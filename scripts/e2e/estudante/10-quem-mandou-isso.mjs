import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { esperarFalasDoTema, provarFalasNaCriacao, provarPodcastNaAula } from "../lib/podcast.mjs";
import { revelar } from "../lib/abas.mjs";

/**
 * Quem mandou isso? v2.2 (exp05ef1b, 0.6.0 — só o Canal A), nas duas pontas da sala: a professora
 * cria a atividade e conduz, o estudante joga. Dois contextos de navegador, porque
 * metade do que a missão instala só se prova com as duas telas vivas.
 *
 * O que esta suíte cobra, e por que cada item é uma regra do software:
 *
 * 1. **A missão NASCE VAZIA** (a fala da Nina leva o tema do pacote). Sem uma
 *    atividade da professora EM ANDAMENTO a lista de conversas fica vazia — e,
 *    na corrida em que a turma ainda não tem nenhuma no ar, o estudante vê a
 *    Nina chegar SOZINHA, pelo polling, quando a professora cria a atividade
 *    com "Pôr esta atividade no ar agora" (ADR-130: a plataforma não cria
 *    atividade, e criar não põe no ar sozinho).
 * 2. **O gabarito não desce antes da hora.** A sessão do estudante é lida
 *    CRUA (pelo BFF, com a sessão dele) antes de entrar, depois do voto e só
 *    então depois da revelação: as mensagens nunca têm `veracidade` nem `tom`,
 *    e `revelacao` é `null` até o voto E o botão da professora.
 * 3. **Exatamente 3, e o Mural é um latch.** A quarta seta FALA (o aviso de
 *    limite) sem abrir a folha; o servidor recusa 4 e recusa 2; confirmado, o
 *    Mural não muda mais — nem pela tela, nem por chamada direta.
 * 4. **Os três botões chegam por polling HTTP** (ADR-93): revelação, síntese
 *    e reflexão trocam a tela do estudante SEM recarregar. E um F5 no meio
 *    devolve a mesma tela, porque o passo é do servidor.
 * 5. **O alerta do grupo vem com os crachás** (EF05CO03): no fim do Mural
 *    revelado, o quadro das 8 mensagens com os dois crachás e 4 pedidos, um
 *    por vez. A criança monta um filtro (chips NÃO, Falsa, Emocional, E, OU),
 *    toca "Ver resultado" — o SERVIDOR executa — e envia o alerta, que vira
 *    bolha enviada no grupo. Os pedidos descem SEM a expressão esperada; a
 *    suíte a sabe à parte (o oráculo abaixo), acerta três de primeira e
 *    corrige o 2º depois de ver o resultado (7 de 8 pontos: atingiu).
 * 6. **A reflexão é o robô do grupo, na casca** (EF05CO04): blocos
 *    (`PuzzleBlock`/`PuzzleTrack`) com o laço opcional, SE, ENTÃO e E
 *    DEPOIS. A suíte liga primeiro SEM o laço ("O robô tratou 1 das 4
 *    mensagens."), encaixa o laço, liga de novo e envia — e a missão fecha
 *    sozinha. A régua lê a 1ª ligação: em processo.
 * 7. **Nenhum acerto chega à criança.** Quem sabe o nível é a professora, no
 *    bloco "Habilidades da BNCC" — e a suíte confere que o nível dali é o que
 *    a régua dá: as 3 escolhidas (EF05CO08), os 4 alertas (EF05CO03, atingiu)
 *    e o robô que só ganhou o laço depois de ligado (EF05CO04, em processo),
 *    em TODA rodada, e que o critério de cada nível está escrito no fim do
 *    bloco. As perguntas P1/P2 saíram: a rota delas responde 404.
 * 8. **O Termômetro não tem nome**, nem no painel nem no telão.
 *
 * A IA é a DE VERDADE (Vertex, com o ADC válido): a suíte cria a atividade
 * pelo assistente ("Nova atividade" na ficha) apertando "Gerar Atividade com
 * IA", e exige `usouIa` na resposta — sem IA a api devolveria 200 com o pacote
 * curado, em silêncio. As escolhas da criança não dependem do conteúdo: o
 * gabarito vem da rota do professor.
 *
 * FIXTURE: a turma A do 5º ano (o seed libera a exp05ef1b lá). O estado é do
 * servidor e sobrevive ao roteiro, então a suíte começa pelo que a turma TEM.
 * Criar de novo EXATAMENTE o pacote mais recente é idempotente (a mesma
 * atividade, o mesmo id): na corrida de ontem a atividade criada agora é a
 * mesma, e se ela já estava em andamento e a turma andou, a suíte aperta
 * "Zerar Turma para Nova Aplicação" na página da atividade, que abre a rodada
 * seguinte sem apagar nada. Uma atividade que volta ao ar (estava pronta) ou
 * que nasce agora já começa numa rodada nova, e zerar não é preciso.
 */
/** O boato que a IA recebe (até 8 palavras) e os fatos da aula, um por linha. */
const TEMA_DA_GERACAO = "Boato da merenda cancelada na escola";
const FATOS_DA_GERACAO = "A merenda continua normal\nA nutricionista visitou a cozinha\nO cardápio novo sai na sexta";

const SERIE = "5EF";
const EXP_ID = "exp05ef1b";
/* A turma vem do CSV do seed, não fixada aqui: um roteiro que fixa o nome
   falha com "timeout esperando option" quando o seed renomeia — um sintoma que
   não aponta para a causa. */
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;
const FICHA = `${HUB}/professor/entre-redes/5-ano/unidade-1`;

/** Rótulos dos crachás, como a experiência os escreve (`textos.ts`). */
const ROTULO_DA_VERACIDADE = { verdadeira: "Verdadeira", falsa: "Falsa" };
const ROTULO_DO_TOM = { emocional: "Emocional", neutra: "Neutra" };

/** O que nunca pode aparecer na tela da criança: nível, acerto, nota. */
const PALAVRAS_DE_ACERTO = /\b(atingiu|em processo|n[aã]o atingiu|acertou|acertei|errou|errada|correta|incorreta|pontos|nota)\b/i;

/**
 * A régua da EF05CO08 (a v2, ADR-120), escrita AQUI de novo, à parte da api:
 * é o oráculo contra o qual a suíte confere o nível que o painel da
 * professora mostra. Se as duas divergirem, uma das duas mudou sem a outra.
 * Só três verdadeiras atingem; uma falsa, de qualquer tipo, é em processo.
 */
function nivelEsperadoCO08(escolhidas) {
  const falsas = escolhidas.filter((m) => m.veracidade === "falsa").length;
  if (falsas === 0) return "atingiu";
  if (falsas === 1) return "em_processo";
  return "nao_atingiu";
}

/**
 * O ORÁCULO do alerta, à parte da api (`regras/alerta.ts`): a expressão
 * esperada de cada pedido, na ordem. A tela nunca a recebe — a suíte a sabe
 * daqui, como o guia da professora a mostra.
 */
const F = (nao = false) => ({ attr: "falsa", nao });
const EMO = (nao = false) => ({ attr: "emocional", nao });
const PEDIDOS_ESPERADOS = [
  { a: F(), op: "E", b: EMO() },
  { a: F(), op: "OU", b: EMO(true) },
  { a: F(true), op: "OU", b: EMO() },
  { a: F(true), op: "E", b: EMO(true) },
];
/** O filtro errado que a suíte tenta primeiro no 2º pedido: "Falsa OU Emocional". */
const FILTRO_ERRADO = { a: F(), op: "OU", b: EMO() };

/** A mensagem passa no filtro? — sobre os crachás (o gabarito da rota da professora). */
function passaNoFiltro(e, m) {
  const valor = (c) => (c.attr === "falsa" ? m.veracidade === "falsa" : m.tom === "emocional") !== c.nao;
  const a = valor(e.a);
  if (!e.op) return a;
  return e.op === "E" ? a && valor(e.b) : a || valor(e.b);
}

/** A régua da EF05CO03, à parte da api (`regras/alerta.ts#nivelCO03`): 6–8 pontos atingem, 3–5 em processo. */
function nivelEsperadoCO03(pontos) {
  if (pontos >= 6) return "atingiu";
  if (pontos >= 3) return "em_processo";
  return "nao_atingiu";
}

/**
 * A régua da EF05CO04, à parte da api (`regras/robo.ts#nivelCO04`), para os
 * robôs desta suíte (que checam antes de encaminhar): atinge só com laço +
 * "urgente e alarmante" já na PRIMEIRA ligação.
 */
function nivelEsperadoCO04(ligacoes, enviado) {
  const completo = (r) => r?.laco === true && r?.condicao === "urgente_alarmante";
  return completo(enviado) && completo(ligacoes[0]) ? "atingiu" : "em_processo";
}

/** O que o robô escreve em cada mensagem (`regras/robo.ts#TEXTO_DA_SITUACAO`) — o oráculo dos cards. */
const TEXTO_DA_SITUACAO = {
  nao_olhou: "O robô não olhou esta mensagem",
  passou: "Passou direto: a regra não pegou",
  checa: "Checou antes de encaminhar",
};

const normalizar = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

