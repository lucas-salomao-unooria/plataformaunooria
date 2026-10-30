import { describe, expect, test } from "vitest";
import {
  PERICIA_VAZIA,
  alternarSinalizacao,
  alturasDasBarras,
  atrasosDoFeed,
  corpoDaPublicacao,
  escalaOposta,
  escolhaInicial,
  estadoParaOHub,
  etapaDoPasso,
  fatorDeMentira,
  formatarFator,
  itensDoFeed,
  linhasDoPost,
  montarParecer,
  rotuloCurto,
  rotuloDoEixo,
  valorDaDemonstracao,
  vistaPadrao,
  RITMO_DO_FEED,
} from "./lib/regras";
import type { Publicacao, Sessao } from "./lib/tipos";

const CAMADAS = {
  explicacao: { zero: "eixo em zero", oitenta: "eixo em oitenta" },
  fonte: "a fonte",
  contexto: "o contexto",
  projecao: "a projeção",
  ordem: ["explicacao", "fonte", "contexto", "projecao"] as const,
};
const pub = (escala: 0 | 80, explicacao = false, fonte = false, contexto = false, projecao = false): Publicacao => ({
  escala,
  explicacao,
  fonte,
  contexto,
  projecao,
  publicadaEm: "2026-10-28T13:00:00.000Z",
});
const fala = (autor: string) => ({ autor, perfil: "p", texto: `${autor} fala` });
const FEED: NonNullable<Sessao["feed"]> = {
  reacoes: [fala("a"), fala("b"), fala("c")],
  rival: { escola: "Rival", escala: 0, chip: "chip" },
  conflito: fala("x"),
  coordenador: fala("y"),
};

describe("o compositor (decisão 5 e a errata)", () => {
  test("a 1ª publicação começa SEM escala e sem camada; publicar exige a escala", () => {
    const e = escolhaInicial("inicial", null);
    expect(e).toEqual({ escala: null, explicacao: false, fonte: false, contexto: false, projecao: false });
    expect(corpoDaPublicacao(e)).toBeNull();
    expect(corpoDaPublicacao({ ...e, escala: 80 })).toEqual({ escala: 80, explicacao: false, fonte: false, contexto: false, projecao: false });
  });

  test("as camadas são opcionais: com escala e sem camada, publica", () => {
    expect(corpoDaPublicacao({ escala: 0, explicacao: false, fonte: false, contexto: false, projecao: false })).not.toBeNull();
  });

  test("a errata recarrega a 1ª escolha INTEIRA (escala e camadas)", () => {
    expect(escolhaInicial("errata", pub(80, true, false, true, true))).toEqual({ escala: 80, explicacao: true, fonte: false, contexto: true, projecao: true });
  });

  test("o post carrega as camadas ligadas, na ordem; a anotação acompanha a escala", () => {
    expect(linhasDoPost(pub(80, true, true, true), CAMADAS)).toEqual(["eixo em oitenta", "a fonte", "o contexto"]);
    expect(linhasDoPost(pub(0, true, false, false), CAMADAS)).toEqual(["eixo em zero"]);
    expect(linhasDoPost(pub(0), CAMADAS)).toEqual([]);
    /* ADR-203: a ordem é a do servidor, e a projeção sai no post como as outras. */
    const embaralhada = { ...CAMADAS, ordem: ["projecao", "fonte", "explicacao", "contexto"] as const };
    expect(linhasDoPost(pub(0, true, true, false, true), embaralhada)).toEqual(["a projeção", "a fonte", "eixo em zero"]);
  });
});

describe("o feed do grupo (E4)", () => {
  test("post, reações do ramo, post espelho, conflito, Coordenador — e a errata ABAIXO", () => {
    const sem = itensDoFeed({ publicacoes: { inicial: pub(80), errata: null, errataPulada: false }, feed: FEED });
    expect(sem.map((i) => i.tipo)).toEqual(["post", "reacao", "reacao", "reacao", "rival", "conflito", "coordenador"]);
    const com = itensDoFeed({ publicacoes: { inicial: pub(80), errata: pub(0, true, true), errataPulada: false }, feed: FEED });
    expect(com.at(-1)).toMatchObject({ tipo: "post", errata: true });
    expect(com[0]).toMatchObject({ tipo: "post", errata: false });
  });

  test("sem publicação não há feed", () => {
    expect(itensDoFeed({ publicacoes: { inicial: null, errata: null, errataPulada: false }, feed: null })).toEqual([]);
  });

  test("o post espelho chega ~10 s depois da publicação", () => {
    const a = atrasosDoFeed(3);
    expect(a).toHaveLength(6);
    expect(a.slice(0, 4).reduce((s, x) => s + x, 0)).toBe(RITMO_DO_FEED.rivalAposPost);
  });

  test("a escala do espelho é a oposta", () => {
    expect(escalaOposta(0)).toBe(80);
    expect(escalaOposta(80)).toBe(0);
  });
});

