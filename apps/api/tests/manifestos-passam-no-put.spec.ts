import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { UpsertSchema } from "../src/experiencias/contrato-de-rotas";
import { EXP_ID_RE } from "../src/comum/codigo-da-experiencia";

/**
 * TODO MANIFESTO PASSA NO PUT DO DEPLOY — antes do deploy.
 *
 * Em 2026-09-11 o job `ativar-exps` de dev morreu num 400 `viewport:
 * invalid_type`: o manifesto da exp01ef1b dizia `"viewport": "mobile"` (string)
 * onde o `ViewportSchema` exige `{ largura, altura }`. O 400 veio DEPOIS de os
 * bundles subirem, quebrou o laço com exit 1 e deixou tudo que vinha depois da
 * exp01ef1b na versão anterior. Nenhum teste validava o manifesto contra o Zod da
 * rota — o vizinho `manifestos-declaram-produto.spec.ts` cobre só o `produto`.
 *
 * Este teste fecha a classe: monta, para CADA experiência, o corpo EXATO que
 * `apps/hub/scripts/publicar-manifesto.mjs` envia, e o passa no `UpsertSchema`
 * da rota. Campo novo no manifesto ou no script tem de mudar AQUI também —
 * é o preço de o portão falhar cedo, no CI, e não no meio do deploy.
 */

const PASTA = resolve(__dirname, "../../experiencias");

type Manifesto = {
  id?: string;
  nome?: string;
  versao?: string;
  series?: string[];
  unidade?: number | null;
  produto?: string | null;
  capabilities?: string[];
  viewport?: unknown;
  publico?: string;
  permissoes?: string[];
};

/** O corpo do PUT, campo a campo como o `publicar-manifesto.mjs` o monta. */
function corpoDoPut(manifesto: Manifesto, versao: string) {
  return {
    nome: manifesto.nome,
    versaoAtiva: versao,
    series: manifesto.series ?? [],
    unidade: manifesto.unidade ?? null,
    produto: manifesto.produto ?? null,
    capabilities: manifesto.capabilities ?? [],
    viewport: manifesto.viewport ?? null,
    publico: manifesto.publico ?? "estudante",
    permissoes: manifesto.permissoes ?? [],
  };
}

const pastas = readdirSync(PASTA, { withFileTypes: true })
  .filter((e) => e.isDirectory() && EXP_ID_RE.test(e.name))
  .map((e) => e.name)
  .sort();

/**
 * Experiências cujo MANIFESTO chegou antes do resto da pasta — e só elas.
 *
 * **Esta lista só encolhe.** A exp05ef1b v2.2 entrou pela api (a ficha da
 * evidência e o seed precisam do manifesto para conferir o `expId`) e saiu
 * daqui quando o bundle chegou com o `package.json` 0.2.0. Vazia é o estado
 * normal; o teste abaixo cobra que uma entrada nova SAIA no dia em que o
 * `package.json` chegar — senão a comparação de versão ficaria desligada.
 */
const SEM_PACOTE_AINDA = new Set<string>([]);

test("há experiências para validar (senão a suíte passaria vazia)", () => {
  expect(pastas.length).toBeGreaterThan(0);
});

describe.each(pastas)("%s", (nome) => {
  const manifesto = JSON.parse(
    readFileSync(resolve(PASTA, nome, "public/experiencia.json"), "utf8"),
  ) as Manifesto;
  test("o corpo do PUT passa no UpsertSchema da rota", () => {
    expect(() => UpsertSchema.parse(corpoDoPut(manifesto, manifesto.versao ?? ""))).not.toThrow();
  });

  if (SEM_PACOTE_AINDA.has(nome)) {
    test("ainda sem package.json — e a entrada sai de SEM_PACOTE_AINDA quando ele chegar", () => {
      expect(existsSync(resolve(PASTA, nome, "package.json"))).toBe(false);
    });
    return;
  }

  const pacote = JSON.parse(readFileSync(resolve(PASTA, nome, "package.json"), "utf8")) as {
    version?: string;
  };

  test("package.json e manifesto dizem a MESMA versão (o CI lê o manifesto)", () => {
    expect(pacote.version).toBe(manifesto.versao);
  });
});
