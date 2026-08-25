#!/usr/bin/env node
/**
 * Importa as REFERÊNCIAS CURRICULARES do gerador de plano de aula (exp-90):
 * currículo da rede e material didático, por disciplina e série.
 *
 * Lê uma pasta no formato do app origem (`docs-referencia/`):
 *
 *   <pasta>/<disciplina>/arquivo.pdf          ← geral (vale para todas as séries)
 *   <pasta>/<disciplina>/<ano-slug>/arquivo   ← específico da série
 *
 * extrai o TEXTO de cada PDF/DOCX/TXT aqui (pdf-parse/mammoth ficam no dev da
 * raiz, a api não precisa deles) e manda um `POST /planos/referencias` por
 * documento, autenticado por `x-import-token` (PLANOS_IMPORT_TOKEN da api).
 * Idempotente: a api faz upsert por (disciplina, serie, nome).
 *
 * Uso:
 *   API_URL=http://localhost:3001 PLANOS_IMPORT_TOKEN=... \
 *     node scripts/importar-referencias-plano.mjs ~/Documents/planodeaula/docs-referencia
 *
 * Os PDFs/DOCXs originais (100+ MB) NÃO entram neste repo.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const pasta = process.argv[2];
const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const TOKEN = process.env.PLANOS_IMPORT_TOKEN;
if (!pasta || !TOKEN) {
  console.error("Uso: API_URL=... PLANOS_IMPORT_TOKEN=... node scripts/importar-referencias-plano.mjs <pasta>");
  process.exit(1);
}

/** Slugs de pasta do app origem (`lib/curriculo.ts`) → série canônica da plataforma. */
const SLUG_PARA_SERIE = {
  "1-ano": "1EF", "2-ano": "2EF", "3-ano": "3EF", "4-ano": "4EF", "5-ano": "5EF",
  "6-ano": "6EF", "7-ano": "7EF", "8-ano": "8EF", "9-ano": "9EF",
  "1-serie-em": "1EM", "2-serie-em": "2EM", "3-serie-em": "3EM",
};
const SERIE_RE = /^[1-9]EF$|^[1-3]EM$/;
const MAX_CHARS = 1_500_000; // teto do body da api (2 MB) com folga
const EXTENSOES = new Set([".pdf", ".docx", ".txt", ".md"]);

async function extrairTexto(caminho) {
  const ext = extname(caminho).toLowerCase();
  const buffer = await readFile(caminho);
  if (ext === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();
    return text;
  }
  if (ext === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  return buffer.toString("utf8");
}

async function arquivosDe(dir) {
  const entradas = await readdir(dir, { withFileTypes: true });
  return entradas
    .filter((e) => e.isFile() && !e.name.startsWith(".") && EXTENSOES.has(extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function enviar(referencia) {
  const r = await fetch(`${API_URL}/planos/referencias`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-import-token": TOKEN },
    body: JSON.stringify(referencia),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(corpo).slice(0, 300)}`);
  return corpo;
}

async function importarArquivo({ disciplina, serie, dir, nome, ordem }) {
  const caminho = join(dir, nome);
  const { size } = await stat(caminho);
  let texto = (await extrairTexto(caminho)).replace(/\r\n/g, "\n").trim();
  if (!texto) {
    console.warn(`  ⚠ ${nome}: sem texto extraível — pulado`);
    return;
  }
  if (texto.length > MAX_CHARS) {
    console.warn(`  ⚠ ${nome}: ${texto.length} chars, cortado em ${MAX_CHARS}`);
    texto = texto.slice(0, MAX_CHARS);
  }
  const resposta = await enviar({ disciplina, serie, nome: basename(nome, extname(nome)), texto, ordem });
  console.log(
    `  ✔ ${serie ?? "geral"} · ${nome} (${(size / 1_048_576).toFixed(1)} MB → ${texto.length} chars, ${resposta.atualizada ? "atualizada" : "nova"})`,
  );
}

let total = 0;
for (const disciplina of (await readdir(pasta, { withFileTypes: true })).filter((e) => e.isDirectory())) {
  const dirDisciplina = join(pasta, disciplina.name);
  console.log(`\n${disciplina.name}`);

  let ordem = 0;
  for (const nome of await arquivosDe(dirDisciplina)) {
    await importarArquivo({ disciplina: disciplina.name, serie: null, dir: dirDisciplina, nome, ordem: ordem++ });
    total += 1;
  }

  for (const sub of (await readdir(dirDisciplina, { withFileTypes: true })).filter((e) => e.isDirectory())) {
    const serie = SLUG_PARA_SERIE[sub.name] ?? (SERIE_RE.test(sub.name) ? sub.name : null);
    if (!serie) {
      console.warn(`  ⚠ pasta ${sub.name} não é uma série conhecida — pulada`);
      continue;
    }
    let ordemSerie = 0;
    for (const nome of await arquivosDe(join(dirDisciplina, sub.name))) {
      await importarArquivo({ disciplina: disciplina.name, serie, dir: join(dirDisciplina, sub.name), nome, ordem: ordemSerie++ });
      total += 1;
    }
  }
}
console.log(`\n${total} referência(s) importada(s) em ${API_URL}.`);
