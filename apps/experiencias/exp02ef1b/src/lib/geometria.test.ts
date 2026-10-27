import { describe, expect, test } from "vitest";
import {
  arrastarDeslocamento,
  deslocarPorTecla,
  encaixar,
  estiloDaJanela,
  fraseDaMissao,
  fraseDoFora,
  ladoEscondido,
  lente,
  pontoNaImagem,
  posicaoNaCaixa,
  proporcaoDaJanela,
  retanguloVisivel,
  revelouTudo,
  urlDaImagem,
} from "./geometria";

/** A geometria do contrato (`GeometriaSchema` da api): a capa é 80% × 80% da foto; a foto 1 é x 0–68. */
const FOTO_1 = { x: 0, y: 0, w: 68, h: 100 };
const FOTO_2 = { x: 32, y: 0, w: 68, h: 100 };
const CAPA = { w: 0.8, h: 0.8 };
const PANORAMICA = 16 / 9;

describe("a moldura de tamanho fixo (E3, E5): só desloca, nunca mostra vazio", () => {
  test("a janela visível tem SEMPRE o tamanho da moldura, em qualquer deslocamento", () => {
    for (const d of [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }, { x: -3, y: 9 }]) {
      const v = retanguloVisivel(FOTO_1, d, CAPA);
      expect(v.w).toBeCloseTo(54.4);
      expect(v.h).toBeCloseTo(80);
    }
  });

  test("o deslocamento fora de [0, 1] é limitado: a janela nunca sai da foto", () => {
    const v = retanguloVisivel(FOTO_2, { x: 5, y: -5 }, CAPA);
    expect(v.x).toBeCloseTo(32 + 68 - 54.4);
    expect(v.y).toBe(0);
    expect(v.x + v.w).toBeLessThanOrEqual(FOTO_2.x + FOTO_2.w + 1e-9);
  });

  test("arrastar o dedo para a DIREITA leva a foto junto: a janela anda para a esquerda", () => {
    const caixa = { w: 300, h: 300 / proporcaoDaJanela({ x: 0, y: 0, w: 54.4, h: 80 }, PANORAMICA) };
    const novo = arrastarDeslocamento({ x: 0.5, y: 0.5 }, 30, 0, caixa, FOTO_1, CAPA);
    expect(novo.x).toBeLessThan(0.5);
    expect(novo.y).toBe(0.5);
  });

  test("o arraste é limitado à folga — arrastar muito não abre vazio", () => {
    const caixa = { w: 300, h: 200 };
    expect(arrastarDeslocamento({ x: 0.5, y: 0.5 }, 10_000, 10_000, caixa, FOTO_1, CAPA)).toEqual({ x: 0, y: 0 });
    expect(arrastarDeslocamento({ x: 0.5, y: 0.5 }, -10_000, -10_000, caixa, FOTO_1, CAPA)).toEqual({ x: 1, y: 1 });
  });

  test("o arraste anda na proporção certa: a caixa inteira de dedo = a largura da moldura na imagem", () => {
    /* 300 px de caixa mostram 54,4 unidades; a folga é 13,6. Andar 75 px = 13,6 unidades = a folga inteira. */
    const novo = arrastarDeslocamento({ x: 1, y: 0.5 }, 75, 0, { w: 300, h: 200 }, FOTO_1, CAPA);
    expect(novo.x).toBeCloseTo(0);
  });

  test("moldura do tamanho da foto (sem folga) não se move nem divide por zero", () => {
    expect(arrastarDeslocamento({ x: 0.5, y: 0.5 }, 40, 40, { w: 300, h: 200 }, FOTO_1, { w: 1, h: 1 })).toEqual({ x: 0.5, y: 0.5 });
  });

  test("as setas do teclado fazem o mesmo arraste, em décimos, e são limitadas", () => {
    expect(deslocarPorTecla({ x: 0.5, y: 0.5 }, "ArrowLeft")).toEqual({ x: 0.6, y: 0.5 });
    expect(deslocarPorTecla({ x: 0.5, y: 0.5 }, "ArrowDown")).toEqual({ x: 0.5, y: 0.4 });
    expect(deslocarPorTecla({ x: 1, y: 0 }, "ArrowLeft")).toEqual({ x: 1, y: 0 });
    expect(deslocarPorTecla({ x: 0.5, y: 0.5 }, "Enter")).toBeNull();
  });
});

describe("o toque → a coordenada da panorâmica", () => {
  test("o canto e o centro da caixa da foto 2 caem no recorte dela", () => {
    const caixa = { w: 170, h: 140 };
    expect(pontoNaImagem(FOTO_2, 0, 0, caixa)).toEqual({ x: 32, y: 0 });
    expect(pontoNaImagem(FOTO_2, 170, 140, caixa)).toEqual({ x: 100, y: 100 });
    expect(pontoNaImagem(FOTO_2, 85, 70, caixa)).toEqual({ x: 66, y: 50 });
  });

  test("o mesmo objeto da faixa comum dá o MESMO ponto da panorâmica nas duas fotos", () => {
    const caixa = { w: 170, h: 140 };
    /* x = 50 da panorâmica: na foto 1 está a 50/68 da caixa, na foto 2 a 18/68. */
    const naFoto1 = pontoNaImagem(FOTO_1, (50 / 68) * 170, 70, caixa);
    const naFoto2 = pontoNaImagem(FOTO_2, (18 / 68) * 170, 70, caixa);
    expect(naFoto1.x).toBeCloseTo(50);
    expect(naFoto2.x).toBeCloseTo(50);
  });

  test("o toque é limitado a 0–100 (a borda arredondada do dedo não manda coordenada inválida)", () => {
    expect(pontoNaImagem(FOTO_1, -10, 500, { w: 100, h: 100 })).toEqual({ x: 0, y: 100 });
  });

  test("posicaoNaCaixa é o inverso de pontoNaImagem", () => {
    const p = pontoNaImagem(FOTO_2, 40, 30, { w: 170, h: 140 });
    const f = posicaoNaCaixa(FOTO_2, p);
    expect(f.x * 170).toBeCloseTo(40);
    expect(f.y * 140).toBeCloseTo(30);
  });
});

