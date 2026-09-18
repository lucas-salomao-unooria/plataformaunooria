/**
 * O campo de estrelas ÚNICO, fixo atrás da página inteira — porte de
 * `initUnooriaStars`, que veio no pacote da revisão 19 (2026-09-18).
 *
 * Ele SUBSTITUI os dois canvas originais: o campo do hero
 * (`estrelas-de-abertura.ts`, em `#opening-stars`) e a poeira ambiente
 * (`atmosfera.ts`, em `#ambient-dust`), que a folha da revisão esconde e que o
 * `palco-do-site.tsx` deixou de montar. Antes eram dois desenhos com regras
 * próprias, um só no hero e outro na página toda; agora é um só, que responde
 * à rolagem e ao ponteiro e atravessa as treze seções.
 *
 * Corpo literal, como os outros quatro de `efeitos/` — o material já chegou
 * escrito para isto ("Em React, inicializar no useEffect e devolver a limpeza
 * no desmontar"). O que mudou em relação ao arquivo de origem:
 *  - a IIFE, o `window.initUnooriaStars` e a auto-inicialização saíram: quem
 *    monta é o palco, como todo efeito desta pasta;
 *  - o `root.__unooriaStarsCleanup` (a proteção contra montar duas vezes na
 *    página estática) saiu junto, porque aqui quem garante isso é o
 *    `useEffect` com a sua limpeza.
 *
 * O CANVAS É CRIADO AQUI, não no JSX, e é o único efeito assim: ele não existe
 * no material original, então não há marcação portada onde encaixá-lo — e um
 * `<canvas>` no JSX que só um efeito usa seria um nó a mais no HTML do
 * servidor para quem abre com JavaScript desligado.
 */
export function iniciarEstrelasDaRolagem(raiz: HTMLElement): () => void {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => {};
  canvas.id = "unooria-scroll-stars";
  canvas.setAttribute("aria-hidden", "true");
  raiz.prepend(canvas);

  const events = new AbortController();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  type Estrela = {
    x: number; y: number; phase: number; radius: number;
    depth: number; opacity: number; blue: boolean; vx: number; vy: number;
  };
  let width = 1,
    height = 1,
    stars: Estrela[] = [],
    frame = 0,
    last = 0,
    clock = 0;
  let scrollTarget = scrollY,
    scrollSmooth = scrollY;
  let px = -1000,
    py = -1000,
    pointer = 0,
    pointerTarget = 0;
  const rand = (n: number) => {
    const v = Math.sin(n * 127.1 + 73.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const wrap = (v: number, size: number) => ((v % size) + size) % size;

  function draw() {
    ctx!.clearRect(0, 0, width, height);
    for (const s of stars) {
      const motion = reduced.matches ? 0 : 1;
      let x = wrap(s.x * width + motion * (clock * s.vx + Math.sin(clock / 22 + s.phase) * 8), width);
      let y = wrap(s.y * height + motion * (clock * s.vy - scrollSmooth * s.depth * 0.12), height);
      const dx = x - px,
        dy = y - py,
        distance = Math.hypot(dx, dy);
      const influence = motion * pointer * Math.max(0, 1 - distance / 140);
      if (distance > 1) {
        x += (dx / distance) * influence * 16;
        y += (dy / distance) * influence * 16;
      }
      // Baixo brilho no miolo para preservar a leitura em qualquer seção.
      const central = Math.abs(x - width / 2) < width * 0.32;
      const twinkle = motion ? 0.88 + 0.12 * Math.sin(clock * 0.6 + s.phase) : 1;
      ctx!.globalAlpha = Math.min(0.65, s.opacity * (central ? 0.65 : 1) * twinkle + influence * 0.12);
      ctx!.fillStyle = s.blue ? "#99b6df" : "#d1d6e7";
      ctx!.beginPath();
      ctx!.arc(x, y, s.radius, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  function tick(now: number) {
    frame = 0;
    if (document.hidden || reduced.matches) {
      last = 0;
      return;
    }
    if (!last || now - last >= 30) {
      const dt = last ? Math.min(0.08, (now - last) / 1000) : 1 / 30;
      last = now;
      clock += dt;
      const ease = 1 - Math.exp(-dt * 10);
      scrollSmooth += (scrollTarget - scrollSmooth) * ease;
      pointer += (pointerTarget - pointer) * ease;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (!frame && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
  }
  function resize() {
    width = document.documentElement.clientWidth;
    height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(width < 700 ? 360 : 1200, Math.max(120, Math.round((width * height) / 1250)));
    stars = Array.from({ length: count }, (_, n) => ({
      x: rand(n + 1),
      y: rand(n + 311),
      phase: rand(n + 90) * Math.PI * 2,
      radius: 0.35 + rand(n + 821) * 0.6,
      depth: 0.3 + rand(n + 167),
      opacity: 0.14 + rand(n + 541) * 0.4,
      blue: n % 4 === 0,
      vx: (rand(n + 29) - 0.5) * 1.8,
      vy: 0.3 + rand(n + 44) * 0.8,
    }));
    draw();
    start();
  }

  const opts = { passive: true, signal: events.signal };
  addEventListener("resize", resize, opts);
  addEventListener("scroll", () => {
    scrollTarget = scrollY;
    start();
  }, opts);
  addEventListener("pointermove", (e) => {
    if (reduced.matches || e.pointerType === "touch") return;
    px = e.clientX;
    py = e.clientY;
    pointerTarget = 1;
  }, opts);
  document.documentElement.addEventListener("pointerleave", () => { pointerTarget = 0; }, opts);
  addEventListener("pointercancel", () => { pointerTarget = 0; }, opts);
  addEventListener("blur", () => { pointerTarget = 0; }, opts);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    } else {
      scrollTarget = scrollY;
      start();
    }
  }, { signal: events.signal });
  reduced.addEventListener("change", () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    scrollTarget = scrollSmooth = scrollY;
    pointer = pointerTarget = 0;
    draw();
    start();
  }, { signal: events.signal });

  resize();

  return () => {
    events.abort();
    cancelAnimationFrame(frame);
    canvas.remove();
  };
}
