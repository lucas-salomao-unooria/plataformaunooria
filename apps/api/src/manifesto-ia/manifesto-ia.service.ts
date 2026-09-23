import { Injectable } from "@nestjs/common";
import { Prisma, type Exp08ef4bSessao } from "@prisma/client";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { PrismaService } from "../prisma/prisma.service";
import {
  CLAUSULAS_DEFAULT,
  CONCESSAO_DO_BOT,
  CONTEXTO_DEFAULT,
  INSIGNIA,
  PERGUNTA_DA_REFLEXAO,
  PISO_DA_JUSTIFICATIVA,
  PODCAST,
  PRINCIPIOS_EM_DISPUTA,
  PROMPTS_DEFAULT,
  PROMPTS_EXIGIDOS,
  TAGS,
  TAGS_EXIGIDAS,
  TETO_DA_JUSTIFICATIVA,
  acharClausula,
  acharPrompt,
  clausulasPublicas,
  promptsPublicos,
  type ClausulaDeGovernanca,
  type ContextoDaTurma,
  type PromptDeAuditoria,
} from "./catalogo";
import { erroDeJogo } from "./erros";
import { paraLog } from "./invariantes";
import { logger } from "../observabilidade/logger";
import { estadoDaAuditoria, disparar } from "./regras/auditoria";
import { DELAY_DA_GOVERNANCA_MS, compilarManifesto } from "./regras/manifesto";
import { padroesEm } from "./regras/moderacao";
import {
  ETAPA_DA_ACAO,
  ETAPA_INICIAL,
  PASSO_INICIAL,
  aguardandoATurma,
  avancarAte,
  normalizarEtapa,
  normalizarPasso,
  passoEfetivo,
  type AcaoDoGate,
  type Etapa,
  type Passo,
} from "./regras/passos";
import type { PacoteDeConteudo } from "./preparo.service";

/**
 * Persistência e regras aplicadas da exp08ef4b.
 *
 * Assinaturas recebem `escolaId`/`estudanteId` explícitos (não o request) — os
 * testes de integração chamam direto, e toda query leva `escola_id` no `where`
 * ALÉM da RLS que o `comTenancy` arma (regra inviolável nº 1, defesa em
 * profundidade).
 *
 * **Zero IA em sala.** A única chamada ao `apps/api/src/ai` desta experiência
 * está em `preparo.service.ts`, e ela roda ANTES da aula, com o professor
 * olhando. Réplicas da máquina, cláusulas e o manifesto compilado saem do
 * pacote da turma ou do catálogo curado: nenhuma aula de 50 minutos depende de
 * o Vertex estar de pé, e nenhum token de estudante é gasto (RNF-CUST).
 */

/** O id que a guarda de liberação (ADR-69) e o manifesto compartilham. */
export const EXP_ID = "exp08ef4b";

/** Minutos sem ação para o painel marcar ociosidade. O alerta é para a docente
 *  ir até a carteira, não para punir. */
export const MINUTOS_PARA_OCIOSO = 3;

// ───────────────────────────────────────────────────────── estado da sessão

interface EstadoSessao {
  passo: Passo;
  clausulaId: string | null;
  latenciaClausulaSeg: number | null;
  confirmouProvocacao: boolean;
  manifestoMarkdown: string | null;
  concluidoEm: Date | null;
}

const ESTADO_INICIAL: EstadoSessao = {
  passo: PASSO_INICIAL,
  clausulaId: null,
  latenciaClausulaSeg: null,
  confirmouProvocacao: false,
  manifestoMarkdown: null,
  concluidoEm: null,
};

type LinhaDaSessao = Pick<
  Exp08ef4bSessao,
  | "passo"
  | "clausulaId"
  | "latenciaClausulaSeg"
  | "confirmouProvocacao"
  | "manifestoMarkdown"
  | "concluidoEm"
>;

function paraEstado(linha: LinhaDaSessao | null | undefined): EstadoSessao {
  if (!linha) return { ...ESTADO_INICIAL };
  return {
    passo: normalizarPasso(linha.passo),
    clausulaId: linha.clausulaId,
    latenciaClausulaSeg: linha.latenciaClausulaSeg,
    confirmouProvocacao: linha.confirmouProvocacao,
    manifestoMarkdown: linha.manifestoMarkdown,
    concluidoEm: linha.concluidoEm,
  };
}

