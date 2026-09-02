import { AggregationTemporality, MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { ExportadorDeMetricasOtlp } from "../src/observabilidade/exportador-de-metricas-otlp";
import type { ClienteOtlpGoogle } from "../src/observabilidade/otlp-google";

/** O exportador serializa em OTLP/JSON e entrega ao cliente da Telemetry API; falha vira resultado, não exceção. */
describe("ExportadorDeMetricasOtlp", () => {
  it("serializa as métricas em OTLP/JSON e manda para v1/metrics, cumulativo", async () => {
    const enviados: string[] = [];
    const cliente = { enviar: async (_c: string, corpo: string | Uint8Array) => { enviados.push(Buffer.from(corpo).toString("utf8")); return { ok: true, status: 200 }; } } as unknown as ClienteOtlpGoogle;
    const exportador = new ExportadorDeMetricasOtlp(cliente);
    expect(exportador.selectAggregationTemporality()).toBe(AggregationTemporality.CUMULATIVE);

    const leitor = new PeriodicExportingMetricReader({ exporter: exportador, exportIntervalMillis: 60_000 });
    const provider = new MeterProvider({ readers: [leitor] });
    provider.getMeter("teste").createCounter("unooria.teste.contador").add(3, { motivo: "x" });
    await leitor.forceFlush();
    await provider.shutdown();

    expect(enviados.length).toBeGreaterThanOrEqual(1);
    const json = JSON.parse(enviados[0] ?? "{}") as { resourceMetrics: Array<{ scopeMetrics: Array<{ metrics: Array<{ name: string; sum: { dataPoints: Array<{ asInt?: string | number; asDouble?: number }> } }> }> }> };
    const metrica = json.resourceMetrics[0]?.scopeMetrics[0]?.metrics[0];
    expect(metrica?.name).toBe("unooria.teste.contador");
    expect(Number(metrica?.sum.dataPoints[0]?.asInt ?? metrica?.sum.dataPoints[0]?.asDouble)).toBe(3);
  });

  it("recusa do upstream vira ExportResult FAILED com o status, sem lançar", async () => {
    const cliente = { enviar: async () => ({ ok: false, status: 403, detalhe: "PERMISSION_DENIED" }) } as unknown as ClienteOtlpGoogle;
    const exportador = new ExportadorDeMetricasOtlp(cliente);
    const leitor = new PeriodicExportingMetricReader({ exporter: exportador, exportIntervalMillis: 60_000 });
    const provider = new MeterProvider({ readers: [leitor] });
    provider.getMeter("teste").createCounter("c").add(1);
    // O leitor engole o FAILED e loga pelo diag; o que se prova é que nada lança.
    await expect(leitor.forceFlush()).resolves.toBeUndefined();
    await provider.shutdown();
  });
});
