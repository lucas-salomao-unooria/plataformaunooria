import { useEffect, useState } from "react";
import { IconUnv } from "@edu/ui/ds-unoovista";
import { TEXTOS } from "../lib/textos";

/** Cada marco fica 0,4 s: a passagem inteira em cerca de 1,2 s (E3-SIS-01). */
const MARCO_MS = 400;

function semMovimento(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * E3-SIS-01 — O SALTO DO RELÓGIO, 16h00 → 23h45 → 02h30, logo depois do
 * Publicar. É a passagem do tempo que o estudante SENTE antes de ver o feed da
 * madrugada; avança sozinho. Com `prefers-reduced-motion`, corta direto para o
 * último marco. Toca uma vez por aba (um F5 vai direto ao feed).
 *
 * O círculo do relógio é o glifo `activity` (a ligadura `history`): a seção
 * não publica relógio.
 */
export function Relogio({ onFim }: { onFim: () => void }) {
  const ultimo = TEXTOS.relogio.length - 1;
  const [marco, setMarco] = useState(() => (semMovimento() ? ultimo : 0));
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (marco < ultimo) setMarco(marco + 1);
      else onFim();
    }, MARCO_MS);
    return () => window.clearTimeout(id);
  }, [marco, ultimo, onFim]);

  return (
    <main className="relogio" data-unv-theme={marco === 0 ? "light" : "dark"}>
      <span className="relogio__circulo">
        <IconUnv name="activity" size="lg" />
      </span>
      <ol className="relogio__marcos" aria-live="polite">
        {TEXTOS.relogio.slice(0, marco + 1).map((m, i) => (
          <li key={m} className={i === ultimo ? "relogio__marco relogio__marco--pico" : "relogio__marco"}>
            {m}
          </li>
        ))}
      </ol>
    </main>
  );
}
