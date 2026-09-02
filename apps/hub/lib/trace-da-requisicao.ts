/**
 * Lê o identificador de trace dos cabeçalhos da requisição. Puro: não depende
 * do SDK do OpenTelemetry, e é o que dá `requestId` a toda linha de log mesmo
 * com o exportador de spans desligado. Cópia deliberada de
 * `apps/api/src/observabilidade/trace-da-requisicao.ts` (ver `lib/log.ts`).
 *
 *  - `traceparent` (W3C): `00-<32 hex>-<16 hex>-<2 hex flags>`.
 *  - `X-Cloud-Trace-Context`: `TRACE_ID/SPAN_ID;o=1`, SPAN_ID em DECIMAL —
 *    é o que o load balancer do Google injeta quando ninguém mandou nada.
 */
export interface TraceDaRequisicao {
  traceId: string;
  spanId?: string;
  amostrado: boolean;
}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const CLOUD_TRACE = /^([0-9a-f]{32})(?:\/(\d{1,20}))?(?:;o=([01]))?$/i;
const ZERADO = /^0+$/;

type Cabecalhos = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return typeof v === "string" ? v.trim() : undefined;
}

function spanDecimalParaHex(decimal: string): string | undefined {
  try {
    const n = BigInt(decimal);
    if (n === 0n) return undefined;
    return n.toString(16).padStart(16, "0").slice(-16);
  } catch {
    return undefined;
  }
}

export function lerTrace(cabecalhos: Cabecalhos): TraceDaRequisicao | undefined {
  const w3c = primeiro(cabecalhos["traceparent"])?.match(TRACEPARENT);
  if (w3c) {
    const [, traceId, spanId, flags] = w3c as unknown as [string, string, string, string];
    if (!ZERADO.test(traceId) && !ZERADO.test(spanId)) {
      return { traceId: traceId.toLowerCase(), spanId: spanId.toLowerCase(), amostrado: (parseInt(flags, 16) & 1) === 1 };
    }
  }
  const google = primeiro(cabecalhos["x-cloud-trace-context"])?.match(CLOUD_TRACE);
  if (google) {
    const [, traceId, spanDecimal, opcao] = google as unknown as [string, string, string | undefined, string | undefined];
    if (!ZERADO.test(traceId)) {
      return {
        traceId: traceId.toLowerCase(),
        spanId: spanDecimal ? spanDecimalParaHex(spanDecimal) : undefined,
        amostrado: opcao === "1",
      };
    }
  }
  return undefined;
}

/** O `traceparent` a repassar a quem a requisição chama (api), para o trace atravessar hub → api. */
export function traceparentPara(trace: TraceDaRequisicao | undefined): string | undefined {
  if (!trace?.spanId) return undefined;
  return `00-${trace.traceId}-${trace.spanId}-${trace.amostrado ? "01" : "00"}`;
}
