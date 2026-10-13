import { textoAlternativoDaImagem } from '../comum/insta/texto-alternativo';
import { arteFallback } from '../geracao/arte-fallback';

import type { FeedPost } from './tipos';

/**
 * Doc 04 §7 e doc 06: o que chega ao cliente. NUNCA lado, intensidade,
 * categoria ou emotional_hook — um estudante curioso não pode abrir o DevTools e
 * ver o truque.
 */
export interface PostCompleto {
  id: string;
  caption: string;
  hashtags: string[];
  likesCount: number;
  timestampLabel: string;
  imageUrl: string | null;
  imageStatus: string;
  /** Só para o texto alternativo: a descrição visual da imagem gerada. */
  imageBrief?: string | null;
  categoria: string;
  author: { handle: string; displayName: string; verificado: boolean };
  comments: { handle: string; texto: string }[];
  _count?: { comments: number };
}

export function paraFeedPost(post: PostCompleto, sugerido: boolean): FeedPost {
  const temImagem = post.imageStatus === 'ok' && Boolean(post.imageUrl);

  return {
    id: post.id,
    author: {
      handle: post.author.handle,
      displayName: post.author.displayName,
      verificado: post.author.verificado,
      avatarSeed: post.author.handle,
    },
    imageUrl: temImagem ? post.imageUrl : null,
    imageAlt: textoAlternativoDaImagem(post),
    ...(temImagem ? {} : { fallbackArt: arteFallback(post.id, post.categoria) }),
    caption: post.caption,
    hashtags: post.hashtags,
    likesCount: post.likesCount,
    timestampLabel: post.timestampLabel,
    sugerido,
    commentsPreview: post.comments.slice(0, 2).map((comentario) => ({
      handle: comentario.handle,
      texto: comentario.texto,
    })),
    commentsTotal: post._count?.comments ?? post.comments.length,
  };
}
