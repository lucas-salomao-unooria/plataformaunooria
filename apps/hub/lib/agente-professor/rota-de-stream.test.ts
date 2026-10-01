import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A rota de stream do agente de IA do professor
 * (`app/api/plataforma/agente-professor/conversas/[id]/mensagens/route.ts`) e o
 * BFF genérico (`app/api/plataforma/[...path]/route.ts`) — os dois sobre o
 * MESMO `lib/bff.ts`. O que se prova:
 *
 *   - o corpo SSE passa como stream, com os cabeçalhos que impedem buffer e
 *     compressão; a recusa JSON (429) passa com status e corpo;
 *   - o `request.signal` chega ao `fetch` da api (o "Parar" e a aba fechada
 *     cancelam a cadeia), e o teto do turno é o de 250 s, não o de 180 s;
 *   - o BFF deixa passar `agente-professor` e continua recusando o resto.
 */
const { warn, info, logFalso, sessao } = vi.hoisted(() => {
  const warn = vi.fn();
  const info = vi.fn();
  const logFalso: { warn: typeof warn; info: typeof info; child: () => typeof logFalso } = {
    warn,
    info,
    child: () => logFalso,
  };
  const sessao: { atual: unknown } = {
    atual: { usuario: { id: "u1", escolaId: "e1", turmaId: undefined, papel: "professor" } },
  };
  return { warn, info, logFalso, sessao };
});
vi.mock("@/lib/log", () => ({
  log: logFalso,
  logDaRequisicao: () => logFalso,
  cabecalhosComoObjeto: (c: Headers) => {
    const plano: Record<string, string> = {};
    c.forEach((v, k) => {
      plano[k] = v;
    });
    return plano;
  },
}));
vi.mock("@/lib/auth", () => ({ auth: async () => sessao.atual }));
vi.mock("@/lib/chave-token", () => ({ assinarTokenExperiencia: async () => "token-curto" }));

const ID = "5b0c1f7e-3a2d-4c8b-9e1f-0a1b2c3d4e5f";
const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const fetchMock = vi.fn();

beforeEach(() => {
  warn.mockReset();
  info.mockReset();
  fetchMock.mockReset();
  sessao.atual = { usuario: { id: "u1", escolaId: "e1", turmaId: undefined, papel: "professor" } };
  vi.stubGlobal("fetch", fetchMock);
  process.env.API_INTERNAL_URL = "http://api.interna:3001";
});
afterEach(() => vi.unstubAllGlobals());

function pedidoDoTurno(id = ID, init: { signal?: AbortSignal } = {}) {
  return new NextRequest(`http://hub.local/api/plataforma/agente-professor/conversas/${id}/mensagens`, {
    method: "POST",
    headers: { "content-type": "application/json", traceparent: TRACEPARENT },
    body: JSON.stringify({ texto: "Quais habilidades?" }),
    signal: init.signal,
  });
}

const rota = () => import("@/app/api/plataforma/agente-professor/conversas/[id]/mensagens/route");
const bff = () => import("@/app/api/plataforma/[...path]/route");

