import { useEffect, useState } from "react";

/**
 * `true` depois de `segundos` sem toque, tecla nem rolagem — enquanto `ativo`.
 * Qualquer gesto apaga e recomeça a contagem. É o relógio do aviso da comissão
 * com a cédula pronta (`e3.feedback.inatividade_aviso`, 60 s).
 */
export function useInatividade(ativo: boolean, segundos: number): boolean {
  const [parado, setParado] = useState(false);

  useEffect(() => {
    if (!ativo) {
      setParado(false);
      return;
    }
    let relogio = window.setTimeout(() => setParado(true), segundos * 1000);
    const mexeu = () => {
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

  return parado;
}
