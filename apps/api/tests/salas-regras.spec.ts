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
): ExperienciaDoCatalogo => ({ expId, nome: expId, series, publico });

const CATALOGO: ExperienciaDoCatalogo[] = [
  exp("exp-01-instanooria", ["8EF"]),
  exp("exp-02-unootube", ["4EF"]),
  exp("exp-03-unoogpt", ["2EM"]),
  exp("exp-07-o-eco-no-grupo", ["7EF"]),
  exp("exp-70-vila-do-lume", []),
  exp("exp-90-plano-de-aula", [], "professor"),
  exp("exp-91-bem-estar", [], "professor"),
];

const semLiberacao = new Map<string, EstadoGravado>();

describe("série e transversal", () => {
  test("`series: []` quer dizer TODAS as séries, não nenhuma", () => {
    const vila = exp("exp-70-vila-do-lume", []);
    expect(serveASerie(vila, "1EF")).toBe(true);
    expect(serveASerie(vila, "3EM")).toBe(true);
    expect(ehTransversal(vila)).toBe(true);
  });

  test("a missão de um ano não serve a outro", () => {
    const insta = exp("exp-01-instanooria", ["8EF"]);
    expect(serveASerie(insta, "8EF")).toBe(true);
    expect(serveASerie(insta, "7EF")).toBe(false);
    expect(ehTransversal(insta)).toBe(false);
  });
});

describe("a grade da turma", () => {
  test("traz a missão da série e as transversais, e nada de outro ano", () => {
    const grade = gradeDaTurma("8EF", CATALOGO, semLiberacao);
    expect(grade.map((m) => m.expId)).toEqual(["exp-70-vila-do-lume", "exp-01-instanooria"]);
  });

  test("a TRANSVERSAL vem primeiro — a Vila é o Ato 1 do Instanooria", () => {
    const grade = gradeDaTurma("8EF", CATALOGO, semLiberacao);
    expect(grade[0]?.expId).toBe("exp-70-vila-do-lume");
    expect(grade[0]?.transversal).toBe(true);
  });

  test("ferramenta de professor NUNCA entra: liberar uma delas seria botão que não abre nada", () => {
    const todas = gradeDaTurma("8EF", CATALOGO, semLiberacao, true);
    expect(todas.map((m) => m.expId)).not.toContain("exp-90-plano-de-aula");
    expect(todas.map((m) => m.expId)).not.toContain("exp-91-bem-estar");
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
      ["exp-01-instanooria", "liberada"],
      ["exp-70-vila-do-lume", "encerrada"],
    ]);
    const grade = gradeDaTurma("8EF", CATALOGO, estados);
    const porId = new Map(grade.map((m) => [m.expId, m.estado]));
    expect(porId.get("exp-01-instanooria")).toBe("liberada");
    // Encerrada continua VISÍVEL: o que a criança fez não evapora da tela.
    expect(porId.get("exp-70-vila-do-lume")).toBe("encerrada");
  });

  test("`todas` acrescenta as de outra série, marcadas e no fim", () => {
    const grade = gradeDaTurma("8EF", CATALOGO, semLiberacao, true);
    const ids = grade.map((m) => m.expId);
    expect(ids).toContain("exp-02-unootube");

    const daSerie = grade.filter((m) => !m.deOutraSerie).map((m) => m.expId);
    expect(daSerie).toEqual(["exp-70-vila-do-lume", "exp-01-instanooria"]);
    // As de fora vêm depois das da turma — são o extra, não a grade do ano.
    expect(grade.findIndex((m) => m.deOutraSerie)).toBe(daSerie.length);
  });

  test("a transversal nunca é `deOutraSerie` — ela é de todas", () => {
    const grade = gradeDaTurma("3EM", CATALOGO, semLiberacao, true);
    const vila = grade.find((m) => m.expId === "exp-70-vila-do-lume");
    expect(vila?.deOutraSerie).toBe(false);
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
