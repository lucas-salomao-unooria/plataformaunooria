import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

/**
 * Smoke VISUAL da REDE: escola identificável, professor lotado em duas, e o
 * estudante transferido pelo CPF sem perder o histórico.
 *
 * É o caminho que nenhum teste de api enxerga: o seletor de escola no cabeçalho
 * mudando o que o professor vê, o CPF sendo reconhecido na importação de OUTRA
 * escola, e o histórico atravessando as duas.
 *
 * Uso: node scripts/walkthrough-rede.mjs <pasta-de-prints>
 * Pré-requisitos: stack no ar + `pnpm seed` (2 escolas, prof.demo nas duas).
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-rede";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";
const SENHA_DO_LOTE = "RedeSmoke2026";

/** CPF válido (dígitos verificadores conferem), usado só por este smoke. */
const CPF = "390.533.447-05";
const TURMA_ORIGEM = "3X";
const TURMA_DESTINO = "4X";

const PLANILHA_ORIGEM = [
  "cpf,matricula,nome,usuario,papel,turma,serie,turno",
  `${CPF},RED-A1,Iara Menezes Costa,iara.rede,estudante,${TURMA_ORIGEM},3EF,manha`,
  "",
].join("\n");

/** A MESMA criança, agora na outra escola: o CPF é o que a reconhece. */
const PLANILHA_DESTINO = [
  "cpf,matricula,nome,papel,turma,serie,turno",
  `${CPF},RED-A1,Iara Menezes Costa,estudante,${TURMA_DESTINO},4EF,tarde`,
  "",
].join("\n");

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "origem.csv"), PLANILHA_ORIGEM, "utf8");
writeFileSync(join(OUT, "destino.csv"), PLANILHA_DESTINO, "utf8");

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
  await p.waitForURL((url) => !url.pathname.startsWith("/login") && url.pathname !== "/", {
    timeout: 30_000,
  });
  await p.waitForTimeout(1500);
}

/** Importa uma planilha pela api, via BFF — o valor do smoke aqui é a TELA depois. */
async function importar(escolaId, arquivo) {
  const params = new URLSearchParams({ senhaPadrao: SENHA_DO_LOTE });
  if (escolaId) params.set("escolaId", escolaId);
  const resposta = await p.request.post(`${HUB}/api/plataforma/rostering/importar?${params}`, {
    headers: { "content-type": "text/csv" },
    data: arquivo,
  });
  const corpo = await resposta.json();
  return corpo;
}

