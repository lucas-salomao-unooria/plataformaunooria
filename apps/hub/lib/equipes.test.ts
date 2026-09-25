import { describe, expect, test } from "vitest";

import {
  SEM_EQUIPE,
  computadoresPadrao,
  corpoParaSalvar,
  juntarNomes,
  moverEstudante,
  novaEquipe,
  problemasAntesDeSalvar,
  rascunhoDaSugestao,
  rascunhoDaUltima,
  removerEquipe,
  resumoDoAgrupamento,
  rotuloEquipesProntas,
  rotulosCurtos,
  tamanhoDasEquipes,
  textoSuaEquipe,
  type PessoaDaEquipe,
  type RascunhoDeEquipes,
} from "./equipes";

const ana: PessoaDaEquipe = { id: "a", nome: "Ana Souza" };
const bruno: PessoaDaEquipe = { id: "b", nome: "Bruno Lima" };
const caio: PessoaDaEquipe = { id: "c", nome: "Caio Reis" };
const davi: PessoaDaEquipe = { id: "d", nome: "Davi Melo" };
const TURMA = [ana, bruno, caio, davi];

function rascunho(): RascunhoDeEquipes {
  return rascunhoDaSugestao(
    {
      modo: "sorteio",
      computadores: 2,
      equipes: [
        { nome: "Equipe 1", membros: [ana, bruno], grupo: "A", mista: false },
        { nome: "Equipe 2", membros: [caio], grupo: "B", mista: true },
      ],
      semEquipe: [],
      agrupamento: null,
    },
    [davi.id],
    TURMA,
  );
}

describe("os textos das equipes", () => {
  test("a tag da sala concorda com o número", () => {
    expect(rotuloEquipesProntas(1)).toBe("1 equipe pronta");
    expect(rotuloEquipesProntas(10)).toBe("10 equipes prontas");
  });

  test("a faixa do estudante junta os colegas com 'e' no último", () => {
    expect(textoSuaEquipe({ nome: "Equipe 3", colegas: ["Ana", "Bruno"] })).toBe(
      "Sua equipe: Equipe 3 · com Ana e Bruno",
    );
    expect(textoSuaEquipe({ nome: "Equipe 3", colegas: ["Ana", "Bruno", "Caio"] })).toBe(
      "Sua equipe: Equipe 3 · com Ana, Bruno e Caio",
    );
    expect(textoSuaEquipe({ nome: "Equipe 3", colegas: ["Ana"] })).toBe("Sua equipe: Equipe 3 · com Ana");
  });

  test("sozinho na equipe, a faixa não inventa um 'com'", () => {
    expect(textoSuaEquipe({ nome: "Equipe 3", colegas: [] })).toBe("Sua equipe: Equipe 3");
    expect(juntarNomes([])).toBe("");
  });

  test("a tela projetada mostra o primeiro nome — e a inicial só quando ele repete", () => {
    const rotulos = rotulosCurtos([
      ana,
      { id: "m1", nome: "Maria Clara Santos" },
      { id: "m2", nome: "maria Oliveira" },
    ]);
    expect(rotulos.get("a")).toBe("Ana");
    expect(rotulos.get("m1")).toBe("Maria S.");
    expect(rotulos.get("m2")).toBe("maria O.");
  });

  test("o tamanho das equipes sai do número de computadores, com diferença de no máximo 1", () => {
    expect(tamanhoDasEquipes(40, 10)).toBe("40 estudantes em 10 computadores: equipes de 4.");
    expect(tamanhoDasEquipes(25, 10)).toBe("25 estudantes em 10 computadores: equipes de 2 ou 3.");
    expect(tamanhoDasEquipes(3, 5)).toBe("3 estudantes em 5 computadores: cada um no seu.");
    expect(tamanhoDasEquipes(0, 5)).toBe("Ninguém presente para dividir.");
  });

  test("o padrão de computadores é o anterior, senão metade da turma, dentro de 1..turma", () => {
    expect(computadoresPadrao(40, null)).toBe(20);
    expect(computadoresPadrao(25, undefined)).toBe(13);
    expect(computadoresPadrao(40, 10)).toBe(10);
    expect(computadoresPadrao(8, 30)).toBe(8);
    expect(computadoresPadrao(0, null)).toBe(1);
  });

  test("o resumo do agrupamento diz quantos têm lado e quantas equipes misturaram", () => {
    const base = { fonte: "Atividade da turma", comGrupo: 18, neutros: 7, aviso: null };
    expect(resumoDoAgrupamento({ ...base, equipesMistas: 1 })).toBe(
      "18 com lado, 7 sem perfil (sorteados). 1 equipe mista.",
    );
    expect(resumoDoAgrupamento({ ...base, equipesMistas: 0 })).toContain("Nenhuma equipe mista.");
    expect(resumoDoAgrupamento({ ...base, equipesMistas: 3 })).toContain("3 equipes mistas.");
  });
});

