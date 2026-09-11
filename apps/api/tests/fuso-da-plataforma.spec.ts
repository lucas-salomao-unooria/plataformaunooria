import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FUSO, diaDaPlataforma } from "../src/comum/fuso";
import { FUSO as FUSO_DO_BEMESTAR } from "../src/bemestar/catalogo";
import { diaDe } from "../src/bemestar/regras";

/**
 * O que este arquivo segura é **a cópia entre a api e o SDK**.
 *
 * `apps/api/src/comum/fuso.ts` e `packages/sdk/src/fuso.ts` declaram o mesmo
 * fuso, porque a api não consome pacote de workspace (`packages/AGENTS.md`). A
 * cópia da copy da exp-01 é guardada por um comentário e nada mais; esta é
 * guardada por este teste — a diferença importa, porque divergir aqui devolve
 * exatamente o defeito que a ADR-98 fechou, só que entre api e hub.
 */
const FUSO_NO_SDK = join(__dirname, "../../../packages/sdk/src/fuso.ts");

describe("o fuso da plataforma", () => {
  it("é o MESMO no SDK e na api — as duas cópias são amarradas, não confiadas", () => {
    const fonte = readFileSync(FUSO_NO_SDK, "utf8");
    const declarado = /export const FUSO_DA_PLATAFORMA = "([^"]+)"/.exec(fonte)?.[1];

    expect(declarado).toBeDefined();
    expect(FUSO).toBe(declarado);
  });

  it("o bem-estar reexporta, não redeclara", () => {
    expect(FUSO_DO_BEMESTAR).toBe(FUSO);
  });

  /**
   * O defeito, do lado do dado: o "dia" do check-in.
   *
   * 22h30 de Brasília já é o dia seguinte em UTC. Com o processo do Cloud Run
   * em UTC e sem fuso explícito, o check-in da noite gravaria o dia de amanhã —
   * e o de amanhã seria recusado com "você já respondeu hoje".
   */
  it("22h30 de Brasília é o dia 10, não o 11, mesmo com o processo em UTC", () => {
    const original = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      const noiteDeBrasilia = new Date("2026-09-11T01:30:00.000Z");
      expect(diaDaPlataforma(noiteDeBrasilia)).toBe("2026-09-10");
      expect(diaDe(noiteDeBrasilia)).toBe("2026-09-10");
    } finally {
      process.env.TZ = original;
    }
  });
});
