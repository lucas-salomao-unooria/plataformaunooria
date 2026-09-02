import { AggregationTemporality, InMemoryMetricExporter, MeterProvider, PeriodicExportingMetricReader, type MetricData } from "@opentelemetry/sdk-metrics";
import { Metricas } from "../src/observabilidade/metricas";

/**
 * `Metricas` com um MeterProvider em memória: os testes registram e leem o que
 * saiu, sem o SDK global (que o `otel.ts` nunca inicia em teste).
 */
export function metricasEmMemoria() {
  const exportador = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const leitor = new PeriodicExportingMetricReader({ exporter: exportador, exportIntervalMillis: 60_000 });
  const provider = new MeterProvider({ readers: [leitor] });
  const metricas = new Metricas(provider);

  async function coletar(): Promise<MetricData[]> {
    const { resourceMetrics } = await leitor.collect();
    return resourceMetrics.scopeMetrics.flatMap((s) => s.metrics);
  }
  /** Os pontos de um instrumento, por nome. */
  async function pontos(nome: string) {
    const m = (await coletar()).find((x) => x.descriptor.name === nome);
    return m?.dataPoints ?? [];
  }
  return { metricas, coletar, pontos, encerrar: () => provider.shutdown() };
}
