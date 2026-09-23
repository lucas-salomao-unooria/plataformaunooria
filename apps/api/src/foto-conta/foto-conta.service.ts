import { Injectable } from "@nestjs/common";
import type { Prisma, FotoContaRun } from "@prisma/client";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { PrismaService } from "../prisma/prisma.service";
import { logger } from "../observabilidade/logger";
import {
  EXP_ID,
  PACOTE_PADRAO,
  PERGUNTAS_DA_RODA,
  ROTULOS_DA_PROJECAO,
  VERSAO_INSTRUMENTO,
  type Complexidade,
  type Etapa,
  type MarcaId,
  type OpcaoReflexao,
  type PacoteDaTurma,
  type Tema,
} from "./catalogo";
import { PacoteDaTurmaSchema } from "./contrato-de-rotas";
import { erroDaMissao } from "./erros";
import {
  comentariosDe,
  escolhaValida,
  podeAvancar,
  reflexaoConclui,
  resumoDaTurma,
  type RunParaPainel,
} from "./regras";

/**
 * Persistência da exp01ef1b. Assinaturas recebem `escolaId`/`estudanteId`
 * explícitos (não o request) — os testes chamam direto, e toda query leva
 * `escola_id` no `where` ALÉM da RLS que o `comTenancy` arma (regra 1,
 * defesa em profundidade).
 *
 * A missão fecha INTEIRA sem IA: o `PACOTE_PADRAO` é o piso autoral. A única
 * superfície de modelo é a preparação docente (`IaDaFotoContaService`).
 */

/** A config "virtual" de turma que nunca foi configurada: banco padrão,
 *  latch armado, tentativa 1. Existe para a aula abrir MESMO sem o professor
 *  ter passado no painel (fallback obrigatório do bloco 9 da spec). */
interface ConfigEfetiva {
  tema: Tema;
  complexidade: Complexidade;
  statusPacote: "pendente" | "pronto";
  pacote: PacoteDaTurma | null;
  pacoteDaIa: boolean;
  latchLiberado: boolean;
  tentativa: number;
}

const CONFIG_PADRAO: ConfigEfetiva = {
  tema: "recreio",
  complexidade: "nivel_1",
  statusPacote: "pendente",
  pacote: null,
  pacoteDaIa: false,
  latchLiberado: false,
  tentativa: 1,
};

function postPublico(p: {
  marcaId: string;
  fotoId: string;
  legendaTexto: string;
  curtidasSimuladas: number;
  criadoEm: Date;
}) {
  return {
    marcaId: p.marcaId as MarcaId,
    fotoId: p.fotoId,
    legendaTexto: p.legendaTexto,
    curtidas: p.curtidasSimuladas,
    criadoEm: p.criadoEm.toISOString(),
  };
}

@Injectable()
export class FotoContaService {
  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------ estudante ------------------------------ */

