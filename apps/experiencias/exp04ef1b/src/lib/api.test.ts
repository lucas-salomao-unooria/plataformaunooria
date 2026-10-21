import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { comRepeticao, statusDoErro, tipoDaFalha } from "./api";

/** O erro exatamente como o SDK o joga: método, caminho e status — sem o corpo. */
const erroDaApi = (status: number) => new Error(`API POST /jornal-escola/publicar → ${status}`);

describe("a falha, como a tela a lê", () => {
  test("o status sai da mensagem do SDK", () => {
    expect(statusDoErro(erroDaApi(409))).toBe(409);
    expect(statusDoErro(new TypeError("Failed to fetch"))).toBeNull();
  });

  test("cada status tem UM destino", () => {
    expect(tipoDaFalha(new TypeError("Failed to fetch"))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(503))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(429))).toBe("limite");
    expect(tipoDaFalha(erroDaApi(401))).toBe("sessao");
    expect(tipoDaFalha(erroDaApi(403))).toBe("bloqueada");
    expect(tipoDaFalha(erroDaApi(409))).toBe("conflito");
    expect(tipoDaFalha(erroDaApi(400))).toBe("invalida");
    expect(tipoDaFalha(erroDaApi(404))).toBe("invalida");
  });
});

describe("comRepeticao — a chamada que caiu na rede se repete; o latch fechado, não", () => {
  const opcoes = () => ({
    aoCair: vi.fn(),
    aoVoltar: vi.fn(),
    esperar: vi.fn(() => Promise.resolve()),
    vivo: () => true,
  });

  test("rede, limite (429) e sessão repetem até passar, com o aviso aceso e depois apagado", async () => {
    const o = opcoes();
    const chamada = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(erroDaApi(429))
      .mockRejectedValueOnce(erroDaApi(401))
      .mockResolvedValueOnce("ok");
    await expect(comRepeticao(chamada, o)).resolves.toBe("ok");
    expect(chamada).toHaveBeenCalledTimes(4);
    expect(o.aoCair.mock.calls).toEqual([["rede"], ["limite"], ["sessao"]]);
    expect(o.aoVoltar).toHaveBeenCalledTimes(1);
  });

  test("o latch que já estava fechado (409 `edicao-ja-publicada`) sobe para a tela reler", async () => {
    const o = opcoes();
    const chamada = vi.fn<() => Promise<string>>().mockRejectedValue(erroDaApi(409));
    await expect(comRepeticao(chamada, o)).rejects.toThrow("→ 409");
    expect(chamada).toHaveBeenCalledTimes(1);
    expect(o.aoCair).not.toHaveBeenCalled();
  });

  test("tela desmontada para de repetir", async () => {
    const o = { ...opcoes(), vivo: () => false };
    const chamada = vi.fn<() => Promise<string>>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(comRepeticao(chamada, o)).rejects.toThrow("Failed to fetch");
    expect(chamada).toHaveBeenCalledTimes(1);
  });
});

describe("as rotas da 3.0.0", () => {
  const fonte = readFileSync("src/lib/api.ts", "utf8");

  test("nenhuma rota de /evidencias: P1/P2 saíram (Canal A puro, ADR-168)", () => {
    // O CAMINHO, entre aspas: o comentário que conta por que a rota saiu pode citá-la.
    expect(fonte).not.toMatch(/["'`]\/evidencias/);
    expect(fonte).not.toMatch(/["'`/]perguntas/);
  });

  test("as rotas novas do contrato estão lá", () => {
    for (const rota of [
      "/jornal-escola/julgamento",
      "/jornal-escola/chave",
      "/jornal-escola/simulacao",
      "/jornal-escola/transferencia",
    ]) {
      expect(fonte).toContain(`"${rota}"`);
    }
  });
});
