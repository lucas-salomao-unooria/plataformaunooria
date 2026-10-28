import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { revelar } from "../lib/abas.mjs";

/**
 * O PORTA-VOZ DOS DADOS 1.0.0 (exp03em1b, 3ª série do EM, unidade 1 — ADR-198),
 * das duas pontas da sala, com DOIS estudantes da mesma turma.
 *
 * A professora CRIA a atividade pelo assistente do hub, com um tema DELA,
 * escrito pela IA REAL (o Vertex, antes da aula), regenera um bloco
 * ("Regenerar Item"), homologa e libera. O estudante A abre o Unoochat, o
 * Assistente de Dados, NÃO abre a nota técnica, vê a prévia em 80%, abre o
 * compositor (sem escala marcada: o envio fica desabilitado), publica 80–100%
 * sem camadas e vê o grupo reagir pelo ramo 80, o post espelho da Santos
 * Dumont em 0% e o Coordenador. A professora pausa (as POSTs dele respondem
 * 409) e libera a retomada; ele publica a errata 80 → 0 com a fonte, lê o
 * laudo (≈ 6,3, a régua 0 → 80), sinaliza só o cartão B com o motivo escala
 * e conclui — sem podcast. O estudante B, depois da retomada (decisão 7), abre
 * a nota técnica ANTES do compositor, publica 0–100% com as três camadas, pula
 * a errata e a perícia. No fim, o painel ao vivo (só contagens) e as
 * habilidades que a régua deu a cada um.
 *
 * Os seletores são CONTRATO com a experiência
 * (`apps/experiencias/exp03em1b/src/lib/textos.ts` e os textos da api em
 * `porta-voz-dos-dados/conteudo.ts`) e com o hub
 * (`atividades/nova/criar-porta-voz.tsx`, `resultados/painel-da-aula-porta-voz.tsx`,
 * `resultados/resultados-porta-voz.tsx`).
 */

const SERIE = "3EM";
const EXP_ID = "exp03em1b";
const TURMA = process.env.TURMA ?? "3EM-A";
const FICHA = `${HUB}/professor/entre-redes/3-serie/unidade-1`;
const RAIZ = "/porta-voz-dos-dados";

/** A copy da tela (`src/lib/textos.ts`) e da api (`conteudo.ts`) — literal. */
const COPY = {
  bot: "Assistente de Dados — Programa Municipal",
  iniciar: "Iniciar Estruturação de Dados",
  gerarPrevias: "Gerar Previews das Escalas",
  escala80: "Escala com Recorte de Variação (Origem 80%)",
  escala0: "Escala Absoluta (Origem 0)",
  abrirCompositor: "Abrir Compositor de Publicação",
  compositor: "Parametrização do Boletim Oficial",
  compositorErrata: "Compositor de Errata Oficial (Slot 2 de 3)",
  zero: "0–100%",
  oitenta: "80–100%",
  previaSemEscala: "Escolha a origem do eixo vertical para gerar a prévia.",
  encaminhar: "Gerar Artefato Final e Encaminhar ao Grupo Público",
  confirmarTitulo: "Confirmar Envio Oficial Irreversível",
  confirmar: "Confirmar Envio",
  camadas: { explicacao: "Anotação de escala", fonte: "Fonte dos dados", contexto: "Contexto da oscilação" },
  rival: "Escola Estadual Santos Dumont",
  autenticacao: "Planilha Municipal Oficial · Autenticação Criptográfica Idêntica",
  pausa: "Sessão pausada pela Coordenação para mediação técnica em sala.",
  abrirAssistente: "Abrir mensagem do Assistente de Dados",
  publicarErrata: "Publicar Errata Corretiva",
  pularErrata: "Avançar sem publicar errata",
  irAoLaudo: "Prosseguir para o Laudo de Auditoria",
  concluirLeitura: "Concluir Leitura do Anexo",
  fator: "≈ 6,3",
  irAPericia: "Avançar para Perícia Técnica",
  canal: "Notícias da Cidade — Eleições Municipais",
  sinalizar: "Sinalizar para revisão",
  verDados: "Ver dados e fonte",
  retornar: "Retornar aos Cartões",
  emitir: "Emitir parecer",
  pularPericia: "Avançar sem emitir parecer",
  selo: "Missão Oficial Concluída — Protocolo Homologado",
  encerrado: "Protocolo Pericial Encerrado",
};

/** O recorte que a professora pede à IA — nada do banco padrão (Vigilância Sanitária da Água). */
const RECORTE = {
  disciplina: "Matemática",
  tema: "Transporte escolar no município",
  topicos: ["pontualidade dos ônibus escolares", "lotação dos veículos por rota", "comunicação de indicadores públicos"],
};

/**
 * O QUE A RÉGUA DEVE DAR — calculado da ficha (`evidencias/fichas/exp03em1b.ts`)
 * e de `porta-voz-dos-dados/regras/evidencia.ts`, não chutado:
 *
 * A — 1ª: 80, sem camadas, SEM abrir o anexo; errata: 0 + fonte; perícia só B / escala.
 *   CO12 (final 0 + fonte) ............................... atingiu
 *   CO13 (não abriu o anexo antes do compositor) ......... nao_atingiu
 *   CO14 (só B, motivo escala) ........................... atingiu
 *   CO21 (explicação nem na 1ª nem na errata) ............ nao_atingiu
 *   CO22 (final com 1 camada: a fonte) ................... em_processo
 *   CO26 (1ª inadequada, errata 80 → 0 corrige) .......... atingiu
 * B — anexo antes do compositor e do nudge; 1ª: 0 + as três camadas; pula errata e perícia.
 *   CO12 (final 0 + fonte) ............................... atingiu
 *   CO13 (anexo antes do compositor e do nudge de 90 s) .. atingiu
 *   CO14 (pulou a perícia) ............................... nao_atingiu
 *   CO21 (explicação ligada na 1ª, sem errata) ........... atingiu
 *   CO22 (final com 3 camadas) ........................... atingiu
 *   CO26 (1ª adequada, sem regressão) .................... atingiu
 */
