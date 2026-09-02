import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKOFF_INICIAL_MS, MAX_BATCH, MAX_BUFFER, TelemetryClient } from "./telemetry";
import { TRACEPARENT } from "./trace";

/**
 * A fila de telemetria não pode nem crescer sem teto nem martelar a api caída:
 * 500 eventos no máximo, backoff exponencial zerado no sucesso, uma tentativa
 * em voo, beacon recusado devolve ao buffer, e todo lote leva traceparent.
 */
const ESTUDANTE = { id: "e1", nome: "x", serie: "6EF", turmaId: "t", escolaId: "esc" };

function cliente(fetchMock: typeof fetch, extra: Partial<ConstructorParameters<typeof TelemetryClient>[0]> = {}) {
  return new TelemetryClient({
    apiUrl: "https://api", getToken: () => "tok", estudante: ESTUDANTE, expId: "exp-01", expVersion: "1.0.0", sessaoId: "s", fetch: fetchMock, ...extra,
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("TelemetryClient", () => {
  it("manda o lote com Bearer e traceparent; sucesso zera o backoff", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const c = cliente(f as unknown as typeof fetch);
    c.track({ verbo: "attempted", objeto: "x" });
    await c.flush();
    expect(f).toHaveBeenCalledTimes(1);
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>).traceparent).toMatch(TRACEPARENT);
    expect(c.pendentes).toBe(0);
    expect(c.backoffAtualMs).toBe(0);
    c.destroy();
  });

  it("com o OTel Web ligado não gera o próprio traceparent", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const c = cliente(f as unknown as typeof fetch, { traceparentPeloOtel: () => true });
    c.track({ verbo: "attempted", objeto: "x" });
    await c.flush();
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers).not.toHaveProperty("traceparent");
    c.destroy();
  });

  it("falha devolve ao buffer e recua exponencialmente; sucesso depois zera", async () => {
    let agora = 1_000_000;
    let ok = false;
    const f = vi.fn(async () => (ok ? new Response("{}", { status: 200 }) : new Response(null, { status: 503 })));
    const c = cliente(f as unknown as typeof fetch, { agora: () => agora });
    c.track({ verbo: "attempted", objeto: "x" });
    await c.flush();
    expect(c.pendentes).toBe(1);
    expect(c.backoffAtualMs).toBe(BACKOFF_INICIAL_MS);
    // dentro da janela de recuo: não tenta
    await c.flush();
    expect(f).toHaveBeenCalledTimes(1);
    agora += BACKOFF_INICIAL_MS;
    await c.flush();
    expect(f).toHaveBeenCalledTimes(2);
    expect(c.backoffAtualMs).toBe(BACKOFF_INICIAL_MS * 2);
    agora += BACKOFF_INICIAL_MS * 2;
    ok = true;
    await c.flush();
    expect(c.pendentes).toBe(0);
    expect(c.backoffAtualMs).toBe(0);
    c.destroy();
  });

  it("erro de rede também recua, e o teto do buffer derruba o mais antigo", async () => {
    const f = vi.fn(async () => { throw new TypeError("fetch failed"); });
    const c = cliente(f as unknown as typeof fetch, { agora: () => 0 });
    for (let i = 0; i < MAX_BUFFER + 25; i++) c.track({ verbo: "interacted", objeto: `o${i}` });
    // o track em múltiplos de MAX_BATCH dispara flush (que falha e devolve); o teto vale sempre
    await vi.runOnlyPendingTimersAsync();
    expect(c.pendentes).toBeLessThanOrEqual(MAX_BUFFER);
    expect(c.descartadosNoCliente).toBeGreaterThan(0);
    expect(c.backoffAtualMs).toBeGreaterThanOrEqual(BACKOFF_INICIAL_MS);
    c.destroy();
  });

  it("flush respeita MAX_BATCH e não roda duas tentativas em voo", async () => {
    let resolver: (r: Response) => void = () => undefined;
    const f = vi.fn(() => new Promise<Response>((r) => { resolver = r; }));
    const c = cliente(f as unknown as typeof fetch);
    for (let i = 0; i < MAX_BATCH - 1; i++) c.track({ verbo: "interacted", objeto: `o${i}` });
    const p1 = c.flush();
    const p2 = c.flush();
    expect(f).toHaveBeenCalledTimes(1);
    resolver(new Response("{}", { status: 200 }));
    await Promise.all([p1, p2]);
    c.destroy();
  });

  it("beacon: envia até MAX_BATCH; `false` do navegador mantém o lote no buffer", () => {
    const f = vi.fn();
    const c = cliente(f as unknown as typeof fetch);
    c.track({ verbo: "attempted", objeto: "x" });
    const sendBeacon = vi.fn(() => false);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon });
    c.flushBeacon();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(c.pendentes).toBe(1);
    sendBeacon.mockReturnValue(true);
    c.flushBeacon();
    expect(c.pendentes).toBe(0);
    vi.unstubAllGlobals();
    c.destroy();
  });
});
