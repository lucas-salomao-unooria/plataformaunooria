/**
 * Espelho do contrato PÚBLICO da api (`apps/api/src/foto-conta/contrato-de-rotas.ts`).
 * Só o que o estudante recebe: a matriz do Aha e o gabarito da reflexão não
 * têm tipo aqui de propósito — o cliente conhece um par de comentários por
 * vez, na resposta de publicar.
 */

export type Etapa =
  | "desafiar"
  | "feed"
  | "decidir"
  | "aha"
  | "roda"
  | "refletir"
  | "concluida";

export type MarcaId = "coruja" | "estrela" | "sol";
export type OpcaoReflexao = "lupa" | "globo";

export interface PostDoFeed {
  id: string;
  fotoId: string;
  legenda: string;
}

export interface LegendaDoPar {
  id: "legenda_1" | "legenda_2";
  texto: string;
  icone: "bloco" | "vassoura";
}

export interface PacotePublico {
  tema: "recreio" | "nossa_horta" | "sala_de_aula" | "parquinho";
  feed: PostDoFeed[];
  par: { fotoAId: string; fotoBId: string };
  legendas: [LegendaDoPar, LegendaDoPar];
}

export interface Sessao {
  etapa: Etapa;
  tentativa: number;
  marcaId: MarcaId | null;
  fotoEscolhidaId: string | null;
  legendaEscolhidaId: string | null;
  tentativasReflexao: number;
  pacote: PacotePublico;
  latchLiberado: boolean;
  versaoInstrumento: string;
}

export interface ComentariosDoPar {
  fotoId: string;
  legendaId: string;
  leo: string;
  sofia: string;
  audioLeo?: string;
  audioSofia?: string;
}

export interface PostDaGaleria {
  marcaId: MarcaId;
  fotoId: string;
  legendaTexto: string;
  curtidas: number;
  criadoEm: string;
}

export interface Publicacao {
  etapa: Etapa;
  post: PostDaGaleria;
  comentarios: ComentariosDoPar;
}

export interface Latch {
  liberado: boolean;
  etapa: Etapa;
  agora: string;
}

export interface RespostaDaReflexao {
  conclui: boolean;
  tentativas: number;
  etapa: Etapa;
}

export interface Galeria {
  posts: PostDaGaleria[];
}

/** A cadência do eco social (não-negociável 2 do handoff): Leo aos 1,5s,
 *  Sofia aos 3,0s, e a transição para o latch 2s depois do fim. */
export const CADENCIA_AHA = { leoMs: 1500, sofiaMs: 3000, transicaoMs: 2000 } as const;

/** O botão NOVA PUBLICAÇÃO só aparece com ≥15s de feed OU ≥1 curtida. */
export const GATILHO_CRIAR = { permanenciaMs: 15_000, curtidas: 1 } as const;

/** Scaffoldings por inatividade (bloco 7 do one-pager). */
export const INACAO = { feedMs: 30_000, decidirMs: 45_000 } as const;

/** Polling do latch (ADR-94) e da galeria. */
export const POLLING = { latchMs: 3_000, galeriaMs: 10_000 } as const;
