import { describe, expect, test, vi } from "vitest";
import { comRepeticao, statusDoErro, tipoDaFalha } from "./api";

/** O erro exatamente como o SDK o joga: método, caminho e status — sem o corpo. */
const erroDaApi = (status: number) => new Error(`API POST /a-selecao/decisao → ${status}`);

describe("a falha, como a tela a lê", () => {
  test("o status sai da mensagem do SDK", () => {
    expect(statusDoErro(erroDaApi(422))).toBe(422);
    expect(statusDoErro(new TypeError("Failed to fetch"))).toBeNull();
  });

  test("cada status tem UM destino", () => {
    expect(tipoDaFalha(new TypeError("Failed to fetch"))).toBe("rede");
    expect(tipoDaFalha(new DOMException("aborted", "AbortError"))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(503))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(429))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(401))).toBe("sessao");
    expect(tipoDaFalha(erroDaApi(403))).toBe("bloqueada");
    expect(tipoDaFalha(erroDaApi(409))).toBe("conflito");
    expect(tipoDaFalha(erroDaApi(422))).toBe("recusada");
    expect(tipoDaFalha(erroDaApi(400))).toBe("invalida");
    expect(tipoDaFalha(erroDaApi(404))).toBe("invalida");
  });
});

describe("comRepeticao — a chamada que caiu na rede se repete; a recusada, não", () => {
  const opcoes = () => ({
    aoCair: vi.fn(),
    aoVoltar: vi.fn(),
    esperar: vi.fn(() => Promise.resolve()),
    vivo: () => true,
  });

  test("rede e sessão repetem até passar, com o aviso aceso e depois apagado", async () => {
    const o = opcoes();
    const chamada = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(erroDaApi(401))
      .mockResolvedValueOnce("ok");
    await expect(comRepeticao(chamada, o)).resolves.toBe("ok");
    expect(chamada).toHaveBeenCalledTimes(3);
    expect(o.aoCair.mock.calls).toEqual([["rede"], ["sessao"]]);
    expect(o.aoVoltar).toHaveBeenCalledTimes(1);
    expect(o.esperar.mock.calls).toEqual([[2_000], [4_000]]);
  });

  test("o latch que já estava fechado (409) não se repete: sobe para a tela reler", async () => {
    const o = opcoes();
    const chamada = vi.fn<() => Promise<string>>().mockRejectedValue(erroDaApi(409));
    await expect(comRepeticao(chamada, o)).rejects.toThrow("→ 409");
    expect(chamada).toHaveBeenCalledTimes(1);
    expect(o.aoCair).not.toHaveBeenCalled();
  });

  test("a legenda recusada (422) não se repete — quem reescreve é a criança", async () => {
    const o = opcoes();
    const chamada = vi.fn<() => Promise<string>>().mockRejectedValue(erroDaApi(422));
    await expect(comRepeticao(chamada, o)).rejects.toThrow("→ 422");
    expect(chamada).toHaveBeenCalledTimes(1);
  });

  test("a queda seguida de recusa apaga o aviso antes de subir o erro", async () => {
    const o = opcoes();
    const chamada = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(erroDaApi(409));
    await expect(comRepeticao(chamada, o)).rejects.toThrow("→ 409");
    expect(o.aoVoltar).toHaveBeenCalledTimes(1);
  });

  test("tela desmontada para de repetir", async () => {
    const o = { ...opcoes(), vivo: () => false };
    const chamada = vi.fn<() => Promise<string>>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(comRepeticao(chamada, o)).rejects.toThrow("Failed to fetch");
    expect(chamada).toHaveBeenCalledTimes(1);
  });
});
