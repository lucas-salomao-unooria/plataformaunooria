import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { marked } from "marked";
import { AI_PROVIDER, ErroDeGeracao, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { rotuloDaSerie, type Serie } from "../comum/series";
import { naoEncontrado } from "../motor/guardas";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { logger } from "../observabilidade/logger";
import { ObjectStorageService } from "../object-storage/object-storage.service";
import { sanitizarHtmlDoPlano } from "../planos/sanitizar";
import { componentePorSlug } from "../curriculo/componentes";
import { habilidadePorCodigo, habilidadesDe, habilidadesDeComputacao } from "../curriculo/consulta";
import {
  DIVISOES_DO_ANO,
  SEMANAS_LETIVAS,
  aulasNoAno,
  horasRelogioNoAno,
  type DivisaoDoAno,
} from "../curriculo/carga-horaria";
import {
  aulasDaSemana,
  conferirGrade,
  semanasDoAnoLetivo,
  nomeDoDia,
  periodosDoAnoLetivo,
  paraDataCivil,
  type DataCivil,
  type FaixaDeHorario,
} from "./calendario";
import { costurarAulas } from "./costura";
import { PROMPT_PLANO_ANUAL } from "./prompt-plano-anual";
import { PROMPT_PLANO_DE_PERIODO, SCHEMA_PLANO_DE_PERIODO } from "./prompt-plano-de-periodo";
import type { Aula, CriarConfiguracao } from "./contrato-de-rotas";

/**
 * app-92 — plano de ensino. Dois níveis de geração assíncrona sobre a mesma
 * máquina de estados da app-90:
 *
 *   pendente ──claim──▶ gerando ──ok──▶ pronto
 *                          └──falha──▶ erro
 *
 * O claim atômico (`updateMany` condicionado ao status) é o que impede duas
 * instâncias de Cloud Run de gerar o mesmo plano — sem fila e sem lock.
 *
 * TENANCY: toda leitura e escrita passa por `comTenancy(fn, escolaId)` com a
 * escola EXPLÍCITA (a geração corre fora da requisição) E filtra
 * `escola_id`/`professor_id`. Regra 1 do AGENTS.md, e aqui ela tem um segundo
 * motivo: o plano de ensino é trabalho intelectual assinado por um professor.
 *
 * ONDE MORA CADA COISA — e a divisão importa:
 *   · a DECISÃO do professor (que habilidade cai em que bimestre) é dado
 *     estruturado no banco, em `distribuicao`;
 *   · o plano anual é PROSA e vai para o object storage privado;
 *   · as aulas do plano de período são DADO ESTRUTURADO (`aulas` JSONB).
 * É essa última que permite ao professor editar a aula de quinta sem reescrever
 * a semana, e ao sistema saber o que já foi planejado e o que ele cumpriu.
 */

const registroGlobal = globalThis as unknown as {
  planejamentoGerando?: Map<string, Promise<void>>;
};
registroGlobal.planejamentoGerando ??= new Map<string, Promise<void>>();
const emExecucao = registroGlobal.planejamentoGerando;

/** Retomada de geração interrompida por restart/deploy, não de falha da IA. */
const MAX_TENTATIVAS = 2;
/** `gerando` há mais que isto sem worker nesta instância = órfã. */
const MINUTOS_PARA_ORFAO = 12;
/**
 * O plano anual é o documento mais longo que a plataforma gera. MEDIDO na
 * app-90: 32k corta o plano no meio e a geração morre em `MAX_TOKENS` sem
 * entregar nada. Até 65k de saída foi a medição histórica no gemini-2.5-flash;
 * reconferir no modelo atual (`VERTEX_MODEL_LONGO`) antes de tratar 64k como teto.
 */
const MAX_TOKENS_ANUAL = 64_000;
/** Uma semana tem no máximo ~10 aulas; o JSON de cada uma é generoso. */
const MAX_TOKENS_PERIODO = 32_000;

/**
 * A causa técnica para o LOG, nunca para a coluna `erro` — essa o professor lê
 * na tela, e "Vertex respondeu 403" não é recado para ele. `ErroDeGeracao`
 * carrega o corpo do vendor em `detalhe`, e descartá-lo era o que fazia o log
 * dizer só "Falha ao gerar conteúdo estruturado" enquanto a razão real
 * (schema ausente, 403, JSON truncado) morria no catch.
 */
function detalheDe(erro: unknown): { detalhe?: string } {
  return erro instanceof ErroDeGeracao && erro.detalhe ? { detalhe: erro.detalhe } : {};
}

export interface DepsDoPlanejamento {
  prisma: PrismaService;
  storage: ObjectStorageService;
  provider: AiProvider;
  quota: QuotaService;
}

@Injectable()
export class PlanejamentoService {
  private readonly deps: DepsDoPlanejamento;

  constructor(
    prisma: PrismaService,
    storage: ObjectStorageService,
    quota: QuotaService,
    @Inject(AI_PROVIDER) provider: AiProvider,
  ) {
    this.deps = { prisma, storage, provider, quota };
  }

  // ═══════════════════════════════════════════════════════ configurações

  async criarConfiguracao(escolaId: string, professorId: string, dados: CriarConfiguracao) {
    const componente = componentePorSlug(dados.componente);
    if (!componente) {
      throw new BadRequestException(`componente desconhecido: ${dados.componente}`);
    }
    if (!componente.anos.includes(dados.serie)) {
      // Não é preciosismo: Biologia no 9º ano ou Ensino Religioso no EM
      // produziriam um plano sem uma única habilidade, e o professor levaria a
      // culpa de um documento vazio.
      throw new BadRequestException(
        `${componente.rotulo} não é ofertado no ${rotuloDaSerie(dados.serie as Serie)}`,
      );
    }
    if (!habilidadesDe(dados.componente, dados.serie).length) {
      throw new BadRequestException(
        `sem habilidades da BNCC para ${componente.rotulo} no ${rotuloDaSerie(dados.serie as Serie)}`,
      );
    }

    return this.deps.prisma.comTenancy(async (tx) => {
      const criada = await tx.planoDeEnsinoConfiguracao.upsert({
        where: {
          escolaId_professorId_anoLetivo_serie_componente: {
            escolaId,
            professorId,
            anoLetivo: dados.anoLetivo,
            serie: dados.serie,
            componente: dados.componente,
          },
        },
        create: {
          escolaId,
          professorId,
          anoLetivo: dados.anoLetivo,
          serie: dados.serie,
          componente: dados.componente,
          turmaId: dados.turmaId ?? null,
          divisaoDoAno: dados.divisaoDoAno,
          minutosPorAula: dados.minutosPorAula,
          aulasSemanais: dados.aulasSemanais,
          grade: dados.grade,
          incluirComputacao: dados.incluirComputacao,
          inicioDoAnoLetivo: new Date(`${dados.inicioDoAnoLetivo}T12:00:00Z`),
        },
        update: {
          turmaId: dados.turmaId ?? null,
          divisaoDoAno: dados.divisaoDoAno,
          minutosPorAula: dados.minutosPorAula,
          aulasSemanais: dados.aulasSemanais,
          grade: dados.grade,
          incluirComputacao: dados.incluirComputacao,
          inicioDoAnoLetivo: new Date(`${dados.inicioDoAnoLetivo}T12:00:00Z`),
        },
      });
      // O início do ano letivo não é coluna: vem de `periodos_letivos`, que é
      // catálogo do CONTRATO — a rede inteira compartilha o calendário, e
      // duplicá-lo por professor criaria N calendários divergentes.
      await this.guardarInicioDoAno(tx, dados.anoLetivo, dados.inicioDoAnoLetivo);
      return criada;
    }, escolaId);
  }

  /**
   * O ano letivo vive em `periodos_letivos` (sem `escola_id`, catálogo do
   * contrato). Se a rede ainda não o cadastrou, o primeiro professor que
   * configurar um plano o cria — melhor que travar o produto esperando uma
   * importação administrativa que pode não ter acontecido.
   */
  private async guardarInicioDoAno(
    tx: Prisma.TransactionClient,
    ano: number,
    inicio: DataCivil,
  ) {
    const existente = await tx.periodoLetivo.findFirst({
      where: { tipo: "ano_letivo", ano },
    });
    if (existente) return;
    await tx.periodoLetivo.create({
      data: {
        tipo: "ano_letivo",
        titulo: `Ano letivo ${ano}`,
        ano,
        inicio: new Date(`${inicio}T12:00:00Z`),
        fim: new Date(`${ano}-12-31T12:00:00Z`),
      },
    });
  }

  async listarConfiguracoes(escolaId: string, professorId: string) {
    return this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoConfiguracao.findMany({
          where: { escolaId, professorId },
          include: { turma: { select: { nome: true } } },
          orderBy: [{ anoLetivo: "desc" }, { serie: "asc" }, { componente: "asc" }],
        }),
      escolaId,
    );
  }

  /** O dimensionamento que a configuração implica. Puro, e é o que o plano usa. */
  dimensionar(config: {
    aulasSemanais: number;
    minutosPorAula: number;
    grade: unknown;
  }) {
    const grade = (Array.isArray(config.grade) ? config.grade : []) as unknown as FaixaDeHorario[];
    const { total, coerente } = conferirGrade(grade, config.aulasSemanais);
    return {
      aulasNoAno: aulasNoAno(config.aulasSemanais),
      horasRelogio: horasRelogioNoAno(config.aulasSemanais, config.minutosPorAula),
      semanasLetivas: SEMANAS_LETIVAS,
      gradeCoerente: coerente,
      aulasNaGrade: total,
    };
  }

  /**
   * A volta às aulas que vale para o plano.
   *
   * A ordem importa e foi um bug: a data da REGÊNCIA vem primeiro. Consultar
   * `periodos_letivos` antes fazia o produto descartar o que o professor havia
   * digitado — e aquela tabela é preenchida pelo seed como ano CIVIL, então o
   * 1º bimestre de quem declarou 02/02/2026 abria em 29/12/2025.
   *
   * Sem nada preenchido, a primeira segunda de fevereiro é o palpite mais
   * próximo do que as redes praticam (São Paulo abriu 2026 em 02/02).
   */
  async inicioDoAnoLetivo(ano: number, daRegencia?: Date | null): Promise<DataCivil> {
    if (daRegencia) return paraDataCivil(daRegencia);
    const periodo = await this.deps.prisma.periodoLetivo.findFirst({
      where: { tipo: "ano_letivo", ano },
    });
    // Um "ano letivo" que começa em 1º de janeiro é o ano CIVIL do catálogo, não
    // a volta às aulas: nesse caso a sugestão de fevereiro é mais honesta.
    if (!periodo || (periodo.inicio.getUTCMonth() === 0 && periodo.inicio.getUTCDate() <= 7)) {
      return primeiraSegundaDeFevereiro(ano);
    }
    return paraDataCivil(periodo.inicio);
  }

  /** O calendário inteiro daquela configuração: períodos e semanas. */
  async calendario(escolaId: string, professorId: string, configuracaoId: string) {
    const config = await this.configuracaoDoProfessor(escolaId, professorId, configuracaoId);
    const inicio = await this.inicioDoAnoLetivo(config.anoLetivo, config.inicioDoAnoLetivo);
    const periodos = periodosDoAnoLetivo(inicio, config.divisaoDoAno as DivisaoDoAno);
    const grade = (config.grade ?? []) as unknown as FaixaDeHorario[];
    const semanas = semanasDoAnoLetivo(periodos);

    const planos = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoPeriodo.findMany({
          where: { escolaId, professorId, planoAnual: { configuracaoId } },
          select: { id: true, ordem: true, status: true },
        }),
      escolaId,
    );
    const porOrdem = new Map(planos.map((p) => [p.ordem, p]));

    return {
      periodos: periodos.map((p) => ({
        ...p,
        aulasEstimadas: semanas
          .filter((s) => s.periodoDeAvaliacao === p.ordem)
          .reduce((t, s) => t + aulasDaSemana(s, grade).length, 0),
      })),
      semanas: semanas.map((s) => ({
        ...s,
        aulasPrevistas: aulasDaSemana(s, grade).length,
        planoId: porOrdem.get(s.ordem)?.id ?? null,
        status: (porOrdem.get(s.ordem)?.status ?? null) as never,
      })),
    };
  }

  private async configuracaoDoProfessor(
    escolaId: string,
    professorId: string,
    id: string,
  ) {
    const config = await this.deps.prisma.comTenancy(
      (tx) => tx.planoDeEnsinoConfiguracao.findFirst({ where: { id, escolaId, professorId } }),
      escolaId,
    );
    if (!config) naoEncontrado();
    return config;
  }

  // ═══════════════════════════════════════════════════════ plano anual

  /**
   * Salva a distribuição de habilidades por período — a decisão pedagógica do
   * professor, e o insumo do gerador.
   *
   * Recusa código que não existe no recorte. Um `EF67LP42` colado à mão
   * chegaria ao prompt e sairia no documento como se fosse currículo: o
   * professor levaria à coordenação um plano citando habilidade inexistente.
   */
  async salvarDistribuicao(
    escolaId: string,
    professorId: string,
    planoId: string,
    distribuicao: Record<string, string[]>,
    distribuicaoComputacao: Record<string, string[]>,
  ) {
    const plano = await this.planoAnualDoProfessor(escolaId, professorId, planoId);
    const config = plano.configuracao;

    const validos = new Set(habilidadesDe(config.componente, config.serie).map((h) => h.codigo));
    const validosCo = new Set(habilidadesDeComputacao(config.serie).map((h) => h.codigo));
    const divisao = DIVISOES_DO_ANO[config.divisaoDoAno as DivisaoDoAno];

    for (const [ordem, codigos] of Object.entries(distribuicao)) {
      if (Number(ordem) > divisao.periodos) {
        throw new BadRequestException(
          `o ano está dividido em ${divisao.periodos} períodos; recebi o período ${ordem}`,
        );
      }
      for (const c of codigos) {
        if (!validos.has(c)) {
          throw new BadRequestException(
            `${c} não é habilidade de ${config.componente} no ${rotuloDaSerie(config.serie as Serie)}`,
          );
        }
      }
    }
    for (const codigos of Object.values(distribuicaoComputacao)) {
      for (const c of codigos) {
        if (!validosCo.has(c)) {
          throw new BadRequestException(`${c} não é habilidade de Computação deste ano`);
        }
      }
    }

    return this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoAnual.update({
          where: { id: planoId },
          data: { distribuicao, distribuicaoComputacao },
        }),
      escolaId,
    );
  }

  async criarPlanoAnual(escolaId: string, professorId: string, configuracaoId: string) {
    const config = await this.configuracaoDoProfessor(escolaId, professorId, configuracaoId);
    const componente = componentePorSlug(config.componente);
    const titulo = `Plano Anual — ${componente?.rotulo ?? config.componente} — ${rotuloDaSerie(
      config.serie as Serie,
    )} — ${config.anoLetivo}`;

    const plano = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoAnual.create({
          data: { escolaId, professorId, configuracaoId, titulo, status: "pendente" },
        }),
      escolaId,
    );

    // A distribuição nasce vazia: é o professor que decide. Mas um plano só é
    // gerável com ela preenchida — quem dispara a geração é a rota própria.
    return plano;
  }

  private async planoAnualDoProfessor(escolaId: string, professorId: string, id: string) {
    const plano = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoAnual.findFirst({
          where: { id, escolaId, professorId },
          include: { configuracao: true },
        }),
      escolaId,
    );
    if (!plano) naoEncontrado();
    return plano;
  }

  /** Dispara a geração do plano anual. Responde 202: a tela faz polling. */
  async gerarPlanoAnual(escolaId: string, professorId: string, planoId: string, perfil: string) {
    const plano = await this.planoAnualDoProfessor(escolaId, professorId, planoId);
    const distribuicao = (plano.distribuicao ?? {}) as Record<string, string[]>;
    const total = Object.values(distribuicao).reduce((t, l) => t + l.length, 0);
    if (!total) {
      throw new BadRequestException(
        "distribua as habilidades pelos períodos antes de gerar o plano",
      );
    }

    // Regra 5 do AGENTS.md: `temSaldo` ANTES, `consumir` depois.
    if (!(await this.deps.quota.temSaldo(escolaId, professorId, perfil as never))) {
      throw new ForbiddenException("quota diária de IA esgotada");
    }

    const claim = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoAnual.updateMany({
          where: {
            id: planoId,
            escolaId,
            OR: [
              { status: "pendente" },
              { status: "erro" },
              // Órfã: `gerando` sem worker vivo nesta instância.
              {
                status: "gerando",
                tentativas: { lt: MAX_TENTATIVAS },
                iniciadoEm: { lt: new Date(Date.now() - MINUTOS_PARA_ORFAO * 60_000) },
              },
            ],
          },
          data: { status: "gerando", iniciadoEm: new Date(), erro: null, tentativas: { increment: 1 } },
        }),
      escolaId,
    );
    if (claim.count === 0) {
      // Já está gerando com worker vivo, ou estourou as tentativas.
      return { id: planoId };
    }

    const chave = `anual:${planoId}`;
    emExecucao.set(
      chave,
      this.executarPlanoAnual(escolaId, professorId, planoId).finally(() =>
        emExecucao.delete(chave),
      ),
    );
    return { id: planoId };
  }

  private async executarPlanoAnual(escolaId: string, professorId: string, planoId: string) {
    try {
      const plano = await this.planoAnualDoProfessor(escolaId, professorId, planoId);
      const config = plano.configuracao;
      const inicio = await this.inicioDoAnoLetivo(config.anoLetivo, config.inicioDoAnoLetivo);
      const periodos = periodosDoAnoLetivo(inicio, config.divisaoDoAno as DivisaoDoAno);
      const grade = (config.grade ?? []) as unknown as FaixaDeHorario[];
      const semanas = semanasDoAnoLetivo(periodos);

      const user = montarBriefingAnual({
        componente: componentePorSlug(config.componente)?.rotulo ?? config.componente,
        habilidadesPorArea: componentePorSlug(config.componente)?.habilidadesPorArea ?? false,
        serie: rotuloDaSerie(config.serie as Serie),
        anoLetivo: config.anoLetivo,
        aulasSemanais: config.aulasSemanais,
        minutosPorAula: config.minutosPorAula,
        divisao: config.divisaoDoAno as DivisaoDoAno,
        periodos: periodos.map((p) => ({
          ...p,
          aulasEstimadas: semanas
            .filter((s) => s.periodoDeAvaliacao === p.ordem)
            .reduce((t, s) => t + aulasDaSemana(s, grade).length, 0),
        })),
        distribuicao: (plano.distribuicao ?? {}) as Record<string, string[]>,
        distribuicaoComputacao: (plano.distribuicaoComputacao ?? {}) as Record<string, string[]>,
      });

      // A chamada de IA fica FORA de transação: leva minutos.
      const resultado = await this.deps.provider.generate({
        system: PROMPT_PLANO_ANUAL,
        user,
        maxTokens: MAX_TOKENS_ANUAL,
        modelo: "longo",
        temperatura: 0.6,
      });

      // O consumo conta mesmo se o resultado for rejeitado: o token foi gasto.
      if (resultado.tokensUsados > 0) {
        await this.deps.quota.consumir(escolaId, professorId, resultado.tokensUsados);
      }
      if (resultado.finishReason === "MAX_TOKENS") {
        throw new ErroDeGeracao("o plano foi cortado por tamanho; reduza o recorte e tente de novo");
      }
      if (!resultado.texto.trim()) throw new ErroDeGeracao("o gerador respondeu vazio");

      const base = `planos-de-ensino/${escolaId}/${planoId}`;
      await this.deps.storage.salvar(`${base}/gerado.md`, resultado.texto, "text/markdown");
      const html = sanitizarHtmlDoPlano(await marked.parse(resultado.texto));
      await this.deps.storage.salvar(`${base}/atual.html`, html, "text/html");

      await this.deps.prisma.comTenancy(
        (tx) =>
          tx.planoDeEnsinoAnual.update({
            where: { id: planoId },
            data: {
              status: "pronto",
              erro: null,
              tokensUsados: resultado.tokensUsados,
              caminhoGeradoMd: `${base}/gerado.md`,
              caminhoHtml: `${base}/atual.html`,
            },
          }),
        escolaId,
      );
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "falha ao gerar o plano";
      logger.error({ codigo: "app-92-plano-anual-falhou", planoId, erro: mensagem, ...detalheDe(erro) });
      await this.deps.prisma
        .comTenancy(
          (tx) =>
            tx.planoDeEnsinoAnual.update({
              where: { id: planoId },
              data: { status: "erro", erro: mensagem.slice(0, 500) },
            }),
          escolaId,
        )
        .catch(() => undefined);
    }
  }

  async obterPlanoAnual(escolaId: string, professorId: string, planoId: string) {
    const plano = await this.planoAnualDoProfessor(escolaId, professorId, planoId);
    const html = plano.caminhoHtml
      ? await this.deps.storage.lerTexto(plano.caminhoHtml)
      : null;
    return { plano, html };
  }

  async salvarConteudoDoPlanoAnual(
    escolaId: string,
    professorId: string,
    planoId: string,
    html: string,
  ) {
    const plano = await this.planoAnualDoProfessor(escolaId, professorId, planoId);
    if (plano.status !== "pronto") {
      throw new BadRequestException("o plano ainda não está pronto");
    }
    const limpo = sanitizarHtmlDoPlano(html);
    const caminho = plano.caminhoHtml ?? `planos-de-ensino/${escolaId}/${planoId}/atual.html`;
    await this.deps.storage.salvar(caminho, limpo, "text/html");
    await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoAnual.update({ where: { id: planoId }, data: { caminhoHtml: caminho } }),
      escolaId,
    );
    return { bytes: Buffer.byteLength(limpo, "utf8") };
  }

  // ═══════════════════════════════════════════════════ plano de período

  /**
   * Gera (ou regenera) o plano de UMA semana.
   *
   * O esqueleto das aulas NÃO vem do modelo: sai de `aulasDaSemana()`, da grade
   * real. O modelo preenche o conteúdo pedagógico das aulas que existem. Foi
   * decisão deliberada: pedir ao modelo que decidisse quantas aulas caberiam
   * produzia dez — o número redondo — para um professor de Arte que tem duas.
   */
  async gerarPlanoDePeriodo(
    escolaId: string,
    professorId: string,
    planoAnualId: string,
    ordem: number,
    feriados: DataCivil[],
    perfil: string,
  ) {
    const plano = await this.planoAnualDoProfessor(escolaId, professorId, planoAnualId);
    const config = plano.configuracao;
    const inicio = await this.inicioDoAnoLetivo(config.anoLetivo, config.inicioDoAnoLetivo);
    const periodos = periodosDoAnoLetivo(inicio, config.divisaoDoAno as DivisaoDoAno);
    const semanas = semanasDoAnoLetivo(periodos);
    const semana = semanas.find((s) => s.ordem === ordem);
    if (!semana) throw new BadRequestException(`o ano letivo não tem a ${ordem}ª semana`);

    const grade = (config.grade ?? []) as unknown as FaixaDeHorario[];
    const horarios = aulasDaSemana(semana, grade, feriados);
    if (!horarios.length) {
      throw new BadRequestException(
        "esta semana não tem aula — confira a grade de horários e os feriados",
      );
    }

    if (!(await this.deps.quota.temSaldo(escolaId, professorId, perfil as never))) {
      throw new ForbiddenException("quota diária de IA esgotada");
    }

    const registro = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoPeriodo.upsert({
          where: { escolaId_planoAnualId_ordem: { escolaId, planoAnualId, ordem } },
          create: {
            escolaId,
            professorId,
            planoAnualId,
            ordem,
            inicio: new Date(`${semana.inicio}T12:00:00Z`),
            fim: new Date(`${semana.fim}T12:00:00Z`),
            periodoDeAvaliacao: semana.periodoDeAvaliacao,
            status: "gerando",
            iniciadoEm: new Date(),
            tentativas: 1,
          },
          update: {
            /**
             * As datas VÃO no update, e não é redundância: `ordem` é a única
             * chave, e o que ela endereça no calendário muda quando o professor
             * corrige o início do ano letivo ou a divisão do ano na regência.
             * Sem estas três linhas, a 3ª semana regerada ficava com as datas
             * do calendário ANTIGO e as aulas do novo — o cabeçalho do .doc
             * dizia uma semana e os dias das aulas, outra.
             */
            inicio: new Date(`${semana.inicio}T12:00:00Z`),
            fim: new Date(`${semana.fim}T12:00:00Z`),
            periodoDeAvaliacao: semana.periodoDeAvaliacao,
            status: "gerando",
            iniciadoEm: new Date(),
            erro: null,
            tentativas: { increment: 1 },
          },
        }),
      escolaId,
    );

    const chave = `periodo:${registro.id}`;
    if (!emExecucao.has(chave)) {
      emExecucao.set(
        chave,
        this.executarPlanoDePeriodo(escolaId, professorId, registro.id, horarios, {
          componente: componentePorSlug(config.componente)?.rotulo ?? config.componente,
          serie: rotuloDaSerie(config.serie as Serie),
          minutosPorAula: config.minutosPorAula,
          periodoDeAvaliacao: semana.periodoDeAvaliacao,
          rotuloDaSemana: semana.rotulo,
          codigos: [
            ...(((plano.distribuicao ?? {}) as Record<string, string[]>)[
              String(semana.periodoDeAvaliacao)
            ] ?? []),
          ],
          codigosComputacao: [
            ...(((plano.distribuicaoComputacao ?? {}) as Record<string, string[]>)[
              String(semana.periodoDeAvaliacao)
            ] ?? []),
          ],
        }).finally(() => emExecucao.delete(chave)),
      );
    }
    return { id: registro.id };
  }

  private async executarPlanoDePeriodo(
    escolaId: string,
    professorId: string,
    periodoId: string,
    horarios: readonly { numero: number; data: DataCivil; diaDaSemana: number; horario: string }[],
    briefing: {
      componente: string;
      serie: string;
      minutosPorAula: number;
      periodoDeAvaliacao: number;
      rotuloDaSemana: string;
      codigos: string[];
      codigosComputacao: string[];
    },
  ) {
    // Fora do try: o `finally` debita o que o vendor cobrou mesmo quando a
    // geração falha no meio. Token gasto em tentativa perdida foi gasto.
    let tokens = 0;
    try {
      const user = montarBriefingDePeriodo(briefing, horarios);
      const resposta = await this.deps.provider.generateJson<{ aulas: Partial<Aula>[] }>({
        system: PROMPT_PLANO_DE_PERIODO,
        prompt: user,
        responseSchema: SCHEMA_PLANO_DE_PERIODO,
        maxTokens: MAX_TOKENS_PERIODO,
        modelo: "longo",
        temperatura: 0.5,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        // Deliberadamente frouxo: `costurarAulas` já degrada campo ausente para
        // vazio e sobra para descarte, então rejeitar aqui só gastaria
        // tentativa à toa. O que a costura NÃO salva é a lista inteira
        // faltando — isso viraria uma semana em branco sem dizer por quê.
        validar: (bruto) => {
          const aulas = (bruto as { aulas?: unknown }).aulas;
          if (!Array.isArray(aulas) || aulas.length === 0) {
            throw new Error("esperava a lista `aulas` com ao menos uma aula");
          }
          return { aulas: aulas as Partial<Aula>[] };
        },
      });

      const permitidos = new Set([...briefing.codigos, ...briefing.codigosComputacao]);
      const aulas = costurarAulas(resposta?.aulas ?? [], horarios, permitidos);

      await this.deps.prisma.comTenancy(
        (tx) =>
          tx.planoDeEnsinoPeriodo.update({
            where: { id: periodoId },
            data: { status: "pronto", erro: null, aulas, tokensUsados: tokens },
          }),
        escolaId,
      );
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "falha ao gerar o plano do período";
      logger.error({ codigo: "app-92-plano-periodo-falhou", periodoId, erro: mensagem, ...detalheDe(erro) });
      await this.deps.prisma
        .comTenancy(
          (tx) =>
            tx.planoDeEnsinoPeriodo.update({
              where: { id: periodoId },
              data: { status: "erro", erro: mensagem.slice(0, 500), tokensUsados: tokens },
            }),
          escolaId,
        )
        .catch(() => undefined);
    } finally {
      // Regra 5 do AGENTS.md: `temSaldo` já correu em `gerarPlanoDePeriodo`;
      // aqui fecha o par. `catch` engolido de propósito — o plano ficou pronto,
      // e derrubar a geração por falha de contabilidade puniria o professor
      // pelo nosso registro. A falha vai no log.
      if (tokens > 0) {
        await this.deps.quota
          .consumir(escolaId, professorId, tokens)
          .catch((falha: unknown) =>
            logger.error({
              codigo: "app-92-quota-nao-debitada",
              periodoId,
              tokens,
              erro: falha instanceof Error ? falha.message : "desconhecido",
            }),
          );
      }
    }
  }

  async obterPlanoDePeriodo(escolaId: string, professorId: string, id: string) {
    const registro = await this.deps.prisma.comTenancy(
      (tx) => tx.planoDeEnsinoPeriodo.findFirst({ where: { id, escolaId, professorId } }),
      escolaId,
    );
    if (!registro) naoEncontrado();
    return registro;
  }

  /** O professor salva a edição das aulas — e é aqui que ele marca o cumprido. */
  async salvarAulas(escolaId: string, professorId: string, id: string, aulas: Aula[]) {
    await this.obterPlanoDePeriodo(escolaId, professorId, id);
    return this.deps.prisma.comTenancy(
      (tx) => tx.planoDeEnsinoPeriodo.update({ where: { id }, data: { aulas, status: "pronto" } }),
      escolaId,
    );
  }

  async listarPlanosAnuais(escolaId: string, professorId: string) {
    return this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoAnual.findMany({
          where: { escolaId, professorId },
          orderBy: { criadoEm: "desc" },
        }),
      escolaId,
    );
  }

  /**
   * As semanas JÁ PLANEJADAS de um plano anual, com as aulas — a fonte do
   * documento de várias semanas (a entrega quinzenal e a do bimestre).
   *
   * Só as `pronto`: um documento entregue à coordenação não leva semana que
   * falhou na geração nem semana que ninguém planejou. Filtra por período de
   * avaliação no BANCO, não na tela, porque o ano inteiro são 40 linhas com as
   * aulas dentro — o payload de "baixar o 1º bimestre" não tem por que
   * carregar os outros três.
   */
  async listarPlanosDePeriodo(
    escolaId: string,
    professorId: string,
    planoAnualId: string,
    periodoDeAvaliacao?: number,
  ) {
    await this.planoAnualDoProfessor(escolaId, professorId, planoAnualId);
    return this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoPeriodo.findMany({
          where: {
            escolaId,
            professorId,
            planoAnualId,
            status: "pronto",
            ...(periodoDeAvaliacao ? { periodoDeAvaliacao } : {}),
          },
          orderBy: { ordem: "asc" },
        }),
      escolaId,
    );
  }

  async apagarPlanoAnual(escolaId: string, professorId: string, planoId: string) {
    await this.planoAnualDoProfessor(escolaId, professorId, planoId);
    await this.deps.storage
      .apagarPrefixo(`planos-de-ensino/${escolaId}/${planoId}/`)
      .catch(() => undefined);
    await this.deps.prisma.comTenancy(
      (tx) => tx.planoDeEnsinoAnual.delete({ where: { id: planoId } }),
      escolaId,
    );
    return { ok: true as const };
  }

  /**
   * Apaga a REGÊNCIA inteira — o planejamento daquele componente × ano.
   *
   * É o que "excluir o planejamento" quer dizer na lista do professor: a
   * configuração, o plano anual dela e todas as semanas planejadas. O banco
   * cuida da cascata (`onDelete: Cascade` em `planosAnuais` e `periodos`), mas
   * o object storage NÃO tem cascata: o `atual.html` e o `gerado.md` de cada
   * plano anual moram sob `planos-de-ensino/{escola}/{planoAnualId}/`, e é por
   * isso que os prefixos são varridos ANTES do delete — depois dele não haveria
   * mais como saber quais eram.
   *
   * O `catch` de cada prefixo é deliberado: arquivo órfão no bucket é lixo, e
   * lixo não pode impedir o professor de apagar o próprio planejamento.
   */
  async apagarConfiguracao(escolaId: string, professorId: string, configuracaoId: string) {
    await this.configuracaoDoProfessor(escolaId, professorId, configuracaoId);
    const planos = await this.deps.prisma.comTenancy(
      (tx) =>
        tx.planoDeEnsinoAnual.findMany({
          where: { escolaId, professorId, configuracaoId },
          select: { id: true },
        }),
      escolaId,
    );
    for (const p of planos) {
      await this.deps.storage
        .apagarPrefixo(`planos-de-ensino/${escolaId}/${p.id}/`)
        .catch(() => undefined);
    }
    await this.deps.prisma.comTenancy(
      (tx) => tx.planoDeEnsinoConfiguracao.delete({ where: { id: configuracaoId } }),
      escolaId,
    );
    return { ok: true as const };
  }
}

