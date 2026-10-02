import { describe, expect, test } from "vitest";
import { dataUriDeSvg, escaparXml, quebrarEmLinhas, svgDaConsulta, svgDoEstande, type Paleta } from "./arte";

const PALETA: Paleta = {
  fundo: "#EFEEF5",
  superficie: "#FFFFFF",
  texto: "#22272A",
  secundario: "#475157",
  destaque: "#716C98",
  borda: "#CCC9DE",
  fonte: "Open Sans, sans-serif",
};

describe("a arte procedural do estande", () => {
  test("é a mesma num F5 e diferente entre vizinhos", () => {
    const a = svgDoEstande("proj-a1", "Braço robótico", PALETA);
    expect(svgDoEstande("proj-a1", "Braço robótico", PALETA)).toBe(a);
    expect(svgDoEstande("proj-a2", "Braço robótico", PALETA)).not.toBe(a);
  });

  test("a cor sai SÓ da paleta (tokens) — nunca da área", () => {
    const svg = svgDoEstande("proj-d4", "Projeto", PALETA);
    const cores = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{3,8})"/g)].map((m) => m[1]));
    for (const cor of cores) expect(Object.values(PALETA)).toContain(cor);
  });

  test("o título escrito pela IA é escapado", () => {
    const svg = svgDoEstande("proj-a1", 'Robô <script>"x"</script> & cia', PALETA);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(escaparXml("a&b")).toBe("a&amp;b");
  });

  test("o título longo quebra em até três linhas, com reticências", () => {
    const linhas = quebrarEmLinhas("um título muito longo para caber numa linha só do painel do estande", 14, 3);
    expect(linhas).toHaveLength(3);
    expect(linhas[2]?.endsWith("…")).toBe(true);
  });

  test("o fundo da consulta e o data: URI", () => {
    const svg = svgDaConsulta("Consulta Oficial aos Jurados · Ata da Mostra", PALETA);
    expect(svg).toContain('viewBox="0 0 375 667"');
    expect(dataUriDeSvg(svg).startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
  });
});
