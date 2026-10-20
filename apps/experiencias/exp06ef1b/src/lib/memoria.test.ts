import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { gravarMemoria, lerMemoria } from "./memoria";

/** Um `sessionStorage` de mentira: o vitest roda em Node, sem `window`. */
class ArmazenamentoFalso {
  dados = new Map<string, string>();
  getItem(k: string) {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.dados.set(k, v);
  }
}

const global = globalThis as unknown as { window?: { sessionStorage: unknown } };
const CHAVE = { estudanteId: "e1", pacoteId: "p1", rodada: 1 };

describe("a memória de F5 (sessionStorage, só ids e números)", () => {
  let armazenamento: ArmazenamentoFalso;

  beforeEach(() => {
    armazenamento = new ArmazenamentoFalso();
    global.window = { sessionStorage: armazenamento };
  });

  afterEach(() => {
    delete global.window;
  });

  test("grava e lê de volta as peças da regra e a dica do gesto", () => {
    gravarMemoria(CHAVE, { se: "rg-x1y", entao: "rg-z2w" });
    gravarMemoria(CHAVE, { gestoUsado: true });
    const m = lerMemoria(CHAVE);
    expect([m.se, m.entao]).toEqual(["rg-x1y", "rg-z2w"]);
    expect(m.gestoUsado).toBe(true);
    /* A separação e os cartões da 0.6.0 saíram (ADR-176): a memória não os guarda mais. */
    expect(m).not.toHaveProperty("separacao");
    expect(m).not.toHaveProperty("mecanismo");
  });

  test("a rodada nova (e o estudante seguinte) não herdam nada", () => {
    gravarMemoria(CHAVE, { se: "rg-xyz" });
    expect(lerMemoria({ ...CHAVE, rodada: 2 }).se).toBeNull();
    expect(lerMemoria({ ...CHAVE, estudanteId: "e2" }).se).toBeNull();
  });

  test("o que não tem cara de id não entra — nem texto escrito por engano", () => {
    armazenamento.setItem(
      "exp06ef1b:e1:p1:1",
      JSON.stringify({ permanencias: ["proj-a1:apresentacao", "um texto com espaço"], entao: 3, se: "texto livre" }),
    );
    const m = lerMemoria(CHAVE);
    expect(m.permanencias).toEqual(["proj-a1:apresentacao"]);
    expect(m.entao).toBeNull();
    expect(m.se).toBeNull();
  });

  test("armazenamento bloqueado: memória vazia, nunca exceção", () => {
    global.window = {
      sessionStorage: {
        getItem: () => {
          throw new Error("bloqueado");
        },
        setItem: () => {
          throw new Error("bloqueado");
        },
      },
    };
    expect(() => gravarMemoria(CHAVE, { gestoUsado: true })).not.toThrow();
    expect(lerMemoria(CHAVE).gestoUsado).toBe(false);
  });
});
