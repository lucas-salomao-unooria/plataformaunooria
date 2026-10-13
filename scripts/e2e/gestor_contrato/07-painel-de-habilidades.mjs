import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * O PAINEL DE HABILIDADES VISTO DO CONTRATO (F14.7, H14.7.3 e H14.7.5): do
 * mais alto ao mais granular — a rede inteira, a regional, a escola, a turma e
 * o estudante.
 *
 * Na rede inteira o cartão de cada missão abre pelo TOPO ("Rede inteira") e
 * desce uma linha por REGIONAL, não cem escolas; a regional abre o painel dela
 * (`?regionalId=`), e dali a escola. Os números da tela são conferidos contra a
 * api, e o topo contra a soma das linhas: é a veracidade, não só a tela.
 */

async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

/** Clica num link já hidratado e espera o endereço novo. */
async function seguir(p, link, destino) {
  await hidratado(p, link);
  await Promise.all([p.waitForURL(destino, { timeout: 30_000 }), link.first().click()]);
}

const CAIXAS = ["atingiu", "emProcesso", "naoAtingiu", "naoAvaliado", "total"];

/** A distribuição de UMA habilidade numa lista de séries somadas, ou `null`. */
function distribuicao(series, serie, expId, codigo) {
  return (
    series
      .find((s) => s.serie === serie)
      ?.missoes.find((m) => m.expId === expId)
      ?.habilidades.find((h) => h.codigo === codigo)?.distribuicao ?? null
  );
}

