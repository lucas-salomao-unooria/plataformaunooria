import { useRef, useState, type KeyboardEvent, type PointerEvent, type Ref } from "react";
import { ButtonUnv, GestureHint, PostCard } from "@edu/ui/ds-unoovista";
import { iniciais, nomeDaConta } from "../../lib/regras";
import { E2, GLOBAL } from "../../lib/textos";
import type { Categoria, PostPublico } from "../../lib/tipos";
import { srcDoEstande, type usePaleta } from "../componentes/midia";

/** Acima disto, a legenda sai recolhida com o "...mais" (o app real corta em duas linhas). */
const LEGENDA_CURTA = 96;
/** Dois toques em até este intervalo são o toque duplo que curte. */
const TOQUE_DUPLO_MS = 320;
/** Arrasto horizontal mínimo para trocar de lâmina (e máximo de deriva vertical). */
const DESLIZE_PX = 40;

type Gesto = "coracao" | "toque-duplo";

/** O começo da legenda até a palavra que cabe, para o "...mais". */
export function recolher(texto: string, limite = LEGENDA_CURTA): string {
  if ([...texto].length <= limite) return texto;
  const corte = [...texto].slice(0, limite).join("");
  const ultimoEspaco = corte.lastIndexOf(" ");
  return (ultimoEspaco > limite / 2 ? corte.slice(0, ultimoEspaco) : corte).trimEnd();
}

/**
 * Um post do feed da mostra: o `PostCard` do Unoovista com um carrossel de
 * DUAS lâminas — a fotografia do estande (ou a arte procedural) e a ficha
 * técnica em texto —, as ações em pílula sobre a mídia, e a legenda recolhida
 * com o "...mais".
 *
 * **Curtir** é o gesto da missão (é ele que afunila o feed, no servidor): pelo
 * coração da pílula ou pelo toque duplo na mídia, como no app real. O toque
 * duplo só CURTE — descurtir é pelo coração, também como no app real.
 *
 * **O carrossel desliza com o dedo** (arrasto horizontal; `touch-action: pan-y`
 * deixa a rolagem vertical do feed com o navegador) e pelas setas do teclado
 * na mídia focada. O DS publica o contador e os pontos (`currentIndex`/
 * `totalCount`), não o deslize: o gesto é do produto.
 *
 * **A dica do gesto** (`GestureHint`, só no primeiro post) mora numa camada
 * posicionada ANTES da mídia no DOM: depois dela, quebraria o
 * `.unv-post-card__media + .unv-post-card__actions` que põe a pílula sobre a
 * imagem (ver `.gesto-do-carrossel` no CSS).
 */
export function PostDoFeed({
  post,
  categoria,
  curtido,
  paleta,
  comDica,
  refDoCartao,
  aoCurtir,
  aoDeslizar,
  aoExpandir,
}: {
  post: PostPublico;
  categoria: Categoria | undefined;
  curtido: boolean;
  paleta: ReturnType<typeof usePaleta>;
  comDica: boolean;
  refDoCartao: Ref<HTMLElement>;
  aoCurtir: (curtiu: boolean, gesto: Gesto) => void;
  aoDeslizar: (lamina: number) => void;
  aoExpandir: () => void;
}) {
  const [lamina, setLamina] = useState(1);
  const [aberta, setAberta] = useState(false);
  const toque = useRef<{ x: number; y: number; t: number } | null>(null);
  const ultimoToque = useRef(0);
  const conta = nomeDaConta(post.perfil);

  function irPara(nova: number) {
    if (nova === lamina || nova < 1 || nova > 2) return;
    setLamina(nova);
    aoDeslizar(nova);
  }

  const gestos = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      toque.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      const inicio = toque.current;
      toque.current = null;
      if (!inicio) return;
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      if (Math.abs(dx) >= DESLIZE_PX && Math.abs(dy) < DESLIZE_PX) {
        irPara(dx < 0 ? lamina + 1 : lamina - 1);
        return;
      }
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
      const agora = Date.now();
      if (agora - ultimoToque.current <= TOQUE_DUPLO_MS) {
        ultimoToque.current = 0;
        if (!curtido) aoCurtir(true, "toque-duplo");
        return;
      }
      ultimoToque.current = agora;
    },
    onPointerCancel: () => {
      toque.current = null;
    },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight") irPara(lamina + 1);
      if (e.key === "ArrowLeft") irPara(lamina - 1);
    },
    tabIndex: 0,
    "aria-roledescription": "carrossel",
    "aria-label": E2.lamina(lamina, 2),
    className: "midia-deslizavel",
  };

  const legenda = `${post.texto} ${post.hashtags.join(" ")}`.trim();
  const recolhida = !aberta && [...legenda].length > LEGENDA_CURTA;

  return (
    <PostCard ref={refDoCartao} className="post" data-post-id={post.id}>
      <PostCard.Header username={conta} initials={iniciais(post.perfil)} location={post.escola} />
      {comDica && lamina === 1 && (
        <div className="gesto-do-carrossel" aria-hidden="true">
          <div className="gesto-do-carrossel__palco">
            <GestureHint gesture="swipe-left" iterations={3} />
          </div>
        </div>
      )}
      {lamina === 1 ? (
        <PostCard.Media
          {...gestos}
          src={srcDoEstande(post, paleta)}
          alt={post.imagem.alt}
          errorLabel={E2.midiaErro}
          retryLabel={GLOBAL.tentarNovamente}
          currentIndex={1}
          totalCount={2}
        />
      ) : (
        <PostCard.Media {...gestos} currentIndex={2} totalCount={2}>
          <div className="ficha-tecnica">
            <p className="ficha-tecnica__titulo">{E2.fichaTitulo}</p>
            <dl className="ficha-tecnica__lista">
              <dt>{E2.fichaProjeto}</dt>
              <dd>{post.titulo}</dd>
              <dt>{E2.fichaEscola}</dt>
              <dd>{post.escola}</dd>
              <dt>{E2.fichaArea}</dt>
              <dd>{categoria ? `${categoria.nome} · ${categoria.hashtag}` : post.hashtags[0] ?? ""}</dd>
              <dt>{E2.fichaPerfil}</dt>
              <dd>{post.perfil}</dd>
            </dl>
            {post.tipo === "bastidor" && <p className="ficha-tecnica__nota">{E2.fichaBastidor}</p>}
          </div>
        </PostCard.Media>
      )}
      <PostCard.Actions
        liked={curtido}
        currentIndex={lamina}
        totalCount={2}
        onLike={() => aoCurtir(!curtido, "coracao")}
      />
      <PostCard.Caption username={conta}>
        {recolhida ? `${recolher(legenda)} ` : legenda}
        {recolhida && (
          <ButtonUnv variant="link" size="sm" className="legenda__mais" onClick={() => {
              setAberta(true);
              aoExpandir();
            }}>
            {E2.mais}
          </ButtonUnv>
        )}
      </PostCard.Caption>
    </PostCard>
  );
}
