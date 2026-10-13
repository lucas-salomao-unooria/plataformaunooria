import { textoAlternativoDaImagem } from "../src/comum/insta/texto-alternativo";

/**
 * O texto alternativo da imagem do post (WCAG 1.1.1, ADR-163): o brief da
 * imagem GERADA, e nada quando o que aparece não é o que o brief descreve.
 */
describe("o texto alternativo da imagem do post", () => {
  const gerada = { imageStatus: "ok", imageUrl: "https://cdn/x.webp" };

  test("a imagem gerada leva o brief, com ponto final", () => {
    expect(textoAlternativoDaImagem({ ...gerada, imageBrief: "Uma bicicleta encostada num poste da ciclovia" })).toBe(
      "Uma bicicleta encostada num poste da ciclovia.",
    );
    expect(textoAlternativoDaImagem({ ...gerada, imageBrief: "  Um prato   de arroz e feijão!  " })).toBe(
      "Um prato de arroz e feijão!",
    );
  });

  test("arte procedural não leva o brief: ele não descreve os emojis", () => {
    expect(textoAlternativoDaImagem({ imageStatus: "fallback", imageUrl: null, imageBrief: "Uma praia lotada" })).toBeNull();
    expect(textoAlternativoDaImagem({ imageStatus: "pendente", imageUrl: null, imageBrief: "Uma praia lotada" })).toBeNull();
  });

  test("sem brief, ou com um curto demais para descrever, volta null", () => {
    expect(textoAlternativoDaImagem({ ...gerada, imageBrief: null })).toBeNull();
    expect(textoAlternativoDaImagem({ ...gerada, imageBrief: "foto" })).toBeNull();
  });
});
