import { randomUUID } from "node:crypto";

/** O pedaço do `Request`/`Response` do Express que este middleware lê — sem `@types/express`. */
type Requisicao = { headers: Record<string, string | string[] | undefined> };
type Resposta = { setHeader(nome: string, valor: string): unknown };
import { abrirContexto, type ContextoDaRequisicao } from "../tenancy/tenancy-context";
import { lerTrace } from "./trace-da-requisicao";

/**
 * Abre o contexto da requisição ANTES de tudo — é um middleware do Express
 * registrado em `main.ts`, não um interceptor do Nest: interceptor roda depois
 * dos guards, e um 401 sairia sem `requestId`.
 *
 * `requestId` = o `traceId` que o load balancer (ou o cliente) mandou. Assim o
 * código que o professor lê no 500 é o mesmo que quem opera cola no Logs
 * Explorer e no Cloud Trace. Sem trace nenhum (dev, curl), um UUID.
 */
export function contextoMiddleware(req: Requisicao, res: Resposta, next: () => void): void {
  const trace = lerTrace(req.headers);
  const contexto: ContextoDaRequisicao = {
    requestId: trace?.traceId ?? randomUUID(),
    traceId: trace?.traceId,
    spanId: trace?.spanId,
    amostrado: trace?.amostrado,
  };
  res.setHeader("x-request-id", contexto.requestId);
  abrirContexto(contexto, () => next());
}
