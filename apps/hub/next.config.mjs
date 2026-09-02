import path from "node:path";
import { fileURLToPath } from "node:url";

const raizDoMonorepo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  /**
   * Sem isto, o `standalone` traça as dependências a partir de `apps/hub` e
   * deixa de fora o que vive na raiz do monorepo (`node_modules/.pnpm`,
   * `packages/*`) — a imagem sobe e quebra no primeiro import de `@edu/ui`.
   */
  outputFileTracingRoot: raizDoMonorepo,
  transpilePackages: ["@edu/sdk", "@edu/ui"],
  /**
   * OpenTelemetry e o exportador do Google ficam FORA do bundle do servidor: a
   * instrumentação do `undici` usa `require-in-the-middle`/`diagnostics_channel`
   * e o exportador carrega `@grpc/grpc-js` — nenhum dos dois sobrevive ao
   * empacotamento. `pino`/`pino-pretty` já estão na lista padrão do Next.
   */
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/instrumentation",
    "@opentelemetry/instrumentation-undici",
    "@opentelemetry/resource-detector-gcp",
    "@opentelemetry/exporter-trace-otlp-http",
    "google-auth-library",
  ],
  // Build de produção SEM derrubar o dev server: `pnpm build:isolado` escreve
  // em .next-prod em vez de sobrescrever o .next do `next dev` (sintoma do
  // conflito: tela branca/CSS bugado no dev). Padrão herdado do projeto origem.
  distDir: process.env.HUB_DIST_DIR ?? ".next",
};
