import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

/**
 * Smoke VISUAL do ciclo inteiro de pessoas: importar → enturmar → primeiro
 * acesso → o professor vendo a turma dele.
 *
 * É o caminho que nenhum typecheck pega: cabeçalho de CSV que o parser recusa,
 * tabela vazia porque a matrícula não foi criada, ícone do DS virando texto, e o
 * beco sem saída da troca de senha (a pessoa troca e volta para a mesma tela).
 *
 * Uso: node scripts/walkthrough-admin-usuarios.mjs <pasta-de-prints>
 * Pré-requisitos: `pnpm dev` (ou `pnpm docker:dev`) no ar + `pnpm seed`.
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-admin";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";
const SENHA_DO_LOTE = "PlanilhaSmoke2026";
const SENHA_ESCOLHIDA = "MinhaSenhaSmoke1";
const TURMA = "9Z";

/** Uma linha por pessoa. O professor traz login; os alunos deixam a api gerar. */
const PLANILHA = [
  "matricula,nome,usuario,email,papel,turma,serie,turno",
  `SMOKE-P1,Marta Nunes Alves,marta.smoke,marta@escola.exemplo,professor,${TURMA},9EF,manha`,
  `SMOKE-A1,Ana Paula Ribeiro,,,aluno,${TURMA},9EF,manha`,
  `SMOKE-A2,Bruno Reis Silva,,,aluno,${TURMA},9EF,manha`,
  `SMOKE-A3,Caio Prado Lima,,,aluno,${TURMA},9EF,manha`,
  `SMOKE-A4,Duda Nogueira Melo,,,aluno,${TURMA},9EF,manha`,
  `SMOKE-A5,Elis Ramos Costa,,,coordenacao,,,`,
  "",
].join("\n");

const TURMA_ONEROSTER = "6C";
const MANIFESTO = [
  "propertyName,value",
  "manifest.version,1.0",
  "oneroster.version,1.2",
  "source.systemName,Smoke da Unooria",
  "file.orgs,absent",
  "file.academicSessions,delta",
  "file.classes,delta",
  "file.users,delta",
  "file.enrollments,delta",
  "file.roles,delta",
  "",
].join("\n");

/** Um lote mínimo, na ordem de dependência. `sourcedId` prefixado por `sm-`. */
const LOTE_ONEROSTER = {
  academicSessions: [
    "sourcedId,title,type,startDate,endDate,schoolYear",
    "sm-ano-2026,Ano letivo 2026,schoolYear,2026-01-01,2026-12-31,2026",
    "",
  ].join("\n"),
  classes: [
    "sourcedId,title,grades,classType,schoolSourcedId,termSourcedIds",
    `sm-turma-6c,${TURMA_ONEROSTER},06,homeroom,escola-demo,sm-ano-2026`,
    "",
  ].join("\n"),
  users: [
    "sourcedId,enabledUser,username,givenName,familyName,identifier,role",
    "sm-prof-1,true,,Helena,Braga,SM-P1,teacher",
    "sm-aluno-1,true,,Tiago,Amorim,SM-A1,student",
    "sm-aluno-2,true,,Vera,Pontes,SM-A2,student",
    "",
  ].join("\n"),
  enrollments: [
    "sourcedId,classSourcedId,schoolSourcedId,userSourcedId,role,primary,beginDate",
    "sm-mat-1,sm-turma-6c,escola-demo,sm-prof-1,teacher,true,2026-02-01",
    "sm-mat-2,sm-turma-6c,escola-demo,sm-aluno-1,student,true,2026-02-01",
    "sm-mat-3,sm-turma-6c,escola-demo,sm-aluno-2,student,true,2026-02-01",
    "",
  ].join("\n"),
};

mkdirSync(OUT, { recursive: true });
const ARQUIVO = join(OUT, "planilha-do-smoke.csv");
writeFileSync(ARQUIVO, PLANILHA, "utf8");

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
async function entrar(usuario, senha = SENHA) {
  await contexto.clearCookies();
  await p.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("button[type=submit]");
  await p.waitForTimeout(1500);
  await p.locator("#username").pressSequentially(usuario, { delay: 20 });
  await p.locator("#password").pressSequentially(senha, { delay: 20 });
  await p.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    null,
    { timeout: 10_000 },
  );
  await p.click("button[type=submit]");
  // A raiz só ROTEIA (`app/page.tsx` redireciona por papel). Parar em "/" tira
  // print de uma tela em branco e faz o teste de ícone dizer "sem ícone".
  await p.waitForURL((url) => !url.pathname.startsWith("/login") && url.pathname !== "/", {
    timeout: 30_000,
  });
  await p.waitForTimeout(1500);
}

