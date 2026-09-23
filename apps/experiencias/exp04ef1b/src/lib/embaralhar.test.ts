import { describe, expect, test } from "vitest";
import { embaralhar, evitarMesmaAbertura } from "./embaralhar";

const itens = Array.from({ length: 21 }, (_, i) => ({ id: `v${String(i + 1).padStart(2, "0")}` }));

describe("embaralhar", () => {
  test("é uma permutação completa", () => {
    const resultado = embaralhar(itens);
    expect(resultado).toHaveLength(21);
    expect(new Set(resultado.map((v) => v.id)).size).toBe(21);
    expect(resultado.map((v) => v.id).sort()).toEqual(itens.map((v) => v.id).sort());
  });

  test("não muta a entrada", () => {
    const copia = [...itens];
    embaralhar(itens);
    expect(itens).toEqual(copia);
  });

  test("é determinístico dado o gerador", () => {
    const zero = () => 0;
    expect(embaralhar(itens, zero)).toEqual(embaralhar(itens, zero));
  });
});

describe("evitarMesmaAbertura", () => {
  test("troca o primeiro quando repete a abertura anterior", () => {
    const resultado = evitarMesmaAbertura(itens, "v01", () => 0.5);
    expect(resultado[0]!.id).not.toBe("v01");
    expect(resultado).toHaveLength(21);
    expect(new Set(resultado.map((v) => v.id)).size).toBe(21);
  });

  test("não mexe quando o primeiro é diferente ou não há anterior", () => {
    expect(evitarMesmaAbertura(itens, "v02")).toBe(itens);
    expect(evitarMesmaAbertura(itens, null)).toBe(itens);
  });
});
