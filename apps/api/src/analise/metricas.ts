import {
  calcularBolha,
  calcularImersao,
  calcularInvestigacao,
  calcularPerfilObservado,
  calcularRitmo,
  calcularTempo,
  PISO_OCIOSIDADE_MS,
  type EventoDeTelemetria,
  type MetaDePost,
} from '../dossie/telemetria';
import type { Bolha, Imersao, Investigacao, PerfilObservado, Ritmo, TempoDaSessao } from '../dossie/tipos';
import { normalizarEstado } from '../motor/estado';
import { dominioDe } from '../motor/eventos';
import type { EngineConfig, EngineState } from '../motor/tipos';
import { normalizarPerfil } from '../perfis/afinidade';
import type { Prisma } from '@prisma/client';

/**
 * Métricas por run, **derivadas** — nunca persistidas (doc 11 §6).
 *
 * Recalcular a partir de `events` custa pouco (uma turma tem ~40 runs de algumas
 * centenas de eventos) e evita a pior armadilha de analytics: número gravado que
 * ninguém sabe mais como foi computado. Quando a definição de "tempo ativo" muda,
 * muda em um lugar — `lib/dossie/telemetria.ts` — e as três superfícies
 * (relatório do estudante, análise do professor, análise de produto) concordam.
 */
export interface MetricasDaRun {
  runId: string;
  estudante: { username: string; displayName: string };
  aluno: { username: string; displayName: string };
  fase: string;
  iniciadaEm: Date;
  encerradaEm: Date | null;

  /** Perfil do Ato 1, renormalizado no servidor (doc 10 §4). */
  perfilJogo: { dominante: string; origem: string } | null;
  perfilObservado: PerfilObservado;

  bolha: Bolha;
  ladoDominante: 'A' | 'B' | 'indefinido';
  dominio: number;
  postsConsumidos: number;
  blocos: number;
  /** Escada de intensidade destravada por lado (doc 11 §3.5). */
  escada: { A: number; B: number };

  tempo: TempoDaSessao;
  ritmo: Ritmo;
  imersao: Imersao;
  investigacao: Investigacao;

  interacoes: {
    curtidas: number;
    comentarios: number;
    salvos: number;
    compartilhados: number;
    seguidos: number;
    naoInteressa: number;
    publicou: boolean;
  };

  /**
   * A COLEÇÃO do estudante — os posts que ele salvou, que no fluxo v2 são o artefato
   * da missão e o material do debate.
   *
   * Diferente de `interacoes.salvos`, que conta eventos: aqui o último evento por
   * post decide, então salvar e dessalvar se anulam. Sem isso a coleção mostrada
   * ao professor estaria maior que a real.
   */
  colecao: {
    total: number;
    doLadoSemeado: number;
    doOutroLado: number;
    neutros: number;
    comentados: number;
  };

  /**
   * No fluxo v2 a conclusão é só a escolha de um lado — `texto` fica nulo. O
   * texto livre virou a REFLEXÃO do fim, que é sobre a atividade (letramento
   * digital), não sobre a pergunta-chave.
   */
  conclusao: {
    inclinacao: 'A' | 'B' | 'duvida';
    /**
     * A PRIMEIRA escolha — `null` nas respostas anteriores à migração que passou
     * a guardá-la. A correlação "lado do feed × resposta" usa a ÚLTIMA, que é a
     * que o estudante assumiu; esta existe para ser possível perguntar se as duas
     * contam a mesma história.
     */
    inclinacaoInicial: 'A' | 'B' | 'duvida' | null;
    trocas: number;
    texto: string | null;
    caracteres: number;
  } | null;
  /** O fechamento escrito da atividade, sem limite de caracteres. */
  reflexao: { texto: string; caracteres: number } | null;

  /**
   * Há quanto tempo o estudante não gera evento nenhum. É o número que faz o
   * professor levantar da cadeira — e por isso é `null` quando a run já acabou:
   * ninguém precisa ser cutucado por estar "ocioso" num relatório.
   */
  ociosoHaMs: number | null;
}

