export interface ComentarioRevisao {
  id: string;
  handle: string;
  texto: string;
  likesCount: number;
  ordem: number;
}

export interface PostRevisao {
  id: string;
  lado: 'A' | 'B' | 'neutro';
  /** Perfil de linguagem do post (doc 10). */
  perfil: 'abertura' | 'autotranscendencia' | 'autopromocao' | 'conservacao';
  intensidade: number;
  categoria: string;
  caption: string;
  hashtags: string[];
  emotionalHook: string | null;
  imageUrl: string | null;
  imageStatus: 'pendente' | 'ok' | 'fallback';
  imageBrief: string;
  likesCount: number;
  timestampLabel: string;
  aprovado: boolean;
  author: { handle: string; displayName: string; verificado: boolean };
  comments: ComentarioRevisao[];
}

export interface RespostaPosts {
  posts: PostRevisao[];
  total: number;
  page: number;
  paginas: number;
  categorias: string[];
  aprovadosPorLado: Record<string, number>;
  /** Contagem por célula (lado, perfil) — a visão de matriz do doc 05 §4. */
  matriz: { lado: string; perfil: string; aprovados: number }[];
  esperadoPorCelula: number;
}
