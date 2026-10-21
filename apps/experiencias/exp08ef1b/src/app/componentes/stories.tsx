import { StoriesTray, StoryBubble, StoryViewer, type UnvStoryBubbleState } from '@edu/ui/ds-unoovista';
import { useEffect, useRef, useState } from 'react';

import { criarSwipe } from '../../lib/gestos';
import type { FeedPostCliente } from '../../lib/tipos';

import { retratoDe } from './avatar-perfil';

/** Quanto tempo cada história fica na tela antes de avançar sozinha. */
const DURACAO_MS = 5000;

const semArroba = (handle: string) => handle.replace(/^@/, '');

/**
 * A mídia de uma história sem foto: o cartão de emoji do post (`fallbackArt`)
 * desenhado num SVG. O `StoryViewer` do DS recebe a mídia por URL e não tem
 * slide sem `src` (o `PostCard.Media` tem; o viewer, não) — sem isto, metade
 * das histórias abriria vazia.
 */
// Vem do servidor e entra num documento XML: escapa antes de interpolar.
const xml = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

const svgComoUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function midiaDaHistoria(post: FeedPostCliente): string {
  if (post.imageUrl) return post.imageUrl;
  const fundo = xml(post.fallbackArt?.corFundo ?? '#222222');
  const emojis = xml(post.fallbackArt?.emojis ?? '✨');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 667">` +
    `<rect width="375" height="667" fill="${fundo}"/>` +
    `<text x="187.5" y="333.5" font-size="96" text-anchor="middle" dominant-baseline="central">${emojis}</text>` +
    `</svg>`;
  return svgComoUrl(svg);
}

/**
 * O avatar do autor no visualizador. O `StoryViewer` recebe só `avatarSrc` (não
 * tem `initials`, como o `Avatar`), e a persona do feed não tem foto: sem isto o
 * círculo sai vazio. As iniciais são desenhadas num SVG com as MESMAS cores do
 * fallback do `Avatar` do DS (`background-tertiary` e `text-secondary`), lidas
 * dos tokens na hora — um SVG em `<img>` não enxerga `var()`.
 */
function avatarDaHistoria(seed: string): string {
  const { src, initials } = retratoDe(seed);
  if (src) return src;
  const token = (nome: string) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${xml(token('--unv-color-background-tertiary'))}"/>` +
    `<text x="32" y="32" font-family="Open Sans, sans-serif" font-size="24" font-weight="600" ` +
    `fill="${xml(token('--unv-color-text-secondary'))}" text-anchor="middle" dominant-baseline="central">${xml(initials)}</text>` +
    `</svg>`;
  return svgComoUrl(svg);
}

/**
 * A faixa de histórias (doc 03 §2), pela `StoriesTray` e a `StoryBubble` do
 * Unoovista: o squircle com anel para quem tem história nova, o anel neutro para
 * a vista e o selo AO VIVO na segunda. Histórias consomem posts do banco e CONTAM
 * dwell — o visualizador avisa quem abriu e por quanto tempo ficou.
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
  const [aberto, setAberto] = useState<number | null>(null);
  const [vistos, setVistos] = useState<Set<string>>(new Set());

  const disponiveis = posts.slice(0, 9);
  const meuRetrato = retratoDe(avatarDoEstudante ?? '');

  const estadoDe = (post: FeedPostCliente, indice: number): UnvStoryBubbleState => {
    if (vistos.has(post.id)) return 'seen';
    // a segunda história é "ao vivo", como era no clone antigo
    return indice === 1 ? 'live' : 'unseen';
  };

  return (
    <>
      <StoriesTray>
        {/* "Seu story" é cenário, como sempre foi: não abre nada. Fica fora do
            teclado e do leitor de tela para não ser um botão que não faz nada. */}
        <StoryBubble
          username="Seu story"
          state="add"
          avatarSrc={meuRetrato.src}
          initials={meuRetrato.initials}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none"
        />

        {disponiveis.map((post, indice) => {
          const retrato = retratoDe(post.author.avatarSeed);
          return (
            <StoryBubble
              key={post.id}
              username={semArroba(post.author.handle)}
              state={estadoDe(post, indice)}
              avatarSrc={retrato.src}
              initials={retrato.initials}
              onClick={() => {
                setAberto(indice);
                aoGestoDeStory?.('abriu_story', post.id);
              }}
            />
          );
        })}
      </StoriesTray>

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

/** Visualizador em tela cheia: o `StoryViewer` do DS, avançando sozinho a cada 5s. */
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
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    abertoEm.current = performance.now();
    setProgresso(0);
    const temporizador = setTimeout(() => aoAvancar(Math.round(performance.now() - abertoEm.current)), DURACAO_MS);

    // A barra do DS recebe o progresso por prop (0 a 1); quem anda com ela é aqui.
    let quadro = 0;
    const animar = () => {
      setProgresso(Math.min(1, (performance.now() - abertoEm.current) / DURACAO_MS));
      quadro = requestAnimationFrame(animar);
    };
    // Quem pede menos movimento vê a barra parada até o fim do segmento.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) quadro = requestAnimationFrame(animar);

    return () => {
      clearTimeout(temporizador);
      cancelAnimationFrame(quadro);
    };
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
   * `criarSwipe`, que captura o ponteiro — e uma captura no invólucro roubaria o
   * clique das zonas de toque e do "fechar" do `StoryViewer` (o clique vai para
   * quem capturou). Por isso, começando num botão, o ponteiro NÃO é capturado; no
   * aparelho de toque o arraste continua valendo pelo par touchstart/touchend.
   */
  const { onPointerDown, ...restoDoSwipe } = criarSwipe({
    aoDeslizar: (direcao) => {
      if (direcao === 'baixo') aoFechar(decorrido());
      if (direcao === 'esquerda') aoAvancar(decorrido());
    },
  });

  return (
    <div
      className="fixed inset-0 z-[60] mx-auto flex w-full max-w-phone touch-none flex-col"
      onPointerDown={(evento) => {
        if (!(evento.target as Element).closest('button')) onPointerDown(evento);
      }}
      {...restoDoSwipe}
    >
      <StoryViewer
        mediaSrc={midiaDaHistoria(post)}
        mediaAlt=""
        username={semArroba(post.author.handle)}
        avatarSrc={avatarDaHistoria(post.author.avatarSeed)}
        timestamp={post.timestampLabel}
        segments={totalDeStories}
        currentSegment={indice + 1}
        segmentProgress={progresso}
        onClose={() => aoFechar(decorrido())}
        onNext={() => aoAvancar(decorrido())}
        footer={
          /* A doca sob o palco mostra a legenda no lugar do "Enviar mensagem":
             a história não tem resposta neste app, e um campo que não faz nada
             seria um controle mentiroso. */
          <p className="m-0 line-clamp-2 px-3 py-1.5 text-[14px] leading-snug text-ink">
            {post.caption.slice(0, 140)}
          </p>
        }
      />
    </div>
  );
}
