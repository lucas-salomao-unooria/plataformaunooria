import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O `apiDoServidor` continua devolvendo `null` em falha (as páginas dependem
 * disso), mas deixa de ser mudo: cada falha vira UMA linha `warn` com rota,
 * status e o `requestId` que a api devolveu — e toda chamada tem teto e leva o
 * `traceparent` da requisição de origem.
 */
// `vi.mock` é içado acima das declarações: o que a fábrica usa vem de `vi.hoisted`.
const { warn, logFalso } = vi.hoisted(() => {
  const warn = vi.fn();
  const logFalso: { warn: typeof warn; child: () => typeof logFalso } = { warn, child: () => logFalso };
  return { warn, logFalso };
});
vi.mock("./log", () => ({
  log: logFalso,
  logDaRequisicao: () => logFalso,
  cabecalhosComoObjeto: (c: Headers | Record<string, string>) => {
    if (!(c instanceof Headers)) return c;
    const plano: Record<string, string> = {};
    c.forEach((v, k) => { plano[k] = v; });
    return plano;
  },
}));
vi.mock("./auth", () => ({
  auth: async () => ({ usuario: { id: "u1", escolaId: "e1", turmaId: "t1", papel: "professor" } }),
}));
vi.mock("./chave-token", () => ({ assinarTokenExperiencia: async () => "token-assinado" }));

const TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ traceparent: TRACEPARENT }) }));

const fetchMock = vi.fn();

beforeEach(() => {
  warn.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function carregar() {
  return import("./api-servidor");
}

describe("apiDoServidor", () => {
  it("200: devolve o JSON, com Bearer, traceparent repassado e um AbortSignal", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const { apiDoServidor } = await carregar();
    await expect(apiDoServidor("/turmas")).resolves.toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/turmas$/);
    expect(init.headers).toMatchObject({ authorization: "Bearer token-assinado", traceparent: TRACEPARENT });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(warn).not.toHaveBeenCalled();
  });

  it("500 com requestId: devolve null e loga UMA vez com o requestId da api", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ codigo: "erro-interno", requestId: "r-api" }), { status: 500 }));
    const { apiDoServidor } = await carregar();
    await expect(apiDoServidor("/turmas")).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ rota: "/turmas", status: 500, requestIdDaApi: "r-api", codigo: "api-recusou" });
  });

  it("api fora do ar: devolve null e loga api-indisponivel", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { apiDoServidor } = await carregar();
    await expect(apiDoServidor("/turmas")).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ rota: "/turmas", status: 599, codigo: "api-indisponivel" });
  });

  it("timeout: devolve null e loga api-timeout", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeout);
    const { apiDoServidor } = await carregar();
    await expect(apiDoServidor("/turmas")).resolves.toBeNull();
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ status: 598, codigo: "api-timeout" });
  });

  it("apiDoServidorBruto devolve o status em vez de engolir", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensagem: "assinatura inválida" }), { status: 422 }));
    const { apiDoServidorBruto } = await carregar();
    await expect(apiDoServidorBruto("/perfis-recebidos")).resolves.toEqual({ ok: false, status: 422, dados: { mensagem: "assinatura inválida" } });
    expect(warn).not.toHaveBeenCalled();
  });

  it("apiDoServidorBruto com a api fora: status 599 e dados null", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { apiDoServidorBruto } = await carregar();
    await expect(apiDoServidorBruto("/perfis-recebidos")).resolves.toEqual({ ok: false, status: 599, dados: null });
  });
});
