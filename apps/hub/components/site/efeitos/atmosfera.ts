/**
 * Poeira ambiente do site público — porte de `atmosphere.js` do bundle original.
 *
 * O CORPO É LITERAL, de propósito. Estes cinco módulos de `efeitos/` são
 * animação de canvas auto-contida: não leem sessão, não chamam a api e não
 * conhecem o DS. Renomear variável ou "arrumar" o cálculo aqui é risco sem
 * retorno — o que se ganharia era estilo, e o que se perde é a única prova de
 * que a tela continua a mesma do material aprovado.
 *
 * O que MUDOU em relação ao original, e só isto:
 *  - a IIFE virou função exportada que devolve o cancelamento;
 *  - todo listener nasce preso a um `AbortController`, porque no hub esta
 *    página desmonta (quem entra vai para `/login`) e um `requestAnimationFrame`
 *    pendurado num canvas que já saiu do DOM é vazamento.
 */
export function iniciarAtmosfera(): () => void {
  const canvas = document.getElementById("ambient-dust") as HTMLCanvasElement | null;
  if (!canvas) return () => {};
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => {};

  const corte = new AbortController();
  const { signal } = corte;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const seed = (n: number) => {
    const v = Math.sin(n * 127.1 + 41.7) * 43758.5453;
    return v - Math.floor(v);
  };
  let width = 0,
    height = 0,
    pending = false;

  function draw() {
    pending = false;
    if (document.hidden) return;
    ctx!.clearRect(0, 0, width, height);
    const count = width < 700 ? 65 : 160;
    const offset = reduced.matches ? 0 : scrollY * 0.035;
    for (let i = 0; i < count; i++) {
      const x = seed(i + 1) * width;
      const y = (((seed(i + 91) * height - offset * (0.4 + seed(i + 53))) % height) + height) % height;
      const radius = 0.35 + seed(i + 341) * 0.7;
      ctx!.fillStyle = i % 3 ? "rgba(127,165,226,.45)" : "rgba(139,133,172,.5)";
      ctx!.beginPath();
      ctx!.arc(x, y, radius, 0, Math.PI * 2);
      ctx!.fill();
    }
  }
  function resize() {
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas!.width = Math.round(width * ratio);
    canvas!.height = Math.round(height * ratio);
    ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function schedule() {
    if (pending || reduced.matches || document.hidden) return;
    pending = true;
    requestAnimationFrame(draw);
  }

  addEventListener("resize", resize, { passive: true, signal });
  addEventListener("scroll", schedule, { passive: true, signal });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) draw(); }, { signal });
  reduced.addEventListener("change", draw, { signal });
  resize();

  return () => corte.abort();
}
