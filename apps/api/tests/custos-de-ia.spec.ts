import { RECURSO_SEM_ROTA, estimarFala, recursoDaRota, type UsoDeIa } from "../src/ai/consumo-de-ia";
import { usoDoVendor } from "../src/ai/gemini-live.client";
import { MedidorDeProvider } from "../src/ai/medidor.provider";
import { MockProvider } from "../src/ai/mock.provider";
import type { AiProvider } from "../src/ai/provider";
import { divisaoDoUso } from "../src/ai/vertex.provider";
import { consumoDoTurno } from "../src/agente-professor/regras";
import { cotacoesDaResposta, dataDoBcb, urlDoPeriodo } from "../src/recursos/cotacao-do-dolar";
import { recorteDa } from "../src/recursos/custos-de-ia.controller";
import {
  LINHA_VAZIA,
  custoEmUsd,
  diasEntre,
  ehDiaValido,
  nomeDoRecurso,
  porRecurso,
  somarDias,
} from "../src/recursos/custos-de-ia";
import { DefinirPrecoDeIaSchema, PeriodoDosCustosSchema } from "../src/recursos/contrato-de-rotas";
import { metricasEmMemoria } from "./metricas-em-memoria";

/**
 * O PAINEL DE CUSTOS DE IA (ADR-161), a parte que não precisa de banco: de onde
 * sai o recurso, como cada vendor vira entrada/saída, a fórmula do custo e a
 * leitura da PTAX. A consulta inteira contra o Postgres está em
 * `custos-de-ia-postgres.spec.ts`.
 */

const MODELOS = { padrao: "modelo-padrao", longo: "modelo-longo", imagem: "modelo-imagem", voz: "modelo-voz" };

describe("de onde vem o recurso de uma chamada", () => {
  it("é o primeiro segmento da rota, sem a query", () => {
    expect(recursoDaRota("/podcast/exp04ef1b/episodios?x=1")).toBe("podcast");
    expect(recursoDaRota("/planos")).toBe("planos");
  });

  it("rota estranha ou ausente cai em sem-rota, nunca em texto livre no banco", () => {
    expect(recursoDaRota(undefined)).toBe(RECURSO_SEM_ROTA);
    expect(recursoDaRota("/")).toBe(RECURSO_SEM_ROTA);
    expect(recursoDaRota("/%2e%2e/etc")).toBe(RECURSO_SEM_ROTA);
    expect(recursoDaRota("/ROTA")).toBe(RECURSO_SEM_ROTA);
  });

  it("as duas rotas do motor da exp08ef1b viram UMA linha no painel, e recurso novo aparece como Outro", () => {
    const linhas = porRecurso([
      { ...LINHA_VAZIA, recurso: "posts", usd: 1 },
      { ...LINHA_VAZIA, recurso: "runs", usd: 2 },
      { ...LINHA_VAZIA, recurso: "rota-nova", usd: 0.5 },
    ]);
    expect(linhas.map((l) => [l.recurso, l.usd])).toEqual([
      ["unoovista", 3],
      ["rota-nova", 0.5],
    ]);
    expect(nomeDoRecurso("rota-nova").nome).toBe("Outro (rota-nova)");
  });
});

