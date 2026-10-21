import type { AiJsonRequest, AiProvider } from "../src/ai/provider";
import { PUBLICO_ALVO } from "../src/comum/insta/defaults";
import type { Antagonismo } from "../src/comum/insta/tipos";
import { destilarAntagonismo, normalizarAntagonismo } from "../src/geracao/prompts/destilacao";
import { gerarReacoes } from "../src/geracao/prompts/reacoes";

/**
 * Prompts da geração (auditoria de prompts, M06). Sem rede e sem banco: um
 * provider falso captura o que iria ao modelo.
 */
function capturador(): { provider: AiProvider; pedidos: AiJsonRequest<unknown>[] } {
  const pedidos: AiJsonRequest<unknown>[] = [];
  const provider = {
    generateJson: async (req: AiJsonRequest<unknown>) => {
      pedidos.push(req);
      throw new Error("capturado");
    },
  } as unknown as AiProvider;
  return { provider, pedidos };
}

const ENTRADA = { disciplina: "História", recorte: "Brasil Império", temaGeral: "Abolição" };

describe("o prompt da destilação", () => {
  it("o schema já força o JSON: o prompt não repete o pedido, e a idade sai da constante", async () => {
    const { provider, pedidos } = capturador();
    await destilarAntagonismo(provider, ENTRADA).catch(() => undefined);
    const { prompt, responseSchema } = pedidos[0]!;
    expect(responseSchema.type).toBe("object");
    expect(prompt).not.toMatch(/apenas o JSON/i);
    expect(prompt).toContain("Português do Brasil.");
    // a idade hardcoded ("estudante de 13 anos") divergia da constante do sistema
    expect(prompt).not.toContain("estudante de 13 anos");
    expect(prompt).toContain(`estudante de ${PUBLICO_ALVO.idade} anos no relatório final`);
  });

  it('pede "aviso" como string vazia quando ok, não null (o schema exige string)', async () => {
    const { provider, pedidos } = capturador();
    await destilarAntagonismo(provider, ENTRADA).catch(() => undefined);
    const { prompt, responseSchema } = pedidos[0]!;
    const aviso = responseSchema.properties?.equilibrio?.properties?.aviso;
    expect(aviso?.type).toBe("string");
    expect(responseSchema.properties?.equilibrio?.required).toContain("aviso");
    expect(prompt).toContain('"aviso" deve ser uma string vazia');
    expect(prompt).not.toContain('"aviso" deve ser null');
  });
});

describe("normalizarAntagonismo (recálculo que o prompt não precisa ensinar)", () => {
  const lado = { label: "L", tese: "t", argumentos: ["a"], tom_tipico: "tom" };
  const base = (equilibrio: { ok: boolean; nota: number; aviso: string | null }) =>
    ({
      perguntas_candidatas: [{ pergunta: "P?", equilibrio, por_que: "x" }],
      escolhida: 7,
      equilibrio: { ok: true, nota: 0.99, aviso: null },
      ladoA: lado,
      ladoB: lado,
    }) as unknown as Antagonismo;

  it("ok=true com aviso vazio vira aviso null; a nota manda no ok", () => {
    const certo = normalizarAntagonismo(base({ ok: true, nota: 0.8, aviso: "" }));
    expect(certo.equilibrio).toMatchObject({ ok: true, aviso: null });
    const errado = normalizarAntagonismo(base({ ok: true, nota: 0.3, aviso: null }));
    expect(errado.equilibrio.ok).toBe(false);
    expect(errado.equilibrio.aviso).toMatch(/dois lados/);
  });

  it("o equilíbrio do topo é o da escolhida, e o índice é limitado ao array", () => {
    const r = normalizarAntagonismo(base({ ok: true, nota: 0.8, aviso: "" }));
    expect(r.escolhida).toBe(0);
    expect(r.equilibrio).toEqual(r.perguntas_candidatas[0]!.equilibrio);
  });
});

describe("o prompt das reações", () => {
  it("usa a idade da constante e não repete o pedido de JSON no system", async () => {
    const { provider, pedidos } = capturador();
    await gerarReacoes(provider, {
      elenco: [{ handle: "@ana", displayName: "Ana", voz: "direta" } as never],
      perguntaChave: "P?",
      textoDoEstudante: "acho que sim",
      contexto: "Ele publicou um post.",
    });
    const { prompt, system } = pedidos[0]!;
    expect(prompt).toContain(`adolescente brasileiro de ${PUBLICO_ALVO.idade} anos`);
    expect(prompt).not.toContain("13 a 14 anos");
    expect(system).not.toMatch(/JSON/);
  });
});
