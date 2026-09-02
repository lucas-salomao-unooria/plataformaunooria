import "server-only";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { GoogleAuth } from "google-auth-library";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { gcpDetector } from "@opentelemetry/resource-detector-gcp";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  ParentBasedSampler,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { configDoOtel } from "./otel-config";

/**
 * OpenTelemetry do hub (runtime Node), iniciado pelo `register()` de
 * `instrumentation.ts`. Difere da api em uma coisa que importa: o Next JÁ
 * emite os spans de servidor (`BaseServer.handleRequest`, `fetch`, route
 * handlers) e JÁ extrai o `traceparent` de entrada assim que existe um
 * `TracerProvider` global — então aqui NÃO entra `instrumentation-http` (o
 * span raiz duplicaria). Só o `undici`, para o `fetch` de saída ao BFF/api
 * levar o `traceparent`.
 *
 * O pai remoto não decide a amostragem (o cabeçalho vem do navegador); o
 * ratio determinístico no `traceId` faz hub e api concordarem sozinhos — ver
 * `apps/api/src/observabilidade/sampler.ts`.
 *
 * O transporte é OTLP pela Telemetry API, com o exportador OFICIAL do
 * OpenTelemetry — o `@google-cloud/opentelemetry-cloud-trace-exporter` foi
 * depreciado e será arquivado em 30/10/2026. O destino não muda: Cloud Trace.
 */
const registro = globalThis as { __otelHub?: NodeSDK };

export function iniciarOtelDoHub(env: Record<string, string | undefined> = process.env): boolean {
  const config = configDoOtel(env, "hub");
  if (!config.ligado || registro.__otelHub) return Boolean(registro.__otelHub);

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const processadores: SpanProcessor[] = [];
  if (config.projeto) {
    // Token da ADC pedido a CADA envio: ele expira em 1 h, e um cabeçalho
    // estático pararia de exportar sozinho depois disso. Mesma fábrica da api
    // (`observabilidade/otlp-google.ts`), copiada pela razão do `lib/log.ts`:
    // um pacote de workspace só para isto não se paga, e a forma tem de mudar
    // nos dois juntos.
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const projeto = config.projeto;
    const cabecalhos = async () => {
      const token = await auth.getAccessToken();
      return { ...(token ? { authorization: `Bearer ${token}` } : {}), "x-goog-user-project": projeto };
    };
    processadores.push(
      new BatchSpanProcessor(new OTLPTraceExporter({ url: "https://telemetry.googleapis.com/v1/traces", headers: cabecalhos }), {
        exportTimeoutMillis: 5_000,
        scheduledDelayMillis: 5_000,
      }),
    );
  }
  if (config.debug) processadores.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  const porRazao = new TraceIdRatioBasedSampler(config.ratio);
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.servico,
      [ATTR_SERVICE_VERSION]: config.versao,
      // Exigido pela ingestão OTLP do Google; o `gcpDetector` não o preenche.
      ...(config.projeto ? { "gcp.project_id": config.projeto } : {}),
    }),
    resourceDetectors: [gcpDetector],
    sampler: new ParentBasedSampler({
      root: porRazao,
      remoteParentSampled: porRazao,
      remoteParentNotSampled: porRazao,
      localParentSampled: new AlwaysOnSampler(),
      localParentNotSampled: new AlwaysOffSampler(),
    }),
    spanProcessors: processadores,
    /**
     * OBRIGATÓRIO, mesmo vazio. Sem a chave, o `NodeSDK` cai no
     * `OTEL_METRICS_EXPORTER` do ambiente e, com ele vazio, assume `otlp` —
     * passando a tentar exportar métricas para `localhost:4318` a cada 60 s.
     * Medido em dev (2026-09-02): uma linha `ERROR` com stack
     * `connect ECONNREFUSED 127.0.0.1:4318` por minuto, para sempre, num
     * projeto que cobra por GiB de log. O hub NÃO tem métrica OpenTelemetry:
     * os handshakes da ponte são métrica de LOG (`/api/ponte`) e os Web Vitals
     * vão para a api. Lista vazia = MeterProvider sem leitor, sem exportação.
     */
    metricReaders: [],
    instrumentations: [new UndiciInstrumentation()],
  });
  sdk.start();
  registro.__otelHub = sdk;

  // O `server.js` do standalone já trata SIGTERM; este listener a mais só
  // garante o flush do último lote dentro dos 10 s do Cloud Run.
  process.once("SIGTERM", () => {
    void sdk.shutdown();
  });
  return true;
}
