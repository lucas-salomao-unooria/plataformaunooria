#!/usr/bin/env node
/**
 * Mede a plataforma contra a WCAG 2.2 nível A e AA com o axe-core (ADR-162).
 *
 *   node scripts/e2e/ferramentas/medir-acessibilidade.mjs [papel…] [--saida arquivo.json]
 *
 * Entra com uma conta de cada papel, percorre as telas da área e roda o axe na
 * página e, À PARTE, dentro do iframe de cada experiência — o axe não atravessa
 * a fronteira de origem sozinho, e a experiência é outra origem (o dev server
 * do Vite, ou o CDN). Sai 1 se houver violação: é o portão que o R-07 pedia.
 *
 * Papéis: `publico`, `professor`, `gestor_escola`, `gestor_contrato`, `admin` e
 * `estudante@<turma>` — um por turma com missão LIBERADA, porque o estudante só
 * enxerga o que o professor liberou na sala dele (ADR-69): uma conta só mede
 * uma missão. Sem argumento, mede todos.
 *
 * Roda contra a stack que já está no ar (HUB_URL, default :3000). Com a stack
 * INTEIRA de pé a VM do Docker esgota a memória no meio da corrida (o hub cai e
 * tudo vira timeout): meça por papel, com só as experiências do lote ligadas.
 *
 * O axe cobre só parte da WCAG. Verde aqui é a condição NECESSÁRIA do AA, não a
 * suficiente: teclado, ordem de foco e leitor de tela continuam exigindo a
 * passada manual descrita no cap. 16.
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { achatar, medirPaginaEFrames } from "../lib/acessibilidade.mjs";
import { contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { HUB } from "../lib/roteiro.mjs";

const ANOS = ["1-ano", "4-ano", "5-ano", "6-ano", "7-ano", "8-ano", "2-serie"];
const TURMAS = ["1A", "4A", "5A", "6A", "7A", "8A", "9B", "2EM-A"];

/** `{ de, padrao, max }` = abra `de` e meça os links que casam com `padrao`. */
const ROTEIRO = {
  publico: { conta: null, rotas: ["/", "/login", "/privacidade", "/termos"] },
  ...Object.fromEntries(
    TURMAS.map((t) => [
      `estudante@${t}`,
      { conta: ["estudante", t], rotas: [...(t === "1A" ? ["/estudante"] : []), { de: "/estudante", padrao: /^\/exp\/[^/]+$/, max: 6 }] },
    ]),
  ),
  professor: {
    conta: ["professor (24"],
    rotas: [
      "/professor", "/professor/turmas", "/professor/entre-redes", "/professor/guia", "/professor/habilidades",
      "/professor/atividades/nova", "/professor/plano-de-aula", "/professor/plano-de-ensino", "/professor/bem-estar",
      "/professor/entre-redes/vila-do-lume", "/professor/entre-redes/vila-do-lume/resultados",
      "/professor/entre-redes/vila-do-lume/guia", "/trocar-senha",
      ...ANOS.flatMap((ano) => {
        const u = `/professor/entre-redes/${ano}/unidade-1`;
        return [u, `${u}/resultados`, `${u}/guia`, `${u}/atividades/nova`];
      }),
      "/professor/entre-redes/6-ano/unidade-2", "/professor/entre-redes/8-ano/unidade-4",
      { de: "/professor/turmas", padrao: /^\/professor\/turmas\/[^/?]+$/, max: 1 },
    ],
  },
  gestor_escola: {
    conta: ["gestor_escola"],
    rotas: ["/admin/usuarios", "/admin/turmas", "/admin/importar", "/admin/relatorios", "/admin/habilidades", "/analise"],
  },
  gestor_contrato: {
    conta: ["gestor_contrato"],
    rotas: ["/admin/escolas", "/admin/regionais", "/admin/periodos-letivos", "/admin/minhas-escolas", "/admin/recursos", "/admin/habilidades"],
  },
  admin: {
    conta: ["admin"],
    rotas: ["/unooria/recursos", "/unooria/uso-de-ia", "/unooria/prospeccao", "/unooria/arquivados", "/unooria/custos-de-ia"],
  },
};

function login([papel, turma]) {
  const c = contasDe(papel).find((x) => !turma || (x.turma === turma && x.escola.startsWith("EE Professora")));
  if (!c) throw new Error(`sem conta de ${papel}${turma ? ` na turma ${turma}` : ""} em credenciais-demo.csv`);
  return c.login;
}

