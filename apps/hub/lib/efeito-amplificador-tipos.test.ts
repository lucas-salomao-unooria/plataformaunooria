import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  DISCIPLINAS,
  FAIXAS_DA_MADRUGADA,
  FASES,
  MANCHETES,
  NOS,
  ORIGENS,
  PASSOS,
  PAUTA,
  TIPOS_DE_COMENTARIO,
  horarioDeMadrugada,
  percentual,
  tempoParado,
} from "./efeito-amplificador-tipos";

/**
 * O espelho do hub contra a api (lida como TEXTO: o hub não importa a api).
 * Uma lista de valores a mais é a que ninguém atualiza junto.
 */
const API = join(__dirname, "../../api/src/efeito-amplificador");
const conteudo = readFileSync(join(API, "conteudo.ts"), "utf8");
const passos = readFileSync(join(API, "regras/passos.ts"), "utf8");
const contrato = readFileSync(join(API, "contrato-de-rotas.ts"), "utf8");
const controller = readFileSync(join(API, "efeito-amplificador-turmas.controller.ts"), "utf8");

const lista = (fonte: string, nome: string) => {
  const m = new RegExp(`export const ${nome}(?:: readonly string\\[\\])? = \\[([^\\]]+)\\]`).exec(fonte);
  return m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};

describe("o espelho dos vocabulários", () => {
  test.each([
    ["DISCIPLINAS", DISCIPLINAS, conteudo],
    ["ORIGENS", ORIGENS, conteudo],
    ["NOS", NOS, conteudo],
    ["MANCHETES", MANCHETES, conteudo],
    ["TIPOS_DE_COMENTARIO", TIPOS_DE_COMENTARIO, conteudo],
    ["FASES", FASES, conteudo],
    ["FAIXAS_DA_MADRUGADA", FAIXAS_DA_MADRUGADA, conteudo],
    ["PASSOS", PASSOS, passos],
  ])("%s", (nome, valores, fonte) => {
    expect(lista(fonte, nome)).toEqual([...valores]);
  });

  test("os tetos da pauta", () => {
    expect(conteudo).toContain(
      `export const PAUTA = { titulo: ${PAUTA.titulo}, descricao: ${PAUTA.descricao}, orientacao: ${PAUTA.orientacao}, orientacoes: { min: ${PAUTA.orientacoes.min}, max: ${PAUTA.orientacoes.max} } } as const;`,
    );
  });
});

describe("o contrato que as telas do professor usam", () => {
  test("o gate recebe `etapa`, não `acao`", () => {
    expect(contrato).toContain('GateSchema = z.object({ etapa: z.enum(["pausa", "explicar"]) })');
  });

  test("o painel traz os quatro cartões e o tempo parado", () => {
    for (const campo of ["percentualNoturno", "matriz", "segundosInativo", "EM13CO24", "EM13CO14", "EM13CO26", "EM13CO08"]) {
      expect(contrato, campo).toContain(campo);
    }
    expect(contrato).not.toContain("picoNaMadrugada");
  });

  test("as rotas da turma que o hub chama existem no controller", () => {
    for (const rota of [":turmaId/pacote", ":turmaId/gerar-conteudo", ":turmaId/homologar", ":turmaId/banco-padrao", ":turmaId/gate", ":turmaId/painel", ":turmaId/zerar", ":turmaId/pacotes/:pacoteId/em-andamento"]) {
      expect(controller, rota).toContain(`"${rota}"`);
    }
  });
});

test("o tempo parado do Monitor de Ritmo", () => {
  expect(tempoParado(null)).toBe("—");
  expect(tempoParado(45)).toBe("45 s");
  expect(tempoParado(185)).toBe("3 min");
  expect(tempoParado(3900)).toBe("1 h 05 min");
});

test("o horário de madrugada segue a régua da api (01h00 a 03h30)", () => {
  expect(horarioDeMadrugada("02h40")).toBe(true);
  expect(horarioDeMadrugada("01h00")).toBe(true);
  expect(horarioDeMadrugada("03h30")).toBe(true);
  expect(horarioDeMadrugada("03h31")).toBe(false);
  expect(horarioDeMadrugada("00h59")).toBe(false);
  expect(horarioDeMadrugada("02:40")).toBe(false);
});

test("percentual inteiro, e zero sem total", () => {
  expect(percentual(1, 3)).toBe(33);
  expect(percentual(0, 0)).toBe(0);
});

test("o recorte segue o Zod da api", async () => {
  const { problemasDoRecorte, topicosDoTexto } = await import("./efeito-amplificador-tipos");
  expect(topicosDoTexto("Luz azul\n\n Sono  \nRetenção")).toEqual(["Luz azul", "Sono", "Retenção"]);
  expect(problemasDoRecorte({ disciplina: "biologia", tema: "Telas e sono", topicos: ["aa", "bb", "cc"], contexto: "" })).toEqual([]);
  expect(problemasDoRecorte({ disciplina: "", tema: "x", topicos: ["aa"], contexto: "" })).toHaveLength(3);
});

test("as perguntas do debate no guia são o roteiro da api (TC-22 a TC-24), literais", async () => {
  const { GUIA_EXP02EM1B } = await import("./entre-redes/guias/exp02em1b");
  const m = /export const ROTEIRO_DO_DEBATE = \[([\s\S]*?)\] as const/.exec(conteudo);
  const roteiro = m ? [...(m[1] as string).matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
  expect(roteiro).toHaveLength(3);
  expect(GUIA_EXP02EM1B.debate.perguntas.slice(-3).map((p) => p.pergunta)).toEqual(roteiro);
});