describe("o que impede de salvar", () => {
  test("equipes válidas não têm problema", () => {
    expect(
      problemasAntesDeSalvar([
        { nome: "Equipe 1", membros: [ana] },
        { nome: "Equipe 2", membros: [bruno] },
      ]),
    ).toEqual([]);
  });

  test("nenhuma equipe", () => {
    expect(problemasAntesDeSalvar([])).toEqual(["Monte pelo menos uma equipe."]);
  });

  test("equipe vazia é nomeada na mensagem", () => {
    expect(problemasAntesDeSalvar([{ nome: "Equipe 2", membros: [] }])).toEqual([
      "Equipe 2: sem ninguém. Ponha alguém nela ou remova a equipe.",
    ]);
  });

  test("nome em branco, longo demais e repetido (sem diferenciar maiúscula)", () => {
    const problemas = problemasAntesDeSalvar([
      { nome: "   ", membros: [ana] },
      { nome: "x".repeat(31), membros: [bruno] },
      { nome: "Tigres", membros: [caio] },
      { nome: "tigres ", membros: [davi] },
    ]);
    expect(problemas).toContain("Toda equipe precisa de um nome.");
    expect(problemas).toContain(`O nome "${"x".repeat(31)}" passa de 30 caracteres.`);
    expect(problemas.filter((p) => p.startsWith("Há mais de uma equipe"))).toHaveLength(1);
  });
});

describe("o rascunho da edição", () => {
  test("a sugestão devolve os presentes; quem faltou aparece em 'Sem equipe'", () => {
    const r = rascunho();
    expect(r.equipes.map((e) => e.membros.length)).toEqual([2, 1]);
    expect(r.semEquipe.map((p) => p.id)).toEqual(["d"]);
    expect(r.ausentes).toEqual(["d"]);
  });

  test("mover tira a tag de lado das duas equipes envolvidas, e só delas", () => {
    const r = moverEstudante(rascunho(), "b", "nova-2");
    expect(r.equipes[0]!.membros.map((p) => p.id)).toEqual(["a"]);
    expect(r.equipes[1]!.membros.map((p) => p.id)).toEqual(["c", "b"]);
    expect(r.equipes.every((e) => e.mexida)).toBe(true);

    const r2 = novaEquipe(rascunho());
    const r3 = moverEstudante(r2, "a", r2.equipes[2]!.chave);
    expect(r3.equipes[1]!.mexida).toBe(false);
  });

  test("quem faltou e entra numa equipe deixa de ser ausente", () => {
    const r = moverEstudante(rascunho(), "d", "nova-1");
    expect(r.ausentes).toEqual([]);
    expect(r.semEquipe).toEqual([]);
    expect(r.equipes[0]!.membros.map((p) => p.id)).toEqual(["a", "b", "d"]);
  });

  test("mandar para 'Sem equipe' não marca falta", () => {
    const r = moverEstudante(rascunho(), "a", SEM_EQUIPE);
    expect(r.semEquipe.map((p) => p.id)).toEqual(["a", "d"]);
    expect(r.ausentes).toEqual(["d"]);
  });

  test("destino desconhecido não muda nada", () => {
    const antes = rascunho();
    expect(moverEstudante(antes, "a", "nao-existe")).toBe(antes);
    expect(moverEstudante(antes, "ninguem", "nova-2")).toBe(antes);
  });

  test("remover a equipe devolve os membros para 'Sem equipe'", () => {
    const r = removerEquipe(rascunho(), "nova-1");
    expect(r.equipes.map((e) => e.nome)).toEqual(["Equipe 2"]);
    expect(r.semEquipe.map((p) => p.id)).toEqual(["a", "b", "d"]);
  });

  test("nova equipe pega o primeiro 'Equipe N' livre", () => {
    const r = novaEquipe(removerEquipe(rascunho(), "nova-1"));
    expect(r.equipes.map((e) => e.nome)).toEqual(["Equipe 2", "Equipe 3"]);
    expect(new Set(r.equipes.map((e) => e.chave)).size).toBe(2);
  });

  test("manter as da última missão tira quem faltou hoje", () => {
    const r = rascunhoDaUltima(
      {
        origem: { expId: "exp04ef1b", atualizadoEm: "2026-09-20T12:00:00Z" },
        equipes: [{ nome: "Equipe 1", membros: [ana, davi] }, { nome: "Equipe 2", membros: [bruno] }],
        semEquipe: [caio],
        saidas: 0,
      },
      ["d"],
      TURMA,
    );
    expect(r.modo).toBe("manual");
    expect(r.equipes[0]!.membros.map((p) => p.id)).toEqual(["a"]);
    expect(r.semEquipe.map((p) => p.id)).toEqual(["c", "d"]);
  });

  test("o corpo do PUT leva ids, nomes aparados e só os ausentes que seguem sem equipe", () => {
    const r = moverEstudante(renomear(rascunho()), "d", "nova-2");
    expect(corpoParaSalvar(r, 3)).toEqual({
      versao: 3,
      modo: "sorteio",
      computadores: 2,
      ausentes: [],
      equipes: [
        { nome: "Tigres", membros: ["a", "b"] },
        { nome: "Equipe 2", membros: ["c", "d"] },
      ],
    });
  });
});

function renomear(r: RascunhoDeEquipes): RascunhoDeEquipes {
  return { ...r, equipes: r.equipes.map((e, i) => (i === 0 ? { ...e, nome: "  Tigres " } : e)) };
}
