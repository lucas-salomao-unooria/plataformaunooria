import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { construirDocumento } from "../src/openapi/documento";

/**
 * Escreve o documento OpenAPI da api num arquivo.
 *
 * Sobe o Nest inteiro sem escutar porta: o esqueleto de caminhos vem do
 * roteador de verdade, então este script é também a prova de que o documento
 * FECHA — `construirDocumento` estoura se `listarRotas` e o roteador
 * discordarem de um caminho sequer.
 *
 *   npx ts-node --transpile-only scripts/gerar-openapi.ts [destino]
 */
const DESTINO_PADRAO = resolve(__dirname, "../../../docs/openapi.json");

process.env.DATABASE_URL ??= "postgresql://postgres:pass@localhost:5432/unooria";
process.env.OIDC_ISSUER ??= "http://localhost:3000";
process.env.OIDC_JWKS_URI ??= "http://localhost:3000/.well-known/jwks.json";
process.env.AI_PROVIDER ??= "mock";

async function main() {
  const destino = process.argv[2] ? resolve(process.argv[2]) : DESTINO_PADRAO;
  const app = await NestFactory.create(AppModule, { logger: false });
  const documento = construirDocumento(app);
  await app.close();

  writeFileSync(destino, JSON.stringify(documento, null, 2) + "\n", "utf8");
  const rotas = Object.values(documento.paths).flatMap((c) => Object.keys(c ?? {}));
  console.info(`${destino}: ${Object.keys(documento.paths).length} caminhos, ${rotas.length} operações`);
}

void main();
