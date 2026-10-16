import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { EXP_ID } from "../../comum/insta/defaults";
import { FASES_DA_RUN, normalizarFase, type FaseDaRun } from "../../comum/insta/etapas";
import { calcularExposicao } from "../../dossie/exposicao";
import { EvidenciasService } from "../../evidencias/evidencias.service";
import { aleatorioDe, embaralhar } from "../../evidencias/regras";
import { PrismaService } from "../../prisma/prisma.service";
import { contextoDaRun } from "../contexto-da-evidencia";
import { normalizarEstado } from "../estado";
import { naoEncontrado, runDoEstudante } from "../guardas";
import { paraFeedPost } from "../sanitizador";
import { linhaDaSelecao, medeConfiabilidade, montarEnvio, nivelDoEnvio, type PostDoEnvio } from "./envio";
import { comporRaioX, gabaritoDoPost, nivelDoRaioX, type ComposicaoDoRaioX } from "./raio-x";
import { efeitosCoerentes, nivelDosTermos } from "./termos";
import {
  CLAUSULAS,
  EFEITOS,
  MARCADOR_DA_TAREFA,
  MARCADOR_DO_ENVIO_LIMITADO,
  MENSAGENS,
  MUDANCAS,
  type ClausulaId,
  type EfeitoId,
  type MensagemId,
  type MudancaId,
  type OpcaoDoRaioX,
  type Tarefa,
} from "./vocabulario";

/**
 * AS TAREFAS DO CANAL A do Unoovista (exp08ef1b, ADR-167): o 6a Raio-x, o 6b
 * Termos e o 6c Envio, e o fim da revelação registrado no servidor.
 *
 * As travas, todas aqui:
 *   - o 6a abre da resposta à pergunta-chave em diante (investigação
 *     encerrada), para quem teve feed com lado e a composição fechou 6 posts,
 *     e FECHA quando a revelação termina — depois dela o estudante sabe o que
 *     cada post era;
 *   - o 6b e o 6c abrem só depois do cinza (`perdidos` em diante), para quem
 *     teve feed com lado e chegou à última tela da revelação;
 *   - vale o PRIMEIRO envio de cada tarefa, mesmo depois de um reinício: a
 *     tarefa refeita grava só "refeita", sem marca nova (as marcas não saem no
 *     reinício).
 *
 * O estudante nunca vê o próprio nível: todo envio responde `{ enviada: true }`.
 * As respostas e os gabaritos ficam aqui (regra 3).
 */

/** Como cada tarefa está para o estudante, agora. */
export type SituacaoDaTarefa =
  /** Nunca vai aparecer para ele (sem feed com lado, ou o Raio-x não fechou 6 posts). */
  | "indisponivel"
  /** Ainda não abriu (a etapa ou a revelação ainda não chegaram). */
  | "aguardando"
  | "pendente"
  | "enviada"
  /** Só o Raio-x: a revelação terminou antes do envio. */
  | "encerrada";

export interface SituacaoDasTarefas {
  revelacaoConcluida: boolean;
  raioX: SituacaoDaTarefa;
  termos: SituacaoDaTarefa;
  envio: SituacaoDaTarefa;
}

const ordem = (fase: FaseDaRun) => FASES_DA_RUN.indexOf(fase);
const aPartirDe = (fase: string, piso: FaseDaRun) => ordem(normalizarFase(fase)) >= ordem(piso);

type Tx = Prisma.TransactionClient;
type RunDoEstudante = NonNullable<Awaited<ReturnType<typeof runDoEstudante>>>;

const INCLUIR_DO_FEED = {
  author: { select: { handle: true, displayName: true, verificado: true, bio: true, tipo: true } },
  comments: {
    orderBy: { ordem: "asc" },
    select: { id: true, handle: true, texto: true, likesCount: true, ordem: true },
  },
} satisfies Prisma.PostInclude;

