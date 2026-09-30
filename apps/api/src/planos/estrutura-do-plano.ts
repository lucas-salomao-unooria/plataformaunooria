/**
 * A ESTRUTURA do plano anual gerado (ADR-123): uma definição só.
 *
 * - `prompt-plano-de-aula.ts` é a AUTORIDADE: descreve cada seção e interpola
 *   `LIMITES`, então o número que a IA lê é o mesmo que os testes cobram.
 * - `template-plano.ts` é um EXEMPLO de formato e de nível de detalhe, de outra
 *   disciplina. Não define seção nenhuma.
 * - `tests/planos-estrutura.spec.ts` confere prompt, template e mock contra este
 *   arquivo, e as habilidades do template contra a BNCC do repositório.
 *
 * Mudou uma seção ou um limite? Muda aqui, no prompt e no exemplo, no mesmo
 * commit: o teste reprova a divergência. Antes, o prompt pedia nove blocos e o
 * template mostrava seis, e o modelo escolhia a quem obedecer.
 */

/** Seções do plano, na ordem em que aparecem. */
export const SECOES_DO_PLANO = [
  "Fundamentação",
  "Objetivos gerais",
  "Percurso do ano",
  "Metodologia geral",
  "Avaliação geral",
  "Referências de elaboração",
] as const;

/** Seções de CADA bimestre (ou unidade). */
export const SECOES_DO_BIMESTRE = [
  "Questão norteadora",
  "Conteúdos",
  "Habilidades mobilizadas",
  "Estratégias metodológicas",
  "Formas de avaliação",
] as const;

/** Só existe no período que tem produto de síntese ou projeto de culminância. */
export const SECAO_OPCIONAL_DO_BIMESTRE = "Produto de síntese";

/**
 * Títulos que já não existem. O teste garante que não voltam: "Produtos de
 * síntese por período" e "Síntese da progressão anual" repetiam, em duas
 * tabelas no fim, o que cada bimestre e o Percurso do ano já dizem.
 */
export const SECOES_QUE_SAIRAM = [
  "Produtos de síntese por período",
  "Síntese da progressão anual",
  "Habilidades da BNCC",
] as const;

/** Quantos itens cada lista comporta. O prompt interpola; o teste confere o exemplo. */
export const LIMITES = {
  objetivos: { min: 6, max: 10 },
  conteudos: { min: 4, max: 7 },
  estrategias: { min: 5, max: 8 },
  avaliacao: { min: 4, max: 6 },
} as const;
