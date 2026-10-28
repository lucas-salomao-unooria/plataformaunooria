import { describe, expect, test } from "vitest";
import { instrucaoDoEstado } from "./instrucao-da-experiencia";

describe("a instrução fora do aparelho (exp:estado)", () => {
  test("a forma certa vira instrução", () => {
    expect(instrucaoDoEstado({ instrucao: { antes: "O post sobre ", destaque: "Telas e sono", depois: " viralizou." } })).toEqual({
      antes: "O post sobre ",
      destaque: "Telas e sono",
      depois: " viralizou.",
    });
  });

  test("ausente, fora da forma ou vazia: nada na tela", () => {
    expect(instrucaoDoEstado({})).toBeNull();
    expect(instrucaoDoEstado({ fase: "perdidos" })).toBeNull();
    expect(instrucaoDoEstado({ instrucao: "texto solto" })).toBeNull();
    expect(instrucaoDoEstado({ instrucao: { antes: "a", destaque: 1, depois: "b" } })).toBeNull();
    expect(instrucaoDoEstado({ instrucao: { antes: "a", destaque: "b" } })).toBeNull();
    expect(instrucaoDoEstado({ instrucao: { antes: " ", destaque: "", depois: "" } })).toBeNull();
    expect(instrucaoDoEstado({ instrucao: { antes: "x".repeat(1001), destaque: "b", depois: "c" } })).toBeNull();
  });

  test("campo a mais é descartado, não repassado", () => {
    expect(instrucaoDoEstado({ instrucao: { antes: "a", destaque: "b", depois: "c", html: "<b>x</b>" } })).toEqual({
      antes: "a",
      destaque: "b",
      depois: "c",
    });
  });
});
