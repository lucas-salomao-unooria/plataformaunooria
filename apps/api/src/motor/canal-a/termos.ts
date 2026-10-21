import type { Nivel } from "../../evidencias/regras";
import { CLAUSULAS, type ClausulaId } from "./vocabulario";

/**
 * O 6b — OS TERMOS (EF08CO09). Regra PURA, testada sem banco.
 *
 * Desde 2026-10-21 (ADR-179, critério do PO validado com a pedagogia): os
 * termos aparecem na ENTRADA, como texto jurídico denso com "Aceitar e
 * continuar", e depois da revelação o estudante os revisita e só MARCA as
 * regras que explicam o que aconteceu no feed. Saíram o efeito de cada regra e
 * a pergunta da mudança (ADR-167).
 */

export interface RespostaDosTermos {
  marcadas: readonly ClausulaId[];
}

/**
 * Os ERROS: regra que explica e ficou sem marca, mais distração marcada (de 0
 * a 5). Marcar todas dá 2 erros; não marcar nenhuma, 3.
 *
 * A RÉGUA: 0 erros, atingiu; 1 ou 2, em processo; 3 ou mais, não atingiu.
 */
export function nivelDosTermos(r: RespostaDosTermos): { nivel: Nivel; erros: number } {
  const marcadas = new Set(r.marcadas);
  const erros = CLAUSULAS.filter((c) => marcadas.has(c.id) !== c.explica).length;
  if (erros === 0) return { nivel: "atingiu", erros };
  if (erros <= 2) return { nivel: "em_processo", erros };
  return { nivel: "nao_atingiu", erros };
}

/** A mesma regra marcada duas vezes é resposta malformada. */
export function marcadasSemRepeticao(r: RespostaDosTermos): boolean {
  return new Set(r.marcadas).size === r.marcadas.length;
}
