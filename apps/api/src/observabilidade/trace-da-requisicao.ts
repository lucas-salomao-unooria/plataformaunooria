/**
 * Lê o identificador de trace dos cabeçalhos da requisição. Puro: não depende
 * do SDK do OpenTelemetry, e é o que garante `traceId` em 100% das linhas de
 * log mesmo com o exportador de spans desligado (`OBS_TRACE_RATIO=0`).
 *
 * Dois formatos, nesta ordem de preferência:
 *  - `traceparent` (W3C Trace Context): `00-<32 hex>-<16 hex>-<2 hex flags>`.
 *    É o que a SDK no navegador e o hub mandam.
 *  - `X-Cloud-Trace-Context`: `TRACE_ID/SPAN_ID;o=1`, com SPAN_ID em DECIMAL.
 *    É o que o load balancer do Google injeta quando ninguém mandou nada.
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

/** SPAN_ID decimal do Google → 16 hex. `BigInt` porque passa de 2^53. */
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
      return {
        traceId: traceId.toLowerCase(),
        spanId: spanId.toLowerCase(),
        amostrado: (parseInt(flags, 16) & 1) === 1,
      };
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
