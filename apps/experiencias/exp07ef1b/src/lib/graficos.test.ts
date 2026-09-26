import { describe, expect, test } from "vitest";
import {
  dataUriDeSvg,
  descricaoDoGrafico,
  escaparXml,
  formatarValor,
  quebrarEmLinhas,
  svgDoCardProcedural,
  svgDoGrafico,
  type Paleta,
} from "./graficos";
import type { Grafico } from "./tipos";

const PALETA: Paleta = {
  fundo: "#F8F8F8",
  superficie: "#FFFFFF",
  texto: "#262626",
  secundario: "#8E8E93",
  destaque: "#3897F0",
  calor: "#ED4956",
  borda: "#C7C7CC",
  fonte: '-apple-system, "SF Pro Text", sans-serif',
};

/** Os três gráficos do banco curado (bloco C), como a api os manda. */
const BARRAS: Grafico = {
  tipo: "barras",
  titulo: "Custo por m² da obra",
  unidade: "R$",
  series: [
    { rotulo: "Esta obra", valor: 420 },
    { rotulo: "Média regional", valor: 512 },
  ],
};
const MAPA: Grafico = {
  tipo: "mapa-de-calor",
  titulo: "Travessia no horário de pico",
  unidade: "min",
  series: [
    { rotulo: "Antes da obra", valor: 8 },
    { rotulo: "Durante a obra", valor: 22 },
  ],
  destaque: "Desvio: +14 min no pico",
};
const LINHAS: Grafico = {
  tipo: "linhas",
  titulo: "Avanço da obra × desembolso",
  unidade: "%",
  series: [
    { rotulo: "Avanço físico", valor: 28 },
    { rotulo: "Desembolso", valor: 35 },
  ],
};

/** O desenho sem o texto (a moldura, o fundo): é a FORMA do card. */
function forma(svg: string): string {
  return svg.replace(/<title>[\s\S]*?<\/title>/, "").replace(/<text[^>]*>[\s\S]*?<\/text>/g, "");
}

/** O corpo e a cor de cada linha de texto — tem de ser um só para todo card. */
function estiloDoTexto(svg: string): Set<string> {
  return new Set([...svg.matchAll(/<text [^>]*?(font-size="[^"]*" font-weight="[^"]*" fill="[^"]*")/g)].map((m) => m[1] ?? ""));
}

describe("o texto dentro do SVG", () => {
  test("escapa o que viraria marcação", () => {
    expect(escaparXml(`<b>"a" & 'b'</b>`)).toBe("&lt;b&gt;&quot;a&quot; &amp; &apos;b&apos;&lt;/b&gt;");
  });

  test("quebra por palavra, respeita o teto de linhas e avisa o corte", () => {
    const linhas = quebrarEmLinhas("uma frase comprida demais para caber numa linha só", 12, 3);
    expect(linhas.length).toBe(3);
    for (const l of linhas) expect([...l].length).toBeLessThanOrEqual(12);
    expect(linhas[2]?.endsWith("…")).toBe(true);
  });

  test("o que cabe não ganha reticências", () => {
    expect(quebrarEmLinhas("curta", 12, 2)).toEqual(["curta"]);
  });

  test("a unidade no lugar em que se lê em português", () => {
    expect(formatarValor(420, "R$")).toBe("R$ 420");
    expect(formatarValor(22, "min")).toBe("22 min");
    expect(formatarValor(35, "%")).toBe("35%");
    expect(formatarValor(1500, "")).toBe("1.500");
  });
});

describe("o gráfico sai dos NÚMEROS", () => {
  test("cada valor da série está escrito no desenho", () => {
    expect(svgDoGrafico(BARRAS, PALETA, "quadrado")).toContain("R$ 420");
    expect(svgDoGrafico(BARRAS, PALETA, "quadrado")).toContain("R$ 512");
    expect(svgDoGrafico(MAPA, PALETA, "story")).toContain("22 min");
    expect(svgDoGrafico(LINHAS, PALETA, "quadrado")).toContain("35%");
  });

  test("o texto alternativo diz o que o desenho mostra", () => {
    expect(descricaoDoGrafico(BARRAS)).toBe("Custo por m² da obra: Esta obra, R$ 420; Média regional, R$ 512.");
    expect(descricaoDoGrafico(MAPA)).toBe(
      "Travessia no horário de pico: Antes da obra, 8 min; Durante a obra, 22 min. Desvio: +14 min no pico.",
    );
  });

  test("o mapa de calor desenha as manchas mais fortes onde o valor é maior", () => {
    const svg = svgDoGrafico(MAPA, PALETA, "quadrado");
    const opacidades = [...svg.matchAll(/fill-opacity="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(opacidades.length).toBe(8); // 4 cruzamentos × 2 séries
    expect(Math.max(...opacidades.slice(4))).toBeGreaterThan(Math.max(...opacidades.slice(0, 4)));
  });

  test("rótulo com marcação não vira marcação", () => {
    const svg = svgDoGrafico({ ...BARRAS, series: [{ rotulo: "<script>", valor: 1 }, { rotulo: "b", valor: 2 }] }, PALETA, "quadrado");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  test("a cor vem da paleta — nenhuma cor que não seja dela", () => {
    const svg = svgDoGrafico(MAPA, PALETA, "story");
    const cores = new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{3,8})"/g)].map((m) => m[1]));
    const daPaleta = new Set(Object.values(PALETA));
    for (const c of cores) expect(daPaleta.has(c ?? "")).toBe(true);
  });
});

describe("o card procedural: IGUAL para todos os veículos (critério 1 do brief)", () => {
  const folha = "Maquete 3D de uma praça moderna vista do alto num dia de sol, com pista de skate e postes de LED.";
  const voz = "Fachada de padaria de esquina vista da calçada: balcão sem clientes e tapumes de metal da obra.";

  test("dois posts de veículos diferentes têm a mesma forma — só o texto muda", () => {
    for (const formato of ["quadrado", "story"] as const) {
      const a = svgDoCardProcedural(folha, PALETA, formato);
      const b = svgDoCardProcedural(voz, PALETA, formato);
      expect(forma(a)).toBe(forma(b));
      expect([...estiloDoTexto(a)]).toEqual([...estiloDoTexto(b)]);
      expect(estiloDoTexto(a).size).toBe(1);
    }
  });

  test("a descrição inteira está no desenho", () => {
    const svg = svgDoCardProcedural(folha, PALETA, "quadrado");
    expect(svg).toContain("Maquete 3D de uma praça");
    expect(svg).toContain("<title>");
  });

  test("vira data: URI que o `<img>` carrega", () => {
    expect(dataUriDeSvg("<svg/>")).toBe("data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E");
  });
});
