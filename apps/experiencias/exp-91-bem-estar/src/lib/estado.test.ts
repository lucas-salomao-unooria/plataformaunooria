import { describe, expect, test } from "vitest";
import { faltam, formatarDia, mensagemDoStatus, percentual, todasRespondidas, varianteDaFaixa } from "./estado";

describe("estado do check-in", () => {
  test("todasRespondidas exige valor 0..3 em cada item do dia", () => {
    expect(todasRespondidas({ 1: 0, 5: 3, 9: 2 }, [1, 5, 9])).toBe(true);
    expect(todasRespondidas({ 1: 0, 5: 3 }, [1, 5, 9])).toBe(false);
    expect(todasRespondidas({ 1: 0, 5: 4, 9: 2 }, [1, 5, 9])).toBe(false);
  });

  test("faixa → variante: só a esperada é verde; severo e extremo são vermelhos", () => {
    expect(varianteDaFaixa("normal")).toBe("success");
    expect(varianteDaFaixa("leve")).toBe("info");
    expect(varianteDaFaixa("moderado")).toBe("warning");
    expect(varianteDaFaixa("severo")).toBe("error");
    expect(varianteDaFaixa("extremamente-severo")).toBe("error");
  });

  test("percentual e faltam", () => {
    expect(percentual(3, 7)).toBe(43);
    expect(percentual(7, 7)).toBe(100);
    expect(percentual(0, 0)).toBe(0);
    expect(faltam(3, 7)).toBe(4);
    expect(faltam(9, 7)).toBe(0);
  });

  test("formatarDia não passa pelo Date (25/08 continua 25/08 à noite)", () => {
    expect(formatarDia("2026-08-25")).toBe("25/08");
    expect(formatarDia("x")).toBe("x");
  });

  test("mensagens por status", () => {
    expect(mensagemDoStatus(409)).toMatch(/já foi registrado/);
    expect(mensagemDoStatus(null)).toMatch(/continuam aqui/);
  });
});
