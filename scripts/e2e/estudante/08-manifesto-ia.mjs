import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O Manifesto da IA (exp-08), nas duas pontas da sala.
 *
 * A missão prova três coisas, e cada uma é uma regra que o software instala:
 *
 * 1. **Fixar a regra do sistema sem tê-lo contraditado é RECUSADO.** É o portão
 *    que a aula inteira existe para instalar (PED-02): a criança tem de ouvir a
 *    máquina admitir que herda as punições do passado antes de decidir o que
 *    fazer com ela.
 * 2. **A pausa da professora congela a tela do estudante — por POLLING, não por
 *    WebSocket** (ADR-93). O roteiro aperta o botão dela e espera o overlay
 *    aparecer do outro lado; um roteiro de um contexto só passaria com o gate
 *    quebrado.
 * 3. **Dado pessoal na justificativa é recusado com 422 e NÃO gravado.** É a
 *    única superfície da missão em que a regra de privacidade vira experiência
 *    vivida, e é a decisão que estava aberta no insumo.
 *
 * A conversa roda na seção `chatgpt` do design system, em tema claro. O
 * briefing, o congelamento, o Meu Percurso e o fechamento falam pela escola
 * (seção `unooria`) — a fronteira é quem fala, e aqui ela não é uma revelação:
 * o estudante sempre soube que era uma aula.
 */
const SERIE = "8EF";
/* A turma vem do CSV do seed, não fixada aqui: o seed já renomeou turma uma
   vez, e um roteiro que fixa o nome falha com "timeout esperando option" — um
   sintoma que não aponta para a causa. */
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;

/** Os dois questionamentos obrigatórios, na ordem que a hipótese pede. */
const AUDITAR = ["prompt_origem_dados", "prompt_preconceito_historico"];

