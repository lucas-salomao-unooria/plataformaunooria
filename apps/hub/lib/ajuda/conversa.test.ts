import { describe, expect, it } from "vitest";

import { CONVERSA_VAZIA, reduzirConversa, relogio, SEM_RESPOSTA, type EventoDaConversa } from "./conversa";

/**
 * A conversa da Ajuda montada dos eventos do avatar, na ORDEM medida no spike
 * (sandbox, 2026-10-02): pedaços → texto inteiro → fim da fala. E o eco da
 * pergunta escrita, que o vendor devolve como transcrição da pessoa.
 */

const aplicar = (eventos: EventoDaConversa[]) => eventos.reduce(reduzirConversa, CONVERSA_VAZIA);

describe("a conversa da Ajuda", () => {
  it("o cumprimento do atendente chega em pedaços e fecha no fim da fala", () => {
    const c = aplicar([
      { tipo: "resposta-pedaco", texto: "Olá! " },
      { tipo: "resposta-pedaco", texto: "Como posso ajudar?" },
      { tipo: "resposta-inteira", texto: "Olá! Como posso ajudar? " },
      { tipo: "resposta-fim" },
    ]);
    expect(c.mensagens).toHaveLength(1);
    expect(c.mensagens[0]).toMatchObject({ autor: "atendente", texto: "Olá! Como posso ajudar?", estado: "pronta" });
    expect(c.respostaAtual).toBeNull();
  });

  it("a pergunta ESCRITA não aparece duas vezes quando o vendor a ecoa", () => {
    const c = aplicar([
      { tipo: "pergunta-escrita", id: "evt-1", texto: "Como libero uma missão?" },
      { tipo: "pergunta-falada", texto: "Como libero uma missão?", origem: "evt-1" },
    ]);
    expect(c.mensagens.filter((m) => m.autor === "pessoa")).toHaveLength(1);
    expect(c.aguardando).toBe(true);
  });

  it("a pergunta FALADA entra como da pessoa", () => {
    const c = aplicar([{ tipo: "pergunta-falada", texto: "onde vejo minhas turmas", origem: null }]);
    expect(c.mensagens[0]).toMatchObject({ autor: "pessoa", texto: "onde vejo minhas turmas" });
  });

  it("o primeiro pedaço da resposta desliga o relógio do 'não respondeu'", () => {
    const c = aplicar([
      { tipo: "pergunta-escrita", id: "evt-1", texto: "oi" },
      { tipo: "resposta-pedaco", texto: "Oi!" },
      { tipo: "sem-resposta" },
    ]);
    expect(c.aguardando).toBe(false);
    expect(c.mensagens.some((m) => m.texto === SEM_RESPOSTA)).toBe(false);
  });

  it("sem resposta, a tela avisa — o vendor fica mudo quando o LLM falha", () => {
    const c = aplicar([{ tipo: "pergunta-escrita", id: "evt-1", texto: "oi" }, { tipo: "sem-resposta" }]);
    expect(c.mensagens.at(-1)).toMatchObject({ autor: "atendente", estado: "erro", texto: SEM_RESPOSTA });
  });

  it("uma pergunta nova fecha a resposta que estava chegando", () => {
    const c = aplicar([
      { tipo: "resposta-pedaco", texto: "Primeiro, abra" },
      { tipo: "pergunta-escrita", id: "evt-2", texto: "espera" },
    ]);
    expect(c.mensagens[0]!.estado).toBe("pronta");
    expect(c.respostaAtual).toBeNull();
  });

  it("ignora pergunta vazia", () => {
    expect(aplicar([{ tipo: "pergunta-escrita", id: "x", texto: "   " }]).mensagens).toHaveLength(0);
  });
});

describe("o relógio da sessão", () => {
  it("é m:ss e nunca negativo", () => {
    expect(relogio(600)).toBe("10:00");
    expect(relogio(65)).toBe("1:05");
    expect(relogio(-3)).toBe("0:00");
  });
});
