import { describe, expect, test } from "vitest";
import { roteiroDaSimulacao, roteiroDoReteste } from "./roteiro";
import type { ConteudoDoPacote, MaterialFixo } from "./tipos";

const c: ConteudoDoPacote = {
  versao: 1,
  trilhaAvancada: { titulo: "Trilha Avançada: X", enunciado: "ex-a" },
  reforcoBasico: { titulo: "Reforço Básico: Y", enunciado: "ex-b" },
  duvidas: { lucas: "dL", beatriz: "dB", thiago1: "dT1", thiago2: "dT2", thiago3: "dT3" },
  respostas: { lucas: "rL", beatriz: "rB", thiago1: "rT1", thiago2: "rT2", thiago3: "rT3" },
  leitura: { titulo: "L", resumo: "l" },
};
const m = { avisos: { beatriz: "rebaixou", thiago: "limitou" } } as MaterialFixo;
const textos = (f: ReturnType<typeof roteiroDaSimulacao>) => f.map((x) => (x.tipo === "cartao" ? `[${x.titulo}]` : x.texto));

describe("a bateria de testes (E4-ALU-01)", () => {
  test("Lucas avança; Beatriz recebe o aviso e o Reforço Básico; Thiago tem 2 respostas e o limite na 3ª", () => {
    expect(textos(roteiroDaSimulacao(c, m))).toEqual([
      "dL",
      "Olá, Lucas! Seja bem-vindo à plataforma.",
      "[Trilha Avançada: X]",
      "rL",
      "--- Sessão 2/3: Beatriz (23h45) ---",
      "dB",
      "Aviso de Sistema: rebaixou",
      "[Reforço Básico: Y]",
      "--- Sessão 3/3: Thiago (Sinal Instável) ---",
      "dT1",
      "rT1",
      "dT2",
      "rT2",
      "dT3",
      "Aviso de Sistema: limitou",
    ]);
  });

  test("a resposta avançada da Beatriz e a 3ª do Thiago NÃO aparecem na bateria", () => {
    const t = textos(roteiroDaSimulacao(c, m));
    expect(t).not.toContain("rB");
    expect(t).not.toContain("rT3");
  });
});

describe("o efeito do reteste no chat (E5-ALU-04)", () => {
  test("com equidade total: Beatriz avançada e Thiago livre", () => {
    const t = textos(roteiroDoReteste(c, m, { equidade: "total", beatrizAvancada: true, thiagoLivre: true }));
    expect(t).toContain("rB");
    expect(t).toContain("[Trilha Avançada: X]");
    expect(t).toContain("rT3");
    expect(t.join(" ")).not.toContain("Aviso de Sistema");
  });

  test("com o viés mantido: os dois avisos de sistema voltam", () => {
    const t = textos(roteiroDoReteste(c, m, { equidade: "nenhuma", beatrizAvancada: false, thiagoLivre: false }));
    expect(t).toContain("Aviso de Sistema: rebaixou");
    expect(t).toContain("Aviso de Sistema: limitou");
    expect(t).not.toContain("rB");
  });
});
