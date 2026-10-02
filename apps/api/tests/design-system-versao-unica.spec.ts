import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * O DESIGN SYSTEM É UM SÓ, NA MESMA VERSÃO, EM TODO O MONOREPO
 * (`docs/regras/design-system.md`, "Uma versão só").
 *
 * Decisão do Lucas em 2026-10-02: o hub, a ponte `packages/ui` e TODAS as
 * experiências declaram o MESMO intervalo de `@unooria/design-system`, e o
 * lockfile resolve UMA versão. Até então cada experiência subia quando alguém
 * lembrava: no mesmo dia havia 0.2.8, 0.2.11 e 0.2.12 convivendo. E a
 * divergência é muda — a ponte `@edu/ui/ds-*` resolve o DS pela versão DELA, e
 * a folha de CSS que a experiência importa pela versão da EXPERIÊNCIA. Com as
 * duas diferentes, o JS de um componente e o CSS dele saem de versões
 * diferentes, e nada quebra no typecheck.
 *
 * Os dois testes fecham as duas portas: um intervalo diferente num
 * `package.json`, e um lockfile com duas versões resolvidas (o `pnpm install`
 * que deixou um importador para trás).
 */

const RAIZ = resolve(__dirname, "../../..");
const PACOTE = "@unooria/design-system";

/** Os `package.json` do workspace: apps, experiências e pacotes. */
function pacotesDoWorkspace(): string[] {
  const pastas = [
    ...listar(join(RAIZ, "apps")),
    ...listar(join(RAIZ, "apps", "experiencias")),
    ...listar(join(RAIZ, "packages")),
  ];
  return pastas.map((p) => join(p, "package.json")).filter((p) => existsSync(p));
}

function listar(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith("."))
    .map((e) => join(pasta, e.name));
}

function intervaloDoDs(caminho: string): string | null {
  const pkg = JSON.parse(readFileSync(caminho, "utf8")) as Record<string, Record<string, string> | undefined>;
  for (const campo of ["dependencies", "devDependencies", "peerDependencies"]) {
    const versao = pkg[campo]?.[PACOTE];
    if (versao) return versao;
  }
  return null;
}

const declarados = pacotesDoWorkspace()
  .map((caminho) => ({ caminho: caminho.slice(RAIZ.length + 1), intervalo: intervaloDoDs(caminho) }))
  .filter((p): p is { caminho: string; intervalo: string } => p.intervalo !== null);

test("há quem dependa do DS (senão os testes abaixo passariam vazios)", () => {
  // o hub, a ponte e as experiências: muito mais que três.
  expect(declarados.length).toBeGreaterThan(3);
  expect(declarados.map((d) => d.caminho)).toEqual(
    expect.arrayContaining(["apps/hub/package.json", "packages/ui/package.json"]),
  );
});

test("todo package.json declara o MESMO intervalo do DS que a ponte", () => {
  const daPonte = declarados.find((d) => d.caminho === "packages/ui/package.json")?.intervalo;
  const divergentes = declarados.filter((d) => d.intervalo !== daPonte);
  expect(divergentes).toEqual([]);
});

test("o lockfile resolve UMA versão do DS", () => {
  const lock = readFileSync(join(RAIZ, "pnpm-lock.yaml"), "utf8");
  const versoes = new Set(
    [...lock.matchAll(/^ {2}'@unooria\/design-system@(\d+\.\d+\.\d+)/gm)].map((m) => m[1]),
  );
  expect([...versoes]).toHaveLength(1);
});
