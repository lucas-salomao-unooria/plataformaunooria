import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { describe, expect, it, vi } from "vitest";
import { ExportadorOtlpDaApi, loteOtlp, spanParaOtlp, valorOtlp } from "./exportador-otlp";

function spanFalso(nome: string, extra: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
    name: nome,
    kind: SpanKind.CLIENT,
    spanContext: () => ({ traceId: "4bf92f3577b34da6a3ce929d0e0e4736", spanId: "00f067aa0ba902b7", traceFlags: 1 }),
    parentSpanContext: { traceId: "4bf92f3577b34da6a3ce929d0e0e4736", spanId: "0000000000000001", traceFlags: 1 },
    startTime: [1756771200, 0],
    endTime: [1756771200, 500_000_000],
    status: { code: SpanStatusCode.OK },
    attributes: { "http.method": "GET", "http.status_code": 200, "http.url": "https://api/x", lista: [1, 2], ratio: 0.5, ok: true },
    links: [],
    events: [{ name: "fetchStart", time: [1756771200, 1], attributes: {} }],
    duration: [0, 500_000_000],
    ended: true,
    resource: { attributes: {} } as never,
    instrumentationScope: { name: "@opentelemetry/instrumentation-fetch", version: "0.222.0" },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    ...extra,
  } as ReadableSpan;
}

describe("spanParaOtlp / loteOtlp", () => {
  it("converte para a forma OTLP/JSON que a api aceita", () => {
    const s = spanParaOtlp(spanFalso("HTTP GET"));
    expect(s).toMatchObject({ traceId: "4bf92f3577b34da6a3ce929d0e0e4736", spanId: "00f067aa0ba902b7", parentSpanId: "0000000000000001", name: "HTTP GET", kind: 3, startTimeUnixNano: "1756771200000000000", endTimeUnixNano: "1756771200500000000", status: { code: 1 } });
    const chaves = s.attributes.map((a) => a.key);
    expect(chaves).toEqual(["http.method", "http.status_code", "http.url", "ratio", "ok"]); // `lista` (array) cai fora
    expect(s.attributes.find((a) => a.key === "http.status_code")?.value).toEqual({ intValue: "200" });
    expect(s.events).toHaveLength(1);
  });

  it("descarta resourceFetch, agrupa por escopo e escreve o resource da experiência", () => {
    const lote = loteOtlp([spanFalso("documentLoad"), spanFalso("resourceFetch"), spanFalso("HTTP GET")], { expId: "exp04ef1b", versao: "1.2.3" });
    expect(lote.resourceSpans[0]?.resource.attributes).toEqual([
      { key: "service.name", value: { stringValue: "exp04ef1b" } },
      { key: "service.version", value: { stringValue: "1.2.3" } },
    ]);
    expect(lote.resourceSpans[0]?.scopeSpans[0]?.spans.map((s) => s.name)).toEqual(["documentLoad", "HTTP GET"]);
  });

  it("valorOtlp: string, int, double, bool; objeto e array ficam de fora", () => {
    expect(valorOtlp("a")).toEqual({ stringValue: "a" });
    expect(valorOtlp(3)).toEqual({ intValue: "3" });
    expect(valorOtlp(1.5)).toEqual({ doubleValue: 1.5 });
    expect(valorOtlp(false)).toEqual({ boolValue: false });
    expect(valorOtlp([1])).toBeUndefined();
    expect(valorOtlp({})).toBeUndefined();
  });
});

describe("ExportadorOtlpDaApi", () => {
  it("POST em /observabilidade/v1/traces com o token ATUAL a cada envio", async () => {
    let token = "t1";
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const exp = new ExportadorOtlpDaApi({ apiUrl: "https://api", getToken: () => token, expId: "exp08ef1b", versao: "1.1.1", fetch: fetchMock as unknown as typeof fetch });
    const r1 = await new Promise((res) => exp.export([spanFalso("HTTP GET")], res));
    token = "t2";
    const r2 = await new Promise((res) => exp.export([spanFalso("HTTP GET")], res));
    expect(r1).toEqual({ code: 0 });
    expect(r2).toEqual({ code: 0 });
    const inits = fetchMock.mock.calls.map((c) => (c as unknown as [string, RequestInit])[1]);
    expect((inits[0]?.headers as Record<string, string>).authorization).toBe("Bearer t1");
    expect((inits[1]?.headers as Record<string, string>).authorization).toBe("Bearer t2");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://api/observabilidade/v1/traces");
  });

  it("lote só de resourceFetch não faz requisição; erro HTTP vira FAILED", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 429 }));
    const exp = new ExportadorOtlpDaApi({ apiUrl: "https://api", getToken: () => "t", expId: "exp08ef1b", versao: "1.1.1", fetch: fetchMock as unknown as typeof fetch });
    expect(await new Promise((res) => exp.export([spanFalso("resourceFetch")], res))).toEqual({ code: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    const r = (await new Promise((res) => exp.export([spanFalso("x")], res))) as { code: number };
    expect(r.code).toBe(1);
  });
});
