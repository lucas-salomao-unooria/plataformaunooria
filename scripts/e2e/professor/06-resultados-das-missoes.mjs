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
      "A aula da A Seleção (o botão único e a etapa) mora na mesma tela dos resultados, sem coluna de pontos",
      "A aula do Júri Estadual mora na página da atividade: os 40 estandes, a lousa anônima dos votos por área e — depois da auditoria — da concentração do feed, a folha sem coluna de voto, taxa, concentração nem nível, e com as categorias buscadas e os parados na cédula",
      "A aula do Enigma da Capa da Rádio mora na página da atividade: quem aguarda a virada, o botão único LIBERAR VIRADA, os cartões da conversa e a folha por criança sem coluna de nível, nota ou ranking",
    ],
    comando: "node scripts/e2e/professor/06-resultados-das-missoes.mjs",
  },
  async (r) => {
    /* O UnooTube abria esta suíte até ser ARQUIVADO (ADR-116): a prova de que a
       tela sem turma ENSINA o próximo passo mudou para o unooGPT, abaixo. */
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });

    // ── O Efeito Amplificador (2ª série EM, unidade 1): a tela sem turma ──
    /* Até a ADR-181 esta unidade era a Missão Tempestade (unooGPT), e a suíte
       provava aqui o relógio da aula e o relatório de um estudante dela. A
       Tempestade virou versão anterior (`exp02em1b-v0`), fora do catálogo: a
       rota da unidade é d'O Efeito Amplificador, e aquelas provas foram com a
       missão para `anteriores/`. O que continua valendo, e é provado aqui, é a
       tela sem turma ENSINAR o próximo passo. */
    const professorEM = conta("professor", { serie: "2EM" });
    await r.entrar(p, professorEM.login);
    await p.goto(`${HUB}/professor/entre-redes/2-serie/unidade-1/resultados`, {
      waitUntil: "domcontentloaded",
    });
    await p.getByText(/Escolha a turma acima/).first().waitFor({ timeout: 20_000 });
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
        "A atividade em andamento, com as cinco abas do template e a Aula ao vivo aberta: o botão que " +
        "avança a turma (Mural, fichas, explicação) e a folha por computador. Equipes, conteúdo, podcast " +
        "e o painel de habilidades da BNCC ficam nas outras abas.",
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

    // ── O Enigma da Capa da Rádio (2º ano, unidade 1) ───────────────────
    /* A suíte do estudante (estudante/14-enigma-capa.mjs) corre ANTES: cria a
       atividade com IA na 2A, põe no ar, libera a virada e um estudante conclui.
       É a página DESSA atividade que este passo lê; rodando sozinha, a turma
       pode estar sem atividade — os dois ramos são legítimos e cada um é provado. */
    const professorSegundo = conta("professor", { serie: "2EF" });
    await r.entrar(p, professorSegundo.login);
    const turmasDoEnigma = (await (await p.request.get(`${BFF}/enigma-capa/turmas`)).json().catch(() => null))?.turmas ?? [];
    const turmaDoEnigma = turmasDoEnigma.find((t) => t.nome === "2A") ?? turmasDoEnigma[0];
    if (!r.exigir(Boolean(turmaDoEnigma), `${professorSegundo.login} tem turma no seletor do Enigma da Capa da Rádio`)) return;
    await p.goto(`${HUB}/professor/entre-redes/2-ano/unidade-1/resultados?turmaId=${turmaDoEnigma.id}`, {
      waitUntil: "domcontentloaded",
    });
    await p.locator("[data-painel-da-aula], [data-sem-atividade], [data-atividade-pronta]").first().waitFor({ timeout: 30_000 });
    if ((await p.locator("[data-painel-da-aula]").count()) === 0) {
      r.ressalva("a 2A não tem atividade do Enigma em andamento: rode antes a estudante/14-enigma-capa, que a cria");
      r.exigir(
        /Nenhuma atividade em andamento nesta turma|Esta atividade está pronta/.test(await p.locator("main").innerText()),
        "sem atividade em andamento, a página do Enigma diz que a turma vê a missão fechada",
      );
    } else {
      const lousa = (await p.locator("[data-lousa]").innerText()).replace(/\s+/g, " ");
      r.exigir(
        /Entraram/.test(lousa) && /Publicaram a capa/.test(lousa) && /Aguardam a virada/.test(lousa) && /Concluíram/.test(lousa),
        "a lousa do Enigma conta quem entrou, publicou, aguarda a virada e concluiu",
      );
      r.exigir(
        (await p.locator('[data-acao="liberar-virada"]').count()) === 1,
        "o botão único da aula (LIBERAR VIRADA, ou “Virada liberada” depois) fica na mesma tela da atividade",
      );
      r.exigir(
        /ENQUADRAMENTO/.test(await p.locator("[data-cartoes]").innerText()),
        "os cartões da nomeação (ENQUADRAMENTO, AUTORIA, O QUE FICOU DE FORA) estão à mão na aula",
      );
      const colunasDoEnigma = await p.locator("[data-folha]").getByRole("columnheader").allInnerTexts();
      r.exigir(
        colunasDoEnigma.length > 0 && !colunasDoEnigma.some((c) => /\b(n[íi]vel|pontos|nota|ranking)\b/i.test(c)),
        `a folha do Enigma não tem coluna de nível, nota nem ranking (colunas: ${colunasDoEnigma.join(", ")})`,
      );
      await p.locator("[data-folha]").scrollIntoViewIfNeeded();
    }
    await r.registrar(p, "resultados-enigma-capa", {
      titulo: "A atividade do Enigma da Capa da Rádio: a aula e os resultados",
      mostra:
        "A atividade em andamento: a lousa (entraram, publicaram, aguardam a virada, concluíram), o botão único " +
        "LIBERAR VIRADA, a conversa individual com os três cartões e a folha por criança — crachá, lupa, capa, busca, " +
        "o que ficou fora, o par, a segunda foto e o voto da horta.",
      prova:
        "A virada é um botão só, para a turma toda (decisão do Lucas). A folha é para a tela da professora: o que " +
        "cada criança fez, para a conversa; o nível de cada habilidade fica na aba Habilidades.",
      inteira: true,
    });

    // ── O Assistente Invisível (1ª série EM, unidade 1) ─────────────────
    /* A suíte do estudante (estudante/16-assistente-invisivel.mjs) corre ANTES:
       cria a atividade na 1EM-A, passa pelas liberações até “Liberar Publicação
       e Transparência”, e um estudante publica. É a página DESSA atividade que
       este passo lê; rodando sozinha, a turma pode estar sem atividade — os dois
       ramos são legítimos e cada um é provado. */
    const professorPrimeiraEM = conta("professor", { serie: "1EM" });
    await r.entrar(p, professorPrimeiraEM.login);
    const turmasDoAssistente =
      (await (await p.request.get(`${BFF}/assistente-invisivel/turmas`)).json().catch(() => null))?.turmas ?? [];
    const turmaDoAssistente = turmasDoAssistente.find((t) => t.nome === "1EM-A") ?? turmasDoAssistente[0];
    if (!r.exigir(Boolean(turmaDoAssistente), `${professorPrimeiraEM.login} tem turma no seletor do Assistente Invisível`)) return;
    await p.goto(`${HUB}/professor/entre-redes/1-serie/unidade-1/resultados?turmaId=${turmaDoAssistente.id}`, {
      waitUntil: "domcontentloaded",
    });
    await p.locator("[data-painel-da-aula], [data-sem-atividade], [data-atividade-pronta]").first().waitFor({ timeout: 30_000 });
    if ((await p.locator("[data-painel-da-aula]").count()) === 0) {
      r.ressalva("a 1EM-A não tem atividade do Assistente Invisível em andamento: rode antes a estudante/16-assistente-invisivel, que a cria");
      r.exigir(
        /Nenhuma atividade em andamento nesta turma|Esta atividade está pronta/.test(await p.locator("main").innerText()),
        "sem atividade em andamento, a página do Assistente Invisível diz que a turma vê a missão fechada",
      );
    } else {
      const fase = await p.locator("[data-painel-da-aula]").getAttribute("data-fase-da-turma");
      const lousa = (await p.locator("[data-lousa]").innerText()).replace(/\s+/g, " ");
      r.exigir(/Painel ao Vivo/.test(lousa), `a aula do Assistente Invisível mora na página da atividade (fase da turma: ${fase})`);
      /* Os botões só andam para a frente: em cada fase, só os da fase seguinte (e nenhum em “publicar”). */
      const botoes = await p.locator("[data-botoes-da-aula] button").allInnerTexts();
      r.exigir(
        fase === "publicar" ? botoes.length === 0 : botoes.length >= 1 && botoes.length <= 2,
        `os botões da aula são os da fase “${fase}”, só para a frente (${botoes.join(" · ") || "nenhum"})`,
      );
      const colunas = await p.locator("[data-folha]").getByRole("columnheader").allInnerTexts();
      r.exigir(
        colunas.length > 0 && !colunas.some((c) => /\b(n[íi]vel|pontos|nota|ranking)\b/i.test(c)),
        `a folha do Assistente Invisível não tem coluna de nível, nota nem ranking (colunas: ${colunas.join(", ")})`,
      );
      if (fase === "publicar") {
        const relatorio = p.locator("[data-relatorio-final]");
        r.exigir(
          (await relatorio.locator("[data-matriz-bncc]").innerText()).includes("EM13CO20") &&
            (await relatorio.locator("[data-niveis-por-estudante]").count()) === 1 &&
            (await p.locator('[data-acao="imprimir-relatorio-homologacao"]').count()) === 1,
          "na publicação, o relatório formativo traz a matriz BNCC, os níveis por estudante e “Exportar Relatório de Homologação Ética”",
        );
        await relatorio.scrollIntoViewIfNeeded();
      } else {
        await p.locator("[data-folha]").scrollIntoViewIfNeeded();
      }
    }
    await r.registrar(p, "resultados-assistente-invisivel", {
      titulo: "A atividade do Assistente Invisível: a aula e os resultados",
      mostra:
        "A atividade em andamento: o Painel ao Vivo com a etiqueta da fase, os botões da fase seguinte, a folha por " +
        "estudante (onde está, aposta, cartões, etapas do algoritmo, critérios e publicação) e, na Etapa 6, o " +
        "relatório formativo com a matriz BNCC, os níveis e a exportação para impressão.",
      prova:
        "As liberações andam só para a frente, com confirmação. A folha é para a tela do professor, sem nível; os " +
        "níveis (Canal A) ficam no relatório final e na aba Habilidades, sem nota nem ordenação.",
      inteira: true,
    });
  },
);
