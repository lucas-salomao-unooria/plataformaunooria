import type { ModoRanking, RankingLinha } from "./tipos";

/**
 * Ordenações do ranking — mesmos desempates do servidor (`regras.ts` da api),
 * para a posição mostrada bater com a que a api calcula.
 */
const porNome = (a: RankingLinha, b: RankingLinha) =>
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });

export function ordenarRanking(linhas: readonly RankingLinha[], modo: ModoRanking): RankingLinha[] {
  const copia = [...linhas];
  if (modo === "inscritos") return copia.sort((a, b) => b.inscritos - a.inscritos || porNome(a, b));
  return copia.sort(
    (a, b) => b.fontesConfiaveis - a.fontesConfiaveis || a.inscritos - b.inscritos || porNome(a, b),
  );
}

/** Posição 1-based do estudante na ordenação dada. */
export function posicaoDoEstudante(linhas: readonly RankingLinha[], modo: ModoRanking): number {
  return ordenarRanking(linhas, modo).findIndex((l) => l.voce) + 1;
}

