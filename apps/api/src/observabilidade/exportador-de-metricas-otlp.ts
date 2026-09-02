import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { JsonMetricsSerializer } from "@opentelemetry/otlp-transformer";
import { AggregationTemporality, type PushMetricExporter, type ResourceMetrics } from "@opentelemetry/sdk-metrics";
import type { ClienteOtlpGoogle } from "./otlp-google";

/**
 * Exportador de métricas para a Telemetry API do Google via OTLP/JSON.
 * Substitui o `@google-cloud/opentelemetry-cloud-monitoring-exporter` (202 MB
 * de `googleapis`) — ver `otlp-google.ts`. Temporalidade CUMULATIVA: é o que o
 * Cloud Monitoring espera de contadores.
 *
 * Falha de envio é devolvida ao `PeriodicExportingMetricReader`, que loga pelo
 * `diag` e tenta de novo no próximo intervalo; nada é acumulado aqui.
 */
export class ExportadorDeMetricasOtlp implements PushMetricExporter {
  constructor(private readonly cliente: ClienteOtlpGoogle) {}

  export(metricas: ResourceMetrics, aoConcluir: (resultado: ExportResult) => void): void {
    const corpo = JsonMetricsSerializer.serializeRequest(metricas);
    if (!corpo) {
      aoConcluir({ code: ExportResultCode.FAILED, error: new Error("otlp: serialização de métricas vazia") });
      return;
    }
    this.cliente
      .enviar("v1/metrics", corpo)
      .then((r) =>
        aoConcluir(
          r.ok
            ? { code: ExportResultCode.SUCCESS }
            : { code: ExportResultCode.FAILED, error: new Error(`otlp metrics: HTTP ${r.status} ${r.detalhe ?? ""}`.trim()) },
        ),
      )
      .catch((erro: unknown) =>
        aoConcluir({ code: ExportResultCode.FAILED, error: erro instanceof Error ? erro : new Error(String(erro)) }),
      );
  }

  selectAggregationTemporality(): AggregationTemporality {
    return AggregationTemporality.CUMULATIVE;
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
