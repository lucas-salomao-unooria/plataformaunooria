import { lerManifestos } from "../prisma/catalogo-e-liberacoes";
import { habilidadePorCodigo } from "../src/curriculo/consulta";
import { FICHAS, type FichaPedagogica } from "../src/evidencias/fichas";
import { validarFicha } from "../src/evidencias/regras";

/**
 * TODA FICHA DO REGISTRO É CONFERIDA (E14).
 *
 * A primeira ficha do registro é a da A Seleção (`exp07ef1b`), e ela entrou
 * com a trava que este arquivo já tinha: os códigos existem na BNCC homologada
 * (`curriculo/`), o `expId` existe nos manifestos, o gabarito só usa níveis
 * válidos e todo marcador de pergunta aponta para uma pergunta que existe.
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
    validadaPor: "Coordenação pedagógica (teste)",
    validadaEm: "2026-09-25",
    habilidades: [{ codigo: "EF08CO01", marcadores: [{ id: "acao-1", tipo: "acao" }] }],
    perguntas: [],
  };

  test("uma ficha boa, de missão real e código real, passa", () => {
    expect(problemas(boa)).toEqual([]);
  });

  test("missão sem manifesto e código fora da Base reprovam", () => {
    const erros = problemas({
      ...boa,
      expId: "exp09ef4b",
      habilidades: [{ codigo: "EF08CO99", marcadores: [{ id: "acao-1", tipo: "acao" }] }],
    });
    expect(erros).toEqual([
      "ficha de exp09ef4b: EF08CO99 não é um código da BNCC.",
      "ficha de exp09ef4b: não há manifesto com este expId.",
    ]);
  });
});
