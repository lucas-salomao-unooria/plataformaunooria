import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";
import { esperarFalasDoTema, provarFalasNaCriacao, provarPodcastNaAula } from "../lib/podcast.mjs";

/**
 * O Júri Estadual de Projetos (exp06ef1b 0.5.0, PRD v2 com os 40 projetos de
 * 2026-10-14 — 6º ano, unidade 1), nas três pontas da sala: a professora
 * prepara e conduz, e dois estudantes da mesma turma julgam a mesma mostra —
 * um curte, o outro não.
 *
 * O que esta suíte cobra, e por que cada item é uma regra do software:
 *
 * 1. **Dois caminhos de preparo** (PRD v2, E0-PROF-01/02): a mostra
 *    personalizada pela IA REAL (Vertex) — parametrizar, gerar (cinco chamadas
 *    na api, ~42 s; a espera vai até o teto do BFF, correndo contra a falha),
 *    ver os 40 estandes na curadoria, uma ABA por área, e as falas do
 *    podcast — e o caminho curto "Usar Banco Padrão Oficial", sem IA, que é o
 *    que vai ao ar para a turma. A turma roda no banco padrão de propósito: as
 *    quatro áreas e as hashtags são as do PRD, e a prova do afunilamento não
 *    depende do que a IA escreveu. A geração por IA NÃO tem fixture: falhou, a
 *    verificação reprova (memória "Teste sempre com IA real") e a suíte segue
 *    pelo banco padrão.
 *    **As abas do DS só renderizam a aba aberta**: contar `[data-estande]` na
 *    página conta UMA área. Os 40 se provam percorrendo as quatro abas
 *    (`percorrerAbas`), na curadoria, na grade de imagens e na página da
 *    atividade.
 * 2. **O crachá é um modal sobre a timeline desfocada**, e a TopBar do
 *    Unoovista traz `@jurado_oficial` em toda tela do clone; a barra tem as
 *    QUATRO abas da copy (Início, Busca, Notificações, Jurado), e a Busca está
 *    fechada durante o julgamento (responde com o aviso, como comentar). O
 *    carrossel tem três fotos e, na 4ª lâmina, os "Bastidores do estande" —
 *    que até a 0.4.x era um post à parte.
 * 3. **O afunilamento sem repetição** (instrumento 3.0.0): dez posts, todos
 *    apresentação, dez projetos DISTINTOS. Quem curte cedo recebe os posts 5 a
 *    10 só da área curtida — projetos NOVOS dela (7/1/1/1); quem não curte vê
 *    as quatro misturadas (3/3/2/2). Os dois ficam com 30 de 40 fora do feed: o
 *    que muda é QUAIS áreas sumiram — os números são da api, nunca da copy.
 * 4. **Salvar não pesa** (melhoria 6): o segundo estudante salva três posts e
 *    o feed dele segue variado (3/3/2/2).
 * 5. **A cédula tem quatro elementos** — o título, os projetos do feed, a
 *    certeza ("Sim"/"Com certeza") e o botão —, sem justificativa nem frase
 *    grifada. Parado 60 s com ela aberta, o aviso da comissão acende NO TOPO
 *    dela (`role="alert"`), e o painel da professora põe o ícone de ocioso ao
 *    lado do nome (o batimento de 15 s, melhoria 8).
 * 6. **O lacre e a espera**: o carimbo com o protocolo, e a plenária com três
 *    elementos (brasão, carimbo, ordem). O F5 volta à espera.
 * 7. **Um botão só** ("Liberar Auditoria"), e ele não volta. Não há rodada de
 *    desvio (saiu com a melhoria 6). A lousa só mostra a CONCENTRAÇÃO do feed
 *    (quem curtiu × quem não curtiu, os dois `MetricCard`) depois dele: no pico
 *    ela entregaria que o feed se adaptou.
 * 8. **A Galeria Oculta**: "30 de 40 estandes nunca chegaram ao seu feed" —
 *    IGUAL para quem curtiu e para quem não curtiu —, e logo abaixo a busca:
 *    a contagem por área e o contraste "sem as suas curtidas" SAÍRAM da tela
 *    (ADR-176), e a api continua os calculando (a suíte prova os números pela
 *    api). A grade dos ocultos é de UMA área, a do chip
 *    (abre na que mais ficou fora, e só o TOQUE no chip conta como busca), com
 *    três colunas; a busca por texto, a ficha de auditoria e a revisão de DOIS
 *    botões — "Manter meu voto inicial" só acende depois de abrir um oculto, e
 *    a troca filtra os estandes por área. O F5 depois da revisão não reabre a
 *    galeria.
 * 9. **A regra SE … ENTÃO (EF06CO03, ADR-174), da escola**: o Léo, as duas
 *    escolhas (três peças cada, sem a certa), uma tentativa só e a revelação
 *    ligada ao feed de cada um; o primeiro acerta as duas, o segundo uma.
 * 10. **A regra CONCLUI** (ADR-176: o caso Mariana saiu): "Concluir o
 *    Julgamento" leva ao fim com a faixa da Unooria (o infográfico "Como os
 *    robôs leem nossas curtidas").
 * 13. **As PASTAS do salvar** (EF06CO01, ADR-176): no feed, "Salvar
 *    publicação" abre "Salvar em" com as quatro pastas da mostra; a comissão
 *    pede no topo do feed; a cédula fica travada enquanto falta estande sem
 *    pasta, e a separação é corrigida NO voto. A tela "Organize o que você
 *    viu" saiu.
 * 11. **O painel da professora** não tem voto, taxa, concentração nem nível
 *    (nem acerto) por criança; mostra quem SEPAROU, e as duas habilidades da
 *    ficha 6 (EF06CO01, EF06CO03) ficam no painel de habilidades, com o nível
 *    que a régua dá — a EF06CO10 saiu.
 * 12. **O podcast de recapitulação** do banco padrão é o roteiro fixo
 *    (aud-exp06ef1b-01), na página da atividade.
 *
 * ─── O estado de ontem ─────────────────────────────────────────────────────
 *
 * FIXTURE: a 6A (o seed libera a exp06ef1b lá). O banco padrão é idempotente
 * por turma ("se a turma já tem esse pacote, reaproveita"): se a atividade
 * criada é a que já estava no ar, a suíte zera a turma (ADR-155), que abre a
 * rodada seguinte.
 */
const SERIE = "6EF";
const EXP_ID = "exp06ef1b";
const FICHA = `${HUB}/professor/entre-redes/6-ano/unidade-1`;
const TITULO_DA_MISSAO = "O Júri Estadual de Projetos";
/** `JURI_IA=pular` dispensa a tentativa da IA (só quando o ADC está vencido, e a corrida diz isso). */
const MODO_DA_IA = (process.env.JURI_IA ?? "real").toLowerCase();

/* A turma vem do CSV do seed, não fixada aqui. */
const PRIMEIRO = conta("estudante", { serie: SERIE });
const TURMA = process.env.TURMA ?? PRIMEIRO.turma;
const SEGUNDO = contasDe("estudante").find((c) => c.turma === PRIMEIRO.turma && c.login !== PRIMEIRO.login);
if (!SEGUNDO) throw new Error(`a turma ${TURMA} precisa de dois estudantes (rode o seed)`);

/** Os parâmetros do preparo por IA, como a professora os digita. */
const PARAMETROS = {
  rotuloDaDisciplina: "Ciências",
  tema: "Ciência que cuida da cidade",
  assuntos: "Energia, água, alimentação e reaproveitamento de materiais na escola.",
};

/** O que nunca pode aparecer na tela da criança: carimbo, nota, acerto. */
const CARIMBO_OU_ACERTO = /\b(correta|incorreta|errou|acertou|errada|pontos|sua nota)\b/i;

/** O que a missão não diz antes da galeria. */
const SPOILER = /\b(algoritmo|bolha|filtro|ocult[ao]s?)\b/i;


/** A copy da experiência (`lib/textos.ts`) que a suíte confere. */
const COPY = {
  topo: "10ª Mostra Estadual de Projetos Escolares",
  jurado: "@jurado_oficial",
  entrar: "Acessar Feed da Mostra",
  abas: ["Início", "Busca", "Notificações", "Jurado"],
  buscaFechada: "Busca restrita à coordenação da mostra estadual durante o julgamento.",
  comentariosFechados: "Comentários restritos à coordenação da mostra estadual.",
  abrirCedula: "Cédula Oficial de Votação — Jurado",
  cabecalhoDaCedula: "Selecione o projeto que receberá a nota máxima e o troféu de Grande Campeão Estadual.",
  inatividade: "Jurado, a plenária aguarda seu voto para prosseguir.",
  espera: "Aguardando o encerramento do prazo de votação da comissão de jurados.",
  badge: (ocultos, total) => `${ocultos} de ${total} estandes nunca chegaram ao seu feed`,
  /* Saíram da galeria na 0.7.0 (ADR-176): a suíte prova que NÃO aparecem. */
  porAreaQueSaiu: "O que chegou ao seu feed, por área:",
  semCurtidasQueSaiu: "Sem as suas curtidas, o seu feed teria trazido:",
  pedidoDasPastas: "A comissão pede: salve cada estande na pasta da área dele.",
  salvarEm: "Salvar em",
  pastaDe: (nome) => `Pasta ${nome}`,
  faltam: (n) =>
    n === 1
      ? "Antes de votar, salve na pasta da área o estande que ainda falta."
      : `Antes de votar, salve cada estande na pasta da área dele: faltam ${n}.`,
  suasPastas: "Suas pastas",
  gradeOculta: (nome) => `Projetos de ${nome} que não chegaram ao seu feed`,
  gradeBusca: "Projetos encontrados",
  grupoDaRevisao: "Projetos da mostra",
  bastidor: "Bastidores do estande",
  busca: "Pesquisar projetos ou categorias...",
  manter: "Manter meu voto inicial",
  manterTravado: "Inspecione ao menos um projeto que não apareceu no seu feed antes de manter o voto.",
  confirmarRevisao: "Confirmar Voto Revisado",
  revisao: "Janela Extraordinária de Revisão de Voto",
  ficha: "Ficha Técnica de Auditoria",
  voltar: "Voltar à Galeria",
  leo: "Você viveu na prática o que Léo investigou no livro didático!",
  separacaoQueSaiu: "Organize o que você viu",
  grupoDoSe: "SE — a condição",
  grupoDoEntao: "ENTÃO — a ação",
  enviarRegra: "Enviar a Regra",
  regraCerta: "A regra que o aplicativo seguiu:",
  avancar: "Concluir o Julgamento",
  fimTitulo: "Credenciamento de Jurado Concluído",
  infografico: "Como os robôs leem nossas curtidas",
};

// ─────────────────────────────────────────────────────── utilitários

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
 * clique (ou um `fill`) nesse intervalo é aceito pelo Playwright sem chamar
 * handler nenhum — o formulário fica com o texto e o estado do React, vazio.
 * A testemunha é a chave `__react*` que o React pendura no nó ao ligar os
 * handlers.
 */
async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

/**
 * A UNIÃO de desfechos legítimos: devolve o NOME do que apareceu primeiro.
 * Para as telas com mais de um estado terminal válido (a IA respondeu ou não;
 * a imagem saiu ou não) — esperar só o caminho feliz pagaria o timeout inteiro
 * e reportaria o seletor, não o que a tela disse.
 */
