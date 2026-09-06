/**
 * Contrato de `AiProvider.generateJson()` — a geração ESTRUTURADA.
 *
 * Existe por um incidente concreto (exp-92, plano de aulas): o chamador montou
 * o pedido com os nomes de campo de `generate()` — `user`/`schema` em vez de
 * `prompt`/`responseSchema` — e calou o compilador com `as never`. Em runtime
 * `responseSchema` chegava `undefined`, a montagem do corpo estourava ANTES do
 * fetch, e as três tentativas queimavam em segundos com zero token gasto. A
 * tela do professor dizia "Falhou" e o log, só "Falha ao gerar conteúdo
 * estruturado" — nenhum dos dois apontava para a causa.
 *
 * Daí o que se prova aqui, e por que cada um:
 *   · erro HTTP vira erro COM o status (antes virava "resposta vazia", porque o
 *     corpo de erro não tem `candidates` e ninguém olhava `res.ok`);
 *   · `maxTokens` e `modelo` chegam ao vendor — eram aceitos e ignorados, e uma
 *     quinzena de aulas passa de 9k tokens de saída;
 *   · saída truncada se explica, em vez de sair como `JSON.parse` quebrando;
 *   · a validação que lança faz REGERAR com o motivo no prompt.
 *
 * `fetch` e a credencial são dublados, como em `ai-conversar.spec.ts`.
 */
import type { AiJsonSchema } from "../src/ai/provider";
import { ErroDeGeracao } from "../src/ai/provider";
import { VertexProvider } from "../src/ai/vertex.provider";

jest.mock("undici", () => ({
  ...jest.requireActual("undici"),
  fetch: (...args: unknown[]) => (global.fetch as (...a: unknown[]) => unknown)(...args),
}));

jest.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getAccessToken() {
      return "token-de-teste";
    }
  },
}));

const SCHEMA: AiJsonSchema = {
  type: "object",
  properties: { aulas: { type: "array", items: { type: "string" } } },
  required: ["aulas"],
};

/** Corpo de resposta do Vertex com um JSON na parte de texto. */
function json(objeto: unknown, extra: Record<string, unknown> = {}) {
  return {
    candidates: [
      { content: { role: "model", parts: [{ text: JSON.stringify(objeto) }] }, ...extra },
    ],
    usageMetadata: { totalTokenCount: 100 },
  };
}

function respostaOk(corpo: unknown) {
  return { ok: true, status: 200, json: async () => corpo } as unknown as Response;
}

function respostaDeErro(status: number, corpo: string) {
  return { ok: false, status, text: async () => corpo } as unknown as Response;
}

/** O `generationConfig` que o provider mandou na chamada de índice `n`. */
function configDaChamada(n = 0): Record<string, unknown> {
  const chamada = (global.fetch as unknown as jest.Mock).mock.calls[n];
  const corpo = JSON.parse((chamada[1] as { body: string }).body) as {
    generationConfig: Record<string, unknown>;
  };
  return corpo.generationConfig;
}

/** O texto do prompt que o provider mandou na chamada de índice `n`. */
function promptDaChamada(n = 0): string {
  const chamada = (global.fetch as unknown as jest.Mock).mock.calls[n];
  const corpo = JSON.parse((chamada[1] as { body: string }).body) as {
    contents: { parts: { text?: string }[] }[];
  };
  return corpo.contents
    .flatMap((c) => c.parts)
    .map((p) => p.text ?? "")
    .join("");
}

const PEDIDO_BASE = {
  prompt: "planeje as aulas",
  responseSchema: SCHEMA,
  validar: (bruto: unknown) => bruto as { aulas: string[] },
};

