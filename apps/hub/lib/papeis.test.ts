import { describe, expect, test } from "vitest";
import { PAPEIS, areaDoPathname, areasDoPapel, homeDoPapel, podeEntrarNaArea } from "./papeis";

describe("homeDoPapel", () => {
  test("estudante cai no hub dele, não mais direto na experiência", () => {
    expect(homeDoPapel("estudante")).toBe("/estudante");
  });

  test("os outros papéis vão para a área deles", () => {
    expect(homeDoPapel("professor")).toBe("/professor");
    expect(homeDoPapel("gestor_escola")).toBe("/admin/usuarios");
    expect(homeDoPapel("gestor_contrato")).toBe("/admin/usuarios");
  });

  test("o `admin` é a conta da Unooria, e a casa dele é o painel dela (ADR-88)", () => {
    expect(homeDoPapel("admin")).toBe("/unooria/recursos");
  });
});

describe("areaDoPathname", () => {
  test("hub e aparelho do estudante são a MESMA área (senão o middleware faz pingue-pongue)", () => {
    expect(areaDoPathname("/estudante")).toBe(homeDoPapel("estudante"));
    expect(areaDoPathname("/exp/exp04ef1b")).toBe(homeDoPapel("estudante"));
    expect(areaDoPathname("/dev-embed")).toBe(homeDoPapel("estudante"));
  });

  test("áreas dos outros papéis continuam separadas", () => {
    expect(areaDoPathname("/professor/entre-redes")).toBe(homeDoPapel("professor"));
    expect(areaDoPathname("/admin/usuarios")).toBe(homeDoPapel("gestor_escola"));
    expect(areaDoPathname("/analise")).toBe(homeDoPapel("gestor_contrato"));
  });

  test("`/unooria/*` é uma área própria, não um pedaço de `/admin`", () => {
    expect(areaDoPathname("/unooria/recursos")).toBe("/unooria/recursos");
    expect(areaDoPathname("/unooria/recursos/entre-redes")).toBe("/unooria/recursos");
  });
});

/**
 * A ARMADILHA DA ADR-88, e é por ela que este bloco existe.
 *
 * O redirect cross-área do middleware comparava UMA string
 * (`areaDoPathname` contra `areaDoPapel`). Com a área `/unooria`, o `admin`
 * passou a ter DUAS casas — o painel da Unooria e a área administrativa, que
 * ele divide com os gestores. Com uma string só ele é EXPULSO de uma das duas,
 * e o sintoma é "clico em Recursos e caio em Usuários": sem erro, sem log, e
 * invisível no typecheck.
 */
describe("areasDoPapel — o admin mora em DUAS áreas", () => {
  test("o `admin` entra no painel da Unooria E na área administrativa", () => {
    expect(podeEntrarNaArea("admin", "/unooria/recursos")).toBe(true);
    expect(podeEntrarNaArea("admin", "/admin/usuarios")).toBe(true);
    expect(podeEntrarNaArea("admin", "/admin/escolas")).toBe(true);
    expect(podeEntrarNaArea("admin", "/analise")).toBe(true);
  });

  test("e continua FORA das áreas de professor e estudante", () => {
    expect(podeEntrarNaArea("admin", "/professor")).toBe(false);
    expect(podeEntrarNaArea("admin", "/estudante")).toBe(false);
    expect(podeEntrarNaArea("admin", "/exp/app-70-vila-do-lume")).toBe(false);
  });

  test("NINGUÉM MAIS entra em `/unooria` — nem o `gestor_contrato`", () => {
    // É a primeira capacidade que o `admin` tem e o `gestor_contrato` não
    // (ADR-88, revendo a igualdade que a ADR-80 afirma). O portão de verdade é
    // o `@Roles("admin")` da api; este é o do middleware.
    for (const papel of PAPEIS.filter((p) => p !== "admin")) {
      expect(podeEntrarNaArea(papel, "/unooria/recursos")).toBe(false);
    }
  });

  test("todo papel entra na PRÓPRIA casa (senão o middleware faz pingue-pongue infinito)", () => {
    for (const papel of PAPEIS) {
      expect(podeEntrarNaArea(papel, homeDoPapel(papel))).toBe(true);
    }
  });

  test("os papéis que não são `admin` têm exatamente UMA área", () => {
    for (const papel of PAPEIS.filter((p) => p !== "admin")) {
      expect(areasDoPapel(papel)).toHaveLength(1);
    }
    expect(areasDoPapel("admin")).toHaveLength(2);
  });
});
