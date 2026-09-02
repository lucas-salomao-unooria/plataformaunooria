import "server-only";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
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
 */
const registro = globalThis as { __otelHub?: NodeSDK };

export function iniciarOtelDoHub(env: Record<string, string | undefined> = process.env): boolean {
  const config = configDoOtel(env, "hub");
  if (!config.ligado || registro.__otelHub) return Boolean(registro.__otelHub);

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const processadores: SpanProcessor[] = [];
  if (config.projeto) {
    processadores.push(
      new BatchSpanProcessor(new TraceExporter({ projectId: config.projeto }), {
        exportTimeoutMillis: 5_000,
        scheduledDelayMillis: 5_000,
      }),
    );
  }
  if (config.debug) processadores.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  const porRazao = new TraceIdRatioBasedSampler(config.ratio);
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: config.servico, [ATTR_SERVICE_VERSION]: config.versao }),
    resourceDetectors: [gcpDetector],
    sampler: new ParentBasedSampler({
      root: porRazao,
      remoteParentSampled: porRazao,
      remoteParentNotSampled: porRazao,
      localParentSampled: new AlwaysOnSampler(),
      localParentNotSampled: new AlwaysOffSampler(),
    }),
    spanProcessors: processadores,
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
