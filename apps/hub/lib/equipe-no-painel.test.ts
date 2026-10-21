import { describe, expect, test } from "vitest";
import { chaveDaLinha, nomesDosMembros } from "./equipe-no-painel";

const equipe = {
  id: "e1",
  nome: "Equipe 1",
  membros: [
    { id: "a", nome: "Ana Souza" },
    { id: "b", nome: "Bia Lima" },
    { id: "c", nome: "Caio Reis" },
  ],
};

describe("painel por computador", () => {
  test("a chave da linha é a EQUIPE quando há — o representante pode mudar no meio da aula", () => {
    expect(chaveDaLinha({ estudanteId: "a", equipe })).toBe("equipe:e1");
    expect(chaveDaLinha({ estudanteId: "b", equipe })).toBe("equipe:e1");
    expect(chaveDaLinha({ estudanteId: "a", equipe: null })).toBe("estudante:a");
  });

  test("os membros viram uma frase em pt-BR, na ordem da api", () => {
    expect(nomesDosMembros(equipe)).toBe("Ana Souza, Bia Lima e Caio Reis");
    expect(nomesDosMembros({ ...equipe, membros: equipe.membros.slice(0, 2) })).toBe("Ana Souza e Bia Lima");
  });
});
