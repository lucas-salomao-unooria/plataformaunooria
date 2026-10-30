import { describe, expect, test } from "vitest";
import { tempoDigitando } from "./lib/falas";

describe("o digitando antes de cada fala do assistente (ajuste do PO de 30/10)", () => {
  test("cresce com o texto, entre 0,6 s e 1,5 s", () => {
    expect(tempoDigitando("")).toBe(600);
    expect(tempoDigitando("x".repeat(100))).toBe(1000);
    expect(tempoDigitando("x".repeat(1000))).toBe(1500);
  });
});
