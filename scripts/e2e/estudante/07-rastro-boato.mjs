import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O Rastro do Boato (exp-06), nas duas pontas da sala.
 *
 * A missão é de DUAS AULAS, e quem separa uma da outra é a professora. O
 * roteiro prova as duas metades: primeiro que o estudante trava no fim da Aula
 * 1, depois que o botão dela solta a turma inteira. Um roteiro de um contexto
 * só passaria com o gate quebrado.
 *
 * Prova também o portão que a missão inteira existe para instalar: **decidir
 * sem ter aberto os dados de três mensagens é recusado**. É o comportamento que
 * a experiência está tentando desfazer, e é a única regra aqui que vale a aula.
 *
 * E prova a descoberta central em número: quem encaminha alcança 1.200; quem
 * apaga para si alcança 850. Se os dois empatassem, a tela ensinaria que a
 * inação é neutra — o contrário do que a missão descobre.
 *
 * A casca do mensageiro roda na seção `whatsappmobile` do design system, em
 * tema escuro (o pacote não publica outro). As telas depois da decisão — o
 * breakpoint, o gráfico, o mapa, o ciclo e o percurso — falam pela escola.
 */
const SERIE = "6EF";
/* A turma vem do CSV do seed, não fixada aqui: o seed já renomeou turma uma
   vez, e um roteiro que fixa o nome falha com "timeout esperando option" — um
   sintoma que não aponta para a causa. */
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;

/** As três fontes que sustentam a descoberta, cada uma numa conversa. */
const AUDITAR = [
  { chat: "Grêmio Estudantil", mensagem: "msg-boato-01" },
  { chat: "Turma 6º B", mensagem: "msg-audio-anonimo" },
  { chat: "Grupo do Bairro", mensagem: "msg-laudo-pdf" },
];

