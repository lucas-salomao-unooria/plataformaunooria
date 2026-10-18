import type { Nivel } from "../../evidencias/regras";
import { ENCAMINHAMENTOS, type Tom, type Veracidade } from "../catalogo";

/**
 * A RÉGUA DA EF05CO08 (E14), lida da seleção do Mural — a régua v2, de
 * 2026-09-26 (ADR-120), que substitui a de 25/09:
 *
 *   3 verdadeiras                 → atingiu
 *   2 verdadeiras e 1 falsa       → em_processo (emocional ou neutra, tanto faz)
 *   1 verdadeira ou nenhuma       → nao_atingiu
 *
 * A habilidade é DISTINGUIR o confiável do não confiável: quem repassou uma
 * mentira ainda não distingue com constância, seja ela séria ou alarmada. O
 * TIPO da falsa continua importando, mas como diagnóstico do professor — a
 * folha mostra o quadrante de cada escolhida e o Termômetro conta a falsa
 * neutra —, não como nível. A régua anterior dava "atingiu" a quem repassava
 * uma falsa emocional, e por isso 16 das 56 combinações atingiam: 29% de
 * acerto por sorteio. Nesta são 4 (7%).
 *
 * Função pura sobre os EIXOS das três escolhidas (o gabarito é do servidor e
 * é ele quem chama). `tests/quem-mandou-isso-regras.spec.ts` confere as 56
 * combinações de 3 entre 8 contra uma tabela escrita à parte.
 */
export function nivelCO08(escolhidas: readonly { veracidade: Veracidade; tom: Tom }[]): Nivel {
  if (escolhidas.length !== ENCAMINHAMENTOS) {
    throw new Error(`a régua da EF05CO08 lê exatamente ${ENCAMINHAMENTOS} mensagens`);
  }
  const falsas = escolhidas.filter((m) => m.veracidade === "falsa").length;
  if (falsas === 0) return "atingiu";
  if (falsas === 1) return "em_processo";
  return "nao_atingiu";
}

/** Os ids dos marcadores da ficha (`evidencias/fichas/exp05ef1b.ts`) que ESTA missão marca. */
export const MARCADOR_DA_SELECAO = "selecao-do-mural";
/** EF05CO03 — `regras/operacoes.ts#nivelCO03`. */
export const MARCADOR_DO_CARTAO = "cartao-de-frases";
/** EF05CO04 — `regras/regra.ts#nivelCO04`. */
export const MARCADOR_DA_REGRA = "regra-do-tio";