describe("o gráfico e o laudo (E5)", () => {
  test("a altura das barras no eixo 80–100", () => {
    expect(alturasDasBarras([95, 88], 80, 100)).toEqual([0.75, 0.4]);
    expect(alturasDasBarras([95], 0, 100)).toEqual([0.95]);
  });

  test("LF(o) = 95 / (95 − o): 1 na origem 0, ≈ 6,3 na origem 80", () => {
    expect(fatorDeMentira(0)).toBe(1);
    expect(formatarFator(fatorDeMentira(80))).toBe("≈ 6,3");
    expect(formatarFator(fatorDeMentira(0))).toBe("≈ 1,0");
    expect(fatorDeMentira(40)).toBeCloseTo(95 / 55);
  });

  test("a demonstração do gesto vai a 80 e volta, 2 ciclos, e termina na origem", () => {
    expect(valorDaDemonstracao(0)).toBe(0);
    expect(valorDaDemonstracao(1200)).toBe(80);
    expect(valorDaDemonstracao(2400 + 1200)).toBe(80);
    expect(valorDaDemonstracao(4800)).toBe(0);
  });
});

describe("a perícia (E6)", () => {
  test("sinalizar sem motivo não emite; desmarcar desfaz o motivo", () => {
    const b = alternarSinalizacao(PERICIA_VAZIA.B, true);
    expect(montarParecer({ ...PERICIA_VAZIA, B: b })).toBeNull();
    const comMotivo = { sinalizou: true, motivo: "escala" as const };
    expect(montarParecer({ ...PERICIA_VAZIA, B: comMotivo })).toEqual({ sinalizouA: false, motivoA: null, sinalizouB: true, motivoB: "escala" });
    expect(alternarSinalizacao(comMotivo, false)).toEqual({ sinalizou: false, motivo: null });
  });

  test("não sinalizar nada é parecer válido", () => {
    expect(montarParecer(PERICIA_VAZIA)).toEqual({ sinalizouA: false, motivoA: null, sinalizouB: false, motivoB: null });
  });

  test("o rótulo do eixo do cartão sem o parêntese", () => {
    expect(rotuloCurto("Ano Anterior (Período 1)")).toBe("Ano Anterior");
  });

  test("o rótulo do eixo: inteiro quando cabe; inicial e número quando não cabe (como o M1 do protótipo)", () => {
    expect(rotuloDoEixo("Mês 1", 8)).toBe("Mês 1");
    expect(rotuloDoEixo("Semana 4", 8)).toBe("Semana 4");
    expect(rotuloDoEixo("1º Quadrimestre", 8)).toBe("Q1");
    expect(rotuloDoEixo("Quadrimestre 3", 8)).toBe("Q3");
    expect(rotuloDoEixo("Ano Anterior (Período 1)", 18)).toBe("Ano Anterior");
    expect(rotuloDoEixo("Primavera chuvosa", 8)).toBe("Primave…");
  });
});

describe("a etapa, a conversa e o hub", () => {
  test("cada passo cai na sua etapa do PRD", () => {
    expect(etapaDoPasso("dados")).toBe("E2");
    expect(etapaDoPasso("errata")).toBe("E4b");
    expect(etapaDoPasso("concluida")).toBe("E6");
  });

  test("a conversa aberta ao chegar sem gesto (F5)", () => {
    expect(vistaPadrao("abertura")).toBe("lista");
    expect(vistaPadrao("feed")).toBe("grupo");
    expect(vistaPadrao("errata")).toBe("assistente");
  });

  test("a instrução ao lado do aparelho: uma por etapa, a pausa vence, a conclusão retira", () => {
    expect(estadoParaOHub({ passo: "compositor", pausada: false, preparada: true })).toMatchObject({ instrucao: { destaque: "origem do eixo vertical" } });
    expect(estadoParaOHub({ passo: "feed", pausada: true, preparada: true })).toMatchObject({ instrucao: { destaque: "Sessão pausada pela Coordenação" } });
    expect(estadoParaOHub({ passo: "concluida", pausada: false, preparada: true })).toEqual({});
    expect(estadoParaOHub({ passo: "abertura", pausada: false, preparada: false })).toEqual({});
  });
});
