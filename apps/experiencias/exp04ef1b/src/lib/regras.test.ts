import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  adicionar,
  chaveDasVagas,
  completas,
  desencaixar,
  devolver,
  encaixar,
  esperaDaTentativa,
  esvaziar,
  gateMudou,
  JOGADA_INICIAL,
  preenchidas,
  retirar,
  segundosDesde,
  separarEnunciado,
  TELA_DO_PASSO,
  VAGAS_VAZIAS,
  vagasValidas,
} from "./regras";
import type { GatePublico } from "./tipos";

describe("as vagas da página", () => {
  test("adicionar vai para a PRIMEIRA vaga vazia", () => {
    const um = adicionar(VAGAS_VAZIAS, "n3");
    expect(um).toEqual({ vagas: ["n3", null, null], resultado: "adicionada" });
    expect(adicionar(["n1", null, "n2"], "n4").vagas).toEqual(["n1", "n4", "n2"]);
  });

  test("a quarta não entra, e a repetida também não", () => {
    expect(adicionar(["n1", "n2", "n3"], "n4")).toEqual({ vagas: ["n1", "n2", "n3"], resultado: "cheia" });
    expect(adicionar(["n1", null, null], "n1").resultado).toBe("repetida");
  });

  test("Trocar Matéria esvazia a vaga, e a próxima escolha volta para ELA (a manchete continua manchete)", () => {
    const sem = esvaziar(["n1", "n2", "n3"], 0);
    expect(sem).toEqual([null, "n2", "n3"]);
    expect(adicionar(sem, "n8").vagas).toEqual(["n8", "n2", "n3"]);
    expect(retirar(["n1", "n2", "n3"], "n2")).toEqual(["n1", null, "n3"]);
  });

  test("completas só com as três, na ordem — é o `slots` do contrato", () => {
    expect(completas(["n1", null, "n3"])).toBeNull();
    expect(completas(["n2", "n1", "n3"])).toEqual(["n2", "n1", "n3"]);
    expect(preenchidas(["n1", null, "n3"])).toBe(2);
    expect(chaveDasVagas(["n2", "n1", "n3"])).toBe("n2|n1|n3");
  });

  test("a memória da aba só volta se for desta mesa, com três posições e sem repetição", () => {
    const ids = new Set(["n1", "n2", "n3"]);
    expect(vagasValidas(["n1", null, "n2"], ids)).toEqual(["n1", null, "n2"]);
    expect(vagasValidas(["n1", "n1", null], ids)).toBeNull();
    expect(vagasValidas(["n9", null, null], ids)).toBeNull();
    expect(vagasValidas(["n1", null], ids)).toBeNull();
    expect(vagasValidas("n1", ids)).toBeNull();
  });
});

describe("a bandeja e a calha da Chave (quem corrige é a api)", () => {
  test("encaixa na próxima vaga até três, e não repete", () => {
    let j = encaixar(JOGADA_INICIAL, "foto", 3);
    j = encaixar(j, "fonte", 3);
    j = encaixar(j, "fonte", 3);
    expect(j.vagas).toEqual(["foto", "fonte"]);
    j = encaixar(encaixar(j, "data", 3), "autoria", 3);
    expect(j.vagas).toEqual(["foto", "fonte", "data"]);
  });

  test("a tentativa que não abriu devolve as iscas e mantém os outros", () => {
    const j = devolver({ vagas: ["foto", "fonte", "data"], devolvidos: [] }, ["foto"]);
    expect(j).toEqual({ vagas: ["fonte", "data"], devolvidos: ["foto"] });
  });

  test("o estado `returned` é breve: some na jogada seguinte", () => {
    const j = { vagas: ["fonte", "data"] as const, devolvidos: ["foto"] as const };
    expect(encaixar(j, "autoria", 3).devolvidos).toEqual([]);
    expect(desencaixar(j, "data")).toEqual({ vagas: ["fonte"], devolvidos: [] });
  });
});

