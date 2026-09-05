import { describe, expect, test } from "vitest";
import { ANOS, MISSOES_TRANSVERSAIS } from "./entre-redes/catalogo";
import { MISSOES_DO_ESTUDANTE } from "./missoes-do-estudante";

/** Missões de ano E transversais: as duas famílias entram no hub do estudante, e a
 *  regra da copy vale para as duas. */
const publicadas = [
  ...ANOS.flatMap((ano) => ano.missoes),
  ...MISSOES_TRANSVERSAIS,
].filter((missao) => missao.status === "disponivel");

describe("missões do estudante", () => {
  test("toda missão publicada tem copy de estudante — senão some do hub dele", () => {
    const semCopy = publicadas.filter((missao) => !missao.estudante);
    /* Identifica pelo `expId` (as duas famílias têm) e cai no título, que
       também têm — `unidadeSlug` só existe nas de ano. */
    expect(semCopy.map((m) => m.expId ?? m.titulo)).toEqual([]);
  });

  test("as missões publicadas hoje aparecem, com rota para o aparelho", () => {
    // As TRANSVERSAIS vêm primeiro: não pertencem a ano nenhum, e a Vila do Lume
    // é o Ato 1 do Instanooria — o perfil medido nela decide de que lado o feed
    // do Instanooria nasce. Depois vem a ordem de `ANOS`: 1º ao 9º ano do
    // Fundamental e então as 3 séries do Médio, então a 2ª série fica DEPOIS do
    // 8º ano.
    expect(MISSOES_DO_ESTUDANTE.map((m) => m.expId)).toEqual([
      "exp-70-vila-do-lume",
      "exp-02-unootube",
      "exp-07-o-eco-no-grupo",
      "exp-01-instanooria",
      "exp-03-unoogpt",
    ]);
    expect(MISSOES_DO_ESTUDANTE.map((m) => m.rota)).toEqual([
      "/exp/exp-70-vila-do-lume",
      "/exp/exp-02-unootube",
      "/exp/exp-07-o-eco-no-grupo",
      "/exp/exp-01-instanooria",
      "/exp/exp-03-unoogpt",
    ]);
  });

  test("a Vila do Lume vem antes do Instanooria: ela é o Ato 1 dele", () => {
    const ordem = MISSOES_DO_ESTUDANTE.map((m) => m.expId);
    const vila = ordem.indexOf("exp-70-vila-do-lume");
    const insta = ordem.indexOf("exp-01-instanooria");

    expect(vila).toBeGreaterThanOrEqual(0);
    expect(insta).toBeGreaterThanOrEqual(0);
    // É o perfil medido na Vila que decide de que lado o feed do Instanooria
    // nasce (`resolverLargada`). Oferecer o Ato 2 primeiro não bloqueia nada —
    // o estudante sem partida cai no sorteio balanceado —, mas convida à ordem
    // errada sem nada na tela dizendo o que faltou.
    expect(vila).toBeLessThan(insta);
  });

  test("a transversal aparece para o estudante sem depender de série", () => {
    // O que "transversal" significa aqui: nenhuma condição de ano. Se um filtro
    // por série voltar e esta missão sumir, é bug — `series: []` no manifesto
    // quer dizer TODAS as séries.
    for (const missao of MISSOES_TRANSVERSAIS) {
      if (missao.status !== "disponivel") continue;
      expect(MISSOES_DO_ESTUDANTE.map((m) => m.expId)).toContain(missao.expId);
    }
  });

  test("a copy do estudante não repete a do professor (que entrega a virada)", () => {
    for (const missao of publicadas) {
      const copy = missao.estudante!;
      expect(copy.chamada).not.toBe(missao.resumo);
    }
  });
});
