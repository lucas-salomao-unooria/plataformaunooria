import type { Attributes, Context, Link, SpanKind } from "@opentelemetry/api";
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type Sampler,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-base";

/**
 * Amostragem por rota (cap. 17): as rotas em que a LATÊNCIA é o produto — IA e
 * o feed adaptativo — guardam 10x mais linhas do tempo que o resto, até 100%.
 */
export const ROTAS_QUENTES: readonly RegExp[] = [/^\/(ai|unoogpt|planos|bemestar)(\/|$)/, /^\/runs\/[^/]+\/feed$/];
export const MULTIPLICADOR_ROTAS_QUENTES = 10;

export function razaoParaRota(caminho: string | undefined, ratio: number): number {
  if (caminho && ROTAS_QUENTES.some((r) => r.test(caminho))) {
    return Math.min(1, ratio * MULTIPLICADOR_ROTAS_QUENTES);
  }
  return ratio;
}

/**
 * Decide pelo `traceId` (determinístico) e pela rota. Lê `url.path` (semconv
 * estável) ou `http.target` (antigo, pode trazer query) — o `http`
 * instrumentation emite um ou outro conforme `OTEL_SEMCONV_STABILITY_OPT_IN`.
 */
class SamplerPorRota implements Sampler {
  private readonly cache = new Map<number, TraceIdRatioBasedSampler>();

  constructor(private readonly ratio: number) {}

  shouldSample(
    contexto: Context,
    traceId: string,
    nome: string,
    tipo: SpanKind,
    atributos: Attributes,
    links: Link[],
  ): SamplingResult {
    const bruto = atributos["url.path"] ?? atributos["http.target"];
    const caminho = typeof bruto === "string" ? bruto.split("?")[0] : undefined;
    void nome; void tipo; void links;
    return this.porRazao(razaoParaRota(caminho, this.ratio)).shouldSample(contexto, traceId);
  }

  toString(): string {
    return `SamplerPorRota{ratio=${this.ratio}}`;
  }

  private porRazao(razao: number): TraceIdRatioBasedSampler {
    let s = this.cache.get(razao);
    if (!s) {
      s = new TraceIdRatioBasedSampler(razao);
      this.cache.set(razao, s);
    }
    return s;
  }
}

/**
 * `ParentBased`, com uma diferença deliberada: o pai REMOTO não decide. O
 * `traceparent` chega da internet (a SDK no navegador, o hub, um curl) e
 * honrar `sampled=01` deixaria qualquer cliente forçar 100% de amostragem —
 * que é custo. Como `TraceIdRatioBased` é determinístico no `traceId`, hub e
 * api com o mesmo ratio tomam a MESMA decisão sem confiar um no outro; nas
 * rotas quentes a api guarda mais que o hub e o Cloud Trace mostra o trace
 * parcial. Pai LOCAL (span filho do mesmo processo) segue o pai, como sempre.
 */
export function criarSampler(ratio: number): Sampler {
  const porRota = new SamplerPorRota(ratio);
  return new ParentBasedSampler({
    root: porRota,
    remoteParentSampled: porRota,
    remoteParentNotSampled: porRota,
    localParentSampled: new AlwaysOnSampler(),
    localParentNotSampled: new AlwaysOffSampler(),
  });
}
