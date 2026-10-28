/**
 * O carrossel das missões (`[data-carousel]`) — porte do script que veio na
 * versão final do material (2026-10-28). Corpo literal, como os outros desta
 * pasta; o que mudou é o de sempre: virou função que devolve o cancelamento, e
 * todo listener nasce preso a um `AbortController`.
 *
 * O SERVIDOR já entrega o primeiro slide ativo e os outros com `inert` e
 * `aria-hidden` — é o que o JSX traz. Este módulo assume a partir daí: setas,
 * pontos, teclado (← → Home End) e o arraste no toque. O `show(0)` do fim só
 * acerta o contador e os botões, sem mudar nada do que já está na tela.
 */
export function iniciarCarrossel(raiz: HTMLElement): () => void {
  const corte = new AbortController();
  const { signal } = corte;

  raiz.querySelectorAll<HTMLElement>("[data-carousel]").forEach((root) => {
    const slides = Array.from(
      root.querySelectorAll<HTMLElement>(".content-slide"),
    );
    const dots = Array.from(
      root.querySelectorAll<HTMLElement>("[data-slide-to]"),
    );
    const prev = root.querySelector<HTMLButtonElement>("[data-prev]");
    const next = root.querySelector<HTMLButtonElement>("[data-next]");
    const counter = root.querySelector<HTMLElement>(".carousel-count");
    if (!prev || !next || !counter || slides.length === 0) return;
    let active = 0,
      start: { x: number; y: number; id: number } | null = null,
      suppressClickUntil = 0;

    function show(index: number) {
      active = Math.max(0, Math.min(slides.length - 1, index));
      slides.forEach((slide, i) => {
        const yes = i === active;
        slide.classList.toggle("is-active", yes);
        slide.setAttribute("aria-hidden", String(!yes));
        slide.inert = !yes;
      });
      dots.forEach((dot, i) =>
        dot.setAttribute("aria-pressed", String(i === active)),
      );
      prev!.disabled = active === 0;
      next!.disabled = active === slides.length - 1;
      counter!.textContent = `${String(active + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    }

    prev.addEventListener("click", () => show(active - 1), { signal });
    next.addEventListener("click", () => show(active + 1), { signal });
    dots.forEach((dot) =>
      dot.addEventListener("click", () => show(Number(dot.dataset.slideTo)), {
        signal,
      }),
    );
    root.addEventListener(
      "keydown",
      (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          show(active + 1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          show(active - 1);
        }
        if (e.key === "Home") {
          e.preventDefault();
          show(0);
        }
        if (e.key === "End") {
          e.preventDefault();
          show(slides.length - 1);
        }
      },
      { signal },
    );
    root.addEventListener(
      "pointerdown",
      (e) => {
        if (
          e.pointerType === "mouse" ||
          (e.target as Element).closest(".carousel-controls")
        )
          return;
        start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      },
      { signal },
    );
    root.addEventListener(
      "pointerup",
      (e) => {
        if (!start || start.id !== e.pointerId) return;
        const dx = e.clientX - start.x,
          dy = e.clientY - start.y;
        start = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
          suppressClickUntil = performance.now() + 450;
          e.preventDefault();
          show(active + (dx < 0 ? 1 : -1));
        }
      },
      { signal },
    );
    root.addEventListener(
      "pointercancel",
      () => {
        start = null;
      },
      { signal },
    );
    /* Um arraste termina num `click` sobre o que estiver embaixo do dedo — o
       botão "Tela real ↗" abriria a imagem ampliada no meio da troca de slide. */
    root.addEventListener(
      "click",
      (e) => {
        if (performance.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { capture: true, signal },
    );
    show(0);
  });

  return () => corte.abort();
}
