import { randomUUID } from "node:crypto";
import { Global, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { contextoAtual } from "../tenancy/tenancy-context";
import { FiltroDeExcecao } from "./filtro-de-excecao";
import { logger } from "./logger";
import { Metricas } from "./metricas";
import { ObservabilidadePublicoController } from "./observabilidade-publico.controller";
import { ObservabilidadeController } from "./observabilidade.controller";
import { ClienteOtlpGoogle } from "./otlp-google";
import { ProxyOtlpService } from "./otlp-proxy.service";

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
/**
 * Sem `GCP_PROJECT_ID` não há cliente: o proxy conta e descarta. O mesmo
 * cliente que o `otel.ts` usa para as métricas — mesma credencial ADC.
 *
 * Constante exportada, e não literal dentro do `@Module`, para que a regressão
 * de injeção (`tests/observabilidade-injecao.spec.ts`) monte ESTE provider em
 * vez de uma cópia: um teste que redeclara a factory passa verde enquanto a do
 * módulo está quebrada.
 */
export const PROVIDER_DO_CLIENTE_OTLP = {
  provide: ClienteOtlpGoogle,
  useFactory: () => (process.env.GCP_PROJECT_ID ? new ClienteOtlpGoogle(process.env.GCP_PROJECT_ID) : undefined),
};

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
  // O público vem PRIMEIRO: `observabilidade/publico/*` é prefixo mais específico
  // que `observabilidade/*`, e o Nest casa na ordem de registro.
  controllers: [ObservabilidadePublicoController, ObservabilidadeController],
  providers: [
    { provide: APP_FILTER, useClass: FiltroDeExcecao },
    DesligamentoDoOtel,
    Metricas,
    ProxyOtlpService,
    PROVIDER_DO_CLIENTE_OTLP,
  ],
  exports: [Metricas],
})
export class ObservabilidadeModule {}
