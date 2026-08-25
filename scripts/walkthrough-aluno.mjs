import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Smoke VISUAL da experiência do aluno, do login ao feed dentro do aparelho.
 *
 * Porte do `scripts/walkthrough-aluno.mjs` do projeto origem para a
 * arquitetura do monorepo: agora o aparelho é um iframe CROSS-ORIGIN (hub
 * :3000 embeda a experiência :5173), então tudo que está dentro dele se
 * alcança por `frameLocator` — não pelo DOM da página.
 *
 * Uso: node scripts/walkthrough-aluno.mjs <pasta-de-prints> [login]
 * Pré-requisitos: `pnpm dev` no ar (hub :3000, api :3001, exp :5173) e o seed
 * (`pnpm --filter @edu/api seed && seed:demo`).
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-aluno";
const USER = process.argv[3] ?? "aluno03";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const contexto = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 });
const p = await contexto.newPage();

const erros = [];
p.on("console", (m) => m.type() === "error" && erros.push(m.text().slice(0, 200)));
p.on("pageerror", (e) => erros.push("PAGEERROR: " + String(e).slice(0, 200)));

const passos = [];
const registrar = async (nome, detalhe = "") => {
  await p.screenshot({ path: `${OUT}/${passos.length + 1}-${nome}.png` });
  passos.push(`${passos.length + 1}. ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

try {
  // ---- login -------------------------------------------------------------
  await p.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("button[type=submit]");
  /**
   * PORTÃO DE HIDRATAÇÃO: em dev o HTML do SSR chega antes do bundle, e um
   * `fill` nesse intervalo escreve no input sem mover o estado do React — o
   * formulário envia vazio. Esperar o botão ficar habilitado após digitar é o
   * sinal de que o onChange chegou ao componente.
   */
  await p.waitForTimeout(1500);
  await p.locator("#username").pressSequentially(USER, { delay: 20 });
  await p.locator("#password").pressSequentially(SENHA, { delay: 20 });
  await p.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    null,
    { timeout: 10_000 },
  );
  await registrar("login-preenchido");

  await p.click("button[type=submit]");
  await p.waitForURL("**/exp/**", { timeout: 30_000 });
  await registrar("entrou-na-experiencia", p.url().replace(HUB, ""));

  // ---- o aparelho --------------------------------------------------------
  const aparelho = p.locator('iframe[title="experiencia"]');
  await aparelho.waitFor({ state: "attached", timeout: 20_000 });
  const caixa = await aparelho.boundingBox();
  const tela = p.frameLocator('iframe[title="experiencia"]');

  // A SDK precisa do handshake (exp:ready → hub:init) e do GET /runs/boot.
  await tela.locator("text=Instanooria").first().waitFor({ timeout: 30_000 });
  await p.waitForTimeout(2000);
  await registrar(
    "aparelho-carregado",
    caixa ? `iframe ${Math.round(caixa.width)}×${Math.round(caixa.height)} css` : "sem caixa",
  );

  // ---- onboarding: missão → figurinha+nome → feed -------------------------
  const telaDaMissao = tela.locator("button", { hasText: "Entrar no Instanooria" });
  if (await telaDaMissao.count()) {
    await registrar("missao-apresentada");
    await telaDaMissao.click();

    // Grade de figurinhas: cada uma é um <button aria-label="{rótulo}">.
    const figurinhas = tela.locator('[aria-label="Escolha sua figurinha"] button');
    await figurinhas.first().waitFor({ timeout: 10_000 });
    const quantas = await figurinhas.count();
    await figurinhas.first().click();
    await tela.locator('input[placeholder="seu nome"]').pressSequentially("Bia", { delay: 25 });
    await registrar("figurinha-e-nome", `${quantas} figurinhas`);

    await tela.locator("button", { hasText: "Salvar e entrar" }).click();
    // splash de 1,5s + POST /runs + /entrar + primeiro bloco do feed
    await p.waitForTimeout(7000);
    await registrar("feed-carregado");
  } else {
    await registrar("sessao-retomada", "onboarding já concluído");
  }

  // ---- feed: rolagem e dwell --------------------------------------------
  const cards = tela.locator("article[data-post-id]");
  const quantosCards = await cards.count();
  if (quantosCards > 0) {
    await cards.nth(Math.min(2, quantosCards - 1)).scrollIntoViewIfNeeded();
    await p.waitForTimeout(3500); // deixa o IntersectionObserver medir dwell
    await registrar("feed-rolado", `${quantosCards} cards no DOM`);
  } else {
    await registrar("feed-sem-cards", "verificar boot/fase");
  }

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
