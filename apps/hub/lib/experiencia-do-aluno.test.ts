import { describe, expect, test } from "vitest";
import { EXP_PADRAO, expIdDoAluno } from "./experiencia-do-aluno";
import { homeDoPapel } from "./papeis";

describe("expIdDoAluno", () => {
  test("4º ano cai no UnooTube; o resto na experiência padrão", () => {
    expect(expIdDoAluno("4EF")).toBe("exp-02-unootube");
    expect(expIdDoAluno("4º ano")).toBe("exp-02-unootube");
    expect(expIdDoAluno("8EF")).toBe(EXP_PADRAO);
    expect(expIdDoAluno("1EM")).toBe(EXP_PADRAO);
  });

  test("sem série (aluno sem turma) cai na padrão", () => {
    expect(expIdDoAluno(undefined)).toBe(EXP_PADRAO);
    expect(expIdDoAluno(null)).toBe(EXP_PADRAO);
    expect(expIdDoAluno("")).toBe(EXP_PADRAO);
  });
});

describe("homeDoPapel", () => {
  test("aluno vai para a experiência da série", () => {
    expect(homeDoPapel("aluno", "4EF")).toBe("/exp/exp-02-unootube");
    expect(homeDoPapel("aluno", "8EF")).toBe("/exp/exp-01-instanooria");
    expect(homeDoPapel("aluno")).toBe("/exp/exp-01-instanooria");
  });

  test("outros papéis ignoram a série", () => {
    expect(homeDoPapel("professor", "4EF")).toBe("/professor");
    expect(homeDoPapel("gestor")).toBe("/admin/usuarios");
    expect(homeDoPapel("admin-contrato")).toBe("/admin/usuarios");
  });
});
