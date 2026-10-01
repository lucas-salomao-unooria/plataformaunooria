import { describe, expect, it } from "vitest";

import { lerEvento, type EventoDoTurno } from "./contrato";
import {
  CONVERSA_NOVA,
  fonteParaTela,
  reduzirConversa,
  type AcaoDaConversa,
  type EstadoDaConversa,
} from "./conversa";

/**
 * O estado de um turno, de ponta a ponta, sem navegador: é a sequência de
 * ações que o hook dispara na ordem em que o stream as entrega.
 */

function aplicar(estado: EstadoDaConversa, ...acoes: AcaoDaConversa[]): EstadoDaConversa {
  return acoes.reduce(reduzirConversa, estado);
}

const evento = (e: EventoDoTurno): AcaoDaConversa => ({ tipo: "evento", evento: e });

const ENVIADA: AcaoDaConversa = { tipo: "enviada", idDaPergunta: "p1", idDaResposta: "r1", texto: "Pergunta?" };

function resposta(estado: EstadoDaConversa) {
  return estado.mensagens.find((m) => m.id === "r1")!;
}

describe("reduzirConversa", () => {
  it("enviar põe a pergunta e a resposta em `enviando`, e liga `transmitindo`", () => {
    const e = aplicar(CONVERSA_NOVA, ENVIADA);
    expect(e.transmitindo).toBe(true);
    expect(e.mensagens.map((m) => [m.autor, m.estado])).toEqual([
      ["professor", "pronta"],
      ["agente", "enviando"],
    ]);
    expect(resposta(e).pergunta).toBe("Pergunta?");
  });

  it("os deltas ACUMULAM, e a resposta passa a `transmitindo`", () => {
    const e = aplicar(CONVERSA_NOVA, ENVIADA, evento({ tipo: "delta", texto: "Encontrei " }), evento({ tipo: "delta", texto: "no acervo." }));
    expect(resposta(e).texto).toBe("Encontrei no acervo.");
    expect(resposta(e).estado).toBe("transmitindo");
  });

  it("fontes, título e aviso; o `fim` deixa a resposta `pronta` e desliga `transmitindo`", () => {
    const fontes = [{ titulo: "BNCC — Ensino Fundamental", paginaInicio: 300, paginaFim: 301 }];
    const e = aplicar(
      CONVERSA_NOVA,
      ENVIADA,
      evento({ tipo: "delta", texto: "Texto" }),
      evento({ tipo: "fontes", fontes }),
      evento({ tipo: "titulo", titulo: "Números naturais no 6º ano" }),
      evento({ tipo: "aviso", codigo: "habilidade-inexistente", mensagem: "O código EF99ZZ99 não existe." }),
      evento({ tipo: "fim" }),
    );
    expect(resposta(e)).toMatchObject({ estado: "pronta", fontes, avisos: ["O código EF99ZZ99 não existe."] });
    expect(e.titulo).toBe("Números naturais no 6º ano");
    expect(e.transmitindo).toBe(false);
    expect(e.respostaAtual).toBeNull();
  });

  it("`erro` depois de deltas mantém o texto que chegou e mostra a mensagem; QUOTA não oferece repetir", () => {
    const e = aplicar(
      CONVERSA_NOVA,
      ENVIADA,
      evento({ tipo: "delta", texto: "Começo" }),
      evento({ tipo: "erro", codigo: "TEMPO_ESGOTADO", mensagem: "Demorou demais." }),
    );
    expect(resposta(e)).toMatchObject({ texto: "Começo", estado: "erro", erro: "Demorou demais.", podeRepetir: true });
    expect(e.transmitindo).toBe(false);

    const quota = aplicar(CONVERSA_NOVA, ENVIADA, evento({ tipo: "erro", codigo: "QUOTA", mensagem: "Cota." }));
    expect(resposta(quota).podeRepetir).toBe(false);
  });

  it("evento depois do fim do turno não muda nada (não há resposta no ar)", () => {
    const fim = aplicar(CONVERSA_NOVA, ENVIADA, evento({ tipo: "delta", texto: "A" }), evento({ tipo: "fim" }));
    expect(aplicar(fim, evento({ tipo: "delta", texto: "B" }))).toEqual(fim);
  });

  it("\"Parar\" (abort) deixa a resposta `pronta` com o que chegou e marcada como interrompida", () => {
    const e = aplicar(CONVERSA_NOVA, ENVIADA, evento({ tipo: "delta", texto: "Meia resposta" }), { tipo: "interrompida" });
    expect(resposta(e)).toMatchObject({ texto: "Meia resposta", estado: "pronta", interrompida: true });
    expect(e.transmitindo).toBe(false);
  });

  it("a conexão que cai sem `fim` vira erro com repetir — texto cortado não pode parecer resposta inteira", () => {
    const e = aplicar(CONVERSA_NOVA, ENVIADA, evento({ tipo: "delta", texto: "Cortad" }), { tipo: "caiu" });
    expect(resposta(e)).toMatchObject({ texto: "Cortad", estado: "erro", podeRepetir: true });
  });

  it("recusa antes do stream (429, 503…) vira erro da resposta com a frase pronta", () => {
    const e = aplicar(CONVERSA_NOVA, ENVIADA, { tipo: "recusada", erro: "Você usou toda a cota.", podeRepetir: false });
    expect(resposta(e)).toMatchObject({ estado: "erro", erro: "Você usou toda a cota.", podeRepetir: false, texto: "" });
  });

  it("repetir zera a MESMA resposta (texto, fontes, avisos) e liga o turno de novo", () => {
    const falhou = aplicar(
      CONVERSA_NOVA,
      ENVIADA,
      evento({ tipo: "delta", texto: "Parcial" }),
      evento({ tipo: "erro", codigo: "AGENTE_INDISPONIVEL", mensagem: "Fora." }),
    );
    const e = aplicar(falhou, { tipo: "repetida", idDaResposta: "r1" });
    expect(resposta(e)).toMatchObject({ texto: "", estado: "enviando", avisos: [], pergunta: "Pergunta?" });
    expect(resposta(e).erro).toBeUndefined();
    expect(e.transmitindo).toBe(true);
    expect(e.mensagens).toHaveLength(2);
  });

  it("carregar uma conversa antiga traz título e mensagens prontas; `nova` limpa tudo", () => {
    const e = aplicar(CONVERSA_NOVA, {
      tipo: "carregada",
      ids: ["a", "b"],
      conversa: {
        id: "c1",
        titulo: "Números naturais no 6º ano",
        mensagens: [
          { autor: "professor", texto: "Pergunta" },
          { autor: "agente", texto: "Resposta", fontes: [{ titulo: "BNCC", paginaInicio: null, paginaFim: null }] },
        ],
      },
    });
    expect(e.conversaId).toBe("c1");
    expect(e.mensagens.map((m) => [m.id, m.estado])).toEqual([
      ["a", "pronta"],
      ["b", "pronta"],
    ]);
    expect(aplicar(e, { tipo: "nova" })).toEqual(CONVERSA_NOVA);
  });

  it("`criada` guarda o id da conversa sem mexer nas mensagens", () => {
    const e = aplicar(CONVERSA_NOVA, ENVIADA, { tipo: "criada", conversaId: "c9" });
    expect(e.conversaId).toBe("c9");
    expect(e.mensagens).toHaveLength(2);
  });
});

