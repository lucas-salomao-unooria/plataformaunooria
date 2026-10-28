import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { revelar } from "../lib/abas.mjs";

/**
 * O EFEITO AMPLIFICADOR 2.1.0 (exp02em1b, 2ª série do EM, unidade 1 — ADR-191),
 * das duas pontas da sala.
 *
 * A professora CRIA a atividade pelo assistente do hub, com um tema DELA,
 * escrito pela IA REAL (o Vertex, antes da aula — a única IA da missão),
 * faz a curadoria, homologa ("Homologar Conteúdo") e põe no ar ("Iniciar
 * Atividade com a Turma"). O estudante abre a pauta no UnooriaAI e conversa
 * com a ÁRVORE DE INTENÇÕES do servidor — sem IA na aula: as três sugestões
 * são a copy, perguntar a fonte só pergunta (o "sim" corrige) e o TC-03
 * corrige autoria e privacidade de uma vez. Ele aprova a prévia, exporta,
 * escolhe a manchete e publica (definitivo); o relógio salta até 02h30 e o
 * feed da madrugada abre, com a instrução do moderador (TC-10) FORA do
 * aparelho, no hub. Ele fixa o aviso de cuidado, mexe na Configuração da
 * Publicação e usa a Central de Apoio. A professora pausa as telas e avança a
 * turma para o Explicar; o estudante aponta um cartão, conclui e lê a
 * transcrição do podcast. No fim, o painel de habilidades.
 *
 * Os nomes (instituto, colega, autoria), o recorte, as manchetes e os
 * comentários vêm do pacote que a IA escreveu, lido da api COM o gabarito (o
 * professor o vê). Os seletores são CONTRATO com a experiência
 * (`apps/experiencias/exp02em1b/src/lib/textos.ts`) e com o hub
 * (`atividades/nova/criar-efeito-amplificador.tsx`,
 * `resultados/painel-da-aula-efeito-amplificador.tsx`,
 * `components/instrucao-da-experiencia.tsx`).
 */

const SERIE = "2EM";
const EXP_ID = "exp02em1b";
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;
const FICHA = `${HUB}/professor/entre-redes/2-serie/unidade-1`;

