import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { ehRuidoDeDev, vigiarFalhasDaApi } from "./lib/smoke.mjs";

/**
 * Smoke VISUAL da exp-03-unoogpt (a Missão Tempestade), do login ao resultado.
 *
 * DOIS CONTEXTOS, e isso é o ponto: o relógio é da TURMA, e sem a largada do
 * professor o estudante não fala com o Cientista. O roteiro prova as duas metades —
 * primeiro que o estudante está BLOQUEADO, depois que a largada o libera. Um smoke
 * de um contexto só passaria com o relógio quebrado.
 *
 * Valida também: o handshake da SDK no iframe cross-origin, o mapa VAZIO no
 * começo (ponto cego é ausência, não zero), o orçamento de 3 perguntas debitado
 * no servidor, o portão da justificativa, e a ausência de erros de console.
 *
 * Uso: node scripts/walkthrough-estudante-unoogpt.mjs <pasta> [estudante] [turma]
 * Pré-requisitos: hub, api e a exp-03 (:5178) no ar + seed (turma 2A).
 * Com AI_PROVIDER=mock o Cientista responde "[mock] ..." — o roteiro aceita.
 * Os seletores abaixo são CONTRATO com a experiência (README da exp-03).
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-unoogpt";
const USER = process.argv[3] ?? "estudante2a01";
const TURMA = process.argv[4] ?? "2A";
const PROF = process.env.PROF_DEMO ?? "prof.demo";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const passos = [];
const erros = [];
const falhasDaApi = [];
let ruidoIgnorado = 0;

/** Login com portão de hidratação: em dev o SSR chega antes do bundle, e o
 *  `fill` do Playwright não move o estado do React. */
async function entrar(pagina, usuario) {
  await pagina.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
  await pagina.waitForSelector("button[type=submit]");
  await pagina.waitForTimeout(1500);
  await pagina.locator("#username").pressSequentially(usuario, { delay: 20 });
  await pagina.locator("#password").pressSequentially(SENHA, { delay: 20 });
  await pagina.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    null,
    { timeout: 10_000 },
  );
  await pagina.click("button[type=submit]");
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000, waitUntil: "domcontentloaded" });
}

/* A exp-03 mostra erro em `<p>` avulso, com classe diferente em cada tela — não
   há gancho estável para correr contra, como há na exp-90. Aqui o sinal é a
   RESPOSTA da api: ela não derruba o roteiro (um 404 de sondagem é esperado),
   mas põe a causa no relatório em vez de deixá-la invisível. */
function vigiar(pagina, rotulo) {
  // Reprova por erro de console, MENOS o ruído conhecido do Next (`lib/smoke.mjs`).
  const anotar = (texto) => (ehRuidoDeDev(texto) ? (ruidoIgnorado += 1) : erros.push(`[${rotulo}] ${texto}`));
  pagina.on("console", (m) => m.type() === "error" && anotar(m.text().slice(0, 200)));
  pagina.on("pageerror", (e) => anotar("PAGEERROR: " + String(e).slice(0, 200)));
  vigiarFalhasDaApi(pagina, falhasDaApi, rotulo);
}