@Injectable()
export class TarefasDoUnoovista {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
  ) {}

  // ── o que a tarefa precisa saber da sessão ──────────────────────────────

  /** A run do estudante, ou 404 — a mensagem neutra do disfarce. */
  private async run(tx: Tx, runId: string, estudanteId: string, escolaId: string): Promise<RunDoEstudante> {
    const run = await runDoEstudante(tx, runId, estudanteId, escolaId);
    if (!run) naoEncontrado();
    return run;
  }

  /** O acervo aprovado e o lado do feed DELE (o que mais serviu, ADR-42). */
  private async acervo(tx: Tx, run: RunDoEstudante) {
    const posts = await tx.post.findMany({
      where: { activityId: run.activityId, aprovado: true },
      select: { id: true, lado: true, intensidade: true, categoria: true, aprovado: true, author: { select: { tipo: true } } },
    });
    const estado = normalizarEstado(run.engineState);
    const { ladoDele } = calcularExposicao(estado.servedPostIds, posts);
    return { posts, estado, ladoDele };
  }

  /**
   * O que ele VIU e por quanto tempo, pelos EVENTOS da sessão — e não só pelo
   * estado do motor. O motor processa os eventos quando o aparelho pede o
   * próximo bloco: os do último bloco (o que ele rolava quando a investigação
   * fechou) ficam só na tabela de eventos, e o Raio-x perderia justamente os
   * posts mais recentes. Vale o maior dos dois.
   */
  private async vistos(tx: Tx, run: RunDoEstudante, estado: ReturnType<typeof normalizarEstado>) {
    const eventos = await tx.event.findMany({
      where: { runId: run.id, tipo: "visto", postId: { not: null } },
      select: { postId: true, payload: true },
    });
    const vistosPorPost: Record<string, number> = { ...(estado.vistosPorPost ?? {}) };
    const dwellPorPost: Record<string, number> = { ...(estado.dwellPorPost ?? {}) };
    const contagem: Record<string, number> = {};
    const soma: Record<string, number> = {};
    for (const e of eventos) {
      if (!e.postId) continue;
      contagem[e.postId] = (contagem[e.postId] ?? 0) + 1;
      const ms = Number((e.payload as { dwellMs?: unknown } | null)?.dwellMs ?? 0);
      soma[e.postId] = (soma[e.postId] ?? 0) + (Number.isFinite(ms) && ms > 0 ? ms : 0);
    }
    for (const id of Object.keys(contagem)) {
      vistosPorPost[id] = Math.max(vistosPorPost[id] ?? 0, contagem[id]!);
      dwellPorPost[id] = Math.max(dwellPorPost[id] ?? 0, soma[id] ?? 0);
    }
    return { vistosPorPost, dwellPorPost };
  }

  private async composicaoDoRaioX(tx: Tx, run: RunDoEstudante): Promise<ComposicaoDoRaioX | null> {
    const { posts, estado, ladoDele } = await this.acervo(tx, run);
    const { vistosPorPost, dwellPorPost } = await this.vistos(tx, run, estado);
    return comporRaioX({ posts, vistosPorPost, dwellPorPost, ladoDele, semente: run.id });
  }

  private linhaDaTarefa(tx: Tx, runId: string, tarefa: Tarefa) {
    return tx.tarefaDaSessao.findUnique({ where: { runId_tarefa: { runId, tarefa } } });
  }

  /**
   * A linha da tarefa, criada na PRIMEIRA leitura com a composição que a tela
   * vai mostrar. `createMany` + `skipDuplicates` é o `ON CONFLICT DO NOTHING`:
   * duas abas abrindo juntas não abortam a transação, e a segunda lê a da
   * primeira.
   */
  private async linhaOuCriar(tx: Tx, run: RunDoEstudante, tarefa: Tarefa, composicao: () => Prisma.InputJsonObject) {
    const existente = await this.linhaDaTarefa(tx, run.id, tarefa);
    if (existente) return existente;
    await tx.tarefaDaSessao.createMany({
      data: [{ escolaId: run.escolaId, runId: run.id, tarefa, composicao: composicao() }],
      skipDuplicates: true,
    });
    return tx.tarefaDaSessao.findUniqueOrThrow({ where: { runId_tarefa: { runId: run.id, tarefa } } });
  }

  /** A situação das três tarefas — é por ela que a experiência decide o desvio por fase. */
  private async situacaoNaTransacao(tx: Tx, run: RunDoEstudante): Promise<SituacaoDasTarefas> {
    const [{ ladoDele }, linhas, composicao] = await Promise.all([
      this.acervo(tx, run),
      tx.tarefaDaSessao.findMany({ where: { runId: run.id }, select: { tarefa: true, enviadaEm: true } }),
      this.composicaoDoRaioX(tx, run),
    ]);
    const enviada = (t: Tarefa) => linhas.some((l) => l.tarefa === t && l.enviadaEm !== null);
    const revelacaoConcluida = run.revelacaoConcluidaEm !== null;

    const raioX: SituacaoDaTarefa = enviada("raio-x")
      ? "enviada"
      : !composicao
        ? "indisponivel"
        : revelacaoConcluida
          ? "encerrada"
          : aPartirDe(run.fase, "conclusao")
            ? "pendente"
            : "aguardando";

    const posRevelacao = (t: Tarefa): SituacaoDaTarefa => {
      if (enviada(t)) return "enviada";
      if (!ladoDele) return "indisponivel";
      return revelacaoConcluida && aPartirDe(run.fase, "perdidos") ? "pendente" : "aguardando";
    };
    return { revelacaoConcluida, raioX, termos: posRevelacao("termos"), envio: posRevelacao("envio") };
  }

  async situacao(runId: string, estudanteId: string, escolaId: string): Promise<SituacaoDasTarefas> {
    return this.prisma.comTenancy(async (tx) => this.situacaoNaTransacao(tx, await this.run(tx, runId, estudanteId, escolaId)), escolaId);
  }

  /**
   * O Raio-x está PENDENTE e vai aparecer? Enquanto estiver, o relatório do
   * estudante chega sem o lado, a intensidade e a categoria dos posts em que
   * ele mais parou — o post do lado dele em que mais parou entra sempre no
   * Raio-x, e o relatório entregaria o gabarito (o caso de quem faz o 6a na
   * entrada da explicabilidade, depois de o relatório já ser legível).
   */
  async raioXPendente(runId: string, escolaId: string): Promise<boolean> {
    return this.prisma.comTenancy(async (tx) => {
      const run = await tx.run.findFirst({ where: { id: runId, escolaId }, select: { estudanteId: true } });
      if (!run) return false;
      const completa = await this.run(tx, runId, run.estudanteId, escolaId);
      return (await this.situacaoNaTransacao(tx, completa)).raioX === "pendente";
    }, escolaId);
  }

  /**
   * A reflexão desta sessão PODE ser lida pela IA? Só a de quem teve feed com
   * lado e chegou à última tela da revelação — a mesma condição das tarefas.
   * Chamada DENTRO da transação do primeiro salvamento.
   */
  async podeLerAReflexao(tx: Tx, runId: string, estudanteId: string, escolaId: string): Promise<boolean> {
    const run = await runDoEstudante(tx, runId, estudanteId, escolaId);
    if (!run || run.revelacaoConcluidaEm === null) return false;
    return (await this.acervo(tx, run)).ladoDele !== null;
  }

  // ── a marca ─────────────────────────────────────────────────────────────

  /**
   * Marca a evidência da tarefa, se ainda não houver marca dela — VALE O
   * PRIMEIRO ENVIO. Devolve `true` quando a tarefa foi REFEITA (já havia marca:
   * o reinício reabriu a tarefa, e o nível de antes fica). Atividade sem turma
   * não tem evidência.
   */
  private async marcarPrimeiro(
    tx: Tx,
    run: RunDoEstudante & { activity: { id: string } },
    turmaId: string | null,
    marcadores: readonly string[],
    marca: { marcador: string; status: "atingiu" | "em_processo" | "nao_atingiu" },
  ): Promise<boolean> {
    const contexto = contextoDaRun({ id: run.activityId, turmaId });
    if (!contexto) return false;
    const base = { escolaId: run.escolaId, expId: EXP_ID, estudanteId: run.estudanteId, ...contexto };
    if (await this.evidencias.jaMarcou(tx, base, marcadores)) return true;
    await this.evidencias.marcar(tx, { ...base, marcador: marca.marcador, status: marca.status });
    return false;
  }

  private async turmaDaAtividade(tx: Tx, activityId: string) {
    return (await tx.activity.findUniqueOrThrow({ where: { id: activityId }, select: { turmaId: true } })).turmaId;
  }

  private jaEnviada(): never {
    // Linguagem de app real: nada de "tarefa" ou "fase".
    throw new ConflictException({ codigo: "tarefa-ja-enviada", mensagem: "Isso já foi enviado." });
  }

  private indisponivel(): never {
    throw new ConflictException({ codigo: "tarefa-indisponivel", mensagem: "Ainda não é hora disso." });
  }

  // ── 6a Raio-x ───────────────────────────────────────────────────────────

  async lerRaioX(runId: string, estudanteId: string, escolaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const run = await this.run(tx, runId, estudanteId, escolaId);
      const situacao = (await this.situacaoNaTransacao(tx, run)).raioX;
      if (situacao !== "pendente" && situacao !== "enviada") return { situacao, posts: [], rotulos: await this.rotulos(tx, run) };
      const composicao = await this.composicaoDoRaioX(tx, run);
      const linha = await this.linhaOuCriar(tx, run, "raio-x", () => ({
        postIds: composicao?.postIds ?? [],
        maisParou: composicao?.maisParou ?? "",
      }));
      const postIds = (linha.composicao as { postIds: string[] }).postIds;
      const posts = await tx.post.findMany({ where: { id: { in: postIds } }, include: INCLUIR_DO_FEED });
      const porId = new Map(posts.map((p) => [p.id, p]));
      return {
        situacao,
        rotulos: await this.rotulos(tx, run),
        /* O mesmo sanitizador do feed: nem aqui o lado desce. */
        posts: postIds
          .map((id) => porId.get(id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => paraFeedPost(p as never, false)),
      };
    }, escolaId);
  }

  async enviarRaioX(runId: string, estudanteId: string, escolaId: string, respostas: Record<string, OpcaoDoRaioX>) {
    return this.prisma.comTenancy(async (tx) => {
      const run = await this.run(tx, runId, estudanteId, escolaId);
      const situacao = (await this.situacaoNaTransacao(tx, run)).raioX;
      if (situacao === "enviada") this.jaEnviada();
      if (situacao !== "pendente") this.indisponivel();
      const linha = await this.linhaDaTarefa(tx, run.id, "raio-x");
      if (!linha) this.indisponivel();
      const { postIds, maisParou } = linha.composicao as { postIds: string[]; maisParou: string };
      const ids = Object.keys(respostas);
      if (ids.length !== postIds.length || !postIds.every((id) => id in respostas)) {
        throw new BadRequestException({ codigo: "resposta-incompleta", mensagem: "Escolhe uma opção em cada post." });
      }
      const posts = await tx.post.findMany({ where: { id: { in: postIds } }, select: { id: true, lado: true } });
      const gabarito = Object.fromEntries(posts.map((p) => [p.id, gabaritoDoPost(p.lado)]));
      const { nivel } = nivelDoRaioX({ respostas, gabarito, maisParou });

      const refeita = await this.marcarPrimeiro(tx, run, await this.turmaDaAtividade(tx, run.activityId), [MARCADOR_DA_TAREFA["raio-x"]], {
        marcador: MARCADOR_DA_TAREFA["raio-x"],
        status: nivel,
      });
      await tx.tarefaDaSessao.update({
        where: { id: linha.id },
        data: { respostas, enviadaEm: new Date(), refeita },
      });
      return { enviada: true as const };
    }, escolaId);
  }

  /**
   * A DEVOLUTIVA do Raio-x — dentro da revelação, como ponte: os 6 posts e de
   * onde cada um veio. Só da explicabilidade em diante, e só para quem enviou:
   * antes disso derrubaria o disfarce. Sem certo ou errado, sem contagem.
   */
  async devolutivaDoRaioX(runId: string, estudanteId: string, escolaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const run = await this.run(tx, runId, estudanteId, escolaId);
      if (!aPartirDe(run.fase, "explicabilidade")) naoEncontrado();
      const linha = await this.linhaDaTarefa(tx, run.id, "raio-x");
      if (!linha?.enviadaEm) return { posts: [] };
      const postIds = (linha.composicao as { postIds: string[] }).postIds;
      const posts = await tx.post.findMany({ where: { id: { in: postIds } }, include: INCLUIR_DO_FEED });
      const porId = new Map(posts.map((p) => [p.id, p]));
      return {
        posts: postIds
          .map((id) => porId.get(id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => ({ ...paraFeedPost(p as never, false), origem: gabaritoDoPost(p.lado) })),
      };
    }, escolaId);
  }

  // ── o fim da revelação ──────────────────────────────────────────────────

  /**
   * "Ver meu relatório": o estudante chegou à última tela da revelação. Abre
   * o 6b e o 6c, e fecha o Raio-x. Idempotente — a primeira data fica.
   */
  async concluirRevelacao(runId: string, estudanteId: string, escolaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const run = await this.run(tx, runId, estudanteId, escolaId);
      if (!aPartirDe(run.fase, "explicabilidade")) this.indisponivel();
      await tx.run.updateMany({
        where: { id: run.id, escolaId, revelacaoConcluidaEm: null },
        data: { revelacaoConcluidaEm: new Date() },
      });
      return { ok: true as const };
    }, escolaId);
  }

  // ── 6b Os termos ────────────────────────────────────────────────────────

  async lerTermos(runId: string, estudanteId: string, escolaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const run = await this.run(tx, runId, estudanteId, escolaId);
      const situacao = (await this.situacaoNaTransacao(tx, run)).termos;
      if (situacao !== "pendente" && situacao !== "enviada") {
        return { situacao, clausulas: [], efeitos: [], mudancas: [] };
      }
      const aleatorio = aleatorioDe(`termos:${run.id}`);
      const linha = await this.linhaOuCriar(tx, run, "termos", () => ({
        efeitos: embaralhar(EFEITOS.map((e) => e.id), aleatorio),
        mudancas: embaralhar(MUDANCAS.map((m) => m.id), aleatorio),
      }));
      const { efeitos, mudancas } = linha.composicao as { efeitos: EfeitoId[]; mudancas: MudancaId[] };
      return {
        situacao,
        /* As cláusulas na ordem fixa; as opções na ordem sorteada para esta sessão. Sem gabarito. */
        clausulas: CLAUSULAS.map((c) => ({ id: c.id, texto: c.texto })),
        efeitos: efeitos.map((id) => ({ id, texto: EFEITOS.find((e) => e.id === id)!.texto })),
        mudancas: mudancas.map((id) => ({ id, texto: MUDANCAS.find((m) => m.id === id)!.texto })),
      };
    }, escolaId);
  }

  async enviarTermos(
    runId: string,
    estudanteId: string,
    escolaId: string,
    resposta: { marcadas: ClausulaId[]; efeitos: Partial<Record<ClausulaId, EfeitoId>>; mudanca: MudancaId },
  ) {
    if (!efeitosCoerentes(resposta)) {
      throw new BadRequestException({
        codigo: "resposta-incompleta",
        mensagem: "Diz o que cada regra marcada fez no seu feed.",
      });
    }
    return this.prisma.comTenancy(async (tx) => {
      const run = await this.run(tx, runId, estudanteId, escolaId);
      const situacao = (await this.situacaoNaTransacao(tx, run)).termos;
      if (situacao === "enviada") this.jaEnviada();
      if (situacao !== "pendente") this.indisponivel();
      const linha = await this.linhaDaTarefa(tx, run.id, "termos");
      if (!linha) this.indisponivel();
      const { nivel } = nivelDosTermos(resposta);
      const refeita = await this.marcarPrimeiro(tx, run, await this.turmaDaAtividade(tx, run.activityId), [MARCADOR_DA_TAREFA.termos], {
        marcador: MARCADOR_DA_TAREFA.termos,
        status: nivel,
      });
      await tx.tarefaDaSessao.update({
        where: { id: linha.id },
        data: { respostas: resposta as unknown as Prisma.InputJsonObject, enviadaEm: new Date(), refeita },
      });
      return { enviada: true as const };
    }, escolaId);
  }

  // ── 6c Mandar pra quem não viu ──────────────────────────────────────────

  private async acervoDoEnvio(tx: Tx, activityId: string): Promise<PostDoEnvio[]> {
    const posts = await tx.post.findMany({
      where: { activityId, aprovado: true },
      select: { id: true, lado: true, categoria: true, aprovado: true, author: { select: { tipo: true } } },
    });
    return posts.map((p) => ({ id: p.id, lado: p.lado, categoria: p.categoria, aprovado: p.aprovado, tipoDoAutor: p.author.tipo }));
  }

  async lerEnvio(runId: string, estudanteId: string, escolaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const run = await this.run(tx, runId, estudanteId, escolaId);
      const situacao = (await this.situacaoNaTransacao(tx, run)).envio;
      if (situacao !== "pendente" && situacao !== "enviada") return { situacao, posts: [], mensagens: [] };
      const acervo = await this.acervoDoEnvio(tx, run.activityId);
      const linha = await this.linhaOuCriar(tx, run, "envio", () => ({
        postIds: montarEnvio(acervo, run.id) ?? [],
        mensagens: embaralhar(
          MENSAGENS.map((m) => m.id),
          aleatorioDe(`mensagens:${run.id}`),
        ),
      }));
      const { postIds, mensagens } = linha.composicao as { postIds: string[]; mensagens: MensagemId[] };
      const posts = await tx.post.findMany({ where: { id: { in: postIds } }, include: INCLUIR_DO_FEED });
      const porId = new Map(posts.map((p) => [p.id, p]));
      return {
        situacao,
        /* Sem lado: o estudante reconhece os lados pelo que lê. A descrição do
           perfil vai junto — é ela que mostra a página de fofoca ou de humor. */
        posts: postIds
          .map((id) => porId.get(id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => ({ ...paraFeedPost(p as never, false), bio: p.author.bio ?? null })),
        mensagens: mensagens.map((id) => ({ id, texto: MENSAGENS.find((m) => m.id === id)!.texto })),
      };
    }, escolaId);
  }

  async enviarEnvio(
    runId: string,
    estudanteId: string,
    escolaId: string,
    resposta: { posts: string[]; mensagem: MensagemId; frase?: string | null },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const run = await this.run(tx, runId, estudanteId, escolaId);
      const situacao = (await this.situacaoNaTransacao(tx, run)).envio;
      if (situacao === "enviada") this.jaEnviada();
      if (situacao !== "pendente") this.indisponivel();
      const linha = await this.linhaDaTarefa(tx, run.id, "envio");
      if (!linha) this.indisponivel();
      const { postIds } = linha.composicao as { postIds: string[] };
      if (!resposta.posts.every((id) => postIds.includes(id))) {
        throw new BadRequestException({ codigo: "post-fora-do-envio", mensagem: "Escolhe entre os posts da tela." });
      }
      const acervo = await this.acervoDoEnvio(tx, run.activityId);
      const selecao = acervo.filter((p) => resposta.posts.includes(p.id));
      const mensagem = MENSAGENS.find((m) => m.id === resposta.mensagem)!;
      const { nivel, marcador } = nivelDoEnvio({
        linha: linhaDaSelecao(selecao),
        mensagem: mensagem.tipo,
        medeConfiabilidade: medeConfiabilidade(acervo),
      });
      const refeita = await this.marcarPrimeiro(
        tx,
        run,
        await this.turmaDaAtividade(tx, run.activityId),
        [MARCADOR_DA_TAREFA.envio, MARCADOR_DO_ENVIO_LIMITADO],
        { marcador, status: nivel },
      );
      const frase = resposta.frase?.trim() || null;
      await tx.tarefaDaSessao.update({
        where: { id: linha.id },
        data: {
          respostas: { posts: resposta.posts, mensagem: resposta.mensagem },
          enviadaEm: new Date(),
          refeita,
          frase,
        },
      });
      return { enviada: true as const };
    }, escolaId);
  }

  /** Os rótulos dos lados, para as opções do Raio-x ("puxa para …"). */
  private async rotulos(tx: Tx, run: RunDoEstudante) {
    const atividade = await tx.activity.findUniqueOrThrow({ where: { id: run.activityId }, select: { antagonismo: true } });
    /* Só os rótulos, como no `boot`: são os únicos campos do antagonismo que o
       aparelho pode ver antes da revelação. */
    const bruto = atividade.antagonismo as { ladoA?: { label?: string }; ladoB?: { label?: string } } | null;
    return { A: bruto?.ladoA?.label ?? "Um lado", B: bruto?.ladoB?.label ?? "O outro lado" };
  }
}
