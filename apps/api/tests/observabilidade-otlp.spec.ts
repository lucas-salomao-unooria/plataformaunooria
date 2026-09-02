import { OtlpTracesSchema, type OtlpTraces } from "../src/observabilidade/contrato-de-rotas";
import { ClienteOtlpGoogle } from "../src/observabilidade/otlp-google";
import { ProxyOtlpService, identidadeDoLote, limparSpan, reescreverLote } from "../src/observabilidade/otlp-proxy.service";
import { metricasEmMemoria } from "./metricas-em-memoria";

/**
 * O lote que a SDK exporta do navegador é entrada não confiável: o proxy o
 * valida (Zod fechado), reescreve o resource, filtra atributos, tira a query
 * das URLs e só então manda para o Google com a credencial da api.
 */
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN = "00f067aa0ba902b7";

function lote(spans = 1, extras: Partial<OtlpTraces["resourceSpans"][0]> = {}): unknown {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "exp-02-unootube" } },
            { key: "service.version", value: { stringValue: "0.3.1" } },
            { key: "user_agent.original", value: { stringValue: "Mozilla/5.0 (aluno)" } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "@opentelemetry/instrumentation-fetch", version: "0.222.0" },
            spans: Array.from({ length: spans }, (_, i) => ({
              traceId: TRACE,
              spanId: (i + 1).toString(16).padStart(16, "0"),
              parentSpanId: SPAN,
              name: "HTTP GET",
              kind: 3,
              startTimeUnixNano: "1756771200000000000",
              endTimeUnixNano: "1756771200500000000",
              attributes: [
                { key: "http.method", value: { stringValue: "GET" } },
                { key: "http.url", value: { stringValue: "https://api/x/unootube/sessao?token=abc&cpf=12345678909" } },
                { key: "http.status_code", value: { intValue: 200 } },
                { key: "http.user_agent", value: { stringValue: "Mozilla" } },
              ],
              links: [{ traceId: TRACE, spanId: SPAN }],
              traceState: "x=1",
            })),
          },
        ],
        ...extras,
      },
    ],
  };
}

describe("OtlpTracesSchema", () => {
  it("aceita o subconjunto e REMOVE links/traceState", () => {
    const r = OtlpTracesSchema.parse(lote(2));
    const span = r.resourceSpans[0]?.scopeSpans[0]?.spans[0];
    expect(span).toBeDefined();
    expect(span).not.toHaveProperty("links");
    expect(span).not.toHaveProperty("traceState");
  });

  it("recusa mais de 64 spans, traceId inválido e atributo fora do formato", () => {
    expect(OtlpTracesSchema.safeParse(lote(65)).success).toBe(false);
    const ruim = lote(1) as { resourceSpans: Array<{ scopeSpans: Array<{ spans: Array<{ traceId: string }> }> }> };
    ruim.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.traceId = "zz";
    expect(OtlpTracesSchema.safeParse(ruim).success).toBe(false);
    expect(OtlpTracesSchema.safeParse({ resourceSpans: [] }).success).toBe(false);
  });
});

describe("identidadeDoLote / limparSpan / reescreverLote", () => {
  it("lê service.name/version válidos; recusa formato estranho", () => {
    expect(identidadeDoLote(OtlpTracesSchema.parse(lote()))).toEqual({ expId: "exp-02-unootube", versao: "0.3.1", superficie: "exp" });
    const hub = OtlpTracesSchema.parse(lote());
    hub.resourceSpans[0]!.resource!.attributes![0] = { key: "service.name", value: { stringValue: "hub" } };
    expect(identidadeDoLote(hub)?.superficie).toBe("hub");
    const estranho = OtlpTracesSchema.parse(lote());
    estranho.resourceSpans[0]!.resource!.attributes![0] = { key: "service.name", value: { stringValue: "../etc" } };
    expect(identidadeDoLote(estranho)).toBeUndefined();
  });

  it("filtra atributos por allowlist e tira a query da URL", () => {
    const span = OtlpTracesSchema.parse(lote()).resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    const limpo = limparSpan(span);
    const chaves = limpo.attributes?.map((a) => a.key);
    expect(chaves).toEqual(["http.method", "http.url", "http.status_code"]);
    const url = limpo.attributes?.find((a) => a.key === "http.url")?.value as { stringValue: string };
    expect(url.stringValue).toBe("https://api/x/unootube/sessao");
  });

  it("substitui o resource do cliente e conta os spans", () => {
    const { corpo, spans } = reescreverLote(OtlpTracesSchema.parse(lote(3)), { expId: "exp-02-unootube", versao: "0.3.1", superficie: "exp" });
    expect(spans).toBe(3);
    const attrs = corpo.resourceSpans[0]!.resource!.attributes!;
    expect(attrs.map((a) => a.key)).toEqual(["service.name", "service.version", "service.namespace", "telemetry.sdk.language"]);
    expect(JSON.stringify(corpo)).not.toContain("aluno");
  });
});

