import { describe, expect, test } from "vitest";
import { areaDoPapel, areaDoPathname, homeDoPapel } from "./papeis";

describe("homeDoPapel", () => {
  test("aluno cai no hub dele, não mais direto na experiência", () => {
    expect(homeDoPapel("aluno")).toBe("/aluno");
  });

  test("os outros papéis vão para a área deles", () => {
    expect(homeDoPapel("professor")).toBe("/professor");
    expect(homeDoPapel("gestor")).toBe("/admin/usuarios");
    expect(homeDoPapel("admin-contrato")).toBe("/admin/usuarios");
  });
});

describe("areaDoPathname", () => {
  test("hub e aparelho do aluno são a MESMA área (senão o middleware faz pingue-pongue)", () => {
    expect(areaDoPathname("/aluno")).toBe(areaDoPapel("aluno"));
    expect(areaDoPathname("/exp/exp-02-unootube")).toBe(areaDoPapel("aluno"));
    expect(areaDoPathname("/dev-embed")).toBe(areaDoPapel("aluno"));
  });

  test("áreas dos outros papéis continuam separadas", () => {
    expect(areaDoPathname("/professor/entre-redes")).toBe(areaDoPapel("professor"));
    expect(areaDoPathname("/admin/usuarios")).toBe(areaDoPapel("gestor"));
    expect(areaDoPathname("/analise")).toBe(areaDoPapel("admin-contrato"));
  });
});
