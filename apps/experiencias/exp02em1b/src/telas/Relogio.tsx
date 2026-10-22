import { useEffect, useState } from "react";
import { IconUnv } from "@edu/ui/ds-unoovista";
import { TEXTOS } from "../lib/textos";

/** Cada marco fica ~0,6 s: a passagem inteira em cerca de 1,8 s (E4-ALU-01), sem pular. */
const MARCO_MS = 600;

/**
 * O SALTO DO RELÓGIO — 16h00 → 23h45 → 02h30 — logo depois do Publicar. É a
 * passagem do tempo que a criança SENTE antes de ver o feed da madrugada; o
 * horário final é cravado: 02h30. Toca uma vez por aba (um F5 vai direto ao feed).
 */
export function Relogio({ onFim }: { onFim: () => void }) {
  const [marco, setMarco] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (marco < TEXTOS.relogio.length - 1) setMarco(marco + 1);
      else onFim();
    }, MARCO_MS);
    return () => window.clearTimeout(id);
  }, [marco, onFim]);

  return (
    <main className="relogio" data-unv-theme={marco === 0 ? "light" : "dark"} aria-live="polite">
      <IconUnv name="activity" size="lg" />
      <p className="relogio__marco">{TEXTOS.relogio[marco]}</p>
    </main>
  );
}
