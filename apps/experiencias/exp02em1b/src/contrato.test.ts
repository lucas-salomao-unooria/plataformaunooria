import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * O que o bundle NÃO pode ter — o bundle é público, e `/exp/exp02em1b` é
 * endereço adivinhável (regra 3).
 *
 * - O GABARITO: a categoria de cada comentário (o que a EM13CO24 lê), o nó de
 *   cada parágrafo, e o conteúdo do banco padrão (o instituto inventado, o
 *   colega exposto): tudo isso é da api.
 * - O que o PO tirou (2026-10-22, ADR-191): a transferência e o Canal B. Nada
 *   de `/evidencias/.../perguntas`, de enquete nem de campo de reflexão.
 * - As rotas que a 2.1.0 apagou na api (`mensagem`, `paragrafo`, `feed`,
 *   `indicador`): chamá-las daria 404 mudo no meio da aula.
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}
const fonte = arquivos("src").map((f) => [f, readFileSync(f, "utf8")] as const);

describe("o bundle não carrega o gabarito", () => {
  test.each([
    ["a categoria do comentário", /saude_(fisica|mental)|anonimo_agressivo|risco_seguranca|"engajamento"/],
    ["o nó do parágrafo", /alucinacao|"plagio"|"lgpd"|\bno:\s*"/],
    ["o conteúdo do banco padrão", /DataBrasil|Gabriel Mendes|Helena Ramos|Lucas Mendonça/],
  ])("%s", (_nome, padrao) => {
    for (const [arquivo, texto] of fonte) expect({ arquivo, casou: padrao.test(texto) }).toEqual({ arquivo, casou: false });
  });
});

describe("sem transferência e sem Canal B (PO, 2026-10-22)", () => {
  test("nenhuma pergunta de múltipla escolha, enquete nem diário", () => {
    for (const [arquivo, texto] of fonte) {
      expect({ arquivo, casou: /\/perguntas|StoryPoll|ChoicePoll|DmPoll|TextFieldUnv|Diário de Bordo|Enviar Reflexão/.test(texto) }).toEqual({
        arquivo,
        casou: false,
      });
    }
  });
});

describe("a api da 2.1.0", () => {
  const api = readFileSync("src/lib/api.ts", "utf8");
  test("só as rotas do PRD §12 — nenhuma das que saíram", () => {
    expect(api).not.toMatch(/`\$\{BASE\}\/(mensagem|paragrafo|feed|indicador)`|post\("(mensagem|paragrafo|feed|indicador)"/);
    for (const rota of ["chat/mensagem", "previa", "publicar", "aviso-cuidado", "seguranca", "explicar", "evidencia", "concluir", "entrar"]) {
      expect(api).toContain(`"${rota}"`);
    }
  });
  test("sem IA na aula: nenhum teto de timeout próprio", () => {
    expect(api).not.toMatch(/timeoutMs/);
  });
});

describe("cada tela fala pela sua seção do DS", () => {
  const telas = readdirSync("src/telas").filter((n) => n.endsWith(".tsx"));
  const ler = (arquivo: string) => readFileSync(join("src/telas", arquivo), "utf8");
  const pontes = (arquivo: string) => [...ler(arquivo).matchAll(/from "@edu\/ui\/([a-z-]+)"/g)].map((m) => m[1]);

  test("a plataforma (`@edu/ui/ds`) não entra em tela nenhuma: a missão vive nos dois apps", () => {
    for (const t of telas) expect({ t, pontes: pontes(t).filter((p) => p === "ds") }).toEqual({ t, pontes: [] });
  });

  test("nenhuma tela mistura duas seções", () => {
    for (const t of telas) expect({ t, n: new Set(pontes(t)).size <= 1 }).toEqual({ t, n: true });
  });

  test.each([
    ["Abertura.tsx", "ds-unooriaai"],
    ["Conversa.tsx", "ds-unooriaai"],
    ["FaixaDeConexao.tsx", "ds-unooriaai"],
    ["Relogio.tsx", "ds-unoovista"],
    ["Feed.tsx", "ds-unoovista"],
    ["Pausa.tsx", "ds-unoovista"],
    ["Explicar.tsx", "ds-unoovista"],
    ["Conclusao.tsx", "ds-unoovista"],
  ])("%s → @edu/ui/%s", (arquivo, ponte) => {
    expect(pontes(arquivo)).toEqual([ponte]);
  });

  test("o Unoovista não importa o Toggle de outra seção (lacuna do Switch)", () => {
    expect(ler("Feed.tsx")).not.toMatch(/import\s*\{[^}]*\bToggle\b/);
    expect(ler("Feed.tsx")).not.toMatch(/<Toggle\b/);
  });

  test("o feed não tem abas, apagar post nem DM", () => {
    expect(ler("Feed.tsx")).not.toMatch(/TabBar|DirectThread|MessageBubble|arquivar|excluir/i);
  });
});
