import { describe, expect, test, vi } from "vitest";
import { connectToHub } from "./bridge";
import { PROTOCOL_VERSION, type HubParaExp } from "./types";

/**
 * Testes de CONTRATO da bridge — o mínimo exigido pelo CLAUDE.md.
 * O "hub" aqui é sintético: MessageEvents despachados na janela com a origin
 * controlada (em jsdom, window.parent === window, então o exp:ready da SDK
 * chega nesta mesma janela).
 */

const HUB_ORIGIN = "http://hub.teste";

function mensagemDoHub(data: unknown, origin: string = HUB_ORIGIN) {
  window.dispatchEvent(new MessageEvent("message", { data, origin }));
}

const INIT_VALIDO = {
  type: "hub:init",
  protocolVersion: PROTOCOL_VERSION,
  token: "token-inicial",
  aluno: { id: "a1", nome: "Aluno", serie: "8EF", turmaId: "t1", escolaId: "e1" },
  apiUrl: "http://localhost:3001",
  config: {},
};

describe("connectToHub", () => {
  test("resolve com hub:init válido da origin certa e envia exp:ready", async () => {
    const spy = vi.spyOn(window.parent, "postMessage");
    const promessa = connectToHub({ hubOrigin: HUB_ORIGIN, timeoutMs: 500 });
    expect(spy).toHaveBeenCalledWith(
      { type: "exp:ready", protocolVersion: PROTOCOL_VERSION },
      HUB_ORIGIN,
    );
    mensagemDoHub(INIT_VALIDO);
    const { init } = await promessa;
    expect(init.aluno.escolaId).toBe("e1");
    expect(init.token).toBe("token-inicial");
    spy.mockRestore();
  });

  test("ignora hub:init vindo de origin errada (e expira por timeout)", async () => {
    const promessa = connectToHub({ hubOrigin: HUB_ORIGIN, timeoutMs: 120 });
    mensagemDoHub(INIT_VALIDO, "http://malicioso.teste");
    await expect(promessa).rejects.toThrow(/Timeout/);
  });

  test("rejeita protocolVersion incompatível com erro visível", async () => {
    const promessa = connectToHub({ hubOrigin: HUB_ORIGIN, timeoutMs: 500 });
    mensagemDoHub({ ...INIT_VALIDO, protocolVersion: 2 });
    await expect(promessa).rejects.toThrow(/Protocolo incompatível/);
  });

  test("hub:init malformado não resolve nem despacha (expira)", async () => {
    const promessa = connectToHub({ hubOrigin: HUB_ORIGIN, timeoutMs: 120 });
    mensagemDoHub({ type: "hub:init", token: 42 });
    await expect(promessa).rejects.toThrow(/Timeout/);
  });

  test("pós-init: mensagem válida é despachada tipada; inválida é descartada", async () => {
    const promessa = connectToHub({ hubOrigin: HUB_ORIGIN, timeoutMs: 500 });
    mensagemDoHub(INIT_VALIDO);
    const { onMessage } = await promessa;

    const recebidas: HubParaExp[] = [];
    onMessage((m) => recebidas.push(m));

    mensagemDoHub({ type: "hub:token", token: "token-novo" });
    mensagemDoHub({ type: "hub:token" }); // sem token → schema derruba
    mensagemDoHub({ type: "hub:pause" });
    mensagemDoHub({ type: "hub:desconhecida" }); // hub futuro → descartada
    mensagemDoHub({ type: "hub:resume" }, "http://malicioso.teste"); // origin errada

    expect(recebidas).toEqual([
      { type: "hub:token", token: "token-novo" },
      { type: "hub:pause" },
    ]);
  });
});
