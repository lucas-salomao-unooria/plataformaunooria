import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * As telas de RESULTADO das missões por ano — o que o professor abre depois da
 * aula (ou durante ela, entre um momento e outro).
 *
 * Aqui o que se testa é leitura, não ação: se o número está na tela, se ele vem
 * com a explicação de como lê-lo, e se a tela diz o que fazer quando não há
 * dado nenhum — que é o estado mais comum antes da primeira aula e o que mais
 * assusta quem abre pela primeira vez.
 *
 * A regra desta suíte: NENHUMA tela de resultado pode mostrar um número sem
 * dizer como ele foi computado. "Poder do viés: 68%" sozinho é numerologia.
 */
await suite(
  {
    slug: "professor/06-resultados-das-missoes",
    papel: "professor",
    titulo: "Os resultados, por missão",
    subtitulo: "o que o professor lê depois da aula",
    contexto:
      "Cada missão tem a sua tela de resultados, dentro da unidade do ano a que pertence. Elas " +
      "são recalculadas a cada visita — nada ali é número gravado que ninguém sabe mais como foi " +
      "computado.",
    prova: [
      "A tela sem turma escolhida ensina o que fazer, em vez de mostrar tabela vazia",
      "O relógio da aula do unooGPT é operável da mesma tela dos resultados",
      "O relatório de um estudante do unooGPT diz QUANDO: até a primeira fala, com quanto relógio, se estourou",
      "A aula da A Seleção (o botão único e a etapa) mora na mesma tela dos resultados, sem coluna de pontos",
      "A aula do Júri Estadual mora na página da atividade: os 40 estandes, a lousa anônima dos votos por área e — depois da auditoria — da concentração do feed, a folha sem coluna de voto, taxa, concentração nem nível, e com as categorias buscadas e os parados na cédula",
    ],
    comando: "node scripts/e2e/professor/06-resultados-das-missoes.mjs",
  },
  async (r) => {
    /* O UnooTube abria esta suíte até ser ARQUIVADO (ADR-116): a prova de que a
       tela sem turma ENSINA o próximo passo mudou para o unooGPT, abaixo. */
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });

    // ── unooGPT (2ª série EM, unidade 1) ────────────────────────────────
    const professorEM = conta("professor", { serie: "2EM" });
    await r.entrar(p, professorEM.login);
    await p.goto(`${HUB}/professor/entre-redes/2-serie/unidade-1/resultados`, {
      waitUntil: "domcontentloaded",
    });
    await p.waitForSelector("select#turma", { timeout: 20_000 });
    await p.waitForTimeout(1500);
    const semTurma = await p.locator("main").innerText();
    r.exigir(
      /Escolha a turma acima/.test(semTurma),
      "sem turma escolhida, a tela ENSINA o próximo passo em vez de mostrar tabela vazia",
    );
    await r.registrar(p, "resultados-sem-turma", {
      titulo: "Antes de escolher a turma",
      mostra: "O seletor de turma e a instrução do que fazer.",
      prova:
        "Tabela vazia sem explicação faz o professor achar que a turma dele não jogou. A frase " +
        "custa uma linha e evita um chamado de suporte.",
    });
    const opcoesEM = await p
      .locator("select#turma option")
      .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
    const alvoEM = opcoesEM.find((o) => o.value);
    if (alvoEM) {
      await p.selectOption("select#turma", alvoEM.value);
      await p.waitForURL("**turmaId=**", { timeout: 20_000 });
      await p.waitForTimeout(2500);
    }
    const temRelogio = await p.locator("text=Relógio da aula").count();
    r.exigir(temRelogio > 0, "o relógio da aula fica na MESMA tela dos resultados");
    /* O fechamento da Tempestade (ADR-172): o WhatsApp e a moradora são abertos
       daqui, depois do debate, e o painel conta quem enviou. */
    r.exigir(
      (await p.locator("[data-fechamento]").count()) > 0,
      "o fechamento (o WhatsApp e a moradora) é aberto do mesmo painel do relógio",
    );
    r.exigir(
      (await p.locator("[data-alcance-do-alerta]").count()) > 0,
      "o card do debate traz a frase do alcance do alerta, que nunca vai ao grupo",
    );
    await r.registrar(p, "resultados-unoogpt", {
      titulo: "O relógio e os resultados do unooGPT",
      mostra: "O relógio da turma (largada, tempo, encerrar e o fechamento) acima da folha da turma.",
      prova:
        "Conduzir e ler ficam juntos aqui porque a condução É durante a aula: obrigar o professor " +
        "a trocar de tela entre dar a largada e ver quem travou seria desenhar para a demonstração, " +
        "não para a sala.",
      inteira: true,
    });

    // ── o relatório de um estudante do unooGPT ───────────────────────────
    // A suíte do estudante (estudante/04-unoogpt.mjs) corre ANTES e deixa uma
    // partida: é ela que este passo lê. Sem linha para abrir, a folha está
    // vazia — e a folha vazia já foi provada acima.
    // A COLUNA, não o texto da página: o rodapé da folha explica justamente por
    // que a coluna não existe, e a palavra aparece lá.
    const colunasDeResgate = await p.locator("table thead th", { hasText: /resgatad/i }).count();
    r.exigir(colunasDeResgate === 0, "a folha da turma NÃO tem coluna de resgatados (viraria ranking)");
    // O estudante da suíte estudante/04 é quem tem partida; a primeira linha
    // da folha pode ser alguém que nunca entrou.
    const estudanteEM = conta("estudante", { serie: "2EM" });
    const linhaDele = p.locator(`[data-estudante="${estudanteEM.login}"] a`, { hasText: "Abrir" });
    const abrir = (await linhaDele.count()) > 0 ? linhaDele.first() : p.locator("table tbody a", { hasText: "Abrir" }).first();
    if ((await abrir.count()) > 0) {
      await abrir.click();
      await p.waitForURL((url) => /unidade-1\/estudantes\//.test(url.pathname), { timeout: 20_000 });
      await p.locator("text=Como usou o tempo").first().waitFor({ timeout: 20_000 });
      await p.waitForTimeout(800);

      const relatorio = await p.locator("main").innerText();
      const posRessalva = relatorio.indexOf("Como ler este relatório");
      const posTempo = relatorio.indexOf("Como usou o tempo");
      r.exigir(posRessalva > 0, "o relatório abre com a ressalva de que isto não é nota");
      r.exigir(posRessalva < posTempo, "e a ressalva vem ANTES de qualquer número");
      r.exigir(/Até a primeira fala/.test(relatorio), "diz quanto demorou até a primeira fala");
      r.exigir(/Mudanças de destino/.test(relatorio), "conta as mudanças de destino antes de confirmar");
      r.exigir(/Ao confirmar/.test(relatorio), "diz com quanto relógio confirmou — ou se estourou");
      r.exigir(/A conversa/.test(relatorio), "e a transcrição continua na tela, com a hora de cada fala");
      const rodadas = await p.locator("[data-rodada]").count();
      r.exigir(rodadas > 0, `há ao menos uma rodada na linha do tempo (${rodadas})`);
      const comHora = await p.locator("main ol li", { hasText: /aos \d+:\d\d|\d\d:\d\d:\d\d/ }).count();
      r.exigir(comHora > 0, `as falas têm hora (${comHora} datadas)`);
      await r.registrar(p, "relatorio-do-estudante-unoogpt", {
        titulo: "O relatório de um estudante do unooGPT",
        mostra:
          "Até a primeira fala, mudanças de destino, com quanto relógio confirmou, cada marco da " +
          "trilha datado pelo cronômetro que a criança via, o desfecho por tentativa e a conversa com hora.",
        prova:
          "Tudo o que é TEMPO vem da trilha que a api grava com o relógio do instante — não da " +
          "telemetria, que o cliente preenche. O número de resgate aparece aqui, uma criança por vez, " +
          "e nunca na folha da turma.",
        detalhe: `${rodadas} rodada(s) · ${comHora} falas datadas`,
        inteira: true,
      });
    }

    // ── A Seleção (7º ano, unidade 1) ───────────────────────────────────
    /* A suíte do estudante (estudante/11-a-selecao.mjs) corre ANTES e deixa a
       turma com duas publicações pareadas: é a folha dela que este passo lê. */
    const professorSetimo = conta("professor", { serie: "7EF" });
    await r.entrar(p, professorSetimo.login);
    await p.goto(`${HUB}/professor/entre-redes/7-ano/unidade-1/resultados`, {
      waitUntil: "domcontentloaded",
    });
    await p.waitForSelector("select#turma", { timeout: 20_000 });
    await p.waitForTimeout(1500);
    const opcoesSetimo = await p
      .locator("select#turma option")
      .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
    /* A turma em que a estudante/11 CRIOU a atividade e a pôs no ar (ADR-130):
       sem atividade em andamento, a página da missão não tem aula para mostrar. */
    const alvoSetimo = opcoesSetimo.find((o) => o.value && o.label.includes("7A")) ?? opcoesSetimo.find((o) => o.value);
    if (alvoSetimo) {
      await p.selectOption("select#turma", alvoSetimo.value);
      await p.waitForURL("**turmaId=**", { timeout: 20_000 });
      await p.waitForTimeout(2500);
    }
    r.exigir(
      (await p.locator("[data-etapa]").count()) > 0,
      "o botão único da aula e a etapa atual ficam na MESMA tela da atividade em andamento",
    );
    const folhaSetimo = await p.locator("main").innerText().catch(() => "");
    r.exigir(
      !/\b(pontos|nota|score|ranking)\b/i.test(folhaSetimo),
      "a folha da A Seleção não traz coluna de pontos",
    );
    await r.registrar(p, "resultados-a-selecao", {
      titulo: "A atividade da A Seleção: a aula e os resultados",
      mostra:
        "A atividade em andamento: as equipes, as imagens, o botão que avança a turma (Mural, " +
        "fichas, explicação), a folha por computador e o painel de habilidades da BNCC.",
      prova:
        "Conduzir e ler ficam juntos porque a condução acontece DURANTE a aula. A folha mostra " +
        "o par e as lentes de cada computador, nunca uma nota.",
      inteira: true,
    });

    // ── O Júri Estadual de Projetos (6º ano, unidade 1) ─────────────────
    /* A suíte do estudante (estudante/13-juri-estadual.mjs) corre ANTES: cria a
       atividade na 6A, põe no ar, dois estudantes votam e a galeria abre. É a
       página DESSA atividade que este passo lê. A tela usa o `Selection` do DS
       (não o `select#turma`): a turma vai na URL, pela api, como a sala a abre. */
    const professorSexto = conta("professor", { serie: "6EF" });
    await r.entrar(p, professorSexto.login);
    const turmasDoJuri = await p.request.get(`${BFF}/juri-estadual/turmas`);
    const listaDoJuri = (await turmasDoJuri.json().catch(() => null))?.turmas ?? [];
    const turmaDoJuri = listaDoJuri.find((t) => t.nome === "6A") ?? listaDoJuri[0];
    if (!r.exigir(Boolean(turmaDoJuri), `${professorSexto.login} tem turma no seletor do Júri Estadual`)) return;
    await p.goto(`${HUB}/professor/entre-redes/6-ano/unidade-1/resultados?turmaId=${turmaDoJuri.id}`, {
      waitUntil: "domcontentloaded",
    });
    /* Os dois estados LEGÍTIMOS da página: a atividade em andamento (a da
       estudante/13) ou nenhuma — quando esta suíte roda sozinha, sem a do
       estudante antes. Espera a união e prova o ramo que a tela mostrou. */
    await p
      .locator("[data-etapa], [data-sem-atividade]")
      .first()
      .waitFor({ timeout: 30_000 });
    if ((await p.locator("[data-sem-atividade]").count()) > 0) {
      r.ressalva(
        "a 6A não tem atividade do Júri Estadual em andamento: rode antes a estudante/13-juri-estadual, que a cria",
      );
      r.exigir(
        /Nenhuma atividade em andamento nesta turma/.test(await p.locator("main").innerText()),
        "sem atividade, a página do Júri diz que a turma vê a missão fechada",
      );
    } else {
      r.exigir(
        (await p.locator("[data-painel-para-projetar]").count()) === 1,
        "a lousa do Júri (votos por área, sem nome) fica na MESMA tela da atividade em andamento",
      );
      const colunasDoJuri = await p.locator("main").getByRole("columnheader").allInnerTexts();
      r.exigir(
        colunasDoJuri.length > 0 &&
          !colunasDoJuri.some((c) => /^\s*voto\b|\b(taxa|n[íi]vel|invisibilidade|concentra\w*|pontos|nota|ranking)\b/i.test(c)),
        `a folha do Júri não tem coluna de voto, taxa, concentração nem nível (colunas: ${colunasDoJuri.join(", ")})`,
      );
      /* 40 projetos (2026-10-14): o total da página vem do PACOTE. */
      const totalDeEstandes = await p.locator("[data-estandes-da-atividade]").getAttribute("data-total-de-estandes");
      r.exigir(totalDeEstandes === "40", `a atividade do banco padrão mostra os 40 estandes, uma aba por área (${totalDeEstandes})`);
      /* A lousa trocou a “invisibilidade média” (com 40 estandes, 30 de 40 para
         todo computador — sempre a mesma) pela CONCENTRAÇÃO do feed, e ela só
         aparece depois de Liberar Auditoria. A estudante/13 deixa a turma na
         galeria; rodando sozinha, a turma pode estar antes dela — os dois ramos
         são legítimos e cada um é provado. */
      const lousaDoJuri = p.locator("[data-painel-para-projetar]");
      r.exigir(
        !/Invisibilidade média/i.test(await lousaDoJuri.innerText()),
        "a lousa não tem mais a “invisibilidade média da turma”: com 40 estandes ela seria a mesma para todos",
      );
      const concentracaoDoJuri = p.locator("[data-concentracao-do-feed]");
      if ((await p.locator('[data-etapa="galeria"]').count()) > 0) {
        await concentracaoDoJuri.waitFor({ timeout: 15_000 });
        const textoDaConcentracao = (await concentracaoDoJuri.innerText()).replace(/\s+/g, " ");
        r.exigir(
          /Quem curtiu algum post/.test(textoDaConcentracao) && /Quem não curtiu nenhum/.test(textoDaConcentracao),
          `depois da auditoria, a lousa mostra a concentração do feed — “Quem curtiu algum post” e “Quem não curtiu nenhum” (${textoDaConcentracao.slice(0, 160)})`,
        );
      } else {
        r.ressalva("a 6A ainda não liberou a auditoria: a concentração do feed não aparece por desenho (rode antes a estudante/13)");
        r.exigir((await concentracaoDoJuri.count()) === 0, "antes da auditoria, a lousa não mostra a concentração do feed");
      }
      /* ADR-174: a folha diz quem SEPAROU os estandes (a EF06CO01 — o acerto é
         nível e mora no painel de habilidades), e o painel conta quem está
         parado na cédula — o ícone ao lado do nome é provado AO VIVO na
         estudante/13 (ele some sozinho 40 s depois de a cédula fechar, então
         aqui só a coluna e a métrica). */
      r.exigir(
        colunasDoJuri.some((c) => /Separação/.test(c)) && !colunasDoJuri.some((c) => /Categorias buscadas/.test(c)),
        `a folha do Júri tem a coluna “Separação”, sem “Categorias buscadas” (colunas: ${colunasDoJuri.join(", ")})`,
      );
      r.exigir(
        (await p.getByText("Separaram os estandes", { exact: true }).count()) > 0,
        "o painel da aula conta quem separou os estandes",
      );
      r.exigir(
        (await p.getByText("Parados na cédula", { exact: true }).count()) > 0,
        "o painel da aula conta quem está parado na cédula (o sinalizador de ociosos)",
      );
      const linhasDoJuri = await p.locator("main").getByRole("row").allInnerTexts();
      const comBusca = linhasDoJuri.filter((l) => /\(#[^)]+\)/.test(l));
      if (comBusca.length === 0) {
        r.ressalva("nenhuma linha da folha tem categoria buscada: rode antes a estudante/13-juri-estadual, que busca por hashtag");
      } else {
        r.exigir(true, `a folha mostra a categoria buscada com o nome e a hashtag (${comBusca[0].replace(/\s+/g, " ").slice(0, 120)})`);
      }
    }
    await r.registrar(p, "resultados-juri-estadual", {
      titulo: "A atividade do Júri Estadual: a aula e os resultados",
      mostra:
        "A atividade em andamento: os 40 estandes em abas por área, o botão Liberar Auditoria, os parados na " +
        "cédula, a lousa com os votos por área antes e depois da galeria e a concentração do feed (quem curtiu × " +
        "quem não curtiu), a folha por computador com as categorias buscadas e o painel de habilidades da BNCC.",
      prova:
        "A lousa vai para o projetor e não tem nome; a folha tem nome e por isso não liga ninguém a um voto, a uma " +
        "taxa ou à concentração do feed. O nível de cada habilidade fica no painel de habilidades, com a " +
        "confirmação da professora.",
      inteira: true,
    });
  },
);
