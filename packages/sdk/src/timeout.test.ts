import { describe, expect, test, vi } from "vitest";
import { createExperiencia } from "./index";
import { PROTOCOL_VERSION } from "./types";

/**
 * Contrato do `timeoutMs` por chamada.
 *
 * O teto fixo de 10 s era certo para ler catálogo e ERRADO para rota que espera
 * um modelo de linguagem: um turno de conversa com ferramentas leva de dez a
 * trinta segundos, e o AbortController cortava a resposta que já estava sendo
 * gerada — o aluno lia "não consegui responder" enquanto a api tinha
 * respondido. Subir o default para todos seria pior: uma api travada
 * penduraria toda experiência por meio minuto.
 */
const HUB_ORIGIN = "http://hub.teste";

const INIT = {
  type: "hub:init",
  protocolVersion: PROTOCOL_VERSION,
  token: "token-inicial",
  aluno: { id: "a1", nome: "Aluno", serie: "2EM", turmaId: "t1", escolaId: "e1" },
  apiUrl: "http://api.teste",
  config: {},
};

/** Sobe a experiência entregando o hub:init assim que o exp:ready sair. */
async function experiencia() {
  const promessa = createExperiencia({ expId: "exp-03-unoogpt", expVersion: "1.0.0", hubOrigin: HUB_ORIGIN });
  window.dispatchEvent(new MessageEvent("message", { data: INIT, origin: HUB_ORIGIN }));
  return promessa;
}

describe("timeout por chamada", () => {
  /**
   * Dubla `fetch` deixando a chamada PENDENTE: o timer só aborta o que ainda
   * está no ar. (Aguardar a resposta antes de checar não testa nada — `call()`
   * limpa o timer no `finally`.) Usa POST porque GET reenvia uma vez e o retry
   * criaria um segundo sinal no meio da medição.
   */
  function fetchPendente() {
    const sinais: AbortSignal[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((_u, init) => {
      const sinal = (init as RequestInit).signal as AbortSignal;
      sinais.push(sinal);
      return new Promise((_resolve, reject) => {
        sinal.addEventListener("abort", () => reject(new Error("abortado")));
      });
    });
    return { sinais, spy };
  }

  /** O sinal da chamada em curso. Falha alto se `fetch` nem foi chamado —
   *  sem isto um erro de setup passaria como "não abortou". */
  function sinalEmCurso(sinais: AbortSignal[]): AbortSignal {
    const sinal = sinais[0];
    if (!sinal) throw new Error("fetch não foi chamado");
    return sinal;
  }

  test("o default segue 10s quando ninguém pede outro", async () => {
    const exp = await experiencia();
    const { sinais, spy } = fetchPendente();
    vi.useFakeTimers();

    const pendente = exp.api.post("/unoogpt/sessao").catch(() => "abortou");
    vi.advanceTimersByTime(9_999);
    expect(sinalEmCurso(sinais).aborted).toBe(false);
    vi.advanceTimersByTime(2);
    expect(sinalEmCurso(sinais).aborted).toBe(true);

    vi.useRealTimers();
    await expect(pendente).resolves.toBe("abortou");
    spy.mockRestore();
  });

  test("timeoutMs explícito sobrevive ao instante em que o default teria cortado", async () => {
    const exp = await experiencia();
    const { sinais, spy } = fetchPendente();
    vi.useFakeTimers();

    const pendente = exp.api
      .post("/unoogpt/pergunta", { texto: "onde chove mais?" }, { timeoutMs: 45_000 })
      .catch(() => "abortou");

    vi.advanceTimersByTime(10_001);
    expect(sinalEmCurso(sinais).aborted).toBe(false); // o turno da IA NÃO é cortado aos 10s

    vi.advanceTimersByTime(35_000);
    expect(sinalEmCurso(sinais).aborted).toBe(true); // mas tem teto: não fica pendurado para sempre

    vi.useRealTimers();
    await expect(pendente).resolves.toBe("abortou");
    spy.mockRestore();
  });

  test("o corpo e o método continuam chegando com as opções presentes", async () => {
    const exp = await experiencia();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await exp.api.put("/unoogpt/conjuntos", { conjuntos: ["chuva"] }, { timeoutMs: 20_000 });

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.teste/unoogpt/conjuntos");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ conjuntos: ["chuva"] }));
    spy.mockRestore();
  });
});