/**
 * O estado como o CLIENTE o recebe.
 *
 * Note que `manifestoMarkdown` é `null` antes da decisão: o documento não
 * existe até a cláusula ser fixada, e devolver um esqueleto com o lugar da
 * cláusula em branco entregaria a cena da Etapa 4 antes da hora.
 */
export interface EstadoPublico {
  passo: Passo;
  passoDoEstudante: Passo;
  aguardandoATurma: boolean;
  promptsEnviados: string[];
  totalAuditorias: number;
  cotaAtingida: boolean;
  faltamAuditorias: number;
  clausulaId: string | null;
  manifestoMarkdown: string | null;
  registrouPercurso: boolean;
  concluidoEm: string | null;
  turma: { etapa: Etapa };
}

/** O pacote que vale para esta turma, e de onde ele veio. */
interface ConteudoEfetivo extends PacoteDeConteudo {
  origem: "turma" | "default";
}

function minutosDesde(quando: Date, agora: Date): number {
  return Math.floor((agora.getTime() - quando.getTime()) / 60_000);
}

@Injectable()
export class ManifestoIaService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────── leitura da sessão

  /** Boot da experiência — READ-ONLY: sem linha, devolve o estado inicial. */
  async sessao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const [linha, etapa, auditorias, percurso, conteudo] = await Promise.all([
        tx.exp08ef4bSessao.findUnique({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
        }),
        this.etapaDaTurma(tx, escolaId, turmaId),
        this.promptsDisparados(tx, escolaId, estudanteId),
        tx.exp08ef4bPercurso.findUnique({
          where: { escolaId_estudanteId: { escolaId, estudanteId } },
        }),
        this.conteudoDaTurma(tx, escolaId, turmaId),
      ]);

      const estado = paraEstado(linha);
      return {
        ...this.publico(estado, auditorias, etapa, Boolean(percurso)),
        catalogo: {
          contexto: conteudo.contexto,
          origemDoConteudo: conteudo.origem,
          // Sem `replicaIa`: o tipo é `PromptPublico`, então a defesa da
          // máquina é impossível de vazar aqui, não só ausente por descuido.
          prompts: promptsPublicos(conteudo.prompts),
          // Sem `justificativaSugerida` — material do professor. Mostrá-la
          // transformaria a autoria da Etapa 5 em cópia.
          clausulas: clausulasPublicas(conteudo.clausulas),
          promptsExigidos: PROMPTS_EXIGIDOS,
          concessaoDoBot: CONCESSAO_DO_BOT,
          principiosEmDisputa: PRINCIPIOS_EM_DISPUTA,
          tags: TAGS.map((t) => ({ ...t })),
          tagsExigidas: TAGS_EXIGIDAS,
          pisoDaJustificativa: PISO_DA_JUSTIFICATIVA,
          tetoDaJustificativa: TETO_DA_JUSTIFICATIVA,
          perguntaDaReflexao: PERGUNTA_DA_REFLEXAO,
          insignia: INSIGNIA,
          podcast: PODCAST,
          delayDaGovernancaMs: DELAY_DA_GOVERNANCA_MS,
        },
        /* A conversa reconstituída — é o que faz o F5 devolver a tela exata em
           vez do chat vazio. As réplicas das perguntas JÁ FEITAS entram: a
           criança as leu, e esconder o que ela já viu seria perder o histórico
           que o clone do ChatGPT mostra por natureza. */
        falas: this.falasDe(conteudo, auditorias, estado),
        percurso: percurso
          ? { tags: percurso.tags, justificativa: percurso.justificativaTexto }
          : null,
        estudante: { nome: estudante.displayName },
      };
    }, escolaId);
  }

  /**
   * O POLLING DO CHECKPOINT A — leve de propósito: sem catálogo, sem conversa.
   *
   * É a alternativa ao WebSocket que a ADR-93 registra: a tela do estudante
   * chama isto a cada 5 segundos durante a Etapa 4, e a professora congela 30
   * telas mudando UMA linha em `exp08ef4b_gates_turma`.
   *
   * O custo é conhecido e comportado: 35 estudantes a cada 5s = 7 req/s por
   * turma, e só durante a Etapa 4. É a mesma ordem de grandeza do gate da
   * exp06ef2b, que roda em produção.
   */
  async gate(escolaId: string, turmaId: string | null, passoBruto?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      const passo = normalizarPasso(passoBruto ?? PASSO_INICIAL);
      return {
        etapa: etapa ?? ETAPA_INICIAL,
        passoEfetivo: passoEfetivo(passo, etapa),
        // O congelamento é AFIRMADO aqui, nunca deduzido pelo cliente: parado
        // no primeiro passo congelado, `passoEfetivo` é igual ao passo e a
        // dedução dá `false` para exatamente quem precisa parar.
        aguardandoATurma: aguardandoATurma(passo, etapa),
        // O instante é do SERVIDOR: o relógio da máquina da escola atrasa, e
        // não é ele que decide o momento da aula.
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────────── as mutações

  /** O estudante saiu do briefing de Amara e abriu a conversa. Idempotente. */
  async abrirConversa(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      const passo = avancarAte(estado.passo, "chat");
      await this.gravarPasso(tx, escolaId, estudanteId, estado.passo, passo);
      const [auditorias, etapa] = await Promise.all([
        this.promptsDisparados(tx, escolaId, estudanteId),
        this.etapaDaTurma(tx, escolaId, turmaId),
      ]);
      return this.publico({ ...estado, passo }, auditorias, etapa, false);
    });
  }

  /**
   * Um questionamento disparado contra a máquina (Etapa 2).
   *
   * A réplica vem NA RESPOSTA, e só aqui: é o único momento em que a defesa da
   * máquina cruza a fronteira do cliente. Antes disso ela não está no bundle
   * nem na sessão — ver a resposta antes de fazer a pergunta desmontaria a
   * cena da auditoria.
   *
   * A cota fecha AQUI, no servidor: quando o segundo prompt distinto entra, o
   * passo anda para `decisao` sozinho. Deixar o cliente pedir a transição seria
   * deixá-lo escolher quando o pico da missão começa — e uma tela que decide
   * isso é uma tela que pode pular o pico.
   */
  async disparar(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    promptId: string,
    latenciaSeg: number,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      if (estado.clausulaId) throw erroDeJogo("clausula-ja-submetida");

      const conteudo = await this.conteudoDaTurma(tx, escolaId, turmaId);
      const jaEnviados = await this.promptsDisparados(tx, escolaId, estudanteId);
      const resultado = disparar(
        jaEnviados,
        promptId,
        conteudo.prompts.map((p) => p.id),
      );
      if (!resultado.ok) throw erroDeJogo(resultado.codigo);

      const prompt = acharPrompt(conteudo.prompts, promptId);
      // `disparar` já validou o id contra a mesma lista; este guarda existe
      // para o TypeScript e para o caso de o pacote da turma mudar entre a
      // validação e a leitura (professora reaprovando no meio da aula).
      if (!prompt) throw erroDeJogo("prompt-desconhecido");

      await tx.exp08ef4bAuditoria.create({
        data: {
          escolaId,
          estudanteId,
          promptId,
          iteracao: jaEnviados.length + 1,
          latenciaSeg,
        },
      });

      const auditoria = estadoDaAuditoria(resultado.enviados);
      const passo = auditoria.cotaAtingida
        ? avancarAte(estado.passo, "decisao")
        : avancarAte(estado.passo, "chat");
      await this.gravarPasso(tx, escolaId, estudanteId, estado.passo, passo);

      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      return {
        ...this.publico({ ...estado, passo }, resultado.enviados, etapa, false),
        replica: prompt.replicaIa,
      };
    });
  }

  /**
   * A cláusula prioritária — LATCH, e o PICO da missão.
   *
   * Aqui a api NÃO corrige nada, e a ausência é o desenho: as quatro cláusulas
   * são salvaguardas válidas, e a lista de métricas proibidas veda calcular
   * acerto entre elas. O que o servidor faz é (a) cobrar a cota de auditoria
   * antes de aceitar, (b) travar a escolha e (c) COMPILAR o manifesto, que é o
   * artefato da missão.
   */
  async submeterClausula(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    clausulaId: string,
    latenciaSeg: number,
    confirmouProvocacao: boolean,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      if (estado.clausulaId) throw erroDeJogo("clausula-ja-submetida");

      const enviados = await this.promptsDisparados(tx, escolaId, estudanteId);
      // A porta que a missão MEDE: fixar a regra do sistema sem tê-lo
      // contraditado. O botão da tela já fica desabilitado, mas a regra vale
      // no servidor — `/manifesto-ia/clausula` é endereço alcançável.
      if (!estadoDaAuditoria(enviados).cotaAtingida) {
        throw erroDeJogo("auditoria-insuficiente");
      }

      const conteudo = await this.conteudoDaTurma(tx, escolaId, turmaId);
      const clausula = acharClausula(conteudo.clausulas, clausulaId);
      if (!clausula) throw erroDeJogo("clausula-desconhecida");

      const manifestoMarkdown = compilarManifesto(conteudo.contexto, clausula);
      const passo = avancarAte(estado.passo, "manifesto");
      await tx.exp08ef4bSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: {
          clausulaId,
          latenciaClausulaSeg: latenciaSeg,
          confirmouProvocacao,
          manifestoMarkdown,
          passo,
        },
      });

      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      return {
        ...this.publico(
          { ...estado, passo, clausulaId, manifestoMarkdown },
          enviados,
          etapa,
          false,
        ),
        manifestoMarkdown,
        delayMs: DELAY_DA_GOVERNANCA_MS,
      };
    });
  }

  /**
   * O "Meu Percurso" — as 2 palavras-chave e o parágrafo autoral. LATCH.
   *
   * **O filtro de dado pessoal roda ANTES de qualquer gravação**, e recusa com
   * 422 sem gravar (a decisão registrada em `regras/moderacao.ts`). O log leva
   * o NOME do padrão que casou e o tamanho do texto — nunca o trecho, que é
   * justamente o dado que a regra está tentando não guardar.
   *
   * Fecha a missão levando o passo a `podcast`: a Etapa 6 é a última, e o
   * `concluir` é dela.
   */
  async registrarPercurso(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    tags: string[],
    justificativa: string,
  ) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");
      if (!estado.clausulaId) throw erroDeJogo("sem-clausula");

      const jaTem = await tx.exp08ef4bPercurso.findUnique({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
      });
      if (jaTem) throw erroDeJogo("percurso-ja-registrado");

      /* O Checkpoint A. A professora congelou a turma para o debate: a
         assinatura individual espera. O 409 é de ESPERA, não de bloqueio — a
         frase de `erros.ts` diz que a discussão está acontecendo. */
      const etapaAtual = await this.etapaDaTurma(tx, escolaId, turmaId);
      if (etapaAtual === "debate") throw erroDeJogo("debate-em-andamento");

      const padroes = padroesEm(justificativa);
      if (padroes.length > 0) {
        logger.info(
          {
            codigo: "exp08ef4b-pii-recusada",
            escolaId,
            padroes,
            tamanho: paraLog(justificativa),
          },
          "parágrafo do percurso recusado por dado pessoal",
        );
        throw erroDeJogo("dado-pessoal-no-texto");
      }

      const texto = justificativa.trim();
      await tx.exp08ef4bPercurso.create({
        data: {
          escolaId,
          estudanteId,
          tags,
          justificativaTexto: texto,
          charsCount: texto.length,
        },
      });

      const passo = avancarAte(estado.passo, "podcast");
      await this.gravarPasso(tx, escolaId, estudanteId, estado.passo, passo);

      const enviados = await this.promptsDisparados(tx, escolaId, estudanteId);
      return this.publico({ ...estado, passo }, enviados, etapaAtual, true);
    });
  }

  /**
   * "Finalizar percurso" — o latch definitivo da missão.
   *
   * Não recebe `score` do cliente, e a ausência é a regra 3 aplicada a uma
   * missão SEM nota: o `exp:concluir` da bridge tem o campo, e aceitar um
   * número dali seria deixar a tela pontuar uma atividade cuja premissa é que
   * as quatro escolhas valem igual. O progresso da plataforma lê `concluido_em`.
   */
  async concluir(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.comSessao(escolaId, estudanteId, turmaId, async (tx, estado) => {
      if (estado.concluidoEm) throw erroDeJogo("missao-concluida");

      const percurso = await tx.exp08ef4bPercurso.findUnique({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
      });
      if (!percurso) throw erroDeJogo("sem-clausula");

      const agora = new Date();
      await tx.exp08ef4bSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { passo: "fim", concluidoEm: agora },
      });

      const enviados = await this.promptsDisparados(tx, escolaId, estudanteId);
      const etapa = await this.etapaDaTurma(tx, escolaId, turmaId);
      return this.publico(
        { ...estado, passo: "fim", concluidoEm: agora },
        enviados,
        etapa,
        true,
      );
    });
  }

  // ──────────────────────────────────────────────────────── lado do professor

  /**
   * As turmas do seletor do painel.
   *
   * `ondeAsTurmasSaoVisiveis` resolve os dois casos num lugar só: o professor
   * vê onde LECIONA, o gestor vê a escola. `professorId` ausente é o gestor —
   * e é por isso que ele é opcional em vez de obrigatório com um valor de
   * mentira.
   */
  async turmas(escolaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return {
        turmas: turmas.map((t) => ({
          id: t.id,
          nome: t.nome,
          serie: t.serie,
          estudantes: t._count.estudantes,
        })),
      };
    }, escolaId);
  }

  /**
   * O painel de mediação ao vivo (E4-PROF-01).
   *
   * O que ele tem: progresso por estudante, a cláusula que cada um fixou, a
   * nuvem agregada de palavras-chave e o parágrafo autoral em leitura nominal.
   * O que ele NÃO tem: nota, taxa de acerto e qualquer ordenação por mérito —
   * `PROIBIDO_NO_PAINEL` tem o teste que cobra a ausência (PED-07 / D6b).
   *
   * A distribuição das quatro cláusulas é o material das três perguntas do
   * debate, e é por isso que ela é contagem simples e não percentual de acerto.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const agora = new Date();

      /**
       * O painel parte de `users`, e NÃO de `matriculas` — a primeira versão
       * partia, e a suíte de Postgres a reprovou com `total: 0`.
       *
       * A razão é a mesma que `comum/liberacao.ts` registra: a verdade da
       * enturmação é `matriculas`, mas `users.turma_id` é o que o resto do
       * runtime lê, e uma criança cuja matrícula ainda não existe — importação
       * pela metade, seed antigo — **tem sala na prática e entra na missão**.
       * Se a porta a deixa entrar e o painel não a mostra, a professora fica
       * com uma tela que nega o que a aula está fazendo.
       */
      const [estudantes, gate] = await Promise.all([
        tx.user.findMany({
          where: { escolaId, turmaId, role: "estudante" },
          select: {
            id: true,
            displayName: true,
            username: true,
            manifestoSessoes: {
              where: { escolaId },
              take: 1,
              select: {
                passo: true,
                clausulaId: true,
                atualizadoEm: true,
                concluidoEm: true,
              },
            },
          },
          orderBy: { displayName: "asc" },
        }),
        this.gateDaTurma(tx, escolaId, turmaId),
      ]);

      const ids = estudantes.map((e) => e.id);
      const [porAuditoria, porPercurso] = await Promise.all([
        ids.length
          ? tx.exp08ef4bAuditoria.groupBy({
              by: ["estudanteId"],
              where: { escolaId, estudanteId: { in: ids } },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        ids.length
          ? tx.exp08ef4bPercurso.findMany({
              where: { escolaId, estudanteId: { in: ids } },
              select: { estudanteId: true, tags: true, justificativaTexto: true },
            })
          : Promise.resolve([]),
      ]);

      const auditoriasDe = new Map(porAuditoria.map((a) => [a.estudanteId, a._count._all]));
      const percursoDe = new Map(porPercurso.map((p) => [p.estudanteId, p]));

      const linhas = estudantes.map((e) => {
        const sessao = e.manifestoSessoes[0];
        const percurso = percursoDe.get(e.id);
        const auditoriasFeitas = auditoriasDe.get(e.id) ?? 0;
        return {
          estudanteId: e.id,
          nome: e.displayName,
          usuario: e.username,
          iniciou: Boolean(sessao),
          passo: normalizarPasso(sessao?.passo),
          auditorias: auditoriasFeitas,
          auditouOMinimo: auditoriasFeitas >= PROMPTS_EXIGIDOS,
          clausulaId: sessao?.clausulaId ?? null,
          tags: percurso?.tags ?? [],
          registrouPercurso: Boolean(percurso),
          // Caixa livre de menor. Está AQUI e só aqui: a rota é a do professor
          // DESTA turma (LGPD art. 14).
          justificativaTexto: percurso?.justificativaTexto ?? null,
          ociosoMin:
            sessao && !sessao.concluidoEm ? minutosDesde(sessao.atualizadoEm, agora) : null,
        };
      });

      const distribuicao: Record<string, number> = {};
      for (const c of CLAUSULAS_DEFAULT) distribuicao[c.id] = 0;
      const tags: Record<string, number> = {};
      for (const t of TAGS) tags[t.id] = 0;
      for (const e of linhas) {
        if (e.clausulaId) distribuicao[e.clausulaId] = (distribuicao[e.clausulaId] ?? 0) + 1;
        for (const t of e.tags) tags[t] = (tags[t] ?? 0) + 1;
      }

      return {
        turma: { ...turma, etapa: gate },
        estudantes: linhas,
        resumo: {
          total: linhas.length,
          iniciaram: linhas.filter((e) => e.iniciou).length,
          auditaram: linhas.filter((e) => e.auditouOMinimo).length,
          fixaramClausula: linhas.filter((e) => e.clausulaId).length,
          assinaram: linhas.filter((e) => e.registrouPercurso).length,
          concluiram: linhas.filter((e) => e.passo === "fim").length,
          ociosos: linhas.filter(
            (e) => e.ociosoMin !== null && e.ociosoMin >= MINUTOS_PARA_OCIOSO,
          ).length,
          distribuicao,
          tags,
        },
      };
    }, escolaId);
  }

  /** O pacote da turma COM o material de mediação. Professor-only. */
  async conteudoParaOProfessor(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await tx.exp08ef4bConteudoTurma.findUnique({
        where: { escolaId_turmaId: { escolaId, turmaId } },
      });
      const conteudo = this.conteudoDaLinha(linha);
      return {
        ...conteudo,
        aprovadoPorProfessor: linha?.aprovadoPorProfessor ?? false,
        usouBancoDefault: linha?.usouBancoDefault ?? true,
        atualizadoEm: linha?.atualizadoEm.toISOString() ?? null,
      };
    }, escolaId);
  }

  /**
   * A homologação do pacote (`Aprovar Conteúdo da Turma`).
   *
   * É o clique que a exigência 8.2 exige, e o que ele grava é o pacote INTEIRO
   * como a professora o deixou depois de editar. `aprovado_por_professor` vira
   * `true` aqui e em nenhum outro lugar — a rota de geração com IA devolve
   * rascunho e não escreve nada.
   */
  async homologar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    pacote: PacoteDeConteudo,
    usouBancoDefault: boolean,
    parametros: { casoContextual: string; focoPrioritario: string },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const dados = {
        casoContextual: parametros.casoContextual,
        focoPrioritario: parametros.focoPrioritario,
        contexto: pacote.contexto as unknown as Prisma.InputJsonValue,
        promptsJson: pacote.prompts as unknown as Prisma.InputJsonValue,
        clausulasJson: pacote.clausulas as unknown as Prisma.InputJsonValue,
        aprovadoPorProfessor: true,
        usouBancoDefault,
      };
      const linha = await tx.exp08ef4bConteudoTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        update: dados,
        create: { escolaId, turmaId, ...dados },
      });
      return {
        ...this.conteudoDaLinha(linha),
        aprovadoPorProfessor: linha.aprovadoPorProfessor,
        usouBancoDefault: linha.usouBancoDefault,
        atualizadoEm: linha.atualizadoEm.toISOString(),
      };
    }, escolaId);
  }

  /** O botão mestre: `Pausar para Debate` / `Retomar Missão`. */
  async mudarGate(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    acao: AcaoDoGate,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const etapa = ETAPA_DA_ACAO[acao];
      const linha = await tx.exp08ef4bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        update: { etapa },
        create: { escolaId, turmaId, etapa },
      });
      return { turma, etapa, atualizadoEm: linha.atualizadoEm.toISOString() };
    }, escolaId);
  }

  /**
   * "Zerar turma" — apaga a execução, PRESERVA o preparo.
   *
   * `exp08ef4b_conteudo_turma` fica: a curadoria custou tempo da professora, e
   * apagá-la junto obrigaria a refazer o preparo para aplicar a missão na
   * turma seguinte no mesmo dia. As auditorias e o percurso caem por CASCADE
   * da sessão — e o gate volta a `missao`, senão a turma nova nasceria
   * congelada num debate que já aconteceu.
   */
  async zerarTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const { count } = await tx.exp08ef4bSessao.deleteMany({ where: { escolaId, turmaId } });
      await tx.exp08ef4bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        update: { etapa: ETAPA_INICIAL },
        create: { escolaId, turmaId, etapa: ETAPA_INICIAL },
      });
      return { sucesso: true as const, registrosApagados: count };
    }, escolaId);
  }

  // ──────────────────────────────────────────────────────────────── internos

  /**
   * O FUNIL de toda entrada de estudante (ADR-69 + ADR-87).
   *
   * A guarda de liberação mora aqui, e não nos controllers, porque rota nova
   * nasce protegida sem ninguém lembrar de protegê-la. `exigirMissaoLiberada`
   * já checa a disponibilidade do recurso antes da liberação por turma.
   */
  private async estudanteDaEscola(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ) {
    const estudante = await tx.user.findUnique({
      where: { id: estudanteId },
      select: { displayName: true, escolaId: true, turmaId: true },
    });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return estudante;
  }

  /** Escola do token E matrícula na turma quando quem pede é professor. */
  private async turmaVisivel(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    professorId?: string,
  ) {
    const turma = await tx.turma.findFirst({
      where: { id: turmaId, escolaId },
      select: { id: true, nome: true, serie: true },
    });
    if (!turma) throw erroDeJogo("turma-nao-encontrada");
    if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) {
      throw erroDeJogo("turma-nao-encontrada");
    }
    return turma;
  }

  /**
   * Núcleo de toda mutação: garante a linha, tranca por (escola, estudante) e
   * roda o trabalho sobre o estado lido já serializado.
   *
   * Dois toques rápidos em "Submeter resposta" viram duas transações em fila, e
   * a segunda relê o estado com a primeira aplicada — daí o
   * `clausula-ja-submetida` em vez de dois manifestos compilados. Os CHECKs do
   * banco são a rede final.
   */
  private comSessao<T>(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    trabalho: (tx: Prisma.TransactionClient, estado: EstadoSessao) => Promise<T>,
  ): Promise<T> {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`manifesto:${escolaId}:${estudanteId}`}, 0))`;
      await tx.$executeRaw`
        INSERT INTO exp08ef4b_sessoes (escola_id, estudante_id, turma_id)
        VALUES (${escolaId}, ${estudanteId}::uuid, ${turmaId}::uuid)
        ON CONFLICT DO NOTHING`;
      /* A turma pode ter mudado depois da primeira visita (transferência no
         meio do ano): o painel lê por turma, e uma linha com a turma antiga
         desapareceria da tela da professora nova. */
      const atual = await tx.exp08ef4bSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
        data: { turmaId },
      });
      return trabalho(tx, paraEstado(atual));
    }, escolaId);
  }

  private async gravarPasso(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    anterior: Passo,
    novo: Passo,
  ) {
    if (novo === anterior) return;
    await tx.exp08ef4bSessao.update({
      where: { escolaId_estudanteId: { escolaId, estudanteId } },
      data: { passo: novo },
    });
  }

  private async promptsDisparados(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<string[]> {
    const linhas = await tx.exp08ef4bAuditoria.findMany({
      where: { escolaId, estudanteId },
      select: { promptId: true },
      orderBy: { iteracao: "asc" },
    });
    return linhas.map((l) => l.promptId);
  }

  private async etapaDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
  ): Promise<Etapa | null> {
    if (!turmaId) return null;
    return this.gateDaTurma(tx, escolaId, turmaId);
  }

  private async gateDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
  ): Promise<Etapa> {
    const linha = await tx.exp08ef4bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      select: { etapa: true },
    });
    return normalizarEtapa(linha?.etapa);
  }

  /**
   * O pacote que vale para esta turma.
   *
   * Sem linha ou sem homologação, o curado da Unooria. **Rascunho não conta**:
   * `aprovado_por_professor: false` é conteúdo que a professora ainda não viu
   * por inteiro, e a exigência 8.2 diz que ele não chega ao estudante.
   */
  private async conteudoDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
  ): Promise<ConteudoEfetivo> {
    if (!turmaId) return { ...this.conteudoDaLinha(null), origem: "default" };
    const linha = await tx.exp08ef4bConteudoTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
    });
    if (!linha?.aprovadoPorProfessor) {
      return { ...this.conteudoDaLinha(null), origem: "default" };
    }
    return { ...this.conteudoDaLinha(linha), origem: "turma" };
  }

  /**
   * Lê o pacote de uma linha, caindo no curado campo por campo.
   *
   * O `Json` do Prisma é `unknown` na prática: o Zod da rota validou na
   * ESCRITA, mas uma linha antiga escrita por uma versão anterior do schema
   * chegaria aqui com a forma velha. Por isso a leitura confere a cardinalidade
   * antes de aceitar — um pacote com 2 cláusulas faria a tela do PICO renderizar
   * meio grid, e o sintoma apareceria na aula, não no deploy.
   */
  private conteudoDaLinha(linha: {
    contexto: Prisma.JsonValue;
    promptsJson: Prisma.JsonValue;
    clausulasJson: Prisma.JsonValue;
  } | null): PacoteDeConteudo {
    const contexto = this.contextoValido(linha?.contexto) ?? { ...CONTEXTO_DEFAULT };
    const prompts = this.listaValida<PromptDeAuditoria>(
      linha?.promptsJson,
      PROMPTS_DEFAULT.length,
      ["id", "rotuloBotao", "textoPrompt", "replicaIa"],
    ) ?? PROMPTS_DEFAULT.map((p) => ({ ...p }));
    const clausulas = this.listaValida<ClausulaDeGovernanca>(
      linha?.clausulasJson,
      CLAUSULAS_DEFAULT.length,
      ["id", "tituloClausula", "artigoTexto", "justificativaSugerida"],
    ) ?? CLAUSULAS_DEFAULT.map((c) => ({ ...c }));
    return { contexto, prompts, clausulas };
  }

  private contextoValido(bruto: Prisma.JsonValue | undefined): ContextoDaTurma | null {
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
    const o = bruto as Record<string, unknown>;
    const campos = ["escola", "casoUsoTitulo", "premissaIaAutoritaria"] as const;
    if (!campos.every((c) => typeof o[c] === "string" && (o[c] as string).length > 0)) {
      return null;
    }
    return {
      escola: o.escola as string,
      casoUsoTitulo: o.casoUsoTitulo as string,
      premissaIaAutoritaria: o.premissaIaAutoritaria as string,
    };
  }

  private listaValida<T>(
    bruto: Prisma.JsonValue | undefined,
    tamanho: number,
    campos: readonly string[],
  ): T[] | null {
    if (!Array.isArray(bruto) || bruto.length !== tamanho) return null;
    const ok = bruto.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        campos.every((c) => typeof (item as Record<string, unknown>)[c] === "string"),
    );
    return ok ? (bruto as unknown as T[]) : null;
  }

  /**
   * A conversa reconstituída, na ordem em que aconteceu.
   *
   * Abre com a tese da máquina, e cada prompt disparado traz o par
   * pergunta/réplica. A concessão do PICO entra quando a cota fecha — é a fala
   * que abre a Etapa 3, e antes disso ela não pode estar na tela.
   */
  private falasDe(
    conteudo: PacoteDeConteudo,
    enviados: readonly string[],
    estado: EstadoSessao,
  ) {
    const falas: Array<{ papel: "user" | "assistant"; texto: string; promptId?: string }> = [
      { papel: "assistant", texto: conteudo.contexto.premissaIaAutoritaria },
    ];
    for (const id of enviados) {
      const prompt = acharPrompt(conteudo.prompts, id);
      if (!prompt) continue;
      falas.push({ papel: "user", texto: prompt.textoPrompt, promptId: id });
      falas.push({ papel: "assistant", texto: prompt.replicaIa, promptId: id });
    }
    if (estadoDaAuditoria(enviados).cotaAtingida) {
      falas.push({ papel: "assistant", texto: CONCESSAO_DO_BOT });
    }
    if (estado.clausulaId) {
      const clausula = acharClausula(conteudo.clausulas, estado.clausulaId);
      if (clausula) {
        falas.push({ papel: "user", texto: clausula.tituloClausula });
      }
    }
    return falas;
  }

  private publico(
    estado: EstadoSessao,
    enviados: readonly string[],
    etapa: Etapa | null,
    registrouPercurso: boolean,
  ): EstadoPublico {
    const auditoria = estadoDaAuditoria(enviados);
    const efetiva = etapa ?? ETAPA_INICIAL;
    return {
      passo: passoEfetivo(estado.passo, etapa),
      passoDoEstudante: estado.passo,
      aguardandoATurma: aguardandoATurma(estado.passo, etapa),
      promptsEnviados: auditoria.enviados,
      totalAuditorias: auditoria.total,
      cotaAtingida: auditoria.cotaAtingida,
      faltamAuditorias: auditoria.faltam,
      clausulaId: estado.clausulaId,
      manifestoMarkdown: estado.manifestoMarkdown,
      registrouPercurso,
      concluidoEm: estado.concluidoEm?.toISOString() ?? null,
      turma: { etapa: efetiva },
    };
  }
}
