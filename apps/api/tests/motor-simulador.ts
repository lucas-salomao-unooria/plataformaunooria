import { curarBloco, curarBlocoInicial } from '../src/motor/curadoria';
import { estadoInicial, semearEstado } from '../src/motor/estado';
import { aplicarEventos } from '../src/motor/eventos';
import type { EngineConfig, EngineState, EventoPontuavel, PostMeta, TipoEvento } from '../src/motor/tipos';
import { ENGINE_CONFIG_DEFAULT } from '../src/comum/insta/defaults';
import type { Intensidade } from '../src/comum/insta/tipos';
import { PERFIS } from '../src/comum/insta/defaults';

export const CONFIG = ENGINE_CONFIG_DEFAULT as unknown as EngineConfig;

/** Gerador determinístico (LCG) — teste de motor não pode depender de sorte. */
export function rngComSemente(semente: number): () => number {
  let estado = semente % 2147483647;
  if (estado <= 0) estado += 2147483646;
  return () => {
    estado = (estado * 16807) % 2147483647;
    return (estado - 1) / 2147483646;
  };
}

const CATEGORIAS_NEUTRAS = ['animais', 'memes de escola', 'esportes', 'comida'];

/** Catálogo sintético do tamanho de uma atividade real (~560 posts). */
export function catalogoDeTeste(): PostMeta[] {
  const posts: PostMeta[] = [];
  let contador = 0;

  const criar = (lado: PostMeta['lado'], intensidade: Intensidade, categoria: string, quantidade: number) => {
    for (let i = 0; i < quantidade; i += 1) {
      contador += 1;
      posts.push({
        id: `post-${String(contador).padStart(4, '0')}`,
        lado,
        // Rodízio pelos 4 perfis: o catálogo de teste cobre a matriz do doc 05 §2.
        perfil: PERFIS[contador % PERFIS.length]!,
        intensidade,
        categoria,
        authorId: `autor-${lado}-${(i % 6) + 1}`,
        likesCount: 500 + ((contador * 37) % 8000),
      });
    }
  };

  for (const lado of ['A', 'B'] as const) {
    criar(lado, 1, 'tema', 68);
    criar(lado, 2, 'tema', 59);
    criar(lado, 3, 'tema', 41);
  }
  for (const categoria of CATEGORIAS_NEUTRAS) criar('neutro', 1, categoria, 56);

  return posts;
}

export interface PassoBloco {
  bloco: number;
  ids: string[];
  metas: PostMeta[];
  estado: EngineState;
  dominio: number;
}

export type Comportamento = (meta: PostMeta, indice: number) => Omit<EventoPontuavel, 'id'>[];

/** Roda N blocos aplicando um comportamento sintético do estudante. */
export function simular(
  blocos: number,
  comportamento: Comportamento,
  opcoes: {
    semente?: number;
    catalogo?: PostMeta[];
    config?: EngineConfig;
    /** Lado semeado pela afinidade do perfil (doc 04 §3). */
    ladoInicial?: 'A' | 'B';
    /** Perfil dominante do Ato 1, para a ponderação de linguagem. */
    perfilDominante?: string | null;
  } = {},
): { estado: EngineState; passos: PassoBloco[] } {
  const config = opcoes.config ?? CONFIG;
  const catalogo = opcoes.catalogo ?? catalogoDeTeste();
  const rng = rngComSemente(opcoes.semente ?? 42);
  const mapa = new Map(catalogo.map((post) => [post.id, post]));

  const ladoInicial = opcoes.ladoInicial ?? 'A';
  let estado = semearEstado(
    estadoInicial(),
    ladoInicial,
    config.sementeInicial,
    opcoes.perfilDominante ?? null,
  );
  let proximoId = 1;
  const passos: PassoBloco[] = [];

  for (let bloco = 1; bloco <= blocos; bloco += 1) {
    const resultado =
      bloco === 1
        ? curarBlocoInicial(catalogo, rng, ladoInicial)
        : curarBloco(estado, catalogo, config, rng);

    const metasDoBloco = resultado.ids.map((id) => mapa.get(id)!);
    const exposicao = { ...(estado.exposicaoPorPerfil ?? {}) };
    for (const meta of metasDoBloco) {
      exposicao[meta.perfil] = (exposicao[meta.perfil] ?? 0) + 1;
    }

    estado = {
      ...estado,
      servedPostIds: [...estado.servedPostIds, ...resultado.ids],
      blocosServidos: [...estado.blocosServidos, resultado.ids],
      blocksServed: estado.blocksServed + 1,
      exposicaoPorPerfil: exposicao,
    };

    const metas = resultado.ids.map((id) => mapa.get(id)!);
    const eventos: EventoPontuavel[] = [];
    metas.forEach((meta, indice) => {
      for (const evento of comportamento(meta, indice)) {
        eventos.push({ ...evento, id: String(proximoId) });
        proximoId += 1;
      }
    });

    estado = aplicarEventos(estado, eventos, mapa, config);

    const a = Math.max(0, estado.scoreA);
    const b = Math.max(0, estado.scoreB);
    const soma = a + b;
    const dominio = soma < config.somaMinimaParaDominio ? 0.5 : Math.max(a, b) / soma;

    passos.push({ bloco, ids: resultado.ids, metas, estado, dominio });
  }

  return { estado, passos };
}

export function visto(meta: PostMeta, dwellMs: number): Omit<EventoPontuavel, 'id'> {
  return { tipo: 'visto', postId: meta.id, payload: { dwellMs } };
}

export function sinal(meta: PostMeta, tipo: TipoEvento): Omit<EventoPontuavel, 'id'> {
  return { tipo, postId: meta.id, payload: {} };
}
