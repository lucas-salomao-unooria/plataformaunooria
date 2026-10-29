import type { Parecer } from "./evidencia";

/**
 * A forma do PARECER da perícia (E6), além do Zod: cartão sinalizado ⇒ com
 * motivo; não sinalizado ⇒ sem motivo (desmarcar desfaz o motivo na tela, e o
 * servidor não guarda um motivo solto). Puro — entra no `superRefine` do
 * contrato e no teste.
 */
export function problemasDoParecer(p: Parecer): string[] {
  const problemas: string[] = [];
  for (const cartao of ["A", "B"] as const) {
    const sinalizou = cartao === "A" ? p.sinalizouA : p.sinalizouB;
    const motivo = cartao === "A" ? p.motivoA : p.motivoB;
    if (sinalizou && motivo === null) problemas.push(`O cartão ${cartao} foi sinalizado sem motivo.`);
    if (!sinalizou && motivo !== null) problemas.push(`O cartão ${cartao} tem motivo sem estar sinalizado.`);
  }
  return problemas;
}

/** O mesmo parecer? (a idempotência do "Emitir parecer") */
export function mesmoParecer(a: Parecer, b: Parecer): boolean {
  return a.sinalizouA === b.sinalizouA && a.motivoA === b.motivoA && a.sinalizouB === b.sinalizouB && a.motivoB === b.motivoB;
}
