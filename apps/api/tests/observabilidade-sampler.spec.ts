import { ROOT_CONTEXT, SpanKind, TraceFlags, trace } from "@opentelemetry/api";
import { SamplingDecision } from "@opentelemetry/sdk-trace-base";
import { createHash } from "node:crypto";
import { criarSampler, razaoParaRota } from "../src/observabilidade/sampler";

/**
 * A amostragem é por rota e determinística no traceId — e o pai REMOTO não
 * decide: honrar `sampled=01` de quem chega da internet deixaria qualquer
 * cliente forçar 100% (custo). Pai LOCAL segue o pai.
 */
const SPAN = "00f067aa0ba902b7";
/**
 * Hash, não `n` em hex: o `TraceIdRatioBased` compara os bytes do id com o
 * teto do ratio, e um id "pequeno" (zeros à esquerda) cai SEMPRE abaixo dele —
 * pareceria 100% amostrado e o teste mentiria.
 */
function traceIdDeterministico(n: number): string {
  return createHash("sha256").update(String(n)).digest("hex").slice(0, 32);
}
function decidir(sampler: ReturnType<typeof criarSampler>, traceId: string, caminho: string, ctx = ROOT_CONTEXT) {
  return sampler.shouldSample(ctx, traceId, "GET", SpanKind.SERVER, { "url.path": caminho }, []).decision;
}
/** Um traceId que o ratio dado NÃO amostra (procura entre alguns; a razão é determinística). */
function traceIdNaoAmostrado(ratio: number): string {
  const s = criarSampler(ratio);
  for (let n = 1; n < 5000; n++) {
    const id = traceIdDeterministico(n * 7919);
    if (decidir(s, id, "/usuarios") === SamplingDecision.NOT_RECORD) return id;
  }
  throw new Error("nenhum traceId não amostrado encontrado — o ratio está errado");
}

describe("razaoParaRota", () => {
  it("rotas de IA e o feed usam 10x o ratio, até 1", () => {
    expect(razaoParaRota("/ai/gerar", 0.02)).toBeCloseTo(0.2);
    expect(razaoParaRota("/unoogpt/sessoes/abc/turno", 0.02)).toBeCloseTo(0.2);
    expect(razaoParaRota("/planos", 0.02)).toBeCloseTo(0.2);
    expect(razaoParaRota("/bemestar/checkin", 0.02)).toBeCloseTo(0.2);
    expect(razaoParaRota("/runs/9f3/feed", 0.02)).toBeCloseTo(0.2);
    expect(razaoParaRota("/ai", 0.2)).toBe(1);
  });

  it("as outras rotas ficam no ratio; sem caminho também", () => {
    expect(razaoParaRota("/usuarios", 0.02)).toBe(0.02);
    expect(razaoParaRota("/runs/9f3/eventos", 0.02)).toBe(0.02);
    expect(razaoParaRota("/aiuda", 0.02)).toBe(0.02);
    expect(razaoParaRota(undefined, 0.02)).toBe(0.02);
  });
});

describe("criarSampler", () => {
  it("ratio 1 grava tudo; ratio 0 nada", () => {
    expect(decidir(criarSampler(1), traceIdDeterministico(42), "/usuarios")).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(decidir(criarSampler(0), traceIdDeterministico(42), "/ai/gerar")).toBe(SamplingDecision.NOT_RECORD);
  });

  it("com ratio 0,1 toda rota de IA é gravada (10x = 1), e existe rota comum que não", () => {
    const s = criarSampler(0.1);
    const azarado = traceIdNaoAmostrado(0.1);
    expect(decidir(s, azarado, "/usuarios")).toBe(SamplingDecision.NOT_RECORD);
    expect(decidir(s, azarado, "/ai/gerar")).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(decidir(s, azarado, "/runs/x/feed")).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it("lê `http.target` (semconv antiga, com query) quando não há `url.path`", () => {
    const s = criarSampler(0.1);
    const azarado = traceIdNaoAmostrado(0.1);
    const decisao = s.shouldSample(ROOT_CONTEXT, azarado, "GET", SpanKind.SERVER, { "http.target": "/ai/gerar?x=1" }, []).decision;
    expect(decisao).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it("a mesma decisão para o mesmo traceId (determinístico) — é o que faz hub e api concordarem", () => {
    const a = criarSampler(0.02);
    const b = criarSampler(0.02);
    for (let n = 1; n <= 50; n++) {
      const id = traceIdDeterministico(n * 104729);
      expect(decidir(a, id, "/turmas")).toBe(decidir(b, id, "/turmas"));
    }
  });

  it("pai REMOTO com sampled=01 não força a gravação de um traceId azarado", () => {
    const s = criarSampler(0.1);
    const azarado = traceIdNaoAmostrado(0.1);
    const ctx = trace.setSpanContext(ROOT_CONTEXT, { traceId: azarado, spanId: SPAN, traceFlags: TraceFlags.SAMPLED, isRemote: true });
    expect(decidir(s, azarado, "/usuarios", ctx)).toBe(SamplingDecision.NOT_RECORD);
  });

  it("pai LOCAL decide: filho de span gravado é gravado, de span não gravado não é", () => {
    const s = criarSampler(0.1);
    const azarado = traceIdNaoAmostrado(0.1);
    const paiGravado = trace.setSpanContext(ROOT_CONTEXT, { traceId: azarado, spanId: SPAN, traceFlags: TraceFlags.SAMPLED, isRemote: false });
    const paiNao = trace.setSpanContext(ROOT_CONTEXT, { traceId: azarado, spanId: SPAN, traceFlags: TraceFlags.NONE, isRemote: false });
    expect(decidir(s, azarado, "/usuarios", paiGravado)).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(decidir(s, azarado, "/ai/gerar", paiNao)).toBe(SamplingDecision.NOT_RECORD);
  });
});
