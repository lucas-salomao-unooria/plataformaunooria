import { MAX_FRASES_DA_LEGENDA } from "../vocabulario";

/**
 * O trecho GRIFADO da justificativa — puro, e com um espelho declarado na
 * experiência (`lib/regras.ts#frasesDaLegenda`), que o `espelho.test.ts` dela
 * compara: a tela mostra as frases para a criança tocar, e o servidor confere
 * que o índice tocado existe na legenda do estande escolhido.
 *
 * A frase termina em `.`, `!` ou `?` seguidos de espaço (ou no fim do texto).
 * Uma legenda sem pontuação é UMA frase. Frase vazia não conta, e o teto
 * (`MAX_FRASES_DA_LEGENDA`) corta a cauda de uma legenda torta — a homologação
 * já limita a legenda a 420 caracteres.
 */
export function frasesDaLegenda(legenda: string): string[] {
  return legenda
    .split(/(?<=[.!?])\s+/u)
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    .slice(0, MAX_FRASES_DA_LEGENDA);
}

/** O índice aponta para uma frase que existe na legenda? */
export function trechoValido(legenda: string, trecho: number): boolean {
  return Number.isInteger(trecho) && trecho >= 0 && trecho < frasesDaLegenda(legenda).length;
}
