import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

/**
 * Smoke VISUAL do PERFIL PORTÁTIL — o que a criança leva ao sair da REDE.
 *
 * O caminho inteiro numa corrida: o gestor abre a turma, emite o documento
 * assinado, e importa esse mesmo arquivo de volta como se ele tivesse vindo de
 * outra rede. Depois adultera um byte e confere que o documento é RECUSADO —
 * que é a única parte do recurso onde um erro silencioso seria grave.
 *
 * Uso: node scripts/walkthrough-perfil-portatil.mjs <pasta-de-prints>
 * Pré-requisitos: stack no ar + `pnpm seed`.
 */
const HUB = process.env.HUB_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "testes/walkthrough-perfil-portatil";
const SENHA = process.env.SENHA_DEMO ?? "unooria123";
const TURMA = process.env.TURMA ?? "8A";

/** CPF válido exclusivo deste smoke. */
const CPF = "700.100.203-81";
const PLANILHA = [
  "cpf,matricula,nome,usuario,papel,turma,serie,turno",
  `${CPF},PP-A1,Rafaela Portatil Souza,rafa.portatil,aluno,${TURMA},8EF,manha`,
  "",
].join("\n");

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const contexto = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
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

try {
  await entrar("gestor.demo");

  // A criança precisa existir com CPF: é o CPF que a reconhece lá fora.
  const importada = await p.request.post(
    `${HUB}/api/plataforma/rostering/importar?senhaPadrao=PortatilSmoke2026`,
    { headers: { "content-type": "text/csv" }, data: PLANILHA },
  );
  const relatorio = await importada.json();
  console.log(
    `   planilha: ${relatorio.criados} criados, ${relatorio.transferidos ?? 0} transferidos, ` +
      `${relatorio.erros?.length ?? 0} erro(s)`,
  );

  await p.goto(`${HUB}/admin/turmas`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  const linhaDaTurma = p.locator("table tbody tr", { hasText: TURMA });
  await Promise.all([
    p.waitForURL(/\/admin\/turmas\/[0-9a-f-]{36}/, { timeout: 20_000 }),
    linhaDaTurma.getByRole("button", { name: "Abrir" }).first().click(),
  ]);
  await p.waitForTimeout(2000);

  const linhaDaAluna = p.locator("table tbody tr", { hasText: "Rafaela Portatil" });
  await linhaDaAluna.getByRole("button", { name: "Perfil portátil" }).click();
  await p.getByText("Isto é para sair da REDE").waitFor({ timeout: 15_000 });
  await p.waitForTimeout(1200);
  await registrar("perfil-portatil-aberto", "emitir, receber e o que já foi recebido");

  const dialogo = p.getByTestId("unooria-modal");

  // ---- emitir --------------------------------------------------------------
  const [download] = await Promise.all([
    p.waitForEvent("download", { timeout: 30_000 }),
    dialogo.getByRole("button", { name: "Emitir e baixar" }).click(),
  ]);
  const caminho = join(OUT, download.suggestedFilename());
  await download.saveAs(caminho);
  const arquivo = JSON.parse(await (await import("node:fs/promises")).readFile(caminho, "utf8"));
  const temAssinatura = typeof arquivo.assinatura === "string" && arquivo.assinatura.split(".").length === 3;
  console.log(
    `   emitido: ${download.suggestedFilename()} · emissor ${arquivo.perfil?.emissor?.contrato} · ` +
      `${temAssinatura ? "assinado (JWS)" : "SEM ASSINATURA"} · CPF ${arquivo.perfil?.titular?.cpf}`,
  );
  await registrar(
    "documento-emitido",
    `${download.suggestedFilename()} · ${temAssinatura ? "JWS presente" : "SEM JWS"}`,
  );

  // ---- receber o mesmo arquivo, como se viesse de outra rede ---------------
  await dialogo.locator('input[type="file"]').setInputFiles(caminho);
  await p.getByText(/Perfil recebido/).waitFor({ timeout: 20_000 });
  await p.waitForTimeout(600);
  await p.waitForTimeout(1200);
  /* A LISTA é a prova de que o documento entrou — a mensagem sozinha some no
     próximo clique, e o modal rola. */
  const naLista = await dialogo.locator("li", { hasText: /emitido em/ }).count();
  const textoDepois = await dialogo.innerText();
  await dialogo.getByText("Recebidos").scrollIntoViewIfNeeded();
  await registrar(
    "documento-recebido",
    `${naLista} na lista de recebidos · ${
      /não verificado/i.test(textoDepois)
        ? "marcado NÃO VERIFICADO (a instalação não tem emissores configurados)"
        : "SEM o rótulo de verificação"
    }`,
  );
  if (naLista === 0) throw new Error("o documento não apareceu na lista de recebidos");

  // ---- adulterar um byte ---------------------------------------------------
  const adulterado = JSON.parse(JSON.stringify(arquivo));
  adulterado.perfil.titular.nome = "Outra Criança Qualquer";
  const caminhoRuim = join(OUT, "adulterado.json");
  writeFileSync(caminhoRuim, JSON.stringify(adulterado, null, 2), "utf8");

  await dialogo.locator('input[type="file"]').setInputFiles(caminhoRuim);
  await p.waitForTimeout(2500);
  const textoFinal = await dialogo.innerText();
  /* Sem emissores configurados a assinatura NÃO é conferida, e o documento
     adulterado entra marcado `nao-verificada` — que é a decisão, não um bug:
     esta instalação não tem como falar com o emissor. O que o smoke registra é
     qual dos dois caminhos aconteceu, para a diferença ficar visível no print. */
  await registrar(
    "documento-adulterado",
    /Recusado/i.test(textoFinal)
      ? "RECUSADO — a assinatura não cobre o conteúdo"
      : "entrou como NÃO VERIFICADO (sem emissores configurados, não há o que conferir)",
  );

  console.log("\n--- passos ---");
  passos.forEach((linha) => console.log(linha));
  console.log("\nerros de console:", erros.length ? erros : "nenhum");
  console.log(`prints em ${OUT}/`);
} finally {
  await browser.close();
}