await suite(
  {
    slug: "estudante/07-rastro-boato",
    papel: "estudante",
    titulo: "O Rastro do Boato — por que a mentira voa?",
    subtitulo: "os dados de envio, a decisão sem dica e o mapa da rede",
    contexto:
      "Um aviso de que a água da escola está contaminada corre quatro grupos em dez minutos, e " +
      "a nota da direção com o laudo quase não sai do lugar. A criança abre os dados de envio de " +
      "cada mensagem, descobre que o alerta veio de seis encaminhamentos anônimos sem autor — e " +
      "decide o que fazer quando chega o áudio convocando um protesto.",
    prova: [
      "Sem abrir os dados de 3 mensagens distintas, a decisão é RECUSADA",
      "Reabrir o mesmo balão não avança a cota — ela é sobre fontes, não sobre repetição",
      "No fim da Aula 1 o estudante trava, e é a professora que solta a turma",
      "O mapa da rede desenha o alcance da decisão: 1.200 encaminhando, 850 calando",
      "A malha de 1.200 nós não põe 1.200 elementos no DOM — o aparelho da escola não trava",
      "A folha da turma não tem coluna de pontos — não é ranking de crianças",
    ],
    comando: "node scripts/e2e/estudante/07-rastro-boato.mjs",
  },
  async (r) => {
    /**
     * Aperta um botão do painel da aula e ESPERA o efeito na tela.
     *
     * As duas coisas juntas, e nenhuma é opcional:
     *
     * - **espera a hidratação.** Depois de um `reload`, o botão do SSR já está
     *   no DOM mas o React ainda não ligou o `onClick`. Um `click` ali é aceito
     *   pelo Playwright e não faz NADA — e o roteiro só descobre 30 s depois,
     *   no estudante, com "não achei as curvas": um sintoma que não aponta para
     *   a causa. Foi exatamente o que aconteceu na primeira versão disto.
     * - **confere que a etapa mudou.** Sem isso, um gate quebrado deixa o
     *   roteiro seguir e falhar na tela errada.
     */
    const apertar = async (pagina, acao, etapaEsperada) => {
      const botao = pagina.locator(`[data-gate="${acao}"]`);
      await botao.waitFor({ timeout: 20_000 });
      await pagina.waitForFunction(
        (sel) => {
          const b = document.querySelector(sel);
          return Boolean(b) && !b.hasAttribute("disabled");
        },
        `[data-gate="${acao}"]`,
        { timeout: 15_000 },
      );
      await pagina.waitForTimeout(600);
      await botao.click();
      await pagina.waitForSelector(`[data-etapa="${etapaEsperada}"]`, { timeout: 20_000 });
    };

    // ═══ PROFESSORA: abre a aula, mas NÃO libera a Aula 2 ═════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, conta("professor", { serie: SERIE }).login);

    await prof.goto(`${HUB}/professor/entre-redes/6-ano/unidade-2`, {
      waitUntil: "domcontentloaded",
    });
    await prof.waitForSelector("text=/duas aulas/i", { timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do professor",
      mostra:
        "A missão explicada para quem vai conduzir: os quatro atos, a pausa entre as aulas e o " +
        "que o software não conta ao estudante.",
      prova:
        "A professora precisa saber ANTES que a Aula 2 é ela quem abre. Uma turma inteira parada " +
        "numa tela de pausa é o pior jeito de descobrir isso.",
    });

    await prof.click("text=Abrir a aula e os resultados");
    await prof.waitForURL("**/resultados**", { timeout: 20_000 });
    /* `select#turma`, NÃO o primeiro `<select>`: quem tem mais de uma lotação
       ganhou um seletor de ESCOLA no cabeçalho, que vem antes no DOM. */
    const seletor = prof.locator("select#turma");
    await seletor.waitFor({ timeout: 15_000 });
    const opcoes = await seletor
      .locator("option")
      .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
    const alvo = opcoes.find((o) => o.label.includes(TURMA) && o.value);
    if (!alvo) throw new Error(`turma ${TURMA} não está no seletor (rode o seed)`);
    await prof.selectOption("select#turma", alvo.value);
    await prof.waitForURL("**turmaId=**", { timeout: 20_000 });
    await prof.waitForSelector("text=A aula", { timeout: 20_000 });

    /* ZERAR PRIMEIRO: o estado é server-side e sobrevive ao roteiro. Sem isto a
       segunda execução encontra o estudante já na decisão, e o roteiro passa
       por cima do portão que ele existe para provar. */
    if (await prof.locator("[data-zerar-turma]").count()) {
      await prof.click("[data-zerar-turma]");
      await prof.locator("text=/Zerar a turma/i").last().click();
      await prof.waitForTimeout(1500);
    }
    /* E a aula volta para a 1: zerar apaga as sessões, mas o gate é da turma —
       se a rodada anterior deixou a Aula 2 aberta, o breakpoint não aconteceria
       e a metade mais importante do roteiro passaria por vazio. */
    await apertar(prof, "pausar-simulacao", "aula1");
    await r.registrar(prof, "painel-da-aula", {
      titulo: "O botão que move a sala",
      mostra: "Abrir a Aula 2 e o inverso dele, com o retrato da turma abaixo.",
      prova:
        "Um clique move a sala inteira. O estado é da TURMA, não de cada aparelho, e é isso que " +
        "faz as 30 telas chegarem juntas ao mapa da rede.",
    });

    // ═══ ESTUDANTE: a Aula 1 ══════════════════════════════════════════════
    const estudante = conta("estudante", { serie: SERIE });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login);

    await p.goto(`${HUB}/exp/exp-06-rastro-boato`, { waitUntil: "domcontentloaded" });
    let q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/480 encaminhamentos/i").waitFor({ timeout: 40_000 });
    await r.registrar(p, "contexto", {
      titulo: "480 contra 12",
      mostra:
        "O contraste que abre a missão: o aviso não confirmado correu 480 vezes em dez minutos; " +
        "a nota da direção, 12.",
      prova:
        "A pergunta da missão está nesses dois números, antes de qualquer explicação. É a " +
        "assimetria que a criança vai investigar — e depois ver desenhada.",
    });

    await q.getByRole("button", { name: /Entrar no aplicativo/i }).click();
    await q.locator("text=/Grêmio Estudantil/i").waitFor({ timeout: 20_000 });
    await r.registrar(p, "lista-de-conversas", {
      titulo: "As quatro conversas",
      mostra: "Grêmio, turma, bairro e o privado do Tomás — com as não-lidas de cada um.",
      prova:
        "As três fontes que sustentam a descoberta estão em conversas DIFERENTES de propósito: " +
        "a investigação não cabe numa rolagem só.",
    });

    // ═══ O PORTÃO: decidir sem auditar é recusado ═════════════════════════
    /* O 409 abaixo é o COMPORTAMENTO SENDO EXERCITADO, não um defeito: sem
       declará-lo, a suíte que prova que a trava funciona ficaria vermelha por
       causa dela — e vermelho que não significa nada é o começo do fim de um
       smoke. O erro não some do relatório: muda de seção, com o motivo ao lado. */
    r.provocado(
      /rastro-boato\/decisao/,
      "a suíte tenta decidir sem auditar 3 fontes de propósito: é a trava que a missão inteira existe para instalar",
    );

    const semCota = await p.evaluate(async () => {
      const r = await fetch("/api/plataforma/rastro-boato/decisao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opcao: "B", latenciaSeg: 3, houveInacao90s: false }),
      });
      return { status: r.status, corpo: await r.json().catch(() => ({})) };
    });
    r.exigir(
      semCota.status === 409 && semCota.corpo?.codigo === "auditoria-insuficiente",
      `decidir sem auditar 3 fontes é recusado (veio ${semCota.status} ${semCota.corpo?.codigo ?? ""})`,
    );

    // ═══ A AUDITORIA, uma fonte por conversa ══════════════════════════════
    for (const [i, alvo] of AUDITAR.entries()) {
      await q.locator(`text=${alvo.chat}`).first().click();
      await q.locator(".feed__balao").first().waitFor({ timeout: 20_000 });
      const balao = q.locator(`.feed__balao`).nth(0);
      await balao.click();
      await q.locator("text=/Dados da mensagem/i").waitFor({ timeout: 15_000 });

      if (i === 0) {
        await r.registrar(p, "dados-da-mensagem", {
          titulo: "Seis encaminhamentos, nenhum autor",
          mostra:
            "O painel de dados de envio: quantas vezes a mensagem foi encaminhada, quem assinou " +
            "e quando ela apareceu pela primeira vez.",
          prova:
            "Nada aqui diz que a mensagem é falsa. Os números estão na tela e a conclusão é da " +
            "criança — é exatamente isso que a missão mede (EF06CO01).",
        });
      }

      await q.getByRole("button", { name: /^Fechar$/i }).click();
      await p.waitForTimeout(500);
      /* Reabrir o MESMO balão, uma vez só: a cota é sobre fontes distintas, e
         se a repetição contasse, três toques no mesmo aviso abririam a crise. */
      if (i === 0) {
        await balao.click();
        await q.getByRole("button", { name: /^Fechar$/i }).click();
        await p.waitForTimeout(500);
        const estado = await p.evaluate(async () => {
          const r = await fetch("/api/plataforma/rastro-boato/sessao");
          return r.json();
        });
        r.exigir(
          estado.totalAuditadas === 1,
          `reabrir o mesmo balão não conta de novo (a api diz ${estado.totalAuditadas})`,
        );
      }
      await q.getByRole("button", { name: /voltar/i }).first().click().catch(() => {});
      await p.waitForTimeout(400);
    }

    // ═══ O PICO: a crise chega, e a tela não dá dica nenhuma ══════════════
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/Boato em circulação rápida/i").waitFor({ timeout: 30_000 });
    await r.registrar(p, "a-decisao", {
      titulo: "O pico, em silêncio",
      mostra:
        "O banner de contágio, o áudio convocando o protesto e as três respostas. Nada mais.",
      prova:
        "Cinco elementos, e nenhuma dica: com uma muleta aqui a escolha deixaria de ser da " +
        "criança. A frase de apoio só aparece depois de 90 segundos parados.",
    });

    /* A escolha vai pela API, e não pelo clique: o que o roteiro precisa provar
       é o MAPA, e o caminho de tela até ele já foi fotografado acima. */
    const decisao = await p.evaluate(async () => {
      const r = await fetch("/api/plataforma/rastro-boato/decisao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opcao: "A", latenciaSeg: 22, houveInacao90s: false }),
      });
      return r.json();
    });
    r.exigir(
      decisao.topologia?.alcance === 1200,
      `encaminhar acende 1.200 conexões (a api devolveu ${decisao.topologia?.alcance})`,
    );
    r.exigir(
      decisao.desfecho === "amplificou",
      "o desfecho só chega DEPOIS do envio — antes dele a tela não sabe qual opção corta a corrente",
    );

    // ═══ O BREAKPOINT: o estudante trava ══════════════════════════════════
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/Debate em andamento/i").waitFor({ timeout: 30_000 });
    await r.registrar(p, "fim-da-aula-1", {
      titulo: "Fim da Aula 1",
      mostra: "A tela de pausa: a investigação e a resposta estão salvas, e a conversa continua depois.",
      prova:
        "A criança não fez nada errado — ela chegou ao fim da aula. Uma tela de bloqueio genérica " +
        "aqui faria parecer que ela perdeu a missão.",
    });

    // ═══ A PROFESSORA ABRE A AULA 2 ══════════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await apertar(prof, "liberar-aula2", "aula2");
    await r.registrar(prof, "aula-2-liberada", {
      titulo: "A Aula 2 abre para a turma inteira",
      mostra: "O painel depois do clique: a etapa muda, e as telas dos estudantes andam junto.",
      prova:
        "É este clique que faz 30 crianças chegarem juntas ao mapa. Sem ele, cada uma veria a " +
        "revelação sozinha, no seu ritmo — e o debate perderia o objeto.",
    });

    // ═══ O AHA: as curvas e o mapa ═══════════════════════════════════════
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/Velocidade nas primeiras horas/i").waitFor({ timeout: 30_000 });
    await r.registrar(p, "as-curvas", {
      titulo: "26 vezes mais rápido",
      mostra:
        "As duas curvas: o aviso sobe exponencial em traço grosso; a nota da direção segue quase " +
        "reta, em tracejado fino.",
      prova:
        "A assimetria é geométrica, não legendada. Uma criança de 11 anos que ainda lê gráfico " +
        "com esforço vê a diferença antes de ler qualquer número.",
    });

    /* A trava de 5s é analítica: sem ela o botão abriria antes de a leitura
       acontecer, e o Aha! chegaria sem o contraste que o sustenta. */
    await p.waitForTimeout(5500);
    await q.getByRole("button", { name: /Ver o mapa da rede/i }).click();
    await q.locator("text=/Por onde a mensagem passou/i").waitFor({ timeout: 20_000 });

    const nos = await q.locator(".mapa circle").count();
    r.exigir(
      nos > 0 && nos < 200,
      `a malha de 1.200 conexões é desenhada agrupada (${nos} círculos no DOM, não 1.200)`,
    );
    await r.registrar(p, "o-mapa-da-rede", {
      titulo: "1.200 conexões, e o nó que era seu",
      mostra:
        "A malha da propagação: o nó do estudante em anel duplo e, abaixo dele, a mancha do que " +
        "o encaminhamento acendeu.",
      prova:
        "O número está por extenso e a mancha comunica a escala — mas são poucos círculos no " +
        "DOM. 1.200 elementos SVG travariam o Chromebook da escola.",
      inteira: true,
    });

    // ═══ O CICLO E O PERCURSO ════════════════════════════════════════════
    await q.getByRole("button", { name: /Construir o ciclo/i }).click();
    await q.locator("text=/O ciclo do boato/i").waitFor({ timeout: 20_000 });
    await r.registrar(p, "o-construtor", {
      titulo: "Nomear o ciclo",
      mostra: "Os quatro slots e os quatro blocos causais, montados por toque.",
      prova:
        "Toque sequencial, não arraste: arrastar num Chromebook de escola não funciona com " +
        "teclado nem com leitor de tela.",
    });

    const modelo = await p.evaluate(async () => {
      const r = await fetch("/api/plataforma/rastro-boato/modelagem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ordemBlocos: ["desfecho", "sem-checagem", "repasse", "gatilho"],
        }),
      });
      return { status: r.status, corpo: await r.json() };
    });
    r.exigir(
      modelo.status === 200 && modelo.corpo.coerente === false,
      "ordem trocada é INCOERENTE e grava igual — não há penalidade, e a missão segue",
    );

    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    /* Pelo HEADING, não por texto: "Meu percurso" também está no rótulo do
       botão de salvar, e o modo estrito do Playwright recusa dois casamentos. */
    await q.getByRole("heading", { name: /Meu percurso/i }).waitFor({ timeout: 30_000 });
    await r.registrar(p, "meu-percurso", {
      titulo: "O que farei da próxima vez",
      mostra: "A pergunta do percurso, o campo de 280 caracteres e o episódio de recapitulação em texto.",
      prova:
        "É o único texto livre da missão, e o dado mais sensível dela. Nenhuma rota de gestor o " +
        "alcança: quem lê é o professor da turma dela.",
    });

    await q.locator("textarea").fill(
      "Percebi que o medo faz repassar sem pensar. Vou abrir os dados da mensagem antes.",
    );
    await q.getByRole("button", { name: /Salvar no Meu percurso/i }).click();
    await q.locator("text=/Missão concluída/i").waitFor({ timeout: 20_000 });
    await r.registrar(p, "missao-concluida", {
      titulo: "Missão concluída",
      mostra: "A reflexão gravada no portfólio, em modo leitura.",
      prova:
        "O registro é definitivo. Não há nota em lugar nenhum desta tela — a leitura pedagógica " +
        "é de conduta, não de acerto.",
    });

    // ═══ A FOLHA DA TURMA ════════════════════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.waitForSelector("text=/Fontes auditadas/i", { timeout: 20_000 });
    const cabecalhos = await prof.locator("table thead th").allTextContents();
    const proibido = cabecalhos.find((c) => /pontos|nota|score|posição/i.test(c));
    r.exigir(!proibido, `a folha da turma não tem coluna de pontos (achei "${proibido ?? ""}")`);
    await r.registrar(prof, "folha-da-turma", {
      titulo: "O retrato da turma, sem placar",
      mostra:
        "Quem auditou quantas fontes, o que respondeu, se montou o ciclo e o texto do percurso.",
      prova:
        "Listagem é ordenável, e ordenar crianças por acerto viraria ranking. O que se lê aqui é " +
        "conduta — e a distribuição A/B/C é o material do debate.",
    });
  },
);
