import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Smoke VISUAL das telas do professor da exp-70: trilha → ficha → resultados da
 * turma → relatório de um aluno.
 *
 * O que ele existe para pegar, e que typecheck nenhum pega:
 *
 *   · o card transversal desenhando "Unidade undefined" (ele não tem unidade);
 *   · um valor de Schwartz aparecendo na LISTAGEM da turma — listagem é
 *     ordenável, e uma coluna "Poder" viraria um ranking de crianças;
 *   · um dos dez valores faltando na tela individual (mostrar só os que deram
 *     número faz a página parecer um retrato completo);
 *   · número impresso onde o grau não autoriza;
 *   · a seção das mensagens abrindo pelo que ela fez em vez do nível que recebeu.
 *
 * Uso: node scripts/walkthrough-professor-vila.mjs <pasta> [turma] [login]
 * Pré-requisitos: hub :3000, api :3001, e ao menos uma turma com partidas
 * (rode `walkthrough-vila-do-lume.mjs` com alguns alunos antes).
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-professor-vila";
const TURMA = process.argv[3] ?? "8A";
const USER = process.argv[4] ?? "prof.demo";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";

/** Os dez valores, em português. Nenhum deles pode vazar para a listagem. */
const VALORES_PT = [
  "Autodireção", "Estimulação", "Hedonismo", "Realização", "Poder",
  "Segurança", "Conformidade", "Tradição", "Benevolência", "Universalismo",
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const contexto = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
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
  await p.waitForTimeout(1500); // portão de hidratação
  await p.locator("#username").pressSequentially(USER, { delay: 20 });
  await p.locator("#password").pressSequentially(SENHA, { delay: 20 });
  await p.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    null,
    { timeout: 10_000 },
  );
  await p.click("button[type=submit]");
  /* Sai do /login e o middleware roteia por papel — a URL final pode ser `/`
     antes de `/professor`, então esperamos SAIR do login e navegamos direto. */
  await p.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });

  // ---- a trilha: o card transversal, fora da grade ------------------------
  await p.goto(`${HUB}/professor/entre-redes`, { waitUntil: "domcontentloaded" });
  const faixa = p.locator("text=Para qualquer ano").first();
  await faixa.waitFor({ timeout: 15_000 });
  const card = p.locator('a[href="/professor/entre-redes/vila-do-lume"]').first();
  await card.waitFor({ timeout: 10_000 });
  const textoDoCard = await card.innerText();
  exigir(!/Unidade/i.test(textoDoCard), `o card transversal fala em unidade: "${textoDoCard.slice(0, 80)}"`);
  exigir(/Transversal/.test(textoDoCard), "o card não se identifica como transversal");

  /* A faixa transversal tem de vir ANTES da grade de etapas: a grade é lida como
     "onde a minha missão mora", e um card sem ano dentro dela fica órfão. */
  const ordem = await p.evaluate(() => {
    const alvo = document.querySelector('a[href="/professor/entre-redes/vila-do-lume"]');
    const primeiraEtapa = Array.from(document.querySelectorAll("h2")).find((h) =>
      /Anos Iniciais/i.test(h.textContent ?? ""),
    );
    if (!alvo || !primeiraEtapa) return null;
    return alvo.getBoundingClientRect().top < primeiraEtapa.getBoundingClientRect().top;
  });
  exigir(ordem === true, "o card transversal não está acima da grade de etapas");
  await registrar("trilha-com-transversal", "acima da grade, sem unidade");

  // ---- a ficha -----------------------------------------------------------
  await card.click();
  await p.waitForURL("**/entre-redes/vila-do-lume", { timeout: 20_000 });
  const ficha = await p.locator("main").innerText();
  for (const trecho of ["golpe grosseiro", "autoridade e urgência", "o colega, e o momento exato"]) {
    exigir(ficha.includes(trecho), `a ficha não explica a bolha "${trecho}"`);
  }
  exigir(/Não conte nada antes/.test(ficha), "a ficha não avisa para não contar nada antes");
  /* O professor precisa saber, na ficha, que a missão vale para o ano DELE e quem
     consome o resultado — senão a Vila parece um jogo solto numa trilha por ano. */
  exigir(/Vale para qualquer ano/.test(ficha), "a ficha não diz que vale para qualquer ano");
  exigir(/Instanooria/.test(ficha), "a ficha não diz qual missão consome o perfil");
  exigir(/Passo a passo/.test(ficha), "a ficha não tem passo a passo");
  await registrar("ficha-da-missao", "3 bolhas + aviso + passo a passo + quem consome");

  // ---- o guia do debate --------------------------------------------------
  await p.locator("a", { hasText: "Guia do debate" }).first().click();
  await p.waitForURL("**/vila-do-lume/guia", { timeout: 20_000 });
  await p.locator("text=Em quem dava pra confiar?").first().waitFor({ timeout: 20_000 });
  await p.waitForTimeout(600);
  const guia = await p.locator("main").innerText();

  /* A REVELAÇÃO precisa ter as três versões do golpe. Sem elas não há aula: cada
     criança sai achando que a mensagem dela era A mensagem. Os textos vêm da api
     (`/vila/professor/cartoes`), não de cópia no hub — uma vírgula divergente
     poria a turma discutindo uma mensagem que ninguém recebeu. */
  /* Case-insensitive: o nome do remetente é renderizado com `uppercase` no CSS, e
     `innerText` devolve o texto TRANSFORMADO — comparar com a caixa original
     falharia num trecho que está na tela. */
  const guiaLower = guia.toLowerCase();
  for (const trecho of ["jogador 1000", "suporte da vila", "sentei atrás de ti"]) {
    exigir(guiaLower.includes(trecho), `a revelação não projeta o golpe: "${trecho}"`);
  }
  /* E as duas VERDADEIRAS, marcadas como tal: quem recusou tudo recusou o único
     aviso honesto que recebeu. */
  exigir(/pedra de fagulha atrás da Crista/.test(guia), "a revelação não mostra a legítima do Lume");
  exigir(/mensagem estranha agora há pouco/.test(guia), "a revelação não mostra o aviso legítimo");
  /* A instrução que impede o dano: a turma não pode sair achando que o Aluno 14
     fez alguma coisa. */
  exigir(
    /não foi um colega de verdade/i.test(guia),
    "o guia não manda dizer que o Aluno 14 não foi um colega de verdade",
  );
  exigir(/Nunca pergunte quem clicou/i.test(guia), "falta a instrução de não perguntar quem clicou");
  exigir(/Confere por outro caminho/.test(guia), "falta a regra que a turma leva");
  /* O guia tem de saber de QUAL turma se trata: nos anos iniciais a bolha B não é
     servida, e projetá-la mandaria o professor esperar a reação de um grupo que a
     sala dele não tem. */
  exigir(
    /Escolha a turma para ver só as mensagens que ela recebeu/.test(guia),
    "o guia não deixa escolher a turma — projetaria a bolha B para os anos iniciais",
  );
  await registrar("guia-do-debate", "3 golpes + 2 legítimas + travas + seletor de turma");

  // ---- resultados da turma ----------------------------------------------
  await p.goto(`${HUB}/professor/entre-redes/vila-do-lume/resultados`, { waitUntil: "domcontentloaded" });
  await p.locator("#turma").waitFor({ timeout: 20_000 });
  const opcao = p.locator("#turma option", { hasText: TURMA }).first();
  const valorDaTurma = await opcao.getAttribute("value");
  exigir(!!valorDaTurma, `turma ${TURMA} não está no seletor`);
  /* PORTÃO DE HIDRATAÇÃO: o seletor é Server Component + client, e em dev o HTML
     do SSR chega antes do bundle. Mudar o `<select>` nesse intervalo troca o
     valor no DOM sem disparar o `onChange` do React — o `router.push` não
     acontece e a página fica parada, sem erro nenhum. */
  await p.waitForTimeout(2000);
  await p.selectOption("#turma", valorDaTurma);
  await p.waitForURL("**turmaId=**", { timeout: 20_000 });
  await p.locator("text=As três bolhas nesta turma").first().waitFor({ timeout: 20_000 });
  await p.waitForTimeout(800);

  const tela = await p.locator("main").innerText();
  /* NENHUM valor de Schwartz na tela da turma. */
  const vazaram = VALORES_PT.filter((v) => tela.includes(v));
  exigir(vazaram.length === 0, `valor de Schwartz vazou para a listagem da turma: ${vazaram.join(", ")}`);

  const linhas = await p.locator("table tbody tr").count();
  exigir(linhas > 0, "a tabela da turma está vazia");

  /* A LETRA DA BOLHA TEM DE SER VISÍVEL, e `toBeVisible()` não pega isto:
     a cor da plataforma vem de classes escritas à mão em
     `packages/ui/styles/plataforma.css`, e o tema do Tailwind está vazio. Uma
     classe de fundo que não existe ali não é erro em lugar nenhum — o elemento
     só fica branco no branco. Foi o que aconteceu com `bg-unooria-neutral-900`.
     Por isso a checagem é no fundo COMPUTADO, não na presença do nó. */
  const circulo = await p.evaluate(() => {
    const el = Array.from(document.querySelectorAll("span")).find(
      (s) => /^[ABC]$/.test(s.textContent?.trim() ?? "") && s.className.includes("rounded-full"),
    );
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { letra: el.textContent?.trim(), fundo: cs.backgroundColor, cor: cs.color };
  });
  exigir(circulo !== null, "nenhuma letra de bolha (A/B/C) na tela da turma");
  if (circulo) {
    const transparente = /rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(circulo.fundo);
    exigir(
      !transparente,
      `a bolha "${circulo.letra}" tem texto ${circulo.cor} sobre fundo ${circulo.fundo} — invisível`,
    );
  }
  await registrar("resultados-da-turma", `${linhas} alunos, sem valor de Schwartz na listagem`);

  // ---- relatório individual ---------------------------------------------
  const abrir = p.locator("table tbody a", { hasText: "Abrir" }).first();
  exigir((await abrir.count()) > 0, "nenhum aluno com partida para abrir");
  await abrir.click();
  await p.waitForURL("**/vila-do-lume/alunos/**", { timeout: 20_000 });
  await p.locator("text=Os dez valores").first().waitFor({ timeout: 20_000 });
  await p.waitForTimeout(600);

  const relatorio = await p.locator("main").innerText();
  /* Os DEZ, sempre — inclusive os que não deram número. */
  const faltando = VALORES_PT.filter((v) => !relatorio.includes(v));
  exigir(faltando.length === 0, `valores faltando na tela individual: ${faltando.join(", ")}`);

  /* A ressalva e o nível vêm antes dos números. */
  /* A ressalva tem de vir ANTES de qualquer número: o que a página mostra é
     hipótese de design, não instrumento validado. */
  const posRessalva = relatorio.indexOf("não um teste");
  const posValores = relatorio.indexOf("Os dez valores");
  exigir(posRessalva > 0, "a tela não abre com a ressalva de que isto não é um teste");
  exigir(
    posRessalva < posValores,
    "a ressalva aparece DEPOIS dos números — ela existe para ser lida antes",
  );
  exigir(
    /hipótese de design/i.test(relatorio),
    "a tela não diz que o mapeamento é hipótese de design",
  );
  exigir(/Não leia na frente dela/i.test(relatorio), "falta o aviso de não ler na frente da criança");
  const posNivel = relatorio.indexOf("O golpe que ela recebeu");
  const posTabela = relatorio.indexOf("Mensagem por mensagem");
  exigir(posNivel > 0, "a seção das mensagens não abre pelo nível recebido");
  exigir(posTabela === -1 || posNivel < posTabela, "o nível aparece DEPOIS do que ela fez");

  /* Nenhum número onde o grau não autoriza: as linhas sem número dizem por quê. */
  const semNumero = [
    "um sinal só — não dá para pôr número",
    "a oportunidade não chegou até ela",
    "teve a chance e não foi por ali",
  ].filter((t) => relatorio.includes(t));
  exigir(
    semNumero.length > 0,
    "nenhuma linha explica ausência de número — ou todos os dez viraram número (improvável)",
  );
  await registrar(
    "relatorio-do-aluno",
    `10 valores, ${semNumero.length} tipos de ausência explicados, nível antes do ato`,
  );
} catch (erro) {
  falhou = true;
  console.error("✖ o walkthrough parou:", String(erro).slice(0, 400));
  await p.screenshot({ path: `${OUT}/ERRO.png`, fullPage: true }).catch(() => {});
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
