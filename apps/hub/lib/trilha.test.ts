import { describe, expect, test } from "vitest";
import { itensDaRota } from "./trilha";

/**
 * O registro de rotas da trilha. Estes testes existem porque o modo de falha
 * dele é SILENCIOSO: nenhuma destas quebras produz erro de tipo nem exceção —
 * a trilha só passa a dizer outra coisa, em dezenas de telas, e ninguém nota
 * até o dono do produto notar. Foi assim que a lacuna original nasceu.
 */

const rotulos = (pathname: string, papel: Parameters<typeof itensDaRota>[1]) =>
  itensDaRota(pathname, papel).map((i) => i.label);

describe("o primeiro item é sempre a home do papel", () => {
  test("professor", () => {
    expect(itensDaRota("/professor/turmas", "professor")[0]).toEqual({
      label: "Início",
      href: "/professor",
    });
  });

  test("gestor e admin-contrato compartilham a mesma área", () => {
    expect(itensDaRota("/admin/turmas", "gestor_escola")[0]?.href).toBe("/admin/usuarios");
    expect(itensDaRota("/analise", "gestor_contrato")[0]?.href).toBe("/admin/usuarios");
  });
});

describe("a home do papel não leva trilha", () => {
  test("um item só, que é a própria página, é ruído", () => {
    expect(itensDaRota("/professor", "professor")).toEqual([]);
    expect(itensDaRota("/admin/usuarios", "gestor_escola")).toEqual([]);
    expect(itensDaRota("/estudante", "estudante")).toEqual([]);
  });

  test("mas a rota seguinte da área nasce com trilha, sem tocar a página", () => {
    expect(rotulos("/professor/turmas", "professor")).toEqual(["Início", "Minhas turmas"]);
  });
});

describe("o slug do ano — a cópia que pode divergir de lib/entre-redes/catalogo.ts", () => {
  test("ano do Fundamental", () => {
    expect(rotulos("/professor/entre-redes/8-ano/unidade-1", "professor")).toEqual([
      "Início",
      "Entre Redes",
      "8º ano · Unidade 1",
    ]);
  });

  test("série do Médio — o OUTRO formato, que é o que se esquece", () => {
    expect(rotulos("/professor/entre-redes/2-serie/unidade-1", "professor")).toEqual([
      "Início",
      "Entre Redes",
      "2ª série · Unidade 1",
    ]);
  });

  test("formato desconhecido degrada para o genérico, sem quebrar a trilha", () => {
    expect(rotulos("/professor/entre-redes/oitavo/unidade-1", "professor")).toEqual([
      "Início",
      "Entre Redes",
      "Missão",
    ]);
  });
});

describe("padrão literal ganha de padrão com curinga", () => {
  test("vila-do-lume não é um [ano]", () => {
    expect(rotulos("/professor/entre-redes/vila-do-lume/resultados", "professor")).toEqual([
      "Início",
      "Entre Redes",
      "Vila do Lume",
      "Resultados da turma",
    ]);
  });
});

describe("aPaginaDesenha: o escape declarado dos guias da aula", () => {
  test("o layout se cala nas duas rotas de guia", () => {
    expect(itensDaRota("/professor/entre-redes/8-ano/unidade-1/guia", "professor")).toEqual([]);
    expect(itensDaRota("/professor/entre-redes/vila-do-lume/guia", "professor")).toEqual([]);
  });
});

describe("segmento oculto não entra na trilha", () => {
  test("o [ano] sozinho não tem tela", () => {
    expect(rotulos("/professor/entre-redes/8-ano/unidade-1", "professor")).not.toContain("Missão");
  });

  test("/analise/atividades sairia duplicado, porque /analise já é prefixo", () => {
    expect(rotulos("/analise/atividades/abc123def456ghij", "gestor_contrato")).toEqual([
      "Início",
      "Análise de produto",
      "Atividade",
    ]);
  });
});

describe("o id do endereço NUNCA vira rótulo", () => {
  test("sem publicação da página, o item fica no rótulo de domínio", () => {
    const itens = itensDaRota("/professor/turmas/clx8f9a2b0001abcd", "professor");
    expect(itens.at(-1)).toEqual({ label: "Turma" });
    expect(JSON.stringify(itens)).not.toContain("clx8f9a2b0001abcd");
  });

  test("rota não registrada humaniza o segmento, mas some com o id", () => {
    const itens = itensDaRota("/professor/relatorios/clx8f9a2b0001abcd", "professor");
    expect(itens.map((i) => i.label)).toEqual(["Início", "Relatorios", "Detalhe"]);
  });
});

describe("o que a página publica só MELHORA a trilha", () => {
  test("o nome próprio troca o rótulo de domínio", () => {
    const itens = itensDaRota("/professor/turmas/abc", "professor", {
      "/professor/turmas/abc": { label: "Turma 8A" },
    });
    expect(itens.at(-1)).toEqual({ label: "Turma 8A" });
  });

  test("`para` nomeia um ANTEPASSADO, não a própria página", () => {
    const itens = itensDaRota("/professor/atividades/abc/analise", "professor", {
      "/professor/atividades/abc": { label: "Debate sobre energia" },
    });
    expect(itens.map((i) => i.label)).toEqual([
      "Início",
      "Entre Redes",
      "Debate sobre energia",
      "Análise da turma",
    ]);
  });

  test("publicação vazia não apaga a trilha — é a assimetria que fecha a lacuna", () => {
    const itens = itensDaRota("/professor/turmas/abc", "professor", {});
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.at(-1)?.label).toBe("Turma");
  });
});

describe("endereços", () => {
  test("o último item nunca é link", () => {
    for (const rota of [
      "/professor/turmas",
      "/professor/turmas/abc",
      "/admin/escolas",
      "/analise/atividades/abc",
      "/professor/entre-redes/8-ano/unidade-1/resultados",
    ]) {
      const itens = itensDaRota(rota, "professor");
      expect(itens.at(-1)?.href, rota).toBeUndefined();
    }
  });

  test("o nó que não tem tela empresta o lugar de quem o contém", () => {
    // `/professor/atividades` não existe como página: aponta para o produto.
    const itens = itensDaRota("/professor/atividades/abc", "professor");
    expect(itens[1]).toEqual({ label: "Entre Redes", href: "/professor/entre-redes" });
  });

  test("o perfil do estudante volta para a ABA de estudantes da turma", () => {
    expect(itensDaRota("/professor/turmas/t1/estudantes/e1", "professor")).toEqual([
      { label: "Início", href: "/professor" },
      { label: "Minhas turmas", href: "/professor/turmas" },
      { label: "Turma", href: "/professor/turmas/t1" },
      { label: "Estudantes", href: "/professor/turmas/t1?aba=estudantes" },
      { label: "Estudante" },
    ]);
  });

  test("`.../estudantes` devolve para a tela de resultados da própria missão", () => {
    const itens = itensDaRota(
      "/professor/entre-redes/8-ano/unidade-1/estudantes/xyz",
      "professor",
    );
    expect(itens.at(-2)).toEqual({
      label: "Resultados da turma",
      href: "/professor/entre-redes/8-ano/unidade-1/resultados",
    });
  });
});
