import { describe, expect, test } from "vitest";
import { ANOS } from "./entre-redes/catalogo";
import { MISSOES_DO_ALUNO } from "./missoes-do-aluno";

const publicadas = ANOS.flatMap((ano) => ano.missoes).filter(
  (missao) => missao.status === "disponivel",
);

describe("missões do aluno", () => {
  test("toda missão publicada tem copy de aluno — senão some do hub dele", () => {
    const semCopy = publicadas.filter((missao) => !missao.aluno);
    expect(semCopy.map((m) => m.expId ?? m.unidadeSlug)).toEqual([]);
  });

  test("as missões publicadas hoje aparecem, com rota para o aparelho", () => {
    expect(MISSOES_DO_ALUNO.map((m) => m.expId)).toEqual([
      "exp-02-unootube",
      "exp-01-instanooria",
    ]);
    expect(MISSOES_DO_ALUNO.map((m) => m.rota)).toEqual([
      "/exp/exp-02-unootube",
      "/exp/exp-01-instanooria",
    ]);
  });

  test("a copy do aluno não repete a do professor (que entrega a virada)", () => {
    for (const missao of publicadas) {
      expect(missao.aluno!.chamada).not.toBe(missao.resumo);
    }
  });
});
