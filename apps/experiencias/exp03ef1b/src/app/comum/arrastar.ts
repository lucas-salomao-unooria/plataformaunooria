import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as MouseDoReact, PointerEvent as PointerDoReact } from "react";

/**
 * O ARRASTE dos cartões (pedido do Lucas, 2026-10-29), por cima do toque
 * sequencial, que continua valendo: tocar e tocar faz o mesmo que arrastar e
 * soltar. O `PuzzleBlock`/`PuzzleTrack` do DS decidiram não arrastar (toque
 * sequencial, para não excluir teclado e leitor de tela); por isso isto é
 * (b) COMPENSAÇÃO de COMPORTAMENTO, não componente: o bloco continua o
 * `<button>` do DS e o arraste só se soma a ele. Quando o DS arrastar, este
 * arquivo morre.
 *
 * Pointer Events, não o drag-and-drop do HTML: o do HTML não dispara no toque
 * (tablet). O arraste só começa depois de {@link LIMIAR_PX}; abaixo disso é um
 * toque, e o `onClick` do DS segue sozinho.
 *
 * **Onde se solta** sai do DOM, não do estado: a zona é o elemento com
 * `data-soltar="<zona>"` sob o dedo, e a vaga é a posição da
 * `.unooria-puzzle-track__slot` dentro dela (o `PuzzleTrack` desenha uma `li`
 * por vaga, na ordem — a posição É a identidade da vaga).
 */
export const LIMIAR_PX = 8;

export interface AlvoDoArraste {
  zona: string;
  /** A vaga da calha, base 0; `null` = solto na zona, fora de uma vaga. */
  vaga: number | null;
}

const CLASSE_SOBRE = "arraste-sobre";

/** O alvo sob o ponto (x, y), ou `null`. O fantasma não intercepta: tem `pointer-events: none`. */
export function alvoNoPonto(x: number, y: number): { alvo: AlvoDoArraste; el: Element } | null {
  const sob = document.elementFromPoint(x, y);
  const zona = sob?.closest<HTMLElement>("[data-soltar]");
  if (!sob || !zona?.dataset.soltar) return null;
  const vaga = sob.closest(".unooria-puzzle-track__slot");
  if (vaga && zona.contains(vaga)) {
    const vagas = Array.from(zona.querySelectorAll(".unooria-puzzle-track__slot"));
    return { alvo: { zona: zona.dataset.soltar, vaga: vagas.indexOf(vaga) }, el: vaga };
  }
  return { alvo: { zona: zona.dataset.soltar, vaga: null }, el: zona };
}

/** As props que `useArrastar` põe numa peça; `{}` quando o arraste está desligado. */
export type Arrastavel = (item: string) => Record<string, unknown>;

interface Pegada {
  item: string;
  origem: HTMLElement;
  x0: number;
  y0: number;
  fantasma: HTMLElement | null;
  sobre: Element | null;
}

/**
 * `arrastavel(item)` devolve as props a espalhar no `PuzzleBlock`;
 * `aoSoltar(item, alvo)` decide o que a jogada faz. `ativo = false` desliga o
 * arraste (a esteira executando, a caixa travada) sem tocar no clique.
 */
export function useArrastar(aoSoltar: (item: string, alvo: AlvoDoArraste) => void, ativo = true) {
  const pegada = useRef<Pegada | null>(null);
  const engolirClique = useRef(false);
  const soltar = useRef(aoSoltar);
  const [arrastando, setArrastando] = useState<string | null>(null);

  useEffect(() => {
    soltar.current = aoSoltar;
  }, [aoSoltar]);

  const limpar = useCallback(() => {
    const p = pegada.current;
    pegada.current = null;
    if (!p) return;
    p.fantasma?.remove();
    p.sobre?.classList.remove(CLASSE_SOBRE);
    p.origem.classList.remove("arraste-origem");
    if (p.fantasma) setArrastando(null);
  }, []);

  useEffect(() => {
    function mover(e: PointerEvent) {
      const p = pegada.current;
      if (!p) return;
      const dx = e.clientX - p.x0;
      const dy = e.clientY - p.y0;
      if (!p.fantasma) {
        if (Math.hypot(dx, dy) < LIMIAR_PX) return;
        // Começou o arraste: o fantasma é uma cópia da peça presa ao corpo,
        // fora de qualquer `overflow` que a cortaria no meio do caminho.
        const r = p.origem.getBoundingClientRect();
        const f = p.origem.cloneNode(true) as HTMLElement;
        f.classList.add("arraste-fantasma");
        f.removeAttribute("id");
        f.setAttribute("aria-hidden", "true");
        Object.assign(f.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
        document.body.appendChild(f);
        p.fantasma = f;
        p.origem.classList.add("arraste-origem");
        setArrastando(p.item);
      }
      e.preventDefault();
      p.fantasma.style.transform = `translate(${dx}px, ${dy}px)`;
      const sob = alvoNoPonto(e.clientX, e.clientY)?.el ?? null;
      if (sob !== p.sobre) {
        p.sobre?.classList.remove(CLASSE_SOBRE);
        sob?.classList.add(CLASSE_SOBRE);
        p.sobre = sob;
      }
    }
    function largar(e: PointerEvent) {
      const p = pegada.current;
      if (!p) return;
      if (!p.fantasma) {
        pegada.current = null;
        return;
      }
      engolirClique.current = true;
      const achado = alvoNoPonto(e.clientX, e.clientY);
      limpar();
      if (achado) soltar.current(p.item, achado.alvo);
      // O clique que o navegador dispara depois do `pointerup` é do arraste,
      // não um toque: o `onClickCapture` o engole. Se não vier, a trava cai.
      window.setTimeout(() => (engolirClique.current = false), 0);
    }
    window.addEventListener("pointermove", mover, { passive: false });
    window.addEventListener("pointerup", largar);
    window.addEventListener("pointercancel", limpar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", largar);
      window.removeEventListener("pointercancel", limpar);
      limpar();
    };
  }, [limpar]);

  const arrastavel = useCallback<Arrastavel>(
    (item: string) =>
      ativo
        ? {
            "data-arrastavel": "",
            onPointerDown: (e: PointerDoReact<HTMLElement>) => {
              if (e.button !== 0 || !e.isPrimary) return;
              pegada.current = { item, origem: e.currentTarget, x0: e.clientX, y0: e.clientY, fantasma: null, sobre: null };
            },
            onClickCapture: (e: MouseDoReact<HTMLElement>) => {
              if (!engolirClique.current) return;
              engolirClique.current = false;
              e.preventDefault();
              e.stopPropagation();
            },
          }
        : {},
    [ativo],
  );

  return { arrastavel, arrastando };
}
