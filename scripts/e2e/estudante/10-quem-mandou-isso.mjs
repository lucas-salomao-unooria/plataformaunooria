import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";

/**
 * Quem mandou isso? v2.2 (exp05ef1b), nas duas pontas da sala: a professora
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
 * 5. **As perguntas da Nina SÃO a reflexão** (ADR-145): Liberar Reflexão leva
 *    direto ao chat da Nina, sem a regra Se/Então e sem repetir a fala da
 *    abertura (o pedido do PO em 2026-10-05).
 * 6. **As perguntas do PO não expõem acerto**: o recibo é `{ enviada: true }`
 *    e a tela diz só "Resposta enviada". Quem sabe o nível é a professora, no
 *    bloco "Habilidades da BNCC" — e a suíte confere que o nível dali é o que
 *    a régua dá para as 3 escolhidas (EF05CO08) e para as alternativas
 *    marcadas (EF05CO03 e EF05CO04), em TODA rodada, e que o critério de cada
 *    nível está escrito no fim do bloco.
 * 7. **O Termômetro não tem nome**, nem no painel nem no telão.
 *
 * A suíte NÃO aperta "Gerar Atividade com IA": uma corrida que depende do
 * Vertex reprova por fornecedor e reporta como se o produto tivesse quebrado.
 * Ela cria a atividade pelo assistente ("Nova atividade" na ficha) a partir do
 * pacote curado padrão, que também é curadoria (passa pelos olhos da
 * professora e pelo clique dela em "Criar atividade").
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
    subtitulo: "exatamente 3, o latch, os três botões da professora e as perguntas da Nina",
    contexto:
      "A Nina pede ajuda: rolou uma confusão sobre o passeio ao museu. No grupo da turma chegam " +
      "oito mensagens — verdadeiras e falsas, calmas e alarmadas —, e a criança encaminha " +
      "exatamente três ao Mural da Turma e vota no motivo. Quando a professora libera a " +
      "revelação, cada mensagem ganha dois selos; depois vêm a síntese e a reflexão: duas perguntas " +
      "rápidas da Nina.",
    prova: [
      "A atividade nasce da professora, pelo assistente — conteúdo, equipes e criar —, e sem uma em andamento a missão não abre",
      "Criada com “Pôr no ar agora”, a Nina chega sozinha à tela do estudante, sem recarregar",
      "Antes da revelação a sessão do estudante não carrega veracidade nem tom de mensagem nenhuma",
      "A quarta seta avisa o limite e não abre a folha; o servidor recusa 4 e recusa 2",
      "Confirmado, o Mural não muda mais — nem pela tela, nem por chamada direta",
      "Revelação, síntese e reflexão chegam à tela do estudante por polling, sem recarregar",
      "Os crachás são os do gabarito do servidor, só das 3 escolhidas, e um F5 os devolve",
      "O Termômetro da Turma não tem nome, no painel nem no telão",
      "Liberar Reflexão leva direto às perguntas da Nina, sem repetir a fala da abertura",
      "As perguntas da Nina respondem só “Resposta enviada” — nenhum acerto chega à criança",
      "O bloco Habilidades da BNCC mostra EF05CO08, EF05CO03 e EF05CO04 com o nível que a régua v2 dá",
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
      q = p.frameLocator('iframe[title="experiencia"]');
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

    /* "Usar Pacote Curado Padrão" CARREGA o pacote na curadoria e não grava
       nada. O desfecho é o recado dele — a curadoria pode já estar na tela com
       o rascunho de uma geração anterior, e esperar só por ela seria esperar o
       passado. */
    await prof.locator('[data-acao="usar-padrao"]').click();
    await esperarOuFalharCedo(
      prof.getByText(`Pacote curado “${padrao.nome}” carregado.`),
      prof.locator("[data-preparo]").locator(ALERTA_DE_ERRO),
      { timeout: 20_000, oQue: "carregar o pacote curado na curadoria" },
    );
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
      mostra: `O passo Conteúdo da criação: o pacote curado “${padrao.nome}” nos quatro quadrantes — verdadeira ou falsa, emocional ou neutra —, com o texto editável, o componente curricular ${rotuloDaDisciplina} e o selo “8 / 8 validados”.`,
      prova:
        "O pacote curado é ponto de partida, não atividade: nada é gravado antes de “Criar atividade”. Os " +
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
        prof.getByText(new RegExp(`a ${rodada + 1}ª rodada fica no histórico`)),
        prof.locator(ALERTA_DE_ERRO),
        { timeout: 30_000, oQue: "zerar a turma" },
      );
      /* A aba da rodada nova aparece na hora, sem recarregar (o PO, 2026-10-05):
         antes ela só existia depois da primeira evidência e de um F5. */
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
      await prof.locator("[data-zerar-turma]").scrollIntoViewIfNeeded();
      await r.registrar(prof, "turma-zerada", {
        titulo: "Zerar abre uma rodada nova, e nada é apagado",
        mostra: `Na página da atividade em andamento, a ${painel.turma.nome} na ${rodada + 1}ª rodada, com o mesmo pacote; a ${rodada}ª fica no histórico.`,
        prova:
          "É a reaplicação da evidência (E14): a rodada anterior não some — o painel de habilidades " +
          "fica com a melhor de cada habilidade. E a confirmação é deliberada: um toque perdido no " +
          "botão não move a sala inteira para o começo.",
      });
    } else {
      r.ressalva(
        "a atividade estava no começo de uma rodada (criada agora, ou posta no ar de novo): zerar não foi preciso nesta corrida",
      );
    }
    const atividade = painel.atividade;

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
    q = p.frameLocator('iframe[title="experiencia"]');
    await esperarOuFalharPorHttp(p, q.locator(".crachas").first(), /quem-mandou-isso\/sessao/, {
      timeout: 40_000,
      oQue: "a revelação depois do F5",
    });
    r.exigir((await q.locator(".crachas").count()) === 3, "o F5 devolve a revelação com os 3 pares de crachás");

    // ─── o Termômetro, na tela dela e no telão ─────────────────────────────
    painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.termometro !== null, { oQue: "o Termômetro" });
    const nomes = new Set(
      (painel.linhas ?? []).flatMap((l) => [l.nome, ...(l.equipe?.membros ?? []).map((m) => m.nome)]).filter(Boolean),
    );
    const termometro = prof.locator("[data-painel-da-aula] [data-termometro]").first();
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

    // ═══ 3º BOTÃO: a reflexão — as perguntas da Nina (ADR-145) ═════════════
    await apertarBotaoDaAula("liberar_reflexao", "Liberar Reflexão", "Liberar a reflexão?", "reflexao");
    await chegaSemRecarregar(q.locator(".unc-poll:not(.unc-poll--voted)").first(), "as perguntas da Nina");
    const convite = s0.textos?.nina?.convite ?? "";
    r.exigir(
      convite !== "" && !(await q.locator(".conversa").innerText()).includes(convite),
      "o chat das perguntas não repete a fala da abertura, que mandava ao grupo e ao Mural",
    );
    r.exigir(
      (await q.locator(".escola").count()) === 0,
      "a reflexão é no mensageiro: não há mais a regra Se/Então na casca da escola",
    );
    await r.registrar(p, "reflexao-perguntas", {
      titulo: "A reflexão: as perguntas da Nina",
      mostra: "Liberada a reflexão, o chat da Nina abre direto na primeira pergunta, sem a fala do começo.",
      prova:
        "A regra Se/Então dissertativa saiu: a missão avalia por critérios fixos, e a etapa 6 são as duas " +
        "perguntas de múltipla escolha. A fala da abertura não volta, porque ela pedia o que já foi feito.",
    });

    // ═══ AS PERGUNTAS DA NINA ═════════════════════════════════════════════
    const idsDasPerguntas = (s0.textos?.perguntas ?? []).map((x) => x.perguntaId);
    r.exigir(idsDasPerguntas.length === 2, `são duas perguntas da Nina (${idsDasPerguntas.join(", ")})`);

    /* A pergunta que desce: sem o nível de nenhuma alternativa, e EMBARALHADA
       no servidor a cada leitura — "a primeira é a certa" não pode virar pista.
       Oito leituras: a chance de todas saírem na mesma ordem é (1/6)^7. */
    const leituras = [];
    for (let i = 0; i < 8; i += 1) leituras.push((await lerApi(p, `/evidencias/${EXP_ID}/perguntas/${idsDasPerguntas[0]}`)).corpo);
    r.exigir(
      leituras.every((l) => (l?.alternativas ?? []).length === 3 && l.alternativas.every((a) => Object.keys(a).sort().join() === "id,texto")),
      "a pergunta desce com 3 alternativas, cada uma só com id e texto — o nível fica no servidor",
    );
    const ordens = new Set(leituras.map((l) => (l?.alternativas ?? []).map((a) => a.id).join(",")));
    r.exigir(ordens.size > 1, `as alternativas chegam embaralhadas a cada leitura (${ordens.size} ordens em 8 leituras)`);

    const alternativaDe = {};
    for (const [indice, perguntaId] of idsDasPerguntas.entries()) {
      const enquete = q.locator(".unc-poll:not(.unc-poll--voted)");
      await enquete.first().waitFor({ timeout: 20_000 });
      const opcao = enquete.first().locator(".unc-poll__option").first();
      await opcao.click();
      /* O Votar acende quando a escolha chegou ao estado da tela — só então o
         rádio marcado diz qual alternativa (pelo id, nunca pela posição). */
      const votarNaPergunta = enquete.first().locator(".unc-poll__vote:not([disabled])");
      await votarNaPergunta.waitFor({ timeout: 10_000 });
      alternativaDe[perguntaId] = await enquete.first().locator("input[type=radio]:checked").getAttribute("value");
      /* A resposta do iframe é cross-origin: quem a vê com certeza é o CONTEXTO. */
      const recibo = p
        .context()
        .waitForEvent("response", {
          predicate: (x) => x.url().includes(`/perguntas/${perguntaId}/resposta`) && x.request().method() === "POST",
          timeout: 30_000,
        });
      await votarNaPergunta.click();
      await esperarOuFalharPorHttp(p, q.locator(".unc-poll--voted").nth(indice), /evidencias\/exp05ef1b\/perguntas/, {
        timeout: 30_000,
        oQue: `responder a pergunta ${perguntaId}`,
      });
      const corpo = await (await recibo).json().catch(() => null);
      r.exigir(
        JSON.stringify(corpo) === JSON.stringify({ enviada: true }),
        `o recibo da ${perguntaId} é só { enviada: true } — a criança não sabe, pela resposta, se acertou`,
      );
    }
    r.exigir(
      (await q.locator(".unc-poll__voted", { hasText: "Resposta enviada" }).count()) === 2,
      "as duas enquetes mostram “Resposta enviada”, e nada mais",
    );
    const textoDasPerguntas = await q.locator(".conversa").innerText();
    r.exigir(
      !PALAVRAS_DE_ACERTO.test(textoDasPerguntas),
      `nenhum nível, acerto ou nota na conversa da Nina (achei "${textoDasPerguntas.match(PALAVRAS_DE_ACERTO)?.[0] ?? ""}")`,
    );
    await r.registrar(p, "perguntas-da-nina", {
      titulo: "Duas perguntas rápidas da Nina",
      mostra: "De volta ao chat da Nina: as duas enquetes respondidas, cada uma com “Resposta enviada”, e a despedida dela.",
      prova:
        "São as perguntas de evidência do PO, com a MESMA enquete do Mural. O enunciado e as " +
        "alternativas vêm da ficha pedagógica, embaralhados; o nível nunca desce, e quem o lê é a professora.",
    });

    await esperarOuFalharPorHttp(p, q.getByRole("heading", { name: "Missão Concluída" }), /quem-mandou-isso\/concluir/, {
      timeout: 30_000,
      oQue: "concluir a missão",
    });
    r.exigir(!PALAVRAS_DE_ACERTO.test(await q.locator(".escola").innerText()), "e o fechamento não tem nível, acerto nem nota");
    const concluida = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      concluida.corpo?.passo === "concluida" && concluida.corpo?.concluido === true,
      `a missão fecha no servidor (passo=${concluida.corpo?.passo})`,
    );
    await r.registrar(p, "missao-concluida", {
      titulo: "Missão Concluída",
      mostra: "A casca da escola com “Missão Concluída”.",
      prova:
        "A fronteira cruza uma vez só, no fim: as perguntas são a Nina falando (dentro da ficção), e o " +
        "fechamento é a escola.",
    });
    /* Sai do aparelho: o iframe continua falando com a api enquanto a página estiver nele. */
    await p.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });

    // ═══ PROFESSORA: a folha e as habilidades da BNCC ═════════════════════
    const material = await lerApi(prof, "/quem-mandou-isso/professor/material");
    const nivelDaAlternativa = (perguntaId) =>
      (material.corpo?.perguntasDeEvidencia ?? [])
        .find((x) => x.perguntaId === perguntaId)
        ?.alternativas.find((a) => a.id === alternativaDe[perguntaId])?.status ?? null;
    const habilidadeDa = (perguntaId) =>
      (material.corpo?.perguntasDeEvidencia ?? []).find((x) => x.perguntaId === perguntaId)?.habilidade ?? null;
    const esperado = {
      EF05CO08: nivelEsperadoCO08(escolhidas.map((id) => gabarito.get(id))),
      [habilidadeDa(idsDasPerguntas[0])]: nivelDaAlternativa(idsDasPerguntas[0]),
      [habilidadeDa(idsDasPerguntas[1])]: nivelDaAlternativa(idsDasPerguntas[1]),
    };
    r.exigir(
      Object.keys(esperado).sort().join(",") === "EF05CO03,EF05CO04,EF05CO08",
      `a P1 mede a EF05CO03 e a P2 a EF05CO04 (${JSON.stringify(esperado)})`,
    );

    /* Toda rodada mede as três de novo (ADR-145), também com o MESMO pacote:
       numa corrida que zerou a turma, a rodada nova tem as três marcas. */
    const caminhoDaEvidencia = `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividade.pacoteId}`;
    const doEstudante = (c) => c?.estudantes?.find((e) => e.nome === estudante.nome);
    const medidasAgora = Object.keys(esperado);
    const habilidades = await esperarNaApi(
      prof,
      caminhoDaEvidencia,
      (c) => Object.keys(doEstudante(c)?.porRodada?.[String(atividade.rodada)] ?? {}).length >= medidasAgora.length,
      { oQue: `as ${medidasAgora.length} marcas do estudante na evidência` },
    );
    r.exigir(habilidades.temFicha === true, "a exp05ef1b tem ficha pedagógica: o bloco de habilidades acende");
    const marcas = doEstudante(habilidades).porRodada[String(atividade.rodada)];
    for (const codigo of medidasAgora) {
      r.exigir(
        marcas[codigo]?.status === esperado[codigo],
        `${codigo}: o painel registra “${marcas[codigo]?.status ?? "nada"}”, e a régua dá “${esperado[codigo]}”`,
      );
    }

    await prof.reload({ waitUntil: "domcontentloaded" });
    const blocoDeHabilidades = prof.locator("section", { has: prof.getByText("Habilidades da BNCC", { exact: true }) }).last();
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
        ["Atingiu:", "Em processo:", "Não atingiu:"].every((n) => textoDosCriterios.split(n).length - 1 >= 3),
      "no fim do bloco, cada uma das três habilidades tem o critério de Atingiu, Em processo e Não atingiu",
    );
    await blocoDeHabilidades.scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "Habilidades da BNCC, por estudante",
      mostra: `A ${atividade.rodada}ª rodada da atividade: a EF05CO08 pela seleção do Mural, a EF05CO03 pela P1 e a EF05CO04 pela P2.`,
      prova:
        "O nível é do servidor e é conferido aqui contra a régua v2: a EF05CO08 vem das 3 escolhidas " +
        "(só três verdadeiras atingem, em toda rodada), e a CO03/CO04, da alternativa marcada. " +
        "O critério de cada nível está escrito no fim do bloco, para a professora consultar e ajustar.",
      detalhe: Object.entries(esperado)
        .map(([c, n]) => `${c}=${n}`)
        .join(" · "),
    });

    const folhaDaTurma = prof.locator("[data-folha]");
    const linhaNaFolha = folhaDaTurma.locator("tr", { hasText: estudante.nome });
    await linhaNaFolha.first().waitFor({ timeout: 20_000 });
    const cabecalhos = await folhaDaTurma.locator("thead th").allInnerTexts();
    r.exigir(
      !cabecalhos.some((c) => /Se\/Então|regra/i.test(c)),
      `a folha não tem mais a coluna da regra Se/Então (${cabecalhos.join(" · ")})`,
    );
    const colunaProibida = cabecalhos.find((c) => /pontos|nota|acerto|ranking|nível/i.test(c));
    r.exigir(!colunaProibida, `a folha não tem coluna de acerto, nota nem nível (achei "${colunaProibida ?? ""}")`);
    await linhaNaFolha.first().scrollIntoViewIfNeeded();
    await r.registrar(prof, "folha-da-turma", {
      titulo: "O diário de bordo da turma",
      mostra: "Onde cada um está, as 3 mensagens encaminhadas com o quadrante e o motivo declarado.",
      prova:
        "É a tela dela, não a do projetor: tem nome. Não tem coluna de acerto — o nível por habilidade " +
        "mora no bloco da BNCC, onde ela também o ajusta.",
    });
  },
);
