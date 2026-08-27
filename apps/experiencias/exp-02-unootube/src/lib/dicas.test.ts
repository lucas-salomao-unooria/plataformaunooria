import { describe, expect, test } from "vitest";
import { dicaDoFeed } from "./dicas";

const base = { carregando: false, salvos: 0, limite: 3 };

describe("dicaDoFeed", () => {
  test("carregando vence qualquer outro estado", () => {
    expect(dicaDoFeed({ ...base, carregando: true, salvos: 3 })).toBe(
      "Aguarde um instante: o Short está sendo preparado.",
    );
  });

  test("sem nenhum salvo, orienta a explorar", () => {
    expect(dicaDoFeed(base)).toBe("Use Anterior e Próximo para ver todos os Shorts.");
  });

  test("no meio do caminho, conta quantos faltam", () => {
    expect(dicaDoFeed({ ...base, salvos: 1 })).toBe("Vídeo salvo! Você já escolheu 1 de 3 favoritos.");
    expect(dicaDoFeed({ ...base, salvos: 2 })).toBe("Vídeo salvo! Você já escolheu 2 de 3 favoritos.");
  });

  test("no limite, aponta para o botão de concluir", () => {
    expect(dicaDoFeed({ ...base, salvos: 3 })).toBe(
      "Pronto! Seus 3 favoritos estão escolhidos. Toque em Concluir missão.",
    );
  });

  test("o limite vem do servidor, não da copy", () => {
    expect(dicaDoFeed({ carregando: false, salvos: 4, limite: 5 })).toBe(
      "Vídeo salvo! Você já escolheu 4 de 5 favoritos.",
    );
  });

  /** Nenhuma variante pode comentar a ESCOLHA — isso é do ranking, depois. */
  test("nenhuma dica fala de verdadeiro, falso ou confiança", () => {
    const proibidas = /confi|verdad|fals|fake|errad|cert|melhor|pior/i;
    for (const salvos of [0, 1, 2, 3]) {
      for (const carregando of [true, false]) {
        expect(dicaDoFeed({ carregando, salvos, limite: 3 })).not.toMatch(proibidas);
      }
    }
  });
});
