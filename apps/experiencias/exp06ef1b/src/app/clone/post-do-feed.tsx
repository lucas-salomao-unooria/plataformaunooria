import { useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent, type Ref } from "react";
import { ButtonUnv, GestureHint, IconUnv, PostCard } from "@edu/ui/ds-unoovista";
import { iniciais, lerGesto, nomeDaConta } from "../../lib/regras";
import { E2 } from "../../lib/textos";
import type { PostPublico } from "../../lib/tipos";
import { srcDaFoto, type usePaleta } from "../componentes/midia";

/** Acima disto, a legenda sai recolhida com o "...mais" (o app real corta em duas linhas). */
const LEGENDA_CURTA = 96;
/** Dois toques em até este intervalo são o toque duplo que curte. */
const TOQUE_DUPLO_MS = 320;
/** O carrossel do estande: a capa e as fotos técnicas 2 e 3 (`e2.instrucao.carrossel_contador`). */
const FOTOS = 3;

type Gesto = "coracao" | "toque-duplo";

/** O começo da legenda até a palavra que cabe, para o "...mais". */
export function recolher(texto: string, limite = LEGENDA_CURTA): string {
  if ([...texto].length <= limite) return texto;
  const corte = [...texto].slice(0, limite).join("");
  const ultimoEspaco = corte.lastIndexOf(" ");
  return (ultimoEspaco > limite / 2 ? corte.slice(0, ultimoEspaco) : corte).trimEnd();
}

/**
 * Um post do feed da mostra: o `PostCard` do Unoovista com o carrossel de TRÊS
 * fotos (a capa do estande e as fotos técnicas 2 e 3, "Foto 2 de 3"), as ações
 * em pílula sobre a mídia e a legenda recolhida com "...mais" / "menos".
 *
 * **Curtir** é o gesto que afunila o feed, no servidor: pelo coração da pílula
 * ou pelo toque duplo na mídia, como no app real. O toque duplo só CURTE.
 * **Salvar** grava o evento e não pesa (PRD v2). **Comentar e compartilhar**
 * respondem com a linha da comissão (`e2.rotulo.comentarios_desabilitados`):
 * um botão morto parece defeito para a criança.
 *
 * **A mídia que não carrega** cai no estado `PLACEHOLDER_DIEGETICO` do próprio
 * `PostCard.Media` (o rótulo técnico e a legenda de sincronização da copy), e
 * a legenda e as ações do estande continuam — o estande ainda pode ser julgado.
 *
 * **As fotos 2 e 3** são a arte procedural do estande com outra semente: o
 * pacote do professor tem UMA fotografia por projeto (`ImagemPublicaSchema`).
 *
 * **O carrossel desliza com o dedo E com o mouse** (o `dragstart` nativo da
 * imagem é cancelado e o ponteiro é capturado), pelas setas sobre a mídia e
 * pelas setas do teclado na mídia focada. A dica do gesto (`GestureHint`, só no
 * primeiro post) mora numa camada ANTES da mídia no DOM (ver o CSS).
 */
