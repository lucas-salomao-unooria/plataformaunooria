import { ALTURA, LARGURA } from "../src/assets/assets.service";
import {
  PROPORCAO_IMAGEM,
  TTS_LIMITE_TEXTO,
  VertexProvider,
  apelidosDosFalantes,
  endpointVertex,
  thinkingConfig,
} from "../src/ai/vertex.provider";

/**
 * Contratos do provider Vertex que não dá para verificar com typecheck e que
 * já custaram uma geração vazia cada um:
 *
 * - `global` não tem host regional (é onde vivem os modelos que a região do
 *   contrato ainda não publicou);
 * - o raciocínio dos modelos 2.5 sai do `maxOutputTokens`, então o default
 *   PRECISA ser 0 — com pensamento livre o plano anual volta vazio.
 */
describe("endpoint do Vertex", () => {
  test("região do contrato usa host regional", () => {
    expect(
      endpointVertex({ project: "entre-redes", location: "southamerica-east1", model: "gemini-2.5-flash" }),
    ).toBe(
      "https://southamerica-east1-aiplatform.googleapis.com/v1/projects/entre-redes/locations/southamerica-east1/publishers/google/models/gemini-2.5-flash:generateContent",
    );
  });

  test("global não leva prefixo no host, mas continua na URL", () => {
    const url = endpointVertex({ project: "entre-redes", location: "global", model: "gemini-3.6-flash" });
    expect(url.startsWith("https://aiplatform.googleapis.com/")).toBe(true);
    expect(url).toContain("/locations/global/");
  });
});

describe("orçamento de raciocínio", () => {
  const original = process.env.VERTEX_THINKING_BUDGET;
  afterEach(() => {
    if (original === undefined) delete process.env.VERTEX_THINKING_BUDGET;
    else process.env.VERTEX_THINKING_BUDGET = original;
  });

  test("ausente = desligado (paridade com o app origem)", () => {
    delete process.env.VERTEX_THINKING_BUDGET;
    expect(thinkingConfig()).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
  });

  test("-1 volta ao pensamento dinâmico e valor positivo vira teto", () => {
    process.env.VERTEX_THINKING_BUDGET = "-1";
    expect(thinkingConfig()).toEqual({ thinkingConfig: { thinkingBudget: -1 } });
    process.env.VERTEX_THINKING_BUDGET = "8000";
    expect(thinkingConfig()).toEqual({ thinkingConfig: { thinkingBudget: 8000 } });
  });

  test("lixo na env desliga em vez de mandar valor inválido ao vendor", () => {
    process.env.VERTEX_THINKING_BUDGET = "muito";
    expect(thinkingConfig()).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
  });
});

describe("proporção da imagem gerada", () => {
  test("é a mesma do card da exp08ef1b — senão o `cover` come a composição", () => {
    const [largura, altura] = PROPORCAO_IMAGEM.split(":").map(Number);
    expect(largura! / altura!).toBeCloseTo(LARGURA / ALTURA, 3);
  });
});

/**
 * Síntese de voz: os três portões que rodam ANTES de qualquer rede.
 *
 * Eles existem porque a Cloud TTS responde 400 seco a roteiro grande, e
 * descobrir isso em produção significaria a fala de uma personagem sumindo da
 * aula sem nenhuma pista no log. Aqui a falha é local, imediata e explica o
 * que fazer — e o teste não toca a rede nem precisa de credencial.
 */
describe("portões da síntese de voz", () => {
  const provider = new VertexProvider();

  test("roteiro acima do teto de BYTES falha antes de chamar a API", async () => {
    // Bytes, não caracteres: em pt-BR cada acento conta 2, e medir por
    // `length` deixaria passar um roteiro que a API recusa.
    const longo = "á".repeat(TTS_LIMITE_TEXTO);
    await expect(
      provider.generateSpeech({ texto: longo, falantes: [{ nome: "Amara", timbre: "jovem-feminino" }] }),
    ).rejects.toThrow(/longo demais/i);
  });

  test("pedido sem texto e sem turnos falha alto", async () => {
    await expect(
      provider.generateSpeech({ falantes: [{ nome: "Amara", timbre: "jovem-feminino" }] }),
    ).rejects.toThrow(/sem texto e sem turnos/i);
  });

  test("pedido sem falante falha alto", async () => {
    await expect(provider.generateSpeech({ texto: "oi", falantes: [] })).rejects.toThrow(
      /sem nenhum falante/i,
    );
  });
});

/*
 * A Cloud TTS recusa com 400 o diálogo cujo apelido de falante tem acento ou
 * espaço. Foi o que deixou o podcast do Unoovista sem áudio: "Téo" derrubava
 * todos os trechos, e a e2e só via "o episódio não ficou pronto".
 */
describe("apelidos dos falantes na síntese de diálogo", () => {
  test("acento e espaço saem do apelido; o nome do roteiro não muda", () => {
    const apelidos = apelidosDosFalantes(["Duda", "Téo", "Ana Clara", "Íris"]);
    expect([...apelidos.values()]).toEqual(["Duda", "Teo", "AnaClara", "Iris"]);
    for (const apelido of apelidos.values()) expect(apelido).toMatch(/^[A-Za-z0-9]+$/);
  });

  test("dois nomes que viram o mesmo apelido não colidem", () => {
    const apelidos = apelidosDosFalantes(["Téo", "Teo"]);
    expect(apelidos.get("Téo")).toBe("Teo");
    expect(apelidos.get("Teo")).toBe("Teo2");
  });

  test("nome sem letra vira Falante<N>", () => {
    expect(apelidosDosFalantes(["—"]).get("—")).toBe("Falante1");
  });
});
