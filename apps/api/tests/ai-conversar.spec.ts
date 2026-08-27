/**
 * Contrato de `AiProvider.conversar()` — a conversa multi-turno com
 * ferramentas, que existe para uma experiência poder ter um agente SEM que
 * nenhum número saia da LLM (o valor vem de um motor determinístico; o modelo
 * só narra o que a ferramenta devolveu).
 *
 * O alvo aqui é o LAÇO DO VERTEX, não o mock: é ele que encadeia ferramenta →
 * narrativa, filtra as partes de raciocínio, reenvia o turno do modelo verbatim
 * e tenta de novo quando o domínio recusa a fala. Cada um desses quatro pontos
 * custou um sintoma no projeto de origem, e todos são invisíveis ao typecheck.
 *
 * `fetch` é dublado; a credencial também (sem isto o teste exigiria ADC).
 */
import { MockProvider } from "../src/ai/mock.provider";
import type { AiFerramenta } from "../src/ai/provider";
import { ErroDeGeracao } from "../src/ai/provider";
import { VertexProvider } from "../src/ai/vertex.provider";

jest.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getAccessToken() {
      return "token-de-teste";
    }
  },
}));

const FERRAMENTA: AiFerramenta = {
  nome: "usar_dados",
  descricao: "Carrega uma fonte de dados da cidade.",
  parametros: {
    type: "object",
    properties: { fonte: { type: "string", description: "previsao, censo ou viaria" } },
    required: ["fonte"],
  },
};

/** Corpo de resposta do Vertex: uma fala de texto. */
function fala(texto: string, extra: Record<string, unknown> = {}) {
  return {
    candidates: [{ content: { role: "model", parts: [{ text: texto }] }, ...extra }],
    usageMetadata: { totalTokenCount: 100 },
  };
}

/** Corpo de resposta do Vertex: um pedido de ferramenta. `assinatura` imita o
 *  `thoughtSignature` — campo que o provedor manda e EXIGE de volta. */
function pedidoDeFerramenta(assinatura = "assinatura-opaca") {
  return {
    candidates: [
      {
        content: {
          role: "model",
          parts: [{ functionCall: { name: "usar_dados", args: { fonte: "chuva" } }, thoughtSignature: assinatura }],
        },
      },
    ],
    usageMetadata: { totalTokenCount: 50 },
  };
}

type Corpo = Record<string, unknown>;

/** Dubla `fetch` devolvendo, em ordem, os corpos dados. Guarda os pedidos. */
function dublarFetch(respostas: Corpo[]): { pedidos: Corpo[] } {
  const pedidos: Corpo[] = [];
  let i = 0;
  global.fetch = jest.fn(async (_url: unknown, init: unknown) => {
    const { body } = init as { body: string };
    pedidos.push(JSON.parse(body) as Corpo);
    const corpo = respostas[Math.min(i, respostas.length - 1)];
    i += 1;
    return { ok: true, status: 200, json: async () => corpo, text: async () => JSON.stringify(corpo) };
  }) as unknown as typeof fetch;
  return { pedidos };
}

const fetchOriginal = global.fetch;
afterEach(() => {
  global.fetch = fetchOriginal;
  jest.restoreAllMocks();
});

const provider = new VertexProvider();
const base = { system: "Você é o Cientista.", historico: [{ papel: "aluno" as const, texto: "onde chove mais?" }] };

