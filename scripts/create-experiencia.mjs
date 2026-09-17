#!/usr/bin/env node
// Uso: pnpm new:exp exp-12-fracoes
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const id = process.argv[2];
if (!id || !/^exp-\d{2}(-[a-z0-9-]+)?$/.test(id)) {
  console.error("Uso: pnpm new:exp exp-NN-slug (ex: exp-12-fracoes)");
  process.exit(1);
}

// Caminhos ancorados na raiz do repo (não no cwd): funciona de qualquer pasta.
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(raiz, "apps", "experiencias", "_template");
const dst = join(raiz, "apps", "experiencias", id);

if (existsSync(dst)) {
  console.error(`✖ ${dst} já existe — não vou sobrescrever.`);
  process.exit(1);
}

const IGNORAR = new Set(["node_modules", "dist", ".turbo", ".DS_Store"]);
cpSync(src, dst, {
  recursive: true,
  filter: (origem) => !IGNORAR.has(origem.split("/").pop() ?? ""),
});

// Onde o id vive: o pacote, o manifesto, o código (`EXP_ID` — o `versao.test.ts`
// cobra que os três concordem) e o README. `src/App.tsx` não carrega mais o id.
for (const f of ["package.json", "public/experiencia.json", "src/lib/tipos.ts", "README.md"]) {
  const p = join(dst, f);
  writeFileSync(p, readFileSync(p, "utf8").replaceAll("exp-template", id));
}
console.log(`✔ ${id} criada em ${dst}.`);
console.log(`  Próximos passos (a lista completa está em apps/experiencias/_template/AGENTS.md):`);
console.log(`   1. public/experiencia.json — nome, produto, series, unidade, publico, permissoes, verbos`);
console.log(`   2. package.json — a porta do dev (próxima livre em apps/hub/lib/experiencias-dev.ts + CORS_ORIGINS da api)`);
console.log(`   3. src/main.tsx — a seção do clone (<secao>.css + fonts/<secao>.css) e a ponte @edu/ui/ds-<secao>`);
console.log(`   4. pnpm install && pnpm --filter @edu/${id} typecheck lint test && pnpm --filter @edu/${id} dev`);
