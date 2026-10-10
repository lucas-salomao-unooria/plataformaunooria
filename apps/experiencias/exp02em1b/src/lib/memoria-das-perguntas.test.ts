import { describe, expect, it } from "vitest";
import { chave, gravarEnviadas, lerEnviadas, limparOutras, PREFIXO } from "./memoria-das-perguntas";

/** Um `Storage` em memória: o da aba, compartilhado por quem usa a máquina. */
function aba(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

const ANA = { estudanteId: "ana", rodadaDaTurma: 1, tentativa: 1 };

describe("a memória das perguntas de evidência é da PARTIDA, não da aba", () => {
  it("o F5 da mesma partida devolve as respostas", () => {
    const s = aba();
    gravarEnviadas(s, ANA, { p1: "A1" });
    expect(lerEnviadas(s, ANA)).toEqual({ p1: "A1" });
  });

  it("depois do zerar (rodada nova, tentativa de volta a 1) nada vem marcado", () => {
    const s = aba();
    gravarEnviadas(s, ANA, { p1: "A1", p2: "B2" });
    expect(lerEnviadas(s, { ...ANA, rodadaDaTurma: 2 })).toEqual({});
  });

  it("outro estudante na mesma aba não herda as respostas", () => {
    const s = aba();
    gravarEnviadas(s, ANA, { p1: "A1" });
    expect(lerEnviadas(s, { ...ANA, estudanteId: "bia" })).toEqual({});
  });

  it("ao montar, apaga as chaves de outras partidas, inclusive as do formato velho (só a tentativa)", () => {
    const s = aba();
    s.setItem(`${PREFIXO}1`, JSON.stringify({ p1: "A1" }));
    gravarEnviadas(s, ANA, { p1: "A1" });
    const bia = { ...ANA, estudanteId: "bia" };
    gravarEnviadas(s, bia, { p2: "B1" });
    s.setItem("outra-coisa", "fica");
    limparOutras(s, bia);
    expect(s.getItem(`${PREFIXO}1`)).toBeNull();
    expect(s.getItem(chave(ANA))).toBeNull();
    expect(lerEnviadas(s, bia)).toEqual({ p2: "B1" });
    expect(s.getItem("outra-coisa")).toBe("fica");
  });

  it("sem armazenamento (bloqueado), a tela segue sem memória", () => {
    expect(lerEnviadas(null, ANA)).toEqual({});
    expect(() => gravarEnviadas(null, ANA, { p1: "A1" })).not.toThrow();
    expect(() => limparOutras(null, ANA)).not.toThrow();
  });
});
