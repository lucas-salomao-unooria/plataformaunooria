import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";
import { esperarFalasDoTema, provarFalasNaCriacao, provarPodcastNaAula } from "../lib/podcast.mjs";

/**
 * Jornal da Escola: A Edição de Bento (exp04ef1b), nas duas pontas da sala: a
 * professora cria a atividade e conduz, e dois estudantes da mesma turma editam.
 *
 * O que esta suíte cobra, e por que cada item é uma regra do software:
 *
 * 1. **A redação é da Unooria, e a peça imitada fala na voz de onde veio**
 *    (ADR-117, ADR-136): o post abre como o post do Unoovista, a mensagem como o
 *    balão do Unoochat — dentro da mesma gaveta da Unooria.
 * 2. **A pista desce do servidor** quando a criança a abre: o texto não está na
 *    sessão (é o registro que mede a EF15CO04).
 * 3. **Publicar é um latch, e o motivo vem DEPOIS dele**: o modal de publicar
 *    não pergunta nada, e a pergunta aparece só depois de a edição sair.
 * 4. **O resultado e a revisão são da professora** — UM botão que avança —, e
 *    chegam pelo polling (ADR-93). Um F5 no meio devolve a mesma tela, e antes
 *    do botão o resultado não existe nem pela api.
 * 5. **A Chave tem iscas**: a isca volta à bandeja, e a Chave só se forma com
 *    fonte, data e autoria.
 * 6. **A 2ª edição mostra o antes e o depois**, e o desafio final sai da
 *    redação, sem mostrar acerto.
 * 7. **O painel da professora não tem nota nem acerto por criança**: o número
 *    de verificadas só aparece no histograma anônimo, e as habilidades da BNCC
 *    ficam no painel de habilidades.
 *
 * O segundo estudante publica pela api (pelo BFF, com a sessão dele): o que a
 * suíte precisa dele é uma segunda edição no histograma, não as mesmas capturas
 * duas vezes.
 *
 * A IA é a DE VERDADE (Vertex, com o ADC válido): a suíte não roda contra o
 * mock. As imagens das notícias são geradas na criação e só vão à turma depois
 * do OK da professora (ADR-147) — sem todas aprovadas, a atividade não vai ao
 * ar, e a suíte prova o 409 antes de aprovar.
 *
 * A ATIVIDADE é da professora (ADR-130): a suíte a cria pelo assistente
 * ("Nova atividade" na ficha), com as oito notícias GERADAS PELA IA sobre um
 * tema da aula, um aluno por computador, e a põe no ar ao criar. A plataforma
 * não cria nada. Como o conteúdo muda a cada corrida, o que a criança escolhe
 * sai do GABARITO que a professora lê pela api (`N`, montado depois de criar):
 * o molde sorteado garante os oito meios, 3+ publicáveis, 2+ antigas e 1+ sem
 * fonte, então "1 de 3" e depois "3 de 3" sempre se montam.
 *
 * FIXTURE: a 4A (o seed libera a exp04ef1b lá). O estado é do servidor e
 * sobrevive ao roteiro. Criar de novo EXATAMENTE o pacote mais recente devolve
 * a mesma atividade; se ela já estava no ar (a corrida de ontem), a suíte zera
 * a turma na página da atividade — zerar abre a rodada seguinte sem apagar
 * nada. Atividade nova, ou que volta ao ar, já começa numa rodada nova.
 */
const SERIE = "4EF";
const EXP_ID = "exp04ef1b";
const FICHA = `${HUB}/professor/entre-redes/4-ano/unidade-1`;

/* A turma vem do CSV do seed, não fixada aqui. */
const PRIMEIRO = conta("estudante", { serie: SERIE });
const TURMA = process.env.TURMA ?? PRIMEIRO.turma;
const SEGUNDO = contasDe("estudante").find((c) => c.turma === PRIMEIRO.turma && c.login !== PRIMEIRO.login);
if (!SEGUNDO) throw new Error(`a turma ${TURMA} precisa de dois estudantes (rode o seed)`);

/** O tema que a IA recebe. Conteúdo novo a cada corrida: atividade nova, rodada 1. */
const PARAMETROS_DA_GERACAO = {
  disciplina: "Ciências",
  tema: "Água limpa e saúde no bairro",
  topicos: "Coleta de lixo na praça\nVacinação na escola\nHorta comunitária\nConsumo de água em casa",
};

/** A manchete como nome acessível do cartão, sem os metacaracteres de regex. */
const manchete = (texto) => new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

/**
 * As notícias que a criança escolhe, pelo GABARITO do pacote gerado (lido pela
 * professora em `GET /jornal-escola/turmas/:t/pacotes`) — nunca da tela:
 * `antiga` (pilar data) e `semFonte` (pilar fonte) com uma publicável dão a 1ª
 * edição com UMA verificada; trocar as duas por outras publicáveis dá três.
 * `post` e `mensagem` são as peças imitadas (cada meio aparece uma vez).
 */
const N = {};

/** O que nunca pode aparecer na tela da criança: carimbo, nota, acerto. */
const CARIMBO_OU_ACERTO = /\b(fake news|falsa|falso|mentira|errou|acertou|correta|incorreta|pontos|sua nota)\b/i;

