#!/usr/bin/env node
/**
 * Uma frente paralela pronta para trabalhar: worktree sobre `origin/dev`,
 * dependências instaladas, `.env` copiados, porta de Vite reservada e o
 * briefing da fatia impresso no fim.
 *
 * Uso:
 *   pnpm worktree criar <tipo/slug | exp-NN-slug> [--fatia api/<mod>,hub/<rota>,exp/<id>]
 *   pnpm worktree listar
 *   pnpm worktree remover <slug>
 *
 * Existe porque a receita à mão (CONTRIBUTING.md) tem quatro passos e o
 * primeiro é o que morde: `git worktree add` sem `origin/dev` ESCRITO abre a
 * branch sobre produção em silêncio — compila, passa nos testes, e o PR chega
 * com um diff cheio de commit que já estava em `dev` (ADR-61, ADR-71).
 */
import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Caminhos ancorados na raiz do repo (não no cwd): funciona de qualquer pasta.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKTREES = join(RAIZ, ".claude", "worktrees");

/** Espelha `.githooks/pre-push`: um nome que o hook recusaria não vira worktree. */
const TIPOS = "feat|fix|chore|docs|ci|refactor|test|perf|build|style|hotfix";
const NOME_DE_BRANCH = new RegExp(`^(exp-\\d{2}-[a-z0-9-]+|(${TIPOS})/[a-z0-9][a-z0-9._-]*)$`);

/**
 * Faixa das frentes. 5173–5179 são da cópia principal (`experiencias-dev.ts`),
 * e `strictPort` faz a colisão falhar alto em vez de o Vite pular de porta —
 * o worktree fica na casa dos 52xx, que é o que `/dev-embed?src=` espera.
 */
const PORTA_INICIAL = 5201;
const PORTA_FINAL = 5299;

/** Os `.env` são todos ignorados pelo git: nenhum viaja com o worktree. */
const ENVS = [
  ".env",
  "apps/api/.env",
  "apps/api/.env.local",
  "apps/hub/.env",
  "apps/hub/.env.local",
  "apps/hub/.env.development.local",
];

const ESC = "\u001b";
const cor = (c, s) => (process.stdout.isTTY ? `${ESC}[${c}m${s}${ESC}[0m` : s);
const ok = (s) => console.log(`${cor(32, "✔")} ${s}`);
const passo = (s) => console.log(`${cor(36, "→")} ${s}`);
const morre = (s) => {
  console.error(`${cor(31, "✖")} ${s}`);
  process.exit(1);
};

const git = (args, opcoes = {}) =>
  execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", ...opcoes })?.trim() ?? "";

/**
 * A porta sai de um hash do slug, não da ordem da listagem: criar uma frente
 * nova não pode mudar a porta de uma frente que já está no ar — o `src=` do
 * `/dev-embed` fica na barra do navegador de quem está trabalhando.
 */
function portaDoSlug(slug, ocupadas) {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const faixa = PORTA_FINAL - PORTA_INICIAL + 1;
  for (let i = 0; i < faixa; i++) {
    const porta = PORTA_INICIAL + ((h + i) % faixa);
    if (!ocupadas.has(porta)) return porta;
  }
  return null;
}

