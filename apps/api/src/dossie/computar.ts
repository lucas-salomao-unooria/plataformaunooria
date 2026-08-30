import type { Prisma } from '@prisma/client';

import { arteFallback } from '../geracao/arte-fallback';
import { PERFIS, type Perfil } from '../comum/insta/defaults';
import { FICHAS } from '../comum/insta/perfis';
import { normalizarEstado } from '../motor/estado';
import { dominioDe } from '../motor/eventos';
import type { EngineConfig, EngineState } from '../motor/tipos';
import { antagonismoSchema } from '../comum/insta/tipos';
import { normalizarPerfil, rotuloDoPerfil } from '../perfis/afinidade';
import { PrismaService } from '../prisma/prisma.service';

import { calcularExposicao } from './exposicao';
import {
  calcularBolha,
  calcularImersao,
  calcularInvestigacao,
  calcularPerfilObservado,
  calcularRitmo,
  calcularTempo,
  type EventoDeTelemetria,
  type MetaDePost,
} from './telemetria';
import {
  VERSAO_DO_RELATORIO,
  type DossierData,
  type ExplicacaoDoLado,
  type PostDoDossie,
  type RespostaDossie,
} from './tipos';

type Transacao = Prisma.TransactionClient;

/**
 * Cômputo do dossiê (doc 04 §6 e doc 06). Roda no finish: congela a run e
 * transforma a sessão em evidência — com os números reais do estudante.
 */
export async function computarDossie(
  prisma: PrismaService,
  runId: string,
  escolaId: string,
): Promise<DossierData> {
  return prisma.comTenancy((tx) => computarDossieNaTransacao(tx, runId), escolaId);
}

