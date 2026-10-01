import type { EventoAgente } from "../src/ai/agente-professor.port";
import { habilidadePorCodigo } from "../src/curriculo/consulta";
import {
  DeduplicadorDeTexto,
  codigosCitados,
  codigosInexistentes,
  extrairFontes,
  mensagensDaSessao,
  primeiroNome,
  somarTokens,
  tituloDoEstado,
} from "../src/agente-professor/regras";

/** As regras puras do agente de IA do professor — contrato em `docs/regras/agente-professor.md`. */

function ev(parcial: Partial<EventoAgente>): EventoAgente {
  return {
    autor: "agente_professor",
    parcial: false,
    textos: [],
    chamadasDeFerramenta: [],
    respostasDeFerramenta: [],
    ...parcial,
  };
}

describe("dedupe parcial × final agregado", () => {
  test("parciais seguidos do final que REPETE tudo: o texto não duplica", () => {
    const d = new DeduplicadorDeTexto();
    const saidas = [
      ev({ parcial: true, textos: ["Olá, "] }),
      ev({ parcial: true, textos: ["Ana."] }),
      ev({ textos: ["Olá, Ana."] }),
    ].map((e) => d.receber(e));
    expect(saidas).toEqual(["Olá, ", "Ana.", null]);
    expect(d.textoDoTurno).toBe("Olá, Ana.");
  });

  test("final sem parcial antes (streaming desligado) sai inteiro", () => {
    const d = new DeduplicadorDeTexto();
    expect(d.receber(ev({ textos: ["Resposta direta."] }))).toBe("Resposta direta.");
  });

  test("final que COMPLETA os parciais: só o resto", () => {
    const d = new DeduplicadorDeTexto();
    d.receber(ev({ parcial: true, textos: ["Três "] }));
    expect(d.receber(ev({ textos: ["Três passos."] }))).toBe("passos.");
    expect(d.textoDoTurno).toBe("Três passos.");
  });

  test("final que DIVERGE dos parciais: nada — o professor já leu a versão dos parciais", () => {
    const d = new DeduplicadorDeTexto();
    d.receber(ev({ parcial: true, textos: ["Um texto"] }));
    expect(d.receber(ev({ textos: ["Outro texto"] }))).toBeNull();
  });

  test("duas chamadas ao modelo no turno (ferramenta no meio): cada segmento deduplica o seu", () => {
    const d = new DeduplicadorDeTexto();
    const saidas = [
      ev({ parcial: true, textos: ["Vou buscar. "] }),
      ev({ textos: ["Vou buscar. "], chamadasDeFerramenta: [{ nome: "buscar_acervo", args: {} }] }),
      ev({ respostasDeFerramenta: [{ nome: "buscar_acervo", resposta: {} }] }),
      ev({ parcial: true, textos: ["Achei."] }),
      ev({ textos: ["Achei."] }),
    ].map((e) => d.receber(e));
    expect(saidas).toEqual(["Vou buscar. ", null, null, "Achei.", null]);
    expect(d.textoDoTurno).toBe("Vou buscar. Achei.");
  });

  test("evento do usuário não vai à tela", () => {
    expect(new DeduplicadorDeTexto().receber(ev({ autor: "user", textos: ["oi"] }))).toBeNull();
  });
});

describe("tokens", () => {
  test("só dos NÃO parciais, e SOMADOS — duas chamadas ao modelo no turno", () => {
    const eventos = [
      ev({ parcial: true, tokens: 999 }),
      ev({ tokens: 120 }),
      ev({ parcial: true, tokens: 999 }),
      ev({ tokens: 350 }),
      ev({}),
    ];
    expect(somarTokens(eventos)).toBe(470);
  });

  test("nenhum não parcial com tokens = zero", () => {
    expect(somarTokens([ev({ parcial: true, tokens: 50 })])).toBe(0);
  });
});

