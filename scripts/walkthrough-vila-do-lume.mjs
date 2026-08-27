import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Smoke VISUAL da exp-70 (Vila do Lume), do login ao jogo 3D rodando dentro do
 * iframe do hub.
 *
 * Por que esta experiência precisa de um walkthrough próprio, e não serve o
 * `walkthrough-aluno.mjs`: aqui o typecheck não cobre quase nada. O jogo é
 * JavaScript clássico fora do `tsc` (ADR-0001 da experiência), e as três coisas
 * que podem quebrar são todas de runtime e todas invisíveis num teste de
 * unidade:
 *
 *   · a ORDEM de injeção dos 19 scripts — errada, o sintoma é
 *     `state is not defined` num arquivo aleatório, diferente a cada recarga;
 *   · o WebGL dentro do iframe — sem canvas, a tela fica preta e o jogo não
 *     avisa nada;
 *   · o `allow-pointer-lock` do sandbox — sem o token, o jogo monta, a intro
 *     aparece, a criança clica em ENTRAR NA VILA e a câmera simplesmente não
 *     anda. Nada no console diz por quê.
 *
 * Uso: node scripts/walkthrough-vila-do-lume.mjs <pasta-de-prints> [login]
 * Pré-requisitos: hub :3000, api :3001 e o dev server da exp em :5177.
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-vila";
const USER = process.argv[3] ?? "aluno03";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";
const EXP = "exp-70-vila-do-lume";

mkdirSync(OUT, { recursive: true });

/**
 * CHROME DO SISTEMA, não o Chromium que vem com o Playwright — e a diferença é
 * o único jeito de este walkthrough provar o que ele existe para provar.
 *
 * Medido (`scripts/probe-pointerlock.mjs`, 2026-08-26), com página servida por HTTP real:
 *
 *   |                                | Chromium do Playwright | Chrome do sistema |
 *   | topo, sem iframe               | WrongDocumentError     | OK                |
 *   | iframe SEM allow-pointer-lock  | SecurityError          | SecurityError     |
 *   | iframe COM allow-pointer-lock  | WrongDocumentError     | OK                |
 *
 * O Chromium do Playwright não concede pointer lock NEM no topo da página, então
 * nele o teste não distingue "o sandbox está errado" de "o navegador não faz
 * isso" — as duas coisas dão erro. No Chrome do sistema a coluna separa: sem o
 * token é `SecurityError` (o sandbox bloqueia), com o token é OK.
 *
 * Sem o Chrome instalado o walkthrough segue no Chromium e AVISA que a checagem
 * de pointer lock não valeu; checagem que falha por limitação do ambiente e não
 * diz isso é pior que checagem nenhuma.
 */
let comChromeReal = true;
const argsGL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium
  .launch({ channel: "chrome", args: argsGL })
  .catch(async () => {
    comChromeReal = false;
    console.warn("⚠ Chrome do sistema ausente — pointer lock NÃO será verificado.");
    return chromium.launch({ args: argsGL });
  });
const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await contexto.newPage();

const erros = [];
const avisos = [];
p.on("console", (m) => {
  if (m.type() === "error") erros.push(m.text().slice(0, 240));
  if (m.type() === "info" || m.type() === "warning") avisos.push(m.text().slice(0, 240));
});
/* 404 dentro do iframe é sintoma clássico de caminho de script errado — e o
   `console` só diz "Failed to load resource" sem dizer QUAL. */
