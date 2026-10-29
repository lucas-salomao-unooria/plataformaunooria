import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * O DS HÍBRIDO (ADR-197) só não vira vazamento se a separação for POR ARQUIVO:
 * `app/jornal/*` importa SÓ a ponte do Unoojornal, `app/mecanica/*` SÓ a da
 * plataforma, e `app/telas/*` e `app/comum/*` nenhuma (compõem peças).
 */
const pontes = (pasta: string) =>
  readdirSync(join("src/app", pasta))
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => ({ f, pontes: [...readFileSync(join("src/app", pasta, f), "utf8").matchAll(/from "(@edu\/ui\/[^"]+)"/g)].map((m) => m[1]) }));

describe("a separação jornal × mecânica", () => {
  test("jornal/ só importa @edu/ui/ds-unoojornal", () => {
    for (const { f, pontes: p } of pontes("jornal")) for (const x of p) expect(x, f).toBe("@edu/ui/ds-unoojornal");
  });
  test("mecanica/ só importa @edu/ui/ds", () => {
    for (const { f, pontes: p } of pontes("mecanica")) for (const x of p) expect(x, f).toBe("@edu/ui/ds");
  });
  test("telas/ e comum/ não importam o DS", () => {
    for (const pasta of ["telas", "comum"]) for (const { f, pontes: p } of pontes(pasta)) expect(p, f).toEqual([]);
  });
});
