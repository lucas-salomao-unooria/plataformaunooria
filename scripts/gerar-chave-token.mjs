#!/usr/bin/env node
/**
 * Gera o par RS256 com que o hub assina os tokens de experiência.
 *
 * Uso:
 *   node scripts/gerar-chave-token.mjs            # imprime a env pronta
 *   node scripts/gerar-chave-token.mjs --env      # grava/atualiza o .env da raiz
 *
 * Em produção a chave vem do Secret Manager (`token-signing-key`, ver
 * docs/INFRA.md) — este script é para desenvolvimento e para o primeiro
 * `docker compose up`, onde o container roda com NODE_ENV=production e a
 * chave é obrigatória.
 *
 * A chave pública NÃO precisa ser guardada: o hub a deriva da privada e a
 * publica em /.well-known/jwks.json.
 */
import { generateKeyPairSync } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

// `\n` escapado: a env precisa caber numa linha só (.env, Cloud Run, compose).
const umaLinha = pem.trimEnd().replace(/\n/g, "\\n");

if (process.argv.includes("--env")) {
  const arquivo = ".env";
  const linha = `TOKEN_SIGNING_KEY_PEM="${umaLinha}"`;
  const atual = existsSync(arquivo) ? readFileSync(arquivo, "utf8") : "";

  if (atual.includes("TOKEN_SIGNING_KEY_PEM=")) {
    writeFileSync(arquivo, atual.replace(/TOKEN_SIGNING_KEY_PEM=.*/g, linha));
    console.log(`✔ TOKEN_SIGNING_KEY_PEM atualizada em ${arquivo}`);
  } else {
    appendFileSync(arquivo, `${atual && !atual.endsWith("\n") ? "\n" : ""}${linha}\n`);
    console.log(`✔ TOKEN_SIGNING_KEY_PEM gravada em ${arquivo}`);
  }
  console.log("  (o docker compose lê este arquivo automaticamente)");
} else {
  console.log(`TOKEN_SIGNING_KEY_PEM="${umaLinha}"`);
}
