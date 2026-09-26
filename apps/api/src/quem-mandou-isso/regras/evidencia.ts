import type { Nivel } from "../../evidencias/regras";
import { ENCAMINHAMENTOS, type Tom, type Veracidade } from "../catalogo";

/**
 * A RÉGUA DA EF05CO08 (E14), lida da seleção do Mural — a regra do Lucas de
 * 2026-09-25, que não se reabre:
 *
 *   3 verdadeiras                          → atingiu
 *   2 verdadeiras, e a falsa é EMOCIONAL   → atingiu
 *   2 verdadeiras, e a falsa é NEUTRA      → em_processo
 *   1 verdadeira ou nenhuma                → nao_atingiu
 *
 * Por que a falsa neutra pesa mais que a emocional: é a falsa NEUTRA — a de
 * embalagem séria, oficial, calma — que a missão existe para desmontar. Cair
 * no boato em caixa alta é o engano que a criança já sabe que existe; cair no
 * ofício falso é o engano que ela não viu.
 *
 * Função pura sobre os EIXOS das três escolhidas (o gabarito é do servidor e
 * é ele quem chama). `tests/quem-mandou-isso-regras.spec.ts` confere as 56
 * combinações de 3 entre 8 contra uma tabela escrita à parte.
 */
export function nivelCO08(escolhidas: readonly { veracidade: Veracidade; tom: Tom }[]): Nivel {
  if (escolhidas.length !== ENCAMINHAMENTOS) {
    throw new Error(`a régua da EF05CO08 lê exatamente ${ENCAMINHAMENTOS} mensagens`);
  }
  const falsas = escolhidas.filter((m) => m.veracidade === "falsa");
  if (falsas.length === 0) return "atingiu";
  if (falsas.length === 1) return falsas[0]?.tom === "emocional" ? "atingiu" : "em_processo";
  return "nao_atingiu";
}

/** Os ids dos marcadores da ficha (`evidencias/fichas/exp05ef1b.ts`) que ESTA missão marca. */
export const MARCADOR_DA_SELECAO = "selecao-do-mural";