/** A api pelo BFF do hub, com a sessão do navegador. */
async function lerApi(p, caminho) {
  const resposta = await p.request.get(`${BFF}${caminho}`);
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

async function mandarApi(p, caminho, dados) {
  const resposta = await p.request.fetch(`${BFF}${caminho}`, { method: "POST", data: dados ?? {} });
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

/**
 * PORTÃO DE HIDRATAÇÃO: em dev o HTML do SSR chega antes do bundle, e um
 * clique nesse intervalo é aceito pelo Playwright sem chamar handler nenhum.
 */
async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

await suite(
  {
    slug: "estudante/12-jornal-da-escola",
    papel: "estudante",
    titulo: "Jornal da Escola — a edição de Bento",
    subtitulo: "escolher três de oito notícias, ver o que os leitores sentiram, checar e publicar de novo",
    contexto:
      "A redação da escola recebeu oito notícias de oito meios, e a primeira página tem três vagas. A " +
      "criança escolhe, publica e só depois descobre o que os leitores viveram: uma oficina que já " +
      "passou, um aviso que ninguém assina. A Chave do Editor ensina a checar fonte, data e autoria, " +
      "e a segunda edição mostra o antes e o depois.",
    prova: [
      "A atividade nasce da professora, pelo assistente — a IA escreve as notícias, a professora aprova textos e imagens, e criar com “no ar agora” abre a turma",
      "O post abre no formato do Unoovista e a mensagem no do Unoochat, dentro da redação da Unooria",
      "A pista de fonte, data e autoria só existe depois que a criança a abre",
      "Publicar não pergunta nada; a pergunta de motivo vem depois do latch",
      "O resultado e a revisão chegam pelo botão único da professora, e a F5 volta à mesma tela",
      "A isca volta para a bandeja, e a Chave só se forma com fonte, data e autoria",
      "O comparativo mostra 1 de 3 na 1ª edição e 3 de 3 na 2ª",
      "O desafio final sai da redação e não mostra acerto",
      "O painel da professora não tem nota por criança, e as habilidades da BNCC aparecem",
    ],
    comando: "node scripts/e2e/estudante/12-jornal-da-escola.mjs",
  },
  async (r) => {
    /**
     * Aperta o botão da aula e espera a etapa nova no painel — e a hidratação,
     * porque depois de um reload o botão do SSR já está no DOM sem o handler.
     */
    const apertar = async (pagina, etapa) => {
      const botao = pagina.locator(`[data-gate="${etapa}"]`);
      await hidratado(pagina, botao);
      await pagina.waitForFunction(
        (sel) => {
          const b = document.querySelector(sel);
          return Boolean(b) && !b.hasAttribute("disabled");
        },
        `[data-gate="${etapa}"]`,
        { timeout: 15_000 },
      );
      await botao.click();
      await pagina.waitForSelector(`[data-etapa="${etapa}"]`, { timeout: 20_000 });
    };

    // ═══ PROFESSORA: a ficha, a criação da atividade e o painel ══════════
    const professora =
      contasDe("professor").find((c) => c.escola === PRIMEIRO.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login);

    const turmas = await lerApi(prof, "/jornal-escola/turmas");
    const turmaId = turmas.corpo?.turmas?.find((t) => t.nome === TURMA)?.id ?? null;
    if (!r.exigir(Boolean(turmaId), `${professora.login} vê a ${TURMA} no seletor do Jornal`)) return;

    /* O que a turma JÁ TEM no ar (ADR-130). Criar de novo EXATAMENTE o pacote
       mais recente é idempotente — devolve a mesma atividade —, e pôr no ar a
       que já está no ar não muda nada: é só nesse caso que o estado de ontem
       sobrevive e a turma precisa ser zerada. */
    const pacotesAntes = await lerApi(prof, `/jornal-escola/turmas/${turmaId}/pacotes`);
    if (pacotesAntes.status !== 200) {
      throw new Error(
        `a api não listou as atividades da ${TURMA} (HTTP ${pacotesAntes.status}): ${JSON.stringify(pacotesAntes.corpo).slice(0, 200)}`,
      );
    }
    const noArAntes = pacotesAntes.corpo?.ativo ?? null;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: /Jornal da Escola/ }).first().waitFor({ timeout: 30_000 });
    await prof.locator("[data-atividades-da-missao]").waitFor({ timeout: 20_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 4º ano",
      mostra:
        "A missão explicada para quem vai conduzir — as etapas, o preparo e os dois portões — e a lista " +
        "“Suas atividades com a turma”, com Nova atividade.",
      prova:
        "A professora sabe ANTES que o resultado e a revisão são ela quem libera — e que a missão só abre " +
        "com uma atividade dela em andamento: a plataforma não cria nada (ADR-130).",
    });

    /* NOVA ATIVIDADE pelo assistente: a turma já vem da ficha, a IA escreve as
       oito notícias sobre o tema da aula, um aluno por computador, e a
       atividade entra no ar ao criar. O `LinkButton` é um `<a>` com `role="button"` (o `Button`
       do DS polimórfico): pelo elemento, e não pelo papel. */
    await prof.locator("a", { hasText: "Nova atividade" }).first().click();
    await prof.waitForURL("**/atividades/nova**", { timeout: 30_000 });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 30_000 });
    await prof.locator("[data-passo-conteudo] [data-preparo-jornal]").waitFor({ timeout: 30_000 });
    r.exigir(
      (await prof.locator("[data-mesa-vazia]").count()) === 1 && (await prof.locator("[data-mesa-do-preparo]").count()) === 0,
      "a criação nasce VAZIA: nenhuma notícia na mesa antes de a professora escolher o ponto de partida",
    );

    /* A IA ESCREVE o pacote (gerar-conteudo, ~20 s com o Vertex): rascunho,
       que não grava nada. A prova é a RESPOSTA — `usouIa` e `origem: "ia"` —,
       não a tela: sem IA a api responde 429/503, e o banner oferece o banco. */
    const preparo = prof.locator("[data-preparo-jornal]");
    await prof.getByLabel("Componente Curricular").fill(PARAMETROS_DA_GERACAO.disciplina);
    await prof.getByLabel("Tema central da aula").fill(PARAMETROS_DA_GERACAO.tema);
    await prof.getByLabel("Tópicos prioritários para as 8 notícias").fill(PARAMETROS_DA_GERACAO.topicos);
    const gerarPacote = prof.locator('[data-acao="gerar-pacote"]');
    await hidratado(prof, gerarPacote);
    const respostaDaGeracao = prof.waitForResponse(
      (res) => /\/jornal-escola\/turmas\/[^/]+\/gerar-conteudo$/.test(new URL(res.url()).pathname) && res.request().method() === "POST",
      { timeout: 180_000 },
    );
    /* As falas do podcast são pedidas logo depois que a mesa chega (ADR-150):
       a espera nasce ANTES do clique, para não perder a resposta. */
    const respostaDasFalas = esperarFalasDoTema(prof, "exp04ef1b");
    await gerarPacote.click();
    const geracao = await respostaDaGeracao;
    const gerado = await geracao.json().catch(() => null);
    if (
      !r.exigir(
        geracao.status() === 200 && gerado?.usouIa === true && gerado?.origem === "ia",
        `a IA escreveu as oito notícias (gerar-conteudo ${geracao.status()}, usouIa=${gerado?.usouIa}, origem=${gerado?.origem}${gerado?.mensagem ? `: ${gerado.mensagem}` : ""})`,
      )
    )
      return;
    await esperarOuFalharCedo(
      prof.getByText(/^Pacote gerado\./),
      preparo.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "mostrar o pacote gerado pela IA" },
    );
    await prof.locator("[data-mesa-do-preparo]").waitFor({ timeout: 10_000 });
    const noticiasNaMesa = await prof
      .locator("[data-mesa-do-preparo] [data-noticia]")
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("data-noticia")));
    r.exigir(
      noticiasNaMesa.length === 8 && ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"].every((id) => noticiasNaMesa.includes(id)),
      `a mesa da criação tem as oito notícias geradas (${noticiasNaMesa.join(", ")})`,
    );
    await r.registrar(prof, "criacao-gerada-com-ia", {
      titulo: "O conteúdo da atividade: escrito pela IA",
      mostra:
        `O passo Conteúdo da criação com as oito notícias que a IA escreveu sobre “${PARAMETROS_DA_GERACAO.tema}”, ` +
        "para a professora ler e editar.",
      prova:
        "A IA escreve o pacote de verdade (Vertex): oito notícias de oito meios, com o gabarito, as pistas e a " +
        "consequência de cada uma, no molde sorteado no servidor. É rascunho: nada vai à turma sem o clique em Criar.",
      inteira: true,
    });
    /* O PODCAST na criação (ADR-150): a IA escreve as três falas que contam
       esta mesa, e a professora as revisa antes de aprovar. */
    await provarFalasNaCriacao(r, prof, await respostaDasFalas, {
      comIa: true,
      passo: "criacao-falas-do-podcast",
      titulo: "As falas do podcast, para revisar",
      mostra:
        "Abaixo da mesa, as três falas do podcast de recapitulação que contam esta atividade: a notícia antiga, " +
        "a reação a ela e o aviso sem assinatura.",
      prova:
        "A IA escreve as falas a partir das notícias da mesa (Vertex), e a professora as revisa e edita na criação: " +
        "elas vão na mesma aprovação dos textos. O resto do roteiro é o aprovado pela Unooria.",
    });
    const aprovarTextos = prof.locator('[data-acao="aprovar-textos"]');
    await prof.locator('[data-acao="aprovar-textos"]:not([disabled])').waitFor({ timeout: 20_000 }).catch(() => undefined);
    if (await aprovarTextos.isDisabled()) {
      const pendencias = await preparo.locator('[role="status"]').allInnerTexts();
      throw new Error(`a curadoria recusou o pacote gerado pela IA: ${pendencias.join(" | ").slice(0, 400)}`);
    }

    /* AS DUAS FASES DA APROVAÇÃO (ADR-147, o pedido do PO): os textos gravam o
       pacote e as imagens começam sozinhas; a professora vê cada uma, gera
       outra para a que não serve e aprova. O "Continuar" só acende depois. */
    const continuar = prof.locator('[data-acao="continuar-criacao"]');
    r.exigir(await continuar.isDisabled(), "antes de aprovar textos e imagens, o “Continuar” da criação fica apagado");
    await aprovarTextos.click();
    await esperarOuFalharCedo(
      prof.locator('[data-preparo-jornal][data-fase="imagens"] [data-imagens-do-pacote]'),
      prof.locator("[data-preparo-jornal]").locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "aprovar os textos e abrir a fase das imagens" },
    );
    const grade = prof.locator("[data-imagens-do-pacote]");
    const pacoteDaCriacao = await grade.getAttribute("data-pacote-das-imagens");
    /** Espera a geração parar: nenhuma imagem gerando nem faltando — e falha CEDO no aviso da grade. */
    const imagensProntas = async (oQue) => {
      const fim = Date.now() + 300_000;
      for (;;) {
        const pendentes = await grade.locator('[data-estado-da-imagem="gerando"], [data-estado-da-imagem="sem-imagem"]').count();
        if (pendentes === 0) return;
        const aviso = grade.locator(".unooria-feedback-alert--warning");
        if ((await aviso.count()) > 0 && (await grade.locator('[data-estado-da-imagem="gerando"]').count()) === 0) {
          throw new Error(`${oQue}: ${(await aviso.first().innerText()).trim()}`);
        }
        if (Date.now() > fim) throw new Error(`${oQue}: a geração não terminou em 5 minutos`);
        await prof.waitForTimeout(1_000);
      }
    };
    await imagensProntas("gerar as imagens das notícias (o ADC está válido?)");
    const cartoesDeImagem = grade.locator("[data-imagem-da-noticia]");
    const totalDeImagens = await cartoesDeImagem.count();
    r.exigir(totalDeImagens >= 4, `a fase 2 mostra uma imagem por notícia que pede imagem (${totalDeImagens})`);
    r.exigir(
      (await grade.locator("[data-imagem-da-noticia] img").count()) === totalDeImagens,
      "cada notícia que pede imagem aparece com a imagem gerada, grande, junto da manchete",
    );

    /* A atividade gravada ainda não vai ao ar: a api recusa sem o OK. */
    const jaAprovada = (await grade.getAttribute("data-imagens-aprovadas")) === "sim";
    if (pacoteDaCriacao && !jaAprovada && noArAntes?.id !== pacoteDaCriacao) {
      const recusa = await mandarApi(prof, `/jornal-escola/turmas/${turmaId}/pacotes/${pacoteDaCriacao}/em-andamento`);
      r.exigir(
        recusa.status === 409 && recusa.corpo?.codigo === "imagens-nao-aprovadas",
        `sem as imagens aprovadas, pôr no ar é recusado com 409 imagens-nao-aprovadas (veio ${recusa.status} ${recusa.corpo?.codigo ?? ""})`,
      );
    }
    await r.registrar(prof, "criacao-imagens", {
      titulo: "As imagens, antes da turma",
      mostra:
        "A fase 2 da criação: cada imagem gerada por IA grande, com o meio, a manchete e o que ela deveria " +
        "mostrar, o estado “Aguardando seu OK” e os botões “Gerar outra imagem” e “Aprovar”.",
      prova:
        "Nenhuma imagem gerada por IA chega à mesa das crianças sem o OK da professora (ADR-147, pedido do PO): " +
        "os textos já estão gravados, e a atividade não vai ao ar enquanto houver imagem sem aprovação.",
      inteira: true,
    });

    /* "Gerar outra imagem" troca SÓ aquela, que volta a esperar o OK. */
    const primeira = cartoesDeImagem.first();
    const idDaPrimeira = await primeira.getAttribute("data-imagem-da-noticia");
    const srcAntes = await primeira.locator("img").getAttribute("src");
    await primeira.locator('[data-acao="gerar-outra-imagem"]').click();
    const daPrimeira = grade.locator(`[data-imagem-da-noticia="${idDaPrimeira}"]`);
    await esperarOuFalharCedo(
      daPrimeira.locator(`img:not([src="${srcAntes}"])`),
      grade.locator(".unooria-feedback-alert--warning"),
      { timeout: 90_000, oQue: "gerar outra imagem para uma notícia" },
    );
    r.exigir(
      (await daPrimeira.getAttribute("data-estado-da-imagem")) === "aguardando",
      "a imagem gerada de novo volta a esperar o OK",
    );

    const aprovar = grade.locator('[data-acao="aprovar-imagens"]');
    await aprovar.click();
    await esperarOuFalharCedo(
      prof.locator('[data-imagens-do-pacote][data-imagens-aprovadas="sim"]'),
      grade.locator(".unooria-feedback-alert--warning"),
      { timeout: 30_000, oQue: "aprovar as imagens" },
    );
    r.exigir(!(await continuar.isDisabled()), "com textos e imagens aprovados, o “Continuar” acende");
    await r.registrar(prof, "criacao-imagens-aprovadas", {
      titulo: "Imagens aprovadas",
      mostra: "Todas as imagens com a etiqueta “Aprovada” e a barra cheia.",
      prova: "É esta aprovação que libera a atividade para ir ao ar — por imagem, e a que for trocada depois espera de novo.",
    });

    await continuar.click();
    /* Rádio do DS pelo PAPEL: o `<input>` transparente cobre o rótulo inteiro. */
    const umPorComputador = prof.getByRole("radio", { name: "Um aluno por computador", exact: true });
    await umPorComputador.click();
    r.exigir(await umPorComputador.isChecked(), "o passo de equipes marca “Um aluno por computador”");
    await r.registrar(prof, "criacao-equipes", {
      titulo: "As equipes, dentro da criação",
      mostra: "O passo Equipes: sortear, eu separo ou um aluno por computador — este, marcado.",
      prova: "A equipe é da atividade (ADR-130): a mesma turma pode sentar diferente em cada aula.",
    });

    await prof.locator('[data-acao="continuar-criacao"]').click();
    await prof.locator("[data-revisao-da-criacao]").waitFor({ timeout: 10_000 });
    /* "Pôr no ar agora" nasce desligado quando a turma já tem uma em andamento
       (a de uma corrida anterior): liga, para a turma entrar nesta. */
    /* O `<input>` do `Toggle` do DS é invisível de propósito (opacidade 0, sem
       ponteiro): espera-se o input no DOM e o toque vai como evento — o
       `onChange` do React escuta o `click`. Esperar `visible` estoura o tempo
       com o interruptor na tela (a receita da 10 e da 13). */
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    r.exigir(await noAr.isChecked(), "“Pôr esta atividade no ar agora” fica ligado");
    await r.registrar(prof, "criacao-revisar", {
      titulo: "Revisar e criar",
      mostra:
        "O último passo: a turma, o tema e as 8 notícias, um aluno por computador e o interruptor " +
        "“Pôr esta atividade no ar agora”, ligado.",
      prova:
        "Criar não põe no ar sozinho: a atividade nasce PRONTA, e é este interruptor que a torna a em " +
        "andamento. Desligado, ela espera na lista — e a aula que está rodando não muda.",
    });

    await prof.locator('[data-acao="criar-atividade"]').click();
    /* O desfecho é a PÁGINA DA ATIVIDADE em andamento; a corrida é contra o
       erro da criação e contra o aviso "A atividade foi criada" (criou, mas
       não entrou no ar), que ficam no passo final. */
    await esperarOuFalharCedo(
      prof.locator('[data-estado-da-atividade="em-andamento"]'),
      prof.locator("[data-revisao-da-criacao]").locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`),
      { timeout: 60_000, oQue: "criar a atividade e pô-la no ar" },
    );
    await prof.waitForURL("**/resultados?**pacote=**", { timeout: 30_000 });
    const atividadeId = new URL(prof.url()).searchParams.get("pacote");
    if (!r.exigir(Boolean(atividadeId), `a página da atividade leva o id dela na URL (${prof.url()})`)) return;
    await prof.locator(`[data-pacote="${atividadeId}"]`).waitFor({ timeout: 20_000 });
    await prof.locator('[data-imagens-do-pacote][data-imagens-aprovadas="sim"]').waitFor({ timeout: 20_000 });
    await prof.locator("[data-etapa]").waitFor({ timeout: 20_000 });
    const pacotesDepois = (await lerApi(prof, `/jornal-escola/turmas/${turmaId}/pacotes`)).corpo;
    r.exigir(
      pacotesDepois?.ativo?.id === atividadeId,
      "a atividade criada é a EM ANDAMENTO da turma (GET /jornal-escola/turmas/:turmaId/pacotes)",
    );
    r.exigir(pacotesDepois?.ativo?.origem === "ia", "a atividade em andamento é a escrita pela IA (origem ia)");

    /* O GABARITO da atividade gerada escolhe o que a criança faz (ver `N`). */
    const doPacote = pacotesDepois?.ativo?.noticias ?? [];
    const comPilar = (pilar) => doPacote.filter((n) => !n.gabarito.publicavel && n.gabarito.pilarEmFalta === pilar);
    const publicaveis = doPacote.filter((n) => n.gabarito.publicavel);
    const [antiga] = comPilar("data");
    const [semFonte] = comPilar("fonte");
    const post = doPacote.find((n) => n.meio === "rede_social");
    const mensagem = doPacote.find((n) => n.meio === "mensagem");
    if (
      !r.exigir(
        Boolean(antiga && semFonte && publicaveis.length >= 3 && post && mensagem),
        `o pacote gerado tem o molde que a missão garante (${publicaveis.length} publicáveis, antiga ${Boolean(antiga)}, sem fonte ${Boolean(semFonte)}, post ${Boolean(post)}, mensagem ${Boolean(mensagem)})`,
      )
    )
      return;
    Object.assign(N, {
      antiga: manchete(antiga.manchete),
      semFonte: manchete(semFonte.manchete),
      publicavel1: manchete(publicaveis[0].manchete),
      publicavel2: manchete(publicaveis[1].manchete),
      publicavel3: manchete(publicaveis[2].manchete),
      post: manchete(post.manchete),
      mensagem: manchete(mensagem.manchete),
    });
    const jaExistia = (pacotesAntes.corpo?.historico ?? []).some((h) => h.id === atividadeId);
    if (!jaExistia) {
      r.exigir(
        pacotesDepois?.ativo?.rodada === 1,
        `a atividade nova começa na 1ª rodada (veio ${pacotesDepois?.ativo?.rodada ?? "nada"})`,
      );
    }

    /* ZERAR só quando a atividade criada é a que JÁ estava no ar (a mesma de
       ontem, pela idempotência): o estado é do servidor e sobrevive ao
       roteiro, e sem isto a segunda execução encontra os estudantes já
       publicados, e o roteiro passa por cima do latch que ele existe para
       provar. Atividade nova começa na 1ª rodada; a que volta ao ar abre a
       seguinte — nas duas, a turma já está na exploração. O "Zerar" só existe
       na página da atividade em andamento — esta. */
    if (noArAntes?.id === atividadeId) {
      const rodada = noArAntes.rodada;
      const zerar = prof.locator("[data-zerar-turma]");
      await hidratado(prof, zerar);
      await zerar.click();
      await prof.getByRole("dialog").getByRole("button", { name: /Zerar a turma/ }).click();
      await esperarOuFalharCedo(
        prof.locator(`[data-pacote="${atividadeId}"]`, { hasText: `rodada ${rodada + 1} em andamento` }),
        prof.getByRole("dialog").locator(ALERTA_DE_ERRO),
        { timeout: 30_000, oQue: "zerar a turma" },
      );
      r.ressalva(
        `a atividade criada é a que já estava no ar (corrida anterior, mesmo banco pronto): a turma foi zerada para a ${rodada + 1}ª rodada`,
      );
    }
    await prof.waitForSelector('[data-etapa="exploracao"]', { timeout: 20_000 });
    await r.registrar(prof, "atividade-em-andamento", {
      titulo: "A atividade em andamento e o botão que move a sala",
      mostra:
        "A página da atividade criada: em andamento, as equipes (um aluno por computador), as imagens " +
        "aprovadas e o painel da aula com o botão único na exploração.",
      prova:
        "Criar com “Pôr no ar agora” abriu uma rodada nova desta atividade — o que só é possível com as " +
        "imagens aprovadas na criação (ADR-147). Trocar uma imagem aqui a tira da turma até o novo OK.",
      inteira: true,
    });

    // ═══ ESTUDANTE 1: o Bento e a mesa ════════════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    /* A DIAGRAMAÇÃO é IA em sala, com o modelo automático de reserva que a tela
       não mostra: a prova é a resposta do `POST /jornal-escola/diagramar`
       (direto à api, de dentro do iframe), que diz a `origem`. */
    const diagramacoes = [];
    p.on("response", (res) => {
      if (res.request().method() !== "POST" || !/\/jornal-escola\/diagramar$/.test(new URL(res.url()).pathname)) return;
      res
        .json()
        .then((corpo) => diagramacoes.push(corpo?.origem ?? `HTTP ${res.status()}`))
        .catch(() => diagramacoes.push(`HTTP ${res.status()}`));
    });
    await r.entrar(p, PRIMEIRO.login);
    await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    const q = () => p.frameLocator('iframe[data-experiencia]');
    /**
     * O painel da aba do DS entra com um fade (`unooria-tab-fade-in`, 0,2 s): a
     * captura logo depois da troca saía desbotada, e o deck mostrava uma tela
     * que ninguém vê. Espera o FIM das animações finitas — a infinita (um
     * girador) nunca termina e não entra na conta.
     */
    const semAnimacao = () =>
      q()
        .locator("body")
        .evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) => a.effect?.getTiming().iterations !== Infinity)
              .map((a) => a.finished.catch(() => undefined)),
          ),
        );
    const explorar = q().getByRole("button", { name: /Explorar Mesa de Notícias/ });
    await explorar.waitFor({ timeout: 40_000 });
    r.exigir(
      (await q().locator("text=/A redação recebeu 8 notícias/").count()) > 0,
      "o Bento apresenta a restrição: oito notícias, três vagas",
    );
    await r.registrar(p, "bento-e-a-restricao", {
      titulo: "Oito notícias, três vagas",
      mostra: "O Bento, a página vazia com as três vagas e o convite para a mesa.",
      prova: "A missão abre pelo trabalho do editor, sem dizer o que ele vai descobrir.",
    });

    await explorar.click();
    await q().locator("text=Pautas da Semana").first().waitFor({ timeout: 20_000 });
    r.exigir((await q().locator(".unooria-news-card").count()) === 8, "a mesa tem os oito cartões");
    r.exigir(
      (await q().locator(".unooria-news-card img").count()) >= 4,
      "as imagens aprovadas pela professora chegam aos cartões da mesa",
    );
    r.exigir((await q().locator("text=/Bento/").count()) === 0, "na mesa, o Bento fica calado");
    await semAnimacao();
    await r.registrar(p, "mesa-de-noticias", {
      titulo: "A mesa da redação",
      mostra: "Os oito cartões, cada um com o meio, a manchete e o resumo.",
      prova:
        "Nenhum cartão avisa que a notícia é velha ou anônima: a plataforma não antecipa a descoberta, " +
        "e notícia bonita não é sinal de nada.",
    });

    const cartao = (manchete) => q().getByRole("button", { name: manchete }).first();
    const gaveta = () => q().getByRole("dialog").first();
    const gavetaFechada = () => q().getByRole("dialog").waitFor({ state: "detached", timeout: 10_000 });
    const abrir = async (manchete) => {
      await cartao(manchete).click();
      await gaveta().waitFor({ timeout: 10_000 });
    };
    const voltarParaAMesa = async () => {
      await gaveta().getByRole("button", { name: /Voltar para a Mesa/ }).click();
      await gavetaFechada();
    };
    /** Abre a pista e ESPERA o desfecho: o botão da pista aberto (`aria-expanded`). */
    const abrirPista = async (rotulo) => {
      const pista = gaveta().getByRole("button", { name: new RegExp(`^${rotulo}`) }).first();
      await pista.click();
      await gaveta()
        .locator(`button[aria-expanded="true"]`, { hasText: rotulo })
        .first()
        .waitFor({ timeout: 10_000 });
    };
    const noJornal = async () => {
      await gaveta().getByRole("button", { name: /Adicionar ao Jornal/ }).click();
      await gavetaFechada();
    };
    const adicionar = async (manchete) => {
      await abrir(manchete);
      await noJornal();
    };

    // A peça imitada, na seção de onde veio.
    await abrir(N.post);
    r.exigir((await gaveta().locator(".unv-post-card").count()) === 1, "o post abre como o post do Unoovista");
    await r.registrar(p, "gaveta-post", {
      titulo: "O post, como post",
      mostra: "A gaveta da redação com a publicação de rede social desenhada como o Unoovista desenha.",
      prova:
        "A redação é da Unooria, mas a peça imitada fala na voz de onde veio (ADR-117): um post que " +
        "não parece post não ensina a reconhecer post.",
    });
    await voltarParaAMesa();

    await abrir(N.mensagem);
    r.exigir(
      (await gaveta().locator(".unc-messagebubble .unc-messagebubble__forwarded").count()) === 1,
      "a mensagem abre como o balão encaminhado do Unoochat",
    );
    await r.registrar(p, "gaveta-mensagem", {
      titulo: "A mensagem encaminhada",
      mostra: "O mesmo aviso no balão do Unoochat, com o selo de encaminhada, dentro da gaveta.",
      prova: "O balão recebido do Unoochat é branco, e vem num contêiner lavanda próprio para não sumir no branco da redação.",
    });
    await voltarParaAMesa();

    // As pistas: o texto só existe depois do toque.
    await abrir(N.antiga);
    const antesDaPista = await gaveta().innerText();
    for (const tipo of ["Fonte", "Data", "Autoria"]) await abrirPista(tipo);
    const depoisDaPista = await gaveta().innerText();
    r.exigir(depoisDaPista.length > antesDaPista.length, "abrir as pistas acrescenta o que o servidor revelou");
    await r.registrar(p, "pistas-abertas", {
      titulo: "Fonte, data e autoria",
      mostra: "A notícia antiga da mesa com as três pistas abertas.",
      prova:
        "O texto de cada pista desce do servidor no toque: abrir é o registro que mede a EF15CO04, e " +
        "uma pista lida sem registro seria evidência que a plataforma não vê.",
    });
    await noJornal();

    await abrir(N.publicavel1);
    for (const tipo of ["Fonte", "Data", "Autoria"]) await abrirPista(tipo);
    await noJornal();
    await adicionar(N.semFonte);

    // ═══ A primeira página e o latch ═════════════════════════════════════
    const aba = (nome) => q().getByRole("tab", { name: nome }).or(q().getByRole("button", { name: nome })).first();
    /** A aba está selecionada SEM o clique da suíte? É a transição automática que o PO pediu. */
    const selecionada = async (nome) => (await aba(nome).getAttribute("aria-selected")) === "true";
    /** Espera (até 5 s) a aba ficar selecionada SOZINHA: a troca vem com o fechar da gaveta, e ler na hora corre contra ela. */
    const ficaSelecionada = async (nome) => {
      for (let i = 0; i < 20; i += 1) {
        if (await selecionada(nome)) return true;
        await p.waitForTimeout(250);
      }
      return false;
    };

    /* 3/3: a mesa vai SOZINHA para a Primeira Página, onde está o publicar
       (ajuste do PO: a criança ficava presa nas pautas sem saber o passo). */
    await q().locator('[role="tab"][aria-selected="true"]', { hasText: "Primeira Página" }).waitFor({ timeout: 10_000 });
    r.exigir(await selecionada(/Primeira Página/), "com a 3ª notícia, a mesa passa sozinha para a Primeira Página");
    await semAnimacao();
    await r.registrar(p, "capa-cheia-vai-para-a-pagina", {
      titulo: "3 de 3: a página aparece sozinha",
      mostra: "Logo depois da terceira notícia, a aba “Primeira Página 3/3” aberta, com o botão de publicar.",
      prova:
        "A criança não precisa descobrir que o próximo passo mora em outra aba: a mesa a leva até lá, " +
        "e o foco vai para a aba da página.",
    });

    // A quarta: o aviso da capa cheia.
    await aba(/Pautas da Semana/).click();
    await abrir(N.publicavel2);
    r.exigir(
      (await q().locator("text=/A capa cabe só 3 matérias/").count()) > 0,
      "com a capa cheia, a quarta notícia não entra e a tela diz por quê",
    );
    await voltarParaAMesa();

    /** Espera o botão acender: ele fica desabilitado enquanto a redação monta a página. */
    const acesa = async (botao) => {
      await botao.waitFor({ timeout: 20_000 });
      for (let i = 0; i < 40 && (await botao.isDisabled()); i += 1) await p.waitForTimeout(250);
      r.exigir(!(await botao.isDisabled()), "depois da diagramação, o botão de publicar acende");
    };
    await aba(/Primeira Página/).click();
    const publicar1 = q().getByRole("button", { name: /Publicar 1ª Edição/ });
    await acesa(publicar1);
    /** A diagramação desta página veio da IA — e nenhuma caiu no modelo automático. */
    const diagramouComIa = async (oQue) => {
      for (let i = 0; i < 40 && diagramacoes.length === 0; i += 1) await p.waitForTimeout(250);
      r.exigir(
        diagramacoes.length > 0 && diagramacoes.every((o) => o === "ia"),
        `${oQue}: a IA diagramou a página (origens: ${diagramacoes.join(", ") || "nenhuma resposta"})`,
      );
      diagramacoes.length = 0;
    };
    await diagramouComIa("1ª edição");
    await semAnimacao();
    await r.registrar(p, "primeira-pagina", {
      titulo: "A página tomando forma",
      mostra: "A manchete principal e as duas secundárias, diagramadas.",
      prova:
        "A IA escolhe o layout, dentro de três modelos fechados — e a suíte confere na resposta que foi ela, " +
        "não o modelo automático que diagrama em silêncio quando ela falha.",
    });

    await publicar1.click();
    await q().getByText(/Confirmar Publicação da Capa/).first().waitFor({ timeout: 10_000 });
    r.exigir(
      (await q().locator("text=/Como as três matérias foram escolhidas/").count()) === 0,
      "o modal de publicar não pergunta o motivo: a pergunta antecipa a descoberta",
    );
    await r.registrar(p, "confirmar-publicacao", {
      titulo: "Publicar, sem volta",
      mostra: "A confirmação da 1ª edição: distribuir agora ou revisar mais.",
      prova: "É o latch da 1ª edição — e nenhuma pergunta antes dele.",
    });
    await q().getByRole("button", { name: /Distribuir Jornal Agora/ }).click();

    // ═══ O motivo, depois do latch ═══════════════════════════════════════
    await q().locator("text=/Como as três matérias foram escolhidas\\?/").first().waitFor({ timeout: 20_000 });
    r.exigir(
      (await q().locator("text=/dupla/").count()) === 0,
      "a pergunta não diz “dupla”: quantos dividem o computador é o professor quem decide",
    );
    await q().getByRole("radio", { name: /Escolhemos as fotos mais chamativas/ }).click();
    await r.registrar(p, "motivo", {
      titulo: "Como as três matérias foram escolhidas",
      mostra: "As duas respostas, a ingênua e a auditada, depois de a edição sair.",
      prova:
        "Perguntar depois do latch e antes do resultado: nem antecipa a descoberta, nem contamina a resposta.",
    });
    await q().getByRole("button", { name: /Enviar resposta/ }).click();
    await q().locator("text=Edição em Análise na Escola").first().waitFor({ timeout: 20_000 });

    await p.reload({ waitUntil: "domcontentloaded" });
    await q().locator("text=Edição em Análise na Escola").first().waitFor({ timeout: 40_000 });
    r.exigir(true, "a F5 depois de publicar volta à espera, não à mesa");
    await r.registrar(p, "espera-do-resultado", {
      titulo: "A edição com os leitores",
      mostra: "A espera neutra, com a página publicada em miniatura e as curiosidades da imprensa.",
      prova: "A criança não vê o resultado sozinha: quem abre é a professora, e a espera não dá pista.",
    });

    // ═══ ESTUDANTE 2: publica pela api, outra edição ═════════════════════
    const p2 = await r.pagina("estudante-2", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p2, SEGUNDO.login);
    await p2.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    await p2
      .frameLocator('iframe[data-experiencia]')
      .getByRole("button", { name: /Explorar Mesa de Notícias/ })
      .waitFor({ timeout: 40_000 });
    await mandarApi(p2, "/jornal-escola/passo", { para: "mesa" });
    const publicacao2 = await mandarApi(p2, "/jornal-escola/publicar", {
      slots: ["n4", "n6", "n7"],
      layout: "classic",
      origemDoLayout: "modelo",
    });
    r.exigir(publicacao2.status === 200, `o segundo estudante publica (veio ${publicacao2.status})`);
    await mandarApi(p2, "/jornal-escola/motivo", { motivo: "checagem" });
    r.provocado(/jornal-escola\/resultado/, "a suíte pede o resultado antes do portão, de propósito: a api recusa");
    const cedo = await lerApi(p2, "/jornal-escola/resultado");
    r.exigir(
      cedo.status === 409 && cedo.corpo?.codigo === "resultado-nao-liberado",
      "antes do botão da professora, o resultado não existe nem pela api",
    );

    // ═══ PROFESSORA libera o resultado ═══════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await apertar(prof, "resultado");
    await r.registrar(prof, "painel-resultado", {
      titulo: "O painel da aula",
      mostra: "Quantos computadores publicaram, o histograma anônimo de verificadas e o motivo da sala.",
      prova:
        "O número de verificadas só existe agregado, sem nome: não há ranking nem exposição de quem " +
        "errou. O botão diz a próxima etapa, e não pula nenhuma.",
      inteira: true,
    });

    await q().locator("text=/1 de 3 notícias verificadas nesta edição \\(33%\\)/").first().waitFor({ timeout: 30_000 });
    r.exigir((await q().locator(".unooria-speech-bubble").count()) >= 3, "cada notícia escolhida tem a reação de um leitor");
    r.exigir(!CARIMBO_OU_ACERTO.test(await q().locator("body").innerText()), "o resultado não carimba notícia nem criança");
    await r.registrar(p, "resultado-e-leitores", {
      titulo: "O que os leitores viveram",
      mostra: "O mural da escola com a reação de um leitor para cada notícia publicada, e o indicador de 1 de 3.",
      prova:
        "A consequência é das notícias que a criança ESCOLHEU (PDF, seção 7), e o percentual descreve a " +
        "seleção, não a criança. Nenhuma palavra de acerto.",
    });

    // ═══ PROFESSORA libera a revisão; a Chave do Editor ═════════════════
    await apertar(prof, "revisao");
    await q().locator("text=Ferramenta de Checagem do Bento").first().waitFor({ timeout: 30_000 });
    await r.registrar(p, "chave-do-editor", {
      titulo: "A Chave do Editor",
      mostra: "O Bento de volta, a calha com três vagas e os seis blocos da bandeja.",
      prova: "Três blocos são pilares e três são iscas, e nada na forma do bloco diz qual é qual.",
    });
    /* Pelo rótulo, sem caixa: a caixa alta é do CSS do `PuzzleBlock`, e o nome
       acessível é o texto do DOM (`Fonte`, `Foto`). */
    const bloco = (rotulo) => q().getByRole("button", { name: new RegExp(`^${rotulo}`, "i") }).first();
    await bloco("FOTO").click();
    await bloco("FONTE").click();
    await bloco("DATA").click();
    await q().locator("text=/Esse bloco não abre a chave/").first().waitFor({ timeout: 15_000 });
    r.exigir((await q().locator("text=Voltou para a bandeja").count()) > 0, "a isca volta para a bandeja");
    await r.registrar(p, "isca-devolvida", {
      titulo: "A isca volta",
      mostra: "A foto bonita devolvida à bandeja, e fonte e data presas na calha.",
      prova: "A Chave corrige no servidor, e cada envio conta: é das tentativas que sai a EF15CO02.",
    });
    await bloco("AUTORIA").click();
    await q().locator("text=/Chave do Editor ativada!/").first().waitFor({ timeout: 15_000 });

    // ═══ A revisão e a 2ª edição ═════════════════════════════════════════
    await q().getByRole("button", { name: /Abrir a Mesa de Revisão/ }).click();
    await q().locator("text=Mesa de Revisão Pericial").first().waitFor({ timeout: 20_000 });
    /* A revisão ABRE na Primeira Página: o aviso da Chave pede a troca, e o
       "Trocar Matéria" está lá (ajuste do PO). */
    r.exigir(await selecionada(/Primeira Página/), "a mesa de revisão abre direto na Primeira Página, sem clique");
    r.exigir(
      (await q().locator("text=/Troque os furos por matérias verificadas/").count()) > 0,
      "o aviso da Chave aparece junto da página que ele manda corrigir",
    );
    await q().locator("text=Fato que já passou").first().waitFor({ timeout: 15_000 });
    r.exigir((await q().locator("text=Fonte sem confirmação").count()) > 0, "a vaga do post sem fonte ganha o marcador");
    r.exigir((await q().locator("text=Matéria verificada").count()) > 0, "a vaga verificada fica marcada como verificada");
    await semAnimacao();
    await r.registrar(p, "mesa-de-revisao", {
      titulo: "A Chave marca as vagas",
      mostra: "A 1ª edição com um marcador em cada vaga: o fato que já passou, a fonte sem confirmação, a verificada.",
      prova: "Os marcadores só existem depois de a Chave se formar — antes disso o pilar em falta não desce.",
    });

    /* A 1ª edição foi [antiga, publicável, sem fonte]: troca a 1ª vaga (a
       antiga) e a 3ª (a sem fonte) por duas publicáveis. */
    const trocar = (i) => q().getByRole("button", { name: /Trocar Matéria/ }).nth(i);
    await trocar(0).click();
    await adicionar(N.publicavel2);
    r.exigir(await ficaSelecionada(/Primeira Página/), "a vaga preenchida de novo devolve a mesa à Primeira Página");
    await trocar(2).click();
    await adicionar(N.publicavel3);
    r.exigir(await ficaSelecionada(/Primeira Página/), "a segunda troca também volta sozinha à página");
    const publicar2 = q().getByRole("button", { name: /Publicar 2ª Edição Revisada/ });
    await acesa(publicar2);
    await diagramouComIa("2ª edição");
    await publicar2.click();
    await q().getByRole("button", { name: /Distribuir Jornal Agora/ }).click();

    await q()
      .locator("text=/1ª Edição: 1 de 3 verificadas ➔ 2ª Edição: 3 de 3 verificadas!/")
      .first()
      .waitFor({ timeout: 30_000 });
    r.exigir((await q().locator("text=/Agora sim!/").count()) > 0, "com as três verificadas, a comunidade agradece");
    await r.registrar(p, "comparativo", {
      titulo: "O antes e o depois",
      mostra: "As duas edições lado a lado, 1 de 3 e 3 de 3, e a reação da comunidade.",
      prova: "A devolutiva final mostra o efeito da checagem sobre os leitores, sem nota.",
    });

    // ═══ O desafio final, fora da redação ════════════════════════════════
    await q().getByRole("button", { name: /Avançar para Desafio Final/ }).click();
    await q().locator("text=Desafio Individual de Checagem").first().waitFor({ timeout: 20_000 });
    r.exigir((await q().locator("text=/Bento/").count()) === 0, "o desafio final sai da redação e não tem o Bento");
    /* As alternativas vêm EMBARALHADAS a cada leitura: casa-se pelo texto, pelo papel. */
    await q().getByRole("radio", { name: /canal oficial da prefeitura com data de hoje/ }).click({ timeout: 30_000 });
    await r.registrar(p, "desafio-final", {
      titulo: "O boato do corte de água",
      mostra: "A mensagem encaminhada, sem link, data nem autoridade, e a primeira pergunta.",
      prova: "A criança transfere o que aprendeu para um caso novo, individualmente; o gabarito fica no servidor.",
    });
    await q().getByRole("button", { name: /^Responder/ }).click();
    await q().getByRole("radio", { name: /Pode fazer a escola inteira parar/ }).click({ timeout: 30_000 });
    await q().getByRole("button", { name: /^Responder/ }).click();
    await q().locator("text=/Antes de repassar qualquer aviso/").first().waitFor({ timeout: 20_000 });
    r.exigir(!CARIMBO_OU_ACERTO.test(await q().locator("body").innerText()), "a síntese não diz se a criança acertou");
    await q().getByRole("button", { name: /Concluir Missão/ }).click();
    await q().locator("text=Edição Publicada — Modo Leitura").first().waitFor({ timeout: 20_000 });
    await r.registrar(p, "modo-leitura", {
      titulo: "Missão concluída",
      mostra: "As duas edições em modo leitura.",
      prova: "A síntese é a mesma para todos: a resposta às perguntas não diz à criança se ela acertou.",
    });

    // ═══ PROFESSORA: a folha por computador e as habilidades ═════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.getByText("EF15CO04").first().waitFor({ timeout: 30_000 });
    const folha = await prof.locator("main").innerText();
    /* Pelos CABEÇALHOS das colunas, não pelo texto da página: o painel explica
       à professora que o número "não é nota", e a frase que nega a nota não
       pode reprovar a suíte que prova a ausência dela. */
    const colunas = await prof.locator("main").getByRole("columnheader").allInnerTexts();
    r.exigir(colunas.length > 0, "a folha da turma está na tela, com as colunas");
    r.exigir(
      !colunas.some((c) => /\b(pontos|nota|score|ranking|acerto|verificadas)\b/i.test(c)),
      `a folha da turma não tem coluna de pontos (colunas: ${colunas.join(", ")})`,
    );
    r.exigir(
      ["EF04CO08", "EF15CO04", "EF15CO02"].every((codigo) => folha.includes(codigo)),
      "o painel de habilidades mostra as três habilidades da ficha",
    );
    await r.registrar(prof, "resultados-e-habilidades", {
      titulo: "A turma por computador, e as habilidades",
      mostra: "Quem publicou cada edição e formou a Chave, e o painel de habilidades da BNCC do pacote.",
      prova:
        "A folha diz só o progresso; o nível de cada habilidade vem das pistas, da Chave, da 2ª edição e " +
        "das duas perguntas, e fica no painel de habilidades, com o ajuste da professora.",
      inteira: true,
    });

    // ═══ PROFESSORA: o podcast de recapitulação ══════════════════════════
    await provarPodcastNaAula(r, prof, {
      blocos: ["Abertura", "Recapitulação da vivência", "A grande revelação", "Provocação e transferência", "Encerramento"],
      vozes: ["Lucas", "Clara"],
      trechos: 5,
      passo: "podcast",
      descricao: "Lucas e Clara, cerca de 3 min 30 s",
    });
  },
);
