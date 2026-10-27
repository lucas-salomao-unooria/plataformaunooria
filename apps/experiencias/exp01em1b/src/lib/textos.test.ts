import { describe, expect, test } from "vitest";
import { citarAposta, linhaDoBloco, otimizacao, rotuloDoCriterio, textoDoMedidor, TEXTOS } from "./textos";

describe("a citação da aposta (E4-ALU-02)", () => {
  test("é o TEXTO INTEIRO da opção, entre aspas simples, sem o ponto final", () => {
    expect(citarAposta("Apenas alguns receberão Avançado, pois o assistente fará triagem.")).toBe(
      "'Apenas alguns receberão Avançado, pois o assistente fará triagem'",
    );
  });

  test("monta a frase do Figma para a aposta C", () => {
    const frase = TEXTOS.e4.confronto.c(citarAposta("Todos receberão nível Básico até comprovarem proficiência."));
    expect(frase).toBe(
      "Você previu: 'Todos receberão nível Básico até comprovarem proficiência'. Mas Lucas recebeu o Avançado imediatamente, enquanto Beatriz foi rebaixada. Se nenhum dos dois fez prova antes, o que o sistema usou para separá-los?",
    );
  });
});

describe("a otimização 5 → N (E5-ALU-02)", () => {
  test("N = 5 − marcados: a conta do estudante, não o gabarito", () => {
    expect(otimizacao(3)).toBe("Otimização: de 5 para 2 passos essenciais");
    expect(otimizacao(1)).toBe("Otimização: de 5 para 4 passos essenciais");
    expect(otimizacao(4)).toBe("Otimização: de 5 para 1 passo essencial");
    expect(otimizacao(5)).toBe("Otimização: de 5 para 0 passos essenciais");
  });

  test("fora da faixa não passa de 0 a 5", () => {
    expect(otimizacao(9)).toBe("Otimização: de 5 para 0 passos essenciais");
    expect(otimizacao(-1)).toBe("Otimização: de 5 para 5 passos essenciais");
  });
});

describe("o medidor da turma", () => {
  test("agregado, no texto do Figma", () => {
    expect(textoDoMedidor({ a: 74, b: 18, c: 8, total: 27 })).toBe(
      "Na sua turma: 74% apostou que o cadastro seria cumprido integralmente (A), 18% previu triagem parcial (B) e 8% previu básico para todos (C)",
    );
  });

  test("sem medidor (menos de 3 apostas), nada", () => {
    expect(textoDoMedidor(null)).toBeNull();
  });
});

describe("o comunicado montado (E6-ALU-01)", () => {
  test("o bloco 1 termina em reticências; os outros, em ponto", () => {
    const l1 = linhaDoBloco("Identificamos que o assistente estava...", "restringindo acessos automaticamente", 0);
    expect(`${l1.antes}${l1.trecho}${l1.fecho}`).toBe("Identificamos que o assistente estava restringindo acessos automaticamente...");
    const l2 = linhaDoBloco("...ao deduzir perfil de estudo a partir de...", "metadados de horário e oscilação de rede", 1);
    expect(`${l2.antes}${l2.trecho}${l2.fecho}`).toBe("...ao deduzir perfil de estudo a partir de metadados de horário e oscilação de rede.");
  });
});

test("o critério leva a letra da função ('Critério 2C: …')", () => {
  expect(rotuloDoCriterio("duvidas", "c", "Sem limite")).toBe("Critério 2C: Sem limite");
});