/** A api pelo BFF do hub, com a sessão do navegador (APIRequestContext divide os cookies do contexto). */
async function lerApi(p, caminho) {
  const resposta = await p.request.get(`${BFF}${caminho}`);
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

async function mandarApi(p, metodo, caminho, dados) {
  const resposta = await p.request.fetch(`${BFF}${caminho}`, { method: metodo, data: dados ?? {} });
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

/**
 * Espera a API chegar a um estado, e PERDE A CORRIDA para um erro dela: um 4xx
 * ou 5xx reprova na hora, com o corpo na mensagem. A pausa entre as leituras é
 * ritmo de sondagem, não espera de desfecho — o desfecho é a condição.
 */
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

/**
 * PORTÃO DE HIDRATAÇÃO: em dev o HTML do SSR chega antes do bundle, e um
 * clique nesse intervalo é aceito pelo Playwright e não chama handler nenhum.
 * A pergunta que testemunha é a chave `__react*` que o React pendura no nó ao
 * ligar os handlers — o `disabled` sozinho não serve, o SSR já nasce sem ele.
 */
async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

async function idDaTurma(p, nome) {
  const { status, corpo } = await lerApi(p, "/turmas/minhas");
  return status === 200 && Array.isArray(corpo) ? (corpo.find((t) => t.nome === nome)?.id ?? null) : null;
}

/** Sem `veracidade` e sem `tom` em NENHUMA mensagem — pela CHAVE, não pelo texto (a fala da Nina diz "verdadeira"). */
function semGabarito(mensagens) {
  return Array.isArray(mensagens) && mensagens.every((m) => !("veracidade" in m) && !("tom" in m));
}

await suite(
  {
    slug: "estudante/10-quem-mandou-isso",
    papel: "estudante",
    titulo: "Quem mandou isso? — o grupo da turma e o Mural",
    subtitulo: "exatamente 3, o latch, os três botões da professora, o alerta do grupo e o robô do grupo",
    contexto:
      "A Nina pede ajuda: rolou uma confusão sobre o passeio ao museu. No grupo da turma chegam " +
      "oito mensagens — verdadeiras e falsas, calmas e alarmadas —, e a criança encaminha " +
      "exatamente três ao Mural da Turma e vota no motivo. Quando a professora libera a " +
      "revelação, cada mensagem ganha dois selos e o Mural abre o alerta do grupo: quatro filtros com " +
      "E, OU e NÃO sobre as oito mensagens; depois vêm a síntese e a reflexão: o robô do grupo, montado " +
      "com blocos e ligado em quatro mensagens, a primeira delas o áudio do tio.",
    prova: [
      "A atividade nasce da professora, pelo assistente — conteúdo, equipes e criar —, e sem uma em andamento a missão não abre",
      "Criada com “Pôr no ar agora”, a Nina chega sozinha à tela do estudante, sem recarregar",
      "Antes da revelação a sessão do estudante não carrega veracidade nem tom de mensagem nenhuma",
      "A quarta seta avisa o limite e não abre a folha; o servidor recusa 4 e recusa 2",
      "Confirmado, o Mural não muda mais — nem pela tela, nem por chamada direta",
      "Revelação, síntese e reflexão chegam à tela do estudante por polling, sem recarregar",
      "Os crachás são os do gabarito do servidor, só das 3 escolhidas, e um F5 os devolve",
      "O Termômetro da Turma não tem nome, no painel nem no telão",
      "Depois dos crachás, os 4 pedidos do alerta descem sem o filtro esperado; o servidor executa, e o alerta enviado vira bolha no grupo",
      "Liberar Reflexão leva ao robô do grupo, na casca: sem o laço ele trata 1 das 4 mensagens; com ele, as 4, e enviar fecha a missão",
      "As perguntas P1/P2 saíram: a rota delas responde 404 para esta missão",
      "O bloco Habilidades da BNCC mostra EF05CO08, EF05CO03 (alerta) e EF05CO04 (robô) com o nível que a régua dá",
      "Toda rodada mede as três habilidades de novo, e o critério de cada nível está no fim do bloco",
      "Zerar a turma abre a aba da rodada nova na hora, sem recarregar a página",
    ],
    comando: "node scripts/e2e/estudante/10-quem-mandou-isso.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { turma: TURMA, serie: SERIE });
    /* A professora que LECIONA na turma e está na mesma escola do estudante. A
       de "2 unidades" fica de fora: com duas lotações a escola ativa pode ser a
       outra, e a turma não viria em `/turmas/minhas`. */
    const professora =
      contasDe("professor").find(
        (c) => c.escola === estudante.escola && c.turma.split(" + ").includes(TURMA),
      ) ?? conta("professor", { turma: TURMA });
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSORA: o que a turma já tem ══════════════════════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login, senhaDe(professora));

    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professora.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurma = `/quem-mandou-isso/turmas/${turmaId}`;

    const pacoteAntes = await lerApi(prof, `${daTurma}/pacote`);
    if (pacoteAntes.status !== 200) {
      throw new Error(
        `a api não abriu o pacote da ${TURMA} (HTTP ${pacoteAntes.status}): ${JSON.stringify(pacoteAntes.corpo).slice(0, 200)}`,
      );
    }
    /* As atividades que a turma já tem (ADR-130): é por elas que a suíte sabe,
       depois de criar, se a atividade é NOVA ou a de ontem (criar de novo o
       mesmo pacote é idempotente). */
    const pacotesAntes = await lerApi(prof, `${daTurma}/pacotes`);
    if (pacotesAntes.status !== 200) {
      throw new Error(
        `a api não listou as atividades da ${TURMA} (HTTP ${pacotesAntes.status}): ${JSON.stringify(pacotesAntes.corpo).slice(0, 200)}`,
      );
    }
    const historicoAntes = pacotesAntes.corpo.historico ?? [];
    /* Tela com DOIS estados legítimos no começo: a turma sem atividade em
       andamento (a missão nasce vazia, e a suíte prova a espera) ou com a de
       uma corrida anterior no ar (a espera não se prova, e a suíte diz isso).
       `ativo` é o pacote EM ANDAMENTO da turma. */
    const nasceVazia = pacoteAntes.corpo.ativo === null;
    const padrao = pacoteAntes.corpo.padrao;

    /* A régua do pacote curado, lida pela rota do PROFESSOR (a única que tem o
       gabarito): 2 por quadrante, e imagem e link com uma verdadeira e uma
       falsa cada — senão o formato vira a pista ("link é mentira"). */
    const quadrantes = new Map();
    for (const m of padrao.mensagens) {
      const chave = `${m.veracidade}/${m.tom}`;
      quadrantes.set(chave, (quadrantes.get(chave) ?? 0) + 1);
    }
    r.exigir(
      padrao.mensagens.length === 8 && quadrantes.size === 4 && [...quadrantes.values()].every((n) => n === 2),
      `o pacote curado tem 8 mensagens, 2 em cada quadrante (${[...quadrantes].map(([q, n]) => `${q}:${n}`).join(" ")})`,
    );
    for (const tipo of ["imagem", "link"]) {
      const verdades = padrao.mensagens.filter((m) => m.tipo === tipo).map((m) => m.veracidade).sort();
      r.exigir(
        verdades.join(",") === "falsa,verdadeira",
        `no pacote curado, ${tipo} tem uma verdadeira e uma falsa (${verdades.join(", ")}) — o formato não prediz a veracidade`,
      );
    }

    // ═══ ESTUDANTE (só na turma sem atividade no ar): a missão nasce vazia ══
    let p = null;
    let q = null;
    const abrirAMissao = async () => {
      p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
      await r.entrar(p, estudante.login, senhaDe(estudante));
      await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
      q = p.frameLocator('iframe[data-experiencia]');
      await esperarOuFalharPorHttp(
        p,
        q.locator(".unc-chatlistitem, .lista__vazia, .aviso-de-rede"),
        /quem-mandou-isso\/sessao/,
        { timeout: 40_000, oQue: "o boot da missão" },
      );
      if (await q.locator(".aviso-de-rede").count()) {
        throw new Error(
          `a missão não abriu para ${estudante.login}: "${(await q.locator(".aviso-de-rede").innerText()).trim()}" — ` +
            `a ${TURMA} precisa da liberação na sala (o seed a grava) e a exp05ef1b ligada no painel da Unooria`,
        );
      }
    };

    if (nasceVazia) {
      await abrirAMissao();
      await q.locator(".lista__vazia").waitFor({ timeout: 20_000 });
      const vazia = await lerApi(p, "/quem-mandou-isso/sessao");
      r.exigir(
        vazia.corpo?.preparada === false && vazia.corpo?.pacote === null,
        `sem atividade em andamento a sessão diz preparada=false e não tem grupo (preparada=${vazia.corpo?.preparada})`,
      );
      await r.registrar(p, "grupo-em-preparo", {
        titulo: "A missão nasce vazia",
        mostra: "A lista de conversas sem a Nina, com a linha de espera: o grupo da turma ainda está sendo organizado.",
        prova:
          "O tema do pacote entra na fala da Nina, então sem uma atividade da professora em andamento não " +
          "há conversa nenhuma — e a tela não culpa ninguém nem denuncia o exercício: diz que falta pouco.",
      });
    } else {
      r.ressalva(
        `a ${TURMA} já tinha uma atividade em andamento (corrida anterior): a espera só se prova numa turma sem nenhuma no ar`,
      );
    }

    // ═══ PROFESSORA: a ficha e as atividades da turma ═════════════════════
    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: "Quem Mandou Isso?", exact: true }).waitFor({ timeout: 30_000 });
    await prof
      .getByText(/A missão só abre com uma atividade sua em andamento — e a revelação é você quem libera/)
      .first()
      .waitFor({ timeout: 15_000 });
    await prof.locator("[data-atividades-da-missao]").waitFor({ timeout: 20_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 5º ano",
      mostra:
        "As seis etapas da missão, o aviso que muda a condução — a missão só abre com uma atividade dela em " +
        "andamento, e os três botões da aula são dela — e a lista “Suas atividades com a turma”, com Nova atividade.",
      prova:
        "A professora precisa saber ANTES que esta missão nasce vazia: a plataforma não cria atividade " +
        "(ADR-130). Descobrir isso com trinta crianças diante de uma tela de espera é o chamado de suporte " +
        "que a faixa existe para evitar.",
    });

    /* NOVA ATIVIDADE pelo assistente: a turma já vem da ficha, o conteúdo parte
       do pacote curado, um aluno por computador, e a atividade entra no ar ao
       criar. O `LinkButton` é um `<a>` com `role="button"` (o `Button` do DS
       polimórfico): pelo elemento, e não pelo papel, que aqui diz "botão" para
       um link. */
    await prof.locator("a", { hasText: "Nova atividade" }).first().click();
    await prof.waitForURL("**/atividades/nova**", { timeout: 30_000 });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 30_000 });
    await prof.locator("[data-passo-conteudo] [data-preparo]").waitFor({ timeout: 30_000 });

    /* O componente curricular é um `Selection` do DS (combobox + listbox). O
       portão é o próprio listbox: sem hidratação o clique não abre nada. Vem
       ANTES do pacote curado, que guarda a disciplina escolhida. */
    const disciplina = prof.getByRole("combobox", { name: /^Componente curricular/ });
    await hidratado(prof, disciplina);
    await disciplina.click();
    const primeiraDisciplina = prof.getByRole("listbox").getByRole("option").first();
    await primeiraDisciplina.waitFor({ timeout: 10_000 }).catch(() => {
      throw new Error("o seletor de componente curricular não abriu: a página ainda não estava hidratada");
    });
    const rotuloDaDisciplina = (await primeiraDisciplina.locator(".unooria-selection-option__label").innerText()).trim();
    await primeiraDisciplina.click();

    /* "Gerar Atividade com IA" ESCREVE o pacote (6 a 13 s com o Vertex) e não
       grava nada além do rascunho. A prova é a RESPOSTA — `usouIa` e a origem
       `ia` —, não a tela: a curadoria pode já estar mostrando o rascunho de uma
       geração anterior. */
    await prof.getByLabel("Título do boato escolar fictício").fill(TEMA_DA_GERACAO);
    await prof.getByLabel("Fatos balizadores da aula (3 a 6 tópicos, um por linha)").fill(FATOS_DA_GERACAO);
    const respostaDaGeracao = prof.waitForResponse(
      (res) => /\/quem-mandou-isso\/turmas\/[^/]+\/gerar$/.test(new URL(res.url()).pathname) && res.request().method() === "POST",
      { timeout: 180_000 },
    );
    /* As falas do podcast são pedidas quando o pacote chega (ADR-150): a
       espera nasce ANTES do clique, para não perder a resposta. */
    const respostaDasFalas = esperarFalasDoTema(prof, "exp05ef1b");
    await prof.locator('[data-acao="gerar-pacote"]').click();
    const geracao = await respostaDaGeracao;
    const gerado = await geracao.json().catch(() => null);
    if (
      !r.exigir(
        geracao.status() === 200 && gerado?.usouIa === true && gerado?.rascunho?.origem === "ia",
        `a IA escreveu as oito mensagens (gerar ${geracao.status()}, usouIa=${gerado?.usouIa}, origem=${gerado?.rascunho?.origem}, motivo=${gerado?.motivo ?? "-"})`,
      )
    )
      return;
    await esperarOuFalharCedo(
      prof.getByText(/^Pacote gerado\./),
      prof.locator("[data-preparo]").locator(ALERTA_DE_ERRO),
      { timeout: 20_000, oQue: "mostrar o pacote gerado pela IA na curadoria" },
    );
    /* O PODCAST na criação (ADR-150): a IA escreve as três falas que contam
       este grupo, e a professora as revisa antes de criar. */
    await provarFalasNaCriacao(r, prof, await respostaDasFalas, {
      comIa: true,
      passo: "criacao-falas-do-podcast",
      titulo: "As falas do podcast, para revisar",
      mostra:
        "Na curadoria, as três falas do podcast de recapitulação que contam este grupo: o que ele trazia, a " +
        "mensagem calma que não era verdadeira e a desesperada que era.",
      prova:
        "A IA escreve as falas a partir das oito mensagens (Vertex), e a professora as revisa e edita na criação: " +
        "elas vão no mesmo “Criar atividade”. O resto do roteiro, com Lucas e Camila, é o aprovado pela Unooria.",
    });
    const cartoes = await prof.locator("[data-curadoria] [data-mensagem]").count();
    const porQuadrante = await prof
      .locator("[data-curadoria] [data-quadrante]")
      .evaluateAll((qs) => qs.map((el) => el.querySelectorAll("[data-mensagem]").length));
    r.exigir(cartoes === 8, `a curadoria mostra as 8 mensagens do pacote (${cartoes})`);
    r.exigir(
      porQuadrante.length === 4 && porQuadrante.every((n) => n === 2),
      `nos 4 quadrantes, 2 em cada (${porQuadrante.join(", ")}) — os selos são só da tela dela`,
    );
    r.exigir(
      (await prof.locator("[data-curadoria]").getByText("8 / 8 validados", { exact: true }).count()) === 1,
      "a curadoria marca “8 / 8 validados”: o pacote curado passa na régua da matriz",
    );
    r.exigir(
      (await prof.getByText(/^Para continuar, ajuste:/).count()) === 0,
      "e nada fica por ajustar para continuar",
    );
    await prof.locator("[data-curadoria]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "curadoria-do-pacote", {
      titulo: "O conteúdo da atividade, na matriz 2x2",
      mostra: `O passo Conteúdo da criação: as oito mensagens que a IA escreveu sobre “${TEMA_DA_GERACAO}” nos quatro quadrantes — verdadeira ou falsa, emocional ou neutra —, com o texto editável, o componente curricular ${rotuloDaDisciplina} e o selo “8 / 8 validados”.`,
      prova:
        "A IA escreve o pacote de verdade (Vertex) no molde sorteado no servidor, e ele passa na mesma régua " +
        "da matriz que o curado. É rascunho: nada é gravado antes de “Criar atividade”. Os " +
        "selos de gabarito são só da professora, e o gabarito e o formato de cada posição não têm campo, " +
        "porque sustentam a matriz equilibrada — a api recusaria a troca.",
    });

    await prof.locator('[data-acao="continuar-criacao"]').click();
    /* Rádio do DS pelo PAPEL: o `<input>` transparente cobre o rótulo inteiro. */
    const umPorComputador = prof.getByRole("radio", { name: "Um aluno por computador", exact: true });
    await umPorComputador.click();
    r.exigir(await umPorComputador.isChecked(), "o passo de equipes marca “Um aluno por computador”");
    await r.registrar(prof, "criacao-equipes", {
      titulo: "As equipes, dentro da criação",
      mostra: "O passo Equipes: sortear, eu separo ou um aluno por computador — este, marcado.",
      prova:
        "A equipe é da atividade (ADR-130): a mesma turma pode sentar diferente em cada aula, e quem faltou " +
        "se marca no dia, na página da atividade.",
    });

    await prof.locator('[data-acao="continuar-criacao"]').click();
    await prof.locator("[data-revisao-da-criacao]").waitFor({ timeout: 10_000 });
    /* "Pôr no ar agora" nasce desligado quando a turma já tem uma em andamento
       (a de uma corrida anterior): liga, para a turma entrar nesta. */
    /* O `<input>` do `Toggle` do DS é invisível de propósito (opacidade 0,
       aresta 0, sem ponteiro): esperar `visible` nunca resolve, e o clique
       pelo Playwright morre no `pointer-events: none`. Espera-se o input no
       DOM e o toque vai como evento — o `onChange` do React escuta o `click`. */
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    r.exigir(await noAr.isChecked(), "“Pôr esta atividade no ar agora” fica ligado");
    await r.registrar(prof, "criacao-revisar", {
      titulo: "Revisar e criar",
      mostra:
        "O último passo: a turma, o tema e as 8 mensagens, um aluno por computador e o interruptor " +
        "“Pôr esta atividade no ar agora”, ligado.",
      prova:
        "Criar não põe no ar sozinho: a atividade nasce PRONTA, e é este interruptor que a torna a em " +
        "andamento. Desligado, ela fica na lista até a professora escolher — e a aula que está rodando não muda.",
    });

    await prof.locator('[data-acao="criar-atividade"]').click();
    /* O desfecho é a PÁGINA DA ATIVIDADE em andamento; a corrida é contra o
       erro da criação e contra o aviso "A atividade foi criada" (criou, mas
       não entrou no ar ou a equipe não salvou), que ficam no passo final. */
    await esperarOuFalharCedo(
      prof.locator('[data-estado-da-atividade="em-andamento"]'),
      prof.locator("[data-revisao-da-criacao]").locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`),
      { timeout: 60_000, oQue: "criar a atividade e pô-la no ar" },
    );
    await prof.waitForURL("**/resultados?**pacote=**", { timeout: 30_000 });
    const atividadeId = new URL(prof.url()).searchParams.get("pacote");
    if (!r.exigir(Boolean(atividadeId), `a página da atividade leva o id dela na URL (${prof.url()})`)) return;

    const pacoteDepois = await esperarNaApi(prof, `${daTurma}/pacote`, (c) => c?.ativo?.id === atividadeId, {
      oQue: "a atividade criada em andamento",
    });
    const ativo = pacoteDepois.ativo;
    const gabarito = new Map(ativo.mensagens.map((m) => [m.id, m]));
    const historicoDepois = (await lerApi(prof, `${daTurma}/pacotes`)).corpo?.historico ?? [];
    r.exigir(
      historicoDepois.find((h) => h.id === atividadeId)?.origem === "ia",
      "a atividade em andamento é a escrita pela IA (origem ia na lista da turma)",
    );
    /* Criar de novo EXATAMENTE o pacote mais recente é idempotente: os dois
       desfechos são legítimos, e cada um é provado. */
    const jaExistia = historicoAntes.some((h) => h.id === atividadeId);
    if (jaExistia) {
      r.exigir(
        historicoDepois.length === historicoAntes.length,
        "criar de novo o MESMO pacote não abre atividade nova: é a mesma da lista (a evidência é por pacote)",
      );
    } else {
      r.exigir(
        historicoDepois.length === historicoAntes.length + 1 && historicoDepois.some((h) => h.id === atividadeId),
        `criar abre UMA atividade nova na lista da turma (${historicoAntes.length} → ${historicoDepois.length})`,
      );
    }

    const pacoteNaPagina = prof.locator(`[data-pacote-da-atividade="${atividadeId}"]`);
    /* O pacote mora na aba Conteúdo da atividade (ADR-182); a que abre, em andamento, é a Aula ao vivo. */
    await revelar(prof, pacoteNaPagina);
    await pacoteNaPagina.waitFor({ timeout: 20_000 });
    r.exigir(
      (await prof.locator('[data-liberacao-na-sala="liberada"]').count()) === 1,
      `a página da atividade diz que a missão está liberada na sala da ${TURMA} (o seed a libera)`,
    );
    const verMensagens = prof.locator('[data-acao="ver-mensagens"]');
    await hidratado(prof, verMensagens);
    await verMensagens.click();
    await prof.locator('[data-acao="ver-mensagens"][aria-expanded="true"]').waitFor({ timeout: 10_000 });
    await pacoteNaPagina.scrollIntoViewIfNeeded();
    await r.registrar(prof, "atividade-em-andamento", {
      titulo: "A página da atividade, em andamento",
      mostra:
        "O tema da atividade com o selo Em andamento, os links para a lista da turma e para o guia da aula, " +
        "o pacote com o componente e a origem, a liberação na sala e as 8 mensagens abertas.",
      prova:
        "São DUAS portas, e as duas são da professora: a atividade em andamento escolhe o pacote, e a " +
        "liberação na sala tira o cadeado do card (ADR-69). Uma sem a outra deixa a turma do lado de fora.",
    });
    await verMensagens.click();

    // ─── estado de ONTEM não reprova hoje: zerar abre a rodada seguinte ────
    /* Só a atividade em andamento tem o painel e o "Zerar" — e é a desta
       página. Uma atividade nova, ou que voltou ao ar, já está numa rodada
       nova; a de ontem, ainda no ar, pode ter a turma no meio do caminho. */
    let painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.atividade?.pacoteId === ativo.id, {
      oQue: "o painel da atividade em andamento",
    });
    const linhaDele = (c) => (c?.linhas ?? []).find((l) => l.nome === estudante.nome) ?? null;
    const turmaAndou = painel.fase !== "triagem" || (linhaDele(painel)?.passo ?? "abertura") !== "abertura";
    if (!jaExistia) {
      r.exigir(painel.atividade.rodada === 1, `a atividade nova começa na 1ª rodada (veio ${painel.atividade.rodada}ª)`);
    }
    if (turmaAndou) {
      const rodada = painel.atividade.rodada;
      const zerar = prof.locator("[data-zerar-turma]").getByRole("button", { name: "Zerar Turma para Nova Aplicação" });
      await revelar(prof, prof.locator("[data-zerar-turma]"));
      await hidratado(prof, zerar);
      await zerar.click();
      const janela = prof.getByRole("dialog", { name: `Zerar ${painel.turma.nome} para nova aplicação?` });
      await janela.waitFor({ timeout: 10_000 });
      /* A confirmação é DELIBERADA: o botão só acende com a caixa marcada. O
         clique vai no rótulo — o `<input>` do DS é o alvo escondido. */
      await janela.getByText("Entendi: a turma recomeça do começo numa rodada nova.").click();
      const confirmar = janela.getByRole("button", { name: "Zerar a turma" });
      await prof.waitForFunction((el) => !el.disabled, await confirmar.elementHandle(), { timeout: 10_000 });
      await confirmar.click();
      await esperarOuFalharCedo(
        prof.getByText(new RegExp(`a ${rodada + 1}ª rodada avalia a turma do zero`)),
        prof.locator(ALERTA_DE_ERRO),
        { timeout: 30_000, oQue: "zerar a turma" },
      );
      /* A aba da rodada nova aparece na hora, sem recarregar (o PO, 2026-10-05):
         antes ela só existia depois da primeira evidência e de um F5. */
      await revelar(prof, prof.locator("[data-habilidades-quem-mandou]"));
      await esperarOuFalharCedo(
        prof.locator("[data-habilidades-quem-mandou]").getByText(`A rodada ${rodada + 1} começou`),
        prof.locator(ALERTA_DE_ERRO),
        { timeout: 30_000, oQue: "a aba da rodada nova no painel de habilidades" },
      );
      painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.atividade?.rodada === rodada + 1, {
        oQue: "a rodada nova",
      });
      r.exigir(
        painel.atividade.pacoteId === ativo.id && painel.fase === "triagem",
        `zerar abre a ${rodada + 1}ª rodada do MESMO pacote e volta a aula à triagem (fase=${painel.fase})`,
      );
      await revelar(prof, prof.locator("[data-zerar-turma]"));
      await prof.locator("[data-zerar-turma]").scrollIntoViewIfNeeded();
      await r.registrar(prof, "turma-zerada", {
        titulo: "Zerar abre uma rodada nova, e as habilidades recomeçam do zero",
        mostra: `Na página da atividade em andamento, a ${painel.turma.nome} na ${rodada + 1}ª rodada, com o mesmo pacote, e o painel de habilidades recomeçando do zero.`,
        prova:
          "É a reaplicação da missão (ADR-155): as habilidades do pacote são apagadas e a turma é " +
          "avaliada de novo. E a confirmação é deliberada: um toque perdido no botão não apaga a " +
          "avaliação da sala inteira.",
      });
    } else {
      r.ressalva(
        "a atividade estava no começo de uma rodada (criada agora, ou posta no ar de novo): zerar não foi preciso nesta corrida",
      );
    }
    const atividade = painel.atividade;

    await revelar(prof, prof.locator("[data-painel-da-aula]"));
    await prof.locator("[data-painel-da-aula]").scrollIntoViewIfNeeded();
    /* Depois de "Zerar" o painel se relê: contar na hora pegava a lista a meio
       caminho e reprovava com os três botões na tela (2026-09-26). Espera o
       terceiro existir — o desfecho, não o relógio — e só então conta. */
    await prof
      .locator("[data-painel-da-aula] li[data-gate]")
      .nth(2)
      .waitFor({ timeout: 30_000 })
      .catch(() => {});
    r.exigir(
      (await prof.locator("[data-painel-da-aula] li[data-gate]").count()) === 3,
      "o painel da aula tem os três botões, na ordem: revelação, síntese, reflexão",
    );
    await r.registrar(prof, "painel-da-aula", {
      titulo: "A aula, antes de a turma entrar",
      mostra: "O progresso da turma e os três botões — Liberar Revelação, Apresentar Síntese e Liberar Reflexão —, cada um com o que faz.",
      prova:
        "Os três só andam para a frente, e cada um pede confirmação: são cliques na frente de trinta " +
        "crianças, e desfazer uma revelação não existe.",
    });

    // ═══ ESTUDANTE: a Nina e o convite ═════════════════════════════════════
    if (nasceVazia) {
      /* O MESMO frame, sem recarregar: quem tira a criança da espera é o
         polling do gate (`preparada` mudou). */
      await esperarOuFalharPorHttp(p, q.locator(".unc-chatlistitem"), /quem-mandou-isso\/(gate|sessao)/, {
        timeout: 30_000,
        oQue: "a Nina chegar depois de a atividade entrar no ar",
      }).catch((erro) => {
        if (/Timeout/i.test(String(erro))) {
          throw new Error(
            "a atividade em andamento não chegou à tela do estudante em 30 s sem recarregar: o polling do gate não viu `preparada` mudar",
          );
        }
        throw erro;
      });
    } else {
      await abrirAMissao();
    }

    const sessaoInicial = await lerApi(p, "/quem-mandou-isso/sessao");
    const s0 = sessaoInicial.corpo;
    r.exigir(
      sessaoInicial.status === 200 && s0?.passo === "abertura" && s0?.preparada === true,
      `a sessão do estudante começa na abertura, com a atividade em andamento (passo=${s0?.passo})`,
    );
    r.exigir(
      s0?.atividade?.pacoteId === atividade.pacoteId && s0?.atividade?.rodada === atividade.rodada,
      `e na MESMA atividade que o painel mostra (pacote e ${atividade.rodada}ª rodada)`,
    );
    r.exigir(
      semGabarito(s0?.pacote?.mensagens) && s0?.pacote?.mensagens?.length === 8,
      "as 8 mensagens que descem ao estudante não têm veracidade nem tom — o gabarito fica no servidor",
    );
    r.exigir(s0?.revelacao === null, "e a revelação é nula: não há o que esconder no bundle porque não há o que baixar");
    r.exigir(
      (s0?.textos?.nina?.convite ?? "").includes(`Rolou uma confusão sobre ${ativo.tema}`),
      `a fala da Nina leva o tema da atividade em andamento ("${ativo.tema}")`,
    );

    await q.locator(".unc-chatlistitem .unc-listitem__main").click();
    const entrarNoGrupo = q.getByRole("button", { name: "Entrar no grupo", exact: true });
    await entrarNoGrupo.waitFor({ timeout: 15_000 });
    await r.registrar(p, "convite-da-nina", {
      titulo: "O pedido da Nina",
      mostra: "A conversa com a Nina: rolou uma confusão sobre o passeio ao museu, e o convite para o grupo Turma 5ºB.",
      prova:
        "Em nenhum lugar se diz que a aula é sobre mentira na internet — é esse silêncio que faz a " +
        "missão medir o comportamento espontâneo, e não o que a criança acha que a professora espera.",
    });

    await entrarNoGrupo.click();
    await esperarOuFalharPorHttp(p, q.locator(".linha-do-grupo").first(), /quem-mandou-isso\/entrar/, {
      timeout: 30_000,
      oQue: "entrar no grupo da turma",
    });
    const linhas = q.locator(".linha-do-grupo");
    /* As mensagens CHEGAM uma a uma (~0,9 s cada, o pedido do PO): a suíte
       espera a oitava, contra o erro da api, e só então conta. */
    r.exigir(
      (await linhas.count()) < 8,
      "as mensagens chegam uma a uma — logo depois de entrar, o grupo ainda não tem as oito",
    );
    await esperarOuFalharPorHttp(p, linhas.nth(7), /quem-mandou-isso\/(entrar|sessao)/, {
      timeout: 30_000,
      oQue: "as oito mensagens chegarem ao grupo",
    });
    r.exigir((await linhas.count()) === 8, `o grupo termina com as 8 mensagens do pacote (${await linhas.count()})`);
    r.exigir(
      (await q.getByText("Apenas administradores podem enviar mensagens").count()) >= 1,
      "no lugar do teclado, a tarja de só-administradores: não há digitação livre dentro do mensageiro",
    );
    await r.registrar(p, "grupo-da-turma", {
      titulo: "Turma 5ºB, oito mensagens",
      mostra:
        "Textos, as duas imagens desenhadas (cada uma com desenho próprio) e as prévias de link, cada um " +
        "com a seta de encaminhar; no " +
        "topo, a faixa “Encaminhe 3 mensagens para o Mural da Turma” com 0/3.",
      prova:
        "Nenhuma mensagem chega marcada, e o formato não é pista: imagem e link têm uma verdadeira e " +
        "uma falsa cada. A única ação é a seta.",
    });

    // ═══ EXATAMENTE 3 ══════════════════════════════════════════════════════
    /* A faixa é tocável como a mensagem fixada do app real: com menos de 3 a
       recusa FALA (`e2.erro.toast_menor_3`). */
    await q.locator(".faixa-tocavel").click();
    await q.locator(".unc-toast", { hasText: "exatamente 3 mensagens" }).waitFor({ timeout: 5_000 }).catch(() => {
      throw new Error("tocar a faixa com 0/3 não disse o que faltava: alvo mudo ensina a desconfiar da tela");
    });

    const folha = q.getByRole("dialog", { name: "Encaminhar para..." });
    for (let i = 0; i < 3; i += 1) {
      await linhas.nth(i).locator(".unc-forwardbutton").click();
      await folha.waitFor({ timeout: 10_000 });
      if (i === 0) {
        await r.registrar(p, "folha-de-encaminhar", {
          titulo: "Encaminhar para…",
          mostra: "A folha inferior com UM destino, já marcado: o Mural da Turma, conversa com a professora.",
          prova:
            "Um destino só. A decisão que a missão mede é O QUE encaminhar, não para onde — e a folha é " +
            "o gesto do aplicativo real, não uma escolha a mais.",
        });
      }
      await folha.getByRole("button", { name: "Enviar", exact: true }).click();
      await linhas.nth(i).locator('.unc-forwardbutton[aria-pressed="true"]').waitFor({ timeout: 10_000 });
    }
    r.exigir(
      (await q.locator(".faixa-tocavel").innerText()).includes("3/3"),
      "a faixa do topo conta 3/3",
    );

    /* A QUARTA seta: esmaecida e com `aria-disabled` — e ainda assim ela FALA
       (o `ForwardButton` do DS só esmaece por `:disabled`, que engole o toque;
       a experiência compensa com `aria-disabled`). O Playwright recusa clicar
       em `aria-disabled`, e é por isso que o clique é forçado: o que se prova
       é o que a criança vê quando toca. */
    const quarta = linhas.nth(3).locator(".unc-forwardbutton");
    r.exigir(
      (await quarta.getAttribute("aria-disabled")) === "true",
      "com 3 escolhidas, as outras setas ficam esgotadas (aria-disabled, que o leitor de tela anuncia)",
    );
    await quarta.click({ force: true });
    await q.locator(".unc-toast", { hasText: "Limite de 3 mensagens atingido" }).waitFor({ timeout: 5_000 }).catch(() => {
      throw new Error("a quarta seta não avisou o limite: a recusa ficou muda");
    });
    r.exigir((await folha.count()) === 0, "e a folha de encaminhar não abre para a quarta");
    r.exigir(
      (await q.locator('.linha-do-grupo .unc-forwardbutton[aria-pressed="true"]').count()) === 3,
      "a seleção continua com 3",
    );
    await r.registrar(p, "trava-de-3", {
      titulo: "A quarta mensagem não entra",
      mostra: "As setas que sobraram esmaecidas e o aviso “Limite de 3 mensagens atingido. Desmarque uma mensagem para escolher outra.”",
      prova:
        "Exatamente 3 é parte do instrumento: a régua da EF05CO08 lê três mensagens. A recusa fala e " +
        "diz o que fazer — desmarcar é o caminho, e ele continua aberto até o Mural.",
    });

    /* E o servidor cobra de novo: botão esgotado não é regra, é enfeite sobre
       uma regra. As chamadas vão pelo APIRequestContext — não passam pelo
       console da página, então não pintam a suíte de vermelho e não precisam
       de `provocado` (que esconderia um 4xx de verdade das mesmas rotas). */
    const selecaoServidor = await esperarNaApi(
      p,
      "/quem-mandou-isso/sessao",
      (c) => (c?.selecao ?? []).length === 3,
      { oQue: "a seleção guardada no servidor" },
    );
    const escolhidas = selecaoServidor.selecao;
    const idsDoPacote = s0.pacote.mensagens.map((m) => m.id);
    const umaAMais = idsDoPacote.find((id) => !escolhidas.includes(id));
    const quatro = await mandarApi(p, "PUT", "/quem-mandou-isso/selecao", { selecao: [...escolhidas, umaAMais] });
    r.exigir(
      quatro.status === 400 && quatro.corpo?.codigo === "selecao-acima-do-limite",
      `o servidor recusa 4 mensagens (${quatro.status} ${quatro.corpo?.codigo ?? ""})`,
    );
    const duas = await mandarApi(p, "POST", "/quem-mandou-isso/mural", { selecao: escolhidas.slice(0, 2) });
    r.exigir(
      duas.status === 400 && duas.corpo?.codigo === "selecao-incompleta",
      `e recusa fechar o Mural com 2 (${duas.status} ${duas.corpo?.codigo ?? ""})`,
    );

    // ═══ O MURAL, E O LATCH ════════════════════════════════════════════════
    await q.getByRole("button", { name: "Ir para o Mural da Turma", exact: true }).click();
    const confirmarEnvio = q.getByRole("button", { name: "Confirmar envio", exact: true });
    await confirmarEnvio.waitFor({ timeout: 15_000 });
    r.exigir((await q.locator(".linha-do-mural").count()) === 3, "o Mural mostra as 3 escolhidas");
    r.exigir(
      (await q.locator(".linha-do-mural .unc-messagebubble__forwarded").count()) === 3,
      "cada uma com o selo Encaminhada, como no aplicativo real",
    );
    r.exigir(
      (await q.locator(".linha-do-mural .unc-messagebubble__sender").count()) === 0,
      "e sem o remetente: a autoria se perde no primeiro repasse — é o título da missão",
    );
    await r.registrar(p, "mural-antes-de-confirmar", {
      titulo: "O último instante em que dá para voltar atrás",
      mostra: "As três mensagens no Mural da Turma, sem quem as mandou, e os botões Revisar seleção no grupo e Confirmar envio.",
      prova:
        "A seleção é revisável ATÉ aqui: quem repassou no impulso e voltou atrás fez o que a missão " +
        "ensina. Depois do próximo toque, não — e é esse toque que a EF05CO08 mede.",
    });

    await confirmarEnvio.click();
    await esperarOuFalharPorHttp(p, q.locator(".unc-poll"), /quem-mandou-isso\/mural/, {
      timeout: 30_000,
      oQue: "confirmar o envio ao Mural",
    });
    r.exigir(
      (await q.getByRole("button", { name: "Revisar seleção no grupo" }).count()) === 0,
      "confirmado, o botão de revisar some: o Mural fechou",
    );
    const outraSelecao = [...escolhidas.slice(0, 2), umaAMais];
    const mudar = await mandarApi(p, "POST", "/quem-mandou-isso/mural", { selecao: outraSelecao });
    r.exigir(
      mudar.status === 409 && mudar.corpo?.codigo === "mural-ja-enviado",
      `nem por chamada direta: outra seleção depois do latch é 409 (${mudar.status} ${mudar.corpo?.codigo ?? ""})`,
    );
    const rascunho = await mandarApi(p, "PUT", "/quem-mandou-isso/selecao", { selecao: [] });
    r.exigir(
      rascunho.status === 409 && rascunho.corpo?.codigo === "mural-ja-enviado",
      `e o rascunho também não muda mais (${rascunho.status} ${rascunho.corpo?.codigo ?? ""})`,
    );
    const confirmada = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      confirmada.corpo?.passo === "enquete" && confirmada.corpo?.confirmado === true,
      `o servidor põe o estudante na enquete (passo=${confirmada.corpo?.passo})`,
    );
    r.exigir(confirmada.corpo?.revelacao === null, "e confirmar não revela nada: o gabarito continua do outro lado");

    // ═══ A ENQUETE E A ESPERA ═════════════════════════════════════════════
    const opcoesDaEnquete = q.locator(".unc-poll .unc-poll__option");
    r.exigir(
      (await opcoesDaEnquete.count()) === (s0.opcoes?.motivos?.length ?? -1) && (await opcoesDaEnquete.count()) === 4,
      `a enquete “O que mais te fez escolher essas mensagens?” tem as 4 opções (${await opcoesDaEnquete.count()})`,
    );
    /* O clique vai no rótulo (o `<input>` do Radio do DS é visualmente
       escondido). O botão Votar só acende com uma escolha — é o portão de que
       o `onChange` chegou ao React. */
    await opcoesDaEnquete.first().click();
    const votar = q.locator(".unc-poll__vote:not([disabled])");
    await votar.waitFor({ timeout: 10_000 }).catch(() => {
      throw new Error("escolher uma opção da enquete não acendeu o Votar: o toque não moveu o estado da tela");
    });
    const motivoEscolhido = await q.locator(".unc-poll input[type=radio]:checked").getAttribute("value");
    await r.registrar(p, "enquete-do-motivo", {
      titulo: "O que mais te fez escolher essas mensagens?",
      mostra: "A enquete do Unoochat no Mural, com as quatro opções e o histórico esmaecido atrás.",
      prova:
        "O motivo é declarado ANTES da revelação — depois dela a resposta seria a que a criança acha " +
        "certa. É o dado que o Termômetro cruza com o que a turma encaminhou.",
    });
    await votar.click();
    await esperarOuFalharPorHttp(p, q.getByText("Mensagens entregues no Mural da Turma"), /quem-mandou-isso\/enquete/, {
      timeout: 30_000,
      oQue: "votar na enquete",
    });
    const esperando = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      esperando.corpo?.passo === "espera" && esperando.corpo?.motivo === motivoEscolhido,
      `votou: o servidor põe o estudante na espera, com o motivo gravado (passo=${esperando.corpo?.passo})`,
    );
    r.exigir(
      esperando.corpo?.revelacao === null && semGabarito(esperando.corpo?.pacote?.mensagens),
      "e o gabarito ainda não desceu: o voto sozinho não revela — falta o botão da professora",
    );
    await r.registrar(p, "espera", {
      titulo: "Mensagens entregues, e a turma ainda chegando",
      mostra: "A mensagem de sistema: você terminou esta etapa, aguarde a orientação do professor para a revelação.",
      prova: "A revelação é da turma, não de cada um: é a espera que faz as trinta telas chegarem juntas ao botão dela.",
    });

    // ═══ PROFESSORA: antes da revelação, só progresso ═════════════════════
    painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => (c?.progresso?.votaram ?? 0) >= 1, {
      oQue: "o voto chegar ao painel",
    });
    r.exigir(painel.termometro === null, "antes da revelação o painel não tem Termômetro: só o progresso");
    await prof.reload({ waitUntil: "domcontentloaded" });
    await revelar(prof, prof.locator("[data-painel-da-aula]"));
    await prof.locator("[data-painel-da-aula]").waitFor({ timeout: 30_000 });
    r.exigir(
      (await prof.locator("[data-termometro]").count()) === 0,
      "e a tela diz que ele aparece quando ela liberar a revelação",
    );

    /**
     * Um botão da aula: o portão de hidratação, a confirmação (o nome do
     * diálogo é o título) e o DESFECHO — a fase da turma no atributo da seção,
     * correndo contra o alerta de erro da janela.
     */
    const apertarBotaoDaAula = async (acao, rotulo, tituloDaJanela, fase) => {
      const botao = prof.locator(`[data-painel-da-aula] li[data-gate="${acao}"]`).getByRole("button", { name: rotulo });
      await hidratado(prof, botao);
      await botao.click();
      const janela = prof.getByRole("dialog", { name: tituloDaJanela });
      await janela.waitFor({ timeout: 10_000 });
      await janela.getByRole("button", { name: rotulo, exact: true }).click();
      await esperarOuFalharCedo(prof.locator(`[data-painel-da-aula][data-fase="${fase}"]`), prof.locator(ALERTA_DE_ERRO), {
        timeout: 30_000,
        oQue: rotulo,
      });
    };

    /** O efeito do botão chega à tela do estudante sozinho — e corre contra o gate falhar. */
    const chegaSemRecarregar = async (alvo, oQue) => {
      await esperarOuFalharPorHttp(p, alvo, /quem-mandou-isso\/(gate|sessao)/, { timeout: 30_000, oQue }).catch((erro) => {
        if (/Timeout/i.test(String(erro))) {
          throw new Error(
            `${oQue}: não chegou à tela do estudante em 30 s sem recarregar — o polling do gate (3 s) não ` +
              "trocou a tela, e numa aula real a turma inteira esperaria um F5 que ninguém pediu",
          );
        }
        throw erro;
      });
    };

    // ═══ 1º BOTÃO: a revelação ════════════════════════════════════════════
    await apertarBotaoDaAula("liberar_revelacao", "Liberar Revelação", "Liberar a revelação para a turma?", "revelacao");
    await chegaSemRecarregar(q.locator(".crachas").first(), "a revelação");

    const revelada = await lerApi(p, "/quem-mandou-isso/sessao");
    const revelacao = revelada.corpo?.revelacao ?? null;
    const idsRevelados = (revelacao?.mensagens ?? []).map((m) => m.id).sort();
    r.exigir(
      revelacao !== null && idsRevelados.join(",") === [...escolhidas].sort().join(","),
      `agora o gabarito cruza a fronteira — e só o das 3 escolhidas (${idsRevelados.join(", ")})`,
    );
    r.exigir(
      (revelacao?.mensagens ?? []).every(
        (m) => gabarito.get(m.id)?.veracidade === m.veracidade && gabarito.get(m.id)?.tom === m.tom,
      ),
      "e os dois eixos de cada uma são os do pacote da atividade (conferidos pela rota da professora)",
    );
    r.exigir(
      semGabarito(revelada.corpo?.pacote?.mensagens),
      "as 8 mensagens do grupo continuam sem gabarito: as 5 que ficaram de fora nunca descem",
    );
    /* O Mural está na ordem do GRUPO: a linha i é a i-ésima escolhida nessa ordem. */
    const naOrdemDoGrupo = idsDoPacote.filter((id) => escolhidas.includes(id));
    const crachasNaTela = await q
      .locator(".linha-do-mural")
      .evaluateAll((ls) => ls.map((l) => [...l.querySelectorAll(".unc-messagetag__label")].map((t) => t.textContent.trim())));
    const crachasEsperados = naOrdemDoGrupo.map((id) => {
      const m = gabarito.get(id);
      return [ROTULO_DA_VERACIDADE[m.veracidade], ROTULO_DO_TOM[m.tom]];
    });
    r.exigir(
      JSON.stringify(crachasNaTela) === JSON.stringify(crachasEsperados),
      `cada mensagem do Mural ganha os DOIS crachás certos (${crachasNaTela.map((c) => c.join("+")).join(" · ")})`,
    );
    r.exigir(
      (await q.getByText(/^Seu motivo declarado:/).count()) === 1,
      "e o motivo que ela votou volta, com o lembrete do bimestre",
    );
    await r.registrar(p, "revelacao", {
      titulo: "Os dois selos, sem ninguém recarregar",
      mostra:
        "As três mensagens do Mural com os crachás — verdadeira ou falsa, emocional ou neutra —, o " +
        "motivo declarado, o lembrete do bimestre e as duas barras da turma, como imagem no chat.",
      prova:
        "Um eixo não prediz o outro: a séria pode ser falsa, a alarmada pode ser verdadeira. Os " +
        "crachás se distinguem por pictograma e palavra, não por cor. E chegaram pelo polling de 3 s.",
    });

    /* O F5 no meio da aula: o passo é do servidor, e a tela volta onde estava. */
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[data-experiencia]');
    await esperarOuFalharPorHttp(p, q.locator(".crachas").first(), /quem-mandou-isso\/sessao/, {
      timeout: 40_000,
      oQue: "a revelação depois do F5",
    });
    r.exigir((await q.locator(".crachas").count()) === 3, "o F5 devolve a revelação com os 3 pares de crachás");

    // ═══ O ALERTA DO GRUPO (EF05CO03), no fim do Mural revelado ═══════════
    /* O alerta desce JUNTO com a revelação: o quadro das 8 mensagens com os
       crachás (decisão de produto — a revelação abriu) e os 4 pedidos SEM a
       expressão esperada. Quem executa o filtro é o servidor; a suíte sabe o
       filtro certo pelo oráculo do topo, como o guia da professora o mostra. */
    const comAlerta = await lerApi(p, "/quem-mandou-isso/sessao");
    const alerta = comAlerta.corpo?.alerta ?? null;
    if (!r.exigir(alerta !== null && alerta.pedidos?.length === 4 && alerta.quadro?.length === 8, `o alerta desce com a revelação: 4 pedidos e o quadro das 8 (${alerta?.pedidos?.length ?? "nenhum"})`)) return;
    r.exigir(alerta.aberto === true && alerta.andamento.length === 0, "aberto, e sem execução nenhuma ainda");
    r.exigir(
      alerta.pedidos.every((ped) => Object.keys(ped).sort().join() === "n,texto") && !/"esperada"/.test(JSON.stringify(comAlerta.corpo)),
      "cada pedido desce só com número e texto — a expressão esperada não está no estado",
    );
    r.exigir(
      alerta.quadro.every((m) => gabarito.get(m.id)?.veracidade === m.veracidade && gabarito.get(m.id)?.tom === m.tom) &&
        alerta.quadro.filter((m) => m.voceEnviou).map((m) => m.id).sort().join() === [...escolhidas].sort().join(),
      "o quadro traz os crachás das 8 (os do pacote da atividade) e marca “Você enviou” nas 3 do Mural",
    );
    r.exigir(
      alerta.quadro.every((m) => m.rotulo === `Mensagem de ${gabarito.get(m.id)?.remetente}`),
      "e cada linha é “Mensagem de {remetente}” — o rótulo derivado, sem campo novo no pacote",
    );

    const faixa = q.getByText("Alerta do grupo · Role para montar os alertas ↓", { exact: true });
    const montador = q.locator(".alerta");
    await esperarOuFalharPorHttp(p, montador, /quem-mandou-isso\/(sessao|gate)/, { timeout: 20_000, oQue: "o alerta do grupo no fim do Mural" });
    r.exigir((await faixa.count()) === 1, "a faixa “Alerta do grupo · Role para montar os alertas ↓” abre o alerta, depois dos crachás");
    r.exigir((await q.locator(".alerta__linha").count()) === 8, "o montador mostra o quadro das 8 mensagens");
    r.exigir(
      (await q.getByText("OU vale se uma das partes for verdadeira, ou as duas.", { exact: true }).count()) === 1,
      "e a dica do OU fica à vista: em português “ou” costuma soar exclusivo",
    );
    const verResultado = montador.getByRole("button", { name: "Ver resultado", exact: true });
    const enviarAlerta = montador.getByRole("button", { name: "Enviar alerta ao grupo", exact: true });
    r.exigir(
      (await verResultado.isDisabled()) && (await enviarAlerta.isDisabled()),
      "sem condição nenhuma, “Ver resultado” e “Enviar alerta ao grupo” ficam apagados",
    );
    await montador.scrollIntoViewIfNeeded();
    await r.registrar(p, "alerta-do-grupo", {
      titulo: "O alerta do grupo",
      mostra:
        "No fim do Mural revelado, a faixa “Alerta do grupo”, o “Alerta 1 de 4” com o pedido, o quadro das " +
        "oito mensagens com os dois crachás (e “Você enviou” nas três dela) e o montador: NÃO, Falsa, " +
        "Emocional, E e OU.",
      prova:
        "Os crachás dão os valores simples; montar o filtro que destaca as mensagens pedidas é a operação " +
        "com E, OU e NÃO que a EF05CO03 mede. O filtro certo nunca desceu ao navegador.",
    });

    /** Liga ou desliga um chip (`FilterChip`, `aria-pressed`) para chegar ao valor pedido. */
    const ajustarChip = async (chip, ligado) => {
      const pressionado = async () => (await chip.getAttribute("aria-pressed")) === "true";
      if ((await pressionado()) === ligado) return;
      await chip.click();
      /* O desfecho é o `aria-pressed` virar — não um tempo fixo. */
      const limite = Date.now() + 5_000;
      while ((await pressionado()) !== ligado) {
        if (Date.now() > limite) {
          throw new Error(`o chip “${normalizar(await chip.innerText())}” não ficou ${ligado ? "ligado" : "desligado"} depois do toque`);
        }
        await p.waitForTimeout(100);
      }
    };
    const ROTULO_DO_CHIP = { falsa: "Falsa", emocional: "Emocional" };
    const ajustarCondicao = async (grupo, c) => {
      const g = montador.getByRole("group", { name: grupo, exact: true });
      await ajustarChip(g.getByRole("button", { name: "NÃO", exact: true }), c.nao);
      await ajustarChip(g.getByRole("button", { name: ROTULO_DO_CHIP[c.attr], exact: true }), true);
    };
    /** Monta o filtro inteiro na tela, chip a chip. */
    const montarFiltro = async (e) => {
      await ajustarCondicao("Primeira condição", e.a);
      const ligacao = montador.getByRole("group", { name: "Juntar com outra condição", exact: true });
      for (const op of ["E", "OU"]) await ajustarChip(ligacao.getByRole("button", { name: op, exact: true }), e.op === op);
      if (e.op) await ajustarCondicao("Segunda condição", e.b);
    };
    /** O estado que o POST devolveu — a resposta do iframe é cross-origin, quem a vê é o CONTEXTO. */
    const respostaDe = (rota) =>
      p.context().waitForEvent("response", {
        predicate: (x) => new URL(x.url()).pathname.endsWith(rota) && x.request().method() === "POST",
        timeout: 30_000,
      });
    const passamEsperadas = (e) => idsDoPacote.filter((id) => passaNoFiltro(e, gabarito.get(id)));

    /** "Ver resultado": o servidor executa; a suíte confere a conta contra o oráculo, na tela e no estado. */
    const executar = async (n, e, k) => {
      await montarFiltro(e);
      const recibo = respostaDe("/quem-mandou-isso/alerta/execucao");
      await verResultado.click();
      await esperarOuFalharPorHttp(p, montador.locator(".alerta__resultado", { hasText: `Execução ${k} de 3` }), /quem-mandou-isso\/alerta\/execucao/, {
        timeout: 30_000,
        oQue: `ver o resultado do alerta ${n} (execução ${k})`,
      });
      const estado = await (await recibo).json().catch(() => null);
      const ids = passamEsperadas(e);
      const execucao = estado?.alerta?.andamento?.find((x) => x.pedido === n)?.execucoes?.[k - 1];
      r.exigir(
        JSON.stringify(execucao?.passam ?? null) === JSON.stringify(ids),
        `alerta ${n}, execução ${k}: o servidor destaca ${ids.length} mensagens — as que o oráculo calcula sobre os crachás`,
      );
      r.exigir(
        (await montador.locator(".alerta__linha--passa").count()) === ids.length &&
          normalizar(await montador.locator(".alerta__resultado").innerText()).startsWith(
            ids.length === 1 ? "1 mensagem passa no filtro." : `${ids.length} mensagens passam no filtro.`,
          ),
        `e a tela destaca as mesmas ${ids.length}, com “… passam no filtro.”`,
      );
      r.exigir(
        !/"(esperada|pontos|nivel|status)"/.test(JSON.stringify(estado?.alerta ?? {})),
        "o estado da execução não traz expressão esperada, ponto nem nível",
      );
      return ids;
    };
    /** "Enviar alerta ao grupo": a bolha ENVIADA no grupo, com as mensagens que o filtro destacou. */
    const enviar = async (n, ids) => {
      const recibo = respostaDe("/quem-mandou-isso/alerta/envio");
      await enviarAlerta.click();
      const bolhas = q.locator(".unc-messagebubble", { hasText: "⚠ Alerta do grupo" });
      await esperarOuFalharPorHttp(p, bolhas.nth(n - 1), /quem-mandou-isso\/alerta\/envio/, { timeout: 30_000, oQue: `enviar o alerta ${n}` });
      const estado = await (await recibo).json().catch(() => null);
      r.exigir(
        JSON.stringify(estado?.alerta?.andamento?.find((x) => x.pedido === n)?.enviado?.passam ?? null) === JSON.stringify(ids),
        `o alerta ${n} enviado é a última execução — as ${ids.length} que ela viu passar`,
      );
      const referencias = ids.map((id) => `a mensagem de ${gabarito.get(id).remetente}`);
      const texto = normalizar(await bolhas.nth(n - 1).innerText());
      r.exigir(
        texto.includes(`${ids.length} ${ids.length === 1 ? "mensagem destacada" : "mensagens destacadas"}: ${referencias.join(", ")}.`),
        `a bolha enviada lista “${referencias.join(", ")}” — sem dizer se o filtro estava certo`,
      );
      r.exigir(!PALAVRAS_DE_ACERTO.test(texto), "e a bolha não tem nível, acerto nem nota");
    };

    // ─── alerta 1: certo de primeira ───────────────────────────────────────
    r.exigir(normalizar(await montador.locator(".alerta__contador").innerText()) === "Alerta 1 de 4", "o alerta começa no pedido 1");
    const ids1 = await executar(1, PEDIDOS_ESPERADOS[0], 1);
    r.exigir(!(await enviarAlerta.isDisabled()), "executado o filtro que está na tela, “Enviar alerta ao grupo” acende");
    await r.registrar(p, "alerta-resultado", {
      titulo: "Ver resultado: o servidor executa o filtro",
      mostra: "O filtro “Falsa E Emocional” montado, as mensagens que passam destacadas, as outras esmaecidas, e “Execução 1 de 3”.",
      prova:
        "Nenhuma cor de acerto: quem passou ganha contorno e a etiqueta “Destacada”, e a criança compara o " +
        "resultado com o pedido e com os crachás. Quem executou foi o servidor.",
    });
    await enviar(1, ids1);

    // ─── alerta 2: errado primeiro, corrigido depois de ver o resultado ─────
    await esperarOuFalharPorHttp(p, montador.locator(".alerta__contador", { hasText: "Alerta 2 de 4" }), /quem-mandou-isso\//, {
      timeout: 15_000,
      oQue: "o pedido 2 abrir depois do envio",
    });
    await executar(2, FILTRO_ERRADO, 1);
    /* Mexer no filtro depois de executar apaga o "Enviar": ela envia o que VIU passar. */
    await montarFiltro(PEDIDOS_ESPERADOS[1]);
    r.exigir(
      (await enviarAlerta.isDisabled()) &&
        (await montador.getByText("Toque em Ver resultado antes de enviar o alerta.", { exact: true }).count()) === 1,
      "trocado o filtro depois do resultado, “Enviar” apaga e a tela pede “Toque em Ver resultado antes de enviar o alerta.”",
    );
    const ids2 = await executar(2, PEDIDOS_ESPERADOS[1], 2);
    await r.registrar(p, "alerta-corrigido", {
      titulo: "Alerta 2: corrigido depois de ver o resultado",
      mostra: "O segundo pedido depois da troca de “Falsa OU Emocional” por “Falsa OU NÃO Emocional”, com “Execução 2 de 3”.",
      prova:
        "Comparar o resultado com o pedido e corrigir é aprendizado, mas vale 1 ponto, não 2: a régua lê a " +
        "PRIMEIRA execução de cada pedido.",
    });
    await enviar(2, ids2);

    // ─── alertas 3 e 4: certos de primeira ─────────────────────────────────
    for (const n of [3, 4]) {
      await esperarOuFalharPorHttp(p, montador.locator(".alerta__contador", { hasText: `Alerta ${n} de 4` }), /quem-mandou-isso\//, {
        timeout: 15_000,
        oQue: `o pedido ${n} abrir depois do envio`,
      });
      await enviar(n, await executar(n, PEDIDOS_ESPERADOS[n - 1], 1));
    }
    await esperarOuFalharPorHttp(p, q.getByText("Alertas enviados.", { exact: true }), /quem-mandou-isso\/alerta\/envio/, {
      timeout: 15_000,
      oQue: "o fim do alerta",
    });
    r.exigir((await montador.count()) === 0, "com os 4 enviados, o montador some e fica “Alertas enviados.”");
    const pontosEsperados = 2 + 1 + 2 + 2;
    await q.getByText("Alertas enviados.", { exact: true }).scrollIntoViewIfNeeded();
    await r.registrar(p, "alertas-enviados", {
      titulo: "Alertas enviados",
      mostra: "As quatro bolhas “⚠ Alerta do grupo” enviadas, cada uma com as mensagens que o filtro destacou, e “Alertas enviados.”",
      prova:
        "O alerta errado iria ao grupo com as mensagens erradas, sem aviso: a tela não comenta. O servidor " +
        "marca a EF05CO03 no QUARTO envio, na mesma transação. Quem lê o nível é a professora.",
    });

    /* A marca chega ao painel de habilidades da professora no 4º envio, antes da síntese. */
    const caminhoDaEvidencia = `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividade.pacoteId}`;
    const doEstudante = (c) => c?.estudantes?.find((e) => e.nome === estudante.nome);
    const naRodada = (c) => doEstudante(c)?.porRodada?.[String(atividade.rodada)] ?? {};
    const depoisDoAlerta = await esperarNaApi(prof, caminhoDaEvidencia, (c) => Boolean(naRodada(c).EF05CO03), {
      oQue: "a marca da EF05CO03 depois do 4º alerta",
    });
    const celulaCO03 = naRodada(depoisDoAlerta).EF05CO03;
    r.exigir(
      celulaCO03.status === nivelEsperadoCO03(pontosEsperados),
      `EF05CO03 pelo alerta: o painel registra “${celulaCO03.status}”, e a régua dá “${nivelEsperadoCO03(pontosEsperados)}” para ${pontosEsperados} de 8`,
    );
    r.exigir(celulaCO03.rotulo === "Alerta do grupo", `e diz de onde veio o nível: “${celulaCO03.rotulo ?? "sem rótulo"}”`);
    r.exigir(!naRodada(depoisDoAlerta).EF05CO04, "a EF05CO04 ainda não tem marca: o robô não foi enviado");
    const painelDoAlerta = await esperarNaApi(prof, `${daTurma}/painel`, (c) => linhaDele(c)?.alertas?.enviados === 4, {
      oQue: "os alertas na folha da turma",
    });
    r.exigir(
      linhaDele(painelDoAlerta).alertas.pontos === pontosEsperados && painelDoAlerta.progresso.enviaramAlertas >= 1,
      `a folha da professora conta ${linhaDele(painelDoAlerta).alertas.pontos} de 8 pontos e 4 enviados, e o painel da aula, quem enviou os 4`,
    );

    // ─── o Termômetro, na tela dela e no telão ─────────────────────────────
    painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.termometro !== null, { oQue: "o Termômetro" });
    const nomes = new Set(
      (painel.linhas ?? []).flatMap((l) => [l.nome, ...(l.equipe?.membros ?? []).map((m) => m.nome)]).filter(Boolean),
    );
    const termometro = prof.locator("[data-painel-da-aula] [data-termometro]").first();
    await revelar(prof, termometro, { timeout: 20_000 });
    await termometro.waitFor({ timeout: 20_000 });
    const textoDoTermometro = await termometro.innerText();
    const nomeNoTermometro = [...nomes].find((n) => textoDoTermometro.includes(n));
    r.exigir(
      nomes.size > 0 && !nomeNoTermometro,
      `nenhum dos ${nomes.size} nomes da turma aparece no Termômetro (achei "${nomeNoTermometro ?? ""}")`,
    );
    r.exigir(
      painel.termometro.unidades >= 1 && (await prof.locator("[data-termometro] [data-sem-dados]").count()) === 0,
      `com ${painel.termometro.unidades} unidade(s) que confirmaram, o Termômetro tem as barras (não “sem dados”)`,
    );
    const roteiro = (await prof.locator("[data-roteiro] li").allInnerTexts()).map((t) => t.trim());
    r.exigir(
      roteiro.length === 3 && roteiro.join("|") === painel.roteiro.perguntas.map((t) => t.trim()).join("|"),
      `depois da revelação aparece o roteiro da roda de conversa, com as 3 perguntas (${roteiro.length})`,
    );
    await termometro.scrollIntoViewIfNeeded();
    await r.registrar(prof, "termometro-da-turma", {
      titulo: "O Termômetro da Turma",
      mostra:
        "Quantas unidades repassaram ao menos uma falsa de formato sério, quantas verdadeiras " +
        "exageradas ficaram de fora e o cruzamento com o motivo votado — e o roteiro da roda.",
      prova:
        "A conta é da sala e não tem lugar para nome: o que vai para a parede não expõe criança nenhuma. " +
        "Com ninguém que confirmou, a tela escreveria “sem dados”, nunca 0%.",
      detalhe: `${painel.termometro.unidades} unidade(s) na conta`,
    });

    await prof.locator('[data-acao="projetar-termometro"]').click();
    const telao = prof.getByRole("dialog", { name: "Termômetro da Turma — Como a sala compartilhou" });
    await telao.waitFor({ timeout: 10_000 });
    const textoDoTelao = await telao.innerText();
    const nomeNoTelao = [...nomes].find((n) => textoDoTelao.includes(n));
    r.exigir(!nomeNoTelao, `o telão também não tem nome nenhum (achei "${nomeNoTelao ?? ""}")`);
    await r.registrar(prof, "telao", {
      titulo: "Projetar o Termômetro",
      mostra: "A janela em tela cheia, em letra grande, só com a conta da turma.",
      prova:
        "A tela da professora tem os selos e a folha com nomes; a parede, não. Projetar é um gesto " +
        "próprio, e o que ele abre não tem para onde vazar um nome.",
    });
    await telao.getByRole("button", { name: "Fechar", exact: true }).click();
    await telao.waitFor({ state: "hidden", timeout: 10_000 });

    // ═══ 2º BOTÃO: a síntese ══════════════════════════════════════════════
    await apertarBotaoDaAula("apresentar_sintese", "Apresentar Síntese", "Apresentar a síntese?", "explicar");
    await chegaSemRecarregar(q.getByText(/Participe da conversa na sala/), "a síntese");
    await r.registrar(p, "sintese", {
      titulo: "O gatilho do compartilhamento",
      mostra:
        "A lâmina desenhada no chat — urgência, autoridade aparente, indignação e calma técnica " +
        "desarmam o filtro de checagem — e o aviso de participar da conversa na sala.",
      prova:
        "A síntese ainda é o mensageiro: ele recebe foto de gráfico. A trava da roda diz o que vem " +
        "depois sem mostrar botão nenhum — quem solta a turma é a professora.",
    });

    // ═══ 3º BOTÃO: a reflexão — o robô do grupo, na casca (EF05CO04) ══════
    await apertarBotaoDaAula("liberar_reflexao", "Liberar Reflexão", "Liberar a reflexão?", "reflexao");
    await chegaSemRecarregar(q.getByRole("heading", { name: "Etapa 6 · Refletir", exact: true }), "o robô do grupo");
    const noRobo = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(noRobo.corpo?.passo === "regra", `a reflexão leva ao robô do grupo (passo=${noRobo.corpo?.passo})`);
    const roboDaSessao = noRobo.corpo?.robo ?? null;
    r.exigir(
      roboDaSessao?.ligacoes?.length === 0 && roboDaSessao?.enviado === null && roboDaSessao?.podeLigar === true,
      "o robô começa sem ligação e sem envio",
    );
    r.exigir(
      (roboDaSessao?.mensagens ?? []).map((m) => `${m.remetente}:${[...m.atributos].sort().join("+")}`).join(" | ") ===
        [
          "Tio Paulo · áudio 0:23:parente_proximo+urgente_alarmante",
          "Banco Seguro:link_nao_checado+urgente_alarmante",
          "Dona Rita, vizinha:",
          "Corrente:promessa_incrivel+urgente_alarmante",
        ].join(" | "),
      "as 4 mensagens do robô descem com os sinais ABERTOS — e só “urgente e alarmante” está nas três de risco",
    );
    const opcoesDoRobo = noRobo.corpo?.opcoes ?? {};
    r.exigir(
      ["condicoes", "acoes"].every(
        (k) => (opcoesDoRobo[k] ?? []).length > 0 && opcoesDoRobo[k].every((o) => Object.keys(o).sort().join() === "icone,id,rotulo"),
      ) &&
        /* `tipo` só nos BLOCOS: em `robo.mensagens` ele é o formato da mensagem (áudio, texto), aberto por desenho. */
        !/"tipo"/.test(JSON.stringify(opcoesDoRobo)) &&
        !/"(checagem|repasse|pegaTodosOsRiscos|riscos)"/.test(JSON.stringify(noRobo.corpo?.robo ?? {})),
      "os blocos descem com id, rótulo e ícone — o que cada ação faz fica no servidor",
    );
    const rotuloDo = (lista, id) => {
      const rotulo = (opcoesDoRobo[lista] ?? []).find((o) => o.id === id)?.rotulo;
      if (!rotulo) throw new Error(`o bloco "${id}" não está em opcoes.${lista} da sessão`);
      return rotulo;
    };
    r.exigir(
      (await q.locator(".unc-chatheader, .unc-messagebubble").count()) === 0,
      "o robô é a CASCA da escola: nada do mensageiro na tela (a fronteira do disfarce cruza aqui, uma vez)",
    );
    const perguntaAntiga = await lerApi(p, `/evidencias/${EXP_ID}/perguntas/p1`);
    r.exigir(
      perguntaAntiga.status === 404,
      `as perguntas P1/P2 saíram: GET /evidencias/${EXP_ID}/perguntas/p1 responde 404 (veio ${perguntaAntiga.status})`,
    );

    /** Um bloco da bandeja (`PuzzleBlock`), pelo NOME, dentro da seção dele. O desfecho é o bloco ficar pressionado. */
    const calha = q.locator(".unooria-puzzle-track");
    const tocarBloco = async (secao, rotulo) => {
      const bloco = q.locator(`section.robo__grupo[aria-label="${secao}"]`).getByRole("button", { name: rotulo, exact: true });
      await bloco.click();
      await q
        .locator(`section.robo__grupo[aria-label="${secao}"] button[aria-pressed="true"]`, { hasText: rotulo })
        .waitFor({ timeout: 5_000 })
        .catch(() => {
          throw new Error(`tocar no bloco “${rotulo}” (${secao}) não o encaixou no robô`);
        });
    };
    const ligar = q.getByRole("button", { name: "Ligar o robô", exact: true });
    r.exigir(await ligar.isDisabled(), "sem condição e ação, “Ligar o robô” fica apagado");
    await r.registrar(p, "robo-do-grupo", {
      titulo: "O robô do grupo",
      mostra:
        "Na casca da escola, a fala da Nina sobre o áudio assustado do tio, a calha “🤖 Cabeça do robô” vazia " +
        "e a bandeja: o laço, as quatro condições e as oito ações, com ícone e rótulo curto.",
      prova:
        "Montar o robô é criar um algoritmo com repetição (o laço), seleção (o SE) e sequência (ENTÃO e E " +
        "DEPOIS) — a EF05CO04. O laço não vem montado, e os blocos errados existem de propósito.",
    });

    // ─── 1ª ligação: SEM o laço ─────────────────────────────────────────────
    await tocarBloco("Condição (SE)", rotuloDo("condicoes", "urgente_alarmante"));
    await tocarBloco("Ação (ENTÃO, até 2 em ordem)", rotuloDo("acoes", "comparar_fonte"));
    await tocarBloco("Ação (ENTÃO, até 2 em ordem)", rotuloDo("acoes", "encaminhar_se_confirmar"));
    r.exigir(
      !(await ligar.isDisabled()) && (await calha.getByRole("button").count()) === 3,
      "com a condição e as duas ações na calha (sem o laço), “Ligar o robô” acende",
    );
    const reciboDaLigacao = () =>
      p.context().waitForEvent("response", {
        predicate: (x) => new URL(x.url()).pathname.endsWith("/quem-mandou-isso/robo/ligar") && x.request().method() === "POST",
        timeout: 30_000,
      });
    let recibo = reciboDaLigacao();
    await ligar.click();
    await esperarOuFalharPorHttp(p, q.getByText("O robô tratou 1 das 4 mensagens.", { exact: true }), /quem-mandou-isso\/robo\/ligar/, {
      timeout: 30_000,
      oQue: "ligar o robô sem o laço",
    });
    let ligado = await (await recibo).json().catch(() => null);
    const situacoes1 = (ligado?.robo?.ligacoes?.[0]?.resultados ?? []).map((x) => x.situacao);
    r.exigir(
      situacoes1.join() === "checa,nao_olhou,nao_olhou,nao_olhou",
      `sem o laço, o servidor só olha a 1ª mensagem (${situacoes1.join(", ")})`,
    );
    const acoesNaTela1 = (await q.locator(".robo__mensagem .robo__acao").allInnerTexts()).map(normalizar);
    r.exigir(
      acoesNaTela1.length === 4 &&
        acoesNaTela1[0].endsWith(TEXTO_DA_SITUACAO.checa) &&
        acoesNaTela1.slice(1).every((t) => t.endsWith(TEXTO_DA_SITUACAO.nao_olhou)),
      `a tela anima as 4: “${TEXTO_DA_SITUACAO.checa}” no tio e “${TEXTO_DA_SITUACAO.nao_olhou}” nas outras`,
    );
    r.exigir(
      normalizar(await q.getByRole("heading", { level: 1 }).first().innerText()) === "Robô ligado · 1 de 5",
      "o título conta a ligação: “Robô ligado · 1 de 5”",
    );
    r.exigir(!PALAVRAS_DE_ACERTO.test(await q.locator(".escola").innerText()), "e nada diz certo nem errado");
    await r.registrar(p, "robo-sem-laco", {
      titulo: "Sem o laço, o robô trata 1 das 4",
      mostra: "As quatro mensagens chegando, com os sinais embaixo de cada uma: o robô checou o áudio do tio e não olhou as outras três.",
      prova:
        "A tela não explica por quê: a criança vê que a regra olha um caso e não repete. Quem executou foi o " +
        "servidor, e o resultado é texto neutro, sem verde nem vermelho.",
    });

    // ─── 2ª ligação: com o laço ─────────────────────────────────────────────
    await q.getByRole("button", { name: "Mudar o robô", exact: true }).click();
    await q.getByRole("heading", { name: "Etapa 6 · Refletir", exact: true }).waitFor({ timeout: 10_000 });
    await tocarBloco("Repetição", opcoesDoRobo.laco?.rotulo ?? "para cada mensagem nova");
    r.exigir((await calha.getByRole("button").count()) === 4, "o robô volta montado como estava, e o laço entra na 1ª vaga");
    recibo = reciboDaLigacao();
    await ligar.click();
    await esperarOuFalharPorHttp(p, q.getByText("O robô tratou as 4 mensagens.", { exact: true }), /quem-mandou-isso\/robo\/ligar/, {
      timeout: 30_000,
      oQue: "ligar o robô com o laço",
    });
    ligado = await (await recibo).json().catch(() => null);
    const ligacoes = ligado?.robo?.ligacoes ?? [];
    const situacoes2 = (ligacoes[1]?.resultados ?? []).map((x) => x.situacao);
    r.exigir(
      situacoes2.join() === "checa,checa,passou,checa",
      `com o laço e “urgente e alarmante”, as três de risco checam e a vizinha passa direto (${situacoes2.join(", ")})`,
    );
    r.exigir(
      normalizar(await q.getByRole("heading", { level: 1 }).first().innerText()) === "Robô ligado · 2 de 5",
      "e o título conta a 2ª ligação",
    );
    await r.registrar(p, "robo-com-laco", {
      titulo: "Com o laço, o robô trata as 4",
      mostra: "O robô ligado de novo: checou o tio, o banco e a corrente; a vizinha, sem sinal, passou direto.",
      prova:
        "Repetir para cada mensagem nova é o que cobre as três mensagens de risco. A régua lê a PRIMEIRA " +
        "ligação: chegar ao robô completo só depois de vê-lo ligado é em processo.",
    });

    // ─── enviar o robô fecha a missão ──────────────────────────────────────
    const roboEnviadoEmPalavras = ligacoes[1]?.emPalavras ?? "";
    await q.getByRole("button", { name: "Enviar meu robô", exact: true }).click();
    await esperarOuFalharPorHttp(p, q.getByRole("heading", { name: "Missão Concluída" }), /quem-mandou-isso\/(robo|concluir)$/, {
      timeout: 30_000,
      oQue: "enviar o robô e concluir a missão",
    });
    const cardDoRobo = normalizar(await q.locator(".escola__regra").innerText());
    r.exigir(
      cardDoRobo.includes("Seu robô do grupo") &&
        cardDoRobo.includes(normalizar(roboEnviadoEmPalavras)) &&
        cardDoRobo.includes("Seu robô foi registrado e enviado ao professor."),
      `“Missão Concluída” mostra o card “Seu robô do grupo” com os blocos e a frase (“${roboEnviadoEmPalavras}”)`,
    );
    r.exigir(
      roboEnviadoEmPalavras.startsWith("Para cada mensagem nova, se a mensagem for urgente e alarmante,"),
      "a frase é a do robô com o laço",
    );
    r.exigir(!PALAVRAS_DE_ACERTO.test(await q.locator(".escola").innerText()), "e o fechamento não tem nível, acerto nem nota");
    const concluida = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      concluida.corpo?.passo === "concluida" && concluida.corpo?.concluido === true,
      `enviar o robô fecha a missão no servidor, sem outro toque (passo=${concluida.corpo?.passo})`,
    );
    await r.registrar(p, "missao-concluida", {
      titulo: "Missão Concluída",
      mostra: "A casca da escola com “Missão Concluída”, o card “Seu robô do grupo” em blocos e a frase, e a despedida da Nina.",
      prova:
        "A fronteira cruza uma vez só, no fim: o desafio do tio é sobre o grupo da FAMÍLIA, e por isso é a " +
        "escola que fala. Enviar o robô conclui a missão sozinho — o POST /concluir sai depois do envio.",
    });
    /* Sai do aparelho: o iframe continua falando com a api enquanto a página estiver nele. */
    await p.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });

    // ═══ PROFESSORA: a folha e as habilidades da BNCC ═════════════════════
    const esperado = {
      EF05CO08: nivelEsperadoCO08(escolhidas.map((id) => gabarito.get(id))),
      EF05CO03: nivelEsperadoCO03(pontosEsperados),
      EF05CO04: nivelEsperadoCO04(ligacoes, ligacoes[1]),
    };
    r.exigir(
      esperado.EF05CO03 === "atingiu" && esperado.EF05CO04 === "em_processo",
      `o roteiro produz os alertas com 7 de 8 (atingiu) e o robô que só ganhou o laço depois de ligado (em processo): ${JSON.stringify(esperado)}`,
    );
    const ROTULO_DO_MARCADOR = { EF05CO08: "Seleção do Mural", EF05CO03: "Alerta do grupo", EF05CO04: "Robô do grupo" };

    /* Toda rodada mede as três de novo (ADR-145), também com o MESMO pacote:
       numa corrida que zerou a turma, a rodada nova tem as três marcas. */
    const medidasAgora = Object.keys(esperado);
    const habilidades = await esperarNaApi(
      prof,
      caminhoDaEvidencia,
      (c) => medidasAgora.every((codigo) => Boolean(naRodada(c)[codigo])),
      { oQue: `as ${medidasAgora.length} marcas do estudante na evidência` },
    );
    r.exigir(habilidades.temFicha === true, "a exp05ef1b tem ficha pedagógica: o bloco de habilidades acende");
    const marcas = naRodada(habilidades);
    for (const codigo of medidasAgora) {
      r.exigir(
        marcas[codigo]?.status === esperado[codigo],
        `${codigo}: o painel registra “${marcas[codigo]?.status ?? "nada"}”, e a régua dá “${esperado[codigo]}”`,
      );
      r.exigir(
        marcas[codigo]?.rotulo === ROTULO_DO_MARCADOR[codigo],
        `${codigo}: o nível diz de onde veio — “${marcas[codigo]?.rotulo ?? "sem rótulo"}” (ADR-166)`,
      );
    }

    const painelFinal = await esperarNaApi(prof, `${daTurma}/painel`, (c) => linhaDele(c)?.robo != null, {
      oQue: "o robô na folha da turma",
    });
    r.exigir(
      linhaDele(painelFinal).robo.ligacoes === 2 &&
        normalizar(linhaDele(painelFinal).robo.emPalavras) === normalizar(roboEnviadoEmPalavras) &&
        painelFinal.progresso.enviaramRobo >= 1,
      `a folha traz o robô enviado em palavras e as ${linhaDele(painelFinal).robo.ligacoes} ligações, e o painel da aula conta quem enviou`,
    );

    await prof.reload({ waitUntil: "domcontentloaded" });
    const blocoDeHabilidades = prof.locator("section", { has: prof.getByText("Habilidades da BNCC", { exact: true }) }).last();
    await revelar(prof, blocoDeHabilidades);
    await blocoDeHabilidades.waitFor({ timeout: 30_000 });
    const textoDoBloco = await blocoDeHabilidades.innerText();
    r.exigir(
      ["EF05CO08", "EF05CO03", "EF05CO04"].every((c) => textoDoBloco.includes(c)),
      "o bloco Habilidades da BNCC mostra a EF05CO08, a EF05CO03 e a EF05CO04",
    );
    const criterios = blocoDeHabilidades.locator("[data-criterios-das-habilidades]");
    const textoDosCriterios = await criterios.innerText();
    r.exigir(
      textoDosCriterios.includes("Encaminha ao Mural da Turma as 3 mensagens verdadeiras.") &&
        textoDosCriterios.includes("Nos 4 alertas do grupo, monta filtros com E, OU e NÃO") &&
        textoDosCriterios.includes("Envia um robô que encaminha a mensagem antes de checar.") &&
        ["Atingiu:", "Em processo:", "Não atingiu:"].every((n) => textoDosCriterios.split(n).length - 1 >= 3),
      "no fim do bloco, cada uma das três habilidades tem o critério de Atingiu, Em processo e Não atingiu — o alerta e o robô",
    );
    await blocoDeHabilidades.scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "Habilidades da BNCC, por estudante",
      mostra: `A ${atividade.rodada}ª rodada da atividade: a EF05CO08 pela seleção do Mural, a EF05CO03 pelo alerta do grupo e a EF05CO04 pelo robô do grupo.`,
      prova:
        "O nível é do servidor e é conferido aqui contra a régua: a EF05CO08 vem das 3 escolhidas, a " +
        "EF05CO03 dos 4 alertas (7 de 8 pontos, atingiu) e a EF05CO04 do robô — que só ganhou o laço depois " +
        "da 1ª ligação, e por isso fica em processo. Tudo pelo que a criança FEZ (o Canal A).",
      detalhe: Object.entries(esperado)
        .map(([c, n]) => `${c}=${n}`)
        .join(" · "),
    });

    const folhaDaTurma = prof.locator("[data-folha]");
    const linhaNaFolha = folhaDaTurma.locator("tr", { hasText: estudante.nome });
    await revelar(prof, folhaDaTurma, { timeout: 20_000 });
    await linhaNaFolha.first().waitFor({ timeout: 20_000 });
    const cabecalhos = (await folhaDaTurma.locator("thead th").allInnerTexts()).map(normalizar);
    r.exigir(
      cabecalhos.includes("Alertas") &&
        cabecalhos.includes("Robô") &&
        !cabecalhos.some((c) => /Cartão de frases|Regra do tio|Se\/Então/i.test(c)),
      `a folha tem as colunas “Alertas” e “Robô”, e não as do cartão, da regra do tio nem do Se/Então (${cabecalhos.join(" · ")})`,
    );
    const colunaProibida = cabecalhos.find((c) => /pontos|nota|acerto|ranking|nível/i.test(c));
    r.exigir(!colunaProibida, `a folha não tem coluna de acerto, nota nem nível (achei "${colunaProibida ?? ""}")`);
    const textoDaLinha = normalizar(await linhaNaFolha.first().innerText());
    r.exigir(
      textoDaLinha.includes(`${pontosEsperados}/8 · 4/4 enviados`) &&
        textoDaLinha.includes(normalizar(roboEnviadoEmPalavras)) &&
        textoDaLinha.includes("ligado 2 vezes"),
      `a linha da criança traz “${pontosEsperados}/8 · 4/4 enviados”, o robô em palavras e “ligado 2 vezes”`,
    );
    await linhaNaFolha.first().scrollIntoViewIfNeeded();
    await r.registrar(prof, "folha-da-turma", {
      titulo: "O diário de bordo da turma",
      mostra:
        "Onde cada um está, as 3 mensagens encaminhadas com o quadrante, o motivo declarado, os pontos dos " +
        "alertas sobre 8 com quantos dos 4 foram enviados, e o robô em palavras, com quantas vezes foi ligado.",
      prova:
        "É a tela dela, não a do projetor: tem nome. O robô não é texto livre de menor — o servidor escreve a " +
        "frase a partir dos blocos. O nível por habilidade mora no bloco da BNCC, onde ela também o ajusta.",
    });

    // ═══ PROFESSORA: o podcast de recapitulação ══════════════════════════
    await provarPodcastNaAula(r, prof, {
      blocos: ["Abertura", "Recapitulação da vivência", "A revelação", "Provocação e conexão com a vida real", "Encerramento"],
      vozes: ["Lucas", "Camila"],
      trechos: 5,
      passo: "podcast",
      descricao: "Lucas e Camila, cerca de 3 min 40 s",
    });
  },
);