async function computarDossieNaTransacao(prisma: Transacao, runId: string): Promise<DossierData> {
  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    include: {
      estudante: { select: { displayName: true, avatar: true } },
      activity: {
        select: { id: true, titulo: true, perguntaChave: true, antagonismo: true, engineConfig: true },
      },
      studentPosts: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const config = run.activity.engineConfig as unknown as EngineConfig;
  const estado: EngineState = normalizarEstado(run.engineState);
  const antagonismo = antagonismoSchema.safeParse(run.activity.antagonismo);

  const metas = await prisma.post.findMany({
    where: { activityId: run.activityId },
    select: { id: true, lado: true, perfil: true, intensidade: true, aprovado: true },
  });
  const porId = new Map(metas.map((post) => [post.id, post]));
  /** A telemetria só precisa de lado/perfil/intensidade — mapa enxuto e puro. */
  const metaPorId: Map<string, MetaDePost> = new Map(
    metas.map((post) => [post.id, { lado: post.lado, perfil: post.perfil, intensidade: post.intensidade }]),
  );

  // ---- proporção final e domínio ----
  const servidos = estado.servedPostIds.map((id) => porId.get(id)).filter(Boolean) as typeof metas;
  const contagem = { A: 0, B: 0, neutro: 0 };
  for (const post of servidos) contagem[post.lado as 'A' | 'B' | 'neutro'] += 1;

  const total = Math.max(1, servidos.length);
  const { dominio, ladoDominante } = dominioDe(estado, config);
  const dominanteFinal: DossierData['ladoDominante'] =
    ladoDominante === 'neutro' || dominio <= 0.5 ? 'indefinido' : ladoDominante;

  // ---- série por bloco (a bolha se fechando) ----
  const porBloco = estado.blocosServidos.map((ids, indice) => {
    const doBloco = ids.map((id) => porId.get(id)).filter(Boolean) as typeof metas;
    const totalBloco = Math.max(1, doBloco.length);

    const doDominante = doBloco.filter((post) => post.lado === dominanteFinal);
    const intensidadeMedia =
      doDominante.length > 0
        ? doDominante.reduce((soma, post) => soma + post.intensidade, 0) / doDominante.length
        : 0;

    return {
      bloco: indice + 1,
      A: Math.round((doBloco.filter((post) => post.lado === 'A').length / totalBloco) * 100) / 100,
      B: Math.round((doBloco.filter((post) => post.lado === 'B').length / totalBloco) * 100) / 100,
      neutro: Math.round((doBloco.filter((post) => post.lado === 'neutro').length / totalBloco) * 100) / 100,
      intensidadeMediaDominante: Math.round(intensidadeMedia * 100) / 100,
    };
  });

  // ---- top 5 por dwell ----
  const topDwell = Object.entries(estado.dwellPorPost)
    .filter(([postId]) => porId.has(postId))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([postId, dwellMs]) => ({ postId, dwellMs }));

  /**
   * ---- o que o algoritmo escondeu ----
   *
   * Pela EXPOSIÇÃO, não pelo domínio (ADR-42): esta é a mesma conta que a tela
   * dos posts perdidos mostra ao estudante, e as duas precisavam nomear o mesmo
   * lado. Antes esta linha usava `dominanteFinal`, e nos estudantes que viraram o
   * jogo ela contava os posts do lado que o algoritmo estava EMPURRANDO neles.
   */
  const exposicao = calcularExposicao(estado.servedPostIds, metas);

  // ---- interações e sinais ----
  const eventos = await prisma.event.groupBy({
    by: ['tipo'],
    where: { runId },
    _count: { _all: true },
  });
  const conta = (tipo: string) => eventos.find((linha) => linha.tipo === tipo)?._count._all ?? 0;

  /**
   * A lista crua (não só a contagem) é o que a telemetria do doc 11 §3 precisa:
   * tempo ativo, ritmo e exploração dependem dos INSTANTES, não do total.
   */
  const trilha = await prisma.event.findMany({
    where: { runId },
    select: { tipo: true, postId: true, payload: true, clientTs: true },
    orderBy: { id: 'asc' },
  });
  const trilhaDeTelemetria: EventoDeTelemetria[] = trilha.map((evento) => ({
    tipo: evento.tipo,
    postId: evento.postId,
    payload: evento.payload,
    clientTs: Number(evento.clientTs),
  }));

  const interacoes = {
    curtidas: conta('curtiu'),
    comentarios: conta('comentou'),
    salvos: conta('salvou'),
    compartilhados: conta('compartilhou'),
    seguidos: conta('seguiu'),
    naoInteressa: conta('nao_interessa') + conta('denunciou'),
  };

  const dwellMedio = (lado: 'A' | 'B' | 'neutro'): number => {
    const valores = Object.entries(estado.dwellPorPost)
      .filter(([postId]) => porId.get(postId)?.lado === lado)
      .map(([, dwellMs]) => dwellMs);
    if (valores.length === 0) return 0;
    return valores.reduce((soma, valor) => soma + valor, 0) / valores.length / 1000;
  };

  const segundos = (valor: number) => `${valor.toFixed(1).replace('.', ',')}s`;
  const ladoOutro = dominanteFinal === 'A' ? 'B' : 'A';

  const rotuloA = antagonismo.success ? antagonismo.data.ladoA.label : 'Lado A';
  const rotuloB = antagonismo.success ? antagonismo.data.ladoB.label : 'Lado B';
  const rotuloDe = (lado: 'A' | 'B' | 'indefinido') =>
    lado === 'A' ? rotuloA : lado === 'B' ? rotuloB : 'nenhum lado';

  // A contribuição do dwell sai dos números REAIS da sessão (antes era fixa em
  // 5 e 1, o que mentia quando os dois lados tiveram tempos parecidos).
  const ladoDoDwellDominante = dominanteFinal === 'indefinido' ? 'A' : dominanteFinal;
  const ladoDoDwellOutro = dominanteFinal === 'indefinido' ? 'B' : (ladoOutro as 'A' | 'B');
  const dwellDominante = dwellMedio(ladoDoDwellDominante);
  const dwellOutro = dwellMedio(ladoDoDwellOutro);
  const pontosDwell = (media: number): number => {
    const baseline = (estado.baselineDwellMs ?? 2000) / 1000;
    if (baseline <= 0) return 0;
    const norma = media / baseline;
    return config.dwell.faixas.find((faixa) => norma >= faixa.min)?.pontos ?? 0;
  };

  // `?? 0` nos pesos: guarda exigida pelo noUncheckedIndexedAccess do monorepo
  // (`pesos` é Record<string, number>); os defaults sempre trazem essas chaves.
  const sinais: DossierData['sinais'] = [
    {
      sinal: `Tempo parado nos posts de "${rotuloDe(ladoDoDwellDominante)}"`,
      valorSessao: segundos(dwellDominante),
      contribuicao: pontosDwell(dwellDominante),
    },
    {
      sinal: `Tempo parado nos posts de "${rotuloDe(ladoDoDwellOutro)}"`,
      valorSessao: segundos(dwellOutro),
      contribuicao: pontosDwell(dwellOutro),
    },
    { sinal: 'Curtidas', valorSessao: String(interacoes.curtidas), contribuicao: config.pesos.curtiu ?? 0 },
    { sinal: 'Comentários', valorSessao: String(interacoes.comentarios), contribuicao: config.pesos.comentou ?? 0 },
    { sinal: 'Perfis que você seguiu', valorSessao: String(interacoes.seguidos), contribuicao: config.pesos.seguiu ?? 0 },
    { sinal: 'Posts salvos', valorSessao: String(interacoes.salvos), contribuicao: config.pesos.salvou ?? 0 },
    {
      sinal: 'Comentários que você abriu',
      valorSessao: String(conta('abriu_comentarios')),
      contribuicao: config.pesos.abriu_comentarios ?? 0,
    },
  ];

  const studentPost = run.studentPosts[0];

  // ---- doc 11 §3: tempo, ritmo, imersão, investigação, bolha e perfil ----
  const entradaDeTelemetria = {
    eventos: trilhaDeTelemetria,
    estado,
    config,
    porId: metaPorId,
    run: {
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      ladoInicial: run.ladoInicial,
      ladoOrigem: run.ladoOrigem,
    },
  };

  const tempo = calcularTempo(entradaDeTelemetria);
  const ritmo = calcularRitmo(entradaDeTelemetria, tempo);
  const imersao = calcularImersao(entradaDeTelemetria, tempo);
  const investigacao = calcularInvestigacao(entradaDeTelemetria);
  /**
   * A inversão é calculada com CONTAGEM por bloco, não com as proporções que
   * `porBloco` guarda para o gráfico: blocos têm tamanhos diferentes.
   */
  const contagemPorBloco = estado.blocosServidos.map((ids, indice) => {
    const doBloco = ids.map((id) => porId.get(id)).filter(Boolean) as typeof metas;
    return {
      bloco: indice + 1,
      A: doBloco.filter((post) => post.lado === 'A').length,
      B: doBloco.filter((post) => post.lado === 'B').length,
    };
  });
  const bolha = calcularBolha(entradaDeTelemetria, dominanteFinal, contagemPorBloco);

  /**
   * O perfil do jogo é renormalizado aqui também. O servidor nunca confia no que
   * o Ato 1 mandou (doc 10 §4) — e a run guarda o bruto justamente para que essa
   * derivação possa ser revista sem perder o dado original.
   */
  /**
   * `perfil_jogo` guarda o PerfilDeValores inteiro (`{escores, dominante}`), não
   * os escores soltos — é o shape do doc 10 §4. Normalizar o envelope em vez dos
   * escores fazia `normalizarPerfil` ler quatro `undefined`, cair no empate e
   * devolver `misto` para TODO estudante com perfil: a explicabilidade do relatório
   * virava "seu lado foi sorteado" mesmo quando tinha vindo do jogo.
   */
  const perfilBruto = run.perfilJogo as Record<string, unknown> | null;
  const envelope = perfilBruto?.escores;
  const escoresDoJogo: Record<string, number> | null =
    envelope && typeof envelope === 'object'
      ? (envelope as Record<string, number>)
      : perfilBruto
        ? (perfilBruto as Record<string, number>)
        : null;
  const perfilDoJogo = escoresDoJogo ? normalizarPerfil(escoresDoJogo) : null;
  const perfilObservado = calcularPerfilObservado(
    entradaDeTelemetria,
    perfilDoJogo ? perfilDoJogo.dominante : null,
  );

  const explicacaoDoLado = montarExplicacao({
    origem: run.ladoOrigem,
    dominante: perfilDoJogo?.dominante ?? null,
    ladoInicial: bolha.ladoInicial,
    ladoRotulo: rotuloDe(bolha.ladoInicial),
    afinidade: antagonismo.success ? antagonismo.data.afinidade : null,
  });

  return {
    versaoDoRelatorio: VERSAO_DO_RELATORIO,
    aluno: { displayName: run.estudante.displayName, avatar: run.estudante.avatar ?? 'avatar-01' },
    atividade: {
      titulo: run.activity.titulo,
      perguntaChave: run.activity.perguntaChave,
      ladoALabel: rotuloA,
      ladoBLabel: rotuloB,
    },
    proporcaoFinal: {
      A: Math.round((contagem.A / total) * 100) / 100,
      B: Math.round((contagem.B / total) * 100) / 100,
      neutro: Math.round((contagem.neutro / total) * 100) / 100,
    },
    ladoDominante: dominanteFinal,
    dominio: Math.round(dominio * 100) / 100,
    porBloco,
    topDwell,
    postsOcultados: {
      ladoOposto: exposicao.idsPerdidos,
      total: exposicao.perdidos,
      /**
       * `true` quando a sessão não serviu post de tese nenhum — sem isso, a tela
       * do professor lia "escondeu 0 posts", que afirma o contrário do que
       * aconteceu. É a diferença entre `zero` e `none` da Vila do Lume.
       */
      ladoNaoObservado: exposicao.ladoDele === null,
    },
    interacoes,
    sinais,
    bolha,
    explicacaoDoLado,
    perfilJogo: perfilDoJogo
      ? { escores: perfilDoJogo.escores, dominante: perfilDoJogo.dominante, origem: run.perfilOrigem }
      : null,
    perfilObservado,
    rotulosDePerfil: PERFIS.map((perfil) => ({
      chave: perfil,
      rotulo: FICHAS[perfil].rotulo,
      prende: FICHAS[perfil].prende,
    })),
    tempo,
    ritmo,
    investigacao,
    imersao,
    ...(studentPost ? { studentPost: { texto: studentPost.texto, ladoInferido: studentPost.ladoInferido } } : {}),
  };
}

