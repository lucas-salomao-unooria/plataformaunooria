import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * O que o bundle NÃO pode ter — o bundle é público, e `/exp/exp02em1b` é
 * endereço adivinhável (regra 3).
 *
 * - O GABARITO: a categoria de saúde dos comentários (o que a EM13CO24 lê), o
 *   `comprova` dos indicadores, o nó de cada parágrafo, e o conteúdo do banco
 *   (o instituto inventado, o colega exposto): tudo isso é da api.
 * - O que o PO tirou (2026-10-22): a etapa de transferência e o Canal B. Nada
 *   de `/evidencias/.../perguntas` nem de `StoryPoll`.
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
  });
}
const fonte = arquivos("src").map((f) => [f, readFileSync(f, "utf8")] as const);

describe("o bundle não carrega o gabarito", () => {
  test.each([
    ["a categoria de saúde", /saude_(fisica|mental)|risco_seguranca/],
    ["o comprova do indicador", /comprova\s*:/],
    ["o nó do parágrafo", /alucinacao|"plagio"|"lgpd"/],
    ["o conteúdo do banco padrão", /DataBrasil|Lucas Mendonça/],
  ])("%s", (_nome, padrao) => {
    for (const [arquivo, texto] of fonte) expect({ arquivo, casou: padrao.test(texto) }).toEqual({ arquivo, casou: false });
  });
});

describe("sem transferência e sem Canal B (PO, 2026-10-22)", () => {
  test("nenhuma pergunta de múltipla escolha nem StoryPoll", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /\/perguntas|StoryPoll|ChoicePoll/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });
});

describe("cada tela fala pela sua seção do DS", () => {
  const importa = (arquivo: string, ponte: string) =>
    new RegExp(`from "@edu/ui/${ponte}"`).test(readFileSync(join("src/telas", arquivo), "utf8"));
  test("a escola (abertura) não usa o clone; o chat é UnooriaAI; o feed e os bastidores são Unoovista", () => {
    expect(importa("Abertura.tsx", "ds")).toBe(true);
    expect(importa("Abertura.tsx", "ds-unooriaai")).toBe(false);
    expect(importa("Conversa.tsx", "ds-unooriaai")).toBe(true);
    expect(importa("Conversa.tsx", "ds-unoovista")).toBe(false);
    expect(importa("Feed.tsx", "ds-unoovista")).toBe(true);
    expect(importa("Feed.tsx", "ds")).toBe(false);
    expect(importa("Explicar.tsx", "ds-unoovista")).toBe(true);
  });
});
