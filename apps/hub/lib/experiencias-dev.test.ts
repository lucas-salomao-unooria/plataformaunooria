import { describe, expect, test } from "vitest";
import { EXPERIENCIAS_DEV, baseDevDaExperiencia } from "./experiencias-dev";

describe("baseDevDaExperiencia", () => {
  test("cada experiência tem porta própria em dev", () => {
    expect(baseDevDaExperiencia("exp-01-instanooria", "x")).toBe("http://localhost:5173");
    expect(baseDevDaExperiencia("exp-02-unootube", "x")).toBe("http://localhost:5174");
    expect(baseDevDaExperiencia("exp-90-plano-de-aula", "x")).toBe("http://localhost:5175");
    expect(baseDevDaExperiencia("exp-91-bem-estar", "x")).toBe("http://localhost:5176");
  });

  test("experiência desconhecida cai no fallback (NEXT_PUBLIC_CDN_EXP_URL)", () => {
    expect(baseDevDaExperiencia("exp-99-nova", "http://localhost:5173")).toBe("http://localhost:5173");
  });

  test("portas não colidem", () => {
    const portas = Object.values(EXPERIENCIAS_DEV);
    expect(new Set(portas).size).toBe(portas.length);
  });
});
