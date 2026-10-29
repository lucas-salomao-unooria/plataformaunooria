import type { Nivel } from "../../evidencias/regras";
import { TENTATIVAS_PARA_ATINGIR_A_ROTINA } from "../vocabulario";
import { acertos, uniforme, type CarimbosDaEtapa } from "./carimbos";

/**
 * Os MARCADORES da ficha (`evidencias/fichas/exp03ef1b.ts`, versão 1, só ação —
 * spec §2) e as réguas que os alimentam. Os ids são contrato com a ficha: a
 * missão calcula o nível na transação da tarefa e o entrega pela porta
 * `marcar`.
 *
 * Quem não faz a tarefa não tem marca dela — "Não avaliado", a AUSÊNCIA de
 * linha (E14) —, nunca "não atingiu". Por isso as réguas devolvem `null`
 * quando a tarefa não aconteceu.
 */

/** EF15CO08 (a principal): o filtro e a inspeção da ficha. Marca no `POST ficha`. */
export const MARCADOR_DA_INSPECAO = "inspecao";
/** EF03CO01: os seis carimbos. Marca no `POST carimbos` da E6 (com a E4 já gravada). */
export const MARCADOR_DOS_CARIMBOS = "carimbos";
/** EF03CO02: a rotina. Marca no `POST rotina` válido. */
export const MARCADOR_DA_ROTINA = "rotina";
/** EF03CO03: o reparo. Marca no `POST reparo`. */
export const MARCADOR_DO_REPARO = "reparo";
/** EF15CO01: a escolha travada confrontada com o reparo. Marca no `POST reparo`. */
export const MARCADOR_DA_PREVISAO = "previsao";

/** A habilidade da BNCC de cada marcador — o que a ficha declara. */
export const HABILIDADE_DO_MARCADOR = {
  [MARCADOR_DA_INSPECAO]: "EF15CO08",
  [MARCADOR_DOS_CARIMBOS]: "EF03CO01",
  [MARCADOR_DA_ROTINA]: "EF03CO02",
  [MARCADOR_DO_REPARO]: "EF03CO03",
  [MARCADOR_DA_PREVISAO]: "EF15CO01",
} as const;

/**
 * EF15CO08: atingiu = a busca CERTA de primeira (`filtro_tentativas` = 0) E a
 * ficha aberta sem o pulso de 15 s; em processo = errou o filtro antes OU
 * precisou do pulso. Sem abrir a ficha não há marca (a rota que marca é a da
 * ficha aberta).
 */
export function nivelDaInspecao(i: { fichaAberta: boolean; filtroTentativas: number; dicaUsada: boolean }): Nivel | null {
  if (!i.fichaAberta) return null;
  return i.filtroTentativas === 0 && !i.dicaUsada ? "atingiu" : "em_processo";
}

/**
 * EF03CO01: os seis carimbos.
 *
 * - não atingiu = carimbo UNIFORME (os três de uma etapa iguais) na E4 ou na E6;
 * - atingiu = K3 ✔ e K5 ? e ao menos 5 dos 6 certos;
 * - em processo = os demais.
 *
 * A UNIFORMIDADE VENCE (decisão da fundação, a spec é omissa na precedência):
 * E4 = ✔✔✔ com a E6 perfeita somaria 5 de 6 com K3 ✔ e K5 ?, mas carimbar
 * tudo igual é justamente o padrão que a régua quer separar.
 * Sem os dois conjuntos, não há marca.
 */
export function nivelDosCarimbos(e4: CarimbosDaEtapa | null, e6: CarimbosDaEtapa | null): Nivel | null {
  if (!e4 || !e6) return null;
  if (uniforme("e4", e4) || uniforme("e6", e6)) return "nao_atingiu";
  const total = acertos("e4", e4) + acertos("e6", e6);
  if (e4.k3 === "v" && e6.k5 === "duvida" && total >= 5) return "atingiu";
  return "em_processo";
}

/**
 * EF03CO02: atingiu = rotina válida com até DUAS tentativas (contando a
 * válida); em processo = válida com mais. Sem rotina válida, não há marca.
 */
export function nivelDaRotina(r: { valida: boolean; tentativas: number }): Nivel | null {
  if (!r.valida) return null;
  return r.tentativas <= TENTATIVAS_PARA_ATINGIR_A_ROTINA ? "atingiu" : "em_processo";
}

/** EF03CO03: atingiu = Pátio no campo Onde; em processo = não. */
export function nivelDoReparo(valido: boolean): Nivel {
  return valido ? "atingiu" : "em_processo";
}

/**
 * EF15CO01: a escolha travada (a previsão) confrontada com a correção. Atingiu =
 * previsão travada + reparo válido; em processo = previsão travada + reparo
 * inválido; sem previsão travada, sem marca. (Na prática repete a EF03CO03 —
 * pendência levada ao PO, spec §2.)
 */
export function nivelDaPrevisao(p: { previsaoTravada: boolean; reparoValido: boolean }): Nivel | null {
  if (!p.previsaoTravada) return null;
  return p.reparoValido ? "atingiu" : "em_processo";
}
