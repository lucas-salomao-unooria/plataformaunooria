import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { ButtonUnv, IconUnv, PostCard as PostCardUnv, TopBar } from '@edu/ui/ds-unoovista';

import { formatarContagem } from '../../lib/avatar';
import type { FeedPostCliente } from '../../lib/tipos';

import { retratoDe } from './avatar-perfil';

const LIMITE_CAPTION = 125;

const semArroba = (handle: string) => handle.replace(/^@/, '');

export interface AcoesDoPost {
  aoCurtir: (post: FeedPostCliente, curtido: boolean) => void;
  aoSalvar: (post: FeedPostCliente, salvo: boolean) => void;
  aoSeguir: (post: FeedPostCliente, seguindo: boolean) => void;
  aoAbrirComentarios: (post: FeedPostCliente) => void;
  aoCompartilhar: (post: FeedPostCliente) => void;
  aoAbrirOpcoes: (post: FeedPostCliente) => void;
  aoAbrirPerfil: (post: FeedPostCliente) => void;
  registrarElemento: (elemento: HTMLElement | null, postId: string) => void;
  /**
   * Telemetria de imersão (doc 11 §2.2). Não pontuam no motor — só medem. O
   * duplo-toque é o sinal mais forte do conjunto: é memória muscular de
   * rede social, ninguém ensina esse gesto, e fazê-lo aqui significa que o
   * estudante acredita que está num app de verdade.
   */
  aoGesto: (tipo: 'duplo_toque' | 'expandiu_legenda', post: FeedPostCliente) => void;
}

/**
 * Card de post pelo `PostCard` composto do Unoovista: cabeçalho, mídia 4:5, a
 * pílula de ações sobre a base da mídia, curtidas, legenda com "mais",
 * hashtags, "ver todos os N comentários", prévia de comentários e data.
 *
 * Três peças são da EXPERIÊNCIA, ao redor do cartão do DS, e cada uma diz por quê:
 * - **"Seguir" ao lado do cabeçalho.** O `PostCard.Header` não tem espaço para
 *   ação além do "mais" — e seguir é sinal do motor, não pode sumir. O
 *   cabeçalho, o botão e o "mais" (o `TopBar.Action`, o mesmo círculo de 44px
 *   do cabeçalho do DS) ficam numa linha.
 * - **O coração do duplo-toque.** A mídia do DS não aceita camada por cima da
 *   foto, e embrulhá-la quebraria a pílula de ações (que só existe quando
 *   `Actions` vem LOGO DEPOIS de `Media`). O coração é irmão, posicionado sobre
 *   a caixa da mídia medida no próprio toque.
 * - **Hashtags e prévia de comentários**, que o DS não tem como peça: texto
 *   corrido nos tokens do Unoovista.
 */
