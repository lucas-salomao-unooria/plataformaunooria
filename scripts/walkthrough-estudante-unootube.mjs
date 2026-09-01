import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { ehRuidoDeDev, vigiarFalhasDaApi } from "./lib/smoke.mjs";
import { conta } from "./lib/credenciais.mjs";

/**
 * Smoke VISUAL da exp-02-unootube, do login à virada do ranking.
 *
 * Valida, de ponta a ponta: o roteamento por série (estudante do 4º ano cai em
 * /exp/exp-02-unootube), o handshake da SDK no iframe cross-origin, o autoplay
 * delegado pelo hub (`allow="autoplay"`), o estado server-side da missão
 * (briefing → salvar 3 → limite → concluir → ranking → credibilidade) e a
 * ausência de erros de console.
 *
 * Uso: node scripts/walkthrough-estudante-unootube.mjs <pasta-de-prints> [login]
 * Pré-requisitos: hub, api e a exp-02 (:5174) no ar + seed (turma 4A).
 * Os seletores abaixo são CONTRATO com a experiência (README da exp-02).
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-unootube";
const USER = process.argv[3] ?? conta("estudante", { serie: "4EF" }).login;
const SENHA = process.env.SENHA_DEMO ?? "unooria123";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const contexto = await browser.newContext({ viewport: { width: 1280, height: 950 }, deviceScaleFactor: 2 });
const p = await contexto.newPage();

const erros = [];
const falhasDaApi = [];
let ruidoIgnorado = 0;
/** Reprova por erro de console, MENOS o ruído conhecido do Next (ver `lib/smoke.mjs`). */
const anotar = (texto) => (ehRuidoDeDev(texto) ? (ruidoIgnorado += 1) : erros.push(texto));
p.on("console", (m) => m.type() === "error" && anotar(m.text().slice(0, 200)));
p.on("pageerror", (e) => anotar("PAGEERROR: " + String(e).slice(0, 200)));
vigiarFalhasDaApi(p, falhasDaApi);