// ═══════════════════════════════════════════════════════════════ auxiliares

function primeiraSegundaDeFevereiro(ano: number): DataCivil {
  const d = new Date(Date.UTC(ano, 1, 1, 12));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** O briefing do plano anual: identificação, carga e as habilidades por período. */
function montarBriefingAnual(d: {
  componente: string;
  habilidadesPorArea: boolean;
  serie: string;
  anoLetivo: number;
  aulasSemanais: number;
  minutosPorAula: number;
  divisao: DivisaoDoAno;
  periodos: ReadonlyArray<{ ordem: number; rotulo: string; inicio: string; fim: string; aulasEstimadas: number }>;
  distribuicao: Record<string, string[]>;
  distribuicaoComputacao: Record<string, string[]>;
}): string {
  const div = DIVISOES_DO_ANO[d.divisao];
  const linhas: string[] = [
    "# IDENTIFICAÇÃO",
    "",
    `- Componente curricular: ${d.componente}`,
    `- Ano/série: ${d.serie}`,
    `- Ano letivo: ${d.anoLetivo}`,
    `- Aulas por semana: ${d.aulasSemanais}`,
    `- Duração da aula: ${d.minutosPorAula} minutos`,
    `- Semanas letivas: ${SEMANAS_LETIVAS}`,
    `- Total de aulas previstas no ano: ${aulasNoAno(d.aulasSemanais)}`,
    `- Carga horária: ${horasRelogioNoAno(d.aulasSemanais, d.minutosPorAula)} horas-relógio`,
    `- Divisão do ano: ${div.periodos} ${div.rotulo.toLowerCase()}s`,
    "",
  ];

  if (d.habilidadesPorArea) {
    linhas.push(
      "OBSERVAÇÃO IMPORTANTE: neste componente, a BNCC do Ensino Médio organiza as",
      "habilidades por ÁREA do conhecimento, não por componente. As habilidades",
      "abaixo são da área e são compartilhadas com os outros componentes dela.",
      "Selecione o enfoque pertinente a este componente ao desenvolvê-las, e não",
      "afirme que são habilidades exclusivas dele.",
      "",
    );
  }

  linhas.push("# HABILIDADES DA BNCC POR PERÍODO", "");
  for (const p of d.periodos) {
    linhas.push(`## ${p.rotulo} (${p.inicio} a ${p.fim}) — ${p.aulasEstimadas} aulas`, "");
    const codigos = d.distribuicao[String(p.ordem)] ?? [];
    if (!codigos.length) {
      linhas.push("_Sem habilidades atribuídas a este período._", "");
    }
    for (const codigo of codigos) {
      const h = habilidadePorCodigo(codigo);
      if (!h) continue;
      linhas.push(
        `- **${h.codigo}** — ${h.descricao}`,
        `  - Objeto de conhecimento: ${h.objetoDeConhecimento ?? "não classificado no documento"}`,
        `  - ${h.unidadeTematica ? `Unidade/prática: ${h.unidadeTematica}` : h.competenciaEspecifica ? `Competência específica da área: ${h.competenciaEspecifica}` : "Sem organizador no documento"}`,
      );
    }
    const co = d.distribuicaoComputacao[String(p.ordem)] ?? [];
    if (co.length) {
      linhas.push("", `### Computação a articular no ${p.rotulo}`, "");
      for (const codigo of co) {
        const h = habilidadePorCodigo(codigo);
        if (!h) continue;
        linhas.push(`- **${h.codigo}** (eixo ${h.eixo ?? "não informado"}) — ${h.descricao}`);
        if (h.explicacao) linhas.push(`  - Explicação oficial: ${h.explicacao}`);
        if (h.exemplos) linhas.push(`  - Exemplos oficiais: ${h.exemplos}`);
      }
    }
    linhas.push("");
  }
  return linhas.join("\n");
}

/** O briefing do plano de período: as aulas que existem e as habilidades dele. */
function montarBriefingDePeriodo(
  d: {
    componente: string;
    serie: string;
    minutosPorAula: number;
    periodoDeAvaliacao: number;
    rotuloDaSemana: string;
    codigos: string[];
    codigosComputacao: string[];
  },
  horarios: readonly { numero: number; data: DataCivil; diaDaSemana: number; horario: string }[],
): string {
  const linhas: string[] = [
    "# IDENTIFICAÇÃO",
    "",
    `- Componente curricular: ${d.componente}`,
    `- Ano/série: ${d.serie}`,
    `- Semana: ${d.rotuloDaSemana} (período de avaliação ${d.periodoDeAvaliacao})`,
    `- Duração de cada aula: ${d.minutosPorAula} minutos`,
    "",
    `# AS ${horarios.length} AULAS QUE EXISTEM`,
    "",
    "Devolva exatamente uma entrada para cada uma, com o mesmo `numero`:",
    "",
  ];
  for (const h of horarios) {
    linhas.push(`- Aula ${h.numero} — ${nomeDoDia(h.diaDaSemana as never)}, ${h.data}, às ${h.horario}`);
  }

  linhas.push("", "# HABILIDADES PREVISTAS PARA ESTE PERÍODO", "");
  if (!d.codigos.length) linhas.push("_Nenhuma habilidade atribuída — planeje retomada e consolidação._");
  for (const codigo of d.codigos) {
    const h = habilidadePorCodigo(codigo);
    if (!h) continue;
    linhas.push(
      `- **${h.codigo}** — ${h.descricao}`,
      `  - Objeto de conhecimento: ${h.objetoDeConhecimento ?? "não classificado"}`,
    );
  }
  if (d.codigosComputacao.length) {
    linhas.push("", "# COMPUTAÇÃO A ARTICULAR (proposta da escola, não currículo do componente)", "");
    for (const codigo of d.codigosComputacao) {
      const h = habilidadePorCodigo(codigo);
      if (!h) continue;
      linhas.push(`- **${h.codigo}** — ${h.descricao}`);
      if (h.exemplos) linhas.push(`  - Exemplos oficiais: ${h.exemplos}`);
    }
  }
  return linhas.join("\n");
}
