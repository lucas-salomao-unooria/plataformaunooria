import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AssetsService } from "./assets/assets.service";
import { construirDocumento } from "./openapi/documento";
import { credenciaisDoDocs, portaDoDocs } from "./openapi/porta-do-docs";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Parsers explícitos: JSON com teto e text/csv cru para a importação de
  // pessoas (`POST /rostering/importar` lê o corpo como string).
  //
  // O teto do CSV é 10mb porque o de 2mb não cobria o caso real: uma planilha
  // de 10 mil alunos passa de 1mb, e o erro que aparecia era "PayloadTooLarge"
  // no meio da matrícula da rede inteira.
  app.useBodyParser("json", { limit: "2mb" });
  app.useBodyParser("text", { type: "text/csv", limit: "10mb" });
  // Driver LOCAL de assets (dev): a api serve as imagens geradas em /assets.
  // Em produção (gcs) a CDN serve o bucket e este static nunca é usado.
  if ((process.env.ASSETS_DRIVER ?? "local") !== "gcs") {
    app.useStaticAssets(app.get(AssetsService).dirLocal(), { prefix: "/assets" });
  }
  app.enableCors({
    origin: (
      // O fallback tinha parado na 5175: sem `CORS_ORIGINS` no ambiente, as
      // exps 5176 (bem-estar), 5177 (Vila) e 5178 (unooGPT) ficavam fora e o
      // navegador barrava a chamada — com um erro que fala de CORS, não da
      // porta que faltou na lista.
      process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177,http://localhost:5178"
    ).split(","),
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

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
