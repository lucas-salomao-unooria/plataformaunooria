import { CARTOES_DA_MISSAO } from "../conteudo";
import {
  CARTOES_DA_INSPECAO,
  CARTOES_DO_CASO,
  type Carimbo,
  type Cartao,
  type EtapaDosCarimbos,
} from "../vocabulario";

/**
 * Os CARIMBOS (E4-ALU-02 e E6-ALU-01) — o gabarito e a uniformidade, puros.
 *
 * Gabarito: K1 ✔, K2 ✖, K3 ✔ (a foto mostra o pátio; a ficha não diz; "a
 * ficha NÃO diz pátio" é verdade) e K4 ✔, K5 ?, K6 ✖ (o mesmo Festival; o dia
 * não dá para saber; a ficha não diz sábado). Ele mora em `conteudo.ts` e só
 * o servidor e o material do professor o leem.
 *
 * Nenhum retorno de acerto desce para a criança no momento: a correção vira
 * nível (EF03CO01) e o alerta de UNIFORMIDADE do painel.
 */

export type CarimbosDaEtapa = Partial<Record<Cartao, Carimbo>>;

export const GABARITO: Readonly<Record<Cartao, Carimbo>> = Object.fromEntries(
  CARTOES_DA_MISSAO.map((c) => [c.id, c.certo]),
) as Record<Cartao, Carimbo>;

export const CARTOES_DA_ETAPA: Readonly<Record<EtapaDosCarimbos, readonly Cartao[]>> = {
  e4: CARTOES_DA_INSPECAO,
  e6: CARTOES_DO_CASO,
};

/** Os três cartões da etapa estão carimbados? */
export function completos(etapa: EtapaDosCarimbos, carimbos: CarimbosDaEtapa): boolean {
  return CARTOES_DA_ETAPA[etapa].every((k) => carimbos[k] !== undefined);
}

/** Quantos carimbos da etapa batem com o gabarito. */
export function acertos(etapa: EtapaDosCarimbos, carimbos: CarimbosDaEtapa): number {
  return CARTOES_DA_ETAPA[etapa].filter((k) => carimbos[k] === GABARITO[k]).length;
}

/** UNIFORME: os três cartões da etapa com o MESMO carimbo — o padrão de quem não discrimina. */
export function uniforme(etapa: EtapaDosCarimbos, carimbos: CarimbosDaEtapa): boolean {
  if (!completos(etapa, carimbos)) return false;
  const valores = CARTOES_DA_ETAPA[etapa].map((k) => carimbos[k]);
  return valores.every((v) => v === valores[0]);
}