/** Metadados dos posts de uma atividade, no formato enxuto da telemetria. */
async function metasDaAtividade(prisma: Prisma.TransactionClient, activityId: string): Promise<Map<string, MetaDePost>> {
  const posts = await prisma.post.findMany({
    where: { activityId },
    select: { id: true, lado: true, perfil: true, intensidade: true },
  });
  return new Map(posts.map((post) => [post.id, { lado: post.lado, perfil: post.perfil, intensidade: post.intensidade }]));
}

/**
 * Métricas de todas as runs de uma atividade, numa passada.
 *
 * Carrega eventos de TODAS as runs de uma vez e agrupa em memória: 40 consultas
 * separadas numa tela que atualiza a cada 5 segundos derrubariam o banco na
 * primeira aula com a turma inteira dentro.
 */
export async function metricasDaAtividade(prisma: Prisma.TransactionClient, activityId: string): Promise<MetricasDaRun[]> {
  const [atividade, runs, porId] = await Promise.all([
    prisma.activity.findUniqueOrThrow({
      where: { id: activityId },
      select: { engineConfig: true },
    }),
    prisma.run.findMany({
      where: { activityId },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        fase: true,
        startedAt: true,
        finishedAt: true,
        ladoInicial: true,
        ladoOrigem: true,
        perfilJogo: true,
        perfilOrigem: true,
        engineState: true,
        estudante: { select: { username: true, displayName: true } },
        conclusao: { select: { inclinacao: true, inclinacaoInicial: true, trocas: true, texto: true } },
        reflexao: { select: { texto: true } },
        _count: { select: { studentPosts: true } },
      },
    }),
    metasDaAtividade(prisma, activityId),
  ]);

  if (runs.length === 0) return [];

  const config = atividade.engineConfig as unknown as EngineConfig;

  const eventos = await prisma.event.findMany({
    where: { runId: { in: runs.map((run) => run.id) } },
    select: { runId: true, tipo: true, postId: true, payload: true, clientTs: true },
    orderBy: { id: 'asc' },
  });

  const porRun = new Map<string, EventoDeTelemetria[]>();
  for (const evento of eventos) {
    const lista = porRun.get(evento.runId) ?? [];
    lista.push({
      tipo: evento.tipo,
      postId: evento.postId,
      payload: evento.payload,
      clientTs: Number(evento.clientTs),
    });
    porRun.set(evento.runId, lista);
  }

  const agora = Date.now();

  return runs.map((run) => {
    const estado: EngineState = normalizarEstado(run.engineState);
    const trilha = porRun.get(run.id) ?? [];
    const entrada = {
      eventos: trilha,
      estado,
      config,
      porId,
      run: {
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        ladoInicial: run.ladoInicial,
        ladoOrigem: run.ladoOrigem,
      },
    };

    const { dominio, ladoDominante } = dominioDe(estado, config);
    const dominanteFinal: MetricasDaRun['ladoDominante'] =
      ladoDominante === 'neutro' || dominio <= 0.5 ? 'indefinido' : ladoDominante;

    const contagemPorBloco = estado.blocosServidos.map((ids, indice) => {
      const metas = ids.map((postId) => porId.get(postId)).filter(Boolean) as MetaDePost[];
      return {
        bloco: indice + 1,
        A: metas.filter((meta) => meta.lado === 'A').length,
        B: metas.filter((meta) => meta.lado === 'B').length,
      };
    });

    const bruto = run.perfilJogo as Record<string, unknown> | null;
    const envelope = bruto?.escores;
    const escores =
      envelope && typeof envelope === 'object'
        ? (envelope as Record<string, number>)
        : bruto
          ? (bruto as Record<string, number>)
          : null;
    const perfil = escores ? normalizarPerfil(escores) : null;

    const conta = (tipo: string) => trilha.filter((evento) => evento.tipo === tipo).length;

    // Tempo é insumo de ritmo e de imersão: calcula uma vez.
    const tempo = calcularTempo(entrada);

    /** Último evento por post decide: salvar e dessalvar se anulam. */
    const salvos = new Map<string, boolean>();
    for (const evento of trilha) {
      if (!evento.postId) continue;
      if (evento.tipo === 'salvou') salvos.set(evento.postId, true);
      if (evento.tipo === 'dessalvou') salvos.set(evento.postId, false);
    }
    const naColecao = [...salvos.entries()]
      .filter(([, salvo]) => salvo)
      .map(([postId]) => porId.get(postId))
      .filter((meta): meta is MetaDePost => Boolean(meta));

    const comentados = new Set(
      trilha.filter((evento) => evento.tipo === 'comentou' && evento.postId).map((evento) => evento.postId),
    ).size;

    /**
     * Ociosidade só faz sentido em sessão viva, e é medida do ÚLTIMO evento —
     * não do começo do vão. Sem `clientTs`, cai para o início da run: quem nunca
     * gerou evento nenhum é exatamente quem o professor mais precisa notar.
     */
    const encerrada = run.finishedAt !== null || run.fase !== 'feed';
    const ultimo = trilha.length > 0 ? Math.max(...trilha.map((evento) => evento.clientTs)) : run.startedAt.getTime();
    const ociosoHaMs = encerrada ? null : Math.max(0, agora - ultimo);

    return {
      runId: run.id,
      estudante: run.estudante,
      aluno: run.estudante,
      fase: run.fase,
      iniciadaEm: run.startedAt,
      encerradaEm: run.finishedAt,
      perfilJogo: perfil ? { dominante: perfil.dominante, origem: run.perfilOrigem } : null,
      perfilObservado: calcularPerfilObservado(entrada, perfil?.dominante ?? null),
      bolha: calcularBolha(entrada, dominanteFinal, contagemPorBloco),
      ladoDominante: dominanteFinal,
      dominio: Math.round(dominio * 100) / 100,
      postsConsumidos: estado.postsConsumidos.length,
      blocos: estado.blocksServed,
      escada: estado.intensityUnlocked,
      tempo,
      ritmo: calcularRitmo(entrada, tempo),
      imersao: calcularImersao(entrada, tempo),
      investigacao: calcularInvestigacao(entrada),
      interacoes: {
        curtidas: conta('curtiu'),
        comentarios: conta('comentou'),
        salvos: conta('salvou'),
        compartilhados: conta('compartilhou'),
        seguidos: conta('seguiu'),
        naoInteressa: conta('nao_interessa') + conta('denunciou'),
        publicou: run._count.studentPosts > 0,
      },
      colecao: {
        total: naColecao.length,
        doLadoSemeado: naColecao.filter((meta) => meta.lado === run.ladoInicial).length,
        doOutroLado: naColecao.filter(
          (meta) => meta.lado !== run.ladoInicial && meta.lado !== 'neutro',
        ).length,
        neutros: naColecao.filter((meta) => meta.lado === 'neutro').length,
        comentados,
      },
      conclusao: run.conclusao
        ? {
            inclinacao: run.conclusao.inclinacao as 'A' | 'B' | 'duvida',
            inclinacaoInicial: (run.conclusao.inclinacaoInicial ?? null) as 'A' | 'B' | 'duvida' | null,
            trocas: run.conclusao.trocas,
            texto: run.conclusao.texto,
            caracteres: run.conclusao.texto?.length ?? 0,
          }
        : null,
      reflexao: run.reflexao
        ? { texto: run.reflexao.texto, caracteres: run.reflexao.texto.length }
        : null,
      ociosoHaMs,
    };
  });
}

/** Limite a partir do qual o monitor grita (doc 11 §4.1). */
export const OCIOSO_ALERTA_MS = PISO_OCIOSIDADE_MS * 6;
