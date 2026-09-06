import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";

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
const TURMA_UNOOTUBE = process.env.TURMA_UNOOTUBE ?? "4A";

await suite(
  {
    slug: "professor/06-resultados-das-missoes",
    papel: "professor",
    titulo: "Os resultados, por missão",
    subtitulo: "UnooTube e unooGPT: o que o professor lê depois da aula",
    contexto:
      "Cada missão tem a sua tela de resultados, dentro da unidade do ano a que pertence. Elas " +
      "são recalculadas a cada visita — nada ali é número gravado que ninguém sabe mais como foi " +
      "computado.",
    prova: [
      "A tela sem turma escolhida ensina o que fazer, em vez de mostrar tabela vazia",
      "O resumo da turma traz total, concluintes e a média — e a base de cada um",
      "Todo número vem com um bloco de 'como ler'",
      "A tabela lista TODOS os estudantes, inclusive quem não entrou",
      "O relógio da aula do unooGPT é operável da mesma tela dos resultados",
      "O relatório de um estudante do unooGPT diz QUANDO: até a primeira fala, com quanto relógio, se estourou",
    ],
    comando: "node scripts/e2e/professor/06-resultados-das-missoes.mjs",
  },
  async (r) => {
    /* O docente precisa LECIONAR na turma pedida: o seletor lista as turmas
       dele, não as da escola. */
    const professor =
      contasDe("professor").find((c) => c.turma.split(" + ").includes(TURMA_UNOOTUBE)) ??
      conta("professor", { serie: "4EF" });
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(p, professor.login);

    // ── UnooTube (4º ano, unidade 1) ────────────────────────────────────
    await p.goto(`${HUB}/professor/entre-redes/4-ano/unidade-1`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1800);
    await r.registrar(p, "ficha-unootube", {
      titulo: "A ficha da missão do UnooTube",
      mostra: "O que a missão faz, o que ela mede e o caminho para os resultados.",
      prova:
        "A ficha do professor pode entregar a virada — ele PRECISA saber que o ranking troca de " +
        "critério. É a copy do estudante que não pode.",
      inteira: true,
    });

    await p.locator("a", { hasText: "Ver resultados da turma" }).click();
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

    /* PORTÃO DE HIDRATAÇÃO: o `<select>` existe no HTML do SSR antes do bundle,
       e mudá-lo nesse intervalo não dispara o `onChange` do React. */
    const opcoes = await p
      .locator("select#turma option")
      .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
    const alvo = opcoes.find((o) => o.label.includes(TURMA_UNOOTUBE) && o.value) ?? opcoes.find((o) => o.value);
    r.exigir(Boolean(alvo), `o seletor lista as turmas deste professor (${opcoes.length - 1})`);
    await p.selectOption("select#turma", alvo.value);
    await p.waitForURL("**turmaId=**", { timeout: 20_000 });
    await p.waitForTimeout(2500);

    const linhas = await p.locator("table tbody tr").count();
    const corpo = await p.locator("main").innerText();
    r.exigir(linhas > 0, `a tabela lista ${linhas} estudante(s), inclusive quem não entrou`);
    r.exigir(/Como ler/.test(corpo), "os números vêm com um bloco de 'como ler'");
    r.exigir(
      /métrica-isca/.test(corpo),
      "e o bloco explica que 'inscritos' é a isca: quem tem mais inscritos escolheu pior",
    );
    await r.registrar(p, "resultados-unootube", {
      titulo: "Os resultados do UnooTube",
      mostra: `Resumo da turma, distribuição de fontes confiáveis e ${linhas} linhas nominais.`,
      prova:
        "'Inscritos' e 'fontes confiáveis' andam em sentidos opostos de propósito, e a tela DIZ " +
        "isso. Sem a explicação, um professor apressado leria o ranking de inscritos como mérito.",
      detalhe: `${linhas} estudantes`,
      inteira: true,
    });

    // ── O Eco no Grupo (7º ano, unidade 1) ──────────────────────────────
    /* A suíte do estudante (estudante/06-o-eco-no-grupo.mjs) corre ANTES e
       deixa a turma com percurso entregue: é ele que este passo lê. */
    const professorSetimo = conta("professor", { serie: "7EF" });
    await r.entrar(p, professorSetimo.login);
    await p.goto(`${HUB}/professor/entre-redes/7-ano/unidade-1/resultados`, {
      waitUntil: "domcontentloaded",
    });
    await p.waitForSelector("select#turma", { timeout: 20_000 });
    await p.waitForTimeout(1500);
    const opcoesEco = await p
      .locator("select#turma option")
      .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
    const alvoEco = opcoesEco.find((o) => o.value);
    if (alvoEco) {
      await p.selectOption("select#turma", alvoEco.value);
      await p.waitForURL("**turmaId=**", { timeout: 20_000 });
      await p.waitForTimeout(2500);
    }
    const temGates = await p.locator("[data-gate]").count();
    r.exigir(temGates >= 3, "os três momentos da aula ficam na MESMA tela dos resultados");
    const folhaEco = await p.locator("table").first().innerText().catch(() => "");
    r.exigir(
      !/\b(pontos|nota|score)\b/i.test(folhaEco),
      "a folha do Eco no Grupo não traz coluna de pontos",
    );
    await r.registrar(p, "resultados-o-eco-no-grupo", {
      titulo: "A aula de duas etapas e os resultados",
      mostra:
        "Os três botões que conduzem a turma — abrir a Aula 2, congelar o debate, liberar o " +
        "percurso — e o retrato de quem abriu a matéria antes de responder.",
      prova:
        "É a única missão da trilha em duas aulas, e a segunda não começa sozinha. Conduzir e ler " +
        "ficam juntos porque a condução acontece DURANTE a aula.",
      inteira: true,
    });

    // ── unooGPT (2ª série EM, unidade 1) ────────────────────────────────
    const professorEM = conta("professor", { serie: "2EM" });
    await r.entrar(p, professorEM.login);
    await p.goto(`${HUB}/professor/entre-redes/2-serie/unidade-1/resultados`, {
      waitUntil: "domcontentloaded",
    });
    await p.waitForSelector("select#turma", { timeout: 20_000 });
    await p.waitForTimeout(1500);
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
    await r.registrar(p, "resultados-unoogpt", {
      titulo: "O relógio e os resultados do unooGPT",
      mostra: "O relógio da turma (largada, tempo, encerrar) acima da folha da turma.",
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
  },
);
