import { describe, expect, test } from "vitest";
import { preencher, textoDe, TEXTOS } from "./textos";

describe("os textos da tela", () => {
  test("o do servidor vence; sem ele, o literal daqui", () => {
    expect(textoDe({ e1: { titulo: "OUTRO" } }, "e1", "titulo")).toBe("OUTRO");
    expect(textoDe(undefined, "e1", "titulo")).toBe(TEXTOS.e1.titulo);
    expect(textoDe({ e1: { titulo: "  " } }, "e1", "titulo")).toBe(TEXTOS.e1.titulo);
  });

  test("{ESPACO} sai em caixa alta; {hora}, {espacoCurto} e {n} como vieram", () => {
    expect(preencher(TEXTOS.e2.rotuloDaFoto1, { espaco: "Biblioteca Escolar", hora: "14:15" })).toBe("FOTO 1 — BIBLIOTECA ESCOLAR 14:15");
    expect(preencher(TEXTOS.e1.contexto, { espacoCurto: "a biblioteca" })).toBe("A capa sobre a biblioteca causou confusão entre os ouvintes.");
    expect(preencher(TEXTOS.e2.contador, { n: "1" })).toBe("1 DE 2 ENCONTRADOS");
    expect(preencher("{nada}", {})).toBe("{nada}");
  });
});