describe("entrada e saída cobradas, vendor a vendor", () => {
  it("Vertex: a saída é o total menos a entrada — o raciocínio entra nela", () => {
    expect(
      divisaoDoUso({ promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 300, totalTokenCount: 1500 }),
    ).toEqual({ entrada: 1000, saida: 500 });
    expect(divisaoDoUso(undefined)).toBeUndefined();
  });

  it("Gemini Live: usa o total quando vem; sem uso na mensagem, nada", () => {
    expect(usoDoVendor({ usageMetadata: { promptTokenCount: 400, responseTokenCount: 90, totalTokenCount: 520 } })).toEqual({
      entrada: 400,
      saida: 120,
    });
    expect(usoDoVendor({ usageMetadata: { promptTokenCount: 10, responseTokenCount: 5 } })).toEqual({ entrada: 10, saida: 5 });
    expect(usoDoVendor({ serverContent: {} })).toBeNull();
  });

  it("agente do professor: soma só os NÃO parciais, e o modelo do evento vence o padrão", () => {
    const vazio = { autor: "a", textos: [], chamadasDeFerramenta: [], respostasDeFerramenta: [] };
    const turno = consumoDoTurno(
      [
        { ...vazio, parcial: true, tokens: 999 },
        { ...vazio, parcial: false, tokens: 300, tokensEntrada: 200, modelo: "gemini-3.7-flash-001" },
        { ...vazio, parcial: false, tokens: 100 },
      ],
      "gemini-3.7-flash",
    );
    // O evento sem entrada conta INTEIRO como saída: a tarifa mais cara.
    expect(turno).toEqual({ entrada: 200, saida: 200, modelo: "gemini-3.7-flash-001" });
    expect(consumoDoTurno([], "gemini-3.7-flash").modelo).toBe("gemini-3.7-flash");
  });

  it("voz: a duração sai do MP3 de 32 kbps, a saída de 25 tokens por segundo", () => {
    // 40.000 bytes de MP3 a 32 kbps = 10 segundos; 400 bytes de roteiro ≈ 100 tokens.
    expect(estimarFala(400, 40_000)).toEqual({ tokensEntrada: 100, tokensSaida: 250, segundos: 10 });
  });
});

describe("o medidor registra o que foi PAGO", () => {
  function medidorCom(real: AiProvider) {
    const { metricas, encerrar } = metricasEmMemoria();
    const registros: UsoDeIa[] = [];
    return { medidor: new MedidorDeProvider(real, metricas, MODELOS, (u) => registros.push(u)), registros, encerrar };
  }

  it("conversar: entrada e saída do resultado, na modalidade texto", async () => {
    const real = new MockProvider();
    real.conversar = async () => ({ texto: "oi", tokensUsados: 150, tokensEntrada: 100, tokensSaida: 30 });
    const { medidor, registros, encerrar } = medidorCom(real);
    await medidor.conversar({ system: "s", historico: [] });
    expect(registros).toEqual([
      expect.objectContaining({ operacao: "conversar", modelo: "modelo-padrao", modalidade: "texto", ok: true, tokensEntrada: 100, tokensSaida: 50 }),
    ]);
    await encerrar();
  });

  it("generateJson que FALHA depois de duas tentativas pagas registra as duas, como falha", async () => {
    const real = new MockProvider();
    real.generateJson = async (req) => {
      req.aoUsarTokens?.(100, { entrada: 80, saida: 20 });
      req.aoUsarTokens?.(100, { entrada: 80, saida: 20 });
      throw new Error("validar recusou as duas");
    };
    const { medidor, registros, encerrar } = medidorCom(real);
    await expect(
      medidor.generateJson({ prompt: "p", responseSchema: { type: "object" }, validar: (b) => b, modelo: "longo" }),
    ).rejects.toThrow();
    expect(registros).toEqual([
      expect.objectContaining({ operacao: "generateJson", modelo: "modelo-longo", ok: false, tokensEntrada: 160, tokensSaida: 40 }),
    ]);
    await encerrar();
  });

  it("imagem conta UMA imagem quando vem, com o que foi cobrado", async () => {
    const real = new MockProvider();
    real.generateImage = async (_p, opcoes) => {
      opcoes?.aoUsarTokens?.(1200, { entrada: 80, saida: 1120 });
      return Buffer.from("png");
    };
    const { medidor, registros, encerrar } = medidorCom(real);
    await medidor.generateImage("um gato");
    expect(registros[0]).toEqual(
      expect.objectContaining({ operacao: "generateImage", modalidade: "imagem", ok: true, imagens: 1, tokensEntrada: 80, tokensSaida: 1120 }),
    );
    await encerrar();
  });

  it("voz sai ESTIMADA, na modalidade áudio", async () => {
    const real = new MockProvider();
    real.generateSpeech = async () => Buffer.alloc(8_000);
    const { medidor, registros, encerrar } = medidorCom(real);
    await medidor.generateSpeech({ texto: "abcd", falantes: [{ nome: "a", timbre: "adulto-feminino" }] });
    expect(registros[0]).toEqual(
      expect.objectContaining({ operacao: "generateSpeech", modalidade: "audio", estimado: true, segundos: 2, tokensSaida: 50 }),
    );
    await encerrar();
  });
});

