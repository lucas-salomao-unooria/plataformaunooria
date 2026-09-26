import { describe, expect, test } from "vitest";
import { ANOS, ETAPAS, UNIDADES_POR_ANO, buscarMissao } from "./catalogo";

describe("grade do Entre Redes", () => {
  test("cobre a Educação Básica inteira: 9 anos do EF + 3 séries do EM", () => {
    expect(ANOS.map((ano) => ano.slug)).toEqual([
      "1-ano", "2-ano", "3-ano", "4-ano", "5-ano", "6-ano", "7-ano", "8-ano", "9-ano",
      "1-serie", "2-serie", "3-serie",
    ]);
    expect(ETAPAS.map((etapa) => etapa.anos.length)).toEqual([5, 4, 3]);
  });

  test("todo ano tem as 4 unidades, publicadas ou não", () => {
    for (const ano of ANOS) {
      expect(ano.missoes).toHaveLength(UNIDADES_POR_ANO);
      expect(ano.missoes.map((m) => m.unidade)).toEqual([1, 2, 3, 4]);
    }
  });

  test("as missões publicadas continuam no lugar delas", () => {
    expect(buscarMissao("1-ano", "unidade-1")?.missao.expId).toBe("exp01ef1b");
    expect(buscarMissao("8-ano", "unidade-1")?.missao.expId).toBe("exp08ef1b");
  });

  test("o UnooTube arquivado (ADR-116) saiu da grade: a unidade 1 do 4º ano fica em breve", () => {
    expect(buscarMissao("4-ano", "unidade-1")?.missao.status).toBe("em-breve");
  });
});
