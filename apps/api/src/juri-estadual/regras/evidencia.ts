/**
 * Os MARCADORES da ficha (`evidencias/fichas/exp06ef1b.ts`, versão 5 — o Canal
 * A puro da ADR-174) e as réguas que os alimentam. Os ids são contrato com a
 * ficha: a missão calcula o nível na própria transação da tarefa e o entrega
 * pela porta `marcar`.
 *
 * - **EF06CO01** `classificacao`: a separação dos estandes vistos nas quatro
 *   áreas (`regras/classificacao.ts`), logo depois do voto.
 * - **EF06CO03** `regra`: a regra SE … ENTÃO montada com peças
 *   (`regras/regra.ts`), depois da revisão do voto.
 *
 * Quem não faz a tarefa não tem marca dela — "Não avaliado", a AUSÊNCIA de
 * linha (E14) —, nunca "não atingiu". A galeria (busca, inspeção, manter ou
 * trocar) é experiência e não marca nada desde a versão 5: a EF06CO10 saiu da
 * missão. As marcas `auditoria` e `cadeia` da versão 4 ficam no histórico com
 * a versão delas — `regra` é um id NOVO para a régua nova nunca se misturar
 * com a contagem de tentativas da cadeia.
 */
export const MARCADOR_DA_CLASSIFICACAO = "classificacao";
export const MARCADOR_DA_REGRA = "regra";

export { nivelDaClassificacao } from "./classificacao";
export { nivelDaRegra } from "./regra";
