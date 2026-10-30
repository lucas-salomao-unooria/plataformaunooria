import { describe, expect, test } from "vitest";
import {
  CAIXA_VAZIA,
  ESTEIRA_VAZIA,
  MONTAGEM_VAZIA,
  RECUO_DA_VAGA,
  campoDaEtiqueta,
  carimbosCompletos,
  fichaMontada,
  gateMudou,
  itensDaCaixa,
  passoEfetivo,
  porNaCaixa,
  porNoNicho,
  quadrosDaSimulacao,
  sequenciaDaEsteira,
  soltarBloco,
  soltarEtiqueta,
  telaVisivel,
  tirarBloco,
  tirarDaCaixa,
  tirarEtiqueta,
  vagasVazias,
} from "./regras";
import { VAGAS_DA_ESTEIRA, type Gate } from "./tipos";

describe("o passo e o portão", () => {
  test("passo efetivo = min(gravado, teto da etapa)", () => {
    expect(passoEfetivo("filtro", "aposta")).toBe("aposta");
    expect(passoEfetivo("ficha", "filtro")).toBe("omissao");
    expect(passoEfetivo("rotina", "inspecao")).toBe("rotina");
    expect(passoEfetivo("galeria", "inspecao")).toBe("galeria");
  });

  test("a tela segurada vale até a criança tocar Avançar, e some numa rodada nova", () => {
    expect(telaVisivel("aposta", "galeria")).toBe("galeria");
    expect(telaVisivel("carimbos", "ficha")).toBe("ficha");
    expect(telaVisivel("caso", "rotina")).toBe("rotina");
    expect(telaVisivel("galeria", "rotina")).toBe("galeria");
    expect(telaVisivel("aposta", null)).toBe("aposta");
  });

  test("a pausa sozinha não relê a sessão; etapa, rodada, pacote, passo e espera relêem", () => {
    const s = { etapa: "aposta", rodada: 1, pacoteId: "p", passo: "aposta", aguardandoOProfessor: true } as const;
    const g: Gate = { ...s, pausada: false };
    expect(gateMudou(s, { ...g, pausada: true })).toBe(false);
    expect(gateMudou(s, { ...g, etapa: "filtro", passo: "filtro", aguardandoOProfessor: false })).toBe(true);
    expect(gateMudou(s, { ...g, rodada: 2 })).toBe(true);
    expect(gateMudou(s, { ...g, pacoteId: "q" })).toBe(true);
  });
});

describe("E2 — a caixa da escolha (toque ou arraste, ADR-201)", () => {
  test("tocar na bandeja põe no primeiro nicho vazio; tocar na caixa devolve", () => {
    let c = porNaCaixa(CAIXA_VAZIA, "rp-aaa");
    c = porNaCaixa(c, "rp-bbb");
    expect(itensDaCaixa(c)).toEqual(["rp-aaa", "rp-bbb"]);
    c = tirarDaCaixa(c, "rp-aaa");
    expect(c).toEqual([null, "rp-bbb", null]);
    c = porNaCaixa(c, "rp-ccc");
    expect(c).toEqual(["rp-ccc", "rp-bbb", null]);
  });

  test("a mesma notícia não entra duas vezes, e a caixa cheia não muda", () => {
    const cheia = ["rp-a11", "rp-b22", "rp-c33"];
    expect(porNaCaixa(cheia, "rp-a11")).toBe(cheia);
    expect(porNaCaixa(cheia, "rp-d44")).toBe(cheia);
  });

  test("arrastar para um nicho: da bandeja ocupa o nicho (o ocupante volta); de outro nicho, troca", () => {
    const c = porNoNicho(CAIXA_VAZIA, "rp-aaa", 2);
    expect(c).toEqual([null, null, "rp-aaa"]);
    expect(porNoNicho(c, "rp-bbb", 2)).toEqual([null, null, "rp-bbb"]);
    const duas = porNoNicho(c, "rp-bbb", 0);
    expect(porNoNicho(duas, "rp-aaa", 0)).toEqual(["rp-aaa", null, "rp-bbb"]);
    expect(porNoNicho(duas, "rp-aaa", 5)).toBe(duas);
  });
});

