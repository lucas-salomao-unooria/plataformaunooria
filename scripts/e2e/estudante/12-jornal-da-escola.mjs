import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp, vigiarFalhasDaApi } from "../lib/smoke.mjs";
import { esperarFalasDoTema, provarFalasNaCriacao, provarPodcastNaAula } from "../lib/podcast.mjs";
import { abrirAba, revelar, textoDeTodasAsAbas } from "../lib/abas.mjs";

/**
 * Jornal da Escola: A Edição de Bento (exp04ef1b 3.0.0, "Canal A puro",
 * ADR-168), nas duas pontas da sala: a professora cria a atividade e conduz, e
 * dois estudantes da mesma turma editam.
 *
 * O que esta suíte cobra, e por que cada item é uma regra do software:
 *
 * 1. **A redação é da Unooria, e a peça imitada fala na voz de onde veio**
 *    (ADR-117, ADR-136): o post abre como o post do Unoovista, a mensagem como o
 *    balão do Unoochat — dentro da mesma gaveta da Unooria.
 * 2. **A pista desce do servidor** quando a criança a abre, e logo abaixo dela
 *    vem o "✓ Confio / ✗ Não confio" (ADR-168): o PRIMEIRO julgamento vale — a
 *    marca não muda num segundo toque nem no F5. É o dado da EF15CO04.
 * 3. **Publicar é um latch, e o motivo vem DEPOIS dele**: o modal de publicar
 *    não pergunta nada, e a pergunta aparece só depois de a edição sair.
 * 4. **O resultado e a revisão são da professora** — UM botão que avança —, e
 *    chegam pelo polling (ADR-93). Um F5 no meio devolve a mesma tela, e antes
 *    do botão o resultado não existe nem pela api.
 * 5. **A Chave do Editor é MONTADA, num envio, sem correção**: três blocos,
 *    o lado de cada cartão, o "se falhar" e a repetição; o "Pronto" só acende
 *    completo, pede confirmação, e nada na tela diz se a Chave está certa.
 * 6. **A 2ª edição mostra o antes e o depois**; na revisão as pistas abrem SEM
 *    julgamento.
 * 7. **A Chave é TESTADA em duas matérias novas** (a simulação): a criança abre
 *    as pistas na ordem da Chave, marca cada uma (obrigatório aqui) e decide; a
 *    resposta é a mesma frase de referência para todos.
 * 8. **A transferência é um boato numa tela neutra**, com "Repassar" e "Não
 *    repassar" à mão desde o início — e a síntese não diz se acertou.
 * 9. **O painel da professora não tem nota nem acerto por criança**: o número
 *    de verificadas só aparece no histograma anônimo, a Chave e a mensagem nova
 *    só AGREGADAS no roteiro da conversa, e as habilidades da BNCC ficam no
 *    painel de habilidades — com os níveis que as réguas dão a esta jornada.
 *
 * A JORNADA do primeiro estudante é escolhida para as três habilidades
 * "atingiu" (as réguas de `apps/api/src/jornal-escola/regras/evidencia.ts`):
 * - EF15CO04: julga certo TODA pista que abre, cada tipo em ≥ 2 notícias, pega
 *   o furo de uma notícia antiga que fica FORA da capa, e não marca "não
 *   confio" em nenhuma notícia da capa. A capa da 1ª edição continua sendo
 *   [antiga, publicável, sem fonte] — a criança abriu delas só as pistas que
 *   passam —, para a revisão e o "1 de 3 ➔ 3 de 3" seguirem de pé;
 * - EF15CO02: a Chave certa (fonte, data, autoria; os seis cartões do lado
 *   certo; "Não publico" nas três; "em TODAS as notícias") e a simulação FIEL
 *   a ela;
 * - EF04CO08: a 2ª edição 3/3 com as três pistas de cada matéria abertas (as
 *   duas novas, na revisão), e no boato abre a fonte e não repassa.
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

/** Na Chave montada, nem correção nem nova tentativa: o que a 2.x dizia e a 3.0.0 não diz. */
const CORRECAO_DA_CHAVE = /(Voltou para a bandeja|Esse bloco não abre a chave|Chave do Editor ativada|tente de novo|nova tentativa|\bcerta\b|\berrada\b)/i;

/**
 * OS TEXTOS DE QUE A SUÍTE DEPENDE — copiados de
 * `apps/experiencias/exp04ef1b/src/lib/textos.ts` (e a frase de referência, de
 * `apps/api/src/jornal-escola/jornal-escola.service.ts#REGRA_DE_REFERENCIA`).
 * A suíte casa por TEXTO EXATO: mudar a copy lá sem mudar aqui reprova a e2e.
 */
const TXT = {
  abrindoPista: "Abrindo a pista…",
  julgar: "Você confia nesta pista?",
  veredito: { confio: "✓ Confio", nao_confio: "✗ Não confio" },
  marcado: (v) => `Marcado: ${v}`,
  motivo: { visual: "Escolhi porque chamou atenção", checagem: "Escolhi porque conferi as pistas" },
  chave: {
    titulo: "Ferramenta de Checagem do Bento",
    combinem: "Combinem antes de tocar.",
    bandeja: "Blocos periciais",
    escolhido: (rotulo) => `${rotulo} escolhido. Toque numa vaga para colocar.`,
    adicionar: "Adicionar na próxima vaga",
    colocarNaVaga: (rotulo, vaga) => `Colocar ${rotulo} na vaga ${vaga}`,
    cartao: (texto, exemplo) => `${texto} (ex.: ${exemplo})`,
    lado: { aprova: "A pista passa", reprova: "A pista falha" },
    seFalhar: "Se esta pista falhar:",
    naoPublico: "Não publico",
    repeticao: "Onde usar estes passos?",
    emTodas: "Usar estes passos em TODAS as notícias",
    pronto: "Pronto",
    falta: "Escolha os três blocos e marque todas as opções para terminar a Chave.",
    confirmarTitulo: "Enviar a Chave do Editor?",
    confirmarDescricao: "Depois de enviar, a Chave não muda.",
    enviar: "Enviar a Chave",
    montada: "Chave do Editor montada! A mesa de revisão está aberta.",
    irParaRevisao: "Abrir a Mesa de Revisão",
  },
  testarAChave: "Testar a minha Chave",
  sim: {
    titulo: "Teste da Chave do Editor",
    suaChave: "Sua Chave do Editor",
    seFalharNaoPublico: "Se falhar: Não publico",
    combinadoEmTodas: "Combinado: Usar estes passos em TODAS as notícias",
    materia: (n, total) => `Matéria ${n} de ${total}`,
    marqueParaSeguir: "Marque se você confia nesta pista para seguir.",
    decisao: { publicar: "Publicar", nao_publicar: "Não publicar" },
    referencia: "Para pensar",
    continuar: "Continuar",
    frase: "Bons editores olham a fonte, a data e quem escreveu — e param se uma delas falhar.",
  },
  boato: {
    titulo: "Chegou uma mensagem",
    oQueFazer: "O que você faz com esta mensagem?",
    repassar: "Repassar para o grupo",
    naoRepassar: "Não repassar",
    sintese:
      "Antes de repassar qualquer aviso, pare e procure a fonte, a data e o autor para não espalhar enganos na escola.",
    conversa: "Daqui a pouco, a turma vai conversar sobre esta mensagem com a professora.",
    concluir: "Concluir Missão",
  },
};

