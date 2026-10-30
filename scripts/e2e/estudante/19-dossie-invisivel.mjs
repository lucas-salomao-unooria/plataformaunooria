import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { revelar } from "../lib/abas.mjs";

/**
 * O DOSSIÊ INVISÍVEL (exp09ef1b, 9º ano do EF, unidade 1 — ADR-202), das duas
 * pontas da sala, com TRÊS estudantes da mesma turma — um por caminho da
 * investigação.
 *
 * O professor usa o BANCO PADRÃO (“Usar banco padrão”: já homologado, no ar e
 * liberado na sala no mesmo toque) e conclui o assistente. Três estudantes da
 * 9A conversam com o assistente do conselho no UnooriaAI:
 *
 *   - A1 pergunta, com as palavras dela, pela falta de registros do Mesa
 *     Aberta, aceita a oferta e DIGITALIZA os cadernos na E2; vota no Mesa
 *     Aberta e, no 2º voto, mantém;
 *   - A2 faz a mesma pergunta, recebe a oferta, NÃO digitaliza e clica “Ver
 *     Projetos”; vota no Conexão (a nuvem) e, depois dos cadernos, revisa para o
 *     Mesa Aberta;
 *   - B usa as três sugestões (nunca pergunta pela lacuna); vota no Conexão e,
 *     no 2º voto, troca de projeto sem pôr a urgência acima da regularidade.
 *
 * O professor aperta as TRÊS travas em ordem (“Liberar Próxima Pauta”, “Abrir
 * Revisão da Decisão”, “Destravar Explicar e Protocolo”). Na E4 quem não
 * digitalizou digitaliza, vê a tabela, toca uma pílula e espera o debate; na E5
 * cada um marca âncoras e monta um protocolo diferente. No fim: o painel ao vivo
 * (contagens A1/A2/B, os votos e a migração) e o NÍVEL das duas habilidades de
 * cada um, conferido contra a régua.
 *
 * O chat passa pelo classificador de IA REAL (Vertex) na pergunta digitada;
 * com o ADC vencido a árvore de intenções responde e o caminho é o mesmo — a
 * tela não diz quem classificou (a sessão guarda, mas não desce), então a
 * suíte não pode afirmar qual respondeu.
 *
 * Os seletores são CONTRATO com a experiência
 * (`apps/experiencias/exp09ef1b/src/app/{telas,clone,mecanica}`), com os textos da
 * api (`dossie-invisivel/conteudo.ts`) e com o hub
 * (`atividades/nova/criar-dossie-invisivel.tsx`, `resultados/painel-da-aula-dossie-invisivel.tsx`,
 * `resultados/resultados-dossie-invisivel.tsx`).
 */

const SERIE = "9EF";
const EXP_ID = "exp09ef1b";
const TURMA = process.env.TURMA ?? "9A";
const FICHA = `${HUB}/professor/entre-redes/9-ano/unidade-1`;
const RAIZ = "/dossie-invisivel";

/** A copy da tela e da api (`conteudo.ts`, `TEXTOS_DA_TELA`, `src/lib/textos.ts`) — literal. */
const COPY = {
  comecar: "Começar Análise",
  verProjetos: "Ver Projetos",
  escolher: "Escolher Projeto",
  digitalizar: "Digitalizar cadernos",
  registrar: "Registrar Decisão",
  manter: "Manter Decisão Original",
  revisar: "Revisar Decisão",
  confirmarFinal: "Confirmar Decisão Final",
  abrirEditor: "Abrir Editor de Protocolo",
  enviarProposta: "Enviar Proposta",
  marcar: "Marcar no histórico",
  enviar: "Enviar",
  pilulaCusto: "Comparar custo real por refeição diária",
  caminhoA1: "Caminho investigativo A1 ativo: você descobriu os dados físicos antes da deliberação.",
  ofertaDosCadernos: "O inventário do conselho registra 3 cadernos de campo do Mesa Aberta em arquivo físico.",
  ocrConcluido: "Leitura óptica dos 3 cadernos concluída com sucesso.",
  parecerInicial: "recomendo o Conexão para Continuar por menor risco documental",
  parecerInvertido: "o projeto Mesa Aberta atinge a pontuação máxima de mérito",
  constatacao: "Constatação de Auditoria: Os critérios de peso e atendimento não mudaram. O que mudou foi o que o robô conseguia ler.",
  esperaDoDebate: "Debate da plenária em andamento.",
  espera: "Parecer registrado. Aguardando autorização da presidência da mesa para abrir o próximo ponto de pauta.",
  amaraInduzida: "parte significativa da turma foi induzida pelos relatórios da nuvem",
  concluida: "Auditoria orçamentária homologada e arquivada nos anais do conselho",
};

/** As três sugestões da abertura, literais (`SUGESTOES`): vão por fora da IA. */
const SUGESTOES = [
  "Qual projeto atende mais pessoas pelo menor custo por vaga?",
  "Compare a regularidade e os relatórios enviados pelos três projetos.",
  "Quais são as evidências de impacto de cada iniciativa?",
];

/** A pergunta da investigação, com palavras de estudante — vai ao classificador de IA. */
const PERGUNTA_DA_LACUNA = "Por que o Mesa Aberta não tem relatórios no sistema? Onde estão os registros?";

/** As travas do professor, na ordem (o rótulo do botão e o título da confirmação). */
const TRAVAS = {
  revelacao: { botao: "Liberar Próxima Pauta", dialogo: "Liberar a próxima pauta?" },
  revoto: { botao: "Abrir Revisão da Decisão", dialogo: "Abrir a revisão da decisão?" },
  explicar: { botao: "Destravar Explicar e Protocolo", dialogo: "Destravar o Explicar e o Protocolo?" },
};

/** O gabarito do protocolo (`regras/evidencia.ts`): o estudante não o recebe. */
const GABARITO = ["auditar-fontes", "normalizar-impacto", "sinalizar-pendencias"];
const DANOSO = "desclassificar-sem-pdf";

/**
 * O QUE A RÉGUA DEVE DAR — de `dossie-invisivel/regras/evidencia.ts`, não chutado:
 *
 * A1 — perguntou e digitalizou na E2; protocolo A, B, C e o D na lixeira.
 *   EF09CO08 (caminho A1: investigou antes da escolha) ........ atingiu
 *   EF09CO07 (3 certos + o danoso descartado) ................ atingiu
 * A2 — perguntou, recebeu a oferta e não digitalizou; protocolo A, B e a 3ª vazia.
 *   EF09CO08 (caminho A2: investigou) ........................ atingiu
 *   EF09CO07 (2 dos 3 certos) ................................ em_processo
 * B — só as sugestões; troca de projeto no 2º voto com a urgência ABAIXO da
 *     regularidade; protocolo só com o bloco danoso na 1ª verificação.
 *   EF09CO08 (B, mudou o projeto, sem urgência > regularidade)  em_processo
 *   EF09CO07 (nenhum certo) .................................. nao_atingiu
 */