/** Ícone do DS é fonte de ligadura: sem a fonte, o <span> mostra o NOME. */
async function iconesViraramTexto() {
  return p.evaluate(() => {
    const alvo = [...document.querySelectorAll("span")].find((s) =>
      (s.className || "").toString().includes("material-symbols"),
    );
    if (!alvo) return "sem ícone na tela";
    const carregou = document.fonts.check(`24px "Material Symbols Rounded"`);
    return carregou ? "ok" : `FONTE NÃO CARREGOU (${getComputedStyle(alvo).fontFamily.split(",")[0]})`;
  });
}

try {
  // ---- gestor: o modelo, a importação e a turma que nasce dela -------------
  await entrar("gestor.demo");
  await registrar("admin-usuarios", p.url().replace(HUB, ""));
  console.log("   ícones:", await iconesViraramTexto());

  // O modelo vem da MESMA constante que o parser lê: se o cabeçalho aqui não
  // for o esperado, a importação de amanhã falha com "coluna desconhecida".
  const modelo = await p.request.get(`${HUB}/api/plataforma/rostering/modelos/usuarios.csv`);
  const cabecalho = (await modelo.text()).replace(/^\uFEFF/, "").split("\n")[0].trim();
  const esperado = "matricula,nome,usuario,email,papel,turma,serie,turno";
  console.log("   modelo para download:", cabecalho === esperado ? "ok" : `DIVERGENTE (${cabecalho})`);

  await p.goto(`${HUB}/admin/importar`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await registrar("admin-importar", "modelo, modo de senha e envio");

  await p.locator("#senha-padrao").fill(SENHA_DO_LOTE);
  await p.getByRole("button", { name: "Enviar arquivo" }).click();
  await p.waitForTimeout(800);
  await p.locator('input[type="file"]').setInputFiles(ARQUIVO);
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Importar" }).last().click();

  await p.getByText(/criados.*atualizados/).waitFor({ timeout: 30_000 });
  const resumo = await p.getByText(/criados.*atualizados/).first().innerText();
  await registrar("importacao-relatorio", resumo.replace(/\n/g, " · "));

  await p.goto(`${HUB}/admin/turmas`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const linhaDaTurma = p.locator("table tbody tr", { hasText: TURMA });
  const achouTurma = (await linhaDaTurma.count()) > 0;
  await registrar("admin-turmas", achouTurma ? `turma ${TURMA} na lista` : `TURMA ${TURMA} NÃO APARECEU`);

  if (achouTurma) {
    await linhaDaTurma.getByRole("button", { name: "Abrir" }).click();
    await p.waitForURL("**/admin/turmas/**", { timeout: 15_000 });
    await p.waitForTimeout(1500);
    const alunos = await p.locator("table tbody tr").count();
    await registrar("admin-turma-alunos", `${alunos} aluno(s) matriculados`);
  }

  // ---- o outro caminho: o binding CSV do OneRoster ------------------------
  await p.goto(`${HUB}/admin/importar`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.getByRole("tab", { name: /OneRoster/ }).click().catch(async () => {
    await p.locator("text=OneRoster 1.2").first().click();
  });
  await p.waitForTimeout(600);
  await registrar("oneroster-arquivos", "os sete arquivos, na ordem de dependência");

  // O manifesto pela TELA (prova a aba + o modal); os demais pela api, porque o
  // valor do smoke aqui é visual, não sete danças de modal.
  writeFileSync(join(OUT, "manifest.csv"), MANIFESTO, "utf8");
  await p.locator("li", { hasText: "1. manifest.csv" }).getByRole("button", { name: "Enviar" }).click();
  await p.waitForTimeout(600);
  await p.locator('input[type="file"]').setInputFiles(join(OUT, "manifest.csv"));
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Enviar" }).last().click();
  await p.getByText(/manifest.csv:/).waitFor({ timeout: 20_000 });
  await registrar("oneroster-manifesto", "versão conferida e lote declarado");

  for (const [arquivo, conteudo] of Object.entries(LOTE_ONEROSTER)) {
    const params = new URLSearchParams({ modo: "delta" });
    if (arquivo === "users") params.set("senhaPadrao", SENHA_DO_LOTE);
    const resposta = await p.request.post(
      `${HUB}/api/plataforma/rostering/oneroster/${arquivo}?${params}`,
      { headers: { "content-type": "text/csv" }, data: conteudo },
    );
    const corpo = await resposta.json();
    console.log(
      `   ${arquivo}.csv: ${corpo.criados} novos, ${corpo.atualizados} atualizados, ` +
        `${corpo.matriculados} enturmados, ${corpo.erros?.length ?? 0} erro(s)`,
    );
    if (corpo.erros?.length) console.log("     erros:", JSON.stringify(corpo.erros).slice(0, 240));
  }

  await p.goto(`${HUB}/admin/turmas`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const turmaOneRoster = p.locator("table tbody tr", { hasText: TURMA_ONEROSTER });
  await registrar(
    "oneroster-turma",
    (await turmaOneRoster.count()) > 0
      ? `turma ${TURMA_ONEROSTER} veio do padrão`
      : `TURMA ${TURMA_ONEROSTER} NÃO APARECEU`,
  );

  // ---- contas de assento: o diagnóstico da virada -------------------------
  await p.goto(`${HUB}/admin/importar`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1000);
  await p.getByRole("button", { name: "Listar contas sem matrícula" }).click();
  await p.waitForTimeout(1500);
  const semMatricula = await p.locator("table tbody tr").count();
  await registrar("contas-de-assento", `${semMatricula} conta(s) sem RA na primeira página`);

  // ---- reset de senha: é o caminho de quem perdeu a folha do lote ----------
  await p.goto(`${HUB}/admin/usuarios`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  await p.locator("#busca").pressSequentially("marta.smoke", { delay: 20 });
  await p.waitForTimeout(1500);
  await registrar("admin-busca", "busca por login");

  await p.getByRole("button", { name: "Resetar senha" }).first().click();
  // O diálogo do DS tem o botão "Resetar"; a linha da tabela tem "Resetar
  // senha". Sem escopar no modal, o `getByRole` casa com os dois.
  await p.getByTestId("unooria-modal").getByRole("button", { name: "Resetar" }).click();
  await p.locator("code").first().waitFor({ timeout: 15_000 });
  const senhaTemporaria = (await p.locator("code").first().innerText()).trim();
  await registrar("senha-temporaria", "devolvida uma vez, não fica em coluna nem em log");

  // ---- o professor importado: primeiro acesso e a turma dele --------------
  await entrar("marta.smoke", senhaTemporaria);
  const presoNaTroca = new URL(p.url()).pathname === "/trocar-senha";
  await registrar("primeiro-acesso", presoNaTroca ? "preso em /trocar-senha" : "NÃO PRENDEU NA TROCA");

  await p.locator("#senha-atual").pressSequentially(senhaTemporaria, { delay: 20 });
  await p.locator("#senha-nova").pressSequentially(SENHA_ESCOLHIDA, { delay: 20 });
  await p.locator("#senha-confirmacao").pressSequentially(SENHA_ESCOLHIDA, { delay: 20 });
  await p.getByRole("button", { name: "Salvar e continuar" }).click();
  await p.waitForURL(
    (url) => url.pathname !== "/trocar-senha" && url.pathname !== "/",
    { timeout: 30_000 },
  );
  await p.waitForTimeout(2000);
  await registrar("hub-do-professor", p.url().replace(HUB, ""));

  await p.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const nomesDasTurmas = await p.locator("main a[href^='/professor/turmas/'], a[href^='/professor/turmas/']").allInnerTexts();
  const soAsDela = nomesDasTurmas.length > 0 && nomesDasTurmas.every((t) => t.includes(TURMA));
  await registrar(
    "minhas-turmas",
    soAsDela ? `só ${TURMA} — as turmas do prof.demo não vazaram` : `VAZOU: ${nomesDasTurmas.join(" | ")}`,
  );

  // Espera a navegação de verdade: o print sem isto sai da LISTA, e o teste
  // seguinte conta zero aluno numa tela que nem é a da turma.
  await Promise.all([
    p.waitForURL(/\/professor\/turmas\/[0-9a-f-]{36}/, { timeout: 20_000 }),
    p.locator('a[href^="/professor/turmas/"]').first().click(),
  ]);
  await p.waitForTimeout(1500);
  const alunosNominais = await p.locator("a[href^='/professor/entre-redes/vila-do-lume/alunos/']").count();
  await registrar("turma-do-professor", `${alunosNominais} aluno(s) nominais na lista`);

  console.log("\n--- passos ---");
  passos.forEach((linha) => console.log(linha));
  console.log("\nerros de console:", erros.length ? erros : "nenhum");
  console.log(`prints em ${OUT}/`);
} finally {
  await browser.close();
}