describe("a fórmula do custo", () => {
  it("tokens por milhão vezes o preço de cada direção, mais minutos", () => {
    expect(custoEmUsd({ tokensEntrada: 2_000_000, tokensSaida: 1_000_000, minutos: 0 }, { entrada: 0.75, saida: 3.75 })).toEqual({
      usd: 5.25,
      semPreco: false,
    });
    expect(custoEmUsd({ tokensEntrada: 0, tokensSaida: 0, minutos: 10 }, { minuto: 0.18 }).usd).toBeCloseTo(1.8);
  });

  it("preço ausente vale ZERO e marca a linha, em vez de um custo que parece completo", () => {
    expect(custoEmUsd({ tokensEntrada: 10, tokensSaida: 10, minutos: 0 }, { entrada: 1 })).toEqual({ usd: 0.00001, semPreco: true });
  });
});

describe("a PTAX do Banco Central", () => {
  it("as datas vão no formato do OData, entre aspas", () => {
    expect(dataDoBcb("2026-10-09")).toBe("'10-09-2026'");
    expect(urlDoPeriodo("2026-10-01", "2026-10-10")).toContain(
      "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='10-01-2026'&@dataFinalCotacao='10-10-2026'&$format=json",
    );
  });

  it("a resposta real vira uma cotação por dia, com o horário de Brasília", () => {
    const cotacoes = cotacoesDaResposta({
      value: [
        { cotacaoCompra: 5.2073, cotacaoVenda: 5.2079, dataHoraCotacao: "2026-10-01 13:10:35.4469" },
        { cotacaoCompra: 5.2232, cotacaoVenda: 5.2238, dataHoraCotacao: "2026-10-02 13:03:16.256632" },
      ],
    });
    expect(cotacoes).toEqual([
      { dia: "2026-10-01", compra: 5.2073, venda: 5.2079, cotadoEm: "2026-10-01T16:10:35.000Z" },
      { dia: "2026-10-02", compra: 5.2232, venda: 5.2238, cotadoEm: "2026-10-02T16:03:16.000Z" },
    ]);
  });

  it("resposta fora do formato LANÇA — e quem chama cai no cache", () => {
    expect(() => cotacoesDaResposta({ value: [{ cotacaoVenda: "5,2" }] })).toThrow();
  });
});

describe("o período e o preço que a rota aceita", () => {
  it("dia inexistente e período invertido são recusados", () => {
    expect(ehDiaValido("2026-02-31")).toBe(false);
    expect(PeriodoDosCustosSchema.safeParse({ de: "2026-02-31" }).success).toBe(false);
    expect(diasEntre("2026-01-01", "2026-12-31")).toBe(364);
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("o preço exige motivo, recusa negativo e o zero a mais", () => {
    const base = { modelo: "Gemini-3.7-Flash", componente: "entrada", usd: 0.75, vigenteDesde: "2026-10-01", motivo: "desconto" };
    expect(DefinirPrecoDeIaSchema.parse(base).modelo).toBe("gemini-3.7-flash");
    expect(DefinirPrecoDeIaSchema.safeParse({ ...base, motivo: "" }).success).toBe(false);
    expect(DefinirPrecoDeIaSchema.safeParse({ ...base, usd: -1 }).success).toBe(false);
    expect(DefinirPrecoDeIaSchema.safeParse({ ...base, usd: 75_000 }).success).toBe(false);
    expect(DefinirPrecoDeIaSchema.safeParse({ ...base, modelo: "x; drop" }).success).toBe(false);
  });
});

describe("os seis recortes da consulta", () => {
  it("cada combinação de GROUPING() aponta para um recorte só", () => {
    const g = (s: string) => {
      const [g_dia, g_recurso, g_modelo, g_modalidade, g_escola] = s.split("").map(Number) as [number, number, number, number, number];
      return recorteDa({ g_dia, g_recurso, g_modelo, g_modalidade, g_escola });
    };
    expect(["01111", "10111", "11001", "11101", "11110", "11111"].map(g)).toEqual([
      "dia",
      "recurso",
      "modelo",
      "modalidade",
      "escola",
      "total",
    ]);
  });
});
