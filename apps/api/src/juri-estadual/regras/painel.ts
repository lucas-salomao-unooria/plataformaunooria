import { AREAS, areaDoProjeto, type Area } from "../vocabulario";

/**
 * O PAINEL do professor — o que ele conta, puro.
 *
 * O painel é PROJETADO na lousa no pico (PED-07: sem nome ligado a escolha).
 * Então a linha de cada computador diz só PROGRESSO (entrou, votou, abriu a
 * galeria, buscou, revisou, concluiu), e o que a turma escolheu vive no resumo
 * ANÔNIMO: os votos por área, a taxa média, quantos mantiveram ou trocaram.
 */

/**
 * As chaves que a linha do painel NÃO pode ter — o teste cobra por SUBCADEIA,
 * em minúsculas. É a lista de PED-07 e da E14: nem o voto (o projeto, a
 * convicção, a área), nem a taxa de cada criança, nem nível de habilidade.
 *
 * `voto` NÃO está aqui de propósito: `votou` (o progresso) a conteria. Quem
 * segura o voto fora da linha é `projeto`, `area` e `conviccao` — e o teste do
 * VALOR, que procura id de projeto no JSON das linhas.
 */
export const PROIBIDO_NA_LINHA_DO_PAINEL = [
  "projeto",
  "area",
  "conviccao",
  "invisibilidade",
  "taxa",
  "percentual",
  "ocultos",
  "nivel",
  "status",
  "nota",
  "score",
  "pontos",
  "ranking",
  "posicao",
  "acerto",
  "tentativa",
  "mecanismo",
  "atitude",
] as const;

/** Votos por área, na ordem das áreas: o gráfico da lousa. */
export function votosPorArea(votos: readonly string[]): Record<Area, number> {
  const total = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
  for (const projetoId of votos) total[areaDoProjeto(projetoId)] += 1;
  return total;
}

/** A média inteira das taxas de quem votou, ou `null` sem voto nenhum. */
export function mediaDasTaxas(percentuais: readonly number[]): number | null {
  if (percentuais.length === 0) return null;
  return Math.round(percentuais.reduce((s, p) => s + p, 0) / percentuais.length);
}