await suite(
  {
    slug: "gestor_contrato/07-painel-de-habilidades",
    papel: "gestor_contrato",
    titulo: "O painel de habilidades da rede inteira",
    subtitulo: "do total da rede ao estudante, sem planilha e sem ranking",
    contexto:
      "O contrato acompanha a BNCC da rede toda. Cada missão abre pelo total da rede e desce uma linha por " +
      "regional; a regional abre as escolas dela, a escola as turmas, a turma os estudantes. Contagem e " +
      "porcentagem, sem ranking: o painel é para direcionar apoio, não para comparar.",
    prova: [
      'Na rede inteira, cada cartão abre pela linha "Rede inteira" e desce por regional',
      "O total da rede é exatamente a soma das regionais (e das escolas sem regional)",
      'A regional abre o painel dela: "Regional inteira" e as escolas',
      'A escola abre pelo total ("Escola inteira"), e dali a turma e o estudante',
      'Sem dizer a escola, a api recusa (400): o contrato nunca lê "a primeira que achar"',
    ],
    comando: "node scripts/e2e/gestor_contrato/07-painel-de-habilidades.mjs",
  },
  async (r) => {
    const erroNaTela = (p) => p.locator(ALERTA_DE_ERRO);
    const p = await r.pagina("gestor_contrato");
    await r.entrar(p, conta("gestor_contrato").login);

    // ── a rede inteira ──────────────────────────────────────────────────
    await p.goto(`${HUB}/admin/habilidades`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: "Painel de habilidades" }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "o painel de habilidades da rede",
    });
    r.exigir(
      (await p.getByRole("combobox", { name: /^Regional/ }).count()) === 1,
      "o contrato escolhe a regional (ou lê todas)",
    );

    const leitura = await p.request.get(`${BFF}/evidencias/rede/consolidado`);
    if (!r.exigir(leitura.ok(), `a api devolve o painel da rede (HTTP ${leitura.status()})`)) return;
    const rede = await leitura.json();
    if (!r.exigir(rede.regionais.length > 0, "a rede inteira vem com o degrau das regionais")) return;

    // A veracidade: o topo é a soma das regionais mais as escolas sem regional, caixa a caixa.
    const soltas = rede.escolas.filter((e) => e.regionalId === null);
    let conferidas = 0;
    let divergentes = 0;
    for (const s of rede.total) {
      for (const m of s.missoes) {
        for (const h of m.habilidades) {
          const linhas = [...rede.regionais, ...soltas]
            .map((l) => distribuicao(l.series, s.serie, m.expId, h.codigo))
            .filter(Boolean);
          const soma = Object.fromEntries(CAIXAS.map((c) => [c, linhas.reduce((t, d) => t + d[c], 0)]));
          conferidas += 1;
          if (CAIXAS.some((c) => soma[c] !== h.distribuicao[c])) divergentes += 1;
        }
      }
    }
    r.exigir(
      conferidas > 0 && divergentes === 0,
      `o total da rede bate com a soma das linhas (${conferidas} habilidade(s) conferida(s), ${divergentes} divergente(s))`,
    );

    const regional = rede.regionais.find((g) => g.series.some((s) => s.missoes.some((m) => m.turmasAplicadas > 0)));
    if (!r.exigir(Boolean(regional), "alguma regional já aplicou missão com ficha (pré-condição)")) return;
    const texto = await p.locator("body").innerText();
    r.exigir(texto.includes("Rede inteira"), 'cada cartão abre pelo topo: a linha "Rede inteira"');
    r.exigir(texto.includes(regional.nome), `a regional ${regional.nome} é uma linha do cartão`);
    await r.registrar(p, "painel-da-rede-inteira", {
      titulo: "A rede inteira, por regional",
      mostra: "Por série, cada missão num cartão: o total da rede no topo e, embaixo, uma linha por regional.",
      prova:
        "O topo é a soma das linhas, conferida caixa a caixa contra a api. Com cem escolas, a lista seria " +
        "ilegível: a regional é o degrau que a hierarquia da rede já tem.",
      detalhe: `${rede.regionais.length} regional(is), ${rede.escolas.length} escola(s)`,
      inteira: true,
    });

    // ── a regional ──────────────────────────────────────────────────────
    await seguir(
      p,
      p.getByRole("link", { name: regional.nome, exact: true }),
      new RegExp(`/admin/habilidades\\?regionalId=${encodeURIComponent(regional.id)}`),
    );
    await esperarOuFalharCedo(p.getByText("Regional inteira").first(), erroNaTela(p), {
      timeout: 30_000,
      oQue: "o painel da regional aberto pelo contrato",
    });
    const daRegional = await (
      await p.request.get(`${BFF}/evidencias/rede/consolidado?regionalId=${encodeURIComponent(regional.id)}`)
    ).json();
    r.exigir(
      JSON.stringify(daRegional.total) === JSON.stringify(regional.series),
      "a linha da regional na rede é o MESMO número do painel da regional",
    );
    const escola = daRegional.escolas.find((e) => e.series.some((s) => s.missoes.some((m) => m.turmasAplicadas > 0)));
    if (!r.exigir(Boolean(escola), "alguma escola da regional já aplicou missão com ficha (pré-condição)")) return;
    await r.registrar(p, "painel-da-regional-pelo-contrato", {
      titulo: "A regional, escola por escola",
      mostra: `${regional.nome}: o total da regional no topo e cada escola embaixo.`,
      prova: "O total da regional é o mesmo número que a coordenação regional lê no painel dela.",
      inteira: true,
    });

    // ── a escola, a turma e o estudante ─────────────────────────────────
    await seguir(
      p,
      p.getByRole("link", { name: escola.nome, exact: true }),
      new RegExp(`/admin/habilidades/escolas/${encodeURIComponent(escola.id)}`),
    );
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: escola.nome }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "a escola aberta pelo contrato",
    });
    r.exigir(
      (await p.locator("body").innerText()).includes("Escola inteira"),
      'a escola abre pelo topo: a linha "Escola inteira"',
    );
    const turma = p.locator('a[href^="/admin/habilidades/turmas/"]').first();
    const hrefDaTurma = (await turma.getAttribute("href")) ?? "";
    r.exigir(
      hrefDaTurma.includes(`escolaId=${encodeURIComponent(escola.id)}`),
      `a turma leva a escola na URL — o contrato não tem escola no token (${hrefDaTurma})`,
    );
    await seguir(p, turma, /\/admin\/habilidades\/turmas\//);
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: /^Turma / }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "a turma aberta pelo contrato",
    });
    const estudante = p.locator('a[href^="/admin/habilidades/estudantes/"]').first();
    const nomeDoEstudante = (await estudante.innerText()).trim();
    await seguir(p, estudante, /\/admin\/habilidades\/estudantes\//);
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: nomeDoEstudante }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "o perfil do estudante aberto pelo contrato",
    });
    await r.registrar(p, "estudante-pelo-contrato", {
      titulo: "Da rede ao estudante",
      mostra: `${nomeDoEstudante}, aberto a partir do total da rede: regional, escola, turma, estudante.`,
      prova:
        "Cada degrau lê UMA escola por vez, com a tranca armada nela: o alcance do contrato atravessa escolas " +
        "sem afrouxar a RLS.",
      inteira: true,
    });

    const semEscola = await p.request.get(`${BFF}/evidencias/escola/consolidado`);
    r.exigir(semEscola.status() === 400, `sem ?escolaId=, o contrato recebe ${semEscola.status()} (esperado 400)`);
  },
);
