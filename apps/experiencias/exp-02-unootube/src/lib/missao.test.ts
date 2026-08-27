import { describe, expect, test } from "vitest";
import { missaoNaoIniciada, telaInicial } from "./missao";
import type { EstadoMissao } from "./tipos";

const zerado: EstadoMissao = {
  salvos: [],
  curtidos: [],
  rankingDesbloqueado: false,
  credibilidadeAdicionada: false,
  concluidoEm: null,
};

describe("telaInicial", () => {
  test("missão zerada abre na entrada", () => {
    expect(missaoNaoIniciada(zerado)).toBe(true);
    expect(telaInicial(zerado)).toBe("entrada");
  });

  test("um salvo já basta para pular o briefing", () => {
    expect(telaInicial({ ...zerado, salvos: ["v01"] })).toBe("feed");
  });

  test("curtir também conta como ter começado", () => {
    expect(telaInicial({ ...zerado, curtidos: ["v02"] })).toBe("feed");
  });

  /**
   * O aluno pode ter salvo 3 e removido depois: `salvos` volta a zero, mas o
   * ranking já destravou (é latch no servidor) e a missão claramente começou.
   */
  test("ranking destravado com salvos zerados ainda é missão começada", () => {
    expect(telaInicial({ ...zerado, rankingDesbloqueado: true })).toBe("feed");
  });

  test("missão concluída não volta ao briefing", () => {
    expect(telaInicial({ ...zerado, rankingDesbloqueado: true, credibilidadeAdicionada: true })).toBe("feed");
  });
});
