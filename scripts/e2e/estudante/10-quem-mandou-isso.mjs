import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { esperarFalasDoTema, provarFalasNaCriacao, provarPodcastNaAula } from "../lib/podcast.mjs";

/**
 * Quem mandou isso? v2.2 (exp05ef1b, 0.5.0 — só o Canal A), nas duas pontas da sala: a professora
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
 * 5. **O cartão de frases vem com os crachás** (EF05CO03): no fim do Mural
 *    revelado, seis frases com E, OU e NÃO sobre as 3 mensagens encaminhadas,
 *    cada uma com Sim/Não. As frases descem SEM a resposta esperada; a suíte
 *    a calcula como a criança — os crachás dão os valores simples, a frase pede
 *    a operação — e responde as seis certas. O recibo é o estado com
 *    `cartao.enviado`, sem acerto nenhum.
 * 6. **A reflexão é a regra do tio, na casca** (EF05CO04): Liberar Reflexão
 *    leva ao desafio do tio, montado com peças. A criança PREVÊ o que a regra
 *    faz com o áudio antes de cada teste; a suíte testa primeiro uma regra que
 *    só manda esperar (com a previsão certa), corrige para a que checa antes de
 *    encaminhar, testa de novo e envia — e a missão fecha sozinha.
 * 7. **Nenhum acerto chega à criança.** Quem sabe o nível é a professora, no
 *    bloco "Habilidades da BNCC" — e a suíte confere que o nível dali é o que
 *    a régua dá: as 3 escolhidas (EF05CO08), as 6 frases certas (EF05CO03,
 *    atingiu) e a regra que só checou depois do retorno do teste (EF05CO04, em
 *    processo), em TODA rodada, e que o critério de cada nível está escrito no
 *    fim do bloco. As perguntas P1/P2 saíram: a rota delas responde 404.
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

/** A régua da EF05CO03, à parte da api (`regras/operacoes.ts#nivelCO03`): 5–6 acertos atingem, 3–4 em processo. */
function nivelEsperadoCO03(acertos) {
  if (acertos >= 5) return "atingiu";
  if (acertos >= 3) return "em_processo";
  return "nao_atingiu";
}

/**
 * A régua da EF05CO04, à parte da api (`regras/regra.ts#nivelCO04`), sobre o
 * que o SERVIDOR disse que cada regra fez com o áudio (`situacao`). Vale para
 * as regras desta suíte, que pegam o áudio: "não atingiu" de verdade é
 * "encaminha antes de checar" para QUALQUER mensagem, e uma regra que deixa o
 * áudio passar e ainda assim repassa não aparece aqui.
 */
function nivelEsperadoCO04(testes, situacaoDaEnviada) {
  if (situacaoDaEnviada === "repassa_antes") return "nao_atingiu";
  const primeiro = testes[0];
  if (primeiro?.situacao === "checa" && primeiro?.previsao === "checa" && situacaoDaEnviada === "checa") return "atingiu";
  return "em_processo";
}

/** O que cada teste da regra escreve na tela (`regras/regra.ts#RESULTADO_DO_TESTE`) — o oráculo dos cards. */
const RESULTADO_DO_TESTE = {
  sem_conferir: "Sua regra pegou o áudio, mas não diz como conferir.",
  checa: "Sua regra pegou o áudio e mandou você checar antes de encaminhar.",
};

/** Os campos da regra do tio, pelo NOME do combobox do `Selection` (`textos.ts#regra`). */
const CAMPO_DA_REGRA = {
  se: /^SE a mensagem for/,
  entao: /^ENTÃO eu/,
  depois: /^E DEPOIS/,
  previsao: /^O que a sua regra vai fazer com o áudio do tio/,
};

const normalizar = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

/**
 * Como a frase do cartão cita a mensagem (`regras/operacoes.ts#referenciaDa`):
 * quem mandou e as 4 primeiras palavras, entre aspas curvas.
 */
function referenciaDa(m) {
  const palavras = m.texto.replace(/\s+/g, " ").trim().split(" ");
  const inicio = palavras
    .slice(0, 4)
    .join(" ")
    .replace(/[,.;:!?…]+$/u, "");
  return `A mensagem de ${m.remetente} “${inicio}${palavras.length > 4 ? "…" : ""}”`;
}

