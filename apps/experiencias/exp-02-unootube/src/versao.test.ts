import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { EXP_VERSION } from "./lib/tipos";

/**
 * A versão vive em TRÊS lugares e os três precisam concordar: o manifesto (que
 * o CI lê para montar o caminho imutável no bucket), o `package.json` (que
 * decide a republicação) e o código (que vai no `versao` do erro de cliente e
 * no `service.version` do trace).
 *
 * Sem esta rede, o código ficou em "1.0.0" enquanto o bundle publicado já era
 * 1.1.x — e nada quebrava de forma visível: o erro só era agrupado numa versão
 * que nunca existiu, e o `scripts/mapear-stack.mjs` procurava o sourcemap num
 * caminho vazio. Descoberto em 2026-09-08, junto da ADR-84.
 */
describe("a versão", () => {
  test("bate nos três lugares — manifesto, package.json e código", () => {
    const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8")) as { versao: string };
    const pacote = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(manifesto.versao).toBe(EXP_VERSION);
    expect(pacote.version).toBe(EXP_VERSION);
  });
});
