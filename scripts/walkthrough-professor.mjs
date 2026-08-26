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

/** Mesmo check, dentro do iframe da experiência (a exp-90 carrega o DS por conta própria). */
async function iconesNoFrame() {
  const frame = p.frames().find((f) => f !== p.mainFrame() && f.url().includes("hubOrigin="));
  if (!frame) return "iframe não encontrado";
  return frame.evaluate(() => {
    const alvo = [...document.querySelectorAll("span")].find((s) =>
      (s.className || "").toString().includes("material-symbols"),
    );
    if (!alvo) return "sem ícone na tela";
    const carregou = document.fonts.check(`24px "Material Symbols Rounded"`);
    return carregou ? "ok" : "FONTE NÃO CARREGOU";
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

  // ---- UnooTube (4º ano · unidade 1): missão sem atividades + resultados ---
  await p.goto(`${HUB}/professor/entre-redes/4-ano/unidade-1`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  await registrar("missao-unootube", p.url().replace(HUB, ""));
  await p.locator("a", { hasText: "Ver resultados da turma" }).click();
  await p.waitForSelector("select#turma", { timeout: 15_000 });
  await p.selectOption("select#turma", { label: /4A/ }).catch(async () => {
    const opcoes = p.locator("select#turma option");
    if ((await opcoes.count()) > 1) await p.selectOption("select#turma", { index: 1 });
  });
  await p.waitForURL("**turmaId=**", { timeout: 15_000 });
  await p.waitForTimeout(2500);
  const linhasUnootube = await p.locator("table tbody tr").count().catch(() => 0);
  await registrar("resultados-unootube", `${linhasUnootube} alunos na tabela`);

  const atividade = p.locator('a[href^="/professor/atividades/"]').first();
  if (await atividade.count()) {
    await atividade.click();
    await p.waitForTimeout(3000);
    await registrar("tela-da-atividade", p.url().replace(HUB, ""));
  }

  // ---- plano de aula: exp-90 embedada no hub ------------------------------
  // Diálogos nativos (confirm de excluir) são aceitos; sem isto o Playwright trava.
  p.on("dialog", (d) => void d.accept());
  await p.goto(`${HUB}/professor`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1000);
  const cardPlano = p.locator('a[href="/professor/plano-de-aula"]');
  console.log("   card do plano de aula é interno:", (await cardPlano.count()) === 1 ? "sim" : "NÃO");
  await cardPlano.first().click();
  await p.waitForURL((url) => url.pathname === "/professor/plano-de-aula", { timeout: 30_000 });
  const exp = p.frameLocator('iframe[title="experiencia"]');
  await exp.getByText("Meus planos de aula").waitFor({ timeout: 45_000 });
  await registrar("plano-de-aula-lista", "iframe da exp-90 carregado");
  console.log("   ícones no iframe:", await iconesNoFrame());

  await exp.getByRole("button", { name: /Novo plano|Gerar meu primeiro plano/ }).first().click();
  await exp.getByText("Novo plano de aula").waitFor({ timeout: 10_000 });
  // Com uma única disciplina disponível o app já a pré-seleciona.
  const escolherDisciplina = exp.getByText("Selecione a disciplina");
  if (await escolherDisciplina.isVisible().catch(() => false)) {
    await escolherDisciplina.click();
    await exp.getByText("Letramento Digital").first().click();
  }
  await exp.getByText("Selecione a série").click();
  await exp.getByText("8º ano").first().click();
  await registrar("plano-de-aula-escolha");
  await exp.getByRole("button", { name: "Gerar plano de aula" }).click();
  // Com o Vertex de verdade e o material real da rede a geração levou 30–60 s
  // nas medições; o mock devolve em segundos. O teto cobre os dois com folga,
  // porque um plano cortado por timeout aqui viraria "iframe vazio" no print.
  await exp.locator("table").first().waitFor({ timeout: 180_000 });
  await registrar("plano-de-aula-editor", "tabela do plano renderizada no editor");

  const editor = exp.locator('[contenteditable="true"]').first();
  await editor.click();
  await p.keyboard.press("End");
  await p.keyboard.type(" Editado no smoke visual.");
  await exp.getByText("Alterações não salvas", { exact: false }).waitFor({ timeout: 5_000 });
  await exp.getByRole("button", { name: "Salvar" }).click();
  await exp.getByText(/Salvo às/).waitFor({ timeout: 15_000 });
  await registrar("plano-de-aula-salvo");

  // Persistiu? Recarrega, abre o primeiro da lista e procura o texto digitado.
  await p.reload({ waitUntil: "domcontentloaded" });
  const exp2 = p.frameLocator('iframe[title="experiencia"]');
  await exp2.getByText("Meus planos de aula").waitFor({ timeout: 45_000 });
  await exp2.getByText(/Plano Anual/).first().click();
  await exp2.locator('[contenteditable="true"]').first().waitFor({ timeout: 15_000 });
  const persistiu = (await exp2.locator('[contenteditable="true"]').first().innerText()).includes("Editado no smoke visual.");
  console.log("   edição persistiu após recarregar:", persistiu ? "sim" : "NÃO");
  await registrar("plano-de-aula-reaberto", persistiu ? "conteúdo salvo voltou" : "CONTEÚDO NÃO VOLTOU");

  await exp2.getByRole("button", { name: "Meus planos" }).click();
  await exp2.getByText("Meus planos de aula").waitFor({ timeout: 10_000 });
  const antesDeExcluir = await exp2.getByText(/Plano Anual/).count();
  await exp2.getByRole("button", { name: /^Excluir / }).first().click();
  await p.waitForTimeout(1500);
  const depoisDeExcluir = await exp2.getByText(/Plano Anual/).count();
  // `confirm()` só funciona com `allow-modals` no sandbox do ExpFrame — sem
  // isso o clique é ignorado em silêncio e a contagem não muda.
  console.log("   excluir removeu da lista:", depoisDeExcluir < antesDeExcluir ? "sim" : "NÃO");
  await registrar("plano-de-aula-excluido", depoisDeExcluir < antesDeExcluir ? "lista diminuiu" : "LISTA NÃO MUDOU");

  // ---- bem-estar: exp-91 embedada no hub ----------------------------------
  // Fluxo completo do check-in do dia com o provider que estiver na api (com
  // `mock` os textos são os fixos do catálogo — o formulário é o mesmo).
  await p.goto(`${HUB}/professor`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1000);
  const cardBemEstar = p.locator('a[href="/professor/bem-estar"]');
  console.log("   card do bem-estar no hub:", (await cardBemEstar.count()) === 1 ? "sim" : "NÃO");
  console.log("   situação do card:", (await cardBemEstar.locator("span").filter({ hasText: /Check-in|minuto/ }).first().innerText().catch(() => "?")));
  await cardBemEstar.first().click();
  await p.waitForURL((url) => url.pathname === "/professor/bem-estar", { timeout: 30_000 });
  const bem = p.frameLocator('iframe[title="experiencia"]');
  await bem.getByText(/Como você está|Check-in de hoje feito/).first().waitFor({ timeout: 45_000 });
  const jaFeito = await bem.getByText("Check-in de hoje feito").isVisible().catch(() => false);
  if (jaFeito) {
    await registrar("bem-estar-ja-feito", "o check-in de hoje já estava registrado (1 por dia)");
  } else {
    await registrar("bem-estar-checkin", "3 frases do DASS-21 + pergunta aberta");
    console.log("   ícones no iframe:", await iconesNoFrame());
    // Uma resposta por frase: os grupos de rádio são as três frases do dia.
    // Marca pelo <input>: o DS põe o input (opacity 0) POR CIMA do rótulo, e o
    // Playwright recusa clicar num <span> coberto — para o humano é o mesmo clique.
    const grupos = bem.locator("fieldset");
    const total = await grupos.count();
    console.log("   frases na tela:", total);
    for (let i = 0; i < total; i += 1) {
      await grupos.nth(i).locator('input[type=radio][aria-label="Às vezes"]').check();
    }
    await bem.locator("textarea").fill("Semana corrida, mas a aula de hoje rendeu.");
    await registrar("bem-estar-respondido");
    await bem.getByRole("button", { name: "Enviar check-in" }).click();
    await bem.getByText("Check-in de hoje feito").waitFor({ timeout: 60_000 });
    await registrar("bem-estar-feito", "acolhimento + progresso do ciclo");
  }
  await bem.getByRole("button", { name: "Histórico" }).click();
  await bem.getByText("Seu histórico").waitFor({ timeout: 15_000 });
  await p.waitForTimeout(1500);
  await registrar("bem-estar-historico");

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
