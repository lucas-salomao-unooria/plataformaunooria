import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Smoke VISUAL do Ato 1 nativo: o professor traz os perfis da Vila do Lume para
 * uma atividade do Instanooria, pela tela.
 *
 * O que ele prova, e que teste de unidade não prova: que o botão existe, que o
 * BFF deixa a rota passar, que a resposta é renderizada, e — a parte que mais
 * importa — que quem foi DESCARTADO aparece NOMEADO. Uma tela que só diz
 * "23 perfis importados" faz o professor achar que a turma inteira entrou.
 *
 * O QUE ELE NÃO PROVA, de propósito: que um perfil bom vira lado no Instanooria.
 * Isso exigiria uma partida real de 15–25 min (as do walkthrough duram segundos e
 * são legitimamente descartadas por amostra insuficiente), e já está provado sem
 * navegador em `apps/api/tests/vila-ato1.spec.ts` — inclusive o
 * `ladoOrigem: "perfil"` em `resolverLargada`. Amarrar este smoke a um perfil
 * semeado no banco o tornaria dependente de estado ambiente, e ele quebraria
 * sozinho na primeira vez que alguém zerasse uma turma.
 *
 * Uso: node scripts/walkthrough-ato1-vila.mjs <pasta> [activityId]
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-ato1";
const ATIVIDADE = process.argv[3] ?? "";
const USER = process.env.LOGIN_PROF ?? "prof.demo";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1400, height: 1100 } })).newPage();

const erros = [];
p.on("pageerror", (e) => erros.push("PAGEERROR: " + String(e).slice(0, 200)));

const passos = [];
const registrar = async (nome, detalhe = "") => {
  await p.screenshot({ path: `${OUT}/${passos.length + 1}-${nome}.png`, fullPage: true });
  passos.push(`${passos.length + 1}. ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

let falhou = false;
const exigir = (c, oque) => {
  if (c) return;
  falhou = true;
  console.error(`✖ ${oque}`);
};

try {
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
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });

  /* Sem id na linha de comando, pega a primeira atividade da lista do professor. */
  let atividade = ATIVIDADE;
  if (!atividade) {
    await p.goto(`${HUB}/professor`, { waitUntil: "domcontentloaded" });
    const link = p.locator('a[href^="/professor/atividades/"]').first();
    await link.waitFor({ timeout: 15_000 });
    atividade = ((await link.getAttribute("href")) ?? "").split("/").pop() ?? "";
  }
  exigir(!!atividade, "nenhuma atividade do Instanooria para testar");

  await p.goto(`${HUB}/professor/atividades/${atividade}`, { waitUntil: "domcontentloaded" });
  const botao = p.locator("button", { hasText: "Trazer perfis da Vila do Lume" }).first();
  await botao.waitFor({ timeout: 20_000 });
  await registrar("painel-do-ato-1", "botão presente");

  await botao.click();
  /* A resposta do servidor: importados / não jogaram / descartados. */
  await p.locator("text=/perfil importado|perfis importados/").first().waitFor({ timeout: 25_000 });
  await p.waitForTimeout(700);

  const painel = await p.locator("main").innerText();
  const m = /(\d+)\s+(?:perfil importado|perfis importados)/.exec(painel);
  exigir(!!m, "a tela não mostra quantos perfis entraram");
  const importados = m ? Number(m[1]) : 0;
  const temDescartados = /Ficaram de fora/.test(painel);

  /* A rota tem de ter FEITO alguma coisa e RELATADO: ou importou, ou descartou
     alguém com motivo. As duas zeradas significam que ninguém da escola jogou —
     e aí o smoke não tem o que exercitar. */
  exigir(
    importados > 0 || temDescartados,
    "a importação não importou nem descartou ninguém — rode o walkthrough do aluno antes",
  );
  /* A parte que mais importa: quem ficou de fora aparece NOMEADO e com motivo. */
  if (temDescartados) {
    exigir(
      /curta demais|nenhum valor observado/.test(painel),
      "os descartados aparecem sem o motivo — o professor não sabe de quem nem por quê",
    );
  }
  await registrar(
    "perfis-importados",
    `${importados} importados` + (temDescartados ? ", descartados nomeados com motivo" : ""),
  );
} catch (erro) {
  falhou = true;
  console.error("✖ o walkthrough parou:", String(erro).slice(0, 400));
  await p.screenshot({ path: `${OUT}/ERRO.png`, fullPage: true }).catch(() => {});
} finally {
  console.log("\n--- passos ---");
  passos.forEach((s) => console.log(s));
  if (erros.length) console.log("\n--- erros ---\n  " + [...new Set(erros)].join("\n  "));
  await browser.close();
  console.log(falhou ? "\n✖ FALHOU" : "\n✓ ok");
  process.exit(falhou ? 1 : 0);
}
