import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { AssetsService } from "./assets/assets.service";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Parsers explícitos: JSON com teto e text/csv cru para a importação de
  // usuários (`POST /usuarios/importar-csv` lê o corpo como string).
  app.useBodyParser("json", { limit: "2mb" });
  app.useBodyParser("text", { type: "text/csv", limit: "2mb" });
  // Driver LOCAL de assets (dev): a api serve as imagens geradas em /assets.
  // Em produção (gcs) a CDN serve o bucket e este static nunca é usado.
  if ((process.env.ASSETS_DRIVER ?? "local") !== "gcs") {
    app.useStaticAssets(app.get(AssetsService).dirLocal(), { prefix: "/assets" });
  }
  app.enableCors({
    origin: (
      process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175"
    ).split(","),
  });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
