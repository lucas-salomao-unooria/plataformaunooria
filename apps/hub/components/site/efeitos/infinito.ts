/**
 * O infinito da marca formado por pontos de luz — porte de `infinity.js`.
 * Corpo literal pelas razões do cabeçalho de `atmosfera.ts`.
 *
 * A única figura reconhecível na cena é amostrada do PRÓPRIO logo já embutido
 * na página, pixel a pixel: não há asset remoto, não há WebGL e não há contorno
 * desenhado à mão em lugar nenhum. É por isso que o módulo espera o `load` da
 * imagem antes de iniciar — sem os pixels não existe figura, e o `catch`
 * esconde os palcos em vez de deixar um canvas preto na página.
 *
 * O logo amostrado é o do RODAPÉ (`.footer-brand img`), desde a versão final do
 * material (2026-10-28): o cabeçalho passou a mostrar a marca do ENTRE REDES, e
 * o infinito é da Unooria — amostrar o cabeçalho formaria outra figura.
 */
type Particula = {
  x: number; y: number; z: number;
  angle: number; distance: number; arm: number; phase: number;
  cloudZ: number; delay: number; size: number;
  color: number; bright: boolean; glint: boolean; alpha: number;
};

type Cena = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  particles: Particula[];
  width: number; height: number;
  visible: boolean; elapsed: number; paused: boolean;
  formed: number; scrollDissolve: number;
  yaw: number; pitch: number; targetYaw: number; targetPitch: number;
  velocityX: number; velocityY: number;
  dragging: boolean; pointer: number | null; lastTouch: number;
  hover: number; hoverTarget: number; px: number; py: number;
  pause: HTMLButtonElement;
  replay: HTMLButtonElement;
};