p.on("requestfailed", (r) => erros.push(`REQ FALHOU ${r.url().slice(0, 160)}`));
p.on("response", (r) => r.status() >= 400 && erros.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`));
p.on("pageerror", (e) => erros.push("PAGEERROR: " + String(e).slice(0, 240)));

const passos = [];
const registrar = async (nome, detalhe = "") => {
  await p.screenshot({ path: `${OUT}/${passos.length + 1}-${nome}.png` });
  passos.push(`${passos.length + 1}. ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

let falhou = false;
const exigir = (condicao, oque) => {
  if (condicao) return;
  falhou = true;
  console.error(`✖ ${oque}`);
};

try {
  // ---- login -------------------------------------------------------------
  await p.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("button[type=submit]");
  /* PORTÃO DE HIDRATAÇÃO: em dev o HTML do SSR chega antes do bundle, e um
     `fill` nesse intervalo escreve no input sem mover o estado do React. */
  await p.waitForTimeout(1500);
  await p.locator("#username").pressSequentially(USER, { delay: 20 });
  await p.locator("#password").pressSequentially(SENHA, { delay: 20 });
  await p.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    null,
    { timeout: 10_000 },
  );
  await p.click("button[type=submit]");
  await p.waitForURL("**/aluno", { timeout: 30_000 });
  await registrar("hub-do-aluno");

  // ---- entra na experiência ---------------------------------------------
  await p.goto(`${HUB}/exp/${EXP}`, { waitUntil: "domcontentloaded" });
  const aparelho = p.locator('iframe[title="experiencia"]');
  await aparelho.waitFor({ state: "attached", timeout: 20_000 });

  /* O manifesto declara `permissoes: ["pointer-lock"]`, e é o `ExpFrame` que
     traduz isso em token de sandbox. Conferido no ATRIBUTO, porque é a única
     evidência que existe antes de a criança tentar mover a câmera. */
  const sandbox = await aparelho.getAttribute("sandbox");
  exigir(
    (sandbox ?? "").includes("allow-pointer-lock"),
    `iframe sem allow-pointer-lock (sandbox="${sandbox}")`,
  );
  await registrar("iframe-montado", `sandbox="${sandbox}"`);

  // ---- o jogo boota ------------------------------------------------------
  const tela = p.frameLocator('iframe[title="experiencia"]');
  /* A tela inicial só monta depois do handshake do SDK e da injeção dos 19
     scripts: é a prova de que a ordem está certa e a identidade chegou. */
  await tela.locator(".hub-titulo").waitFor({ timeout: 30_000 });
  await registrar("tela-inicial", await tela.locator(".hub-titulo").innerText());

  const canvas = tela.locator("#canvasHost canvas");
  await canvas.waitFor({ timeout: 20_000 });
  const dim = await canvas.evaluate((c) => `${c.width}×${c.height}`);
  exigir(!/^0×|×0$/.test(dim), `canvas WebGL com dimensão zero (${dim})`);
  await registrar("canvas-webgl", dim);

  // ---- intro: 9 cartões do Lume até ENTRAR NA VILA -----------------------
  await tela.locator("button", { hasText: "JOGAR" }).click();
  await tela.locator(".intro-nav").waitFor({ timeout: 10_000 });
  await registrar("intro-primeiro-cartao");

  await tela.locator("button", { hasText: "Pular a explicação" }).click();
  const nomeNaPedra = await tela.locator(".slot-escolhido").innerText();
  /* A identidade vem da sessão. Vazio ou "—" aqui significa que o handshake
     entregou o jogo sem aluno — e uma partida sem aluno não pode ser
     atribuída a ninguém. */
  exigir(
    nomeNaPedra.trim().length > 0 && !nomeNaPedra.includes("—"),
    `nome do aluno não chegou ao jogo (leu "${nomeNaPedra}")`,
  );
  await registrar("ultimo-cartao", `nome no jogo: "${nomeNaPedra}"`);

  // ---- entra na vila -----------------------------------------------------
  await tela.locator("button", { hasText: "ENTRAR NA VILA" }).click();
  await p.waitForTimeout(3000);

  /* O HUD só aparece com a partida rodando: é o sinal de que `startGame()`
     passou por `initScene`/`animate` sem lançar. */
  const fogueiras = await tela.locator("#scoreStars").innerText();
  await registrar("dentro-da-vila", `${fogueiras}/8 fogueiras`);

  /* POINTER LOCK — a checagem que só o Chrome real consegue fazer. O jogo pede o
     lock no clique de "ENTRAR NA VILA" (`controls.lock()`); se ele não pegar, a
     criança entra na vila e a câmera não gira, sem nada no jogo dizendo por quê. */
  /* O FRAME DO JOGO, não a página. `f.url().includes(EXP)` casaria a página do
     hub também — a rota dela é `/exp/exp-70-vila-do-lume` —, e aí a checagem
     leria o `document` errado e daria "não pegou" com o lock funcionando. Filtro
     por `parentFrame()`: só frame aninhado é candidato. */
  const quadro = p.frames().find((f) => f.parentFrame() !== null);
  const preso = quadro ? await quadro.evaluate(() => document.pointerLockElement !== null) : false;
  if (comChromeReal) {
    exigir(preso, "pointer lock não pegou dentro do iframe — a câmera não vai girar");
  }
  await registrar(
    "pointer-lock",
    comChromeReal ? (preso ? "ponteiro preso" : "NÃO pegou") : "não verificado (sem Chrome real)",
  );

  /* Andar de verdade: prova que o loop do jogo está rodando, não só montado. */
  const distancia = async () =>
    quadro ? await quadro.evaluate(() => Math.round(state.distanceWalked)) : -1;
  const antes = await distancia();
  await p.keyboard.down("KeyW");
  await p.waitForTimeout(1800);
  await p.keyboard.up("KeyW");
  const depois = await distancia();
  exigir(depois > antes, `a criança não andou (${antes}m → ${depois}m): o loop do jogo não roda`);
  await registrar("andou-na-vila", `${antes}m → ${depois}m`);

  /* PERDER E RETOMAR O PONTEIRO — o caminho que o porte quebrou, e que só um
     walkthrough pega.

     O `pointerlockchange` do `16-boot.js` estava dentro de
     `window.addEventListener('load', ...)`. No repo de origem os `<script>`
     ficavam no fim do `index.html` e o `load` disparava depois deles; aqui o
     `carregador.ts` injeta os scripts DEPOIS do handshake com o hub, quando o
     `load` já passou — então o listener nunca era registrado.

     A consequência não parece um bug de listener: a criança perde o ponteiro
     (Esc, trocar de aba, `hub:pause`), a câmera congela, o teclado para de andar
     e o aviso "Clique pra voltar pro jogo" NÃO aparece. Como ele é o único
     `controls.lock()` fora dos diálogos, a partida fica sem caminho de volta. */
  if (comChromeReal && preso) {
    await quadro.evaluate(() => document.exitPointerLock());
    await p.waitForTimeout(1200); // o Chrome recusa novo lock por ~1s
    const aviso = await quadro.evaluate(
      () => getComputedStyle(document.getElementById("pausedHint")).display,
    );
    exigir(
      aviso === "flex",
      `perdeu o ponteiro e o aviso de voltar não apareceu (display=${aviso}): ` +
        "o listener de pointerlockchange não foi registrado",
    );
    await tela.locator("#pausedHint").click();
    await p.waitForTimeout(600);
    const voltou = await quadro.evaluate(() => document.pointerLockElement !== null);
    exigir(voltou, "clicar no aviso não devolveu o ponteiro — a partida fica sem caminho de volta");
    await registrar("pausa-e-volta", `aviso=${aviso}, ponteiro de volta: ${voltou}`);
  }

  // ---- a partida veio da api, e sem gabarito ------------------------------
  const ponte = await quadro.evaluate(() => ({
    bolha: window.VILA?.bolha ?? null,
    quantos: window.VILA?.cartoes?.length ?? 0,
    fio: JSON.stringify(window.VILA?.cartoes ?? []),
  }));
  exigir(["A", "B", "C"].includes(ponte.bolha), `bolha não chegou da api (leu ${ponte.bolha})`);
  exigir(ponte.quantos === 4, `esperava 4 cartões servidos, veio ${ponte.quantos}`);
  /* O gabarito não pode estar no fio. Era uma constante no bundle, com os três
     golpes divergentes e o `legitima` de cada um. */
  exigir(!/legitima|"aceita"|"nivel"/.test(ponte.fio), "GABARITO no fio dos cartões");
  /* Só a bolha DESTA criança pode estar no fio. Conta BOLHAS DISTINTAS, não
     ocorrências: a versão anterior somava as aparições de um marcador e exigia
     exatamente 1, mas "Suporte da Vila" aparece quatro vezes dentro do MESMO
     cartão da bolha B (a `tag` e o `name` das três batidas) — a asserção
     acusava vazamento de bolha numa partida perfeitamente correta. Smoke que
     grita lobo é pior que smoke nenhum: some no meio do ruído junto com a falha
     de verdade. */
  const MARCAS_DE_BOLHA = { A: "jogador 1000", B: "Suporte da Vila", C: "sentei atrás de ti" };
  const bolhasNoFio = Object.entries(MARCAS_DE_BOLHA)
    .filter(([, marca]) => ponte.fio.includes(marca))
    .map(([bolha]) => bolha);
  exigir(
    bolhasNoFio.length === 1 && bolhasNoFio[0] === ponte.bolha,
    `o fio devia trazer só a bolha ${ponte.bolha} e trouxe [${bolhasNoFio.join(", ") || "nenhuma"}]`,
  );
  await registrar(
    "cartoes-da-api",
    `bolha ${ponte.bolha} (só ela no fio), ${ponte.quantos} cartões, sem gabarito`,
  );

  // ---- a DM: um cartão SERVIDO PELA API renderiza e registra ---------------
  /* O caminho crítico do M3. O gatilho `inicio` só abre 20s depois de entrar na
     vila, e esperar isso não prova nada a mais sobre a costura — o que precisa
     ser provado é que um cartão que veio do servidor, sem gabarito, atravessa
     `openDM` → opções → `pickDM` e vira registro. Então abrimos o primeiro à mão,
     pelas funções do próprio jogo. */
  await quadro.evaluate(() => openDM(window.VILA.cartoes[0]));
  await tela.locator("#dmReplies .dm-reply-btn").first().waitFor({ timeout: 15_000 });
  const opcoes = await tela.locator("#dmReplies .dm-reply-btn").count();
  exigir(opcoes === 3, `o cartão devia ter 3 opções, tem ${opcoes}`);
  const remetente = await tela.locator("#dmCard .dm-name").innerText();
  await registrar("dm-aberta", `${remetente}, ${opcoes} opções`);

  await p.keyboard.press("Digit2"); // "Ignorar" em todos os cartões
  await p.waitForTimeout(1600);
  const registro = await quadro.evaluate(() => {
    const c = state.dmCartoes[state.dmCartoes.length - 1];
    return {
      id: c.id,
      escolha: c.escolha,
      temGabarito: "legitima" in c || "nivel" in c || "aceitou" in c,
      decisaoMs: c.decisaoMs,
      /* `aposCartao:N` conta cartões resolvidos, e o contador sobe 1s depois de
         o cartão abrir — era `aposGolpe`, que dizia ao cliente qual era o golpe. */
      destravou: gatilhoAtendido("aposCartao:1"),
    };
  });
  exigir(registro.escolha === 2, `a escolha não foi registrada (leu ${registro.escolha})`);
  exigir(!registro.temGabarito, "o registro do cartão carrega gabarito (legitima/nivel/aceitou)");
  exigir(typeof registro.decisaoMs === "number", "o tempo de decisão não foi medido");
  exigir(registro.destravou, "`aposCartao:1` não destravou depois do primeiro cartão");
  await registrar(
    "dm-respondida",
    `${registro.id} → opção ${registro.escolha} em ${registro.decisaoMs}ms, sem gabarito`,
  );

  // ---- conclusão real: o payload que o JOGO monta contra o contrato da API --
  /* Acender as 8 fogueiras leva 15–25 minutos e não é o que este smoke testa. O
     que ele testa é a COSTURA: que o payload montado pelo `construirPayloadSessao`
     do jogo passa pelo zod da api e vira linha no banco. Então forçamos o fim
     pelas funções do próprio jogo, sem inventar payload nenhum. */
  const medida = await quadro.evaluate(() => {
    state.visited = zones.map((z) => z.id);
    const payload = construirPayloadSessao();
    return {
      bytes: JSON.stringify(payload).length,
      eventos: payload.eventos.length,
      status: payload.status,
      /* Prova que o texto livre morreu: nenhum valor de `dados` é string fora do
         vocabulário fechado, porque o jogo já não monta frase nenhuma. */
      temTexto: payload.eventos.some((e) => e.dados && "texto" in e.dados),
      temGabarito: /legitima|"nivel"|aceitou|"bolha"|seguras|"risco"/.test(JSON.stringify(payload)),
    };
  });
  exigir(medida.status === "completa", `status devia ser completa, veio ${medida.status}`);
  exigir(!medida.temTexto, "o payload ainda carrega `dados.texto` — canal de texto livre");
  exigir(!medida.temGabarito, "o payload ainda carrega classificação feita no cliente");
  await registrar("payload-montado", `${medida.bytes} bytes, ${medida.eventos} eventos`);

  await quadro.evaluate(() => buildResults());
  await p.waitForTimeout(3000);
  const gravou = avisos.some((m) => m.includes("partida gravada"));
  exigir(gravou, `a api não confirmou a gravação. Console: ${avisos.join(" | ") || "(vazio)"}`);
  await registrar("partida-gravada", "POST /vila/sessoes/:id/concluir → ok");

  console.log(`\n--- medida do payload ---\n  ${medida.bytes} bytes, ${medida.eventos} eventos`);
} catch (erro) {
  falhou = true;
  console.error("✖ o walkthrough parou:", String(erro).slice(0, 400));
  await p.screenshot({ path: `${OUT}/ERRO.png` }).catch(() => {});
} finally {
  console.log("\n--- passos ---");
  passos.forEach((s) => console.log(s));
  if (erros.length) {
    console.log("\n--- erros de console ---");
    [...new Set(erros)].forEach((e) => console.log("  " + e));
  }
  await browser.close();
  console.log(falhou ? "\n✖ FALHOU" : "\n✓ ok");
  process.exit(falhou ? 1 : 0);
}