async function entrar(pagina, usuario) {
  await pagina.context().clearCookies();
  await pagina.goto(`${HUB}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await pagina.waitForSelector("button[type=submit]");
  await pagina.waitForTimeout(1500); // portão de hidratação, como no roteiro
  await pagina.locator("#username").pressSequentially(usuario, { delay: 15 });
  await pagina.locator("#password").pressSequentially(senhaDemo(), { delay: 15 });
  await pagina.waitForFunction(() => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"), null, { timeout: 10_000 });
  await pagina.click("button[type=submit]");
  await pagina.waitForURL((u) => !u.pathname.startsWith("/login") && u.pathname !== "/", { timeout: 60_000 });
}

async function medir(pagina, rota, papel) {
  const reg = { papel, rota, erro: null, pagina: [], frames: [] };
  try {
    await pagina.goto(`${HUB}${rota}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await pagina.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await pagina.waitForTimeout(2500);
    reg.final = new URL(pagina.url()).pathname;
    if (pagina.frames().length > 1) await pagina.waitForTimeout(3000); // o handshake da ponte chega depois do load
    Object.assign(reg, await medirPaginaEFrames(pagina));
  } catch (e) {
    reg.erro = String(e).slice(0, 300);
  }
  const nos = (vs) => vs.reduce((s, v) => s + v.nos.length, 0);
  const total = nos(reg.pagina) + reg.frames.reduce((s, f) => s + nos(f.violacoes ?? []), 0);
  const frames = reg.frames.map((f) => `${new URL(f.url).port}:${f.texto ?? "erro"}c`).join(" ");
  console.log(`[${papel}] ${rota} → ${reg.erro ? `ERRO ${reg.erro.slice(0, 90)}` : `${total} nó(s)`}${frames ? `  frames ${frames}` : ""}`);
  return reg;
}

const args = process.argv.slice(2);
const iSaida = args.indexOf("--saida");
const saida = iSaida > -1 ? args.splice(iSaida, 2)[1] : null;
const papeis = args.length ? args : Object.keys(ROTEIRO);

const navegador = await chromium.launch();
const resultados = [];
for (const papel of papeis) {
  const ficha = ROTEIRO[papel];
  if (!ficha) throw new Error(`papel desconhecido: ${papel} (conhecidos: ${Object.keys(ROTEIRO).join(", ")})`);
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
  const pagina = await ctx.newPage();
  try {
    if (ficha.conta) await entrar(pagina, login(ficha.conta));
  } catch (e) {
    console.log(`[${papel}] login falhou: ${String(e).slice(0, 160)}`);
    resultados.push({ papel, rota: "/login", erro: String(e).slice(0, 300), pagina: [], frames: [] });
    await ctx.close();
    continue;
  }
  for (const r of ficha.rotas) {
    if (typeof r === "string") {
      resultados.push(await medir(pagina, r, papel));
      continue;
    }
    await pagina.goto(`${HUB}${r.de}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await pagina.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await pagina.waitForTimeout(2000);
    const hrefs = (await pagina.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))).filter((h) => h && r.padrao.test(h));
    if (!hrefs.length) console.log(`[${papel}] nenhum link ${r.padrao} em ${r.de}`);
    for (const h of [...new Set(hrefs)].slice(0, r.max)) resultados.push(await medir(pagina, h, papel));
  }
  await ctx.close();
}
await navegador.close();

/* Resumo por regra: é a forma em que a correção se distribui (quase sempre UMA
   peça do DS explica dezenas de nós em telas diferentes). */
const regras = new Map();
for (const reg of resultados) {
  for (const [onde, v] of achatar(reg.rota, reg)) {
    const r = regras.get(v.id) ?? { ...v, nos: 0, telas: new Set(), exemplos: [] };
    r.nos += v.nos.length;
    r.telas.add(onde);
    for (const n of v.nos) if (r.exemplos.length < 4) r.exemplos.push(`${onde} :: ${n.html.slice(0, 140)}`);
    regras.set(v.id, r);
  }
}
console.log(`\n══ ${resultados.length} tela(s) medida(s) · ${regras.size} regra(s) violada(s) ══`);
for (const [id, r] of regras) {
  console.log(`\n✗ ${id} (${r.impacto}) ${r.criterios.join(",")} — ${r.nos} nó(s) em ${r.telas.size} tela(s)\n  ${r.ajuda}`);
  for (const e of r.exemplos) console.log(`  · ${e}`);
}
const erros = resultados.filter((r) => r.erro);
for (const e of erros) console.log(`\n! não medida: [${e.papel}] ${e.rota} — ${e.erro.slice(0, 120)}`);
if (saida) writeFileSync(saida, JSON.stringify(resultados, null, 1));
process.exit(regras.size || erros.length ? 1 : 0);