describe("o polling relê a sessão quando a turma andou", () => {
  const estado = { passo: "publicada", etapa: "exploracao", rodada: 1, pacoteId: "p1" } as const;
  const gate = (parte: Partial<GatePublico>): GatePublico => ({
    etapa: "exploracao",
    rodada: 1,
    pacoteId: "p1",
    passoEfetivo: "publicada",
    aguardandoOProfessor: true,
    agora: "2026-09-27T08:00:00.000Z",
    ...parte,
  });

  test("nada mudou: não relê", () => {
    expect(gateMudou(estado, gate({}))).toBe(false);
  });

  test("o professor liberou o resultado", () => {
    expect(gateMudou(estado, gate({ etapa: "resultado", passoEfetivo: "resultado" }))).toBe(true);
  });

  test("zerar a turma (rodada) e pacote novo relêem; gate que ainda não nasceu, não", () => {
    expect(gateMudou(estado, gate({ rodada: 2 }))).toBe(true);
    expect(gateMudou(estado, gate({ pacoteId: "p2" }))).toBe(true);
    expect(gateMudou(estado, gate({ rodada: null, pacoteId: null }))).toBe(false);
  });
});

describe("a tela de cada passo", () => {
  test("todo passo tem tela, na ordem do percurso", () => {
    expect(Object.values(TELA_DO_PASSO)).toEqual([
      "abertura",
      "mesa",
      "motivo",
      "espera",
      "resultado",
      "chave",
      "revisao",
      "comparativo",
      "desafio-final",
      "leitura",
    ]);
  });
});

describe("o enunciado de P1: boato, detalhe e pergunta", () => {
  /** O enunciado REAL da ficha da api — o teste vale para o texto que vai à tela. */
  function enunciadosDaFicha(): string[] {
    const fonte = readFileSync("../../api/src/evidencias/fichas/exp04ef1b.ts", "utf8");
    return [...fonte.matchAll(/enunciado:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1] ?? ""}"`) as string);
  }

  test("a P1 da ficha se separa no boato encaminhado, no detalhe e na pergunta; a P2 é só pergunta", () => {
    const [p1, p2] = enunciadosDaFicha();
    expect(p1 && separarEnunciado(p1)).toEqual({
      boato:
        "URGENTE: A prefeitura avisou que a água de todas as escolas do bairro vai ser cortada amanhã e ninguém deve ir para a aula! Repassem para todo mundo!",
      detalhe: "Mensagem sem link oficial, sem carimbo de data e sem nome de autoridade responsável.",
      pergunta:
        "Você recebeu esse aviso no celular. Antes de comemorar que não vai ter aula e repassar para os colegas, o que você precisa conferir para saber se essa mensagem é confiável?",
    });
    expect(p2 && separarEnunciado(p2).boato).toBeNull();
  });

  test("três blocos separados por linha em branco", () => {
    expect(separarEnunciado("URGENTE: corte de água!\n\nSem link oficial.\n\nO que conferir?")).toEqual({
      boato: "URGENTE: corte de água!",
      detalhe: "Sem link oficial.",
      pergunta: "O que conferir?",
    });
  });

  test("dois blocos: o primeiro é o boato; um bloco: tudo é pergunta — nada some", () => {
    expect(separarEnunciado("Boato.\n\nPergunta?")).toEqual({ boato: "Boato.", detalhe: null, pergunta: "Pergunta?" });
    expect(separarEnunciado("Só a pergunta?")).toEqual({ boato: null, detalhe: null, pergunta: "Só a pergunta?" });
  });
});

describe("os relógios", () => {
  test("a espera entre tentativas: 2 s, 4 s, 8 s e depois 15 s", () => {
    expect([0, 1, 2, 3, 9].map(esperaDaTentativa)).toEqual([2_000, 4_000, 8_000, 15_000, 15_000]);
  });

  test("o tempo nunca é negativo (o relógio da máquina da escola atrasa)", () => {
    expect(segundosDesde(10_000, 5_000)).toBe(0);
    expect(segundosDesde(0, 61_500)).toBe(61);
  });
});