export function iniciarInfinito(): () => void {
  const primary = document.getElementById("brand-infinity") as HTMLCanvasElement | null;
  const logo = document.querySelector(".footer-brand img") as HTMLImageElement | null;
  if (!primary || !logo) return () => {};

  const corte = new AbortController();
  const { signal } = corte;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const compact = matchMedia("(max-width: 700px)");
  const scenes: Cena[] = [];
  const tau = Math.PI * 2;
  const colors = ["127,165,226", "139,133,172", "189,213,247", "243,246,255"];
  let frameId = 0,
    lastFrame = 0,
    sprites: HTMLCanvasElement[] = [];
  const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (v: number) => { v = clamp(v); return v * v * (3 - 2 * v); };
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const random = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

  function brandPoints() {
    const sample = document.createElement("canvas");
    sample.width = 600;
    sample.height = 129;
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.drawImage(logo!, 0, 0, 600, 129);
    const data = ctx.getImageData(189, 34, 188, 92).data,
      points: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < 92; y++)
      for (let x = 0; x < 188; x++) {
        const p = (y * 188 + x) * 4;
        if (data[p + 3]! > 100 && Math.min(data[p]!, data[p + 1]!, data[p + 2]!) > 75)
          points.push({ x: (x + 0.5 - 94) / 94, y: (y + 0.5 - 46) / 94 });
      }
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(random(i + 704) * (i + 1));
      [points[i], points[j]] = [points[j]!, points[i]!];
    }
    if (!points.length) throw new Error("Contorno da marca indisponível");
    return points;
  }

  function glowSprites() {
    return colors.map((color) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.07, "rgba(255,255,255,.95)");
      gradient.addColorStop(0.15, `rgba(${color},.65)`);
      gradient.addColorStop(0.35, `rgba(${color},.1)`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      return canvas;
    });
  }

  function addScene(canvas: HTMLCanvasElement, points: Array<{ x: number; y: number }>, index: number) {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;
    const stage = canvas.closest(".infinity-stage")!;
    const count = compact.matches ? 2200 : 4300;
    const particles: Particula[] = points.slice(0, count).map((p, i) => {
      const seed = i + index * 11001,
        angle = (random(seed + 87) - 0.5) * 0.75;
      const distance = 0.08 + Math.pow(random(seed + 73), 0.65) * 1.4;
      const bright = random(seed + 16);
      return {
        x: p.x, y: p.y, z: (random(seed + 91) - 0.5) * 0.38,
        angle, distance, arm: i % 3, phase: random(seed + 42) * tau,
        cloudZ: (random(seed + 13) - 0.5) * 1.4,
        delay: random(seed + 19) * 0.13,
        size: bright > 0.987 ? 2.3 + random(seed + 55) : bright > 0.9 ? 0.9 + random(seed + 44) : 0.22 + random(seed + 17) * 0.48,
        color: i % 4, bright: bright > 0.9, glint: bright > 0.996,
        alpha: 0.3 + random(seed + 25) * 0.7,
      };
    });
    const view: Cena = {
      canvas, context, particles, width: 0, height: 0, visible: false,
      elapsed: 0, paused: false, formed: 0, scrollDissolve: 0,
      yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, velocityX: 0, velocityY: 0,
      dragging: false, pointer: null, lastTouch: 0, hover: 0, hoverTarget: 0, px: 0, py: 0,
      pause: stage.querySelector('[id="infinity-pause"], [data-infinity-pause]') as HTMLButtonElement,
      replay: stage.querySelector('[id="infinity-replay"], [data-infinity-replay]') as HTMLButtonElement,
    };
    scenes.push(view);
    connect(view);
    return view;
  }

  function resize(view: Cena) {
    const w = Math.round(view.canvas.clientWidth),
      h = Math.round(view.canvas.clientHeight);
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio || 1, compact.matches ? 1.5 : 2);
    view.canvas.width = Math.round(w * ratio);
    view.canvas.height = Math.round(h * ratio);
    view.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    view.width = w;
    view.height = h;
  }

  // Nuvem -> reunião -> infinito -> soltura. A rolagem também abre o volume.
  // Toda forma identificável é o contorno original da marca, nunca um numeral.
  function formation(seconds: number) {
    const t = seconds % 20;
    if (t < 4.6) return smooth((t - 0.35) / 4.1);
    if (t < 12) return 1;
    if (t < 15.2) return 1 - smooth((t - 12) / 3.2);
    return 0;
  }

  function render(view: Cena, still = motion.matches) {
    const { context: ctx, width: w, height: h } = view;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const t = still ? 6 : view.elapsed;
    const form = still ? 1 : formation(t) * (1 - view.scrollDissolve * 0.88);
    view.formed = form;
    const spread = 1 - form;
    const yaw = still ? 0 : view.yaw + Math.sin(t * 0.17) * 0.065;
    const pitch = still ? 0 : view.pitch + Math.sin(t * 0.13) * 0.055;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
    const scale = Math.min(w * 0.4, (h - 65) * 0.78);
    const centerX = w / 2, centerY = (h - 42) / 2;
    const pointScale = clamp(w / 900, 0.66, 1.2);
    ctx.globalCompositeOperation = "lighter";
    for (const p of view.particles) {
      const gather = still ? 1 : smooth(clamp((form - p.delay) / (1 - p.delay)));
      const open = 1 - gather;
      const orbital = p.angle + p.distance * 3.1 + t * (0.16 + spread * 0.075) + (p.arm * tau) / 3;
      const cloudX = Math.cos(orbital) * p.distance;
      const cloudY = Math.sin(orbital) * p.distance * 0.6;
      const cloudZ = p.cloudZ + Math.sin(orbital * 0.8) * 0.23;
      const flutter = still ? 0 : Math.sin(t * 0.65 + p.phase) * 0.004;
      const x = mix(cloudX, p.x, gather);
      const y = mix(cloudY, p.y + flutter, gather);
      const z = mix(cloudZ, p.z, gather);
      const rx = x * cy + z * sy, rz = z * cy - x * sy;
      const ry = y * cx - rz * sx, depth = rz * cx + y * sx;
      const perspective = 2.9 / (2.9 + depth);
      let screenX = centerX + rx * scale * perspective,
        screenY = centerY + ry * scale * perspective;
      const dx = screenX - view.px, dy = screenY - view.py;
      const influence = still ? 0 : Math.max(0, 1 - Math.hypot(dx, dy) / (compact.matches ? 75 : 130)) * view.hover;
      screenX += dx * influence * 0.25;
      screenY += dy * influence * 0.25;
      const flicker = still ? 1 : 0.78 + 0.22 * Math.sin(t * (0.8 + p.alpha) + p.phase);
      const alpha = clamp(p.alpha * flicker * (0.48 + 0.52 * gather) * (1 - depth * 0.22) + influence * 0.25);
      const radius = p.size * pointScale * perspective * (1 + influence * 0.3);
      if (screenX < -30 || screenX > w + 30 || screenY < -30 || screenY > h + 30) continue;
      ctx.globalAlpha = alpha;
      if (p.bright) {
        const size = radius * (p.glint ? 19 : 12);
        ctx.drawImage(sprites[p.color]!, screenX - size / 2, screenY - size / 2, size, size);
      } else {
        ctx.fillStyle = `rgb(${colors[p.color]})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, Math.max(0.15, radius), 0, tau);
        ctx.fill();
      }
      if (p.glint) {
        const length = radius * (3.5 + 1.5 * Math.sin(t + p.phase));
        ctx.globalAlpha = alpha * 0.38;
        ctx.strokeStyle = "#e0eaff";
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(screenX - length, screenY);
        ctx.lineTo(screenX + length, screenY);
        ctx.moveTo(screenX, screenY - length);
        ctx.lineTo(screenX, screenY + length);
        ctx.stroke();
      }
      if (p.bright) {
        ctx.globalAlpha = alpha * 0.16;
        ctx.fillStyle = "#9bb9ef";
        const dust = 9 + open * 20;
        ctx.fillRect(screenX + Math.cos(p.phase) * dust, screenY + Math.sin(p.phase) * dust, 0.65, 0.65);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  const active = () => !motion.matches && !document.hidden && scenes.some((v) => v.visible && !v.paused);
  function stop() { if (frameId) cancelAnimationFrame(frameId); frameId = 0; }
  function frame(now: number) {
    frameId = 0;
    if (!active()) return;
    const delta = now - lastFrame;
    if (delta >= 32) {
      const dt = Math.min(delta, 64) / 1000,
        step = dt * 30;
      lastFrame = now;
      for (const v of scenes) {
        if (!v.visible || v.paused) continue;
        v.elapsed += dt;
        if (!v.dragging) {
          v.targetYaw += v.velocityX * step;
          v.targetPitch = clamp(v.targetPitch + v.velocityY * step, -1.35, 1.35);
          v.velocityX *= Math.pow(0.93, step);
          v.velocityY *= Math.pow(0.92, step);
          if (v.elapsed - v.lastTouch > 1.5) {
            v.targetYaw = Math.atan2(Math.sin(v.targetYaw), Math.cos(v.targetYaw));
            v.targetYaw *= Math.pow(0.972, step);
            v.targetPitch *= Math.pow(0.972, step);
          }
        }
        const follow = 1 - Math.pow(0.72, step);
        v.yaw += (v.targetYaw - v.yaw) * follow;
        v.pitch += (v.targetPitch - v.pitch) * follow;
        v.hover += (v.hoverTarget - v.hover) * 0.15;
        render(v);
      }
    }
    frameId = requestAnimationFrame(frame);
  }
  function start() {
    if (frameId || !active()) return;
    lastFrame = performance.now();
    frameId = requestAnimationFrame(frame);
  }
  function pause(view: Cena, value: boolean) {
    view.paused = value;
    view.pause.setAttribute("aria-pressed", String(value));
    view.pause.setAttribute("aria-label", value ? "Retomar estrelas" : "Pausar estrelas");
    view.pause.title = value ? "Retomar estrelas" : "Pausar estrelas";
    view.pause.querySelector("path")!.setAttribute("d", value ? "M7 4v16l14-8z" : "M6 5h4v14H6zm8 0h4v14h-4z");
    if (active()) start();
    else stop();
  }
  function replay(view: Cena) {
    if (motion.matches) return;
    view.elapsed = 0;
    view.lastTouch = 0;
    view.targetYaw = 0;
    view.targetPitch = 0;
    view.velocityX = 0;
    view.velocityY = 0;
    view.hoverTarget = 0;
    pause(view, false);
    render(view);
  }
  function connect(v: Cena) {
    let lastX = 0, lastY = 0, startX = 0, startY = 0, lastAt = 0;
    const position = (e: PointerEvent) => {
      const r = v.canvas.getBoundingClientRect();
      v.px = e.clientX - r.left;
      v.py = e.clientY - r.top;
    };
    v.canvas.addEventListener("pointerdown", (e) => {
      if (motion.matches || e.button !== 0 || v.pointer !== null) return;
      v.pointer = e.pointerId;
      v.dragging = true;
      v.velocityX = 0;
      v.velocityY = 0;
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
      lastAt = performance.now();
      v.lastTouch = v.elapsed;
      position(e);
      v.hoverTarget = 1;
      v.canvas.setPointerCapture(e.pointerId);
    }, { signal });
    v.canvas.addEventListener("pointermove", (e) => {
      if (motion.matches) return;
      position(e);
      v.hoverTarget = e.pointerType === "touch" && !v.dragging ? 0 : 1;
      if (v.pointer !== e.pointerId) return;
      const dx = (e.clientX - lastX) / v.width,
        dy = (e.clientY - lastY) / v.height;
      const now = performance.now(),
        interval = Math.max(12, now - lastAt);
      v.targetYaw += dx * 4.8;
      v.targetPitch = clamp(v.targetPitch - dy * 3.1, -1.35, 1.35);
      v.velocityX = clamp((dx * 4.8 * 28) / interval, -0.14, 0.14);
      v.velocityY = clamp((-dy * 3.1 * 28) / interval, -0.1, 0.1);
      lastX = e.clientX;
      lastY = e.clientY;
      lastAt = now;
      v.lastTouch = v.elapsed;
      if (v.paused) { v.yaw = v.targetYaw; v.pitch = v.targetPitch; render(v); }
    }, { signal });
    function release(e: PointerEvent) {
      if (v.pointer !== e.pointerId) return;
      const tap = e.type === "pointerup" && Math.hypot(e.clientX - startX, e.clientY - startY) < 7;
      if (performance.now() - lastAt > 100) { v.velocityX = 0; v.velocityY = 0; }
      v.pointer = null;
      v.dragging = false;
      v.lastTouch = v.elapsed;
      v.hoverTarget = 0;
      if (v.canvas.hasPointerCapture(e.pointerId)) v.canvas.releasePointerCapture(e.pointerId);
      if (tap) replay(v);
    }
    v.canvas.addEventListener("pointerup", release, { signal });
    v.canvas.addEventListener("pointercancel", release, { signal });
    v.canvas.addEventListener("lostpointercapture", () => { v.pointer = null; v.dragging = false; v.hoverTarget = 0; }, { signal });
    v.canvas.addEventListener("pointerleave", () => { if (!v.dragging) v.hoverTarget = 0; }, { signal });
    v.canvas.addEventListener("keydown", (e) => {
      if (motion.matches) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "Enter", " "].includes(e.key)) return;
      e.preventDefault();
      v.lastTouch = v.elapsed;
      v.velocityX = 0;
      v.velocityY = 0;
      if (e.key === "Enter" || e.key === " ") { replay(v); return; }
      if (e.key === "ArrowLeft") v.targetYaw -= 0.18;
      if (e.key === "ArrowRight") v.targetYaw += 0.18;
      if (e.key === "ArrowUp") v.targetPitch = clamp(v.targetPitch - 0.14, -1.35, 1.35);
      if (e.key === "ArrowDown") v.targetPitch = clamp(v.targetPitch + 0.14, -1.35, 1.35);
      if (e.key === "Home") { v.targetYaw = 0; v.targetPitch = 0; }
      if (v.paused) { v.yaw = v.targetYaw; v.pitch = v.targetPitch; render(v); }
    }, { signal });
    v.pause.addEventListener("click", () => pause(v, !v.paused), { signal });
    v.replay.addEventListener("click", () => replay(v), { signal });
  }

  function updateScroll() {
    for (const v of scenes) {
      const r = v.canvas.getBoundingClientRect();
      if (!("IntersectionObserver" in window)) v.visible = r.bottom > 0 && r.top < innerHeight;
      const edge = Math.max(0, -r.top, r.bottom - innerHeight);
      v.scrollDissolve = smooth((edge / Math.max(1, r.height) - 0.32) / 0.68);
    }
    if (active()) start();
    else stop();
  }

  const observadores: Array<{ disconnect: () => void }> = [];
  function init() {
    try {
      const points = brandPoints();
      sprites = glowSprites();
      const hero = addScene(primary!, points, 0);
      if (!hero) throw new Error("Canvas indisponível");
      scenes.forEach((v) => {
        resize(v);
        const r = v.canvas.getBoundingClientRect();
        v.visible = r.bottom > 0 && r.top < innerHeight;
        v.canvas.tabIndex = motion.matches ? -1 : 0;
        render(v, motion.matches || !v.visible);
      });
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              const v = scenes.find((s) => s.canvas === e.target);
              if (!v) continue;
              v.visible = e.isIntersecting;
              if (v.visible) render(v, motion.matches || v.paused);
            }
            updateScroll();
          },
          { threshold: 0, rootMargin: "30px" },
        );
        scenes.forEach((v) => observer.observe(v.canvas));
        observadores.push(observer);
      }
      const refresh = () => {
        scenes.forEach((v) => { resize(v); render(v); });
        updateScroll();
      };
      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(refresh);
        scenes.forEach((v) => observer.observe(v.canvas));
        observadores.push(observer);
      } else addEventListener("resize", refresh, { passive: true, signal });
      addEventListener("scroll", updateScroll, { passive: true, signal });
      document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()), { signal });
      motion.addEventListener("change", () => {
        stop();
        scenes.forEach((v) => {
          v.canvas.tabIndex = motion.matches ? -1 : 0;
          v.hover = 0;
          v.hoverTarget = 0;
          render(v);
        });
        start();
      }, { signal });
      updateScroll();
      start();
    } catch (error) {
      console.warn("As estrelas não puderam ser iniciadas.", error);
      document.querySelectorAll<HTMLElement>(".infinity-stage").forEach((stage) => { stage.hidden = true; });
    }
  }

  if (logo.complete && logo.naturalWidth) init();
  else logo.addEventListener("load", init, { once: true, signal });

  return () => {
    corte.abort();
    observadores.forEach((o) => o.disconnect());
    stop();
  };
}
