import { normalizarRota } from "../src/observabilidade/normalizar-rota";

/** A rota é rótulo de métrica: conjunto fechado, senão uma série por criança. */
describe("normalizarRota", () => {
  it("hub: reduz a uma dúzia de valores", () => {
    expect(normalizarRota("/", "hub")).toBe("/");
    expect(normalizarRota("/login?next=%2Fprofessor", "hub")).toBe("/login");
    expect(normalizarRota("/estudante", "hub")).toBe("/estudante");
    expect(normalizarRota("/estudante/missoes/3", "hub")).toBe("/estudante");
    expect(normalizarRota("/professor", "hub")).toBe("/professor");
    expect(normalizarRota("/professor/turmas/9f3a-uuid", "hub")).toBe("/professor/:secao");
    expect(normalizarRota("/professor/entre-redes/vila-do-lume/estudantes/abc", "hub")).toBe("/professor/:secao");
    expect(normalizarRota("/admin/usuarios", "hub")).toBe("/admin/:secao");
    expect(normalizarRota("/analise/atividades/x", "hub")).toBe("/analise");
    expect(normalizarRota("/exp/exp-02-unootube", "hub")).toBe("/exp/:expId");
    expect(normalizarRota("/trocar-senha/", "hub")).toBe("/trocar-senha");
  });

  it("hub: o desconhecido é `outra`", () => {
    expect(normalizarRota("/qualquer/coisa", "hub")).toBe("outra");
    expect(normalizarRota("/estudantes/12345678909", "hub")).toBe("outra");
    expect(normalizarRota("", "hub")).toBe("outra");
  });

  it("exp: só o padrão de expId passa", () => {
    expect(normalizarRota("exp-02-unootube", "exp")).toBe("exp-02-unootube");
    expect(normalizarRota("exp-70-vila-do-lume?x=1", "exp")).toBe("exp-70-vila-do-lume");
    expect(normalizarRota("/exp/exp-02-unootube", "exp")).toBe("outra");
    expect(normalizarRota("Exp-02", "exp")).toBe("outra");
  });
});
