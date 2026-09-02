import type { ExportResult } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

/**
 * Exportador de spans do NAVEGADOR para a api da plataforma
 * (`POST /observabilidade/v1/traces`), em OTLP/JSON escrito à mão.
 *
 * Por que não o `@opentelemetry/exporter-trace-otlp-http`: ele recebe
 * cabeçalhos ESTÁTICOS, e o token da experiência roda a cada 15 minutos
 * (`hub:token`) — o exportador ficaria mandando um Bearer vencido. Aqui o token
 * é pedido a `getToken()` a cada envio. E por que não o `otlp-transformer`: ele
 * arrasta o protobuf para o bundle; a forma JSON do OTLP para spans cabe em
 * sessenta linhas, e a api valida exatamente este subconjunto.
 *
 * Um span por asset (`resourceFetch` do document-load) é descartado antes de
 * sair: a exp-02 tem dezenas de vídeos e imagens, e cada um viraria um span
 * que ninguém lê e que a api limita a 64 por lote.
 */
export const SPANS_IGNORADOS: ReadonlySet<string> = new Set(["resourceFetch"]);
/** Acima disto o `keepalive` do fetch é recusado pelo navegador (teto de 64 KB). */
const TETO_KEEPALIVE_BYTES = 60_000;

type ValorOtlp = { stringValue: string } | { intValue: string } | { doubleValue: number } | { boolValue: boolean };

export function valorOtlp(v: unknown): ValorOtlp | undefined {
  if (typeof v === "string") return { stringValue: v.slice(0, 256) };
  if (typeof v === "boolean") return { boolValue: v };
  if (typeof v === "number" && Number.isFinite(v)) return Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v };
  // arrays e objetos ficam de fora: a api não os aceita e nada aqui precisa deles
  return undefined;
}

function atributos(attrs: Record<string, unknown>, max: number): Array<{ key: string; value: ValorOtlp }> {
  const saida: Array<{ key: string; value: ValorOtlp }> = [];
  for (const [key, v] of Object.entries(attrs)) {
    const value = valorOtlp(v);
    if (value) saida.push({ key: key.slice(0, 64), value });
    if (saida.length >= max) break;
  }
  return saida;
}

function nanos(t: [number, number]): string {
  return (BigInt(t[0]) * 1_000_000_000n + BigInt(t[1])).toString();
}

export function spanParaOtlp(span: ReadableSpan) {
  const ctx = span.spanContext();
  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    parentSpanId: span.parentSpanContext?.spanId ?? "",
    name: span.name.slice(0, 128),
    // SpanKind da API (INTERNAL=0…CONSUMER=4) → enum OTLP (UNSPECIFIED=0, INTERNAL=1…CONSUMER=5).
    kind: span.kind + 1,
    startTimeUnixNano: nanos(span.startTime),
    endTimeUnixNano: nanos(span.endTime),
    attributes: atributos(span.attributes, 24),
    status: { code: span.status.code, ...(span.status.message ? { message: span.status.message.slice(0, 256) } : {}) },
    events: span.events.slice(0, 8).map((e) => ({
      timeUnixNano: nanos(e.time),
      name: e.name.slice(0, 128),
      attributes: atributos(e.attributes ?? {}, 8),
    })),
  };
}

export function loteOtlp(spans: ReadableSpan[], servico: { expId: string; versao: string }) {
  const porEscopo = new Map<string, { scope: { name: string; version?: string }; spans: ReturnType<typeof spanParaOtlp>[] }>();
  for (const span of spans) {
    if (SPANS_IGNORADOS.has(span.name)) continue;
    const escopo = span.instrumentationScope;
    const chave = `${escopo.name}@${escopo.version ?? ""}`;
    let grupo = porEscopo.get(chave);
    if (!grupo) {
      grupo = { scope: { name: escopo.name, ...(escopo.version ? { version: escopo.version } : {}) }, spans: [] };
      porEscopo.set(chave, grupo);
    }
    grupo.spans.push(spanParaOtlp(span));
  }
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: servico.expId } },
            { key: "service.version", value: { stringValue: servico.versao } },
          ],
        },
        scopeSpans: [...porEscopo.values()].slice(0, 4),
      },
    ],
  };
}

export class ExportadorOtlpDaApi implements SpanExporter {
  constructor(
    private readonly cfg: { apiUrl: string; getToken: () => string; expId: string; versao: string; fetch?: typeof fetch },
  ) {}

  export(spans: ReadableSpan[], aoConcluir: (r: ExportResult) => void): void {
    const lote = loteOtlp(spans, this.cfg);
    const total = lote.resourceSpans[0]?.scopeSpans.reduce((n, s) => n + s.spans.length, 0) ?? 0;
    // ExportResultCode: SUCCESS = 0, FAILED = 1 (constantes locais: o `core` inteiro não vale o import).
    if (total === 0) {
      aoConcluir({ code: 0 });
      return;
    }
    const corpo = JSON.stringify(lote);
    const enviar = this.cfg.fetch ?? fetch;
    enviar(`${this.cfg.apiUrl}/observabilidade/v1/traces`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.getToken()}` },
      body: corpo,
      keepalive: corpo.length < TETO_KEEPALIVE_BYTES,
    })
      .then((r) => aoConcluir(r.ok ? { code: 0 } : { code: 1, error: new Error(`otlp ${r.status}`) }))
      .catch((erro: unknown) => aoConcluir({ code: 1, error: erro instanceof Error ? erro : new Error(String(erro)) }));
  }

  async shutdown(): Promise<void> {}
  async forceFlush(): Promise<void> {}
}
