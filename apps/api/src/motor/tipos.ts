import { z } from 'zod';

import type { Intensidade, Lado } from '../comum/insta/tipos';

/** Estado do motor persistido em runs.engine_state (doc 04 §3). */
export interface EngineState {
  scoreA: number;
  scoreB: number;
  /** Lado semeado pela afinidade do perfil (doc 04 §3). Nunca muda na sessão. */
  ladoInicial?: 'A' | 'B';
  /**
   * Perfil dominante do Ato 1, congelado na criação da run. Alimenta a
   * ponderação de linguagem (doc 04 §5.5); `null` quando o perfil é `misto` ou
   * ausente, e aí a ponderação desliga e os 4 perfis saem por igual.
   */
  perfilDominante?: string | null;
  /** Pontuação por perfil de linguagem — o eixo do doc 10. */
  perfilScores?: Record<string, number>;
  /** Quantos posts de cada perfil foram servidos (denominador do doc 04 §7). */
  exposicaoPorPerfil?: Record<string, number>;
  /** Balde por categoria neutra: escolhe QUAIS neutros servir, não o eixo A/B. */
  neutroScores: Record<string, number>;
  followedAuthors: string[];
  servedPostIds: string[];
  intensityUnlocked: { A: Intensidade; B: Intensidade };
  baselineDwellMs: number | null;
  blocksServed: number;

  // ---- controle interno (mesmo JSONB, invisível ao cliente) ----
  /** Dwells dos 8 primeiros posts, para a mediana da baseline. */
  dwellsIniciais: number[];
  /** Sinais explícitos (curtida ou mais forte) por lado e nível. */
  sinaisPorNivel: { A: Record<string, number>; B: Record<string, number> };
  /** Dwells altos (>= 2.2 da baseline) por lado e nível. */
  dwellsAltosPorNivel: { A: Record<string, number>; B: Record<string, number> };
  /** Quantas vezes cada post já foi visto (revisita conta ponto). */
  vistosPorPost: Record<string, number>;
  /** Posts efetivamente consumidos (evento "visto") — gatilho de encerramento. */
  postsConsumidos: string[];
  /** Último evento já pontuado (idempotência do processamento). */
  ultimoEventoProcessado: string;
  /** Bloco em que o módulo de sugestões apareceu por último. */
  ultimoBlocoSugestoes: number;
  /** A notificação "começou a seguir você" só acontece uma vez. */
  notificouSeguidor: boolean;
  /** Dwell acumulado por post (insumo do dossiê). */
  dwellPorPost: Record<string, number>;
  /** Posts servidos agrupados por bloco (insumo da série temporal do dossiê). */
  blocosServidos: string[][];
  /** Dwells que chegaram antes da baseline existir (pontuados retroativamente). */
  pendentesDeBaseline: { postId: string; dwellMs: number }[];
  /** Momento em que o feed começou (o onboarding não consome a cota de 12 min). */
  feedIniciadoEm: string | null;
  /** Versão do estado — concorrência otimista no salvamento do bloco. */
  versao: number;
}

/** Metadados de curadoria — nunca saem do servidor. */
export interface PostMeta {
  id: string;
  lado: Lado;
  /** Perfil de linguagem do post (doc 10). Vale também para neutros. */
  perfil: string;
  intensidade: Intensidade;
  categoria: string;
  authorId: string;
  /** Proxy de "curtibilidade" — usado para escolher as iscas do bloco inicial. */
  likesCount: number;
}

export const tipoEventoSchema = z.enum([
  'visto',
  'curtiu',
  'descurtiu',
  'salvou',
  /**
   * Dessalvar não era registrado, e por isso a coleção do estudante ficava errada: um
   * post salvo e depois removido continuava na lista. No fluxo v2 essa coleção é
   * o artefato da missão e o material do debate — ela tem de estar certa.
   */
  'dessalvou',
  'abriu_comentarios',
  'comentou',
  'compartilhou',
  'seguiu',
  'deixou_seguir',
  'nao_interessa',
  'denunciou',
  'enquete',
  'rever',
  'abriu_perfil',
  /**
   * Eventos de telemetria do M5/M6 (doc 11 §2.2). `abriu_busca` e `buscou` são os
   * mais valiosos do conjunto: medem quem foi atrás do que o feed não dava.
   */
  'abriu_busca',
  'buscou',
  'abriu_da_busca',
  'expandiu_legenda',
  'duplo_toque',
  'abriu_story',
  'avancou_story',
  'trocou_aba',
  'perdeu_foco',
  'voltou_foco',
]);