const ESPERADO = {
  A1: { EF09CO08: "atingiu", EF09CO07: "atingiu" },
  A2: { EF09CO08: "atingiu", EF09CO07: "em_processo" },
  B: { EF09CO08: "em_processo", EF09CO07: "nao_atingiu" },
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
async function comResposta(p, rota, acao, timeout = 30_000) {
  const resposta = p.waitForResponse((x) => rota.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout });
  await acao();
  const http = await resposta;
  return { status: http.status(), corpo: await http.json().catch(() => null) };
}

await suite(
  {
    slug: "estudante/19-dossie-invisivel",
    papel: "estudante",
    titulo: "O Dossiê Invisível — os rastros digitais, os cadernos de papel e o protocolo",
    subtitulo:
      "o banco padrão em dois toques, três estudantes pelos três caminhos da investigação (A1, A2 e B), as três travas da professora e as habilidades de cada um",
    contexto:
      "O estudante é o Conselheiro Relator de uma comissão que tem R$ 12.000 indivisíveis para três projetos de jovens. O " +
      "assistente de IA do conselho só lê o que foi digitalizado: recomenda o projeto com 12 relatórios em PDF, e o Mesa " +
      "Aberta, com 180 registros em cadernos de papel, aparece em último. Quem pergunta pela falta de registros recebe a " +
      "oferta de digitalizar os cadernos; a professora libera a próxima pauta e, com os MESMOS critérios, o parecer se " +
      "inverte. Depois do debate, o 2º voto; por fim, Amara nomeia o viés e cada um monta o protocolo do assistente.",
    prova: [
      "“Usar banco padrão” põe o banco curado no ar e libera a missão na sala; o assistente fecha em “Liberar para a Turma”",
      "A pergunta pela falta de registros do Mesa Aberta recebe a oferta dos cadernos; a sugestão nunca a recebe",
      "Digitalizar na E2 é o caminho A1 (o parecer se inverte antes da escolha); a oferta sem digitalizar é o A2; só as sugestões, o B",
      "“Registrar Decisão” só acende com o projeto marcado e o ranking tocado; registrar leva à espera da presidência da mesa",
      "As três travas andam só para a frente, com confirmação, e só a próxima fica habilitada",
      "Na E4, quem não digitalizou digitaliza; a tabela de confronto e a pílula dirigida; o 2º voto só abre depois da trava do debate",
      "Na E5, Amara afirma a indução da turma (2 de 3 votaram na nuvem), as âncoras se marcam no histórico e o editor aceita qualquer composição",
      "A sessão do estudante não traz o gabarito do protocolo",
      "O painel ao vivo mostra só contagens: A1/A2/B, a 1ª deliberação, a migração no 2º voto e os protocolos",
      "A régua dá a cada estudante o nível de EF09CO08 e EF09CO07 que o caminho dele prevê, na api e no painel de habilidades da atividade",
    ],
    comando: "node scripts/e2e/estudante/19-dossie-invisivel.mjs",
  },
  async (r) => {
    const daTurma = contasDe("estudante").filter((c) => c.turma === TURMA && c.serie.startsWith(SERIE));
    if (!r.exigir(daTurma.length >= 3, `a ${TURMA} tem três estudantes no credenciais-demo.csv (${daTurma.length})`)) return;
    const [contaA1, contaA2, contaB] = daTurma;
    const professor =
      contasDe("professor").find((c) => c.escola.split(" + ").includes(contaA1.escola) && c.turma.split(" + ").includes(TURMA)) ??
      contasDe("professor").find((c) => c.turma.split(" + ").includes(TURMA));
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSOR: estado de ontem, a ficha e o banco padrão ═══════════════
    const prof = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professor.login, senhaDe(professor));
    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professor.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurmaApi = `${RAIZ}/turmas/${turmaId}`;

    /* Estado de ONTEM: uma corrida anterior deixou a rodada com sessões (e as
       travas abertas). “Zerar Turma” abre a rodada seguinte do MESMO pacote,
       com o gate de volta à exploração (ADR-155) — sem isso os três estudantes
       chegariam já concluídos. */
    const antes = (await lerApi(prof, `${daTurmaApi}/painel`)).corpo;
    if (antes?.atividade && (antes.resumo?.entraram ?? 0) > 0) {
      const zerou = await mandarApi(prof, `${daTurmaApi}/zerar`, { rodada: antes.atividade.rodada });
      r.exigir(zerou.status === 200 && zerou.corpo?.etapa === "exploracao", `a rodada anterior foi zerada (HTTP ${zerou.status}, etapa ${zerou.corpo?.etapa})`);
    }

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(prof.getByRole("heading", { name: "O Dossiê Invisível", exact: true }), prof.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "a ficha do 9º ano, unidade 1",
    });
    await prof.getByText(/A missão só abre com uma atividade sua em andamento/).first().waitFor({ timeout: 15_000 });
    const textoDaFicha = await prof.locator("main").innerText();
    r.exigir(textoDaFicha.includes("EF09CO08") && textoDaFicha.includes("EF09CO07"), "a ficha traz as duas habilidades (EF09CO08 e EF09CO07)");
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 9º ano, unidade 1",
      mostra: "O Dossiê Invisível na trilha: as duas habilidades, o UnooriaAI, o aviso de que a missão só abre com atividade em andamento e as três travas da aula.",
      prova: "Missão individual com debate coletivo (ADR-202): sem passo de equipes.",
    });

    await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
    const passo = prof.locator("[data-passo-conteudo]");
    /* Estado de ONTEM: um rascunho da IA sem homologar volta à curadoria. Recomeça pelo recorte. */
    const inicio = await primeiroQueAparecer(
      { recorte: passo.locator("[data-caminho-curto]"), curadoria: passo.locator("[data-curadoria]") },
      { timeout: 60_000, oQue: "o preparo da turma" },
    );
    if (inicio === "curadoria") {
      await hidratado(prof, passo.locator('[data-acao="recomecar-preparo"]'));
      await passo.locator('[data-acao="recomecar-preparo"]').first().click();
      await passo.locator("[data-caminho-curto]").waitFor({ timeout: 30_000 });
    }
    const usarPadrao = passo.locator('[data-acao="usar-padrao"]');
    await hidratado(prof, usarPadrao);
    r.exigir(
      /Mesa Aberta.*Ponto de Apoio.*Conexão para Continuar/.test((await passo.locator("[data-caminho-curto]").innerText()).replace(/\s+/g, " ")),
      "o caminho curto mostra o banco curado com os três projetos (Mesa Aberta, Ponto de Apoio, Conexão para Continuar)",
    );
    await r.registrar(prof, "banco-padrao", {
      titulo: "O banco curado padrão, em dois toques",
      mostra: "“Banco Curado Padrão” no topo do preparo, com o tema e os três projetos, e o recorte para preparar com IA logo abaixo.",
      prova: "O banco padrão já é homologado: um toque põe a atividade no ar e libera a missão na sala.",
    });
    await usarPadrao.click();
    await esperarOuFalharCedo(passo.locator('[data-fase="ativacao"]'), passo.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "Usar banco padrão",
    });
    r.exigir(
      (await passo.locator('[data-fase="ativacao"]').innerText()).includes("Missão Ativa — Sessões Liberadas para Conselheiros"),
      "o banco padrão já entra no ar: “Missão Ativa — Sessões Liberadas para Conselheiros”",
    );
    await r.registrar(prof, "padrao-no-ar", {
      titulo: "Pôr Atividade no Ar",
      mostra: "A turma, o pacote do banco padrão e a confirmação de que a missão já foi liberada para esta turma.",
      prova: "O caminho curto não passa pela curadoria: o banco padrão é conteúdo aprovado, não rascunho da IA.",
    });

    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').waitFor({ timeout: 10_000 });
    await prof.locator('[data-acao="continuar-criacao"]').click();
    const revisao = prof.locator("[data-revisao-da-criacao]");
    await revisao.waitFor({ timeout: 10_000 });
    r.exigir((await revisao.innerText()).includes("Missão individual"), "sem passo de equipes: a revisão diz “Missão individual”");
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    if ((await noAr.count()) > 0 && !(await noAr.isChecked())) await noAr.dispatchEvent("click");
    const liberar = prof.locator('[data-acao="criar-atividade"]');
    r.exigir((await liberar.innerText()).includes("Liberar para a Turma"), "o botão final diz “Liberar para a Turma”");
    await liberar.click();
    await esperarOuFalharCedo(
      prof.locator('[data-estado-da-atividade="em-andamento"]'),
      revisao.locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`),
      { timeout: 60_000, oQue: "liberar a atividade" },
    );
    const paginaDaAtividade = prof.url();
    const pacotes = (await lerApi(prof, `${daTurmaApi}/pacotes`)).corpo;
    const atividadeId = pacotes?.emAndamento?.pacoteId;
    const detalhe = (await lerApi(prof, `${daTurmaApi}/pacotes/${atividadeId}`)).corpo;
    if (
      !r.exigir(
        detalhe?.origem === "padrao" && detalhe?.conteudo?.projetos?.papel?.nome === "Mesa Aberta",
        `a atividade EM ANDAMENTO é a do banco padrão (origem ${detalhe?.origem}, papel “${detalhe?.conteudo?.projetos?.papel?.nome}”)`,
      )
    )
      return;
    await r.registrar(prof, "atividade-no-ar", {
      titulo: "A atividade do banco padrão, em andamento",
      mostra: "A página da atividade: o tema “Políticas públicas e combate à desigualdade urbana”, em andamento, com a aula ao vivo.",
      prova: `Origem “padrao”, rodada ${pacotes.emAndamento.rodada}: a turma vê o Mesa Aberta, o Ponto de Apoio e o Conexão para Continuar.`,
    });

    // ═══ ESTUDANTES: entram na missão ══════════════════════════════════════
    const estudantes = {};
    for (const [rotulo, conta] of [["A1", contaA1], ["A2", contaA2], ["B", contaB]]) {
      const pg = await r.pagina(`estudante ${rotulo}`, { viewport: { width: 1280, height: 950 } });
      await r.entrar(pg, conta.login, senhaDe(conta));
      await pg.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
      const q = pg.frameLocator("iframe[data-experiencia]");
      await esperarOuFalharPorHttp(pg, q.getByRole("button", { name: COPY.comecar, exact: true }), /dossie-invisivel\/sessao/, {
        timeout: 40_000,
        oQue: `o boot da missão (${rotulo})`,
      });
      estudantes[rotulo] = { pg, q, conta };
    }
    const { pg: a1, q: q1 } = estudantes.A1;
    r.exigir((await q1.getByText(/Mesa Aberta: João \(14 anos\)/).count()) >= 1, "a abertura traz os três cartões dos projetos (o Mesa Aberta de João, 14 anos)");
    await r.registrar(a1, "abertura", {
      titulo: "A convocação",
      mostra: "O UnooriaAI do Conselho Municipal de Apoio Social: Amara, os três cartões dos projetos, o composer inativo e “Começar Análise”.",
      prova: "A abertura não entrega nada da virada: os três projetos chegam como cartões de contexto.",
    });

    /** “Começar Análise” → a fala de abertura do assistente e o composer ativo. */
    async function comecar(rotulo) {
      const { pg, q } = estudantes[rotulo];
      const entrou = await comResposta(pg, /sessao\/entrar$/, () => q.getByRole("button", { name: COPY.comecar, exact: true }).click());
      r.exigir(entrou.status === 200 && entrou.corpo?.passo === "conversa", `${rotulo}: “Começar Análise” abre a conversa (HTTP ${entrou.status}, passo ${entrou.corpo?.passo})`);
      await q.getByText(/Sessão deliberativa aberta\. Sou o assistente técnico/).first().waitFor({ timeout: 15_000 });
    }

    /**
     * Uma pergunta DIGITADA ao assistente, pelo composer do iframe. O composer
     * do DS é um `<form>`: sem `forms` no manifesto o sandbox bloqueia o submit
     * em silêncio. Sem POST da rota, a suíte REPROVA aqui, com a causa — nunca
     * contorna pela api, que provaria uma conversa que o estudante não consegue ter.
     */
    async function perguntar(rotulo, texto) {
      const { pg, q } = estudantes[rotulo];
      const campo = q.getByPlaceholder("Consulte o assistente sobre os projetos...");
      await campo.click();
      await campo.pressSequentially(texto, { delay: 5 });
      try {
        return await comResposta(pg, /sessao\/mensagem$/, () => q.getByRole("button", { name: COPY.enviar, exact: true }).click(), 20_000);
      } catch {
        throw new Error(
          `${rotulo}: a pergunta digitada não saiu do composer (nenhum POST sessao/mensagem em 20 s) — ` +
            "confira o `forms` em `permissoes` do manifesto e o atributo `sandbox` do iframe",
        );
      }
    }

    // ═══ A1: pergunta pela lacuna e digitaliza na E2 ═══════════════════════
    await comecar("A1");
    r.exigir((await q1.locator(".uai-sugestoes").getByRole("button").count()) === 3, "A1: as três sugestões aparecem antes da primeira mensagem");
    const lacunaA1 = await perguntar("A1", PERGUNTA_DA_LACUNA);
    r.exigir(
      (await a1.locator("iframe[data-experiencia]").getAttribute("sandbox"))?.split(/\s+/).includes("allow-forms"),
      "o iframe da missão tem `allow-forms`: o composer do UnooriaAI é um <form>",
    );
    r.exigir(
      lacunaA1.status === 200 && lacunaA1.corpo?.chat?.cadernosOferecidos === true,
      `A1: a pergunta pela falta de registros recebe a oferta dos cadernos (HTTP ${lacunaA1.status}, oferecidos ${lacunaA1.corpo?.chat?.cadernosOferecidos})`,
    );
    await q1.getByText(COPY.ofertaDosCadernos, { exact: false }).first().waitFor({ timeout: 15_000 });
    const oferta = q1.locator('[data-tela="oferta-dos-cadernos"]');
    await oferta.waitFor({ timeout: 10_000 });
    r.exigir((await q1.locator(".uai-sugestoes").count()) === 0, "A1: as sugestões somem depois da primeira mensagem");
    await r.registrar(a1, "a1-oferta-dos-cadernos", {
      titulo: "A1 pergunta pela lacuna",
      mostra: "A pergunta de A1 sobre os registros do Mesa Aberta e a resposta do assistente: 3 cadernos de campo em arquivo físico, e “Digitalizar cadernos”.",
      prova: "A oferta só vem para quem desconfia da ausência de dados — é a investigação que a EF09CO08 mede.",
      detalhe: "enviada pelo composer do iframe",
    });
    const ocrA1 = await comResposta(a1, /sessao\/digitalizar$/, () => oferta.getByRole("button", { name: COPY.digitalizar, exact: true }).click());
    r.exigir(ocrA1.status === 200 && ocrA1.corpo?.chat?.cadernosDigitalizados === true, `A1: o OCR grava os cadernos no servidor (HTTP ${ocrA1.status})`);
    await q1.getByText(COPY.caminhoA1, { exact: true }).waitFor({ timeout: 10_000 });
    await q1.getByText(COPY.parecerInvertido, { exact: false }).first().waitFor({ timeout: 10_000 });
    await r.registrar(a1, "a1-cadernos-digitalizados", {
      titulo: "A1 digitaliza antes de escolher",
      mostra: "A leitura óptica concluída (180 registros), o parecer que já se inverte para o Mesa Aberta e a nota “Caminho investigativo A1 ativo”.",
      prova: "Os cadernos só descem depois de digitalizados; o caminho congela no “Registrar Decisão”.",
    });

    /** “Ver Projetos” (se a escolha ainda não abriu) → “Escolher Projeto” → o painel: marca o projeto, mexe um critério e registra. */
    async function deliberar(rotulo, nomeDoProjeto, { verProjetos }) {
      const { pg, q } = estudantes[rotulo];
      if (verProjetos) {
        const viu = await comResposta(pg, /sessao\/ver-projetos$/, () => q.getByRole("button", { name: COPY.verProjetos, exact: true }).click());
        r.exigir(viu.status === 200 && viu.corpo?.chat?.podeEscolher === true, `${rotulo}: “Ver Projetos” libera a escolha (HTTP ${viu.status})`);
      }
      await q.getByRole("button", { name: COPY.escolher, exact: true }).click();
      const painel = q.locator('[data-tela="E3-ALU-01"]');
      await painel.waitFor({ timeout: 10_000 });
      const registrar = painel.getByRole("button", { name: COPY.registrar, exact: true });
      r.exigir(await registrar.isDisabled(), `${rotulo}: sem projeto marcado, “Registrar Decisão” fica desabilitado`);
      await painel.getByRole("radio", { name: new RegExp(`^${nomeDoProjeto}`) }).click();
      r.exigir(await registrar.isDisabled(), `${rotulo}: com o projeto marcado e o ranking intocado, ainda desabilitado`);
      await painel.locator("li[data-criterio]").first().getByRole("button", { name: /^Descer critério/ }).click();
      const ranking = await painel.locator("li[data-criterio]").evaluateAll((lis) => lis.map((li) => li.getAttribute("data-criterio")));
      r.exigir(!(await registrar.isDisabled()), `${rotulo}: projeto marcado e um critério movido, “Registrar Decisão” acende`);
      return { painel, registrar, ranking };
    }

    async function registrarDecisao(rotulo, deliberacao) {
      const { pg, q } = estudantes[rotulo];
      const decidiu = await comResposta(pg, /sessao\/decisao$/, () => deliberacao.registrar.click());
      r.exigir(decidiu.status === 200 && decidiu.corpo?.passo === "espera1", `${rotulo}: a decisão grava e leva à espera (HTTP ${decidiu.status}, passo ${decidiu.corpo?.passo})`);
      r.exigir(
        JSON.stringify(decidiu.corpo?.decisao?.ranking) === JSON.stringify(deliberacao.ranking),
        `${rotulo}: o ranking gravado é o da tela (${deliberacao.ranking.join(" > ")})`,
      );
      await q.getByText(COPY.espera, { exact: true }).waitFor({ timeout: 10_000 });
      return decidiu.corpo;
    }

    const delA1 = await deliberar("A1", "Mesa Aberta", { verProjetos: true });
    await r.registrar(a1, "a1-painel-de-deliberacao", {
      titulo: "O Painel de Deliberação Orçamentária",
      mostra: "Mesa Aberta selecionado, os outros dois na “Fila de espera”, e o ranking dos três critérios com um deles movido.",
      prova: "A verba é indivisível; o “Registrar Decisão” só acende com o projeto marcado e o ranking tocado (o ranking nasce embaralhado).",
    });
    const decisaoA1 = await registrarDecisao("A1", delA1);
    r.exigir(decisaoA1?.caminho === "A1", `A1: o caminho congelado é A1 (${decisaoA1?.caminho})`);
    await r.registrar(a1, "a1-espera", {
      titulo: "A trava da presidência da mesa",
      mostra: "A conversa inerte sob “Parecer registrado. Aguardando autorização da presidência da mesa…”.",
      prova: "O passo é derivado no servidor: decidiu e a revelação ainda não foi liberada = espera.",
    });

    // ═══ A2: pergunta, recebe a oferta e NÃO digitaliza ════════════════════
    const { pg: a2, q: q2 } = estudantes.A2;
    await comecar("A2");
    const lacunaA2 = await perguntar("A2", PERGUNTA_DA_LACUNA);
    r.exigir(
      lacunaA2.status === 200 && lacunaA2.corpo?.chat?.cadernosOferecidos === true,
      `A2: a mesma pergunta recebe a oferta dos cadernos (HTTP ${lacunaA2.status})`,
    );
    await q2.locator('[data-tela="oferta-dos-cadernos"]').waitFor({ timeout: 15_000 });
    const delA2 = await deliberar("A2", "Conexão para Continuar", { verProjetos: true });
    await q2.getByText(COPY.parecerInicial, { exact: false }).first().waitFor({ timeout: 10_000 });
    await r.registrar(a2, "a2-ver-projetos", {
      titulo: "A2 recusa a oferta e vê os projetos",
      mostra: "A oferta dos cadernos sem resposta, os projetos inscritos e o parecer pela nuvem; no painel, o Conexão para Continuar.",
      prova: "Ter a oferta e não digitalizar é o caminho A2 — a investigação conta, mesmo sem a prova na mão.",
    });
    const decisaoA2 = await registrarDecisao("A2", delA2);
    r.exigir(decisaoA2?.caminho === "A2", `A2: o caminho congelado é A2 (${decisaoA2?.caminho})`);

    // ═══ B: as três sugestões ══════════════════════════════════════════════
    const { pg: b, q: qb } = estudantes.B;
    await comecar("B");
    const primeira = await comResposta(b, /sessao\/mensagem$/, () => qb.locator(".uai-sugestoes").getByRole("button", { name: SUGESTOES[0], exact: true }).click());
    r.exigir(primeira.status === 200 && primeira.corpo?.chat?.consultas === 1, `B: a 1ª sugestão conta como consulta (HTTP ${primeira.status})`);
    await qb.locator(".uai-sugestoes").waitFor({ state: "detached", timeout: 10_000 });
    const segunda = await perguntar("B", SUGESTOES[1]);
    const terceira = await perguntar("B", SUGESTOES[2]);
    r.exigir(
      terceira.status === 200 && terceira.corpo?.chat?.consultas === 3 && terceira.corpo?.chat?.podeEscolher === true && terceira.corpo?.chat?.cadernosOferecidos === false,
      `B: três consultas pelas sugestões liberam a escolha sem a oferta dos cadernos (consultas ${terceira.corpo?.chat?.consultas}, ${segunda.status}/${terceira.status})`,
    );
    await qb.getByText("Limite de 3 consultas atingido.", { exact: false }).first().waitFor({ timeout: 15_000 });
    await qb.getByText(/possui apenas a ficha cadastral de abertura no sistema digital/).first().waitFor({ timeout: 10_000 });
    await r.registrar(b, "b-tres-sugestoes", {
      titulo: "B segue as três sugestões",
      mostra: "Custo por vaga, regularidade (12 relatórios contra a ficha cadastral do Mesa Aberta, com os anexos) e impacto; o parecer pela nuvem e o limiar das 3 consultas.",
      prova: "As sugestões exatas nunca vão à IA e nunca fazem a oferta dos cadernos: sem desconfiar da lacuna, o caminho é B.",
    });
    const delB = await deliberar("B", "Conexão para Continuar", { verProjetos: false });
    const decisaoB = await registrarDecisao("B", delB);
    r.exigir(decisaoB?.caminho === "B", `B: o caminho congelado é B (${decisaoB?.caminho})`);

    // ═══ PROFESSOR: a 1ª trava ═════════════════════════════════════════════
    await prof.goto(paginaDaAtividade, { waitUntil: "domcontentloaded" });
    const painel = prof.locator("[data-painel-da-aula]");
    await revelar(prof, painel);
    await painel.waitFor({ timeout: 30_000 });

    /** Aperta UMA trava e confere que só ela andou (e que a seguinte acendeu). */
    async function travar(etapa) {
      const botao = prof.locator(`[data-acao="trava-${etapa}"]`);
      await hidratado(prof, botao);
      const habilitados = await prof.locator("[data-botoes-da-aula] button:not([disabled])").count();
      r.exigir(habilitados === 1 && !(await botao.isDisabled()), `antes de “${TRAVAS[etapa].botao}”, só ela está habilitada (${habilitados} habilitada[s])`);
      await botao.click();
      const dialogo = prof.getByRole("dialog", { name: TRAVAS[etapa].dialogo });
      await dialogo.waitFor({ timeout: 10_000 });
      await dialogo.getByRole("button", { name: TRAVAS[etapa].botao }).click();
      await esperarOuFalharCedo(prof.locator(`[data-controle-da-missao][data-etapa="${etapa}"]`), painel.locator(ALERTA_DE_ERRO), {
        timeout: 20_000,
        oQue: TRAVAS[etapa].botao,
      });
      r.exigir((await botao.getAttribute("data-feita")) === "sim" && (await botao.isDisabled()), `“${TRAVAS[etapa].botao}” fica feita e desabilitada (só para a frente)`);
    }

    const registraram = await prof.locator("[data-registraram]").innerText();
    r.exigir(/^3 de 3 registraram a primeira escolha/.test(registraram), `antes da 1ª trava, o painel conta quem registrou (“${registraram}”)`);
    await r.registrar(prof, "painel-antes-da-revelacao", {
      titulo: "A aula ao vivo, antes da próxima pauta",
      mostra: "As três travas no topo, só “Liberar Próxima Pauta” acesa; “3 de 3 registraram a primeira escolha”; a distribuição de votos da 1ª deliberação.",
      prova: "A lousa vai ao projetor: só contagens, sem nome e sem ranking.",
      inteira: true,
    });
    await travar("revelacao");

    // ═══ E4: a revelação ═══════════════════════════════════════════════════
    const tabela = (q) => q.locator('[data-tela="E4-ALU-02"]');
    /* A1 já digitalizou: vai direto à tabela, com o contrafactual. */
    await tabela(q1).waitFor({ timeout: 30_000 });
    await q1.getByText("Simulação Contrafactual", { exact: true }).waitFor({ timeout: 10_000 });
    r.exigir((await tabela(q1).innerText()).includes(COPY.constatacao), "A1: a tabela traz a constatação de auditoria");

    /** B e A2 recebem o aviso e digitalizam na E4. */
    async function digitalizarNaE4(rotulo) {
      const { pg, q } = estudantes[rotulo];
      const aviso = q.locator('[data-tela="E4-ALU-01"]');
      await aviso.waitFor({ timeout: 30_000 });
      const ocr = await comResposta(pg, /sessao\/digitalizar$/, () => aviso.getByRole("button", { name: COPY.digitalizar, exact: true }).click());
      r.exigir(ocr.status === 200 && ocr.corpo?.revelacao?.tabela?.length === 2, `${rotulo}: digitalizar na E4 monta a tabela de confronto (HTTP ${ocr.status})`);
      await tabela(q).waitFor({ timeout: 10_000 });
      return ocr.corpo;
    }
    const e4B = await digitalizarNaE4("B");
    const linhasB = (e4B?.revelacao?.tabela ?? []).map((l) => `${l.nome} (${l.rotulo}): ${l.documentos}, ${l.custo}`);
    r.exigir(
      e4B?.revelacao?.tabela?.[0]?.projeto === "nuvem" && e4B?.revelacao?.tabela?.[1]?.projeto === "papel" && /180 diários em cadernos físicos/.test(linhasB[1] ?? ""),
      `B: a tabela compara o 1º voto (a nuvem) com o Mesa Aberta pós-OCR (${linhasB.join(" | ")})`,
    );
    await qb.getByText(COPY.parecerInvertido, { exact: false }).first().waitFor({ timeout: 10_000 });
    await tabela(qb).scrollIntoViewIfNeeded();
    await r.registrar(b, "b-tabela-de-confronto", {
      titulo: "B: os cadernos e a tabela de confronto",
      mostra: "O aviso dos cadernos, a leitura óptica, o parecer que se inverte e a tabela: Conexão para Continuar (1º voto) × Mesa Aberta (pós-OCR), com a constatação.",
      prova: "Os critérios não mudaram; mudou o que o robô conseguia ler. É o Aha da missão.",
    });
    await digitalizarNaE4("A2");

    /** Uma pílula dirigida: a resposta entra na thread e a espera do debate aparece. */
    async function pilula(rotulo) {
      const { pg, q } = estudantes[rotulo];
      const feita = await comResposta(pg, /sessao\/pilula$/, () => q.getByRole("button", { name: COPY.pilulaCusto, exact: true }).click());
      r.exigir(feita.status === 200 && feita.corpo?.revelacao?.pilulas?.includes("custo"), `${rotulo}: a pílula do custo responde (HTTP ${feita.status})`);
      await q.getByText(/refeições servidas a 24 jovens em 180 dias/).first().waitFor({ timeout: 10_000 });
      await q.getByText(COPY.esperaDoDebate, { exact: false }).first().waitFor({ timeout: 10_000 });
      r.exigir(feita.corpo?.revotoAberto === false, `${rotulo}: antes da trava do debate, o 2º voto não abre`);
    }
    await pilula("B");
    await r.registrar(b, "b-pilula-e-espera-do-debate", {
      titulo: "A pílula dirigida e a espera do debate",
      mostra: "“Comparar custo real por refeição diária”: 4.320 refeições, R$ 2,78 por refeição — e a espera da plenária.",
      prova: "O 2º voto só abre depois do DEBATE (a trava “Abrir Revisão da Decisão”), não com a tabela.",
    });
    await pilula("A2");
    await pilula("A1");

    // ═══ PROFESSOR: a trava do debate ══════════════════════════════════════
    await prof.bringToFront();
    await travar("revoto");

    // ═══ O 2º voto ═════════════════════════════════════════════════════════
    const revisaoDe = (q) => q.locator('[data-tela="E4-ALU-03"]');

    /* A1 mantém. */
    await revisaoDe(q1).waitFor({ timeout: 30_000 });
    await revisaoDe(q1).getByRole("button", { name: COPY.manter, exact: true }).click();
    const revotoA1 = await comResposta(a1, /sessao\/revoto$/, () => revisaoDe(q1).getByRole("button", { name: COPY.confirmarFinal, exact: true }).click());
    r.exigir(revotoA1.status === 200 && revotoA1.corpo?.revoto?.manteve === true, `A1: mantém o Mesa Aberta (HTTP ${revotoA1.status})`);

    /* A2 revisa para o Mesa Aberta. */
    await revisaoDe(q2).waitFor({ timeout: 30_000 });
    await revisaoDe(q2).getByRole("button", { name: COPY.revisar, exact: true }).click();
    await revisaoDe(q2).getByRole("radio", { name: /^Mesa Aberta/ }).click();
    await r.registrar(a2, "a2-revisao-da-decisao", {
      titulo: "A revisão da decisão",
      mostra: "A escolha da E3 congelada ao lado (Conexão para Continuar), “Revisar Decisão”, o Mesa Aberta marcado e o ranking da E3 para reordenar.",
      prova: "A 1ª escolha não se apaga: o 2º voto é outra linha, e a migração vai para a lousa.",
    });
    const revotoA2 = await comResposta(a2, /sessao\/revoto$/, () => revisaoDe(q2).getByRole("button", { name: COPY.confirmarFinal, exact: true }).click());
    r.exigir(revotoA2.status === 200 && revotoA2.corpo?.revoto?.projeto === "papel" && revotoA2.corpo?.revoto?.manteve === false, `A2: revisa para o Mesa Aberta (HTTP ${revotoA2.status})`);

    /* B troca de projeto e deixa a URGÊNCIA abaixo da regularidade: “em processo”. */
    await revisaoDe(qb).waitFor({ timeout: 30_000 });
    await revisaoDe(qb).getByRole("button", { name: COPY.revisar, exact: true }).click();
    await revisaoDe(qb).getByRole("radio", { name: /^Mesa Aberta/ }).click();
    const ordemB = () => revisaoDe(qb).locator("li[data-criterio]").evaluateAll((lis) => lis.map((li) => li.getAttribute("data-criterio")));
    for (let i = 0; i < 2; i++) {
      const ordem = await ordemB();
      if (ordem.indexOf("urgencia") > ordem.indexOf("regularidade")) break;
      await revisaoDe(qb).locator('li[data-criterio="urgencia"]').getByRole("button", { name: /^Descer critério/ }).click();
    }
    const rankingFinalB = await ordemB();
    r.exigir(rankingFinalB.indexOf("urgencia") > rankingFinalB.indexOf("regularidade"), `B: a urgência fica abaixo da regularidade (${rankingFinalB.join(" > ")})`);
    const revotoB = await comResposta(b, /sessao\/revoto$/, () => revisaoDe(qb).getByRole("button", { name: COPY.confirmarFinal, exact: true }).click());
    r.exigir(
      revotoB.status === 200 && revotoB.corpo?.revoto?.projeto === "papel" && JSON.stringify(revotoB.corpo?.revoto?.ranking) === JSON.stringify(rankingFinalB),
      `B: troca para o Mesa Aberta com o ranking da tela (HTTP ${revotoB.status})`,
    );
    await qb.getByText(COPY.espera, { exact: true }).waitFor({ timeout: 10_000 });
    await qb.getByText("Decisão Final Registrada nos Autos", { exact: true }).waitFor({ timeout: 10_000 });
    await r.registrar(b, "b-decisao-final", {
      titulo: "A decisão final registrada",
      mostra: "“Decisão Final Registrada nos Autos”: o Mesa Aberta, com o critério 1, e a espera do Explicar.",
      prova: "O latch 2 congela o 2º voto; a régua da EF09CO08 lê o conjunto (caminho, projeto e os dois rankings).",
    });

    // ═══ PROFESSOR: a migração e a 3ª trava ════════════════════════════════
    await prof.bringToFront();
    const migracao = painel.locator("[data-migracao]");
    await migracao.locator("[data-mantiveram-trocaram]").waitFor({ timeout: 20_000 });
    await migracao.scrollIntoViewIfNeeded();
    await r.registrar(prof, "migracao-do-segundo-voto", {
      titulo: "A consolidação do 2º voto",
      mostra: "“Consolidação do Segundo Voto e Migração de Escolhas”: 2 trocaram, 1 manteve, e para onde foi quem trocou; a 1ª deliberação × a decisão final por projeto.",
      prova: "Só contagens: nenhum nome, nenhum voto individual na lousa.",
      inteira: true,
    });
    await travar("explicar");
    r.exigir((await prof.locator("[data-botoes-da-aula] button:not([disabled])").count()) === 0, "com as três travas feitas, nenhum botão da aula fica habilitado");

    // ═══ E5: Amara, as âncoras e o protocolo ═══════════════════════════════
    const sessaoA1 = await lerApi(a1, `${RAIZ}/sessao`);
    await q1.locator('[data-tela="E5-ALU-01"]').waitFor({ timeout: 30_000 });
    r.exigir(
      (sessaoA1.corpo?.explicar?.falaDeAmara ?? "").includes(COPY.amaraInduzida) || (await q1.getByText(COPY.amaraInduzida, { exact: false }).count()) > 0,
      "A1: com 2 de 3 votos iniciais na nuvem, Amara afirma a indução da turma",
    );
    r.exigir(
      /* O banco desce embaralhado (as quatro peças em alguma ordem): o que não pode descer é a CHAVE do gabarito nem a auditoria do chat. */
      !/"(gabarito|danoso|blocoDanoso|classificador|intencao|arvore)"/i.test(JSON.stringify((await lerApi(a1, `${RAIZ}/sessao`)).corpo ?? {})),
      "a sessão do estudante não traz o gabarito do protocolo nem a auditoria do classificador",
    );

    /** Marca uma âncora no histórico. */
    async function marcarAncora(rotulo, ancora) {
      const { pg, q } = estudantes[rotulo];
      const alvo = q.locator(`[data-ancora="${ancora}"]`).first();
      await alvo.scrollIntoViewIfNeeded();
      const marcou = await comResposta(pg, /sessao\/ancoras$/, () => alvo.getByText(COPY.marcar, { exact: true }).click());
      r.exigir(marcou.status === 200 && marcou.corpo?.explicar?.ancoras?.includes(ancora), `${rotulo}: a âncora “${ancora}” fica marcada (HTTP ${marcou.status})`);
    }

    /**
     * Monta o protocolo pela TELA: toca o bloco no banco e toca a verificação;
     * “Mover para Lixeira” pelo botão do bloco. `slots` = os blocos por
     * verificação (null = vazia).
     */
    async function protocolo(rotulo, slots, lixeira) {
      const { pg, q } = estudantes[rotulo];
      await q.getByRole("button", { name: COPY.abrirEditor, exact: true }).click();
      const editor = q.locator('[data-tela="E5-ALU-02"]');
      await editor.waitFor({ timeout: 10_000 });
      const enviar = editor.getByRole("button", { name: COPY.enviarProposta, exact: true });
      r.exigir(await enviar.isDisabled(), `${rotulo}: o editor abre limpo, com “Enviar Proposta” desabilitado`);
      for (const [vaga, bloco] of slots.entries()) {
        if (!bloco) continue;
        await editor.locator(`.editor__banco [data-bloco="${bloco}"] button`).first().click();
        await editor.locator(`.editor__vaga[data-vaga="${vaga}"] button[data-slot-index="0"]`).click();
        await editor.locator(`.editor__vaga[data-vaga="${vaga}"] [data-bloco="${bloco}"]`).waitFor({ timeout: 5_000 });
      }
      for (const bloco of lixeira) {
        await editor.locator(`.editor__banco [data-bloco="${bloco}"]`).getByRole("button", { name: /^Mover para Lixeira/ }).click();
      }
      r.exigir(!(await enviar.isDisabled()), `${rotulo}: com um bloco na esteira, “Enviar Proposta” acende (sem trava no cliente)`);
      return { editor, enviar, enviarAgora: () => comResposta(pg, /sessao\/protocolo$/, () => enviar.click()) };
    }

    /* As âncoras de cada um são as mensagens que ELE viu: A1 digitalizou antes do parecer, então só tem a
       inversão; A2 viu o parecer inicial (no “Ver Projetos”) e a inversão (na E4); B, o contraste documental. */
    r.exigir(
      (await q1.locator('[data-ancora="parecer-inicial"]').count()) === 0 && (await q1.locator('[data-ancora="inversao"]').count()) === 1,
      "A1: quem digitalizou na E2 nunca recebeu o parecer pela nuvem — a âncora marcável é a da inversão",
    );
    await marcarAncora("A1", "inversao");
    await r.registrar(a1, "a1-amara-e-ancoras", {
      titulo: "Amara nomeia, e o histórico vira prova",
      mostra: "Amara pergunta se o assistente avaliava o resultado ou os rastros digitais; os quatro conceitos; e a âncora marcada na inversão do parecer.",
      prova: "A fala de Amara afirma a indução só porque ≥ 50% da turma votou na nuvem na E3; as âncoras não são evidência.",
    });
    const ed1 = await protocolo("A1", GABARITO, [DANOSO]);
    await ed1.editor.scrollIntoViewIfNeeded();
    await r.registrar(a1, "a1-editor-de-protocolo", {
      titulo: "O Editor de Protocolo",
      mostra: "As três verificações preenchidas (auditar fontes, normalizar o impacto, sinalizar pendências) e “Desclassificar sem PDF” na Área de Descarte.",
      prova: "O banco chega embaralhado e o envio aceita qualquer composição: a régua ternária é do servidor.",
    });
    const envioA1 = await ed1.enviarAgora();
    r.exigir(envioA1.status === 200 && envioA1.corpo?.concluido === true, `A1: “Enviar Proposta” conclui a missão (HTTP ${envioA1.status})`);
    r.exigir(!/atingiu|acert|corret|gabarito/i.test(JSON.stringify(envioA1.corpo?.protocolo ?? {})), "a resposta ao protocolo não diz se acertou");
    const conclusaoA1 = q1.locator('[data-tela="concluida"]');
    await conclusaoA1.waitFor({ timeout: 15_000 });
    r.exigir((await conclusaoA1.innerText()).includes(COPY.concluida) && (await conclusaoA1.innerText()).includes("Mesa Aberta"), "A1: os autos encerrados, com a destinação final ao Mesa Aberta");
    await r.registrar(a1, "a1-conclusao", {
      titulo: "Os autos encerrados",
      mostra: "“Autos Oficiais Encerrados”, a destinação final (Mesa Aberta, R$ 12.000) e o protocolo submetido — somente leitura.",
      prova: "A conclusão é a mesma para todos; o nível de cada habilidade fica com o professor.",
    });

    await q2.locator('[data-tela="E5-ALU-01"]').waitFor({ timeout: 30_000 });
    await marcarAncora("A2", "parecer-inicial");
    await marcarAncora("A2", "inversao");
    const envioA2 = await (await protocolo("A2", [GABARITO[0], GABARITO[1], null], [])).enviarAgora();
    r.exigir(envioA2.status === 200 && envioA2.corpo?.concluido === true, `A2: protocolo com a 3ª verificação vazia entra e conclui (HTTP ${envioA2.status})`);

    await qb.locator('[data-tela="E5-ALU-01"]').waitFor({ timeout: 30_000 });
    await marcarAncora("B", "contraste");
    const envioB = await (await protocolo("B", [DANOSO, null, null], [])).enviarAgora();
    r.exigir(envioB.status === 200 && envioB.corpo?.concluido === true, `B: protocolo só com o bloco danoso entra e conclui (HTTP ${envioB.status})`);
    await qb.locator('[data-tela="concluida"]').waitFor({ timeout: 15_000 });

    // ═══ PROFESSOR: o painel ao vivo ═══════════════════════════════════════
    await prof.bringToFront();
    const resumo = (await lerApi(prof, `${daTurmaApi}/painel`)).corpo?.resumo;
    r.exigir(
      JSON.stringify(resumo?.caminhos) === JSON.stringify({ A1: 1, A2: 1, B: 1 }),
      `a lousa conta os caminhos: 1 A1, 1 A2, 1 B (${JSON.stringify(resumo?.caminhos)})`,
    );
    r.exigir(
      JSON.stringify(resumo?.escolhaInicial) === JSON.stringify({ papel: 1, parcial: 0, nuvem: 2 }) &&
        JSON.stringify(resumo?.escolhaFinal) === JSON.stringify({ papel: 3, parcial: 0, nuvem: 0 }),
      `a 1ª deliberação (1 Mesa Aberta, 2 Conexão) e a final (3 Mesa Aberta) (${JSON.stringify({ i: resumo?.escolhaInicial, f: resumo?.escolhaFinal })})`,
    );
    r.exigir(
      resumo?.migracao?.mantiveram === 1 && resumo?.migracao?.trocaram === 2 && resumo?.migracao?.para?.papel === 2,
      `a migração: 1 manteve, 2 trocaram, os 2 para o Mesa Aberta (${JSON.stringify(resumo?.migracao)})`,
    );
    r.exigir(resumo?.protocolosEnviados === 3 && resumo?.porPasso?.concluida === 3, `3 protocolos enviados e 3 concluíram (${resumo?.protocolosEnviados}, ${resumo?.porPasso?.concluida})`);
    await prof.reload({ waitUntil: "domcontentloaded" });
    await revelar(prof, painel);
    await painel.waitFor({ timeout: 30_000 });
    const textoDoPainel = (await painel.innerText()).replace(/\s+/g, " ");
    r.exigir(/Distribuição de Votos da Turma — 1ª Deliberação/.test(textoDoPainel) && /Caminhos da Investigação/.test(textoDoPainel), "o painel traz a distribuição da 1ª deliberação e os caminhos da investigação");
    const colunas = await painel.locator("[data-monitor-de-ritmo]").getByRole("columnheader").allInnerTexts();
    r.exigir(
      colunas.length > 0 && !colunas.some((c) => /\b(n[íi]vel|pontos|nota|ranking|voto|caminho)\b/i.test(c)),
      `a folha nominal não tem coluna de nível, nota, voto nem caminho (colunas: ${colunas.join(", ")})`,
    );
    await painel.locator("[data-caminhos]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "painel-ao-vivo", {
      titulo: "A aula ao vivo: só contagens",
      mostra: "As três travas feitas, 3 registraram / confirmaram / enviaram / concluíram, a 1ª deliberação (1 × 0 × 2), os caminhos A1 · A2 · B e a migração.",
      prova: "A lousa vai ao projetor: sem nomes, sem ranking, sem o voto de ninguém. Os nomes ficam só na folha de ritmo.",
      inteira: true,
    });

    // ═══ PROFESSOR: as habilidades ═════════════════════════════════════════
    const evidencia = (await lerApi(prof, `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`)).corpo;
    const statusDe = (nome, codigo) => {
      const doEstudante = evidencia?.estudantes?.find((x) => x.nome === nome);
      return Object.values(doEstudante?.porRodada ?? {}).map((rodada) => rodada?.[codigo]?.status).find(Boolean) ?? null;
    };
    for (const [quem, conta] of [["A1", contaA1], ["A2", contaA2], ["B", contaB]]) {
      const obtido = Object.fromEntries(Object.keys(ESPERADO[quem]).map((c) => [c, statusDe(conta.nome, c)]));
      r.exigir(
        Object.entries(ESPERADO[quem]).every(([c, s]) => obtido[c] === s),
        `a régua de ${quem} (${conta.nome}) é a prevista: ${Object.entries(obtido).map(([c, s]) => `${c} ${s}`).join(", ")}`,
      );
    }
    const habilidades = prof.locator("[data-habilidades-dossie-invisivel]");
    await revelar(prof, habilidades);
    await habilidades.waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await habilidades.innerText();
    r.exigir(textoDasHabilidades.includes("EF09CO07") && textoDasHabilidades.includes("EF09CO08"), "o painel de habilidades traz EF09CO07 e EF09CO08");
    r.exigir(
      [contaA1, contaA2, contaB].every((c) => textoDasHabilidades.includes(c.nome)),
      "o painel de habilidades traz os três estudantes",
    );
    await habilidades.scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "O Relatório Final de Proficiência",
      mostra: "EF09CO08 e EF09CO07 com o nível de cada estudante: A1 atingiu as duas; A2 atingiu e está em processo; B está em processo e não atingiu.",
      prova: "Só Canal A: a investigação, o 2º voto e o protocolo — tudo pelo que o estudante fez, medido no servidor.",
      inteira: true,
    });

    r.ressalva("qual classificador respondeu a pergunta digitada (IA ou árvore) não é visível na tela nem na resposta: a sessão grava, mas não desce");
  },
);