const passos = [];
const registrar = async (nome, detalhe = "") => {
  await p.screenshot({ path: `${OUT}/${passos.length + 1}-${nome}.png` });
  passos.push(`${passos.length + 1}. ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

try {
  // ---- login (portão de hidratação: ver walkthrough-estudante.mjs) -------------
  await p.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("button[type=submit]");
  await p.waitForTimeout(1500);
  await p.locator("#username").pressSequentially(USER, { delay: 20 });
  await p.locator("#password").pressSequentially(SENHA, { delay: 20 });
  await paginaWaitForFunction();
  async function paginaWaitForFunction() {
    await p.waitForFunction(
      () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
      null,
      { timeout: 10_000 },
    );
  }
  await p.click("button[type=submit]");

  // ---- hub do estudante -------------------------------------------------------
  // O roteamento não olha mais a série: o estudante escolhe a missão no hub dele.
  await p.waitForURL((url) => url.pathname.includes("/estudante"), { timeout: 30_000 });
  const cartao = p.locator("a", { hasText: "UnooTube" }).first();
  await cartao.waitFor({ timeout: 15_000 });
  await registrar("hub-do-estudante", `${await p.locator("main ul > li").count()} missões`);

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

  // ---- estado anterior? reinicia pelo perfil para o roteiro ser repetível --
  // Desde a 1.1.0 a experiência abre no BRIEFING quando nada foi feito ainda
  // (`lib/missao.ts`), e reiniciar volta para lá. Este roteiro sempre começa da
  // entrada: se ela não está na tela, é porque há missão em andamento.
  const jaComecou = (await tela.locator("section.entrada").count()) === 0;
  if (jaComecou) {
    await tela.locator('button[aria-label="Abrir seu perfil"]').click();
    await tela.locator("button", { hasText: "Reiniciar missão" }).click();
    await tela.locator("button", { hasText: "Sim, reiniciar" }).click();
    await tela.locator("section.entrada").waitFor({ timeout: 15_000 });
    await registrar("missao-reiniciada", "estado anterior descartado");
  }

  // ---- tela de entrada: o briefing (Figma `3:24`) --------------------------
  await tela.locator("h1", { hasText: "Missão: escolha seus Shorts favoritos!" }).waitFor({ timeout: 20_000 });
  const passosDoBriefing = await tela.locator(".entrada-passos li").count();
  const regrasDoBriefing = await tela.locator(".entrada-regras li").count();
  await registrar("tela-de-entrada", `${passosDoBriefing} passos · ${regrasDoBriefing} regras`);

  await tela.locator("button", { hasText: "Começar missão" }).click();
  await tela.locator("article.short-item").first().waitFor({ timeout: 20_000 });

  /*
   * Autoplay: sem `allow="autoplay"` no iframe o play() rejeita em silêncio.
   *
   * Espera ATIVA, e não um `waitForTimeout` fixo: desde a 1.1.0 o feed só monta
   * depois de "Começar missão", ou seja, o vídeo começa a baixar agora — antes
   * ele tinha o tempo inteiro do login e do boot para bufferizar. Com o sleep de
   * 2,5 s o smoke acusava "autoplay BLOQUEADO" por rede lenta, que é falso
   * negativo do pior tipo: aponta para o `allow` do iframe, que está certo.
   */
  const tocando = await tela
    .locator("article.short-item")
    .first()
    .evaluate(
      (item) =>
        new Promise((resolve) => {
          const limite = Date.now() + 15_000;
          const olhar = () => {
            const v = item.querySelector("video");
            if (v && !v.paused && v.readyState >= 2) return resolve(true);
            if (Date.now() > limite) return resolve(false);
            setTimeout(olhar, 250);
          };
          olhar();
        }),
    );
  const quantosVideos = await tela.locator("article.short-item").count();
  const bandejaVazia = await tela.locator(".bandeja-slot .empty-slot").count();
  await registrar(
    "feed-carregado",
    `${quantosVideos} shorts · autoplay: ${tocando ? "ok" : "BLOQUEADO"} · ${bandejaVazia} lugares vazios`,
  );

  /* ---- navegação por TECLADO ---------------------------------------------
     O feed anda por seta, e isso vive num `useEffect` cujo listener depende de
     `moverFeed`. É um caminho que o typecheck não alcança e que quebra calado:
     dependência velha e a seta passa a mover para o vídeo ERRADO; listener
     recriado a cada render e ele some entre o `keydown` e o handler. Mede o
     item mais perto do centro, que é o que a pessoa vê — `scrollIntoView` é
     suave, então a asserção vem depois da animação. */
  const itemCentral = () =>
    tela
      .locator("article.short-item")
      .first()
      .evaluate(() => {
        const meio = window.innerHeight / 2;
        const perto = [...document.querySelectorAll("article.short-item")]
          .map((el, i) => {
            const r = el.getBoundingClientRect();
            return { i, d: Math.abs(r.top + r.height / 2 - meio) };
          })
          .sort((a, z) => a.d - z.d)[0];
        return perto ? perto.i : -1;
      });
  await tela.locator("article.short-item").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  const noComeco = await itemCentral();
  await p.keyboard.press("ArrowDown");
  await p.waitForTimeout(1600);
  const depoisDeDescer = await itemCentral();
  await p.keyboard.press("ArrowUp");
  await p.waitForTimeout(1600);
  const depoisDeSubir = await itemCentral();
  const tecladoOk = depoisDeDescer > noComeco && depoisDeSubir === noComeco;
  if (!tecladoOk) {
    console.error(`\n✗ seta não moveu o feed (${noComeco} -> ${depoisDeDescer} -> ${depoisDeSubir})`);
    process.exitCode = 1;
  }
  await registrar(
    "feed-por-teclado",
    `${noComeco} → ${depoisDeDescer} → ${depoisDeSubir}${tecladoOk ? "" : " — NÃO MOVEU"}`,
  );

  // ---- salvar 3 vídeos ----------------------------------------------------
  for (let i = 0; i < 3; i += 1) {
    const botoes = tela.locator('button[aria-label="Salvar vídeo"]:not([disabled])');
    await botoes.nth(i).scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await botoes.nth(i).click();
    await p.waitForTimeout(900);
  }
  const preenchidos = await tela.locator(".bandeja-previa").count();
  await registrar("tres-favoritos", `${preenchidos} na bandeja`);

  // ---- 4º salvo: o diálogo de limite (Figma `7:224`) -----------------------
  // Ele SUBSTITUIU o toast de "playlist cheia": o toast sumia em 5 s e não
  // oferecia saída nenhuma. Um print aqui é o que pega o diálogo vazio.
  const quarto = tela.locator('button[aria-label="Salvar vídeo"]:not([disabled])').first();
  await quarto.scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  await quarto.click();
  await tela.locator("text=Você já salvou 3 vídeos!").waitFor({ timeout: 10_000 });
  const trocasOferecidas = await tela.locator(".dialogo-limite__favoritos li").count();
  await registrar("limite-atingido", `${trocasOferecidas} trocas oferecidas`);
  await tela.locator("button", { hasText: "Entendi!" }).click();
  await p.waitForTimeout(600);

  // ---- concluir pelo botão da bandeja (1.1.0: não abre mais sozinho) -------
  const concluir = tela.locator("button", { hasText: "Concluir missão" });
  if (await concluir.isDisabled()) throw new Error('"Concluir missão" continua desabilitado com 3 favoritos');
  await concluir.click();
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

  // A troca de aparência é do estudante (Perfil → APARÊNCIA) e vale para as DUAS
  // seções do DS: `data-uni-theme` no clone e `.unooria-theme-dark` na
  // plataforma. Sem este passo, o modo escuro nunca entra no smoke visual.
  await tela.locator('button[aria-label="Abrir seu perfil"]').click();
  /* O h1 do perfil é o NOME da criança. Era uma regex por "Estudante" porque
     o seed antigo chamava todo mundo assim; com gente de verdade, o que
     identifica a tela é o primeiro nome de quem entrou. */
  const primeiroNome = conta("estudante", { serie: "4EF" }).nome.split(" ")[0];
  await tela.locator("h1", { hasText: primeiroNome }).first().waitFor({ timeout: 15_000 });
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
  console.log(erros.length ? erros.join("\n") : `(nenhum${ruidoIgnorado ? `; ${ruidoIgnorado} de ruído conhecido do Next ignorados` : ""})`);
  console.log("--- respostas de erro da api ---");
  console.log(falhasDaApi.length ? [...new Set(falhasDaApi)].join("\n") : "(nenhuma)");
  if (!tocando) console.log('\n! autoplay bloqueado — conferir allow="autoplay" no ExpFrame');
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
