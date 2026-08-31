import { Glifo } from '@edu/ui/ds-insta';
import { useEffect, useRef, useState } from 'react';

import { criarSwipe } from '../../lib/gestos';
import type { FeedPostCliente } from '../../lib/tipos';

import { AvatarPerfil } from './avatar-perfil';

/**
 * Linha de stories (doc 03 §2): 88px, círculos de 62px com anel gradiente.
 * Stories consomem posts do banco e CONTAM dwell — o viewer avisa quem abriu e
 * por quanto tempo ficou.
 */
export function Stories({
  posts,
  avatarDoEstudante,
  aoDwellDeStory,
  aoGestoDeStory,
}: {
  posts: FeedPostCliente[];
  avatarDoEstudante?: string;
  aoDwellDeStory: (postId: string, dwellMs: number) => void;
  /** Telemetria de exploração (doc 11 §3.1): abrir e avançar story. */
  aoGestoDeStory?: (tipo: 'abriu_story' | 'avancou_story', postId: string) => void;
}) {
  const avatar = avatarDoEstudante ?? '';
  const [aberto, setAberto] = useState<number | null>(null);
  const [vistos, setVistos] = useState<Set<string>>(new Set());

  const disponiveis = posts.slice(0, 9);

  return (
    <>
      {/* Figma node 0:1694: linha de 98px, fundo branco, divisória de 0.33px,
          avatar interno de 56px dentro do anel e handle em 12px. */}
      <div className="sem-scrollbar flex h-stories items-center gap-3 overflow-x-auto bg-surface px-2.5 shadow-[0px_0.33px_0px_0px_theme(colors.hairline)]">
        <div className="flex w-[74px] shrink-0 flex-col items-center gap-1.5">
          <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full border border-hairline">
            <AvatarPerfil seed={avatar} tamanho={56} />
          </span>
          <span className="w-full truncate text-center text-[12px] leading-none text-ink">Seu story</span>
        </div>

        {disponiveis.map((post, indice) => (
          <button
            key={post.id}
            type="button"
            className="flex w-[74px] shrink-0 flex-col items-center gap-1.5"
            onClick={() => {
              setAberto(indice);
              aoGestoDeStory?.('abriu_story', disponiveis[indice]!.id);
            }}
          >
            <span
              className={`anel-story ${vistos.has(post.id) ? 'anel-story-visto' : ''} ${
                // o primeiro story "ao vivo" usa o gradiente próprio do Figma
                !vistos.has(post.id) && indice === 1 ? 'anel-story-live' : ''
              }`}
            >
              <span className="block rounded-full border-2 border-surface">
                <AvatarPerfil seed={post.author.avatarSeed} tamanho={56} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[12px] leading-none text-ink">
              {post.author.handle.replace(/^@/, '')}
            </span>
          </button>
        ))}
      </div>

      {aberto !== null && disponiveis[aberto] ? (
        <VisualizadorDeStory
          indice={aberto}
          totalDeStories={disponiveis.length}
          post={disponiveis[aberto]}
          aoFechar={(dwellMs) => {
            const post = disponiveis[aberto]!;
            aoDwellDeStory(post.id, dwellMs);
            setVistos((atual) => new Set(atual).add(post.id));
            setAberto(null);
          }}
          aoAvancar={(dwellMs) => {
            const post = disponiveis[aberto]!;
            aoDwellDeStory(post.id, dwellMs);
            setVistos((atual) => new Set(atual).add(post.id));
            const proximo = aberto + 1 < disponiveis.length ? aberto + 1 : null;
            if (proximo !== null) aoGestoDeStory?.('avancou_story', disponiveis[proximo]!.id);
            setAberto(proximo);
          }}
        />
      ) : null}
    </>
  );
}

/** Viewer fullscreen com barra de progresso de 5s; arrastar para baixo fecha. */
function Barras({ total, atual, chave }: { total: number; atual: number; chave: string }) {
  return (
    <div className="flex gap-1 px-2 pt-2">
      {Array.from({ length: total }, (_, indice) => (
        <span key={indice} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
          {indice < atual ? <span className="block h-full bg-white" /> : null}
          {indice === atual ? <span key={chave} className="animar-progresso-story block h-full bg-white" /> : null}
        </span>
      ))}
    </div>
  );
}

function VisualizadorDeStory({
  post,
  indice,
  totalDeStories,
  aoFechar,
  aoAvancar,
}: {
  post: FeedPostCliente;
  indice: number;
  totalDeStories: number;
  aoFechar: (dwellMs: number) => void;
  aoAvancar: (dwellMs: number) => void;
}) {
  /**
   * O cronômetro reinicia a cada story: o viewer não remonta entre stories, e
   * com `useState` inicial o 2º story reportava o dobro do tempo (dwell inflado
   * para quem aparece primeiro na fila).
   */
  const abertoEm = useRef(performance.now());

  useEffect(() => {
    abertoEm.current = performance.now();
    const temporizador = setTimeout(() => aoAvancar(Math.round(performance.now() - abertoEm.current)), 5000);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  // Story ocupa a tela inteira: o feed atrás não pode rolar.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  const decorrido = () => Math.round(performance.now() - abertoEm.current);

  /**
   * Arrastar para baixo fecha; lateral avança (doc 03 §2). O gesto vem de
   * `criarSwipe`, que usa captura de ponteiro — sem isso o navegador cancelava o
   * arraste no primeiro movimento e só o X fechava o story.
   */
  const swipe = criarSwipe({
    aoDeslizar: (direcao) => {
      if (direcao === 'baixo') aoFechar(decorrido());
      if (direcao === 'esquerda') aoAvancar(decorrido());
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex flex-col touch-none bg-black" {...swipe}>
      <div className="mx-auto flex w-full max-w-phone flex-1 flex-col">
        <Barras total={totalDeStories} atual={indice} chave={post.id} />

        <div className="flex items-center gap-2 px-3 py-3">
          <AvatarPerfil seed={post.author.avatarSeed} tamanho={32} />
          <span className="flex-1 text-[13px] font-semibold text-white">
            {post.author.handle.replace(/^@/, '')}
          </span>
          <span className="text-[12px] text-white/70">{post.timestampLabel}</span>
          <button type="button" aria-label="Fechar" onClick={() => aoFechar(decorrido())}>
            <Glifo name="close" size={22} tone="inverse" />
          </button>
        </div>

        <button
          type="button"
          className="relative flex-1"
          onClick={() => aoAvancar(decorrido())}
          aria-label="Próximo story"
        >
          {post.imageUrl ? (
             
            <img src={post.imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-[96px]"
              style={{ background: post.fallbackArt?.corFundo ?? '#222' }}
            >
              {post.fallbackArt?.emojis ?? '✨'}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-left text-[14px] leading-snug text-white">
            {post.caption.slice(0, 140)}
          </span>
        </button>
      </div>
    </div>
  );
}
