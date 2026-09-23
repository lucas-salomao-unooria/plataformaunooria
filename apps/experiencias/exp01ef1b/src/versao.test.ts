import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { EXP_ID, EXP_VERSION } from "./lib/versao";

/**
 * A versão vive em TRÊS lugares e a divergência já causou bug de deploy
 * (ADR-84): o CI lê o manifesto, o pacote lê o package.json e o handshake
 * manda o EXP_VERSION. Este teste é o que segura os três juntos.
 */
describe("as três fontes da versão", () => {
  const raiz = join(__dirname, "..");
  const manifesto = JSON.parse(
    readFileSync(join(raiz, "public/experiencia.json"), "utf8"),
  ) as { id: string; versao: string };
  const pacote = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8")) as {
    version: string;
  };

  test("experiencia.json, package.json e EXP_VERSION dizem o mesmo número", () => {
    expect(manifesto.versao).toBe(EXP_VERSION);
    expect(pacote.version).toBe(EXP_VERSION);
  });

  test("o id do manifesto é o EXP_ID do handshake (ADR-69: divergir = missão nunca abre)", () => {
    expect(manifesto.id).toBe(EXP_ID);
  });
});
