/**
 * A luz que percorre a estrada das progressões — porte de `progressions.js`.
 * Corpo literal pelas razões do cabeçalho de `atmosfera.ts`.
 *
 * A arte (`.webp`) não é tocada: o SVG entra POR CIMA dela, e os três traçados
 * abaixo são a estrada desenhada na ilustração, amostrada ponto a ponto.
 */
const NS = "http://www.w3.org/2000/svg";

const ESTRADAS: Record<string, string> = {
  initial:
    "M 450 447 C 594 459 561 499 433 522 C 287 551 302 680 424 711 C 611 755 498 764 405 788 C 278 822 315 918 427 949 C 608 987 495 1006 402 1035 C 282 1070 321 1172 434 1199 C 600 1234 495 1250 402 1280 C 288 1317 318 1409 435 1442",
  final:
    "M 449 448 C 603 480 514 504 413 530 C 295 561 311 692 427 719 C 594 752 494 760 403 786 C 286 820 321 907 428 930 C 603 960 494 984 402 1008 C 278 1043 321 1139 432 1158 C 601 1190 485 1209 402 1236 C 291 1272 320 1371 431 1395",
  high:
    "M 403 332 C 562 382 424 390 475 435 C 623 508 474 544 408 564 C 267 604 293 704 421 730 C 620 769 434 789 376 815 C 271 869 320 950 435 977 C 608 1018 440 1046 373 1076 C 266 1124 328 1198 438 1214 C 619 1254 434 1269 373 1310 C 271 1364 345 1421 497 1448",
};

type Cena = {
  art: Element;
  glow: SVGPathElement;
  road: SVGPathElement;
  halo: SVGCircleElement;
  head: SVGCircleElement;
  sparks: SVGCircleElement[];
  length: number;
  samples: Array<{ t: number; y: number }>;
  visible: boolean;
  progress: number;
};

function svgNode<T extends SVGElement>(tag: string, attributes: Record<string, string>): T {
  const node = document.createElementNS(NS, tag) as T;
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

export function iniciarProgressoes(): () => void {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const corte = new AbortController();
  const { signal } = corte;

  const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-progression]"))
    .map((figure): Cena | null => {
      const art = figure.querySelector(".progression-art");
      const d = ESTRADAS[figure.dataset.progression ?? ""];
      if (!art || !d) return null;
      /* O SVG é montado aqui e não no JSX: ele é ARTEFATO da animação (traçado,
         faíscas, halo), não conteúdo da página. Deixá-lo na marcação faria o
         React renderizar no servidor um desenho que só existe com movimento
         ligado — e que o `prefers-reduced-motion` esconde. */
      const svg = svgNode<SVGSVGElement>("svg", {
        viewBox: "0 0 935 1683",
        class: "progression-light",
        "aria-hidden": "true",
        focusable: "false",
      });
      const glow = svgNode<SVGPathElement>("path", { d, class: "progression-glow", pathLength: "1" });
      const road = svgNode<SVGPathElement>("path", { d, class: "progression-road", pathLength: "1" });
      const halo = svgNode<SVGCircleElement>("circle", { r: "13", class: "progression-halo", opacity: "0" });
      const head = svgNode<SVGCircleElement>("circle", { r: "4.5", class: "progression-head", opacity: "0" });
      const sparks = Array.from({ length: 7 }, (_, i) =>
        svgNode<SVGCircleElement>("circle", { r: i % 2 ? "2.5" : "1.8", class: "progression-spark", opacity: "0" }),
      );
      svg.append(glow, road, ...sparks, halo, head);
      art.append(svg);
      const length = road.getTotalLength();
      // Mapeia a altura rolada no comprimento da rota: a luz acompanha o trecho lido.
      const samples = Array.from({ length: 181 }, (_, i) => ({ t: i / 180, y: road.getPointAtLength((length * i) / 180).y }));
      return { art, glow, road, halo, head, sparks, length, samples, visible: false, progress: 0 };
    })
    .filter((cena): cena is Cena => cena !== null);
  if (!scenes.length) return () => {};

  let frame = 0;
  let last = 0;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  function progressAtY(scene: Cena, y: number) {
    const samples = scene.samples;
    if (y <= samples[0]!.y) return 0;
    for (let i = 1; i < samples.length; i++) {
      if (y <= samples[i]!.y) {
        const before = samples[i - 1]!;
        return before.t + (samples[i]!.t - before.t) * clamp((y - before.y) / (samples[i]!.y - before.y || 1));
      }
    }
    return 1;
  }
  function place(node: SVGCircleElement, point: DOMPoint) {
    node.setAttribute("cx", point.x.toFixed(2));
    node.setAttribute("cy", point.y.toFixed(2));
  }
  function canAnimate() {
    return !motion.matches && !document.hidden && scenes.some((s) => s.visible);
  }
  function tick(now: number) {
    frame = 0;
    if (!canAnimate()) {
      last = 0;
      return;
    }
    const delta = last ? Math.min(50, now - last) : 16;
    last = now;
    for (const s of scenes) {
      if (!s.visible) continue;
      const rect = s.art.getBoundingClientRect();
      if (!rect.height) continue;
      const y = ((innerHeight * 0.64 - rect.top) * 1683) / rect.height;
      const target = progressAtY(s, y);
      s.progress += (target - s.progress) * (1 - Math.exp(-delta / 110));
      if (Math.abs(target - s.progress) < 0.0002) s.progress = target;
      s.road.style.strokeDashoffset = s.glow.style.strokeDashoffset = String(1 - s.progress);
      const point = s.road.getPointAtLength(s.length * s.progress);
      place(s.head, point);
      place(s.halo, point);
      s.head.style.opacity = s.progress > 0.001 && s.progress < 0.999 ? "1" : "0";
      s.halo.style.opacity = s.progress > 0.001 && s.progress < 0.999 ? ".55" : "0";
      s.halo.setAttribute("r", String(12 + Math.sin(now / 520) * 3));
      // Uma corrente discreta mantém viva a parte já revelada entre rolagens.
      s.sparks.forEach((spark, i) => {
        const t = (now / 20000 + i / s.sparks.length) % 1;
        const visible = t < s.progress && s.progress > 0.01;
        spark.style.opacity = visible ? String(0.25 + 0.4 * Math.sin(t * Math.PI)) : "0";
        if (visible) place(spark, s.road.getPointAtLength(s.length * t));
      });
    }
    frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (canAnimate() && !frame) frame = requestAnimationFrame(tick);
  }

  let observador: IntersectionObserver | null = null;
  if ("IntersectionObserver" in window) {
    observador = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const scene = scenes.find((s) => s.art === entry.target);
          if (scene) scene.visible = entry.isIntersecting;
        });
        wake();
      },
      { rootMargin: "80px 0px", threshold: 0 },
    );
    scenes.forEach((s) => observador!.observe(s.art));
  } else {
    scenes.forEach((s) => { s.visible = true; });
    wake();
  }
  document.addEventListener("visibilitychange", wake, { signal });
  motion.addEventListener("change", wake, { signal });
  addEventListener("pageshow", wake, { signal });

  return () => {
    corte.abort();
    observador?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    // O SVG foi anexado à arte por este módulo: quem o criou o remove, senão
    // remontar a página empilharia uma estrada por montagem.
    scenes.forEach((s) => s.road.parentElement?.remove());
  };
}
