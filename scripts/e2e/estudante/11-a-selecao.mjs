import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";

/**
 * A Seleção (exp07ef1b), nas três pontas da sala: a professora e dois
 * estudantes da mesma turma.
 *
 * A descoberta da missão é SOCIAL: a criança só percebe que a própria
 * curadoria contou um lado da história quando vê, ao lado dela, a de um colega
 * que escolheu outros posts do MESMO feed. Um roteiro de um estudante só
 * passaria com o pareamento quebrado — por isso são dois, com escolhas
 * divergentes de propósito, e a prova é que cada um vê o outro no Mural.
 *
 * O primeiro estudante percorre a tela inteira. O segundo publica pela api
 * (pelo BFF, com a sessão dele): o que a suíte precisa dele é a tríade no
 * banco antes de o Mural abrir, não as mesmas capturas duas vezes.
 *
 * A IA é a DE VERDADE (Vertex, com o ADC válido), de ponta a ponta: ela
 * escreve a cobertura (os 12 posts e as falas do podcast), gera as imagens, lê
 * a legenda da criança (o Canal A da EF07CO11, provado no painel ANTES da
 * enquete p1, que também marca a EF07CO11) e sintetiza o podcast. Toda saída
 * de reserva silenciosa vira reprovação aqui.
 */
const SERIE = "7EF";
/* A turma vem do CSV do seed, não fixada aqui (o seed já renomeou turma uma
   vez). A 7A tem a missão liberada pelo seed; a 7B não. */
const PRIMEIRO = conta("estudante", { serie: SERIE });
const TURMA = process.env.TURMA ?? PRIMEIRO.turma;
const SEGUNDO = contasDe("estudante").find(
  (c) =>
    c.turma === PRIMEIRO.turma &&
    c.login !== PRIMEIRO.login &&
    c.nome.split(" ")[0] !== PRIMEIRO.nome.split(" ")[0],
);
if (!SEGUNDO) throw new Error(`a turma ${TURMA} precisa de dois estudantes (rode o seed)`);
const PRIMEIRO_NOME_DO_SEGUNDO = SEGUNDO.nome.split(" ")[0];

/** A legenda válida: 10 a 140 caracteres, sem link, telefone, e-mail nem @. */
/** O tema que a IA recebe. Conteúdo novo a cada corrida: cobertura nova, rodada 1. */
const TEMA_DA_GERACAO = "Inauguração da quadra coberta do bairro";
const LEGENDA = "Escolhi estes três posts porque mostram o que aconteceu no evento do bairro.";
/** Mais de 100 caracteres, digitados (o `fill` não move o estado do React). */
const REFLEXAO =
  "Se a equipe ouvir só um grupo, a reportagem vai mostrar um lado só. Nos meus Stories eu " +
  "também deixei vozes de fora, como os moradores.";