/**
 * A resposta CERTA de uma frase do cartão, calculada como a criança a calcula:
 * os crachás dão os dois valores simples da mensagem (veracidade e tom), e a
 * frase pede a operação sobre eles. `mensagens` são as 3 encaminhadas, com o
 * texto do grupo e o gabarito que a revelação trouxe.
 */
function respostaCertaDaFrase(frase, mensagens) {
  const candidatas = mensagens
    .map((m) => ({ m, ref: referenciaDa(m) }))
    .filter(({ ref }) => frase.texto.startsWith(ref))
    .sort((a, b) => b.ref.length - a.ref.length);
  if (!candidatas.length) throw new Error(`a frase ${frase.id} não cita nenhuma das 3 mensagens encaminhadas: "${frase.texto}"`);
  const { m, ref } = candidatas[0];
  const resto = frase.texto.slice(ref.length);
  const tem = (valor) => valor === m.veracidade || valor === m.tom;
  const negacao = resto.match(/^ NÃO é (\S+)\.$/u);
  if (frase.operador === "NAO" && negacao) return tem(negacao[1]) ? "nao" : "sim";
  const binaria = resto.match(/^ é (\S+) (E|OU) (\S+)\.$/u);
  if (binaria && binaria[2] === frase.operador) {
    const [a, b] = [tem(binaria[1]), tem(binaria[3])];
    return (frase.operador === "E" ? a && b : a || b) ? "sim" : "nao";
  }
  throw new Error(`a frase ${frase.id} (${frase.operador}) não tem a forma que o cartão promete: "${frase.texto}"`);
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
    subtitulo: "exatamente 3, o latch, os três botões da professora, o cartão de frases e a regra do tio",
    contexto:
      "A Nina pede ajuda: rolou uma confusão sobre o passeio ao museu. No grupo da turma chegam " +
      "oito mensagens — verdadeiras e falsas, calmas e alarmadas —, e a criança encaminha " +
      "exatamente três ao Mural da Turma e vota no motivo. Quando a professora libera a " +
      "revelação, cada mensagem ganha dois selos e a Nina manda um cartão de frases com E, OU e NÃO " +
      "sobre as três; depois vêm a síntese e a reflexão: a regra do tio, montada com peças, prevista " +
      "e testada no áudio dele.",
    prova: [
      "A atividade nasce da professora, pelo assistente — conteúdo, equipes e criar —, e sem uma em andamento a missão não abre",
      "Criada com “Pôr no ar agora”, a Nina chega sozinha à tela do estudante, sem recarregar",
      "Antes da revelação a sessão do estudante não carrega veracidade nem tom de mensagem nenhuma",
      "A quarta seta avisa o limite e não abre a folha; o servidor recusa 4 e recusa 2",
      "Confirmado, o Mural não muda mais — nem pela tela, nem por chamada direta",
      "Revelação, síntese e reflexão chegam à tela do estudante por polling, sem recarregar",
      "Os crachás são os do gabarito do servidor, só das 3 escolhidas, e um F5 os devolve",
      "O Termômetro da Turma não tem nome, no painel nem no telão",
      "Depois dos crachás, o cartão de 6 frases desce sem a resposta esperada, e o envio não devolve acerto",
      "Liberar Reflexão leva à regra do tio, na casca: prever, testar, corrigir e enviar fecham a missão",
      "As perguntas P1/P2 saíram: a rota delas responde 404 para esta missão",
      "O bloco Habilidades da BNCC mostra EF05CO08, EF05CO03 (cartão) e EF05CO04 (regra) com o nível que a régua dá",
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
        prof.getByText(new RegExp(`a ${rodada + 1}ª rodada avalia a turma do zero`)),
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
    q = p.frameLocator('iframe[data-experiencia]');
    await esperarOuFalharPorHttp(p, q.locator(".crachas").first(), /quem-mandou-isso\/sessao/, {
      timeout: 40_000,
      oQue: "a revelação depois do F5",
    });
    r.exigir((await q.locator(".crachas").count()) === 3, "o F5 devolve a revelação com os 3 pares de crachás");

    // ═══ O CARTÃO DE FRASES (EF05CO03), no fim do Mural revelado ══════════
    /* O cartão desce JUNTO com a revelação — depende do gabarito das três —,
       e SEM a resposta esperada: o servidor gera as frases com semente na
       sessão e guarda a certa só no envio. A suíte calcula a certa como a
       criança: os crachás dão os valores simples, a frase pede a operação. */
    const comCartao = await lerApi(p, "/quem-mandou-isso/sessao");
    const cartao = comCartao.corpo?.cartao ?? null;
    if (!r.exigir(cartao !== null && cartao.frases?.length === 6, `o cartão de 6 frases desce com a revelação (${cartao?.frases?.length ?? "nenhum"})`)) return;
    r.exigir(cartao.enviado === false, "e ainda não foi enviado");
    r.exigir(
      cartao.frases.every((f) => Object.keys(f).sort().join() === "id,operador,texto") &&
        !JSON.stringify(comCartao.corpo).includes('"esperado"'),
      "cada frase desce só com id, operador e texto — a resposta esperada não está no estado",
    );
    const porOperador = cartao.frases.reduce((acc, f) => ({ ...acc, [f.operador]: (acc[f.operador] ?? 0) + 1 }), {});
    r.exigir(
      porOperador.E === 2 && porOperador.OU === 2 && porOperador.NAO === 2,
      `duas frases com E, duas com OU e duas com NÃO (${JSON.stringify(porOperador)})`,
    );

    const frasesNaTela = q.locator("fieldset.cartao__frase");
    await esperarOuFalharPorHttp(p, frasesNaTela.nth(5), /quem-mandou-isso\/(sessao|gate)/, {
      timeout: 20_000,
      oQue: "o cartão de frases no fim do Mural",
    });
    const legendas = (await q.locator("fieldset.cartao__frase legend").allInnerTexts()).map(normalizar);
    r.exigir(
      legendas.length === 6 && legendas.every((t, i) => t === normalizar(cartao.frases[i].texto)),
      "a tela mostra as 6 frases do estado, na mesma ordem, com o operador em destaque",
    );
    r.exigir(
      (await q.getByText("OU vale se uma das partes for verdadeira, ou as duas.", { exact: true }).count()) === 1,
      "e a dica do OU fica à vista: em português “ou” costuma soar exclusivo",
    );
    await frasesNaTela.first().scrollIntoViewIfNeeded();
    await r.registrar(p, "cartao-de-frases", {
      titulo: "O cartão de frases da Nina",
      mostra:
        "No fim do Mural revelado, a fala da Nina e seis frases sobre as três mensagens encaminhadas — " +
        "“é falsa E neutra”, “é verdadeira OU emocional”, “NÃO é emocional” —, cada uma com Sim e Não.",
      prova:
        "Os crachás dão os valores simples, e a frase composta quem resolve é a criança: é a operação " +
        "com E, OU e NÃO que a EF05CO03 mede. Três frases certas e três erradas — responder tudo igual " +
        "acerta só a metade —, e a resposta esperada nunca desceu ao navegador.",
      detalhe: cartao.frases.map((f) => f.operador).join(" · "),
    });

    /* As 3 encaminhadas, com o texto do grupo (de onde a frase tira a
       citação) e os dois eixos que a revelação trouxe. */
    const mensagensDoCartao = revelacao.mensagens.map((g) => ({
      ...g,
      ...s0.pacote.mensagens.find((m) => m.id === g.id),
    }));
    const enviarRespostas = q.locator(".rodape__acao").getByRole("button", { name: "Enviar respostas", exact: true });
    let acertosEsperados = 0;
    for (const [i, frase] of cartao.frases.entries()) {
      const certa = respostaCertaDaFrase(frase, mensagensDoCartao);
      if (i === 5) {
        r.exigir(await enviarRespostas.isDisabled(), "com 5 das 6 respondidas, “Enviar respostas” ainda não acende");
      }
      /* O `<input>` do Radio do Unoochat é recortado (1px, clip): o clique vai
         no `<label>` que o embrulha, e o portão é o input MARCADO. */
      const naTela = frasesNaTela.nth(i);
      await naTela.locator(`label.unc-radio:has(input[value="${certa}"])`).click();
      await naTela
        .locator(`input[value="${certa}"]:checked`)
        .waitFor({ state: "attached", timeout: 5_000 })
        .catch(() => {
          throw new Error(`marcar “${certa}” na frase ${frase.id} não moveu o estado da tela`);
        });
      acertosEsperados += 1;
    }
    await q
      .locator(".rodape__acao button:not([disabled])", { hasText: "Enviar respostas" })
      .waitFor({ timeout: 10_000 })
      .catch(() => {
        throw new Error("com as 6 frases respondidas, “Enviar respostas” não acendeu");
      });
    /* A resposta do iframe é cross-origin: quem a vê com certeza é o CONTEXTO. */
    const reciboDoCartao = p.context().waitForEvent("response", {
      predicate: (x) => /\/quem-mandou-isso\/operacoes$/.test(new URL(x.url()).pathname) && x.request().method() === "POST",
      timeout: 30_000,
    });
    await enviarRespostas.click();
    await esperarOuFalharPorHttp(p, q.getByText("Respostas enviadas.", { exact: true }), /quem-mandou-isso\/operacoes/, {
      timeout: 30_000,
      oQue: "enviar o cartão de frases",
    });
    const estadoDoCartao = await (await reciboDoCartao).json().catch(() => null);
    r.exigir(
      estadoDoCartao?.cartao?.enviado === true &&
        !/"(esperado|acertos|nivel|status)"/.test(JSON.stringify(estadoDoCartao?.cartao ?? {})),
      "o recibo é o estado com `cartao.enviado` — sem resposta esperada, acerto nem nível",
    );
    r.exigir(
      (await frasesNaTela.locator("input:disabled").count()) === 12 && (await enviarRespostas.count()) === 0,
      "enviado, o cartão trava (os 12 botões desabilitados) e o “Enviar respostas” some",
    );
    await q.getByText("Respostas enviadas.", { exact: true }).scrollIntoViewIfNeeded();
    await r.registrar(p, "cartao-enviado", {
      titulo: "Respostas enviadas",
      mostra: "As seis frases respondidas e travadas, e a linha “Respostas enviadas.” no fim do Mural.",
      prova:
        "Nada diz se a criança acertou: o servidor recalcula as frases da sessão, confere e marca a " +
        "EF05CO03 na mesma transação do envio. Quem lê o nível é a professora.",
    });

    /* A marca chega ao painel de habilidades da professora no envio, antes da
       síntese — o cartão segue o caminho da criança, não o botão dela. */
    const caminhoDaEvidencia = `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividade.pacoteId}`;
    const doEstudante = (c) => c?.estudantes?.find((e) => e.nome === estudante.nome);
    const naRodada = (c) => doEstudante(c)?.porRodada?.[String(atividade.rodada)] ?? {};
    const depoisDoCartao = await esperarNaApi(prof, caminhoDaEvidencia, (c) => Boolean(naRodada(c).EF05CO03), {
      oQue: "a marca da EF05CO03 depois do cartão",
    });
    const celulaCO03 = naRodada(depoisDoCartao).EF05CO03;
    r.exigir(
      celulaCO03.status === nivelEsperadoCO03(acertosEsperados),
      `EF05CO03 pelo cartão: o painel registra “${celulaCO03.status}”, e a régua dá “${nivelEsperadoCO03(acertosEsperados)}” para ${acertosEsperados} de 6`,
    );
    r.exigir(celulaCO03.rotulo === "Cartão de frases", `e diz de onde veio o nível: “${celulaCO03.rotulo ?? "sem rótulo"}”`);
    r.exigir(!naRodada(depoisDoCartao).EF05CO04, "a EF05CO04 ainda não tem marca: a regra do tio não foi enviada");
    const painelDoCartao = await esperarNaApi(prof, `${daTurma}/painel`, (c) => linhaDele(c)?.cartao != null, {
      oQue: "o cartão na folha da turma",
    });
    r.exigir(
      linhaDele(painelDoCartao).cartao.acertos === acertosEsperados && painelDoCartao.progresso.responderamCartao >= 1,
      `a folha da professora conta ${linhaDele(painelDoCartao).cartao.acertos} de 6 certas, e o painel da aula, quem respondeu o cartão`,
    );

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

    // ═══ 3º BOTÃO: a reflexão — a regra do tio, na casca (EF05CO04) ═══════
    await apertarBotaoDaAula("liberar_reflexao", "Liberar Reflexão", "Liberar a reflexão?", "reflexao");
    await chegaSemRecarregar(q.getByRole("heading", { name: "O desafio do tio", exact: true }), "a regra do tio");
    const naRegra = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      naRegra.corpo?.passo === "regra" && naRegra.corpo?.cartao?.enviado === true,
      `com o cartão enviado, a reflexão leva direto à regra (passo=${naRegra.corpo?.passo})`,
    );
    r.exigir(
      naRegra.corpo?.regra?.testes?.length === 0 && naRegra.corpo?.regra?.enviada === null && naRegra.corpo?.regra?.podeTestar === true,
      "a regra começa sem teste e sem envio",
    );
    const opcoesDaRegra = naRegra.corpo?.opcoes ?? {};
    r.exigir(
      ["condicoes", "acoes", "previsoes"].every(
        (k) => (opcoesDaRegra[k] ?? []).length > 0 && opcoesDaRegra[k].every((o) => Object.keys(o).sort().join() === "id,rotulo"),
      ),
      "as peças descem só com id e rótulo — o que cada uma faz com o áudio do tio fica no servidor",
    );
    const rotuloDa = (lista, id) => {
      const rotulo = (opcoesDaRegra[lista] ?? []).find((o) => o.id === id)?.rotulo;
      if (!rotulo) throw new Error(`a peça "${id}" não está em opcoes.${lista} da sessão`);
      return rotulo;
    };
    r.exigir(
      rotuloDa("previsoes", "sem_conferir") === "Mandar esperar, sem dizer como conferir" &&
        rotuloDa("previsoes", "checa") === "Mandar checar antes de encaminhar",
      "as previsões dizem o que a regra FAZ com o áudio, nunca “certo” ou “errado”",
    );
    r.exigir(
      (await q.locator(".unc-chatheader, .unc-messagebubble").count()) === 0,
      "a regra é a CASCA da escola: nada do mensageiro na tela (a fronteira do disfarce cruza aqui, uma vez)",
    );
    const perguntaAntiga = await lerApi(p, `/evidencias/${EXP_ID}/perguntas/p1`);
    r.exigir(
      perguntaAntiga.status === 404,
      `as perguntas P1/P2 saíram: GET /evidencias/${EXP_ID}/perguntas/p1 responde 404 (veio ${perguntaAntiga.status})`,
    );

    /**
     * Uma peça da regra: o `Selection` do DS (combobox + listbox), pelo NOME do
     * campo. A lista é a que o combobox controla (`aria-controls`), não "o
     * listbox da tela": com dois abertos por um instante, o seletor genérico
     * pegaria o errado. O desfecho é o campo mostrar a peça escolhida.
     */
    const escolherPeca = async (campo, rotulo) => {
      const combo = q.getByRole("combobox", { name: campo });
      await combo.click();
      await q.locator(`[role="combobox"][aria-expanded="true"]`).first().waitFor({ timeout: 10_000 });
      const idDaLista = await combo.getAttribute("aria-controls");
      if (!idDaLista) throw new Error(`o campo ${campo} não abriu a lista de peças`);
      await q.locator(`[id="${idDaLista}"]`).getByRole("option", { name: rotulo, exact: true }).click();
      await combo
        .filter({ hasText: rotulo })
        .waitFor({ timeout: 5_000 })
        .catch(async () => {
          throw new Error(`escolher “${rotulo}” em ${campo} não mudou o campo (mostra “${normalizar(await combo.innerText())}”)`);
        });
    };
    const testar = q.getByRole("button", { name: "Testar no áudio do tio", exact: true });
    const cardDoTeste = (n) => q.locator(".escola__teste").filter({ hasText: `Teste ${n}` });

    // ─── 1º teste: uma regra que só manda esperar, com a previsão certa ────
    await escolherPeca(CAMPO_DA_REGRA.se, rotuloDa("condicoes", "urgente_alarmante"));
    await escolherPeca(CAMPO_DA_REGRA.entao, rotuloDa("acoes", "esperar"));
    r.exigir(await testar.isDisabled(), "sem a previsão, “Testar no áudio do tio” não acende: prever vem ANTES de ver");
    await escolherPeca(CAMPO_DA_REGRA.previsao, rotuloDa("previsoes", "sem_conferir"));
    r.exigir(!(await testar.isDisabled()), "com condição, ação e previsão, o teste acende");
    await r.registrar(p, "regra-do-tio", {
      titulo: "O desafio do tio",
      mostra:
        "Na casca da escola, a fala da Nina sobre o áudio assustado do tio e a regra montada com peças: " +
        "“SE a mensagem for urgente e alarmante ENTÃO eu espero antes de encaminhar”, e a previsão " +
        "“Mandar esperar, sem dizer como conferir”.",
      prova:
        "Prever é simular: a criança diz o que a regra vai fazer com o áudio ANTES de ver — é a " +
        "simulação de algoritmo que a EF05CO04 pede. As peças têm critério fixo, e as erradas existem " +
        "de propósito, para a criança poder errar. Sem texto livre de menor.",
    });
    await testar.click();
    await esperarOuFalharPorHttp(p, cardDoTeste(1), /quem-mandou-isso\/regra\/teste/, {
      timeout: 30_000,
      oQue: "o primeiro teste da regra",
    });
    const textoDoTeste1 = normalizar(await cardDoTeste(1).innerText());
    r.exigir(
      textoDoTeste1.includes(RESULTADO_DO_TESTE.sem_conferir) &&
        textoDoTeste1.includes(`Você previu: ${rotuloDa("previsoes", "sem_conferir")}`),
      `o card “Teste 1” diz o que a regra fez — “${RESULTADO_DO_TESTE.sem_conferir}” — ao lado da previsão`,
    );
    r.exigir(
      !PALAVRAS_DE_ACERTO.test(textoDoTeste1),
      `o teste não diz certo nem errado (achei "${textoDoTeste1.match(PALAVRAS_DE_ACERTO)?.[0] ?? ""}")`,
    );
    r.exigir(
      await testar.isDisabled(),
      "depois do teste a previsão se apaga, e o teste seguinte pede outra: prever de novo é simular de novo",
    );
    await cardDoTeste(1).scrollIntoViewIfNeeded();
    await r.registrar(p, "regra-teste-1", {
      titulo: "Teste 1: pegou o áudio, mas não diz como conferir",
      mostra: "O card “Teste 1” com a regra em palavras, a previsão da criança e o resultado: “Sua regra pegou o áudio, mas não diz como conferir.”",
      prova:
        "O resultado diz o que a regra FEZ, num card neutro, sem cor de acerto. Quem simula é o " +
        "servidor: o tipo de cada peça e quais condições pegam o áudio nunca desceram.",
    });

    // ─── 2º teste: a regra que checa antes de encaminhar ───────────────────
    await escolherPeca(CAMPO_DA_REGRA.entao, rotuloDa("acoes", "comparar_fonte"));
    await escolherPeca(CAMPO_DA_REGRA.depois, rotuloDa("acoes", "encaminhar_se_confirmar"));
    await escolherPeca(CAMPO_DA_REGRA.previsao, rotuloDa("previsoes", "checa"));
    await testar.click();
    await esperarOuFalharPorHttp(p, cardDoTeste(2), /quem-mandou-isso\/regra\/teste/, {
      timeout: 30_000,
      oQue: "o segundo teste da regra",
    });
    const textoDoTeste2 = normalizar(await cardDoTeste(2).innerText());
    r.exigir(
      textoDoTeste2.includes(RESULTADO_DO_TESTE.checa),
      `o card “Teste 2” diz “${RESULTADO_DO_TESTE.checa}”`,
    );
    const testada = await lerApi(p, "/quem-mandou-isso/sessao");
    const testes = testada.corpo?.regra?.testes ?? [];
    r.exigir(
      testes.length === 2 &&
        testes[0].situacao === "sem_conferir" &&
        testes[0].previsao === "sem_conferir" &&
        testes[1].situacao === "checa" &&
        JSON.stringify(testes[1].acoes) === JSON.stringify(["comparar_fonte", "encaminhar_se_confirmar"]),
      `o servidor guarda os dois testes, em ordem (${testes.map((t) => `${t.previsao}→${t.situacao}`).join(", ")})`,
    );
    r.exigir(
      !/"(tipo|pegaOAudio|checagem|repasse)"/.test(JSON.stringify(testada.corpo?.regra ?? {})),
      "e o estado não traz o tipo das ações nem quais condições pegam o áudio",
    );
    const regraEnviadaEmPalavras = testes[1]?.emPalavras ?? "";
    await cardDoTeste(2).scrollIntoViewIfNeeded();
    await r.registrar(p, "regra-teste-2", {
      titulo: "Teste 2: corrigida, a regra manda checar",
      mostra:
        "A regra corrigida — “ENTÃO eu comparo com uma fonte confiável E DEPOIS encaminho só se a notícia se " +
        "confirmar” —, a previsão “Mandar checar antes de encaminhar” e o card “Teste 2”.",
      prova:
        "Testar e corrigir é aprendizado, mas não leva ao “atingiu” sozinho: a correção veio DEPOIS do " +
        "retorno do teste. A régua lê a primeira regra e a primeira previsão.",
    });

    // ─── enviar a regra fecha a missão ─────────────────────────────────────
    await q.getByRole("button", { name: "Enviar minha regra", exact: true }).click();
    await esperarOuFalharPorHttp(
      p,
      q.getByRole("heading", { name: "Missão Concluída" }),
      /quem-mandou-isso\/(regra|concluir)$/,
      { timeout: 30_000, oQue: "enviar a regra e concluir a missão" },
    );
    const cardDaRegra = q.locator(".escola__regra");
    r.exigir(
      normalizar(await cardDaRegra.innerText()).includes("Sua regra") &&
        normalizar(await cardDaRegra.innerText()).includes(normalizar(regraEnviadaEmPalavras)),
      `“Missão Concluída” mostra o card “Sua regra” com a regra enviada (“${regraEnviadaEmPalavras}”)`,
    );
    r.exigir(!PALAVRAS_DE_ACERTO.test(await q.locator(".escola").innerText()), "e o fechamento não tem nível, acerto nem nota");
    const concluida = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      concluida.corpo?.passo === "concluida" && concluida.corpo?.concluido === true,
      `enviar a regra fecha a missão no servidor, sem outro toque (passo=${concluida.corpo?.passo})`,
    );
    await r.registrar(p, "missao-concluida", {
      titulo: "Missão Concluída",
      mostra: "A casca da escola com “Missão Concluída”, o card “Sua regra” e a despedida da Nina.",
      prova:
        "A fronteira cruza uma vez só, no fim: o desafio do tio é sobre o grupo da FAMÍLIA, e por isso é " +
        "a escola que fala. Enviar a regra conclui a missão sozinho — o POST /concluir sai depois do envio.",
    });
    /* Sai do aparelho: o iframe continua falando com a api enquanto a página estiver nele. */
    await p.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });

    // ═══ PROFESSORA: a folha e as habilidades da BNCC ═════════════════════
    const esperado = {
      EF05CO08: nivelEsperadoCO08(escolhidas.map((id) => gabarito.get(id))),
      EF05CO03: nivelEsperadoCO03(acertosEsperados),
      EF05CO04: nivelEsperadoCO04(testes, testes[1]?.situacao),
    };
    r.exigir(
      esperado.EF05CO03 === "atingiu" && esperado.EF05CO04 === "em_processo",
      `o roteiro produz o cartão inteiro certo (atingiu) e a regra corrigida depois do teste (em processo): ${JSON.stringify(esperado)}`,
    );
    const ROTULO_DO_MARCADOR = { EF05CO08: "Seleção do Mural", EF05CO03: "Cartão de frases", EF05CO04: "Regra do tio" };

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

    const painelFinal = await esperarNaApi(prof, `${daTurma}/painel`, (c) => linhaDele(c)?.regra != null, {
      oQue: "a regra do tio na folha da turma",
    });
    r.exigir(
      linhaDele(painelFinal).regra.testes === 2 &&
        normalizar(linhaDele(painelFinal).regra.emPalavras) === normalizar(regraEnviadaEmPalavras) &&
        painelFinal.progresso.enviaramRegra >= 1,
      `a folha traz a regra enviada em palavras e os ${linhaDele(painelFinal).regra.testes} testes, e o painel da aula conta quem enviou`,
    );

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
        textoDosCriterios.includes("No cartão de frases, acerta 5 ou 6 das 6 frases") &&
        textoDosCriterios.includes("Envia uma regra que encaminha a mensagem antes de checar.") &&
        ["Atingiu:", "Em processo:", "Não atingiu:"].every((n) => textoDosCriterios.split(n).length - 1 >= 3),
      "no fim do bloco, cada uma das três habilidades tem o critério de Atingiu, Em processo e Não atingiu — o cartão e a regra, não mais as perguntas",
    );
    await blocoDeHabilidades.scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "Habilidades da BNCC, por estudante",
      mostra: `A ${atividade.rodada}ª rodada da atividade: a EF05CO08 pela seleção do Mural, a EF05CO03 pelo cartão de frases e a EF05CO04 pela regra do tio.`,
      prova:
        "O nível é do servidor e é conferido aqui contra a régua: a EF05CO08 vem das 3 escolhidas, a " +
        "EF05CO03 dos acertos no cartão (6 de 6, atingiu) e a EF05CO04 da regra — que só checou depois " +
        "do retorno do teste, e por isso fica em processo. Tudo pelo que a criança FEZ (o Canal A).",
      detalhe: Object.entries(esperado)
        .map(([c, n]) => `${c}=${n}`)
        .join(" · "),
    });

    const folhaDaTurma = prof.locator("[data-folha]");
    const linhaNaFolha = folhaDaTurma.locator("tr", { hasText: estudante.nome });
    await linhaNaFolha.first().waitFor({ timeout: 20_000 });
    const cabecalhos = (await folhaDaTurma.locator("thead th").allInnerTexts()).map(normalizar);
    r.exigir(
      cabecalhos.includes("Cartão de frases") && cabecalhos.includes("Regra do tio") && !cabecalhos.some((c) => /Se\/Então/i.test(c)),
      `a folha tem as colunas “Cartão de frases” e “Regra do tio”, e não a do Se/Então (${cabecalhos.join(" · ")})`,
    );
    const colunaProibida = cabecalhos.find((c) => /pontos|nota|acerto|ranking|nível/i.test(c));
    r.exigir(!colunaProibida, `a folha não tem coluna de acerto, nota nem nível (achei "${colunaProibida ?? ""}")`);
    const textoDaLinha = normalizar(await linhaNaFolha.first().innerText());
    r.exigir(
      textoDaLinha.includes(`${acertosEsperados} de 6 certas`) &&
        textoDaLinha.includes(normalizar(regraEnviadaEmPalavras)) &&
        textoDaLinha.includes("2 testes"),
      `a linha da criança traz “${acertosEsperados} de 6 certas”, a regra em palavras e “2 testes”`,
    );
    await linhaNaFolha.first().scrollIntoViewIfNeeded();
    await r.registrar(prof, "folha-da-turma", {
      titulo: "O diário de bordo da turma",
      mostra:
        "Onde cada um está, as 3 mensagens encaminhadas com o quadrante, o motivo declarado, os acertos do " +
        "cartão por operador e a regra do tio em palavras, com quantos testes ela levou.",
      prova:
        "É a tela dela, não a do projetor: tem nome. A regra não é texto livre de menor — o servidor a " +
        "escreve a partir das peças. O nível por habilidade mora no bloco da BNCC, onde ela também o ajusta.",
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