describe("fontes de buscar_acervo", () => {
  test("snake, camel e `pageSpan`; sem repetição; outras ferramentas ignoradas", () => {
    const eventos = [
      ev({
        respostasDeFerramenta: [
          {
            nome: "buscar_acervo",
            resposta: {
              trechos: [
                { titulo: "BNCC — Ensino Fundamental", pagina_inicio: 300, pagina_fim: 301, trecho: "…" },
                { title: "Livro de Matemática 6º ano", pageSpan: { pageStart: 12, pageEnd: 14 } },
              ],
            },
          },
          { nome: "buscar_habilidades", resposta: { trechos: [{ titulo: "não é fonte" }] } },
        ],
      }),
      ev({
        respostasDeFerramenta: [
          { nome: "buscar_acervo", resposta: { result: [{ titulo: "BNCC — Ensino Fundamental", paginaInicio: 300, paginaFim: 301 }] } },
          { nome: "buscar_acervo", resposta: [{ titulo: "Sem página" }, { sem: "título" }] },
        ],
      }),
    ];
    expect(extrairFontes(eventos)).toEqual([
      { titulo: "BNCC — Ensino Fundamental", paginaInicio: 300, paginaFim: 301 },
      { titulo: "Livro de Matemática 6º ano", paginaInicio: 12, paginaFim: 14 },
      { titulo: "Sem página", paginaInicio: null, paginaFim: null },
    ]);
  });
});

describe("conferência dos códigos da BNCC", () => {
  const existe = (c: string) => habilidadePorCodigo(c) !== null;

  test("os formatos do currículo são reconhecidos, inclusive o de três dígitos de Computação", () => {
    expect(codigosCitados("Veja EF06MA01, EM13LP01, EM13MAT101, EF05CO01 e EF05CO011.")).toEqual([
      "EF06MA01",
      "EM13LP01",
      "EM13MAT101",
      "EF05CO01",
      "EF05CO011",
    ]);
    /* Sem repetição, e colado em pontuação/markdown. */
    expect(codigosCitados("**EF06MA01** (EF06MA01)")).toEqual(["EF06MA01"]);
  });

  test("existente não avisa; inexistente avisa; EF05CO011 existe e NÃO é lido como EF05CO01", () => {
    expect(existe("EF05CO011")).toBe(true);
    expect(codigosInexistentes("EF06MA01 e EF05CO011", existe)).toEqual([]);
    expect(codigosInexistentes("EF06MA01 e EF99ZZ99", existe)).toEqual(["EF99ZZ99"]);
  });

  test("texto sem código não avisa nada", () => {
    expect(codigosInexistentes("Sugiro uma reta numérica.", existe)).toEqual([]);
  });
});

describe("primeiro nome e título", () => {
  test("primeiro nome de `display_name`", () => {
    expect(primeiroNome("  Ana Beatriz  Souza ")).toBe("Ana");
    expect(primeiroNome("Ana")).toBe("Ana");
    expect(primeiroNome("   ")).toBeNull();
    expect(primeiroNome(null)).toBeNull();
  });

  test("título saneado para a coluna", () => {
    expect(tituloDoEstado({ titulo_conversa: "  Frações \n no 6º ano " })).toBe("Frações no 6º ano");
    expect(tituloDoEstado({ titulo_conversa: "" })).toBeNull();
    expect(tituloDoEstado({ titulo_conversa: 42 })).toBeNull();
    expect(tituloDoEstado(undefined)).toBeNull();
    expect(tituloDoEstado({ titulo_conversa: "x".repeat(300) })?.length).toBe(120);
  });
});

describe("mensagens montadas da sessão", () => {
  test("professor + texto FINAL do agente, sem parciais, com as fontes do turno", () => {
    const eventos = [
      ev({ autor: "user", textos: ["Como ensinar frações?"] }),
      ev({ chamadasDeFerramenta: [{ nome: "buscar_acervo", args: {} }] }),
      ev({ respostasDeFerramenta: [{ nome: "buscar_acervo", resposta: { trechos: [{ titulo: "BNCC", pagina_inicio: 1, pagina_fim: 2 }] } }] }),
      ev({ parcial: true, textos: ["Com pizza"] }),
      ev({ textos: ["Com pizza."] }),
      ev({ autor: "user", textos: ["E decimais?"] }),
      ev({ textos: ["Com dinheiro."] }),
    ];
    expect(mensagensDaSessao(eventos)).toEqual([
      { autor: "professor", texto: "Como ensinar frações?" },
      { autor: "agente", texto: "Com pizza.", fontes: [{ titulo: "BNCC", paginaInicio: 1, paginaFim: 2 }] },
      { autor: "professor", texto: "E decimais?" },
      { autor: "agente", texto: "Com dinheiro." },
    ]);
  });
});
