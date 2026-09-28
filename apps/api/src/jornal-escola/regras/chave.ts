import { BLOCOS_ISCA, BLOCOS_VALIDOS, TAMANHO_DA_CHAVE, type IdDeBloco } from "../vocabulario";

/**
 * A CORREÇÃO da Chave do Editor — pura, e só no servidor (regra 3): o conjunto
 * certo nunca desce ao bundle.
 *
 * Sucesso é o CONJUNTO {fonte, data, autoria}, em qualquer ordem (o PRD, Etapa
 * 5: "aceita qualquer permutação completa dos 3 critérios válidos"). A ordem
 * não é critério porque a referência do livro ainda é provisória (PDF §8): se
 * ele trouxer uma sequência obrigatória, é aqui que ela entra.
 *
 * Cada envio é uma TENTATIVA — a isca também conta, e é para isso que ela
 * existe: sem isca, a Chave aceitaria qualquer toque e a EF15CO02 daria
 * "atingiu" para todo mundo. As iscas enviadas VOLTAM à bandeja (`devolvidos`);
 * os pilares ficam na calha.
 */

const VALIDOS = new Set<string>(BLOCOS_VALIDOS);
const ISCAS = new Set<string>(BLOCOS_ISCA);

export type CorrecaoDaChave = { sucesso: boolean; devolvidos: IdDeBloco[] };

export function corrigirChave(blocos: readonly IdDeBloco[]): CorrecaoDaChave {
  const distintos = new Set(blocos);
  const sucesso =
    blocos.length === TAMANHO_DA_CHAVE &&
    distintos.size === TAMANHO_DA_CHAVE &&
    [...distintos].every((b) => VALIDOS.has(b));
  return { sucesso, devolvidos: sucesso ? [] : blocos.filter((b) => ISCAS.has(b)) };
}