describe("fonteParaTela", () => {
  it("tira as páginas nulas (o DS quer a página ou nada)", () => {
    expect(fonteParaTela({ titulo: "BNCC", paginaInicio: null, paginaFim: null })).toEqual({ titulo: "BNCC" });
    expect(fonteParaTela({ titulo: "BNCC", paginaInicio: 300, paginaFim: 301 })).toEqual({
      titulo: "BNCC",
      paginaInicio: 300,
      paginaFim: 301,
    });
  });
});

describe("lerEvento", () => {
  it("valida o `data:` de cada evento e ignora o que não é do contrato", () => {
    expect(lerEvento("delta", '{"texto":"oi"}')).toEqual({ tipo: "delta", texto: "oi" });
    expect(lerEvento("delta", '{"outra":"coisa"}')).toBeNull();
    expect(lerEvento("delta", "não é json")).toBeNull();
    expect(lerEvento("evento-novo", "{}")).toBeNull();
  });

  it("`fim` vale mesmo sem `data:`, e `erro` torto ainda encerra o turno", () => {
    expect(lerEvento("fim", "")).toEqual({ tipo: "fim" });
    expect(lerEvento("erro", "lixo")).toEqual({ tipo: "erro", codigo: "AGENTE_INDISPONIVEL", mensagem: "" });
  });
});
