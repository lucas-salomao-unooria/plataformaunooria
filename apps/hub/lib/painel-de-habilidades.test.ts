import { describe, expect, test } from "vitest";

import {
  colunasPorUnidade,
  distribuicaoDa,
  ordenarHabilidades,
  porcentagem,
  proporcaoAtingiu,
  rotuloDaSerieDoPainel,
  rotuloDaUnidade,
  segmentosDaBarra,
  seriesDaEscola,
  seriesDaRede,
  type Distribuicao,
  type EscolaConsolidada,
  type MissaoDoPainel,
  type RedeConsolidada,
} from "./painel-de-habilidades";

const d = (atingiu: number, emProcesso: number, naoAtingiu: number, naoAvaliado: number): Distribuicao => ({
  atingiu,
  emProcesso,
  naoAtingiu,
  naoAvaliado,
  total: atingiu + emProcesso + naoAtingiu + naoAvaliado,
});

const missao = (expId: string, unidade: number | null, series: string[]): MissaoDoPainel => ({
  expId,
  nome: expId,
  unidade,
  series,
  habilidades: [{ codigo: "EF05CO08", descricao: "" }],
});

describe("a barra", () => {
  test("quatro segmentos, na ordem da escala, com o não avaliado por último", () => {
    const segmentos = segmentosDaBarra(d(3, 2, 1, 4));
    expect(segmentos.map((s) => s.label)).toEqual(["Atingiu", "Em processo", "Não atingiu", "Não avaliado"]);
    expect(segmentos.map((s) => s.value)).toEqual([3, 2, 1, 4]);
  });

  test("só o não avaliado é tracejado: é ausência, não mais um nível", () => {
    expect(segmentosDaBarra(d(3, 2, 1, 4)).map((s) => s.pattern ?? "solid")).toEqual([
      "solid",
      "solid",
      "solid",
      "dashed",
    ]);
  });

  test("turma vazia não divide por zero", () => {
    expect(proporcaoAtingiu(d(0, 0, 0, 0))).toBe(0);
    expect(porcentagem(0, 0)).toBe("0%");
    expect(porcentagem(1, 3)).toBe("33%");
  });
});

describe("as colunas", () => {
  test("as quatro unidades sempre, e as transversais só se houver", () => {
    const colunas = colunasPorUnidade([missao("a", 1, []), missao("b", 3, [])]);
    expect(colunas.map((c) => c.unidade)).toEqual([1, 2, 3, 4]);
    expect(colunas[1]!.missoes).toEqual([]);
    expect(colunasPorUnidade([missao("t", null, [])]).map((c) => c.unidade)).toEqual([1, 2, 3, 4, null]);
    expect(rotuloDaUnidade(null)).toBe("Transversais");
    expect(rotuloDaUnidade(2)).toBe("Unidade 2");
  });
});

describe("a ordem das habilidades", () => {
  const habilidades = [
    { codigo: "A", distribuicao: d(1, 0, 3, 0) },
    { codigo: "B", distribuicao: d(3, 1, 0, 0) },
    { codigo: "C", distribuicao: d(1, 0, 3, 0) },
  ];

  test("na ordem da ficha, nada muda", () => {
    expect(ordenarHabilidades(habilidades, "ficha").map((h) => h.codigo)).toEqual(["A", "B", "C"]);
  });

  test("mais atingidas primeiro; empate mantém a ordem da ficha", () => {
    expect(ordenarHabilidades(habilidades, "atingimento").map((h) => h.codigo)).toEqual(["B", "A", "C"]);
  });
});

describe("as séries", () => {
  test("o rótulo humano, e a série desconhecida passa crua", () => {
    expect(rotuloDaSerieDoPainel("5EF")).toBe("5º ano");
    expect(rotuloDaSerieDoPainel("XX")).toBe("XX");
  });

  test("a escola agrupada por série, com as missões que valem para o grupo", () => {
    const painel: EscolaConsolidada = {
      escola: { id: "e", nome: "E" },
      periodo: null,
      missoes: [missao("exp04ef1b", 1, ["4EF"]), missao("exp05ef1b", 1, ["5EF"])],
      turmas: [
        { id: "1", nome: "4A", serie: "4EF", estudantes: 2, missoes: [{ expId: "exp04ef1b", aplicada: false, habilidades: [] }] },
        { id: "2", nome: "5A", serie: "5EF", estudantes: 2, missoes: [{ expId: "exp05ef1b", aplicada: true, habilidades: [] }] },
        { id: "3", nome: "5B", serie: "5EF", estudantes: 2, missoes: [{ expId: "exp05ef1b", aplicada: true, habilidades: [] }] },
      ],
    };
    const grupos = seriesDaEscola(painel);
    expect(grupos.map((g) => [g.serie, g.turmas.map((t) => t.nome), g.missoes.map((m) => m.expId)])).toEqual([
      ["4EF", ["4A"], ["exp04ef1b"]],
      ["5EF", ["5A", "5B"], ["exp05ef1b"]],
    ]);
  });

  test("a rede: as séries de todas as escolas, na ordem da trilha", () => {
    const painel: RedeConsolidada = {
      regional: null,
      periodo: null,
      missoes: [missao("exp04ef1b", 1, ["4EF"]), missao("exp05ef1b", 1, ["5EF"])],
      escolas: [
        {
          id: "a",
          nome: "A",
          series: [
            { serie: "5EF", turmas: 1, estudantes: 3, missoes: [{ expId: "exp05ef1b", turmasAplicadas: 1, habilidades: [] }] },
          ],
        },
        {
          id: "b",
          nome: "B",
          series: [
            { serie: "4EF", turmas: 1, estudantes: 3, missoes: [{ expId: "exp04ef1b", turmasAplicadas: 0, habilidades: [] }] },
          ],
        },
      ],
    };
    expect(seriesDaRede(painel).map((s) => [s.serie, s.missoes.map((m) => m.expId)])).toEqual([
      ["4EF", ["exp04ef1b"]],
      ["5EF", ["exp05ef1b"]],
    ]);
  });

  test("a distribuição de uma habilidade numa linha, ou null se ela não a mede", () => {
    const linha = [{ expId: "x", habilidades: [{ codigo: "H", distribuicao: d(1, 0, 0, 1) }] }];
    expect(distribuicaoDa(linha, "x", "H")).toEqual(d(1, 0, 0, 1));
    expect(distribuicaoDa(linha, "x", "Z")).toBeNull();
    expect(distribuicaoDa(linha, "y", "H")).toBeNull();
  });
});
