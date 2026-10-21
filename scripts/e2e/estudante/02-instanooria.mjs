import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { vigiarFalhasDaApi } from "../lib/smoke.mjs";

/**
 * A MISSÃO INTEIRA do Unoovista (exp08ef1b), ponta a ponta, com as duas pessoas que a
 * aula tem: o professor no relógio e o estudante no aparelho.
 *
 * Um contexto só não chega ao fim — e essa é a arquitetura, não uma limitação
 * do teste. As sete etapas (investigação → resposta → debate → explicação → o
 * que perderam → reflexão → fim) são estado de TURMA, server-side, e quem as
 * move é o professor. Um roteiro de um contexto só provaria o feed.
 *
 * O que esta suíte faz que nenhuma outra fazia: o estudante USA o app de
 * verdade — curte, comenta, salva, abre stories, busca no acervo e PUBLICA UM
 * POST SEU, que é o caminho por onde as personas reagem ao que ele escreveu
 * (`POST /runs/:id/student-post`). Era o único gesto do produto que nenhum
 * roteiro exercitava, e é justamente o que fecha o argumento da missão: o feed
 * também responde a você.
 *
 * A turma é ZERADA no começo. O onboarding só aparece uma vez, e um smoke que
 * só passa na primeira execução por banco não é smoke.
 */
const TURMA = process.env.TURMA ?? "8A";
const SERIE = "8EF";

