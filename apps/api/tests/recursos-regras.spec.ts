import {
  linhasLegiveis,
  resolverExperiencia,
  resolverProduto,
  type LinhaDeDisponibilidade,
} from "../src/recursos/regras";

/**
 * A CADEIA DE PRECEDÊNCIA da disponibilidade (ADR-87) — sem banco.
 *
 * É aqui que as duas regras do painel da Unooria se provam: o escopo mais
 * específico ganha, e o produto é um TETO. As duas decidem o que o professor vê
 * na grade e se o estudante entra na missão, e nenhuma delas é visível no
 * typecheck: errar a ordem do laço faz o interruptor da escola ser engolido pelo
 * do contrato em silêncio.
 */

const EXP = "exp-70-vila-do-lume";

const linha = (
  recursoId: string,
  escolaId: string | null,
  ligado: boolean,
  versaoFixa: string | null = null,
): LinhaDeDisponibilidade => ({ recursoId, escolaId, ligado, versaoFixa, motivo: null });

/** A escola 7 pendurada na regional 3 — a cadeia como o service a monta. */
const CADEIA = ["esc-7", "regional-3"] as const;

describe("o padrão é LIGADO", () => {
  test("sem linha nenhuma, produto e experiência estão ligados e ninguém decidiu", () => {
    expect(resolverProduto([], "entre-redes", CADEIA)).toEqual({
      ligado: true,
      versaoFixa: null,
    });
    const efetivo = resolverExperiencia([], EXP, "entre-redes", CADEIA);
    expect(efetivo.ligado).toBe(true);
    // `undefined` e não `null`: "ninguém mexeu" é diferente de "o contrato
    // decidiu" — é dessa distinção que a tela tira o estado "herda".
    expect(efetivo.decididoEm).toBeUndefined();
  });
});

describe("o escopo mais específico ganha", () => {
  test("a linha do contrato vale quando não há nada mais específico", () => {
    const linhas = [linha("produto:bem-estar", null, false)];
    expect(resolverProduto(linhas, "bem-estar", CADEIA)).toMatchObject({
      ligado: false,
      decididoEm: null,
    });
  });

  test("a linha da ESCOLA ganha da do contrato", () => {
    const linhas = [
      linha("produto:bem-estar", null, false),
      linha("produto:bem-estar", "esc-7", true),
    ];
    expect(resolverProduto(linhas, "bem-estar", CADEIA)).toMatchObject({
      ligado: true,
      decididoEm: "esc-7",
    });
  });

  test("a linha da REGIONAL ganha do contrato e perde da escola", () => {
    const daRegional = linha("produto:bem-estar", "regional-3", false);
    expect(resolverProduto([linha("produto:bem-estar", null, true), daRegional], "bem-estar", CADEIA))
      .toMatchObject({ ligado: false, decididoEm: "regional-3" });

    expect(
      resolverProduto(
        [daRegional, linha("produto:bem-estar", "esc-7", true)],
        "bem-estar",
        CADEIA,
      ),
    ).toMatchObject({ ligado: true, decididoEm: "esc-7" });
  });

  test("a linha de OUTRA escola não vale nesta cadeia", () => {
    const linhas = [linha("produto:bem-estar", "esc-99", false)];
    expect(resolverProduto(linhas, "bem-estar", CADEIA).ligado).toBe(true);
  });

  test("cadeia VAZIA (token de contrato, sem escola) lê só a linha do contrato", () => {
    const linhas = [
      linha("produto:bem-estar", "esc-7", false),
      linha("produto:bem-estar", null, true),
    ];
    expect(resolverProduto(linhas, "bem-estar", []).ligado).toBe(true);
  });
});

describe("o produto é um TETO", () => {
  test("produto desligado desliga a experiência mesmo com linha própria LIGADA", () => {
    const linhas = [
      linha("produto:entre-redes", null, false),
      linha(`experiencia:${EXP}`, null, true),
    ];
    const efetivo = resolverExperiencia(linhas, EXP, "entre-redes", CADEIA);
    expect(efetivo.ligado).toBe(false);
    // É este campo que a tela usa para desabilitar o interruptor da experiência
    // com o motivo ao lado, em vez de mostrá-lo ligado e mentir.
    expect(efetivo.tetoDoProduto).toBe(true);
  });

  test("religar o produto NA ESCOLA reabre o teto, e aí vale o interruptor da experiência", () => {
    const linhas = [
      linha("produto:entre-redes", null, false),
      linha("produto:entre-redes", "esc-7", true),
      linha(`experiencia:${EXP}`, null, false),
    ];
    const efetivo = resolverExperiencia(linhas, EXP, "entre-redes", CADEIA);
    expect(efetivo.ligado).toBe(false);
    // Desligada pela PRÓPRIA linha, não pelo teto — a tela diz coisas diferentes.
    expect(efetivo.tetoDoProduto).toBeUndefined();
    expect(efetivo.decididoEm).toBeNull();
  });

  test("experiência SEM produto responde só pelo próprio interruptor", () => {
    const linhas = [linha("produto:entre-redes", null, false)];
    expect(resolverExperiencia(linhas, EXP, null, CADEIA).ligado).toBe(true);
  });
});

describe("a versão fixa", () => {
  test("desce com a linha da experiência que vale", () => {
    const linhas = [linha(`experiencia:${EXP}`, "esc-7", true, "1.1.0")];
    expect(resolverExperiencia(linhas, EXP, "entre-redes", CADEIA).versaoFixa).toBe("1.1.0");
  });

  test("A LINHA INTEIRA É A DECISÃO: a da escola não herda a versão do contrato", () => {
    const linhas = [
      linha(`experiencia:${EXP}`, null, true, "2.0.0"),
      linha(`experiencia:${EXP}`, "esc-7", true, null),
    ];
    expect(resolverExperiencia(linhas, EXP, "entre-redes", CADEIA).versaoFixa).toBeNull();
  });

  test("produto nunca devolve versão — o CHECK do banco recusa gravá-la lá", () => {
    const linhas = [linha("produto:entre-redes", null, true, "9.9.9")];
    expect(resolverProduto(linhas, "entre-redes", CADEIA).versaoFixa).toBeNull();
  });
});

test("linha com `recurso_id` fora do vocabulário é descartada, não interpretada", () => {
  const sujas = [
    linha("jogo", null, false),
    linha("produto:bem-estar", null, false),
    linha("experiencia:EXP-MAIUSCULA", null, false),
  ];
  const limpas = linhasLegiveis(sujas);
  expect(limpas.map((l) => l.recursoId)).toEqual(["produto:bem-estar"]);
  // E o descarte não muda resposta nenhuma: o que sobrou continua valendo.
  expect(resolverProduto(limpas, "bem-estar", CADEIA).ligado).toBe(false);
});