describe("rota de stream do turno", () => {
  it("repassa o corpo SSE COMO STREAM, com os cabeçalhos sem buffer nem compressão", async () => {
    const sse = 'event: delta\ndata: {"texto":"Olá"}\n\nevent: fim\ndata: {}\n\n';
    fetchMock.mockResolvedValue(
      new Response(sse, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8" } }),
    );
    const { POST, CABECALHOS_DO_STREAM } = await rota();
    const resposta = await POST(pedidoDoTurno(), { params: Promise.resolve({ id: ID }) });

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(resposta.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(resposta.headers.get("x-accel-buffering")).toBe("no");
    expect(CABECALHOS_DO_STREAM["cache-control"]).toMatch(/no-transform/);
    expect(resposta.body).toBeInstanceOf(ReadableStream);
    expect(await resposta.text()).toBe(sse);
  });

  it("chama a api certa com o token curto, o traceparent e o corpo como veio", async () => {
    fetchMock.mockResolvedValue(new Response("", { headers: { "content-type": "text/event-stream" } }));
    const { POST } = await rota();
    await POST(pedidoDoTurno(), { params: Promise.resolve({ id: ID }) });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe(`http://api.interna:3001/agente-professor/conversas/${ID}/mensagens`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      authorization: "Bearer token-curto",
      traceparent: TRACEPARENT,
      "content-type": "application/json",
      accept: "text/event-stream",
    });
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(JSON.stringify({ texto: "Quais habilidades?" }));
  });

  it("o `signal` do fetch segue o do navegador: abortar o pedido aborta a chamada à api", async () => {
    fetchMock.mockResolvedValue(new Response("", { headers: { "content-type": "text/event-stream" } }));
    const navegador = new AbortController();
    const { POST } = await rota();
    const pedido = pedidoDoTurno(ID, { signal: navegador.signal });
    await POST(pedido, { params: Promise.resolve({ id: ID }) });

    const sinal = (fetchMock.mock.calls[0] as [URL, RequestInit])[1].signal as AbortSignal;
    expect(sinal.aborted).toBe(false);
    navegador.abort();
    expect(pedido.signal.aborted).toBe(true);
    expect(sinal.aborted).toBe(true);
  });

  it("o teto do turno é 250 s — entre os 240 s da api e os 300 s do Cloud Run", async () => {
    const { TETO_DO_TURNO_MS } = await rota();
    const { TIMEOUT_DO_BFF_MS } = await bff();
    expect(TETO_DO_TURNO_MS).toBe(250_000);
    expect(TETO_DO_TURNO_MS).toBeGreaterThan(240_000);
    expect(TETO_DO_TURNO_MS).toBeLessThan(300_000);
    expect(TETO_DO_TURNO_MS).toBeGreaterThan(TIMEOUT_DO_BFF_MS);
  });

  it("recusa JSON antes do stream (429 QUOTA): status e corpo passam como vieram", async () => {
    const corpo = { codigo: "QUOTA", mensagem: "Você usou toda a cota de IA de hoje. Ela renova amanhã." };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(corpo), { status: 429, headers: { "content-type": "application/json; charset=utf-8" } }),
    );
    const { POST } = await rota();
    const resposta = await POST(pedidoDoTurno(), { params: Promise.resolve({ id: ID }) });

    expect(resposta.status).toBe(429);
    expect(resposta.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(resposta.headers.get("x-accel-buffering")).toBeNull();
    expect(await resposta.json()).toEqual(corpo);
  });

  it("id que não é UUID responde 404 sem chamar a api (o id vira caminho lá)", async () => {
    const { POST } = await rota();
    const resposta = await POST(pedidoDoTurno("..%2F..%2Fusuarios"), {
      params: Promise.resolve({ id: "../../usuarios" }),
    });
    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toMatchObject({ codigo: "conversa-inexistente" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem sessão 401, preso na troca de senha 403 — e a api nem é chamada", async () => {
    const { POST } = await rota();
    sessao.atual = null;
    expect((await POST(pedidoDoTurno(), { params: Promise.resolve({ id: ID }) })).status).toBe(401);
    sessao.atual = { usuario: { id: "u1", escolaId: "e1", papel: "professor", precisaTrocarSenha: true } };
    expect((await POST(pedidoDoTurno(), { params: Promise.resolve({ id: ID }) })).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("api fora do ar vira 502 JSON com a frase para o professor, e loga sem o texto da pergunta", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { POST } = await rota();
    const resposta = await POST(pedidoDoTurno(), { params: Promise.resolve({ id: ID }) });
    expect(resposta.status).toBe(502);
    expect(await resposta.json()).toMatchObject({ codigo: "plataforma-indisponivel" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain("Quais habilidades");
  });

  it("o navegador que desistiu antes da resposta não vira `warn`", async () => {
    const navegador = new AbortController();
    fetchMock.mockImplementation(async () => {
      navegador.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const { POST } = await rota();
    const resposta = await POST(pedidoDoTurno(ID, { signal: navegador.signal }), { params: Promise.resolve({ id: ID }) });
    expect(resposta.status).toBe(499);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("BFF genérico", () => {
  const pedido = (caminho: string, signal?: AbortSignal) =>
    new NextRequest(`http://hub.local/api/plataforma/${caminho}`, { method: "GET", signal });

  it("deixa passar `agente-professor` (listar), com token e o signal do navegador", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    const navegador = new AbortController();
    const { GET } = await bff();
    const resposta = await GET(pedido("agente-professor/conversas", navegador.signal), {
      params: Promise.resolve({ path: ["agente-professor", "conversas"] }),
    });
    expect(resposta.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("http://api.interna:3001/agente-professor/conversas");
    expect(init.headers).toMatchObject({ authorization: "Bearer token-curto" });
    navegador.abort();
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  it("apagar passa pelo BFF e devolve o 204 da api", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { DELETE } = await bff();
    const resposta = await DELETE(
      new NextRequest(`http://hub.local/api/plataforma/agente-professor/conversas/${ID}`, { method: "DELETE" }),
      { params: Promise.resolve({ path: ["agente-professor", "conversas", ID] }) },
    );
    expect(resposta.status).toBe(204);
    expect((fetchMock.mock.calls[0] as [URL, RequestInit])[1].method).toBe("DELETE");
  });

  it("prefixo fora da allowlist continua 404 e logado, sem chamar a api", async () => {
    const { GET } = await bff();
    const resposta = await GET(pedido("bemestar/resumo"), { params: Promise.resolve({ path: ["bemestar", "resumo"] }) });
    expect(resposta.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ prefixo: "bemestar", codigo: "bff-prefixo-recusado" });
  });

  it("sem sessão, o sinal do navegador ainda passa — para o par público da rota", async () => {
    sessao.atual = null;
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    const { POST } = await bff();
    const resposta = await POST(
      new NextRequest("http://hub.local/api/plataforma/observabilidade/vitals", { method: "POST", body: "{}" }),
      { params: Promise.resolve({ path: ["observabilidade", "vitals"] }) },
    );
    expect(resposta.status).toBe(202);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("http://api.interna:3001/observabilidade/publico/vitals");
    expect(init.headers).not.toHaveProperty("authorization");
  });

  it("timeout da api continua 504", async () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    fetchMock.mockRejectedValue(timeout);
    const { GET } = await bff();
    const resposta = await GET(pedido("agente-professor/conversas"), {
      params: Promise.resolve({ path: ["agente-professor", "conversas"] }),
    });
    expect(resposta.status).toBe(504);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ codigo: "api-timeout" });
  });
});
