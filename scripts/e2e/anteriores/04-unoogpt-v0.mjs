import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { provarPodcastNaAula } from "../lib/podcast.mjs";
import { esperarOuFalharPorHttp } from "../lib/smoke.mjs";

/**
 * A Missão Tempestade (exp02em1b), nas duas pontas da sala.
 *
 * O relógio é da TURMA: sem a largada do professor, o estudante entra, vê o mapa
 * e NÃO consegue falar com o Cientista. O roteiro prova as duas metades —
 * primeiro que ele está bloqueado, depois que a largada o libera. Um roteiro de
 * um contexto só passaria com o relógio quebrado.
 *
 * A experiência inteira roda na seção `unooriaai` do design system (ADR-138),
 * sem revelação no software: aqui a mediação é do professor, na sala.
 *
 * Os seletores são CONTRATO com a experiência (README da exp02em1b).
 */
const SERIE = "2EM";
/* A turma vem do CSV do seed, não fixada aqui: o seed já renomeou "2A" para
   "2EM-A" uma vez, e um roteiro que fixa o nome falha com "timeout esperando
   option" — um sintoma que não aponta para a causa. */
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;

await suite(
  {
    slug: "estudante/04-unoogpt",
    papel: "estudante",
    titulo: "UnooriaAI — a Missão Tempestade",
    subtitulo: "o relógio da turma, o orçamento de perguntas e o mapa que começa vazio",
    contexto:
      "Uma emergência climática: equipes limitadas, bairros demais, e um assistente de IA que " +
      "responde com o que foi carregado nele — nem mais, nem menos. A criança decide onde alocar " +
      "e descobre, ao simular, o que não perguntou.",
    prova: [
      "Sem a largada do professor, o campo de conversa fica desabilitado",
      "A largada libera a missão em segundos, pelo relógio da turma",
      "O mapa começa VAZIO: ponto cego é ausência de dado, não zero",
      "O turno com o Cientista é gravado no servidor e sobrevive a um F5",
      "A folha da turma não tem coluna de resgatados — não é ranking de crianças",
      "Ao encerrar a missão, o nível aparece no painel aberto, sem recarregar",
      "Zerar a turma apaga as habilidades, e o painel recomeça do zero",
      "Depois de zerar, a turma joga de novo: largada nova, e o turno com o Cientista é gravado",
      "A ligação da Saúde aparece antes da decisão, e o pedido só da contagem traz a contagem por bairro",
      "\"Enviar equipes\" abre o registro da operação, sem relógio, antes de qualquer resultado",
      "O resultado traz as duas comparações nas mesmas 20 tempestades, e não há mais pergunta de múltipla escolha",
      "O fechamento só aparece quando o professor o abre, com o balão do mensageiro em tema claro, e o painel conta quem enviou",
      "A tela individual traz a transcrição inteira para o professor",
      "A conclusão da operação cabe na coluna ao lado do mapa, sem nada cortado",
    ],
    comando: "node scripts/e2e/estudante/04-unoogpt.mjs",
  },
  async (r) => {
    // ═══ PROFESSOR: abre a aula, mas AINDA NÃO dá a largada ═══════════════
    const prof = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, conta("professor", { serie: SERIE }).login);

    await prof.goto(`${HUB}/professor/entre-redes/2-serie/unidade-1`, { waitUntil: "domcontentloaded" });
    await prof.waitForSelector("text=/largada/i", { timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do professor",
      mostra: "A missão explicada para quem vai conduzir, com o aviso de que ela não começa sozinha.",
      prova:
        "O professor precisa saber ANTES que a largada é dele: uma turma inteira esperando numa " +
        "tela que não avança é o pior jeito de descobrir isso.",
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
    await prof.waitForSelector("text=Relógio da aula", { timeout: 20_000 });
    /* Os resultados DESTA turma: o roteiro abre depois a tela de um estudante,
       e o painel de habilidades do fim está aqui, não lá. */
    const resultadosDaTurma = prof.url();

    /* ZERAR PRIMEIRO: o estado é server-side e sobrevive ao roteiro. Sem isto a
       segunda execução encontra o estudante já na investigação e o smoke passa
       por causa da rodada anterior. E de graça isto cobre o caminho destrutivo. */
    if (await prof.locator("[data-zerar-turma]").count()) {
      await prof.click("[data-zerar-turma]");
      await prof.locator("text=/Apaga as partidas|apaga todas as partidas/i").first().waitFor({ timeout: 10_000 });
      await prof.locator("button", { hasText: /^Zerar a turma$/ }).last().click();
      await prof.waitForTimeout(2500);
      await r.registrar(prof, "turma-zerada", {
        titulo: "O professor zera a turma",
        mostra: "A confirmação de que as partidas e o relógio voltaram ao início.",
        prova:
          "Zerar é destrutivo e por isso pede confirmação nomeando o que apaga. É o caminho de " +
          "repetir a missão com a mesma turma noutra aula.",
      });
      await prof.reload({ waitUntil: "domcontentloaded" });
      await prof.waitForSelector("text=Relógio da aula", { timeout: 20_000 });
    }

    await r.registrar(prof, "antes-da-largada", {
      titulo: "O relógio parado",
      mostra: "O cronômetro em zero e o botão 'Dar a largada' habilitado.",
      prova:
        "A aula tem um começo comum. Sem isso, quem chega antes tem mais tempo de missão que " +
        "quem chega depois — e a comparação da turma perde o sentido.",
    });

    // ═══ ESTUDANTE: bloqueado, porque a largada não veio ══════════════════
    const estudante = conta("estudante", { serie: SERIE });
    const p = await r.pagina("estudante", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(p, estudante.login);

    await p.goto(`${HUB}/exp/exp02em1b-v0`, { waitUntil: "domcontentloaded" });
    const quadro = p.frameLocator('iframe[data-experiencia]');
    await quadro.locator("text=/Não dá para atender todos/i").waitFor({ timeout: 40_000 });
    await r.registrar(p, "a-missao", {
      titulo: "A missão: a emergência",
      mostra: "A situação: uma tempestade chegando, equipes de menos, bairros demais.",
      prova:
        "O dilema é declarado sem moralizar. A missão não tem resposta certa — tem escolhas com " +
        "consequências que a simulação vai mostrar.",
    });

    /* Entrar ANTES da largada é a melhor prova do portão: a investigação abre, o
       cronômetro aparece PARADO e o campo não aceita fala nenhuma. */
    await quadro.locator("button", { hasText: /começar/i }).first().click();
    await quadro.locator("text=/Aguardando o professor/i").waitFor({ timeout: 25_000 });
    const campoBloqueado = quadro.locator("form input").first();
    await campoBloqueado.waitFor({ timeout: 20_000 });
    r.exigir(
      await campoBloqueado.isDisabled(),
      "antes da largada, o campo de conversa está DESABILITADO — o portão é do servidor",
    );
    await r.registrar(p, "estudante-esperando", {
      titulo: "O estudante espera a largada",
      mostra: "O mapa já visível, o cronômetro parado e o campo de conversa bloqueado.",
      prova:
        "Deixar entrar e travar a conversa é melhor que barrar a tela: a criança se ambienta no " +
        "mapa enquanto a turma inteira chega.",
    });

    // ═══ PROFESSOR: dá a largada ══════════════════════════════════════════
    await prof.click("text=Dar a largada");
    await prof.waitForSelector("text=Em andamento", { timeout: 20_000 });
    await r.registrar(prof, "largada-dada", {
      titulo: "A largada",
      mostra: "A fase muda para 'Em andamento' e o cronômetro começa a correr para a turma toda.",
      prova: "Um clique move a sala inteira. O estado é da turma, não de cada aparelho.",
    });

    // ═══ ESTUDANTE: a missão abre ═════════════════════════════════════════
    /* O polling do relógio é de 5s; recarregar é mais rápido e igualmente
       válido. O estudante NÃO volta à abertura — o passo é server-side. */
    await p.reload({ waitUntil: "domcontentloaded" });
    const q2 = p.frameLocator('iframe[data-experiencia]');
    const campo = q2.locator("form input").first();
    await campo.waitFor({ timeout: 40_000 });
    await q2.locator("text=/Perguntas:/i").waitFor({ timeout: 20_000 });
    r.exigir(!(await campo.isDisabled()), "depois da largada, o campo aceita fala");

    const desenhados = await q2.locator("[data-bairro]").count();
    const comDado = await q2.locator('[data-bairro][data-com-dado="true"]').count();
    r.exigir(desenhados > 0, `o mapa desenhou ${desenhados} bairros`);
    r.exigir(
      comDado === 0,
      "e nenhum deles tem estimativa antes de carregar fonte — o mapa começa VAZIO",
    );
    await r.registrar(p, "investigacao-liberada", {
      titulo: "A investigação abre, com o mapa vazio",
      mostra: `${desenhados} bairros desenhados, nenhum com número, e o orçamento de perguntas no topo.`,
      prova:
        "Ponto cego é AUSÊNCIA de dado, não zero. Um bairro mostrando '0 pessoas' antes de " +
        "qualquer fonte ensinaria exatamente o oposto da missão.",
      detalhe: `${desenhados} bairros · ${comDado} com dado`,
    });

    // ── um turno com o Cientista ─────────────────────────────────────────
    /* A asserção é a fala DO ESTUDANTE aparecendo — não a do agente: a mensagem
       de abertura dele já está na tela desde o começo, e esperar por texto do
       assistente passaria sem turno nenhum.
       E espera-se a RESPOSTA HTTP, não um sinal de tela: com provedor real o
       turno leva de 10 a 30 s, e recarregar antes encontra o banco vazio. */
    const PERGUNTA = "onde mora mais gente?";
    const turno = p.waitForResponse(
      (resp) => resp.url().includes("/unoogpt/pergunta") && resp.request().method() === "POST",
      { timeout: 120_000 },
    );
    await campo.pressSequentially(PERGUNTA, { delay: 15 });
    await campo.press("Enter");
    await q2.locator(`text=${PERGUNTA}`).first().waitFor({ timeout: 60_000 });
    const resposta = await turno;
    r.exigir(resposta.ok(), `o turno com o Cientista respondeu ${resposta.status()}`);

    /* A ASSERÇÃO DE VERDADE: a fala tem de SOBREVIVER a um reload. Ver o texto
       na tela não prova nada — o cliente mostra a fala do estudante
       otimistamente e só a retira se a api falhar. O que só um turno gravado
       produz é a conversa voltar inteira depois do F5. */
    await p.reload({ waitUntil: "domcontentloaded" });
    const q3 = p.frameLocator('iframe[data-experiencia]');
    await q3.locator(`text=${PERGUNTA}`).first().waitFor({ timeout: 40_000 });
    const orcamento = await q3.locator("text=/Perguntas:/").first().innerText();
    await r.registrar(p, "turno-do-cientista", {
      titulo: "Uma pergunta ao Cientista",
      mostra: "A conversa com a pergunta da criança e a resposta do agente, e o orçamento debitado.",
      prova:
        "O orçamento é debitado NO SERVIDOR: três perguntas por tentativa. E a conversa voltou " +
        "inteira depois de um F5 — ela está em `exp02em1b_v0_mensagens`, não na memória da aba.",
      detalhe: orcamento.replace(/\s+/g, " ").trim(),
    });

    // ═══ PROFESSOR: a folha da turma ══════════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.waitForSelector(`[data-estudante="${estudante.login}"]`, { timeout: 20_000 });
    const linha = await prof.locator(`[data-estudante="${estudante.login}"]`).innerText();

    const cabecalho = (await prof.locator("thead").first().innerText()).toLowerCase();
    const proibidas = ["resgatad", "salvas", "vítimas", "vitimas"].filter((t) => cabecalho.includes(t));
    r.exigir(
      proibidas.length === 0,
      `a folha da turma NÃO tem coluna de resgatados (${proibidas.join(", ") || "nenhuma"})`,
    );
    await r.registrar(prof, "folha-da-turma", {
      titulo: "A folha da turma, ao vivo",
      mostra: "Uma linha por criança, com o passo em que ela está e o que já consultou.",
      prova:
        "Nenhuma coluna conta quantas pessoas cada um 'salvou'. Listagem é ordenável, e uma coluna " +
        "dessas viraria ranking de crianças por decisão moral numa emergência fictícia.",
      detalhe: linha.replace(/\s+/g, " ").slice(0, 90),
    });

    await prof.locator(`[data-estudante="${estudante.login}"] a`).first().click();
    await prof.waitForSelector("text=O que a missão mediu", { timeout: 20_000 });
    await prof.waitForSelector("text=A conversa", { timeout: 20_000 });
    await r.registrar(prof, "relatorio-individual", {
      titulo: "A linha de uma criança",
      mostra: "O que a missão mediu, em graus, e a transcrição inteira da conversa com o Cientista.",
      prova:
        "A leitura é em GRAUS, não em nota. E a transcrição existe para o professor entender o " +
        "raciocínio — é o insumo da conversa em sala, não um resultado a publicar.",
      inteira: true,
    });

    // ═══ ESTUDANTE: a ligação da Saúde, antes da decisão (ADR-172) ═══════
    /* A ligação aparece no PRIMEIRO destino escolhido ou ao abrir a decisão. O
       turno com o Cientista pode já ter registrado um destino — então ela pode
       estar na tela antes do clique; os dois caminhos levam ao mesmo cartão. */
    const q4 = p.frameLocator('iframe[data-experiencia]');
    const ligacao = q4.locator('[aria-label="Ligação da Secretaria de Saúde"]');
    if ((await ligacao.count()) === 0) {
      await q4.locator("button", { hasText: /Definir destinos|Ver detalhes/ }).first().click();
    }
    await ligacao.waitFor({ timeout: 20_000 });
    await r.registrar(p, "ligacao-da-saude", {
      titulo: "A Secretaria de Saúde liga",
      mostra: "O cartão com quatro pedidos possíveis de dados de pessoas com deficiência ou mobilidade reduzida.",
      prova:
        "Decidir o que coletar de terceiros é conduta de quem trata o dado (EM13CO26). A tela não diz " +
        "qual pedido é o certo: o grupo escolhe, e recebe a consequência.",
    });
    await ligacao.getByRole("radio", { name: /Só o número dessas pessoas/ }).click();
    await esperarOuFalharPorHttp(p, ligacao.getByText("2.150 pessoas"), /\/unoogpt\/saude/, {
      timeout: 20_000,
      oQue: "a resposta à Saúde",
    });
    r.exigir(
      (await ligacao.getByText(/ficam no sistema/).count()) === 0,
      "quem pediu só a contagem não recebe nome nenhum — o aviso dos nomes é de quem pediu lista",
    );
    await r.registrar(p, "contagem-da-saude", {
      titulo: "A contagem chega",
      mostra: "Ribeirinha 2.150, Vale Verde 980, Morro Alto 850 e Industrial 190 pessoas.",
      prova:
        "A consequência é a contagem, sem nomes. Ela usa a base do cadastro antigo, e o Morro Alto " +
        "aparece com menos da metade: mais uma visão parcial para o debate.",
    });
    await ligacao.locator("button", { hasText: "Voltar para a operação" }).click();

    // ═══ ESTUDANTE: decide e manda as equipes ═══════════════════════════
    /* Fechada a ligação, a decisão abre (ou abre no botão). Destino das duas
       equipes, o "por quê" de cada uma, Enviar. Cada troca de destino é um POST
       — espera-se o select da justificativa aparecer. */
    const modal = q4.locator('[aria-label="Decisão operacional"]');
    if ((await modal.count()) === 0) {
      await q4.locator("button", { hasText: /Definir destinos|Ver detalhes/ }).first().click();
    }
    await modal.waitFor({ timeout: 20_000 });
    for (const [equipe, indice] of [["alfa", 1], ["bravo", 2]]) {
      await modal.locator(`select[aria-label="Destino da equipe ${equipe}"]`).selectOption({ index: indice });
      const porque = modal.locator(`select[aria-label="Por que a equipe ${equipe} vai para lá"]`);
      await porque.waitFor({ timeout: 20_000 });
      await porque.selectOption({ index: 1 });
    }
    await modal.locator("button", { hasText: /enviar/i }).first().click();

    // ═══ ESTUDANTE: o registro da operação, sem relógio (ADR-172) ═══════
    const registro = q4.locator('[aria-label="Registro da operação"]');
    await esperarOuFalharPorHttp(p, registro, /\/unoogpt\/mandar/, { timeout: 30_000, oQue: "Enviar equipes" });
    r.exigir(
      (await q4.locator("text=A tempestade passou").count()) === 0,
      "o resultado fica RETIDO até o registro: nada da tempestade aparece antes dele",
    );
    const cartoes = await registro.locator("section").count();
    r.exigir(cartoes >= 1, `o registro tem os cartões que se aplicam a este grupo (${cartoes})`);
    await r.registrar(p, "registro-da-operacao", {
      titulo: "O registro da operação",
      mostra:
        "As equipes já saíram, e o grupo registra o que leu, o que perguntaria às fontes e o alerta para quem ficou sem equipe.",
      prova:
        "Sem relógio: a hora de saída foi a do clique, e cada cartão mede uma habilidade sem a pressa da " +
        "investigação. O resultado só vem depois, e a tela nunca diz se acertou.",
      detalhe: `${cartoes} cartão(ões)`,
      inteira: true,
    });
    /* Responde o primeiro rádio de cada pergunta ainda aberta, cartão a
       cartão: o cartão vai inteiro quando a última pergunta dele é escolhida. */
    for (let volta = 0; volta < 12; volta++) {
      const aberta = registro.locator('[role="radiogroup"]:not(:has([aria-checked="true"]))').first();
      if ((await aberta.count()) === 0) break;
      await aberta.getByRole("radio").first().click();
      await p.waitForTimeout(700);
    }
    const verResultado = registro.locator("button", { hasText: "Ver o que aconteceu" });
    await esperarOuFalharPorHttp(p, verResultado, /\/unoogpt\/registro/, { timeout: 30_000, oQue: "o registro" });
    await r.registrar(p, "registro-feito", {
      titulo: "Operação registrada",
      mostra: "Os cartões marcados como registrados e o botão para ver o que aconteceu.",
      prova: "O desfecho estava no servidor desde o envio; ele só desce agora, com o registro feito.",
    });
    await verResultado.click();

    /* "A tempestade passou" só aparece depois da animação das equipes (4,8 s);
       antes disso o painel diz "Operação em curso". O que se prova aqui é o
       layout: o painel da esquerda tem de caber na coluna dele. Ele já saiu
       cortado na fronteira com o mapa, com barra de rolagem horizontal, porque
       o motivo da chegada (nowrap) empurrava a largura mínima da lista. */
    const passou = q4.locator("text=A tempestade passou");
    await passou.waitFor({ timeout: 60_000 });
    const largura = await passou.evaluate((el) => {
      const sec = el.closest("section");
      return { conteudo: sec.scrollWidth, coluna: sec.clientWidth };
    });
    r.exigir(
      largura.conteudo <= largura.coluna,
      `o painel da operação cabe na coluna (${largura.conteudo}px em ${largura.coluna}px)`,
    );
    await r.registrar(p, "tempestade-passou", {
      titulo: "A tempestade passou",
      mostra:
        "À esquerda, onde cada equipe chegou e por quê, o percentual de resgatadas e atingidas e o " +
        "risco coberto; à direita, o mapa com as rotas percorridas.",
      prova:
        "O painel cabe inteiro ao lado do mapa: o motivo da chegada quebra linha em vez de ser " +
        "cortado. E não há nota — o número é da cidade, não do estudante.",
      detalhe: `${largura.conteudo}px de conteúdo em ${largura.coluna}px de coluna`,
    });

    // ═══ ESTUDANTE: o "E se…" nas mesmas tempestades, e nada de Canal B ══
    let pediuPerguntas = false;
    p.on("request", (req) => {
      if (/\/evidencias\/exp02em1b-v0\/perguntas/.test(req.url())) pediuPerguntas = true;
    });
    await q4.locator("button", { hasText: /Ver o resultado completo/ }).first().click();
    const comparacoes = q4.locator('[aria-label="Duas outras decisões, nas mesmas 20 tempestades"]');
    await esperarOuFalharPorHttp(p, comparacoes, /\/unoogpt\/e-se/, { timeout: 30_000, oQue: "o \"E se…\"" });
    const quadradinhos = await comparacoes.locator(".faixa-de-tempestades").first().locator("span").count();
    r.exigir(quadradinhos === 20, `cada comparação mostra 20 tempestades (${quadradinhos})`);
    r.exigir(
      (await comparacoes.locator("ol.sr-only li").count()) === 40,
      "e o leitor de tela ouve as duas, tempestade a tempestade",
    );
    await comparacoes.scrollIntoViewIfNeeded();
    await r.registrar(p, "e-se-nas-mesmas-tempestades", {
      titulo: "Duas outras decisões, nas mesmas 20 tempestades",
      mostra: "Duas faixas de 20 quadradinhos, cada uma com a pergunta sobre o que ela permite afirmar.",
      prova:
        "As comparações são montadas pelo servidor — uma clara e uma que depende — e as duas decisões " +
        "rodam nas mesmas tempestades. O grupo interpreta o que o modelo prevê; a tela não diz se acertou.",
    });
    for (let volta = 0; volta < 4; volta++) {
      const aberta = comparacoes.locator('[role="radiogroup"]:not(:has([aria-checked="true"]))').first();
      if ((await aberta.count()) === 0) break;
      await aberta.getByRole("radio", { name: /Depende/ }).click();
      await p.waitForTimeout(700);
    }
    await esperarOuFalharPorHttp(p, comparacoes.getByText("Respostas enviadas ✓"), /\/unoogpt\/e-se/, {
      timeout: 20_000,
      oQue: "as respostas do \"E se…\"",
    });
    r.exigir(
      (await q4.getByText(/Antes de fechar|Quatro perguntas sobre o que você viveu/).count()) === 0,
      "não há mais as quatro perguntas de múltipla escolha no resultado (o Canal B saiu)",
    );
    r.exigir(!pediuPerguntas, "e a tela não pede pergunta nenhuma à evidência");
    r.exigir(
      (await comparacoes.locator(".faixa-de-tempestades span[data-quem]").count()) >= 40,
      "enviadas as respostas, as faixas continuam na tela para o debate",
    );

    // ═══ PROFESSOR: abre o fechamento depois do debate ═══════════════════
    await prof.goto(resultadosDaTurma, { waitUntil: "domcontentloaded" });
    await prof.locator("button", { hasText: "Abrir o fechamento" }).click();
    await prof.locator("[data-fechamento-aberto]").waitFor({ timeout: 20_000 });
    await r.registrar(prof, "fechamento-aberto", {
      titulo: "O professor abre o fechamento",
      mostra: "O relógio da aula com o fechamento aberto e quantos grupos já enviaram.",
      prova:
        "O WhatsApp e a moradora aparecem juntos para a turma, depois do debate. O painel é o sinal " +
        "para as perguntas faladas sobre cuidado com os dados e direitos.",
    });

    // ═══ ESTUDANTE: o fechamento — o pedido pelo WhatsApp e a moradora ═══
    const fechamento = q4.locator('[aria-label="Fechamento da operação"]');
    await fechamento.waitFor({ timeout: 40_000 });
    const peca = fechamento.locator(".peca-unoochat");
    r.exigir((await peca.getAttribute("data-unc-theme")) === "light", "o balão do mensageiro é a peça do unoochat, em tema claro");
    r.exigir(
      !/\b\d{1,2}:\d{2}\b/.test(await peca.innerText()),
      "e o balão não traz hora nem tiques",
    );
    r.exigir(
      (await q4.locator("button", { hasText: "Tentar de novo" }).count()) === 0,
      "com o fechamento aberto, o \"Tentar de novo\" some",
    );
    await peca.scrollIntoViewIfNeeded();
    await r.registrar(p, "pedido-pelo-whatsapp", {
      titulo: "Um pedido pelo WhatsApp",
      mostra: "O balão de um número desconhecido pedindo a lista das pessoas com deficiência do Morro Alto.",
      prova:
        "Só a mensagem tem a cara do mensageiro (clone dentro de clone, ADR-173): as perguntas em volta " +
        "continuam no UnooriaAI. O grupo decide o que responde e se reporta o pedido (EM13CO08).",
    });
    await fechamento.getByRole("radio", { name: "Não mando nenhum dado por este canal" }).click();
    await p.waitForTimeout(500);
    await fechamento.getByRole("radio", { name: "Aviso a coordenação" }).click();
    await esperarOuFalharPorHttp(p, fechamento.getByText("Registrado ✓"), /\/unoogpt\/fechamento/, {
      timeout: 20_000,
      oQue: "a resposta ao WhatsApp",
    });
    for (let volta = 0; volta < 6; volta++) {
      const aberta = fechamento.locator('[role="radiogroup"]:not(:has([aria-checked="true"]))').first();
      if ((await aberta.count()) === 0) break;
      await aberta.getByRole("radio").first().click();
      await p.waitForTimeout(700);
    }
    await esperarOuFalharPorHttp(p, fechamento.getByText("Resposta enviada ✓"), /\/unoogpt\/fechamento/, {
      timeout: 20_000,
      oQue: "a resposta à moradora",
    });
    await r.registrar(p, "resposta-a-moradora", {
      titulo: "A resposta à moradora",
      mostra: "As quatro partes da resposta à moradora do bairro que ficou sem equipe, enviadas.",
      prova:
        "As frases certas de \"Os dados\" e \"Quem decidiu\" são montadas pelo servidor com o que o grupo fez. " +
        "A tela nunca diz se acertou.",
      inteira: true,
    });

    await prof.reload({ waitUntil: "domcontentloaded" });
    const contagem = await prof.locator("[data-fechamento-aberto]").innerText();
    r.exigir(/^\s*1 de \d+/.test(contagem), `o painel conta o fechamento enviado (${contagem.split(".")[0]})`);

    // ═══ PROFESSOR: o painel espera o encerramento ══════════════════════
    await prof.goto(resultadosDaTurma, { waitUntil: "domcontentloaded" });
    await prof
      .getByText("O nível aparece quando você encerrar a missão na Sala de Aula")
      .waitFor({ timeout: 30_000 });
    await r.registrar(prof, "habilidades-esperando-encerramento", {
      titulo: "As habilidades esperam o encerramento",
      mostra: "O bloco \"Habilidades da BNCC\" nos resultados, avisando que o nível vem ao encerrar.",
      prova:
        "Com a missão aberta, as tarefas estão guardadas mas não viram nível: elas só valem depois " +
        "que o professor encerra a missão na Sala de Aula.",
    });

    // ═══ PROFESSOR: encerrar acende o nível SEM recarregar a página ═════
    /* A página de resultados fica aberta; a missão é encerrada na Sala de Aula
       (o mesmo PUT da tela da sala, pelo BFF). Quem traz o nível para esta
       página é o `router.refresh()` de 10 s do painel do relógio — a marca na
       `window` prova que ninguém recarregou: um F5 a apagaria. */
    const turmaId = new URL(resultadosDaTurma).searchParams.get("turmaId");
    const estadoNaSala = (estado) =>
      prof.evaluate(
        async ({ turmaId, estado }) =>
          (
            await fetch(`/api/plataforma/salas/turma/${turmaId}/missoes/exp02em1b-v0`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ estado }),
            })
          ).status,
        { turmaId, estado },
      );
    await prof.evaluate(() => {
      window.__semRecarga = true;
    });
    const niveis = prof
      .locator("[data-habilidades-da-tempestade] tbody")
      .getByText(/^(Atingiu|Em processo|Não atingiu)$/);
    const encerrou = await estadoNaSala("encerrada");
    r.exigir(encerrou === 200, `a missão encerra na sala (veio ${encerrou})`);
    await niveis.first().waitFor({ timeout: 40_000 });
    r.exigir(
      await prof.evaluate(() => window.__semRecarga === true),
      "o nível apareceu no painel aberto, sem recarregar a página",
    );
    r.exigir(
      (await prof.getByText("O nível aparece quando você encerrar a missão na Sala de Aula").count()) === 0,
      "o aviso de espera sai quando a missão é encerrada",
    );
    await prof.locator("[data-habilidades-da-tempestade]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-sem-recarregar", {
      titulo: "O nível aparece sozinho ao encerrar",
      mostra: "O bloco \"Habilidades da BNCC\" com o nível das tarefas, na mesma página, sem recarregar.",
      prova:
        "A página dos resultados acompanha a aula: ao encerrar a missão na Sala de Aula, o nível " +
        "chega em até 10 segundos, sem o professor apertar F5.",
    });

    // ═══ PROFESSOR: zerar apaga as habilidades da turma (ADR-155) ════════
    await prof.click("[data-zerar-turma]");
    await prof.locator("text=/habilidades da turma/i").first().waitFor({ timeout: 10_000 });
    await prof.locator("button", { hasText: /^Zerar a turma$/ }).last().click();
    const limpo = Date.now() + 30_000;
    while ((await niveis.count()) > 0 && Date.now() < limpo) await prof.waitForTimeout(500);
    r.exigir((await niveis.count()) === 0, "zerar a turma apaga o nível de todos, e o painel recomeça do zero");
    r.exigir(
      await prof.evaluate(() => window.__semRecarga === true),
      "o painel esvaziou na mesma página, sem recarregar",
    );
    await prof.locator("[data-habilidades-da-tempestade]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-zeradas", {
      titulo: "Zerar recomeça as habilidades do zero",
      mostra: "O bloco \"Habilidades da BNCC\" sem nível nenhum, logo depois de zerar a turma.",
      prova:
        "Zerar a turma é aplicar a missão de novo: as respostas e os níveis da aplicação anterior " +
        "saem, e o encerramento seguinte só conta o que a turma fizer daqui para a frente.",
    });

    // ═══ PROFESSOR: o podcast FIXO da missão (ADR-156) ═══════════════════
    /* Sem falas para revisar: a missão não tem customização, e o roteiro é o
       mesmo em toda turma. Ele fica nos resultados, depois do debate. */
    await provarPodcastNaAula(r, prof, {
      blocos: ["Abertura", "Recapitulação da missão", "O que cada fonte enxergava", "Provocação e transferência", "Encerramento"],
      vozes: ["Lia", "Caio"],
      trechos: 5,
      passo: "podcast",
      descricao: "Lia e Caio, cerca de 3 min 30 s",
    });
    r.exigir(
      (await prof.locator("[data-falas-do-podcast]").count()) === 0,
      "o podcast da Tempestade não tem falas para revisar: o roteiro é fixo",
    );

    /* Devolve a sala como o seed a deixa: a próxima corrida entra liberada. */
    r.exigir((await estadoNaSala("liberada")) === 200, "a missão volta a ficar liberada para a turma");

    // ═══ A turma joga de novo depois de zerar ════════════════════════════
    /* Zerar deixou a rodada nova VAZIA, e é ela que o relatório do estudante
       mostra. A suíte professor/06 abre esse relatório e exige uma rodada com
       falas datadas — sem esta partida ela encontra "ainda não começou" e fica
       vermelha por causa da ordem das suítes, não do produto. De quebra, prova
       que a turma zerada volta a jogar: largada nova, campo aberto, turno gravado. */
    await prof.goto(resultadosDaTurma, { waitUntil: "domcontentloaded" });
    await prof.waitForSelector("text=Dar a largada", { timeout: 20_000 });
    await prof.click("text=Dar a largada");
    await prof.waitForSelector("text=Em andamento", { timeout: 20_000 });

    await p.goto(`${HUB}/exp/exp02em1b-v0`, { waitUntil: "domcontentloaded" });
    const q9 = p.frameLocator('iframe[data-experiencia]');
    const campoDeNovo = q9.locator("form input").first();
    /* Zerar apagou a partida: a criança volta à ABERTURA, como no começo. */
    await q9.locator("text=/Não dá para atender todos/i").waitFor({ timeout: 40_000 });
    await q9.locator("button", { hasText: /começar/i }).first().click();
    await campoDeNovo.waitFor({ timeout: 20_000 });
    const liberado = Date.now() + 20_000;
    while ((await campoDeNovo.isDisabled()) && Date.now() < liberado) await prof.waitForTimeout(500);
    r.exigir(!(await campoDeNovo.isDisabled()), "depois de zerar e dar a largada de novo, o campo aceita fala");

    const PERGUNTA_DE_NOVO = "qual bairro tem mais idosos?";
    const turnoDeNovo = p.waitForResponse(
      (resp) => resp.url().includes("/unoogpt/pergunta") && resp.request().method() === "POST",
      { timeout: 120_000 },
    );
    await campoDeNovo.pressSequentially(PERGUNTA_DE_NOVO, { delay: 15 });
    await campoDeNovo.press("Enter");
    const respostaDeNovo = await turnoDeNovo;
    r.exigir(respostaDeNovo.ok(), `o turno da rodada nova respondeu ${respostaDeNovo.status()}`);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p
      .frameLocator('iframe[data-experiencia]')
      .locator(`text=${PERGUNTA_DE_NOVO}`)
      .first()
      .waitFor({ timeout: 40_000 });
    await r.registrar(p, "joga-depois-de-zerar", {
      titulo: "A turma zerada joga de novo",
      mostra: "Depois de zerar e de uma largada nova, a criança volta a conversar com o Cientista.",
      prova:
        "Zerar é aplicar a missão de novo, não trancá-la: a rodada nova abre com a largada e a " +
        "pergunta sobrevive a um F5. É esta partida que o relatório do estudante mostra depois.",
    });
  },
);
