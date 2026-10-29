import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * O PAINEL DE HABILIDADES DO PROFESSOR (F14.7, H14.7.1): as habilidades da
 * BNCC de Computação da turma, em quatro colunas — as unidades do ano —, e em
 * cada habilidade quantas crianças atingiram, estão em processo, não atingiram
 * e não foram avaliadas.
 *
 * O que esta suíte cobra e nenhuma outra cobre:
 *
 *  - o cartão do painel fica no topo da lista de missões, e leva a ele;
 *  - as quatro unidades aparecem SEMPRE, mesmo as que ainda não têm missão;
 *  - cada habilidade de cada missão aplicada tem a barra, e os números da tela
 *    são os da api (a contagem de "Atingiu" e de "Não avaliado");
 *  - "Mais atingidas primeiro" reordena as HABILIDADES, nunca os estudantes;
 *  - a lista de estudantes é alfabética e leva ao perfil, dentro da sala;
 *  - o professor não lê o painel da escola nem o da rede (403 na api).
 *
 * FIXTURE. Só leitura, na 5A — onde a `estudante/10` (Quem mandou isso?) grava
 * evidência. Sem missão aplicada, a prova é o estado vazio com o caminho para
 * aplicar a primeira; a suíte ramifica pelo que a api diz.
 */
const TURMA = process.env.TURMA_PAINEL ?? "5A";
const VAZIO = "Esta turma ainda não concluiu nenhuma missão com habilidades da BNCC.";

/** A escola da 5A que a `estudante/10` usa — há outra 5A, na segunda escola do seed. */
const ESCOLA = process.env.ESCOLA_PAINEL ?? "EE Professora Maria Aparecida Nogueira";

/**
 * Quem leciona na turma DESTA escola. Pela turma só, o primeiro da lista é o
 * professor das duas unidades, cuja 5A é a da OUTRA escola — e o token dele
 * carrega a primeira, onde só existe a 1A.
 */
const professorDa = (turma) =>
  contasDe("professor").find((c) => c.escola === ESCOLA && c.turma.split(" + ").includes(turma)) ??
  conta("professor", { turma, escola: ESCOLA });

async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

