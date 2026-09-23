#!/usr/bin/env node
// Uso: pnpm new:exp exp06ef3b          (missão: 6º ano EF, unidade 3)
//      pnpm new:exp app-93-nome-curto   (o que não é missão)
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// O MESMO formato de apps/api/src/comum/codigo-da-experiencia.ts (ADR-110).
// Uma cópia a mais, e não um import, porque isto é Node puro; se ela divergir,
// o `codigo-da-experiencia.spec.ts` reprova a pasta que este script criar.
const MISSAO = /^exp0([1-9])(ef|em)([1-4])b$/;
const APP = /^app-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

const id = process.argv[2];
const missao = MISSAO.exec(id ?? "");
if (!id || (!missao && !APP.test(id)) || (missao?.[2] === "em" && Number(missao[1]) > 3)) {
  console.error(
    "Uso: pnpm new:exp expNNefUb | expNNemUb | app-NN-nome\n" +
      "  missão da trilha: exp + ano (01-09 EF, 01-03 EM) + etapa + unidade (1-4) + b — ex.: exp06ef3b\n" +
      "  o que não é missão (produto, transversal): app-NN-nome — ex.: app-93-diario-de-bordo",
  );
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

// A série e a unidade SAEM do código — o manifesto não pode discordar dele.
const caminhoDoManifesto = join(dst, "public/experiencia.json");
const manifesto = JSON.parse(readFileSync(caminhoDoManifesto, "utf8"));
if (missao) {
  manifesto.series = [`${missao[1]}${missao[2].toUpperCase()}`];
  manifesto.unidade = Number(missao[3]);
} else {
  manifesto.series = [];
  delete manifesto.unidade;
}
writeFileSync(caminhoDoManifesto, `${JSON.stringify(manifesto, null, 2)}\n`);
console.log(`✔ ${id} criada em ${dst}.`);
console.log(`  Próximos passos (a lista completa está em apps/experiencias/_template/AGENTS.md):`);
console.log(`   1. public/experiencia.json — nome, produto, publico, permissoes, verbos (series e unidade já saíram do código)`);
console.log(`   2. package.json — a porta do dev (próxima livre em apps/hub/lib/experiencias-dev.ts + CORS_ORIGINS da api)`);
console.log(`   3. src/main.tsx — a seção do clone (<secao>.css + fonts/<secao>.css) e a ponte @edu/ui/ds-<secao>`);
console.log(`   4. pnpm install && pnpm --filter @edu/${id} typecheck lint test && pnpm --filter @edu/${id} dev`);
