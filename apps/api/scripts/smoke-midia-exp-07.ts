/**
 * Smoke da mídia da exp-07 — o caminho inteiro, de verdade, contra o Vertex.
 *
 * Existe porque nada em `pnpm test` toca a rede: a suíte roda com o
 * `MockProvider`, que falha fechado em voz e imagem de propósito. Isso prova
 * que a missão fecha SEM modelo nenhum, mas não prova que a síntese funciona —
 * e as duas coisas precisam ser verdade.
 *
 *   VERTEX_PROJECT_ID=<projeto> npx ts-node --transpile-only \
 *     scripts/smoke-midia-exp-07.ts [id-da-midia]
 *
 * Sem argumento, prepara TUDO (3 vozes + 1 foto + 1 recorte). Com um id, só
 * aquele item — é o que se usa para conferir uma voz depois de mexer na direção
 * de atuação, sem pagar o podcast inteiro de novo.
 *
 * Grava em `ASSETS_LOCAL_DIR` (default `storage/`), como o driver local faz em
 * dev: os arquivos saem em `storage/experiencias/exp-07-o-eco-no-grupo/`, e dá
 * para ouvir e ver antes de qualquer aula.
 */
import { ConfigService } from "@nestjs/config";
import { QuotaService } from "../src/ai/quota.service";
import { VertexProvider } from "../src/ai/vertex.provider";
import { AssetsService } from "../src/assets/assets.service";
import { MIDIA } from "../src/o-eco-no-grupo/midia";
import { MidiaDaExp07Service } from "../src/o-eco-no-grupo/midia.service";
import { PrismaService } from "../src/prisma/prisma.service";

const ESCOLA = process.env.SMOKE_ESCOLA ?? "smoke-exp-07";
const USUARIO = process.env.SMOKE_USUARIO ?? "00000000-0000-4000-8000-000000000007";

async function main() {
  const alvo = process.argv[2];
  if (alvo && !MIDIA[alvo]) {
    throw new Error(`id desconhecido: ${alvo}. Conhecidos: ${Object.keys(MIDIA).join(", ")}`);
  }

  const config = new ConfigService({
    ASSETS_DRIVER: process.env.ASSETS_DRIVER ?? "local",
    ASSETS_LOCAL_DIR: process.env.ASSETS_LOCAL_DIR,
    ASSETS_PUBLIC_URL: process.env.ASSETS_PUBLIC_URL,
    ASSETS_BUCKET: process.env.ASSETS_BUCKET,
    AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR: 2_000_000,
  });
  // O `QuotaService` grava em `ia_uso_diario`, então o banco de dev precisa
  // estar de pé — o smoke exercita o caminho REAL, quota inclusive.
  const prisma = new PrismaService();
  const assets = new AssetsService(config);
  const servico = new MidiaDaExp07Service(
    new VertexProvider(),
    assets,
    new QuotaService(prisma, config),
  );

  const inicio = Date.now();
  const r = await servico.preparar(ESCOLA, USUARIO, "professor");
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

  console.info(`\nPreparo em ${segundos}s`);
  console.info(`  geradas:  ${r.geradas.join(", ") || "(nada — já estava tudo publicado)"}`);
  console.info(`  falharam: ${r.falharam.join(", ") || "(nenhuma)"}`);
  console.info("\nURLs:");
  for (const [id, url] of Object.entries(r.urls)) console.info(`  ${id.padEnd(24)} ${url ?? "—"}`);
  await prisma.$disconnect();
  process.exit(r.falharam.length > 0 ? 1 : 0);
}

main().catch((erro) => {
  console.error("FALHOU:", erro instanceof Error ? erro.message : erro);
  const detalhe = (erro as { detalhe?: string }).detalhe;
  if (detalhe) console.error("detalhe:", detalhe);
  process.exit(1);
});
