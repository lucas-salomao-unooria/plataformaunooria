import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  SEGUNDOS_ATE_O_ALERTA,
  SEGUNDOS_DE_LEITURA_DO_GRAFICO,
  auditadasDo,
  esperandoAAula2,
  mensagensDo,
  segundosDesde,
  telaDoPasso,
} from "./regras";
import { EXP_VERSION, type Estado, type Mensagem } from "./tipos";

const MENSAGENS: Mensagem[] = [
  {
    id: "m1",
    chat: "gremio",
    autor: "a",
    hora: "08:00",
    tipo: "texto",
    texto: "x",
    metadados: { saltos: 6, autor: "a", detalhe: "", carimbo: "" },
  },
  {
    id: "m2",
    chat: "gremio",
    autor: "b",
    hora: "08:01",
    tipo: "texto",
    texto: "y",
    metadados: { saltos: null, autor: "b", detalhe: "", carimbo: "" },
  },
  {
    id: "m3",
    chat: "turma",
    autor: "c",
    hora: "08:02",
    tipo: "texto",
    texto: "z",
    metadados: { saltos: 2, autor: "c", detalhe: "", carimbo: "" },
  },
];

function estado(parcial: Partial<Estado> = {}): Estado {
  return {
    passo: "chats",
    passoDoEstudante: "chats",
    aguardandoATurma: false,
    auditadas: [],
    totalAuditadas: 0,
    cotaAtingida: false,
    faltamAuditar: 3,
    opcao: null,
    desfecho: null,
    reacao: null,
    topologia: null,
    ordemBlocos: [],
    coerente: null,
    entregouPercurso: false,
    concluidoEm: null,
    turma: { etapa: "aula1" },
    ...parcial,
  };
}

describe("o manifesto", () => {
  test("a versão bate nos três lugares — manifesto, package.json e código", () => {
    // O CI lê o manifesto para montar o caminho no bucket, que é IMUTÁVEL, e o
    // package.json para decidir se republica. Divergir já causou bug, e a
    // exp04ef1b e a exp02em1b divergem hoje. Aqui o teste é a rede.
    const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8"));
    const pacote = JSON.parse(readFileSync("package.json", "utf8"));
    expect(manifesto.versao).toBe(EXP_VERSION);
    expect(pacote.version).toBe(EXP_VERSION);
  });

  test("declara a casca de aparelho, a série e a unidade", () => {
    const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8"));
    // `viewport` é o que liga o `DispositivoFrame` do hub — sem ele a missão
    // apareceria esticada na janela, e não num celular.
    expect(manifesto.viewport).toEqual({ largura: 375, altura: 812 });
    // `series` decide se a missão entra na grade de uma turma; errar tira a
    // missão da tela sozinha. `unidade` é o que ORDENA a grade do ano.
    expect(manifesto.series).toEqual(["6EF"]);
    expect(manifesto.unidade).toBe(2);
  });

  test("NÃO pede permissão de iframe nenhuma", () => {
    // Não há `<form>` nesta missão: a decisão é `Radio` + botão, e o percurso é
    // um `TextArea` com submit programático. Pedir `forms` sem precisar seria
    // capacidade concedida por hábito — o princípio é o menor privilégio.
    const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8"));
    expect(manifesto.permissoes).toEqual([]);
  });
});

describe("as travas de tempo são as do ofício", () => {
  test("o alerta de inação só entra depois de 90s de silêncio", () => {
    // O silêncio pedagógico é não-negociável: encurtar isto tira a pressão que
    // o pico da missão existe para produzir.
    expect(SEGUNDOS_ATE_O_ALERTA).toBe(90);
  });

  test("o mapa não abre antes de 5s de leitura do gráfico", () => {
    // Sem a trava, o estudante toca "Ver mapa" antes de ler a assimetria das
    // curvas, e o Aha! chega sem o contraste que o sustenta.
    expect(SEGUNDOS_DE_LEITURA_DO_GRAFICO).toBe(5);
  });
});

describe("as duas esperas não são a mesma tela", () => {
  test("segurado no breakpoint = esperando a Aula 2", () => {
    expect(esperandoAAula2(estado({ passo: "breakpoint", aguardandoATurma: true }))).toBe(true);
  });

  test("ser empurrado adiante não é esperar", () => {
    // A etapa como PISO leva o estudante para frente; isso não é bloqueio.
    expect(esperandoAAula2(estado({ passo: "resultado", aguardandoATurma: false }))).toBe(false);
  });
});

describe("o feedback por conversa", () => {
  test("conta só as mensagens daquela conversa", () => {
    // Sem isto, quem auditou 3 balões do MESMO grupo não teria como saber por
    // que a cota não fechou — ela é sobre mensagens distintas em fontes
    // distintas.
    const e = estado({ auditadas: ["m1", "m2", "m3"] });
    expect(auditadasDo(e, MENSAGENS, "gremio")).toBe(2);
    expect(auditadasDo(e, MENSAGENS, "turma")).toBe(1);
    expect(auditadasDo(e, MENSAGENS, "bairro")).toBe(0);
  });

  test("mensagensDo separa os feeds", () => {
    expect(mensagensDo(MENSAGENS, "gremio").map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});

describe("a tela do passo", () => {
  test("um F5 no meio da Aula 1 cai no breakpoint, não no mapa", () => {
    // `passo` já vem reconciliado com a etapa da turma.
    expect(telaDoPasso("breakpoint", false, false)).toBe("espera");
  });

  test("a Etapa 4 alterna entre curvas e mapa dentro do mesmo passo", () => {
    // A alternância é do estudante, e ele pode voltar para comparar — é o que
    // a missão pede.
    expect(telaDoPasso("resultado", false, false)).toBe("curvas");
    expect(telaDoPasso("resultado", false, true)).toBe("mapa");
  });

  test("a lista e o feed são o mesmo passo", () => {
    expect(telaDoPasso("chats", false, false)).toBe("conversas");
    expect(telaDoPasso("chats", true, false)).toBe("feed");
  });

  test("todo passo tem tela — nenhum cai em undefined", () => {
    const passos = [
      "contexto",
      "chats",
      "decisao",
      "breakpoint",
      "resultado",
      "ciclo",
      "percurso",
      "fim",
    ] as const;
    for (const p of passos) expect(telaDoPasso(p, false, false)).toBeTruthy();
  });
});

describe("segundosDesde", () => {
  test("não devolve negativo quando o relógio da escola atrasa", () => {
    // Latência negativa é 400 no Zod da api, num payload que parecia certo.
    expect(segundosDesde(2_000, 1_000)).toBe(0);
  });

  test("conta segundos inteiros", () => {
    expect(segundosDesde(0, 90_500)).toBe(90);
  });
});
