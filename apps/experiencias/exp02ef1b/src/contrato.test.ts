import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * O que o bundle NÃO pode ter — ele é público, e `/exp/exp02ef1b` é endereço
 * adivinhável (regra 3).
 *
 * - O GABARITO: os alvos dos invariantes, os núcleos, a fala da visitante por
 *   foto, o selo coerente, os marcáveis, a atividade/cor das cartas e o núcleo
 *   da segunda foto — tudo isso é de `apps/api/src/enigma-capa/conteudo.ts`.
 * - Persistência no navegador: a fila de envio é em MEMÓRIA (one-pager §8), e
 *   token só em memória (regra 4).
 * - Canal B e texto livre (decisões do Lucas, 2026-10-26).
 * - Outra seção do DS: a missão inteira é Unoovista.
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
  });
}
/** O CÓDIGO, sem os comentários: a documentação pode (e deve) nomear o que não desce. */
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const fonte = arquivos("src").map((f) => [f, semComentarios(readFileSync(f, "utf8"))] as const);

describe("o bundle não carrega o gabarito", () => {
  test.each([
    ["o selo coerente", /seloCoerente/],
    ["o núcleo da foto", /nucleo\s*:/],
    ["os marcáveis", /marcaveis/],
    ["a atividade ou a cor das cartas", /atividade:\s*"(leitura|brincadeira)"|cor:\s*"(azul|vermelha)"/],
    ["um alvo de invariante escrito à mão", /alvo:\s*\{\s*x:/],
    ["a fala da visitante de um pacote", /Na foto, vi (crianças|alfaces|minhocas|tinteiros|canetas)/],
  ])("%s", (_nome, padrao) => {
    for (const [arquivo, texto] of fonte) expect({ arquivo, casou: padrao.test(texto) }).toEqual({ arquivo, casou: false });
  });
});

describe("nada persiste no navegador", () => {
  test("sem localStorage, sessionStorage nem IndexedDB", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /localStorage|sessionStorage|indexedDB/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });
});

describe("sem Canal B e sem texto livre", () => {
  test("nenhuma pergunta de avaliação, campo de texto nem StoryPoll", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /\/perguntas|StoryPoll|TextFieldUnv|<textarea|type="text"/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });
});

describe("uma seção do DS só: o Unoovista", () => {
  test("nenhuma tela importa outra ponte, nem a folha da plataforma", () => {
    for (const [arquivo, texto] of fonte) {
      const pontes = [...texto.matchAll(/from "@edu\/ui\/([\w-]+)"/g)].map((m) => m[1]);
      for (const p of pontes) expect({ arquivo, ponte: p }).toEqual({ arquivo, ponte: "ds-unoovista" });
      expect({ arquivo, casou: /design-system\/(unooria|instanooria)\.css/.test(texto) }).toEqual({ arquivo, casou: false });
    }
  });
});
