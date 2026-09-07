import { describe, expect, it } from "vitest";

import { estadoDaTelaDoPlano } from "./estado-do-plano";

/**
 * O caso que dá nome a este arquivo é o primeiro: `pendente` mostrando barra de
 * progresso. Os outros existem para que consertá-lo não quebre o resto.
 */
describe("estadoDaTelaDoPlano", () => {
  it("plano pendente CONVIDA a gerar — nunca finge que já está gerando", () => {
    // O bug: aqui a tela mostrava a barra indeterminada e "a geração continua
    // no servidor", com o servidor parado e nenhuma geração disparada.
    expect(estadoDaTelaDoPlano("pendente", null)).toBe("convite");
  });

  it("só `gerando` mostra progresso", () => {
    expect(estadoDaTelaDoPlano("gerando", null)).toBe("gerando");
  });

  it("plano que falhou convida a tentar de novo", () => {
    expect(estadoDaTelaDoPlano("erro", null)).toBe("convite");
  });

  it("plano pronto mostra o documento", () => {
    expect(estadoDaTelaDoPlano("pronto", "<p>plano</p>")).toBe("documento");
  });

  it("pronto sem documento carregado ainda convida: não há o que exibir", () => {
    expect(estadoDaTelaDoPlano("pronto", null)).toBe("convite");
  });

  it("regeneração em curso esconde o documento pelo progresso", () => {
    expect(estadoDaTelaDoPlano("gerando", "<p>plano anterior</p>")).toBe("gerando");
  });

  it("regeneração que falhou preserva o documento que o professor já tinha", () => {
    expect(estadoDaTelaDoPlano("erro", "<p>plano anterior</p>")).toBe("documento");
  });
});
