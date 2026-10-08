import { lerManifestos } from "../prisma/catalogo-e-liberacoes";
import { habilidadePorCodigo } from "../src/curriculo/consulta";
import { FICHAS, type FichaPedagogica } from "../src/evidencias/fichas";
import { validarFicha } from "../src/evidencias/regras";

/**
 * TODA FICHA DO REGISTRO É CONFERIDA (E14).
 *
 * Toda ficha do registro (`FICHAS`: Quem Mandou Isso?, A Seleção, Jornal da
 * Escola, Júri Estadual, O Conteúdo que não chegou e a Missão Tempestade) entra com a trava: os códigos existem na BNCC
 * homologada (`curriculo/`), o `expId` existe nos manifestos, o gabarito só usa
 * níveis válidos e todo marcador de pergunta aponta para uma pergunta que existe.
 *
 * A prova de que a trava FUNCIONA com ficha de verdade (e não só passa por
 * vazio) está nos dois últimos testes: uma ficha boa passa pelo mesmo caminho,
 * e uma com `expId` fora dos manifestos e código fora da Base reprova.
 */

/** Existe na BNCC, com a grafia exata do documento. */
const CODIGOS = { has: (codigo: string) => habilidadePorCodigo(codigo)?.codigo === codigo };

/** Os ids das experiências REAIS — a mesma leitura do seed e de `manifestos-declaram-produto`. */
const EXPERIENCIAS = new Set(lerManifestos().map((m) => m.id));

/** Os problemas de uma ficha do REGISTRO: o validador puro + o que só o disco responde. */
function problemas(ficha: FichaPedagogica): string[] {
  const erros = validarFicha(ficha, CODIGOS);
  if (!EXPERIENCIAS.has(ficha.expId)) erros.push(`ficha de ${ficha.expId}: não há manifesto com este expId.`);
  return erros;
}

test("há manifesto para conferir o expId (senão a trava passaria por vazio)", () => {
  expect(EXPERIENCIAS.size).toBeGreaterThan(0);
});

test("uma ficha por missão", () => {
  const ids = FICHAS.map((f) => f.expId);
  expect(ids.length).toBe(new Set(ids).size);
});

/* Laço, e não `describe.each`: com o registro vazio — como ele nasceu —, o
   `.each` do Jest estoura ("called with an empty Array of table data"). */
test("o registro tem ficha para conferir (senão a trava passaria por vazio)", () => {
  expect(FICHAS.map((f) => f.expId)).toContain("exp07ef1b");
});

for (const ficha of FICHAS) {
  test(`a ficha de ${ficha.expId} é válida`, () => {
    expect(problemas(ficha)).toEqual([]);
  });
}

describe("a trava confere de verdade", () => {
  const boa: FichaPedagogica = {
    expId: "exp08ef1b",
    versao: 1,
    habilidades: [{ codigo: "EF08CO01", marcadores: [{ id: "acao-1", tipo: "acao" }], criterios: { atingiu: "a", em_processo: "b", nao_atingiu: "c" } }],
    perguntas: [],
  };

  test("uma ficha boa, de missão real e código real, passa", () => {
    expect(problemas(boa)).toEqual([]);
  });

  test("missão sem manifesto e código fora da Base reprovam", () => {
    const erros = problemas({
      ...boa,
      expId: "exp09ef4b",
      habilidades: [{ codigo: "EF08CO99", marcadores: [{ id: "acao-1", tipo: "acao" }], criterios: { atingiu: "a", em_processo: "b", nao_atingiu: "c" } }],
    });
    expect(erros).toEqual([
      "ficha de exp09ef4b: EF08CO99 não é um código da BNCC.",
      "ficha de exp09ef4b: não há manifesto com este expId.",
    ]);
  });
});

test("a ficha da exp05ef1b está no registro, com as três habilidades da régua", () => {
  const ficha = FICHAS.find((f) => f.expId === "exp05ef1b");
  expect(ficha?.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => [m.id, m.tipo, m.perguntaId ?? null])])).toEqual([
    ["EF05CO08", [["selecao-do-mural", "acao", null]]],
    ["EF05CO03", [["pergunta-tom-e-veracidade", "multipla_escolha", "p1"]]],
    ["EF05CO04", [["pergunta-regra-condicional", "multipla_escolha", "p2"]]],
  ]);
  expect(ficha?.perguntas.map((p) => [p.id, p.alternativas.map((a) => [a.id, a.status])])).toEqual([
    ["p1", [["A1", "atingiu"], ["A2", "em_processo"], ["A3", "nao_atingiu"]]],
    ["p2", [["B1", "atingiu"], ["B2", "em_processo"], ["B3", "nao_atingiu"]]],
  ]);
});

test("a ficha da exp08ef1b está no registro: três perguntas, uma por habilidade, gabarito do PO", () => {
  const ficha = FICHAS.find((f) => f.expId === "exp08ef1b");
  expect(ficha?.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => [m.id, m.tipo, m.perguntaId ?? null])])).toEqual([
    ["EF08CO11", [["p1", "multipla_escolha", "p1"]]],
    ["EF08CO09", [["p2", "multipla_escolha", "p2"]]],
    ["EF08CO07", [["p3", "multipla_escolha", "p3"]]],
  ]);
  expect(ficha?.perguntas.map((p) => [p.id, p.alternativas.map((a) => [a.id, a.status])])).toEqual([
    ["p1", [["A1", "atingiu"], ["A2", "em_processo"], ["A3", "nao_atingiu"]]],
    ["p2", [["B1", "atingiu"], ["B2", "em_processo"], ["B3", "nao_atingiu"]]],
    ["p3", [["C1", "atingiu"], ["C2", "em_processo"], ["C3", "nao_atingiu"]]],
  ]);
});

test("a ficha da exp02em1b está no registro: quatro perguntas, vale a melhor, conta ao encerrar", () => {
  const ficha = FICHAS.find((f) => f.expId === "exp02em1b");
  expect(ficha?.respostas).toBe("melhor");
  expect(ficha?.contaAoEncerrarAMissao).toBe(true);
  expect(ficha?.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => [m.id, m.tipo, m.perguntaId ?? null])])).toEqual([
    ["EM13CO14", [["p1", "multipla_escolha", "p1"]]],
    ["EM13CO08", [["p2", "multipla_escolha", "p2"]]],
    ["EM13CO24", [["p3", "multipla_escolha", "p3"]]],
    ["EM13CO26", [["p4", "multipla_escolha", "p4"]]],
  ]);
  expect(ficha?.perguntas.map((p) => [p.id, p.alternativas.map((a) => [a.id, a.status])])).toEqual([
    ["p1", [["A1", "atingiu"], ["A2", "em_processo"], ["A3", "nao_atingiu"]]],
    ["p2", [["B1", "atingiu"], ["B2", "em_processo"], ["B3", "nao_atingiu"]]],
    ["p3", [["C1", "atingiu"], ["C2", "em_processo"], ["C3", "nao_atingiu"]]],
    ["p4", [["D1", "atingiu"], ["D2", "em_processo"], ["D3", "nao_atingiu"]]],
  ]);
});