describe("VertexProvider.conversar", () => {
  it("encadeia ferramenta e devolve a narrativa, somando os tokens das duas voltas", async () => {
    dublarFetch([pedidoDeFerramenta(), fala("A chuva bate mais forte no norte.")]);
    const executadas: Array<{ nome: string; args: unknown }> = [];

    const r = await provider.conversar({
      ...base,
      ferramentas: {
        declaracoes: [FERRAMENTA],
        executar: async (nome, args) => {
          executadas.push({ nome, args });
          return { chuvaNorte: 42 };
        },
      },
    });

    expect(executadas).toEqual([{ nome: "usar_dados", args: { fonte: "chuva" } }]);
    expect(r.texto).toBe("A chuva bate mais forte no norte.");
    expect(r.voltas).toBe(1);
    expect(r.tentativas).toBe(1);
    // 50 do pedido de ferramenta + 100 da narrativa: o que foi PAGO.
    expect(r.tokensUsados).toBe(150);
  });

  it("reenvia o turno do modelo VERBATIM, preservando a assinatura de raciocínio", async () => {
    // Sem isto o Vertex recusa a continuação com 400: a ferramenta roda, mas a
    // narrativa nunca chega. Remontar `{functionCall}` à mão perde o campo.
    const { pedidos } = dublarFetch([pedidoDeFerramenta("nao-invente-isto"), fala("Pronto.")]);

    await provider.conversar({
      ...base,
      ferramentas: { declaracoes: [FERRAMENTA], executar: async () => ({ ok: true }) },
    });

    const segundo = pedidos[1] as { contents: Array<{ role?: string; parts?: Array<Record<string, unknown>> }> };
    const [, turnoDoModelo, respostaDaFerramenta] = segundo.contents;
    expect(turnoDoModelo?.parts?.[0]?.thoughtSignature).toBe("nao-invente-isto");
    // e o resultado da ferramenta volta como functionResponse
    expect(respostaDaFerramenta?.role).toBe("user");
    expect(respostaDaFerramenta?.parts?.[0]).toHaveProperty("functionResponse");
  });

  it("não deixa a parte de RACIOCÍNIO virar fala do agente", async () => {
    dublarFetch([
      {
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                { thought: true, text: "O aluno não consultou nada ainda; devo sugerir." },
                { text: "Quer que eu veja a previsão primeiro?" },
              ],
            },
          },
        ],
        usageMetadata: { totalTokenCount: 10 },
      },
    ]);

    const r = await provider.conversar(base);
    expect(r.texto).toBe("Quer que eu veja a previsão primeiro?");
    expect(r.texto).not.toContain("devo sugerir");
  });

  it("recusa do domínio derruba a tentativa e o modelo tenta de novo SABENDO por quê", async () => {
    const { pedidos } = dublarFetch([fala("Manda a equipe pro norte."), fala("Onde você quer olhar primeiro?")]);

    const r = await provider.conversar({
      ...base,
      validar: (texto) => (texto.includes("Manda") ? ["termo proibido: Manda"] : []),
    });

    expect(r.texto).toBe("Onde você quer olhar primeiro?");
    expect(r.tentativas).toBe(2);
    // os tokens da tentativa REJEITADA continuam contando
    expect(r.tokensUsados).toBe(200);
    const segundoSystem = JSON.stringify((pedidos[1] as Corpo).systemInstruction);
    expect(segundoSystem).toContain("termo proibido: Manda");
  });

  it("a última tentativa pede SOCORRO e baixa a exigência", async () => {
    const { pedidos } = dublarFetch([fala("ruim"), fala("ruim"), fala("ruim")]);

    await expect(
      provider.conversar({ ...base, validar: () => ["sempre ruim"], socorro: "Pergunte que fonte abrir." }),
    ).rejects.toThrow(ErroDeGeracao);

    expect(pedidos).toHaveLength(3);
    const ultimo = JSON.stringify((pedidos[2] as Corpo).systemInstruction);
    expect(ultimo).toContain("ÚLTIMA CHANCE");
    expect(ultimo).toContain("Pergunte que fonte abrir.");
    // e a tentativa do meio NÃO pede socorro
    expect(JSON.stringify((pedidos[1] as Corpo).systemInstruction)).not.toContain("ÚLTIMA CHANCE");
  });

  it("a fala recusada não fica no histórico da tentativa seguinte", async () => {
    // Deixá-la no contexto ensinaria justamente o erro que acabou de ser recusado.
    const { pedidos } = dublarFetch([fala("resposta recusada"), fala("resposta boa")]);

    await provider.conversar({ ...base, validar: (t) => (t.includes("recusada") ? ["não"] : []) });

    expect(JSON.stringify((pedidos[1] as Corpo).contents)).not.toContain("resposta recusada");
  });

  it("não excede maxVoltas quando o modelo só pede ferramenta", async () => {
    // Modelo preso pedindo ferramenta para sempre: o laço tem de parar, e a
    // fala vazia vira recusa em vez de chegar vazia ao aluno.
    const { pedidos } = dublarFetch([pedidoDeFerramenta()]);
    let execucoes = 0;

    await expect(
      provider.conversar({
        ...base,
        maxVoltas: 2,
        tentativas: 1,
        ferramentas: {
          declaracoes: [FERRAMENTA],
          executar: async () => {
            execucoes += 1;
            return {};
          },
        },
      }),
    ).rejects.toThrow(ErroDeGeracao);

    expect(pedidos).toHaveLength(2);
    expect(execucoes).toBe(2);
  });

  it("traduz a declaração da ferramenta, inclusive a descrição de cada argumento", async () => {
    // A descrição por propriedade é como o modelo descobre o que pode mandar.
    // Sem ela ele chuta o valor do argumento — e um bairro inventado chega ao
    // executor como se o aluno o tivesse escolhido.
    const { pedidos } = dublarFetch([fala("ok")]);

    await provider.conversar({
      ...base,
      ferramentas: { declaracoes: [FERRAMENTA], executar: async () => ({}) },
    });

    const tools = (pedidos[0] as { tools: Array<{ functionDeclarations: Array<Record<string, unknown>> }> }).tools;
    const decl = tools[0]?.functionDeclarations?.[0] as {
      name: string;
      description: string;
      parameters: { type: string; properties: Record<string, { type: string; description?: string }> };
    };
    expect(decl.name).toBe("usar_dados");
    expect(decl.description).toBe("Carrega uma fonte de dados da cidade.");
    expect(decl.parameters.type).toBe("OBJECT");
    expect(decl.parameters.properties.fonte?.description).toBe("previsao, censo ou viaria");
  });

  it("propaga falha HTTP do Vertex como ErroDeGeracao", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => "assinatura invalida",
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(provider.conversar(base)).rejects.toThrow(ErroDeGeracao);
  });
});

describe("MockProvider.conversar", () => {
  it("chama a primeira ferramenta declarada — o caminho novo não pode ficar sem exercício", async () => {
    const executadas: string[] = [];
    const r = await new MockProvider().conversar({
      ...base,
      ferramentas: {
        declaracoes: [FERRAMENTA],
        executar: async (nome) => {
          executadas.push(nome);
          return {};
        },
      },
    });

    expect(executadas).toEqual(["usar_dados"]);
    expect(r.voltas).toBe(1);
    expect(r.tokensUsados).toBeGreaterThan(0);
  });

  it("não escreve dígito nenhum: regra de domínio costuma recusar número sem ferramenta", async () => {
    const r = await new MockProvider().conversar(base);
    expect(r.texto).not.toMatch(/\d/);
  });
});
