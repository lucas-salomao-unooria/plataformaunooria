import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * A Missão Tempestade (exp-03), nas duas pontas da sala.
 *
 * O relógio é da TURMA: sem a largada do professor, o estudante entra, vê o mapa
 * e NÃO consegue falar com o Cientista. O roteiro prova as duas metades —
 * primeiro que ele está bloqueado, depois que a largada o libera. Um roteiro de
 * um contexto só passaria com o relógio quebrado.
 *
 * A experiência inteira roda na seção `chatgpt` do design system, sem
 * revelação no software: aqui a mediação é do professor, na sala.
 *
 * Os seletores são CONTRATO com a experiência (README da exp-03).
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
    titulo: "unooGPT — a Missão Tempestade",
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

    await p.goto(`${HUB}/exp/exp-03-unoogpt`, { waitUntil: "domcontentloaded" });
    const quadro = p.frameLocator('iframe[title="experiencia"]');
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
    const q2 = p.frameLocator('iframe[title="experiencia"]');
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
    const q3 = p.frameLocator('iframe[title="experiencia"]');
    await q3.locator(`text=${PERGUNTA}`).first().waitFor({ timeout: 40_000 });
    const orcamento = await q3.locator("text=/Perguntas:/").first().innerText();
    await r.registrar(p, "turno-do-cientista", {
      titulo: "Uma pergunta ao Cientista",
      mostra: "A conversa com a pergunta da criança e a resposta do agente, e o orçamento debitado.",
      prova:
        "O orçamento é debitado NO SERVIDOR: três perguntas por tentativa. E a conversa voltou " +
        "inteira depois de um F5 — ela está em `exp_03_mensagens`, não na memória da aba.",
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

    // ═══ ESTUDANTE: decide, envia e vê a tempestade passar ═══════════════
    /* O caminho é o do painel de decisão, que existe desde o começo da
       Investigação: destino das duas equipes, o "por quê" de cada uma, Enviar.
       Cada troca de destino é um POST — espera-se o select da justificativa
       aparecer, que só existe depois de o servidor registrar o bairro. */
    const q4 = p.frameLocator('iframe[title="experiencia"]');
    await q4.locator("button", { hasText: /Definir destinos|Ver detalhes/ }).first().click();
    const modal = q4.locator('[aria-label="Decisão operacional"]');
    await modal.waitFor({ timeout: 20_000 });
    for (const [equipe, indice] of [["alfa", 1], ["bravo", 2]]) {
      await modal.locator(`select[aria-label="Destino da equipe ${equipe}"]`).selectOption({ index: indice });
      const porque = modal.locator(`select[aria-label="Por que a equipe ${equipe} vai para lá"]`);
      await porque.waitFor({ timeout: 20_000 });
      await porque.selectOption({ index: 1 });
    }
    await modal.locator("button", { hasText: /enviar/i }).first().click();

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
        "À esquerda, onde cada equipe chegou e por quê, o percentual de resgatadas e afetadas e o " +
        "risco coberto; à direita, o mapa com as rotas percorridas.",
      prova:
        "O painel cabe inteiro ao lado do mapa: o motivo da chegada quebra linha em vez de ser " +
        "cortado. E não há nota — o número é da cidade, não do estudante.",
      detalhe: `${largura.conteudo}px de conteúdo em ${largura.coluna}px de coluna`,
    });
  },
);
