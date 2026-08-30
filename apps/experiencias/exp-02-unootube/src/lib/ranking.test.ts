import { describe, expect, test } from "vitest";
import { ordenarRanking, posicaoDoEstudante, posicaoDoAluno } from "./ranking";
import type { RankingLinha } from "./tipos";

const linha = (id: string, nome: string, fontes: number, inscritos: number, voce = false): RankingLinha => ({
  id,
  nome,
  avatar: nome[0]!,
  accent: "blue",
  fontesConfiaveis: fontes,
  inscritos,
  voce,
});

const turma = [
  linha("c1", "Bernardo", 0, 3000),
  linha("c2", "Ana", 3, 150),
  linha("c3", "Caio", 1, 2050),
  linha("voce", "Lia", 3, 150, true),
  linha("c4", "Álvaro", 0, 3000),
];

describe("ordenarRanking", () => {
  test("por inscritos: fakes no topo, desempate por nome pt-BR (acento não conta)", () => {
    expect(ordenarRanking(turma, "inscritos").map((l) => l.nome)).toEqual(["Álvaro", "Bernardo", "Caio", "Ana", "Lia"]);
  });

  test("por fontes: a métrica vira", () => {
    expect(ordenarRanking(turma, "confiaveis").map((l) => l.nome)).toEqual(["Ana", "Lia", "Caio", "Álvaro", "Bernardo"]);
  });

  test("não muta a entrada", () => {
    const antes = turma.map((l) => l.id);
    ordenarRanking(turma, "confiaveis");
    expect(turma.map((l) => l.id)).toEqual(antes);
  });
});

describe("posicaoDoEstudante", () => {
  test("1-based nas duas ordenações", () => {
    expect(posicaoDoEstudante(turma, "inscritos")).toBe(5);
    expect(posicaoDoEstudante(turma, "confiaveis")).toBe(2);
    expect(posicaoDoAluno(turma, "inscritos")).toBe(5);
  });

  test("0 quando não há linha 'você'", () => {
    expect(posicaoDoEstudante(turma.filter((l) => !l.voce), "inscritos")).toBe(0);
  });
});
