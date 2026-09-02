import { z } from "zod";
import { ExportadorOtlpDaApi } from "./exportador-otlp";

/**
 * OpenTelemetry Web dentro da experiência (decisão de 2026-09-02): spans de
 * `document-load` e de todo `fetch`, exportados para a api da plataforma, que
 * os valida e reexporta ao Cloud Trace. É o que põe a abertura de uma missão
 * numa só linha do tempo: navegador → api → Postgres → Vertex.
 *
 * Só liga DEPOIS do handshake e só se `config.obs.traceRatio > 0` — o ratio
 * vem do hub (env de runtime), nunca de `import.meta.env`: mudar a amostragem
 * não pode exigir republicar as seis experiências. Os pacotes entram por
 * `import()` dinâmico: com ratio 0 (dev) nada é baixado, e o hub, que
 * transpila esta SDK, não avalia o SDK web no servidor.
 *
 * Sem `context-zone` (zone.js, ~100 KB): perde-se só a paternidade automática
 * entre spans iniciados em callbacks assíncronos soltos; o `fetch` continua
 * com `traceparent` e com o span de documento como pai quando iniciado dentro
 * dele. A amostragem é decidida aqui (raiz) pelo `traceId`, e o servidor
 * redecide pelo mesmo `traceId` — o cliente não força nada.
 */
export const ObsConfigSchema = z
  .object({
    traceRatio: z.number().min(0).max(1).default(0),
  })
  .partial();
export type ObsConfig = z.infer<typeof ObsConfigSchema>;

/** Lê `config.obs` do `hub:init` sem confiar na forma. */
export function lerObsConfig(config: Record<string, unknown> | undefined): { traceRatio: number } {
  const r = ObsConfigSchema.safeParse(config?.obs);
  return { traceRatio: r.success ? (r.data.traceRatio ?? 0) : 0 };
}

export interface TracesWeb {
  /** Envia o que está no buffer (pagehide, conclusão). */
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface OpcoesDosTracesWeb {
  traceRatio: number;
  apiUrl: string;
  expId: string;
  versao: string;
  getToken: () => string;
}

/** A cada quanto o lote sai. 30 s, não 10: uma escola inteira sai por um NAT e o rate limit do WAF é por IP. */
export const INTERVALO_DE_EXPORT_MS = 30_000;

export async function iniciarTracesWeb(o: OpcoesDosTracesWeb): Promise<TracesWeb | null> {
  if (!(o.traceRatio > 0) || typeof window === "undefined") return null;

  const [{ WebTracerProvider, BatchSpanProcessor, TraceIdRatioBasedSampler }, { resourceFromAttributes }, { W3CTraceContextPropagator }, { registerInstrumentations }, { FetchInstrumentation }, { DocumentLoadInstrumentation }] =
    await Promise.all([
      import("@opentelemetry/sdk-trace-web"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/core"),
      import("@opentelemetry/instrumentation"),
      import("@opentelemetry/instrumentation-fetch"),
      import("@opentelemetry/instrumentation-document-load"),
    ]);

  const exportador = new ExportadorOtlpDaApi({ apiUrl: o.apiUrl, getToken: o.getToken, expId: o.expId, versao: o.versao });
  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({ "service.name": o.expId, "service.version": o.versao }),
    sampler: new TraceIdRatioBasedSampler(Math.min(1, o.traceRatio)),
    spanProcessors: [
      new BatchSpanProcessor(exportador, { maxExportBatchSize: 64, scheduledDelayMillis: INTERVALO_DE_EXPORT_MS, exportTimeoutMillis: 10_000 }),
    ],
  });
  provider.register({ propagator: new W3CTraceContextPropagator() });

  const origemDaApi = new URL(o.apiUrl).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new FetchInstrumentation({
        // O `traceparent` só vai para a NOSSA api (é cross-origin: o bundle vive
        // na CDN). Mandá-lo a terceiros seria vazar o id da sessão.
        propagateTraceHeaderCorsUrls: [new RegExp(`^${origemDaApi}`)],
        // O próprio export, a telemetria de saída e o Clarity não viram span:
        // seriam spans sobre a coleta, não sobre a experiência.
        ignoreUrls: [/\/observabilidade\//, /\/telemetry\/beacon$/, /clarity\.ms/],
        clearTimingResources: true,
      }),
      // Registrado depois do `load`? Ele lê o `readyState` e emite na hora.
      new DocumentLoadInstrumentation(),
    ],
  });

  const flush = () => void provider.forceFlush();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  return {
    forceFlush: () => provider.forceFlush(),
    shutdown: () => provider.shutdown(),
  };
}
