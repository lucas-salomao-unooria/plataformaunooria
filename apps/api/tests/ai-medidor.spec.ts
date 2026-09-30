import { MedidorDeProvider, classificarFalha } from "../src/ai/medidor.provider";
import { ErroDeGeracao, type AiProvider, type AiResult } from "../src/ai/provider";
import { metricasEmMemoria } from "./metricas-em-memoria";

/**
 * O decorator mede sem mudar o contrato: o resultado passa intacto, o erro é
 * relançado intacto (o `ErroDeGeracao` que o `/destilar` transforma em 503),
 * e o que fica são histograma de latência e contadores por rótulo fechado.
 */
const MODELOS = {
  padrao: "gemini-padrao",
  longo: "gemini-longo",
  imagem: "gemini-imagem",
  voz: "gemini-voz",
};

function providerFalso(resultado: Partial<AiResult> | Error): AiProvider {
  const devolver = async () => {
    if (resultado instanceof Error) throw resultado;
    return { texto: "ok", tokensUsados: 100, ...resultado } as AiResult;
  };
  return {
    generate: devolver,
    conversar: devolver,
    generateJson: async <T>() => {
      if (resultado instanceof Error) throw resultado;
      return { a: 1 } as unknown as T;
    },
    generateImage: async () => {
      if (resultado instanceof Error) throw resultado;
      return Buffer.from("png");
    },
    generateSpeech: async () => {
      if (resultado instanceof Error) throw resultado;
      return Buffer.from("mp3");
    },
  };
}

