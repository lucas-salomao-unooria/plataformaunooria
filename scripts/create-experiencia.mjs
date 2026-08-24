#!/usr/bin/env node
// Uso: pnpm new:exp exp-07-fracoes
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const id = process.argv[2];
if (!id || !/^exp-\d{2}(-[a-z0-9-]+)?$/.test(id)) {
  console.error("Uso: pnpm new:exp exp-NN-slug (ex: exp-07-fracoes)");
  process.exit(1);
}
const src = join("apps", "experiencias", "_template");
const dst = join("apps", "experiencias", id);
cpSync(src, dst, { recursive: true });

for (const f of ["package.json", "experiencia.json", "src/App.tsx"]) {
  const p = join(dst, f);
  writeFileSync(p, readFileSync(p, "utf8").replaceAll("exp-template", id));
}
console.log(`✔ ${id} criada em ${dst}. Rode: pnpm install && pnpm --filter @edu/${id} dev`);
