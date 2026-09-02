#!/usr/bin/env node
/**
 * Traduz a stack MINIFICADA de um erro de cliente para arquivo:linha:coluna
 * do fonte, usando o sourcemap da versão exata — que o CI guardou no bucket
 * PRIVADO `gs://{EXP_MAPAS_BUCKET}/{expId}/{versao}/assets/*.map` (o bundle
 * público não tem o comentário `sourceMappingURL`; ver apps/experiencias/AGENTS.md).
 *
 * Uso:
 *   EXP_MAPAS_BUCKET=entre-redes-dev-exp-mapas GCP_PROJECT=entre-redes-dev \
 *     node scripts/mapear-stack.mjs exp-02-unootube 1.2.3 < stack.txt
 *   ... ou com a stack inline: node scripts/mapear-stack.mjs exp-02-unootube 1.2.3 --stack "TypeError: ... at index-DmVpvDXl.js:1:23456"
 *
 * A stack vem do Logs Explorer (jsonPayload.stack_trace da linha codigo=erro-cliente).
 * Sem dependência: usa `SourceMap` do Node (>= 18) e o gcloud já autenticado.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { SourceMap } from "node:module";

const [expId, versao, ...resto] = process.argv.slice(2);
if (!expId || !versao) {
  console.error("uso: node scripts/mapear-stack.mjs <expId> <versao> [--stack '<stack>']  (ou a stack pelo stdin)");
  process.exit(2);
}
const bucket = process.env.EXP_MAPAS_BUCKET;
if (!bucket) {
  console.error("erro: EXP_MAPAS_BUCKET ausente (terraform output bucket_exp_mapas)");
  process.exit(2);
}
const projeto = process.env.GCP_PROJECT ? ["--project", process.env.GCP_PROJECT] : [];
const stack = resto[0] === "--stack" ? (resto[1] ?? "") : readFileSync(0, "utf8");

const mapas = new Map();
function mapaDe(asset) {
  if (!mapas.has(asset)) {
    const uri = `gs://${bucket}/${expId}/${versao}/${asset}.map`;
    try {
      const json = execFileSync("gcloud", ["storage", "cat", uri, ...projeto], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      mapas.set(asset, new SourceMap(JSON.parse(json)));
    } catch (erro) {
      console.error(`aviso: sem mapa para ${uri} (${erro instanceof Error ? erro.message.split("\n")[0] : erro})`);
      mapas.set(asset, null);
    }
  }
  return mapas.get(asset);
}

// `assets/index-DmVpvDXl.js:1:23456` — com ou sem a URL na frente.
const QUADRO = /((?:assets\/)?[A-Za-z0-9._-]+\.js):(\d+):(\d+)/g;
let traduzidos = 0;
const saida = stack.replace(QUADRO, (trecho, arquivo, linha, coluna) => {
  const asset = arquivo.startsWith("assets/") ? arquivo : `assets/${arquivo}`;
  const mapa = mapaDe(asset);
  if (!mapa) return trecho;
  const e = mapa.findEntry(Number(linha) - 1, Number(coluna) - 1);
  if (!e || !e.originalSource) return trecho;
  traduzidos += 1;
  const fonte = e.originalSource.replace(/^(\.\.\/)+/, "");
  return `${fonte}:${e.originalLine + 1}:${e.originalColumn + 1}${e.name ? ` (${e.name})` : ""}  [${trecho}]`;
});
process.stdout.write(saida.endsWith("\n") ? saida : `${saida}\n`);
console.error(`${traduzidos} quadro(s) traduzido(s) com os mapas de ${expId}@${versao}`);
