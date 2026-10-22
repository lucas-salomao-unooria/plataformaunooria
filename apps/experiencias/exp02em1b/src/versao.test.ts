import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { EXP_ID, EXP_VERSION } from "./lib/tipos";

/**
 * A versão vive em TRÊS lugares e os três precisam concordar: o manifesto (que
 * o CI lê para montar o caminho imutável no bucket), o `package.json` (que
 * decide a republicação) e o código (que vai no `versao` do erro de cliente e
 * no `service.version` do trace). Sem esta rede, o código fica numa versão que
 * nunca existiu — descoberto em 2026-09-08, junto da ADR-84.
 */
const manifesto = JSON.parse(readFileSync("public/experiencia.json", "utf8")) as {
  id: string;
  versao: string;
  produto?: string;
  unidade?: number | null;
  series?: string[];
  publico?: string;
  permissoes?: string[];
  capabilities?: string[];
};
const pacote = JSON.parse(readFileSync("package.json", "utf8")) as { name: string; version: string };

/** Espelham `apps/api/src/experiencias/contrato-de-rotas.ts` e `recursos/catalogo.ts`. */
const PRODUTOS = ["entre-redes", "plano-de-aula", "plano-de-ensino", "bem-estar"];
const PERMISSOES = ["pointer-lock", "forms", "downloads"];
const CAPABILITIES = ["telemetria", "progresso", "ia", "avaliacao", "tempo-real"];

describe("a versão e o id", () => {
  test("a versão bate nos três lugares — manifesto, package.json e código", () => {
    expect(manifesto.versao).toBe(EXP_VERSION);
    expect(pacote.version).toBe(EXP_VERSION);
  });

  test("o id do manifesto é o do código e o do pacote", () => {
    expect(manifesto.id).toBe(EXP_ID);
    expect(pacote.name).toBe(`@edu/${EXP_ID}`);
  });
});

/**
 * O manifesto é o contrato com o CI, o hub e a api — e o modo de falhar é MUDO:
 * sem `produto` a experiência funciona e fica invisível para quem liga e
 * desliga a rede (ADR-87); `permissoes` fora do vocabulário derruba o
 * `PUT /experiencias/:expId` do deploy com 400, DEPOIS de os bundles subirem.
 */
describe("o manifesto", () => {
  test("declara um produto do vocabulário", () => {
    expect(PRODUTOS).toContain(manifesto.produto);
  });

  test("declara o público", () => {
    expect(["estudante", "professor"]).toContain(manifesto.publico);
  });

  test("unidade é 1–4, ou ausente só em transversal (`series: []`) e ferramenta de professor", () => {
    if (manifesto.unidade == null) {
      expect(manifesto.series?.length === 0 || manifesto.publico === "professor").toBe(true);
    } else {
      expect([1, 2, 3, 4]).toContain(manifesto.unidade);
    }
  });

  test("permissões e capabilities só do vocabulário fechado", () => {
    for (const p of manifesto.permissoes ?? []) expect(PERMISSOES).toContain(p);
    for (const c of manifesto.capabilities ?? []) expect(CAPABILITIES).toContain(c);
  });
});
