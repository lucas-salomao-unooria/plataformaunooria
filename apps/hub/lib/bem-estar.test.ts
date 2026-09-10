import { describe, expect, test } from "vitest";
import { situacaoDoBemEstar } from "./bem-estar";

describe("situacaoDoBemEstar", () => {
  test("sem resumo (api fora) — convite neutro", () => {
    expect(situacaoDoBemEstar(null)).toBe("Menos de 1 minuto por dia");
  });
  test("pendente", () => {
    expect(situacaoDoBemEstar({ hoje: "pendente", respondidos: 0, total: 7, cicloAberto: false })).toMatch(/Falta responder hoje · ~40/);
    expect(situacaoDoBemEstar({ hoje: "pendente", respondidos: 3, total: 7, cicloAberto: true })).toBe("Falta responder hoje · 3 de 7");
  });
  test("respondido", () => {
    expect(situacaoDoBemEstar({ hoje: "respondido", respondidos: 4, total: 7, cicloAberto: true })).toBe("Você já respondeu hoje · 4 de 7");
    expect(situacaoDoBemEstar({ hoje: "respondido", respondidos: 0, total: 7, cicloAberto: false })).toMatch(/ciclo fechado|0 de 7/);
  });
});
