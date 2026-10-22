import { TAREFAS } from "../src/unoogpt/regras/canal-a";
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

test("a ficha da exp05ef1b está no registro: o alerta e o robô do grupo, sem pergunta (v5)", () => {
  const ficha = FICHAS.find((f) => f.expId === "exp05ef1b");
  expect(ficha?.versao).toBe(5);
  expect(ficha?.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => [m.id, m.tipo, m.rotulo, m.perguntaId ?? null])])).toEqual([
    ["EF05CO08", [["selecao-do-mural", "acao", "Seleção do Mural", null]]],
    ["EF05CO03", [["alerta-do-grupo", "acao", "Alerta do grupo", null]]],
    ["EF05CO04", [["robo-do-grupo", "acao", "Robô do grupo", null]]],
  ]);
  expect(ficha?.perguntas).toEqual([]);
  /* Toda ação tem rótulo: é o "de onde veio o nível" do painel (ADR-166). */
  expect(ficha?.habilidades.flatMap((h) => h.marcadores).every((m) => Boolean(m.rotulo))).toBe(true);
});

test("a ficha da exp08ef1b está no registro: o Canal A em toda habilidade, sem pergunta (ADR-167)", () => {
  const ficha = FICHAS.find((f) => f.expId === "exp08ef1b");
  expect(ficha?.versao).toBe(3); // réguas do PO validadas em 2026-10-21 (ADR-179)
  expect(
    ficha?.habilidades.map((h) => [
      h.codigo,
      h.marcadores.map((m) => [m.id, m.tipo, m.limitadoPelaAtividade ?? false]),
    ]),
  ).toEqual([
    ["EF08CO11", [["raio-x", "acao", false], ["reflexao", "acao", false]]],
    ["EF08CO09", [["termos", "acao", false]]],
    ["EF08CO07", [["envio", "acao", false], ["envio-sem-confiabilidade", "acao", true]]],
  ]);
  expect(ficha?.perguntas).toEqual([]);
  /* Toda ação tem rótulo: é o "de onde veio o nível" do painel (ADR-166). */
  expect(ficha?.habilidades.flatMap((h) => h.marcadores).every((m) => Boolean(m.rotulo))).toBe(true);
});

test("a ficha da exp02em1b-v0 (Tempestade) está no registro: o Canal A em toda habilidade, sem pergunta (ADR-172)", () => {
  const ficha = FICHAS.find((f) => f.expId === "exp02em1b-v0");
  expect(ficha?.versao).toBe(2);
  expect(ficha?.respostas).toBeUndefined();
  expect(ficha?.contaAoEncerrarAMissao).toBe(true);
  expect(ficha?.habilidades.map((h) => [h.codigo, h.marcadores.map((m) => [m.id, m.tipo])])).toEqual([
    ["EM13CO12", [["leitura", "acao"]]],
    ["EM13CO14", [["fontes", "acao"]]],
    ["EM13CO11", [["e-se", "acao"]]],
    ["EM13CO08", [["whatsapp", "acao"]]],
    ["EM13CO24", [["alerta", "acao"]]],
    ["EM13CO26", [["saude", "acao"], ["moradora", "acao"]]],
  ]);
  expect(ficha?.perguntas).toEqual([]);
  /* Toda ação tem rótulo (ADR-166), e nenhuma é limitada pela atividade: o teto
     da Saúde é a própria régua, não a atividade. */
  const marcadores = ficha?.habilidades.flatMap((h) => h.marcadores) ?? [];
  expect(marcadores.every((m) => Boolean(m.rotulo))).toBe(true);
  expect(marcadores.some((m) => m.limitadoPelaAtividade)).toBe(false);
  /* Os marcadores são as tarefas do Canal A, uma a uma. */
  expect(marcadores.map((m) => m.id).sort()).toEqual([...TAREFAS].sort());
  /* A EM13CO10 fica fora: trabalhada no debate, não medida. */
  expect(ficha?.habilidades.some((h) => h.codigo === "EM13CO10")).toBe(false);
});
