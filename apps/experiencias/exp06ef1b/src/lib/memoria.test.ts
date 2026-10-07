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

  test("grava e lê de volta a calha, os cartões e as enquetes", () => {
    gravarMemoria(CHAVE, { ordemDaCadeia: ["bl-a1b", "bl-c2d"], mecanismo: "m1", votos: { p1: "D2" } });
    gravarMemoria(CHAVE, { gestoUsado: true });
    const m = lerMemoria(CHAVE);
    expect(m.ordemDaCadeia).toEqual(["bl-a1b", "bl-c2d"]);
    expect(m.mecanismo).toBe("m1");
    expect(m.votos).toEqual({ p1: "D2" });
    expect(m.gestoUsado).toBe(true);
  });

  test("a rodada nova (e o estudante seguinte) não herdam nada", () => {
    gravarMemoria(CHAVE, { ordemDaCadeia: ["bl-xyz"] });
    expect(lerMemoria({ ...CHAVE, rodada: 2 }).ordemDaCadeia).toEqual([]);
    expect(lerMemoria({ ...CHAVE, estudanteId: "e2" }).ordemDaCadeia).toEqual([]);
  });

  test("o que não tem cara de id não entra — nem texto escrito por engano", () => {
    armazenamento.setItem("exp06ef1b:e1:p1:1", JSON.stringify({ ordemDaCadeia: ["bl-a1b", "um texto com espaço"], mecanismo: 3 }));
    const m = lerMemoria(CHAVE);
    expect(m.ordemDaCadeia).toEqual(["bl-a1b"]);
    expect(m.mecanismo).toBeNull();
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
