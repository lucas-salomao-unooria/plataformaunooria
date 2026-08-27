import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Smoke VISUAL da exp-02-unootube, do login à virada do ranking.
 *
 * Valida, de ponta a ponta: o roteamento por série (aluno do 4º ano cai em
 * /exp/exp-02-unootube), o handshake da SDK no iframe cross-origin, o autoplay
 * delegado pelo hub (`allow="autoplay"`), o estado server-side da missão
 * (salvar 3 → ranking → credibilidade) e a ausência de erros de console.
 *
 * Uso: node scripts/walkthrough-aluno-unootube.mjs <pasta-de-prints> [login]
 * Pré-requisitos: hub, api e a exp-02 (:5174) no ar + seed (turma 4A).
 * Os seletores abaixo são CONTRATO com a experiência (README da exp-02).
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-unootube";
const USER = process.argv[3] ?? "aluno4a01";
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
  // ---- login (portão de hidratação: ver walkthrough-aluno.mjs) -------------
  await p.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("button[type=submit]");
  await p.waitForTimeout(1500);
  await p.locator("#username").pressSequentially(USER, { delay: 20 });
  await p.locator("#password").pressSequentially(SENHA, { delay: 20 });
  await p.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    null,
    { timeout: 10_000 },
  );
  await p.click("button[type=submit]");

  // ---- hub do aluno -------------------------------------------------------
  // O roteamento não olha mais a série: o aluno escolhe a missão no hub dele.
  await p.waitForURL("**/aluno", { timeout: 30_000 });
  const cartao = p.locator("a", { hasText: "UnooTube" }).first();
  await cartao.waitFor({ timeout: 15_000 });
  await registrar("hub-do-aluno", `${await p.locator("main ul > li").count()} missões`);

  await cartao.click();
  await p.waitForURL("**/exp/exp-02-unootube**", { timeout: 30_000 });
  await registrar("entrou-no-unootube", p.url().replace(HUB, ""));

  // ---- iframe + handshake + boot -----------------------------------------
  const iframe = p.locator('iframe[title="experiencia"]');
  await iframe.waitFor({ state: "attached", timeout: 20_000 });
  const tela = p.frameLocator('iframe[title="experiencia"]');
  // A marca é o `Logo` da seção Unootube do DS (`.uni-logo`), não mais um
  // wordmark de texto próprio — ver `bootstrap.tsx` e `Topbar.tsx`.
  await tela.locator(".uni-topbar .uni-logo").first().waitFor({ timeout: 30_000 });
  await tela.locator("article.short-item").first().waitFor({ timeout: 20_000 });
  await p.waitForTimeout(2500);

  // Autoplay: sem `allow="autoplay"` no iframe o play() rejeita em silêncio.
  const tocando = await tela.locator("video").evaluateAll((vs) => vs.some((v) => !v.paused && v.readyState >= 2));
  const quantosVideos = await tela.locator("article.short-item").count();
  await registrar("feed-carregado", `${quantosVideos} shorts · autoplay: ${tocando ? "ok" : "BLOQUEADO"}`);

  // ---- estado anterior? reinicia pelo perfil para o roteiro ser repetível --
  const jaSalvos = await tela.locator('button[aria-label="Remover dos salvos"]').count();
  const rankingJaAberto = await tela.locator("nav.uni-sidebar button", { hasText: "Ranking" }).count();
  if (jaSalvos > 0 || rankingJaAberto > 0) {
    await tela.locator('button[aria-label="Abrir seu perfil"]').click();
    await tela.locator("button", { hasText: "Reiniciar missão" }).click();
    await tela.locator("button", { hasText: "Sim, reiniciar" }).click();
    await p.waitForTimeout(1500);
    await registrar("missao-reiniciada", `${jaSalvos} salvos anteriores`);
  }

  // ---- salvar 3 vídeos ----------------------------------------------------
  for (let i = 0; i < 3; i += 1) {
    const botoes = tela.locator('button[aria-label="Salvar vídeo"]');
    await botoes.nth(i).scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await botoes.nth(i).click();
    await p.waitForTimeout(900);
  }
  await tela.locator("text=Você salvou 3 vídeos!").waitFor({ timeout: 10_000 });
  const resultado = await tela.locator(".complete-result").innerText();
  await registrar("missao-concluida", resultado.replace(/\s+/g, " ").trim());

  // ---- coleção: as duas abas ----------------------------------------------
  // A tela de Playlists nunca esteve no smoke e foi inteiramente reescrita
  // sobre o DS (ShortsShelf + TopMenuBar): sem print aqui, uma prateleira
  // vazia ou uma prévia sem vídeo passaria despercebida.
  await tela.locator("button", { hasText: "Ver depois" }).click();
  await tela.locator("nav.uni-sidebar button", { hasText: "Playlists" }).click();
  await tela.locator("h1", { hasText: "Sua coleção" }).waitFor({ timeout: 15_000 });
  await p.waitForTimeout(1200);
  const previas = await tela.locator(".library-preview video").count();
  await registrar("playlists-salvos", `${previas} prévias na prateleira`);

  await tela.locator("button", { hasText: "Curtidos" }).click();
  await p.waitForTimeout(800);
  await registrar("playlists-curtidos");

  await tela.locator("nav.uni-sidebar button", { hasText: "Ranking" }).click();
  // Da revelação em diante quem desenha é o DS da PLATAFORMA (ver Ranking.tsx):
  // `SectionHeader` publica o título como <h2>, a tabela é `.unooria-table` e o
  // resumo virou três `MetricCard`.
  await tela.locator("h2", { hasText: "Ranking da turma" }).waitFor({ timeout: 15_000 });
  await tela.locator(".unooria-table tbody tr").nth(39).waitFor({ timeout: 15_000 });
  const posicaoAntes = await tela.locator(".unooria-metric-card__value").first().innerText();
  await registrar("ranking-por-inscritos", `40 linhas · você em ${posicaoAntes}`);

  // A troca de aparência é do aluno (Perfil → APARÊNCIA) e vale para as DUAS
  // seções do DS: `data-uni-theme` no clone e `.unooria-theme-dark` na
  // plataforma. Sem este passo, o modo escuro nunca entra no smoke visual.
  await tela.locator('button[aria-label="Abrir seu perfil"]').click();
  await tela.locator("h1", { hasText: "Aluno" }).first().waitFor({ timeout: 15_000 });
  await tela.locator("button", { hasText: "Escuro" }).click();
  await p.waitForTimeout(600);
  const temaEscuro = await tela.locator("html").getAttribute("data-uni-theme");
  await registrar("perfil-tema-escuro", `data-uni-theme: ${temaEscuro}`);

  await tela.locator("nav.uni-sidebar button", { hasText: "Ranking" }).click();
  await tela.locator("h2", { hasText: "Ranking da turma" }).waitFor({ timeout: 15_000 });
  await registrar("ranking-no-escuro");

  await tela.locator("button", { hasText: "Adicionar credibilidade" }).click();
  await tela.locator("text=Ter muitos inscritos não significa contar a verdade").waitFor({ timeout: 15_000 });
  await p.waitForTimeout(800);
  const posicaoDepois = await tela.locator(".unooria-metric-card__value").first().innerText();
  await registrar("credibilidade-adicionada", `você em ${posicaoDepois}`);

  // ---- recarga: o estado é do servidor -------------------------------------
  await p.reload({ waitUntil: "domcontentloaded" });
  await tela.locator("article.short-item").first().waitFor({ timeout: 30_000 });
  await p.waitForTimeout(1500);
  const salvosDepois = await tela.locator('button[aria-label="Remover dos salvos"]').count();
  await registrar("recarga-mantem-estado", `${salvosDepois} salvos após F5`);

  console.log("\n--- passos ---");
  passos.forEach((linha) => console.log(linha));
  console.log("\n--- erros de console ---");
  console.log(erros.length ? erros.join("\n") : "(nenhum)");
  if (!tocando) console.log("\n! autoplay bloqueado — conferir allow=\"autoplay\" no ExpFrame");
  if (salvosDepois !== 3) {
    console.error(`\n✗ esperava 3 salvos após recarga, veio ${salvosDepois}`);
    process.exitCode = 1;
  }
  if (erros.length) process.exitCode = 1;
  console.log(`\nprints em ${OUT}/`);
} catch (falha) {
  await p.screenshot({ path: `${OUT}/erro.png` }).catch(() => {});
  console.error("\n✗ walkthrough interrompido:", String(falha).slice(0, 400));
  console.error("erros de console:", erros.length ? erros.join("\n") : "(nenhum)");
  process.exitCode = 1;
} finally {
  await browser.close();
}
