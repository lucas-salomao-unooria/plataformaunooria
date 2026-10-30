import { ButtonUjn, TagUjn } from "@edu/ui/ds-unoojornal";
import type { ReactNode } from "react";

/**
 * Os botões e selos do JORNAL (Avançar da galeria, Buscar, Inspecionar Ficha,
 * Continuar do desfecho). O `ButtonUjn` para em `lg` = 52px; a
 * classe `.alvo-64` leva o alvo a 64px (a compensação está em `globals.css`).
 */
export function AcaoDoJornal({
  children,
  variante = "primary",
  desabilitado = false,
  pulsando = false,
  icone,
  aoTocar,
  rotuloAcessivel,
}: {
  children: ReactNode;
  variante?: "primary" | "secondary";
  desabilitado?: boolean;
  pulsando?: boolean;
  icone?: "search" | "arrowForward" | "edition" | "gallery";
  aoTocar: () => void;
  rotuloAcessivel?: string;
}) {
  return (
    <ButtonUjn
      variant={variante}
      size="lg"
      disabled={desabilitado}
      iconStart={icone === "arrowForward" ? undefined : icone}
      iconEnd={icone === "arrowForward" ? "arrowForward" : undefined}
      onClick={aoTocar}
      aria-label={rotuloAcessivel}
      className={`alvo-64${pulsando ? " pulsa" : ""}`}
    >
      {children}
    </ButtonUjn>
  );
}

/** Um selo do jornal ("Mesma feira", "Recuperada", "2 notícias no pátio"). */
export function SeloDoJornal({ children, forte = false }: { children: ReactNode; forte?: boolean }) {
  return (
    <TagUjn variant={forte ? "accent" : "neutral"} size="md">
      {children}
    </TagUjn>
  );
}
