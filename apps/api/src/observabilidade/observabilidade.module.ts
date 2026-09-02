import { randomUUID } from "node:crypto";
import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { contextoAtual } from "../tenancy/tenancy-context";
import { FiltroDeExcecao } from "./filtro-de-excecao";
import { logger } from "./logger";

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
  providers: [{ provide: APP_FILTER, useClass: FiltroDeExcecao }],
})
export class ObservabilidadeModule {}
