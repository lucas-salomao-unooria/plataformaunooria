import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Smoke VISUAL da landing pública (`/`, sem sessão).
 *
 * O que o typecheck não pega e este script cobra:
 *  - a fonte do DS (Open Sans) e a fonte de LIGADURA dos ícones (Material
 *    Symbols Rounded) carregadas — sem a segunda, o ícone vira a palavra
 *    "warning" escrita na tela;
 *  - o shader de fundo desenhando (canvas com contexto WebGL e tamanho > 0);
 *  - a revelação ao rolar chegando ao fim (todo `.landing-revelar` visível), e
 *    o card de vidro com cor de fundo COMPUTADA (classe de cor inexistente não
 *    é erro em lugar nenhum — o elemento só fica transparente);
 *  - nada transbordando na largura em celular;
 *  - "Começar Agora" levando ao /login.
 *
 * Uso: node scripts/walkthrough-landing.mjs <pasta-de-prints>
 * Pré-requisito: o hub no ar (:3000). A api NÃO é necessária: a landing não lê
 * sessão nem dado nenhum.
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-landing";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const falhas = [];
const passos = [];
const erros = [];

const registrar = async (p, nome, detalhe = "") => {
  await p.screenshot({ path: `${OUT}/${passos.length + 1}-${nome}.png`, fullPage: nome.endsWith("-inteira") });
  passos.push(`${passos.length + 1}. ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};
const cobrar = (condicao, mensagem) => {
  if (!condicao) {
    falhas.push(mensagem);
    console.log(`✗ ${mensagem}`);
  }
};

try {
  // ---- desktop -------------------------------------------------------------
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const p = await desktop.newPage();
  p.on("console", (m) => m.type() === "error" && erros.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => erros.push("PAGEERROR: " + String(e).slice(0, 200)));

  await p.goto(`${HUB}/`, { waitUntil: "domcontentloaded" });
  await p.locator("h1").waitFor({ timeout: 30_000 });
  cobrar(p.url() === `${HUB}/`, `a raiz redirecionou para ${p.url()} — sem sessão ela deve ser a landing`);
  cobrar(
    (await p.locator("h1").innerText()).includes("Educação Digital e Midiática"),
    "o título do hero não é o do modelo",
  );

  // Hidratação + fontes. O DS auto-hospeda as duas; `fonts.ready` espera o download.
  await p.waitForFunction(() => document.getElementById("landing")?.classList.contains("landing--animada"), null, {
    timeout: 15_000,
  });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);

  const fontes = await p.evaluate(() => ({
    openSans: document.fonts.check('16px "Open Sans"'),
    simbolos: document.fonts.check('24px "Material Symbols Rounded"'),
    h1: getComputedStyle(document.querySelector("h1")).fontFamily,
    icone: getComputedStyle(document.querySelector(".material-symbols-rounded")).fontFamily,
    icones: document.querySelectorAll(".material-symbols-rounded").length,
  }));
  cobrar(fontes.openSans, `Open Sans não carregou (h1 em "${fontes.h1}")`);
  cobrar(fontes.simbolos, `Material Symbols Rounded não carregou — ícone sai como texto ("${fontes.icone}")`);
  cobrar(fontes.icones >= 8, `esperava ≥ 8 ícones do DS, achei ${fontes.icones}`);

  const canvas = await p.evaluate(() => {
    const c = document.querySelector(".landing__fundo canvas");
    if (!c) return null;
    return { w: c.width, h: c.height, gl: Boolean(c.getContext("webgl")) };
  });
  cobrar(canvas && canvas.gl && canvas.w > 0 && canvas.h > 0, `shader de fundo sem contexto/tamanho: ${JSON.stringify(canvas)}`);

  const cta = p.locator("nav a", { hasText: "Começar Agora" });
  cobrar((await cta.count()) === 1, "botão 'Começar Agora' ausente na nav");
  cobrar((await cta.getAttribute("href")) === "/login", "'Começar Agora' não aponta para /login");

  await registrar(p, "hero", `${fontes.icones} ícones, canvas ${canvas?.w}×${canvas?.h}`);

  // ---- rolagem: a revelação tem de chegar ao fim ----------------------------
  await p.locator("#problema").scrollIntoViewIfNeeded();
  await p.waitForTimeout(900);
  const cartao = await p.evaluate(() => {
    const el = document.querySelector("#problema .landing-vidro");
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, opacidade: cs.opacity, blur: cs.backdropFilter || cs.webkitBackdropFilter };
  });
  cobrar(
    cartao.bg && cartao.bg !== "rgba(0, 0, 0, 0)" && cartao.bg !== "transparent",
    `card de vidro sem cor de fundo computada (${cartao.bg}) — token/color-mix não resolveu`,
  );
  cobrar(Number(cartao.opacidade) === 1, `card do desafio ainda invisível (opacity ${cartao.opacidade})`);
  await registrar(p, "desafio", `fundo ${cartao.bg}, blur "${cartao.blur}"`);

  await p.locator("#resposta").scrollIntoViewIfNeeded();
  await p.waitForTimeout(900);
  const simbolo = await p.locator(".landing-conceito img, .landing-conceito svg").count();
  cobrar(simbolo >= 1, "o símbolo da marca não está no painel de Nossa Resposta");
  await registrar(p, "resposta");

  await p.locator("footer").scrollIntoViewIfNeeded();
  await p.waitForTimeout(1200);
  const pendentes = await p.evaluate(
    () => document.querySelectorAll(".landing-revelar:not(.landing-revelar--visivel)").length,
  );
  cobrar(pendentes === 0, `${pendentes} bloco(s) .landing-revelar nunca ficaram visíveis`);
  await registrar(p, "rodape", `${pendentes} blocos pendentes`);

  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  await registrar(p, "pagina-inteira");

  // ---- o CTA leva ao login ---------------------------------------------------
  await cta.click();
  await p.waitForURL("**/login", { timeout: 30_000 });
  await p.locator("button[type=submit]").waitFor({ timeout: 15_000 });
  await registrar(p, "login", p.url().replace(HUB, ""));
  await desktop.close();

  // ---- celular: nada transborda -----------------------------------------------
  const celular = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const m = await celular.newPage();
  m.on("pageerror", (e) => erros.push("PAGEERROR(mobile): " + String(e).slice(0, 200)));
  await m.goto(`${HUB}/`, { waitUntil: "domcontentloaded" });
  await m.locator("h1").waitFor({ timeout: 30_000 });
  await m.waitForTimeout(1200);
  const larguras = await m.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  cobrar(larguras.scroll <= larguras.viewport, `transborda na largura em celular: ${larguras.scroll} > ${larguras.viewport}`);
  await registrar(m, "celular-hero", `scrollWidth ${larguras.scroll} / viewport ${larguras.viewport}`);
  await m.locator("#problema").scrollIntoViewIfNeeded();
  await m.waitForTimeout(900);
  await registrar(m, "celular-desafio");
  await celular.close();
} catch (e) {
  falhas.push(`exceção: ${String(e).slice(0, 300)}`);
  console.error(e);
} finally {
  await browser.close();
}

console.log("\nPassos:\n" + passos.join("\n"));
if (erros.length) console.log("\nErros de console:\n- " + erros.join("\n- "));
if (falhas.length) {
  console.log("\nFALHAS:\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("\nLanding OK.");
