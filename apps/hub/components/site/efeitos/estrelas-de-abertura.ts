/**
 * Campo de estrelas da abertura — porte de `opening-stars.js`. Corpo literal
 * pelas razões do cabeçalho de `atmosfera.ts`.
 */
type Estrela = { x: number; y: number; radius: number; depth: number; opacity: number; blue: boolean };

export function iniciarEstrelasDeAbertura(): () => void {
  const canvas = document.getElementById("opening-stars") as HTMLCanvasElement | null;
  const opening = document.getElementById("inicio");
  if (!canvas || !opening) return () => {};
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return () => {};

  const corte = new AbortController();
  const { signal } = corte;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const seed = (n: number) => {
    const value = Math.sin(n * 127.1 + 73.7) * 43758.5453;
    return value - Math.floor(value);
  };
  let width = 0,
    height = 0,
    stars: Estrela[] = [],
    frame = 0,
    visible = true;
  let x = 0,
    y = 0,
    targetX = 0,
    targetY = 0,
    strength = 0,
    targetStrength = 0;
  let pointerX = -1000,
    pointerY = -1000,
    scroll = 0,
    targetScroll = 0;

  function draw() {
    context!.clearRect(0, 0, width, height);
    for (const star of stars) {
      const shiftX = reduced.matches ? 0 : x * star.depth;
      const shiftY = reduced.matches ? 0 : y * star.depth - scroll * star.depth;
      let sx = (((star.x * width + shiftX) % width) + width) % width;
      let sy = (((star.y * height + shiftY) % height) + height) % height;
      const dx = sx - pointerX,
        dy = sy - pointerY;
      const distance = Math.hypot(dx, dy);
      const influence = reduced.matches ? 0 : Math.max(0, 1 - distance / 160) * strength;
      if (distance > 1) {
        sx += (dx / distance) * influence * 14;
        sy += (dy / distance) * influence * 14;
      }
      // Mantém a área de leitura do texto mais calma que as bordas.
      const textZone = Math.abs(sx - width / 2) < width * 0.36 && Math.abs(sy - height / 2) < height * 0.2;
      context!.globalAlpha = Math.min(0.8, star.opacity * (textZone ? 0.5 : 1) + influence * 0.3);
      context!.fillStyle = star.blue ? "#99b6df" : "#d1d6e7";
      context!.beginPath();
      context!.arc(sx, sy, star.radius, 0, Math.PI * 2);
      context!.fill();
    }
    context!.globalAlpha = 1;
  }
  function tick() {
    frame = 0;
    if (!visible || document.hidden) return;
    if (reduced.matches) {
      draw();
      return;
    }
    x += (targetX - x) * 0.08;
    y += (targetY - y) * 0.08;
    strength += (targetStrength - strength) * 0.1;
    scroll += (targetScroll - scroll) * 0.12;
    draw();
    if (Math.abs(targetX - x) + Math.abs(targetY - y) + Math.abs(targetScroll - scroll) + Math.abs(targetStrength - strength) > 0.015) wake();
  }
  function wake() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function resize() {
    width = opening!.clientWidth;
    height = opening!.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas!.width = Math.round(width * ratio);
    canvas!.height = Math.round(height * ratio);
    context!.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(1800, Math.max(200, Math.round((width * height) / 1150)));
    stars = Array.from({ length: count }, (_, i) => ({
      x: seed(i + 1),
      y: seed(i + 311),
      radius: 0.3 + seed(i + 821) * 0.6,
      depth: 0.35 + seed(i + 167),
      opacity: 0.15 + seed(i + 541) * 0.38,
      blue: i % 4 === 0,
    }));
    draw();
    wake();
  }

  opening.addEventListener(
    "pointermove",
    (event) => {
      if (reduced.matches) return;
      const rect = opening.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      targetX = (pointerX / width - 0.5) * 22;
      targetY = (pointerY / height - 0.5) * 16;
      targetStrength = 1;
      wake();
    },
    { passive: true, signal },
  );
  const reset = () => {
    targetX = targetY = targetStrength = 0;
    wake();
  };
  opening.addEventListener("pointerleave", reset, { passive: true, signal });
  opening.addEventListener("pointercancel", reset, { passive: true, signal });
  opening.addEventListener("pointerup", (event) => { if (event.pointerType === "touch") reset(); }, { passive: true, signal });
  addEventListener(
    "scroll",
    () => {
      targetScroll = Math.min(height, Math.max(0, -opening.getBoundingClientRect().top)) * 0.08;
      wake();
    },
    { passive: true, signal },
  );

  const observadores: Array<{ disconnect: () => void }> = [];
  if ("ResizeObserver" in window) {
    const observador = new ResizeObserver(resize);
    observador.observe(opening);
    observadores.push(observador);
  } else addEventListener("resize", resize, { passive: true, signal });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]!.isIntersecting;
      wake();
    });
    observer.observe(opening);
    observadores.push(observer);
  }
  document.addEventListener("visibilitychange", wake, { signal });
  reduced.addEventListener("change", () => { reset(); draw(); }, { signal });
  resize();

  return () => {
    corte.abort();
    observadores.forEach((o) => o.disconnect());
    if (frame) cancelAnimationFrame(frame);
  };
}
