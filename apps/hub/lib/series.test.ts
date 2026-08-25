import { describe, expect, test } from "vitest";
import { SERIES, normalizarSerie } from "./series";

describe("normalizarSerie", () => {
  test("enum canônico passa direto, em qualquer caixa", () => {
    for (const s of SERIES) expect(normalizarSerie(s)).toBe(s);
    expect(normalizarSerie("8ef")).toBe("8EF");
    expect(normalizarSerie(" 4EF ")).toBe("4EF");
  });

  test("grafias humanas do fundamental", () => {
    expect(normalizarSerie("8º ano")).toBe("8EF");
    expect(normalizarSerie("8o ano")).toBe("8EF");
    expect(normalizarSerie("4º ano EF")).toBe("4EF");
    expect(normalizarSerie("4º ano do Ensino Fundamental")).toBe("4EF");
  });

  test("grafias humanas do médio", () => {
    expect(normalizarSerie("2ª série EM")).toBe("2EM");
    expect(normalizarSerie("1a serie do ensino medio")).toBe("1EM");
    expect(normalizarSerie("3 EM")).toBe("3EM");
  });

  test("não reconhecido vira null", () => {
    expect(normalizarSerie("")).toBeNull();
    expect(normalizarSerie(undefined)).toBeNull();
    expect(normalizarSerie(null)).toBeNull();
    expect(normalizarSerie("10EF")).toBeNull();
    expect(normalizarSerie("4EM")).toBeNull();
    expect(normalizarSerie("professor")).toBeNull();
  });
});
