import { describe, expect, test } from "vitest";
import { areaDoPapel, areaDoPathname, homeDoPapel } from "./papeis";

describe("homeDoPapel", () => {
  test("estudante cai no hub dele, não mais direto na experiência", () => {
    expect(homeDoPapel("estudante")).toBe("/estudante");
  });

  test("os outros papéis vão para a área deles", () => {
    expect(homeDoPapel("professor")).toBe("/professor");
    expect(homeDoPapel("gestor")).toBe("/admin/usuarios");
    expect(homeDoPapel("admin-contrato")).toBe("/admin/usuarios");
  });
});

describe("areaDoPathname", () => {
  test("hub e aparelho do estudante são a MESMA área (senão o middleware faz pingue-pongue)", () => {
    expect(areaDoPathname("/estudante")).toBe(areaDoPapel("estudante"));
    expect(areaDoPathname("/exp/exp-02-unootube")).toBe(areaDoPapel("estudante"));
    expect(areaDoPathname("/dev-embed")).toBe(areaDoPapel("estudante"));
  });

  test("áreas dos outros papéis continuam separadas", () => {
    expect(areaDoPathname("/professor/entre-redes")).toBe(areaDoPapel("professor"));
    expect(areaDoPathname("/admin/usuarios")).toBe(areaDoPapel("gestor"));
    expect(areaDoPathname("/analise")).toBe(areaDoPapel("admin-contrato"));
  });
});
