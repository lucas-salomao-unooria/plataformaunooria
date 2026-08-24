import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Smoke VISUAL das telas da plataforma (professor e gestor).
 *
 * Cobre o que o walkthrough do aluno não alcança: o Design System
 * institucional (`unooria.css` + Material Symbols via <link>), a trilha, a
 * tela da atividade com os painéis e a gestão de usuários.
 *
 * Uso: node scripts/walkthrough-professor.mjs <pasta-de-prints>
 * Pré-requisitos: `pnpm dev` no ar + seed (`seed` e `seed:demo`).
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-professor";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const contexto = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
const p = await contexto.newPage();

const erros = [];
p.on("console", (m) => m.type() === "error" && erros.push(m.text().slice(0, 200)));
p.on("pageerror", (e) => erros.push("PAGEERROR: " + String(e).slice(0, 200)));

const passos = [];
const registrar = async (nome, detalhe = "") => {
  await p.screenshot({ path: `${OUT}/${passos.length + 1}-${nome}.png`, fullPage: true });
  passos.push(`${passos.length + 1}. ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

/**
 * Login com PORTÃO DE HIDRATAÇÃO: em dev o HTML do SSR chega antes do bundle,
 * e escrever nesse intervalo não move o estado do React — o form envia vazio.
 */
async function entrar(usuario) {
  await p.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("button[type=submit]");
  await p.waitForTimeout(1500);
  await p.locator("#username").pressSequentially(usuario, { delay: 20 });
  await p.locator("#password").pressSequentially(SENHA, { delay: 20 });
  await p.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    null,
    { timeout: 10_000 },
  );
  await p.click("button[type=submit]");
  await p.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await p.waitForTimeout(1500);
}

/** Ícone do DS é fonte de ligadura: sem a fonte, o <span> mostra o NOME. */
async function iconesViraramTexto() {
  return p.evaluate(() => {
    const alvo = [...document.querySelectorAll("span")].find((s) =>
      (s.className || "").toString().includes("material-symbols"),
    );
    if (!alvo) return "sem ícone na tela";
    const familia = getComputedStyle(alvo).fontFamily;
    const carregou = document.fonts.check(`24px "Material Symbols Rounded"`);
    return carregou ? `ok (${familia.split(",")[0]})` : `FONTE NÃO CARREGOU (${familia.split(",")[0]})`;
  });
}

try {
  // ---- professor ---------------------------------------------------------
  await entrar("prof.demo");
  await registrar("hub-do-professor", p.url().replace(HUB, ""));
  console.log("   ícones:", await iconesViraramTexto());

  await p.goto(`${HUB}/professor/entre-redes`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  await registrar("trilha-entre-redes");

  const atividade = p.locator('a[href^="/professor/atividades/"]').first();
  if (await atividade.count()) {
    await atividade.click();
    await p.waitForTimeout(3000);
    await registrar("tela-da-atividade", p.url().replace(HUB, ""));
  }

  // ---- gestor: importação de usuários ------------------------------------
  await p.goto(`${HUB}/api/auth/signout`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await contexto.clearCookies();
  await entrar("gestor.demo");
  await registrar("admin-usuarios", p.url().replace(HUB, ""));
  const linhas = await p.locator("table tbody tr").count().catch(() => 0);
  console.log("   linhas na tabela:", linhas);

  console.log("\n--- passos ---");
  passos.forEach((linha) => console.log(linha));
  console.log("\n--- erros de console ---");
  console.log(erros.length ? erros.join("\n") : "(nenhum)");
  console.log(`\nprints em ${OUT}/`);
} catch (falha) {
  await p.screenshot({ path: `${OUT}/erro.png` }).catch(() => {});
  console.error("\n✗ walkthrough interrompido:", String(falha).slice(0, 400));
  console.error("erros de console:", erros.length ? erros.join("\n") : "(nenhum)");
  process.exitCode = 1;
} finally {
  await browser.close();
}
