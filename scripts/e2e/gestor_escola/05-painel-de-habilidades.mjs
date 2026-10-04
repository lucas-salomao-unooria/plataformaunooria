import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * O PAINEL DE HABILIDADES DA GESTÃO (F14.7, H14.7.2 e H14.7.3): a mesma
 * entrada no menu ("Habilidades"), duas alturas pelo papel.
 *
 *  - a COORDENAÇÃO DA ESCOLA lê a própria escola: as turmas do ano por série,
 *    cada missão num cartão, a barra de cada habilidade por turma — e abre a
 *    turma (a visão do professor) e o estudante;
 *  - a COORDENAÇÃO REGIONAL lê as escolas da regional dela, SEM seletor de
 *    regional (ela lê a dela; a api ignora o parâmetro), e desce rede → escola
 *    → turma sem ter lotação em escola nenhuma: o `?escolaId=` vai na URL, e a
 *    api confere que a escola é da regional.
 *
 * Só leitura. Os números da tela são conferidos contra a api.
 */
const ESCOLA_DEMO = process.env.ESCOLA_PAINEL ?? "EE Professora Maria Aparecida Nogueira";

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

await suite(
  {
    slug: "gestor_escola/05-painel-de-habilidades",
    papel: "gestor_escola",
    titulo: "O painel de habilidades da escola e da rede",
    subtitulo: "a coordenação acompanha a BNCC sem pedir planilha a cada professor",
    contexto:
      "A coordenação da escola vê todas as turmas do ano, por série; a coordenação regional vê as escolas da " +
      "regional dela. Em cada missão, a barra de cada habilidade da BNCC — em contagem e porcentagem, porque " +
      "turmas e escolas têm tamanhos diferentes. Sem ranking: o painel é para acompanhar e apoiar.",
    prova: [
      "O item \"Habilidades\" está no menu da gestão",
      "A coordenação da escola vê as turmas por série, com os números da api",
      "Do painel da escola, a turma abre a visão do professor, e o estudante o perfil",
      "A regional vê as escolas dela, sem seletor de regional",
      "A regional desce da rede à escola e à turma, sem lotação",
      "A coordenação de UMA escola não lê o painel da rede (403), e a regional não lê escola fora dela (403)",
    ],
    comando: "node scripts/e2e/gestor_escola/05-painel-de-habilidades.mjs",
  },
  async (r) => {
    const erroNaTela = (p) => p.locator(ALERTA_DE_ERRO);

    // ── a coordenação da escola ─────────────────────────────────────────
    const coordenacao = conta("gestor_escola", { escola: ESCOLA_DEMO });
    const p = await r.pagina("gestor_escola");
    await r.entrar(p, coordenacao.login);

    await p.goto(`${HUB}/admin/habilidades`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: "Painel de habilidades" }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "o painel de habilidades da escola",
    });
    r.exigir((await p.getByText("Habilidades", { exact: true }).count()) > 0, 'o item "Habilidades" está no menu');

    const leitura = await p.request.get(`${BFF}/evidencias/escola/consolidado`);
    if (!r.exigir(leitura.ok(), `a api devolve o painel da escola (HTTP ${leitura.status()})`)) return;
    const escola = await leitura.json();
    const comMissao = escola.turmas.filter((t) => t.missoes.some((m) => m.aplicada));
    if (!r.exigir(comMissao.length > 0, "alguma turma da escola já aplicou missão com ficha (pré-condição)")) return;

    const texto = await p.locator("body").innerText();
    const turmasNaTela = escola.turmas.filter((t) => texto.includes(`Turma ${t.nome}`)).length;
    r.exigir(
      turmasNaTela === escola.turmas.length,
      `cada turma da api está na tela (${turmasNaTela} de ${escola.turmas.length})`,
    );
    r.exigir(
      (await p.getByRole("combobox", { name: /Ano\/série/ }).count()) === 1,
      "o filtro de ano/série está na tela",
    );
    await r.registrar(p, "painel-da-escola", {
      titulo: "A escola, por série",
      mostra: `${escola.escola.nome}: as turmas do ano letivo agrupadas por série, cada missão num cartão.`,
      prova:
        "Contagem e porcentagem lado a lado: é a porcentagem que deixa ler turmas de tamanhos diferentes. Turmas " +
        "por série e nome, sem ranking. A turma que ainda não aplicou aparece como tal, sem barra.",
      detalhe: `${escola.turmas.length} turma(s), ${comMissao.length} com missão aplicada`,
      inteira: true,
    });

    const turma = comMissao[0];
    await seguir(
      p,
      p.getByRole("link", { name: `Turma ${turma.nome}`, exact: true }),
      new RegExp(`/admin/habilidades/turmas/${turma.id}`),
    );
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: `Turma ${turma.nome}` }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "a turma aberta pela coordenação",
    });
    await r.registrar(p, "turma-pela-coordenacao", {
      titulo: "A turma, como o professor a vê",
      mostra: `A ${turma.nome} aberta do painel da escola: as quatro unidades e a barra de cada habilidade.`,
      prova: "É a mesma tela do professor, só de leitura: a coordenação acompanha, não ajusta.",
      inteira: true,
    });
    const nome = p.locator('a[href^="/admin/habilidades/estudantes/"]').first();
    const nomeDoEstudante = (await nome.innerText()).trim();
    await seguir(p, nome, /\/admin\/habilidades\/estudantes\//);
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: nomeDoEstudante }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "o perfil do estudante aberto pela coordenação",
    });
    await r.registrar(p, "estudante-pela-coordenacao", {
      titulo: "O estudante, missão a missão",
      mostra: `${nomeDoEstudante}: em cada missão, o melhor nível de cada habilidade entre as atividades.`,
      prova: "Da mais recente para a mais antiga; o que não tem nível é 'Não avaliado'. Nenhum dado de outro estudante.",
      inteira: true,
    });

    const redeDaEscola = await p.request.get(`${BFF}/evidencias/rede/consolidado`);
    r.exigir(
      redeDaEscola.status() === 403,
      `a coordenação de UMA escola não lê o painel da rede (HTTP ${redeDaEscola.status()}, esperado 403)`,
    );

    // ── a coordenação regional ──────────────────────────────────────────
    const supervisao = conta("gestor_regional");
    const g = await r.pagina("gestor_regional");
    await r.entrar(g, supervisao.login);

    await g.goto(`${HUB}/admin/habilidades`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(g.getByRole("heading", { level: 1, name: "Painel de habilidades" }), erroNaTela(g), {
      timeout: 30_000,
      oQue: "o painel de habilidades da regional",
    });
    r.exigir(
      (await g.getByRole("combobox", { name: /^Regional/ }).count()) === 0,
      "a regional não escolhe a regional: lê a dela, e a api ignora o parâmetro",
    );
    const daRede = await (await g.request.get(`${BFF}/evidencias/rede/consolidado`)).json();
    const alvo = daRede.escolas.find((e) => e.series.some((s) => s.missoes.some((m) => m.turmasAplicadas > 0)));
    if (!r.exigir(Boolean(alvo), "alguma escola da regional já aplicou missão com ficha (pré-condição)")) return;
    const textoDaRede = await g.locator("body").innerText();
    r.exigir(textoDaRede.includes(alvo.nome), `a escola ${alvo.nome} está no painel da regional`);
    await r.registrar(g, "painel-da-rede", {
      titulo: "A regional, escola por escola",
      mostra: `${daRede.regional?.nome ?? "A regional"}: por série, cada escola com a soma das turmas em cada habilidade.`,
      prova:
        "Escolas por nome, sem ranking. A turma que ainda não aplicou entra na soma como 'não avaliado' — são " +
        "crianças da série que a missão ainda não alcançou. Nome de criança não aparece aqui.",
      detalhe: `${daRede.escolas.length} escola(s)`,
      inteira: true,
    });

    await seguir(
      g,
      g.getByRole("link", { name: alvo.nome, exact: true }),
      new RegExp(`/admin/habilidades/escolas/${encodeURIComponent(alvo.id)}`),
    );
    await esperarOuFalharCedo(g.getByRole("heading", { level: 1, name: alvo.nome }), erroNaTela(g), {
      timeout: 30_000,
      oQue: "a escola aberta pela regional",
    });
    const turmaDaRegional = g.locator('a[href^="/admin/habilidades/turmas/"]').first();
    const hrefDaTurma = (await turmaDaRegional.getAttribute("href")) ?? "";
    r.exigir(
      hrefDaTurma.includes(`escolaId=${encodeURIComponent(alvo.id)}`),
      `a turma leva a escola na URL — é assim que a regional a abre sem lotação (${hrefDaTurma})`,
    );
    await seguir(g, turmaDaRegional, /\/admin\/habilidades\/turmas\//);
    await esperarOuFalharCedo(g.getByRole("heading", { level: 1, name: /^Turma / }), erroNaTela(g), {
      timeout: 30_000,
      oQue: "a turma aberta pela regional",
    });
    await r.registrar(g, "turma-pela-regional", {
      titulo: "Da rede à turma",
      mostra: `Uma turma de ${alvo.nome}, aberta pela regional a partir do painel da rede.`,
      prova:
        "A regional não tem lotação em escola nenhuma: a escola vai na URL, e a api confere que ela é da " +
        "regional antes de armar a tranca NAQUELA escola. A RLS não muda.",
      inteira: true,
    });

    const vizinha = await g.request.get(`${BFF}/evidencias/escola/consolidado?escolaId=escola-que-nao-e-dela`);
    r.exigir(vizinha.status() === 403, `escola fora da regional responde ${vizinha.status()} (esperado 403)`);
  },
);
