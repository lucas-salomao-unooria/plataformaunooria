import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { revelar } from "../lib/abas.mjs";
import { esperarNaApi, hidratado, idDaTurma, lerApi, primeiroQueAparecer } from "../lib/enigma-capa.mjs";

/**
 * O ASSISTENTE INVISÍVEL (exp01em1b, 1ª série EM, unidade 1 — ADR-185), das
 * duas pontas da sala, com a IA REAL no preparo.
 *
 * O professor recorta a aula (Biologia, tema e tópicos), GERA o pacote com a
 * IA, edita um item, regenera outro e aprova; escolhe "Um aluno por
 * computador" e libera a atividade para a turma. No painel da aula ao vivo, as
 * liberações e as duas pausas andam só para a frente: Liberar Início dos
 * Testes, Liberar Início da Simulação (só com 100% das apostas), Travar Telas
 * da Turma, Liberar Bancada de Reconstrução, Pausar para Comparação e Liberar
 * Publicação e Transparência.
 *
 * O estudante, num celular: a Zara e o módulo de teste (E1), as três funções
 * (E2), a aposta A — o LATCH 1 (E3) —, as três sessões roteirizadas do
 * UnooriaAI, o confronto com a própria aposta e as fichas de auditoria (E4), a
 * Trava 1, os 6 cartões, as etapas do algoritmo (marca 2, 3 e 4 e "Pular
 * Etapa"), o reteste com o 1B mantido → o Alerta de Viés → "Revisar Critérios"
 * → 1C/2C → Homologação Aprovada (E5), a Trava 2, a página de transparência
 * ligada com os 4 blocos certos e a publicação — o LATCH 2 — e o certificado
 * (E6). No fim, o relatório formativo com as quatro habilidades "Atingiu" e o
 * "Exportar Relatório de Homologação Ética".
 *
 * Se a IA cair (sem saldo ou vendor fora), o preparo segue pelo banco padrão
 * de Língua Portuguesa — o ramo LEGÍTIMO da tela (E0-PROF-03) —, e a suíte diz
 * em voz alta qual caminho rodou.
 *
 * Os seletores são CONTRATO com a experiência (`src/lib/textos.ts`,
 * `src/telas/*`) e com o hub (`atividades/nova/criar-assistente-invisivel.tsx`,
 * `resultados/painel-da-aula-assistente-invisivel.tsx`).
 */

const SERIE = "1EM";
const EXP_ID = "exp01em1b";
const TURMA = process.env.TURMA ?? "1EM-A";
const FICHA = `${HUB}/professor/entre-redes/1-serie/unidade-1`;

/** O recorte que o professor pede à IA — nada do banco padrão (que é de Língua Portuguesa). */
const RECORTE = {
  disciplina: "Biologia",
  tema: "Respiração celular e energia",
  topicos: ["Mitocôndria", "Glicólise", "Ciclo de Krebs", "ATP"],
};

/** O texto que o professor escreve à mão: sem horário, conexão nem rede (a régua do pacote recusa). */
const DUVIDA_EDITADA = "Pode me explicar com um exemplo do dia a dia como a célula tira energia da glicose?";

/** As opções da aposta e dos blocos, como o servidor as manda (`conteudo.ts`) — a e2e casa por texto exato. */
const APOSTA_A = "Todos receberão o nível Avançado conforme solicitado no cadastro.";
const CARTOES = [
  { rotulo: "Escolha de Trilha Avançada", coluna: "Dados Fornecidos" },
  { rotulo: "Nome e Turma do Estudante", coluna: "Dados Fornecidos" },
  { rotulo: "Horário de Acesso (23h45)", coluna: "Dados Observados" },
  { rotulo: "Oscilação no Sinal de Rede", coluna: "Dados Observados" },
  { rotulo: "Endereço IP de Conexão", coluna: "Dados Observados" },
  { rotulo: "Modelo do Dispositivo Utilizado", coluna: "Dados Observados" },
];
const BLOCOS_CERTOS = [
  "restringindo acessos automaticamente",
  "metadados de horário e oscilação de rede",
  "critérios pedagógicos objetivos e escolha do estudante",
  "solicitar explicação e revisão humana de decisões automatizadas",
];
const ESPERA = "Aguardando autorização da mediação docente para liberar a próxima fase da auditoria";

