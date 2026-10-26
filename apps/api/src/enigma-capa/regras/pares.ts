import { CARTAS_DOS_PARES } from "../conteudo";

/**
 * E5, os PARES: "Junte duas fotos da mesma atividade." O par certo é o da
 * mesma ATIVIDADE (a+c, b+d); o distrator é a COR da camiseta (a+d, b+c).
 * Não bloqueia e não entra na régua (decisão da spec, ADR-184): vai ao painel,
 * junto com o motivo que a criança escolheu ("A atividade" / "A cor da roupa").
 *
 * `null` = carta desconhecida ou a mesma carta duas vezes.
 */
export function parCorreto(cartas: readonly [string, string] | readonly string[]): boolean | null {
  if (cartas.length !== 2 || cartas[0] === cartas[1]) return null;
  const [a, b] = cartas.map((id) => CARTAS_DOS_PARES.find((c) => c.id === id));
  if (!a || !b) return null;
  return a.atividade === b.atividade;
}
