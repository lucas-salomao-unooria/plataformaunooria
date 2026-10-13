import { randomUUID } from "node:crypto";
import { context, trace } from "@opentelemetry/api";

/**
 * Com o OpenTelemetry ligado, o `http` instrumentation já abriu o span de
 * servidor antes do Express — e mesmo NÃO amostrado ele é um span com
 * `traceId`/`spanId` válidos (propagados do `traceparent`). O `spanId` daqui é
 * o do span desta requisição, que é o que `logging.googleapis.com/spanId`
 * deve carregar. Sem SDK, `getSpan` devolve `undefined` e os cabeçalhos
 * respondem: `traceId` em 100% das requisições nos dois modos.
 */
function traceAtivo(): { traceId: string; spanId: string; amostrado: boolean } | undefined {
  const span = trace.getSpan(context.active())?.spanContext();
  if (!span || !trace.isSpanContextValid(span)) return undefined;
  return { traceId: span.traceId, spanId: span.spanId, amostrado: (span.traceFlags & 1) === 1 };
}

/** O pedaço do `Request`/`Response` do Express que este middleware lê — sem `@types/express`. */
type Requisicao = { headers: Record<string, string | string[] | undefined>; originalUrl?: string; url?: string };
type Resposta = { setHeader(nome: string, valor: string): unknown };
import { abrirContexto, type ContextoDaRequisicao } from "../tenancy/tenancy-context";
import { recursoDaRota } from "../ai/consumo-de-ia";
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
  const t = traceAtivo() ?? lerTrace(req.headers);
  const contexto: ContextoDaRequisicao = {
    requestId: t?.traceId ?? randomUUID(),
    traceId: t?.traceId,
    spanId: t?.spanId,
    amostrado: t?.amostrado,
    // A ROTA, e não o handler: o middleware roda antes do roteamento do Nest.
    recurso: recursoDaRota(req.originalUrl ?? req.url),
  };
  res.setHeader("x-request-id", contexto.requestId);
  abrirContexto(contexto, () => next());
}
