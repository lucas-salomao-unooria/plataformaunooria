import { describe, expect, test } from "vitest";
import { bannerDoAviso, confirmacaoDoRelato, estadoParaOHub, etapaDoPasso, iniciais, partirOpcao, proximaOpcao } from "./lib/regras";
import type { Estado } from "./lib/tipos";

const instrucao = { antes: "O post sobre ", destaque: "Convivência Escolar e Celular", depois: " viralizou." };
const feed = {
  comentarios: [],
  perfilSuspeito: null,
  aviso: null,
  contaPrivada: false,
  restringirComentarios: false,
  denunciou: false,
  relatos: [],
  metrica: "4.820 impressões entre 01h00 e 03h30",
  instrucao,
} satisfies NonNullable<Estado["feed"]>;

describe("o TC-10 que vai para o hub (exp:estado)", () => {
  test("no feed, a instrução exatamente como a api a manda", () => {
    expect(estadoParaOHub({ passo: "feed", feed }, false)).toEqual({ instrucao });
  });

  test("durante o relógio ainda não é o feed: o hub não desenha nada", () => {
    expect(estadoParaOHub({ passo: "feed", feed }, true)).toEqual({});
  });

  test.each(["abertura", "conversa", "explicar", "concluida"] as const)("em %s o objeto vazio a retira", (passo) => {
    expect(estadoParaOHub({ passo, feed }, false)).toEqual({});
  });

  test("feed sem dado (ainda não chegou) não publica instrução pela metade", () => {
    expect(estadoParaOHub({ passo: "feed", feed: null }, false)).toEqual({});
  });
});

describe("a etapa da telemetria", () => {
  test("cada passo do servidor tem a etapa do PRD", () => {
    expect(["abertura", "conversa", "feed", "explicar", "concluida"].map((p) => etapaDoPasso(p as Estado["passo"]))).toEqual([
      "E1",
      "E2",
      "E4",
      "E5",
      "E6",
    ]);
  });
});

describe("os textos do feed", () => {
  test("o banner do aviso fixado, um por motivo (o de saúde é a copy literal)", () => {
    expect(bannerDoAviso("saude_usuarios")).toBe("Aviso fixado: Conteúdo pode afetar a saúde de quem lê");
    expect(bannerDoAviso("fonte_duvidosa")).toBe("Aviso fixado: Informação sem fonte confiável");
    expect(bannerDoAviso("ofensivo")).toBe("Aviso fixado: Conteúdo ofensivo.");
  });

  test("a confirmação do relato muda com o destino (TC-15 e TC-16)", () => {
    expect(confirmacaoDoRelato("escola")).toBe("Relato encaminhado à equipe de apoio da escola");
    expect(confirmacaoDoRelato("unoovista")).toBe("Relato encaminhado à equipe do Unoovista");
  });

  test("a opção de destino se parte no primeiro dois-pontos", () => {
    expect(partirOpcao("Equipe do Unoovista: situações de abuso, assédio ou exposição na plataforma")).toEqual([
      "Equipe do Unoovista",
      "situações de abuso, assédio ou exposição na plataforma",
    ]);
    expect(partirOpcao("sem dois-pontos")).toEqual(["sem dois-pontos", ""]);
  });

  test("as iniciais do avatar, de nome e de conta", () => {
    expect(iniciais("Clara")).toBe("C");
    expect(iniciais("radar_escola_off")).toBe("RE");
    expect(iniciais("user_89412")).toBe("U8");
  });
});

describe("as setas num grupo de rádio", () => {
  test("descem, sobem e dão a volta", () => {
    expect(proximaOpcao(-1, "ArrowDown", 3)).toBe(0);
    expect(proximaOpcao(2, "ArrowDown", 3)).toBe(0);
    expect(proximaOpcao(0, "ArrowUp", 3)).toBe(2);
    expect(proximaOpcao(-1, "ArrowUp", 3)).toBe(2);
    expect(proximaOpcao(1, "ArrowRight", 3)).toBe(2);
  });

  test("outra tecla não mexe", () => {
    expect(proximaOpcao(1, "Enter", 3)).toBeNull();
    expect(proximaOpcao(0, "ArrowDown", 0)).toBeNull();
  });
});
