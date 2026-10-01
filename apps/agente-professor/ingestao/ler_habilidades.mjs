// Lê os três arquivos GERADOS da BNCC da api e imprime JSON no stdout.
//
// Usa o type stripping nativo do Node (>= 22.6; o monorepo exige >= 24): o dado é
// importado como o módulo TypeScript que ele é, e não raspado com regex — se o
// gerador `scripts/extrair-bncc.mjs` mudar a formatação, isto continua lendo.
//
//   node --no-warnings ingestao/ler_habilidades.mjs <pasta apps/api/src/curriculo/dados>
import { pathToFileURL } from "node:url";
import path from "node:path";

const pasta = process.argv[2];
if (!pasta) {
  console.error("uso: ler_habilidades.mjs <pasta dos dados>");
  process.exit(2);
}
const importar = (arquivo) => import(pathToFileURL(path.join(pasta, arquivo)).href);
const ef = (await importar("habilidades-ef.ts")).habilidadesEf;
const em = (await importar("habilidades-em.ts")).habilidadesEm;
const computacao = (await importar("habilidades-computacao.ts")).habilidadesComputacao;
process.stdout.write(JSON.stringify({ ef, em, computacao }));
