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

describe("a memória de F5 (sessionStorage, só ids e números)", () => {
  let armazenamento: ArmazenamentoFalso;

  beforeEach(() => {
    armazenamento = new ArmazenamentoFalso();
    global.window = { sessionStorage: armazenamento };
  });

  afterEach(() => {
    delete global.window;
  });

  test("grava e lê de volta os salvos, os desmarcados e o card", () => {
    gravarMemoria("s1", { salvos: ["post_a_1", "post_b_2"], desmarcados: ["post_b_2"] });
    gravarMemoria("s1", { card: 2 });
    expect(lerMemoria("s1")).toEqual({
      salvos: ["post_a_1", "post_b_2"],
      desmarcados: ["post_b_2"],
      tempoFeedS: 0,
      card: 2,
      votos: {},
    });
  });

  test("a chave é da SESSÃO: zerar a turma não traz os salvos da rodada anterior", () => {
    gravarMemoria("rodada-1", { salvos: ["post_a_1"] });
    expect(lerMemoria("rodada-2").salvos).toEqual([]);
  });

  test("lixo no armazenamento vira memória vazia, nunca exceção", () => {
    armazenamento.setItem("exp07ef1b:s1", "{isto não é json");
    expect(lerMemoria("s1").salvos).toEqual([]);
    armazenamento.setItem("exp07ef1b:s1", JSON.stringify({ salvos: [1, "post_a_1", null], card: -3, votos: { p1: 7, p2: "B1" } }));
    expect(lerMemoria("s1")).toMatchObject({ salvos: ["post_a_1"], card: 0, votos: { p2: "B1" } });
  });

  test("armazenamento bloqueado (aba anônima): lê vazio e grava em silêncio", () => {
    global.window = {
      sessionStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("SecurityError");
        },
      },
    };
    expect(lerMemoria("s1").salvos).toEqual([]);
    expect(() => gravarMemoria("s1", { salvos: ["post_a_1"] })).not.toThrow();
  });

  test("nenhum campo de TEXTO de criança existe na memória", () => {
    gravarMemoria("s1", { salvos: ["post_a_1"] });
    const guardado = JSON.parse(armazenamento.getItem("exp07ef1b:s1") ?? "{}") as Record<string, unknown>;
    expect(Object.keys(guardado).sort()).toEqual(["card", "desmarcados", "salvos", "tempoFeedS", "votos"]);
  });
});
