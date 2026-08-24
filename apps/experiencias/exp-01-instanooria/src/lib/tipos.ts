/** Espelho dos tipos que o servidor manda ao cliente (doc 06). */
export interface FeedPostCliente {
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

export interface PerfilCliente {
  /** Vem do módulo de sugestões/notificação (o servidor manda o id do autor). */
  authorId?: string;
  /** Perfil aberto a partir de um card: o cliente só conhece o post. */
  postIdDeOrigem?: string;
  handle: string;
  displayName: string;
  verificado: boolean;
  avatarSeed: string;
}

export type ModuloCliente =
  | { tipo: 'sugestoes'; perfis: PerfilCliente[] }
  | { tipo: 'notificacao_seguidor'; perfil: PerfilCliente }
  | { tipo: 'fim_sessao' };

export interface ComentarioCliente {
  id: string;
  handle: string;
  texto: string;
  likesCount: number;
  timestampLabel: string;
  doAluno?: boolean;
}

/** Item da timeline do feed: post, módulo de sugestões ou o post do aluno. */
export type ItemFeed =
  | { tipo: 'post'; post: FeedPostCliente }
  | { tipo: 'sugestoes'; perfis: PerfilCliente[] }
  | { tipo: 'post_do_aluno'; texto: string; template: string; criadoEm: number };