/** A copy da tela (`src/lib/textos.ts`) e da api (`conteudo.ts`) — literal. */
const COPY = {
  abrir: "Abrir UnooriaAI",
  sugestoes: [
    "Criar rascunho informativo sobre o tema",
    "Qual a fonte dessa pesquisa?",
    "Reescreva removendo os nomes pessoais e citando o autor original",
  ],
  placeholder: "Digite sua mensagem ou solicite ajustes no texto...",
  previa: "Prévia do Post",
  pendencias: {
    fonte: "Fonte não verificada identificada no texto",
    autoria: "Trecho com semelhança literal sem atribuição autoral",
    privacidade: "Dados pessoais sensíveis identificados sem consentimento",
  },
  aprovar: "Aprovar Prévia",
  exportar: "Exportar para o Unoovista",
  fechamento: "Fechamento Editorial da Campanha",
  publicar: "Publicar no Unoovista",
  relogio: [
    "Hoje, 16h00 · Publicação enviada ao feed",
    "Hoje, 23h45 · Início das notificações automáticas",
    "Madrugada, 02h30 · Pico de distribuição do algoritmo",
  ],
  hora: "02h30 · Madrugada",
  metrica: "4.820 impressões entre 01h00 e 03h30",
  tc10: "Você é moderador do perfil do grêmio estudantil no Unoovista. O post sobre",
  fixarAviso: "Fixar aviso de cuidado",
  motivoSaude: "Conteúdo pode afetar a saúde de quem lê",
  bannerSaude: "Aviso fixado: Conteúdo pode afetar a saúde de quem lê",
  configuracao: "Configuração da Publicação",
  privada: "Ajustar privacidade para conta privada",
  restringir: "Restringir comentários a seguidores conhecidos",
  central: "Central de Apoio",
  denunciar: "Denunciar perfil",
  denunciaConfirmar: "Deseja reportar esta conta por atividade abusiva e mensagens invasivas fora do horário escolar?",
  denunciado: "Perfil suspeito denunciado à moderação do sistema.",
  encaminhar: "Encaminhar relato",
  destinoEscola: "Equipe de apoio da escola: acolhimento e acompanhamento dos estudantes",
  encaminhadoEscola: "Relato encaminhado à equipe de apoio da escola",
  pausa: "Aguardando a liberação do orientador do grêmio para avançar para a próxima fase...",
  bastidores: "Bastidores da Distribuição: Relatório Analítico",
  citacao: "O objetivo não é a qualidade da informação, mas o engajamento",
  avancar: "Avançar",
  esperaTitulo: "Enquanto a turma conclui...",
  concluir: "Concluir missão",
  selo: "Missão concluída",
  transcricao: "Ler a transcrição",
  transcricaoTitulo: "Transcrição do episódio",
};

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
    subtitulo: "a atividade criada com IA antes da aula, o UnooriaAI sem IA na aula, o feed das 02h30 e os dois botões da professora",
    contexto:
      "O estudante é o moderador do perfil do grêmio: cria com o UnooriaAI o post da campanha, audita o rascunho — " +
      "uma fonte inventada, um trecho copiado e um colega exposto — e publica no Unoovista. O relógio salta até " +
      "as 02h30, a rede destaca uma frase e o feed vira crise. A professora pausa as telas para o debate e " +
      "avança a turma para o Explicar, onde o estudante vê os bastidores da entrega.",
    prova: [
      "A professora cria a atividade com um tema próprio, o Vertex escreve o pacote (origem ia), ela homologa e põe no ar",
      "O estudante vê a pauta do pacote e abre o UnooriaAI com as três sugestões da copy",
      "Perguntar a fonte NÃO corrige o dado; o “sim” corrige; o TC-03 corrige autoria e privacidade — sem IA na aula",
      "A prévia mostra as pendências; aprovar, exportar e publicar com uma das três manchetes é definitivo",
      "O relógio salta até 02h30 e o feed da madrugada abre sem barra de abas, com o TC-10 FORA do aparelho",
      "Aviso de cuidado com o motivo de saúde, as chaves da publicação, a denúncia e o relato à escola",
      "A sessão do estudante não carrega o gabarito (categoria do comentário, nós do rascunho)",
      "O painel de condução tem os quatro cartões; a pausa congela a tela; o avanço abre os bastidores",
      "A conclusão traz a transcrição do podcast e nenhuma transferência (sem diário, sem reflexão)",
      "O painel de habilidades mostra EM13CO24, EM13CO14, EM13CO26 e EM13CO08 com o nível do estudante",
    ],
    comando: "node scripts/e2e/estudante/04-efeito-amplificador.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { turma: TURMA, serie: SERIE });
    const professora =
      contasDe("professor").find((c) => c.escola === estudante.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSORA: a ficha e a criação com a IA ══════════════════════════
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
      mostra: "O Efeito Amplificador na trilha: a missão, o aviso de que ela só abre com atividade em andamento e a lista de atividades.",
      prova: "A ficha da unidade é da missão 2.1.0; a Tempestade é versão anterior, fora do catálogo.",
    });

    await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
    const passo = prof.locator("[data-passo-conteudo]");
    await passo.locator("[data-recorte-da-aula]").waitFor({ timeout: 30_000 });
    const disciplina = passo.getByRole("combobox", { name: /^Componente Curricular BNCC/i });
    await hidratado(prof, disciplina);
    await disciplina.click();
    await prof.getByRole("option", { name: RECORTE.disciplina, exact: true }).first().click();
    const tema = passo.getByRole("textbox", { name: /^Tema da Campanha/i });
    await tema.click();
    await tema.pressSequentially(RECORTE.tema);
    const topicos = passo.getByRole("textbox", { name: /^Tópicos da Aula/i });
    await topicos.click();
    await topicos.pressSequentially(RECORTE.topicos.join("\n"));
    await r.registrar(prof, "configuracao-pedagogica", {
      titulo: "A Configuração Pedagógica da Missão",
      mostra: `Biologia, o tema “${RECORTE.tema}” e três tópicos da aula — e os dois caminhos: o pacote padrão oficial ou Gerar Pacote com IA.`,
      prova: "A missão é customizável: a pauta, o rascunho, os nomes e os comentários vão ser escritos para esta aula.",
    });

    await passo.locator('[data-acao="gerar-conteudo"]').click();
    const curadoria = passo.locator("[data-curadoria]");
    const desfecho = await primeiroQueAparecer(
      {
        curadoria,
        contingencia: passo.locator("[data-contingencia]"),
        falha: passo.locator(ALERTA_DE_ERRO),
      },
      { timeout: 180_000, oQue: "a geração do pacote com IA" },
    );
    if (desfecho !== "curadoria") {
      const aviso = (await passo.locator(`[data-contingencia], ${ALERTA_DE_ERRO}`).first().innerText()).replace(/\s+/g, " ");
      r.exigir(false, `a IA REAL gerou o pacote (a tela respondeu: “${aviso.slice(0, 220)}”)`);
      return;
    }
    r.exigir((await curadoria.innerText()).includes("Gerado com IA"), "a curadoria mostra o pacote “Gerado com IA” (o Vertex respondeu)");
    await curadoria.scrollIntoViewIfNeeded();
    await r.registrar(prof, "curadoria-da-ia", {
      titulo: "A Homologação do Pacote de Conteúdo",
      mostra: "A pauta, o rascunho com os três problemas e a correção de cada um, os nomes citados, as três manchetes e os comentários da madrugada — tudo editável.",
      prova: "O Vertex escreveu para o tema da professora (Gerado com IA); a curadoria humana vem antes de a turma ver qualquer coisa.",
      inteira: true,
    });

    await passo.locator('[data-acao="homologar-conteudo"]').click();
    await esperarOuFalharCedo(passo.locator('[data-fase="ativacao"]'), passo.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "Homologar Conteúdo",
    });
    await passo.locator('[data-fase="ativacao"]').getByText(RECORTE.tema, { exact: false }).first().waitFor({ timeout: 10_000 });
    await r.registrar(prof, "ativacao-da-turma", {
      titulo: "A Ativação da Turma",
      mostra: "O pacote homologado, com a turma e o tema, à espera do último passo do assistente.",
      prova: "Homologar grava a atividade PRONTA; quem a põe no ar é o “Iniciar Atividade com a Turma”.",
    });

    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').waitFor({ timeout: 10_000 });
    await prof.locator('[data-acao="continuar-criacao"]').click();
    await prof.getByRole("radio", { name: "Um aluno por computador", exact: true }).click();
    await prof.locator('[data-acao="continuar-criacao"]').click();
    const revisao = prof.locator("[data-revisao-da-criacao]");
    await revisao.waitFor({ timeout: 10_000 });
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    r.exigir(await noAr.isChecked(), "“Pôr esta atividade no ar agora” fica ligado");
    const iniciar = prof.locator('[data-acao="criar-atividade"]');
    r.exigir(
      (await iniciar.innerText()).includes("Iniciar Atividade com a Turma"),
      "o botão final do assistente diz “Iniciar Atividade com a Turma”",
    );
    await iniciar.click();
    await esperarOuFalharCedo(
      prof.locator('[data-estado-da-atividade="em-andamento"]'),
      revisao.locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`),
      { timeout: 60_000, oQue: "pôr a atividade no ar" },
    );
    const paginaDaAtividade = prof.url();
    const atividadeId = (await lerApi(prof, `${daTurma}/pacotes`)).corpo?.emAndamento?.pacoteId;
    const detalhe = (await lerApi(prof, `${daTurma}/pacotes/${atividadeId}`)).corpo;
    if (
      !r.exigir(
        detalhe?.origem === "ia" && detalhe?.tema === RECORTE.tema,
        `a atividade EM ANDAMENTO é a da IA, com o tema da professora (origem ${detalhe?.origem}, “${detalhe?.tema}”)`,
      )
    )
      return;
    const k = detalhe.conteudo;
    await r.registrar(prof, "atividade-da-ia-no-ar", {
      titulo: "A atividade da IA, em andamento",
      mostra: "A página da atividade criada agora: o tema da professora, em andamento, com o painel da aula.",
      prova: `Origem “ia”: o instituto é “${k.fonteInventada}”, o colega “${k.colega}” e a autoria “${k.fonteOriginal}” — nada do banco padrão.`,
    });

    // ═══ ESTUDANTE: a pauta e o UnooriaAI ══════════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login, senhaDe(estudante));
    await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    const q = p.frameLocator("iframe[data-experiencia]");
    await esperarOuFalharPorHttp(p, q.getByRole("button", { name: COPY.abrir }), /efeito-amplificador\/sessao/, {
      timeout: 40_000,
      oQue: "o boot da missão",
    });
    await q.getByText(k.pauta.titulo, { exact: true }).first().waitFor({ timeout: 10_000 });
    await r.registrar(p, "pauta-do-gremio", {
      titulo: "A pauta da semana",
      mostra: "Já no UnooriaAI: a Campanha Institucional do Grêmio, a pauta escrita para o tema da professora e o Abrir UnooriaAI.",
      prova: `A pauta vem do pacote homologado (“${k.pauta.titulo}”), não da tela: a missão abre porque há atividade em andamento.`,
    });

    await q.getByRole("button", { name: COPY.abrir }).click();
    for (const s of COPY.sugestoes) await q.getByRole("button", { name: s, exact: true }).waitFor({ timeout: 20_000 });
    await r.registrar(p, "tres-sugestoes", {
      titulo: "O UnooriaAI e as três sugestões",
      mostra: "A boas-vindas do assistente editorial e as três sugestões da copy: o rascunho, a fonte (TC-02) e o direito digital (TC-03).",
      prova: "As sugestões são a copy literal; o estudante pode tocar nelas ou escrever o próprio pedido.",
    });

    /**
     * Uma fala ao UnooriaAI — pela sugestão (toque) ou pelo campo (texto).
     * Espera a resposta do POST e devolve o estado que a api mandou; a fala da
     * árvore tem de aparecer na tela. Sem IA na aula: a resposta é imediata.
     */
    const falar = async ({ sugestao, texto }) => {
      const resposta = p.waitForResponse(
        (x) => x.url().includes("/efeito-amplificador/chat/mensagem") && x.request().method() === "POST",
        { timeout: 30_000 },
      );
      if (sugestao) {
        await q.getByRole("button", { name: sugestao, exact: true }).click();
      } else {
        const campo = q.getByPlaceholder(COPY.placeholder);
        await campo.fill(texto);
        await campo.press("Enter");
      }
      const http = await resposta;
      const estado = await http.json().catch(() => null);
      const fala = [...(estado?.conversa?.mensagens ?? [])].reverse().find((m) => m.papel === "assistente")?.texto ?? "";
      if (http.status() === 200 && fala) await q.getByText(fala, { exact: true }).last().waitFor({ timeout: 10_000 });
      return { status: http.status(), estado, fala };
    };

    const m1 = await falar({ sugestao: COPY.sugestoes[0] });
    r.exigir(m1.status === 200 && m1.estado?.previa?.gerada === true, `a 1ª sugestão gera o rascunho (HTTP ${m1.status})`);
    r.exigir(m1.fala.startsWith("Aqui está uma primeira proposta:"), `o UnooriaAI responde com a fala do rascunho: “${m1.fala.slice(0, 90)}”`);
    await r.registrar(p, "rascunho-gerado", {
      titulo: "O rascunho gerado",
      mostra: "A primeira proposta do UnooriaAI e o botão Prévia do Post no topo do app.",
      prova: "A resposta é da árvore de intenções do servidor, sem IA na aula: o rascunho é o do pacote homologado.",
    });

    const m2 = await falar({ sugestao: COPY.sugestoes[1] });
    const pend2 = m2.estado?.previa?.pendencias;
    r.exigir(
      m2.status === 200 && m2.fala.includes(k.fonteInventada) && m2.fala.endsWith("Deseja que eu atualize a prévia?"),
      `perguntar a fonte nomeia “${k.fonteInventada}” e OFERECE atualizar a prévia`,
    );
    r.exigir(pend2?.fonte === true, "perguntar a fonte NÃO corrige o dado (a pendência da fonte continua)");
    await q.getByRole("button", { name: new RegExp(COPY.previa) }).click();
    await q.getByText(COPY.pendencias.fonte, { exact: true }).waitFor({ timeout: 10_000 });
    for (const t of [COPY.pendencias.autoria, COPY.pendencias.privacidade]) await q.getByText(t, { exact: true }).waitFor({ timeout: 5_000 });
    await r.registrar(p, "previa-com-pendencias", {
      titulo: "A Prévia do Post, com as três pendências",
      mostra: "O texto como está e os três avisos: fonte não verificada, trecho sem atribuição autoral e dados pessoais sem consentimento.",
      prova: "Perguntar a fonte só pergunta: o aviso “Fonte não verificada identificada no texto” continua na gaveta.",
    });
    await q.getByRole("button", { name: "Fechar", exact: true }).click();
    await q.getByPlaceholder(COPY.placeholder).waitFor({ timeout: 10_000 });

    const m3 = await falar({ texto: "sim" });
    r.exigir(
      m3.status === 200 && m3.estado?.previa?.pendencias?.fonte === false && m3.fala.startsWith("Atualizei a prévia"),
      `o “sim” à oferta corrige a estatística (pendência da fonte: ${m3.estado?.previa?.pendencias?.fonte})`,
    );
    const m4 = await falar({ sugestao: COPY.sugestoes[2] });
    const pend4 = m4.estado?.previa?.pendencias;
    r.exigir(
      m4.status === 200 && pend4?.autoria === false && pend4?.privacidade === false,
      `o TC-03 corrige autoria e privacidade de uma vez (autoria ${pend4?.autoria}, privacidade ${pend4?.privacidade})`,
    );
    r.exigir(m4.estado?.conversa?.restantes === 1, `o chat conta as mensagens: resta 1 de 5 (${m4.estado?.conversa?.restantes})`);
    await r.registrar(p, "auditoria-no-unooriaai", {
      titulo: "A auditoria do rascunho",
      mostra: "A fonte questionada, o “sim” que troca o dado e o pedido do TC-03: crédito à autoria e o colega anonimizado.",
      prova: "O servidor decide pela intenção: a pergunta não corrige, o aceite e o pedido de direito digital sim.",
    });

    const sessao = await lerApi(p, "/efeito-amplificador/sessao");
    const sessaoTexto = JSON.stringify(sessao.corpo ?? {});
    r.exigir(
      sessao.status === 200 && !/"tipo":|saude_fisica|saude_mental|"no":|"alucinacao"|"plagio"|"lgpd"/.test(sessaoTexto),
      "GET /efeito-amplificador/sessao não traz o gabarito: nem a categoria dos comentários, nem os nós do rascunho",
    );

    await q.getByRole("button", { name: new RegExp(COPY.previa) }).click();
    await q.getByRole("button", { name: COPY.aprovar, exact: true }).waitFor({ timeout: 10_000 });
    r.exigir(
      (await q.locator(".uai-pendencias").count()) === 0,
      "com os três problemas resolvidos, a gaveta não mostra pendência nenhuma",
    );
    await r.registrar(p, "previa-pronta", {
      titulo: "A prévia corrigida",
      mostra: "O texto final, sem avisos, com Solicitar revisão e Aprovar Prévia.",
      prova: "Aprovar não é obrigatório nem trava por pendência: o dilema é do estudante, e a régua mede o Publicar.",
    });
    const aprovou = p.waitForResponse((x) => x.url().includes("/efeito-amplificador/previa") && x.request().method() === "POST");
    await q.getByRole("button", { name: COPY.aprovar, exact: true }).click();
    r.exigir((await aprovou).status() === 200, "Aprovar Prévia grava a aprovação (POST /previa)");
    await q.getByRole("button", { name: new RegExp(COPY.exportar) }).click();
    const fechamento = q.getByRole("dialog", { name: COPY.fechamento });
    await fechamento.waitFor({ timeout: 10_000 });
    const radios = fechamento.getByRole("radio");
    r.exigir((await radios.count()) === 3, `o Fechamento Editorial traz as três manchetes (${await radios.count()})`);
    const publicar = fechamento.getByRole("button", { name: COPY.publicar, exact: true });
    r.exigir(await publicar.isDisabled(), "o Publicar no Unoovista só acende depois de escolher a manchete");
    await radios.filter({ hasText: k.manchetes.neutra }).click();
    await r.registrar(p, "fechamento-editorial", {
      titulo: "O Fechamento Editorial da Campanha",
      mostra: "As três manchetes do pacote — neutra, construtiva, sensacionalista — com a neutra escolhida, e o Publicar no Unoovista.",
      prova: "A aposta: a manchete mais equilibrada, esperando uma circulação construtiva.",
    });

    // ═══ ESTUDANTE: o relógio e o feed da madrugada ════════════════════════
    const marcos = COPY.relogio.map((m) => q.getByText(m, { exact: true }).waitFor({ timeout: 15_000 }).then(() => true));
    await publicar.click();
    await q.getByText(COPY.relogio[1], { exact: true }).waitFor({ timeout: 15_000 });
    await r.registrar(p, "relogio-ate-a-madrugada", {
      titulo: "O relógio salta para a madrugada",
      mostra: "16h00, 23h45, 02h30: a passagem do tempo depois do Publicar.",
      prova: "O estudante sente o tempo correr antes de ver o feed; o salto toca uma vez por aba.",
    });
    const viuOsMarcos = await Promise.all(marcos).catch(() => false);
    r.exigir(viuOsMarcos !== false, "os três marcos do relógio aparecem (16h00 → 23h45 → 02h30)");

    await q.getByText(COPY.hora, { exact: true }).waitFor({ timeout: 15_000 });
    const publicada = await lerApi(p, "/efeito-amplificador/sessao");
    const pub = publicada.corpo?.publicacao;
    r.exigir(pub?.manchete?.id === "neutra", `a publicação saiu com a manchete escolhida (${pub?.manchete?.id})`);
    r.exigir(pub?.trechoPincado === k.recorte, "a rede destaca a frase pinçada do pacote mesmo no post cuidadoso");
    const outra = await mandarApi(p, "/efeito-amplificador/publicar", { manchete: "sensacionalista" });
    r.exigir(outra.status === 409, `Publicar é definitivo: outra manchete depois responde 409 (${outra.status} ${outra.corpo?.codigo ?? ""})`);
    await q.getByText(`“${k.recorte}”`, { exact: true }).waitFor({ timeout: 10_000 });
    await q.getByText(COPY.metrica, { exact: true }).waitFor({ timeout: 10_000 });
    const comentariosNaTela = await q.locator(".unv-comentarios li, .unv-comentarios [class*='list-item']").count();
    r.exigir(
      (await q.getByText(k.comentarios[0].texto, { exact: true }).count()) >= 1,
      `os comentários da madrugada do pacote aparecem (${comentariosNaTela} na lista)`,
    );
    r.exigir((await q.locator(".unv-tab-bar, [role='tablist']").count()) === 0, "o feed da madrugada não tem barra de abas");

    /* O TC-10 é chrome do HUB: o aside fica na página, fora do iframe, com o tema destacado. */
    const aside = p.locator('aside[data-testid="instrucao-da-experiencia"]');
    await aside.waitFor({ timeout: 15_000 });
    const textoDoAside = (await aside.innerText()).replace(/\s+/g, " ");
    r.exigir(textoDoAside.startsWith(COPY.tc10), "a instrução do moderador (TC-10) está no hub, ao lado do aparelho");
    r.exigir(
      (await aside.locator("mark").innerText()).trim() === RECORTE.tema,
      `o tema da professora vem destacado na instrução (“${RECORTE.tema}”)`,
    );
    r.exigir((await q.getByText(COPY.tc10).count()) === 0, "o TC-10 NÃO está dentro do aparelho (iframe)");
    const caixaDoAside = await aside.boundingBox();
    const caixaDoIframe = await p.locator("iframe[data-experiencia]").boundingBox();
    r.exigir(
      Boolean(caixaDoAside && caixaDoIframe && caixaDoAside.x >= caixaDoIframe.x + caixaDoIframe.width - 1),
      "em tela larga, a instrução fica à direita do aparelho, sem sobrepor",
    );
    await r.registrar(p, "feed-da-madrugada", {
      titulo: "O feed das 02h30, e a instrução do moderador",
      mostra: "02h30 · Madrugada, a frase pinçada em destaque, 4.820 impressões, o alerta de metadados e os comentários — e, fora do aparelho, o TC-10 com o tema da professora.",
      prova: "A entrega é a mesma para todo post: o incentivo é da rede, não do texto. A instrução é do hub, não do clone.",
    });

    /* E4-ALU-02 — o aviso de cuidado com o motivo de saúde. */
    const folha = q.locator(".unv-bottom-sheet--modal");
    await q.getByRole("button", { name: COPY.fixarAviso, exact: true }).click();
    await folha.getByRole("radio", { name: COPY.motivoSaude }).click();
    await r.registrar(p, "aviso-de-cuidado", {
      titulo: "Fixar aviso de cuidado",
      mostra: "Os três motivos — saúde de quem lê, informação sem fonte, conteúdo ofensivo — com o de saúde escolhido.",
      prova: "Nada na tela diz qual motivo mede o quê: é o gesto do estudante que a EM13CO24 lê.",
    });
    await folha.getByRole("button", { name: COPY.fixarAviso, exact: true }).click();
    await q.getByText(COPY.bannerSaude, { exact: true }).waitFor({ timeout: 10_000 });

    /* E4-ALU-04 — a Configuração da Publicação. */
    await q.getByRole("button", { name: COPY.configuracao, exact: true }).click();
    const privada = folha.getByRole("switch", { name: COPY.privada });
    const restringir = folha.getByRole("switch", { name: COPY.restringir });
    await privada.waitFor({ timeout: 10_000 });
    r.exigir((await privada.getAttribute("aria-checked")) === "false", "as chaves da publicação começam desligadas");
    await privada.click();
    await folha.locator(`[role="switch"][aria-checked="true"]`).first().waitFor({ timeout: 10_000 });
    await restringir.click();
    await folha.locator(`[role="switch"][aria-checked="true"]`).nth(1).waitFor({ timeout: 10_000 });
    await r.registrar(p, "configuracao-da-publicacao", {
      titulo: "A Configuração da Publicação",
      mostra: "Conta privada e comentários restritos a seguidores conhecidos, as duas chaves ativadas.",
      prova: "A chave é o gesto de preservar a privacidade — um dos três comportamentos protetivos da EM13CO08.",
    });
    await folha.getByRole("button", { name: "Fechar", exact: true }).click();
    await folha.waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});

    /* E4-ALU-03 — a Central de Apoio: denunciar o perfil e encaminhar o relato. */
    await q.getByRole("button", { name: COPY.central, exact: true }).click();
    await folha.getByText(COPY.denunciar, { exact: true }).click();
    await q.getByText(COPY.denunciaConfirmar).waitFor({ timeout: 10_000 });
    await r.registrar(p, "denuncia-confirmacao", {
      titulo: "Denunciar a conta suspeita",
      mostra: "A confirmação da denúncia, com o perfil invasivo e o horário do comentário.",
      prova: "O perfil vem da sessão só com o nome e o comentário: a categoria do comentário não desce ao estudante.",
    });
    await q.getByRole("button", { name: COPY.denunciar, exact: true }).last().click();
    await q.getByText(COPY.denunciado).first().waitFor({ timeout: 10_000 });
    await folha.getByText(COPY.encaminhar, { exact: true }).click();
    const doRelato = k.comentarios.find((c) => c.tipo === "saude_mental") ?? k.comentarios[0];
    await folha.getByRole("radio", { name: new RegExp(`^${doRelato.autor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`) }).click();
    await folha.getByRole("radio", { name: COPY.destinoEscola }).click();
    await r.registrar(p, "central-de-apoio-relato", {
      titulo: "A Central de Apoio: o relato",
      mostra: "O comentário de um colega afetado escolhido como relato, e a equipe de apoio da escola como destino.",
      prova: "O grêmio não resolve sozinho: o estudante busca apoio dentro do Unoovista, por vontade própria.",
    });
    await folha.getByRole("button", { name: COPY.encaminhar, exact: true }).click();
    await q.getByText(COPY.encaminhadoEscola, { exact: true }).waitFor({ timeout: 10_000 });
    await r.registrar(p, "relato-encaminhado", {
      titulo: "Relato encaminhado",
      mostra: "“Relato encaminhado à equipe de apoio da escola”.",
      prova: "Denunciar, encaminhar e a chave de privacidade: os três comportamentos protetivos da EM13CO08.",
    });
    await folha.getByRole("button", { name: "Fechar", exact: true }).click();
    const feedAgora = (await lerApi(p, "/efeito-amplificador/sessao")).corpo?.feed;
    r.exigir(
      feedAgora?.aviso === "saude_usuarios" && feedAgora?.contaPrivada && feedAgora?.restringirComentarios && feedAgora?.denunciou && feedAgora?.relatos?.length === 1,
      "o servidor registrou o aviso de saúde, as duas chaves, a denúncia e o relato",
    );

    // ═══ PROFESSORA: o painel de condução, a pausa e o Explicar ════════════
    await prof.goto(paginaDaAtividade, { waitUntil: "domcontentloaded" });
    const painel = prof.locator("[data-painel-da-aula]");
    await revelar(prof, painel);
    await painel.waitFor({ timeout: 30_000 });
    for (const cartao of ["data-balanco-editorial", "data-distribuicao-horaria", "data-monitor-de-ritmo", "data-matriz-de-evidencias"]) {
      r.exigir((await painel.locator(`[${cartao}]`).count()) === 1, `o painel de condução tem o cartão [${cartao}]`);
    }
    await painel.locator("[data-monitor-de-ritmo]").getByText(estudante.nome).first().waitFor({ timeout: 20_000 });
    await r.registrar(prof, "painel-de-conducao", {
      titulo: "O Painel de Condução em Tempo Real",
      mostra: "Balanço Editorial, Distribuição Horária Coletiva, Monitor de Ritmo e Inatividade e a Matriz Consolidada de Evidências — e os dois botões da aula.",
      prova: "A lousa é agregada (sem nomes); o monitor é nominal, mas só mostra o passo e a manchete, nunca o chat.",
      inteira: true,
    });

    const botoes = prof.locator("[data-botoes-da-aula]");
    await botoes.getByRole("button", { name: "Pausar Telas para Debate" }).click();
    const dialogoPausa = prof.getByRole("dialog", { name: "Pausar as telas para o debate?" });
    await dialogoPausa.waitFor({ timeout: 10_000 });
    await dialogoPausa.getByRole("button", { name: "Pausar Telas para Debate" }).click();
    await dialogoPausa.waitFor({ state: "hidden", timeout: 15_000 });
    await q.getByText(COPY.pausa, { exact: true }).waitFor({ timeout: 20_000 });
    await r.registrar(p, "telas-pausadas", {
      titulo: "As telas pausadas",
      mostra: "A espera na voz da ficção, por cima do feed: o orientador do grêmio vai liberar a próxima fase.",
      prova: "A pausa chega ao aparelho pelo polling de 3 s, sem recarregar; o que está embaixo fica inerte.",
    });
    const congelada = await mandarApi(p, "/efeito-amplificador/aviso-cuidado", { motivo: "saude_usuarios" });
    r.exigir(congelada.status === 409, `com as telas pausadas, a jogada responde 409 (${congelada.status} ${congelada.corpo?.codigo ?? ""})`);

    await botoes.getByRole("button", { name: "Avançar Turma para Explicar" }).click();
    const dialogoExplicar = prof.getByRole("dialog", { name: "Avançar a turma para o Explicar?" });
    await dialogoExplicar.waitFor({ timeout: 10_000 });
    await dialogoExplicar.getByRole("button", { name: "Avançar Turma para Explicar" }).click();
    await dialogoExplicar.waitFor({ state: "hidden", timeout: 15_000 });

    // ═══ ESTUDANTE: os bastidores e a conclusão ════════════════════════════
    await q.getByText(COPY.bastidores, { exact: true }).first().waitFor({ timeout: 25_000 });
    r.exigir((await p.locator('aside[data-testid="instrucao-da-experiencia"]').count()) === 0, "fora do feed, a instrução do moderador sai do hub");
    await q.getByText("Horário de Pico", { exact: true }).click();
    await q.getByText(COPY.citacao, { exact: false }).waitFor({ timeout: 10_000 });
    await r.registrar(p, "bastidores-da-entrega", {
      titulo: "Os bastidores da distribuição",
      mostra: "Os dois cartões — Horário de Pico e Métrica de Retenção —, a citação de Nico ao apontar um deles e os conceitos.",
      prova: "O Avançar nunca trava: apontar o cartão abre a citação, mas o clique não é habilidade (PRD RF-007).",
    });
    await q.getByRole("button", { name: COPY.avancar, exact: true }).click();
    await q.getByText(COPY.esperaTitulo, { exact: true }).waitFor({ timeout: 10_000 });
    await r.registrar(p, "espera-ativa", {
      titulo: "Enquanto a turma conclui",
      mostra: "O gráfico exploratório das impressões por faixa de horário, e o Concluir missão.",
      prova: "A espera é ativa: o estudante explora a curva de entrega enquanto os colegas terminam.",
    });
    await q.getByRole("button", { name: COPY.concluir, exact: true }).click();
    await q.getByRole("heading", { name: COPY.selo }).waitFor({ timeout: 15_000 });
    await q.getByText(COPY.transcricao, { exact: true }).click();
    await q.getByText(COPY.transcricaoTitulo, { exact: true }).waitFor({ timeout: 10_000 });
    const podcast = publicada.corpo?.textos?.podcast;
    const primeiraFala = podcast?.blocos?.[0]?.falas?.[0]?.texto ?? "";
    r.exigir(Boolean(primeiraFala) && (await q.getByText(primeiraFala, { exact: false }).count()) >= 1, "a transcrição do podcast aparece na tela");
    const textoFinal = await q.locator("body").innerText();
    r.exigir(
      !/streaming de áudio|Diário de Bordo/i.test(textoFinal) &&
        (await q.locator("textarea, input[type='text'], [contenteditable='true']").count()) === 0,
      "sem caso de transferência: nem “streaming de áudio”, nem Diário de Bordo, nem campo de reflexão",
    );
    await r.registrar(p, "missao-concluida", {
      titulo: "Missão concluída, com o podcast",
      mostra: "O selo, o cartão do podcast O Algoritmo Não Dorme e a transcrição do episódio aberta.",
      prova: "A transferência saiu desta versão (ADR-191): o fim é somente leitura, e o áudio é tocado em aula pelo professor.",
    });
    const fim = (await lerApi(p, "/efeito-amplificador/sessao")).corpo;
    r.exigir(fim?.concluido === true && fim?.passo === "concluida", `a sessão fecha concluída (passo ${fim?.passo})`);

    // ═══ PROFESSORA: as habilidades ════════════════════════════════════════
    const evidencia = (await lerApi(prof, `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`)).corpo;
    const doEstudante = evidencia?.estudantes?.find((x) => x.nome === estudante.nome);
    const statusDe = (codigo) => Object.values(doEstudante?.porRodada ?? {}).map((rodada) => rodada?.[codigo]?.status).find(Boolean) ?? null;
    const CODIGOS = ["EM13CO24", "EM13CO14", "EM13CO26", "EM13CO08"];
    r.exigir(
      CODIGOS.every((c) => statusDe(c) === "atingiu"),
      `a evidência (E14) dá “atingiu” nas quatro (${CODIGOS.map((c) => `${c} ${statusDe(c)}`).join(", ")})`,
    );
    await prof.reload({ waitUntil: "domcontentloaded" });
    const habilidades = prof.locator("[data-habilidades-efeito-amplificador]");
    await revelar(prof, habilidades);
    await habilidades.waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await habilidades.innerText();
    for (const codigo of CODIGOS) r.exigir(textoDasHabilidades.includes(codigo), `o painel de habilidades traz ${codigo}`);
    r.exigir(textoDasHabilidades.includes(estudante.nome), `o painel de habilidades traz ${estudante.nome}`);
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "As habilidades da BNCC",
      mostra: "EM13CO24, EM13CO14, EM13CO26 e EM13CO08, com o nível que a régua deu ao estudante.",
      prova: "Só Canal A: tudo foi medido pelo que o estudante fez — o aviso, a auditoria, o direito digital e a proteção.",
      inteira: true,
    });
  },
);
