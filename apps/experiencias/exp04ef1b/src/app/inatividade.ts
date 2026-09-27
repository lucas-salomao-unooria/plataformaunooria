import { useEffect } from "react";
import { SEGUNDOS_DE_INATIVIDADE, type EtapaDaMissao } from "../lib/regras";
import { telemetria } from "../lib/telemetria";

/**
 * EVT-U04 — noventa segundos sem toque nem tecla numa etapa em que a criança
 * AGE. Um registro por período de silêncio: o próximo toque zera o relógio, e
 * ele só volta a registrar depois de outros noventa.
 *
 * Desligado nas esperas do professor (`ativo = false`): ali ficar parada é o
 * esperado, e o evento viraria ruído — trinta registros por sala a cada
 * mediação.
 */
export function useInatividade(etapa: EtapaDaMissao, ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    let relogio = 0;
    const armar = () => {
      window.clearTimeout(relogio);
      relogio = window.setTimeout(() => telemetria.ficouInativa(etapa, SEGUNDOS_DE_INATIVIDADE), SEGUNDOS_DE_INATIVIDADE * 1000);
    };
    armar();
    window.addEventListener("pointerdown", armar);
    window.addEventListener("keydown", armar);
    return () => {
      window.clearTimeout(relogio);
      window.removeEventListener("pointerdown", armar);
      window.removeEventListener("keydown", armar);
    };
  }, [etapa, ativo]);
}