async function primeiroQueAparecer(desfechos, { timeout, oQue }) {
  const nomes = Object.keys(desfechos);
  try {
    return await Promise.any(
      nomes.map((nome) =>
        desfechos[nome]
          .first()
          .waitFor({ timeout })
          .then(() => nome),
      ),
    );
  } catch {
    throw new Error(`${oQue}: nenhum desfecho em ${timeout / 1000}s (${nomes.join(", ")})`);
  }
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "2 de 30 jurados votaram." — a mesma frase de `juri-estadual-tipos.ts#textoDosVotos`. */
function fraseDosVotos({ votaram, total }, porComputador) {
  const sujeito = porComputador ? (total === 1 ? "computador" : "computadores") : total === 1 ? "jurado" : "jurados";
  return `${votaram} de ${total} ${sujeito} ${votaram === 1 && total === 1 ? "votou" : "votaram"}.`;
}

/**
 * As ABAS por área (o `Tabs` do DS, nas telas do professor): só a aba ABERTA é
 * renderizada, então contar itens na página conta uma área só. Toca cada aba,
 * espera ela ficar selecionada e conta os itens do contêiner — devolve o
 * rótulo ("Tecnologia · 10") e a contagem de cada uma, e volta à primeira.
 */
async function percorrerAbas(pagina, conteiner, seletorDoItem) {
  const abas = conteiner.getByRole("tab");
  await hidratado(pagina, abas);
  const porAba = [];
  const quantas = await abas.count();
  for (let i = 0; i < quantas; i += 1) {
    const aba = abas.nth(i);
    await aba.click();
    await pagina.waitForFunction((el) => el.getAttribute("aria-selected") === "true", await aba.elementHandle(), {
      timeout: 10_000,
    });
    porAba.push({
      /* O `Tab` do DS desenha o ícone padrão (`add`, por ligadura): fora do rótulo. */
      rotulo: (await aba.innerText()).replace(/\s+/g, " ").trim().replace(/^add /, ""),
      itens: await conteiner.locator(seletorDoItem).count(),
    });
  }
  if (quantas > 0) await abas.first().click();
  return porAba;
}

/** "Tecnologia · 10; Meio Ambiente · 10; …" — para a mensagem da verificação. */
function resumoDasAbas(porAba) {
  return porAba.map((a) => `${a.rotulo} → ${a.itens}`).join("; ");
}

/** Quantos posts de cada área um feed tem, em ordem decrescente: [7, 1, 1, 1]. */
function distribuicao(contagemPorArea) {
  return Object.values(contagemPorArea).sort((a, b) => b - a);
}

/** Os posts de um feed contados por área: `{ area_a: 7, … }`. */
function postsPorArea(posts) {
  const total = {};
  for (const post of posts) total[post.area] = (total[post.area] ?? 0) + 1;
  return total;
}

/** A área que a grade dos ocultos abre: a que MAIS ficou fora (empate: a ordem das áreas) — `regras.ts#areaComMaisOcultos`. */
function areaComMaisOcultos(porArea) {
  let melhor = null;
  for (const a of porArea) if (!melhor || a.total - a.vistos > melhor.total - melhor.vistos) melhor = a;
  return melhor?.area ?? null;
}

await suite(
  {
    slug: "estudante/13-juri-estadual",
    papel: "estudante",
    titulo: "O Júri Estadual de Projetos — o feed que esconde a mostra",
    subtitulo: "curtir, lacrar o voto, auditar o que nunca chegou ao feed e montar a regra que escondeu",
    contexto:
      "A criança é jurada de uma mostra científica estadual num feed de rede social: quarenta projetos de " +
      "quatro áreas, dez em cada. As curtidas dela mudam o que o feed mostra, sem aviso: depois que uma área " +
      "vence, o resto do feed traz só projetos novos dela. Ela lacra o voto e a turma espera junta, enquanto a " +
      "professora projeta como os votos se dividiram. Na Galeria Oculta todo mundo descobre que 30 dos 40 " +
      "estandes ficaram fora do feed — e cada uma vê QUAIS áreas sumiram, e o feed que teria tido sem as " +
      "curtidas. Depois remonta a regra que fez isso.",
    prova: [
      "A professora prepara pela IA real (40 estandes, uma aba por área, e as falas do podcast) e põe no ar pelo Banco Padrão Oficial, sem IA",
      "O crachá é um modal sobre a timeline desfocada; a TopBar traz @jurado_oficial, a barra tem as quatro abas, com a Busca fechada, e o carrossel termina nos Bastidores do estande",
      "Dez posts sem repetir nenhum; quem curte cedo recebe os posts 5 a 10 só da área curtida, com projetos novos (7/1/1/1)",
      "Salvar grava e não pesa: quem só salva vê as quatro áreas misturadas (3/3/2/2)",
      "As PASTAS (EF06CO01, ADR-176): no feed, o Salvar abre “Salvar em” com as quatro pastas da mostra; a aba Jurado conta os estandes de cada pasta",
      "A cédula tem quatro elementos, e parado 60 s com ela aberta o aviso acende no topo e a professora vê o ícone de ocioso",
      "A cédula fica travada enquanto falta estande sem pasta, e diz quantos; a separação é corrigida no voto, sem tela própria — o lacre e a espera com três elementos; o F5 volta à espera",
      "Um botão só, Liberar Auditoria, e ele não volta; só depois dele a lousa mostra a concentração do feed (quem curtiu × quem não curtiu)",
      "A Galeria Oculta: 30 de 40 para os dois e a busca logo abaixo — sem a contagem por área nem o “sem as suas curtidas” na tela (a api os calcula: por área e contrafactual provados nela) —, a grade por área e a revisão de dois botões — Manter só depois de abrir um oculto",
      "A regra SE … ENTÃO (EF06CO03): três peças de cada lado, uma tentativa, e a revelação ligada ao feed de cada um",
      "A regra conclui a missão (o caso Mariana saiu), e a faixa da Unooria no fim",
      "O painel da professora: sem voto, taxa, concentração, acerto nem nível; quem separou; EF06CO01 e EF06CO03 com o nível da régua",
    ],
    comando: "node scripts/e2e/estudante/13-juri-estadual.mjs",
  },
  async (r) => {
    /** Aperta o botão da aula e espera a etapa nova — e a hidratação, depois de um reload. */
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
      await esperarOuFalharCedo(pagina.locator(`[data-etapa="${etapa}"]`), pagina.locator(ALERTA_DE_ERRO), {
        timeout: 20_000,
        oQue: `o botão da aula (${etapa})`,
      });
    };

    // ═══ PROFESSORA: a ficha ═════════════════════════════════════════════
    const professora =
      contasDe("professor").find((c) => c.escola === PRIMEIRO.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login);

    const turmas = await lerApi(prof, "/juri-estadual/turmas");
    const turmaId = turmas.corpo?.turmas?.find((t) => t.nome === TURMA)?.id ?? null;
    if (!r.exigir(Boolean(turmaId), `${professora.login} vê a ${TURMA} no seletor do Júri Estadual`)) return;
    const caminhoDaTurma = `/juri-estadual/turmas/${turmaId}`;

    const pacotesAntes = await lerApi(prof, `${caminhoDaTurma}/pacotes`);
    if (pacotesAntes.status !== 200) {
      throw new Error(
        `a api não listou as atividades da ${TURMA} (HTTP ${pacotesAntes.status}): ${JSON.stringify(pacotesAntes.corpo).slice(0, 200)}`,
      );
    }
    const noArAntes = pacotesAntes.corpo?.ativo ?? null;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: new RegExp(TITULO_DA_MISSAO) }).first().waitFor({ timeout: 60_000 });
    await prof.getByText("Prepare antes: banco padrão ou mostra personalizada").first().waitFor({ timeout: 15_000 });
    await prof.locator("[data-atividades-da-missao]").waitFor({ timeout: 20_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 6º ano",
      mostra:
        "A missão explicada para quem conduz, o aviso “Prepare antes: banco padrão ou mostra personalizada” e a " +
        "lista “Suas atividades com a turma”, com Nova atividade.",
      prova:
        "A professora sabe ANTES que há dois caminhos — o banco padrão, em um toque, ou a mostra da IA sobre o tema " +
        "da aula — e que a missão só abre com uma atividade dela em andamento (ADR-130).",
    });

    /** Abre "Nova atividade" e espera o preparo na fase dos textos. */
    const abrirNovaAtividade = async () => {
      await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
      await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
      const preparo = prof.locator('[data-passo-conteudo] [data-preparo-juri][data-fase="textos"]');
      await preparo.waitFor({ timeout: 30_000 });
      return preparo;
    };

    // ═══ PROFESSORA: o caminho da IA REAL ════════════════════════════════
    const preparoDaIa = await abrirNovaAtividade();
    r.exigir(
      (await prof.locator("[data-mostra-vazia]").count()) === 1 && (await prof.locator("[data-curadoria-da-mostra]").count()) === 0,
      "a criação nasce VAZIA: nenhum estande antes de a professora escolher o caminho",
    );
    r.exigir(
      (await preparoDaIa.locator('[data-caminho-curto] [data-acao="usar-banco-padrao"]').count()) === 1,
      "o caminho curto “Usar Banco Padrão Oficial” fica no topo do preparo, antes de qualquer campo",
    );
    if (MODO_DA_IA === "pular") {
      r.ressalva("JURI_IA=pular: a geração da mostra por IA não foi exercida nesta corrida");
    } else {
      const disciplina = prof.getByRole("combobox", { name: /^Componente curricular/i });
      await hidratado(prof, disciplina);
      await disciplina.click();
      const opcao = prof.getByRole("listbox").getByRole("option", { name: new RegExp(PARAMETROS.rotuloDaDisciplina) }).first();
      await opcao.waitFor({ timeout: 10_000 }).catch(() => {
        throw new Error("o seletor de componente curricular não abriu: a página ainda não estava hidratada");
      });
      await opcao.click();
      const tema = preparoDaIa.getByRole("textbox", { name: /^Título da mostra escolar/i });
      await tema.click();
      await tema.pressSequentially(PARAMETROS.tema);
      const assuntos = preparoDaIa.getByRole("textbox", { name: /^Assuntos curriculares da semana/i });
      await assuntos.click();
      await assuntos.pressSequentially(PARAMETROS.assuntos);
      await prof.waitForFunction(
        () => !document.querySelector('[data-acao="gerar-mostra"]')?.hasAttribute("disabled"),
        null,
        { timeout: 10_000 },
      );
      await r.registrar(prof, "preparo-parametros", {
        titulo: "Dois caminhos: o banco padrão ou a IA",
        mostra:
          "A fase 1 da criação: no topo, “Usar Banco Padrão Oficial”; abaixo, o componente curricular, o tema da " +
          "feira e os objetos de conhecimento, e o botão Gerar com IA.",
        prova:
          "O caminho curto não pede nada e não usa IA; o personalizado escreve a mostra sobre a aula da professora, " +
          "e nada gerado chega à turma sem a aprovação dela.",
      });

      const curadoria = prof.locator("[data-curadoria-da-mostra]");
      const falhaDaIa = prof.locator(`[data-preparo-juri] [data-falha-da-ia], [data-preparo-juri] ${ALERTA_DE_ERRO}`);
      const respostaDasFalas = esperarFalasDoTema(prof, EXP_ID);
      respostaDasFalas.catch(() => undefined);
      await prof.locator('[data-acao="gerar-mostra"]').click();
      /* A geração são CINCO chamadas na api (as categorias, depois as quatro
         áreas em paralelo; ~42 s medidos). A espera é a UNIÃO dos desfechos —
         a curadoria ou a falha —, e o teto passa do teto do BFF (180 s): quem
         decide quando desistir é o produto, que responde com a falha, nunca o
         relógio do roteiro. */
      const desfecho = await primeiroQueAparecer(
        { curadoria, falha: falhaDaIa },
        { timeout: 200_000, oQue: "a geração da mostra com IA" },
      );
      if (desfecho === "falha") {
        const texto = (await falhaDaIa.first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
        await r.registrar(prof, "preparo-ia-falhou", {
          titulo: "Quando a IA não responde",
          mostra: `O aviso da falha na voz da plataforma: “${texto.slice(0, 160)}”, e o botão do acervo padrão.`,
          prova: "Sem saldo ou com o gerador fora, a aula não para: o banco padrão entra no lugar (RF-007).",
        });
        r.exigir(false, `a IA REAL gerou a mostra (a tela respondeu: “${texto.slice(0, 200)}”)`);
      } else {
        const abasDaCuradoria = await percorrerAbas(prof, curadoria, "[data-estande]");
        const estandes = abasDaCuradoria.reduce((n, a) => n + a.itens, 0);
        r.exigir(
          abasDaCuradoria.length === 4 && abasDaCuradoria.every((a) => a.itens === 10) && estandes === 40,
          `a IA real escreveu 40 estandes, dez em cada uma das 4 abas — só a aberta é desenhada (${resumoDasAbas(abasDaCuradoria)})`,
        );
        r.exigir(
          abasDaCuradoria.every((a) => /\S · (10|\d+ com ajuste)$/.test(a.rotulo)),
          `o rótulo de cada aba é “Nome · 10” (ou quantos estandes da área pedem ajuste): ${abasDaCuradoria.map((a) => a.rotulo).join(" | ")}`,
        );
        await curadoria.scrollIntoViewIfNeeded();
        await r.registrar(prof, "curadoria-da-ia", {
          titulo: "A mostra escrita pela IA, na curadoria",
          mostra:
            "Os quarenta estandes que o Vertex escreveu, uma aba por área (“Nome · 10”), a primeira aberta: a " +
            "categoria com nome e hashtag e os dez estandes dela, cada um com Editar e Regenerar.",
          prova:
            "A IA traz as categorias no pacote (melhoria 2: o Zod valida o FORMATO, não uma lista fixa), e o rascunho " +
            "não persiste: só o “Aprovar textos” grava. Quarenta cartões soltos não se leem: a aba mostra uma área " +
            "por vez e diz no rótulo quantos estandes dela pedem ajuste.",
          detalhe: resumoDasAbas(abasDaCuradoria),
          inteira: true,
        });
        await provarFalasNaCriacao(r, prof, await respostaDasFalas, {
          comIa: true,
          passo: "criacao-falas-do-podcast",
          titulo: "As falas do podcast, para revisar",
          mostra: "Abaixo da curadoria, as três falas do podcast de recapitulação que citam esta mostra, editáveis.",
          prova: "A IA escreve as falas a partir dos estandes; a professora as revisa antes de aprovar os textos.",
        });
        r.ressalva("a mostra da IA foi gerada e curada, e NÃO foi gravada: a aula desta corrida vai ao ar pelo banco padrão");
      }
    }

    // ═══ PROFESSORA: o caminho curto — Usar Banco Padrão Oficial ═════════
    const preparo = await abrirNovaAtividade();
    const usarPadrao = preparo.locator('[data-acao="usar-banco-padrao"]');
    await hidratado(prof, usarPadrao);
    await usarPadrao.click();
    await esperarOuFalharCedo(
      prof.locator('[data-preparo-juri][data-fase="banco-padrao"]'),
      prof.locator(`[data-preparo-juri] ${ALERTA_DE_ERRO}`),
      { timeout: 30_000, oQue: "usar o Banco Padrão Oficial" },
    );
    r.exigir(
      /Banco Padrão Oficial está pronto/.test(await prof.locator('[data-preparo-juri][data-fase="banco-padrao"]').innerText()),
      "o banco padrão fica pronto em um toque, sem IA e sem curadoria",
    );
    await r.registrar(prof, "banco-padrao", {
      titulo: "O Banco Padrão Oficial, em um toque",
      mostra:
        "A confirmação: os 40 estandes da Feira de Ciências e Sustentabilidade prontos, sem IA, com as imagens do " +
        "banco padrão (e a arte da missão no estande que ainda não tem imagem).",
      prova:
        "É o caminho curto do PRD (E0-PROF-02) e o fallback quando falta cota de IA: a atividade fica gravada, fora " +
        "do ar, com as imagens já aprovadas — as do banco padrão que existem, a arte procedural no resto.",
    });
    const continuar = prof.locator('[data-acao="continuar-criacao"]');
    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').waitFor({ timeout: 10_000 });
    await continuar.click();
    const umPorComputador = prof.getByRole("radio", { name: "Um aluno por computador", exact: true });
    await umPorComputador.click();
    r.exigir(await umPorComputador.isChecked(), "o passo de equipes marca “Um aluno por computador”");
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
      { timeout: 60_000, oQue: "criar a atividade do banco padrão e pô-la no ar" },
    );
    await prof.waitForURL("**/resultados?**pacote=**", { timeout: 30_000 });
    const atividadeId = new URL(prof.url()).searchParams.get("pacote");
    if (!r.exigir(Boolean(atividadeId), `a página da atividade leva o id dela na URL (${prof.url()})`)) return;
    const pacotesDepois = (await lerApi(prof, `${caminhoDaTurma}/pacotes`)).corpo;
    r.exigir(pacotesDepois?.ativo?.id === atividadeId, "a atividade do banco padrão é a EM ANDAMENTO da turma");
    r.exigir(pacotesDepois?.ativo?.origem === "padrao", `a origem gravada é “padrao” (veio ${pacotesDepois?.ativo?.origem})`);

    if (noArAntes?.id === atividadeId) {
      const rodada = noArAntes.rodada;
      const zerar = prof.locator("[data-zerar-turma]");
      await hidratado(prof, zerar);
      await zerar.click();
      await prof.getByRole("dialog").getByRole("button", { name: "Iniciar Nova Rodada" }).click();
      await esperarOuFalharCedo(
        prof.locator(`[data-pacote="${atividadeId}"]`, { hasText: `rodada ${rodada + 1}` }),
        prof.getByRole("dialog").locator(ALERTA_DE_ERRO),
        { timeout: 30_000, oQue: "zerar a turma" },
      );
      r.ressalva(`o banco padrão já estava no ar (corrida anterior): a turma foi zerada para a ${rodada + 1}ª rodada`);
    }
    await prof.waitForSelector('[data-etapa="exploracao"]', { timeout: 20_000 });
    await r.registrar(prof, "atividade-em-andamento", {
      titulo: "A atividade em andamento, e o botão da aula",
      mostra:
        "A página da atividade do banco padrão: em andamento, as imagens e os 40 estandes em abas por área, e o " +
        "painel da aula com Liberar Auditoria.",
      prova: "Um botão só (PRD v2): Liberar Auditoria abre a Galeria Oculta para a turma inteira, e não volta.",
      inteira: true,
    });

    /* Os 40 na página da atividade, nas DUAS grades com abas: os estandes (só
       leitura) e as imagens. Só a aba aberta é desenhada, então a prova anda
       pelas quatro. */
    const estandesDaAtividade = prof.locator("[data-estandes-da-atividade]");
    await estandesDaAtividade.waitFor({ timeout: 20_000 });
    r.exigir(
      (await estandesDaAtividade.getAttribute("data-total-de-estandes")) === "40",
      `a página da atividade diz o total do PACOTE: 40 estandes (${await estandesDaAtividade.getAttribute("data-total-de-estandes")})`,
    );
    const abasDosEstandes = await percorrerAbas(prof, estandesDaAtividade, "[data-estande]");
    r.exigir(
      abasDosEstandes.length === 4 && abasDosEstandes.every((a) => a.itens === 10 && /\S · 10$/.test(a.rotulo)),
      `os estandes da atividade: quatro abas “Nome · 10”, dez estandes em cada (${resumoDasAbas(abasDosEstandes)})`,
    );
    const gradeDeImagens = prof.locator("[data-imagens-do-juri]");
    const abasDasImagens = await percorrerAbas(prof, gradeDeImagens, "[data-imagem-do-estande]");
    r.exigir(
      abasDasImagens.length === 4 && abasDasImagens.every((a) => a.itens === 10 && /\S · (10|\d+ com imagem faltando)$/.test(a.rotulo)),
      `a grade de imagens: quatro abas, dez estandes em cada, e o rótulo diz quantos têm imagem faltando (${resumoDasAbas(abasDasImagens)})`,
    );
    /* Quatro imagens por estande (0.8.0, ADR-178): as lâminas do carrossel do post. */
    const laminasDoCartao = await gradeDeImagens.locator("[data-imagem-do-estande]").first().locator("[data-lamina]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-lamina")),
    );
    r.exigir(
      laminasDoCartao.join(",") === "capa,detalhe,equipe,bastidor",
      `cada estande da grade de imagens mostra as quatro lâminas do carrossel, na ordem do post (${laminasDoCartao.join(", ")})`,
    );
    /* A foto enquadra a barra de abas (o contêiner é maior que a tela). */
    await estandesDaAtividade.getByRole("tablist").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
    await r.registrar(prof, "estandes-em-abas", {
      titulo: "Quarenta estandes, uma aba por área",
      mostra:
        "“Os estandes da mostra” na página da atividade: “São 40 estandes…”, as quatro abas (“Tecnologia · 10”, …) " +
        "e os dez cartões da área aberta.",
      prova:
        "O total vem do PACOTE, não de uma constante (o de 16 da 0.4.x continua abrindo). As abas do DS desenham " +
        "só a área aberta: a suíte tocou as quatro e contou dez em cada — e o mesmo na grade de imagens.",
      detalhe: `estandes: ${resumoDasAbas(abasDosEstandes)} · imagens: ${resumoDasAbas(abasDasImagens)}`,
    });

    // ═══ ESTUDANTES: utilitários ═════════════════════════════════════════
    const entrarPelaGrade = async (pagina, login) => {
      await r.entrar(pagina, login);
      if (!new URL(pagina.url()).pathname.startsWith("/estudante")) {
        await pagina.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });
      }
      const cartao = pagina.locator("main a", { hasText: TITULO_DA_MISSAO }).first();
      await cartao.waitFor({ timeout: 30_000 }).catch(() => {
        throw new Error(`o cartão “${TITULO_DA_MISSAO}” não está ABERTO na grade da ${TURMA}`);
      });
      await hidratado(pagina, cartao);
      await cartao.click();
      await pagina.waitForURL(`**/exp/${EXP_ID}**`, { timeout: 30_000 });
    };
    const frameDe = (pagina) => () => pagina.frameLocator('iframe[data-experiencia]');
    const semAnimacao = (q) =>
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
    const sessaoDe = async (pagina) => {
      const s = await lerApi(pagina, "/juri-estadual/sessao");
      if (s.status !== 200) throw new Error(`a sessão da missão não abriu (HTTP ${s.status}): ${JSON.stringify(s.corpo).slice(0, 200)}`);
      return s.corpo;
    };
    const aviso = (q, texto) => q().getByText(texto).first();
    const botaoDaCedula = (q) => q().getByRole("button", { name: COPY.abrirCedula });

    /**
     * Rola o feed até os dez, um post por vez (o motor serve o próximo quando o
     * último fica ≥ 60% visível). `aoChegar(postId)` roda a cada post novo.
     */
    const rolarAteOsDez = async (q, aoChegar = async () => {}) => {
      const artigos = q().locator("article[data-post-id]");
      await artigos.nth(3).waitFor({ timeout: 20_000 });
      const vistos = new Set();
      for (;;) {
        const total = await artigos.count();
        for (let i = 0; i < total; i += 1) {
          const id = await artigos.nth(i).getAttribute("data-post-id");
          if (id && !vistos.has(id)) {
            vistos.add(id);
            await aoChegar(id, i);
          }
        }
        if (total >= 10) break;
        await artigos.nth(total - 1).scrollIntoViewIfNeeded();
        await artigos
          .nth(total)
          .waitFor({ timeout: 20_000 })
          .catch(() => {
            throw new Error(`o feed parou em ${total} posts: rolar até o último não trouxe o próximo do motor`);
          });
      }
      await botaoDaCedula(q).waitFor({ timeout: 15_000 });
    };

    /** A cédula: os quatro elementos, e o voto. */
    const abrirACedula = async (q) => {
      await botaoDaCedula(q).click();
      const folha = q().getByRole("dialog", { name: COPY.cabecalhoDaCedula });
      await folha.waitFor({ timeout: 10_000 });
      return folha;
    };
    const marcarOVoto = async (folha, tituloDoProjeto, certeza) => {
      const projetos = folha.getByRole("radiogroup", { name: "Projetos do seu feed" });
      const opcao = tituloDoProjeto
        ? projetos.getByRole("radio", { name: new RegExp(`^${escaparRegex(tituloDoProjeto)}`) }).first()
        : projetos.getByRole("radio").last();
      await opcao.scrollIntoViewIfNeeded();
      await opcao.click();
      /* A opção do alto pode ficar sob a borda da folha: o clique tem de MARCAR. */
      if ((await opcao.getAttribute("aria-checked")) !== "true") await opcao.dispatchEvent("click");
      if ((await opcao.getAttribute("aria-checked")) !== "true") throw new Error("a cédula não marcou o projeto tocado");
      await folha.getByRole("group", { name: "Sua certeza" }).getByRole("button", { name: certeza, exact: true }).click();
    };
    /* O voto leva direto à espera: a separação das pastas é corrigida NELE (ADR-176). */
    const lacrar = async (q, folha) => {
      await folha.getByRole("button", { name: "Confirmar Voto Oficial" }).click();
      await q().getByText(/^Voto Registrado e Lacrado — Protocolo #/).first().waitFor({ timeout: 20_000 });
    };

    /**
     * Uma PASTA (EF06CO01, ADR-176): "Salvar publicação" (ou "Remover dos
     * salvos", se o post já está numa pasta) abre a folha "Salvar em"; a suíte
     * toca a pasta e espera a api gravá-la — o desfecho, não o relógio.
     */
    const salvarNaPasta = async (pagina, qq, postId, area, nome) => {
      const artigo = qq().locator(`article[data-post-id="${postId}"]`);
      await artigo.scrollIntoViewIfNeeded();
      await artigo.getByRole("button", { name: /^(Salvar publicação|Remover dos salvos)$/ }).click();
      const folha = qq().getByRole("dialog", { name: COPY.salvarEm });
      await folha.waitFor({ timeout: 10_000 });
      await folha.getByRole("button", { name: COPY.pastaDe(nome), exact: true }).click();
      await folha.waitFor({ state: "hidden", timeout: 10_000 });
      await esperarNaApi(pagina, "/juri-estadual/sessao", (s) => s?.feed?.pastas?.[postId] === area, {
        oQue: `a pasta de ${postId}`,
      });
    };

    /**
     * Guarda nas pastas todo estande visto que ainda não está numa. A suíte sabe
     * a área certa pelo FEED da sessão (o post traz a área) e erra de propósito
     * as `erradas` primeiras. Devolve quantos estandes o feed mostrou.
     */
    const guardarNasPastas = async (pagina, qq, erradas = 0) => {
      const sessao = await sessaoDe(pagina);
      const nomeDaArea = new Map(sessao.categorias.map((c) => [c.area, c.nome]));
      const vistos = new Set();
      let feitas = 0;
      for (const post of sessao.feed.posts) {
        if (vistos.has(post.projetoId)) continue;
        vistos.add(post.projetoId);
        if (sessao.feed.pastas?.[post.id]) continue;
        const area = feitas < erradas ? [...nomeDaArea.keys()].find((a) => a !== post.area) : post.area;
        await salvarNaPasta(pagina, qq, post.id, area, nomeDaArea.get(area));
        feitas += 1;
      }
      return vistos.size;
    };

    const plenaria = (qq) => qq().locator(".plenaria");
    const conferirOPico = async (qq, quem) => {
      await plenaria(qq).waitFor({ timeout: 20_000 });
      const elementos = await plenaria(qq).evaluate((el) => el.children.length);
      const texto = await plenaria(qq).innerText();
      r.exigir(elementos === 3, `${quem}: a espera tem exatamente três elementos — brasão, carimbo e ordem (${elementos})`);
      r.exigir(
        (await qq().locator(".tela").locator("button, [role=tab], article").count()) === 0,
        `${quem}: na espera não há botão, aba nem post — nada leva de volta`,
      );
      r.exigir(texto.includes(COPY.espera), `${quem}: a ordem da comissão é “${COPY.espera}”`);
      r.exigir(!SPOILER.test(texto), `${quem}: a espera não diz algoritmo, bolha, filtro nem oculto`);
    };

    // ── ESTUDANTE 1: o crachá, as abas, o carrossel ──────────────────────
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await entrarPelaGrade(p, PRIMEIRO.login);
    const q = frameDe(p);
    const cracha = q().getByRole("dialog", { name: COPY.topo });
    await cracha.waitFor({ timeout: 60_000 });
    const acessar = cracha.getByRole("button", { name: COPY.entrar });
    await acessar.waitFor({ timeout: 20_000 });
    r.exigir((await cracha.getByText(COPY.jurado).count()) > 0, "o crachá-modal traz o selo @jurado_oficial");
    r.exigir(
      (await q().locator(".timeline-desfocada").count()) === 1,
      "atrás do crachá, a timeline do Unoovista desfocada e inerte",
    );
    await semAnimacao(q);
    await r.registrar(p, "cracha-modal", {
      titulo: "O crachá, sobre a timeline desfocada",
      mostra:
        "A folha da comissão (“10ª Mostra Estadual de Projetos Escolares”) com o emissor @comissao_juri, o selo " +
        "@jurado_oficial, o mandato e “Acessar Feed da Mostra” — e atrás, a timeline desfocada.",
      prova:
        "A missão abre pelo papel de jurado; o modal não fecha pelo véu nem por ESC: o único caminho é entrar no " +
        "feed. Nenhuma palavra sobre o feed se adaptar.",
    });

    await acessar.click();
    const artigos1 = q().locator("article[data-post-id]");
    await artigos1.nth(3).waitFor({ timeout: 20_000 });
    const abertura = (await sessaoDe(p)).feed.posts;
    r.exigir(
      abertura.length === 4 && new Set(abertura.map((x) => x.area)).size === 4,
      `a abertura do feed traz 4 posts, um de cada área (${abertura.map((x) => x.area).join(", ")})`,
    );
    const topo = q().locator("header, [class*='topbar' i]").first();
    r.exigir(
      (await q().getByText(COPY.jurado).first().isVisible()) && (await q().getByText("Unoovista").first().isVisible()),
      "a TopBar do Unoovista traz a marca e o crachá @jurado_oficial",
    );
    const navegacao = q().getByRole("navigation", { name: "Navegação do app" });
    /* A aba inativa do `TabBar` do DS mostra só o ícone: o nome vai no rótulo acessível. */
    const aba = (nome) => navegacao.getByLabel(nome, { exact: true }).or(navegacao.getByText(nome, { exact: true })).first();
    const abasPresentes = [];
    for (const a of COPY.abas) if ((await aba(a).count()) > 0) abasPresentes.push(a);
    r.exigir(
      abasPresentes.length === 4,
      `a barra de abas tem as quatro da copy — Início, Busca, Notificações, Jurado (achou: ${abasPresentes.join(", ")})`,
    );
    await semAnimacao(q);
    await r.registrar(p, "feed-topbar", {
      titulo: "O feed, com o crachá na TopBar",
      mostra: "A TopBar “Unoovista” com o selo @jurado_oficial à direita, a abertura do feed e as quatro abas embaixo.",
      prova: "O crachá fica em toda tela do clone; a abertura mostra um projeto de cada área — a mostra é variada antes de a bolha fechar.",
    });
    void topo;

    /* A aba BUSCA está fechada durante o julgamento: responde com o aviso. */
    await aba("Busca").click();
    await aviso(q, COPY.buscaFechada).waitFor({ timeout: 10_000 });
    r.exigir((await sessaoDe(p)).passo === "feed", "a Busca fechada não tira a criança do feed");
    await aba("Jurado").click();
    await q().getByText(COPY.topo).first().waitFor({ timeout: 10_000 });
    await aba("Início").click();
    await artigos1.first().waitFor({ timeout: 10_000 });

    /* O CARROSSEL anda com o MOUSE (arrasto real) e pelas setas. São três fotos
       e, na 4ª lâmina, os BASTIDORES do estande (0.5.0: o bastidor deixou de
       ser um post à parte e virou parte do post). */
    const primeiroPost = artigos1.first();
    const midia = primeiroPost.locator('[aria-roledescription="carrossel"]').first();
    await midia.scrollIntoViewIfNeeded();
    const arrastarParaAEsquerda = async () => {
      const caixa = await midia.boundingBox();
      if (!caixa) throw new Error("a mídia do primeiro post não tem caixa na tela");
      const yDoMeio = caixa.y + caixa.height / 2;
      await p.mouse.move(caixa.x + caixa.width * 0.8, yDoMeio);
      await p.mouse.down();
      await p.mouse.move(caixa.x + caixa.width * 0.5, yDoMeio, { steps: 6 });
      await p.mouse.move(caixa.x + caixa.width * 0.2, yDoMeio, { steps: 6 });
      await p.mouse.up();
    };
    /* As fotos 2 e 3 (0.8.0, ADR-178): a gerada da lâmina quando a api a manda,
       senão a arte procedural (`data:`). Os dois estados são legítimos — o
       banco padrão pode não ter as imagens no storage —, e cada um se prova. */
    const laminasDaApi = abertura[0].laminas ?? { detalhe: null, equipe: null, bastidor: null };
    const srcDaLamina = async (rotulo) =>
      primeiroPost.locator(`[aria-roledescription="carrossel"][aria-label="${rotulo}"] img`).first().getAttribute("src");
    const fotoCerta = (src, esperada) => (esperada ? src === esperada : Boolean(src?.startsWith("data:image/svg")));
    await arrastarParaAEsquerda();
    await primeiroPost.locator('[aria-label="Foto 2 de 3"]').first().waitFor({ timeout: 10_000 });
    const src2 = await srcDaLamina("Foto 2 de 3");
    r.exigir(
      fotoCerta(src2, laminasDaApi.detalhe),
      `a foto 2 é ${laminasDaApi.detalhe ? "a imagem gerada do projeto de perto" : "a arte procedural (a api não mandou imagem para a lâmina)"} (${String(src2).slice(0, 50)}…)`,
    );
    await arrastarParaAEsquerda();
    await primeiroPost.locator('[aria-label="Foto 3 de 3"]').first().waitFor({ timeout: 10_000 });
    const src3 = await srcDaLamina("Foto 3 de 3");
    r.exigir(
      fotoCerta(src3, laminasDaApi.equipe),
      `a foto 3 é ${laminasDaApi.equipe ? "a imagem gerada da equipe no estande" : "a arte procedural (a api não mandou imagem para a lâmina)"} (${String(src3).slice(0, 50)}…)`,
    );
    await arrastarParaAEsquerda();
    const laminaDoBastidor = primeiroPost.locator(`[aria-roledescription="carrossel"][aria-label="${COPY.bastidor}"]`).first();
    await laminaDoBastidor.waitFor({ timeout: 10_000 }).catch(() => {
      throw new Error(`o terceiro arrasto não levou à 4ª lâmina, “${COPY.bastidor}”`);
    });
    /* Com a foto dos bastidores, o texto desce para baixo da imagem; sem ela, fica na lâmina. */
    const ondeEstaOTexto = laminasDaApi.bastidor ? primeiroPost.locator("[data-bastidor-do-post]") : laminaDoBastidor;
    const textoDaLamina = (await ondeEstaOTexto.innerText()).replace(/\s+/g, " ").trim();
    if (laminasDaApi.bastidor) {
      r.exigir(
        (await laminaDoBastidor.locator("img").first().getAttribute("src")) === laminasDaApi.bastidor,
        "a 4ª lâmina mostra a imagem gerada dos bastidores, e o texto do teste vem embaixo dela",
      );
    }
    const bastidorDaApi = (abertura[0].bastidor ?? "").replace(/\s+/g, " ").trim();
    r.exigir(
      bastidorDaApi !== "" && textoDaLamina.includes(COPY.bastidor) && textoDaLamina.includes(bastidorDaApi),
      `a 4ª lâmina, alcançada arrastando com o mouse, é “${COPY.bastidor}” com o texto do bastidor que a api mandou no post (${bastidorDaApi.slice(0, 60)}…)`,
    );
    r.exigir(
      (await primeiroPost.locator('[data-seta="proxima"], [aria-label="Próxima foto"]').count()) === 0,
      "na última lâmina, a seta de avançar some: o carrossel tem quatro lâminas, nem uma a mais",
    );
    await semAnimacao(q);
    await r.registrar(p, "carrossel-bastidor", {
      titulo: "O carrossel termina nos Bastidores do estande",
      mostra: `O primeiro post depois de três arrastos com o mouse: a 4ª lâmina, “${COPY.bastidor}”, ${laminasDaApi.bastidor ? "com a imagem da bancada de testes e, embaixo dela, o texto do protótipo em teste" : "com o texto do protótipo em teste (sem imagem gerada para a lâmina)"}.`,
      prova:
        "Até a 0.4.x o bastidor era um post SEPARADO, que repetia o projeto (a saturação). Desde a 0.5.0 nenhum post " +
        "se repete: o bastidor é a última lâmina do próprio post, com o mesmo gesto e as mesmas setas das fotos.",
    });
    await primeiroPost.locator('[data-seta="anterior"]').click();
    await primeiroPost.locator('[aria-label="Foto 3 de 3"]').first().waitFor({ timeout: 10_000 });
    r.exigir(true, "o carrossel anda arrastando com o mouse (fotos 2 e 3, depois os bastidores) e volta pela seta (foto 3 de 3)");

    /* COMENTAR responde com o aviso, e não pesa. */
    await primeiroPost.getByRole("button", { name: "Comentar publicação", exact: true }).click();
    await aviso(q, COPY.comentariosFechados).waitFor({ timeout: 10_000 });
    r.exigir((await sessaoDe(p)).feed.curtidos.length === 0, "comentar responde com o aviso da comissão e não vira sinal do feed");

    // ── ESTUDANTE 1: curtir duas vezes a mesma área — o afunilamento ─────
    const areaCurtida = abertura[0].area;
    const curtidas = [];
    const curtir = async (postId) => {
      const artigo = q().locator(`article[data-post-id="${postId}"]`);
      await artigo.getByRole("button", { name: "Curtir publicação", exact: true }).click();
      await artigo.getByRole("button", { name: "Descurtir publicação", exact: true }).waitFor({ timeout: 5_000 });
      await esperarNaApi(p, "/juri-estadual/sessao", (s) => s?.feed?.curtidos?.includes(postId), {
        oQue: `a curtida em ${postId}`,
      });
      curtidas.push(postId);
    };
    await curtir(abertura[0].id);
    await rolarAteOsDez(q, async (postId) => {
      if (curtidas.length >= 2 || curtidas.includes(postId)) return;
      const post = (await sessaoDe(p)).feed.posts.find((x) => x.id === postId);
      if (post?.area === areaCurtida) await curtir(postId);
    });
    const feed1 = (await sessaoDe(p)).feed;
    if (!r.exigir(curtidas.length === 2, `o primeiro estudante curtiu DUAS vezes a mesma área (${areaCurtida}: ${curtidas.join(", ")})`)) {
      throw new Error("pré-condição do afunilamento: o feed não serviu um segundo post da área curtida (regras/afunilamento.ts)");
    }
    const depoisDaAbertura = feed1.posts.slice(4);
    const projetosDistintos1 = new Set(feed1.posts.map((x) => x.projetoId)).size;
    r.exigir(
      feed1.posts.length === 10 &&
        feed1.posts.every((x) => x.tipo === "apresentacao") &&
        new Set(feed1.posts.map((x) => x.id)).size === 10 &&
        projetosDistintos1 === 10,
      `dez posts, todos apresentação, dez projetos DISTINTOS — nenhum post se repete (${feed1.posts.length} posts, ${projetosDistintos1} projetos, formatos: ${[...new Set(feed1.posts.map((x) => x.tipo))].join(", ")})`,
    );
    r.exigir(
      depoisDaAbertura.every((x) => x.area === areaCurtida),
      `quem curte cedo recebe os posts 5 a 10 só de ${areaCurtida}, com projetos NOVOS dela (${depoisDaAbertura.map((x) => x.area).join(", ")})`,
    );
    const distribuicao1 = distribuicao(postsPorArea(feed1.posts));
    r.exigir(
      JSON.stringify(distribuicao1) === "[7,1,1,1]",
      `o feed de quem curtiu cedo fica 7/1/1/1 por área (${distribuicao1.join("/")})`,
    );
    await semAnimacao(q);
    await r.registrar(p, "feed-afunilado", {
      titulo: "Dez posts, e a cédula acende",
      mostra: "O fim do feed: projetos novos da área curtida, um atrás do outro, nenhum repetido, e o botão da cédula.",
      prova:
        "Duas curtidas fizeram a área líder, e o resto do feed foi só dela — sem aviso nenhum e sem repetir post: a " +
        "área tem dez projetos. A criança vai votar achando que viu a mostra.",
      detalhe: `${projetosDistintos1} projetos distintos em 10 posts · por área ${distribuicao1.join("/")}`,
    });

    // ── ESTUDANTE 1: as PASTAS do salvar (EF06CO01, ADR-176) ─────────────
    const pedido = q().getByText(COPY.pedidoDasPastas).first();
    r.exigir(await pedido.isVisible(), `no topo do feed, a comissão pede: “${COPY.pedidoDasPastas}”`);
    r.exigir(!SPOILER.test(COPY.pedidoDasPastas), "o pedido das pastas, antes da galeria, não diz algoritmo, bolha, filtro nem oculto");
    const categoriasDoFeed = (await sessaoDe(p)).categorias;
    const primeiroDoFeed = feed1.posts[0];
    /* O aviso de "Comentários restritos" (4 s) do passo anterior ainda pode estar na
       tela e cobriria a última pasta no print: espera ele sair — o desfecho, não o relógio. */
    await aviso(q, COPY.comentariosFechados).waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    const artigoDoPrimeiro = q().locator(`article[data-post-id="${primeiroDoFeed.id}"]`);
    await artigoDoPrimeiro.scrollIntoViewIfNeeded();
    await artigoDoPrimeiro.getByRole("button", { name: "Salvar publicação", exact: true }).click();
    const folhaDasPastas = q().getByRole("dialog", { name: COPY.salvarEm });
    await folhaDasPastas.waitFor({ timeout: 10_000 });
    const pastasNaFolha = [];
    for (const c of categoriasDoFeed) {
      if ((await folhaDasPastas.getByRole("button", { name: COPY.pastaDe(c.nome), exact: true }).count()) > 0) pastasNaFolha.push(c.nome);
    }
    r.exigir(
      pastasNaFolha.length === 4,
      `“${COPY.salvarEm}” oferece as quatro pastas da mostra, com os nomes das áreas do pacote (${pastasNaFolha.join(", ")})`,
    );
    r.exigir(!SPOILER.test(await folhaDasPastas.innerText()), "a folha das pastas não diz algoritmo, bolha, filtro nem oculto");
    await semAnimacao(q);
    await r.registrar(p, "pastas-do-salvar", {
      titulo: "Salvar em: as pastas da mostra",
      mostra: `O pedido da comissão no topo do feed e, sobre o post, a folha “${COPY.salvarEm}” com as quatro pastas: ${pastasNaFolha.join(", ")}.`,
      prova:
        "A EF06CO01 no próprio feed (ADR-176): classificar cada estande na coleção a que pertence, como as coleções " +
        "de posts salvos de uma rede social. Salvar não pesa no feed; quem corrige a pasta é o servidor, no voto.",
    });
    const nomeDaPrimeira = categoriasDoFeed.find((c) => c.area === primeiroDoFeed.area)?.nome;
    await folhaDasPastas.getByRole("button", { name: COPY.pastaDe(nomeDaPrimeira), exact: true }).click();
    await folhaDasPastas.waitFor({ state: "hidden", timeout: 10_000 });
    await esperarNaApi(p, "/juri-estadual/sessao", (s) => s?.feed?.pastas?.[primeiroDoFeed.id] === primeiroDoFeed.area, {
      oQue: "a primeira pasta",
    });
    const estandesSeparados1 = await guardarNasPastas(p, q, 0);
    const pastas1 = (await sessaoDe(p)).feed;
    r.exigir(
      estandesSeparados1 === projetosDistintos1 && pastas1.semPasta === 0,
      `os ${projetosDistintos1} estandes do feed estão nas pastas, e a api diz que não falta nenhum (faltam ${pastas1.semPasta})`,
    );
    r.exigir(
      pastas1.curtidos.length === 2 && JSON.stringify(distribuicao(postsPorArea(pastas1.posts))) === "[7,1,1,1]",
      "guardar nas pastas não mexeu no feed: as mesmas duas curtidas e o mesmo 7/1/1/1",
    );
    await aba("Jurado").click();
    await q().getByText(COPY.suasPastas).first().waitFor({ timeout: 10_000 });
    const textoDoPerfil = await q().locator(".pastas").first().innerText();
    const contagemDasPastas = [...textoDoPerfil.matchAll(/(\d+) estandes?/g)].map((m) => Number(m[1]));
    r.exigir(
      contagemDasPastas.length === 4 && contagemDasPastas.reduce((n, x) => n + x, 0) === projetosDistintos1,
      `a aba Jurado mostra as quatro pastas, somando os ${projetosDistintos1} estandes (${contagemDasPastas.join(" + ")})`,
    );
    await semAnimacao(q);
    await r.registrar(p, "pastas-no-perfil", {
      titulo: "As pastas, na aba Jurado",
      mostra: `“${COPY.suasPastas}”: as quatro pastas com quantos estandes cada uma guarda (${contagemDasPastas.join(", ")}).`,
      prova: "É a criança vendo o que ela mesma separou — sem certo nem errado: o nível é do professor, no painel de habilidades.",
    });
    await aba("Início").click();
    await artigos1.first().waitFor({ timeout: 10_000 });

    // ── ESTUDANTE 1: a cédula de quatro elementos, e o lacre ─────────────
    const votado1 = feed1.posts.find((x) => x.area === areaCurtida && x.tipo === "apresentacao");
    const folha1 = await abrirACedula(q);
    r.exigir(
      (await folha1.getByRole("radiogroup").count()) === 1 &&
        (await folha1.locator("textarea, input[type=text]").count()) === 0 &&
        (await folha1.getByRole("group", { name: "Sua certeza" }).getByRole("button").count()) === 2,
      "a cédula tem quatro elementos: o título, os projetos do feed, a certeza (Sim / Com certeza) e o botão — sem justificativa",
    );
    const opcoesDaCedula = await folha1.getByRole("radiogroup", { name: "Projetos do seu feed" }).getByRole("radio").count();
    r.exigir(
      opcoesDaCedula === projetosDistintos1,
      `a cédula só oferece os projetos que o feed serviu (${opcoesDaCedula} opções, ${projetosDistintos1} projetos)`,
    );
    await marcarOVoto(folha1, votado1.titulo, "Com certeza");
    await r.registrar(p, "cedula", {
      titulo: "A cédula, com quatro elementos",
      mostra: "A folha da cédula: o título, os projetos do feed, “Você considera que avaliou com justiça…” com Sim / Com certeza, e Confirmar Voto Oficial.",
      prova: "As duas respostas afirmam certeza de propósito: é a aposta que a Galeria Oculta vai confrontar.",
    });
    await lacrar(q, folha1);

    r.exigir(!CARIMBO_OU_ACERTO.test(await q().locator(".tela").innerText()), "depois do voto, a tela não diz quantos estandes ficaram na pasta certa");
    r.exigir((await q().getByText(COPY.separacaoQueSaiu).count()) === 0, `a tela “${COPY.separacaoQueSaiu}” saiu: o voto leva direto ao lacre`);
    await conferirOPico(q, "o primeiro estudante");
    await r.registrar(p, "lacre-e-espera", {
      titulo: "O lacre, e a espera",
      mostra: "O brasão, “Voto Registrado e Lacrado — Protocolo #…” e a ordem da comissão, e nada mais.",
      prova: "O voto é o LATCH 1, e a separação das pastas é corrigida nele: só existem quando a api confirma. Quem tira a criança daqui é o polling do gate.",
    });
    await p.reload({ waitUntil: "domcontentloaded" });
    await plenaria(q).waitFor({ timeout: 40_000 });
    r.exigir((await q().locator("article[data-post-id]").count()) === 0, "o F5 depois do voto volta à espera — o feed não volta");

    // ── ESTUDANTE 2: só salva; a cédula parada; o ocioso ─────────────────
    const p2 = await r.pagina("estudante-2", { viewport: { width: 1280, height: 950 } });
    await entrarPelaGrade(p2, SEGUNDO.login);
    const q2 = frameDe(p2);
    await q2().getByRole("dialog", { name: COPY.topo }).getByRole("button", { name: COPY.entrar }).click({ timeout: 60_000 });
    await q2().locator("article[data-post-id]").nth(3).waitFor({ timeout: 20_000 });
    r.exigir(!(await botaoDaCedula(q2).isVisible()), "antes do 10º post (ou dos 8 minutos) o botão da cédula não aparece");
    const salvos = [];
    const categorias2 = (await sessaoDe(p2)).categorias;
    /* Os três primeiros vão para uma pasta ERRADA, de propósito: 7 de 10 é "em processo". */
    await rolarAteOsDez(q2, async (postId) => {
      if (salvos.length >= 3) return;
      const post = (await sessaoDe(p2)).feed.posts.find((x) => x.id === postId);
      const errada = categorias2.find((c) => c.area !== post?.area);
      await salvarNaPasta(p2, q2, postId, errada.area, errada.nome);
      salvos.push(postId);
    });
    const feed2 = (await sessaoDe(p2)).feed;
    r.exigir(feed2.curtidos.length === 0 && feed2.salvos.length === 3, `o segundo estudante só salvou (${feed2.salvos.length} salvos, ${feed2.curtidos.length} curtidas)`);
    const distribuicao2 = distribuicao(postsPorArea(feed2.posts));
    r.exigir(
      feed2.posts.length === 10 && new Set(feed2.posts.map((x) => x.projetoId)).size === 10,
      `o feed de quem só salvou também tem dez projetos distintos (${new Set(feed2.posts.map((x) => x.projetoId)).size})`,
    );
    r.exigir(
      JSON.stringify(distribuicao2) === "[3,3,2,2]",
      `salvar não pesa: quem só salvou vê as quatro áreas misturadas, 3/3/2/2 (${distribuicao2.join("/")})`,
    );

    /* A CÉDULA PARADA: 60 s sem toque com ela aberta. A espera é o desfecho (o
       aviso), correndo contra o erro da tela — não um relógio cego. */
    const folha2 = await abrirACedula(q2);
    const alertaDaCedula = folha2.getByRole("alert");
    await esperarOuFalharCedo(alertaDaCedula.getByText(COPY.inatividade), q2().locator(ALERTA_DE_ERRO), {
      timeout: 90_000,
      oQue: "o aviso de 60 s com a cédula aberta",
    });
    const caixaDoAlerta = await alertaDaCedula.boundingBox();
    const caixaDosProjetos = await folha2.getByRole("radiogroup").boundingBox();
    r.exigir(
      Boolean(caixaDoAlerta && caixaDosProjetos && caixaDoAlerta.y < caixaDosProjetos.y),
      "o aviso de inatividade fica NO TOPO da cédula, acima dos projetos",
    );
    await r.registrar(p2, "cedula-parada", {
      titulo: "Parado na cédula",
      mostra: `A cédula aberta há mais de um minuto, com o aviso no topo: “${COPY.inatividade}”.`,
      prova: "O aviso é role=alert, aceso pela casca; o batimento de 15 s leva a mesma marca ao painel da professora.",
    });
    const painelOcioso = await esperarNaApi(
      prof,
      `${caminhoDaTurma}/painel`,
      (c) => (c?.linhas ?? []).some((l) => l.usuario === SEGUNDO.login && l.ocioso),
      { oQue: "o ocioso no painel da professora", timeout: 45_000 },
    );
    r.exigir(painelOcioso.resumo.ociosos >= 1, `o painel conta ${painelOcioso.resumo.ociosos} parado(s) na cédula`);
    await prof.reload({ waitUntil: "domcontentloaded" });
    const linhaOciosa = prof.locator("main").getByRole("row").filter({ hasText: SEGUNDO.login });
    await linhaOciosa.locator("[data-ocioso]").first().waitFor({ timeout: 30_000 });
    await linhaOciosa.first().scrollIntoViewIfNeeded();
    await r.registrar(prof, "painel-ocioso", {
      titulo: "O sinalizador de ociosos",
      mostra: `O ícone de alerta ao lado de ${SEGUNDO.login} na folha, e a métrica “Parados na cédula”.`,
      prova: "Cédula aberta e mais de 60 s sem toque; o ícone tem texto para leitor de tela e some sozinho quando ela volta.",
    });

    /* A CÉDULA TRAVADA: o segundo só guardou três estandes nas pastas. */
    const faltamNaCedula = (await sessaoDe(p2)).feed.semPasta;
    await marcarOVoto(folha2, null, "Sim");
    r.exigir(
      faltamNaCedula === 7 && (await folha2.getByText(COPY.faltam(faltamNaCedula)).count()) > 0,
      `com estande fora das pastas, a cédula diz “${COPY.faltam(faltamNaCedula)}”`,
    );
    r.exigir(
      await folha2.getByRole("button", { name: "Confirmar Voto Oficial" }).isDisabled(),
      "e o voto fica travado, mesmo com o projeto e a certeza escolhidos",
    );
    r.provocado(
      /juri-estadual\/voto/,
      "a suíte manda o voto pela api com estande fora das pastas, de propósito: é a trava da separação no voto (ADR-176)",
    );
    const recusa = await mandarApi(p2, "/juri-estadual/voto", {
      projetoId: feed2.posts[0].projetoId,
      conviccao: "examinei_bem",
    });
    r.exigir(
      recusa.status === 409 && recusa.corpo?.codigo === "estandes-sem-pasta",
      `a api recusa o voto sem as pastas: 409 estandes-sem-pasta (veio ${recusa.status} ${recusa.corpo?.codigo ?? ""})`,
    );
    await semAnimacao(q2);
    await r.registrar(p2, "cedula-sem-pastas", {
      titulo: "A cédula espera as pastas",
      mostra: `A cédula com o projeto e a certeza escolhidos, “${COPY.faltam(faltamNaCedula)}” no topo e Confirmar Voto Oficial apagado.`,
      prova:
        "A separação da EF06CO01 é corrigida NO voto (ADR-176): a cédula só lacra com todo estande visto numa pasta. " +
        "A tela trava o botão, e a api recusa com 409 se a tela errar.",
    });
    await p2.keyboard.press("Escape");
    await folha2.waitFor({ state: "hidden", timeout: 10_000 });
    const estandesSeparados2 = await guardarNasPastas(p2, q2, 0);
    r.exigir((await sessaoDe(p2)).feed.semPasta === 0, "guardados os outros sete, não falta pasta nenhuma");
    const folha2b = await abrirACedula(q2);
    await marcarOVoto(folha2b, null, "Sim");
    r.exigir((await folha2b.getByText(/^Antes de votar/).count()) === 0, "com tudo nas pastas, o aviso some e o voto destrava");
    await lacrar(q2, folha2b);
    await conferirOPico(q2, "o segundo estudante");

    // ═══ PROFESSORA: a lousa do pico, e Liberar Auditoria ════════════════
    const painelNoPico = await esperarNaApi(
      prof,
      `${caminhoDaTurma}/painel`,
      (c) => (c?.resumo?.computadores?.votaram ?? 0) >= 2 && (c?.resumo?.separaram ?? 0) >= 2,
      { oQue: "os dois votos e as duas separações (as pastas, corrigidas no voto) no painel da aula" },
    );
    const { resumo } = painelNoPico;
    r.exigir(
      painelNoPico.linhas.filter((l) => [PRIMEIRO.login, SEGUNDO.login].includes(l.usuario)).every((l) => l.separou === true),
      "a linha de cada um diz que SEPAROU — e só isso: o acerto não vem na folha",
    );
    r.exigir(
      JSON.stringify(painelNoPico.linhas).match(/acert/i) === null,
      "nenhuma linha do painel carrega acerto da separação",
    );
    r.exigir(
      resumo.votosPorArea.reduce((n, a) => n + a.votos, 0) === 2,
      `os votos por área somam 2 (${resumo.votosPorArea.map((a) => `${a.area}=${a.votos}`).join(", ")})`,
    );
    await prof.reload({ waitUntil: "domcontentloaded" });
    const lousa = prof.locator("[data-painel-para-projetar]");
    await lousa.waitFor({ timeout: 30_000 });
    const fraseDoPico = fraseDosVotos(resumo.computadores, resumo.porComputador);
    r.exigir((await prof.locator("main").innerText()).includes(fraseDoPico), `o painel diz “${fraseDoPico}”`);
    r.exigir((await lousa.locator("[data-votos-por-area] li").count()) === 4, "a lousa lista os votos das quatro áreas");
    const botaoDaAula = prof.locator('[data-gate="galeria"]');
    r.exigir((await botaoDaAula.innerText()).includes("Liberar Auditoria"), "o botão da aula é “Liberar Auditoria”");
    const concentracaoNaLousa = prof.locator("[data-concentracao-do-feed]");
    r.exigir(
      (await concentracaoNaLousa.count()) === 0 && !/Quem curtiu algum post|Invisibilidade média/.test(await lousa.innerText()),
      "no pico a lousa NÃO mostra a concentração do feed (nem a antiga invisibilidade média): projetada antes da auditoria, ela diria que o feed se adaptou",
    );
    await lousa.scrollIntoViewIfNeeded();
    await r.registrar(prof, "lousa-do-pico", {
      titulo: "A lousa do pico",
      mostra: `“${fraseDoPico}”, o gráfico dos votos por área e o botão Liberar Auditoria.`,
      prova: "Sem nome: a lousa diz como a turma se dividiu, nunca quem votou em quê.",
      inteira: true,
    });
    await apertar(prof, "galeria");
    r.exigir((await prof.locator("[data-gate]").count()) === 0, "depois de Liberar Auditoria, não há botão de etapa: ele não volta e não há rodada de desvio");

    /* A CONCENTRAÇÃO do feed, na lousa, só agora: entre quem votou, a média da
       fração do feed na área mais vista — de quem curtiu e de quem não curtiu.
       O número é da api (`resumo.concentracao`); a tela o projeta. */
    const painelDaAuditoria = await esperarNaApi(
      prof,
      `${caminhoDaTurma}/painel`,
      (c) => c?.resumo?.concentracao?.curtiram != null && c?.resumo?.concentracao?.naoCurtiram != null,
      { oQue: "a concentração do feed no painel" },
    );
    const concentracao = painelDaAuditoria.resumo.concentracao;
    r.exigir(
      concentracao.curtiram === 70 && concentracao.naoCurtiram === 30,
      `a concentração da api: quem curtiu teve 70% do feed numa área só, quem não curtiu 30% (veio ${concentracao.curtiram}% × ${concentracao.naoCurtiram}%)`,
    );
    await esperarOuFalharCedo(concentracaoNaLousa, prof.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "a concentração do feed na lousa, depois de Liberar Auditoria",
    });
    const textoDaConcentracao = (await concentracaoNaLousa.innerText()).replace(/\s+/g, " ");
    r.exigir(
      textoDaConcentracao.includes("Quem curtiu algum post") &&
        textoDaConcentracao.includes("Quem não curtiu nenhum") &&
        textoDaConcentracao.includes(`${concentracao.curtiram}%`) &&
        textoDaConcentracao.includes(`${concentracao.naoCurtiram}%`),
      `a lousa projeta os dois MetricCards — “Quem curtiu algum post” ${concentracao.curtiram}% e “Quem não curtiu nenhum” ${concentracao.naoCurtiram}% — com os números da api`,
    );
    await concentracaoNaLousa.scrollIntoViewIfNeeded();
    await r.registrar(prof, "lousa-da-concentracao", {
      titulo: "A lousa depois da auditoria: a concentração do feed",
      mostra:
        `“Quanto do feed caiu numa área só”: Quem curtiu algum post ${concentracao.curtiram}%, Quem não curtiu ` +
        `nenhum ${concentracao.naoCurtiram}%, e a frase que a professora lê em voz alta.`,
      prova:
        "Com 40 estandes, todo computador fica com 30 de fora — a antiga “invisibilidade média” seria sempre a " +
        "mesma. O contraste é QUAIS áreas sumiram: quem curtiu teve quase todo o feed numa área. Só agregado, sem " +
        "nome, e só depois do botão: no pico, ele entregaria a descoberta da galeria.",
      detalhe: `concentracao ${concentracao.curtiram}/${concentracao.naoCurtiram}`,
    });

    // ═══ A GALERIA OCULTA: 30 de 40 para os dois — o que muda é QUAIS ═════
    const tituloDaGaleria = (qq) => qq().getByRole("heading", { name: "Galeria Oculta da Mostra" }).first();
    await tituloDaGaleria(q).waitFor({ timeout: 40_000 });
    await tituloDaGaleria(q2).waitFor({ timeout: 40_000 });
    const galeria1 = await lerApi(p, "/juri-estadual/galeria");
    const galeria2 = await lerApi(p2, "/juri-estadual/galeria");
    if (galeria1.status !== 200 || galeria2.status !== 200) {
      throw new Error(`a galeria não abriu pela api (HTTP ${galeria1.status} e ${galeria2.status})`);
    }
    const g1 = galeria1.corpo;
    const g2 = galeria2.corpo;
    const categorias1 = (await sessaoDe(p)).categorias;
    const nomeDa = (area) => categorias1.find((c) => c.area === area)?.nome ?? area;
    const chipDa = (area) => `#${(categorias1.find((c) => c.area === area)?.hashtag ?? area).replace(/^#+/, "")}`;
    const porAreaEmTexto = (porArea) => porArea.map((a) => `${nomeDa(a.area)} ${a.vistos}/${a.total}`).join(", ");
    const contagemEmTexto = (contagem) => Object.entries(contagem).map(([area, n]) => `${nomeDa(area)} ${n}`).join(", ");

    /* "30 de 40" — e o MESMO número para quem curtiu e para quem não curtiu. */
    const fora1 = g1.invisibilidade;
    const fora2 = g2.invisibilidade;
    r.exigir(
      fora1.ocultos === 30 && fora1.total === 40 && fora2.ocultos === 30 && fora2.total === 40,
      `30 de 40 para os DOIS: quem curtiu (${fora1.ocultos} de ${fora1.total}) e quem não curtiu (${fora2.ocultos} de ${fora2.total})`,
    );
    r.exigir(
      (await q().getByText(COPY.badge(fora1.ocultos, fora1.total)).count()) > 0,
      `a galeria do primeiro diz o número da api: “${COPY.badge(fora1.ocultos, fora1.total)}”`,
    );
    r.exigir(
      (await q2().getByText(COPY.badge(fora2.ocultos, fora2.total)).count()) > 0,
      `a galeria do segundo diz o mesmo: “${COPY.badge(fora2.ocultos, fora2.total)}”`,
    );
    r.exigir(
      !/\d\s*%/.test(await q().locator(".galeria").innerText()),
      "nenhuma porcentagem na galeria: a moldura é “X de Y estandes”",
    );

    /* POR ÁREA: o que chegou ao feed de cada um — e é aí que os dois diferem. */
    const confereComOFeed = (galeria, feed) => {
      const reais = postsPorArea(feed.posts);
      return galeria.porArea.every((a) => a.vistos === (reais[a.area] ?? 0) && a.total === 10);
    };
    r.exigir(
      confereComOFeed(g1, feed1) && confereComOFeed(g2, feed2),
      "o “por área” da api é o feed REAL de cada um, sobre os dez estandes de cada área",
    );
    const vistos1 = Object.fromEntries(g1.porArea.map((a) => [a.area, a.vistos]));
    const vistos2 = Object.fromEntries(g2.porArea.map((a) => [a.area, a.vistos]));
    r.exigir(
      vistos1[areaCurtida] === 7 && JSON.stringify(distribuicao(vistos1)) === "[7,1,1,1]",
      `quem curtiu viu 7 de 10 da área curtida e 1 de cada outra (${porAreaEmTexto(g1.porArea)})`,
    );
    r.exigir(
      JSON.stringify(distribuicao(vistos2)) === "[3,3,2,2]",
      `quem não curtiu viu as quatro áreas misturadas, 3/3/2/2 (${porAreaEmTexto(g2.porArea)})`,
    );
    /* O CONTRAFACTUAL: o feed que ESTA sessão teria tido sem curtidas e sem
       permanências (a mesma semente, o mesmo motor). Para quem não curtiu, é o
       próprio feed; para quem curtiu, é outro. */
    const contagemSem = (g) => Object.fromEntries(g.semCurtidas.map((a) => [a.area, a.posts.length]));
    const sem1 = contagemSem(g1);
    const sem2 = contagemSem(g2);
    const projetosSem2 = new Set(g2.semCurtidas.flatMap((a) => a.posts));
    const projetosReais2 = new Set(feed2.posts.map((x) => x.projetoId));
    r.exigir(
      projetosSem2.size === projetosReais2.size && [...projetosReais2].every((id) => projetosSem2.has(id)),
      `para quem NÃO curtiu, “sem as suas curtidas” é o próprio feed real: os mesmos ${projetosReais2.size} projetos (${contagemEmTexto(sem2)})`,
    );
    const reais1 = postsPorArea(feed1.posts);
    const somaSem1 = Object.values(sem1).reduce((n, x) => n + x, 0);
    r.exigir(
      somaSem1 === 10 && g1.semCurtidas.some((a) => a.posts.length !== (reais1[a.area] ?? 0)),
      `para quem curtiu, “sem as suas curtidas” é OUTRO feed: ${contagemEmTexto(sem1)} — contra o real ${contagemEmTexto(reais1)}`,
    );
    /* Na TELA, a contagem por área e o contraste saíram (ADR-176): do badge, direto à busca. */
    for (const [qq, quem] of [
      [q, "do primeiro"],
      [q2, "do segundo"],
    ]) {
      r.exigir(
        (await qq().getByText(COPY.porAreaQueSaiu).count()) === 0 && (await qq().getByText(COPY.semCurtidasQueSaiu).count()) === 0,
        `a galeria ${quem} não mostra mais “${COPY.porAreaQueSaiu}” nem “${COPY.semCurtidasQueSaiu}”`,
      );
    }
    const ordemNaGaleria = await q()
      .locator(".galeria")
      .evaluate((el) => [...el.children].map((c) => (c.matches("[role=search], input, .unv-search-field") || c.querySelector("input") ? "busca" : c.tagName.toLowerCase())));
    const posicaoDaBusca = ordemNaGaleria.indexOf("busca");
    r.exigir(
      posicaoDaBusca > 0 && !ordemNaGaleria.slice(0, posicaoDaBusca).includes("ul"),
      `entre o badge e a busca não há mais lista nenhuma (${ordemNaGaleria.slice(0, posicaoDaBusca + 1).join(" → ")})`,
    );

    /* A GRADE é dos ocultos de UMA área: abre na que mais ficou fora. */
    const areaInicial1 = areaComMaisOcultos(g1.porArea);
    const grade1 = q().getByRole("list", { name: COPY.gradeOculta(nomeDa(areaInicial1)) });
    await grade1.waitFor({ timeout: 10_000 }).catch(() => {
      throw new Error(`a grade não abriu na área que mais ficou fora (${nomeDa(areaInicial1)})`);
    });
    const ocultosIniciais1 = g1.projetos.filter((x) => x.area === areaInicial1 && !x.exibidoNoSeuFeed).length;
    const itensDaGrade = await grade1.getByRole("listitem").count();
    const colunas = await grade1.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
    r.exigir(
      areaInicial1 !== areaCurtida && itensDaGrade === ocultosIniciais1,
      `a grade abre na área que mais ficou fora (${nomeDa(areaInicial1)}), com um item por oculto DELA — ${itensDaGrade} de ${ocultosIniciais1}, não os ${fora1.ocultos} soltos`,
    );
    r.exigir(colunas === 3, `a grade da galeria tem três colunas (${colunas}), ${Math.ceil(itensDaGrade / 3)} linhas`);
    const manter1 = q().getByRole("button", { name: COPY.manter });
    r.exigir(await manter1.isDisabled(), "antes de abrir um oculto, “Manter meu voto inicial” fica desligado");
    r.exigir((await q().getByText(COPY.manterTravado).count()) > 0, "e a tela diz por quê");
    await semAnimacao(q);
    await r.registrar(p, "galeria-oculta", {
      titulo: "A Galeria Oculta: o que sumiu, por área",
      mostra:
        `A auditoria da comissão, o voto lacrado, “${COPY.badge(fora1.ocultos, fora1.total)}”, logo abaixo a busca e os ` +
        `chips, e a grade de três colunas com os ocultos de ${nomeDa(areaInicial1)}; embaixo, os dois botões da ` +
        "revisão, com Manter desligado.",
      prova:
        "Com 40 estandes e dez posts, o total escondido é igual para todos — a prova é QUAL área sumiu, e a grade " +
        "abre na que mais ficou fora. A contagem por área e o contraste saíram da tela (ADR-176); os números " +
        "seguem calculados pelo servidor, sobre o feed DESTA criança.",
      detalhe: `${fora1.ocultos} de ${fora1.total} · por área ${porAreaEmTexto(g1.porArea)} · sem curtidas ${contagemEmTexto(sem1)}`,
      inteira: true,
    });

    const areaInicial2 = areaComMaisOcultos(g2.porArea);
    const grade2 = q2().getByRole("list", { name: COPY.gradeOculta(nomeDa(areaInicial2)) });
    await grade2.waitFor({ timeout: 10_000 });
    const ocultosIniciais2 = g2.projetos.filter((x) => x.area === areaInicial2 && !x.exibidoNoSeuFeed).length;
    r.exigir(
      (await grade2.getByRole("listitem").count()) === ocultosIniciais2,
      `a grade do segundo abre na área dele que mais ficou fora (${nomeDa(areaInicial2)}, ${ocultosIniciais2} ocultos)`,
    );
    await semAnimacao(q2);
    await r.registrar(p2, "galeria-de-quem-nao-curtiu", {
      titulo: "A mesma galeria, o mesmo total — outras áreas",
      mostra:
        `A galeria de quem só salvou: o mesmo “${COPY.badge(fora2.ocultos, fora2.total)}”, e a grade aberta em ` +
        `${nomeDa(areaInicial2)} — o feed dele teve ${porAreaEmTexto(g2.porArea)}.`,
      prova:
        `${porAreaEmTexto(g1.porArea)} contra ${porAreaEmTexto(g2.porArea)}: o total não distingue os dois; as ` +
        "áreas, sim. Foram as curtidas, não o acaso, que esconderam uma parte da mostra e não outra.",
      inteira: true,
    });

    // ── ESTUDANTE 1: a hashtag de uma categoria fora da bolha, dois ocultos, Manter ──
    /* Só o TOQUE no chip conta como busca: abrir a galeria, que já mostra a
       grade de uma área, não é busca nenhuma. */
    const linhaAntesDoChip = (await lerApi(prof, `${caminhoDaTurma}/painel`)).corpo?.linhas?.find((l) => l.usuario === PRIMEIRO.login);
    r.exigir(
      linhaAntesDoChip?.buscou === false,
      `abrir a galeria não conta como busca: ninguém tocou num chip (buscou: ${JSON.stringify(linhaAntesDoChip?.buscou ?? null)})`,
    );
    const areaBuscada = categorias1.map((c) => c.area).find((a) => a !== areaCurtida && a !== areaInicial1);
    const categoriaBuscada = categorias1.find((c) => c.area === areaBuscada);
    const chip = chipDa(areaBuscada);
    const botaoDoChip = q().getByRole("group", { name: "Hashtags da mostra" }).getByRole("button", { name: chip, exact: true });
    await botaoDoChip.click();
    const gradeDaArea = q().getByRole("list", { name: COPY.gradeOculta(categoriaBuscada.nome) });
    await gradeDaArea.waitFor({ timeout: 10_000 });
    const ocultosDaBusca = g1.projetos.filter((x) => x.area === areaBuscada && !x.exibidoNoSeuFeed);
    r.exigir(
      (await gradeDaArea.getByRole("listitem").count()) === ocultosDaBusca.length && (await botaoDoChip.getAttribute("aria-pressed")) === "true",
      `o chip ${chip} troca a grade para os ocultos de ${categoriaBuscada.nome} (${ocultosDaBusca.length}), e fica marcado`,
    );
    if (!r.exigir(ocultosDaBusca.length >= 2, `a categoria ${chip} tem ao menos dois projetos que o feed escondeu (${ocultosDaBusca.length})`)) return;
    const inspecionar = async (qq, titulo) => {
      await qq().getByRole("button", { name: `Inspecionar Projeto: ${titulo}` }).click();
      const ficha = qq().getByRole("dialog", { name: COPY.ficha });
      await ficha.waitFor({ timeout: 10_000 });
      await ficha.getByText(titulo).first().waitFor({ timeout: 10_000 });
      return ficha;
    };
    const ficha1 = await inspecionar(q, ocultosDaBusca[0].titulo);
    await semAnimacao(q);
    await r.registrar(p, "galeria-ficha", {
      titulo: "A ficha de auditoria",
      mostra: `Depois do chip ${chip} (a grade trocou para ${categoriaBuscada.nome}), a ficha de “${ocultosDaBusca[0].titulo}”: as três fotos, o resumo técnico, as hashtags e Voltar à Galeria.`,
      prova: "A busca por hashtag e a ficha de auditoria são a experiência da galeria: elas não marcam habilidade — a EF06CO01 já foi medida no voto, pelas pastas.",
    });
    await ficha1.getByRole("button", { name: COPY.voltar }).click();
    await ficha1.waitFor({ state: "detached", timeout: 10_000 });
    r.exigir(!(await manter1.isDisabled()), "aberto um oculto, “Manter meu voto inicial” acende");
    const ficha1b = await inspecionar(q, ocultosDaBusca[1].titulo);
    await ficha1b.getByRole("button", { name: COPY.voltar }).click();
    await ficha1b.waitFor({ state: "detached", timeout: 10_000 });
    await manter1.click();

    // ── ESTUDANTE 2: busca por texto, e o voto revisado, filtrado por área ──
    const categoria2 = (await sessaoDe(p2)).categorias[0];
    const busca = q2().getByRole("searchbox", { name: COPY.busca }).or(q2().getByRole("textbox", { name: COPY.busca })).first();
    await busca.click();
    await busca.pressSequentially(categoria2.nome);
    const gradeDaBusca2 = q2().getByRole("list", { name: COPY.gradeBusca });
    await gradeDaBusca2.waitFor({ timeout: 10_000 });
    r.exigir((await gradeDaBusca2.getByRole("listitem").count()) > 0, `a busca por texto (“${categoria2.nome}”) encontra projetos`);
    await q2().getByRole("button", { name: COPY.confirmarRevisao }).first().click();
    const folhaDaRevisao = q2().getByRole("dialog", { name: COPY.revisao });
    await folhaDaRevisao.waitFor({ timeout: 10_000 });
    const voto2 = (await sessaoDe(p2)).voto?.projetoId ?? null;
    const areaDoVoto2 = g2.projetos.find((x) => x.id === voto2)?.area ?? null;
    const opcoesNaArea = (area) => g2.projetos.filter((x) => x.area === area && x.id !== voto2).length;
    const grupoDaTroca = folhaDaRevisao.getByRole("radiogroup", { name: new RegExp(`^${escaparRegex(COPY.grupoDaRevisao)}`) });
    /* A lista abre na área da grade (a busca por texto não troca o chip). */
    await grupoDaTroca.waitFor({ timeout: 10_000 });
    const nomeDoGrupo = async () => (await grupoDaTroca.getAttribute("aria-label")) ?? "";
    r.exigir(
      (await nomeDoGrupo()) === `${COPY.grupoDaRevisao}: ${nomeDa(areaInicial2)}` &&
        (await grupoDaTroca.getByRole("radio").count()) === opcoesNaArea(areaInicial2),
      `a troca do voto abre FILTRADA na área da grade: “${await nomeDoGrupo()}”, ${await grupoDaTroca.getByRole("radio").count()} estandes (esperado ${opcoesNaArea(areaInicial2)})`,
    );
    const outraArea = areaDoVoto2 && areaDoVoto2 !== areaInicial2 ? areaDoVoto2 : categorias1.map((c) => c.area).find((a) => a !== areaInicial2);
    await folhaDaRevisao.getByRole("group", { name: "Hashtags da mostra" }).getByRole("button", { name: chipDa(outraArea), exact: true }).click();
    await q2()
      .getByRole("radiogroup", { name: `${COPY.grupoDaRevisao}: ${nomeDa(outraArea)}` })
      .waitFor({ timeout: 10_000 });
    const opcoesDepoisDoChip = await grupoDaTroca.getByRole("radio").count();
    r.exigir(
      opcoesDepoisDoChip === opcoesNaArea(outraArea),
      `o chip troca a área da lista: ${nomeDa(outraArea)} com ${opcoesDepoisDoChip} estandes${outraArea === areaDoVoto2 ? " — os dez dela menos o do voto lacrado" : ""} (esperado ${opcoesNaArea(outraArea)})`,
    );
    await grupoDaTroca.getByRole("radio").first().click();
    await semAnimacao(q2);
    await r.registrar(p2, "revisao-do-voto", {
      titulo: "O voto revisado, área por área",
      mostra:
        `A janela extraordinária de revisão: os chips das quatro áreas, a lista de ${nomeDa(outraArea)} ` +
        `(${opcoesDepoisDoChip} estandes${outraArea === areaDoVoto2 ? ", sem o do voto lacrado" : ""}) e Confirmar Voto Revisado.`,
      prova:
        "Dois botões (melhoria 6): manter ou confirmar um voto revisado. Trinta e nove opções soltas não se escolhem " +
        "num celular: a lista é filtrada pelos mesmos chips de área. A api grava o voto final ao lado do lacrado.",
    });
    await folhaDaRevisao.getByRole("button", { name: COPY.confirmarRevisao }).click();
    // ═══ ESTUDANTE 1: a Etapa 5 — o Léo e a regra SE … ENTÃO ═════════════
    await q().getByText(COPY.leo).first().waitFor({ timeout: 30_000 });
    const sessao1 = await sessaoDe(p);
    r.exigir(sessao1.revisao?.acao === "manter", "a api guardou que o primeiro manteve o voto");
    r.exigir(
      sessao1.cadeia?.se?.length === 3 && sessao1.cadeia?.entao?.length === 3 && sessao1.cadeia?.revelacao === null,
      "a regra desce com três peças de cada lado e SEM a revelação antes do envio",
    );
    r.exigir(!/"certa"/.test(JSON.stringify(sessao1.cadeia)), "nenhuma peça diz se é a certa");
    r.exigir((await q().locator(".par__lado").count()) === 0, "o par simulado e a cadeia de quatro blocos saíram (ADR-174)");
    /* O gabarito vem do material do PROFESSOR — a criança nunca o recebe. */
    const material = await lerApi(prof, "/juri-estadual/professor/material");
    if (material.status !== 200) throw new Error(`o material do professor não veio (HTTP ${material.status})`);
    const pecaCerta = (lado) => material.corpo.pecas[lado].find((x) => x.certa).texto;
    const pecaErrada = (lado) => material.corpo.pecas[lado].find((x) => !x.certa).texto;
    const escolherARegra = async (qq, se, entao) => {
      await qq().getByRole("radiogroup", { name: COPY.grupoDoSe }).getByRole("radio", { name: se, exact: true }).click();
      await qq().getByRole("radiogroup", { name: COPY.grupoDoEntao }).getByRole("radio", { name: entao, exact: true }).click();
    };
    await escolherARegra(q, pecaCerta("se"), pecaCerta("entao"));
    await semAnimacao(q);
    await r.registrar(p, "regra-montada", {
      titulo: "A regra SE … ENTÃO",
      mostra: "A tela da escola: a ponte do Léo, as três condições (SE) e as três ações (ENTÃO), a regra montada e Enviar a Regra.",
      prova:
        "A EF06CO03 (ADR-174): construir a instrução que o programa executou, não só reconhecê-la. As peças descem " +
        "embaralhadas e com ids opacos; o servidor corrige, e é uma tentativa só.",
      inteira: true,
    });
    await q().getByRole("button", { name: COPY.enviarRegra }).click();
    await q().getByText(COPY.regraCerta).first().waitFor({ timeout: 15_000 });
    const revelacao1 = (await sessaoDe(p)).cadeia?.revelacao;
    r.exigir(
      revelacao1?.motivo === "curtidas" && revelacao1?.area === areaCurtida,
      `a revelação liga a regra ao feed DELE: curtiu ${nomeDa(areaCurtida)} (veio ${revelacao1?.motivo} / ${revelacao1?.area})`,
    );
    const textoDaRevelacao = await q().locator("body").innerText();
    r.exigir(textoDaRevelacao.includes(chipDa(areaCurtida)), `a revelação cita a hashtag da área que ele curtiu (${chipDa(areaCurtida)})`);
    r.exigir(!CARIMBO_OU_ACERTO.test(textoDaRevelacao), "a revelação mostra a regra certa sem dizer “acertou” ou “errou”");
    await semAnimacao(q);
    await r.registrar(p, "regra-revelada", {
      titulo: "A regra certa, ligada ao feed dele",
      mostra: `A regra que ele montou, a que o aplicativo seguiu, e “Depois que você curtiu posts de ${chipDa(areaCurtida)}…”.`,
      prova: "A revelação só desce depois do envio, e diz o que a regra fez NESTE feed — no tom de “pode deixar o feed menos variado”, não de bolha inevitável.",
      inteira: true,
    });
    await q().getByRole("button", { name: COPY.avancar }).click();

    // ═══ ESTUDANTE 1: a regra CONCLUI (ADR-176: o caso Mariana saiu) ══════
    await q().getByText(COPY.fimTitulo).first().waitFor({ timeout: 20_000 });
    const sessaoNoFim = await sessaoDe(p);
    r.exigir(sessaoNoFim.concluida === true && sessaoNoFim.passo === "fim", "a regra enviada conclui a missão — sem o caso Mariana");
    r.exigir(!("mariana" in sessaoNoFim) && (await q().getByText(/Mariana/).count()) === 0, "o caso Mariana não existe mais: nem na sessão, nem na tela");
    const faixa = q().getByRole("region", { name: COPY.infografico });
    await faixa.waitFor({ timeout: 10_000 });
    await faixa.scrollIntoViewIfNeeded();
    await semAnimacao(q);
    await r.registrar(p, "fim-faixa-unooria", {
      titulo: "O fim, e a faixa da Unooria",
      mostra: `“${COPY.fimTitulo}” na voz da comissão e, abaixo, o cartão da Unooria “${COPY.infografico}”.`,
      prova: "O fim não tem botão nem nota. O infográfico é da escola (seção unooria do DS, PRD §10.1), não do clone.",
    });

    // ═══ ESTUDANTE 2: o F5 depois da revisão não reabre a galeria ═══════
    await q2().getByText(COPY.leo).first().waitFor({ timeout: 30_000 });
    await p2.reload({ waitUntil: "domcontentloaded" });
    await q2().getByText(COPY.leo).first().waitFor({ timeout: 40_000 });
    r.exigir((await tituloDaGaleria(q2).count()) === 0, "o F5 depois da revisão volta à regra — a galeria não reabre");
    const sessao2 = await sessaoDe(p2);
    r.exigir(
      sessao2.revisao?.acao === "trocar" && sessao2.revisao.projetoId !== sessao2.voto?.projetoId,
      "a api guardou a troca, com o voto final diferente do lacrado",
    );
    /* O segundo acerta só o SE: "em processo". Quem só salvou não fechou bolha: a regra não disparou (ou disparou pelo tempo parado). */
    await escolherARegra(q2, pecaCerta("se"), pecaErrada("entao"));
    await q2().getByRole("button", { name: COPY.enviarRegra }).click();
    await q2().getByText(COPY.regraCerta).first().waitFor({ timeout: 15_000 });
    const revelacao2 = (await sessaoDe(p2)).cadeia?.revelacao;
    r.exigir(
      revelacao2?.motivo === "variado" || revelacao2?.motivo === "permanencia",
      `quem só salvou não curtiu: a revelação não fala de curtidas (veio ${revelacao2?.motivo})`,
    );

    // ═══ PROFESSORA: a folha, as categorias buscadas e as habilidades ═══
    const painelDepois = await esperarNaApi(prof, `${caminhoDaTurma}/painel`, (c) => (c?.resumo?.revisaram ?? 0) >= 2, {
      oQue: "as duas revisões no painel",
    });
    r.exigir(
      painelDepois.resumo.revisao.mantiveram === 1 && painelDepois.resumo.revisao.trocaram === 1,
      `um manteve e um trocou (${JSON.stringify(painelDepois.resumo.revisao)})`,
    );
    const linha1 = painelDepois.linhas.find((l) => l.usuario === PRIMEIRO.login);
    r.exigir(linha1?.separou === true && !("categoriasBuscadas" in (linha1 ?? {})), "a linha diz que separou; as categorias buscadas saíram da folha");
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.locator("[data-revisao-da-turma]").waitFor({ timeout: 30_000 });
    const colunasDaFolha = await prof.locator("main").getByRole("columnheader").allInnerTexts();
    r.exigir(
      !colunasDaFolha.some((c) => /^\s*voto\b|\b(taxa|n[íi]vel|invisibilidade|concentra\w*|pontos|nota|ranking|acerto)\b/i.test(c)),
      `a folha não tem coluna de voto, taxa, concentração nem nível (colunas: ${colunasDaFolha.join(", ")})`,
    );
    const linhaDoPrimeiro = prof.locator("main").getByRole("row").filter({ hasText: PRIMEIRO.login }).first();
    r.exigir(
      colunasDaFolha.some((c) => /Separação/.test(c)) && !colunasDaFolha.some((c) => /Categorias buscadas/.test(c)),
      `a folha tem a coluna “Separação” e não tem mais “Categorias buscadas” (colunas: ${colunasDaFolha.join(", ")})`,
    );
    r.exigir((await linhaDoPrimeiro.innerText()).includes("separou"), "na linha do primeiro, a separação aparece como feita");
    const habilidades = prof.locator("[data-habilidades-do-juri]");
    await habilidades.waitFor({ timeout: 30_000 });
    await habilidades.getByText("EF06CO01").first().waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await habilidades.innerText();
    r.exigir(
      ["EF06CO01", "EF06CO03"].every((codigo) => textoDasHabilidades.includes(codigo)) && !textoDasHabilidades.includes("EF06CO10"),
      "o painel de habilidades mostra EF06CO01 e EF06CO03 — e não a EF06CO10, que saiu (ADR-174; ficha 6, ADR-176)",
    );
    const caminhoDaEvidencia = `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`;
    const nivelDe = (c, quem, codigo) => {
      const e = c?.estudantes?.find((x) => x.nome === quem.nome);
      return Object.values(e?.porRodada ?? {}).map((rodada) => rodada?.[codigo]?.status).find(Boolean) ?? null;
    };
    const evidencia = await esperarNaApi(
      prof,
      caminhoDaEvidencia,
      (c) => nivelDe(c, SEGUNDO, "EF06CO03") !== null,
      { oQue: "as marcas da separação e da regra no painel de habilidades", timeout: 30_000 },
    );
    const esperado = {
      [`${PRIMEIRO.login} EF06CO01`]: [nivelDe(evidencia, PRIMEIRO, "EF06CO01"), "atingiu"],
      [`${PRIMEIRO.login} EF06CO03`]: [nivelDe(evidencia, PRIMEIRO, "EF06CO03"), "atingiu"],
      [`${SEGUNDO.login} EF06CO01 (${estandesSeparados2 - 3} de ${estandesSeparados2} nas pastas certas)`]: [nivelDe(evidencia, SEGUNDO, "EF06CO01"), "em_processo"],
      [`${SEGUNDO.login} EF06CO03`]: [nivelDe(evidencia, SEGUNDO, "EF06CO03"), "em_processo"],
    };
    for (const [quem, [veio, regua]] of Object.entries(esperado)) {
      r.exigir(veio === regua, `${quem}: o painel registra “${veio}”, e a régua dá “${regua}”`);
    }
    await linhaDoPrimeiro.scrollIntoViewIfNeeded();
    await r.registrar(prof, "resultados-e-habilidades", {
      titulo: "A folha da turma, a separação e as habilidades",
      mostra: "Onde cada um está, a coluna “Separação” (as pastas) e o painel de habilidades da BNCC com a EF06CO01 e a EF06CO03.",
      prova: "A folha diz só o progresso — nunca voto, taxa, concentração, acerto ou nível ligados a nome. A concentração mora só na lousa, agregada; o nível (a separação e a regra), no painel de habilidades.",
      inteira: true,
    });

    // ═══ PROFESSORA: o podcast do banco padrão (roteiro fixo) ════════════
    await provarPodcastNaAula(r, prof, {
      blocos: ["Abertura", "Recapitulação da vivência", "A grande revelação", "Provocação e transferência", "Encerramento"],
      vozes: ["Bia", "Rafa"],
      trechos: 5,
      passo: "podcast",
      descricao: "o roteiro fixo do banco padrão (aud-exp06ef1b-01)",
    });
  },
);
