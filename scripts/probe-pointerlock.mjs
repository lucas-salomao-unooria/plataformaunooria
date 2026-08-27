import { createServer } from "node:http";
import { chromium } from "playwright";

/**
 * Mede se o pointer lock funciona dentro de um iframe com sandbox — a decisão
 * que sustenta o campo `permissoes` do manifesto e o `allow-pointer-lock` do
 * `ExpFrame` (a exp-70 é um jogo 3D em primeira pessoa).
 *
 * Existe porque a resposta depende do NAVEGADOR, e um teste que roda no
 * navegador errado responde a coisa errada. Medido em 2026-08-26, páginas
 * servidas por HTTP real:
 *
 *   |                                | Chromium do Playwright | Chrome do sistema |
 *   | topo, sem iframe               | WrongDocumentError     | OK                |
 *   | iframe SEM allow-pointer-lock  | SecurityError          | SecurityError     |
 *   | iframe COM allow-pointer-lock  | WrongDocumentError     | OK                |
 *
 * A leitura: o Chromium do Playwright não concede pointer lock nem no topo da
 * página, então nele as duas hipóteses ("o sandbox está errado" e "o navegador
 * não faz isso") são indistinguíveis. No Chrome do sistema elas separam — e é
 * essa coluna que prova que o token é necessário E suficiente.
 *
 * Rode de novo quando o Chrome ou o Playwright subir de major:
 *   node scripts/probe-pointerlock.mjs          # Chromium do Playwright
 *   CANAL=chrome node scripts/probe-pointerlock.mjs
 */

const JOGO = `<!doctype html><html><body style="margin:0">
<canvas id="c" width="300" height="200" style="background:#333"></canvas>
<script>
  window.resultado = "nao-tentou";
  document.getElementById('c').addEventListener('click', () => {
    try {
      const p = document.getElementById('c').requestPointerLock();
      if (p && p.then) p.then(() => window.resultado = "OK").catch(e => window.resultado = "ERRO: " + e.name);
    } catch (e) { window.resultado = "THROW: " + e.name; }
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) window.resultado = "OK";
  });
  document.addEventListener('pointerlockerror', () => {
    if (window.resultado === "nao-tentou") window.resultado = "ERRO: pointerlockerror";
  });
</script></body></html>`;

const pai = (sandbox) => `<!doctype html><html><body style="margin:0">
<iframe id="f" sandbox="${sandbox}" src="http://127.0.0.1:${PORTA}/jogo" width="800" height="600" style="border:0"></iframe>
</body></html>`;

const PORTA = 8791;
let sandboxAtual = "allow-scripts";
const srv = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(req.url === "/jogo" ? JOGO : pai(sandboxAtual));
});
await new Promise((r) => srv.listen(PORTA, "127.0.0.1", r));

async function testar(rotulo, headless, sandbox) {
  if (sandbox !== null) sandboxAtual = sandbox;
  const b = await chromium.launch({
    headless,
    channel: process.env.CANAL || undefined,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(e.name ?? String(e).slice(0, 40)));

  const url = sandbox === null ? `http://127.0.0.1:${PORTA}/jogo` : `http://127.0.0.1:${PORTA}/pai`;
  await p.goto(url, { waitUntil: "load" });
  if (sandbox === null) {
    await p.locator("#c").click();
  } else {
    await p.frameLocator("#f").locator("#c").click();
  }
  await p.waitForTimeout(900);
  const alvo = sandbox === null ? p : p.frames().find((f) => f.url().endsWith("/jogo"));
  const r = await alvo.evaluate(() => window.resultado);
  console.log(`${rotulo.padEnd(40)} → ${r}${erros.length ? "  [" + [...new Set(erros)].join(",") + "]" : ""}`);
  await b.close();
}

for (const [rotulo, headless] of [["HEADLESS", true], ["HEADED", false]]) {
  console.log(`--- ${rotulo} ---`);
  await testar("topo (sem iframe)", headless, null);
  await testar("iframe SEM allow-pointer-lock", headless, "allow-scripts allow-same-origin");
  await testar("iframe COM allow-pointer-lock", headless, "allow-scripts allow-same-origin allow-pointer-lock");
}
srv.close();
