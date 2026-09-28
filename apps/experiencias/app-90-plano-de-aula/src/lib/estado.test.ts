import { describe, expect, test } from "vitest";
import { DISCIPLINAS_CATALOGO } from "./curriculo";
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
  test("EF e EM cobrindo todos os anos do catálogo", () => {
    expect(rotuloDaSerie("2EF")).toBe("2º ano");
    expect(rotuloDaSerie("4EF")).toBe("4º ano");
    expect(rotuloDaSerie("6EF")).toBe("6º ano");
    expect(rotuloDaSerie("8EF")).toBe("8º ano");
    expect(rotuloDaSerie("2EM")).toBe("2ª série EM");
  });
});

describe("catálogo de disciplinas", () => {
  test("possui 15 disciplinas canônicas da Educação Básica", () => {
    expect(DISCIPLINAS_CATALOGO).toHaveLength(15);
    expect(DISCIPLINAS_CATALOGO[0]).toEqual({ slug: "letramento-digital", label: "Letramento Digital" });
    expect(DISCIPLINAS_CATALOGO.some((d) => d.slug === "matematica")).toBe(true);
    expect(DISCIPLINAS_CATALOGO.some((d) => d.slug === "lingua-portuguesa")).toBe(true);
  });
});
