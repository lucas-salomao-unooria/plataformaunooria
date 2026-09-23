import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  CODIGO_DE_APP_RE,
  CODIGO_DE_MISSAO_RE,
  EXP_ID_RE,
  FORMATO_DO_EXP_ID,
  codigoDaMissao,
} from "../src/comum/codigo-da-experiencia";

/**
 * O CÓDIGO DA EXPERIÊNCIA É DERIVADO, NÃO ESCOLHIDO (ADR-110).
 *
 * A missão da trilha se chama pelo lugar dela na grade: `exp08ef1b` é o 8º ano
 * do Fundamental, unidade 1. O formato anterior (`exp-NN-slug`) tinha um número
 * que PARECIA a série e era a ordem de criação — a `exp-01` era do 8º ano, a
 * `exp-04` do 1º —, e nada cobrava coerência entre o id e o manifesto. Este
 * arquivo cobra: o `id` de toda missão É `codigoDaMissao(series[0], unidade)`,
 * e a pasta tem o nome do `id`.
 *
 * E amarra as duas cópias do formato (api e SDK), como
 * `fuso-da-plataforma.spec.ts` faz com o fuso.
 */

const PASTA = resolve(__dirname, "../../experiencias");
const NO_SDK = join(__dirname, "../../../packages/sdk/src/codigo-da-experiencia.ts");

type Manifesto = { id: string; series?: string[]; unidade?: number };

/** TODAS as pastas, não só as que já passam no formato: a errada tem de reprovar, não sumir. */
const pastas = readdirSync(PASTA, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "_template")
  .map((e) => e.name)
  .sort();

describe("o formato", () => {
  it("aceita missão e app, e recusa o formato antigo", () => {
    for (const ok of ["exp01ef1b", "exp09ef4b", "exp03em4b", "app-70-vila-do-lume", "app-90-plano-de-aula"]) {
      expect(EXP_ID_RE.test(ok)).toBe(true);
    }
    for (const nao of [
      "exp-01-instanooria",
      "exp10ef1b",
      "exp04em1b",
      "exp08ef5b",
      "exp08ef1",
      "Exp08ef1b",
      "app-70",
      "app-7-vila",
      "app-70-Vila",
      "hub",
    ]) {
      expect(EXP_ID_RE.test(nao)).toBe(false);
    }
  });

  it("EXP_ID_RE é exatamente a união dos dois formatos", () => {
    const uniao = `^(${CODIGO_DE_MISSAO_RE.source.slice(1, -1)}|${CODIGO_DE_APP_RE.source.slice(1, -1)})$`;
    expect(EXP_ID_RE.source).toBe(uniao);
  });

  it("codigoDaMissao monta pela série e pela unidade", () => {
    expect(codigoDaMissao("8EF", 1)).toBe("exp08ef1b");
    expect(codigoDaMissao("1EF", 1)).toBe("exp01ef1b");
    expect(codigoDaMissao("2EM", 1)).toBe("exp02em1b");
    expect(codigoDaMissao("8EF", 4)).toBe("exp08ef4b");
  });

  it("codigoDaMissao recusa o que está fora da grade, em vez de inventar código", () => {
    expect(() => codigoDaMissao("4EM", 1)).toThrow();
    expect(() => codigoDaMissao("10EF", 1)).toThrow();
    expect(() => codigoDaMissao("8EF", 0)).toThrow();
    expect(() => codigoDaMissao("8EF", 5)).toThrow();
    expect(() => codigoDaMissao("8ef", 1)).toThrow();
  });
});

describe("as duas cópias são amarradas, não confiadas", () => {
  const fonte = readFileSync(NO_SDK, "utf8");
  const literal = (nome: string) => new RegExp(`export const ${nome} = /(.+)/;`).exec(fonte)?.[1];

  it.each([
    ["CODIGO_DE_MISSAO_RE", CODIGO_DE_MISSAO_RE],
    ["CODIGO_DE_APP_RE", CODIGO_DE_APP_RE],
    ["EXP_ID_RE", EXP_ID_RE],
  ])("%s é o mesmo no SDK e na api", (nome, re) => {
    expect(literal(nome)).toBe(re.source);
  });

  it("a mensagem de erro é a mesma", () => {
    expect(fonte).toContain(`export const FORMATO_DO_EXP_ID = "${FORMATO_DO_EXP_ID}";`);
  });
});

describe("todo manifesto tem o código certo", () => {
  test("há experiências para validar (senão a suíte passaria vazia)", () => {
    expect(pastas.length).toBeGreaterThan(0);
  });

  describe.each(pastas)("%s", (pasta) => {
    const manifesto = JSON.parse(
      readFileSync(join(PASTA, pasta, "public/experiencia.json"), "utf8"),
    ) as Manifesto;

    test("a pasta tem o nome do id", () => {
      expect(manifesto.id).toBe(pasta);
    });

    test("o id está num dos dois formatos", () => {
      expect(manifesto.id).toMatch(EXP_ID_RE);
    });

    if (manifesto.unidade !== undefined) {
      test("missão: UMA série, e o id é derivado dela e da unidade", () => {
        expect(manifesto.series).toHaveLength(1);
        expect(manifesto.id).toBe(codigoDaMissao(manifesto.series?.[0] ?? "", manifesto.unidade ?? 0));
      });
    } else {
      test("sem unidade não é missão: o id é app-NN-nome", () => {
        expect(manifesto.id).toMatch(CODIGO_DE_APP_RE);
      });
    }
  });
});
