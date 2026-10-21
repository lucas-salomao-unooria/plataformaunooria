import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A ociosidade com a cédula ABERTA (E3-SIS-01 e a melhoria 8).
 *
 * - `parado` vira `true` depois de `segundos` sem toque, tecla nem rolagem —
 *   enquanto `ativo`. Qualquer gesto apaga e recomeça a contagem. É o aviso da
 *   comissão no topo da cédula (60 s).
 * - `segundosSemToque()` diz há quanto tempo não há gesto: é o que o batimento
 *   de 15 s leva ao servidor, que acende o ícone de ocioso no painel do
 *   professor.
 */
export function useOciosidade(ativo: boolean, segundos: number): { parado: boolean; segundosSemToque: () => number } {
  const [parado, setParado] = useState(false);
  const ultimoGesto = useRef(Date.now());

  useEffect(() => {
    if (!ativo) {
      setParado(false);
      return;
    }
    ultimoGesto.current = Date.now();
    let relogio = window.setTimeout(() => setParado(true), segundos * 1000);
    const mexeu = () => {
      ultimoGesto.current = Date.now();
      setParado(false);
      window.clearTimeout(relogio);
      relogio = window.setTimeout(() => setParado(true), segundos * 1000);
    };
    const eventos = ["pointerdown", "keydown", "wheel", "touchmove"] as const;
    for (const e of eventos) window.addEventListener(e, mexeu, { passive: true, capture: true });
    return () => {
      window.clearTimeout(relogio);
      for (const e of eventos) window.removeEventListener(e, mexeu, { capture: true });
    };
  }, [ativo, segundos]);

  const segundosSemToque = useCallback(() => Math.max(0, Math.floor((Date.now() - ultimoGesto.current) / 1000)), []);
  return { parado, segundosSemToque };
}
