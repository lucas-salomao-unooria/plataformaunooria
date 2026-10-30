import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ANCORAS, CRITERIOS, PASSOS, PILULAS, PROJETOS } from "./lib/tipos";

/**
 * O espelho declarado da api: as listas que a tela usa são as do servidor.
 * Lê `apps/api/src/dossie-invisivel/*` como TEXTO (a experiência não importa
 * a api) e reprova a divergência — o typecheck não a veria.
 */
const API = "../../api/src/dossie-invisivel";
const conteudo = readFileSync(`${API}/conteudo.ts`, "utf8");
const passos = readFileSync(`${API}/regras/passos.ts`, "utf8");
const lista = (xs: readonly string[]) => `[${xs.map((x) => `"${x}"`).join(", ")}]`;

describe("o espelho das listas", () => {
  test("os passos", () => expect(passos).toContain(`PASSOS = ${lista(PASSOS)} as const`));
  test("os projetos", () => expect(conteudo).toContain(`PROJETOS = ${lista(PROJETOS)} as const`));
  test("os critérios", () => expect(conteudo).toContain(`CRITERIOS = ${lista(CRITERIOS)} as const`));
  test("as pílulas", () => expect(conteudo).toContain(`PILULAS = ${lista(PILULAS)} as const`));
  test("as âncoras", () => expect(conteudo).toContain(`ANCORAS = ${lista(ANCORAS)} as const`));
});
