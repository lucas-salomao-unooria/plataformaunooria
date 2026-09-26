import { HUB, suite } from "../lib/roteiro.mjs";
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
