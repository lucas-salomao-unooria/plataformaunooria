import { normalizarSerie, type Serie } from "./series";

/**
 * Série → experiência de ENTRADA do aluno (o que ele vê ao logar).
 *
 * Mapa estático de propósito: o middleware roda no edge e não consulta a api,
 * e a tabela `experiencias` (manifesto) só existe quando o CI publica. Quando
 * houver dezenas de experiências, a fonte passa a ser `experiencias.series` e
 * o middleware manda para um `/exp` genérico.
 */
export const EXP_PADRAO = "exp-01-instanooria";

export const EXP_POR_SERIE: Partial<Record<Serie, string>> = {
  "4EF": "exp-02-unootube",
};

export function expIdDoAluno(serieBruta: string | null | undefined): string {
  const serie = normalizarSerie(serieBruta);
  return (serie && EXP_POR_SERIE[serie]) ?? EXP_PADRAO;
}
