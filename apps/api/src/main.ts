// PRIMEIRA linha, antes de qualquer outro import: a instrumentação do
// OpenTelemetry precisa patchear `http`/`express`/`undici`/Prisma ANTES de o
// Nest os carregar. Ver `otel.ts`.
import "./otel";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { contextoMiddleware } from "./observabilidade/contexto.middleware";
import { logger } from "./observabilidade/logger";
import { AssetsService } from "./assets/assets.service";
import { construirDocumento } from "./openapi/documento";
import { credenciaisDoDocs, portaDoDocs } from "./openapi/porta-do-docs";
import { TETO_EM_MB } from "./rostering/rostering.service";

async function bootstrap() {
  // `bufferLogs`: o que o Nest loga durante a montagem dos módulos espera o
  // `useLogger` abaixo, e sai em JSON como todo o resto.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // PRIMEIRO middleware: abre o contexto da requisição (requestId/trace) antes
  // dos parsers e dos guards — um 401 sai com `x-request-id` como qualquer 200.
  app.use(contextoMiddleware);
  // SIGTERM do Cloud Run → `app.close()` → hooks de desligamento (o flush do
  // OpenTelemetry entra por aqui).
  app.enableShutdownHooks();
  // Parsers explícitos: JSON com teto e text/csv cru para a importação de
  // pessoas (`POST /rostering/importar` lê o corpo como string).
  //
  // O teto do CSV é o `TETO_DO_ARQUIVO` do rostering, e a ORDEM entre os dois
  // importa: com o parser menor que a rota, o corpo morre no middleware e o
  // gestor recebe um "PayloadTooLarge" do Express, sem o texto que diz o que
  // fazer. O `mb` do parser é MEBIbyte (30mb = 31,4 MB), então ele fica ~5%
  // ACIMA do teto da rota — e é essa folga que faz a nossa mensagem ser a que
  // aparece. Eram 10mb, que cobriam a planilha de uma escola mas não o binding
  // OneRoster de uma rede.
  app.useBodyParser("json", { limit: "2mb" });
  app.useBodyParser("text", { type: "text/csv", limit: `${TETO_EM_MB}mb` });
  // Driver LOCAL de assets (dev): a api serve as imagens geradas em /assets.
  // Em produção (gcs) a CDN serve o bucket e este static nunca é usado.
  if ((process.env.ASSETS_DRIVER ?? "local") !== "gcs") {
    app.useStaticAssets(app.get(AssetsService).dirLocal(), { prefix: "/assets" });
  }
  app.enableCors({
    origin: (
      // **Toda porta de experiência nova entra AQUI.** O fallback já parou na
      // 5175 uma vez, e as exps 5176/5177/5178 ficaram fora: o navegador barra
      // a chamada com um erro que fala de CORS, não da porta que faltou — o
      // sintoma na tela é a experiência abrindo e morrendo em "Failed to
      // fetch", como se a api estivesse fora do ar.
      //
      // 5179 (Eco), 5180 (plano de ensino) e 5181 (Rastro do Boato) entraram
      // depois. A lista viva é `apps/hub/lib/experiencias-dev.ts`.
      process.env.CORS_ORIGINS ??
      [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://localhost:5179",
        "http://localhost:5180",
        "http://localhost:5181",
      ].join(",")    ).split(","),
  });
  /**
   * Documentação OpenAPI em `/docs`, e o JSON em `/docs-json`.
   *
   * Sem `SWAGGER_USUARIO`/`SWAGGER_SENHA` nada disto é montado, e o 404 que
   * responde é o do roteador — a api tem domínio próprio no balanceador, e o
   * que a porta protege é o mapa das 146 rotas. A porta entra ANTES do
   * `setup`, senão o próprio JS do Swagger UI (servido debaixo de `/docs`)
   * sairia sem credencial.
   */
  const credenciais = credenciaisDoDocs();
  if (credenciais) {
    const porta = portaDoDocs(credenciais);
    app.use("/docs", porta);
    app.use("/docs-json", porta);
    SwaggerModule.setup("docs", app, construirDocumento(app), {
      jsonDocumentUrl: "docs-json",
      // Sem isto, o token colado em "Authorize" se perde a cada recarga — e
      // conferir uma rota vira colar o token de novo a cada tentativa.
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const porta = process.env.PORT ?? 3001;
  await app.listen(porta);
  // Uma linha por subida, sempre: é a sonda de que o stdout deste contêiner
  // chega ao Cloud Logging como `jsonPayload` (medição de 2026-09-01: só o
  // request log aparecia lá, e nenhuma linha da aplicação).
  logger.info({ codigo: "api-iniciada", porta: Number(porta) }, "api iniciada");
}
void bootstrap();
