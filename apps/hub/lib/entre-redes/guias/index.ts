import { GUIA_EXP08EF1B } from "./exp08ef1b";
import { GUIA_EXP02EM1B } from "./exp02em1b";
import { GUIA_EXP01EF1B } from "./exp01ef1b";
import { GUIA_EXP04EF1B } from "./exp04ef1b";
import { GUIA_EXP05EF1B } from "./exp05ef1b";
import { GUIA_EXP06EF2B } from "./exp06ef2b";
import { GUIA_EXP07EF1B } from "./exp07ef1b";
import { GUIA_EXP08EF4B } from "./exp08ef4b";
import { GUIA_APP_70 } from "./app-70-vila-do-lume";
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
    GUIA_EXP08EF1B,
    GUIA_EXP02EM1B,
    GUIA_EXP01EF1B,
    GUIA_EXP04EF1B,
    GUIA_EXP05EF1B,
    GUIA_EXP06EF2B,
    GUIA_EXP07EF1B,
    GUIA_EXP08EF4B,
    GUIA_APP_70,
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