export function PostDoFeed({
  post,
  curtido,
  salvo,
  paleta,
  comDica,
  refDoCartao,
  aoCurtir,
  aoSalvar,
  aoFechado,
  aoDeslizar,
  aoExpandir,
}: {
  post: PostPublico;
  curtido: boolean;
  salvo: boolean;
  paleta: ReturnType<typeof usePaleta>;
  comDica: boolean;
  refDoCartao: Ref<HTMLElement>;
  aoCurtir: (curtiu: boolean, gesto: Gesto) => void;
  aoSalvar: (salvou: boolean) => void;
  /** Comentar ou compartilhar: a comissão responde que estão fechados. */
  aoFechado: (acao: "comentar" | "compartilhar") => void;
  aoDeslizar: (lamina: number) => void;
  aoExpandir: () => void;
}) {
  const [lamina, setLamina] = useState(1);
  const [aberta, setAberta] = useState(false);
  const toque = useRef<{ x: number; y: number; t: number } | null>(null);
  const ultimoToque = useRef(0);
  const conta = nomeDaConta(post.perfil);

  function irPara(nova: number) {
    if (nova === lamina || nova < 1 || nova > FOTOS) return;
    setLamina(nova);
    aoDeslizar(nova);
  }

  const gestos = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      toque.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      /* O `pointerup` volta para cá mesmo que o mouse saia da mídia no arrasto. */
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* Ponteiro que já acabou (o navegador recusa): o gesto segue sem captura. */
      }
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      const inicio = toque.current;
      toque.current = null;
      if (!inicio) return;
      const gesto = lerGesto(e.clientX - inicio.x, e.clientY - inicio.y);
      if (gesto === "proxima" || gesto === "anterior") {
        irPara(gesto === "proxima" ? lamina + 1 : lamina - 1);
        return;
      }
      if (gesto !== "toque") return;
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
    /* O arrasto NATIVO da imagem roubaria o gesto do mouse (`pointercancel`). */
    onDragStart: (e: DragEvent<HTMLDivElement>) => e.preventDefault(),
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight") irPara(lamina + 1);
      if (e.key === "ArrowLeft") irPara(lamina - 1);
    },
    tabIndex: 0,
    "aria-roledescription": "carrossel",
    "aria-label": E2.foto(lamina),
    className: "midia-deslizavel",
  };

  const legenda = `${post.texto} ${post.hashtags.join(" ")}`.trim();
  const longa = [...legenda].length > LEGENDA_CURTA;
  const recolhida = !aberta && longa;

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
      {/* As setas: a navegação por clique. Mostram só a direção que existe. */}
      <div className="setas-do-carrossel">
        <div className="setas-do-carrossel__palco">
          {lamina > 1 && (
            <ButtonUnv
              variant="primary"
              size="sm"
              className="setas-do-carrossel__seta setas-do-carrossel__seta--anterior"
              aria-label={E2.fotoAnterior}
              data-seta="anterior"
              leadingIcon={<IconUnv name="back" size="sm" tone="inherit" />}
              onClick={() => irPara(lamina - 1)}
            />
          )}
          {lamina < FOTOS && (
            <ButtonUnv
              variant="primary"
              size="sm"
              className="setas-do-carrossel__seta setas-do-carrossel__seta--proxima"
              aria-label={E2.proximaFoto}
              data-seta="proxima"
              leadingIcon={<IconUnv name="back" size="sm" tone="inherit" flipX />}
              onClick={() => irPara(lamina + 1)}
            />
          )}
        </div>
      </div>
      <PostCard.Media
        {...gestos}
        key={lamina}
        src={srcDaFoto(post, lamina, paleta)}
        alt={post.imagem.alt}
        errorLabel={E2.placeholderMidia}
        errorDescription={E2.placeholderLegenda}
        currentIndex={lamina}
        totalCount={FOTOS}
      />
      <PostCard.Actions
        liked={curtido}
        saved={salvo}
        currentIndex={lamina}
        totalCount={FOTOS}
        onLike={() => aoCurtir(!curtido, "coracao")}
        onSave={() => aoSalvar(!salvo)}
        onComment={() => aoFechado("comentar")}
        onShare={() => aoFechado("compartilhar")}
      />
      <PostCard.Caption username={conta}>
        {recolhida ? `${recolher(legenda)} ` : `${legenda} `}
        {longa && (
          <ButtonUnv
            variant="link"
            size="sm"
            className="legenda__mais"
            aria-expanded={aberta}
            onClick={() => {
              if (!aberta) aoExpandir();
              setAberta(!aberta);
            }}
          >
            {aberta ? E2.menos : E2.mais}
          </ButtonUnv>
        )}
      </PostCard.Caption>
    </PostCard>
  );
}