function slugsExistentes() {
  if (!existsSync(WORKTREES)) return [];
  return readdirSync(WORKTREES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/** Map<slug, porta> das frentes que existem, mais `extra` se vier. */
function portasDasFrentes(extra) {
  const slugs = slugsExistentes();
  if (extra && !slugs.includes(extra)) slugs.push(extra);
  const ocupadas = new Set();
  const mapa = new Map();
  for (const slug of slugs.sort()) {
    const porta = portaDoSlug(slug, ocupadas);
    if (porta === null) continue;
    ocupadas.add(porta);
    mapa.set(slug, porta);
  }
  return mapa;
}

/**
 * `api/unootube` vira `apps/api/src/unootube`, e assim por diante. O caminho
 * que não existe não reprova — a frente pode estar criando o módulo — mas é
 * DITO, porque o erro de digitação silencioso vira uma fatia que não protege
 * nada: o hook compara com o que está escrito aqui.
 */
function resolverAlvo(alvo) {
  const t = alvo.trim();
  if (/^(apps|packages|scripts|docs)\//.test(t)) return [t];
  const [tipo, ...resto] = t.split("/");
  const nome = resto.join("/");
  if (!nome) return [];
  if (tipo === "api") return [`apps/api/src/${nome}`];
  if (tipo === "exp") return [`apps/experiencias/${nome}`];
  if (tipo === "hub") {
    // O App Router tem grupos de rota — `(plataforma)/professor`, não `professor`.
    const achados = rotasDoHub(join(RAIZ, "apps", "hub", "app"), "apps/hub/app", nome);
    return achados.length > 0 ? achados : [`apps/hub/app/${nome}`];
  }
  return [t];
}

function rotasDoHub(absoluto, relativo, nome, profundidade = 0) {
  if (profundidade > 4 || !existsSync(absoluto)) return [];
  const achados = [];
  for (const d of readdirSync(absoluto, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === "node_modules") continue;
    const rel = `${relativo}/${d.name}`;
    if (d.name === nome) achados.push(rel);
    else achados.push(...rotasDoHub(join(absoluto, d.name), rel, nome, profundidade + 1));
  }
  return achados;
}

function resolverFatia(fatia) {
  const alvos = (fatia ?? "")
    .split(",")
    .filter(Boolean)
    .flatMap(resolverAlvo);
  for (const alvo of alvos) {
    if (!existsSync(join(RAIZ, alvo))) {
      console.log(`${cor(33, "!")} ${alvo} ainda não existe — nasce nesta frente?`);
    }
  }
  return [...new Set(alvos)];
}

function criar(branch, fatia) {
  if (!branch) morre("falta o nome da branch. Uso: pnpm worktree criar fix/quota-por-perfil");
  if (!NOME_DE_BRANCH.test(branch)) {
    morre(
      `nome de branch fora do padrão: '${branch}'\n` +
        `    Experiência nova:  exp-NN-slug     (ex.: exp-12-fracoes)\n` +
        `    Qualquer outra:    tipo/slug       (ex.: fix/quota-por-perfil)\n` +
        `    Tipos: ${TIPOS.replaceAll("|", ", ")}\n` +
        `  É o padrão do .githooks/pre-push: criar aqui o que ele recusaria só` +
        ` adia a recusa para a hora do push.`,
    );
  }

  const slug = branch.includes("/") ? branch.split("/")[1] : branch;
  const destino = join(WORKTREES, slug);
  if (existsSync(destino)) morre(`${destino} já existe — não vou sobrescrever.`);

  // Resolvida ANTES do install: um --fatia errado falha em segundos, não depois
  // de dois minutos de `pnpm install`.
  const alvos = resolverFatia(fatia);

  passo("git fetch origin");
  git(["fetch", "origin", "--quiet"]);
  // Conserta a raiz de uma vez: clone antigo tem origin/HEAD em main (ADR-61).
  try {
    git(["remote", "set-head", "origin", "--auto"], { stdio: "ignore" });
  } catch {
    /* sem rede, ou remote sem HEAD: o `origin/dev` explícito abaixo já basta */
  }

  // A branch que já existe vence a convenção: reaproveita em vez de recusar —
  // e uma branch existente NÃO é movida para cima de `dev` por conta própria.
  const jaExisteLocal = git(["branch", "--list", branch]) !== "";
  const jaExisteRemota = git(["ls-remote", "--heads", "origin", branch]) !== "";
  mkdirSync(WORKTREES, { recursive: true });

  if (jaExisteLocal) {
    passo(`branch '${branch}' já existe local — reaproveitando`);
    git(["worktree", "add", destino, branch], { stdio: "inherit" });
  } else if (jaExisteRemota) {
    passo(`branch '${branch}' já existe em origin — rastreando`);
    git(["worktree", "add", "--track", "-b", branch, destino, `origin/${branch}`], {
      stdio: "inherit",
    });
  } else {
    // `origin/dev` está ESCRITO de propósito. Ver o cabeçalho deste arquivo.
    passo(`git worktree add -b ${branch} … origin/dev`);
    git(["worktree", "add", "-b", branch, destino, "origin/dev"], { stdio: "inherit" });
  }

  // A fatia mora no git-dir DA FRENTE (.git/worktrees/<slug>/): privado dela,
  // fora do versionamento, e é onde o .githooks/pre-commit vai procurar.
  if (alvos.length > 0) {
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
      cwd: destino,
      encoding: "utf8",
    }).trim();
    writeFileSync(join(gitDir, "fatia"), `${alvos.join("\n")}\n`);
    ok(`fatia gravada — o pre-commit recusa commit fora dela (escape: PERMITIR_FORA_DA_FATIA=1)`);
  } else {
    console.log(
      `${cor(33, "!")} sem --fatia: o pre-commit não tem o que conferir nesta frente.`,
    );
  }

  passo("copiando os .env (ignorados pelo git, não viajam com o worktree)");
  let copiados = 0;
  for (const env of ENVS) {
    const de = join(RAIZ, env);
    if (!existsSync(de)) continue;
    mkdirSync(dirname(join(destino, env)), { recursive: true });
    copyFileSync(de, join(destino, env));
    copiados++;
  }
  ok(`${copiados} arquivo(s) de ambiente copiado(s)`);

  if (process.argv.includes("--sem-instalar")) {
    passo("--sem-instalar: pulando pnpm install e prisma generate");
  } else {
    // node_modules e o client do Prisma são POR worktree — não compartilhados.
    passo("pnpm install (node_modules não é compartilhado)");
    execSync("pnpm install", { cwd: destino, stdio: "inherit" });
    passo("prisma generate (o client também é por worktree)");
    execSync("pnpm --filter @edu/api exec prisma generate", { cwd: destino, stdio: "inherit" });
  }

  const porta = portasDasFrentes(slug).get(slug);
  if (!porta) morre(`nenhuma porta livre entre ${PORTA_INICIAL} e ${PORTA_FINAL}.`);

  console.log(`\n${cor(1, `Frente '${slug}' pronta.`)} ${destino}\n`);
  briefing({ slug, branch, destino, porta, alvos });
}

function briefing({ slug, branch, destino, porta, alvos }) {
  const declarada =
    alvos.length > 0
      ? alvos.map((a) => `  ${a}`).join("\n")
      : "  (declare com --fatia api/<modulo>,hub/<rota>,exp/<exp-id>)";
  const regua = cor(2, "─".repeat(72));

  console.log(`${cor(1, "Briefing")} — cole no agente que vai tocar esta frente:
${regua}
Trabalhe em ${destino} (branch ${branch}, a partir de origin/dev).

Sua fatia, e só ela:
${declarada}

NÃO edite outro módulo de apps/api/src nem outra rota de apps/hub/app. A fatia
é vertical: o módulo da api, a rota do hub e a experiência andam juntos.

Costura permitida, em UM commit separado no fim, depois de
\`git fetch origin && git merge origin/dev\`:
  - 1 import + 1 linha no array de apps/api/src/app.module.ts
  - models novos NO FIM de apps/api/prisma/schema.prisma (nunca no meio)
  - a sua migração em apps/api/prisma/migrations/
  - a sua entrada em apps/hub/middleware.ts / apps/hub/lib/experiencias-dev.ts
Reserve o número da ADR conferindo origin/dev, não a sua cópia.

O runtime é singleton. AQUI você roda:
  pnpm turbo typecheck lint test          (unitários e de contrato)
  pnpm turbo build --filter=<pacote>
  pnpm --filter @edu/<exp> dev -- --port ${porta}
      e embeda pelo hub que já está no ar:
      http://localhost:3000/dev-embed?src=http://localhost:${porta}

AQUI você NÃO roda — é da cópia principal, uma frente por vez:
  pnpm dev / pnpm docker:dev   (docker:dev daqui RECRIA os containers da principal)
  migração de banco (prisma migrate deploy / migrate reset)
  a suíte e2e (node scripts/e2e/rodar.mjs …)
${regua}

Terminou a frente:
  git log --oneline origin/dev..HEAD     ${cor(2, "# só os seus commits")}
  gh pr create --base dev
  pnpm worktree remover ${slug}`);
}

function listar() {
  const bruto = git(["worktree", "list", "--porcelain"]);
  const portas = portasDasFrentes();
  const frentes = [];
  let atual = {};
  for (const linha of `${bruto}\n\n`.split("\n")) {
    if (linha.startsWith("worktree ")) atual = { caminho: linha.slice(9) };
    else if (linha.startsWith("branch ")) atual.branch = linha.slice(7).replace("refs/heads/", "");
    else if (linha === "" && atual.caminho) {
      frentes.push(atual);
      atual = {};
    }
  }

  console.log(`\n${cor(1, "Frentes")}\n`);
  for (const { caminho, branch } of frentes) {
    const slug = caminho.startsWith(`${WORKTREES}/`) ? caminho.slice(WORKTREES.length + 1) : null;
    const porta = slug ? portas.get(slug) : null;
    const onde = slug ? `worktree ${slug}` : "cópia principal";
    console.log(
      `  ${(branch ?? "(destacada)").padEnd(32)} ${onde.padEnd(30)} ${porta ? `Vite :${porta}` : ""}`,
    );
  }
  console.log(
    `\n${cor(2, "A cópia principal é quem roda a stack, a migração e a e2e — uma frente por vez.")}\n`,
  );
}

function remover(slug) {
  if (!slug) morre("falta o slug. Uso: pnpm worktree remover <slug>");
  const destino = join(WORKTREES, slug);
  if (!existsSync(destino)) morre(`${destino} não existe. Veja: pnpm worktree listar`);
  // Worktree órfão fica em `git worktree list` e segura a branch contra `git branch -d`.
  git(["worktree", "remove", destino], { stdio: "inherit" });
  ok(`worktree '${slug}' removido. A branch fica — apague com git branch -d depois do merge.`);
}

const [comando, argumento] = process.argv.slice(2);
const fatiaIdx = process.argv.indexOf("--fatia");
const fatia = fatiaIdx > -1 ? process.argv[fatiaIdx + 1] : undefined;

switch (comando) {
  case "criar":
    criar(argumento, fatia);
    break;
  case "listar":
    listar();
    break;
  case "remover":
    remover(argumento);
    break;
  default:
    console.log(`Uso:
  pnpm worktree criar <tipo/slug | exp-NN-slug> [--fatia api/<mod>,hub/<rota>,exp/<id>] [--sem-instalar]
  pnpm worktree listar
  pnpm worktree remover <slug>`);
    process.exit(comando ? 1 : 0);
}
