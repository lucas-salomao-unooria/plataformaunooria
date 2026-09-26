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
 * Em dev e na e2e a IA é o mock, que sempre falha: a classificação da legenda
 * (o Canal A de EF07CO11) NÃO marca nada, e isso é o comportamento declarado
 * (ADR-114). A evidência que o painel mostra no fim vem da enquete p1.
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
      "Publicar exige EXATAMENTE 3 posts e uma legenda de 10 caracteres ou mais",
      "Legenda com link é recusada antes de outro estudante poder lê-la",
      "Publicar é irreversível, e a F5 volta ao mesmo passo",
      "Quem move a sala é UM botão da professora: Mural, fichas, explicação",
      "No Mural, cada estudante vê o colega que escolheu outra coisa — pelo primeiro nome",
      "A ficha técnica só aparece depois que a professora revela",
      "As duas enquetes da Amara não mostram acerto, e a missão termina",
      "A folha da turma não tem coluna de pontos, e o painel mostra as habilidades da BNCC",
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

    // ═══ PROFESSORA: a ficha, o preparo e a turma zerada ══════════════════
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

    await prof.click("text=Abrir a aula e os resultados");
    await prof.waitForURL("**/resultados**", { timeout: 20_000 });
    const seletor = prof.locator("select#turma");
    await seletor.waitFor({ timeout: 15_000 });
    const opcoes = await seletor
      .locator("option")
      .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
    const alvo = opcoes.find((o) => o.label.includes(TURMA) && o.value);
    if (!alvo) throw new Error(`turma ${TURMA} não está no seletor (rode o seed)`);
    await prof.selectOption("select#turma", alvo.value);
    await prof.waitForURL("**turmaId=**", { timeout: 20_000 });

    /* ZERAR PRIMEIRO: o estado é server-side e sobrevive ao roteiro. Zerar
       abre uma rodada nova com a etapa em "exploracao" (a anterior fica no
       histórico, que é o que a evidência exige). Sem isto a segunda execução
       encontra os estudantes já publicados, e o roteiro passa por cima do
       latch que ele existe para provar. */
    await prof.locator("[data-zerar-turma]").waitFor({ timeout: 20_000 });
    await prof.click("[data-zerar-turma]");
    await prof.locator("text=/Zerar a turma/i").last().click();
    await prof.waitForSelector('[data-etapa="exploracao"]', { timeout: 20_000 });
    await r.registrar(prof, "preparo-e-painel", {
      titulo: "O preparo e o botão que move a sala",
      mostra:
        "O tema da cobertura com os 12 posts e as tags à vista da professora, e o painel da aula " +
        "com UM botão que mostra a próxima etapa.",
      prova:
        "As tags de fonte e de ângulo só a professora vê antes da revelação. Um botão só, que " +
        "anda uma etapa por vez, e nenhuma etapa é pulada.",
      inteira: true,
    });

    // ═══ ESTUDANTE 1: a DM, o feed e os salvos ════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, PRIMEIRO.login);
    await p.goto(`${HUB}/exp/exp07ef1b`, { waitUntil: "domcontentloaded" });
    const q = () => p.frameLocator('iframe[title="experiencia"]');
    await q().getByRole("button", { name: /Abrir Feed da Cobertura/i }).waitFor({ timeout: 40_000 });
    await r.registrar(p, "dm-da-amara", {
      titulo: "O pedido da Amara",
      mostra: "A DM do grêmio com o desafio: escolher 3 posts e publicar nos Stories com uma legenda.",
      prova:
        "Nada aqui fala em viés ou em lado da história: a missão depende de a criança escolher " +
        "achando que está sendo completa.",
    });

    await q().getByRole("button", { name: /Abrir Feed da Cobertura/i }).click();
    await q().locator("text=/Posts salvos: 0/").waitFor({ timeout: 20_000 });
    for (let i = 0; i < 3; i += 1) {
      await q().getByRole("button", { name: /Salvar publicação/i }).first().click();
      await p.waitForTimeout(300);
    }
    await q().locator("text=/Posts salvos: 3/").waitFor({ timeout: 10_000 });
    await r.registrar(p, "feed-da-cobertura", {
      titulo: "O feed e o marcador",
      mostra: "Os posts dos três perfis intercalados, o contador de salvos e a pílula para a aba Salvos.",
      prova:
        "Curtir não conta: só o marcador leva o post para os Stories. A pílula só aparece com 3 " +
        "salvos, e o feed nunca põe três posts seguidos do mesmo perfil.",
    });

    await q().getByRole("button", { name: /Ir para aba Salvos/i }).click();
    await q().locator("text=/Itens Salvos/").waitFor({ timeout: 15_000 });
    const grade = q().getByLabel("Posts salvos");
    for (let i = 0; i < 3; i += 1) await grade.locator("button").nth(i).click();
    await q().locator("text=/3 de 3 selecionados/").waitFor({ timeout: 10_000 });

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
    await q().locator("text=/Não foi possível publicar/i").waitFor({ timeout: 15_000 });
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
    await q().locator("text=/Publicado! Aguardando o professor/i").waitFor({ timeout: 20_000 });
    await r.registrar(p, "publicado", {
      titulo: "Publicado, e sem volta",
      mostra: "A prévia dos próprios Stories e a espera pelo Mural da turma.",
      prova:
        "Depois de confirmar, não há como voltar ao feed nem editar a legenda: a escolha que a " +
        "turma vai comparar é a que a criança fez, não uma corrigida depois.",
    });

    await p.reload({ waitUntil: "domcontentloaded" });
    await q().locator("text=/Publicado! Aguardando o professor/i").waitFor({ timeout: 40_000 });
    r.exigir(true, "a F5 depois de publicar volta à espera, não ao feed");

    // ═══ ESTUDANTE 2: publica pela api, com escolhas DIVERGENTES ═════════
    const p2 = await r.pagina("estudante-2", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p2, SEGUNDO.login);
    await p2.goto(`${HUB}/exp/exp07ef1b`, { waitUntil: "domcontentloaded" });
    await p2
      .frameLocator('iframe[title="experiencia"]')
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
    await q().locator("text=/Mural de Stories da Turma/i").waitFor({ timeout: 30_000 });
    await q().locator(`text=Publicação de ${PRIMEIRO_NOME_DO_SEGUNDO}`).waitFor({ timeout: 15_000 });
    r.exigir(
      (await q().locator("text=/Ficha Técnica/i").count()) === 0,
      "na tela pico do Mural não há ficha técnica: o contraste vem antes da explicação",
    );
    await r.registrar(p, "mural-pareado", {
      titulo: "O mesmo feed, outra história",
      mostra: `A própria tríade e, ao lado, a de ${PRIMEIRO_NOME_DO_SEGUNDO}, que escolheu só vozes da comunidade.`,
      prova:
        "O par é o colega que mais se afastou da escolha da criança, e ele aparece pelo primeiro " +
        "nome. Tela nua: nenhuma tag, nenhuma nota — o estranhamento vem antes da teoria.",
    });

    // ═══ PROFESSORA revela as fichas ═════════════════════════════════════
    await apertar(prof, "fichas");
    const verDetalhes = q().getByRole("button", { name: /Ver detalhes da postagem/i });
    await verDetalhes.waitFor({ timeout: 30_000 });
    await verDetalhes.click();
    await q().locator("text=/Ficha Técnica da Curadoria/i").waitFor({ timeout: 15_000 });
    await r.registrar(p, "ficha-tecnica", {
      titulo: "A ficha técnica acende",
      mostra: "A fonte ouvida e o ângulo de cada post, e o equilíbrio editorial das duas seleções.",
      prova:
        "Ninguém mentiu: os dois contaram fatos do mesmo evento. A ficha mostra que cada seleção " +
        "deixou de fora dois terços do que o feed tinha — e ela só existe depois do botão.",
    });

    // ═══ PROFESSORA libera a explicação; o estudante lê os 3 cards ═══════
    await apertar(prof, "explicacao");
    for (let card = 0; card < 2; card += 1) {
      /* A trava de 8s por card é da missão: o botão "Próximo" acende sozinho,
         e a espera corre contra ele (habilitado), nunca por tempo cego. */
      const proximo = q().getByRole("button", { name: /^Próximo/ }).first();
      await proximo.waitFor({ timeout: 30_000 });
      await p.waitForFunction(() => true);
      await proximo.click({ timeout: 15_000 });
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
    await q().locator("text=/Reflexão Individual/i").waitFor({ timeout: 20_000 });
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
    await q().locator("text=/Pronto! Sua resposta foi enviada/i").waitFor({ timeout: 20_000 });
    await q().getByRole("button", { name: /^Continuar/i }).click();

    /* As alternativas vêm EMBARALHADAS a cada leitura: casa-se por texto. */
    await q()
      .getByRole("button", { name: /Cuidado — eu só escolhi 3 posts/i })
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
    await q().locator("text=/Missão concluída!/").waitFor({ timeout: 20_000 });
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
    r.exigir(
      !/\b(pontos|nota|score|ranking)\b/i.test(folha),
      "a folha da turma não tem coluna de pontos",
    );
    r.exigir(/EF07CO11/.test(folha), "o painel de habilidades da BNCC aparece com a EF07CO11");
    await r.registrar(prof, "resultados-e-habilidades", {
      titulo: "A turma por computador, e as habilidades",
      mostra:
        "Quem publicou, o par de cada um, a distribuição das lentes da sala e o painel de " +
        "habilidades da BNCC da cobertura.",
      prova:
        "A legenda e a reflexão aparecem para a professora da turma, e para a gestão só " +
        "\"entregou\". O nível da EF07CO11 veio da enquete; a leitura da legenda por IA não " +
        "marcou nada porque em dev a IA é o mock — e \"Não avaliado\" é o que a regra manda.",
      inteira: true,
    });
  },
);
