/**
 * Folhear as páginas dos livros na imagem ampliada — porte do script que veio
 * na versão final do material (2026-10-28). Corpo literal.
 *
 * Só os cartões de "Materiais do estudante" (`.book-card [data-print]`) ligam o
 * modo livro: a janela ganha "‹ ›", o contador "Página n de 4", as setas do
 * teclado e o deslizar do dedo, com uma transição curta entre as páginas. As
 * telas das missões e as jornadas continuam abrindo como antes.
 *
 * As páginas são relidas da PRÓPRIA marcação (`src` e `alt` de cada cartão):
 * trocar uma página é trocar a imagem do cartão, sem lista paralela aqui.
 *
 * Dois desvios do original, ambos de desmontagem: os botões e o contador que o
 * módulo acrescenta à janela SAEM na limpeza (sem isso, cada remontagem do
 * Strict Mode deixaria um par a mais), e o `innerHTML` dos botões virou nó.
 */
export function iniciarPaginasDoLivro(raiz: HTMLElement): () => void {
  const dialog = raiz.querySelector<HTMLDialogElement>("#print-dialog");
  const picture = raiz.querySelector<HTMLImageElement>("#print-image");
  const title = raiz.querySelector<HTMLElement>("#print-title");
  const viewport = dialog?.querySelector<HTMLElement>(".image-viewport");
  if (!dialog || !picture || !viewport) return () => {};
  const buttons = Array.from(
    raiz.querySelectorAll<HTMLElement>(".book-card [data-print]"),
  );
  if (buttons.length < 2) return () => {};

  const corte = new AbortController();
  const { signal } = corte;
  const pages = buttons.map((b) => {
    const i = b.querySelector("img")!;
    return { src: i.src, alt: i.alt, title: b.dataset.title || "" };
  });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };
  const seta = (simbolo: string) => {
    const s = mk("span");
    s.setAttribute("aria-hidden", "true");
    s.textContent = simbolo;
    return s;
  };
  const prev = mk("button", "page-nav page-prev"),
    next = mk("button", "page-nav page-next"),
    pager = mk("div", "page-pager");
  prev.append(seta("‹"));
  next.append(seta("›"));
  prev.type = next.type = "button";
  prev.setAttribute("aria-label", "Página anterior");
  next.setAttribute("aria-label", "Próxima página");
  pager.setAttribute("aria-live", "polite");
  dialog.append(prev, next, pager);

  let idx = -1,
    busy = false,
    stage: HTMLDivElement | null = null;
  const ui = () => {
    prev.disabled = idx <= 0 || busy;
    next.disabled = idx >= pages.length - 1 || busy;
    pager.textContent = `Página ${idx + 1} de ${pages.length}`;
  };
  const fit = () => {
    // em modo livro sobra espaço em cima para o contador
    if (idx < 0 || !picture.naturalWidth) return;
    const w = window.visualViewport?.width || innerWidth,
      h = window.visualViewport?.height || innerHeight,
      r = Math.min(
        (w - 32) / picture.naturalWidth,
        (h - 124) / picture.naturalHeight,
      );
    picture.style.width = `${picture.naturalWidth * r}px`;
    picture.style.height = `${picture.naturalHeight * r}px`;
  };
  const show = (i: number) => {
    idx = i;
    const p = pages[i]!;
    picture.src = p.src;
    picture.alt = p.alt;
    if (title) title.textContent = p.title;
    ui();
  };
  const endFlip = () => {
    if (stage) {
      stage.remove();
      stage = null;
    }
    picture.style.visibility = "";
    busy = false;
    ui();
  };
  const DUR = 320,
    SLIDE = 28;
  const go = (dir: number) => {
    const to = idx + dir;
    if (busy || to < 0 || to >= pages.length) return;
    if (reduce.matches) {
      show(to);
      return;
    }
    const r = picture.getBoundingClientRect(),
      dx = SLIDE * dir;
    busy = true;
    ui();
    stage = mk("div", "page-stage");
    Object.assign(stage.style, {
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      height: r.height + "px",
    });
    const incoming = mk("img");
    incoming.alt = "";
    incoming.src = pages[to]!.src;
    stage.append(incoming);
    dialog.append(stage);
    const o: KeyframeAnimationOptions = {
      duration: DUR,
      easing: "cubic-bezier(.3,.1,.2,1)",
      fill: "forwards",
    };
    picture.animate(
      [
        { opacity: 1, transform: "translateX(0)" },
        { opacity: 0, transform: `translateX(${-dx}px)` },
      ],
      o,
    ); // a página atual sai
    incoming
      .animate(
        [
          { opacity: 0, transform: `translateX(${dx}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        o,
      ) // a próxima entra
      .finished.then(() => {
        show(to);
        return picture.decode().catch(() => {});
      })
      .then(() => {
        picture.getAnimations().forEach((a) => a.cancel());
        requestAnimationFrame(() => {
          fit();
          endFlip();
        });
      })
      .catch(() => {
        picture.getAnimations().forEach((a) => a.cancel());
        endFlip();
      });
  };
  prev.addEventListener(
    "click",
    (e) => {
      e.stopPropagation();
      go(-1);
    },
    { signal },
  );
  next.addEventListener(
    "click",
    (e) => {
      e.stopPropagation();
      go(1);
    },
    { signal },
  );
  dialog.addEventListener(
    "keydown",
    (e) => {
      if (idx < 0) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    },
    { signal },
  );
  // deslizar o dedo
  let sx: number | null = null,
    sy: number | null = null;
  viewport.addEventListener(
    "touchstart",
    (e) => {
      if (idx < 0 || e.touches.length !== 1) return;
      sx = e.touches[0]!.clientX;
      sy = e.touches[0]!.clientY;
    },
    { passive: true, signal },
  );
  viewport.addEventListener(
    "touchend",
    (e) => {
      if (sx == null || sy == null) return;
      const t = e.changedTouches[0]!,
        dx = t.clientX - sx,
        dy = t.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4)
        go(dx < 0 ? 1 : -1);
    },
    { passive: true, signal },
  );
  // abrir: só os cartões de livro ligam o modo "folhear"; as telas de missão e as infografias continuam como antes
  raiz.querySelectorAll<HTMLElement>("[data-print]").forEach((b) =>
    b.addEventListener(
      "click",
      () => {
        const i = buttons.indexOf(b);
        if (i < 0) {
          idx = -1;
          dialog.classList.remove("is-book");
          return;
        }
        idx = i;
        busy = false;
        dialog.classList.add("is-book");
        ui();
        requestAnimationFrame(fit);
      },
      { signal },
    ),
  );
  picture.addEventListener("load", fit, { signal });
  addEventListener("resize", fit, { signal });
  window.visualViewport?.addEventListener("resize", fit, { signal });
  dialog.addEventListener(
    "close",
    () => {
      idx = -1;
      dialog.classList.remove("is-book");
      endFlip();
    },
    { signal },
  );

  return () => {
    corte.abort();
    stage?.remove();
    prev.remove();
    next.remove();
    pager.remove();
    dialog.classList.remove("is-book");
  };
}
