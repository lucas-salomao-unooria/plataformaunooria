import { describe, expect, test } from "vitest";
import { EXPERIENCIAS_DEV, baseDevDaExperiencia } from "./experiencias-dev";

describe("baseDevDaExperiencia", () => {
  test("cada experiência tem porta própria em dev", () => {
    expect(baseDevDaExperiencia("exp08ef1b", "x")).toBe("http://localhost:5173");
    expect(baseDevDaExperiencia("exp04ef1b", "x")).toBe("http://localhost:5174");
    expect(baseDevDaExperiencia("app-90-plano-de-aula", "x")).toBe("http://localhost:5175");
    expect(baseDevDaExperiencia("app-70-vila-do-lume", "x")).toBe("http://localhost:5177");
    expect(baseDevDaExperiencia("app-91-bem-estar", "x")).toBe("http://localhost:5176");
    expect(baseDevDaExperiencia("exp02em1b", "x")).toBe("http://localhost:5178");
    expect(baseDevDaExperiencia("exp05ef1b", "x")).toBe("http://localhost:5184");
  });

  test("experiência desconhecida cai no fallback (NEXT_PUBLIC_CDN_EXP_URL)", () => {
    expect(baseDevDaExperiencia("app-99-nova", "http://localhost:5173")).toBe("http://localhost:5173");
  });

  test("portas não colidem", () => {
    const portas = Object.values(EXPERIENCIAS_DEV);
    expect(new Set(portas).size).toBe(portas.length);
  });
});