await suite(
  {
    slug: "estudante/11-a-selecao",
    papel: "estudante",
    titulo: "A Seleção — curadoria e enquadramento",
    subtitulo: "salvar, podar para três, publicar, e ver o mesmo feed contado de outro jeito",
    contexto:
      "A Amara pede ajuda para cobrir um evento do bairro nos Stories do grêmio. O feed tem 12 " +
      "posts de três perfis — o oficial, o comunitário e o de números. A criança escolhe três e " +
      "escreve uma legenda achando que contou o que aconteceu; no Mural, ao lado da seleção de um " +
      "colega, descobre que cada um mostrou um recorte.",
    prova: [
      "A atividade nasce da professora, pelo assistente — turma, conteúdo, equipes e criar — e só a que está em andamento abre para a turma",
      "A cobertura se aprova em duas fases na mesma tela: os textos, e depois as imagens no card de cada post",
      "\"Aprovar Cobertura e Abrir Turma\" libera a missão na sala — mesmo encerrada antes",
      "Publicar exige EXATAMENTE 3 posts e uma legenda de 10 caracteres ou mais",
      "Legenda com link é recusada antes de outro estudante poder lê-la",
      "Publicar é irreversível, e a F5 volta ao mesmo passo",
      "Quem move a sala é UM botão da professora: Mural, fichas, explicação",
      "No Mural, cada estudante vê o colega que escolheu outra coisa — pelo primeiro nome, aberto no Story dele e com a legenda de cada post sobre a imagem",
      "A ficha técnica só aparece depois que a professora revela",
      "As duas enquetes da Amara não mostram acerto, e a missão termina",
      "A folha da turma não tem coluna de pontos, e o painel mostra as habilidades da BNCC",
      "O podcast de recapitulação é da professora: as três falas do tema se revisam na criação da atividade, e a transcrição fica sempre na tela",
    ],
    comando: "node scripts/e2e/estudante/11-a-selecao.mjs",
  },
  async (r) => {
    /**
     * Aperta o botão da aula e ESPERA a etapa nova na tela. Espera também a
     * hidratação: depois de um reload o botão do SSR já está no DOM mas o
     * `onClick` ainda não — e o clique aceito que não faz nada só aparece 30s
     * depois, no estudante, com um sintoma que não aponta para a causa.
     */
    const apertar = async (pagina, etapa) => {
      const botao = pagina.locator(`[data-gate="${etapa}"]`);
      await botao.waitFor({ timeout: 20_000 });
      await pagina.waitForFunction(
        (sel) => {
          const b = document.querySelector(sel);
          return Boolean(b) && !b.hasAttribute("disabled");
        },
        `[data-gate="${etapa}"]`,
        { timeout: 15_000 },
      );
      await pagina.waitForTimeout(600);
      await botao.click();
      await pagina.waitForSelector(`[data-etapa="${etapa}"]`, { timeout: 20_000 });
    };

    /** Chama a api pelo BFF com a sessão da página (a do estudante). */
    const api = (pagina, caminho, corpo) =>
      pagina.evaluate(
        async ({ caminho, corpo }) => {
          const resp = await fetch(`/api/plataforma/${caminho}`, {
            method: corpo === undefined ? "GET" : "POST",
            headers: { "content-type": "application/json" },
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
          });
          return { status: resp.status, corpo: await resp.json().catch(() => ({})) };
        },
        { caminho, corpo },
      );

    // ═══ PROFESSORA: a ficha, a criação da atividade e o painel ══════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, conta("professor", { serie: SERIE }).login);
    await prof.goto(`${HUB}/professor/entre-redes/7-ano/unidade-1`, {
      waitUntil: "domcontentloaded",
    });
    await prof.waitForSelector("text=/A Seleção/i", { timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do professor",
      mostra: "A missão explicada para quem vai conduzir: as seis etapas e o preparo antes da aula.",
      prova:
        "A professora precisa saber ANTES que o Mural, as fichas e a explicação são ela quem " +
        "libera — e que não deve ler as perguntas do debate antes do Mural.",
    });

    /* A TURMA pela api (o seletor da criação é o `Selection` do DS, não um
       <select>): a ficha abre NA turma, como a sala de aula a abre. */
    const turmasDaSelecao = await api(prof, "a-selecao/turmas");
    const daTurma = (turmasDaSelecao.corpo.turmas ?? []).find((t) => t.nome === TURMA);
    if (!daTurma) throw new Error(`turma ${TURMA} não está entre as do professor (rode o seed)`);
    await prof.goto(`${HUB}/professor/entre-redes/7-ano/unidade-1?turmaId=${daTurma.id}`, {
      waitUntil: "domcontentloaded",
    });
    await prof.locator("[data-atividades-da-missao]").waitFor({ timeout: 20_000 });
    await r.registrar(prof, "atividades-da-missao", {
      titulo: "As atividades da missão na turma",
      mostra:
        "A lista \"Suas atividades com a turma\", com a em andamento primeiro, e o botão Nova atividade.",
      prova:
        "A missão é o roteiro; a atividade é o que a turma faz de fato, e quem a cria é a " +
        "professora — a plataforma não cria nada (ADR-130).",
    });

    /* A turma começa com a missão ENCERRADA na sala (ADR-146). O seed a
       libera, e com ela liberada o "pôr no ar" parecia funcionar: era só a
       metade da porta. Encerrada, o estudante abaixo só entra se o "Aprovar
       Cobertura e Abrir Turma" liberar a missão de verdade. */
    const encerrou = await prof.evaluate(
      async ({ turmaId }) =>
        (
          await fetch(`/api/plataforma/salas/turma/${turmaId}/missoes/exp07ef1b`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ estado: "encerrada" }),
          })
        ).status,
      { turmaId: daTurma.id },
    );
    r.exigir(encerrou === 200, `a missão começa encerrada na sala (veio ${encerrou})`);

    /* NOVA ATIVIDADE pelo assistente: a turma já vem da ficha, a IA escreve a
       cobertura sobre o tema da aula, um aluno por computador, e a atividade
       entra no ar ao criar. Criar SEMPRE abre a
       rodada 1 de uma atividade nova — é o que dispensa zerar a turma. */
    /* `LinkButton` é o `Button` do DS com `as={Link}`, e o DS põe
       `role="button"` em todo elemento que não é <button>: pelo PAPEL não é
       link. A âncora pelo texto é o mesmo caminho da estudante/10. */
    await prof.locator("a", { hasText: "Nova atividade" }).click();
    await prof.waitForURL("**/atividades/nova**", { timeout: 20_000 });
    await prof.locator('[data-acao="gerar-lote"]').waitFor({ timeout: 20_000 });
    await prof.waitForTimeout(600); // hidratação: o clique do SSR não tem `onClick`
    /* A IA ESCREVE a cobertura (gerar-conteudo, 20 a 30 s com o Vertex). A
       prova é a RESPOSTA — `usouIa` e `origem: "ia"` —: sem IA a api devolve
       200 com a cobertura pronta, e só o aviso amarelo contaria. */
    await prof.getByLabel("Evento central coberto pelos veículos").fill(TEMA_DA_GERACAO);
    const respostaDaGeracao = prof.waitForResponse(
      (res) => /\/a-selecao\/turmas\/[^/]+\/gerar-conteudo$/.test(new URL(res.url()).pathname) && res.request().method() === "POST",
      { timeout: 180_000 },
    );
    await prof.click('[data-acao="gerar-lote"]');
    const geracao = await respostaDaGeracao;
    const gerado = await geracao.json().catch(() => null);
    if (
      !r.exigir(
        geracao.status() === 200 && gerado?.usouIa === true && gerado?.origem === "ia",
        `a IA escreveu a cobertura (gerar-conteudo ${geracao.status()}, usouIa=${gerado?.usouIa}, origem=${gerado?.origem})`,
      )
    )
      return;
    await prof.getByText(/^Lote gerado\./).first().waitFor({ timeout: 20_000 });
    await prof.locator("[data-grade-de-posts]").waitFor({ timeout: 20_000 });
    const falas = prof.locator("[data-falas-do-podcast]");
    r.exigir((await falas.locator("textarea").count()) === 3, "a criação mostra as três falas do podcast");
    const textosDasFalas = await falas.locator("textarea").evaluateAll((ts) => ts.map((t) => t.value.trim()));
    r.exigir(
      textosDasFalas.every((t) => t.length > 0),
      "as três falas do podcast vêm escritas pela IA sobre o tema",
    );
    r.exigir(
      (await prof.locator("[data-grade-de-posts]").getByText("A imagem será gerada após a aprovação dos textos.").count()) > 0,
      "na fase 1, o card do post avisa que a imagem vem depois dos textos",
    );
    await r.registrar(prof, "criacao-conteudo", {
      titulo: "Fase 1: os textos",
      mostra:
        "O passo de conteúdo da criação: o tema, os 12 posts com as tags que só a professora vê, o " +
        "aviso de que a imagem vem depois e as três falas do podcast de recapitulação.",
      prova:
        "A IA escreveu os 12 posts e as três falas sobre o tema da aula (Vertex), no molde do servidor. É " +
        "rascunho: nada vai à turma sem as duas aprovações.",
      inteira: true,
    });
    /* FASE 2: aprovar os textos grava a cobertura e as imagens se geram sozinhas
       no mesmo card — com descrições NOVAS, são geradas de verdade, duas por
       chamada. Nenhum post pode ficar com a cena por escrito. */
    await prof.click('[data-acao="aprovar-textos"]');
    await prof.waitForSelector('[data-fase-das-imagens][data-pronta="sim"]', { timeout: 300_000 });
    const avisoDasImagens = prof.locator("[data-fase-das-imagens] .unooria-feedback-alert--warning");
    r.exigir(
      (await avisoDasImagens.count()) === 0,
      `a IA gerou a imagem de todos os posts que pedem imagem${(await avisoDasImagens.count()) > 0 ? `: ${(await avisoDasImagens.first().innerText()).trim()}` : ""}`,
    );
    r.exigir(
      (await prof.locator('[data-acao="aprovar-textos"]').count()) === 0,
      "aprovados, os textos não voltam a ser editáveis",
    );
    await r.registrar(prof, "criacao-imagens", {
      titulo: "Fase 2: as imagens, no card de cada post",
      mostra:
        "Os mesmos 12 cards, agora com a imagem (ou a cena por escrito, quando a imagem não saiu) junto da " +
        "legenda, e o botão Gerar outra imagem em cada um.",
      prova:
        "A professora vê a composição que a turma vai ver antes de abrir a turma — e regera a imagem que " +
        "não combina com o post (ADR-146).",
      inteira: true,
    });
    await prof.click('[data-acao="continuar-criacao"]');
    await prof.getByRole("radio", { name: "Um aluno por computador", exact: true }).click();
    await r.registrar(prof, "criacao-equipes", {
      titulo: "As equipes, dentro da criação",
      mostra: "O passo de equipes: sortear, eu separo ou um aluno por computador.",
      prova: "A equipe é da atividade (ADR-130): a mesma turma pode sentar diferente em cada aula.",
    });
    await prof.click('[data-acao="continuar-criacao"]');
    /* "Pôr no ar agora" nasce desligado quando a turma já tem uma em andamento
       (a de uma corrida anterior): liga, para a turma entrar nesta. */
    /* O `<input>` do `Toggle` do DS é invisível de propósito (opacidade 0, sem
       ponteiro): espera-se o input no DOM e o toque vai como evento — o
       `onChange` do React escuta o `click`. Esperar `visible` estoura o tempo
       com o interruptor na tela (a receita da 10 e da 13). */
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    r.exigir(
      /Aprovar Cobertura e Abrir Turma/.test(await prof.locator('[data-acao="criar-atividade"]').innerText()),
      "o botão final diz que aprova a cobertura e abre a turma",
    );
    await prof.click('[data-acao="criar-atividade"]');
    await prof.waitForURL("**/resultados?**cobertura=**", { timeout: 30_000 });
    const sala = await api(prof, `salas/turma/${daTurma.id}`);
    const naSala = (sala.corpo.missoes ?? []).find((m) => m.expId === "exp07ef1b");
    r.exigir(naSala?.estado === "liberada", `abrir a turma liberou a missão na sala (veio ${naSala?.estado})`);
    await prof.waitForSelector('[data-estado-da-atividade="em-andamento"]', { timeout: 20_000 });
    await prof.waitForSelector('[data-etapa="exploracao"]', { timeout: 20_000 });
    await r.registrar(prof, "preparo-e-painel", {
      titulo: "A atividade em andamento e o botão que move a sala",
      mostra:
        "A página da atividade criada: em andamento, as equipes (um aluno por computador), as imagens " +
        "e o painel da aula com UM botão que mostra a próxima etapa.",
      prova:
        "Criar com \"Pôr no ar agora\" abriu a rodada 1 da atividade nova. Um botão só, que anda uma " +
        "etapa por vez, e nenhuma etapa é pulada.",
      inteira: true,
    });

    // ═══ ESTUDANTE 1: a DM, o feed e os salvos ════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, PRIMEIRO.login);
    await p.goto(`${HUB}/exp/exp07ef1b`, { waitUntil: "domcontentloaded" });
    const q = () => p.frameLocator('iframe[data-experiencia]');
    await q().getByRole("button", { name: /Abrir Feed da Cobertura/i }).waitFor({ timeout: 40_000 });
    await r.registrar(p, "dm-da-amara", {
      titulo: "O pedido da Amara",
      mostra: "A DM do grêmio com o desafio: escolher 3 posts e publicar nos Stories com uma legenda.",
      prova:
        "Nada aqui fala em viés ou em lado da história: a missão depende de a criança escolher " +
        "achando que está sendo completa.",
    });

    await q().getByRole("button", { name: /Abrir Feed da Cobertura/i }).click();
    await q().locator("text=/Posts salvos: 0/").first().waitFor({ timeout: 20_000 });
    for (let i = 0; i < 3; i += 1) {
      await q().getByRole("button", { name: /Salvar publicação/i }).first().click();
      await p.waitForTimeout(300);
    }
    await q().locator("text=/Posts salvos: 3/").first().waitFor({ timeout: 10_000 });
    await r.registrar(p, "feed-da-cobertura", {
      titulo: "O feed e o marcador",
      mostra: "Os posts dos três perfis intercalados, o contador de salvos e a pílula para a aba Salvos.",
      prova:
        "Só o marcador fica nas ações do post: curtir, comentar e compartilhar saíram (ADR-146). Cada " +
        "comentário tem autor. A pílula só aparece com 3 salvos, e o feed nunca põe três posts seguidos " +
        "do mesmo perfil.",
    });

    await q().getByRole("button", { name: /Ir para aba Salvos/i }).click();
    /* Pelo PAPEL: a tela tem o título escondido para o leitor de tela (`h1.so-leitor`)
       e o da barra com o mesmo texto — por texto, o localizador casa os dois. */
    await q().getByRole("heading", { name: "Itens Salvos" }).waitFor({ timeout: 15_000 });
    /* Os salvos CHEGAM marcados: com exatamente três, a seleção já está feita.
       Um toque desmarca (a poda) e outro devolve — é isso que a grade prova. */
    const grade = q().getByLabel("Posts salvos");
    await q().locator("text=/3 de 3 selecionados/").first().waitFor({ timeout: 10_000 });
    await grade.locator("button").first().click();
    await q().locator("text=/2 de 3 selecionados/").first().waitFor({ timeout: 10_000 });
    await grade.locator("button").first().click();
    await q().locator("text=/3 de 3 selecionados/").first().waitFor({ timeout: 10_000 });

    // ═══ O PORTÃO: legenda curta desabilita, link é recusado ══════════════
    const campo = q().getByRole("textbox").first();
    await campo.click();
    await campo.pressSequentially("curta");
    const publicar = q().getByRole("button", { name: /Publicar nos Stories|Seu story/i }).first();
    r.exigir(
      await publicar.isDisabled(),
      "com menos de 10 caracteres na legenda, publicar fica desabilitado",
    );

    /* O 422 abaixo é o COMPORTAMENTO SENDO EXERCITADO: a legenda vai para a
       tela de outro estudante no Mural, e link não pode chegar lá. */
    r.provocado(
      /a-selecao\/decisao/,
      "a suíte publica uma legenda com link de propósito: o sanitizador recusa antes de o colega ler",
    );
    await campo.fill("");
    await campo.pressSequentially(" veja em http://exemplo.com.br agora");
    await publicar.click();
    await q().getByRole("button", { name: /Confirmar publicação/i }).click();
    await q().locator("text=/Não foi possível publicar/i").first().waitFor({ timeout: 15_000 });
    await r.registrar(p, "legenda-recusada", {
      titulo: "A legenda com link não passa",
      mostra: "A recusa na voz do clone, pedindo para tirar links, telefones, e-mails e marcações.",
      prova:
        "A legenda é texto de criança que outra criança vai ler no Mural. O filtro fica no " +
        "servidor, e a tela só traduz a recusa.",
    });

    await campo.fill("");
    await campo.pressSequentially(LEGENDA);
    await publicar.click();
    await q().getByRole("button", { name: /Confirmar publicação/i }).click();
    await q().locator("text=/Publicado! Aguardando o professor/i").first().waitFor({ timeout: 20_000 });

    /* O CANAL A: a IA lê a legenda DEPOIS do latch, fora da transação dele, e
       marca a EF07CO11. A resposta da publicação não conta nada (é o estado da
       sessão); quem mostra é o painel de evidências, e só ANTES da enquete p1 —
       que também marca a EF07CO11 — a marca é, com certeza, a da IA. */
    const coberturaId = new URL(prof.url()).searchParams.get("cobertura");
    let celulaDoCanalA = null;
    for (let i = 0; i < 30 && !celulaDoCanalA; i += 1) {
      const painel = await api(prof, `evidencias/turma/${daTurma.id}/missao/exp07ef1b/atividade/${coberturaId}`);
      const dele = (painel.corpo?.estudantes ?? []).find((e) => e.nome === PRIMEIRO.nome);
      celulaDoCanalA = Object.values(dele?.porRodada ?? {}).find((celulas) => celulas?.EF07CO11)?.EF07CO11 ?? null;
      if (!celulaDoCanalA) await prof.waitForTimeout(1_000);
    }
    r.exigir(
      Boolean(celulaDoCanalA),
      `a IA leu a legenda e marcou a EF07CO11 antes da enquete (o Canal A; veio ${JSON.stringify(celulaDoCanalA)})`,
    );
    await r.registrar(p, "publicado", {
      titulo: "Publicado, e sem volta",
      mostra: "A prévia dos próprios Stories e a espera pelo Mural da turma.",
      prova:
        "Depois de confirmar, não há como voltar ao feed nem editar a legenda: a escolha que a " +
        "turma vai comparar é a que a criança fez, não uma corrigida depois.",
    });

    await p.reload({ waitUntil: "domcontentloaded" });
    await q().locator("text=/Publicado! Aguardando o professor/i").first().waitFor({ timeout: 40_000 });
    r.exigir(true, "a F5 depois de publicar volta à espera, não ao feed");

    // ═══ ESTUDANTE 2: publica pela api, com escolhas DIVERGENTES ═════════
    const p2 = await r.pagina("estudante-2", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p2, SEGUNDO.login);
    await p2.goto(`${HUB}/exp/exp07ef1b`, { waitUntil: "domcontentloaded" });
    await p2
      .frameLocator('iframe[data-experiencia]')
      .getByRole("button", { name: /Abrir Feed da Cobertura/i })
      .waitFor({ timeout: 40_000 });
    await api(p2, "a-selecao/passo", { para: "feed" });
    await api(p2, "a-selecao/passo", { para: "salvos" });
    /* Só o perfil comunitário: a mais distante de uma tríade misturada. */
    const decisao = await api(p2, "a-selecao/decisao", {
      selecao: ["post_b_1", "post_b_2", "post_b_3"],
      legenda: "Os moradores contam o que a obra mudou no bairro todo dia.",
    });
    r.exigir(decisao.status === 200, `o segundo estudante publica (veio ${decisao.status})`);

    // ═══ PROFESSORA libera o Mural ═══════════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await apertar(prof, "mural");
    await q().getByRole("heading", { name: /Mural de Stories da Turma/i }).first().waitFor({ timeout: 30_000 });
    /* Abre no Story do PAR (ADR-146): o nome dele está na aba E no Story — daí
       o `.first()`. A legenda de cada post vem sobre a imagem. */
    await q().locator(`text=Publicação de ${PRIMEIRO_NOME_DO_SEGUNDO}`).first().waitFor({ timeout: 15_000 });
    await q().locator(".legenda-do-post").first().waitFor({ timeout: 10_000 });
    r.exigir(
      (await q().locator("text=/Ficha Técnica/i").count()) === 0,
      "na tela pico do Mural não há ficha técnica: o contraste vem antes da explicação",
    );
    await r.registrar(p, "mural-pareado", {
      titulo: "O mesmo feed, outra história",
      mostra: `O Mural aberto na tríade de ${PRIMEIRO_NOME_DO_SEGUNDO}, que escolheu só vozes da comunidade, com a legenda de cada post sobre a imagem; a própria fica na outra aba.`,
      prova:
        "O par é o colega que mais se afastou da escolha da criança, e ele aparece pelo primeiro " +
        "nome. Tela nua: nenhuma tag, nenhuma nota — o estranhamento vem antes da teoria.",
    });

    // ═══ PROFESSORA revela as fichas ═════════════════════════════════════
    await apertar(prof, "fichas");
    /* A folha chega ABERTA quando a revelação acende (é o momento de ler); só
       recolhida ela mostra "Ver detalhes da postagem". Espera a UNIÃO dos dois
       estados, abre se precisar, e prova pelo conteúdo — a fonte ouvida. */
    const verDetalhes = q().getByRole("button", { name: /Ver detalhes da postagem/i });
    const fonteOuvida = q().locator("text=/Fonte ouvida:/").first();
    await verDetalhes.or(fonteOuvida).first().waitFor({ timeout: 30_000 });
    if (!(await fonteOuvida.isVisible())) await verDetalhes.click();
    await fonteOuvida.waitFor({ timeout: 15_000 });
    r.exigir(
      (await q().locator("text=/Equilíbrio editorial/i").count()) > 0,
      "a ficha traz o equilíbrio editorial das duas seleções",
    );
    await r.registrar(p, "ficha-tecnica", {
      titulo: "A ficha técnica acende",
      mostra: "A fonte ouvida e o ângulo de cada post, e o equilíbrio editorial das duas seleções.",
      prova:
        "Ninguém mentiu: os dois contaram fatos do mesmo evento. A ficha mostra que cada seleção " +
        "deixou de fora dois terços do que o feed tinha — e ela só existe depois do botão.",
    });

    // ═══ PROFESSORA libera a explicação; o estudante lê os 3 cards ═══════
    await apertar(prof, "explicacao");
    /* A etapa chega pela sondagem do gate (5s), então a espera é pelo CARD, não
       pelo botão: o Mural também tem um "Próximo story" (o do `StoryViewer`), e
       um `/^Próximo/` clicava nele antes de a explicação existir. */
    await q()
      .getByRole("heading", { name: /A ilusão da neutralidade/i })
      .waitFor({ timeout: 20_000 });
    for (let card = 0; card < 3; card += 1) {
      /* A trava de 8s por card é da missão: o botão "Próximo" acende sozinho,
         e a espera corre contra ele (habilitado), nunca por tempo cego. São 3
         cliques: o do 3º card é o que abre a DM de fechamento. */
      const proximo = q().getByRole("button", { name: /^Próximo$/ });
      await proximo.click({ timeout: 15_000 });
      if (card < 2) {
        await q()
          .getByText(`${card + 2}/3`, { exact: true })
          .first()
          .waitFor({ timeout: 5_000 });
      }
      if (card === 0) {
        await r.registrar(p, "explicacao", {
          titulo: "Três cards, oito segundos cada",
          mostra: "O carrossel conceitual: a ilusão da neutralidade, as três lentes e quem fala.",
          prova:
            "A teoria entra DEPOIS do choque, e o avanço espera a leitura. É a única trava de " +
            "tempo da missão.",
        });
      }
    }
    await q().getByRole("button", { name: /Ir para a Reflexão/i }).click({ timeout: 45_000 });

    // ═══ REFLEXÃO (escola) e as ENQUETES (Amara) ═════════════════════════
    await q().locator("text=/Reflexão Individual/i").first().waitFor({ timeout: 20_000 });
    const reflexao = q().getByRole("textbox").first();
    await reflexao.click();
    await reflexao.pressSequentially(REFLEXAO);
    await r.registrar(p, "reflexao", {
      titulo: "A reflexão, na voz da escola",
      mostra: "A pergunta de transferência, o aviso de que só o professor lê e o contador.",
      prova:
        "A criança aplica o que viveu a um caso novo. O texto é confidencial: vai ao professor da " +
        "turma, nunca ao colega, nunca à gestão.",
    });
    await q().getByRole("button", { name: /Enviar Reflexão ao Professor/i }).click();
    await q().locator("text=/Pronto! Sua resposta foi enviada/i").first().waitFor({ timeout: 20_000 });
    await q().getByRole("button", { name: /^Continuar/i }).click();

    /* As alternativas vêm EMBARALHADAS a cada leitura: casa-se por texto. */
    await q()
      .getByRole("button", { name: /Cuidado, eu só escolhi 3 posts/i })
      .click({ timeout: 30_000 });
    await q().locator("text=/Resposta enviada ✓/").first().waitFor({ timeout: 15_000 });
    r.exigir(
      (await q().locator("text=/correta|acertou|errou/i").count()) === 0,
      "a enquete não mostra acerto nem erro",
    );
    await r.registrar(p, "enquete", {
      titulo: "A enquete da Amara",
      mostra: "A pergunta na DM, as três respostas e o \"Resposta enviada ✓\".",
      prova:
        "O gabarito mora no servidor e a ordem muda a cada exibição. A criança não sabe se " +
        "\"acertou\" — é evidência para o professor, não prova.",
    });
    await q()
      .getByRole("button", { name: /A gente priorizou fontes diferentes/i })
      .click({ timeout: 30_000 });
    const fechar = q().getByRole("button", { name: /Fechar conversa/i });
    await fechar.waitFor({ timeout: 30_000 });
    await fechar.click();
    await q().locator("text=/Missão concluída!/").first().waitFor({ timeout: 20_000 });
    await r.registrar(p, "concluida", {
      titulo: "Missão concluída",
      mostra: "O fim, na voz da escola.",
      prova:
        "A conclusão só chega depois da reflexão e das enquetes, e nenhuma delas prende a criança.",
    });

    // ═══ PROFESSORA: a folha da turma e as habilidades ═══════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.waitForSelector("[data-envio]", { timeout: 20_000 });
    const folha = await prof.locator("main").innerText();
    /* Pelos CABEÇALHOS das colunas, não pelo texto da página: a folha mostra a
       seleção e a legenda de cada estudante, e o lote da IA escreve o que quiser
       ("Usuários pedem mais pontos de água potável…" reprovou a corrida de
       2026-10-07). É o mesmo conserto da `estudante/12`. */
    const colunas = await prof.locator("main").getByRole("columnheader").allInnerTexts();
    r.exigir(
      colunas.length > 0 && !colunas.some((c) => /\b(pontos|nota|score|ranking)\b/i.test(c)),
      `a folha da turma não tem coluna de pontos (colunas: ${colunas.join(", ")})`,
    );
    r.exigir(/EF07CO11/.test(folha), "o painel de habilidades da BNCC aparece com a EF07CO11");
    await r.registrar(prof, "resultados-e-habilidades", {
      titulo: "A turma por computador, e as habilidades",
      mostra:
        "Quem publicou, o par de cada um, a distribuição das lentes da sala e o painel de " +
        "habilidades da BNCC da cobertura.",
      prova:
        "A legenda e a reflexão aparecem para a professora da turma, e para a gestão só " +
        "\"entregou\". A EF07CO11 tem duas fontes — a leitura da legenda pela IA (o Canal A, provado " +
        "antes da enquete) e a enquete — e vale a melhor.",
      inteira: true,
    });

    // ═══ PROFESSORA: o podcast de recapitulação ══════════════════════════
    const cartao = prof.locator("[data-podcast-da-aula]");
    await cartao.waitFor({ timeout: 20_000 });
    await prof.click('[data-acao="ler-transcricao"]');
    const transcricao = prof.locator("[data-transcricao-podcast]");
    await transcricao.waitFor({ timeout: 10_000 });
    const roteiro = await transcricao.innerText();
    r.exigir(
      ["Abertura", "Recapitulação", "A revelação", "Provocação e transferência", "Encerramento"].every(
        (bloco) => roteiro.toUpperCase().includes(bloco.toUpperCase()),
      ),
      "a transcrição traz os cinco blocos do roteiro aprovado",
    );
    r.exigir(/Lucas:/.test(roteiro) && /Clara:/.test(roteiro), "com as falas de Lucas e de Clara");
    r.exigir(/Folha Oficial/.test(roteiro) && /Métrica Urbana/.test(roteiro), "e o Bloco 2 fala dos três veículos");
    await r.registrar(prof, "podcast-transcricao", {
      titulo: "O podcast de recapitulação, para a professora",
      mostra:
        "O player do podcast (Lucas e Clara, cerca de 3 min 45 s) e a transcrição inteira, bloco a bloco.",
      prova:
        "O podcast é da professora, que decide tocar para a turma depois da aula. Sem áudio o " +
        "player não some: diz o porquê, e a transcrição continua na tela.",
      inteira: true,
    });

    /* Gerar o áudio com o TTS de verdade: o episódio sai trecho a trecho e fica
       pronto. A espera é pela UNIÃO dos desfechos — pronto, ou a frase de
       falha —, nunca pelo relógio; e a falha reprova (a IA é a real). */
    if ((await cartao.getAttribute("data-podcast-pronto")) !== "sim") {
      await prof.click('[data-acao="gerar-podcast"]');
      await prof
        .locator(
          '[data-podcast-pronto="sim"], [data-podcast-da-aula] :text-matches("não pôde ser gerado|sem saldo|limite", "i")',
        )
        .first()
        .waitFor({ timeout: 300_000 });
    }
    const pronto = (await cartao.getAttribute("data-podcast-pronto")) === "sim";
    r.exigir(pronto, "o TTS sintetizou os cinco trechos e o episódio ficou pronto");
    if (pronto) {
      r.exigir((await cartao.locator("audio").count()) === 1, "o episódio emendado toca no player do DS");
    }
    await r.registrar(prof, "podcast-audio", {
      titulo: pronto ? "O episódio pronto" : "Sem áudio, com a transcrição",
      mostra: pronto
        ? "Os cinco trechos sintetizados pelo TTS do Gemini e emendados num episódio só, no player."
        : "A síntese não saiu (em dev a IA é o mock, que falha fechado) e a tela diz isso — a transcrição fica.",
      prova: pronto
        ? "Um trecho por chamada, porque o episódio não cabe nos 30 s do BFF; os blocos fixos saem uma vez por contrato."
        : "Falha de voz não esconde o podcast nem cobra a quota: o trecho que não saiu é dito, e a leitura segue.",
      inteira: true,
    });
  },
);
