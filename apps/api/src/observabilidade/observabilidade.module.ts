import { randomUUID } from "node:crypto";
import { Global, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { contextoAtual } from "../tenancy/tenancy-context";
import { FiltroDeExcecao } from "./filtro-de-excecao";
import { logger } from "./logger";

/**
 * SIGTERM do Cloud Run → `app.close()` (via `enableShutdownHooks`) → aqui →
 * `sdk.shutdown()`: o último lote de spans sai antes de o processo morrer.
 * Import dinâmico para o Jest (que sobe o `AppModule` em `openapi-cobertura`)
 * não carregar o SDK; no `main.ts` o módulo já está em cache.
 */
@Injectable()
export class DesligamentoDoOtel implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    const { desligarOtel } = await import("../otel");
    await desligarOtel();
  }
}

/**
 * Liga o pino ao Nest (`Logger` do nestjs-pino substitui o ConsoleLogger em
 * `main.ts`) e registra o filtro global de exceção.
 *
 * `autoLogging: false`: o Cloud Run já grava um log por requisição.
 * `quietReqLogger`: o logger por requisição do pino-http carrega só o
 * `requestId`, não o objeto `req` inteiro (que traz o header `authorization`).
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        logger,
        autoLogging: false,
        quietReqLogger: true,
        customAttributeKeys: { reqId: "requestId" },
        // O middleware de contexto (`main.ts`) roda antes deste: o id já existe.
        genReqId: () => contextoAtual()?.requestId ?? randomUUID(),
      },
    }),
  ],
  providers: [{ provide: APP_FILTER, useClass: FiltroDeExcecao }, DesligamentoDoOtel],
})
export class ObservabilidadeModule {}
