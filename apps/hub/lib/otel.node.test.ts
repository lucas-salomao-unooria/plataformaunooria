import { describe, expect, it, vi } from "vitest";

/**
 * Regressão medida em dev (2026-09-02): sem a chave `metricReaders`, o
 * `NodeSDK` cai no `OTEL_METRICS_EXPORTER` do ambiente e assume `otlp` —
 * tentando exportar para `localhost:4318` a cada 60 s e escrevendo uma linha
 * ERROR por minuto num projeto que cobra por GiB de log. O hub não tem
 * métrica OpenTelemetry; a lista vazia é o que desliga isso.
 */
const construcoes: Array<Record<string, unknown>> = [];
vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class {
    constructor(config: Record<string, unknown>) {
      construcoes.push(config);
    }
    start() {}
    shutdown() {
      return Promise.resolve();
    }
  },
}));

describe("iniciarOtelDoHub", () => {
  it("declara metricReaders vazio — o hub não exporta métrica OpenTelemetry", async () => {
    const { iniciarOtelDoHub } = await import("./otel.node");
    expect(iniciarOtelDoHub({ OBS_TRACE_RATIO: "1", OBS_DEBUG: "1" })).toBe(true);
    expect(construcoes).toHaveLength(1);
    expect(construcoes[0]).toHaveProperty("metricReaders");
    expect(construcoes[0]?.metricReaders).toEqual([]);
  });

  it("com o gate fechado não instancia SDK nenhum", async () => {
    const { iniciarOtelDoHub } = await import("./otel.node");
    const antes = construcoes.length;
    // já iniciado no teste acima (singleton em globalThis): o retorno é o mesmo,
    // e o que importa é não construir um segundo.
    iniciarOtelDoHub({});
    expect(construcoes).toHaveLength(antes);
  });
});