describe("MedidorDeProvider", () => {
  it("generate ok: latência com resultado=ok, tokens por direção, finishReason da allowlist", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const medidor = new MedidorDeProvider(
      providerFalso({ tokensUsados: 120, tokensEntrada: 100, tokensSaida: 20, finishReason: "STOP" }),
      metricas,
      MODELOS,
    );
    const r = await medidor.generate({ system: "s", user: "u", modelo: "longo" });
    expect(r.texto).toBe("ok");

    const latencia = await pontos("unooria.ia.latencia");
    expect(latencia).toHaveLength(1);
    expect(latencia[0]?.attributes).toEqual({ modelo: "gemini-longo", operacao: "generate", resultado: "ok" });

    const tokens = await pontos("unooria.ia.tokens");
    const porDirecao = Object.fromEntries(tokens.map((p) => [p.attributes.direcao, p.value]));
    expect(porDirecao).toEqual({ total: 120, entrada: 100, saida: 20 });

    const respostas = await pontos("unooria.ia.respostas");
    expect(respostas[0]?.attributes).toMatchObject({ modelo: "gemini-longo", finishReason: "STOP" });
    await encerrar();
  });

  it("finishReason fora da allowlist vira `outro`; conversar registra voltas e tentativas", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const medidor = new MedidorDeProvider(providerFalso({ finishReason: "ALGO_NOVO_DO_VENDOR", voltas: 3, tentativas: 2 }), metricas, MODELOS);
    await medidor.conversar({ system: "s", historico: [] });
    expect((await pontos("unooria.ia.respostas"))[0]?.attributes.finishReason).toBe("outro");
    expect((await pontos("unooria.ia.voltas"))).toHaveLength(1);
    expect((await pontos("unooria.ia.tentativas"))[0]?.attributes).toMatchObject({ operacao: "conversar" });
    await encerrar();
  });

  it("falha do provider: resultado=erro-provider e o ErroDeGeracao é relançado intacto", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const erro = new ErroDeGeracao("Vertex respondeu 429", "quota");
    const medidor = new MedidorDeProvider(providerFalso(erro), metricas, MODELOS);
    await expect(medidor.generateJson({ prompt: "p", responseSchema: { type: "object" }, validar: (x) => x })).rejects.toBe(erro);
    const latencia = await pontos("unooria.ia.latencia");
    expect(latencia[0]?.attributes).toEqual({ modelo: "gemini-padrao", operacao: "generateJson", resultado: "erro-provider" });
    expect(await pontos("unooria.ia.tokens")).toHaveLength(0);
    await encerrar();
  });

  it("generateJson com modelo `longo`: rotula pelo modelo pedido e registra os tokens de cada tentativa", async () => {
    // `generateJson` devolve `T`, sem `tokensUsados`: o único caminho dos tokens é
    // `aoUsarTokens`, uma vez por tentativa (a rejeitada por `validar` também foi
    // paga). Antes da correção o rótulo era sempre `padrao` e nenhum token entrava.
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const recebidos: number[] = [];
    const real: AiProvider = {
      ...providerFalso({}),
      generateJson: async <T>(req: { aoUsarTokens?: (n: number) => void }) => {
        req.aoUsarTokens?.(300); // tentativa rejeitada por `validar`
        req.aoUsarTokens?.(200);
        return { a: 1 } as unknown as T;
      },
    };
    const medidor = new MedidorDeProvider(real, metricas, MODELOS);
    await medidor.generateJson({
      prompt: "p",
      responseSchema: { type: "object" },
      validar: (x) => x,
      modelo: "longo",
      aoUsarTokens: (n) => recebidos.push(n),
    });

    // o callback de quem chamou (a quota) continua recebendo tudo, intacto
    expect(recebidos).toEqual([300, 200]);

    const latencia = await pontos("unooria.ia.latencia");
    expect(latencia[0]?.attributes).toEqual({ modelo: "gemini-longo", operacao: "generateJson", resultado: "ok" });

    const tokens = await pontos("unooria.ia.tokens");
    expect(tokens.map((p) => p.attributes)).toEqual([{ modelo: "gemini-longo", direcao: "total" }]);
    expect(tokens[0]?.value).toBe(500);
    await encerrar();
  });

  it("generateJson sem `modelo` e sem aoUsarTokens: rótulo `padrao` e o medidor mede sem exigir callback", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const real: AiProvider = {
      ...providerFalso({}),
      generateJson: async <T>(req: { aoUsarTokens?: (n: number) => void }) => {
        req.aoUsarTokens?.(40);
        return { a: 1 } as unknown as T;
      },
    };
    const medidor = new MedidorDeProvider(real, metricas, MODELOS);
    await medidor.generateJson({ prompt: "p", responseSchema: { type: "object" }, validar: (x) => x });
    expect((await pontos("unooria.ia.latencia"))[0]?.attributes).toMatchObject({ modelo: "gemini-padrao" });
    expect((await pontos("unooria.ia.tokens"))[0]).toMatchObject({ value: 40, attributes: { modelo: "gemini-padrao", direcao: "total" } });
    await encerrar();
  });

  it("generateImage usa o modelo de imagem e devolve o Buffer intacto", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const medidor = new MedidorDeProvider(providerFalso({}), metricas, MODELOS);
    expect((await medidor.generateImage("um gato")).toString()).toBe("png");
    expect((await pontos("unooria.ia.latencia"))[0]?.attributes).toMatchObject({ modelo: "gemini-imagem", operacao: "generateImage" });
    await encerrar();
  });

  it("generateSpeech usa o modelo de VOZ e devolve o Buffer intacto", async () => {
    // Rótulo próprio: voz e imagem têm modelos e custos diferentes, e medi-las
    // sob o mesmo nome esconderia qual delas ficou lenta.
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const medidor = new MedidorDeProvider(providerFalso({}), metricas, MODELOS);
    const audio = await medidor.generateSpeech({
      texto: "oi",
      falantes: [{ nome: "Amara", timbre: "jovem-feminino" }],
    });
    expect(audio.toString()).toBe("mp3");
    expect((await pontos("unooria.ia.latencia"))[0]?.attributes).toMatchObject({
      modelo: "gemini-voz",
      operacao: "generateSpeech",
    });
    await encerrar();
  });
});

describe("classificarFalha", () => {
  it("timeout, provider e o resto", () => {
    const t = new Error("x");
    t.name = "TimeoutError";
    expect(classificarFalha(t)).toBe("timeout");
    expect(classificarFalha(new Error("Headers Timeout Error"))).toBe("timeout");
    expect(classificarFalha(new ErroDeGeracao("v"))).toBe("erro-provider");
    expect(classificarFalha(new TypeError("fetch failed"))).toBe("erro");
    expect(classificarFalha("string")).toBe("erro");
  });
});