await suite(
  {
    slug: "estudante/08-manifesto-ia",
    papel: "estudante",
    titulo: "O Manifesto da IA — nossos direitos em código",
    subtitulo: "a auditoria da máquina, a cláusula irreversível e a pausa para o debate",
    contexto:
      "A direção está homologando a compra de um sistema que prevê notas e monitora presença, e " +
      "o assistente da escola já está online afirmando que algoritmos são neutros. O estudante " +
      "questiona a origem dos dados, ouve a máquina admitir que assume as punições antigas como " +
      "probabilidade válida — e então fixa UMA cláusula de governança que o código passa a obedecer.",
    prova: [
      "Sem contraditar a máquina 2 vezes, fixar a cláusula é RECUSADO",
      "O mesmo questionamento duas vezes NÃO fecha a cota — ela é sobre argumentos, não repetição",
      "A réplica da máquina não está no bundle antes da pergunta ser feita",
      "A pausa da professora congela a tela do estudante por polling HTTP, sem WebSocket",
      "Dado pessoal na justificativa é recusado com 422 e não é gravado",
      "A folha da turma não tem coluna de pontos nem taxa de acerto — as 4 cláusulas são válidas",
    ],
    comando: "node scripts/e2e/estudante/08-manifesto-ia.mjs",
  },
  async (r) => {
    /**
     * Aperta um botão do painel do debate e ESPERA o efeito na tela dela.
     *
     * As duas coisas juntas, e nenhuma é opcional:
     *
     * - **espera a hidratação.** Depois de um `reload`, o botão do SSR já está
     *   no DOM mas o React ainda não ligou o `onClick`. Um `click` ali é aceito
     *   pelo Playwright e não faz NADA — e o roteiro só descobre 30s depois, no
     *   estudante, com "não achei o overlay": um sintoma que não aponta para a
     *   causa.
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

    // ═══ PROFESSORA: a ficha, o preparo e o painel ════════════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, conta("professor", { serie: SERIE }).login);

    await prof.goto(`${HUB}/professor/entre-redes/8-ano/unidade-4`, {
      waitUntil: "domcontentloaded",
    });
    await prof.waitForSelector("text=/cláusula de governança/i", { timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do professor",
      mostra:
        "A missão explicada para quem vai conduzir: os cinco atos, a pausa para o debate e o que " +
        "o software não conta ao estudante.",
      prova:
        "A professora precisa saber ANTES que não há cláusula certa. Descobrir isso no meio do " +
        "debate, com a turma esperando um veredito, é o pior jeito.",
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
    await prof.waitForSelector("text=Preparação da missão", { timeout: 20_000 });

    /* ZERAR PRIMEIRO: o estado é server-side e sobrevive ao roteiro. Sem isto a
       segunda execução encontra o estudante já com a cláusula fixada, e o
       roteiro passa por cima do portão que ele existe para provar. */
    if (await prof.locator("[data-zerar-turma]").count()) {
      await prof.click("[data-zerar-turma]");
      await prof.locator("text=/^Zerar a turma$/").last().click();
      await prof.waitForTimeout(1500);
    }
    /* E o debate volta a fechar: zerar apaga as sessões e devolve o gate a
       `missao`, mas conferir é barato — se a rodada anterior deixou a turma
       congelada, o estudante travaria no briefing e a metade mais importante
       do roteiro passaria por vazio. */
    await apertar(prof, "retomar-missao", "missao");
    await r.registrar(prof, "preparo-e-painel", {
      titulo: "A preparação, e o botão que congela a sala",
      mostra:
        "O formulário do caso da escola, o aviso de que nada gerado por inteligência artificial " +
        "chega aos estudantes sem aprovação, e os dois botões do debate.",
      prova:
        "A curadoria docente é obrigatória (exigência 8.2): gerar devolve rascunho, e o que " +
        "publica é o clique dela. Sem aprovar nada, a missão roda com o pacote curado da Unooria.",
    });

    // ═══ ESTUDANTE: o briefing e a abertura da conversa ══════════════════
    const estudante = conta("estudante", { serie: SERIE });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login);

    await p.goto(`${HUB}/exp/exp-08-manifesto-ia`, { waitUntil: "domcontentloaded" });
    let q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/monitorar notas e presença/i").waitFor({ timeout: 40_000 });
    await r.registrar(p, "alerta-de-amara", {
      titulo: "Amara chama",
      mostra:
        "O alerta: a direção quer instalar uma inteligência artificial para monitorar notas e " +
        "presença, e o sistema afirma decidir de forma neutra.",
      prova:
        "A pergunta da missão está aqui, antes de qualquer explicação — quem confere se o código " +
        "é justo? O áudio ainda não foi gravado, e o texto está sempre na tela.",
    });

    await q.locator('[data-acao="iniciar-chat"]').click();
    await q.locator("text=/algoritmos matemáticos são neutros/i").waitFor({ timeout: 20_000 });
    await r.registrar(p, "muro-da-neutralidade", {
      titulo: "O muro da neutralidade",
      mostra:
        "A primeira fala da máquina, fria e corporativa, e a faixa com os três princípios em " +
        "disputa. A barra de digitar está atenuada: escrever livre não existe aqui.",
      prova:
        "A ausência de digitação livre é guardrail, não limitação: prompt aberto num clone de " +
        "assistente é a porta para conteúdo fora da faixa numa aula com adolescentes.",
    });

    // ═══ O PORTÃO: fixar a regra sem contraditar é recusado ═══════════════
    /* O 409 abaixo é o COMPORTAMENTO SENDO EXERCITADO, não um defeito: sem
       declará-lo, a suíte que prova que a trava funciona ficaria vermelha por
       causa dela — e vermelho que não significa nada é o começo do fim de um
       smoke. O erro não some do relatório: muda de seção, com o motivo ao lado. */
    r.provocado(
      /manifesto-ia\/clausula/,
      "a suíte tenta fixar a cláusula sem contraditar a máquina de propósito: é a trava que a missão inteira existe para instalar",
    );

    const semCota = await p.evaluate(async () => {
      const r = await fetch("/api/plataforma/manifesto-ia/clausula", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clausulaId: "clausula_veto_humano",
          latenciaSeg: 3,
          confirmouProvocacao: false,
        }),
      });
      return { status: r.status, corpo: await r.json().catch(() => ({})) };
    });
    r.exigir(
      semCota.status === 409 && semCota.corpo?.codigo === "auditoria-insuficiente",
      `fixar a cláusula sem 2 questionamentos é recusado (veio ${semCota.status} ${semCota.corpo?.codigo ?? ""})`,
    );

    // ═══ A RÉPLICA NÃO ESTÁ NO BUNDLE ANTES DA PERGUNTA ══════════════════
    const sessaoCrua = await p.evaluate(async () => {
      const r = await fetch("/api/plataforma/manifesto-ia/sessao");
      return r.json();
    });
    const temReplica = JSON.stringify(sessaoCrua.catalogo?.prompts ?? []).includes("replicaIa");
    r.exigir(
      !temReplica,
      "a defesa da máquina não vem em /sessao: ver a resposta antes de perguntar desmontaria a auditoria",
    );
    const temJustificativa = JSON.stringify(sessaoCrua.catalogo?.clausulas ?? []).includes(
      "justificativaSugerida",
    );
    r.exigir(
      !temJustificativa,
      "o argumento pronto de cada cláusula não vem ao estudante: é material do professor",
    );

    // ═══ A AUDITORIA, e a repetição que NÃO conta ════════════════════════
    for (const [i, promptId] of AUDITAR.entries()) {
      await q.locator(`[data-prompt="${promptId}"]`).click();
      await q.locator('button[aria-label="Enviar mensagem"], [aria-label="Enviar mensagem"]')
        .first()
        .click()
        .catch(async () => {
          /* O `Composer` do DS é um `<form>`: se o alvo de envio mudar de
             rótulo numa versão nova, o Enter continua submetendo. É fallback
             declarado, não gambiarra — e por isso o `forms` está no manifesto. */
          await q.locator("textarea, input[type=text]").first().press("Enter");
        });

      if (i === 0) {
        await q.locator("text=/cinco anos de arquivos da secretaria/i").waitFor({ timeout: 25_000 });
        await r.registrar(p, "primeira-defesa", {
          titulo: "A máquina responde com estatística",
          mostra:
            "A primeira defesa: cinco anos de arquivos da secretaria, padrões objetivos, noventa " +
            "e dois por cento de precisão.",
          prova:
            "Nada aqui é falso, e é isso que faz a auditoria valer: o cálculo É objetivo. O que " +
            "está errado é a escolha do que calcular — e o segundo questionamento é que a expõe.",
        });

        /* Reenviar o MESMO questionamento: a cota é sobre argumentos distintos,
           e se a repetição contasse, dois toques no mesmo card abririam o pico
           sem a criança ter visto a contradição. */
        r.provocado(
          /manifesto-ia\/disparar/,
          "a suíte reenvia o mesmo questionamento de propósito: a cota é sobre argumentos distintos, não sobre repetição",
        );
        const repetido = await p.evaluate(async (id) => {
          const r = await fetch("/api/plataforma/manifesto-ia/disparar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ promptId: id, latenciaSeg: 4 }),
          });
          return { status: r.status, corpo: await r.json().catch(() => ({})) };
        }, promptId);
        r.exigir(
          repetido.status === 409 && repetido.corpo?.codigo === "prompt-ja-enviado",
          `o mesmo questionamento duas vezes é recusado (veio ${repetido.status} ${repetido.corpo?.codigo ?? ""})`,
        );
      }
    }

    await q.locator("text=/probabilidade estatística válida/i").waitFor({ timeout: 25_000 });
    await r.registrar(p, "a-contradicao", {
      titulo: "A contradição, em voz alta",
      mostra:
        "A segunda defesa: se determinados grupos tiveram mais punições no passado, o algoritmo " +
        "assume essa frequência como probabilidade válida.",
      prova:
        "É o ponto de virada da aula, e a máquina o diz sozinha. Nenhum texto da plataforma " +
        "explica o viés — quem tem de nomeá-lo é a criança (EF08CO05).",
    });

    // ═══ O PICO: quatro cláusulas, nenhuma certa ═════════════════════════
    await q.locator("text=/Escolha uma cláusula inegociável/i").waitFor({ timeout: 25_000 });
    await r.registrar(p, "o-pico", {
      titulo: "A cláusula inegociável",
      mostra:
        "A concessão da máquina e as quatro salvaguardas em grid. Sem Amara, sem dica, sem barra " +
        "de progresso.",
      prova:
        "Teto de cinco elementos e silêncio total: o peso da escolha é o objeto da etapa. As " +
        "quatro cláusulas são válidas — não há resposta certa a procurar na tela.",
    });

    await q.locator('[data-clausula="clausula_veto_humano"]').click();
    await q.locator('[data-acao="submeter-clausula"]').click();
    /* A confirmação do caminho degenerado: o clique veio em menos de 5s de
       tela, então a máquina devolve a provocação e pede o segundo toque. */
    await q.locator("text=/Deseja confirmar essa prioridade/i").waitFor({ timeout: 15_000 });
    await r.registrar(p, "provocacao-minima", {
      titulo: "A máquina pergunta se é isso mesmo",
      mostra: "A réplica provocativa que o clique rápido dispara, e o botão de confirmar.",
      prova:
        "O sistema ACEITA a escolha — não frustrar é regra —, mas a criança a faz duas vezes. É " +
        "o caminho degenerado da exploração mínima, e ele não invalida nada.",
    });
    await q.locator('[data-acao="submeter-clausula"]').click();

    // ═══ O AHA!: o manifesto promulgado ═════════════════════════════════
    await q.locator('[data-manifesto="promulgado"]').waitFor({ timeout: 30_000 });
    const documento = await q.locator('[data-manifesto="promulgado"]').innerText();
    r.exigir(
      documento.includes("Veto Humano Obrigatório"),
      "o manifesto carrega a cláusula ESCOLHIDA em destaque",
    );
    r.exigir(
      !documento.includes("Anonimização Estrita"),
      "e NÃO carrega as outras três: a diretriz soberana é uma, senão a escolha do pico não teria consequência",
    );
    await r.registrar(p, "o-manifesto", {
      titulo: "A máquina reescreve as próprias diretrizes",
      mostra:
        "O Manifesto de Direitos Digitais dos Estudantes, dentro do bloco de código do " +
        "assistente, com a cláusula escolhida como diretriz soberana e o botão de copiar.",
      prova:
        "O documento é compilado no SERVIDOR: é a evidência do percurso, e o que a professora lê " +
        "no painel tem de ser o mesmo texto que a criança copiou.",
    });

    // ═══ O CHECKPOINT A: a professora congela, e a tela dele para ═══════
    await apertar(prof, "pausar-para-debate", "debate");
    /* O polling é de 5s (ADR-93, não há WebSocket): a espera aqui tem de caber
       mais de um ciclo, senão a suíte reprova por ritmo e não por defeito. */
    await q.locator("text=/Manifesto em análise coletiva/i").waitFor({ timeout: 30_000 });
    await r.registrar(p, "congelado-para-o-debate", {
      titulo: "A turma para junto",
      mostra:
        "O overlay de pausa cobrindo a conversa: manifesto em análise coletiva, participe da " +
        "discussão com a turma.",
      prova:
        "Um clique da professora congelou esta tela — por polling HTTP de 5 segundos, porque não " +
        "há WebSocket de aplicação no Cloud Run (ADR-93). A tela não tem como fechar: quem " +
        "solta é ela.",
    });

    /* E a assinatura é recusada enquanto o debate corre: o overlay é UX, e a
       regra vale no servidor — `/manifesto-ia/percurso` é endereço alcançável. */
    r.provocado(
      /manifesto-ia\/percurso/,
      "a suíte tenta assinar durante o debate e depois com um telefone no texto: as duas recusas são o comportamento sendo exercitado",
    );
    const duranteODebate = await p.evaluate(async () => {
      const r = await fetch("/api/plataforma/manifesto-ia/percurso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tags: ["autonomia", "justica"],
          justificativa: "Nenhuma máquina deve decidir sozinha sobre a vida de uma pessoa.",
        }),
      });
      return { status: r.status, corpo: await r.json().catch(() => ({})) };
    });
    r.exigir(
      duranteODebate.status === 409 && duranteODebate.corpo?.codigo === "debate-em-andamento",
      `assinar durante o debate é recusado no servidor (veio ${duranteODebate.status} ${duranteODebate.corpo?.codigo ?? ""})`,
    );

    await apertar(prof, "retomar-missao", "missao");

    // ═══ A ASSINATURA, e o dado pessoal recusado ════════════════════════
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator('[data-campo="justificativa"], textarea').first().waitFor({ timeout: 30_000 });
    await r.registrar(p, "meu-percurso", {
      titulo: "Por que essa cláusula é inegociável para você",
      mostra:
        "A cláusula aprovada em citação, as quatro palavras-chave (das quais ele marca 2) e o " +
        "campo do parágrafo autoral.",
      prova:
        "É o único texto livre da missão, e o dado mais sensível dela. Nenhuma rota de gestor o " +
        "alcança: quem lê é o professor da turma dela (LGPD art. 14).",
    });

    /* O FILTRO DE DADO PESSOAL: 422 com dica, e nada gravado. Era a pergunta
       aberta do insumo — recusar ou gravar com flag —, e recusar ENSINA: a
       criança reescreve no momento em que ia entregar o telefone. */
    const comTelefone = await p.evaluate(async () => {
      const r = await fetch("/api/plataforma/manifesto-ia/percurso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tags: ["autonomia", "justica"],
          justificativa: "Se errarem comigo me liguem no (11) 98765-4321 para eu poder contestar.",
        }),
      });
      return { status: r.status, corpo: await r.json().catch(() => ({})) };
    });
    r.exigir(
      comTelefone.status === 422 && comTelefone.corpo?.codigo === "dado-pessoal-no-texto",
      `telefone na justificativa é recusado com 422 (veio ${comTelefone.status} ${comTelefone.corpo?.codigo ?? ""})`,
    );

    /* E não foi gravado: a recusa é ANTES do banco, não uma flag depois dele. */
    const aindaSemPercurso = await p.evaluate(async () => {
      const r = await fetch("/api/plataforma/manifesto-ia/sessao");
      return r.json();
    });
    r.exigir(
      aindaSemPercurso.percurso === null && aindaSemPercurso.registrouPercurso === false,
      "o texto com telefone NÃO foi gravado — a recusa é anterior ao banco",
    );

    await q.locator('[data-tag="autonomia"] input, [data-tag="autonomia"]').first().click();
    await q.locator('[data-tag="justica"] input, [data-tag="justica"]').first().click();
    await q.locator("textarea").first().fill(
      "Uma pessoa tem de olhar antes de uma máquina decidir que alguém vai mal na escola.",
    );
    await q.locator('[data-acao="registrar-percurso"]').click();
    await q.locator('[data-selo="protocolo"]').waitFor({ timeout: 25_000 });
    await r.registrar(p, "protocolado", {
      titulo: "A cláusula protocolada",
      mostra:
        "O selo de protocolo, a cláusula, as duas palavras-chave e o parágrafo — em modo leitura.",
      prova:
        "O formulário entra em latch: não há botão de editar, e a ausência é a regra. O que foi " +
        "assinado foi assinado.",
    });

    // ═══ O FECHAMENTO ═══════════════════════════════════════════════════
    await q.locator('[data-acao="avancar-reflexao"]').click();
    await q.locator('[data-acao="ler-transcricao"]').waitFor({ timeout: 20_000 });
    await q.locator('[data-acao="ler-transcricao"]').click();
    await q.locator("text=/código auditado/i").waitFor({ timeout: 20_000 });
    await r.registrar(p, "transcricao-do-episodio", {
      titulo: "O episódio, em texto",
      mostra: "Os cinco blocos do fechamento com Amara e Léo, no modal acessível.",
      prova:
        "A gravação ainda não existe, e a transcrição não é remendo: é o conteúdo acessível para " +
        "a sala sem fone de ouvido. O botão de ouvir aparece desabilitado com o motivo à vista, " +
        "em vez de um player que não toca nada.",
    });

    // ═══ A FOLHA DA TURMA ═══════════════════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.waitForSelector("text=/Cláusula fixada/i", { timeout: 20_000 });
    const cabecalhos = await prof.locator("table thead th").allTextContents();
    const proibido = cabecalhos.find((c) => /pontos|nota|score|posição|acerto|taxa/i.test(c));
    r.exigir(
      !proibido,
      `a folha da turma não tem coluna de pontos nem de acerto (achei "${proibido ?? ""}")`,
    );
    await r.registrar(prof, "folha-da-turma", {
      titulo: "O retrato da turma, sem placar",
      mostra:
        "Quantos questionamentos cada um disparou, que cláusula fixou, as palavras-chave e o " +
        "texto que escreveu. Acima, a distribuição das quatro cláusulas.",
      prova:
        "Não há coluna de acerto porque não há acerto: as quatro salvaguardas são válidas. A " +
        "distribuição é o material das três perguntas do debate, e a frase na tela diz isso.",
    });
  },
);
