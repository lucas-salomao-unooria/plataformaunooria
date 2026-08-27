import { describe, expect, test } from "vitest";
import { ANOS, MISSOES_TRANSVERSAIS } from "./entre-redes/catalogo";
import { MISSOES_DO_ALUNO } from "./missoes-do-aluno";

/** Missões de ano E transversais: as duas famílias entram no hub do aluno, e a
 *  regra da copy vale para as duas. */
const publicadas = [
  ...ANOS.flatMap((ano) => ano.missoes),
  ...MISSOES_TRANSVERSAIS,
].filter((missao) => missao.status === "disponivel");

describe("missões do aluno", () => {
  test("toda missão publicada tem copy de aluno — senão some do hub dele", () => {
    const semCopy = publicadas.filter((missao) => !missao.aluno);
    /* Identifica pelo `expId` (as duas famílias têm) e cai no título, que
       também têm — `unidadeSlug` só existe nas de ano. */
    expect(semCopy.map((m) => m.expId ?? m.titulo)).toEqual([]);
  });

  test("as missões publicadas hoje aparecem, com rota para o aparelho", () => {
    // A ORDEM é a de `ANOS`: 1º ao 9º ano do Fundamental e depois as 3 séries
    // do Médio. A 2ª série vem DEPOIS do 8º ano, e as transversais no fim.
    expect(MISSOES_DO_ALUNO.map((m) => m.expId)).toEqual([
      "exp-02-unootube",
      "exp-01-instanooria",
      "exp-03-unoogpt",
      // Transversal: entra sem série e sem filtro nenhum.
      "exp-70-vila-do-lume",
    ]);
    expect(MISSOES_DO_ALUNO.map((m) => m.rota)).toEqual([
      "/exp/exp-02-unootube",
      "/exp/exp-01-instanooria",
      "/exp/exp-03-unoogpt",
      "/exp/exp-70-vila-do-lume",
    ]);
  });

  test("a transversal aparece para o aluno sem depender de série", () => {
    // O que "transversal" significa aqui: nenhuma condição de ano. Se um filtro
    // por série voltar e esta missão sumir, é bug — `series: []` no manifesto
    // quer dizer TODAS as séries.
    for (const missao of MISSOES_TRANSVERSAIS) {
      if (missao.status !== "disponivel") continue;
      expect(MISSOES_DO_ALUNO.map((m) => m.expId)).toContain(missao.expId);
    }
  });

  test("a copy do aluno não repete a do professor (que entrega a virada)", () => {
    for (const missao of publicadas) {
      expect(missao.aluno!.chamada).not.toBe(missao.resumo);
    }
  });
});