try {
  // ---- admin do contrato: as escolas da rede ------------------------------
  await entrar("analise.unooria");
  await p.goto(`${HUB}/admin/escolas`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1800);
  const linhasDeEscola = await p.locator("table tbody tr").count();
  await registrar("escolas-da-rede", `${linhasDeEscola} escola(s) com contagem de gente e turma`);

  // ---- a regional agrupa as unidades -------------------------------------
  /* O nível entre a escola e o contrato. Ele AGRUPA para trabalhar em lote e não
     autoriza nada — quem dá acesso é a lotação, e é isso que os dois passos
     seguintes mostram na tela, um depois do outro. */
  /* O `Selection` do DS não é `<select>`: é um combobox com `role="option"`. */
  await p.getByRole("combobox", { name: /Tipo|Nível/ }).click();
  await p.getByRole("option", { name: "Regionais" }).click();
  await p.waitForTimeout(1500);
  const regionais = await p.locator("table tbody tr").allInnerTexts();
  await registrar(
    "regionais-da-rede",
    regionais.length ? regionais.map((t) => t.split("\n")[0]).join(", ") : "NENHUMA REGIONAL",
  );

  if (regionais.length > 0) {
    await p.locator("table tbody tr").first().getByRole("button", { name: "Ver unidades" }).click();
    await p.waitForTimeout(1800);
    const unidades = await p.locator("table tbody tr").allInnerTexts();
    await registrar(
      "unidades-da-regional",
      `${unidades.length} unidade(s): ${unidades.map((t) => t.split("\n")[0]).join(", ")}`,
    );

    // ---- lotação em lote: é assim que nasce o supervisor de diretoria -----
    /* O `<input>` do Checkbox do DS é sr-only e o `<label>` cobre o clique:
       `force` mira o input em vez de esperar que ele receba o ponteiro. */
    await p
      .getByRole("checkbox", { name: "Selecionar todas as linhas" })
      .check({ force: true });
    await p.waitForTimeout(600);
    await registrar("unidades-selecionadas", `${unidades.length} marcada(s), barra de ação visível`);

    await p.getByRole("button", { name: "Lotar pessoa nestas escolas" }).click();
    await p.getByText("Onde a pessoa está hoje").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(800);

    const dialogo = p.getByTestId("unooria-modal");
    await dialogo.getByRole("combobox", { name: /Onde a pessoa está hoje/ }).click();
    await p.getByRole("option", { name: "EE Vila Nova" }).first().click();
    await dialogo.locator("#busca-pessoa-lote").pressSequentially("Gestor Vila Nova", { delay: 20 });
    await p.waitForTimeout(1800);

    const seletorDePessoa = dialogo.getByRole("combobox", { name: /^Pessoa/ });
    if ((await seletorDePessoa.count()) > 0) {
      await seletorDePessoa.click();
      await p.getByRole("option", { name: /Gestor Vila Nova/ }).first().click();
      await p.waitForTimeout(400);
      await Promise.all([
        p.waitForResponse(
          (r) => r.url().includes("/escolas/lotacoes-em-lote") && r.request().method() === "POST",
          { timeout: 20_000 },
        ),
        dialogo.getByRole("button", { name: "Lotar", exact: true }).click(),
      ]);
      await p.waitForTimeout(1200);
      const texto = await dialogo.innerText();
      await registrar(
        "lotacao-em-lote",
        /agora está em/.test(texto)
          ? texto.split("\n").find((l) => /agora está em/.test(l))
          : "SEM CONFIRMAÇÃO NA TELA",
      );
      await dialogo.getByRole("button", { name: "Fechar", exact: true }).click();
    } else {
      await registrar("lotacao-em-lote", "A PESSOA NÃO APARECEU NA BUSCA");
    }
  }

  // ---- a mesma criança em duas escolas, reconhecida pelo CPF -------------
  const naOrigem = await importar("escola-demo", PLANILHA_ORIGEM);
  console.log(
    `   escola-demo: ${naOrigem.criados} criados, ${naOrigem.transferidos} transferidos, ` +
      `${naOrigem.erros?.length ?? 0} erro(s)`,
  );
  if (naOrigem.erros?.length) console.log("     ", JSON.stringify(naOrigem.erros).slice(0, 200));

  const noDestino = await importar("escola-demo-2", PLANILHA_DESTINO);
  console.log(
    `   escola-demo-2: ${noDestino.criados} criados, ${noDestino.transferidos} transferidos`,
  );
  const transferiu = noDestino.criados === 0 && noDestino.transferidos === 1;
  console.log(
    "   o CPF reconheceu a mesma criança:",
    transferiu ? "sim — transferência, não cadastro novo" : "NÃO — nasceu de novo",
  );

  // ---- o histórico atravessa as duas escolas -----------------------------
  await p.goto(`${HUB}/admin/turmas?escolaId=escola-demo-2`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  const linhaDaTurma = p.locator("table tbody tr", { hasText: TURMA_DESTINO });
  if ((await linhaDaTurma.count()) > 0) {
    await Promise.all([
      p.waitForURL(/\/admin\/turmas\/[0-9a-f-]{36}/, { timeout: 20_000 }),
      linhaDaTurma.getByRole("button", { name: "Abrir" }).click(),
    ]);
    await p.waitForTimeout(1500);
    await registrar("turma-da-escola-nova", "a criança transferida, na turma do destino");

    await p.getByRole("button", { name: "Histórico" }).first().click();
    await p.getByText(/Histórico de/).waitFor({ timeout: 15_000 });
    await p.waitForTimeout(800);
    const texto = await p.getByTestId("unooria-modal").innerText();
    const duasEscolas = /EE Escola Demo/.test(texto) && /EE Vila Nova/.test(texto);
    // O gestor VÊ o CPF, formatado: é como ele confere que é a criança certa.
    const cpfNaTela = texto.includes(CPF);
    await registrar(
      "historico-atravessa-escolas",
      `${duasEscolas ? "as DUAS escolas na trajetória" : "SÓ UMA ESCOLA"} · ${
        cpfNaTela ? "CPF completo na tela" : "CPF NÃO APARECEU"
      }`,
    );
    // O diálogo do DS tem o X ("Fechar modal") e o botão "Fechar": `exact`
    // separa os dois.
    await p.getByRole("button", { name: "Fechar", exact: true }).click();
  } else {
    await registrar("turma-da-escola-nova", `TURMA ${TURMA_DESTINO} NÃO APARECEU`);
  }

  // ---- o professor lotado em duas escolas --------------------------------
  await entrar("prof.demo");
  const seletor = p.locator('select[aria-label="Escola ativa"]');
  const temSeletor = (await seletor.count()) > 0;
  const opcoes = temSeletor ? await seletor.locator("option").allInnerTexts() : [];
  await registrar(
    "professor-com-duas-escolas",
    temSeletor ? `seletor com: ${opcoes.join(" | ")}` : "SEM SELETOR DE ESCOLA",
  );

  await p.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1500);
  const naEscolaUm = await p.locator('a[href^="/professor/turmas/"]').allInnerTexts();
  await registrar("turmas-na-escola-1", naEscolaUm.map((t) => t.split("\n")[0]).join(", "));

  if (temSeletor) {
    /* Troca a escola ATIVA: é o token que muda, e com ele o que o professor vê.
       Esperar a RESPOSTA do POST em vez de um `waitForTimeout` cego — o `select`
       existe no HTML do SSR antes de o React estar hidratado, e um clique nesse
       intervalo troca o valor na tela sem chamar handler nenhum. */
    await p.waitForTimeout(2000);
    const [resposta] = await Promise.all([
      p.waitForResponse(
        (r) => r.url().includes("/api/escola-ativa") && r.request().method() === "POST",
        { timeout: 20_000 },
      ),
      p.locator('select[aria-label="Escola ativa"]').selectOption({ label: "EE Vila Nova" }),
    ]);
    console.log("   POST /api/escola-ativa:", resposta.status());
    await p.waitForTimeout(1500);
    await p.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    const naEscolaDois = await p.locator('a[href^="/professor/turmas/"]').allInnerTexts();
    const mudou = JSON.stringify(naEscolaDois) !== JSON.stringify(naEscolaUm);
    await registrar(
      "turmas-na-escola-2",
      `${naEscolaDois.map((t) => t.split("\n")[0]).join(", ") || "nenhuma"} · ${
        mudou ? "a lista MUDOU com a escola" : "A LISTA NÃO MUDOU"
      }`,
    );
  }

  // ---- o panorama de quem administra muitas escolas ----------------------
  /* A supervisora da diretoria: um `gestor` lotado nas duas unidades. Ela vê uma
     escola POR VEZ — o panorama lista, não soma. */
  await entrar("supervisor.demo");
  await p.goto(`${HUB}/admin/minhas-escolas`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  const linhasDoPanorama = await p.locator("table tbody tr").allInnerTexts();
  await registrar(
    "panorama-do-supervisor",
    linhasDoPanorama.length
      ? `${linhasDoPanorama.length} escola(s): ${linhasDoPanorama
          .map((t) => t.split("\n")[0])
          .join(" | ")}`
      : "PANORAMA VAZIO",
  );

  const itemDoMenu = await p.getByRole("button", { name: /Minhas escolas/ }).count();
  console.log("   item 'Minhas escolas' na navegação:", itemDoMenu > 0 ? "sim" : "NÃO APARECEU");

  const trocar = p.getByRole("button", { name: "Trocar e abrir" }).first();
  if ((await trocar.count()) > 0) {
    await Promise.all([
      p.waitForResponse(
        (r) => r.url().includes("/api/escola-ativa") && r.request().method() === "POST",
        { timeout: 20_000 },
      ),
      trocar.click(),
    ]);
    await p.waitForURL(/\/admin\/usuarios/, { timeout: 20_000 });
    await p.waitForTimeout(2000);
    const escolaNoCabecalho = await p
      .locator('select[aria-label="Escola ativa"]')
      .inputValue()
      .catch(() => "sem seletor");
    await registrar(
      "supervisor-trocou-de-escola",
      `abriu as pessoas de "${escolaNoCabecalho}" — uma escola por vez, nunca duas somadas`,
    );
  }

  console.log("\n--- passos ---");
  passos.forEach((linha) => console.log(linha));
  console.log("\nerros de console:", erros.length ? erros : "nenhum");
  console.log(`prints em ${OUT}/`);
} finally {
  await browser.close();
}
