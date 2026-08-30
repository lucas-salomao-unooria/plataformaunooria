import type { Prisma } from '@prisma/client';

import {
  curarBloco,
  curarBlocoInicial,
  deveEncerrar,
  deveMostrarSugestoes,
  deveNotificarSeguidor,
} from './curadoria';
import { normalizarEstado } from './estado';
import { aplicarEventos, dominioDe } from './eventos';
import { paraFeedPost } from './sanitizador';
import type {
  EngineConfig,
  EngineState,
  EventoPontuavel,
  FeedPost,
  ModuloFeed,
  PerfilSugerido,
  PostMeta,
  TipoEvento,
} from './tipos';
import type { Intensidade, Lado } from '../comum/insta/tipos';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Serviço do feed: processa eventos pendentes, cura o próximo bloco e persiste
 * o estado. O route handler é só a casca HTTP — assim os testes do doc 04 §8
 * podem rodar o motor de verdade contra um Postgres de teste.
 */
export interface BlocoDoFeed {
  posts: FeedPost[];
  modulos: ModuloFeed[];
  /** Só para diagnóstico interno (nunca vai ao cliente). */
  diagnostico: { dominio: number; ladoDominante: Lado; bloco: number };
}

export async function proximoBlocoDoFeed(
  prisma: PrismaService,
  runId: string,
  escolaId: string,
): Promise<BlocoDoFeed> {
  /**
   * Lock consultivo por run dentro de uma transação: dois pedidos simultâneos de
   * bloco (duas abas, reload no meio do fetch, retry) se sobrescreviam e um bloco
   * inteiro desaparecia do estado — posts entregues voltavam a ser servidos e a
   * série por bloco do dossiê ficava corrompida.
   */
  return prisma.comTenancy(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${runId}, 0))`;
      return curarDentroDaTransacao(tx, runId);
    },
    escolaId,
    { timeout: 20_000 },
  );
}

type Transacao = Prisma.TransactionClient;

async function curarDentroDaTransacao(prisma: Transacao, runId: string): Promise<BlocoDoFeed> {
  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    include: { activity: { select: { id: true, engineConfig: true } } },
  });

  const config = run.activity.engineConfig as unknown as EngineConfig;
  const estadoSalvo = normalizarEstado(run.engineState);

  if (run.fase === 'encerramento' || run.fase === 'revelacao' || run.fase === 'dossie') {
    return {
      posts: [],
      modulos: [{ tipo: 'fim_sessao' }],
      diagnostico: { ...dominioDe(estadoSalvo, config), bloco: estadoSalvo.blocksServed },
    };
  }

  const [catalogoBruto, eventosPendentes, autoresBrutos] = await Promise.all([
    prisma.post.findMany({
      where: { activityId: run.activityId, aprovado: true },
      select: {
        id: true,
        lado: true,
        perfil: true,
        intensidade: true,
        categoria: true,
        authorId: true,
        likesCount: true,
      },
    }),
    prisma.event.findMany({
      where: { runId, id: { gt: BigInt(estadoSalvo.ultimoEventoProcessado) } },
      orderBy: { id: 'asc' },
      take: 2000,
      select: { id: true, tipo: true, postId: true, payload: true },
    }),
    prisma.author.findMany({
      where: { activityId: run.activityId },
      select: { id: true, lado: true },
    }),
  ]);

  const ladoPorAutor = new Map<string, Lado>(autoresBrutos.map((autor) => [autor.id, autor.lado as Lado]));

  const catalogo: PostMeta[] = catalogoBruto.map((post) => ({
    id: post.id,
    lado: post.lado as Lado,
    perfil: post.perfil,
    intensidade: post.intensidade as Intensidade,
    categoria: post.categoria,
    authorId: post.authorId,
    likesCount: post.likesCount,
  }));
  const mapaPosts = new Map(catalogo.map((post) => [post.id, post]));

  const eventos: EventoPontuavel[] = eventosPendentes.map((evento) => ({
    id: String(evento.id),
    tipo: evento.tipo as TipoEvento,
    postId: evento.postId,
    payload: (evento.payload ?? {}) as Record<string, unknown>,
  }));

  const dwellNorms: { eventoId: string; dwellNorm: number }[] = [];
  let estado: EngineState = aplicarEventos(estadoSalvo, eventos, mapaPosts, config, ladoPorAutor, dwellNorms);

  // Doc 04 §2: o evento guarda dwell bruto E normalizado.
  for (const item of dwellNorms.slice(0, 80)) {
    await prisma.event.update({
      where: { id: BigInt(item.eventoId) },
      data: { payload: { ...(eventosPendentes.find((e) => String(e.id) === item.eventoId)?.payload as object ?? {}), dwellNorm: item.dwellNorm } },
    });
  }

  if (deveEncerrar(estado, config, run.startedAt)) {
    await prisma.run.update({
      where: { id: runId },
      data: { fase: 'encerramento', engineState: { ...estado, versao: estado.versao + 1 } as unknown as Prisma.InputJsonObject },
    });
    return {
      posts: [],
      modulos: [{ tipo: 'fim_sessao' }],
      diagnostico: { ...dominioDe(estado, config), bloco: estado.blocksServed },
    };
  }

  const bloco =
    estado.blocksServed === 0
      ? // O bloco inicial já nasce inclinado para o lado que o perfil indicou.
        curarBlocoInicial(catalogo, Math.random, estado.ladoInicial ?? 'A')
      : curarBloco(estado, catalogo, config);

  // Catálogo esgotado: encerra a sessão em vez de devolver um feed vazio (que
  // deixaria o estudante numa tela morta, sem próximo bloco e sem encerramento).
  if (bloco.ids.length === 0) {
    await prisma.run.update({
      where: { id: runId },
      data: { fase: 'encerramento', engineState: { ...estado, versao: estado.versao + 1 } as unknown as Prisma.InputJsonObject },
    });
    return {
      posts: [],
      modulos: [{ tipo: 'fim_sessao' }],
      diagnostico: { ...dominioDe(estado, config), bloco: estado.blocksServed },
    };
  }

  /**
   * Exposição por perfil (doc 04 §7). É o DENOMINADOR da métrica de perfil
   * observado: sem ele, o dossiê afirmaria que o estudante prefere a linguagem X
   * quando o feed simplesmente serviu mais X. Contar aqui, no momento de servir,
   * é o único lugar em que a informação existe.
   */
  const metaPorId = new Map(catalogo.map((post) => [post.id, post]));
  const exposicao = { ...(estado.exposicaoPorPerfil ?? {}) };
  for (const id of bloco.ids) {
    const perfil = metaPorId.get(id)?.perfil;
    if (perfil) exposicao[perfil] = (exposicao[perfil] ?? 0) + 1;
  }

  estado = {
    ...estado,
    servedPostIds: [...estado.servedPostIds, ...bloco.ids],
    blocosServidos: [...estado.blocosServidos, bloco.ids],
    blocksServed: estado.blocksServed + 1,
    exposicaoPorPerfil: exposicao,
    versao: estado.versao + 1,
    feedIniciadoEm: estado.feedIniciadoEm ?? new Date().toISOString(),
  };

  const { dominio, ladoDominante } = dominioDe(estado, config);
  const modulos: ModuloFeed[] = [];

  if (ladoDominante !== 'neutro') {
    const querSugestoes = deveMostrarSugestoes(estado, config, dominio);
    const querNotificacao = deveNotificarSeguidor(estado, config, dominio);

    if (querSugestoes || querNotificacao) {
      const perfis = await perfisDoLado(
        prisma,
        run.activityId,
        ladoDominante,
        estado.followedAuthors,
        config.sugestoes.perfis + 1,
      );

      if (querSugestoes && perfis.length > 0) {
        modulos.push({ tipo: 'sugestoes', perfis: perfis.slice(0, config.sugestoes.perfis) });
        estado = { ...estado, ultimoBlocoSugestoes: estado.blocksServed };
      }
      if (querNotificacao && perfis.length > 0) {
        // `!`: guardado pelo `perfis.length > 0` (noUncheckedIndexedAccess).
        modulos.push({ tipo: 'notificacao_seguidor', perfil: perfis[perfis.length - 1]! });
        estado = { ...estado, notificouSeguidor: true };
      }
    }
  }

  await prisma.run.update({
    where: { id: runId },
    data: { fase: 'feed', engineState: estado as unknown as Prisma.InputJsonObject },
  });

  const completos = await prisma.post.findMany({
    where: { id: { in: bloco.ids } },
    select: {
      id: true,
      caption: true,
      hashtags: true,
      likesCount: true,
      timestampLabel: true,
      imageUrl: true,
      imageStatus: true,
      categoria: true,
      author: { select: { handle: true, displayName: true, verificado: true } },
      comments: { orderBy: { ordem: 'asc' }, take: 2, select: { handle: true, texto: true } },
      _count: { select: { comments: true } },
    },
  });

  const porId = new Map(completos.map((post) => [post.id, post]));
  const posts = bloco.ids
    .map((postId) => porId.get(postId))
    .filter((post): post is NonNullable<typeof post> => Boolean(post))
    .map((post) => paraFeedPost(post, bloco.sugeridos.has(post.id)));

  return { posts, modulos, diagnostico: { dominio, ladoDominante, bloco: estado.blocksServed } };
}

/** Perfis do lado dominante com mais posts, ainda não seguidos (doc 04 §5). */
async function perfisDoLado(
  prisma: Transacao,
  activityId: string,
  lado: Lado,
  seguidos: string[],
  quantidade: number,
): Promise<PerfilSugerido[]> {
  const autores = await prisma.author.findMany({
    where: { activityId, lado, ...(seguidos.length > 0 ? { id: { notIn: seguidos } } : {}) },
    select: {
      id: true,
      handle: true,
      displayName: true,
      verificado: true,
      _count: { select: { posts: true } },
    },
  });

  return autores
    .sort((a, b) => b._count.posts - a._count.posts)
    .slice(0, quantidade)
    .map((autor) => ({
      authorId: autor.id,
      handle: autor.handle,
      displayName: autor.displayName,
      verificado: autor.verificado,
      avatarSeed: autor.handle,
    }));
}