describe("E4-03 — a ficha do reparo (spec §7.6)", () => {
  test("qualquer etiqueta em qualquer campo; trocar de campo tira do anterior", () => {
    let m = soltarEtiqueta(MONTAGEM_VAZIA, "et-pat", "quem");
    expect(m.quem).toBe("et-pat");
    m = soltarEtiqueta(m, "et-pat", "onde");
    expect(m).toEqual({ quem: null, onde: "et-pat", quando: null });
    expect(campoDaEtiqueta(m, "et-pat")).toBe("onde");
  });

  test("soltar num campo ocupado devolve a que estava à bandeja", () => {
    const m = soltarEtiqueta(soltarEtiqueta(MONTAGEM_VAZIA, "et-aaa", "onde"), "et-bbb", "onde");
    expect(m.onde).toBe("et-bbb");
    expect(campoDaEtiqueta(m, "et-aaa")).toBeNull();
  });

  test("Concluir só com as três posicionadas — e a tela NÃO julga onde está o Pátio", () => {
    expect(fichaMontada(soltarEtiqueta(MONTAGEM_VAZIA, "et-aaa", "onde"))).toBeNull();
    const errada = { quem: "et-pat", onde: "et-est", quando: "et-sex" };
    expect(fichaMontada(errada)).toEqual(errada);
    expect(tirarEtiqueta(errada, "quem").quem).toBeNull();
  });
});

describe("E5-01 — a esteira da rotina", () => {
  test("sete vagas, com o recuo do desenho (ENQUANTO > Pegar, SE > ok, SENÃO > revisar, FIM)", () => {
    expect(ESTEIRA_VAZIA).toHaveLength(VAGAS_DA_ESTEIRA);
    expect(RECUO_DA_VAGA).toEqual([0, 1, 1, 2, 1, 2, 0]);
  });

  test("soltar move o bloco; a sequência só sai com as sete vagas cheias", () => {
    let e = soltarBloco(ESTEIRA_VAZIA, "bl-a", 0);
    e = soltarBloco(e, "bl-a", 3);
    expect(e[0]).toBeNull();
    expect(e[3]).toBe("bl-a");
    expect(sequenciaDaEsteira(e)).toBeNull();
    expect(vagasVazias(e)).toBe(6);
    e = tirarBloco(e, 3);
    expect(vagasVazias(e)).toBe(7);
    const cheia = ["bl-1", "bl-2", "bl-3", "bl-4", "bl-5", "bl-6", "bl-7"].reduce((acc, id, i) => soltarBloco(acc, id, i), ESTEIRA_VAZIA);
    expect(sequenciaDaEsteira(cheia)).toEqual(["bl-1", "bl-2", "bl-3", "bl-4", "bl-5", "bl-6", "bl-7"]);
  });

  test("a simulação divide os ~1,8 s pelas fichas que o servidor devolveu", () => {
    const q = quadrosDaSimulacao(
      [
        { manchete: "A", marca: "ok", pendentes: 2 },
        { manchete: "B", marca: "revisar", pendentes: 1 },
        { manchete: "C", marca: "ok", pendentes: 0 },
      ],
      1800,
    );
    expect(q.map((x) => x.emMs)).toEqual([0, 600, 1200]);
    expect(q[1]?.marca).toBe("revisar");
  });
});

describe("os carimbos", () => {
  test("Avançar só com os três; nenhum julgamento", () => {
    expect(carimbosCompletos(["k1", "k2", "k3"] as const, { k1: "v", k2: "x" })).toBeNull();
    expect(carimbosCompletos(["k1", "k2", "k3"] as const, { k1: "v", k2: "v", k3: "v" })).toEqual({ k1: "v", k2: "v", k3: "v" });
  });
});
