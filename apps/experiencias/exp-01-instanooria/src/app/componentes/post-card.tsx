import { useEffect, useRef, useState } from 'react';

import { formatarContagem } from '../../lib/avatar';
import type { FeedPostCliente } from '../../lib/tipos';

import { AvatarPerfil } from './avatar-perfil';
import { Glifo } from '@edu/ui/ds-insta';

const LIMITE_CAPTION = 125;

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
   * Instagram, ninguém ensina esse gesto, e fazê-lo aqui significa que o aluno
   * acredita que está num app de verdade.
   */
  aoGesto: (tipo: 'duplo_toque' | 'expandiu_legenda', post: FeedPostCliente) => void;
}

/**
 * Card de post — anatomia exata do doc 03 §3: header 56px, mídia 4:5,
 * barra de ações 48px, linha de curtidas, legenda com "... mais",
 * "ver todos os N comentários", prévia de comentários e timestamp.
 */
export function PostCard({
  post,
  acoes,
  curtido,
  salvo,
  seguindo,
  comentariosDoAluno,
}: {
  post: FeedPostCliente;
  acoes: AcoesDoPost;
  curtido: boolean;
  salvo: boolean;
  seguindo: boolean;
  comentariosDoAluno: number;
}) {
  const [expandido, setExpandido] = useState(false);
  const [mostrarCoracao, setMostrarCoracao] = useState(false);
  const [pulsar, setPulsar] = useState(false);
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

  const curtir = (viaDuploToque: boolean) => {
    if (viaDuploToque) acoes.aoGesto('duplo_toque', post);
    if (viaDuploToque && curtido) {
      setMostrarCoracao(true);
      window.setTimeout(() => setMostrarCoracao(false), 700);
      return;
    }
    if (!curtido) {
      setPulsar(true);
      window.setTimeout(() => setPulsar(false), 340);
      if (viaDuploToque) {
        setMostrarCoracao(true);
        window.setTimeout(() => setMostrarCoracao(false), 700);
      }
    }
    acoes.aoCurtir(post, !curtido);
  };

  const aoTocarMidia = () => {
    const agora = Date.now();
    if (agora - ultimoToque.current < 300) {
      ultimoToque.current = 0;
      curtir(true);
      return;
    }
    ultimoToque.current = agora;
  };

  const caption = post.caption;
  const precisaTruncar = caption.length > LIMITE_CAPTION && !expandido;
  const textoCaption = precisaTruncar ? `${caption.slice(0, LIMITE_CAPTION)}…` : caption;
  const totalCurtidas = post.likesCount + (curtido ? 1 : 0);
  const totalComentarios = post.commentsTotal + comentariosDoAluno;

  return (
    <article
      ref={elemento}
      className="card-otimizado border-b border-hairline bg-surface"
      data-post-id={post.id}
    >
      {/* 1. Header 56px */}
      <header className="flex h-postheader items-center gap-2.5 px-3">
        <button type="button" onClick={() => acoes.aoAbrirPerfil(post)} className="active:opacity-60">
          <AvatarPerfil seed={post.author.avatarSeed} tamanho={32} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => acoes.aoAbrirPerfil(post)}
              className="truncate text-[14px] font-semibold text-ink active:opacity-60"
            >
              {post.author.handle.replace(/^@/, '')}
            </button>
            {post.author.verificado ? <Glifo name="verified" size={12} /> : null}
            <button
              type="button"
              onClick={() => acoes.aoSeguir(post, !seguindo)}
              className={`ml-1 text-[13px] font-semibold active:opacity-60 ${seguindo ? 'text-muted' : 'text-action'}`}
            >
              · {seguindo ? 'Seguindo' : 'Seguir'}
            </button>
          </div>
          {post.sugerido ? <p className="truncate text-[12px] text-muted">Sugerido para você</p> : null}
        </div>

        <button
          type="button"
          aria-label="Mais opções"
          onClick={() => acoes.aoAbrirOpcoes(post)}
          className="active:opacity-60"
        >
          <Glifo name="more" size={18} />
        </button>
      </header>

      {/* 2. Mídia 4:5 com duplo-toque */}
      <div
        className="relative aspect-post w-full select-none overflow-hidden bg-canvas"
        onPointerUp={aoTocarMidia}
        onDoubleClick={() => curtir(true)}
      >
        {post.imageUrl ? (
           
          <img
            src={post.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            width={1080}
            height={1350}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-3"
            style={{ background: post.fallbackArt?.corFundo ?? '#EFEFEF' }}
          >
            <span className="text-[64px] leading-none">{post.fallbackArt?.emojis ?? '✨'}</span>
            <span className="max-w-[70%] text-center text-[15px] font-semibold text-black/60">
              {post.hashtags.slice(0, 2).join(' ')}
            </span>
          </div>
        )}

        {mostrarCoracao ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="animar-coracao drop-shadow-lg">
              <Glifo name="heartFilled" size={96} tone="inverse" />
            </span>
          </span>
        ) : null}
      </div>

      {/* 3. Barra de ações 48px */}
      <div className="flex h-actionbar items-center justify-between px-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label={curtido ? 'Remover curtida' : 'Curtir'}
            onClick={() => curtir(false)}
            className={pulsar ? 'animar-curtida' : undefined}
          >
            <Glifo name={curtido ? 'heartFilled' : 'heart'} size={24} tone={curtido ? 'like' : 'primary'} />
          </button>
          <button type="button" aria-label="Comentar" onClick={() => acoes.aoAbrirComentarios(post)}>
            <Glifo name="comment" size={24} />
          </button>
          <button type="button" aria-label="Enviar" onClick={() => acoes.aoCompartilhar(post)}>
            <Glifo name="share" size={22} />
          </button>
        </div>

        <button
          type="button"
          aria-label={salvo ? 'Remover dos salvos' : 'Salvar'}
          onClick={() => acoes.aoSalvar(post, !salvo)}
        >
          <Glifo name={salvo ? 'bookmarkFilled' : 'bookmark'} size={24} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-3">
        {/* 4. Curtidas */}
        <p className="text-[14px] font-semibold text-ink">
          Curtido por <span className="font-semibold">{post.commentsPreview[0]?.handle.replace(/^@/, '') ?? 'ana.paes'}</span> e{' '}
          <span className="font-semibold">outras {formatarContagem(totalCurtidas)} pessoas</span>
        </p>

        {/* 5. Legenda */}
        <p className="text-[14px] leading-snug text-ink">
          <span className="font-semibold">{post.author.handle.replace(/^@/, '')}</span> {textoCaption}
          {precisaTruncar ? (
            <button type="button" className="ml-1 text-muted" onClick={() => {
                setExpandido(true);
                acoes.aoGesto('expandiu_legenda', post);
              }}>
              mais
            </button>
          ) : null}
        </p>

        {post.hashtags.length > 0 ? (
          <p className="text-[14px] leading-snug text-link">{post.hashtags.join(' ')}</p>
        ) : null}

        {/* 6. Ver todos os comentários */}
        {totalComentarios > 0 ? (
          <button
            type="button"
            className="self-start text-[14px] text-muted active:opacity-60"
            onClick={() => acoes.aoAbrirComentarios(post)}
          >
            Ver todos os {formatarContagem(totalComentarios)} comentários
          </button>
        ) : null}

        {/* 7. Prévia de comentários */}
        {post.commentsPreview.map((comentario) => (
          <p key={`${post.id}-${comentario.handle}`} className="text-[14px] leading-snug text-ink">
            <span className="font-semibold">{comentario.handle.replace(/^@/, '')}</span> {comentario.texto}
          </p>
        ))}

        {/* 8. Timestamp */}
        <p className="text-[11px] text-muted">{post.timestampLabel}</p>
      </div>
    </article>
  );
}
