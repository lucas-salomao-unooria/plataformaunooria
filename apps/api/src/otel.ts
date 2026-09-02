/**
 * OpenTelemetry da api — PRIMEIRA importação do `main.ts`, antes de
 * `@nestjs/core`. A instrumentação automática faz *monkey-patch* de `http`,
 * `express`, `undici` e do Prisma no `start()`: se este arquivo fosse
 * importado depois do `AppModule`, esses módulos já estariam carregados e o
 * trace teria só o HTTP de entrada, sem banco e sem IA — em silêncio.
 *
 * Nada aqui importa código da aplicação (o Zod do ConfigModule ainda não
 * rodou); o ambiente é lido cru por `configDoOtel`. Desligado (dev, teste, ou
 * sem `GCP_PROJECT_ID`), nenhum objeto do SDK é criado.
 *
 * Exportador DIRETO para o Cloud Trace, com ADC — a mesma credencial da
 * service account que já autentica o Vertex. Sem sidecar de collector
 * (ADR-57): ele é o gatilho de reavaliação, não o ponto de partida.
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { gcpDetector } from "@opentelemetry/resource-detector-gcp";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { configDoOtel } from "./observabilidade/otel-config";
import { criarSampler } from "./observabilidade/sampler";

/** Sondas não viram span: o uptime check bate 4.320 vezes por dia. */
const ROTAS_SEM_SPAN = /^\/(healthz|readyz)(\?|$)/;

const config = configDoOtel(process.env, "api");
let desligar: () => Promise<void> = async () => {};

if (config.ligado) {
  // Só os nomes estáveis (`url.path`, `http.route`); sem isto o `http` emite
  // os dois vocabulários e cada span dobra de tamanho.
  process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= "http";
  // `PERMISSION_DENIED`/`SERVICE_DISABLED` do exportador precisam aparecer no
  // log — sem isto o SDK engole e o trace simplesmente "não existe".
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const processadores: SpanProcessor[] = [];
  if (config.projeto) {
    processadores.push(
      new BatchSpanProcessor(new TraceExporter({ projectId: config.projeto }), {
        // O Cloud Run dá 10 s no SIGTERM; o default de 30 s de export
        // perderia o último lote.
        exportTimeoutMillis: 5_000,
        scheduledDelayMillis: 5_000,
      }),
    );
  }
  if (config.debug) processadores.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: config.servico, [ATTR_SERVICE_VERSION]: config.versao }),
    resourceDetectors: [gcpDetector],
    sampler: criarSampler(config.ratio),
    spanProcessors: processadores,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => ROTAS_SEM_SPAN.test(req.url ?? ""),
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      new UndiciInstrumentation(),
      // Prisma fala com o Postgres pelo query engine próprio: `instrumentation-pg`
      // não veria nada. Acompanha a versão do `prisma` (AGENTS.md).
      new PrismaInstrumentation(),
    ],
  });
  sdk.start();
  desligar = () => sdk.shutdown();
}

export const otelLigado = config.ligado;

/** Flush e encerramento do SDK — chamado pelo hook de desligamento do Nest (SIGTERM do Cloud Run). */
export function desligarOtel(): Promise<void> {
  return desligar();
}
