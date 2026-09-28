import {
  camposDaTransicao,
  ehTransversal,
  gradeDaTurma,
  serveASerie,
  type EstadoGravado,
  type ExperienciaDoCatalogo,
} from "../src/salas/regras";

/**
 * As regras PURAS da sala de aula (ADR-69) — sem banco.
 *
 * O que se prova aqui é o que decide o que aparece na tela: quem serve a série,
 * o que é transversal, a ordem, e o par estado/`encerrada_em` que o CHECK da
 * migration cobra do outro lado.
 */

const exp = (
  expId: string,
  series: string[],
  publico = "estudante",
  unidade: number | null = null,
): ExperienciaDoCatalogo => ({ expId, nome: expId, series, publico, unidade });

const CATALOGO: ExperienciaDoCatalogo[] = [
  exp("exp08ef1b", ["8EF"]),
  exp("exp04ef1b", ["4EF"]),
  exp("exp02em1b", ["2EM"]),
  exp("exp07ef1b", ["7EF"]),
  exp("app-70-vila-do-lume", []),
  exp("app-90-plano-de-aula", [], "professor"),
  exp("app-91-bem-estar", [], "professor"),
];

const semLiberacao = new Map<string, EstadoGravado>();

describe("série e transversal", () => {
  test("`series: []` quer dizer TODAS as séries, não nenhuma", () => {
    const vila = exp("app-70-vila-do-lume", []);
    expect(serveASerie(vila, "1EF")).toBe(true);
    expect(serveASerie(vila, "3EM")).toBe(true);
    expect(ehTransversal(vila)).toBe(true);
  });

  test("a missão de um ano não serve a outro", () => {
    const insta = exp("exp08ef1b", ["8EF"]);
    expect(serveASerie(insta, "8EF")).toBe(true);
    expect(serveASerie(insta, "7EF")).toBe(false);
    expect(ehTransversal(insta)).toBe(false);
  });
});

describe("a grade da turma", () => {
  test("traz a missão da série e as transversais, e nada de outro ano", () => {
    const grade = gradeDaTurma("8EF", CATALOGO, semLiberacao);
    expect(grade.map((m) => m.expId)).toEqual(["app-70-vila-do-lume", "exp08ef1b"]);
  });

  test("a TRANSVERSAL vem primeiro — a Vila é o Ato 1 do Instanooria", () => {
    const grade = gradeDaTurma("8EF", CATALOGO, semLiberacao);
    expect(grade[0]?.expId).toBe("app-70-vila-do-lume");
    expect(grade[0]?.transversal).toBe(true);
  });

  test("ferramenta de professor NUNCA entra: liberar uma delas seria botão que não abre nada", () => {
    const todas = gradeDaTurma("8EF", CATALOGO, semLiberacao, true);
    expect(todas.map((m) => m.expId)).not.toContain("app-90-plano-de-aula");
    expect(todas.map((m) => m.expId)).not.toContain("app-91-bem-estar");
  });

  test("sem linha em `liberacoes`, a missão está BLOQUEADA — e continua na grade", () => {
    const grade = gradeDaTurma("8EF", CATALOGO, semLiberacao);
    expect(grade.every((m) => m.estado === "bloqueada")).toBe(true);
    /* A decisão que este teste protege: bloqueada aparece com cadeado. Sumir da
       tela deixaria a criança sem saber que a próxima unidade existe. */
    expect(grade.length).toBeGreaterThan(0);
  });

  test("o estado gravado vence a ausência", () => {
    const estados = new Map<string, EstadoGravado>([
      ["exp08ef1b", "liberada"],
      ["app-70-vila-do-lume", "encerrada"],
    ]);
    const grade = gradeDaTurma("8EF", CATALOGO, estados);
    const porId = new Map(grade.map((m) => [m.expId, m.estado]));
    expect(porId.get("exp08ef1b")).toBe("liberada");
    // Encerrada continua VISÍVEL: o que a criança fez não evapora da tela.
    expect(porId.get("app-70-vila-do-lume")).toBe("encerrada");
  });

  test("`todas` acrescenta as de outra série, marcadas e no fim", () => {
    const grade = gradeDaTurma("8EF", CATALOGO, semLiberacao, true);
    const ids = grade.map((m) => m.expId);
    expect(ids).toContain("exp04ef1b");

    const daSerie = grade.filter((m) => !m.deOutraSerie).map((m) => m.expId);
    expect(daSerie).toEqual(["app-70-vila-do-lume", "exp08ef1b"]);
    // As de fora vêm depois das da turma — são o extra, não a grade do ano.
    expect(grade.findIndex((m) => m.deOutraSerie)).toBe(daSerie.length);
  });

  test("a transversal nunca é `deOutraSerie` — ela é de todas", () => {
    const grade = gradeDaTurma("3EM", CATALOGO, semLiberacao, true);
    const vila = grade.find((m) => m.expId === "app-70-vila-do-lume");
    expect(vila?.deOutraSerie).toBe(false);
  });
});

describe("a ordem da grade", () => {
  /* O 8º ano com as 4 unidades publicadas, declaradas FORA DE ORDEM no catálogo
     e com `exp_id` que contraria a ordem do ano — é o caso que o `localeCompare`
     sozinho errava. Os ids são FICTÍCIOS e fora do formato da ADR-110 de
     propósito: com o código real (`exp08ef2b`…) a ordem alfabética já
     acertaria, e o teste deixaria de provar que a grade ordena pela unidade. */
  const ANO_COMPLETO: ExperienciaDoCatalogo[] = [
    exp("exp-40-quarta", ["8EF"], "estudante", 4),
    exp("exp08ef1b", ["8EF"], "estudante", 1),
    exp("exp-30-terceira", ["8EF"], "estudante", 3),
    exp("exp-20-segunda", ["8EF"], "estudante", 2),
    exp("app-70-vila-do-lume", []),
  ];

  test("as unidades saem na ordem do ANO, não na do `exp_id`", () => {
    const grade = gradeDaTurma("8EF", ANO_COMPLETO, semLiberacao);
    expect(grade.map((m) => m.unidade)).toEqual([null, 1, 2, 3, 4]);
  });

  test("a transversal vem primeiro mesmo sem unidade — ela não é a unidade 1", () => {
    const grade = gradeDaTurma("8EF", ANO_COMPLETO, semLiberacao);
    expect(grade[0]?.expId).toBe("app-70-vila-do-lume");
    expect(grade[0]?.unidade).toBeNull();
  });

  test("quem não declara unidade vai por ÚLTIMO, nunca no lugar da unidade 1", () => {
    // Missão publicada antes do campo existir: `null` não pode virar zero.
    const comLegado = [...ANO_COMPLETO, exp("exp-99-sem-unidade", ["8EF"])];
    const grade = gradeDaTurma("8EF", comLegado, semLiberacao);
    const daSerie = grade.filter((m) => !m.transversal);
    expect(daSerie.at(-1)?.expId).toBe("exp-99-sem-unidade");
  });
});

describe("a transição de estado", () => {
  const agora = new Date("2026-09-05T12:00:00.000Z");

  test("encerrar carimba a data", () => {
    expect(camposDaTransicao("encerrada", agora)).toEqual({
      estado: "encerrada",
      encerradaEm: agora,
    });
  });

  test("reliberar LIMPA a data — senão o painel mente sobre quando a aula fechou", () => {
    expect(camposDaTransicao("liberada", agora)).toEqual({
      estado: "liberada",
      encerradaEm: null,
    });
  });
});