/**
 * A frase da seção "por que seu feed começou desse lado" (doc 02 fase 6 §2).
 *
 * Três origens, três frases — e nenhuma delas pode fingir. Quando o lado veio de
 * sorteio, dizer "foi escolhido a partir de como você jogou" seria mentir para o
 * estudante na única tela do exercício que existe para não mentir.
 */
function montarExplicacao({
  origem,
  dominante,
  // Recebido para manter a assinatura do origem; a explicação usa o rótulo.
  ladoInicial: _ladoInicial,
  ladoRotulo,
  afinidade,
}: {
  origem: string;
  dominante: Perfil | 'misto' | null;
  ladoInicial: 'A' | 'B';
  ladoRotulo: string;
  afinidade: {
    por_que_abertura: string;
    por_que_autopromocao: string;
    por_que_conservacao?: string;
    por_que_autotranscendencia?: string;
  } | null;
}): ExplicacaoDoLado {
  const temPerfil = origem === 'perfil' && dominante !== null && dominante !== 'misto';

  /**
   * O "por quê" é o DO PERFIL DO ESTUDANTE, não o do eixo.
   *
   * A afinidade é decidida por eixo (doc 10 §5.2), mas a justificativa que a IA
   * escreve para o polo nomeado defende o lado DELE. Usá-la para o polo oposto
   * produzia uma frase incoerente no relatório: "o lado que fala a sua língua é B
   * — porque quem gosta de estratégia se identifica com A". Quando a justificativa
   * do polo do estudante não existe (atividade gerada antes do M8), a frase some.
   */
  const porQue = (() => {
    if (!temPerfil || !afinidade) return null;
    if (dominante === 'abertura') return afinidade.por_que_abertura;
    if (dominante === 'autopromocao') return afinidade.por_que_autopromocao;
    if (dominante === 'conservacao') return afinidade.por_que_conservacao ?? null;
    return afinidade.por_que_autotranscendencia ?? null;
  })();

  return {
    perfilRotulo: temPerfil ? rotuloDoPerfil(dominante as Perfil) : null,
    ladoRotulo,
    porQue,
    origem: temPerfil ? 'perfil' : origem === 'redistribuido' ? 'redistribuido' : 'sorteio',
  };
}

