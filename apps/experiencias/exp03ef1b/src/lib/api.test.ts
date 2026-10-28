import { describe, expect, test, vi } from "vitest";
import type { ExperienciaHandle } from "@edu/sdk";
import { comRepeticao, definirExperiencia, nina, statusDoErro, tipoDaFalha } from "./api";

const erroDaApi = (status: number) => new Error(`API POST /nina-noticia/previsao → ${status}`);

function comSdk() {
  const get = vi.fn((_: string) => Promise.resolve({}));
  const post = vi.fn((_: string, __?: unknown) => Promise.resolve({}));
  definirExperiencia({ api: { get, post } } as unknown as ExperienciaHandle);
  return { get, post };
}

/**
 * O cliente HTTP contra o CONTRATO (`apps/api/src/nina-noticia/contrato-de-rotas.ts`,
 * índice `ROTAS`): método, caminho e o corpo como o Zod de lá o aceita.
 */
describe("o cliente da missão fala o contrato", () => {
  test("leituras: sessão e portão", async () => {
    const { get } = comSdk();
    await nina.sessao();
    await nina.gate();
    expect(get.mock.calls.map((c) => c[0])).toEqual(["/nina-noticia/sessao", "/nina-noticia/gate"]);
  });

  test("jogadas: caminho e corpo de cada uma", async () => {
    const { post } = comSdk();
    await nina.selos(["rp-a1b"]);
    await nina.previsao(["rp-a1b", "rp-c2d"]);
    await nina.filtro({ campo: "onde", valor: "patio" });
    await nina.ficha(true);
    await nina.carimbos({ etapa: "e4", carimbos: { k1: "v", k2: "x", k3: "duvida" } });
    await nina.reparo({ quem: "et-aaa", onde: "et-bbb", quando: "et-ccc" });
    await nina.passo("ponte");
    await nina.rotina(["bl-1aa"]);
    await nina.concluir();
    expect(post.mock.calls).toEqual([
      ["/nina-noticia/selos", { reportagens: ["rp-a1b"] }],
      ["/nina-noticia/previsao", { itens: ["rp-a1b", "rp-c2d"] }],
      ["/nina-noticia/filtro", { campo: "onde", valor: "patio" }],
      ["/nina-noticia/ficha", { dica: true }],
      ["/nina-noticia/carimbos", { etapa: "e4", carimbos: { k1: "v", k2: "x", k3: "duvida" } }],
      ["/nina-noticia/reparo", { ficha: { quem: "et-aaa", onde: "et-bbb", quando: "et-ccc" } }],
      ["/nina-noticia/passo", { para: "ponte" }],
      ["/nina-noticia/rotina", { sequencia: ["bl-1aa"] }],
      ["/nina-noticia/concluir", {}],
    ]);
  });
});

describe("a falha, como a tela a lê", () => {
  test("cada status tem UM destino", () => {
    expect(statusDoErro(erroDaApi(409))).toBe(409);
    expect(tipoDaFalha(new TypeError("Failed to fetch"))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(503))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(429))).toBe("rede");
    expect(tipoDaFalha(erroDaApi(401))).toBe("sessao");
    expect(tipoDaFalha(erroDaApi(403))).toBe("bloqueada");
    expect(tipoDaFalha(erroDaApi(409))).toBe("conflito");
    expect(tipoDaFalha(erroDaApi(400))).toBe("invalida");
  });

  test("rede repete com o aviso aceso; o latch recusado (409) sobe sem repetir", async () => {
    const o = { aoCair: vi.fn(), aoVoltar: vi.fn(), esperar: vi.fn(() => Promise.resolve()), vivo: () => true };
    const cai = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce("ok");
    await expect(comRepeticao(cai, o)).resolves.toBe("ok");
    expect(o.aoCair).toHaveBeenCalledWith("rede");
    const recusa = vi.fn<() => Promise<string>>().mockRejectedValue(erroDaApi(409));
    await expect(comRepeticao(recusa, o)).rejects.toThrow("→ 409");
    expect(recusa).toHaveBeenCalledTimes(1);
  });
});
