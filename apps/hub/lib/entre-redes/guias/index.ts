import { GUIA_EXP_01 } from "./exp-01-instanooria";
import { GUIA_EXP_02 } from "./exp-02-unootube";
import { GUIA_EXP_03 } from "./exp-03-unoogpt";
import { GUIA_EXP_04 } from "./exp-04-o-que-a-foto-conta";
import { GUIA_EXP_06 } from "./exp-06-rastro-boato";
import { GUIA_EXP_07 } from "./exp-07-o-eco-no-grupo";
import { GUIA_EXP_08 } from "./exp-08-manifesto-ia";
import { GUIA_EXP_70 } from "./exp-70-vila-do-lume";
import type { GuiaDaAula } from "./tipos";

/**
 * O registro dos guias, indexado por `expId`.
 *
 * Mora aqui e não em `catalogo.ts` de propósito: o catálogo é a GRADE (que
 * missões existem, em que ano, com que ficha) e é lido por meia dúzia de telas.
 * O guia é material de aula, pesado, e só a rota do guia o carrega.
 *
 * Missão publicada SEM guia é permitida pelo tipo e proibida pelo teste
 * (`index.test.ts`): quem publica uma missão nova precisa escrever o guia dela
 * no mesmo trabalho, e a lista de exceções abaixo é o lugar de dizer, por
 * escrito, que aquela missão não terá um.
 */
const GUIAS: ReadonlyMap<string, GuiaDaAula> = new Map(
  [
    GUIA_EXP_01,
    GUIA_EXP_02,
    GUIA_EXP_03,
    GUIA_EXP_04,
    GUIA_EXP_06,
    GUIA_EXP_07,
    GUIA_EXP_08,
    GUIA_EXP_70,
  ].map((guia) => [
    guia.expId,
    guia,
  ]),
);

/**
 * Missões disponíveis que deliberadamente NÃO têm guia da aula.
 *
 * Hoje está vazia, e é assim que deve ficar: uma missão sem guia é uma missão
 * que o professor recebe sem saber como conduzir. Se alguma entrar aqui, entra
 * com a razão escrita ao lado.
 */
export const MISSOES_SEM_GUIA: readonly string[] = [];

export function buscarGuia(expId: string): GuiaDaAula | null {
  return GUIAS.get(expId) ?? null;
}

/** Só para o teste: a lista inteira, sem expor o Map para escrita. */
export function todosOsGuias(): GuiaDaAula[] {
  return [...GUIAS.values()];
}

export type { GuiaDaAula } from "./tipos";