  /**
   * O boot da missão: cria (ou retoma) a run da tentativa corrente e devolve o
   * estado + o pacote SEM a matriz do Aha. É o funil da ADR-69: quem valida
   * escola, turma e liberação é `estudanteDaEscola`, aqui e em toda mutação.
   */
  async sessao(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      const run = await this.runDaTentativa(tx, escolaId, turmaId, estudanteId, config.tentativa);
      const { comentarios: _matriz, ...pacotePublico } = this.pacoteDe(config);

      return {
        etapa: run.etapa as Etapa,
        tentativa: run.tentativa,
        marcaId: (run.marcaId as MarcaId | null) ?? null,
        fotoEscolhidaId: run.fotoEscolhidaId,
        legendaEscolhidaId: run.legendaEscolhidaId,
        tentativasReflexao: run.tentativasReflexao,
        pacote: pacotePublico,
        latchLiberado: config.latchLiberado,
        versaoInstrumento: run.versaoInstrumento,
      };
    }, escolaId);
  }

  /** Etapa 1 → 2: grava a marca e abre o mural. */
  async marcar(escolaId: string, estudanteId: string, marcaId: MarcaId) {
    return this.mutar(escolaId, estudanteId, async (tx, run) => {
      this.exigirTransicao(run.etapa as Etapa, "feed");
      return tx.fotoContaRun.update({
        where: { id: run.id },
        data: { marcaId, etapa: "feed" },
      });
    });
  }

  /** Etapa 2 → 3: registra a exploração (grau `none`) e abre a decisão. */
  async sairDoFeed(
    escolaId: string,
    estudanteId: string,
    dados: { curtidas: number; permanenciaMs: number },
  ) {
    return this.mutar(escolaId, estudanteId, async (tx, run) => {
      this.exigirTransicao(run.etapa as Etapa, "decidir");
      return tx.fotoContaRun.update({
        where: { id: run.id },
        data: {
          etapa: "decidir",
          curtidasFeed: dados.curtidas,
          permanenciaFeedMs: dados.permanenciaMs,
        },
      });
    });
  }

  /**
   * Etapa 3 → 4 (o PICO): valida a escolha CONTRA O PACOTE, grava o par, cria
   * o post do mural e devolve os comentários — só a linha do par escolhido.
   *
   * Idempotente pelo RESULTADO: repetir com o MESMO par (toque duplo, retry de
   * rede) devolve a publicação existente; par DIFERENTE depois de publicado é
   * recusa — a publicação é irreversível por desenho.
   */
  async publicar(
    escolaId: string,
    estudanteId: string,
    corpo: { fotoId: string; legendaId: string; latenciaMs?: number },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      const run = await this.runDaTentativa(tx, escolaId, turmaId, estudanteId, config.tentativa);
      const pacote = this.pacoteDe(config);

      if (run.fotoEscolhidaId) {
        if (run.fotoEscolhidaId !== corpo.fotoId || run.legendaEscolhidaId !== corpo.legendaId) {
          throw erroDaMissao("publicacao-ja-feita");
        }
        const post = await tx.fotoContaPostTurma.findUnique({ where: { runId: run.id } });
        const comentarios = comentariosDe(pacote, corpo.fotoId, corpo.legendaId);
        if (!post || !comentarios) throw erroDaMissao("run-nao-encontrada");
        return { etapa: run.etapa as Etapa, post: postPublico(post), comentarios };
      }

      this.exigirTransicao(run.etapa as Etapa, "aha");
      if (!escolhaValida(pacote, corpo.fotoId, corpo.legendaId)) {
        throw erroDaMissao("escolha-fora-do-pacote");
      }
      const comentarios = comentariosDe(pacote, corpo.fotoId, corpo.legendaId);
      if (!comentarios) throw erroDaMissao("escolha-fora-do-pacote");
      const legenda = pacote.legendas.find((l) => l.id === corpo.legendaId);
      if (!legenda) throw erroDaMissao("escolha-fora-do-pacote");
      if (!run.marcaId) throw erroDaMissao("etapa-fora-de-ordem");

      const atualizada = await tx.fotoContaRun.update({
        where: { id: run.id },
        data: {
          etapa: "aha",
          fotoEscolhidaId: corpo.fotoId,
          legendaEscolhidaId: corpo.legendaId,
          latenciaDecisaoMs: corpo.latenciaMs ?? null,
        },
      });
      const post = await tx.fotoContaPostTurma.create({
        data: {
          runId: run.id,
          escolaId,
          turmaId,
          tentativa: run.tentativa,
          marcaId: run.marcaId,
          fotoId: corpo.fotoId,
          legendaTexto: legenda.texto,
        },
      });

      return { etapa: atualizada.etapa as Etapa, post: postPublico(post), comentarios };
    }, escolaId);
  }

  /** Etapa 4 → 5: os timers do Aha terminaram; a run entra no latch. */
  async chegarNaRoda(escolaId: string, estudanteId: string) {
    return this.mutar(escolaId, estudanteId, async (tx, run) => {
      this.exigirTransicao(run.etapa as Etapa, "roda");
      return tx.fotoContaRun.update({ where: { id: run.id }, data: { etapa: "roda" } });
    });
  }

  /**
   * O polling do latch (3s, ADR-94) — leve de propósito: sem pacote e sem
   * catálogo, como o gate do o-eco-no-grupo. NÃO muda a run: quem tira a
   * criança da roda é a reflexão, que confere o latch de novo.
   */
  async latch(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteSemLiberacao(tx, escolaId, estudanteId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      const run = await tx.fotoContaRun.findUnique({
        where: {
          escolaId_turmaId_estudanteId_tentativa: {
            escolaId,
            turmaId,
            estudanteId,
            tentativa: config.tentativa,
          },
        },
        select: { etapa: true },
      });
      if (!run) throw erroDaMissao("run-nao-encontrada");
      return {
        liberado: config.latchLiberado,
        etapa: run.etapa as Etapa,
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  /**
   * Etapa 6: o servidor decide (regra 3). Globo = retry formativo, sem
   * penalidade; Lupa = conclui e congela. Exige o latch liberado: responder
   * antes da Roda quebraria a mediação que a missão existe para provocar.
   */
  async refletir(escolaId: string, estudanteId: string, escolha: OpcaoReflexao) {
    return this.mutar(escolaId, estudanteId, async (tx, run, config) => {
      if (run.etapa === "concluida") throw erroDaMissao("missao-concluida");
      if (run.etapa !== "roda" && run.etapa !== "refletir") {
        throw erroDaMissao("etapa-fora-de-ordem");
      }
      if (!config.latchLiberado) throw erroDaMissao("roda-em-andamento");

      if (!reflexaoConclui(escolha)) {
        return tx.fotoContaRun.update({
          where: { id: run.id },
          data: { etapa: "refletir", tentativasReflexao: { increment: 1 } },
        });
      }
      return tx.fotoContaRun.update({
        where: { id: run.id },
        data: { etapa: "concluida", reflexaoFinal: escolha, concluidoEm: new Date() },
      });
    }).then((run) => ({
      conclui: run.etapa === "concluida",
      tentativas: run.tentativasReflexao,
      etapa: run.etapa as Etapa,
    }));
  }

  /** A Galeria da Turma (pós-publicação): passiva, da tentativa corrente. */
  async galeria(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteSemLiberacao(tx, escolaId, estudanteId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      const posts = await tx.fotoContaPostTurma.findMany({
        where: { escolaId, turmaId, tentativa: config.tentativa },
        orderBy: { criadoEm: "desc" },
        take: 60,
      });
      return { posts: posts.map(postPublico) };
    }, escolaId);
  }

  /* ------------------------------ professor ------------------------------ */

  /** As turmas em que o professor tem matrícula (porta única da plataforma). */
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
   * O dashboard ao vivo. A lista de hesitação sai daqui COM nome — hidratado
   * da matrícula NESTA rota autenticada de professor (DAD-07): o modelo, a
   * telemetria e o polling só conhecem o id opaco.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      const runs = await tx.fotoContaRun.findMany({
        where: { escolaId, turmaId, tentativa: config.tentativa },
        select: {
          estudanteId: true,
          etapa: true,
          fotoEscolhidaId: true,
          legendaEscolhidaId: true,
          atualizadoEm: true,
        },
      });
      const resumo = resumoDaTurma(runs as RunParaPainel[], new Date());

      const hesitando =
        resumo.hesitando.length === 0
          ? []
          : (
              await tx.user.findMany({
                where: { id: { in: resumo.hesitando }, escolaId },
                select: { id: true, displayName: true },
              })
            ).map((u) => ({ id: u.id, nome: u.displayName }));

      const { hesitando: _ids, ...resto } = resumo;
      return {
        turma,
        tema: config.tema,
        complexidade: config.complexidade,
        statusPacote: config.statusPacote,
        pacoteDaIa: config.pacoteDaIa,
        latchLiberado: config.latchLiberado,
        tentativa: config.tentativa,
        resumo: resto,
        hesitando,
      };
    }, escolaId);
  }

  /** Grava tema/complexidade — o passo anterior à geração e à aprovação. */
  async configurar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    corpo: { tema: Tema; complexidade: Complexidade },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await tx.fotoContaTurmaConfig.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, tema: corpo.tema, complexidade: corpo.complexidade },
        update: { tema: corpo.tema, complexidade: corpo.complexidade },
      });
      return { ok: true as const };
    }, escolaId);
  }

  /**
   * Aprova o pacote conferido no preview (`cfg_turma_ready` da spec). A api
   * REVALIDA o pacote inteiro: aprovação é o último portão antes da turma.
   */
  async aprovar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    pacote: unknown,
    daIa: boolean,
  ) {
    const valido = PacoteDaTurmaSchema.safeParse(pacote);
    if (!valido.success) throw erroDaMissao("payload-invalido");
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await tx.fotoContaTurmaConfig.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: {
          escolaId,
          turmaId,
          tema: valido.data.tema,
          statusPacote: "pronto",
          pacote: valido.data as unknown as Prisma.InputJsonValue,
          pacoteDaIa: daIa,
        },
        update: {
          tema: valido.data.tema,
          statusPacote: "pronto",
          pacote: valido.data as unknown as Prisma.InputJsonValue,
          pacoteDaIa: daIa,
        },
      });
      logger.info(
        { codigo: "foto-conta.pacote-aprovado", turmaId, daIa },
        "pacote da turma aprovado",
      );
      return { ok: true as const };
    }, escolaId);
  }

  /**
   * DAD-11: a liberação é um UPDATE simples e idempotente por ERRO — sem lock
   * de linha. Quem "recebe o broadcast" é o polling dos tablets. Liberar duas
   * vezes responde `409 latch-ja-liberado`, e a mensagem diz que está tudo
   * bem: a turma JÁ está liberada.
   */
  async liberarLatch(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      if (config.latchLiberado) throw erroDaMissao("latch-ja-liberado");

      await tx.fotoContaTurmaConfig.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, latchLiberado: true },
        update: { latchLiberado: true },
      });
      const tabletsNoLatch = await tx.fotoContaRun.count({
        where: { escolaId, turmaId, tentativa: config.tentativa, etapa: "roda" },
      });
      logger.info(
        { codigo: "foto-conta.latch-liberado", turmaId, tabletsNoLatch },
        "turma liberada para a reflexão final",
      );
      return { liberado: true as const, tabletsNoLatch };
    }, escolaId);
  }

  /**
   * DAD-11: o reset roda numa transação serializada (o `comTenancy` É a
   * transação) e ARQUIVA em vez de apagar — a tentativa incrementa e as runs
   * antigas ficam imutáveis na tentativa anterior (DAD-06). O latch volta
   * armado; o histórico analítico não é tocado.
   */
  async reset(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      const runsArquivadas = await tx.fotoContaRun.count({
        where: { escolaId, turmaId, tentativa: config.tentativa },
      });
      const nova = config.tentativa + 1;
      await tx.fotoContaTurmaConfig.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, tentativa: nova },
        update: { tentativa: nova, latchLiberado: false },
      });
      logger.info(
        { codigo: "foto-conta.turma-zerada", turmaId, tentativa: nova, runsArquivadas },
        "turma reiniciada; runs anteriores arquivadas",
      );
      return { tentativa: nova, runsArquivadas, latchLiberado: false as const };
    }, escolaId);
  }

  /** A projeção da lousa (E5-PROF-01): o material do debate vem da API — uma
   *  cópia no hub divergiria do que os tablets mostraram. */
  async projecao(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      const pacote = this.pacoteDe(config);
      const [conectados, noLatch] = await Promise.all([
        tx.fotoContaRun.count({
          where: { escolaId, turmaId, tentativa: config.tentativa },
        }),
        tx.fotoContaRun.count({
          where: { escolaId, turmaId, tentativa: config.tentativa, etapa: "roda" },
        }),
      ]);
      return {
        fotoAId: pacote.par.fotoAId,
        fotoBId: pacote.par.fotoBId,
        legendas: pacote.legendas,
        rotulos: { ...ROTULOS_DA_PROJECAO },
        perguntas: [...PERGUNTAS_DA_RODA],
        tema: pacote.tema,
        latchLiberado: config.latchLiberado,
        conectados,
        noLatch,
      };
    }, escolaId);
  }

  /* ------------------------------- internos ------------------------------ */

  /**
   * O FUNIL das rotas de estudante (ADR-69 + ADR-87): valida a escola, exige a
   * turma (missão síncrona: sem sala não há aula) e chama a porta comum, que
   * confere disponibilidade e liberação. Toda rota de estudante passa aqui —
   * pô-lo só na leitura deixaria a escrita aberta a quem chama direto.
   */
  private async estudanteDaEscola(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<{ turmaId: string }> {
    const { turmaId } = await this.estudanteSemLiberacao(tx, escolaId, estudanteId);
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return { turmaId };
  }

  /** Só a identidade/turma, SEM a porta da liberação — para as leituras leves
   *  (latch, galeria) de quem JÁ está dentro: encerrar a missão fecha a
   *  entrada, não expulsa a criança no meio da aula. */
  private async estudanteSemLiberacao(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<{ turmaId: string }> {
    const estudante = await tx.user.findUnique({
      where: { id: estudanteId },
      select: { escolaId: true, turmaId: true },
    });
    if (!estudante || estudante.escolaId !== escolaId) {
      throw erroDaMissao("run-nao-encontrada");
    }
    if (!estudante.turmaId) throw erroDaMissao("sem-turma");
    return { turmaId: estudante.turmaId };
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
    if (!turma) throw erroDaMissao("turma-nao-encontrada");
    if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) {
      throw erroDaMissao("turma-nao-encontrada");
    }
    return turma;
  }

  /** A config efetiva da turma — a linha, ou o padrão virtual (a aula abre
   *  sem o professor ter configurado nada). */
  private async configDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
  ): Promise<ConfigEfetiva> {
    const linha = await tx.fotoContaTurmaConfig.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
    });
    if (!linha) return { ...CONFIG_PADRAO };
    return {
      tema: linha.tema as Tema,
      complexidade: linha.complexidade as Complexidade,
      statusPacote: linha.statusPacote as "pendente" | "pronto",
      pacote: linha.pacote ? (linha.pacote as unknown as PacoteDaTurma) : null,
      pacoteDaIa: linha.pacoteDaIa,
      latchLiberado: linha.latchLiberado,
      tentativa: linha.tentativa,
    };
  }

  /** O pacote que VALE: o aprovado, ou o banco curado padrão. Pacote gravado
   *  ilegível cai no padrão COM log — a aula não pode morrer por um JSON. */
  private pacoteDe(config: ConfigEfetiva): PacoteDaTurma {
    if (config.statusPacote !== "pronto" || !config.pacote) return PACOTE_PADRAO;
    const valido = PacoteDaTurmaSchema.safeParse(config.pacote);
    if (!valido.success) {
      logger.warn(
        { codigo: "foto-conta.pacote-ilegivel" },
        "pacote aprovado não passa no schema; servindo o banco padrão",
      );
      return PACOTE_PADRAO;
    }
    return valido.data;
  }

  /** A run da tentativa corrente — cria no primeiro toque. */
  private async runDaTentativa(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    estudanteId: string,
    tentativa: number,
  ): Promise<FotoContaRun> {
    const chave = {
      escolaId_turmaId_estudanteId_tentativa: { escolaId, turmaId, estudanteId, tentativa },
    };
    const existente = await tx.fotoContaRun.findUnique({ where: chave });
    if (existente) return existente;
    return tx.fotoContaRun.create({
      data: { escolaId, turmaId, estudanteId, tentativa, versaoInstrumento: VERSAO_INSTRUMENTO },
    });
  }

  /** Núcleo das mutações do estudante: funil + run da tentativa + regra, tudo
   *  na MESMA transação do `comTenancy`. */
  private async mutar(
    escolaId: string,
    estudanteId: string,
    fn: (
      tx: Prisma.TransactionClient,
      run: FotoContaRun,
      config: ConfigEfetiva,
    ) => Promise<FotoContaRun>,
  ): Promise<FotoContaRun> {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const config = await this.configDaTurma(tx, escolaId, turmaId);
      const run = await this.runDaTentativa(tx, escolaId, turmaId, estudanteId, config.tentativa);
      return fn(tx, run, config);
    }, escolaId);
  }

  private exigirTransicao(de: Etapa, para: Etapa): void {
    if (!podeAvancar(de, para)) {
      throw erroDaMissao(de === "concluida" ? "missao-concluida" : "etapa-fora-de-ordem");
    }
  }
}