/** O lado da pista pelo gabarito da notícia — a regra de `regras/julgamentos.ts#vereditoCerto`. */
const vereditoCerto = (gabarito, tipo) => (!gabarito.publicavel && gabarito.pilarEmFalta === tipo ? "nao_confio" : "confio");

/** A ordem da Chave que a criança monta — é também a ordem em que a simulação abre as pistas. */
const ORDEM_DA_CHAVE = ["fonte", "data", "autoria"];
const ROTULO_DA_PISTA = { fonte: "Fonte", data: "Data", autoria: "Autoria" };

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

/** Lê a api até a condição valer — e falha com a última leitura, nunca com o relógio. */
async function esperarNaApi(p, caminho, condicao, { oQue, timeout = 20_000 } = {}) {
  const limite = Date.now() + timeout;
  let ultima = null;
  while (Date.now() < limite) {
    ultima = await lerApi(p, caminho);
    if (ultima.status >= 400) {
      throw new Error(`${oQue}: HTTP ${ultima.status} em ${caminho} — ${JSON.stringify(ultima.corpo).slice(0, 300)}`);
    }
    if (condicao(ultima.corpo)) return ultima.corpo;
    await p.waitForTimeout(500);
  }
  throw new Error(
    `${oQue}: a api não chegou ao estado esperado em ${timeout / 1000}s (última leitura: ${JSON.stringify(ultima?.corpo).slice(0, 300)})`,
  );
}

