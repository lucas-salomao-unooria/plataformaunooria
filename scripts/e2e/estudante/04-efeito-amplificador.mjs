import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { revelar } from "../lib/abas.mjs";

/**
 * O EFEITO AMPLIFICADOR (exp02em1b, 2ª série do EM, unidade 1 — ADR-181), das
 * duas pontas da sala, com a IA REAL nas duas.
 *
 * A professora CRIA a atividade pelo assistente do hub, com um tema DELA,
 * gerado pelo Vertex, e a põe no ar; o estudante abre a missão, ouve a fala do
 * PO e conversa com o UnooriaAI em linguagem LIVRE — a conversa híbrida: a IA
 * entende e redige, o servidor decide o que muda na prévia. Ele audita (a
 * fonte, a substituição, o colega e o crédito), publica, vive a madrugada no
 * feed e usa as três proteções; a professora pausa as telas e libera a Etapa 5,
 * e o estudante aponta os bastidores e conclui. Uma colega testa o que a árvore
 * não sabe fazer: a dúvida de conceito e o pedido fora do tema. No fim, o
 * painel de habilidades mostra as quatro habilidades.
 *
 * Nada aqui é do banco padrão: os nomes (instituto, colega, veículo), o
 * recorte, as manchetes e os comentários vêm do pacote que a IA escreveu, lido
 * da api COM o gabarito (o professor o vê). As frases do estudante não casam
 * com gatilho nenhum da árvore — quem as entende é o modelo, e a suíte exige
 * `origem: "ia"` em cada resposta.
 *
 * Os seletores são CONTRATO com a experiência (`src/lib/textos.ts`) e com o
 * hub (`atividades/nova/criar-efeito-amplificador.tsx`,
 * `resultados/painel-da-aula-efeito-amplificador.tsx`).
 */

const SERIE = "2EM";
const EXP_ID = "exp02em1b";
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;
const FICHA = `${HUB}/professor/entre-redes/2-serie/unidade-1`;
const ABERTURA = /Olá, vamos montar seu post para .+, você pode me pedir para montar o post, questionar minhas fontes e perguntar sobre direito digital\. Vamos começar\?/;

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

/** A UNIÃO de desfechos legítimos: devolve o NOME do que apareceu primeiro. */
async function primeiroQueAparecer(desfechos, { timeout, oQue }) {
  const nomes = Object.keys(desfechos);
  try {
    return await Promise.any(nomes.map((nome) => desfechos[nome].first().waitFor({ timeout }).then(() => nome)));
  } catch {
    throw new Error(`${oQue}: nenhum desfecho em ${timeout / 1000}s (${nomes.join(", ")})`);
  }
}

/** O recorte que a professora pede à IA — nada do banco padrão. */
const RECORTE = {
  disciplina: "Biologia",
  tema: "O sono dos adolescentes e as telas",
  topicos: ["luz azul e melatonina", "privação de sono", "notificações noturnas"],
};

async function idDaTurma(p, nome) {
  const { status, corpo } = await lerApi(p, "/turmas/minhas");
  return status === 200 && Array.isArray(corpo) ? (corpo.find((t) => t.nome === nome)?.id ?? null) : null;
}

