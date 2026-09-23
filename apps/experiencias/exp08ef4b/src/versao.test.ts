import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { EXP_VERSION } from "./lib/tipos";

/**
 * A versão vive em TRÊS lugares e os três precisam concordar: o manifesto (que
 * o CI lê para montar o caminho imutável no bucket), o `package.json` (que
 * decide a republicação) e o código (que vai no `versao` do erro de cliente e
 * no `service.version` do trace).
 *
 * Sem esta rede, o código fica numa versão que nunca existiu: o erro é agrupado
 * nela e o `scripts/mapear-stack.mjs` procura o sourcemap num caminho vazio.
 * Descoberto em 2026-09-08, junto da ADR-84.
 */
describe("a versão", () => {
  test("bate nos três lugares — manifesto, package.json e código", () => {
    const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8")) as {
      versao: string;
    };
    const pacote = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(manifesto.versao).toBe(EXP_VERSION);
    expect(pacote.version).toBe(EXP_VERSION);
  });

  /**
   * O manifesto declara `produto`, senão a experiência não aparece no painel da
   * Unooria e deixa de poder ser desligada numa rede (regra 8 / ADR-87). O
   * portão oficial é `apps/api/tests/manifestos-declaram-produto.spec.ts`, no
   * CI; este teste existe para a falha aparecer aqui também, porque o modo de
   * falhar é MUDO — tudo funciona e a regra está quebrada.
   */
  test("o manifesto declara o produto e a unidade", () => {
    const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8")) as {
      produto?: string;
      unidade?: number;
      series?: string[];
      permissoes?: string[];
    };
    expect(manifesto.produto).toBe("entre-redes");
    expect(manifesto.unidade).toBe(4);
    expect(manifesto.series).toEqual(["8EF"]);
    /**
     * `permissoes` só aceita o vocabulário FECHADO de
     * `apps/api/src/experiencias/contrato-de-rotas.ts`
     * (`pointer-lock | forms | downloads`). `clipboard-write` NÃO entra: o
     * `allow` do `ExpFrame` já o concede a todas as experiências, e declará-lo
     * aqui derrubaria o `PUT /experiencias/:expId` do deploy com 400 — depois
     * de os bundles já terem subido.
     */
    expect(manifesto.permissoes).toEqual(["forms"]);
  });
});