describe("generateJson", () => {
  const envOriginal = { ...process.env };

  beforeEach(() => {
    process.env.VERTEX_PROJECT_ID = "projeto-de-teste";
    process.env.VERTEX_LOCATION = "global";
    process.env.VERTEX_MODEL = "modelo-padrao";
    process.env.VERTEX_MODEL_LONGO = "modelo-longo";
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = { ...envOriginal };
    jest.restoreAllMocks();
  });

  it("manda o schema convertido e devolve o JSON validado", async () => {
    (global.fetch as unknown as jest.Mock).mockResolvedValue(
      respostaOk(json({ aulas: ["a", "b"] })),
    );

    const saida = await new VertexProvider().generateJson(PEDIDO_BASE);

    expect(saida).toEqual({ aulas: ["a", "b"] });
    // O schema NEUTRO vira o dialeto do vendor (tipos em maiúsculas). Um
    // `responseSchema` ausente estourava aqui, antes de qualquer requisição.
    expect(configDaChamada().responseSchema).toEqual({
      type: "OBJECT",
      properties: { aulas: { type: "ARRAY", items: { type: "STRING" } } },
      required: ["aulas"],
    });
  });

  it("erro HTTP vira ErroDeGeracao com o status e o corpo, não 'resposta vazia'", async () => {
    (global.fetch as unknown as jest.Mock).mockResolvedValue(
      respostaDeErro(403, '{"error":{"message":"permissao negada"}}'),
    );

    const falha = await new VertexProvider().generateJson(PEDIDO_BASE).catch((e: unknown) => e);

    expect(falha).toBeInstanceOf(ErroDeGeracao);
    expect((falha as Error).message).toBe("Vertex respondeu 403");
    // A causa do vendor sobrevive até quem loga: é ela que diz o que fazer.
    expect((falha as ErroDeGeracao).detalhe).toContain("permissao negada");
    // E morre na primeira: reescrever o prompt não devolve permissão, e as três
    // tentativas só adiavam o erro — foi assim que o status sumiu do log.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("429 é passageiro: continua tentando, e o status sobrevive se esgotar", async () => {
    (global.fetch as unknown as jest.Mock).mockResolvedValue(respostaDeErro(429, "rate limited"));

    const falha = await new VertexProvider()
      .generateJson({ ...PEDIDO_BASE, tentativas: 2 })
      .catch((e: unknown) => e);

    expect((falha as Error).message).toBe("Vertex respondeu 429");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("respeita maxTokens e a família de modelo em vez de ignorá-los", async () => {
    (global.fetch as unknown as jest.Mock).mockResolvedValue(respostaOk(json({ aulas: [] })));

    await new VertexProvider().generateJson({ ...PEDIDO_BASE, maxTokens: 32_000, modelo: "longo" });

    expect(configDaChamada().maxOutputTokens).toBe(32_000);
    const url = (global.fetch as unknown as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("modelo-longo");
  });

  it("sem maxTokens não impõe teto: o do modelo vale", async () => {
    (global.fetch as unknown as jest.Mock).mockResolvedValue(respostaOk(json({ aulas: [] })));

    await new VertexProvider().generateJson(PEDIDO_BASE);

    expect(configDaChamada()).not.toHaveProperty("maxOutputTokens");
  });

  it("saída cortada por tamanho se explica em vez de sair como JSON inválido", async () => {
    (global.fetch as unknown as jest.Mock).mockResolvedValue(
      respostaOk({
        candidates: [{ content: { role: "model", parts: [] }, finishReason: "MAX_TOKENS" }],
      }),
    );

    await expect(
      new VertexProvider().generateJson({ ...PEDIDO_BASE, tentativas: 1 }),
    ).rejects.toMatchObject({ detalhe: expect.stringContaining("teto de saída") });
  });

  it("validação que lança faz regerar com o motivo no prompt", async () => {
    (global.fetch as unknown as jest.Mock)
      .mockResolvedValueOnce(respostaOk(json({ aulas: [] })))
      .mockResolvedValueOnce(respostaOk(json({ aulas: ["a"] })));

    const saida = await new VertexProvider().generateJson({
      ...PEDIDO_BASE,
      validar: (bruto) => {
        const { aulas } = bruto as { aulas: string[] };
        if (aulas.length === 0) throw new Error("esperava ao menos uma aula");
        return { aulas };
      },
    });

    expect(saida).toEqual({ aulas: ["a"] });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(promptDaChamada(1)).toContain("esperava ao menos uma aula");
  });
});
