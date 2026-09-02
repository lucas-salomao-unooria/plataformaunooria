import { AggregationType, type ViewOptions } from "@opentelemetry/sdk-metrics";

/**
 * Fronteiras dos histogramas da aplicação. Explícitas porque o default do SDK
 * (0, 5, 10, 25 … 10000) é pensado para milissegundos de HTTP e não serve
 * nem para a IA (segundos a minutos) nem para o CLS (frações de unidade).
 */
export const FRONTEIRAS_IA_MS = [250, 500, 1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 60_000, 120_000];
export const FRONTEIRAS_VITAL_MS = [100, 250, 500, 1_000, 2_000, 2_500, 4_000, 8_000];
export const FRONTEIRAS_CLS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
export const FRONTEIRAS_CONTAGEM = [1, 2, 3, 4, 6, 8];

function histograma(instrumentName: string, boundaries: number[]): ViewOptions {
  return { instrumentName, aggregation: { type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM, options: { boundaries } } };
}

export const VISOES: ViewOptions[] = [
  histograma("unooria.ia.latencia", FRONTEIRAS_IA_MS),
  histograma("unooria.ia.voltas", FRONTEIRAS_CONTAGEM),
  histograma("unooria.ia.tentativas", FRONTEIRAS_CONTAGEM),
  histograma("unooria.web.lcp", FRONTEIRAS_VITAL_MS),
  histograma("unooria.web.inp", FRONTEIRAS_VITAL_MS),
  histograma("unooria.web.ttfb", FRONTEIRAS_VITAL_MS),
  histograma("unooria.web.cls", FRONTEIRAS_CLS),
];