const registrar = async (pagina, nome, detalhe = "") => {
  await pagina.screenshot({ path: `${OUT}/${passos.length + 1}-${nome}.png` });
  passos.push(`${passos.length + 1}. ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

try {
  // ═══ PROFESSOR: abre a aula, mas AINDA NÃO dá a largada ═══════════════════
  const ctxProf = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const prof = await ctxProf.newPage();
  vigiar(prof, "prof");
  await entrar(prof, PROF);

  await prof.goto(`${HUB}/professor/entre-redes/2-serie/unidade-1`, { waitUntil: "domcontentloaded" });
  await prof.waitForSelector("text=/largada/i", { timeout: 15_000 });
  await registrar(prof, "ficha-do-professor", "a faixa avisa que sem largada a missão não começa");

  await prof.click("text=Abrir a aula e os resultados");
  await prof.waitForURL("**/resultados**", { timeout: 20_000 });
  // O seletor de turma vem do banco: escolhe a 2A pelo rótulo.
  // `select#turma`, NÃO o primeiro `<select>` da página: quem tem mais de uma
  // lotação (prof.demo tem duas) ganhou um seletor de ESCOLA no cabeçalho, que
  // vem antes no DOM. Pegar o primeiro procurava "2A" entre nomes de escola e
  // acusava "rode o seed" — culpando o banco por uma mudança de header.
  const seletor = prof.locator("select#turma");
  await seletor.waitFor({ timeout: 15_000 });
  // `selectOption` só aceita label literal: acha o value da 2A entre as opções.
  const opcoes = await seletor.locator("option").evaluateAll((os) =>
    os.map((o) => ({ value: o.value, label: o.textContent ?? "" })),
  );
  const alvo = opcoes.find((o) => o.label.includes(TURMA) && o.value);
  if (!alvo) throw new Error(`turma ${TURMA} não está no seletor (rode o seed)`);
  await seletor.selectOption(alvo.value);
  await prof.waitForURL("**turmaId=**", { timeout: 20_000 });
  await prof.waitForSelector("text=Relógio da aula", { timeout: 20_000 });

  /* ZERAR PRIMEIRO — o estado desta missão é server-side e sobrevive ao
     roteiro: sem isto a segunda execução encontra o estudante já na investigação e
     o smoke falha por sucesso da rodada anterior. É o mesmo problema que o
     walkthrough da exp-02 resolve reiniciando pelo perfil. Aqui o reset é do
     PROFESSOR, e de graça ele cobre o caminho destrutivo. */
  if (await prof.locator("[data-zerar-turma]").count()) {
    await prof.click("[data-zerar-turma]");
    await prof.locator("text=/Apaga as partidas|apaga todas as partidas/i").first().waitFor({ timeout: 10_000 });
    await prof.locator("button", { hasText: /^Zerar a turma$/ }).last().click();
    await prof.waitForTimeout(2500);
    await registrar(prof, "turma-zerada", "partidas apagadas e relógio devolvido ao início");
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.waitForSelector("text=Relógio da aula", { timeout: 20_000 });
  }

  await registrar(prof, "aula-antes-da-largada", "cronômetro parado, botão 'Dar a largada' habilitado");

  // ═══ ESTUDANTE: bloqueado, porque a largada não veio ══════════════════════════
  const ctxEstudante = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const estudante = await ctxEstudante.newPage();
  vigiar(estudante, "estudante");
  await entrar(estudante, USER);
  await estudante.waitForURL((url) => url.pathname.includes("/estudante") || url.pathname.includes("/aluno"), { timeout: 30_000 });

  const cartao = estudante.locator("a", { hasText: "unooGPT" }).first();
  await cartao.waitFor({ timeout: 15_000 });
  await registrar(estudante, "hub-do-estudante", `${await estudante.locator("main ul > li").count()} missões`);

  await cartao.click();
  await estudante.waitForURL("**/exp/exp-03-unoogpt**", { timeout: 30_000 });
  const quadro = estudante.frameLocator('iframe[title="experiencia"]');
  // O briefing é a primeira tela: se o handshake da SDK falhou, nada aparece.
  await quadro.locator("text=/Não dá para atender todos/i").waitFor({ timeout: 40_000 });
  await registrar(estudante, "briefing", "handshake da SDK ok dentro do iframe");

  // Entrar ANTES da largada é a melhor prova do portão: a investigação abre, o
  // cronômetro aparece PARADO e o campo não aceita fala nenhuma.
  await quadro.locator("button", { hasText: /começar/i }).first().click();
  await quadro.locator("text=/Aguardando o professor/i").waitFor({ timeout: 25_000 });
  const campoBloqueado = quadro.locator("form input").first();
  await campoBloqueado.waitFor({ timeout: 20_000 });
  if (!(await campoBloqueado.isDisabled())) {
    throw new Error("o campo aceita fala ANTES da largada — o portão do relógio não está valendo");
  }
  await registrar(estudante, "estudante-esperando", "cronômetro parado e campo desabilitado");

  // ═══ PROFESSOR: dá a largada ══════════════════════════════════════════════
  await prof.click("text=Dar a largada");
  await prof.waitForSelector("text=Em andamento", { timeout: 20_000 });
  await registrar(prof, "largada-dada", "fase: Em andamento");

  // ═══ ESTUDANTE: agora a missão abre ═══════════════════════════════════════════
  // O polling do relógio é de 5s; recarregar é mais rápido e igualmente válido.
  /* O estudante JÁ está na investigação (ele entrou antes da largada, e o passo é
     server-side). Recarregar não o devolve ao briefing — o que muda é o
     cronômetro, que agora corre, e o campo, que agora aceita fala. É essa
     mudança que interessa. O polling é de 5s; o reload é mais rápido e
     igualmente válido. */
  await estudante.reload({ waitUntil: "domcontentloaded" });
  const q2 = estudante.frameLocator('iframe[title="experiencia"]');
  const campo = q2.locator("form input").first();
  await campo.waitFor({ timeout: 40_000 });
  await q2.locator("text=/Perguntas:/i").waitFor({ timeout: 20_000 });
  await q2.locator("text=/Para investigar/i").waitFor({ timeout: 20_000 });
  if (await campo.isDisabled()) {
    throw new Error("o campo continua bloqueado DEPOIS da largada — o relógio não liberou");
  }
  await registrar(estudante, "investigacao-liberada", "cronômetro correndo e campo habilitado");

  // O MAPA COMEÇA VAZIO: nenhum bairro entrega estimativa antes de haver fonte.
  const desenhados = await q2.locator("[data-bairro]").count();
  const comDado = await q2.locator('[data-bairro][data-com-dado="true"]').count();
  if (desenhados === 0) throw new Error("o mapa não desenhou bairro nenhum");
  if (comDado !== 0) {
    throw new Error(`${comDado} bairro(s) já têm dado antes de carregar fonte — o mapa deve começar VAZIO`);
  }
  await registrar(estudante, "mapa-vazio", `${desenhados} bairros desenhados, nenhum com dado`);

  /* UM TURNO COM O CIENTISTA.
     A asserção é a fala DO ESTUDANTE aparecendo na conversa — não a do agente. A
     primeira versão deste roteiro esperava por texto do assistente e passava
     sem turno nenhum: a mensagem de abertura dele já está na tela desde o
     começo, e o submit do formulário estava BLOQUEADO pelo sandbox. Um teste
     que passa com a funcionalidade quebrada é pior que teste nenhum. */
  const PERGUNTA = "onde mora mais gente?";
  /* ESPERAR A RESPOSTA HTTP, e não um sinal de tela.
     Com o provedor real o turno leva de 10 a 30 segundos, e recarregar antes de
     ele terminar encontra o banco ainda vazio — o teste falharia por corrida do
     roteiro, não por defeito do produto. Esperar o campo reabilitar não serve
     (ele não é desabilitado) e esperar texto do agente é o falso positivo que
     este roteiro já cometeu duas vezes. A resposta da rota é o único sinal que
     significa exatamente "o turno acabou". O `waitForResponse` é registrado
     ANTES do Enter, senão a resposta pode chegar antes de alguém escutar. */
  const turno = estudante.waitForResponse(
    (r) => r.url().includes("/unoogpt/pergunta") && r.request().method() === "POST",
    { timeout: 90_000 },
  );
  await campo.pressSequentially(PERGUNTA, { delay: 15 });
  await campo.press("Enter");
  await q2.locator(`text=${PERGUNTA}`).first().waitFor({ timeout: 60_000 });
  const resposta = await turno;
  if (!resposta.ok()) {
    throw new Error(`o turno voltou ${resposta.status()} — veja o log da api`);
  }

  /* A ASSERÇÃO DE VERDADE: a fala tem de SOBREVIVER a um reload.
     Ver o texto na tela não prova nada — o cliente mostra a fala do estudante
     otimistamente, na hora, e só a retira se a api falhar. Um turno que morre no
     provedor fica ~30s na tela antes de desaparecer, e o teste passaria nessa
     janela. O que só um turno gravado produz é a conversa voltar inteira depois
     de um F5, porque ela vem de `exp_03_mensagens`. */
  await estudante.reload({ waitUntil: "domcontentloaded" });
  const q3 = estudante.frameLocator('iframe[title="experiencia"]');
  await q3.locator(`text=${PERGUNTA}`).first().waitFor({ timeout: 40_000 });
  const orcamento = await q3.locator("text=/Perguntas:/").first().innerText();
  await registrar(estudante, "turno-do-cientista", `a fala sobreviveu ao F5 · ${orcamento.trim()}`);

  // ═══ PROFESSOR: a folha da turma já mostra a criança ══════════════════════
  await prof.reload({ waitUntil: "domcontentloaded" });
  await prof.waitForSelector(`[data-estudante="${USER}"], [data-aluno="${USER}"]`, { timeout: 20_000 });
  const linha = await prof.locator(`[data-estudante="${USER}"], [data-aluno="${USER}"]`).innerText();
  await registrar(prof, "folha-da-turma", linha.replace(/\s+/g, " ").slice(0, 90));

  // A listagem NÃO pode ter coluna de resgatados — é ranking de crianças.
  const cabecalho = (await prof.locator("thead").first().innerText()).toLowerCase();
  for (const proibido of ["resgatad", "salvas", "vítimas", "vitimas"]) {
    if (cabecalho.includes(proibido)) throw new Error(`a folha da turma tem coluna proibida: ${proibido}`);
  }
  await registrar(prof, "sem-ranking", "nenhuma coluna de resgatados na listagem");

  // ═══ PROFESSOR: a linha de uma criança, com a transcrição ═════════════════
  await prof.locator(`[data-estudante="${USER}"] a, [data-aluno="${USER}"] a`).first().click();
  await prof.waitForSelector("text=O que a missão mediu", { timeout: 20_000 });
  await prof.waitForSelector("text=A conversa", { timeout: 20_000 });
  await registrar(prof, "relatorio-individual", "graus + transcrição");

  console.log("\n" + passos.join("\n"));
  if (falhasDaApi.length > 0) {
    console.error(`\n! respostas de erro da api:\n` + [...new Set(falhasDaApi)].join("\n"));
  }
  if (erros.length > 0) {
    console.error(`\n✗ ${erros.length} erro(s) de console:\n` + erros.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`\n✓ sem erros de console${ruidoIgnorado ? ` (${ruidoIgnorado} de ruído conhecido do Next ignorados)` : ""}`);
  }
} catch (erro) {
  console.error("\n✗ FALHOU:", erro.message);
  if (falhasDaApi.length > 0) {
    console.error("respostas de erro da api:", [...new Set(falhasDaApi)].join(" | "));
  }
  // Diagnóstico: o que estava DENTRO do iframe quando quebrou. Sem isto o
  // timeout de um seletor não diz se a tela errada apareceu ou nenhuma.
  for (const pagina of browser.contexts().flatMap((c) => c.pages())) {
    const dentro = pagina.frames().find((f) => f.url().includes("5178"));
    if (!dentro) continue;
    const txt = await dentro.evaluate(() => document.body.innerText).catch(() => "(inacessível)");
    console.error("--- iframe da exp ---\n" + txt.slice(0, 800));
  }
  console.log(passos.join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