await suite(
  {
    slug: "professor/13-painel-de-habilidades",
    papel: "professor",
    titulo: "O painel de habilidades da turma",
    subtitulo: "a BNCC de Computação por unidade do ano, em quantas crianças",
    contexto:
      "Um cartão fixo no topo das missões leva ao painel da turma: as quatro unidades do ano, e em cada " +
      "missão a barra de cada habilidade da BNCC — quantos atingiram, estão em processo, não atingiram e não " +
      "foram avaliados. Em cada missão vale o MELHOR resultado da criança entre as atividades; quem não tem " +
      "registro é 'não avaliado', nunca 'não atingiu'.",
    prova: [
      "O cartão do painel está no topo da lista de missões e leva a ele",
      "As quatro unidades aparecem sempre",
      "Cada habilidade aplicada tem a barra, com os números da api",
      "'Mais atingidas primeiro' reordena as habilidades, nunca os estudantes",
      "A lista de estudantes é alfabética e leva ao perfil, dentro da sala",
      "O professor não lê o painel da escola nem o da rede (403)",
      "O Dossiê Invisível (9º ano, unidade 1) entra na coluna da Unidade 1 da 9A com EF09CO07 e EF09CO08, e as barras são as da api",
    ],
    comando: "node scripts/e2e/professor/13-painel-de-habilidades.mjs",
  },
  async (r) => {
    const erroNaTela = (p) => p.locator(ALERTA_DE_ERRO);

    // ── O Dossiê Invisível na 9A (exp09ef1b, ADR-202) ───────────────────
    /* A missão mais nova grava evidência na 9A (a `estudante/19` conclui três
       caminhos: EF09CO08 2 atingiu + 1 em processo; EF09CO07 1 em cada nível).
       Num contexto PRÓPRIO, antes da 5A: o roteiro da 5A tem retornos cedo no
       estado vazio. Rodando sozinha, a 9A pode não ter a missão aplicada — a
       prova vira a missão listada sem barra. */
    {
      const professorNono = professorDa("9A");
      const p9 = await r.pagina("professor 9A");
      await r.entrar(p9, professorNono.login);
      const turmas9 = await (await p9.request.get(`${BFF}/turmas/minhas`)).json().catch(() => []);
      const turma9 = Array.isArray(turmas9) ? turmas9.find((t) => t.nome === "9A") : null;
      if (r.exigir(Boolean(turma9), `${professorNono.login} leciona na 9A`)) {
        const consolidado = await (await p9.request.get(`${BFF}/evidencias/turma/${turma9.id}/consolidado`)).json().catch(() => null);
        const dossie = consolidado?.missoes?.find((m) => m.expId === "exp09ef1b") ?? null;
        r.exigir(
          Boolean(dossie) && dossie.unidade === 1 && ["EF09CO07", "EF09CO08"].every((c) => dossie.habilidades.some((h) => h.codigo === c)),
          `o painel da 9A lista O Dossiê Invisível na Unidade 1 com EF09CO07 e EF09CO08 (unidade ${dossie?.unidade})`,
        );
        await p9.goto(`${HUB}/professor/habilidades?turmaId=${turma9.id}`, { waitUntil: "domcontentloaded" });
        await esperarOuFalharCedo(p9.getByRole("heading", { level: 1, name: "Painel de habilidades" }), erroNaTela(p9), {
          timeout: 30_000,
          oQue: "o painel de habilidades da 9A",
        });
        if (!dossie?.aplicada) {
          r.ressalva("a 9A ainda não tem evidência do Dossiê Invisível: rode antes a estudante/19-dossie-invisivel");
        } else {
          for (const h of dossie.habilidades) {
            const barra = p9.locator(".unooria-stacked-progress-card").filter({ hasText: h.codigo }).first();
            await barra.waitFor({ timeout: 15_000 });
            const legenda = await barra.innerText();
            const d = h.distribuicao;
            r.exigir(
              legenda.includes(`${d.atingiu} (`) && legenda.includes(`${d.naoAvaliado} (`),
              `a barra de ${h.codigo} na 9A mostra os números da api (atingiu ${d.atingiu}, em processo ${d.emProcesso}, não atingiu ${d.naoAtingiu}, não avaliado ${d.naoAvaliado})`,
            );
          }
          const co08 = dossie.habilidades.find((h) => h.codigo === "EF09CO08")?.distribuicao;
          const co07 = dossie.habilidades.find((h) => h.codigo === "EF09CO07")?.distribuicao;
          r.exigir(
            co08?.atingiu >= 2 && co08?.emProcesso >= 1 && co07?.atingiu >= 1 && co07?.emProcesso >= 1 && co07?.naoAtingiu >= 1,
            `a régua dos três caminhos da estudante/19 chega ao consolidado (EF09CO08 ${JSON.stringify(co08)}; EF09CO07 ${JSON.stringify(co07)})`,
          );
          await p9.locator(".unooria-stacked-progress-card").filter({ hasText: "EF09CO08" }).first().scrollIntoViewIfNeeded();
        }
        await r.registrar(p9, "painel-da-9a-dossie", {
          titulo: "O Dossiê Invisível no painel da 9A",
          mostra: "A coluna da Unidade 1 do 9º ano com O Dossiê Invisível: a barra de EF09CO08 e a de EF09CO07, em quantas crianças.",
          prova: "A missão nova entra no painel pela FICHA (evidencias/fichas/exp09ef1b.ts), sem lista à mão; quem não fez é “não avaliado”, tracejado.",
          inteira: true,
        });
      }
    }
    const professora = professorDa(TURMA);
    const p = await r.pagina("professor");
    await r.entrar(p, professora.login);

    // ── o cartão no topo da lista de missões ────────────────────────────
    await p.goto(`${HUB}/professor/entre-redes`, { waitUntil: "domcontentloaded" });
    const abrir = p.getByRole("link", { name: "Abrir o painel de habilidades", exact: true });
    await esperarOuFalharCedo(abrir, erroNaTela(p), { timeout: 30_000, oQue: "o cartão do painel de habilidades" });
    await r.registrar(p, "cartao-do-painel", {
      titulo: "O painel mora no topo das missões",
      mostra: "O cartão \"Painel de habilidades da BNCC\", fixo antes da trilha e separado dos cartões de missão.",
      prova: "É o resultado de TODAS as missões, por unidade — não uma missão a mais na grade.",
    });
    await hidratado(p, abrir);
    await Promise.all([p.waitForURL(/\/professor\/habilidades/, { timeout: 30_000 }), abrir.click()]);

    // ── a turma ─────────────────────────────────────────────────────────
    const respostaDasTurmas = await p.request.get(`${BFF}/turmas/minhas`);
    const turmas = await respostaDasTurmas.json().catch(() => []);
    const lista = Array.isArray(turmas) ? turmas : [];
    const turmaId = lista.find((t) => t.nome === TURMA)?.id ?? null;
    if (
      !r.exigir(
        Boolean(turmaId),
        `a professora leciona na ${TURMA} (GET /turmas/minhas: HTTP ${respostaDasTurmas.status()}, ${lista.map((t) => t.nome).join(", ") || "nenhuma"})`,
      )
    ) {
      return;
    }

    const leitura = await p.request.get(`${BFF}/evidencias/turma/${turmaId}/consolidado`);
    if (!r.exigir(leitura.ok(), `a api devolve o painel da ${TURMA} (HTTP ${leitura.status()})`)) return;
    const painel = await leitura.json();
    const aplicadas = painel.missoes.filter((m) => m.aplicada);

    await p.goto(`${HUB}/professor/habilidades?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: "Painel de habilidades" }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "o painel de habilidades",
    });

    if (aplicadas.length === 0) {
      const vazio = await p
        .getByText(VAZIO, { exact: true })
        .waitFor({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      r.exigir(vazio, `sem missão aplicada, o painel diz "${VAZIO}"`);
      r.exigir(
        (await p.getByRole("link", { name: "Aplicar a primeira missão" }).count()) === 1,
        "e oferece o caminho para aplicar a primeira",
      );
      await r.registrar(p, "painel-vazio", {
        titulo: "O painel, antes da primeira missão",
        mostra: `A ${TURMA} ainda não concluiu nenhuma missão com habilidades da BNCC.`,
        prova: "Estado vazio com o caminho para a lista de missões — quem aplica é o professor.",
      });
      return;
    }

    // As quatro unidades, sempre.
    for (const u of [1, 2, 3, 4]) {
      r.exigir(
        (await p.getByRole("heading", { level: 2, name: `Unidade ${u}`, exact: true }).count()) === 1,
        `a coluna "Unidade ${u}" está no painel`,
      );
    }

    // Cada habilidade aplicada tem a barra; e o total de "Atingiu" da tela é o da api.
    const habilidades = aplicadas.flatMap((m) => m.habilidades);
    const texto = await p.locator("main").innerText();
    const faltando = habilidades.filter((h) => !texto.includes(h.codigo));
    r.exigir(faltando.length === 0, `cada habilidade aplicada aparece (${habilidades.length - faltando.length} de ${habilidades.length})`);
    const barras = await p.locator(".unooria-stacked-progress-card").count();
    r.exigir(barras === habilidades.length, `uma barra por habilidade aplicada (${barras} de ${habilidades.length})`);
    const primeira = habilidades[0];
    const legenda = await p.locator(".unooria-stacked-progress-card").first().innerText();
    r.exigir(
      legenda.includes(`Atingiu:`) && legenda.includes(`${primeira.distribuicao.atingiu} (`),
      `a barra de ${primeira.codigo} mostra os ${primeira.distribuicao.atingiu} que atingiram, como a api`,
    );
    r.exigir(
      legenda.includes("Não avaliado:") && legenda.includes(`${primeira.distribuicao.naoAvaliado} (`),
      `e os ${primeira.distribuicao.naoAvaliado} não avaliados — separados de "Não atingiu"`,
    );
    /* O não avaliado é contorno tracejado, na barra e na legenda (DS 0.2.16):
       ausência, e não uma quarta faixa de resultado. */
    const cartao = p.locator(".unooria-stacked-progress-card").first();
    const tracejadoNaLegenda = await cartao.locator(".unooria-dataviz__indicator-dot--dashed").count();
    const tracejadoNaBarra = await cartao.locator(".unooria-stacked-progress__segment--dashed").count();
    r.exigir(tracejadoNaLegenda === 1, 'o marcador de "Não avaliado" na legenda é tracejado');
    r.exigir(
      tracejadoNaBarra === (primeira.distribuicao.naoAvaliado > 0 ? 1 : 0),
      `e a faixa dele na barra também (${tracejadoNaBarra}), sem traço solto quando é zero`,
    );
    await r.registrar(p, "painel-da-turma", {
      titulo: "A turma, por unidade",
      mostra: `A ${TURMA}: as quatro unidades do ano e, em cada missão aplicada, a barra de cada habilidade da BNCC.`,
      prova:
        "Contagem, porque o professor quer saber QUANTOS. Em cada missão vale o melhor resultado da criança " +
        "entre as atividades; quem não tem registro é 'não avaliado', TRACEJADO, e nunca entra em 'não atingiu'.",
      detalhe: `${aplicadas.length} missão(ões) aplicada(s), ${habilidades.length} habilidade(s)`,
      inteira: true,
    });

    // "Mais atingidas primeiro": as habilidades mudam de ordem, os estudantes não.
    const estudantesAntes = await p.locator('a[href*="/estudantes/"]').allInnerTexts();
    const aba = p.getByRole("tab", { name: "Mais atingidas primeiro" });
    await hidratado(p, aba);
    await aba.click();
    const estudantesDepois = await p.locator('a[href*="/estudantes/"]').allInnerTexts();
    r.exigir(
      JSON.stringify(estudantesAntes) === JSON.stringify(estudantesDepois),
      "reordenar as habilidades não mexe na lista de estudantes",
    );
    await r.registrar(p, "mais-atingidas-primeiro", {
      titulo: "Onde reforçar",
      mostra: "As habilidades de cada coluna da mais atingida para a menos atingida.",
      prova: "A ordenação é das HABILIDADES, dentro de cada unidade. A lista de estudantes continua alfabética: sem ranking.",
      inteira: true,
    });

    // A lista de estudantes é a da api, alfabética, e leva ao perfil dentro da sala.
    const nomesDaApi = painel.estudantes.map((e) => e.nome);
    r.exigir(
      JSON.stringify(estudantesDepois.map((n) => n.trim())) === JSON.stringify(nomesDaApi),
      `a lista de estudantes é a da api, em ordem alfabética (${nomesDaApi.length})`,
    );
    const primeiroNome = p.locator('a[href*="/estudantes/"]').first();
    const href = (await primeiroNome.getAttribute("href")) ?? "";
    r.exigir(
      href.startsWith(`/professor/turmas/${turmaId}/estudantes/`),
      `o nome leva ao perfil dentro da sala (${href})`,
    );
    await Promise.all([
      p.waitForURL(new RegExp(`/professor/turmas/${turmaId}/estudantes/`), { timeout: 30_000 }),
      primeiroNome.click(),
    ]);
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1 }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "o perfil do estudante",
    });
    await r.registrar(p, "perfil-pelo-painel", {
      titulo: "Do painel ao estudante",
      mostra: "O perfil aberto pelo nome: em cada missão, o melhor nível de cada habilidade entre as atividades.",
      prova: "A habilidade da missão sem nível aparece como 'Não avaliado'. Nenhum dado de outro estudante aparece aqui.",
      inteira: true,
    });

    // O professor lê a turma, não a escola nem a rede.
    const escola = await p.request.get(`${BFF}/evidencias/escola/consolidado`);
    const rede = await p.request.get(`${BFF}/evidencias/rede/consolidado`);
    r.exigir(escola.status() === 403, `o painel da escola responde ${escola.status()} ao professor (esperado 403)`);
    r.exigir(rede.status() === 403, `o painel da rede responde ${rede.status()} ao professor (esperado 403)`);
  },
);