await suite(
  {
    slug: "estudante/04-efeito-amplificador",
    papel: "estudante",
    titulo: "O Efeito Amplificador — o post, a madrugada e os bastidores",
    subtitulo: "a atividade criada com IA, o UnooriaAI híbrido em linguagem livre, o latch do Publicar e os dois botões da professora",
    contexto:
      "O estudante é o comunicador do grêmio: cria com o UnooriaAI o post da campanha, audita o rascunho — " +
      "um dado inventado, um trecho copiado e um colega exposto — e publica no Unoovista. O relógio corre até " +
      "as 02h30, a rede destaca uma frase e o feed vira crise. A professora pausa as telas para o debate e " +
      "libera a Etapa 5, onde o estudante aponta o que a rede buscou.",
    prova: [
      "A professora cria a atividade com um tema próprio, e o Vertex escreve o pacote (origem ia)",
      "O UnooriaAI abre com a fala do PO, com o tema da professora",
      "Cada resposta do UnooriaAI é da IA real, a pedidos em linguagem livre que a árvore não entenderia",
      "Perguntar a fonte não corrige o dado; aceitar a troca, tirar o colega e pedir o crédito sim — o servidor decide",
      "A dúvida de conceito e o pedido fora do tema são respondidos sem mexer no post",
      "Publicar é definitivo, e o algoritmo destaca a frase do recorte mesmo no post cuidadoso",
      "A sessão do estudante não carrega o gabarito (a categoria de saúde dos comentários, o comprova dos indicadores)",
      "As três proteções e a moderação ficam nos três pontos, e a pausa da professora congela a tela por polling",
      "A Etapa 5 exige os dois indicadores que comprovam; um distrator acende a dica",
      "O painel de habilidades mostra EM13CO24, EM13CO14, EM13CO26 e EM13CO08 com o nível da régua",
    ],
    comando: "node scripts/e2e/estudante/04-efeito-amplificador.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { turma: TURMA, serie: SERIE });
    const professora =
      contasDe("professor").find((c) => c.escola === estudante.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSORA: o pacote padrão no ar ═════════════════════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login, senhaDe(professora));
    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professora.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurma = `/efeito-amplificador/turmas/${turmaId}`;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: "O Efeito Amplificador", exact: true }).waitFor({ timeout: 30_000 });
    await prof.getByText(/A missão só abre com uma atividade sua em andamento/).first().waitFor({ timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha da 2ª série, unidade 1",
      mostra: "O Efeito Amplificador na trilha: as cinco etapas, o aviso dos dois botões e a lista de atividades.",
      prova: "A Missão Tempestade saiu do catálogo (é a exp02em1b-v0); a ficha da unidade é da missão nova.",
    });

    /* A professora CRIA a atividade: o assistente do hub, o recorte dela, a IA real. */
    await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
    const passo = prof.locator("[data-passo-conteudo]");
    const disciplina = passo.getByRole("combobox", { name: /^Componente Curricular da BNCC/i });
    await hidratado(prof, disciplina);
    await disciplina.click();
    await prof.getByRole("option", { name: RECORTE.disciplina }).first().click();
    const tema = passo.getByRole("textbox", { name: /^Tema Central da Aula/i });
    await tema.click();
    await tema.pressSequentially(RECORTE.tema);
    const topicos = passo.getByRole("textbox", { name: /^Tópicos da Discussão/i });
    await topicos.click();
    await topicos.pressSequentially(RECORTE.topicos.join("\n"));
    await r.registrar(prof, "recorte-da-professora", {
      titulo: "O recorte da professora",
      mostra: `A criação da atividade: Biologia, o tema “${RECORTE.tema}” e três tópicos da aula.`,
      prova: "A missão é customizável: o post, os nomes e os comentários vão ser escritos para esta aula.",
    });
    await passo.locator('[data-acao="gerar-conteudo"]').click();
    const curadoria = passo.locator("[data-curadoria]");
    const desfecho = await primeiroQueAparecer(
      { curadoria, falha: passo.locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`) },
      { timeout: 180_000, oQue: "a geração do pacote com IA" },
    );
    if (desfecho === "falha") {
      const aviso = (await passo.locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`).first().innerText()).replace(/\s+/g, " ");
      r.exigir(false, `a IA REAL gerou o pacote (a tela respondeu: “${aviso.slice(0, 200)}”)`);
      return;
    }
    r.exigir((await curadoria.innerText()).includes("Gerado com IA"), "a curadoria mostra o pacote “Gerado com IA” (o Vertex respondeu)");
    await curadoria.scrollIntoViewIfNeeded();
    await r.registrar(prof, "curadoria-da-ia", {
      titulo: "O pacote escrito pela IA, na curadoria",
      mostra: "O rascunho com os três problemas etiquetados, a correção de cada um, as manchetes e os comentários da madrugada.",
      prova: "O Vertex escreveu para o tema da professora, e a régua da homologação já passou: os três nós estão lá.",
      inteira: true,
    });
    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').waitFor({ timeout: 10_000 });
    await prof.locator('[data-acao="continuar-criacao"]').click();
    const umPorComputador = prof.getByRole("radio", { name: "Um aluno por computador", exact: true });
    await umPorComputador.click();
    await prof.locator('[data-acao="continuar-criacao"]').click();
    const revisao = prof.locator("[data-revisao-da-criacao]");
    await revisao.waitFor({ timeout: 10_000 });
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    r.exigir(await noAr.isChecked(), "“Pôr esta atividade no ar agora” fica ligado");
    await prof.locator('[data-acao="criar-atividade"]').click();
    await esperarOuFalharCedo(
      prof.locator('[data-estado-da-atividade="em-andamento"]'),
      revisao.locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`),
      { timeout: 60_000, oQue: "homologar o pacote da IA e pô-lo no ar" },
    );
    const pacotes = await lerApi(prof, `${daTurma}/pacotes`);
    const atividadeId = pacotes.corpo?.emAndamento?.pacoteId;
    const detalhe = (await lerApi(prof, `${daTurma}/pacotes/${atividadeId}`)).corpo;
    if (!r.exigir(detalhe?.origem === "ia" && detalhe?.tema === RECORTE.tema, `a atividade EM ANDAMENTO é a da IA, com o tema da professora (origem ${detalhe?.origem}, “${detalhe?.tema}”)`)) return;
    const k = detalhe.conteudo;
    const paragrafoDo = (no) => k.rascunho.find((x) => x.no === no);
    await r.registrar(prof, "atividade-da-ia-no-ar", {
      titulo: "A atividade da IA, em andamento",
      mostra: "A página da atividade criada agora: o tema da professora, em andamento, e o painel da aula.",
      prova: `Origem “ia”: o instituto é “${k.fonteInventada}”, o colega “${k.colega}” e o veículo “${k.veiculo}” — nada do banco padrão.`,
    });

    // ═══ ESTUDANTE: a abertura e o UnooriaAI ═══════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login, senhaDe(estudante));
    await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    const q = p.frameLocator("iframe[data-experiencia]");
    await esperarOuFalharPorHttp(p, q.getByRole("button", { name: "Iniciar Campanha" }), /efeito-amplificador\/sessao/, {
      timeout: 40_000,
      oQue: "o boot da missão",
    });
    await r.registrar(p, "pauta-do-gremio", {
      titulo: "A pauta do grêmio",
      mostra: "A tela da escola entrega o desafio: criar a publicação oficial da campanha.",
      prova: "A missão abre porque há atividade em andamento e a sala liberou; o disfarce começa no Iniciar Campanha.",
    });
    await q.getByRole("button", { name: "Iniciar Campanha" }).click();
    await q.getByText(ABERTURA).waitFor({ timeout: 20_000 });
    r.exigir(
      (await q.getByText(`Gerar rascunho do post: ${RECORTE.tema}`, { exact: true }).count()) === 1,
      "a primeira sugestão do chat leva o tema da professora (não o “celular na escola” do banco padrão)",
    );
    await r.registrar(p, "abertura-do-unooriaai", {
      titulo: "A fala de abertura do UnooriaAI",
      mostra: "O assistente se apresenta com o tema do pacote e as três sugestões da copy.",
      prova: "É a fala literal do PO (2026-10-22), com o tema no lugar de [tema customizado].",
    });

    /**
     * Uma fala LIVRE ao UnooriaAI: espera a resposta do POST (a IA leva
     * segundos) e devolve o estado que a api mandou. A espera corre contra a
     * resposta HTTP, nunca contra um texto fixo — a fala é escrita pelo modelo.
     */
    const falar = async (pagina, quadro, texto) => {
      const campo = quadro.getByPlaceholder("Pergunte ao UnooriaAI...");
      await campo.fill(texto);
      const resposta = pagina.waitForResponse(
        (x) => x.url().includes("/efeito-amplificador/mensagem") && x.request().method() === "POST",
        { timeout: 60_000 },
      );
      await campo.press("Enter");
      const http = await resposta;
      const estado = await http.json().catch(() => null);
      /* A RESPOSTA é a fala logo depois do pedido — na 5ª, o aviso do limite (da árvore, de propósito) vem depois dela. */
      const mensagens = estado?.conversa?.mensagens ?? [];
      const pedido = mensagens.map((m) => m.papel).lastIndexOf("estudante");
      const fala = pedido >= 0 ? mensagens[pedido + 1] : undefined;
      if (estado?.conversa?.restantes > 0) await quadro.getByText(fala?.texto ?? "", { exact: true }).waitFor({ timeout: 10_000 });
      return { status: http.status(), estado, fala };
    };
    const daIa = (rotulo, x) => r.exigir(x.status === 200 && x.fala?.origem === "ia", `${rotulo}: a resposta é da IA (HTTP ${x.status}, origem ${x.fala?.origem}): “${(x.fala?.texto ?? "").slice(0, 140)}”`);
    const paragrafo = (estado, no) => estado?.previa?.paragrafos?.find((x) => x.id === paragrafoDo(no)?.id);

    const m1 = await falar(p, q, "oi! me ajuda a escrever o texto da campanha do grêmio?");
    daIa("“me ajuda a escrever o texto”", m1);
    r.exigir(m1.estado?.previa?.gerada === true, "a IA entendeu o pedido de rascunho: a Prévia da Publicação foi gerada");
    const m2 = await falar(p, q, "de onde você tirou esse número da pesquisa? me parece exagerado");
    daIa("“de onde você tirou esse número?”", m2);
    r.exigir(
      paragrafo(m2.estado, "alucinacao")?.corrigido === false && m2.fala?.texto?.includes(k.fonteInventada.split(" ")[0]),
      `questionada, a IA admite que não verificou “${k.fonteInventada}” — e perguntar a fonte NÃO corrige o dado`,
    );
    await r.registrar(p, "ia-questionada", {
      titulo: "O UnooriaAI questionado",
      mostra: "O pedido livre do rascunho e a pergunta sobre o número: a IA admite que não tem registro do instituto e oferece trocar.",
      prova: "A conversa é com IA real (origem “ia”); a REGRA DE OURO segura o problema até o estudante questionar.",
    });
    const m3 = await falar(p, q, "então pode trocar esse dado, por favor");
    daIa("“pode trocar esse dado”", m3);
    r.exigir(paragrafo(m3.estado, "alucinacao")?.corrigido === true, "aceita a troca, o servidor substitui a estatística na prévia");
    const m4 = await falar(p, q, "não acho certo expor a doença de um colega no post, tira isso");
    daIa("“não acho certo expor a doença de um colega”", m4);
    r.exigir(paragrafo(m4.estado, "lgpd")?.corrigido === true, "o colega sai do post: a identificação removida na prévia");
    const m5 = await falar(p, q, "esse pedaço parece copiado de algum jornal, dá o crédito certinho");
    daIa("“parece copiado de algum jornal”", m5);
    r.exigir(paragrafo(m5.estado, "plagio")?.corrigido === true, "o trecho copiado ganha aspas e crédito ao veículo");
    r.exigir(m5.estado?.conversa?.restantes === 0, "o chat fecha na 5ª mensagem");
    await q.getByText(/Atingimos o limite de interações/).waitFor({ timeout: 20_000 });
    await r.registrar(p, "auditoria-no-unooriaai", {
      titulo: "A auditoria do rascunho, em linguagem livre",
      mostra: "A troca do dado, o colega anonimizado e a citação creditada — pedidos com as palavras do estudante — e o aviso do limite.",
      prova: "A IA entende e redige; quem muda a prévia é o servidor, pela intenção da lista fechada. O chat fecha na 5ª mensagem.",
    });

    const sessao = await lerApi(p, "/efeito-amplificador/sessao");
    r.exigir(
      !JSON.stringify(sessao.corpo).match(/"tipo":|"comprova":|"no":/),
      "a sessão do estudante não traz a categoria de saúde, o comprova nem o nó (o gabarito é do servidor)",
    );

    await q.getByRole("button", { name: "Revisar Publicação" }).click();
    await q.getByText("Prévia da Publicação").waitFor({ timeout: 10_000 });
    await r.registrar(p, "previa-da-publicacao", {
      titulo: "A Prévia da Publicação",
      mostra: "Os parágrafos como ficaram, cada um com Remover trecho.",
      prova: "Sem edição livre: tirar um parágrafo também resolve o nó para a régua.",
    });
    await q.getByRole("button", { name: "Exportar para o Unoovista" }).click();
    await q.getByRole("radio", { name: k.manchetes.neutra }).click();
    await r.registrar(p, "manchete-de-capa", {
      titulo: "A manchete de capa",
      mostra: "Três manchetes — neutra, construtiva, sensacionalista — e o Publicar no Unoovista.",
      prova: "A aposta: o estudante escolhe a mais equilibrada esperando uma circulação construtiva.",
    });
    await q.getByRole("button", { name: "Publicar no Unoovista" }).click();

    // ═══ ESTUDANTE: a madrugada ════════════════════════════════════════════
    await q.getByText(/Seus dados de localização aproximada/).waitFor({ timeout: 20_000 });
    const publicada = await lerApi(p, "/efeito-amplificador/sessao");
    r.exigir(
      publicada.corpo?.publicacao?.trechoPincado === k.recorte,
      "o post cuidadoso também ganha a frase pinçada em destaque (o recorte do pacote)",
    );
    await r.registrar(p, "feed-da-madrugada", {
      titulo: "O feed da madrugada",
      mostra: "O post com a frase fora de contexto em destaque, o alerta de metadados e os comentários das 02h.",
      prova: "A entrega é a mesma para toda a turma: o incentivo é da rede, não do texto.",
    });

    /* Uma de cada dimensão de saúde (a EM13CO24 lê as duas): os handles vêm do pacote da IA. */
    for (const tipo of ["saude_fisica", "saude_mental"]) {
      const c = k.comentarios.find((x) => x.tipo === tipo);
      await q.getByRole("button", { name: `${c.handle}: ver mais` }).click();
    }
    await q.getByRole("button", { name: "Opções da publicação" }).click();
    await q.getByText("Restringir Comentários", { exact: true }).click();
    await q.getByText("Comentários restritos nesta publicação.").first().waitFor({ timeout: 10_000 });
    await q.getByRole("button", { name: "Opções da publicação" }).click();
    await q.getByText("Configurações de Privacidade", { exact: true }).click();
    await q.getByRole("button", { name: "Opções da publicação" }).click();
    await q.getByText("Central de Apoio / Ajuda e Segurança", { exact: true }).click();
    await q.getByRole("button", { name: "Opções do comentário" }).nth(k.comentarios.findIndex((x) => x.tipo === "risco_seguranca")).click();
    await q.getByText("Denunciar", { exact: true }).click();
    await q.getByText("Denúncia enviada para análise da moderação.").first().waitFor({ timeout: 10_000 });
    await r.registrar(p, "protecoes-nos-tres-pontos", {
      titulo: "As proteções nos três pontos",
      mostra: "Comentários restritos, conta privada, Central de Apoio e a conta invasiva denunciada.",
      prova: "Ninguém mandou: as ferramentas ficam nos menus, e usá-las é o que a EM13CO08 mede.",
    });

    // ═══ UMA COLEGA: o que a árvore não sabe fazer ═════════════════════════
    const colega = contasDe("estudante").find((c) => c.turma === TURMA && c.login !== estudante.login);
    if (r.exigir(Boolean(colega), `há uma segunda estudante na ${TURMA}`)) {
      const c2 = await r.pagina("colega", { viewport: { width: 1280, height: 950 } });
      await r.entrar(c2, colega.login, senhaDe(colega));
      await c2.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
      const q2 = c2.frameLocator("iframe[data-experiencia]");
      await q2.getByRole("button", { name: "Iniciar Campanha" }).waitFor({ timeout: 40_000 });
      await q2.getByRole("button", { name: "Iniciar Campanha" }).click();
      await q2.getByText(ABERTURA).waitFor({ timeout: 20_000 });
      const d1 = await falar(c2, q2, "monta o post pra mim");
      daIa("a colega pede o post", d1);
      const antes = JSON.stringify(d1.estado?.previa);
      const d2 = await falar(c2, q2, "o que exatamente a LGPD protege?");
      daIa("“o que a LGPD protege?”", d2);
      r.exigir(
        JSON.stringify(d2.estado?.previa) === antes,
        "a dúvida de conceito RESPONDE sem mexer no post (a árvore teria anonimizado ao ler “LGPD”)",
      );
      const d3 = await falar(c2, q2, "quem você acha que ganha o campeonato brasileiro esse ano?");
      daIa("“quem ganha o campeonato?”", d3);
      r.exigir(JSON.stringify(d3.estado?.previa) === antes, "o pedido fora do tema volta à campanha, sem mexer no post");
      await r.registrar(c2, "duvida-e-fora-do-tema", {
        titulo: "Dúvida de conceito e pedido fora do tema",
        mostra: "A colega pergunta o que a LGPD protege e quem ganha o campeonato: a IA explica o conceito e volta ao tema da campanha.",
        prova: "A IA responde à altura do que foi perguntado, dentro dos guardrails, e a prévia não muda em nenhuma das duas.",
      });
    }

    // ═══ PROFESSORA: a pausa e a Etapa 5 ═══════════════════════════════════
    await prof.goto(`${FICHA}/resultados?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-lousa]").waitFor({ timeout: 30_000 });
    await prof.locator("[data-botoes-da-aula]").getByRole("button", { name: "Pausar Telas para Debate" }).click();
    await prof.getByRole("dialog").getByRole("button", { name: "Pausar Telas para Debate" }).click();
    await q.getByText("Aguardando a liberação do orientador do grêmio para avançar...").first().waitFor({ timeout: 20_000 });
    await r.registrar(prof, "lousa-da-conducao", {
      titulo: "A lousa da condução",
      mostra: "Publicações, a porcentagem com pico de madrugada, as manchetes e a curva de entrega — sem nomes.",
      prova: "É o material do debate: 100% dos posts entregues de madrugada, qualquer que fosse a manchete.",
    });
    await r.registrar(p, "telas-pausadas", {
      titulo: "As telas pausadas",
      mostra: "A espera na voz da ficção, por cima do feed.",
      prova: "A pausa chega ao aparelho pelo polling de 3 s, sem recarregar.",
    });
    await prof.locator("[data-botoes-da-aula]").getByRole("button", { name: "Liberar Etapa 5" }).click();
    await prof.getByRole("dialog").getByRole("button", { name: "Liberar Etapa 5" }).click();

    // ═══ ESTUDANTE: os bastidores ══════════════════════════════════════════
    await q.getByText("Bastidores da Entrega Algorítmica").first().waitFor({ timeout: 20_000 });
    await q.getByRole("button", { name: "Curtidas na publicação: 37" }).click();
    await q.getByText(/Este indicador não mostra o que a rede priorizou/).waitFor({ timeout: 10_000 });
    await q.getByRole("button", { name: "Pico de Notificações: 02h30" }).click();
    await q.getByRole("button", { name: "Tempo de Retenção Compulsiva: +340%" }).click();
    await q.getByText(/Economia da Atenção: o modelo de negócio/).waitFor({ timeout: 10_000 });
    await r.registrar(p, "bastidores-da-entrega", {
      titulo: "Os bastidores da entrega",
      mostra: "Os dois indicadores confirmados, a fala de Nico e os três conceitos.",
      prova: "O gabarito é do servidor: o distrator acendeu a dica; os dois certos liberaram o Concluir.",
    });
    await q.getByRole("button", { name: "Concluir missão" }).click();
    await q.getByText("Missão Concluída").waitFor({ timeout: 15_000 });

    // ═══ PROFESSORA: as habilidades ════════════════════════════════════════
    const atividade = (await lerApi(prof, `${daTurma}/pacotes`)).corpo?.emAndamento?.pacoteId;
    const habilidades = await lerApi(prof, `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividade}`);
    const texto = JSON.stringify(habilidades.corpo ?? {});
    for (const codigo of ["EM13CO24", "EM13CO14", "EM13CO26", "EM13CO08"]) {
      r.exigir(texto.includes(codigo), `o painel de habilidades traz ${codigo}`);
    }
    await prof.reload({ waitUntil: "domcontentloaded" });
    /* O painel de habilidades mora na aba Habilidades da atividade (ADR-182). */
    await revelar(prof, prof.locator("[data-habilidades-efeito-amplificador]"));
    await prof.locator("[data-habilidades-efeito-amplificador]").waitFor({ timeout: 30_000 });
    await prof.locator("[data-habilidades-efeito-amplificador]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "As habilidades da BNCC",
      mostra: "EM13CO24, EM13CO14, EM13CO26 e EM13CO08, com o nível que a régua deu ao estudante.",
      prova: "Só Canal A: tudo foi medido pelo que o estudante fez — não há perguntas no fim (decisão do PO).",
    });
  },
);
