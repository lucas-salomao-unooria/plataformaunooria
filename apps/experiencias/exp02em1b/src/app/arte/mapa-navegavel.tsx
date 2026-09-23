import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pan e zoom sem dependência nova (a stack é pinada — TEMPLATE §3).
 *
 * A tela interna tem tamanho FIXO em px: é o retângulo em que os bairros são
 * posicionados por porcentagem. Sem tamanho fixo, mudar o zoom mudaria também a
 * proporção da cidade e os bairros se atropelariam.
 */
export const TELA = { largura: 1560, altura: 2080 };

/**
 * A cidade NUNCA cabe inteira na janela: a escala mínima é a que caberia
 * (contain) multiplicada por 1.35, então sempre sobra cidade fora do quadro.
 * É decisão de produto, não de layout — se desse para bater o olho e decidir,
 * investigar viraria opcional. O estudante tem que percorrer.
 *
 * Usar "cobrir" (max dos lados) em vez de "caber" (min) parece equivalente e
 * não é: numa janela larga e baixa, cobrir força um zoom absurdo e o mapa fica
 * inutilizável.
 */
const FOLGA_MINIMA = 1.35;
const MAX = 3;

export interface Camera {
  escala: number;
  x: number;
  y: number;
}

interface Janela {
  largura: number;
  altura: number;
}

function escalaMinima(janela: Janela): number {
  if (!janela.largura || !janela.altura) return 1;
  const caber = Math.min(janela.largura / TELA.largura, janela.altura / TELA.altura);
  return caber * FOLGA_MINIMA;
}

/**
 * Impede que o mapa "descole" da janela: quando a borda da cidade chega, o
 * arrasto para. Mapa que continua deslizando no vazio parece quebrado.
 */
function limitar(camera: Camera, janela: Janela): Camera {
  const largura = TELA.largura * camera.escala;
  const altura = TELA.altura * camera.escala;
  const maxX = Math.max(0, (largura - janela.largura) / 2);
  const maxY = Math.max(0, (altura - janela.altura) / 2);
  return {
    escala: camera.escala,
    x: Math.min(maxX, Math.max(-maxX, camera.x)),
    y: Math.min(maxY, Math.max(-maxY, camera.y)),
  };
}

export function useCamera() {
  const janela = useRef<Janela>({ largura: 0, altura: 0 });
  const [camera, definir] = useState<Camera>({ escala: 1, x: 0, y: 0 });

  const aplicar = useCallback((proxima: Camera) => {
    const min = escalaMinima(janela.current);
    definir(
      limitar({ ...proxima, escala: Math.min(MAX, Math.max(min, proxima.escala)) }, janela.current),
    );
  }, []);

  const mover = useCallback(
    (atualiza: (c: Camera) => Camera) =>
      definir((c) => {
        const min = escalaMinima(janela.current);
        const proxima = atualiza(c);
        return limitar(
          { ...proxima, escala: Math.min(MAX, Math.max(min, proxima.escala)) },
          janela.current,
        );
      }),
    [],
  );

  const aproximar = useCallback(
    (fator: number) => mover((c) => ({ ...c, escala: c.escala * fator })),
    [mover],
  );

  /** Volta ao enquadramento mais aberto possível — que ainda não mostra tudo. */
  const enquadrar = useCallback(() => {
    aplicar({ escala: escalaMinima(janela.current), x: 0, y: 0 });
  }, [aplicar]);

  /** Centraliza um ponto do mapa (em % da tela interna) na janela visível. */
  const focar = useCallback(
    (leftPct: number, topPct: number) => {
      mover((c) => ({
        escala: c.escala,
        x: (0.5 - leftPct / 100) * TELA.largura * c.escala,
        y: (0.5 - topPct / 100) * TELA.altura * c.escala,
      }));
    },
    [mover],
  );

  const medir = useCallback(
    (largura: number, altura: number) => {
      const primeira = janela.current.largura === 0;
      const mudouMuito = Math.abs(largura - janela.current.largura) > 40;
      janela.current = { largura, altura };
      // Reenquadra na primeira medida e quando a coluna muda de tamanho; fora
      // disso o zoom que o estudante deu é dele.
      if (primeira || mudouMuito) enquadrar();
      else mover((c) => c);
    },
    [enquadrar, mover],
  );

  return { camera, mover, aproximar, enquadrar, focar, medir };
}

export function Navegavel({
  camera,
  mover,
  medir,
  children,
}: {
  camera: Camera;
  mover: (atualiza: (c: Camera) => Camera) => void;
  medir: (largura: number, altura: number) => void;
  children: React.ReactNode;
}) {
  const janela = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  // Wheel com preventDefault precisa de listener NÃO passivo: no React o
  // onWheel é passivo, o preventDefault é ignorado e a página rola junto.
  useEffect(() => {
    const el = janela.current;
    if (!el) return;

    function aoRolar(evento: WheelEvent) {
      evento.preventDefault();
      const fator = evento.deltaY > 0 ? 0.94 : 1.06;
      mover((c) => ({ ...c, escala: c.escala * fator }));
    }

    el.addEventListener('wheel', aoRolar, { passive: false });
    return () => el.removeEventListener('wheel', aoRolar);
  }, [mover]);

  useEffect(() => {
    const el = janela.current;
    if (!el) return;
    const medirAgora = () => medir(el.clientWidth, el.clientHeight);
    medirAgora();
    const observador = new ResizeObserver(medirAgora);
    observador.observe(el);
    return () => observador.disconnect();
  }, [medir]);

  return (
    <div
      ref={janela}
      onPointerDown={(e) => {
        // Só o fundo arrasta: clicar num cartão é seleção, não pan.
        if ((e.target as HTMLElement).closest('[data-nao-arrasta]')) return;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        arrasto.current = { x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y };
        setArrastando(true);
      }}
      onPointerMove={(e) => {
        if (!arrasto.current) return;
        const d = arrasto.current;
        mover((c) => ({ ...c, x: d.camX + (e.clientX - d.x), y: d.camY + (e.clientY - d.y) }));
      }}
      onPointerUp={() => {
        arrasto.current = null;
        setArrastando(false);
      }}
      onPointerLeave={() => {
        arrasto.current = null;
        setArrastando(false);
      }}
      className={`relative h-full w-full overflow-hidden rounded-gpt-2xl border border-gpt-borda bg-gpt-superficie ${
        arrastando ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <div
        style={{
          width: TELA.largura,
          height: TELA.altura,
          transform: `translate(-50%, -50%) translate(${camera.x}px, ${camera.y}px) scale(${camera.escala})`,
        }}
        className="absolute left-1/2 top-1/2 origin-center"
      >
        {children}
      </div>
    </div>
  );
}
