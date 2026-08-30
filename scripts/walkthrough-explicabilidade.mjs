import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { vigiarFalhasDaApi } from "./lib/smoke.mjs";

/**
 * Smoke VISUAL da EXPLICABILIDADE da exp-01 — o fechamento da missão.
 *
 * O `walkthrough-aluno.mjs` para no feed, de propósito: ele cobre a entrada. Da
 * revelação em diante ninguém chegava por script, e é justamente onde mora a
 * tela mais densa do produto e a única que sai do aparelho.
 *
 * DOIS CONTEXTOS, como o da exp-03: o professor conduz o relógio da turma e o
 * aluno joga. Nada avança sem o botão do professor, então um contexto só não
 * consegue chegar ao fim.
 *
 * O que ele PROVA, e que typecheck nenhum pega:
 *
 * 1. O aparelho EXPANDE no relatório — comparando a `boundingBox` do iframe
 *    antes e depois do "Ver meu relatório".
 * 2. E expande SEM RECARREGAR: uma marca é escrita dentro do frame antes da
 *    expansão e precisa continuar lá depois. Se a árvore React trocar, o
 *    `<iframe>` é remontado, a marca some e o aluno volta para a revelação com
 *    a sessão recarregada — o modo de falha que a ADR-41 existe para impedir.
 * 3. O relatório é CLARO: o `backgroundColor` COMPUTADO do fundo, não a classe.
 * 4. E CONTRAI quando o professor avança para "o que perderam", ainda sem
 *    recarregar.
 *
 * Uso: node scripts/walkthrough-explicabilidade.mjs <pasta-de-prints>
 * Pré-requisitos: a stack no ar (hub :3000, api :3001, exp :5173) e o seed
 * (`pnpm --filter @edu/api seed && seed:demo`).
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/wt-explicabilidade";
const ALUNO = process.argv[3] ?? "aluno03";
const PROFESSOR = "prof.demo";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const passos = [];
const problemas = [];

const registrar = async (pagina, nome, detalhe = "") => {
  await pagina.screenshot({ path: `${OUT}/${passos.length + 1}-${nome}.png` });
  passos.push(`${passos.length + 1}. ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  console.log(`✓ ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
};

/** Falha alto: um smoke que registra o defeito e sai com 0 não é smoke. */
const exigir = (condicao, oque) => {
  if (!condicao) {
    problemas.push(oque);
    console.error(`✗ ${oque}`);
  } else {
    console.log(`  ✓ ${oque}`);
  }
};

/** Login com PORTÃO DE HIDRATAÇÃO: em dev o SSR chega antes do bundle. */
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
  await pagina.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

/* A exp-01 mostra erro em `<p>` avulso, com classe diferente em cada tela — não
   há gancho estável para correr contra, como há na exp-90. O sinal aqui é a
   RESPOSTA da api: não derruba o roteiro, mas põe a causa no relatório.
   Declarado FORA do `try`: `const` dentro do bloco é invisível ao `catch`, e a
   referência de lá viraria ReferenceError mascarando a falha de verdade. */
const falhasDaApi = [];