const ESPERADO = {
  A: { EM13CO12: "atingiu", EM13CO13: "nao_atingiu", EM13CO14: "atingiu", EM13CO21: "nao_atingiu", EM13CO22: "em_processo", EM13CO26: "atingiu" },
  B: { EM13CO12: "atingiu", EM13CO13: "atingiu", EM13CO14: "nao_atingiu", EM13CO21: "atingiu", EM13CO22: "atingiu", EM13CO26: "atingiu" },
};

async function lerApi(p, caminho) {
  const resposta = await p.request.get(`${BFF}${caminho}`);
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

async function mandarApi(p, caminho, dados) {
  const resposta = await p.request.fetch(`${BFF}${caminho}`, { method: "POST", data: dados ?? {} });
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

/** PORTÃO DE HIDRATAÇÃO: em dev o SSR chega antes do bundle, e o clique nesse intervalo não chama handler nenhum. */
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

async function idDaTurma(p, nome) {
  const { status, corpo } = await lerApi(p, "/turmas/minhas");
  return status === 200 && Array.isArray(corpo) ? (corpo.find((t) => t.nome === nome)?.id ?? null) : null;
}

/** Uma POST do estudante pela tela: dispara o clique e espera a resposta da rota. */
async function comResposta(p, rota, acao) {
  const resposta = p.waitForResponse((x) => rota.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 30_000 });
  await acao();
  const http = await resposta;
  return { status: http.status(), corpo: await http.json().catch(() => null) };
}

await suite(
  {
    slug: "estudante/18-porta-voz",
    papel: "estudante",
    titulo: "O Porta-Voz dos Dados — a escala, o grupo da cidade e a errata",
    subtitulo:
      "a atividade criada com IA antes da aula, dois estudantes por caminhos opostos (80% sem camadas com errata e perícia; 0% completo pulando tudo), a pausa e a retomada da professora e as habilidades de cada um",
    contexto:
      "O estudante é o Porta-Voz Oficial de Dados da escola: recebe do Assistente de Dados a planilha 95 → 94 → 92 → 88, " +
      "escolhe onde o eixo vertical começa e o que acompanha o boletim, e publica no grupo da cidade. O grupo reage pela " +
      "escala dele, a Escola Santos Dumont publica a MESMA planilha com a escala oposta, a professora pausa as telas para o " +
      "debate e libera a retomada: a errata, o laudo com o Fator de Mentira e a perícia dos cartões eleitorais.",
    prova: [
      "A professora cria a atividade com um tema próprio, o Vertex escreve o pacote (origem ia), ela regenera um bloco, homologa e libera",
      "A lista do Unoochat abre com o Assistente e o grupo com o recorte da professora no nome",
      "O compositor começa SEM escala marcada: o envio fica desabilitado até a escolha (decisão 5); as camadas são opcionais",
      "Quem publica 80% vê as reações do ramo 80 escritas para a turma; o post espelho da Santos Dumont vem em 0% com a autenticação idêntica",
      "Com as telas pausadas, toda POST do estudante responde 409 telas-pausadas; a retomada abre a oferta da errata",
      "A errata entra ABAIXO do original no grupo, gastando o slot 2",
      "O laudo dá ≈ 6,3 e a régua recalcula o fator ao mover a origem do eixo",
      "A perícia aceita sinalizar só o cartão B com o motivo escala; a conclusão não fala de podcast",
      "Quem publica depois da retomada vai direto à oferta da errata (decisão 7) e pode pular errata e perícia",
      "A sessão do estudante não carrega o gabarito da perícia nem o podcast",
      "O painel ao vivo mostra só contagens: a distribuição 0/80 e quantos decidiram a errata e a perícia",
      "A régua dá a cada estudante as seis marcas que a ficha prevê para o caminho que ele fez",
      "A aba Podcast existe para a professora",
    ],
    comando: "node scripts/e2e/estudante/18-porta-voz.mjs",
  },
  async (r) => {
    const daTurma = contasDe("estudante").filter((c) => c.turma === TURMA && c.serie.startsWith(SERIE));
    if (!r.exigir(daTurma.length >= 2, `a ${TURMA} tem dois estudantes no credenciais-demo.csv (${daTurma.length})`)) return;
    const [estudanteA, estudanteB] = daTurma;
    const professora =
      contasDe("professor").find((c) => c.escola.split(" + ").includes(estudanteA.escola) && c.turma.split(" + ").includes(TURMA)) ??
      contasDe("professor").find((c) => c.turma.split(" + ").includes(TURMA));
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSORA: a ficha e a criação com a IA ══════════════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login, senhaDe(professora));
    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professora.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurmaApi = `${RAIZ}/turmas/${turmaId}`;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(
      prof.getByRole("heading", { name: "O Porta-Voz dos Dados", exact: true }),
      prof.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "a ficha da 3ª série, unidade 1" },
    );
    await prof.getByText(/A missão só abre com uma atividade sua em andamento/).first().waitFor({ timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha da 3ª série, unidade 1",
      mostra: "O Porta-Voz dos Dados na trilha: as seis habilidades, o aviso de que a missão só abre com atividade em andamento e os dois botões da aula.",
      prova: "A ficha é da missão 1.0.0 (ADR-198), individual: sem equipe.",
    });

    await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
    const passo = prof.locator("[data-passo-conteudo]");
    /* Estado de ONTEM: um rascunho da IA sem homologar volta à curadoria. Recomeça pelo recorte. */
    const inicio = await primeiroQueAparecer(
      { recorte: passo.locator("[data-recorte-da-aula]"), curadoria: passo.locator("[data-curadoria]") },
      { timeout: 60_000, oQue: "o preparo da turma" },
    );
    if (inicio === "curadoria") {
      await hidratado(prof, passo.locator('[data-acao="recomecar-preparo"]'));
      await passo.locator('[data-acao="recomecar-preparo"]').first().click();
      await passo.locator("[data-recorte-da-aula]").waitFor({ timeout: 30_000 });
    }
    const disciplina = passo.getByRole("combobox", { name: /^Componente Curricular/i });
    await hidratado(prof, disciplina);
    await disciplina.click();
    await prof.getByRole("option", { name: RECORTE.disciplina, exact: true }).first().click();
    const tema = passo.getByRole("textbox", { name: /^Título do Tema Gerador/i });
    await tema.click();
    await tema.pressSequentially(RECORTE.tema);
    const topicos = passo.getByRole("textbox", { name: /^Objetos de Conhecimento/i });
    await topicos.click();
    await topicos.pressSequentially(RECORTE.topicos.join("\n"));
    await r.registrar(prof, "recorte-da-aula", {
      titulo: "O recorte pedagógico da missão",
      mostra: `Matemática, o tema “${RECORTE.tema}” e três objetos de conhecimento — e os dois caminhos: o banco padrão em dois toques ou Gerar Proposta via IA.`,
      prova: "A missão é customizável: o nome do grupo, a tabela, a nota técnica e as falas dos moradores são escritos para esta aula; os números 95/94/92/88 são fixos.",
    });

    await passo.locator('[data-acao="gerar-conteudo"]').click();
    const curadoria = passo.locator("[data-curadoria]");
    const desfecho = await primeiroQueAparecer(
      { curadoria, contingencia: passo.locator("[data-contingencia]"), falha: passo.locator(ALERTA_DE_ERRO) },
      { timeout: 180_000, oQue: "a geração do pacote com IA" },
    );
    if (desfecho !== "curadoria") {
      const aviso = (await passo.locator(`[data-contingencia], ${ALERTA_DE_ERRO}`).first().innerText()).replace(/\s+/g, " ");
      r.exigir(false, `a IA REAL gerou o pacote (a tela respondeu: “${aviso.slice(0, 220)}”)`);
      return;
    }
    r.exigir((await curadoria.innerText()).includes("Gerado com IA"), "a curadoria mostra o pacote “Gerado com IA” (o Vertex respondeu)");
    await r.registrar(prof, "curadoria-da-ia", {
      titulo: "A Curadoria do Pacote de Conteúdo",
      mostra: "O grupo da cidade, a tabela com os números fixos, a nota técnica, as três informações do compositor, as reações nos ramos 0 e 80 e o pós-Aha — tudo editável, cada bloco com “Regenerar Item”.",
      prova: "O Vertex escreveu para o tema da professora (Gerado com IA); a curadoria humana vem antes de a turma ver qualquer coisa.",
      inteira: true,
    });

    /* "Regenerar Item" em UM bloco: o das reações dos moradores. Corre contra o aviso do próprio bloco. */
    const bloco = passo.locator('[data-item-do-pacote="reacoes"]');
    const reacoesAntes = await bloco.locator("textarea").first().inputValue();
    const regenerar = comResposta(prof, /\/regenerar$/, () => bloco.locator('[data-acao="regenerar-item"]').click());
    const regenerado = await regenerar;
    r.exigir(
      regenerado.status === 200 && regenerado.corpo?.usouIa === true,
      `“Regenerar Item” nas reações volta escrito pela IA (HTTP ${regenerado.status}, usouIa ${regenerado.corpo?.usouIa})`,
    );
    await bloco.locator('[data-acao="regenerar-item"]:not([disabled])').waitFor({ timeout: 30_000 });
    r.exigir((await bloco.locator(".unooria-feedback-alert--warning, .unooria-feedback-alert--error").count()) === 0, "o bloco regenerado não traz aviso");
    const reacoesDepois = await bloco.locator("textarea").first().inputValue();
    await bloco.scrollIntoViewIfNeeded();
    await r.registrar(prof, "regenerar-item", {
      titulo: "Regenerar Item: as reações dos moradores",
      mostra: "O bloco das reações, reescrito pela IA sem tocar no resto do pacote.",
      prova: "Regenerar é por BLOCO: o professor troca só o que não gostou, e o resto da curadoria fica como estava.",
      detalhe: reacoesAntes === reacoesDepois ? "a 1ª reação saiu igual" : "a 1ª reação mudou",
    });

    await passo.locator('[data-acao="homologar-conteudo"]').click();
    await esperarOuFalharCedo(passo.locator('[data-fase="ativacao"]'), passo.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "Homologar Pacote de Conteúdo",
    });
    await passo.locator('[data-fase="ativacao"]').getByText(RECORTE.tema, { exact: false }).first().waitFor({ timeout: 10_000 });
    await r.registrar(prof, "pacote-homologado", {
      titulo: "Pronto para Liberação em Sala",
      mostra: "O pacote homologado, com a turma e o tema, à espera do último passo do assistente.",
      prova: "Homologar SÓ aprova; quem põe no ar e libera a missão na sala é “Liberar Atividade para a Turma”.",
    });

    /* Missão individual (MISSOES_SEM_EQUIPE): do conteúdo, direto para a revisão. */
    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').waitFor({ timeout: 10_000 });
    await prof.locator('[data-acao="continuar-criacao"]').click();
    const revisao = prof.locator("[data-revisao-da-criacao]");
    await revisao.waitFor({ timeout: 10_000 });
    r.exigir((await revisao.innerText()).includes("Missão individual"), "sem passo de equipes: a revisão diz “Missão individual”");
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    const liberar = prof.locator('[data-acao="criar-atividade"]');
    r.exigir((await liberar.innerText()).includes("Liberar Atividade para a Turma"), "o botão final diz “Liberar Atividade para a Turma”");
    await liberar.click();
    await esperarOuFalharCedo(
      prof.locator('[data-estado-da-atividade="em-andamento"]'),
      revisao.locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`),
      { timeout: 60_000, oQue: "liberar a atividade" },
    );
    const paginaDaAtividade = prof.url();
    const atividadeId = (await lerApi(prof, `${daTurmaApi}/pacotes`)).corpo?.emAndamento?.pacoteId;
    const detalhe = (await lerApi(prof, `${daTurmaApi}/pacotes/${atividadeId}`)).corpo;
    if (
      !r.exigir(
        detalhe?.origem === "ia" && detalhe?.tema === RECORTE.tema,
        `a atividade EM ANDAMENTO é a da IA, com o tema da professora (origem ${detalhe?.origem}, “${detalhe?.tema}”)`,
      )
    )
      return;
    const k = detalhe.conteudo;
    const nomeDoGrupo = `Comitê Municipal de Políticas Públicas — ${k.grupo}`;
    await r.registrar(prof, "atividade-no-ar", {
      titulo: "A atividade da IA, em andamento",
      mostra: "A página da atividade criada agora: o tema da professora, em andamento, com a aula ao vivo.",
      prova: `Origem “ia”: o grupo se chama “${nomeDoGrupo}” — nada do banco padrão.`,
    });

    // ═══ ESTUDANTE A: a lista, o Assistente e o compositor ═════════════════
    const a = await r.pagina("estudante A", { viewport: { width: 1280, height: 950 } });
    await r.entrar(a, estudanteA.login, senhaDe(estudanteA));
    await a.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    const qa = a.frameLocator("iframe[data-experiencia]");
    await esperarOuFalharPorHttp(a, qa.getByText(COPY.bot, { exact: true }), /porta-voz-dos-dados\/sessao/, {
      timeout: 40_000,
      oQue: "o boot da missão (A)",
    });
    await qa.getByText(nomeDoGrupo, { exact: true }).first().waitFor({ timeout: 10_000 });
    const asideA = a.locator('aside[data-testid="instrucao-da-experiencia"]');
    await r.registrar(a, "lista-do-unoochat", {
      titulo: "A lista de conversas do Unoochat",
      mostra: "O Assistente de Dados com uma mensagem não lida e o grupo da cidade com o recorte da professora no nome; ao lado do aparelho, a instrução do hub.",
      prova: `O nome do grupo vem do pacote homologado (“${k.grupo}”), não da tela.`,
    });

    await qa.getByText(COPY.bot, { exact: true }).first().click();
    await qa.getByRole("button", { name: COPY.iniciar, exact: true }).click();
    await qa.getByRole("button", { name: COPY.gerarPrevias, exact: true }).waitFor({ timeout: 15_000 });
    r.exigir((await qa.getByRole("button", { name: new RegExp(`^Abrir ${k.notaTecnica.arquivo.replace(/\./g, "\\.")}`) }).count()) >= 1, "a nota técnica está anexada no chat (A não a abre)");
    await qa.getByRole("button", { name: COPY.gerarPrevias, exact: true }).click();
    await qa.getByText(COPY.escala80, { exact: true }).click();
    await qa.getByText(`Exibindo: ${COPY.escala80}`, { exact: true }).waitFor({ timeout: 10_000 });
    await r.registrar(a, "previa-80", {
      titulo: "A tabela, o anexo e a prévia em 80%",
      mostra: "A tabela da subprefeitura, a nota técnica anexada (que A não abre) e a prévia com o eixo recortado em 80%.",
      prova: "Nada é gate: dá para avançar sem abrir o anexo. É a EM13CO13 que vai registrar a ausência.",
    });

    await qa.getByRole("button", { name: COPY.abrirCompositor, exact: true }).click();
    const compositorA = qa.getByRole("dialog", { name: COPY.compositor, exact: true });
    await compositorA.waitFor({ timeout: 10_000 });
    const enviarA = compositorA.getByRole("button", { name: COPY.encaminhar, exact: true });
    r.exigir(
      (await compositorA.getByRole("radio", { checked: true }).count()) === 0 && (await enviarA.isDisabled()),
      "o compositor começa sem escala marcada e com o envio desabilitado (decisão 5)",
    );
    r.exigir(await compositorA.getByText(COPY.previaSemEscala, { exact: true }).isVisible(), "sem escala, a prévia pede a escolha da origem do eixo");
    await asideA.waitFor({ timeout: 15_000 });
    r.exigir(/origem do eixo vertical/.test(await asideA.innerText()), "a instrução do hub muda para o compositor (origem do eixo vertical)");
    await r.registrar(a, "compositor-sem-escala", {
      titulo: "O compositor, sem escala marcada",
      mostra: "A origem do eixo (0–100% e 80–100%) sem nada marcado, as três informações desligadas e o envio desabilitado.",
      prova: "Escolher o eixo é parte da ação, não uma camada: o envio só acende com a escala; as camadas são opcionais.",
    });

    await compositorA.getByRole("radio", { name: COPY.oitenta, exact: true }).check({ force: true });
    await compositorA.locator("button:not([disabled])", { hasText: COPY.encaminhar }).waitFor({ timeout: 5_000 }).catch(() => {});
    r.exigir(!(await enviarA.isDisabled()), "escolhida a escala, o envio acende");
    r.exigir((await compositorA.getByRole("switch", { checked: true }).count()) === 0, "A publica sem nenhuma camada ligada");
    await r.registrar(a, "compositor-80-sem-camadas", {
      titulo: "80–100%, sem camadas",
      mostra: "A escala recortada em 80% e a prévia ao vivo do boletim, sem anotação, sem fonte e sem contexto.",
      prova: "A prévia é o MESMO post que vai ao grupo: o que o estudante vê é o que publica.",
    });
    await enviarA.click();
    const confirmacaoA = qa.getByRole("dialog", { name: COPY.confirmarTitulo, exact: true });
    await confirmacaoA.waitFor({ timeout: 10_000 });
    r.exigir((await confirmacaoA.innerText()).includes("1 de suas 3 publicações"), "a confirmação avisa que gasta 1 das 3 publicações");
    const publicouA = await comResposta(a, /decisao\/publicar$/, () => confirmacaoA.getByRole("button", { name: COPY.confirmar, exact: true }).click());
    r.exigir(publicouA.status === 200 && publicouA.corpo?.slotsRestantes === 2, `a 1ª publicação grava e gasta o slot 1 (HTTP ${publicouA.status}, restam ${publicouA.corpo?.slotsRestantes})`);

    // ═══ ESTUDANTE A: o grupo da cidade ════════════════════════════════════
    const feedA = publicouA.corpo?.feed;
    r.exigir(
      JSON.stringify((feedA?.reacoes ?? []).map((f) => f.texto)) === JSON.stringify(k.reacoes.oitenta.map((f) => f.texto)),
      "o grupo reage pelo RAMO 80 do pacote homologado (as reações escritas para a turma)",
    );
    for (const fala of k.reacoes.oitenta) await qa.getByText(fala.texto, { exact: true }).first().waitFor({ timeout: 20_000 });
    const rival = qa.locator('[data-post="rival"]');
    await rival.waitFor({ timeout: 25_000 });
    r.exigir((await rival.getAttribute("data-escala")) === "0", "o post espelho da Santos Dumont vem com a escala OPOSTA (0%)");
    r.exigir((await rival.innerText()).includes(COPY.rival), "o post espelho é da Escola Estadual Santos Dumont");
    await qa.getByText(COPY.autenticacao, { exact: true }).waitFor({ timeout: 10_000 });
    await qa.getByText(k.posAha.conflito.texto, { exact: true }).waitFor({ timeout: 15_000 });
    await qa.getByText(k.posAha.coordenador.texto, { exact: false }).first().waitFor({ timeout: 15_000 });
    r.exigir(
      (await qa.locator('[data-post="inicial"]').getAttribute("data-escala")) === "80",
      "o post de A está no grupo com a escala que ele escolheu (80%)",
    );
    await r.registrar(a, "grupo-reage-80", {
      titulo: "O grupo da cidade reage ao recorte de 80%",
      mostra: `O boletim de A, as reações do ramo 80, o post espelho da Santos Dumont em 0% com “Autenticação Criptográfica Idêntica”, o morador confuso e ${k.posAha.coordenador.autor} suspendendo a deliberação.`,
      prova: "A reação depende da ESCALA publicada, não do texto: a mesma planilha, com o eixo oposto, conta outra história.",
    });
    const sessaoA = await lerApi(a, `${RAIZ}/sessao`);
    const textoDaSessao = JSON.stringify(sessaoA.corpo ?? {});
    r.exigir(
      sessaoA.status === 200 && !/cartaoDistorcido|"motivoDaDistorcao"|gabarito|podcast/i.test(textoDaSessao),
      "GET sessao não traz o gabarito da perícia nem nada do podcast",
    );

    // ═══ PROFESSORA: a aula ao vivo e a pausa ══════════════════════════════
    await prof.goto(paginaDaAtividade, { waitUntil: "domcontentloaded" });
    const painel = prof.locator("[data-painel-da-aula]");
    await revelar(prof, painel);
    await painel.waitFor({ timeout: 30_000 });
    const pausar = prof.locator('[data-acao="pausar-debate"]');
    await hidratado(prof, pausar);
    await pausar.click();
    const dialogoPausa = prof.getByRole("dialog", { name: "Pausar as telas para o debate?" });
    await dialogoPausa.waitFor({ timeout: 10_000 });
    await dialogoPausa.getByRole("button", { name: "Pausar para o debate" }).click();
    await esperarOuFalharCedo(prof.locator('[data-controle-da-missao][data-etapa="pausa"]'), painel.locator(ALERTA_DE_ERRO), {
      timeout: 20_000,
      oQue: "Pausar para o debate",
    });
    await r.registrar(prof, "pausa-para-o-debate", {
      titulo: "Pausar para o debate",
      mostra: "A aula ao vivo com a turma em pausa: a lousa de contagens e o roteiro das três perguntas do debate.",
      prova: "O gate só anda para a frente (exploração → pausa → liberada), com confirmação.",
      inteira: true,
    });

    const faixa = qa.locator("[data-pausa]");
    await faixa.waitFor({ timeout: 20_000 });
    r.exigir((await faixa.innerText()).includes(COPY.pausa), "no grupo, a pausa é o rodapé com a faixa da Coordenação");
    const congelada = await mandarApi(a, `${RAIZ}/errata/pular`);
    r.exigir(
      congelada.status === 409 && congelada.corpo?.codigo === "telas-pausadas",
      `com as telas pausadas, a POST do estudante responde 409 telas-pausadas (${congelada.status} ${congelada.corpo?.codigo ?? ""})`,
    );
    await r.registrar(a, "telas-pausadas", {
      titulo: "As telas pausadas",
      mostra: "O grupo com o rodapé “Sessão pausada pela Coordenação para mediação técnica em sala. Aguarde orientações.” — a rolagem continua livre.",
      prova: "A pausa chega pelo polling de 3 s; toda POST do estudante responde 409 enquanto ela vale.",
    });

    await prof.locator('[data-acao="liberar-retomada"]').click();
    const dialogoLiberar = prof.getByRole("dialog", { name: "Liberar a retomada da turma?" });
    await dialogoLiberar.waitFor({ timeout: 10_000 });
    await dialogoLiberar.getByRole("button", { name: "Liberar Retomada da Turma" }).click();
    await esperarOuFalharCedo(prof.locator('[data-controle-da-missao][data-etapa="liberada"]'), painel.locator(ALERTA_DE_ERRO), {
      timeout: 20_000,
      oQue: "Liberar Retomada da Turma",
    });

    // ═══ ESTUDANTE A: a errata ═════════════════════════════════════════════
    await qa.getByRole("button", { name: COPY.abrirAssistente, exact: true }).click({ timeout: 25_000 });
    await qa.getByText(/ERRATA TÉCNICA CORRETIVA utilizando o seu 2º slot/).waitFor({ timeout: 10_000 });
    await r.registrar(a, "oferta-da-errata", {
      titulo: "A oferta da errata",
      mostra: "O Assistente de Dados libera o 2º slot: “Publicar Errata Corretiva” ou “Avançar sem publicar errata”.",
      prova: "A errata só abre com a retomada liberada; o original permanece no histórico.",
    });
    await qa.locator(".rodape").getByRole("button", { name: COPY.publicarErrata, exact: true }).click();
    const errataA = qa.getByRole("dialog", { name: COPY.compositorErrata, exact: true });
    await errataA.waitFor({ timeout: 10_000 });
    r.exigir(await errataA.getByRole("radio", { name: COPY.oitenta, exact: true }).isChecked(), "o compositor da errata recarrega a 1ª publicação (80%)");
    await errataA.getByRole("radio", { name: COPY.zero, exact: true }).check({ force: true });
    await errataA.getByRole("switch", { name: new RegExp(`^${COPY.camadas.fonte}`) }).click();
    r.exigir(
      (await errataA.getByRole("switch", { name: new RegExp(`^${COPY.camadas.fonte}`) }).getAttribute("aria-checked")) === "true",
      "a fonte dos dados fica ligada na errata",
    );
    await r.registrar(a, "errata-0-com-fonte", {
      titulo: "A errata: 0–100% com a fonte",
      mostra: "O compositor da errata (slot 2 de 3) com a etiqueta Errata, a escala trocada para 0–100% e a fonte dos dados ligada.",
      prova: "A errata parte da 1ª publicação INTEIRA: o estudante muda só o que quer corrigir.",
    });
    await errataA.getByRole("button", { name: COPY.publicarErrata, exact: true }).click();
    const confirmacaoErrata = qa.getByRole("dialog", { name: COPY.confirmarTitulo, exact: true });
    await confirmacaoErrata.waitFor({ timeout: 10_000 });
    r.exigir((await confirmacaoErrata.innerText()).includes("slot 2 de 3"), "a confirmação da errata fala do slot 2 de 3");
    const errataPublicada = await comResposta(a, /errata\/publicar$/, () => confirmacaoErrata.getByRole("button", { name: COPY.confirmar, exact: true }).click());
    r.exigir(
      errataPublicada.status === 200 && errataPublicada.corpo?.slotsRestantes === 1 && errataPublicada.corpo?.publicacoes?.errata?.escala === 0,
      `a errata grava 0% e gasta o slot 2 (HTTP ${errataPublicada.status}, restam ${errataPublicada.corpo?.slotsRestantes})`,
    );
    const postErrata = qa.locator('[data-post="errata"]');
    await postErrata.waitFor({ timeout: 15_000 });
    const errataAbaixo = await qa
      .locator('[data-post="inicial"]')
      .evaluate((original) => {
        const errata = document.querySelector('[data-post="errata"]');
        return Boolean(errata && original.compareDocumentPosition(errata) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
    r.exigir(errataAbaixo, "no grupo, a errata entra ABAIXO do boletim original");
    r.exigir((await postErrata.innerText()).includes(k.camadas.fonte), "a errata traz a linha da fonte dos dados");
    await postErrata.scrollIntoViewIfNeeded();
    await r.registrar(a, "errata-no-grupo", {
      titulo: "A errata abaixo do original",
      mostra: "O boletim original em 80% continua no histórico; a errata em 0% com a fonte entra abaixo dele, e o caminho segue para o laudo.",
      prova: "As publicações são LINHAS: a 1ª nunca é apagada. Não há 3ª publicação.",
    });

    // ═══ ESTUDANTE A: o laudo ══════════════════════════════════════════════
    await qa.getByRole("button", { name: COPY.irAoLaudo, exact: true }).click();
    const laudo = qa.locator('[data-tela="laudo"]');
    await laudo.waitFor({ timeout: 15_000 });
    await laudo.getByText(COPY.fator, { exact: true }).first().waitFor({ timeout: 10_000 });
    const leitura = laudo.locator("[data-fator]");
    /* A demonstração do gesto (2 ciclos de 2,4 s) termina na origem 0; espera o desfecho, não o relógio. */
    await laudo.locator('[data-fator="≈ 1,0"]').waitFor({ timeout: 15_000 });
    const regua = laudo.getByRole("slider").first();
    await regua.focus();
    await regua.press("End");
    await laudo.locator(`[data-fator="${COPY.fator}"]`).waitFor({ timeout: 5_000 });
    r.exigir((await leitura.innerText()).includes("Com o eixo em 80%"), "com a régua em 80%, a leitura diz ≈ 6,3");
    await r.registrar(a, "laudo-regua-80", {
      titulo: "O laudo: o Fator de Mentira",
      mostra: "A desmontagem, o Fator de Mentira ≈ 6,3 e a régua do eixo arrastada até 80%: o mesmo gráfico do boletim, recortado.",
      prova: "LF(o) = 95 / (95 − o): 1 com o eixo em 0, ≈ 6,3 em 80 — o laudo é da escola (seção unooria), não do mensageiro.",
    });
    await regua.press("Home");
    await laudo.locator('[data-fator="≈ 1,0"]').waitFor({ timeout: 5_000 });
    r.exigir(true, "a régua de volta a 0% recalcula o fator para ≈ 1,0");

    // ═══ ESTUDANTE A: a perícia ════════════════════════════════════════════
    await laudo.getByRole("button", { name: COPY.irAPericia, exact: true }).click();
    await qa.getByText(COPY.canal, { exact: true }).first().waitFor({ timeout: 15_000 });
    const cartaoB = qa.locator('[data-cartao="B"]');
    await cartaoB.waitFor({ timeout: 10_000 });
    await qa.getByRole("button", { name: COPY.verDados, exact: true }).first().click();
    const folhaDados = qa.getByRole("dialog", { name: "Relatório Técnico Oficial de Ocorrências Policiais" });
    await folhaDados.waitFor({ timeout: 10_000 });
    await r.registrar(a, "pericia-dados", {
      titulo: "A perícia: os dados oficiais",
      mostra: "A folha “Ver dados e fonte”: as taxas da Secretaria nos dois anos e o eixo de cada cartão.",
      prova: "Os cartões chegam como peças, sem rótulo de certo ou errado: o gabarito fica no servidor.",
    });
    await folhaDados.getByRole("button", { name: COPY.retornar, exact: true }).click();
    await folhaDados.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    await cartaoB.getByRole("switch", { name: COPY.sinalizar, exact: true }).click();
    const emitir = qa.getByRole("button", { name: COPY.emitir, exact: true });
    r.exigir(await emitir.isDisabled(), "com o cartão B sinalizado sem motivo, “Emitir parecer” fica desabilitado");
    await cartaoB.getByRole("radio", { name: "escala", exact: true }).check({ force: true });
    r.exigir(!(await emitir.isDisabled()), "com o motivo, o parecer acende");
    r.exigir((await qa.locator('[data-cartao="A"]').getByRole("switch", { checked: true }).count()) === 0, "o cartão A fica sem sinalização");
    await cartaoB.scrollIntoViewIfNeeded();
    await r.registrar(a, "pericia-so-b-escala", {
      titulo: "A perícia: só o cartão B, pela escala",
      mostra: "O cartão B (eixo de 23,5 a 24,5) sinalizado para revisão com o motivo escala; o cartão A sem sinalização.",
      prova: "O parecer só exige motivo para o cartão sinalizado; a resposta não diz se acertou.",
    });
    const parecer = await comResposta(a, /pericia\/parecer$/, () => emitir.click());
    r.exigir(parecer.status === 200 && parecer.corpo?.concluido === true, `o parecer conclui a missão (HTTP ${parecer.status})`);
    r.exigir(!/acert|corret|gabarito/i.test(JSON.stringify(parecer.corpo?.pericia ?? {})), "a resposta ao parecer não diz se acertou");

    const conclusaoA = qa.locator('[data-tela="conclusao"]');
    await conclusaoA.waitFor({ timeout: 15_000 });
    await conclusaoA.getByText(COPY.selo).waitFor({ timeout: 10_000 });
    r.exigir((await conclusaoA.innerText()).includes(COPY.encerrado), "a conclusão traz o selo e “Protocolo Pericial Encerrado”");
    r.exigir(!/podcast|transcri/i.test(await qa.locator("body").innerText()), "a conclusão do estudante não fala de podcast (decisão 1)");
    await r.registrar(a, "conclusao-a", {
      titulo: "A conclusão, sem podcast",
      mostra: "O selo “Missão Oficial Concluída — Protocolo Homologado”, o texto e o modo somente leitura.",
      prova: "O podcast é só da professora (decisão 1); a régua de cada habilidade também.",
    });

    // ═══ ESTUDANTE B: depois da retomada, o caminho oposto ═════════════════
    const b = await r.pagina("estudante B", { viewport: { width: 1280, height: 950 } });
    await r.entrar(b, estudanteB.login, senhaDe(estudanteB));
    await b.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    const qb = b.frameLocator("iframe[data-experiencia]");
    await esperarOuFalharPorHttp(b, qb.getByText(COPY.bot, { exact: true }), /porta-voz-dos-dados\/sessao/, {
      timeout: 40_000,
      oQue: "o boot da missão (B)",
    });
    await qb.getByText(COPY.bot, { exact: true }).first().click();
    await qb.getByRole("button", { name: COPY.iniciar, exact: true }).click();
    const anexo = qb.getByRole("button", { name: new RegExp(`^Abrir ${k.notaTecnica.arquivo.replace(/\./g, "\\.")}`) });
    const abriuAnexo = await comResposta(b, /sessao\/marco$/, () => anexo.click());
    r.exigir(abriuAnexo.status === 200 && abriuAnexo.corpo?.marcos?.anexoAberto === true, "abrir a nota técnica carimba o marco no servidor");
    const nota = qb.getByRole("dialog", { name: k.notaTecnica.titulo });
    await nota.waitFor({ timeout: 10_000 });
    r.exigir((await nota.innerText()).includes(k.notaTecnica.resumo.slice(0, 40)), "a folha traz a nota técnica do pacote");
    await r.registrar(b, "b-abre-a-nota-tecnica", {
      titulo: "B abre a nota técnica antes do compositor",
      mostra: `A folha “${k.notaTecnica.titulo}”, com o contexto da queda que só quem abre fica sabendo.`,
      prova: "O horário que a EM13CO13 lê é o do servidor: abrir antes do compositor (e do aviso de 90 s) é o atingiu.",
    });
    await nota.getByRole("button", { name: COPY.concluirLeitura, exact: true }).click();
    await qb.getByRole("button", { name: COPY.gerarPrevias, exact: true }).click();
    await qb.getByText(COPY.escala0, { exact: true }).click();
    await qb.getByRole("button", { name: COPY.abrirCompositor, exact: true }).click();
    const compositorB = qb.getByRole("dialog", { name: COPY.compositor, exact: true });
    await compositorB.waitFor({ timeout: 10_000 });
    await compositorB.getByRole("radio", { name: COPY.zero, exact: true }).check({ force: true });
    for (const camada of Object.values(COPY.camadas)) await compositorB.getByRole("switch", { name: new RegExp(`^${camada}`) }).click();
    r.exigir((await compositorB.getByRole("switch", { checked: true }).count()) === 3, "B liga as três informações (explicação, fonte e contexto)");
    await r.registrar(b, "b-compositor-completo", {
      titulo: "B: 0–100% com as três informações",
      mostra: "O eixo em 0% e a explicação da escala, a fonte e o contexto da oscilação ligados, na prévia ao vivo.",
      prova: "A explicação da escala acompanha a origem marcada: o texto é o do ramo 0 do pacote.",
    });
    await compositorB.getByRole("button", { name: COPY.encaminhar, exact: true }).click();
    const confirmacaoB = qb.getByRole("dialog", { name: COPY.confirmarTitulo, exact: true });
    await confirmacaoB.waitFor({ timeout: 10_000 });
    const publicouB = await comResposta(b, /decisao\/publicar$/, () => confirmacaoB.getByRole("button", { name: COPY.confirmar, exact: true }).click());
    r.exigir(
      publicouB.status === 200 && publicouB.corpo?.passo === "errata",
      `quem publica DEPOIS da retomada vai direto à errata (decisão 7; passo ${publicouB.corpo?.passo})`,
    );
    r.exigir(
      JSON.stringify((publicouB.corpo?.feed?.reacoes ?? []).map((f) => f.texto)) === JSON.stringify(k.reacoes.zero.map((f) => f.texto)),
      "o grupo de B reage pelo RAMO 0",
    );
    for (const fala of k.reacoes.zero) await qb.getByText(fala.texto, { exact: true }).first().waitFor({ timeout: 20_000 });
    await qb.locator('[data-post="rival"][data-escala="80"]').waitFor({ timeout: 25_000 });
    await qb.getByRole("button", { name: COPY.abrirAssistente, exact: true }).waitFor({ timeout: 20_000 });
    await r.registrar(b, "b-grupo-reage-0", {
      titulo: "B: o grupo reage ao eixo em 0%",
      mostra: "As reações do ramo 0, o post espelho da Santos Dumont em 80% — e, sem pausa (a turma já foi liberada), o botão para a mensagem do Assistente.",
      prova: "Quem chega ao Aha depois da retomada vê o conflito e segue direto para a oferta da errata (decisão 7).",
    });
    await qb.getByRole("button", { name: COPY.abrirAssistente, exact: true }).click();
    await comResposta(b, /errata\/pular$/, () => qb.locator(".rodape").getByRole("button", { name: COPY.pularErrata, exact: true }).click());
    const laudoB = qb.locator('[data-tela="laudo"]');
    await laudoB.waitFor({ timeout: 15_000 });
    await comResposta(b, /sessao\/marco$/, () => laudoB.getByRole("button", { name: COPY.irAPericia, exact: true }).click());
    await qb.getByRole("button", { name: COPY.pularPericia, exact: true }).waitFor({ timeout: 15_000 });
    await r.registrar(b, "b-pericia", {
      titulo: "B: a perícia, sem parecer",
      mostra: "Os dois cartões eleitorais, e “Avançar sem emitir parecer” sempre visível.",
      prova: "Nada é gate: pular a errata e a perícia é escolha do estudante, e a régua registra isso.",
    });
    const pulouB = await comResposta(b, /pericia\/pular$/, () => qb.getByRole("button", { name: COPY.pularPericia, exact: true }).click());
    r.exigir(pulouB.status === 200 && pulouB.corpo?.concluido === true, `pular a perícia conclui a missão de B (HTTP ${pulouB.status})`);
    await qb.locator('[data-tela="conclusao"]').waitFor({ timeout: 15_000 });
    await r.registrar(b, "conclusao-b", {
      titulo: "B conclui",
      mostra: "O selo e o modo somente leitura, como para A.",
      prova: "A conclusão é a mesma para todos: o que cada um fez fica na régua da professora, não na tela do estudante.",
    });

    // ═══ PROFESSORA: o painel ao vivo ══════════════════════════════════════
    await prof.goto(paginaDaAtividade, { waitUntil: "domcontentloaded" });
    await revelar(prof, painel);
    await painel.waitFor({ timeout: 30_000 });
    const resumo = (await lerApi(prof, `${daTurmaApi}/painel`)).corpo?.resumo;
    r.exigir(
      resumo?.primeiraPublicacao?.escala0 === 1 && resumo?.primeiraPublicacao?.escala80 === 1,
      `a lousa conta a 1ª publicação: 1 em 0% e 1 em 80% (${JSON.stringify(resumo?.primeiraPublicacao)})`,
    );
    r.exigir(
      resumo?.errata?.publicaram === 1 && resumo?.errata?.pularam === 1 && resumo?.pericia?.emitiram === 1 && resumo?.pericia?.pularam === 1,
      `errata 1 publicou / 1 pulou; perícia 1 emitiu / 1 pulou (${JSON.stringify({ errata: resumo?.errata, pericia: resumo?.pericia })})`,
    );
    r.exigir(resumo?.abriramAnexo === 1 && resumo?.porPasso?.concluida === 2, `1 abriu o anexo e 2 concluíram (${resumo?.abriramAnexo}, ${resumo?.porPasso?.concluida})`);
    const distribuicao = painel.locator("[data-distribuicao-das-escalas]");
    await distribuicao.getByText("Eixo em 0%: 50% · Eixo em 80%: 50%", { exact: false }).first().waitFor({ timeout: 15_000 });
    /* A lousa DIZ "sem acerto nem ranking" no subtítulo: o que se confere é a estrutura — a folha nominal só tem nome, etapa e tempo parado. */
    const colunas = await painel.locator("[data-monitor-de-ritmo]").getByRole("columnheader").allInnerTexts();
    r.exigir(
      colunas.length > 0 && !colunas.some((c) => /\b(n[íi]vel|pontos|nota|ranking|escala|acerto)\b/i.test(c)),
      `a folha nominal não tem coluna de nível, nota, escala nem ranking (colunas: ${colunas.join(", ")})`,
    );
    r.exigir(
      !(await painel.locator("[data-monitor-de-ritmo]").innerText()).includes("80%"),
      "a folha nominal não mostra a escala de ninguém",
    );
    await distribuicao.scrollIntoViewIfNeeded();
    await r.registrar(prof, "painel-ao-vivo", {
      titulo: "A aula ao vivo: só contagens",
      mostra: "Pausados, quem abriu o anexo, quem publicou e concluiu; a distribuição da escala na 1ª publicação (50% em 0, 50% em 80); a errata e a perícia em contagem.",
      prova: "A lousa vai ao projetor: sem nomes, sem ranking, sem a escala de ninguém. Os nomes ficam só na folha de ritmo.",
      inteira: true,
    });

    // ═══ PROFESSORA: as habilidades ════════════════════════════════════════
    const evidencia = (await lerApi(prof, `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`)).corpo;
    const statusDe = (nome, codigo) => {
      const doEstudante = evidencia?.estudantes?.find((x) => x.nome === nome);
      return Object.values(doEstudante?.porRodada ?? {}).map((rodada) => rodada?.[codigo]?.status).find(Boolean) ?? null;
    };
    for (const [quem, conta] of [["A", estudanteA], ["B", estudanteB]]) {
      const obtido = Object.fromEntries(Object.keys(ESPERADO[quem]).map((c) => [c, statusDe(conta.nome, c)]));
      r.exigir(
        Object.entries(ESPERADO[quem]).every(([c, s]) => obtido[c] === s),
        `a régua de ${quem} (${conta.nome}) é a da ficha: ${Object.entries(obtido).map(([c, s]) => `${c} ${s}`).join(", ")}`,
      );
    }
    await prof.reload({ waitUntil: "domcontentloaded" });
    const habilidades = prof.locator("[data-habilidades-porta-voz]");
    await revelar(prof, habilidades);
    await habilidades.waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await habilidades.innerText();
    for (const codigo of Object.keys(ESPERADO.A)) r.exigir(textoDasHabilidades.includes(codigo), `o painel de habilidades traz ${codigo}`);
    r.exigir(
      textoDasHabilidades.includes(estudanteA.nome) && textoDasHabilidades.includes(estudanteB.nome),
      "o painel de habilidades traz os dois estudantes",
    );
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "O Relatório Final de Proficiência",
      mostra: "As seis habilidades (EM13CO12, 13, 14, 21, 22 e 26) com o nível de cada estudante: A e B por caminhos opostos.",
      prova: "Só Canal A: a escala final, a nota técnica antes do compositor, a perícia, a explicação, as camadas e a errata — tudo pelo que o estudante fez.",
      inteira: true,
    });

    /* O podcast é FIXO e só da professora (decisão 1): a aba Podcast da atividade. */
    const podcast = prof.locator("[data-podcast-da-aula], [data-podcast-indisponivel]");
    await revelar(prof, podcast);
    await podcast.first().waitFor({ timeout: 15_000 });
    r.exigir((await prof.locator("[data-podcast-da-aula]").count()) >= 1, "a aba Podcast está na página da atividade, para a professora");
    await podcast.first().scrollIntoViewIfNeeded();
    await r.registrar(prof, "podcast-da-professora", {
      titulo: "O podcast, só para a professora",
      mostra: "A aba Podcast da atividade, com o episódio fixo da missão para tocar em aula.",
      prova: "A tela do estudante não fala de podcast; o episódio é material da professora.",
    });
  },
);
