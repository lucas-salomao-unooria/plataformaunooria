import { describe, expect, test, vi } from "vitest";
import type { ExperienciaHandle } from "@edu/sdk";
import { comRepeticao, definirExperiencia, postSemResposta, statusDoErro, tipoDaFalha } from "./api";

/** O erro exatamente como o SDK o joga: método, caminho e status — sem o corpo. */
const erroDaApi = (status: number) => new Error(`API POST /juri-estadual/voto → ${status}`);

describe("a falha, como a tela a lê", () => {
  test("o status sai da mensagem do SDK", () => {
    expect(statusDoErro(erroDaApi(409))).toBe(409);
    expect(statusDoErro(new TypeError("Failed to fetch"))).toBeNull();
  });

  test("cada status tem UM destino", () => {
    expect(tipoDaFalha(new TypeError("Failed to fetch"))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(503))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(429))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(401))).toBe("sessao");
    expect(tipoDaFalha(erroDaApi(403))).toBe("bloqueada");
    expect(tipoDaFalha(erroDaApi(409))).toBe("conflito");
    expect(tipoDaFalha(erroDaApi(400))).toBe("invalida");
    expect(tipoDaFalha(erroDaApi(404))).toBe("invalida");
  });
});

describe("comRepeticao — a chamada que caiu na rede se repete; a recusada, não", () => {
  const opcoes = () => ({ aoCair: vi.fn(), aoVoltar: vi.fn(), esperar: vi.fn(() => Promise.resolve()), vivo: () => true });

  test("rede e sessão repetem até passar, com o aviso aceso e depois apagado", async () => {
    const o = opcoes();
    const chamada = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(erroDaApi(401))
      .mockResolvedValueOnce("ok");
    await expect(comRepeticao(chamada, o)).resolves.toBe("ok");
    expect(o.aoCair.mock.calls).toEqual([["rede"], ["sessao"]]);
    expect(o.aoVoltar).toHaveBeenCalledTimes(1);
  });

  test("o voto que já estava lacrado (409) não se repete: sobe para a tela reler", async () => {
    const o = opcoes();
    const chamada = vi.fn<() => Promise<string>>().mockRejectedValue(erroDaApi(409));
    await expect(comRepeticao(chamada, o)).rejects.toThrow("→ 409");
    expect(chamada).toHaveBeenCalledTimes(1);
  });

  test("tela desmontada para de repetir", async () => {
    const o = { ...opcoes(), vivo: () => false };
    const chamada = vi.fn<() => Promise<string>>().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(comRepeticao(chamada, o)).rejects.toThrow("Failed to fetch");
    expect(chamada).toHaveBeenCalledTimes(1);
  });
});

describe("postSemResposta — o 204 de `galeria/acoes`", () => {
  function comPost(post: () => Promise<unknown>) {
    definirExperiencia({ api: { post } } as unknown as ExperienciaHandle);
  }

  test("o corpo vazio (o `res.json()` do SDK lança SyntaxError) é sucesso, não queda de rede", async () => {
    comPost(() => Promise.reject(new SyntaxError("Unexpected end of JSON input")));
    await expect(postSemResposta("/juri-estadual/galeria/acoes", {})).resolves.toBeUndefined();
  });

  test("a falha de verdade continua subindo", async () => {
    comPost(() => Promise.reject(erroDaApi(403)));
    await expect(postSemResposta("/juri-estadual/galeria/acoes", {})).rejects.toThrow("→ 403");
  });
});