try {
  // ---- o professor, e a atividade ----------------------------------------
  const ctxProf = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const prof = await ctxProf.newPage();
  vigiarFalhasDaApi(prof, falhasDaApi, "professor");
  await entrar(prof, PROFESSOR);

  const lista = await prof.request.get(`${HUB}/api/plataforma/atividades`);
  const { atividades } = await lista.json();
  const atividade = (atividades ?? []).find((a) => a.status === "ativa") ?? atividades?.[0];
  if (!atividade) throw new Error("nenhuma atividade no seed — rode `seed:demo`");

  /**
   * Zera a turma e volta o relógio. Sem isto a segunda execução acha o aluno já
   * na explicabilidade e não exercita nada do caminho.
   */
  await prof.request.post(`${HUB}/api/plataforma/atividades/${atividade.id}/limpar`);
  await prof.request.post(`${HUB}/api/plataforma/atividades/${atividade.id}/etapa`, {
    data: { etapa: "investigacao" },
  });
  await prof.goto(`${HUB}/professor/atividades/${atividade.id}`, { waitUntil: "domcontentloaded" });
  await prof.waitForTimeout(2500);
  await registrar(prof, "professor-na-atividade", `${atividade.titulo} · turma zerada`);

  // ---- o aluno entra e usa o feed ----------------------------------------
  const ctxAluno = await browser.newContext({
    viewport: { width: 1280, height: 950 },
    deviceScaleFactor: 2,
  });
  const p = await ctxAluno.newPage();
  const erros = [];
  p.on("console", (m) => m.type() === "error" && erros.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => erros.push("PAGEERROR: " + String(e).slice(0, 200)));
  vigiarFalhasDaApi(p, falhasDaApi, "aluno");

  await entrar(p, ALUNO);
  await p.goto(`${HUB}/exp/exp-01-instanooria`, { waitUntil: "domcontentloaded" });

  const aparelho = p.locator('iframe[title="experiencia"]');
  await aparelho.waitFor({ state: "attached", timeout: 20_000 });
  const tela = p.frameLocator('iframe[title="experiencia"]');
  await tela.locator("text=Instanooria").first().waitFor({ timeout: 30_000 });
  await p.waitForTimeout(2000);

  const entrar1 = tela.locator("button", { hasText: "Entrar no Instanooria" });
  if (await entrar1.count()) {
    await entrar1.click();
    await tela.locator('[aria-label="Escolha sua figurinha"] button').first().click();
    await tela.locator('input[placeholder="seu nome"]').pressSequentially("Bia", { delay: 25 });
    await tela.locator("button", { hasText: "Salvar e entrar" }).click();
    await p.waitForTimeout(7000);
  }

  const cards = tela.locator("article[data-post-id]");
  const quantosCards = await cards.count();
  if (quantosCards > 0) {
    await cards.nth(Math.min(2, quantosCards - 1)).scrollIntoViewIfNeeded();
    await p.waitForTimeout(3500); // o IntersectionObserver mede o dwell
  }
  const caixaNoFeed = await aparelho.boundingBox();
  await registrar(
    p,
    "aluno-no-feed",
    `${quantosCards} cards · iframe ${Math.round(caixaNoFeed.width)}×${Math.round(caixaNoFeed.height)}`,
  );
  exigir(
    Math.round(caixaNoFeed.width) <= 400,
    `no feed o aparelho é estreito (${Math.round(caixaNoFeed.width)}px)`,
  );

  // ---- o professor conduz até a explicação --------------------------------
  for (const etapa of ["conclusao", "debate", "explicabilidade"]) {
    const r = await prof.request.post(`${HUB}/api/plataforma/atividades/${atividade.id}/etapa`, {
      data: { etapa },
    });
    if (!r.ok()) throw new Error(`etapa ${etapa}: ${r.status()} ${await r.text()}`);
    await p.waitForTimeout(1500);
  }
  await prof.reload({ waitUntil: "domcontentloaded" });
  await prof.waitForTimeout(2500);
  await registrar(prof, "painel-na-explicacao");

  // O aluno é levado pelo polling de 5s do relógio da turma.
  await tela
    .locator("text=O Instanooria não é uma rede social de verdade")
    .waitFor({ timeout: 30_000 });
  await registrar(p, "revelacao-tela-1", "fundo escuro, uma frase por vez");

  /**
   * A MARCA. Cross-origin, o hub não alcança o `contentWindow` — mas o
   * Playwright alcança o frame. Se o iframe for remontado, ela some.
   *
   * O frame vem do PRÓPRIO elemento, nunca de casar a URL: a página do hub é
   * `/exp/exp-01-instanooria`, então procurar por "exp-01" na lista de frames
   * devolvia o frame de cima — e todas as verificações passavam a falar do hub.
   * A de "não recarregou" ficava verde por construção.
   */
  const frame = await (await aparelho.elementHandle()).contentFrame();
  if (!frame) throw new Error("não consegui alcançar o frame da experiência");
  await frame.evaluate(() => {
    window.__marcaDoSmoke = "viva";
  });

  // ---- as 7 telas ---------------------------------------------------------
  let telas = 0;
  for (let i = 0; i < 10; i += 1) {
    const continuar = tela.locator("button", { hasText: "Continuar" });
    if (!(await continuar.count())) break;
    await continuar.click();
    telas += 1;
    await p.waitForTimeout(700);
  }
  const verRelatorio = tela.locator("button", { hasText: "Ver meu relatório" });
  await verRelatorio.waitFor({ timeout: 15_000 });
  const caixaAntes = await aparelho.boundingBox();
  await registrar(p, "revelacao-ultima-tela", `${telas + 1} telas · botão "Ver meu relatório"`);

  // ---- O RELATÓRIO: expande, não recarrega, e é claro ---------------------
  await verRelatorio.click();
  /**
   * Espera um elemento do FIM do relatório, não o cabeçalho: o conteúdo vem de
   * um `React.lazy` (é assim que o CSS da plataforma fica fora do bundle do
   * feed), e medir logo depois do título pegava a tela ainda montando — dava
   * fundo transparente e zero gráfico, que lia como bug de tema.
   */
  await tela.locator("button", { hasText: "Copiar relatório" }).waitFor({ timeout: 25_000 });
  await p.waitForTimeout(1200); // a transição do DispositivoFrame
  const caixaDepois = await aparelho.boundingBox();
  await registrar(
    p,
    "relatorio-expandido",
    `iframe ${Math.round(caixaAntes.width)}px → ${Math.round(caixaDepois.width)}px`,
  );

  exigir(
    caixaDepois.width > caixaAntes.width * 1.5,
    `o aparelho expandiu (${Math.round(caixaAntes.width)} → ${Math.round(caixaDepois.width)}px)`,
  );

  const marcaViva = await frame.evaluate(() => window.__marcaDoSmoke).catch(() => null);
  exigir(marcaViva === "viva", "o iframe NÃO recarregou ao expandir (a marca sobreviveu)");

  /**
   * Sobe da âncora até achar quem realmente PINTA — é o que o navegador faz.
   * Medir um seletor fixo pegava um contêiner transparente e acusava tema
   * errado onde o tema estava certo.
   */
  const fundo = await frame.evaluate(() => {
    const botao = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Copiar relatório"),
    );
    let no = botao?.parentElement ?? document.body;
    while (no && no !== document.documentElement) {
      const cor = getComputedStyle(no).backgroundColor;
      if (cor && cor !== "transparent" && !cor.endsWith(", 0)")) return cor;
      no = no.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  });
  const claro = (() => {
    const m = fundo.match(/\d+/g);
    if (!m) return false;
    const [r, g, b] = m.map(Number);
    return (r + g + b) / 3 > 200; // o `night` (#0B0B10) daria ~12
  })();
  exigir(claro, `o relatório é de tema CLARO (backgroundColor computado: ${fundo})`);

  const graficos = await frame.evaluate(() => document.querySelectorAll("svg[role=img]").length);
  exigir(graficos >= 2, `os gráficos que não cabiam no aparelho apareceram (${graficos} svg)`);

  // ---- e CONTRAI quando o professor avança --------------------------------
  await prof.request.post(`${HUB}/api/plataforma/atividades/${atividade.id}/etapa`, {
    data: { etapa: "perdidos" },
  });
  await p.waitForTimeout(9000); // o polling da experiência é de 5s
  const caixaPerdidos = await aparelho.boundingBox();
  await registrar(
    p,
    "perdidos-contraiu",
    `iframe de volta a ${Math.round(caixaPerdidos.width)}px`,
  );

  exigir(
    caixaPerdidos.width < caixaDepois.width * 0.6,
    `o aparelho voltou ao formato de celular (${Math.round(caixaPerdidos.width)}px)`,
  );
  const marcaAindaViva = await frame.evaluate(() => window.__marcaDoSmoke).catch(() => null);
  exigir(marcaAindaViva === "viva", "o iframe NÃO recarregou ao contrair");

  const moldura = await p.locator("text=o feed que você não recebeu").count();
  exigir(moldura > 0, "a moldura dos posts perdidos apareceu no hub, fora do aparelho");

  // ---- as telas do PROFESSOR que contam a mesma história -----------------
  await prof.goto(`${HUB}/professor/entre-redes/8-ano/unidade-1/guia`, {
    waitUntil: "domcontentloaded",
  });
  await prof.waitForTimeout(2000);
  await registrar(prof, "guia-da-aula");

  const seteMomentos = await prof.locator("text=os 7 momentos").count();
  exigir(seteMomentos > 0, 'o guia fala em "os 7 momentos", e não mais em "os seis botões"');
  const encerrarAtividade = await prof.locator("text=Encerrar atividade").count();
  exigir(encerrarAtividade > 0, "o 7º passo aparece na tabela do guia");
  const revelacaoNoGuia = await prof
    .locator("text=O Instanooria não é uma rede social de verdade")
    .count();
  exigir(revelacaoNoGuia > 0, "o professor lê a revelação palavra por palavra, antes da aula");

  await prof.goto(`${HUB}/professor/atividades/${atividade.id}`, {
    waitUntil: "domcontentloaded",
  });
  await prof.waitForTimeout(3000);
  await registrar(prof, "painel-do-professor");

  const faixa = await prof.locator("text=posts de tese aprovados").count();
  exigir(faixa > 0, 'a faixa diz "de tese", em vez de somar os neutros com o alvo da tese');
  const envolvimento = await prof.locator("th", { hasText: "Envolvimento" }).count();
  exigir(envolvimento > 0, 'a coluna se chama "Envolvimento" — um número, um nome');

  /**
   * A seção nova do relatório do professor consome `explicacaoDoLado`, que o
   * popup não lia. Verifico o PAYLOAD, não o clique: o `Modal` do DS não abre
   * por clique programático neste contexto (nem dialog nem overlay aparecem no
   * DOM depois dele), e forçar isso testaria o Playwright, não o produto. O que
   * importa aqui é que o dado chega — a renderização é a mesma expressão que a
   * tela do aluno já usa, e essa o smoke exercita acima.
   */
  const runs = await prof.request.get(`${HUB}/api/plataforma/atividades/${atividade.id}/monitor`);
  const { runs: linhas } = await runs.json();
  const comRun = (linhas ?? []).find((l) => l.runId);
  if (comRun) {
    const dossie = await prof.request.get(`${HUB}/api/plataforma/runs/${comRun.runId}/dossie`);
    const corpo = await dossie.json();
    const explicacao = corpo?.dossie?.explicacaoDoLado;
    exigir(
      Boolean(explicacao?.origem && explicacao?.ladoRotulo),
      `o relatório do professor recebe a explicação do lado (origem: ${explicacao?.origem})`,
    );
    const ocultados = corpo?.dossie?.postsOcultados;
    exigir(
      typeof ocultados?.ladoNaoObservado === "boolean",
      "o payload distingue “não houve lado dominante” de “escondeu 0 posts”",
    );
  }

  console.log("\n--- passos ---");
  passos.forEach((linha) => console.log(linha));
  console.log("\n--- erros de console (aluno) ---");
  console.log(erros.length ? erros.join("\n") : "(nenhum)");
  console.log("\n--- respostas de erro da api ---");
  console.log(falhasDaApi.length ? [...new Set(falhasDaApi)].join("\n") : "(nenhuma)");

  if (problemas.length > 0) {
    console.error(`\n✗ ${problemas.length} verificação(ões) falharam:`);
    problemas.forEach((linha) => console.error(`  - ${linha}`));
    process.exitCode = 1;
  } else {
    console.log(`\n✓ tudo verde. prints em ${OUT}/`);
  }
} catch (falha) {
  console.error("\n✗ walkthrough interrompido:", String(falha).slice(0, 600));
  console.error("respostas de erro da api:", falhasDaApi.length ? [...new Set(falhasDaApi)].join(" | ") : "(nenhuma)");
  process.exitCode = 1;
} finally {
  await browser.close();
}
