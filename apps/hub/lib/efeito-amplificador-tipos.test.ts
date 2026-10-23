import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { DISCIPLINAS, FASES, MANCHETES, NOS, ORIGENS, PASSOS, TIPOS_DE_COMENTARIO, percentualNaMadrugada } from "./efeito-amplificador-tipos";

/**
 * O espelho do hub contra a api (lida como TEXTO: o hub não importa a api).
 * Uma lista de valores a mais é a que ninguém atualiza junto.
 */
const API = join(__dirname, "../../api/src/efeito-amplificador");
const conteudo = readFileSync(join(API, "conteudo.ts"), "utf8");
const passos = readFileSync(join(API, "regras/passos.ts"), "utf8");

const lista = (fonte: string, nome: string) => {
  const m = new RegExp(`export const ${nome} = \\[([^\\]]+)\\] as const`).exec(fonte);
  return m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};

describe("o espelho dos vocabulários", () => {
  test.each([
    ["DISCIPLINAS", DISCIPLINAS, conteudo],
    ["ORIGENS", ORIGENS, conteudo],
    ["NOS", NOS, conteudo],
    ["MANCHETES", MANCHETES, conteudo],
    ["TIPOS_DE_COMENTARIO", TIPOS_DE_COMENTARIO, conteudo],
    ["FASES", FASES, conteudo],
    ["PASSOS", PASSOS, passos],
  ])("%s", (nome, valores, fonte) => {
    expect(lista(fonte, nome)).toEqual([...valores]);
  });
});

test("100% das publicações na madrugada quando alguém publicou; nada antes disso", () => {
  const base = { unidades: 3, manchetes: { neutra: 1, construtiva: 1, sensacionalista: 0 }, entrega: [] };
  expect(percentualNaMadrugada({ ...base, publicaram: 2, picoNaMadrugada: 2 })).toBe(100);
  expect(percentualNaMadrugada({ ...base, publicaram: 0, picoNaMadrugada: 0 })).toBeNull();
});

test("o recorte segue o Zod da api", async () => {
  const { problemasDoRecorte, topicosDoTexto } = await import("./efeito-amplificador-tipos");
  expect(topicosDoTexto("Luz azul\n\n Sono  \nRetenção")).toEqual(["Luz azul", "Sono", "Retenção"]);
  expect(problemasDoRecorte({ disciplina: "biologia", tema: "Telas e sono", topicos: ["aa", "bb", "cc"], contexto: "" })).toEqual([]);
  expect(problemasDoRecorte({ disciplina: "", tema: "x", topicos: ["aa"], contexto: "" })).toHaveLength(3);
});
