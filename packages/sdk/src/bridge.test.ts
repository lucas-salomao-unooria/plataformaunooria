import { describe, expect, test, vi } from "vitest";
import { READY_RETRY_MS, connectToHub, normalizarHubOrigin } from "./bridge";
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
  estudante: { id: "a1", nome: "Estudante", serie: "8EF", turmaId: "t1", escolaId: "e1" },
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
    expect(init.estudante.escolaId).toBe("e1");
    expect(init.token).toBe("token-inicial");
    spy.mockRestore();
  });

  test("reenvia exp:ready até o hub responder e ignora hub:init repetido", async () => {
    const spy = vi.spyOn(window.parent, "postMessage");
    const promessa = connectToHub({ hubOrigin: HUB_ORIGIN, timeoutMs: 3000 });
    await new Promise((r) => setTimeout(r, READY_RETRY_MS * 2 + 100));
    const readies = spy.mock.calls.filter((c) => (c[0] as { type?: string })?.type === "exp:ready");
    expect(readies.length).toBeGreaterThanOrEqual(2);
    mensagemDoHub(INIT_VALIDO);
    const { onMessage } = await promessa;
    const antes = readies.length;
    await new Promise((r) => setTimeout(r, READY_RETRY_MS * 2));
    const depois = spy.mock.calls.filter((c) => (c[0] as { type?: string })?.type === "exp:ready").length;
    expect(depois).toBe(antes); // parou de anunciar depois do init
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recebidas: HubParaExp[] = [];
    onMessage((m) => recebidas.push(m));
    mensagemDoHub(INIT_VALIDO); // resposta atrasada a um reenvio
    expect(aviso).not.toHaveBeenCalled();
    expect(recebidas).toHaveLength(0);
    aviso.mockRestore();
    spy.mockRestore();
  });

  test("ignora hub:init vindo de origin errada (e expira por timeout)", async () => {
    const promessa = connectToHub({ hubOrigin: HUB_ORIGIN, timeoutMs: 120 });
    mensagemDoHub(INIT_VALIDO, "http://malicioso.teste");
    await expect(promessa).rejects.toThrow(/Timeout/);
  });

  test("rejeita protocolVersion incompatível com erro visível", async () => {
    const promessa = connectToHub({ hubOrigin: HUB_ORIGIN, timeoutMs: 500 });
    /* Derivado da constante, não fixado: o teste tem de continuar afirmando
       "major diferente falha alto" depois do próximo bump. */
    mensagemDoHub({ ...INIT_VALIDO, protocolVersion: PROTOCOL_VERSION + 1 });
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

/**
 * O `?hubOrigin=` vem da URL, e o bundle da experiência é público: sem estas
 * travas, quem embeda a experiência num iframe próprio escolhe a origem em que
 * ela confia — e recebe tudo o que ela envia depois.
 */
describe("normalizarHubOrigin", () => {
  test("reduz à origem canônica, descartando caminho e query", () => {
    expect(normalizarHubOrigin("http://hub.teste/exp/abc?x=1#y")).toBe("http://hub.teste");
    expect(normalizarHubOrigin("https://hub.teste:8443/")).toBe("https://hub.teste:8443");
  });

  test("recusa o que não é origem http(s) utilizável", () => {
    expect(() => normalizarHubOrigin("")).toThrow(/URL absoluta/);
    expect(() => normalizarHubOrigin("//evil.tld")).toThrow(/URL absoluta/);
    expect(() => normalizarHubOrigin("javascript:alert(1)")).toThrow(/esquema/);
    expect(() => normalizarHubOrigin("data:text/html,<b>")).toThrow(/esquema|opaca/);
    expect(() => normalizarHubOrigin("http://user:senha@hub.teste")).toThrow(/credencial/);
  });

  test("recusa origem diferente de quem realmente embedou", () => {
    const original = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, protocol: "http:", ancestorOrigins: ["http://hub.teste"] },
    });
    try {
      expect(normalizarHubOrigin("http://hub.teste")).toBe("http://hub.teste");
      expect(() => normalizarHubOrigin("http://evil.tld")).toThrow(/não é quem embedou/);
    } finally {
      if (original) Object.defineProperty(window, "location", original);
    }
  });
});