describe("o recorte por CSS: UMA imagem serve as duas fotos", () => {
  test("a caixa da foto 2 mostra a panorâmica deslocada 32/68 para a esquerda e ampliada 100/68", () => {
    const e = estiloDaJanela(FOTO_2);
    expect(parseFloat(e.width)).toBeCloseTo((100 / 68) * 100, 2);
    expect(parseFloat(e.left)).toBeCloseTo((-32 / 68) * 100, 2);
    expect(e.top).toBe("0%");
  });

  test("a proporção da caixa de um recorte 68 × 100 da panorâmica 16:9", () => {
    expect(proporcaoDaJanela(FOTO_1, PANORAMICA)).toBeCloseTo(0.68 * PANORAMICA);
  });

  test("encaixar não distorce e não passa do espaço", () => {
    expect(encaixar({ w: 343, h: 1000 }, 2)).toEqual({ w: 343, h: 171 });
    expect(encaixar({ w: 1000, h: 100 }, 2)).toEqual({ w: 200, h: 100 });
    expect(encaixar({ w: 0, h: 100 }, 2)).toEqual({ w: 0, h: 0 });
  });
});

describe("a lupa: ampliação FIXA de 2×", () => {
  test("a imagem dentro da lente tem o dobro do tamanho da foto na tela, e o ponto sob o centro fica no centro", () => {
    const caixa = { w: 340, h: 280 };
    const l = lente(FOTO_1, caixa, { x: 170, y: 140 }, 56);
    expect(l.ponto).toEqual({ x: 34, y: 50 });
    /* a foto (68 unidades) ocupa 340 px; a panorâmica inteira, ampliada 2×, ocupa 2 × 500 px. */
    expect(l.img.w).toBeCloseTo(1000);
    expect(l.img.left + (l.ponto.x / 100) * l.img.w).toBeCloseTo(56);
    expect(l.img.top + (l.ponto.y / 100) * l.img.h).toBeCloseTo(56);
  });
});

describe("o slider de comparação: a alça parte do centro e revela o lado escondido", () => {
  test("o lado escondido é onde mais coisa ficou fora da capa", () => {
    const capaDaFoto1 = retanguloVisivel(FOTO_1, { x: 0, y: 0.5 }, CAPA); // x 0–54,4
    const capaDaFoto2 = retanguloVisivel(FOTO_2, { x: 1, y: 0.5 }, CAPA); // x 45,6–100
    expect(ladoEscondido(capaDaFoto1)).toBe("direita");
    expect(ladoEscondido(capaDaFoto2)).toBe("esquerda");
    expect(ladoEscondido(FOTO_2)).toBe("esquerda");
  });

  test("revelou tudo = a alça no fim do curso, do lado escondido", () => {
    expect(revelouTudo(50, "direita")).toBe(false);
    expect(revelouTudo(97, "direita")).toBe(true);
    expect(revelouTudo(97, "esquerda")).toBe(false);
    expect(revelouTudo(2, "esquerda")).toBe(true);
  });
});

describe("os textos com o espaço da cena", () => {
  test("o artigo do espacoCurto vira a contração certa (espelho da api)", () => {
    expect(fraseDoFora("a biblioteca")).toBe("Marque na biblioteca o que ficou fora da sua foto.");
    expect(fraseDoFora("o museu")).toBe("Marque no museu o que ficou fora da sua foto.");
    expect(fraseDoFora("o pátio")).toBe("Marque no pátio o que ficou fora da sua foto.");
    expect(fraseDoFora("Escola Nova")).toBe("Marque em Escola Nova o que ficou fora da sua foto.");
  });

  test("a missão da abertura: a preposição certa, em caixa alta (espelho da api)", () => {
    expect(fraseDaMissao("a biblioteca")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DA BIBLIOTECA");
    expect(fraseDaMissao("o museu")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DO MUSEU");
    expect(fraseDaMissao("as salas")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DAS SALAS");
    expect(fraseDaMissao("Escola Nova")).toBe("ENCONTRE NAS FOTOS 2 OBJETOS DE ESCOLA NOVA");
  });

  test("a imagem do bundle é relativa à base (o caminho do bucket muda por versão); a da IA vai como veio", () => {
    expect(urlDaImagem({ tipo: "bundle", nome: "cenas/biblioteca.webp" }, "./")).toBe("./cenas/biblioteca.webp");
    expect(urlDaImagem({ tipo: "bundle", nome: "/fixas/carta-a.webp" }, "/exp/1.0.0")).toBe("/exp/1.0.0/fixas/carta-a.webp");
    expect(urlDaImagem({ tipo: "url", url: "https://cdn.exemplo/x.webp" }, "./")).toBe("https://cdn.exemplo/x.webp");
  });
});
