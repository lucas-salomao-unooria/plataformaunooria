import { describe, expect, test } from "vitest";
import { montarDocumentoDoc, nomeDoArquivo } from "./exportar-doc";

describe("exportar .doc", () => {
  test("embrulha o HTML com os namespaces do Word e o conteúdo intacto", () => {
    const doc = montarDocumentoDoc("<h1>Plano</h1><table><tr><td>x</td></tr></table>");
    expect(doc).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    expect(doc).toContain("@page Section1");
    expect(doc).toContain("<h1>Plano</h1><table><tr><td>x</td></tr></table>");
    expect(doc).not.toContain("var(--"); // Word não resolve CSS variables
  });

  test("nome do arquivo saneado, com acento preservado e fallback", () => {
    expect(nomeDoArquivo("Plano Anual — Letramento Digital — 8º ano")).toBe("Plano_Anual_Letramento_Digital_8º_ano.doc");
    expect(nomeDoArquivo("<script>/../x")).toBe("scriptx.doc");
    expect(nomeDoArquivo("   ")).toBe("Plano_de_Aula.doc");
  });
});
