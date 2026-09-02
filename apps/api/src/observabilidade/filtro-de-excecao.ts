import { ArgumentsHost, Catch, HttpException, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { ZodError } from "zod";
import { contextoAtual } from "../tenancy/tenancy-context";
import { logger } from "./logger";
import { redigirTexto } from "./redaction";

/** Tipo que o Error Reporting reconhece mesmo sem `stack_trace`. */
export const TIPO_ERRO_REPORTADO =
  "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent";

/**
 * Filtro global de exceção. Três caminhos:
 *
 *  - `HttpException`: o corpo continua o de hoje (`super.catch`). 5xx vira
 *    UMA linha `ERROR` com stack; 4xx é `debug` — é resposta, não falha.
 *  - `ZodError` que escapou de um `parse(body)` no handler: era 500 genérico;
 *    vira 400 com `path: code`, sem o valor recebido (regra 6 — o corpo da
 *    requisição carrega nome de criança e CPF). É o mesmo formato que o
 *    `ContratoInterceptor` já usa.
 *  - Qualquer outra coisa: 500 `{ codigo: "erro-interno", requestId }` e UMA
 *    linha `ERROR` com `stack_trace`, que o Error Reporting agrupa por
 *    assinatura. O `requestId` no corpo é a ponte entre o relato do professor
 *    e o registro no Logs Explorer.
 */
@Catch()
export class FiltroDeExcecao extends BaseExceptionFilter {
  override catch(excecao: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Requisicao | undefined>();
    const rota = descreverRota(req);
    const requestId = contextoAtual()?.requestId;

    if (excecao instanceof HttpException) {
      const status = excecao.getStatus();
      if (status >= 500) {
        logger.error({ err: excecao, status, rota, codigo: "http-5xx" }, excecao.message);
      } else {
        logger.debug({ status, rota, codigo: "http-4xx" }, excecao.message);
      }
      super.catch(excecao, host);
      return;
    }

    if (excecao instanceof ZodError) {
      const problemas = excecao.issues
        .map((p) => `${p.path.join(".") || "(raiz)"}: ${p.code}`)
        .join("; ");
      logger.debug({ rota, problemas, codigo: "corpo-invalido" }, "corpo fora do contrato");
      this.responder(host, HttpStatus.BAD_REQUEST, { codigo: "corpo-invalido", problemas, requestId });
      return;
    }

    const err = excecao instanceof Error ? excecao : new Error(String(excecao));
    logger.error(
      { err, rota, codigo: "erro-interno", "@type": TIPO_ERRO_REPORTADO },
      err.stack ?? err.message,
    );
    this.responder(host, HttpStatus.INTERNAL_SERVER_ERROR, { codigo: "erro-interno", requestId });
  }

  private responder(host: ArgumentsHost, status: number, corpo: unknown): void {
    const adaptador = this.httpAdapterHost?.httpAdapter ?? this.applicationRef;
    adaptador?.reply(host.switchToHttp().getResponse(), corpo, status);
  }
}

/** O pedaço do `Request` do Express que o filtro lê — sem `@types/express`. */
type Requisicao = { method?: string; originalUrl?: string; url?: string; route?: { path?: string } };

/** `POST /runs/:id/feed` — o template da rota quando o Express já casou; senão o caminho sem query. */
function descreverRota(req: Requisicao | undefined): string | undefined {
  if (!req?.method) return undefined;
  const caminho = req.route?.path ?? (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
  return `${req.method} ${redigirTexto(caminho)}`;
}