export type TipoEvento = z.infer<typeof tipoEventoSchema>;

export const eventoSchema = z.object({
  tipo: tipoEventoSchema,
  postId: z.string().uuid().nullable().optional(),
  clientTs: z.number().int().positive(),
  payload: z
    .object({
      dwellMs: z.number().int().min(0).max(600_000).optional(),
      authorId: z.string().uuid().optional(),
      texto: z.string().max(500).optional(),
      opcao: z.string().max(60).optional(),
      lado: z.enum(['A', 'B']).optional(),
      contexto: z.enum(['feed', 'story', 'busca', 'perfil']).optional(),
      /**
       * Telemetria (doc 11 §2.2). Sem declarar aqui, o zod **descarta a chave em
       * silêncio** — o evento é gravado com payload vazio e o dado se perde sem
       * nenhum erro. Foi exatamente o que aconteceu com o termo de busca até este
       * milestone.
       */
      termo: z.string().trim().max(80).optional(),
      aba: z.enum(['feed', 'busca', 'criar', 'notificacoes', 'perfil']).optional(),
    })
    .optional(),
});

export type EventoEntrada = z.infer<typeof eventoSchema>;

/** Evento já persistido, como o motor o consome. */
export interface EventoPontuavel {
  id: string;
  tipo: TipoEvento;
  postId: string | null;
  payload: Record<string, unknown> | null;
}

/** Post servido ao cliente — shape do doc 06, sem campos reveladores. */
export interface FeedPost {
  id: string;
  author: { handle: string; displayName: string; verificado: boolean; avatarSeed: string };
  imageUrl: string | null;
  fallbackArt?: { corFundo: string; emojis: string };
  caption: string;
  hashtags: string[];
  likesCount: number;
  timestampLabel: string;
  sugerido: boolean;
  commentsPreview: { handle: string; texto: string }[];
  commentsTotal: number;
}

export interface PerfilSugerido {
  handle: string;
  displayName: string;
  avatarSeed: string;
  verificado: boolean;
  authorId: string;
}

export type ModuloFeed =
  | { tipo: 'sugestoes'; perfis: PerfilSugerido[] }
  | { tipo: 'notificacao_seguidor'; perfil: PerfilSugerido }
  | { tipo: 'fim_sessao' };

export interface EngineConfig {
  dwell: {
    faixas: { min: number; pontos: number }[];
    rolouRetoMs: number;
    rolouRetoPontos: number;
    revisitaMinMs: number;
  };
  pesos: Record<string, number>;
  bonusAutorSeguido: number;
  mixagem: { dominioMax: number; dominante: number; oposto: number; neutro: number }[];
  /** Tabela alternativa quando a atividade não tem neutros (doc 04 §5). */
  mixagemSemNeutros?: { dominioMax: number; dominante: number; oposto: number; neutro: number }[];
  /** Semente do lado indicado pelo perfil (doc 04 §3.2). */
  sementeInicial?: number;
  /** Peso da ponderação por perfil na seleção (doc 04 §5.5). */
  pesoPerfil?: number;
  escada: {
    sinaisExplicitosParaDestravar: number;
    dwellsAltosParaDestravar: number;
    proporcaoNivelMaximo: number;
  };
  bloco: { inicial: number; seguinte: number };
  somaMinimaParaDominio: number;
  suavizacaoDominio?: number;
  encerramento: { maxPosts: number; maxMinutos: number; minMinutos?: number };
  sugestoes: { dominioMinimo: number; cadaNBlocos: number; perfis: number };
  proporcaoSugeridos?: number;
  notificacaoSeguidor: { dominioGatilho: number };
}