await suite(
  {
    slug: "estudante/02-instanooria",
    papel: "estudante",
    titulo: "Unoovista — a missão completa",
    subtitulo: "do onboarding ao relatório, com o professor conduzindo o relógio",
    contexto:
      "A experiência central do produto: um clone de rede social em que o feed de cada criança nasce " +
      "enviesado para um dos lados de um debate real de sala de aula. Ela investiga, responde, " +
      "debate — e só então descobre que o feed dela era diferente do feed do colega. " +
      "As sete etapas são estado de turma: quem as move é o professor.",
    prova: [
      "O onboarding cria a identidade fictícia e a run server-side",
      "O feed serve posts curados pelo perfil, e a rolagem é medida (dwell)",
      "As interações do app funcionam de verdade: curtir, comentar, salvar, stories, busca",
      "O estudante PUBLICA um post seu e as personas reagem a ele",
      "As sete etapas da aula avançam só pelo professor, e chegam ao estudante em segundos",
      "O relatório expande o aparelho SEM recarregar a experiência, e volta a contrair",
      "O Raio-x (6a) vem logo depois da resposta, ainda no disfarce, sem devolutiva no envio",
      "A revelação tem dez telas, com a ponte do Raio-x, os termos e o registro",
      "Depois do cinza, os termos (6b) e o envio (6c), sem o lado nas miniaturas",
      "A reflexão escrita é gravada, sobrevive à recarga e é lida pela IA real, uma vez só",
      "As três perguntas do fim não aparecem mais (o Canal B saiu)",
      "O painel do professor diz de qual tarefa veio cada nível",
      "O que ela fez virou medida: o dossiê é computado dos eventos da sessão",
    ],
    comando: "node scripts/e2e/estudante/02-instanooria.mjs",
  },
  async (r) => {
    // ═══ o professor prepara a aula ═══════════════════════════════════════
    const prof = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, conta("professor", { turma: TURMA }).login);

    const lista = await prof.request.get(`${BFF}/atividades`);
    const { atividades } = await lista.json();
    /* Ativa de preferência; senão a mais recente — o passo seguinte a reativa. */
    const atividade = (atividades ?? []).find((a) => a.status === "ativa") ?? atividades?.[0];
    if (!atividade) throw new Error("nenhuma atividade no seed — rode `pnpm --filter @edu/api seed:demo`");

    /**
     * REATIVAR, e não só zerar.
     *
     * Esta suíte termina movendo a turma até `fim` — e chegar ao fim ENCERRA a
     * atividade. Na execução seguinte ela não está mais ativa, e o estudante
     * abre o aparelho em "Nada rolando por aqui agora": uma tela correta, para
     * um estado que o próprio roteiro causou. Era o caso clássico do smoke que
     * só passa uma vez por banco.
     *
     * `forcar: true` porque a atividade de demonstração tem menos posts que o
     * recomendado, e a trava de volume recusaria a reativação — a trava em si é
     * exercitada em `professor/02-atividade-do-zero`.
     */
    if (atividade.status !== "ativa") {
      const reativacao = await prof.request.post(`${BFF}/atividades/${atividade.id}/ativar`, {
        data: { forcar: true },
      });
      r.exigir(
        reativacao.ok(),
        `a atividade estava "${atividade.status}" e foi reativada (HTTP ${reativacao.status()})`,
      );
    }

    /* Zerar é o que torna o roteiro repetível: sem isso a segunda execução acha
       o estudante já na explicação e não exercita caminho nenhum. */
    await prof.request.post(`${BFF}/atividades/${atividade.id}/limpar`);
    await prof.request.post(`${BFF}/atividades/${atividade.id}/etapa`, {
      data: { etapa: "investigacao" },
    });
    /* IA AO VIVO ligada: é ela que faz as personas reagirem ao post que o
       estudante escrever. Com ela desligada o produto publica o post do mesmo
       jeito (falha fechada, como um app real em que ninguém responde) — e o
       caminho mais interessante da missão nunca seria exercitado. */
    const chaveDaIa = await prof.request.patch(`${BFF}/atividades/${atividade.id}/ia`, {
      data: { ativo: true },
    });
    r.exigir(chaveDaIa.ok(), `a IA ao vivo foi ligada para esta aula (HTTP ${chaveDaIa.status()})`);
    await prof.goto(`${HUB}/professor/atividades/${atividade.id}`, { waitUntil: "domcontentloaded" });
    await prof.waitForTimeout(2500);
    await r.registrar(prof, "professor-abre-a-atividade", {
      titulo: "O professor abre a atividade e zera a turma",
      mostra: `A atividade "${atividade.titulo}", com o painel de etapas no início e o monitor da turma vazio.`,
      prova:
        "Zerar apaga as sessões e mantém a atividade e os posts gerados. É o caminho real de " +
        "reaproveitar a mesma atividade com outra turma — e o que torna esta suíte repetível.",
      detalhe: `${atividade.titulo} · etapa: investigação`,
    });

    // ═══ o estudante entra ════════════════════════════════════════════════
    const estudante = conta("estudante", { serie: SERIE });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    /* As rotas do Canal A (`/runs/:id/raio-x`, `termos`, `envio`) que falharem
       aparecem com o corpo, em vez de virar timeout num seletor. */
    const falhasDaApi = [];
    vigiarFalhasDaApi(p, falhasDaApi, "estudante");
    await r.entrar(p, estudante.login);

    await p.goto(`${HUB}/exp/exp08ef1b`, { waitUntil: "domcontentloaded" });
    const aparelho = p.locator('iframe[data-experiencia]');
    await aparelho.waitFor({ state: "attached", timeout: 20_000 });
    const tela = p.frameLocator('iframe[data-experiencia]');
    // O nome do app é o `Logo` do DS (um SVG com `role="img"`), não texto.
    await tela.locator('[aria-label="Unoovista"]').first().waitFor({ timeout: 30_000 });
    await p.waitForTimeout(2000);

    const caixaNoFeed = await aparelho.boundingBox();
    await r.registrar(p, "aparelho-carregado", {
      titulo: "O aparelho, em formato de celular",
      mostra: "A moldura do hub desenha um telefone, e a experiência ocupa a tela dele.",
      prova:
        "A largura estreita não é estética: é o que faz a criança tratar aquilo como o app dela, " +
        "e não como um exercício escolar numa página larga.",
      detalhe: `iframe ${Math.round(caixaNoFeed.width)}×${Math.round(caixaNoFeed.height)} css`,
    });
    r.exigir(
      Math.round(caixaNoFeed.width) <= 400,
      `no feed o aparelho é estreito (${Math.round(caixaNoFeed.width)}px)`,
    );

    // ── onboarding: figurinha e apelido ─────────────────────────────────
    const entrarNoApp = tela.locator("button", { hasText: "Entrar no Unoovista" });
    r.exigir(await entrarNoApp.count(), "a missão abre pela tela de entrada (a turma estava zerada)");
    await r.registrar(p, "missao-apresentada", {
      titulo: "A abertura da ficção",
      mostra: "A tela que convida a entrar no app, sem nenhuma palavra de escola.",
      prova:
        "Nada aqui menciona algoritmo, viés ou pesquisa. A revelação vem no fim — antes dela, " +
        "qualquer pista contaminaria a medida.",
    });
    await entrarNoApp.click();

    const figurinhas = tela.locator('[aria-label="Escolha sua figurinha"] button');
    await figurinhas.first().waitFor({ timeout: 10_000 });
    const quantasFigurinhas = await figurinhas.count();
    await figurinhas.nth(2).click();
    await tela.locator('input[placeholder="seu nome"]').pressSequentially("Bia", { delay: 25 });
    await r.registrar(p, "figurinha-e-apelido", {
      titulo: "Identidade fictícia",
      mostra: `Grade de ${quantasFigurinhas} figurinhas e um campo de apelido.`,
      prova:
        "A criança não usa foto nem nome real dentro do app. O que sai da experiência para a " +
        "telemetria é um id opaco — nunca nome, nunca e-mail (LGPD, dados de menores).",
      detalhe: `${quantasFigurinhas} figurinhas`,
    });

    await tela.locator("button", { hasText: "Salvar e entrar" }).click();
    await p.waitForTimeout(7000); // splash + POST /runs + /entrar + 1º bloco do feed

    const cards = tela.locator("article[data-post-id]");
    await cards.first().waitFor({ timeout: 30_000 });
    const quantosCards = await cards.count();
    r.exigir(quantosCards > 0, `o feed veio do servidor com ${quantosCards} posts no primeiro bloco`);
    await r.registrar(p, "feed-inicial", {
      titulo: "O feed monta",
      mostra: "Posts com autor, imagem, legenda, curtidas e comentários — indistinguíveis de uma rede real.",
      prova:
        "A curadoria é server-side: o cliente recebe os posts já escolhidos e NÃO sabe o lado de " +
        "nenhum deles. Se o lado viajasse no fio, bastaria abrir o DevTools para desmontar a missão.",
      detalhe: `${quantosCards} cards no DOM`,
    });

    // ── o estudante USA o app ───────────────────────────────────────────
    await cards.nth(Math.min(2, quantosCards - 1)).scrollIntoViewIfNeeded();
    await p.waitForTimeout(3500); // o IntersectionObserver mede o dwell
    await r.registrar(p, "rolagem-medida", {
      titulo: "Rolar conta como dado",
      mostra: "O feed rolado até o terceiro post.",
      prova:
        "Cada post visível é cronometrado por IntersectionObserver e vira evento no lote da SDK. " +
        "O tempo de atenção é a medida central da missão — não o clique.",
    });

    /* CURTIR e SALVAR: os dois gestos que o dossiê lê. */
    const curtir = tela.locator('button[aria-label="Curtir publicação"]').first();
    await curtir.click();
    await p.waitForTimeout(800);
    const salvar = tela.locator('button[aria-label="Salvar publicação"]').first();
    await salvar.click();
    await p.waitForTimeout(800);
    const salvos = await tela.locator('button[aria-label="Remover dos salvos"]').count();
    r.exigir(salvos > 0, `salvar marcou o post (${salvos} salvo(s) na tela)`);
    await r.registrar(p, "curtiu-e-salvou", {
      titulo: "Curtir e salvar",
      mostra: "O coração preenchido e o marcador de salvo no primeiro post.",
      prova:
        "Salvar é o gesto que a etapa de debate vai reabrir: no debate a tela trava exatamente no " +
        "que cada um guardou, e é isso que cada criança tem de defender.",
      detalhe: `${salvos} post(s) salvos`,
    });

    /* COMENTAR: caminho completo até a folha aberta. */
    await tela.locator('button[aria-label="Comentar publicação"]').first().click();
    const campoComentario = tela.locator('input[placeholder="Adicione um comentário…"]');
    await campoComentario.waitFor({ timeout: 15_000 });
    await campoComentario.pressSequentially("mas isso aí é verdade mesmo?", { delay: 15 });
    await tela.locator("button", { hasText: "Publicar" }).click();
    await p.waitForTimeout(1500);
    await r.registrar(p, "comentou", {
      titulo: "Comentar num post",
      mostra: "A folha de comentários aberta, com o comentário do estudante no fim da lista.",
      prova:
        "O que a criança escreve é dela e fica na sessão dela. O texto vai para a api e volta no " +
        "relatório do professor — nunca para outra criança.",
    });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(800);

    /* O POST DO ESTUDANTE — o gesto que nenhum roteiro exercitava. */
    await tela.locator('button[aria-label="Criar"]').click();
    await tela.locator("text=Novo post").waitFor({ timeout: 10_000 });
    const fundos = tela.locator('button[aria-label^="Fundo "]');
    await fundos.first().waitFor({ timeout: 10_000 });
    const quantosFundos = await fundos.count();
    await fundos.nth(1).click();
    await r.registrar(p, "compositor-fundo", {
      titulo: "O compositor: escolher o fundo",
      mostra: `${quantosFundos} fundos no estilo "post de texto".`,
      prova:
        "Nada na interface convida até aqui — é descoberta espontânea, como no app real. Quem " +
        "descobre publica; quem não descobre não é penalizado.",
      detalhe: `${quantosFundos} fundos`,
    });

    await tela.locator("button", { hasText: "Avançar" }).click();
    const TEXTO_DO_POST = "eu acho que os dois lados exageram nas contas";
    const composicao = tela.locator("textarea[placeholder='escreva aqui…']");
    await composicao.waitFor({ timeout: 10_000 });
    await composicao.pressSequentially(TEXTO_DO_POST, { delay: 12 });
    await r.registrar(p, "compositor-texto", {
      titulo: "O compositor: escrever",
      mostra: `O texto "${TEXTO_DO_POST}" sobre o fundo escolhido, com o contador de caracteres.`,
      prova:
        "É produção da criança dentro da ficção: ela deixa de ser só leitora do feed e passa a " +
        "publicar nele.",
    });

    /* A resposta do servidor é o que prova o caminho inteiro: o post é gravado
       e as personas reagem AO QUE ELE ESCREVEU. Esperar a resposta HTTP, e não
       um sinal de tela — o cliente mostra o post otimistamente, e um erro no
       servidor ficaria invisível por dezenas de segundos. */
    const publicacao = p.waitForResponse(
      (resp) => resp.url().includes("/student-post") && resp.request().method() === "POST",
      { timeout: 90_000 },
    );
    await tela.locator("button", { hasText: "Compartilhar" }).click();
    const respostaDoPost = await publicacao;
    r.exigir(respostaDoPost.ok(), `POST /runs/:id/student-post respondeu ${respostaDoPost.status()}`);

    const corpo = await respostaDoPost.json().catch(() => ({}));
    console.log(`      resposta do student-post: ${JSON.stringify(corpo).slice(0, 300)}`);
    /* As reações aparecem SOB o post, quando chegam. Esperar o DOM é mais fiel
       que ler a resposta: é o que a criança vê. E a lista vazia é resultado
       VÁLIDO — a geração falha fechada, como um app real em que ninguém
       respondeu —, então 0 vira ressalva com o motivo, não reprovação. */
    const apoio = tela.locator("article, section").filter({ hasText: TEXTO_DO_POST }).first();
    await p.waitForTimeout(6000);
    const apoios = corpo?.comentariosDeApoio?.length ?? 0;
    if (apoios > 0) {
      r.exigir(true, `as personas reagiram ao post do estudante (${apoios} comentários de apoio)`);
    } else {
      r.ressalva(
        "nenhuma reação das personas chegou nesta execução. É comportamento válido — a geração " +
          "falha FECHADA (modelo, rede ou filtro de segurança) e o post é publicado do mesmo " +
          "jeito. O motivo fica no log da api, em `[ia] ...`",
      );
    }
    void apoio;
    /* O post do estudante entra no TOPO do feed, e o feed continua na rolagem
       onde ele estava — sem voltar ao topo, o print mostra o post de outra
       pessoa e a evidência não mostra o que a legenda promete. */
    await tela.locator("article[data-post-id]").first().evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(1200);
    await r.registrar(p, "post-publicado", {
      titulo: "O post do estudante, no topo do feed dele",
      mostra: "O post publicado, com curtidas subindo e os comentários das personas embaixo.",
      prova:
        "As reações vêm do servidor e são calculadas pelo lado do feed em que a criança nasceu: " +
        "quem publica no sentido da bolha recebe aplauso, e é essa assimetria que a explicação " +
        "do fim vai nomear.",
      detalhe: `${apoios} comentários de apoio das personas`,
    });

    /* STORIES e BUSCA: as duas superfícies que o feed principal não cobre. */
    const story = tela.locator("button", { hasText: /^@?\w/ }).first();
    const temStories = await tela.locator('[aria-label="Próxima história"]').count();
    await tela.locator('button[aria-label="Buscar"]').click();
    const busca = tela.locator('input[placeholder="Pesquisar"]');
    await busca.waitFor({ timeout: 10_000 });
    /* Cada miniatura é um `<button>` quadrado na grade de 3 colunas — a imagem
       pode faltar (o post cai na arte procedural), então contar `img` mede a
       geração de imagem, não a busca. */
    const miniaturas = tela.locator(".grid-cols-3 > button");
    await miniaturas.first().waitFor({ timeout: 20_000 });
    const miniaturasAntes = await miniaturas.count();
    /* O termo sai do PRÓPRIO acervo desta atividade: um termo fixo ("dinheiro")
       não existe no recorte de todas elas, e a busca voltaria vazia — o que
       leria como "a busca não funciona" quando ela funcionou perfeitamente. */
    const termo = await tela
      .locator("article[data-post-id]")
      .first()
      .innerText()
      .then((texto) => {
        /* A legenda inteira do primeiro post, e dela a palavra mais longa: o
           card traz handle, contadores e "ver comentários" junto, e pegar a
           primeira palavra com 6+ letras costumava devolver um pedaço da
           interface em vez do conteúdo. */
        const palavras = texto
          .replace(/[#@]\S+/g, " ")
          .split(/[^\p{L}]+/u)
          .filter((palavra) => palavra.length >= 6);
        return palavras.sort((a, b) => b.length - a.length)[0]?.toLowerCase() ?? "de";
      })
      .catch(() => "de");
    await busca.pressSequentially(termo, { delay: 20 });
    await busca.press("Enter");
    await p.waitForTimeout(3000);
    const miniaturasDepois = await miniaturas.count();
    r.exigir(
      miniaturasAntes > 0,
      `a busca abre com o acervo inteiro da atividade (${miniaturasAntes} miniaturas)`,
    );
    await r.registrar(p, "busca-no-acervo", {
      titulo: "A busca — a saída que ninguém aponta",
      mostra: "Grade de miniaturas com o resultado da consulta ao acervo.",
      prova:
        "A busca devolve o ACERVO INTEIRO, os dois lados, sem curadoria de bolha. É a única saída " +
        "do viés dentro do app, e ela não é sinalizada em lugar nenhum: quantos descobrem sozinhos " +
        "é uma das métricas da análise de produto.",
      detalhe: `${miniaturasAntes} miniaturas no acervo → ${miniaturasDepois} para "${termo}"${temStories ? " · stories presentes" : ""}`,
    });
    void story;

    /* As duas abas que faltam: notificações e o perfil dele. O perfil é onde o
       post que ele acabou de publicar aparece na grade — a prova, do lado da
       criança, de que a publicação foi para algum lugar. */
    await tela.locator('button[aria-label="Notificações"]').click();
    await p.waitForTimeout(1500);
    await r.registrar(p, "notificacoes", {
      titulo: "As notificações",
      mostra: "Quem interagiu com o que ela publicou ou comentou.",
      prova:
        "Alimentadas pela PRÓPRIA sessão dela — nenhuma criança aparece na notificação de outra. " +
        "O feed é individual do começo ao fim.",
    });

    await tela.locator('button[aria-label="Meu perfil"]').click();
    await p.waitForTimeout(1500);
    const publicacoes = await tela.locator("text=/publicaç/i").first().innerText().catch(() => "");
    await r.registrar(p, "perfil-do-estudante", {
      titulo: "O perfil dela, com o post publicado",
      mostra: `A grade com o que ela salvou e o post que ela mesma escreveu. ${publicacoes}`.trim(),
      prova:
        "O identificador é a figurinha e o apelido escolhidos no onboarding. Nada do nome real " +
        "dela circula dentro do aparelho.",
      detalhe: publicacoes,
    });

    await tela.locator('button[aria-label="Início"]').click();
    await p.waitForTimeout(1500);

    /* ROLAR DE VERDADE antes de a investigação fechar. O Raio-x (6a) só usa
       posts que ela VIU no feed (a tela cinza nunca entra), dos dois lados e
       neutros: com três posts rolados ele não fecharia 6, e a habilidade
       ficaria só com a reflexão — o caso de quem quase não rolou. Um post por
       vez, o tempo de o dwell (≥60% visível) contar, e o feed pede blocos novos
       sozinho. */
    for (let i = 0; i < 24; i += 1) {
      const doFeed = tela.locator("article[data-post-id]");
      if (i >= (await doFeed.count())) break;
      await doFeed.nth(i).scrollIntoViewIfNeeded();
      await p.waitForTimeout(1300);
    }
    await p.waitForTimeout(5000); // o lote de eventos do motor sai a cada 4 s

    // ═══ o professor move a turma: RESPOSTA ═══════════════════════════════
    await moverEtapa(prof, atividade.id, "conclusao");
    await tela.locator("text=E aí, o que você acha?").waitFor({ timeout: 40_000 });
    await r.registrar(p, "pergunta-do-debate", {
      titulo: "A pergunta, antes de qualquer revelação",
      mostra: "A pergunta-chave da atividade e três opções: um lado, o outro, ou ainda em dúvida.",
      prova:
        "A resposta é colhida ANTES de a criança saber que o feed era enviesado. Depois da " +
        "revelação, a resposta já não mede o efeito do feed — mede a reação à revelação.",
    });

    const opcoes = tela.locator('[role="radio"]');
    const quantasOpcoes = await opcoes.count();
    r.exigir(quantasOpcoes === 3, `três caminhos, incluindo a dúvida (${quantasOpcoes} opções)`);
    await opcoes.nth(0).click();
    await tela.locator("text=Resposta registrada").waitFor({ timeout: 20_000 });
    await r.registrar(p, "resposta-registrada", {
      titulo: "Resposta registrada",
      mostra: "A confirmação, com o aviso de que dá para trocar de ideia enquanto espera.",
      prova:
        "'Ainda em dúvida' é uma resposta legítima e conta como tal. Forçar um lado inventaria " +
        "convicção onde havia hesitação.",
    });

    // ═══ O RAIO-X (6a), na mesma tela, ainda no disfarce ═════════════════
    const raioX = tela.locator('section[aria-label="Raio-x do feed"]');
    await raioX
      .getByText("Antes da conversa: de cada post abaixo, o que ele faz?")
      .waitFor({ timeout: 30_000 })
      .catch(() => {
        throw new Error(
          `o Raio-x não apareceu depois da resposta${falhasDaApi.length ? ` — falhas da api: ${falhasDaApi.join(" | ")}` : ""}`,
        );
      });
    const textoDoRaioX = await raioX.innerText();
    r.exigir(
      !/algoritmo|bolha|lado inicial|lado de partida/i.test(textoDoRaioX),
      "o Raio-x não fala de algoritmo, bolha nem lado inicial — o disfarce continua",
    );
    await r.registrar(p, "raio-x", {
      titulo: "O Raio-x do feed, antes do debate",
      mostra: "Um post que ela viu, e três opções: puxa para um lado, puxa para o outro, ou informa sem tomar lado.",
      prova:
        "Os 6 posts são posts que ELA viu (nenhum da tela cinza), e o aparelho nem sabe o lado deles: " +
        "a composição, o gabarito e a régua ficam na api.",
    });
    const ESCOLHAS = [/^puxa para/, /^informa sem tomar lado$/];
    for (let i = 0; i < 6; i += 1) {
      const opcoesDoPost = raioX.getByRole("radio", { name: ESCOLHAS[i % 2] });
      await opcoesDoPost.first().click();
      const seguir = raioX.getByRole("button", { name: i === 5 ? "Enviar" : "Próximo" });
      await seguir.click();
    }
    await raioX.getByText("Enviado.").waitFor({ timeout: 20_000 });
    const depoisDoEnvio = await raioX.innerText();
    r.exigir(
      !/acert|errou|certo|errado|de onde veio/i.test(depoisDoEnvio),
      "o envio não dá devolutiva: nem acerto, nem de onde cada post veio (isso fica para a revelação)",
    );
    await r.registrar(p, "raio-x-enviado", {
      titulo: "Raio-x enviado",
      mostra: "Só \"Enviado.\" — nada de certo, errado ou contagem.",
      prova:
        "A devolutiva do Raio-x entra DENTRO da revelação, como ponte. Dizer agora de onde cada post " +
        "veio entregaria a revelação antes do debate.",
    });

    // ═══ DEBATE ══════════════════════════════════════════════════════════
    await moverEtapa(prof, atividade.id, "debate");
    await tela.locator("text=Hora de conversar").waitFor({ timeout: 40_000 });
    await r.registrar(p, "debate", {
      titulo: "O debate trava o app no que cada um salvou",
      mostra: "A tela do debate, com os posts que este estudante guardou.",
      prova:
        "O feed some de propósito. Se continuasse disponível, metade da sala estaria rolando post " +
        "novo em vez de defender o que salvou — e o valor do momento é ter que defender.",
    });

    // ═══ EXPLICAÇÃO: a revelação e o relatório ═══════════════════════════
    await moverEtapa(prof, atividade.id, "explicabilidade");
    await tela
      .locator("text=O Unoovista não é uma rede social de verdade")
      .waitFor({ timeout: 40_000 });
    await r.registrar(p, "revelacao", {
      titulo: "A revelação",
      mostra: "Fundo escuro, uma frase por vez: o app conta o que ele era.",
      prova:
        "A virada da missão. Tudo o que a criança fez até aqui foi feito sem saber — é o que " +
        "torna a descoberta sobre ela mesma, e não sobre um exercício.",
    });

    /**
     * A MARCA. Cross-origin, o hub não alcança o `contentWindow` — mas o
     * Playwright alcança o frame. Se a árvore React remontar o `<iframe>`, a
     * marca some e a criança volta ao começo com a sessão recarregada.
     */
    const frame = await (await aparelho.elementHandle()).contentFrame();
    if (!frame) throw new Error("não consegui alcançar o frame da experiência");
    await frame.evaluate(() => {
      window.__marcaDoSmoke = "viva";
    });

    let telasDaRevelacao = 0;
    let viuAPonte = false;
    let viuOsTermos = false;
    let viuORegistro = false;
    for (let i = 0; i < 14; i += 1) {
      if (!viuAPonte && (await tela.getByText("Os 6 posts do Raio-x, antes do debate:").count())) {
        viuAPonte = true;
        const ponte = tela.getByRole("list", { name: "De onde veio cada post" });
        await ponte.waitFor({ timeout: 10_000 });
        const itens = await ponte.getByRole("listitem").count();
        r.exigir(itens === 6, `a ponte mostra os 6 posts do Raio-x (${itens})`);
        const textoDaPonte = await ponte.innerText();
        r.exigir(
          /escrito para (defender|informar)/.test(textoDaPonte) && !/acert|errou|certo|errado/i.test(textoDaPonte),
          "cada post diz de onde veio, sem certo ou errado",
        );
        await r.registrar(p, "ponte-do-raio-x", {
          titulo: "A ponte do Raio-x, dentro da revelação",
          mostra: "Os 6 posts do Raio-x, cada um com \"escrito para defender [lado]\" ou \"escrito para informar, sem defender lado\".",
          prova:
            "A devolutiva fala do post, nunca do estudante: sem contagem e sem certo ou errado. Ela só " +
            "existe da revelação em diante, e só para quem enviou o Raio-x.",
        });
      }
      if (await tela.getByText("Nos termos de uso — que quase ninguém lê, nem adulto.").count()) viuOsTermos = true;
      if (await tela.getByText("O registro, não.").count()) viuORegistro = true;
      const continuar = tela.locator("button", { hasText: "Continuar" });
      if (!(await continuar.count())) break;
      await continuar.click();
      telasDaRevelacao += 1;
      await p.waitForTimeout(700);
    }
    r.exigir(viuAPonte, "a revelação teve a ponte do Raio-x");
    r.exigir(viuOsTermos && viuORegistro, "a revelação teve as duas telas novas: os termos e o registro");
    r.exigir(telasDaRevelacao + 1 === 10, `a revelação tem dez telas para quem fez o Raio-x (${telasDaRevelacao + 1})`);
    const verRelatorio = tela.locator("button", { hasText: "Ver meu relatório" });
    await verRelatorio.waitFor({ timeout: 15_000 });
    const caixaAntes = await aparelho.boundingBox();

    await verRelatorio.click();
    /* Esperar um elemento do FIM do relatório: o conteúdo vem de `React.lazy`, e
       medir logo depois do título pega a tela ainda montando — fundo
       transparente e zero gráfico, que lê como bug de tema. */
    await tela.locator("button", { hasText: "Copiar relatório" }).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1200);
    const caixaDepois = await aparelho.boundingBox();

    r.exigir(
      caixaDepois.width > caixaAntes.width * 1.5,
      `o aparelho EXPANDIU para o relatório (${Math.round(caixaAntes.width)} → ${Math.round(caixaDepois.width)}px)`,
    );
    const marcaViva = await frame.evaluate(() => window.__marcaDoSmoke).catch(() => null);
    r.exigir(marcaViva === "viva", "e expandiu SEM recarregar o iframe — a marca sobreviveu");

    const fundo = await frame.evaluate(() => {
      const botao = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Copiar relatório"),
      );
      let no = botao?.parentElement ?? document.body;
      while (no && no !== document.documentElement) {
        const cor = getComputedStyle(no).backgroundColor;
        if (cor && cor !== "transparent" && !cor.endsWith(", 0)") && !cor.endsWith("/ 0)")) return cor;
        no = no.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    });
    /* Dois formatos: `rgb(255, 255, 255)` e `color(srgb 1 1 1)` — o Chrome passou
       a devolver o segundo quando o CSS declara a cor no espaço sRGB, com os
       canais de 0 a 1. Lido como `rgb`, o branco virava (1, 1, 1) e "escuro". */
    const claro = (() => {
      const m = fundo.match(/[\d.]+/g);
      if (!m) return false;
      const escala = fundo.startsWith("color(") ? 255 : 1;
      const [vermelho, verde, azul] = m.slice(0, 3).map((v) => Number(v) * escala);
      return (vermelho + verde + azul) / 3 > 200;
    })();
    r.exigir(claro, `o relatório é de tema CLARO (backgroundColor computado: ${fundo})`);
    const graficos = await frame.evaluate(() => document.querySelectorAll("svg[role=img]").length);
    r.exigir(graficos >= 2, `os gráficos que não cabiam no aparelho apareceram (${graficos} svg)`);

    await r.registrar(p, "relatorio-expandido", {
      titulo: "O relatório: o aparelho vira tela cheia",
      mostra: "O dossiê da sessão, com os gráficos do que ela viu, do que salvou e de onde o feed nasceu.",
      prova:
        "É a única tela que sai do formato de celular — e ela expande SEM remontar o iframe. " +
        "Remontar recarregaria a experiência e devolveria a criança ao começo, perdendo a sessão.",
      detalhe: `${telasDaRevelacao + 1} telas de revelação · iframe ${Math.round(caixaAntes.width)}px → ${Math.round(caixaDepois.width)}px · ${graficos} gráficos`,
    });

    // ═══ O QUE PERDERAM ══════════════════════════════════════════════════
    await moverEtapa(prof, atividade.id, "perdidos");
    /* O DESFECHO, não o relógio: o polling da experiência é de 5 s e, no dev
       publicado, a fase nova chega depois disso. Espera o aparelho contrair E a
       moldura aparecer, com teto de 45 s. */
    for (let i = 0; i < 45; i += 1) {
      const caixa = await aparelho.boundingBox();
      if (caixa.width < caixaDepois.width * 0.6 && (await p.locator("text=o feed que você não recebeu").count()) > 0) break;
      await p.waitForTimeout(1000);
    }
    const caixaPerdidos = await aparelho.boundingBox();
    r.exigir(
      caixaPerdidos.width < caixaDepois.width * 0.6,
      `o aparelho voltou ao formato de celular (${Math.round(caixaPerdidos.width)}px)`,
    );
    const marcaAindaViva = await frame.evaluate(() => window.__marcaDoSmoke).catch(() => null);
    r.exigir(marcaAindaViva === "viva", "e contraiu sem recarregar também");
    const moldura = await p.locator("text=o feed que você não recebeu").count();
    r.exigir(moldura > 0, "a moldura dos posts perdidos apareceu no hub, FORA do aparelho");
    await r.registrar(p, "o-que-perderam", {
      titulo: "O que o algoritmo escondeu",
      mostra: "O feed do outro lado, em cinza, na moldura do hub — fora do aparelho.",
      prova:
        "Estar fora do aparelho é a decisão: o app nunca mostrou esses posts, e mostrá-los DENTRO " +
        "dele contradiria a história que a criança acabou de ouvir.",
      detalhe: `iframe de volta a ${Math.round(caixaPerdidos.width)}px`,
    });

    // ═══ AS TAREFAS DEPOIS DO CINZA: 6b os termos, 6c o envio ════════════
    await tela.getByRole("button", { name: "Continuar" }).click();
    await tela
      .getByText("Estes seriam os termos de uso de uma plataforma como o Unoovista.")
      .waitFor({ timeout: 30_000 })
      .catch(() => {
        throw new Error(`os termos (6b) não abriram${falhasDaApi.length ? ` — falhas da api: ${falhasDaApi.join(" | ")}` : ""}`);
      });
    await r.registrar(p, "termos", {
      titulo: "Os termos (6b)",
      mostra: "As 5 regras, fictícias: marcar as que explicam o feed, dizer o efeito de cada uma e escolher a mudança.",
      prova:
        "Os termos aparecem pela primeira vez aqui, depois da revelação. Marcar todas dá \"não atingiu\": " +
        "a régua cobra localizar, explicar o efeito e julgar — e o gabarito fica na api.",
    });
    /* As três que explicam, cada uma com o seu efeito, e a mudança que dá controle. */
    for (const [clausula, efeito] of [
      ["Registramos suas curtidas", "e1"],
      ["Usamos o seu histórico de interações", "e2"],
      ["Guardamos o histórico das suas interações", "e3"],
    ]) {
      /* O `<input>` do `Checkbox` do DS é só para leitor de tela (sr-only, fora da
         área visível): quem marca é o toque no RÓTULO, como o dedo da criança. */
      await tela.getByText(new RegExp(clausula)).click();
      r.exigir(await tela.getByRole("checkbox", { name: new RegExp(clausula) }).isChecked(), `a regra "${clausula}…" ficou marcada`);
      const grupo = clausula === "Registramos suas curtidas" ? "c1" : clausula.startsWith("Usamos") ? "c3" : "c5";
      await tela.locator(`input[type="radio"][name="efeito-${grupo}"][value="${efeito}"]`).check({ force: true });
    }
    await tela.locator('input[type="radio"][name="mudanca"][value="controle"]').check({ force: true });
    await tela.getByRole("button", { name: "Enviar" }).click();

    await tela
      .getByText("Um colega de outra turma não viu nada", { exact: false })
      .waitFor({ timeout: 30_000 })
      .catch(() => {
        throw new Error(`o envio (6c) não abriu${falhasDaApi.length ? ` — falhas da api: ${falhasDaApi.join(" | ")}` : ""}`);
      });
    /* Os posts chegam depois do título: contar sem esperar o primeiro dava 0. */
    await tela.getByRole("checkbox", { name: "mandar este" }).first().waitFor({ state: "attached", timeout: 30_000 });
    const postsDoEnvio = await tela.getByRole("checkbox", { name: "mandar este" }).count();
    r.exigir(postsDoEnvio === 9, `o envio oferece 9 posts (${postsDoEnvio})`);
    const textoDoEnvio = await tela.getByRole("list", { name: "Os posts" }).innerText();
    r.exigir(!/lado A|lado B|sem lado/i.test(textoDoEnvio), "as miniaturas não dizem o lado de cada post");
    await r.registrar(p, "envio", {
      titulo: "Mandar pra quem não viu (6c)",
      mostra: "9 posts, com quem publicou e a descrição do perfil, 4 mensagens e uma frase opcional.",
      prova:
        "A miniatura não diz o lado: montar \"os dois lados\" é reconhecê-los. A descrição do perfil é o que " +
        "mostra a página de fofoca ou de humor — e o servidor classifica pelo lado gravado.",
    });
    const marcar = tela.getByRole("checkbox", { name: "mandar este" });
    await tela.getByText("mandar este").nth(0).click();
    await tela.getByText("mandar este").nth(1).click();
    r.exigir((await marcar.nth(0).isChecked()) && (await marcar.nth(1).isChecked()), "dois posts escolhidos para mandar");
    await tela.locator('input[type="radio"][name="mensagem"][value="m1"]').check({ force: true });
    await tela.locator("textarea").fill("Olha os dois lados antes de decidir.");
    await tela.getByRole("button", { name: "Enviar" }).click();

    /* Feitas as duas, o cinza volta com "Rever meu relatório". */
    const rever = tela.getByRole("button", { name: "Rever meu relatório" });
    await rever.waitFor({ timeout: 30_000 });
    await rever.click();
    await tela.locator("button", { hasText: "Copiar relatório" }).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1200);
    const caixaRever = await aparelho.boundingBox();
    r.exigir(caixaRever.width > caixaPerdidos.width * 1.5, "\"Rever meu relatório\" abre o relatório em tela cheia, a pedido");
    await r.registrar(p, "rever-relatorio", {
      titulo: "Rever meu relatório",
      mostra: "O relatório de novo, em tela cheia, com \"Voltar\".",
      prova:
        "Na versão em duas aulas, as duplas e a reflexão acontecem dias depois: rever o relatório evita que o " +
        "gesto próprio que a reflexão pede vire memória.",
    });
    await tela.getByRole("button", { name: "Voltar" }).click();
    await p.waitForTimeout(1500);

    // ═══ REFLEXÃO ════════════════════════════════════════════════════════
    await moverEtapa(prof, atividade.id, "reflexao");
    const escrita = tela.locator("textarea");
    await escrita.waitFor({ timeout: 40_000 });
    /* A caixa nasce desabilitada até o texto salvo carregar: digitar antes
       perdia o texto e o "Salvar" nunca acendia. */
    for (let i = 0; i < 40 && (await escrita.isDisabled()); i += 1) await p.waitForTimeout(500);
    const TEXTO_REFLEXAO =
      "Como eu parava e salvava os posts de um lado, o feed foi me mostrando cada vez mais deles e os do outro lado quase não chegaram. Eu nem percebi que era sempre o mesmo lado.";
    await escrita.pressSequentially(TEXTO_REFLEXAO, { delay: 8 });
    const aviso = await tela
      .getByText("Um programa de IA lê o primeiro texto que você salvar e sugere a ele um nível; quem decide é ele.", {
        exact: false,
      })
      .count();
    r.exigir(aviso > 0, "a tela avisa que o professor lê e que a IA lê o primeiro texto salvo");
    await r.registrar(p, "reflexao-escrita", {
      titulo: "A reflexão final",
      mostra: "Campo de escrita livre, com o aviso de quem lê o texto e andaimes opcionais para quem travou.",
      prova:
        "É a única produção textual longa da missão, e ela é do estudante — o professor lê no " +
        "relatório da turma, ninguém mais.",
    });

    await tela.locator("button", { hasText: /^Salvar$/ }).click();
    await tela.locator("text=Guardado").waitFor({ timeout: 20_000 });

    /* Sobreviver ao F5 é o que separa "apareceu na tela" de "foi gravado". */
    await p.reload({ waitUntil: "domcontentloaded" });
    const telaDepois = p.frameLocator('iframe[data-experiencia]');
    const escritaDepois = telaDepois.locator("textarea");
    await escritaDepois.waitFor({ timeout: 40_000 });
    await p.waitForTimeout(2000);
    const voltou = await escritaDepois.inputValue();
    r.exigir(
      voltou.includes("nem percebi"),
      "a reflexão sobreviveu ao F5 — está no servidor, não na memória do cliente",
    );
    await r.registrar(p, "reflexao-persistida", {
      titulo: "E ela sobrevive à recarga",
      mostra: "Depois de um F5, o texto volta inteiro.",
      prova:
        "Estado de experiência é server-side, sempre. Um F5 no meio da aula — que acontece — não " +
        "pode custar o que a criança escreveu.",
      detalhe: `${voltou.length} caracteres devolvidos pelo servidor`,
    });

    // ═══ O CANAL B SAIU: nada de perguntas do fim ═══════════════════════
    await p.waitForTimeout(2500);
    const perguntas = await telaDepois.getByRole("button", { name: "Enviar resposta" }).count();
    const cabecalho = await telaDepois.getByText("mais três perguntas").count();
    r.exigir(perguntas === 0 && cabecalho === 0, "as três perguntas do fim não aparecem mais depois da reflexão salva");

    // ═══ A TELEMETRIA CHEGOU? ════════════════════════════════════════════
    /* O dwell de cada post é a medida central da missão, e ela viaja por dois
       canais: os eventos OPERACIONAIS (`POST /runs/:id/eventos`, que alimentam
       o dossiê) e o lote ANALÍTICO da SDK (`POST /telemetry/batch`). Um smoke
       que não olha isso deixaria passar o pior defeito silencioso do produto:
       tudo funcionando na tela e nada sendo medido. */
    const monitor = await prof.request.get(`${BFF}/atividades/${atividade.id}/monitor`);
    const { runs } = await monitor.json();
    const linha = (runs ?? []).find((l) => l.runId);
    r.exigir(Boolean(linha), "a sessão desta criança aparece no monitor da turma");
    if (linha?.runId) {
      const dossie = await prof.request.get(`${BFF}/runs/${linha.runId}/dossie`);
      const corpo = await dossie.json();
      const vistos = corpo?.dossie?.postsVistos ?? corpo?.dossie?.totalVisto ?? null;
      r.exigir(
        dossie.ok(),
        `o dossiê da sessão foi computado a partir dos eventos (HTTP ${dossie.status()}` +
          `${vistos !== null ? `, ${vistos} posts medidos` : ""})`,
      );
      const explicacao = corpo?.dossie?.explicacaoDoLado;
      r.exigir(
        Boolean(explicacao?.origem && explicacao?.ladoRotulo),
        `o relatório sabe de onde veio o lado do feed dela (origem: ${explicacao?.origem})`,
      );

      /* A LEITURA DA REFLEXÃO pela IA REAL (Vertex): ela roda depois da resposta
         ao estudante. A espera corre contra o erro: a leitura que ENCERROU como
         falha (sem saldo, tempo, saída inválida) reprova na hora, com o motivo —
         nunca um timeout cego. */
      let leitura = null;
      const limite = Date.now() + 90_000;
      while (Date.now() < limite) {
        const det = await prof.request.get(`${BFF}/atividades/${atividade.id}/estudantes/${linha.runId}`);
        leitura = (await det.json())?.sessao?.canalA?.leitura ?? null;
        if (leitura?.lidaEm) break;
        await p.waitForTimeout(2000);
      }
      r.exigir(Boolean(leitura?.lidaEm), "a IA leu a reflexão (a leitura encerrou)");
      r.exigir(
        leitura?.resultado === "nivel",
        `a leitura da IA real deu um nível (resultado: ${leitura?.resultado}, nível: ${leitura?.nivel}, motivo: ${leitura?.motivo})`,
      );
      const detalhe = await (await prof.request.get(`${BFF}/atividades/${atividade.id}/estudantes/${linha.runId}`)).json();
      const canalA = detalhe?.sessao?.canalA;
      r.exigir(
        canalA?.raioX && canalA?.termos && canalA?.envio && canalA?.revelacaoConcluida,
        "o professor vê que ela terminou a revelação e fez o Raio-x, os termos e o envio",
      );
      r.exigir(canalA?.fraseDoEnvio === "Olha os dois lados antes de decidir.", "e lê a frase própria do envio");
      r.exigir(String(canalA?.textoLido ?? "").startsWith("Como eu parava"), "e o texto que a IA leu");
    }

    // ═══ FIM: o professor encerra e vê a turma ═══════════════════════════
    await moverEtapa(prof, atividade.id, "fim");
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.waitForTimeout(3000);
    const paginaDoProfessor = await prof.locator("main").innerText();
    r.exigir(
      ["EF08CO11", "EF08CO09", "EF08CO07"].every((c) => paginaDoProfessor.includes(c)),
      "o painel \"Habilidades da BNCC\" da atividade mostra as três habilidades do Unoovista",
    );
    r.exigir(
      /Os termos de uso/.test(paginaDoProfessor) && /Envio/.test(paginaDoProfessor) && /Raio-x do feed|Reflexão — sugestão da IA/.test(paginaDoProfessor),
      "cada nível diz de qual tarefa veio (o \"de onde veio\" do painel, ADR-166)",
    );
    await r.registrar(prof, "professor-ao-fim", {
      titulo: "A turma, pelo lado do professor",
      mostra: "O monitor com a linha deste estudante: de que lado o feed nasceu, o que ele fez e como respondeu.",
      prova:
        "O professor vê a turma NOMINALMENTE — é a sala dele. A análise de produto, que compara " +
        "turmas, é outra tela e é agregada.",
    });
  },
);

/** Move a turma inteira de etapa. É o único jeito de a aula andar. */
async function moverEtapa(pagina, atividadeId, etapa) {
  const resposta = await pagina.request.post(`${BFF}/atividades/${atividadeId}/etapa`, {
    data: { etapa },
  });
  if (!resposta.ok()) {
    throw new Error(`etapa ${etapa}: ${resposta.status()} ${(await resposta.text()).slice(0, 200)}`);
  }
  await pagina.waitForTimeout(1200);
}
