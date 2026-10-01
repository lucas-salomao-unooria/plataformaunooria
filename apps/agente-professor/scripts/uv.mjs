// Roda `uv run --locked <comando>` para o turbo — e trata a FALTA do uv de forma explícita.
//
// Este pacote é Python dentro de um monorepo Node: `pnpm turbo typecheck lint test` da raiz
// o inclui pelos scripts do package.json. Sem `uv` na máquina, o padrão é FALHAR com a
// instrução de instalação: um pacote que some da verificação sem avisar é um verde falso.
// Quem precisa rodar o resto do monorepo sem Python (uma imagem de CI enxuta) declara isso:
//
//   AGENTE_PROFESSOR_PULAR_SEM_UV=1 pnpm turbo typecheck lint test
//
// e o pulo sai num aviso em destaque. A variável entra no hash do turbo
// (`apps/agente-professor/turbo.json`): um "pulado" em cache nunca vale por um "passou".
import { spawnSync } from "node:child_process";

const argumentos = process.argv.slice(2);
const sonda = spawnSync("uv", ["--version"], { stdio: "ignore" });

if (sonda.error || sonda.status !== 0) {
  if (process.env.AGENTE_PROFESSOR_PULAR_SEM_UV === "1") {
    console.warn(
      "\n" + "!".repeat(72) +
      `\n!! @edu/agente-professor: 'uv' ausente — "${argumentos.join(" ")}" foi PULADO` +
      "\n!! (AGENTE_PROFESSOR_PULAR_SEM_UV=1). O agente NÃO foi verificado nesta execução." +
      "\n" + "!".repeat(72) + "\n",
    );
    process.exit(0);
  }
  console.error(
    "@edu/agente-professor precisa do 'uv' (https://docs.astral.sh/uv/) para lint, typecheck e test.\n" +
      "Instale com:  curl -LsSf https://astral.sh/uv/install.sh | sh\n" +
      "Ou, para pular conscientemente: AGENTE_PROFESSOR_PULAR_SEM_UV=1",
  );
  process.exit(1);
}

const execucao = spawnSync("uv", ["run", "--locked", ...argumentos], { stdio: "inherit" });
process.exit(execucao.status ?? 1);
