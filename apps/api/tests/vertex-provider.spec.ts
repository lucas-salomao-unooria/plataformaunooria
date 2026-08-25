import { endpointVertex, thinkingConfig } from "../src/ai/vertex.provider";

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
