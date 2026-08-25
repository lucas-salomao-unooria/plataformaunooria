import { describe, expect, test } from "vitest";
import { mensagemDoStatus, rotuloDaSerie, rotuloDoStatus, telaDoStatus } from "./estado";

describe("máquina de telas do polling", () => {
  test("pendente/gerando ficam na geração; pronto abre o editor; erro volta à escolha", () => {
    expect(telaDoStatus("pendente")).toBe("gerando");
    expect(telaDoStatus("gerando")).toBe("gerando");
    expect(telaDoStatus("pronto")).toBe("resultado");
    expect(telaDoStatus("erro")).toBe("novo");
  });

  test("mensagens por status HTTP", () => {
    expect(mensagemDoStatus(409)).toMatch(/já tem um plano/);
    expect(mensagemDoStatus(429)).toMatch(/Limite/);
    expect(mensagemDoStatus(400)).toMatch(/material de referência/);
    expect(mensagemDoStatus(null, "padrão")).toBe("padrão");
  });

  test("rótulo de status", () => {
    expect(rotuloDoStatus("pronto")).toEqual({ texto: "Pronto", variante: "success" });
    expect(rotuloDoStatus("erro").variante).toBe("error");
  });
});

describe("série ↔ rótulo", () => {
  test("EF e EM", () => {
    expect(rotuloDaSerie("2EF")).toBe("2º ano");
    expect(rotuloDaSerie("8EF")).toBe("8º ano");
    expect(rotuloDaSerie("2EM")).toBe("2ª série EM");
  });
});
