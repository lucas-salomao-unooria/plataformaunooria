import { describe, expect, it, vi } from "vitest";
import { MAX_ERROS_POR_SESSAO, MAX_STACK_BYTES, descreverErro, hashCurto, instalarCapturaDeErros, type ErroDeCliente } from "./erros";

describe("instalarCapturaDeErros", () => {
  function montar() {
    const enviar = vi.fn<(erro: ErroDeCliente) => Promise<unknown>>(async () => undefined);
    const notificarHub = vi.fn();
    const captura = instalarCapturaDeErros({ expId: "exp-02-unootube", versao: "1.2.3", sessaoId: "s", enviar, notificarHub, traceAtivo: () => ({ traceId: "a".repeat(32), spanId: "b".repeat(16) }) });
    return { enviar, notificarHub, captura };
  }

  it("window.onerror vira um POST com expId, versão, url sem query, sessão e trace", () => {
    const { enviar, notificarHub, captura } = montar();
    window.dispatchEvent(new ErrorEvent("error", { error: new TypeError("boom"), message: "boom" }));
    expect(enviar).toHaveBeenCalledTimes(1);
    const corpo = enviar.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(corpo).toMatchObject({ expId: "exp-02-unootube", versao: "1.2.3", mensagem: "boom", sessaoId: "s", traceId: "a".repeat(32) });
    expect(String(corpo.url)).not.toContain("?");
    expect(notificarHub).toHaveBeenCalledWith(expect.objectContaining({ mensagem: "boom", hash: expect.any(String) }));
    captura.desinstalar();
  });

  it("dedupe por hash: o mesmo erro não é enviado duas vezes, mas o hub é avisado", () => {
    const { enviar, notificarHub, captura } = montar();
    const e = new Error("repetido");
    captura.reportar(e);
    captura.reportar(e);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(notificarHub).toHaveBeenCalledTimes(2);
    captura.desinstalar();
  });

  it("teto por sessão: a partir do 6º erro distinto nada mais sai", () => {
    const { enviar, captura } = montar();
    for (let i = 0; i < MAX_ERROS_POR_SESSAO + 3; i++) captura.reportar(new Error(`e${i}`));
    expect(enviar).toHaveBeenCalledTimes(MAX_ERROS_POR_SESSAO);
    captura.desinstalar();
  });

  it("unhandledrejection e valores não-Error também são reportados; stack cortada", () => {
    const { enviar, captura } = montar();
    const grande = new Error("g");
    grande.stack = "x".repeat(MAX_STACK_BYTES * 2);
    captura.reportar(grande);
    expect(String((enviar.mock.calls[0]?.[0] as unknown as { stack: string }).stack).length).toBe(MAX_STACK_BYTES);
    captura.reportar("string solta");
    expect((enviar.mock.calls[1]?.[0] as unknown as { mensagem: string }).mensagem).toBe("string solta");
    captura.desinstalar();
  });

  it("falha ao enviar é engolida (erro ao reportar erro não vira laço)", async () => {
    const enviar = vi.fn(async () => { throw new Error("api fora"); });
    const captura = instalarCapturaDeErros({ expId: "hub", versao: "dev", sessaoId: "s", enviar });
    expect(() => captura.reportar(new Error("x"))).not.toThrow();
    await Promise.resolve();
    captura.desinstalar();
  });

  it("hashCurto e descreverErro são estáveis", () => {
    expect(hashCurto("abc")).toBe(hashCurto("abc"));
    expect(hashCurto("abc")).not.toBe(hashCurto("abd"));
    expect(descreverErro(undefined).mensagem).toBeTruthy();
    expect(descreverErro({ a: 1 }).mensagem).toBe('{"a":1}');
  });
});
