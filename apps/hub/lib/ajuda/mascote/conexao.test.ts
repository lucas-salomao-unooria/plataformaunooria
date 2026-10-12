import { describe, expect, it, vi } from "vitest";

import { conectarAoMascote, enderecoDoMascote, ErroDeConexao, FECHAMENTOS, fechamentoParaTela, lerEvento } from "./conexao";
import { LipSync, VISEMAS, type Analisador } from "./lipsync";

/**
 * O lado do navegador do mascote (ADR-158): o endereço da conexão, o bilhete
 * como PRIMEIRA mensagem (nunca na URL), a frase de cada fechamento e a boca
 * em repouso no silêncio.
 */

class WebSocketFalso {
  readyState = 0;
  enviadas: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  constructor(readonly url: string) {}
  send(dados: string) {
    this.enviadas.push(JSON.parse(dados));
  }
  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  abrir() {
    this.readyState = 1;
    this.onopen?.();
  }
  receber(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

describe("a conexão de voz do mascote", () => {
  it("o endereço sai da URL da api, com ws/wss", () => {
    expect(enderecoDoMascote("http://localhost:3001")).toBe("ws://localhost:3001/ajuda/mascote/ao-vivo");
    expect(enderecoDoMascote("https://api.rede.gov.br")).toBe("wss://api.rede.gov.br/ajuda/mascote/ao-vivo");
  });

  it("entra com o bilhete na primeira mensagem e resolve no `pronto`", async () => {
    const criados: WebSocketFalso[] = [];
    const eventos: unknown[] = [];
    const conexao = conectarAoMascote({
      endereco: "ws://api/ajuda/mascote/ao-vivo",
      bilhete: "o-bilhete",
      aoEvento: (e) => eventos.push(e),
      aoFechar: vi.fn(),
      criar: (e) => {
        const ws = new WebSocketFalso(e);
        criados.push(ws);
        return ws as unknown as WebSocket;
      },
    });
    const ws = criados[0]!;
    expect(ws.url).not.toContain("o-bilhete");
    ws.abrir();
    expect(ws.enviadas).toEqual([{ tipo: "entrar", bilhete: "o-bilhete" }]);
    ws.receber({ tipo: "pronto", prazo: "2026-10-12T12:10:00.000Z" });
    const { conexao: aoVivo, prazo } = await conexao;
    expect(prazo.toISOString()).toBe("2026-10-12T12:10:00.000Z");

    aoVivo.enviarTexto("Como libero uma missão?");
    expect(ws.enviadas.at(-1)).toEqual({ tipo: "texto", texto: "Como libero uma missão?" });
    ws.receber({ tipo: "transcricao-saida", texto: "Primeiro…" });
    ws.receber({ lixo: true });
    expect(eventos).toEqual([{ tipo: "transcricao-saida", texto: "Primeiro…" }]);
  });

  it("fechada antes do `pronto`, rejeita com o código", async () => {
    const criados: WebSocketFalso[] = [];
    const conexao = conectarAoMascote({
      endereco: "ws://api",
      bilhete: "b",
      aoEvento: vi.fn(),
      aoFechar: vi.fn(),
      criar: (e) => {
        const ws = new WebSocketFalso(e);
        criados.push(ws);
        return ws as unknown as WebSocket;
      },
    });
    criados[0]!.close(FECHAMENTOS.INDISPONIVEL);
    await expect(conexao).rejects.toBeInstanceOf(ErroDeConexao);
  });

  it("cada fechamento vira uma frase de tela; o tempo esgotado é fim, não erro", () => {
    expect(fechamentoParaTela(FECHAMENTOS.TEMPO_ESGOTADO).tipo).toBe("encerrada");
    expect(fechamentoParaTela(FECHAMENTOS.PRODUTO_DESLIGADO)).toMatchObject({ tipo: "erro", podeRepetir: false });
    expect(fechamentoParaTela(1006)).toMatchObject({ tipo: "erro", podeRepetir: true });
  });

  it("mensagem fora do protocolo é ignorada", () => {
    expect(lerEvento(JSON.stringify({ tipo: "audio", base64: "AA", taxa: 24000 }))).toEqual({
      tipo: "audio",
      base64: "AA",
      taxa: 24000,
    });
    expect(lerEvento("não é json")).toBeNull();
    expect(lerEvento(JSON.stringify({ serverContent: {} }))).toBeNull();
  });
});

describe("o lip sync", () => {
  const analisador = (amplitude: number): Analisador => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    context: { sampleRate: 48000 },
    getFloatTimeDomainData: (d) => d.fill(amplitude),
    getFloatFrequencyData: (d) => d.fill(-120),
  });

  it("no silêncio, a boca descansa (sil) e os pesos somam 1", () => {
    const lipsync = new LipSync();
    let pesos: Float32Array = lipsync.pesos;
    for (let i = 0; i < 30; i++) pesos = lipsync.quadro(analisador(0), 1 / 60);
    const soma = [...pesos].reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(1, 5);
    expect(pesos[VISEMAS.indexOf("viseme_sil")]).toBeGreaterThan(0.95);
    expect(lipsync.nivel).toBe(0);
  });
});
