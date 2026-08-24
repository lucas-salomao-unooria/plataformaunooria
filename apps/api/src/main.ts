import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:5173").split(",") });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
