import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { urlSegura } from "./markdown-seguro";

/**
 * O markdown da resposta do agente é texto de MODELO — que leu PDFs — e vira
 * HTML no navegador do professor. Cada caso aqui é uma tentativa de fazer esse
 * texto virar outra coisa que não texto e links seguros.
 *
 * O DS é trocado por marcadores: o que se prova é QUAL componente o markdown
 * usa (a tabela tem de ir para o `RichContentTable`, com a rolagem do DS), não
 * o CSS do pacote — que, importado no Node, nem carregaria.
 */
vi.mock("@edu/ui/ds", () => ({
  RichContent: ({ children }: { children?: ReactNode }) => createElement("div", { "data-rich-content": "" }, children),
  RichContentTable: ({ node, ...resto }: { node?: unknown; children?: ReactNode }) => {
    void node;
    return createElement("table", { "data-rich-content-table": "", ...resto });
  },
}));

const { MarkdownDoAgente } = await import("@/components/agente-professor/markdown");

const html = (texto: string) => renderToStaticMarkup(createElement(MarkdownDoAgente, { texto }));

describe("markdown do agente: o que NÃO pode virar elemento", () => {
  it("`<script>` e HTML cru viram TEXTO (escapado), nunca elemento", () => {
    const saida = html('Veja: <script>alert("x")</script> e <img src=x onerror=alert(1)> e <b>negrito</b>');
    expect(saida).not.toMatch(/<script/i);
    expect(saida).not.toMatch(/<img/i);
    expect(saida).not.toMatch(/<b>/);
    expect(saida).toContain("&lt;script&gt;");
    expect(saida).toContain("&lt;b&gt;negrito&lt;/b&gt;");
  });

  it("`javascript:` não vira link — nem disfarçado de caixa alta ou com tabulação", () => {
    for (const url of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "java\tscript:alert(1)", " javascript:alert(1)"]) {
      const saida = html(`[clique aqui](${url.replace("\t", "%09")})`);
      expect(saida, url).not.toMatch(/href=/);
      expect(saida, url).toContain("clique aqui");
    }
    expect(html("<javascript:alert(1)>")).not.toMatch(/href=/);
  });

  it("`data:` não vira link nem imagem; imagem vira o texto alternativo", () => {
    expect(html("[baixar](data:text/html;base64,PHNjcmlwdD4=)")).not.toMatch(/href=/);
    const imagem = html("![um gráfico](data:image/png;base64,AAAA) e ![foto](https://exemplo.org/a.png)");
    expect(imagem).not.toMatch(/<img/i);
    expect(imagem).toContain("um gráfico");
    expect(imagem).toContain("foto");
  });

  it("link relativo (rota do hub, âncora) fica texto: o painel flutua sobre qualquer tela", () => {
    expect(html("[área](/professor/turmas)")).not.toMatch(/href=/);
    expect(html("[nota](#rodape)")).not.toMatch(/href=/);
  });
});

describe("markdown do agente: o que DEVE virar elemento", () => {
  it("link http/https abre em nova guia, com `noopener noreferrer`", () => {
    const saida = html("[BNCC](https://basenacionalcomum.mec.gov.br/)");
    expect(saida).toContain('href="https://basenacionalcomum.mec.gov.br/"');
    expect(saida).toContain('target="_blank"');
    expect(saida).toContain('rel="noopener noreferrer"');
  });

  it("tabela GFM vai para o `RichContentTable` do DS, dentro do `RichContent`", () => {
    const saida = html("| Código | Habilidade |\n| --- | --- |\n| EF06MA01 | Comparar números naturais |");
    expect(saida.startsWith("<div data-rich-content")).toBe(true);
    expect(saida).toMatch(/<table data-rich-content-table/);
    expect(saida).toContain("EF06MA01");
  });

  it("títulos, listas, negrito, código e riscado do GFM passam", () => {
    const saida = html("## Plano\n\n- **um**\n- `dois`\n\n~~três~~\n\n```\nbloco\n```");
    for (const tag of ["<h2>", "<ul>", "<strong>", "<code>", "<del>", "<pre>"]) expect(saida).toContain(tag);
  });
});

describe("markdown PARCIAL (a resposta ainda chegando) não quebra a tela", () => {
  it.each([
    ["cerca de código aberta", "Exemplo:\n\n```python\nprint('oi')"],
    ["tabela pela metade", "| Código | Habilidade |\n| --- |"],
    ["tabela só com o cabeçalho", "| Código | Habilidade"],
    ["negrito sem fechar", "Isto é **importante"],
    ["link pela metade", "Veja [a BNCC](https://basenac"],
    ["lista começando", "1. "],
    ["texto vazio", ""],
  ])("%s", (_nome, texto) => {
    expect(() => html(texto)).not.toThrow();
  });
});

describe("urlSegura", () => {
  it("só http, https e mailto absolutos", () => {
    expect(urlSegura("https://exemplo.org")).toBe("https://exemplo.org");
    expect(urlSegura("http://exemplo.org")).toBe("http://exemplo.org");
    expect(urlSegura("mailto:coordenacao@escola.gov.br")).toBe("mailto:coordenacao@escola.gov.br");
    for (const ruim of ["javascript:alert(1)", "java\nscript:alert(1)", "data:text/html,x", "vbscript:x", "/relativo", "#x", "ftp://x", ""]) {
      expect(urlSegura(ruim), ruim).toBeNull();
    }
  });
});