/**
 * Congela a run, grava o dossiê e move a fase para **`conclusao`** (doc 07).
 *
 * Mudou no M7: antes ia direto para `revelacao`. Agora o estudante responde a
 * pergunta-chave primeiro — uma conclusão escrita depois de saber que o feed era
 * enviesado não serve para nada, e é o par "conclusão × lado semeado" que dá a
 * punchline do relatório.
 *
 * O dossiê é COMPUTADO aqui e só fica legível a partir de `revelacao`: computar
 * antes garante que os dados congelam no instante em que a sessão terminou, e não
 * dependem de quanto tempo o estudante leva escrevendo.
 */
export async function encerrarRun(
  prisma: PrismaService,
  runId: string,
  escolaId: string,
): Promise<DossierData> {
  return prisma.comTenancy((tx) => encerrarRunNaTransacao(tx, runId, escolaId), escolaId);
}

async function encerrarRunNaTransacao(
  prisma: Transacao,
  runId: string,
  escolaId: string,
): Promise<DossierData> {
  const existente = await prisma.dossier.findUnique({ where: { runId } });
  const run = await prisma.run.findUniqueOrThrow({ where: { id: runId }, select: { finishedAt: true } });

  // Congelar é idempotente: chamar finish de novo não recomputa nem reescreve o
  // instante do encerramento.
  if (existente) {
    if (run.finishedAt === null) {
      await prisma.run.update({ where: { id: runId }, data: { fase: 'conclusao', finishedAt: new Date() } });
    }
    return existente.data as unknown as DossierData;
  }

  const dossie = await computarDossieNaTransacao(prisma, runId);

  // No origem estas duas escritas iam num `$transaction` próprio; aqui a
  // atomicidade vem da transação da tenancy que envolve a função inteira.
  await prisma.dossier.create({
    data: { runId, escolaId, data: dossie as unknown as Prisma.InputJsonObject },
  });
  await prisma.run.update({
    where: { id: runId },
    data: { fase: 'conclusao', finishedAt: run.finishedAt ?? new Date() },
  });

  return dossie;
}