await suite(
  {
    slug: "estudante/12-jornal-da-escola",
    papel: "estudante",
    titulo: "Jornal da Escola — a edição de Bento",
    subtitulo:
      "julgar as pistas, escolher três de oito notícias, ver o que os leitores sentiram, montar a Chave, publicar de novo, testar a Chave e decidir sobre um boato",
    contexto:
      "A redação da escola recebeu oito notícias de oito meios, e a primeira página tem três vagas. A " +
      "criança abre as pistas e diz se confia em cada uma, escolhe, publica e só depois descobre o que os " +
      "leitores viveram. Ela monta a própria Chave do Editor, sem correção, refaz a capa, testa a Chave em " +
      "duas matérias novas e, numa tela neutra, decide o que faz com um boato.",
    prova: [
      "A atividade nasce da professora, pelo assistente — a IA escreve as oito notícias e as duas matérias da simulação, a professora aprova textos e imagens, e criar com “no ar agora” abre a turma",
      "O post abre no formato do Unoovista e a mensagem no do Unoochat, dentro da redação da Unooria",
      "A pista só existe depois que a criança a abre, e o “✓ Confio / ✗ Não confio” marcado não muda num segundo toque nem no F5",
      "Publicar não pergunta nada; a pergunta de motivo vem depois do latch",
      "O resultado e a revisão chegam pelo botão único da professora, e a F5 volta à mesma tela",
      "A Chave é montada num envio só: o “Pronto” só acende completo, pede confirmação e nada diz se ela está certa",
      "Na revisão as pistas abrem sem julgamento, e o comparativo mostra 1 de 3 na 1ª edição e 3 de 3 na 2ª",
      "Na simulação a criança segue a própria Chave, marca cada pista e recebe a mesma frase de referência que todos",
      "O boato chega numa tela neutra, com “Repassar” e “Não repassar” desde o início, e a síntese não mostra acerto",
      "O painel da professora não tem nota por criança, traz o roteiro agregado da Chave e as colunas “Teste da Chave” e “Fim da missão”, e as três habilidades chegam a “atingiu”",
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
    /* AS DUAS MATÉRIAS DA SIMULAÇÃO (3.0.0, ADR-168) vêm no MESMO rascunho da
       IA e aparecem abaixo da mesa, para a professora ler e editar como as oito. */
    r.exigir(
      Array.isArray(gerado?.simulacao) && gerado.simulacao.length === 2,
      `a IA escreveu as duas matérias da simulação junto das oito (${gerado?.simulacao?.length ?? 0})`,
    );
    const simulacaoNaCriacao = prof.locator("[data-simulacao-do-preparo]");
    await simulacaoNaCriacao.waitFor({ timeout: 10_000 });
    const materiasNaCriacao = await simulacaoNaCriacao
      .locator("[data-materia-da-simulacao]")
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("data-materia-da-simulacao")));
    r.exigir(
      materiasNaCriacao.length === 2 && ["s1", "s2"].every((id) => materiasNaCriacao.includes(id)),
      `abaixo da mesa, as duas matérias da simulação (${materiasNaCriacao.join(", ") || "nenhuma"})`,
    );
    r.exigir(
      (await simulacaoNaCriacao.getByText("As duas matérias para testar a Chave do Editor", { exact: true }).count()) === 1,
      "a faixa da simulação diz para que servem as duas matérias",
    );
    await r.registrar(prof, "criacao-gerada-com-ia", {
      titulo: "O conteúdo da atividade: escrito pela IA",
      mostra:
        `O passo Conteúdo da criação com as oito notícias que a IA escreveu sobre “${PARAMETROS_DA_GERACAO.tema}”, ` +
        "e, abaixo da mesa, as duas matérias em que a turma vai testar a Chave do Editor — para a professora ler e editar.",
      prova:
        "A IA escreve o pacote de verdade (Vertex): oito notícias de oito meios, com o gabarito, as pistas e a " +
        "consequência de cada uma, no molde sorteado no servidor, mais as duas matérias da simulação (uma " +
        "publicável, uma com furo). É rascunho: nada vai à turma sem o clique em Criar.",
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
    /* As imagens moram na aba Conteúdo e o painel, na Aula ao vivo (ADR-182). */
    await revelar(prof, prof.locator('[data-imagens-do-pacote][data-imagens-aprovadas="sim"]'));
    await prof.locator('[data-imagens-do-pacote][data-imagens-aprovadas="sim"]').waitFor({ timeout: 20_000 });
    await revelar(prof, prof.locator("[data-etapa]"));
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
    const [antiga, outraAntiga] = comPilar("data");
    const [semFonte] = comPilar("fonte");
    const post = doPacote.find((n) => n.meio === "rede_social");
    const mensagem = doPacote.find((n) => n.meio === "mensagem");
    if (
      !r.exigir(
        Boolean(antiga && outraAntiga && semFonte && publicaveis.length >= 3 && post && mensagem),
        `o pacote gerado tem o molde que a missão garante (${publicaveis.length} publicáveis, antigas ${comPilar("data").length}, sem fonte ${Boolean(semFonte)}, post ${Boolean(post)}, mensagem ${Boolean(mensagem)})`,
      )
    )
      return;
    Object.assign(N, {
      antiga: manchete(antiga.manchete),
      /* A antiga que a criança JULGA e deixa fora da capa: é o furo pego da EF15CO04. */
      outraAntiga: manchete(outraAntiga.manchete),
      gabaritoDaOutraAntiga: outraAntiga.gabarito,
      gabaritoDaAntiga: antiga.gabarito,
      gabaritoDaSemFonte: semFonte.gabarito,
      gabaritoDaPublicavel1: publicaveis[0].gabarito,
      semFonte: manchete(semFonte.manchete),
      publicavel1: manchete(publicaveis[0].manchete),
      publicavel2: manchete(publicaveis[1].manchete),
      publicavel3: manchete(publicaveis[2].manchete),
      post: manchete(post.manchete),
      mensagem: manchete(mensagem.manchete),
    });
    /* O gabarito das duas matérias da simulação, pela manchete (a tela da
       criança não o recebe): com ele a suíte marca cada pista como a criança
       que lê bem marcaria — e para no furo, como a Chave dela manda. */
    const simulacaoDoPacote = pacotesDepois?.ativo?.simulacao ?? [];
    r.exigir(
      simulacaoDoPacote.length === 2 && simulacaoDoPacote.filter((m) => m.gabarito?.publicavel).length === 1,
      `a atividade em andamento leva as duas matérias da simulação, uma publicável e uma com furo (${simulacaoDoPacote.length})`,
    );

    /* Os blocos da Chave com o lado CERTO de cada cartão: material do
       professor (`GET /jornal-escola/professor/material`) — a criança nunca o
       recebe. A suíte monta a Chave certa a partir dele, sem fixar a copy. */
    const material = await lerApi(prof, "/jornal-escola/professor/material");
    const pilares = (material.corpo?.blocos ?? []).filter((b) => b.pilar);
    if (
      !r.exigir(
        material.status === 200 && ORDEM_DA_CHAVE.every((id) => pilares.some((b) => b.id === id && b.cartoes?.length === 2)),
        `o material do professor traz os três pilares da Chave com os dois cartões (HTTP ${material.status})`,
      )
    )
      return;
    const pilar = (id) => pilares.find((b) => b.id === id);

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
      await revelar(prof, zerar);
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
    r.exigir(
      (await prof.locator("[data-simulacao-do-pacote] [data-materia-da-simulacao]").count()) === 2,
      "a página da atividade mostra, só para a professora, as duas matérias em que a turma testa a Chave",
    );
    await r.registrar(prof, "atividade-em-andamento", {
      titulo: "A atividade em andamento e o botão que move a sala",
      mostra:
        "A página da atividade criada, em andamento, com as cinco abas do template e a Aula ao vivo aberta: " +
        "o painel da aula com o botão único na exploração. As equipes, as imagens aprovadas e as duas " +
        "matérias da simulação estão nas abas Equipes e Conteúdo.",
      prova:
        "Criar com “Pôr no ar agora” abriu uma rodada nova desta atividade — o que só é possível com as " +
        "imagens aprovadas na criação (ADR-147). Trocar uma imagem aqui a tira da turma até o novo OK. As " +
        "matérias da simulação vêm com a etiqueta do gabarito: é a resposta, e por isso não se projeta.",
      inteira: true,
    });

    // ═══ ESTUDANTE 1: o Bento e a mesa ════════════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    /* As respostas 4xx/5xx da api ficam anotadas para o relatório: a missão
       renderiza falha em `<p>` avulso, e sem isto a causa some (lib/smoke.mjs). */
    const falhasDaApi = [];
    vigiarFalhasDaApi(p, falhasDaApi, "estudante");
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
    /** A resposta de uma rota da missão (o iframe fala direto com a api): a espera nasce ANTES do clique. */
    const respostaDe = (metodo, rota, timeout = 30_000) =>
      p.waitForResponse((res) => res.request().method() === metodo && rota.test(new URL(res.url()).pathname), { timeout });

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
    /**
     * A pista (o `RevealClue` do DS) pelo RÓTULO exato. O nome acessível do
     * gatilho junta rótulo e pergunta ("Fonte De onde veio?"), e na simulação o
     * bloco travado da Chave também se chama "Fonte": pelo rótulo do chip não
     * há ambiguidade.
     */
    const pistaEm = (raiz, tipo) =>
      raiz
        .locator(".unooria-reveal-clue")
        .filter({ has: q().locator(".unooria-reveal-clue__label", { hasText: new RegExp(`^${ROTULO_DA_PISTA[tipo]}$`) }) })
        .first();
    /** O painel da pista aberta, com o texto já na tela (não mais "Abrindo a pista…"). */
    const textoDaPista = (pista) => pista.locator(".unooria-reveal-clue__panel").filter({ hasNotText: TXT.abrindoPista });
    /**
     * Abre a pista e ESPERA o texto do servidor — correndo contra o `POST
     * pista`: se a api recusa, a tela só fecha o chip, sem alerta no DOM.
     */
    const abrirPista = async (tipo, raiz = gaveta()) => {
      const pista = pistaEm(raiz, tipo);
      const gatilho = pista.locator(".unooria-reveal-clue__trigger");
      if ((await gatilho.getAttribute("aria-expanded")) !== "true") await gatilho.click();
      await esperarOuFalharPorHttp(p, textoDaPista(pista), /\/jornal-escola\/pista$/, {
        timeout: 15_000,
        oQue: `abrir a pista ${ROTULO_DA_PISTA[tipo]}`,
      });
      return pista;
    };
    /** "✓ Confio" / "✗ Não confio" sob a pista aberta, e o desfecho: a marca que a api DEVOLVEU. */
    const julgar = async (pista, veredito) => {
      await pista
        .getByRole("group", { name: TXT.julgar })
        .getByRole("button", { name: TXT.veredito[veredito], exact: true })
        .click();
      await esperarOuFalharPorHttp(
        p,
        pista.getByText(TXT.marcado(TXT.veredito[veredito]), { exact: true }),
        /\/jornal-escola\/julgamento$/,
        { timeout: 15_000, oQue: `marcar “${TXT.veredito[veredito]}”` },
      );
    };
    /** Abre cada pista pedida e julga logo depois, pelo gabarito: é a criança que lê bem. */
    const abrirEJulgar = async (gabarito, tipos) => {
      for (const tipo of tipos) await julgar(await abrirPista(tipo), vereditoCerto(gabarito, tipo));
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

    // ═══ As pistas e o julgamento: o furo pego numa notícia fora da capa ═══
    await abrir(N.outraAntiga);
    const antesDaPista = await gaveta().innerText();
    r.exigir(
      (await gaveta().getByRole("group", { name: TXT.julgar }).count()) === 0,
      "com as pistas fechadas, não há o que julgar: o “Confio / Não confio” só nasce sob a pista aberta",
    );
    const fonteDaOutra = await abrirPista("fonte");
    r.exigir(
      (await fonteDaOutra.getByRole("group", { name: TXT.julgar }).getByRole("button").count()) === 2,
      "logo abaixo da pista aberta, os dois botões: “✓ Confio” e “✗ Não confio”",
    );
    await r.registrar(p, "pista-e-julgamento", {
      titulo: "Abrir a pista e dizer se confia",
      mostra: "A pista de fonte aberta, com o texto que o servidor revelou e, logo abaixo, “✓ Confio” e “✗ Não confio”.",
      prova:
        "O texto desce do servidor no toque (é o registro que a api exige antes de julgar), e o julgamento " +
        "vem ANTES da decisão da capa: julgado depois, ele viraria justificativa de uma escolha já feita. Os " +
        "dois botões têm o mesmo peso — nenhum é a resposta “esperada”.",
    });
    await julgar(fonteDaOutra, vereditoCerto(N.gabaritoDaOutraAntiga, "fonte"));
    await abrirEJulgar(N.gabaritoDaOutraAntiga, ["data", "autoria"]);
    const depoisDaPista = await gaveta().innerText();
    r.exigir(depoisDaPista.length > antesDaPista.length, "abrir as pistas acrescenta o que o servidor revelou");
    const furo = pistaEm(gaveta(), "data");
    r.exigir(
      (await furo.getByText(TXT.marcado(TXT.veredito.nao_confio), { exact: true }).count()) === 1 &&
        (await gaveta().getByRole("group", { name: TXT.julgar }).count()) === 0,
      "julgada, cada pista mostra a marca e os botões somem: a data da notícia antiga ficou “✗ Não confio”",
    );
    await r.registrar(p, "pistas-julgadas", {
      titulo: "Fonte, data e autoria, julgadas",
      mostra: "Uma notícia antiga da mesa com as três pistas abertas e a marca de cada uma — a data, “✗ Não confio”.",
      prova:
        "O veredito marcado é um Tag neutro, sem verde nem vermelho: a tela não diz se a criança acertou. É " +
        "o dado da EF15CO04, que a api corrige contra o gabarito na 1ª publicação.",
    });

    /* O PRIMEIRO julgamento vale: um segundo toque (a repetição da rede, outra
       aba) devolve o gravado com `novo: false`, e a tela segue com a marca. */
    const segundoToque = await mandarApi(p, "/jornal-escola/julgamento", {
      noticiaId: outraAntiga.id,
      tipo: "data",
      veredito: "confio",
    });
    r.exigir(
      segundoToque.status === 200 && segundoToque.corpo?.veredito === "nao_confio" && segundoToque.corpo?.novo === false,
      `um segundo julgamento da mesma pista não muda nada: a api devolve o primeiro (veio ${segundoToque.status} ${segundoToque.corpo?.veredito ?? ""} novo=${segundoToque.corpo?.novo})`,
    );
    await voltarParaAMesa();

    /* E o F5: a marca volta da api (`estado.julgamentos`), com a pista aberta. */
    await p.reload({ waitUntil: "domcontentloaded" });
    await q().locator("text=Pautas da Semana").first().waitFor({ timeout: 40_000 });
    await abrir(N.outraAntiga);
    const furoDepoisDoF5 = pistaEm(gaveta(), "data");
    await furoDepoisDoF5.getByText(TXT.marcado(TXT.veredito.nao_confio), { exact: true }).waitFor({ timeout: 10_000 });
    r.exigir(
      (await furoDepoisDoF5.locator(".unooria-reveal-clue__trigger").getAttribute("aria-expanded")) === "true" &&
        (await gaveta().getByRole("group", { name: TXT.julgar }).count()) === 0,
      "depois do F5, a pista reabre aberta, com a mesma marca e sem os botões",
    );
    await r.registrar(p, "julgamento-depois-do-f5", {
      titulo: "A marca não muda",
      mostra: "A mesma notícia depois de recarregar a página: as três pistas abertas, cada uma com a marca de antes.",
      prova:
        "Vale o primeiro julgamento de cada pista — nem o F5 nem um segundo toque o reescrevem (a suíte " +
        "mandou “confio” de novo pela api e ela devolveu o “não confio” gravado). Mudar de ideia depois não " +
        "reescreve a evidência.",
    });
    /* Fica FORA da capa: é a notícia em que ela não confiou. */
    await voltarParaAMesa();

    /* A capa da 1ª edição: [antiga, publicável, sem fonte] — das duas com furo
       ela abre só as pistas que passam (e as julga "confio", certo); da
       publicável, as três. Cada tipo fica julgado em ≥ 2 notícias, todo
       julgamento certo, o furo aberto pego, e nenhum "não confio" na capa. */
    await abrir(N.antiga);
    await abrirEJulgar(N.gabaritoDaAntiga, ["fonte", "autoria"]);
    await noJornal();

    await abrir(N.publicavel1);
    await abrirEJulgar(N.gabaritoDaPublicavel1, ORDEM_DA_CHAVE);
    await noJornal();

    await abrir(N.semFonte);
    await abrirEJulgar(N.gabaritoDaSemFonte, ["data", "autoria"]);
    await noJornal();

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
    await esperarOuFalharPorHttp(
      p,
      q().locator("text=/Como as três matérias foram escolhidas\\?/"),
      /\/jornal-escola\/publicar$/,
      { timeout: 20_000, oQue: "publicar a 1ª edição" },
    );
    r.exigir(
      (await q().locator("text=/dupla/").count()) === 0,
      "a pergunta não diz “dupla”: quantos dividem o computador é o professor quem decide",
    );
    r.exigir(
      (await q().getByRole("radio", { name: TXT.motivo.visual, exact: true }).count()) === 1 &&
        (await q().getByRole("radio", { name: TXT.motivo.checagem, exact: true }).count()) === 1,
      `as duas respostas com os rótulos da 3.0.0: “${TXT.motivo.visual}” e “${TXT.motivo.checagem}”`,
    );
    await q().getByRole("radio", { name: TXT.motivo.visual, exact: true }).click();
    await r.registrar(p, "motivo", {
      titulo: "Como as três matérias foram escolhidas",
      mostra: `As duas respostas — “${TXT.motivo.visual}” e “${TXT.motivo.checagem}” —, depois de a edição sair.`,
      prova:
        "Perguntar depois do latch e antes do resultado: nem antecipa a descoberta, nem contamina a resposta. " +
        "A pergunta não avalia nada: registra como a escolha foi feita.",
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
    /* A PAUSA (3.0.0): a missão cabe em uma ou em duas aulas, e o lugar de
       parar é aqui, antes de "Liberar revisão". */
    const pausa = prof.locator("[data-pausa]");
    await pausa.waitFor({ timeout: 10_000 });
    r.exigir(
      (await pausa.innerText()).includes("A missão cabe em uma ou em duas aulas."),
      "antes de “Liberar revisão”, o painel diz que a aula pode parar aqui e voltar pela Chave do Editor",
    );
    await r.registrar(prof, "painel-resultado", {
      titulo: "O painel da aula",
      mostra:
        "Quantos computadores publicaram, o histograma anônimo de verificadas, o motivo da sala e, antes de " +
        "“Liberar revisão”, a pausa: a missão cabe em uma ou em duas aulas.",
      prova:
        "O número de verificadas só existe agregado, sem nome: não há ranking nem exposição de quem " +
        "errou. O botão diz a próxima etapa, e não pula nenhuma — e o que cada computador fez fica salvo " +
        "se a aula acabar aqui.",
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

    // ═══ PROFESSORA libera a revisão; a Chave do Editor, MONTADA ══════════
    await apertar(prof, "revisao");
    await q().getByText(TXT.chave.titulo, { exact: true }).first().waitFor({ timeout: 30_000 });
    const pronto = q().getByRole("button", { name: TXT.chave.pronto, exact: true });
    const bandeja = q().getByRole("list", { name: TXT.chave.bandeja });
    await bandeja.waitFor({ timeout: 10_000 });
    r.exigir((await bandeja.getByRole("button").count()) === 6, "a bandeja tem os seis blocos: três pilares e três iscas");
    r.exigir(
      (await q().getByText(TXT.chave.combinem, { exact: true }).count()) === 1,
      "o lembrete da dupla aparece: “Combinem antes de tocar.”",
    );
    r.exigir(
      (await pronto.isDisabled()) && (await q().getByText(TXT.chave.falta, { exact: true }).count()) === 1,
      "com a Chave vazia, o “Pronto” fica desabilitado e a linha diz o que falta",
    );
    await r.registrar(p, "chave-do-editor", {
      titulo: "A Chave do Editor: o Montador",
      mostra: "O Bento de volta, a calha com três vagas ordenadas, os seis blocos da bandeja e o “Pronto” apagado.",
      prova:
        "Três blocos são pilares e três são armadilhas, e nada na forma do bloco diz qual é qual: quais são os " +
        "pilares, e o lado certo de cada cartão, ficam no servidor.",
    });

    /* Só toques: o bloco fica escolhido e vai para a vaga — "Adicionar na
       próxima vaga" ou o "Colocar aqui" de uma vaga. Ordem: fonte, data, autoria. */
    /* Pelo rótulo, sem caixa: a caixa alta é do CSS do `PuzzleBlock`. */
    const bloco = (rotulo) => bandeja.getByRole("button", { name: new RegExp(`^${rotulo}$`, "i") });
    await bloco("Fonte").click();
    await q().getByText(TXT.chave.escolhido("Fonte"), { exact: true }).first().waitFor({ timeout: 5_000 });
    await q().getByRole("button", { name: TXT.chave.adicionar, exact: true }).click();
    await bloco("Data").click();
    await q().getByRole("button", { name: TXT.chave.colocarNaVaga("Data", 2), exact: true }).click();
    await bloco("Autoria").click();
    await q().getByRole("button", { name: TXT.chave.adicionar, exact: true }).click();
    await q().getByRole("radiogroup", { name: TXT.chave.seFalhar, exact: true }).nth(2).waitFor({ timeout: 5_000 });
    r.exigir(
      await pronto.isDisabled(),
      "com os três blocos nas vagas e nenhuma opção marcada, o “Pronto” continua desabilitado",
    );

    /* Os dois cartões de cada pilar, do lado certo (pelo material do
       professor): a tela os mostra embaralhados, e o grupo se acha pelo texto. */
    for (const id of ORDEM_DA_CHAVE) {
      for (const c of pilar(id).cartoes) {
        const grupo = q().getByRole("radiogroup", { name: TXT.chave.cartao(c.texto, c.exemplo), exact: true });
        const lado = grupo.getByRole("radio", { name: TXT.chave.lado[c.lado], exact: true });
        await lado.click();
        r.exigir(await lado.isChecked(), `o cartão “${c.texto}” fica com “${TXT.chave.lado[c.lado]}”`);
      }
    }
    const seFalhar = q().getByRole("radiogroup", { name: TXT.chave.seFalhar, exact: true });
    r.exigir((await seFalhar.count()) === 3, "cada vaga cheia tem o seu “Se esta pista falhar:”");
    for (let i = 0; i < 3; i += 1) await seFalhar.nth(i).getByRole("radio", { name: TXT.chave.naoPublico, exact: true }).click();
    r.exigir(
      await pronto.isDisabled(),
      "falta só a repetição, e o “Pronto” ainda não acende: ele espera TODAS as escolhas",
    );
    await q()
      .getByRole("radiogroup", { name: TXT.chave.repeticao, exact: true })
      .getByRole("radio", { name: TXT.chave.emTodas, exact: true })
      .click();
    for (let i = 0; i < 20 && (await pronto.isDisabled()); i += 1) await p.waitForTimeout(250);
    r.exigir(!(await pronto.isDisabled()), "com os três blocos, os seis cartões, os três “se falhar” e a repetição, o “Pronto” acende");
    await semAnimacao();
    await r.registrar(p, "chave-montada-na-tela", {
      titulo: "A Chave, montada",
      mostra:
        "Fonte, data e autoria nas três vagas, cada cartão com “A pista passa” ou “A pista falha”, “Não publico” " +
        "nas três e “Usar estes passos em TODAS as notícias” — e o “Pronto” aceso.",
      prova:
        "O “Pronto” só acende com tudo escolhido. A criança diz quando cada pista passa ou falha, o que fazer " +
        "quando ela falha e se a regra vale para todas: é a Chave DELA, um algoritmo que ela vai testar depois.",
      inteira: true,
    });

    await pronto.click();
    const confirmacao = q().getByRole("dialog", { name: TXT.chave.confirmarTitulo });
    await confirmacao.waitFor({ timeout: 10_000 });
    r.exigir(
      (await confirmacao.getByText(TXT.chave.confirmarDescricao, { exact: true }).count()) === 1,
      "a confirmação avisa: “Depois de enviar, a Chave não muda.”",
    );
    await r.registrar(p, "chave-confirmar", {
      titulo: "Um envio, sem volta",
      mostra: "A janela “Enviar a Chave do Editor?”, com “Depois de enviar, a Chave não muda.”",
      prova: "A Chave vai à api UMA vez: sem correção, sem “devolvidos” e sem nova tentativa.",
    });
    const respostaDaChave = respostaDe("POST", /\/jornal-escola\/chave$/);
    await confirmacao.getByRole("button", { name: TXT.chave.enviar, exact: true }).click();
    await esperarOuFalharPorHttp(p, q().getByText(TXT.chave.montada, { exact: true }), /\/jornal-escola\/chave$/, {
      timeout: 20_000,
      oQue: "enviar a Chave do Editor",
    });
    const chaveEnviada = await respostaDaChave;
    const corpoDaChave = chaveEnviada.request().postDataJSON();
    r.exigir(
      JSON.stringify(corpoDaChave?.vagas?.map((v) => v.bloco)) === JSON.stringify(ORDEM_DA_CHAVE) &&
        corpoDaChave.vagas.every((v) => v.seFalhar === "parar" && v.lados?.[0] === "aprova" && v.lados?.[1] === "reprova") &&
        corpoDaChave.repeticao === "todas",
      `a tela manda a Chave na posição CANÔNICA dos cartões, mesmo os mostrando embaralhados (${JSON.stringify(corpoDaChave).slice(0, 240)})`,
    );
    const devolvido = await chaveEnviada.json().catch(() => null);
    r.exigir(
      devolvido !== null && Object.keys(devolvido).join(",") === "estado",
      `a resposta da Chave não diz se ela está certa: só o estado (chaves: ${Object.keys(devolvido ?? {}).join(", ")})`,
    );
    const textoDaChave = await q().locator("body").innerText();
    r.exigir(
      !CORRECAO_DA_CHAVE.test(textoDaChave) && !CARIMBO_OU_ACERTO.test(textoDaChave),
      "montada, a Chave não tem mensagem de certo ou errado, nem bloco devolvido, nem nova tentativa",
    );
    r.exigir(
      (await q().getByRole("button", { name: TXT.chave.pronto, exact: true }).count()) === 0,
      "depois do envio, não há “Pronto” de novo: a Chave não muda",
    );
    await r.registrar(p, "chave-montada", {
      titulo: "A Chave enviada",
      mostra: "“Chave do Editor montada! A mesa de revisão está aberta.”, os blocos travados e “Abrir a Mesa de Revisão”.",
      prova:
        "A tela não sabe se a Chave está certa — e não diz. A api a corrige campo a campo para a EF15CO02, e a " +
        "Chave errada também segue: ela é TESTADA na simulação, não corrigida aqui.",
    });

    // ═══ A revisão e a 2ª edição ═════════════════════════════════════════
    await q().getByRole("button", { name: TXT.chave.irParaRevisao, exact: true }).click();
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
      prova: "Os marcadores só existem depois de a Chave ser montada — antes disso o pilar em falta não desce.",
    });

    /* A 1ª edição foi [antiga, publicável, sem fonte]: troca a 1ª vaga (a
       antiga) e a 3ª (a sem fonte) por duas publicáveis — conferindo as três
       pistas de cada uma ANTES de pôr na capa (é a metade da EF04CO08). */
    const trocar = (i) => q().getByRole("button", { name: /Trocar Matéria/ }).nth(i);
    const conferirEAdicionar = async (manchete) => {
      await abrir(manchete);
      for (const tipo of ORDEM_DA_CHAVE) await abrirPista(tipo);
      r.exigir(
        (await gaveta().getByRole("group", { name: TXT.julgar }).count()) === 0,
        "na revisão, as pistas abrem SEM “Confio / Não confio”: o julgamento é só da mesa da 1ª edição",
      );
    };
    await trocar(0).click();
    await conferirEAdicionar(N.publicavel2);
    await r.registrar(p, "revisao-pistas-sem-julgamento", {
      titulo: "Conferir antes de trocar",
      mostra: "Na mesa de revisão, a gaveta de uma notícia nova com as três pistas abertas — e sem os botões de julgar.",
      prova:
        "A revisão registra a consulta da fase 2 (a api guarda cada pista por fase), e é dela que sai a 2ª " +
        "edição “conferida”: 3 de 3 só vale com as três pistas de cada matéria abertas.",
    });
    await noJornal();
    r.exigir(await ficaSelecionada(/Primeira Página/), "a vaga preenchida de novo devolve a mesa à Primeira Página");
    await trocar(2).click();
    await conferirEAdicionar(N.publicavel3);
    await noJornal();
    r.exigir(await ficaSelecionada(/Primeira Página/), "a segunda troca também volta sozinha à página");
    const publicar2 = q().getByRole("button", { name: /Publicar 2ª Edição Revisada/ });
    await acesa(publicar2);
    await diagramouComIa("2ª edição");
    await publicar2.click();
    await q().getByRole("button", { name: /Distribuir Jornal Agora/ }).click();

    await esperarOuFalharPorHttp(
      p,
      q().locator("text=/1ª Edição: 1 de 3 verificadas ➔ 2ª Edição: 3 de 3 verificadas!/"),
      /\/jornal-escola\/(republicar|comparativo)$/,
      { timeout: 30_000, oQue: "publicar a 2ª edição e abrir o comparativo" },
    );
    r.exigir((await q().locator("text=/Agora sim!/").count()) > 0, "com as três verificadas, a comunidade agradece");
    r.exigir(
      (await q().getByRole("button", { name: TXT.testarAChave, exact: true }).count()) === 1,
      "o comparativo leva ao “Testar a minha Chave”",
    );
    await r.registrar(p, "comparativo", {
      titulo: "O antes e o depois",
      mostra: "As duas edições lado a lado, 1 de 3 e 3 de 3, a reação da comunidade e “Testar a minha Chave”.",
      prova: "A devolutiva final mostra o efeito da checagem sobre os leitores, sem nota.",
    });

    // ═══ A simulação: a Chave DELA em duas matérias novas ════════════════
    await q().getByRole("button", { name: TXT.testarAChave, exact: true }).click();
    const materia = (n) => q().getByRole("region", { name: TXT.sim.materia(n, 2), exact: true });
    await esperarOuFalharPorHttp(p, materia(1), /\/jornal-escola\/(passo|simulacao)$/, {
      timeout: 20_000,
      oQue: "abrir a simulação da Chave",
    });
    r.exigir((await q().getByText(TXT.sim.titulo, { exact: true }).count()) > 0, "a tela se chama “Teste da Chave do Editor”");
    r.exigir((await q().locator("text=/Bento/").count()) === 0, "na simulação, o Bento fica calado: quem fala é a redação");
    const roteiro = q().getByRole("group", { name: TXT.sim.suaChave, exact: true });
    const rotulosDoRoteiro = await roteiro.locator(".unooria-puzzle-block__label").allInnerTexts();
    r.exigir(
      rotulosDoRoteiro.map((t) => t.trim().toLowerCase()).join(",") === ORDEM_DA_CHAVE.join(","),
      `a Chave dela aparece como roteiro, na ordem das vagas (${rotulosDoRoteiro.join(", ")})`,
    );
    r.exigir(
      (await roteiro.getByText(TXT.sim.seFalharNaoPublico, { exact: true }).count()) === 3 &&
        (await roteiro.getByText(TXT.sim.combinadoEmTodas, { exact: true }).count()) === 1,
      "o roteiro diz o “se falhar” de cada vaga e a repetição que ela escolheu",
    );

    /**
     * O gabarito da matéria na tela, pela manchete — vem do pacote da
     * professora. Sem ele (não deveria faltar), a criança confia em tudo e
     * continua fiel à Chave.
     */
    const gabaritoDaMateria = async (secao) => {
      const texto = await secao.innerText();
      return simulacaoDoPacote.find((m) => texto.includes(m.manchete))?.gabarito ?? { publicavel: true, pilarEmFalta: null };
    };
    /** Aplica a Chave: abre na ordem dela, marca cada pista, e para no primeiro "não confio". */
    const aplicarAChave = async (n) => {
      const secao = materia(n);
      await secao.waitFor({ timeout: 10_000 });
      const gabarito = await gabaritoDaMateria(secao);
      const passos = [];
      for (const tipo of ORDEM_DA_CHAVE) {
        const pista = pistaEm(secao, tipo);
        await pista.locator(".unooria-reveal-clue__trigger").click();
        await textoDaPista(pista).waitFor({ timeout: 10_000 });
        const veredito = vereditoCerto(gabarito, tipo);
        if (n === 1 && passos.length === 0) {
          /* A marcação é OBRIGATÓRIA aqui: com a pista esperando, nem outra
             pista abre nem a decisão acende. */
          const outra = pistaEm(secao, "data").locator(".unooria-reveal-clue__trigger");
          await outra.click();
          r.exigir(
            (await outra.getAttribute("aria-expanded")) === "false" &&
              (await secao.getByText(TXT.sim.marqueParaSeguir, { exact: true }).count()) === 1 &&
              (await secao.getByRole("button", { name: TXT.sim.decisao.publicar, exact: true }).isDisabled()) &&
              (await secao.getByRole("button", { name: TXT.sim.decisao.nao_publicar, exact: true }).isDisabled()),
            "na simulação, a pista aberta precisa da marca: outra pista não abre e “Publicar”/“Não publicar” ficam apagados",
          );
          await r.registrar(p, "simulacao-marcar-para-seguir", {
            titulo: "Testar a Chave numa matéria nova",
            mostra:
              "A Chave dela como roteiro (Fonte, Data, Autoria, “Se falhar: Não publico”), a 1ª matéria nova e a " +
              "pista de fonte aberta, com “Marque se você confia nesta pista para seguir.”",
            prova:
              "A ordem é a evidência, e a tela não a força: as três pistas ficam tocáveis. Mas, aberta, a pista " +
              "só deixa seguir marcada — é o que torna “seguiu a própria regra” sempre decidível na api.",
            inteira: true,
          });
        }
        await pista
          .getByRole("group", { name: TXT.julgar })
          .getByRole("button", { name: TXT.veredito[veredito], exact: true })
          .click();
        await pista.getByText(TXT.marcado(TXT.veredito[veredito]), { exact: true }).waitFor({ timeout: 5_000 });
        passos.push({ tipo, veredito });
        if (veredito === "nao_confio") break; // a Chave diz "Não publico": para aqui
      }
      const decisao = passos.some((x) => x.veredito === "nao_confio") ? "nao_publicar" : "publicar";
      return { secao, passos, decisao };
    };

    const primeiraMateria = await aplicarAChave(1);
    await primeiraMateria.secao.getByRole("button", { name: TXT.sim.decisao[primeiraMateria.decisao], exact: true }).click();
    const segundaMateria = await aplicarAChave(2);
    await r.registrar(p, "simulacao-segunda-materia", {
      titulo: "A Chave na segunda matéria",
      mostra: "A 2ª matéria com as pistas abertas na ordem da Chave e marcadas, antes da decisão.",
      prova:
        "Ela para onde a regra DELA manda: depois de um “não confio” numa vaga “Não publico”, não abre mais " +
        "nada e não publica. É a fidelidade à regra que a api mede, não o acerto do conteúdo.",
    });
    const respostaDaSimulacao = respostaDe("POST", /\/jornal-escola\/simulacao$/);
    await segundaMateria.secao.getByRole("button", { name: TXT.sim.decisao[segundaMateria.decisao], exact: true }).click();
    await esperarOuFalharPorHttp(p, q().getByText(TXT.sim.frase, { exact: true }), /\/jornal-escola\/simulacao$/, {
      timeout: 20_000,
      oQue: "enviar a simulação",
    });
    const simulacaoEnviada = await respostaDaSimulacao;
    const corpoDaSimulacao = simulacaoEnviada.request().postDataJSON();
    const esperadoDaSimulacao = [primeiraMateria, segundaMateria].map((m) => ({ passos: m.passos, decisao: m.decisao }));
    r.exigir(
      JSON.stringify((corpoDaSimulacao?.materias ?? []).map((m) => ({ passos: m.passos, decisao: m.decisao }))) ===
        JSON.stringify(esperadoDaSimulacao),
      `a simulação vai de uma vez, com as pistas NA ORDEM em que ela abriu e as marcas (${JSON.stringify(corpoDaSimulacao?.materias).slice(0, 300)})`,
    );
    const daSimulacao = await simulacaoEnviada.json().catch(() => null);
    r.exigir(
      daSimulacao?.referencia === TXT.sim.frase,
      `a resposta é a frase de referência, a MESMA para todos (“${daSimulacao?.referencia ?? "nada"}”)`,
    );
    r.exigir(
      (await q().getByText(TXT.sim.referencia, { exact: true }).count()) === 1 &&
        !CARIMBO_OU_ACERTO.test(await q().locator("body").innerText()),
      "a tela mostra “Para pensar” e a frase, sem comparar com a Chave dela nem dizer se acertou",
    );
    await r.registrar(p, "simulacao-referencia", {
      titulo: "A regra de referência",
      mostra: `“${TXT.sim.referencia}” e a frase: “${TXT.sim.frase}”`,
      prova:
        "A frase é igual para todos e desce só quando a medição já terminou: a Chave montada errada não sai da " +
        "aula reforçada, e a tela não diz a ninguém se a dele estava certa.",
    });

    // ═══ A transferência: o boato, numa tela neutra ══════════════════════
    await q().getByRole("button", { name: TXT.sim.continuar, exact: true }).click();
    const decisaoDoBoato = q().getByRole("group", { name: TXT.boato.oQueFazer, exact: true });
    await esperarOuFalharPorHttp(p, decisaoDoBoato, /\/jornal-escola\/transferencia$/, {
      timeout: 20_000,
      oQue: "abrir a mensagem nova",
    });
    r.exigir((await q().getByText(TXT.boato.titulo, { exact: true }).count()) > 0, "a tela se chama “Chegou uma mensagem”");
    r.exigir((await q().locator("text=/Bento/").count()) === 0, "o boato sai da redação e não tem o Bento");
    r.exigir((await q().locator(".unc-messagebubble").count()) === 1, "o boato chega no balão encaminhado do Unoochat");
    const repassar = decisaoDoBoato.getByRole("button", { name: TXT.boato.repassar, exact: true });
    const naoRepassar = decisaoDoBoato.getByRole("button", { name: TXT.boato.naoRepassar, exact: true });
    r.exigir(
      !(await repassar.isDisabled()) && !(await naoRepassar.isDisabled()),
      "“Repassar para o grupo” e “Não repassar” estão à mão desde o início, antes de qualquer pista",
    );
    r.exigir(
      (await q().locator('.unooria-reveal-clue__trigger[aria-expanded="true"]').count()) === 0,
      "as três pistas nascem fechadas, sem destaque: nada na tela pede para verificar",
    );
    await r.registrar(p, "boato", {
      titulo: "Chegou uma mensagem",
      mostra: "O boato encaminhado no balão do Unoochat, as três pistas fechadas e os dois botões, com o mesmo peso.",
      prova:
        "A tela é NEUTRA: sem fala de ninguém e sem pedir checagem. O que se mede é se a criança abre alguma " +
        "pista ANTES de decidir — à mão, como faria no grupo da turma.",
    });
    const fonteDoBoato = pistaEm(q().locator(".tela--escola"), "fonte");
    await fonteDoBoato.locator(".unooria-reveal-clue__trigger").click();
    await textoDaPista(fonteDoBoato).waitFor({ timeout: 10_000 });
    const respostaDoBoato = respostaDe("POST", /\/jornal-escola\/transferencia$/);
    await naoRepassar.click();
    await esperarOuFalharPorHttp(p, q().getByText(TXT.boato.sintese, { exact: true }), /\/jornal-escola\/transferencia$/, {
      timeout: 20_000,
      oQue: "decidir sobre o boato",
    });
    const corpoDoBoato = (await respostaDoBoato).request().postDataJSON();
    r.exigir(
      JSON.stringify(corpoDoBoato?.pistas) === JSON.stringify(["fonte"]) && corpoDoBoato?.decisao === "nao_repassar",
      `a decisão vai com as pistas abertas ANTES dela (${JSON.stringify(corpoDoBoato)})`,
    );
    r.exigir(
      (await q().getByText(TXT.boato.conversa, { exact: true }).count()) === 1 &&
        (await q().getByRole("button", { name: TXT.boato.repassar, exact: true }).count()) === 0,
      "decidido, a síntese e a conversa com a professora; os botões de decidir saem",
    );
    r.exigir(!CARIMBO_OU_ACERTO.test(await q().locator("body").innerText()), "a síntese não diz se a criança acertou");
    await r.registrar(p, "sintese", {
      titulo: "A síntese, a mesma para todos",
      mostra: "A pista de fonte aberta, a síntese única e o aviso da conversa com a turma — e o “Concluir Missão”.",
      prova: "A tela não sabe se a decisão “foi boa”, e não diz: a síntese é igual para quem repassou e para quem não.",
    });
    await q().getByRole("button", { name: TXT.boato.concluir, exact: true }).click();
    await q().locator("text=Edição Publicada — Modo Leitura").first().waitFor({ timeout: 20_000 });
    await r.registrar(p, "modo-leitura", {
      titulo: "Missão concluída",
      mostra: "As duas edições em modo leitura.",
      prova: "Nenhuma tela da missão mostrou nível, acerto ou nota: as habilidades ficam com a professora.",
    });
    if (falhasDaApi.length > 0) r.ressalva(`respostas 4xx/5xx da api durante a missão: ${falhasDaApi.join(" | ").slice(0, 400)}`);

    // ═══ PROFESSORA: a folha, o roteiro da Chave e as habilidades ═════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    /* As habilidades moram na aba Habilidades e a folha, na Aula ao vivo (ADR-182). */
    await revelar(prof, prof.locator("[data-habilidades-do-jornal]"));
    await prof.getByText("EF15CO04").first().waitFor({ timeout: 30_000 });
    const folha = await textoDeTodasAsAbas(prof, "atividade");
    await abrirAba(prof, "Aula ao vivo");
    /* Pelos CABEÇALHOS das colunas, não pelo texto da página: o painel explica
       à professora que o número "não é nota", e a frase que nega a nota não
       pode reprovar a suíte que prova a ausência dela. */
    const colunas = (await prof.locator("main").getByRole("columnheader").allInnerTexts()).map((c) => c.trim());
    r.exigir(colunas.length > 0, "a folha da turma está na tela, com as colunas");
    r.exigir(
      !colunas.some((c) => /\b(pontos|nota|score|ranking|acerto|verificadas)\b/i.test(c)),
      `a folha da turma não tem coluna de pontos (colunas: ${colunas.join(", ")})`,
    );
    r.exigir(
      ["Teste da Chave", "Fim da missão"].every((c) => colunas.includes(c)) && !colunas.includes("Desafio final"),
      `a folha tem “Teste da Chave” e “Fim da missão”, e não mais “Desafio final” (colunas: ${colunas.join(", ")})`,
    );
    const linhaDoPrimeiro = prof.locator("main tr", { hasText: PRIMEIRO.nome }).first();
    r.exigir(
      (await linhaDoPrimeiro.count()) === 1 && /testou/.test(await linhaDoPrimeiro.innerText()) && /concluiu/.test(await linhaDoPrimeiro.innerText()),
      `a linha de ${PRIMEIRO.nome} diz que testou a Chave e concluiu — só o progresso, sem nível`,
    );
    r.exigir(
      ["EF04CO08", "EF15CO04", "EF15CO02"].every((codigo) => folha.includes(codigo)),
      "o painel de habilidades mostra as três habilidades da ficha",
    );

    /* O ROTEIRO DA CONVERSA (3.0.0): a Chave e a mensagem nova, só AGREGADAS. */
    const roteiroDaConversa = prof.locator("[data-roteiro-da-chave]");
    await roteiroDaConversa.waitFor({ timeout: 20_000 });
    r.exigir(
      (await prof.getByText("Roteiro da conversa: a Chave e a mensagem nova", { exact: true }).count()) === 1,
      "o painel tem o card “Roteiro da conversa: a Chave e a mensagem nova”",
    );
    r.exigir(
      (await roteiroDaConversa.locator("[data-iscas-da-chave]").innerText()).includes(
        "Nenhuma Chave usou foto, urgência ou compartilhamento como critério.",
      ),
      "a única Chave montada nesta rodada não tem armadilha, e o roteiro diz isso sem nome",
    );
    r.exigir(
      (await roteiroDaConversa.locator("[data-repassaram-sem-abrir]").innerText()).trim().startsWith("0 "),
      "ninguém repassou a mensagem sem abrir pista — o número vem agregado, sem nome",
    );
    r.exigir(
      !CARIMBO_OU_ACERTO.test(await roteiroDaConversa.innerText()) && (await roteiroDaConversa.getByText(PRIMEIRO.nome).count()) === 0,
      "o roteiro não tem nome de criança nem palavra de acerto",
    );
    await roteiroDaConversa.scrollIntoViewIfNeeded();
    await r.registrar(prof, "roteiro-da-chave", {
      titulo: "O roteiro da conversa: a Chave e a mensagem nova",
      mostra:
        "O card com as armadilhas mais escolhidas na Chave, quantos puseram “Olho a próxima pista” ou “Só na " +
        "primeira notícia”, e o que a turma fez com a mensagem nova.",
      prova:
        "São as escolhas da turma somadas, sem nome e sem nível, para puxar a conversa do fechamento — o que " +
        "cada criança pôs na Chave ou decidiu diante do boato não aparece na folha.",
    });

    /* OS NÍVEIS desta jornada (`regras/evidencia.ts`): as três "atingiu". */
    const rodadaAgora = (await lerApi(prof, `/jornal-escola/turmas/${turmaId}/pacotes`)).corpo?.ativo?.rodada;
    const doEstudante = (c) => c?.estudantes?.find((e) => e.nome === PRIMEIRO.nome);
    const esperado = { EF15CO04: "atingiu", EF15CO02: "atingiu", EF04CO08: "atingiu" };
    const habilidades = await esperarNaApi(
      prof,
      `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`,
      (c) => Object.keys(doEstudante(c)?.porRodada?.[String(rodadaAgora)] ?? {}).length >= Object.keys(esperado).length,
      { oQue: "as três marcas do primeiro estudante na evidência" },
    );
    r.exigir(habilidades.temFicha === true, "a exp04ef1b tem ficha pedagógica: o bloco de habilidades acende");
    const marcas = doEstudante(habilidades).porRodada[String(rodadaAgora)];
    const motivoDoNivel = {
      EF15CO04: "julgou certo cada tipo de pista em 2+ notícias, pegou o furo e não pôs na capa a notícia em que não confiou",
      EF15CO02: "Chave certa e simulação fiel a ela",
      EF04CO08: "2ª edição 3/3 com as três pistas de cada matéria, e no boato abriu a fonte e não repassou",
    };
    for (const [codigo, nivel] of Object.entries(esperado)) {
      r.exigir(
        marcas[codigo]?.status === nivel,
        `${codigo}: o painel registra “${marcas[codigo]?.status ?? "nada"}”, e a régua dá “${nivel}” (${motivoDoNivel[codigo]})`,
      );
    }
    await r.registrar(prof, "resultados-e-habilidades", {
      titulo: "A turma por computador, e as habilidades",
      mostra:
        "Quem publicou cada edição, montou e testou a Chave e chegou ao fim da missão, e o painel de habilidades " +
        "da BNCC do pacote.",
      prova:
        "A folha diz só o progresso; o nível de cada habilidade vem só de AÇÕES — o “confio / não confio” da " +
        "mesa, a Chave montada e testada, a 2ª edição e a decisão diante do boato — e fica no painel de " +
        "habilidades, com o ajuste da professora.",
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
