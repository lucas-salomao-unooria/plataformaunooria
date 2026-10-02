import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { CONTAS, E1, E2, E3, E4, E5, E6, ENQUETE, ESCOLA, ESPERA, FIM, GLOBAL } from "./textos";

/**
 * Todas as strings de um grupo de copy — as fixas e as montadas (as funções são
 * chamadas com valores de amostra: a régua é sobre as PALAVRAS da moldura).
 */
function textosDo(grupo: unknown): string[] {
  if (typeof grupo === "string") return [grupo];
  if (typeof grupo === "function") {
    const f = grupo as (...a: unknown[]) => unknown;
    try {
      return [String(f(9, 16, 56))];
    } catch {
      return [String(f(["Celular", "Wi-Fi da escola"]))];
    }
  }
  if (Array.isArray(grupo)) return grupo.flatMap((g) => textosDo(g));
  if (grupo && typeof grupo === "object") return Object.values(grupo).flatMap((g) => textosDo(g));
  return [];
}

const TODOS = [CONTAS, GLOBAL, ESCOLA, E1, E2, E3, ESPERA, E4, E5, E6, ENQUETE, FIM];
const ANTES_DA_GALERIA = [CONTAS, GLOBAL, E1, E2, E3, ESPERA];

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

describe("a copy da missão", () => {
  test("UMA exclamação na missão inteira — a do Léo", () => {
    const comExclamacao = TODOS.flatMap((g) => textosDo(g)).filter((t) => t.includes("!"));
    expect(comExclamacao).toEqual([E5.ponteLeo]);
    expect([...E5.ponteLeo.matchAll(/!/g)]).toHaveLength(1);
  });

  test("nenhuma taxa cravada: a invisibilidade é a da sessão, vinda da api", () => {
    const tudo = TODOS.flatMap((g) => textosDo(g)).join("\n");
    expect(tudo).not.toMatch(/75\s*%/);
    expect(tudo).not.toMatch(/12 projetos/);
    expect(E4.taxa(9, 16, 56)).toBe("9 de 16 estandes nunca chegaram ao seu feed (56% da mostra).");
    expect(E4.taxa(1, 16, 6)).toContain("nunca chegou");
  });

  /**
   * As marcas que não entram num estande (`TERMOS_PROIBIDOS` da api) também não
   * entram na moldura: o app é o Unoovista, e a lista é lida da fonte única.
   */
  test("nenhuma marca real na tela", () => {
    const fonte = readFileSync("../../api/src/juri-estadual/invariantes.ts", "utf8");
    const bloco = /export const TERMOS_PROIBIDOS = \[([\s\S]*?)\] as const/.exec(fonte)?.[1] ?? "";
    const marcas = [...bloco.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(marcas.length).toBeGreaterThan(5);
    for (const texto of TODOS.flatMap((g) => textosDo(g))) {
      const palavras = new Set(semAcento(texto).split(/[^a-z0-9]+/));
      for (const marca of marcas) expect(palavras.has(marca), `"${marca}" em "${texto}"`).toBe(false);
    }
  });

  /**
   * O GAP COGNITIVO: antes da galeria, a tela não nomeia a descoberta. O guia
   * do professor pede o mesmo da fala dele ("não mencione algoritmo, bolha ou
   * filtro"); este teste cobra da moldura: o crachá, o feed, a cédula, a
   * plenária e os avisos globais.
   */
  test("antes da galeria, nenhuma palavra entrega o mecanismo", () => {
    const proibidas = ["algoritmo", "bolha", "filtro", "oculto", "oculta", "ocultos", "escondido", "invisivel"];
    for (const texto of ANTES_DA_GALERIA.flatMap((g) => textosDo(g))) {
      const palavras = new Set(semAcento(texto).split(/[^a-z0-9]+/));
      for (const p of proibidas) expect(palavras.has(p), `"${p}" em "${texto}"`).toBe(false);
    }
  });
});