export class DossieAindaNaoExiste extends Error {
  constructor() {
    super('dossiê ainda não computado');
    this.name = 'DossieAindaNaoExiste';
  }
}

/**
 * Monta a resposta do dossiê com as miniaturas referenciadas.
 * NUNCA encerra a run: um GET que congela a sessão desfazia o reset do professor
 * e, pior, entregava pesos do motor e rótulos dos lados antes da revelação.
 * O encerramento é só do `POST /finish` e do gatilho do motor.
 */
export async function montarRespostaDossie(
  prisma: PrismaService,
  runId: string,
  escolaId: string,
): Promise<RespostaDossie> {
  return prisma.comTenancy((tx) => montarRespostaDossieNaTransacao(tx, runId), escolaId);
}

async function montarRespostaDossieNaTransacao(
  prisma: Transacao,
  runId: string,
): Promise<RespostaDossie> {
  const [registro, conclusao] = await Promise.all([
    prisma.dossier.findUnique({ where: { runId } }),
    prisma.conclusao.findUnique({ where: { runId } }),
  ]);
  if (!registro) throw new DossieAindaNaoExiste();

  /**
   * Dossiê congelado numa versão anterior do cômputo é recomputado na leitura.
   * Seguro **porque a run está congelada**: eventos e `engine_state` não mudam
   * mais, então o resultado é o que teria saído no encerramento. Melhor
   * recomputar uma vez que servir um relatório com seções faltando — ou, pior,
   * com a explicabilidade errada.
   */
  let dados = registro.data as unknown as DossierData;
  if ((dados.versaoDoRelatorio ?? 1) < VERSAO_DO_RELATORIO) {
    dados = await computarDossieNaTransacao(prisma, runId);
    await prisma.dossier.update({
      where: { runId },
      data: { data: dados as unknown as Prisma.InputJsonObject },
    });
  }

  /**
   * A conclusão é anexada AQUI, não no congelamento: o dossiê é computado no
   * `finish`, antes de o estudante escrever. Anexar na leitura também deixa o dado
   * comportamental (congelado) separado do reflexivo (escrito depois) — que é a
   * distinção que o doc 06 registra ao manter `exp_01_conclusoes` fora de `exp_01_dossiers`.
   */
  const dossie: DossierData = {
    ...dados,
    ...(conclusao
      ? {
          conclusao: {
            inclinacao: conclusao.inclinacao as 'A' | 'B' | 'duvida',
            texto: conclusao.texto,
            escritaEm: conclusao.createdAt.toISOString(),
          },
        }
      : {}),
  };

  const ids = [...dossie.topDwell.map((item) => item.postId), ...dossie.postsOcultados.ladoOposto.slice(0, 24)];

  const posts = await prisma.post.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      lado: true,
      intensidade: true,
      caption: true,
      imageUrl: true,
      imageStatus: true,
      categoria: true,
      author: { select: { handle: true } },
    },
  });

  const paraDossie = (post: (typeof posts)[number]): PostDoDossie => ({
    id: post.id,
    lado: post.lado,
    intensidade: post.intensidade,
    caption: post.caption,
    imageUrl: post.imageStatus === 'ok' ? post.imageUrl : null,
    imageStatus: post.imageStatus,
    categoria: post.categoria,
    handle: post.author.handle,
    fallbackArt: arteFallback(post.id, post.categoria),
  });

  const porId = new Map(posts.map((post) => [post.id, post]));

  return {
    dossie,
    posts: {
      topDwell: dossie.topDwell
        .map((item) => {
          const post = porId.get(item.postId);
          if (!post) return null;
          return {
            ...paraDossie(post),
            dwellMs: item.dwellMs,
            segundos: Math.round(item.dwellMs / 100) / 10,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      ocultados: dossie.postsOcultados.ladoOposto
        .slice(0, 24)
        .map((id) => porId.get(id))
        .filter((post): post is NonNullable<typeof post> => Boolean(post))
        .map(paraDossie),
    },
  };
}
