import { BadRequestException, HttpException, Inject, Injectable } from "@nestjs/common";
import { marked } from "marked";
import { AI_PROVIDER, ErroDeGeracao, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { rotuloDaSerie, type Serie } from "../comum/series";
import { ehUuid, naoEncontrado } from "../motor/guardas";
import { PrismaService } from "../prisma/prisma.service";
import { ObjectStorageService } from "../object-storage/object-storage.service";
import { rotuloDaDisciplina, tituloDoPlano, type CriarPlano } from "./catalogo";
import { PROMPT_PLANO_DE_AULA } from "./prompt-plano-de-aula";
import { sanitizarHtmlDoPlano } from "./sanitizar";
import { TEMPLATE_PLANO } from "./template-plano";

/**
 * Plano de aula (exp-90): geração ASSÍNCRONA de um plano anual + persistência
 * do que o professor edita.
 *
 * É o `geracao/worker.ts` em miniatura: uma única chamada de IA por plano, sem
 * fila nem advisory lock — o claim atômico (`updateMany` condicionado ao
 * status) já garante que duas instâncias não gerem o mesmo plano. O registro
 * de execuções vive no `globalThis` pelo mesmo motivo do worker (em dev cada
 * reload carrega o módulo de novo).
 *
 *   pendente ──claim──▶ gerando ──ok──▶ pronto
 *                          └──falha/estouro──▶ erro
 *
 * CONTEÚDO fica no object storage privado; a tabela guarda metadados, status
 * e caminhos. Toda leitura/escrita passa por `comTenancy(fn, escolaId)` com a
 * escola EXPLÍCITA (o worker roda fora de requisição) E filtra
 * `escola_id`/`professor_id` — regra 1 do CLAUDE.md.
 */

const registroGlobal = globalThis as unknown as { planosGerando?: Map<string, Promise<void>> };
registroGlobal.planosGerando ??= new Map<string, Promise<void>>();
const emExecucao = registroGlobal.planosGerando;

/** Tentativas de RETOMADA de geração interrompida (restart/deploy), não de falha da IA. */
const MAX_TENTATIVAS = 2;
/** Geração `gerando` há mais que isto sem worker nesta instância = órfã. */
const MINUTOS_PARA_ORFAO = 12;
/**
 * O original pedia 32k — era o teto do Claude via OpenRouter. MEDIDO no
 * gemini-2.5-flash com o material real (currículo de Cajamar + 4 unidades do
 * 8º ano): o plano é cortado em 32k e a geração termina em `MAX_TOKENS`, sem
 * plano nenhum. A família 2.5 entrega até 65k de saída; 64k dá a folga que
 * falta sem chegar no limite duro.
 */
const MAX_TOKENS_SAIDA = 64_000;

export const STATUS_PLANO = ["pendente", "gerando", "pronto", "erro"] as const;
export type StatusPlano = (typeof STATUS_PLANO)[number];

const SELECAO_META = {
  id: true,
  serie: true,
  disciplina: true,
  titulo: true,
  status: true,
  erro: true,
  tokensUsados: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface DepsDosPlanos {
  prisma: PrismaService;
  storage: ObjectStorageService;
  provider: AiProvider;
  quota: QuotaService;
}

@Injectable()
export class PlanosService {
  private readonly deps: DepsDosPlanos;

  constructor(
    prisma: PrismaService,
    storage: ObjectStorageService,
    @Inject(AI_PROVIDER) provider: AiProvider,
    quota: QuotaService,
  ) {
    this.deps = { prisma, storage, provider, quota };
  }

  // ------------------------------------------------------------ referências

  /**
   * O que dá para gerar: disciplinas com pelo menos UMA referência específica
   * de série (porta a regra do origem: pasta do ano vazia bloqueia a geração;
   * o currículo geral sozinho não libera).
   */
  async disponiveis(): Promise<Array<{ disciplina: string; rotulo: string; series: Serie[] }>> {
    const linhas = await this.deps.prisma.planoReferencia.findMany({
      where: { serie: { not: null } },
      select: { disciplina: true, serie: true },
      distinct: ["disciplina", "serie"],
      orderBy: [{ disciplina: "asc" }, { serie: "asc" }],
    });
    const porDisciplina = new Map<string, Set<string>>();
    for (const linha of linhas) {
      if (!linha.serie) continue;
      const series = porDisciplina.get(linha.disciplina) ?? new Set<string>();
      series.add(linha.serie);
      porDisciplina.set(linha.disciplina, series);
    }
    return [...porDisciplina.entries()].map(([disciplina, series]) => ({
      disciplina,
      rotulo: rotuloDaDisciplina(disciplina),
      series: ordenarSeries([...series] as Serie[]),
    }));
  }

  /** Template + gerais + específicas, na ORDEM e com as molduras do origem. */
  async montarPrompt(disciplina: string, serie: Serie): Promise<string> {
    const referencias = await this.deps.prisma.planoReferencia.findMany({
      where: { disciplina, OR: [{ serie: null }, { serie }] },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      select: { serie: true, nome: true, texto: true },
    });
    const gerais = referencias.filter((r) => r.serie === null);
    const especificas = referencias.filter((r) => r.serie === serie);
    if (especificas.length === 0) {
      throw new BadRequestException({
        codigo: "SEM_REFERENCIA",
        mensagem: `Ainda não há material de referência cadastrado para ${rotuloDaDisciplina(disciplina)} — ${rotuloDaSerie(serie)}. Peça para importarem o currículo da rede e o material didático desta série antes de gerar o plano.`,
      });
    }

    const blocos: string[] = [
      `DOCUMENTO DE REFERÊNCIA OBRIGATÓRIA: o texto a seguir é o template de estrutura que TODOS os planos de aula devem seguir. Use exatamente esta organização de seções, formatação e nível de detalhe como modelo. Adapte o conteúdo à disciplina e ano solicitados, mas mantenha a mesma estrutura.\n\n${TEMPLATE_PLANO}`,
      ...gerais.map(
        (r) =>
          `--- DOCUMENTO DE REFERÊNCIA GERAL DA DISCIPLINA (vale para todos os anos): ${r.nome} ---\n\n${r.texto}`,
      ),
      ...especificas.map((r) => `--- DOCUMENTO DE REFERÊNCIA DA REDE: ${r.nome} ---\n\n${r.texto}`),
      `Por favor, gere o Plano Anual para:\n\n- Ano escolar: ${rotuloDaSerie(serie)}\n- Componente curricular: ${rotuloDaDisciplina(disciplina)}\n\nUtilize os documentos do professor como base (currículo da rede e material didático). Siga RIGOROSAMENTE a estrutura do template de referência fornecido e os critérios de qualidade definidos nas suas instruções.`,
    ];
    return blocos.join("\n\n");
  }

  // ------------------------------------------------------------------ CRUD

  async listar(escolaId: string, professorId: string) {
    const planos = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeAula.findMany({
          where: { escolaId, professorId },
          orderBy: { updatedAt: "desc" },
          select: SELECAO_META,
        }),
      escolaId,
    );
    return { planos: planos.map(apresentar) };
  }

  /**
   * Cria o registro (`pendente`) e dispara a geração em background. A
   * resposta é imediata (202): o cliente acompanha por `obter`.
   */
  async criar(escolaId: string, professorId: string, perfil: Perfil, dados: CriarPlano) {
    // Quota ANTES de qualquer trabalho — regra 5 do CLAUDE.md.
    if (!(await this.deps.quota.temSaldo(escolaId, professorId, perfil))) {
      throw new HttpException(
        { codigo: "QUOTA", mensagem: "Sua quota diária de geração com IA acabou. Tente amanhã." },
        429,
      );
    }
    // Referência antes de criar a linha: sem material, nada a gerar.
    await this.montarPrompt(dados.disciplina, dados.serie);

    const emCurso = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeAula.count({
          where: { escolaId, professorId, status: { in: ["pendente", "gerando"] } },
        }),
      escolaId,
    );
    if (emCurso > 0) {
      throw new HttpException(
        { codigo: "JA_GERANDO", mensagem: "Você já tem um plano sendo gerado. Aguarde ele terminar." },
        409,
      );
    }

    const plano = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeAula.create({
          data: {
            escolaId,
            professorId,
            serie: dados.serie,
            disciplina: dados.disciplina,
            titulo: tituloDoPlano(dados.disciplina, dados.serie),
            status: "pendente",
          },
          select: { id: true },
        }),
      escolaId,
    );

    this.dispararGeracao(escolaId, plano.id);
    return { id: plano.id };
  }

  /** Metadados + HTML atual (quando pronto). Também retoma geração órfã. */
  async obter(escolaId: string, professorId: string, id: string) {
    const plano = await this.planoDoProfessor(escolaId, professorId, id);
    await this.retomarSeOrfao(escolaId, plano);
    const html =
      plano.status === "pronto" && plano.caminhoHtml
        ? await this.deps.storage.lerTexto(plano.caminhoHtml)
        : null;
    return { plano: apresentar(plano), html };
  }

  /** O botão Salvar: sanitiza e sobrescreve `atual.html`. */
  async salvarConteudo(escolaId: string, professorId: string, id: string, html: string) {
    const plano = await this.planoDoProfessor(escolaId, professorId, id);
    if (plano.status !== "pronto") {
      throw new HttpException(
        { codigo: "NAO_PRONTO", mensagem: "Esse plano ainda não terminou de ser gerado." },
        409,
      );
    }
    const limpo = sanitizarHtmlDoPlano(html);
    const caminho = plano.caminhoHtml ?? caminhoDoObjeto(escolaId, id, "atual.html");
    await this.deps.storage.salvar(caminho, limpo, "text/html; charset=utf-8");
    await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeAula.updateMany({
          where: { id, escolaId, professorId },
          data: { caminhoHtml: caminho, updatedAt: new Date() },
        }),
      escolaId,
    );
    return { ok: true, salvoEm: new Date().toISOString(), bytes: Buffer.byteLength(limpo, "utf8") };
  }

  async renomear(escolaId: string, professorId: string, id: string, titulo: string) {
    await this.planoDoProfessor(escolaId, professorId, id);
    await this.deps.prisma.comTenancy(
      (tx) => tx.planoDeAula.updateMany({ where: { id, escolaId, professorId }, data: { titulo } }),
      escolaId,
    );
    return { ok: true };
  }

  /** Volta ao Markdown original da IA (reconvertido) — desfaz a edição. */
  async restaurar(escolaId: string, professorId: string, id: string) {
    const plano = await this.planoDoProfessor(escolaId, professorId, id);
    if (plano.status !== "pronto" || !plano.caminhoGeradoMd) {
      throw new HttpException(
        { codigo: "NAO_PRONTO", mensagem: "Esse plano ainda não tem versão original para restaurar." },
        409,
      );
    }
    const markdown = await this.deps.storage.lerTexto(plano.caminhoGeradoMd);
    if (!markdown) naoEncontrado();
    const html = await markdownParaHtml(markdown);
    const caminho = plano.caminhoHtml ?? caminhoDoObjeto(escolaId, id, "atual.html");
    await this.deps.storage.salvar(caminho, html, "text/html; charset=utf-8");
    await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeAula.updateMany({
          where: { id, escolaId, professorId },
          data: { caminhoHtml: caminho, updatedAt: new Date() },
        }),
      escolaId,
    );
    return { ok: true, html };
  }

  /** Linha primeiro, objetos depois (falha no storage só loga — padrão do AssetsService). */
  async excluir(escolaId: string, professorId: string, id: string) {
    await this.planoDoProfessor(escolaId, professorId, id);
    if (emExecucao.has(id)) {
      throw new HttpException(
        { codigo: "GERANDO", mensagem: "Espere a geração terminar para excluir este plano." },
        409,
      );
    }
    await this.deps.prisma.comTenancy(
      (tx) => tx.planoDeAula.deleteMany({ where: { id, escolaId, professorId } }),
      escolaId,
    );
    await this.deps.storage.apagarPrefixo(prefixoDoPlano(escolaId, id));
    return { ok: true };
  }

  // -------------------------------------------------------------- geração

  geracaoAtiva(planoId: string): boolean {
    return emExecucao.has(planoId);
  }

  /** Dispara (ou retoma) a geração em background nesta instância. */
  dispararGeracao(escolaId: string, planoId: string): void {
    if (emExecucao.has(planoId)) return;
    const execucao = this.executarGeracao(escolaId, planoId)
      .catch((erro) => {
        console.error("[planos] geração falhou fora do fluxo tratado", planoId, erro);
      })
      .finally(() => {
        emExecucao.delete(planoId);
      });
    emExecucao.set(planoId, execucao);
  }

  /** Aguarda a geração em curso desta instância (testes). */
  async aguardarGeracao(planoId: string): Promise<void> {
    await emExecucao.get(planoId);
  }

  private async executarGeracao(escolaId: string, planoId: string): Promise<void> {
    const limiteOrfao = new Date(Date.now() - MINUTOS_PARA_ORFAO * 60_000);
    // Claim atômico: só `pendente`, ou `gerando` velho o bastante para ser
    // órfão. Uma geração em voo em OUTRA instância tem iniciadoEm recente e
    // não é reclamada.
    const claim = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeAula.updateMany({
          where: {
            id: planoId,
            escolaId,
            OR: [{ status: "pendente" }, { status: "gerando", iniciadoEm: { lt: limiteOrfao } }],
          },
          data: { status: "gerando", iniciadoEm: new Date(), tentativas: { increment: 1 }, erro: null },
        }),
      escolaId,
    );
    if (claim.count === 0) return;

    const plano = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeAula.findFirst({
          where: { id: planoId, escolaId },
          select: { professorId: true, disciplina: true, serie: true },
        }),
      escolaId,
    );
    if (!plano) return;

    const falhar = (mensagem: string) =>
      this.deps.prisma.comTenancy(
        (tx) =>
          tx.planoDeAula.updateMany({
            where: { id: planoId, escolaId },
            data: { status: "erro", erro: mensagem.slice(0, 500) },
          }),
        escolaId,
      );

    try {
      const user = await this.montarPrompt(plano.disciplina, plano.serie as Serie);

      // A chamada de IA fica FORA de transação (leva minutos).
      const resultado = await this.deps.provider.generate({
        system: PROMPT_PLANO_DE_AULA,
        user,
        maxTokens: MAX_TOKENS_SAIDA,
        modelo: "longo",
        temperatura: 0.7,
      });

      // O consumo conta mesmo se o resultado for rejeitado abaixo: o token foi gasto.
      if (resultado.tokensUsados > 0) {
        await this.deps.quota.consumir(escolaId, plano.professorId, resultado.tokensUsados);
      }

      if (resultado.finishReason === "MAX_TOKENS") {
        throw new ErroDeGeracao(
          "O plano ficou grande demais e foi cortado antes de terminar. Tente gerar de novo — se persistir, avise o suporte.",
        );
      }
      const markdown = resultado.texto.trim();
      if (!markdown) throw new ErroDeGeracao("A geração terminou sem conteúdo. Tente novamente.");

      const html = await markdownParaHtml(markdown);
      const caminhoGeradoMd = caminhoDoObjeto(escolaId, planoId, "gerado.md");
      const caminhoHtml = caminhoDoObjeto(escolaId, planoId, "atual.html");
      await this.deps.storage.salvar(caminhoGeradoMd, markdown, "text/markdown; charset=utf-8");
      await this.deps.storage.salvar(caminhoHtml, html, "text/html; charset=utf-8");

      await this.deps.prisma.comTenancy(
        (tx) =>
          tx.planoDeAula.updateMany({
            where: { id: planoId, escolaId },
            data: {
              status: "pronto",
              erro: null,
              tokensUsados: resultado.tokensUsados,
              caminhoGeradoMd,
              caminhoHtml,
            },
          }),
        escolaId,
      );
    } catch (erro) {
      const mensagem =
        erro instanceof HttpException
          ? mensagemDaExcecao(erro)
          : erro instanceof Error
            ? erro.message
            : "erro desconhecido";
      // `fetch failed` NUNCA diz nada sozinho: a razão real (DNS, TLS,
      // dispatcher incompatível) vive só em `cause`. Sem imprimi-la, uma
      // incompatibilidade de undici passou dias parecendo falha de credencial.
      // Só o log — a `mensagem` que vai ao banco é a que o professor lê.
      const causa = erro instanceof Error && erro.cause instanceof Error ? ` (causa: ${erro.cause.message})` : "";
      console.error("[planos] geração com erro", planoId, mensagem.slice(0, 200) + causa);
      await falhar(mensagem);
    }
  }

  /**
   * `pendente`/`gerando` sem worker nesta instância: ou o processo morreu no
   * meio (restart/deploy) ou é outra instância gerando. Só o tempo separa os
   * dois casos — daí a janela de `MINUTOS_PARA_ORFAO`.
   */
  private async retomarSeOrfao(escolaId: string, plano: PlanoCompleto): Promise<void> {
    if (plano.status !== "pendente" && plano.status !== "gerando") return;
    if (emExecucao.has(plano.id)) return;
    const velho =
      plano.status === "pendente" ||
      !plano.iniciadoEm ||
      plano.iniciadoEm.getTime() < Date.now() - MINUTOS_PARA_ORFAO * 60_000;
    if (!velho) return;

    if (plano.tentativas < MAX_TENTATIVAS) {
      this.dispararGeracao(escolaId, plano.id);
      return;
    }
    await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeAula.updateMany({
          where: { id: plano.id, escolaId, status: { in: ["pendente", "gerando"] } },
          data: { status: "erro", erro: "A geração foi interrompida. Gere o plano novamente." },
        }),
      escolaId,
    );
    plano.status = "erro";
    plano.erro = "A geração foi interrompida. Gere o plano novamente.";
  }

  // --------------------------------------------------------------- posse

  private async planoDoProfessor(escolaId: string, professorId: string, id: string): Promise<PlanoCompleto> {
    if (!ehUuid(id)) naoEncontrado();
    const plano = await this.deps.prisma.comTenancy(
      (tx) => tx.planoDeAula.findFirst({ where: { id, escolaId, professorId } }),
      escolaId,
    );
    if (!plano) naoEncontrado();
    return plano;
  }
}