export function PostCard({
  post,
  acoes,
  curtido,
  salvo,
  seguindo,
  comentariosDoEstudante,
}: {
  post: FeedPostCliente;
  acoes: AcoesDoPost;
  curtido: boolean;
  salvo: boolean;
  seguindo: boolean;
  comentariosDoEstudante?: number;
}) {
  const [expandido, setExpandido] = useState(false);
  /** A caixa da mídia (relativa ao cartão) enquanto o coração do duplo-toque está na tela. */
  const [coracao, setCoracao] = useState<CSSProperties | null>(null);
  const ultimoToque = useRef(0);
  const elemento = useRef<HTMLElement | null>(null);

  useEffect(() => {
    acoes.registrarElemento(elemento.current, post.id);
    const atual = elemento.current;
    return () => {
      if (atual) acoes.registrarElemento(null, post.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const mostrarCoracao = (midia: HTMLElement) => {
    setCoracao({ top: midia.offsetTop, left: midia.offsetLeft, width: midia.offsetWidth, height: midia.offsetHeight });
    window.setTimeout(() => setCoracao(null), 700);
  };

  const curtir = (midiaDoDuploToque: HTMLElement | null) => {
    if (midiaDoDuploToque) {
      acoes.aoGesto('duplo_toque', post);
      mostrarCoracao(midiaDoDuploToque);
      // O duplo-toque só CURTE: num post já curtido ele não descurte.
      if (curtido) return;
    }
    acoes.aoCurtir(post, !curtido);
  };

  const aoTocarMidia = (evento: React.PointerEvent<HTMLDivElement>) => {
    const agora = Date.now();
    if (agora - ultimoToque.current < 300) {
      ultimoToque.current = 0;
      curtir(evento.currentTarget);
      return;
    }
    ultimoToque.current = agora;
  };

  const handle = semArroba(post.author.handle);
  const retrato = retratoDe(post.author.avatarSeed);
  const caption = post.caption;
  const precisaTruncar = caption.length > LIMITE_CAPTION && !expandido;
  const textoCaption = precisaTruncar ? `${caption.slice(0, LIMITE_CAPTION)}…` : caption;
  const totalCurtidas = post.likesCount + (curtido ? 1 : 0);
  const totalComentarios = post.commentsTotal + (comentariosDoEstudante ?? 0);
  const quemCurtiu = post.commentsPreview[0]?.handle ?? 'ana.paes';

  return (
    <PostCardUnv ref={elemento} className="card-otimizado relative" data-post-id={post.id}>
      <div className="flex items-center gap-2">
        <PostCardUnv.Header
          className="min-w-0 flex-1 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label={`Abrir o perfil de ${handle}`}
          username={handle}
          avatarSrc={retrato.src}
          initials={retrato.initials}
          verified={post.author.verificado}
          location={post.sugerido ? 'Sugerido para você' : undefined}
          onClick={() => acoes.aoAbrirPerfil(post)}
          onKeyDown={(evento) => {
            if (evento.key !== 'Enter' && evento.key !== ' ') return;
            evento.preventDefault();
            acoes.aoAbrirPerfil(post);
          }}
        />
        <ButtonUnv variant={seguindo ? 'secondary' : 'primary'} size="sm" onClick={() => acoes.aoSeguir(post, !seguindo)}>
          {seguindo ? 'Seguindo' : 'Seguir'}
        </ButtonUnv>
        <TopBar.Action icon="more" label="Mais opções" onClick={() => acoes.aoAbrirOpcoes(post)} />
      </div>

      <PostCardUnv.Media
        src={post.imageUrl ?? undefined}
        alt=""
        aspectRatio={4 / 5}
        className="select-none"
        onPointerUp={aoTocarMidia}
        onDoubleClick={(evento) => curtir(evento.currentTarget)}
      >
        {post.imageUrl ? undefined : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-3"
            style={{ background: post.fallbackArt?.corFundo ?? 'var(--unv-color-background-tertiary)' }}
          >
            <span className="text-[64px] leading-none">{post.fallbackArt?.emojis ?? '✨'}</span>
            <span className="max-w-[70%] text-center text-[15px] font-semibold text-black/60">
              {post.hashtags.slice(0, 2).join(' ')}
            </span>
          </div>
        )}
      </PostCardUnv.Media>

      <PostCardUnv.Actions
        liked={curtido}
        saved={salvo}
        onLike={() => curtir(null)}
        onComment={() => acoes.aoAbrirComentarios(post)}
        onShare={() => acoes.aoCompartilhar(post)}
        onSave={() => acoes.aoSalvar(post, !salvo)}
      />

      <PostCardUnv.Likes>
        Curtido por <strong>{semArroba(quemCurtiu)}</strong> e{' '}
        <strong>outras {formatarContagem(totalCurtidas)} pessoas</strong>
      </PostCardUnv.Likes>

      <PostCardUnv.Caption username={handle}>
        {textoCaption}
        {precisaTruncar ? (
          <ButtonUnv
            variant="link"
            size="sm"
            className="ml-1"
            onClick={() => {
              setExpandido(true);
              acoes.aoGesto('expandiu_legenda', post);
            }}
          >
            mais
          </ButtonUnv>
        ) : null}
      </PostCardUnv.Caption>

      {post.hashtags.length > 0 ? (
        <p className="m-0 text-[14px] leading-snug text-link">{post.hashtags.join(' ')}</p>
      ) : null}

      {totalComentarios > 0 ? (
        <ButtonUnv variant="link" size="sm" className="self-start" onClick={() => acoes.aoAbrirComentarios(post)}>
          Ver todos os {formatarContagem(totalComentarios)} comentários
        </ButtonUnv>
      ) : null}

      {post.commentsPreview.map((comentario) => (
        <PostCardUnv.Caption key={`${post.id}-${comentario.handle}`} username={semArroba(comentario.handle)}>
          {comentario.texto}
        </PostCardUnv.Caption>
      ))}

      <PostCardUnv.Timestamp>{post.timestampLabel}</PostCardUnv.Timestamp>

      {coracao ? (
        <span className="pointer-events-none absolute flex items-center justify-center" style={coracao}>
          <span className="animar-coracao drop-shadow-lg">
            <IconUnv name="heartFilled" size={96} tone="inverse" filled />
          </span>
        </span>
      ) : null}
    </PostCardUnv>
  );
}