describe("ProxyOtlpService", () => {
  function clienteFalso(ok = true) {
    const enviados: Array<{ caminho: string; corpo: string }> = [];
    const cliente = {
      enviar: async (caminho: string, corpo: string | Uint8Array) => {
        enviados.push({ caminho, corpo: String(corpo) });
        return { ok, status: ok ? 200 : 403, detalhe: ok ? undefined : "PERMISSION_DENIED" };
      },
    } as unknown as ClienteOtlpGoogle;
    return { cliente, enviados };
  }

  it("lote válido: reenviado para v1/traces com resource reescrito; spans contados por superfície", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const { cliente, enviados } = clienteFalso();
    const proxy = new ProxyOtlpService(metricas, cliente);
    await expect(proxy.receber(OtlpTracesSchema.parse(lote(2)), "e1:u-aceito")).resolves.toBe("aceito");
    expect(enviados[0]?.caminho).toBe("v1/traces");
    expect(enviados[0]?.corpo).toContain('"service.name"');
    expect(enviados[0]?.corpo).not.toContain("token=abc");
    expect((await pontos("unooria.observabilidade.spans_recebidos"))[0]).toMatchObject({ value: 2, attributes: { superficie: "exp" } });
    await encerrar();
  });

  it("sem cliente (dev sem projeto): conta e descarta, sem lançar", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const proxy = new ProxyOtlpService(metricas, undefined);
    await expect(proxy.receber(OtlpTracesSchema.parse(lote(1)), "e1:u-sem-projeto")).resolves.toBe("descartado");
    expect((await pontos("unooria.observabilidade.spans_descartados"))[0]?.attributes).toEqual({ motivo: "sem-projeto" });
    await encerrar();
  });

  it("upstream recusa: descartado e contado como upstream, sem lançar", async () => {
    const { metricas, pontos, encerrar } = metricasEmMemoria();
    const proxy = new ProxyOtlpService(metricas, clienteFalso(false).cliente);
    await expect(proxy.receber(OtlpTracesSchema.parse(lote(1)), "e1:u-upstream")).resolves.toBe("descartado");
    expect((await pontos("unooria.observabilidade.spans_descartados"))[0]?.attributes).toEqual({ motivo: "upstream" });
    await encerrar();
  });

  it("cota por (escola, usuário): o 31º lote no minuto é recusado", async () => {
    const { metricas, encerrar } = metricasEmMemoria();
    const proxy = new ProxyOtlpService(metricas, clienteFalso().cliente);
    const l = OtlpTracesSchema.parse(lote(1));
    for (let i = 0; i < ProxyOtlpService.LOTES_POR_MINUTO; i++) expect(await proxy.receber(l, "e1:u-cota")).toBe("aceito");
    expect(await proxy.receber(l, "e1:u-cota")).toBe("cota");
    expect(await proxy.receber(l, "e1:u-outro")).toBe("aceito");
    await encerrar();
  });
});

describe("ClienteOtlpGoogle", () => {
  it("manda Bearer da ADC, x-goog-user-project e o corpo para o caminho certo", async () => {
    const chamadas: Array<{ url: string; init: { headers: Record<string, string>; body: unknown } }> = [];
    const cliente = new ClienteOtlpGoogle("entre-redes", {
      auth: { getAccessToken: async () => "tok-123" },
      fetch: (async (url: string, init: { headers: Record<string, string>; body: unknown }) => {
        chamadas.push({ url, init });
        return new Response(null, { status: 200 });
      }) as never,
      base: "https://telemetria.exemplo",
    });
    await expect(cliente.enviar("v1/metrics", "{}")).resolves.toEqual({ ok: true, status: 200 });
    expect(chamadas[0]?.url).toBe("https://telemetria.exemplo/v1/metrics");
    expect(chamadas[0]?.init.headers).toMatchObject({ authorization: "Bearer tok-123", "x-goog-user-project": "entre-redes", "content-type": "application/json" });
  });

  it("sem token da ADC devolve ok=false sem chamar a rede; erro HTTP traz o detalhe", async () => {
    let chamou = false;
    const semToken = new ClienteOtlpGoogle("p", { auth: { getAccessToken: async () => null as unknown as string }, fetch: (async () => { chamou = true; return new Response(); }) as never });
    await expect(semToken.enviar("v1/traces", "{}")).resolves.toMatchObject({ ok: false, status: 0 });
    expect(chamou).toBe(false);
    const recusa = new ClienteOtlpGoogle("p", { auth: { getAccessToken: async () => "t" }, fetch: (async () => new Response("PERMISSION_DENIED: telemetry.writer", { status: 403 })) as never });
    await expect(recusa.enviar("v1/traces", "{}")).resolves.toMatchObject({ ok: false, status: 403, detalhe: expect.stringContaining("PERMISSION_DENIED") });
  });
});