// ------------------------------------------------------------------ helpers

type PlanoCompleto = {
  id: string;
  escolaId: string;
  professorId: string;
  serie: string;
  disciplina: string;
  titulo: string;
  status: string;
  tentativas: number;
  iniciadoEm: Date | null;
  erro: string | null;
  tokensUsados: number;
  caminhoGeradoMd: string | null;
  caminhoHtml: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function apresentar(plano: {
  id: string;
  serie: string;
  disciplina: string;
  titulo: string;
  status: string;
  erro: string | null;
  tokensUsados: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plano.id,
    serie: plano.serie,
    serieRotulo: rotuloDaSerie(plano.serie as Serie),
    disciplina: plano.disciplina,
    disciplinaRotulo: rotuloDaDisciplina(plano.disciplina),
    titulo: plano.titulo,
    status: plano.status as StatusPlano,
    erro: plano.erro,
    tokensUsados: plano.tokensUsados,
    criadoEm: plano.createdAt.toISOString(),
    atualizadoEm: plano.updatedAt.toISOString(),
  };
}

export type PlanoApresentado = ReturnType<typeof apresentar>;

function prefixoDoPlano(escolaId: string, planoId: string): string {
  return `planos/${escolaId}/${planoId}`;
}

function caminhoDoObjeto(escolaId: string, planoId: string, arquivo: "gerado.md" | "atual.html"): string {
  return `${prefixoDoPlano(escolaId, planoId)}/${arquivo}`;
}

/** `marked` UMA vez, na api (o cliente não converte nada). GFM (tabelas) é o default. */
export async function markdownParaHtml(markdown: string): Promise<string> {
  const html = await marked.parse(markdown, { gfm: true, breaks: false });
  // O que a IA devolve também passa pela allowlist: é HTML que vai para o
  // navegador, e um modelo pode ser induzido a emitir <script>.
  return sanitizarHtmlDoPlano(html);
}

function ordenarSeries(series: Serie[]): Serie[] {
  const peso = (s: Serie) => (s.endsWith("EM") ? 100 : 0) + Number(s[0]);
  return [...series].sort((a, b) => peso(a) - peso(b));
}

function mensagemDaExcecao(erro: HttpException): string {
  const corpo = erro.getResponse();
  if (typeof corpo === "string") return corpo;
  const mensagem = (corpo as { mensagem?: unknown }).mensagem;
  return typeof mensagem === "string" ? mensagem : erro.message;
}
