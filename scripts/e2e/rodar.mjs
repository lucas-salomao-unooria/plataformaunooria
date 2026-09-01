import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

/**
 * O runner da suíte de ponta a ponta.
 *
 *   node scripts/e2e/rodar.mjs                # tudo, na ordem
 *   node scripts/e2e/rodar.mjs professor      # só um papel
 *   node scripts/e2e/rodar.mjs estudante/02   # uma suíte
 *   node scripts/e2e/rodar.mjs --deck         # roda tudo e gera o deck + vídeos
 *
 * A ORDEM DOS PAPÉIS não é alfabética por acaso, e nem é só estética:
 *
 *   1. `publico` não depende de nada e falha rápido se o hub estiver fora — é o
 *      canário mais barato que existe;
 *   2. `estudante` PRODUZ o estado (runs, sessões, partidas) que...
 *   3. ...`professor` lê. Rodar o professor antes deixaria as telas de
 *      resultado vazias e as asserções de conteúdo sem objeto;
 *   4. `gestor` e `admin-contrato` mexem em gente e escola, e vêm por último
 *      porque importam pessoas e trocam senhas — efeitos que atrapalhariam as
 *      contas usadas pelos roteiros de cima.
 *
 * Cada suíte roda em processo PRÓPRIO. É mais lento que um processo só, e é
 * deliberado: uma suíte que trava o navegador ou vaza memória não leva as
 * outras dezoito junto, e o código de saída de cada uma é independente.
 */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const E2E = join(RAIZ, "scripts", "e2e");

/** A ordem canônica. Ver o bloco acima para o porquê. */
const PAPEIS = ["publico", "estudante", "professor", "gestor", "admin-contrato"];

const argumentos = process.argv.slice(2);
const comDeck = argumentos.includes("--deck");
const filtros = argumentos.filter((a) => !a.startsWith("--"));

function suitesDe(papel) {
  const pasta = join(E2E, papel);
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((arquivo) => arquivo.endsWith(".mjs") && !arquivo.startsWith("."))
    .sort()
    .map((arquivo) => ({ papel, arquivo, caminho: join(pasta, arquivo), slug: `${papel}/${arquivo.replace(/\.mjs$/, "")}` }));
}

const todas = PAPEIS.flatMap(suitesDe);
const escolhidas = filtros.length
  ? todas.filter((s) => filtros.some((f) => s.slug.includes(f) || s.papel === f))
  : todas;

if (escolhidas.length === 0) {
  console.error(`Nenhuma suíte casou com: ${filtros.join(", ")}`);
  console.error(`Disponíveis:\n  ${todas.map((s) => s.slug).join("\n  ")}`);
  process.exit(1);
}

/** Roda uma suíte em processo próprio, com a saída passando ao vivo. */
function rodar(suite) {
  return new Promise((resolvido) => {
    const inicio = Date.now();
    const filho = spawn(process.execPath, [suite.caminho], { cwd: RAIZ, stdio: "inherit" });
    filho.on("close", (codigo) => {
      resolvido({ ...suite, codigo, duracaoMs: Date.now() - inicio });
    });
  });
}

console.log(`\n══ suíte de ponta a ponta · ${escolhidas.length} roteiro(s) ══`);
const resultados = [];
for (const suite of escolhidas) {
  resultados.push(await rodar(suite));
}

// ── o resumo ─────────────────────────────────────────────────────────────
console.log("\n══ resumo ══\n");
let passos = 0;
for (const resultado of resultados) {
  const manifesto = join(RAIZ, "testes", resultado.slug, "passos.json");
  let detalhe = "";
  if (existsSync(manifesto)) {
    const dados = JSON.parse(readFileSync(manifesto, "utf8"));
    passos += dados.passos.length;
    const reprovadas = dados.verificacoes.filter((v) => !v.ok).length;
    detalhe =
      `${String(dados.passos.length).padStart(2)} passos · ` +
      `${dados.verificacoes.filter((v) => v.ok && !v.ressalva).length} verificações` +
      (reprovadas ? ` · ${reprovadas} REPROVADAS` : "");
  }
  const marca = resultado.codigo === 0 ? "✓" : "✗";
  console.log(
    `${marca} ${resultado.slug.padEnd(42)} ${String(Math.round(resultado.duracaoMs / 1000)).padStart(4)}s  ${detalhe}`,
  );
}

const falharam = resultados.filter((r) => r.codigo !== 0);
const minutos = Math.round(resultados.reduce((n, r) => n + r.duracaoMs, 0) / 60_000);
console.log(
  `\n${falharam.length ? "✗" : "✓"} ${resultados.length - falharam.length}/${resultados.length} suítes verdes · ` +
    `${passos} passos fotografados · ${minutos} min`,
);
if (falharam.length) {
  console.log(`\nvermelhas: ${falharam.map((f) => f.slug).join(", ")}`);
  console.log("o relatório de cada uma está em testes/<papel>/<suite>/relatorio.md");
}

// ── o deck e os vídeos ───────────────────────────────────────────────────
/* Só com `--deck`, e só depois de tudo rodar: o deck e os vídeos leem os
   manifestos, e montá-los no meio de uma execução parcial produziria um
   documento que descreve uma corrida que não aconteceu. */
if (comDeck) {
  for (const ferramenta of ["gerar-deck.mjs", "gerar-videos.mjs"]) {
    console.log(`\n── ${ferramenta} ──`);
    await new Promise((pronto) => {
      const filho = spawn(process.execPath, [join(E2E, "ferramentas", ferramenta)], {
        cwd: RAIZ,
        stdio: "inherit",
      });
      filho.on("close", pronto);
    });
  }
}

process.exit(falharam.length ? 1 : 0);