await suite(
  {
    slug: "estudante/16-assistente-invisivel",
    papel: "estudante",
    titulo: "O Assistente Invisível — dados que viram decisões",
    subtitulo: "o pacote gerado com IA e curado pelo professor, as cinco liberações, os dois latches e a página de transparência",
    contexto:
      "O estudante da 1ª série é auditor da comissão de tecnologia da escola: testa o UnooriaAI com três colegas " +
      "que pediram a mesma Trilha Avançada, aposta no resultado e vê Beatriz rebaixada pelo horário e Thiago " +
      "travado pela conexão. Nas fichas ele descobre a inferência, separa dados fornecidos de observados, marca as " +
      "etapas dispensáveis do algoritmo, troca os critérios até a homologação passar e publica a página de " +
      "transparência com o comunicado da comissão. O professor conduz cada etapa do painel ao vivo.",
    prova: [
      "O professor gera o pacote com a IA real (Biologia), edita um item, regenera outro e aprova — ou, com a IA fora, segue pelo banco padrão",
      "“Liberar Atividade para a Turma” põe a atividade em andamento e a missão liberada na sala",
      "A camada de espera segura o estudante até cada liberação; a aposta é o LATCH 1 e o 100% acende a simulação",
      "As três sessões roteirizadas do UnooriaAI, o confronto com o texto da aposta e as fichas de auditoria",
      "A Trava 1, os 6 cartões, as etapas 2, 3 e 4 marcadas e “Pular Etapa”",
      "O reteste com o 1B mantido dá o Alerta de Viés; “Revisar Critérios” e 1C/2C dão a Homologação Aprovada",
      "A Trava 2, a página ligada, os 4 blocos certos e a publicação (LATCH 2); o certificado com a salvaguarda",
      "A sessão do estudante não carrega o gabarito (colunas, passos dispensáveis, critérios equitativos, opção certa)",
      "O relatório formativo com as quatro habilidades “Atingiu” e a exportação para impressão",
    ],
    comando: "node scripts/e2e/estudante/16-assistente-invisivel.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { turma: TURMA, serie: SERIE });
    const professor =
      contasDe("professor").find((c) => c.escola === estudante.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSOR: o recorte da aula ═════════════════════════════════════
    const prof = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professor.login, senhaDe(professor));
    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professor.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurma = `/assistente-invisivel/turmas/${turmaId}`;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(
      prof.getByRole("heading", { name: "O Assistente Invisível: Dados que viram decisões", exact: true }),
      prof.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "a ficha da missão" },
    );
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha da 1ª série, unidade 1",
      mostra: "O Assistente Invisível na trilha: a auditoria algorítmica, as habilidades EM13CO20/01/18/03 e as atividades da turma.",
      prova: "A ficha é da missão nova e diz antes da aula que são cinco botões do professor, sempre para a frente.",
    });

    await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
    const passo = prof.locator("[data-passo-conteudo]");
    const recorte = passo.locator("[data-recorte-da-aula]");
    await esperarOuFalharCedo(recorte, passo.locator("[data-preparo-assistente]").getByText("Não conseguimos abrir o preparo desta turma"), {
      timeout: 30_000,
      oQue: "o preparo da turma (GET …/pacotes)",
    });
    const disciplina = recorte
      .locator("div.unooria-selection")
      .filter({ has: prof.locator('text="Disciplina Escolar"') })
      .locator("button[role=combobox]")
      .first();
    await hidratado(prof, disciplina);
    await disciplina.click();
    await prof.locator("[role=option]", { hasText: RECORTE.disciplina }).first().click();
    /* `fill`, não digitação: um rascunho de ONTEM volta com o recorte dele nos campos. */
    const tema = recorte.getByPlaceholder(/Digite o conteúdo específico/);
    await tema.fill(RECORTE.tema);
    const topicos = recorte.getByPlaceholder(/conceitos centrais/);
    await topicos.fill(RECORTE.topicos.join(", "));
    await recorte.getByText("Parâmetros Ativos").waitFor({ timeout: 10_000 });
    r.exigir(
      (await tema.inputValue()) === RECORTE.tema && (await topicos.inputValue()) === RECORTE.topicos.join(", "),
      "o recorte do professor está nos campos (Biologia, tema e 4 tópicos) e os parâmetros estão ativos",
    );
    await r.registrar(prof, "recorte-da-aula", {
      titulo: "Recorte da Aula",
      mostra: `Biologia, “${RECORTE.tema}”, ${RECORTE.topicos.length} tópicos: “Usar Banco Padrão da Rede” ao lado de “Gerar Cenários de Teste com IA”.`,
      prova: "A missão é customizável: as trilhas, as dúvidas do chat e as respostas do assistente vão ser escritas para esta aula.",
    });

    // ═══ PROFESSOR: a geração com IA (ou o banco padrão, se a IA cair) ═════
    const comecouAGerar = Date.now();
    const respostaDaGeracao = prof.waitForResponse(
      (x) => /\/gerar-conteudo$/.test(new URL(x.url()).pathname) && x.request().method() === "POST",
      { timeout: 240_000 },
    );
    await recorte.locator('[data-acao="gerar-com-ia"]').click();
    await recorte.locator("[data-gerando]").waitFor({ timeout: 10_000 });
    await r.registrar(prof, "gerando-com-ia", {
      titulo: "Criando exercícios e diálogos temáticos no UnooriaAI…",
      mostra: "A barra da geração enquanto o Vertex escreve o pacote inteiro: as duas trilhas, as cinco dúvidas, as cinco respostas e a leitura.",
      prova: "Os botões ficam ocupados; o banco padrão continua à mão se a IA cair.",
    });
    const geracao = await respostaDaGeracao;
    const corpoDaGeracao = await geracao.json().catch(() => null);
    const segundos = Math.round((Date.now() - comecouAGerar) / 1000);
    const usouIa = geracao.status() === 200 && corpoDaGeracao?.usouIa === true;
    const curadoria = passo.locator("[data-curadoria]");
    let caminho;
    if (usouIa) {
      caminho = "ia";
      await esperarOuFalharCedo(curadoria, recorte.locator(ALERTA_DE_ERRO), { timeout: 30_000, oQue: "abrir a curadoria do pacote gerado" });
      r.exigir(
        corpoDaGeracao?.rascunho?.origem === "ia" && corpoDaGeracao?.motivo === null,
        `CAMINHO DA IA REAL: o pacote veio do Vertex (origem “${corpoDaGeracao?.rascunho?.origem}”, em ${segundos}s)`,
      );
    } else {
      /* Ramo LEGÍTIMO (E0-PROF-03): sem saldo (429) ou com o vendor fora (503/504, ou 200 com usouIa=false), a tela oferece o banco padrão. */
      caminho = "banco-padrao";
      const motivo = corpoDaGeracao?.motivo ?? `HTTP ${geracao.status()}`;
      r.ressalva(
        `A IA NÃO GEROU o pacote (motivo: ${motivo}, em ${segundos}s): o preparo segue pelo banco padrão de Língua Portuguesa — o caminho com IA real fica PENDENDO de ADC válido`,
      );
      if (geracao.status() >= 500) r.provocado(/gerar-conteudo/, "a geração com a IA fora do ar, que a tela converte no banco padrão");
      const contingencia = await primeiroQueAparecer(
        { contingencia: recorte.locator("[data-contingencia]"), falha: recorte.locator(ALERTA_DE_ERRO) },
        { timeout: 20_000, oQue: "a contingência da geração" },
      );
      if (contingencia === "falha") {
        r.exigir(false, `a geração falhou sem contingência: “${(await recorte.locator(ALERTA_DE_ERRO).first().innerText()).replace(/\s+/g, " ")}”`);
        return;
      }
      await r.registrar(prof, "contingencia-da-geracao", {
        titulo: "Sem IA: o banco padrão da rede",
        mostra: "O aviso da geração (cota atingida ou serviço instável) e o caminho para o banco curado de Língua Portuguesa.",
        prova: "Sem saldo ou com o vendor fora, o professor não fica sem aula.",
      });
      await recorte.locator('[data-acao="prosseguir-com-banco-oficial"], [data-acao="usar-banco-padrao-503"]').first().click();
      await esperarOuFalharCedo(curadoria, recorte.locator(ALERTA_DE_ERRO), { timeout: 30_000, oQue: "abrir a curadoria do banco padrão" });
    }
    await r.registrar(prof, "curadoria-do-pacote", {
      titulo: "Curadoria do Pacote Temático",
      mostra: `Os treze itens do pacote (${caminho === "ia" ? "escritos pela IA" : "do banco padrão"}), cada um com “Editar Texto” e “Regenerar Este Item”.`,
      prova: "Nada chega à turma sem a aprovação do professor — inclusive a dúvida do Lucas e as respostas do assistente.",
      inteira: true,
    });

    /* Editar Texto: a dúvida do Lucas, escrita à mão. */
    const itemEditado = curadoria.locator('[data-item="duvidas.lucas"]');
    await itemEditado.locator('[data-acao="editar-texto"]').click();
    await itemEditado.locator("textarea").fill(DUVIDA_EDITADA);
    const salvou = prof.waitForResponse((x) => /\/rascunho\/editar$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 30_000 });
    await itemEditado.locator('[data-acao="salvar-texto"]').click();
    const edicao = await salvou;
    await esperarOuFalharCedo(curadoria.locator('[data-item="duvidas.lucas"][data-editado="sim"]'), itemEditado.locator(ALERTA_DE_ERRO), {
      timeout: 15_000,
      oQue: "salvar o texto editado",
    });
    r.exigir(
      edicao.status() === 200 && (await itemEditado.innerText()).includes(DUVIDA_EDITADA) && (await itemEditado.innerText()).includes("Editado pelo professor"),
      "“Editar Texto”: a dúvida do Lucas foi reescrita e ganhou “Editado pelo professor”",
    );

    /* Regenerar Este Item: a resposta do assistente ao Thiago. */
    const itemRegenerado = curadoria.locator('[data-item="respostas.thiago1"]');
    const antesDoRegenerar = (await itemRegenerado.locator("p").first().innerText()).trim();
    const regenerou = prof.waitForResponse((x) => /\/rascunho\/regenerar$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 180_000 });
    await itemRegenerado.locator('[data-acao="regenerar-item"]').click();
    const regeneracao = await regenerou;
    if (regeneracao.status() === 200) {
      await itemRegenerado.locator('[data-acao="regenerar-item"]:not([disabled])').waitFor({ timeout: 15_000 });
      const depoisDoRegenerar = (await itemRegenerado.locator("p").first().innerText()).trim();
      r.exigir(depoisDoRegenerar.length > 0 && depoisDoRegenerar !== antesDoRegenerar, "“Regenerar Este Item”: a IA reescreveu só a resposta ao Thiago (o texto mudou)");
    } else {
      /* Sem IA, o regenerar responde 429/503 e o rascunho fica como estava — o erro aparece NO item. */
      r.provocado(/rascunho\/regenerar/, "o “Regenerar Este Item” com a IA fora, que responde 429/503 e mantém o rascunho");
      await itemRegenerado.locator(ALERTA_DE_ERRO).waitFor({ timeout: 15_000 });
      r.exigir(
        caminho === "banco-padrao" && [429, 503].includes(regeneracao.status()),
        `sem IA, “Regenerar Este Item” responde ${regeneracao.status()} e o item diz que não deu (o rascunho fica como estava)`,
      );
      r.ressalva("o “Regenerar Este Item” com a IA real ficou PENDENTE (a IA estava fora nesta corrida)");
    }
    await itemRegenerado.scrollIntoViewIfNeeded();
    await r.registrar(prof, "editar-e-regenerar", {
      titulo: "Editar Texto e Regenerar Este Item",
      mostra: "A dúvida do Lucas reescrita pelo professor (com o selo “Editado pelo professor”) e a resposta ao Thiago regenerada.",
      prova: "O servidor guarda o rascunho que o professor viu; a régua do pacote vale para a IA, o editar e o regenerar.",
    });

    const aprovou = prof.waitForResponse((x) => /\/homologar$/.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout: 30_000 });
    await curadoria.locator('[data-acao="aprovar-pacote"]').click();
    const homologacao = await aprovou;
    await esperarOuFalharCedo(passo.locator('[data-fase="liberacao"]'), curadoria.locator(ALERTA_DE_ERRO), { timeout: 30_000, oQue: "aprovar o pacote" });
    r.exigir(homologacao.status() < 300, `“Aprovar Pacote Homologado” grava a atividade pronta (HTTP ${homologacao.status()})`);
    await r.registrar(prof, "pacote-aprovado", {
      titulo: "Liberação da Atividade Escolar",
      mostra: "O pacote aprovado: a turma, a disciplina e o tema, e a configuração ativa inicial do assistente (B-B-A, restritiva).",
      prova: "Aprovar cria a atividade PRONTA (ADR-130); quem a põe no ar é o último passo do assistente.",
    });

    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').click();
    await prof.getByRole("radio", { name: "Um aluno por computador", exact: true }).click();
    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').click();
    await prof.locator("[data-revisao-da-criacao]").waitFor({ timeout: 10_000 });
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    const criar = prof.locator('[data-acao="criar-atividade"]');
    r.exigir((await noAr.isChecked()) && (await criar.innerText()).includes("Liberar Atividade para a Turma"), "com o “Pôr no ar” ligado, o botão é “Liberar Atividade para a Turma”");
    await r.registrar(prof, "revisar-e-liberar", {
      titulo: "Revisar e liberar",
      mostra: "A turma, o pacote aprovado e “Um aluno por computador”, com o pôr no ar ligado.",
      prova: "Liberar põe a atividade em andamento e libera a missão na sala de aula num toque.",
    });
    await criar.click();
    await esperarOuFalharCedo(prof.locator("[data-painel-da-aula]"), prof.locator(ALERTA_DE_ERRO), { timeout: 60_000, oQue: "liberar a atividade" });

    const historico = (await lerApi(prof, `${daTurma}/historico`)).corpo;
    const atividadeId = historico?.emAndamento?.pacoteId;
    const detalhe = (await lerApi(prof, `${daTurma}/pacotes/${atividadeId}`)).corpo;
    r.exigir(
      detalhe?.ativo === true &&
        detalhe?.origem === (caminho === "ia" ? "ia" : "padrao") &&
        (caminho !== "ia" || detalhe?.tema === RECORTE.tema) &&
        detalhe?.editados?.includes("duvidas.lucas") &&
        detalhe?.conteudo?.duvidas?.lucas === DUVIDA_EDITADA,
      `a atividade EM ANDAMENTO é a aprovada agora (origem ${detalhe?.origem}, “${detalhe?.tema}”), com a dúvida editada`,
    );
    const salas = await lerApi(prof, `/salas/turma/${turmaId}`);
    const naSala = salas.corpo?.missoes?.find?.((m) => m.expId === EXP_ID) ?? null;
    r.exigir(naSala?.estado === "liberada", `a missão está liberada na sala da ${TURMA} (${naSala?.estado})`);
    const painel = prof.locator("[data-painel-da-aula]");
    await revelar(prof, painel);
    r.exigir((await painel.getAttribute("data-fase-da-turma")) === "aguardando-inicio", "a turma começa em “aguardando-inicio”: o primeiro botão é do professor");
    await r.registrar(prof, "painel-ao-vivo", {
      titulo: "Painel ao Vivo: o papel da turma",
      mostra: "“Status da Condução: Papel da Turma” e o botão “Liberar Início dos Testes”, com a folha da turma embaixo.",
      prova: "A turma só sai das boas-vindas quando o professor apresenta a comissão e libera.",
    });

    /** Uma liberação do painel: o botão, a confirmação, e a fase nova — correndo contra o erro. */
    const liberar = async (para) => {
      const botao = prof.locator(`[data-acao="fase-${para}"]:not([disabled])`);
      await botao.waitFor({ timeout: 30_000 });
      await botao.click();
      const confirmar = prof.locator('[data-acao="confirmar-fase"]');
      await confirmar.waitFor({ timeout: 10_000 });
      await confirmar.click();
      await esperarOuFalharCedo(prof.locator(`[data-painel-da-aula][data-fase-da-turma="${para}"]`), prof.locator(ALERTA_DE_ERRO), {
        timeout: 20_000,
        oQue: `liberar a fase “${para}”`,
      });
    };

    // ═══ ESTUDANTE: a espera e a E1 ═══════════════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 412, height: 915 }, mobile: true, deviceScaleFactor: 2 });
    await r.entrar(p, estudante.login, senhaDe(estudante));
    await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    const q = p.frameLocator("iframe[data-experiencia]");
    await esperarOuFalharPorHttp(p, q.getByRole("button", { name: "Abrir Módulo de Teste" }), /assistente-invisivel\/sessao/, {
      timeout: 40_000,
      oQue: "o boot da missão",
    });
    await q.getByText(ESPERA).first().waitFor({ timeout: 10_000 });
    r.exigir(await q.getByText("Unooria · Comissão", { exact: true }).isVisible(), "o cabeçalho é “Unooria · Comissão” (individual, sem equipe)");
    await r.registrar(p, "espera-do-inicio", {
      titulo: "Pausa para Mediação",
      mostra: "A Zara e o módulo de teste por baixo, e a camada de espera: “Aguardando autorização da mediação docente…”.",
      prova: "A turma não começa sozinha: o passo é o mesmo, e a camada sai quando o professor libera.",
    });

    await liberar("testes");
    await q.getByText(ESPERA).first().waitFor({ state: "hidden", timeout: 20_000 });
    await r.registrar(p, "boas-vindas", {
      titulo: "Etapa 1 — Desafiar",
      mostra: "A Zara (Comissão Estudantil) apresenta o UnooriaAI em teste e o botão “Abrir Módulo de Teste”.",
      prova: "A liberação chegou pelo polling de 3 s do gate, sem recarregar a tela.",
    });
    const postDo = (rota, acao, timeout = 30_000) =>
      Promise.all([
        p.waitForResponse((x) => rota.test(new URL(x.url()).pathname) && x.request().method() === "POST", { timeout }),
        acao(),
      ]).then(async ([x]) => ({ status: x.status(), corpo: await x.json().catch(() => null) }));
    const iniciou = await postDo(/\/assistente-invisivel\/iniciar$/, () => q.getByRole("button", { name: "Abrir Módulo de Teste" }).click());
    r.exigir(iniciou.status === 200 && iniciou.corpo?.passo === "funcoes" && iniciou.corpo?.equipe === null, "“Abrir Módulo de Teste” leva às funções (passo “funcoes”)");

    // ═══ ESTUDANTE: E2, as funções ════════════════════════════════════════
    const ir = q.getByRole("button", { name: "Ir para Bateria de Testes" });
    await ir.waitFor({ timeout: 15_000 });
    r.exigir(await ir.isDisabled(), "“Ir para Bateria de Testes” nasce apagado: só acende com uma função aberta");
    for (const funcao of ["Função 1: Apresentar Exercícios", "Função 2: Responder Dúvidas", "Função 3: Sugerir Conteúdos"]) {
      await q.getByRole("button", { name: new RegExp(`^${funcao}`) }).click();
      await q.getByRole("button", { name: `${funcao} ✓` }).waitFor({ timeout: 5000 });
    }
    r.exigir(await ir.isEnabled(), "com as funções abertas (✓), o botão acende");
    await r.registrar(p, "tres-funcoes", {
      titulo: "Etapa 2 — Funções",
      mostra: "As três funções expandidas, com a descrição longa e a prévia estática do UnooriaAI; cada uma ganhou o ✓.",
      prova: "O botão só acende depois de uma função aberta (recolhido → expandido → habilitado).",
      inteira: true,
    });
    const navegou = await postDo(/\/assistente-invisivel\/navegar$/, () => ir.click());
    r.exigir(navegou.corpo?.passo === "aposta" && navegou.corpo?.funcoesAbertas?.length === 3, "as três funções abertas vão ao servidor e o passo vira a aposta");

    // ═══ ESTUDANTE: E3, a aposta (LATCH 1) ════════════════════════════════
    await q.getByText("Lucas (15 anos)").first().waitFor({ timeout: 15_000 });
    r.exigir(
      (await q.getByText("Beatriz (15 anos)").count()) === 1 &&
        (await q.getByText("Thiago (16 anos)").count()) === 1 &&
        (await q.getByText("Preferência declarada: Trilha Avançada").count()) === 3,
      "as três fichas de cadastro (Beatriz, Thiago e Lucas) pedem a Trilha Avançada",
    );
    r.exigir(await q.getByRole("button", { name: "Disparar Simulação" }).isDisabled(), "sem aposta, “Disparar Simulação” fica apagado");
    await q.getByRole("radio", { name: APOSTA_A, exact: true }).click();
    await r.registrar(p, "a-aposta", {
      titulo: "Etapa 3 — Aposta",
      mostra: "As três fichas com a mesma preferência e a aposta (A): “Todos receberão o nível Avançado conforme solicitado no cadastro.”",
      prova: "A aposta mede a crença de entrada: nada na tela diz que o sistema usa horário ou conexão.",
      inteira: true,
    });
    const apostou = await postDo(/\/assistente-invisivel\/aposta$/, () => q.getByRole("button", { name: "Disparar Simulação" }).click());
    r.exigir(apostou.status === 200 && apostou.corpo?.aposta === "a" && Boolean(apostou.corpo?.apostadaEm), "a aposta A está gravada (LATCH 1)");
    await q.getByText("Estado Latch Gravado").first().waitFor({ timeout: 10_000 });
    r.exigir(
      (await q.getByText(`Previsão arquivada: ${APOSTA_A}`).count()) === 1 && (await q.getByRole("button", { name: "Iniciando Simulação de Chat..." }).isDisabled()),
      "“Previsão arquivada” com o texto inteiro da aposta, e “Iniciando Simulação de Chat...” esperando a turma",
    );
    await r.registrar(p, "previsao-arquivada", {
      titulo: "Estado Latch Gravado",
      mostra: "A previsão arquivada de forma definitiva e o botão “Iniciando Simulação de Chat...” desabilitado.",
      prova: "LATCH 1: a aposta não volta. A simulação só começa quando 100% das sessões abertas apostaram.",
    });

    // ═══ PROFESSOR: 100% das apostas e a simulação ════════════════════════
    const painelNaApi = await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.resumo?.todosApostaram === true, {
      oQue: "o painel contar 100% das apostas",
    });
    r.exigir(painelNaApi.resumo.apostas.a >= 1 && painelNaApi.resumo.faltamApostar.length === 0, `100% das sessões abertas apostaram (${painelNaApi.resumo.sessoes} sessão(ões); faltam: nenhuma)`);
    await prof.locator('[data-acao="fase-simulacao"]:not([disabled])').waitFor({ timeout: 20_000 });
    await painel.getByText("Status da Condução: Apostas Registradas").waitFor({ timeout: 10_000 });
    await r.registrar(prof, "apostas-registradas", {
      titulo: "Distribuição das Apostas da Sala",
      mostra: "As barras A, B e C, “Apostas registradas pela turma” em 100% e o “Liberar Início da Simulação” aceso.",
      prova: "O botão só acende com 100% das sessões abertas: quem abriu e saiu segura a turma, e o painel diz quem falta.",
    });
    await liberar("simulacao");

    // ═══ ESTUDANTE: E4, a simulação, o confronto e as fichas ══════════════
    const concluiuSimulacao = p.waitForResponse(
      (x) => /\/assistente-invisivel\/simulacao\/concluir$/.test(new URL(x.url()).pathname) && x.request().method() === "POST",
      { timeout: 90_000 },
    );
    await q.getByText("Aviso de Sistema: Identificamos o seu ritmo de estudos e direcionamos você para o Reforço Básico").first().waitFor({ timeout: 40_000 });
    r.exigir((await q.getByText(DUVIDA_EDITADA).count()) >= 1, "a dúvida do Lucas no chat é a que o professor editou");
    await r.registrar(p, "sessao-da-beatriz", {
      titulo: "UnooriaAI — Sessão de Teste 2/3: Beatriz",
      mostra: "O Lucas recebe a Trilha Avançada; a Beatriz (23h45) recebe o aviso de sistema e o Reforço Básico.",
      prova: "A conversa é ROTEIRIZADA a partir do pacote aprovado: não há IA na tela do estudante, e o Composer fica bloqueado.",
    });
    await q.getByText("Sessões 2/3 e 3/3 Concluídas").first().waitFor({ timeout: 40_000 });
    r.exigir(
      (await q.getByText("Aviso de Sistema: Limite de interações atingido para a sua sessão. Retorne amanhã").count()) === 1,
      "o Thiago (sinal instável) recebe o limite de interações na terceira dúvida",
    );
    await r.registrar(p, "sessoes-concluidas", {
      titulo: "Sessões 2/3 e 3/3 Concluídas",
      mostra: "A sessão do Thiago: duas respostas e, na terceira dúvida, “Limite de interações atingido”.",
      prova: "Os três pediram a mesma coisa; só o que o sistema observou mudou.",
    });
    const simulacao = await concluiuSimulacao;
    r.exigir(simulacao.status() === 200, "a simulação concluída vai ao servidor depois da pausa para ler");

    const confronto =
      "Você previu: 'Todos receberão o nível Avançado conforme solicitado no cadastro'. No entanto, Beatriz e Thiago foram barrados. Por que o formulário que eles preencheram não foi respeitado?";
    await q.getByText(confronto, { exact: true }).waitFor({ timeout: 15_000 });
    r.exigir((await q.getByText(/^Na sua turma:/).count()) === 0, "com menos de 3 apostas, o medidor da turma não aparece");
    await r.registrar(p, "confronto", {
      titulo: "Etapa 4 — Flagrante da Triagem",
      mostra: "O confronto nominal com a aposta A (o texto inteiro, entre aspas) e a Zara: “Precisamos abrir essas fichas.”",
      prova: "A aposta gravada volta como espelho: o estudante previu o cadastro respeitado, e o cadastro não foi.",
    });
    const abriuFichas = await postDo(/\/assistente-invisivel\/fichas\/abrir$/, () => q.getByRole("button", { name: "Abrir Fichas de Auditoria de Acesso" }).click());
    r.exigir(abriuFichas.corpo?.passo === "fichas", "“Abrir Fichas de Auditoria de Acesso” abre as fichas (passo “fichas”)");
    const folha = q.getByRole("dialog", { name: "Fichas de Auditoria de Acesso" });
    await folha.waitFor({ timeout: 10_000 });
    const textoDasFichas = (await folha.innerText()).replace(/\s+/g, " ");
    r.exigir(
      textoDasFichas.includes("23h45 · Banda larga") &&
        textoDasFichas.includes("08h30 · Sinal instável") &&
        textoDasFichas.includes("Inferência: Acesso noturno / Possível cansaço e baixo rendimento → Rebaixar para Básico") &&
        textoDasFichas.includes("Inferência: Risco de sobrecarga e lentidão → Limitar a 2 mensagens") &&
        textoDasFichas.includes("Resultado: Avançado"),
      "as fichas mostram o horário e a conexão observados, a inferência e a ação de cada perfil (o Lucas sem inferência)",
    );
    await r.registrar(p, "fichas-de-auditoria", {
      titulo: "Fichas de Auditoria de Acesso",
      mostra: "Estudante | Formulário | Observado | Ação do Sistema: Lucas avançado; Beatriz rebaixada pelo acesso noturno; Thiago limitado pelo sinal.",
      prova: "As fichas não são gabarito: são a revelação que a mecânica mostra — o formulário igual, o observado diferente.",
    });
    const inspecionou = await postDo(/\/assistente-invisivel\/inspecao\/concluir$/, () => folha.getByRole("button", { name: "Concluir Inspeção de Metadados" }).click());
    r.exigir(inspecionou.corpo?.passo === "classificacao" && inspecionou.corpo?.aguardandoProfessor === true, "“Concluir Inspeção de Metadados” leva à Trava 1 (a bancada espera o professor)");
    await q.getByText(ESPERA).first().waitFor({ timeout: 10_000 });
    await q.getByText("Fichas de Auditoria Técnicas em segundo plano...").first().waitFor({ state: "attached", timeout: 10_000 });
    await r.registrar(p, "trava-1", {
      titulo: "A Trava 1",
      mostra: "As fichas em segundo plano e a camada “Aguardando autorização da mediação docente…”.",
      prova: "A Trava 1 vem DEPOIS das fichas (decisão do Vinicius): a turma debate com o que acabou de ver.",
    });

    // ═══ PROFESSOR: travar as telas e liberar a bancada ═══════════════════
    await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.resumo?.simulacoesConcluidas >= 1, { oQue: "o painel contar a simulação concluída" });
    await liberar("debate-1");
    await painel.locator('[data-pergunta="2"]').waitFor({ timeout: 10_000 });
    await r.registrar(prof, "telas-travadas", {
      titulo: "Status da Condução: Telas Travadas",
      mostra: "As apostas da sala, quem concluiu as 3 sessões e as perguntas 1 e 2 do roteiro de debate.",
      prova: "“Travar Telas da Turma” vale para todo mundo da Etapa 4, inclusive quem ainda está nas fichas.",
    });
    await q.getByText("Roda de conversa coletiva em andamento com o professor (8 min).").first().waitFor({ timeout: 20_000 });
    await r.registrar(p, "roda-de-conversa", {
      titulo: "Pausa para Mediação — a roda de conversa",
      mostra: "A camada de espera com “Roda de conversa coletiva em andamento com o professor (8 min).”",
      prova: "A pausa é a FASE da turma, não o passo do estudante: o polling do gate a trouxe sozinho.",
    });
    await liberar("explicar");

    // ═══ ESTUDANTE: E5, os cartões ════════════════════════════════════════
    await q.getByText("Arraste ou toque nos cartões para separar os dados fornecidos pelo estudante dos dados técnicos observados pela plataforma.").waitFor({ timeout: 20_000 });
    await q.getByText(ESPERA).first().waitFor({ state: "hidden", timeout: 10_000 });
    const bandeja = q.locator(".bandeja");
    r.exigir((await bandeja.getByText("Cartão 1", { exact: true }).count()) === 1, "com nada colocado, o 1º cartão leva a etiqueta “Cartão 1” (o andaime)");
    for (const [i, cartao] of CARTOES.entries()) {
      await bandeja.getByRole("button", { name: cartao.rotulo }).click();
      await q.getByRole("button", { name: `Colocar em ${cartao.coluna}` }).click();
      if (i === 2) {
        await q.getByText(/A classificação dos dados da sessão ainda não foi concluída/).first().waitFor({ timeout: 5000 });
        await r.registrar(p, "cartoes-no-meio", {
          titulo: "Etapa 5 — os cartões, no meio",
          mostra: "Três cartões colocados (Dados Fornecidos 2, Dados Observados 1) e o aviso de classificação incompleta.",
          prova: "Por toque: toca o cartão e depois “Colocar em …”. A tela não sabe a coluna certa: manda a alocação, e o servidor decide.",
          inteira: true,
        });
      }
    }
    r.exigir((await bandeja.count()) === 0, "os 6 cartões saíram da bandeja");
    await r.registrar(p, "cartoes-separados", {
      titulo: "Dados Fornecidos × Dados Observados",
      mostra: "Escolha de Trilha e Nome e Turma em Fornecidos (2); horário, sinal, IP e aparelho em Observados (4).",
      prova: "O que o estudante digitou × o que o sistema gravou sozinho — a cadeia causal começa no dado observado.",
      inteira: true,
    });
    const classificou = await postDo(/\/assistente-invisivel\/cartoes$/, () => q.getByRole("button", { name: "Concluir Classificação" }).click());
    r.exigir(
      classificou.corpo?.passo === "algoritmo" && classificou.corpo?.classificacao?.completa === true && classificou.corpo?.classificacao?.cadeiaCausal === true,
      "a classificação completa abre a tabela causal (o servidor decide: `cadeiaCausal`)",
    );

    // ═══ ESTUDANTE: E5, as etapas do algoritmo ════════════════════════════
    await q.getByText("Tabela Causal: Horário (Dado Observado) → Cansaço Presumido (Inferência) → Reforço Básico (Decisão Restritiva).").waitFor({ timeout: 15_000 });
    const abriuPainel = await postDo(/\/assistente-invisivel\/algoritmo\/abrir$/, () =>
      q.getByRole("button", { name: /\[Opcional \/ Aprofundamento\] Ver etapas de processamento do assistente/ }).click(),
    );
    r.exigir(abriuPainel.corpo?.algoritmo?.aberto === true, "abrir o painel opcional vai ao servidor (o PQ-04)");
    let marcou = null;
    for (const n of [2, 3, 4]) {
      const caixa = q.getByRole("checkbox", { name: new RegExp(`Passo ${n}:`) });
      marcou = await postDo(/\/assistente-invisivel\/algoritmo\/marcar$/, () => caixa.dispatchEvent("click"));
    }
    r.exigir(JSON.stringify(marcou?.corpo?.algoritmo?.marcados) === "[2,3,4]", `os passos 2, 3 e 4 marcados no servidor (${JSON.stringify(marcou?.corpo?.algoritmo?.marcados)})`);
    await q.getByText("Otimização: de 5 para 2 passos essenciais").waitFor({ timeout: 5000 });
    r.exigir(
      (await q.getByText(/\(Inferência dispensável\)$/).count()) === 3 && (await q.getByText(/\(Essencial\)$/).count()) === 2,
      "os marcados ganham “(Inferência dispensável)” e os outros “(Essencial)” — o rótulo do estudante, não o gabarito",
    );
    await r.registrar(p, "etapas-do-algoritmo", {
      titulo: "Ver etapas de processamento do assistente",
      mostra: "Os 5 passos do algoritmo com 2, 3 e 4 marcados como inferência dispensável e “Otimização: de 5 para 2 passos essenciais”.",
      prova: "Opcional (EM13CO03): a tela não sabe quais passos sobram — a conta é do estudante, a régua é do servidor.",
      inteira: true,
    });
    const pulou = await postDo(/\/assistente-invisivel\/algoritmo\/concluir$/, () => q.getByRole("button", { name: "Pular Etapa" }).click());
    r.exigir(pulou.corpo?.passo === "criterios" && pulou.corpo?.algoritmo?.concluido === true, "“Pular Etapa” fecha o painel e leva ao banco de critérios");

    // ═══ ESTUDANTE: E5, os critérios e o reteste ══════════════════════════
    await q.getByText("Selecione critérios no repositório da rede para reconfigurar as três funções do assistente escolar.").waitFor({ timeout: 15_000 });
    r.exigir(
      (await q.getByRole("radio", { name: /^Critério 1B: .*\[Ativo\]$/ }).count()) === 1 &&
        (await q.getByRole("radio", { name: /^Critério 2B: .*\[Ativo\]$/ }).count()) === 1 &&
        (await q.getByRole("radio", { name: /^Critério 3A: .*\[Ativo\]$/ }).count()) === 1,
      "a configuração no ar é B-B-A, com “[Ativo]”",
    );
    /* O 1B MANTIDO (o horário de acesso) e o 2C: equidade parcial. */
    await q.getByRole("radio", { name: /^Critério 2C:/ }).click();
    await r.registrar(p, "criterios-1b-mantido", {
      titulo: "O banco de critérios — o 1B mantido",
      mostra: "As três funções em 3 opções cada; o estudante troca só a função 2 (2C) e mantém o 1B (horário de acesso).",
      prova: "O que está no ar leva “[Ativo]”: é o que o sistema roda, não uma dica.",
      inteira: true,
    });
    const primeiro = await postDo(/\/assistente-invisivel\/criterios$/, () => q.getByRole("button", { name: "Executar Novo Teste de Homologação" }).click());
    r.exigir(
      primeiro.corpo?.passo === "reteste" && primeiro.corpo?.reteste?.equidade !== "total" && primeiro.corpo?.reteste?.beatrizAvancada === false,
      `com o 1B mantido, o reteste NÃO homologa (equidade “${primeiro.corpo?.reteste?.equidade}”, a Beatriz segue rebaixada)`,
    );
    await q.getByText("Alerta de Viés Mantido").first().waitFor({ timeout: 10_000 });
    r.exigir(
      (await q.getByText("Atenção: as regras ativas continuam gerando restrições baseadas em dados observados. Revise os critérios no banco antes de aprovar.").count()) === 1 &&
        (await q.getByRole("button", { name: "Revisar Critérios" }).count()) === 1 &&
        (await q.getByRole("button", { name: "Avançar para Publicação" }).count()) === 1,
      "o alerta oferece “Revisar Critérios” e “Avançar para Publicação”",
    );
    await r.registrar(p, "alerta-de-vies", {
      titulo: "Alerta de Viés Mantido",
      mostra: "O resultado do reteste e o efeito no chat: a Beatriz ainda recebe o Reforço Básico.",
      prova: "O servidor calcula o reteste; a tela mostra o efeito, nunca o gabarito.",
      inteira: true,
    });
    const revisou = await postDo(/\/assistente-invisivel\/reteste\/revisar$/, () => q.getByRole("button", { name: "Revisar Critérios" }).click());
    r.exigir(revisou.corpo?.passo === "criterios", "“Revisar Critérios” volta ao banco");
    await q.getByRole("radio", { name: /^Critério 1C:/ }).waitFor({ timeout: 10_000 });
    await q.getByRole("radio", { name: /^Critério 1C:/ }).click();
    if (!(await q.getByRole("radio", { name: /^Critério 2C:/ }).isChecked())) await q.getByRole("radio", { name: /^Critério 2C:/ }).click();
    const segundo = await postDo(/\/assistente-invisivel\/criterios$/, () => q.getByRole("button", { name: "Executar Novo Teste de Homologação" }).click());
    r.exigir(
      segundo.corpo?.reteste?.equidade === "total" && segundo.corpo?.reteste?.beatrizAvancada === true && segundo.corpo?.reteste?.thiagoLivre === true && segundo.corpo?.retestes === 2,
      "1C/2C: equidade total — a Beatriz avança e o Thiago fica livre (2 retestes)",
    );
    await q.getByText("Equidade Homologada").first().waitFor({ timeout: 10_000 });
    await q.getByText("Homologação Aprovada: critérios equitativos ativos. Beatriz acessou o nível Avançado e Thiago manteve dúvidas liberadas.").waitFor({ timeout: 5000 });
    await r.registrar(p, "homologacao-aprovada", {
      titulo: "Equidade Homologada",
      mostra: "“Homologação Aprovada”, “Nenhum estudante foi restrito por horário ou oscilação técnica” e o novo teste no UnooriaAI.",
      prova: "EM13CO01: os critérios reutilizados do repositório (1C e 2C) não restringem por dado observado.",
      inteira: true,
    });
    const avancou = await postDo(/\/assistente-invisivel\/reteste\/avancar$/, () => q.getByRole("button", { name: "Avançar para Homologação e Transparência" }).click());
    r.exigir(avancou.corpo?.passo === "publicacao" && avancou.corpo?.aguardandoProfessor === true, "avançar leva à Trava 2 (a publicação espera o professor)");
    await q.getByText(ESPERA).first().waitFor({ timeout: 10_000 });
    await q.getByText("Bancada de Critérios em segundo plano...").first().waitFor({ state: "attached", timeout: 10_000 });
    await r.registrar(p, "trava-2", {
      titulo: "A Trava 2",
      mostra: "A bancada em segundo plano e a camada de espera da mediação docente.",
      prova: "A publicação só abre depois da comparação 1A × 1C no quadro.",
    });

    // ═══ PROFESSOR: a comparação e a publicação ═══════════════════════════
    await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.resumo?.criterioExercicios?.c >= 1, { oQue: "o painel contar o critério 1C" });
    await painel.locator("[data-projecao-de-solucoes]").waitFor({ timeout: 20_000 });
    await prof.waitForFunction(() => /Último reteste de cada estudante/.test(document.querySelector("[data-projecao-de-solucoes]")?.textContent ?? ""), null, {
      timeout: 20_000,
    });
    r.exigir((await painel.locator("[data-avisos-discretos]").count()) === 0, "quem revisou e homologou NÃO entra nos Avisos Discretos");
    await painel.locator("[data-projecao-de-solucoes]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "projecao-de-solucoes", {
      titulo: "Projeção de Soluções: 1A × 1C",
      mostra: "“Critérios Escolhidos pela Sala: 1A × 1C” no último reteste de cada estudante, com o sentido de cada critério.",
      prova: "O professor projeta o contraste; os Avisos Discretos listariam só quem avançou mantendo regras restritivas.",
    });
    await liberar("debate-2");
    await q.getByText("Comparação de soluções no quadro com o professor (5 min).").first().waitFor({ timeout: 20_000 });
    await r.registrar(p, "comparacao-no-quadro", {
      titulo: "Pausa para Mediação — a comparação",
      mostra: "A camada de espera com “Comparação de soluções no quadro com o professor (5 min).”",
      prova: "A segunda pausa, opcional, para todo mundo da Etapa 5.",
    });
    await liberar("publicar");

    // ═══ ESTUDANTE: E6, a página e o comunicado (LATCH 2) ═════════════════
    await q.getByText("Ative a declaração de transparência e monte o comunicado oficial da comissão escolar articulando os quatro pontos lógicos.").waitFor({ timeout: 20_000 });
    await q.getByText(ESPERA).first().waitFor({ state: "hidden", timeout: 10_000 });
    const pagina = q.getByRole("switch", { name: /Página Pública de Transparência do UnooriaAI/ });
    r.exigir(!(await pagina.isChecked()), "a página de transparência nasce DESLIGADA");
    await pagina.dispatchEvent("click");
    r.exigir(await pagina.isChecked(), "o estudante liga a página de transparência");
    for (const opcao of BLOCOS_CERTOS) await q.getByRole("radio", { name: opcao, exact: true }).click();
    const montado = (await q.locator(".comunicado").innerText()).replace(/\s+/g, " ");
    r.exigir(
      montado.includes("1. Problema:") && montado.includes("restringindo acessos automaticamente...") && montado.includes("4. LGPD:"),
      "com os 4 blocos escolhidos, o comunicado aparece montado, com os trechos escolhidos",
    );
    await r.registrar(p, "comunicado-montado", {
      titulo: "Etapa 6 — Publicar",
      mostra: "A página pública ligada e os 4 blocos do comunicado: o problema, a inferência indevida, a regra corrigida e a salvaguarda LGPD.",
      prova: "Publicar é sempre habilitado (só bloco em branco tem aviso): um aviso de bloco “desconexo” entregaria o gabarito.",
      inteira: true,
    });
    const publicou = await postDo(/\/assistente-invisivel\/publicar$/, () => q.getByRole("button", { name: "Publicar Transparência e Comunicado" }).click());
    r.exigir(
      publicou.status === 200 && publicou.corpo?.concluido === true && publicou.corpo?.passo === "concluida" && publicou.corpo?.publicacao?.paginaAtiva === true,
      "a publicação trava (LATCH 2) e conclui a missão, com a página ativa",
    );
    await q.getByText("Certificado de Homologação Ética Escolar").waitFor({ timeout: 15_000 });
    r.exigir(
      (await q.getByText("Salvaguarda Ativa: Direito à Explicação e Revisão Humana (LGPD)").count()) === 1 &&
        (await q.getByText("Cenário de Transferência: Algoritmos no Mercado").count()) === 1,
      "o certificado traz a salvaguarda ativa e o cenário de transferência",
    );
    await r.registrar(p, "certificado", {
      titulo: "Certificado de Homologação Ética Escolar",
      mostra: "A Zara, o certificado com a salvaguarda LGPD, o caso do aplicativo de transporte, a síntese e o desafio extra.",
      prova: "A interface fica congelada em modo leitura: o LATCH 2 já marcou as quatro habilidades no servidor.",
      inteira: true,
    });

    /* Regra 3: o estado do estudante não carrega o gabarito. */
    const sessao = await lerApi(p, "/assistente-invisivel/sessao");
    const bruto = JSON.stringify(sessao.corpo ?? {});
    r.exigir(
      sessao.status === 200 &&
        !/"(coluna|colunaCerta|dispensaveis|passosDispensaveis|equitativos|criteriosEquitativos|opcaoCerta|certa|acertos|alinhamento|niveis)"/.test(bruto) &&
        (sessao.corpo?.material?.cartoes ?? []).every((c) => Object.keys(c).sort().join() === "id,rotulo"),
      "GET /assistente-invisivel/sessao não traz colunas, passos dispensáveis, critérios equitativos, opção certa, acertos nem níveis",
    );

    // ═══ PROFESSOR: o relatório formativo e a exportação ══════════════════
    const niveisDe = (c) => c?.linhas?.find((l) => l.nome === estudante.nome)?.niveis ?? null;
    const final = await esperarNaApi(prof, `${daTurma}/painel`, (c) => niveisDe(c) !== null, { oQue: "os níveis do estudante no painel" });
    const niveis = niveisDe(final);
    r.exigir(
      niveis.co20 === "atingiu" && niveis.co01 === "atingiu" && niveis.co18 === "atingiu" && niveis.co03 === "atingiu",
      `as quatro habilidades de ${estudante.nome}: CO20 ${niveis.co20}, CO01 ${niveis.co01}, CO18 ${niveis.co18}, CO03 ${niveis.co03}`,
    );
    const evidencia = (await lerApi(prof, `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`)).corpo;
    const doEstudante = evidencia?.estudantes?.find((x) => x.nome === estudante.nome);
    const statusDe = (codigo) => Object.values(doEstudante?.porRodada ?? {}).map((rodada) => rodada?.[codigo]?.status).find(Boolean) ?? null;
    r.exigir(
      ["EM13CO20", "EM13CO01", "EM13CO18", "EM13CO03"].every((c) => statusDe(c) === "atingiu"),
      `a evidência (E14) registra “atingiu” nas quatro (${["EM13CO20", "EM13CO01", "EM13CO18", "EM13CO03"].map((c) => `${c} ${statusDe(c)}`).join(", ")})`,
    );

    await prof.reload({ waitUntil: "domcontentloaded" });
    const relatorio = prof.locator("[data-relatorio-final]");
    await revelar(prof, relatorio);
    await relatorio.waitFor({ timeout: 30_000 });
    const linhaDoEstudante = relatorio.locator("[data-niveis-por-estudante]").getByRole("row").filter({ hasText: estudante.nome });
    await linhaDoEstudante.first().waitFor({ timeout: 15_000 });
    const textoDaLinha = await linhaDoEstudante.first().innerText();
    r.exigir((textoDaLinha.match(/Atingiu/g) ?? []).length === 4, `a linha de ${estudante.nome} em “Níveis por Estudante” tem as quatro “Atingiu”`);
    r.exigir((await relatorio.locator("[data-comunicados]").innerText()).includes("Página de transparência: Ativada"), "o comunicado publicado aparece com a página ativada");
    await relatorio.scrollIntoViewIfNeeded();
    await r.registrar(prof, "relatorio-formativo", {
      titulo: "Relatório Formativo Final",
      mostra: `A conclusão da homologação, a matriz BNCC (Canal A), as perguntas 3 e 4, os níveis de ${estudante.nome} (quatro “Atingiu”) e o comunicado publicado.`,
      prova: "Os níveis saem do que o estudante FEZ — a página, os blocos, os critérios e as etapas —, sem nota nem ordenação.",
      inteira: true,
    });

    /* "Exportar Relatório de Homologação Ética": a impressão do navegador, só com o relatório. O
       `window.print` vira um registro (o headless não abre o diálogo) — o que se prova é que o botão
       dispara a impressão COM a folha do relatório marcada e a desfaz depois, sem erro de console. */
    const exportar = prof.locator('[data-acao="imprimir-relatorio-homologacao"]');
    await exportar.waitFor({ timeout: 10_000 });
    r.exigir((await exportar.innerText()).trim() === "Exportar Relatório de Homologação Ética", "o botão “Exportar Relatório de Homologação Ética” está no relatório");
    const errosAntes = r.erros.length;
    await prof.evaluate(() => {
      window.__impressoes = [];
      window.print = () => {
        window.__impressoes.push(document.documentElement.dataset.impressao ?? null);
        window.dispatchEvent(new Event("afterprint"));
      };
    });
    await exportar.click();
    const impressoes = await prof.evaluate(() => ({ chamadas: window.__impressoes, depois: document.documentElement.dataset.impressao ?? null }));
    r.exigir(
      JSON.stringify(impressoes.chamadas) === JSON.stringify(["relatorio-homologacao"]) && impressoes.depois === null && r.erros.length === errosAntes,
      "o clique dispara UMA impressão com a folha do relatório marcada, a marca sai no afterprint, e nenhum erro de console",
    );
    /* A folha impressa: com a marca e a mídia de impressão, só o relatório fica. */
    await prof.evaluate(() => (document.documentElement.dataset.impressao = "relatorio-homologacao"));
    await prof.emulateMedia({ media: "print" });
    await r.registrar(prof, "relatorio-impresso", {
      titulo: "Exportar Relatório de Homologação Ética",
      mostra: "A página como a impressora a vê: só o relatório formativo, sem a lousa, a folha nem os botões.",
      prova: "A exportação é a impressão do navegador (“Salvar como PDF”) com a folha própria do relatório.",
      inteira: true,
    });
    await prof.emulateMedia({ media: null });
    await prof.evaluate(() => delete document.documentElement.dataset.impressao);

    const habilidades = prof.locator("[data-habilidades-assistente-invisivel]");
    await revelar(prof, habilidades);
    await habilidades.waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await habilidades.innerText();
    r.exigir(
      ["EM13CO20", "EM13CO01", "EM13CO18", "EM13CO03"].every((c) => textoDasHabilidades.includes(c)),
      "a aba Habilidades mostra EM13CO20, EM13CO01, EM13CO18 e EM13CO03",
    );
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "As habilidades da BNCC",
      mostra: `As quatro habilidades da missão para ${estudante.nome}, todas “Atingiu”.`,
      prova: "100% Canal A: as quatro marcam juntas no LATCH 2, pelo que o estudante fez. Caminho do preparo nesta corrida: " + (caminho === "ia" ? "IA real." : "banco padrão (IA fora)."),
      inteira: true,
    });
  },
);
