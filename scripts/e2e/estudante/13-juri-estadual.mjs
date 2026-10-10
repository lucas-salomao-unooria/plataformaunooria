import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";
import { esperarFalasDoTema, provarFalasNaCriacao, provarPodcastNaAula } from "../lib/podcast.mjs";

/**
 * O Júri Estadual de Projetos (exp06ef1b 0.4.0, PRD v2 — 6º ano, unidade 1),
 * nas três pontas da sala: a professora prepara e conduz, e dois estudantes da
 * mesma turma julgam a mesma mostra — um curte, o outro não.
 *
 * O que esta suíte cobra, e por que cada item é uma regra do software:
 *
 * 1. **Dois caminhos de preparo** (PRD v2, E0-PROF-01/02): a mostra
 *    personalizada pela IA REAL (Vertex) — parametrizar, gerar, ver os 16
 *    estandes na curadoria e as falas do podcast — e o caminho curto "Usar
 *    Banco Padrão Oficial", sem IA, que é o que vai ao ar para a turma. A
 *    turma roda no banco padrão de propósito: as quatro áreas e as hashtags
 *    são as do PRD, e a prova da saturação não depende do que a IA escreveu.
 *    A geração por IA NÃO tem fixture: falhou, a verificação reprova (memória
 *    "Teste sempre com IA real") e a suíte segue pelo banco padrão.
 * 2. **O crachá é um modal sobre a timeline desfocada**, e a TopBar do
 *    Unoovista traz `@jurado_oficial` em toda tela do clone; a barra tem as
 *    QUATRO abas da copy (Início, Busca, Notificações, Jurado), e a Busca está
 *    fechada durante o julgamento (responde com o aviso, como comentar).
 * 3. **A saturação** (melhoria 1): duas curtidas na mesma área a fazem líder,
 *    e os posts 5 a 10 vêm SÓ dela, repetindo os projetos em outros formatos.
 *    Quem curte chega à galeria com 69–75% da feira escondida; quem não curte,
 *    com bem menos — os dois números são da api, nunca da copy.
 * 4. **Salvar não pesa** (melhoria 6): o segundo estudante salva três posts e
 *    o feed dele segue variado.
 * 5. **A cédula tem quatro elementos** — o título, os projetos do feed, a
 *    certeza ("Sim"/"Com certeza") e o botão —, sem justificativa nem frase
 *    grifada. Parado 60 s com ela aberta, o aviso da comissão acende NO TOPO
 *    dela (`role="alert"`), e o painel da professora põe o ícone de ocioso ao
 *    lado do nome (o batimento de 15 s, melhoria 8).
 * 6. **O lacre e a espera**: o carimbo com o protocolo, e a plenária com três
 *    elementos (brasão, carimbo, ordem). O F5 volta à espera.
 * 7. **Um botão só** ("Liberar Auditoria"), e ele não volta. Não há rodada de
 *    desvio (saiu com a melhoria 6).
 * 8. **A Galeria Oculta**: o badge "{n}% dos projetos da feira ficaram fora do
 *    seu feed" com o número REAL, a grade de três colunas que cresce com os
 *    ocultos, a busca por hashtag e por texto, a ficha de auditoria e a
 *    revisão de DOIS botões — "Manter meu voto inicial" só acende depois de
 *    abrir um oculto. O F5 depois da revisão não reabre a galeria.
 * 9. **Etapa 5, da escola**: o Léo, o par simulado OPOSTO lado a lado (gerado
 *    pelo servidor) e a cadeia com os blocos do 01e; a ordem errada é 422
 *    `ordem-incorreta` e devolve os blocos à bandeja sem dizer qual vaga errou.
 * 10. **Mariana e o Canal B**: os cinco cartões literais (3 de mecanismo, 2 de
 *    atitude), as três enquetes nos Stories sem acerto, e o fim com a faixa da
 *    Unooria (o infográfico "Como os robôs leem nossas curtidas").
 * 11. **O painel da professora** não tem voto, taxa nem nível por criança;
 *    mostra as categorias que cada um buscou, e as três habilidades da ficha
 *    (EF06CO10, EF06CO01, EF06CO03) ficam no painel de habilidades.
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

/** Os rótulos da cadeia (`conteudo.ts#BLOCOS_DA_CADEIA`, 01e doc-03), na ordem certa. */
const CADEIA = [
  "Suas interações com cliques e curtidas no feed",
  "Registro de dados e identificação de padrões",
  "Algoritmo de recomendação escolhendo novos posts",
  "Afunilamento do feed e criação da bolha",
];

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
  badge: (n) => `${n}% dos projetos da feira ficaram fora do seu feed`,
  gradeOculta: "Projetos que não chegaram ao seu feed",
  gradeBusca: "Projetos encontrados",
  busca: "Pesquisar projetos ou categorias...",
  manter: "Manter meu voto inicial",
  manterTravado: "Inspecione ao menos um projeto que não apareceu no seu feed antes de manter o voto.",
  confirmarRevisao: "Confirmar Voto Revisado",
  revisao: "Janela Extraordinária de Revisão de Voto",
  ficha: "Ficha Técnica de Auditoria",
  voltar: "Voltar à Galeria",
  leo: "Você viveu na prática o que Léo investigou no livro didático!",
  cadeiaErro: "A ordem das regras precisa de ajuste. Lembre-se: primeiro vêm suas ações, depois os dados registrados pela máquina.",
  cadeiaCerta: "Cadeia lógica confirmada. O sistema usou suas ações como dados para prever e limitar o que você via.",
  avancar: "Continuar para a Reflexão",
  submeter: "Submeter Análise do Júri",
  confirmadas: ["Resposta registrada na ata do júri", "Dados computados", "Regra conferida"],
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

/** As caixas de dois elementos lado a lado: mesma linha, sem sobreposição. */
async function ladoALado(locator) {
  const caixas = await locator.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  if (caixas.length !== 2) return { ok: false, caixas };
  const [a, b] = caixas;
  return { ok: Math.abs(a.top - b.top) < 4 && a.right <= b.left + 1 && a.width > 60 && b.width > 60, caixas };
}

await suite(
  {
    slug: "estudante/13-juri-estadual",
    papel: "estudante",
    titulo: "O Júri Estadual de Projetos — o feed que esconde a mostra",
    subtitulo: "curtir, lacrar o voto, auditar o que nunca chegou ao feed e montar a regra que escondeu",
    contexto:
      "A criança é jurada de uma mostra científica estadual num feed de rede social: dezesseis projetos de " +
      "quatro áreas. As curtidas dela mudam o que o feed mostra, sem aviso: depois que uma área vence, o resto " +
      "do feed é só dela, em outros formatos. Ela lacra o voto e a turma espera junta, enquanto a professora " +
      "projeta como os votos se dividiram. Na Galeria Oculta cada uma vê, com o número real, quanto da feira " +
      "ficou fora do seu feed — e depois remonta a regra que fez isso.",
    prova: [
      "A professora prepara pela IA real (16 estandes e as falas do podcast) e põe no ar pelo Banco Padrão Oficial, sem IA",
      "O crachá é um modal sobre a timeline desfocada; a TopBar traz @jurado_oficial e a barra tem as quatro abas, com a Busca fechada",
      "Duas curtidas na mesma área saturam o feed: os posts 5 a 10 são só dela, e 69–75% da feira fica fora",
      "Salvar grava e não pesa: quem só salva vê um feed variado",
      "A cédula tem quatro elementos, e parado 60 s com ela aberta o aviso acende no topo e a professora vê o ícone de ocioso",
      "O lacre e a espera com três elementos; o F5 volta à espera",
      "Um botão só, Liberar Auditoria, e ele não volta",
      "A Galeria Oculta com a taxa real, a grade de três colunas, a busca e a revisão de dois botões — Manter só depois de abrir um oculto",
      "A Etapa 5 com o par simulado oposto lado a lado, e a cadeia errada respondida com 422 sem dizer qual vaga",
      "Mariana, os cinco cartões, as três enquetes do Canal B sem acerto e a faixa da Unooria no fim",
      "O painel da professora: sem voto, taxa nem nível; as categorias buscadas; EF06CO10, EF06CO01 e EF06CO03",
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
      const desfecho = await primeiroQueAparecer(
        { curadoria, falha: falhaDaIa },
        { timeout: 120_000, oQue: "a geração da mostra com IA" },
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
        const estandes = await curadoria.locator("[data-estande]").count();
        const areasNaTela = await curadoria.locator("section[data-area]").count();
        r.exigir(estandes === 16 && areasNaTela === 4, `a IA real escreveu 16 estandes em 4 áreas (${estandes} em ${areasNaTela})`);
        await curadoria.scrollIntoViewIfNeeded();
        await r.registrar(prof, "curadoria-da-ia", {
          titulo: "A mostra escrita pela IA, na curadoria",
          mostra: "Os dezesseis estandes que o Vertex escreveu, em quatro categorias com nome e hashtag, cada um com Editar e Regenerar.",
          prova:
            "A IA traz as categorias no pacote (melhoria 2: o Zod valida o FORMATO, não uma lista fixa), e o rascunho " +
            "não persiste: só o “Aprovar textos” grava.",
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
      mostra: "A confirmação: os 16 estandes da Feira de Ciências e Sustentabilidade prontos, sem IA, com a arte da missão.",
      prova:
        "É o caminho curto do PRD (E0-PROF-02) e o fallback quando falta cota de IA: a atividade fica gravada, fora " +
        "do ar, com as imagens já aprovadas (a arte procedural).",
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
      mostra: "A página da atividade do banco padrão: em andamento, os 16 estandes e o painel da aula com Liberar Auditoria.",
      prova: "Um botão só (PRD v2): Liberar Auditoria abre a Galeria Oculta para a turma inteira, e não volta.",
      inteira: true,
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
    const frameDe = (pagina) => () => pagina.frameLocator('iframe[title="experiencia"]');
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
    const lacrar = async (q, folha) => {
      await folha.getByRole("button", { name: "Confirmar Voto Oficial" }).click();
      await q().getByText(/^Voto Registrado e Lacrado — Protocolo #/).first().waitFor({ timeout: 15_000 });
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

    /* O CARROSSEL anda com o MOUSE (arrasto real) e pelas setas. */
    const primeiroPost = artigos1.first();
    const midia = primeiroPost.locator('[aria-roledescription="carrossel"]').first();
    await midia.scrollIntoViewIfNeeded();
    const caixa = await midia.boundingBox();
    if (!caixa) throw new Error("a mídia do primeiro post não tem caixa na tela");
    const yDoMeio = caixa.y + caixa.height / 2;
    await p.mouse.move(caixa.x + caixa.width * 0.8, yDoMeio);
    await p.mouse.down();
    await p.mouse.move(caixa.x + caixa.width * 0.5, yDoMeio, { steps: 6 });
    await p.mouse.move(caixa.x + caixa.width * 0.2, yDoMeio, { steps: 6 });
    await p.mouse.up();
    await primeiroPost.locator('[aria-label="Foto 2 de 3"]').first().waitFor({ timeout: 10_000 });
    await primeiroPost.locator('[data-seta="anterior"]').click();
    await primeiroPost.locator('[aria-label="Foto 1 de 3"]').first().waitFor({ timeout: 10_000 });
    r.exigir(true, "o carrossel anda arrastando com o mouse (foto 2 de 3) e volta pela seta (foto 1 de 3)");

    /* COMENTAR responde com o aviso, e não pesa. */
    await primeiroPost.getByRole("button", { name: "Comentar publicação", exact: true }).click();
    await aviso(q, COPY.comentariosFechados).waitFor({ timeout: 10_000 });
    r.exigir((await sessaoDe(p)).feed.curtidos.length === 0, "comentar responde com o aviso da comissão e não vira sinal do feed");

    // ── ESTUDANTE 1: curtir duas vezes a mesma área — a saturação ────────
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
      throw new Error("pré-condição da saturação: o feed não serviu um segundo post da área curtida (regras/afunilamento.ts)");
    }
    const depoisDaAbertura = feed1.posts.slice(4);
    const projetosDistintos1 = new Set(feed1.posts.map((x) => x.projetoId)).size;
    r.exigir(
      feed1.posts.length === 10 && depoisDaAbertura.every((x) => x.area === areaCurtida),
      `saturação: os posts 5 a 10 são todos de ${areaCurtida} (${depoisDaAbertura.map((x) => x.area).join(", ")})`,
    );
    r.exigir(
      projetosDistintos1 >= 4 && projetosDistintos1 <= 5,
      `quem curte vê 4–5 projetos distintos, repetidos em outros formatos (${projetosDistintos1}: ${[...new Set(depoisDaAbertura.map((x) => x.tipo))].join(", ")})`,
    );
    await semAnimacao(q);
    await r.registrar(p, "feed-saturado", {
      titulo: "Dez posts, e a cédula acende",
      mostra: "O fim do feed: os mesmos projetos da área curtida em formatos diferentes, e o botão da cédula.",
      prova:
        "Duas curtidas fizeram a área líder, e o resto do feed foi só dela — sem aviso nenhum. A criança vai votar " +
        "achando que viu a mostra.",
      detalhe: `${projetosDistintos1} projetos distintos em 10 posts`,
    });

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
    await conferirOPico(q, "o primeiro estudante");
    await r.registrar(p, "lacre-e-espera", {
      titulo: "O lacre, e a espera",
      mostra: "O brasão, “Voto Registrado e Lacrado — Protocolo #…” e a ordem da comissão, e nada mais.",
      prova: "O voto é o LATCH 1: só existe quando a api confirma. Quem tira a criança daqui é o polling do gate.",
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
    await rolarAteOsDez(q2, async (postId) => {
      if (salvos.length >= 3) return;
      const artigo = q2().locator(`article[data-post-id="${postId}"]`);
      await artigo.getByRole("button", { name: "Salvar publicação", exact: true }).click();
      await esperarNaApi(p2, "/juri-estadual/sessao", (s) => s?.feed?.salvos?.includes(postId), { oQue: `o salvo em ${postId}` });
      salvos.push(postId);
    });
    const feed2 = (await sessaoDe(p2)).feed;
    r.exigir(feed2.curtidos.length === 0 && feed2.salvos.length === 3, `o segundo estudante só salvou (${feed2.salvos.length} salvos, ${feed2.curtidos.length} curtidas)`);
    r.exigir(
      new Set(feed2.posts.slice(4).map((x) => x.area)).size > 1,
      "salvar não pesa: o feed de quem só salvou segue variado depois da abertura",
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

    await marcarOVoto(folha2, null, "Sim");
    await lacrar(q2, folha2);
    await conferirOPico(q2, "o segundo estudante");

    // ═══ PROFESSORA: a lousa do pico, e Liberar Auditoria ════════════════
    const painelNoPico = await esperarNaApi(
      prof,
      `${caminhoDaTurma}/painel`,
      (c) => (c?.resumo?.computadores?.votaram ?? 0) >= 2,
      { oQue: "os dois votos no painel da aula" },
    );
    const { resumo } = painelNoPico;
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
    await lousa.scrollIntoViewIfNeeded();
    await r.registrar(prof, "lousa-do-pico", {
      titulo: "A lousa do pico",
      mostra: `“${fraseDoPico}”, o gráfico dos votos por área e o botão Liberar Auditoria.`,
      prova: "Sem nome: a lousa diz como a turma se dividiu, nunca quem votou em quê.",
      inteira: true,
    });
    await apertar(prof, "galeria");
    r.exigir((await prof.locator("[data-gate]").count()) === 0, "depois de Liberar Auditoria, não há botão de etapa: ele não volta e não há rodada de desvio");

    // ═══ A GALERIA OCULTA: as duas taxas, reais ══════════════════════════
    const tituloDaGaleria = (qq) => qq().getByRole("heading", { name: "Galeria Oculta da Mostra" }).first();
    await tituloDaGaleria(q).waitFor({ timeout: 40_000 });
    await tituloDaGaleria(q2).waitFor({ timeout: 40_000 });
    const galeria1 = await lerApi(p, "/juri-estadual/galeria");
    const galeria2 = await lerApi(p2, "/juri-estadual/galeria");
    if (galeria1.status !== 200 || galeria2.status !== 200) {
      throw new Error(`a galeria não abriu pela api (HTTP ${galeria1.status} e ${galeria2.status})`);
    }
    const taxa1 = galeria1.corpo.invisibilidade;
    const taxa2 = galeria2.corpo.invisibilidade;
    r.exigir((await q().getByText(COPY.badge(taxa1.percentual)).count()) > 0, `o badge do primeiro é o número da api: “${COPY.badge(taxa1.percentual)}”`);
    r.exigir((await q2().getByText(COPY.badge(taxa2.percentual)).count()) > 0, `o badge do segundo é o número da api: “${COPY.badge(taxa2.percentual)}”`);
    r.exigir(
      taxa1.percentual >= 69 && taxa1.percentual <= 75,
      `com a saturação, quem curtiu tem 69–75% da feira fora do feed (${taxa1.percentual}%, ${taxa1.ocultos} de ${taxa1.total})`,
    );
    r.exigir(taxa1.percentual > taxa2.percentual, `quem curtiu (${taxa1.percentual}%) vê menos da feira que quem só salvou (${taxa2.percentual}%)`);
    const grade1 = q().getByRole("list", { name: COPY.gradeOculta });
    const itensDaGrade = await grade1.getByRole("listitem").count();
    const colunas = await grade1.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);
    r.exigir(itensDaGrade === taxa1.ocultos, `a grade tem um item por oculto (${itensDaGrade} de ${taxa1.ocultos})`);
    r.exigir(colunas === 3, `a grade da galeria tem três colunas (${colunas}), e cresce com os ocultos (${Math.ceil(itensDaGrade / 3)} linhas)`);
    const manter1 = q().getByRole("button", { name: COPY.manter });
    r.exigir(await manter1.isDisabled(), "antes de abrir um oculto, “Manter meu voto inicial” fica desligado");
    r.exigir((await q().getByText(COPY.manterTravado).count()) > 0, "e a tela diz por quê");
    await semAnimacao(q);
    await r.registrar(p, "galeria-oculta", {
      titulo: "A Galeria Oculta",
      mostra: `A auditoria da comissão, o voto lacrado, o badge “${COPY.badge(taxa1.percentual)}” e a grade de três colunas dos ocultos; embaixo, os dois botões da revisão, com Manter desligado.`,
      prova: "O número é do servidor, sobre o que o feed serviu a ESTA criança; nada é cravado na copy, e a grade tem o tamanho que tiver.",
      detalhe: `${taxa1.ocultos} de ${taxa1.total} ocultos`,
      inteira: true,
    });
    await semAnimacao(q2);
    await r.registrar(p2, "galeria-de-quem-nao-curtiu", {
      titulo: "A mesma galeria, outra taxa",
      mostra: `A galeria de quem só salvou: “${COPY.badge(taxa2.percentual)}”.`,
      prova: `${taxa1.percentual}% contra ${taxa2.percentual}%: foram as curtidas, não o acaso, que esconderam a mostra.`,
    });

    // ── ESTUDANTE 1: a hashtag de uma categoria fora da bolha, dois ocultos, Manter ──
    const projetos1 = galeria1.corpo.projetos;
    const categorias1 = (await sessaoDe(p)).categorias;
    const areaBuscada = categorias1.map((c) => c.area).find((a) => a !== areaCurtida);
    const categoriaBuscada = categorias1.find((c) => c.area === areaBuscada);
    const chip = `#${categoriaBuscada.hashtag.replace(/^#+/, "")}`;
    await q().getByRole("group", { name: "Hashtags da mostra" }).getByRole("button", { name: chip, exact: true }).click();
    const gradeDaBusca = q().getByRole("list", { name: COPY.gradeBusca });
    await gradeDaBusca.waitFor({ timeout: 10_000 });
    r.exigir((await gradeDaBusca.getByRole("listitem").count()) === 4, `a hashtag ${chip} mostra os quatro projetos da categoria`);
    const ocultosDaBusca = projetos1.filter((x) => x.area === areaBuscada && !x.exibidoNoSeuFeed);
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
      mostra: `Depois do chip ${chip}, a ficha de “${ocultosDaBusca[0].titulo}”: as três fotos, o resumo técnico, as hashtags e Voltar à Galeria.`,
      prova: "Buscar pela hashtag de uma categoria fora da bolha e abrir um projeto dela é a EF06CO01 (melhoria 3); dois ocultos e uma busca, a EF06CO10.",
    });
    await ficha1.getByRole("button", { name: COPY.voltar }).click();
    await ficha1.waitFor({ state: "detached", timeout: 10_000 });
    r.exigir(!(await manter1.isDisabled()), "aberto um oculto, “Manter meu voto inicial” acende");
    const ficha1b = await inspecionar(q, ocultosDaBusca[1].titulo);
    await ficha1b.getByRole("button", { name: COPY.voltar }).click();
    await ficha1b.waitFor({ state: "detached", timeout: 10_000 });
    await manter1.click();

    // ── ESTUDANTE 2: busca por texto, e o voto revisado ──────────────────
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
    await folhaDaRevisao.getByRole("radiogroup", { name: "Projetos da mostra" }).getByRole("radio").first().click();
    await semAnimacao(q2);
    await r.registrar(p2, "revisao-do-voto", {
      titulo: "O voto revisado",
      mostra: "A janela extraordinária de revisão: os dezesseis projetos menos o do voto lacrado, e Confirmar Voto Revisado.",
      prova: "Dois botões (melhoria 6): manter ou confirmar um voto revisado. A api grava o voto final ao lado do lacrado.",
    });
    await folhaDaRevisao.getByRole("button", { name: COPY.confirmarRevisao }).click();

    // ═══ ESTUDANTE 1: a Etapa 5 — o Léo, o par simulado e a cadeia ═══════
    await q().getByText(COPY.leo).first().waitFor({ timeout: 30_000 });
    const sessao1 = await sessaoDe(p);
    r.exigir(sessao1.revisao?.acao === "manter", "a api guardou que o primeiro manteve o voto");
    const par = sessao1.cadeia?.parSimulado;
    r.exigir(
      Boolean(par) && par.voce.areaPrincipal === areaCurtida && par.outroJurado.areaPrincipal !== areaCurtida,
      `o par simulado é o OPOSTO: você = ${par?.voce.areaPrincipal}, outro jurado = ${par?.outroJurado.areaPrincipal}`,
    );
    const lados = await ladoALado(q().locator(".par__lado"));
    r.exigir(lados.ok, `os dois históricos ficam LADO A LADO (${JSON.stringify(lados.caixas.map((c) => [Math.round(c.left), Math.round(c.top), Math.round(c.width)]))})`);
    await semAnimacao(q);
    await r.registrar(p, "etapa5-lado-a-lado", {
      titulo: "A Etapa 5: você e o outro jurado, lado a lado",
      mostra: "A tela da escola: a ponte do Léo, os dois históricos — o seu e o de outro jurado que curtiu temas diferentes — lado a lado, e os quatro blocos.",
      prova: "O outro jurado é gerado pelo servidor como o OPOSTO das áreas reais deste feed (melhoria 7) — nunca dado de colega.",
      inteira: true,
    });

    const bandeja = () => q().getByRole("region", { name: "Etapas da regra" });
    const bloco = (rotulo) => bandeja().getByRole("button", { name: new RegExp(`^${escaparRegex(rotulo)}`) });
    const errada = [CADEIA[1], CADEIA[0], CADEIA[2], CADEIA[3]];
    for (const rotulo of errada) await bloco(rotulo).click();
    const respostaDaCadeia = p.waitForResponse((res) => /juri-estadual\/cadeia/.test(res.url()) && res.request().method() === "POST", {
      timeout: 15_000,
    });
    r.provocado(/ordem-incorreta|422/, "a suíte manda a cadeia na ordem errada de propósito: o 422 é a regra");
    await q().getByRole("button", { name: "Validar Cadeia Lógica" }).click();
    const errou = await respostaDaCadeia;
    const corpoDoErro = await errou.json().catch(() => null);
    r.exigir(
      errou.status() === 422 && JSON.stringify(corpoDoErro ?? {}).includes("ordem-incorreta"),
      `a ordem errada é 422 ordem-incorreta (veio ${errou.status()} ${JSON.stringify(corpoDoErro ?? {}).slice(0, 120)})`,
    );
    await q().getByText(COPY.cadeiaErro).first().waitFor({ timeout: 15_000 });
    r.exigir((await q().getByText("Voltou para a bandeja").count()) > 0, "na ordem errada, os blocos voltam para a bandeja");
    r.exigir(!/vaga|posição \d+ (está )?errad/i.test(await q().locator("body").innerText()), "e a tela não diz qual vaga errou");
    await r.registrar(p, "cadeia-errada", {
      titulo: "A cadeia que não encaixou",
      mostra: `Os blocos de volta à bandeja e a frase de apoio: “${COPY.cadeiaErro}”`,
      prova: "O servidor confere a ordem (ids opacos) e responde 422 sem dizer qual vaga; a tentativa conta para a EF06CO03.",
    });
    for (const rotulo of CADEIA) await bloco(rotulo).click();
    await q().getByRole("button", { name: "Validar Cadeia Lógica" }).click();
    await q().getByText(COPY.cadeiaCerta).first().waitFor({ timeout: 15_000 });
    await semAnimacao(q);
    await r.registrar(p, "cadeia-montada", {
      titulo: "Interações → Dados → Algoritmo → Bolha",
      mostra: "A cadeia lógica montada na calha, na segunda tentativa, com a confirmação.",
      prova: "A regra que o feed executou vira descrição precisa: o “se… então…” que a enquete da EF06CO03 pergunta.",
    });
    await q().getByRole("button", { name: COPY.avancar }).click();

    // ═══ ESTUDANTE 1: Mariana ════════════════════════════════════════════
    await q().getByText(/Mariana/).first().waitFor({ timeout: 20_000 });
    const mariana = (await sessaoDe(p)).mariana;
    r.exigir(
      mariana?.mecanismos?.length === 3 && mariana?.atitudes?.length === 2 && /Chapa B/.test(mariana.caso),
      `o caso Mariana traz a Chapa B e os cinco cartões, 3 de mecanismo e 2 de atitude (${mariana?.mecanismos?.length}+${mariana?.atitudes?.length})`,
    );
    r.exigir((await q().getByRole("radio").count()) === 5, "os cinco cartões aparecem juntos, como opções neutras");
    const cartaoDeMecanismo = mariana.mecanismos.find((c) => /bolha/i.test(c.texto)) ?? mariana.mecanismos[0];
    const cartaoDeAtitude = mariana.atitudes.find((c) => /Buscar/i.test(c.texto)) ?? mariana.atitudes[0];
    await q().getByRole("radio", { name: cartaoDeMecanismo.texto, exact: true }).click();
    await q().getByRole("radio", { name: cartaoDeAtitude.texto, exact: true }).click();
    await semAnimacao(q);
    await r.registrar(p, "caso-mariana", {
      titulo: "O caso de Mariana",
      mostra: "A eleição do grêmio (Chapa A e Chapa B) e os cinco cartões, um de mecanismo e um de atitude escolhidos.",
      prova: "A transferência para um caso novo. A tela não diz qual cartão é o certo, e a escolha não vira nota.",
      inteira: true,
    });
    await q().getByRole("button", { name: COPY.submeter }).click();

    // ═══ ESTUDANTE 1: o Canal B — as três enquetes nos Stories ══════════
    for (const [i, id] of ["p1", "p2", "p3"].entries()) {
      const pergunta = await lerApi(p, `/evidencias/${EXP_ID}/perguntas/${id}`);
      if (pergunta.status !== 200) throw new Error(`a pergunta ${id} não veio da api (HTTP ${pergunta.status})`);
      const alternativa = pergunta.corpo.alternativas[0];
      await q().getByRole("button", { name: alternativa.texto }).first().click({ timeout: 30_000 });
      await q().getByText(COPY.confirmadas[i]).first().waitFor({ timeout: 15_000 });
      r.exigir(!CARIMBO_OU_ACERTO.test(await q().locator("body").innerText()), `a enquete ${i + 1} confirma o registro, sem acerto`);
      if (i === 0) {
        await r.registrar(p, "enquete", {
          titulo: "A consulta aos jurados",
          mostra: `Os Stories da comissão, em tema escuro: a primeira pergunta, a alternativa tocada e “${COPY.confirmadas[0]}”.`,
          prova: "O gabarito mora na ficha da api e a ordem muda (ids opacos). A criança não sabe se acertou: é evidência, não prova.",
        });
      }
      if (i < 2) await q().getByRole("button", { name: "Próxima pergunta" }).last().click();
    }
    await q().getByRole("button", { name: "Encerrar consulta" }).click();
    await q().getByText(COPY.fimTitulo).first().waitFor({ timeout: 20_000 });
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
    r.exigir((await tituloDaGaleria(q2).count()) === 0, "o F5 depois da revisão volta à cadeia — a galeria não reabre");
    const sessao2 = await sessaoDe(p2);
    r.exigir(
      sessao2.revisao?.acao === "trocar" && sessao2.revisao.projetoId !== sessao2.voto?.projetoId,
      "a api guardou a troca, com o voto final diferente do lacrado",
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
    r.exigir(
      linha1?.categoriasBuscadas?.includes(areaBuscada),
      `a linha do primeiro traz a categoria que ele buscou (${linha1?.categoriasBuscadas?.join(", ")})`,
    );
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.locator("[data-revisao-da-turma]").waitFor({ timeout: 30_000 });
    const colunasDaFolha = await prof.locator("main").getByRole("columnheader").allInnerTexts();
    r.exigir(
      !colunasDaFolha.some((c) => /^\s*voto\b|\b(taxa|n[íi]vel|invisibilidade|pontos|nota|ranking|acerto)\b/i.test(c)),
      `a folha não tem coluna de voto, taxa nem nível (colunas: ${colunasDaFolha.join(", ")})`,
    );
    const linhaDoPrimeiro = prof.locator("main").getByRole("row").filter({ hasText: PRIMEIRO.login }).first();
    r.exigir(
      (await linhaDoPrimeiro.innerText()).includes(categoriaBuscada.hashtag.startsWith("#") ? categoriaBuscada.hashtag : `#${categoriaBuscada.hashtag}`),
      `a coluna “Categorias buscadas” mostra ${chip} na linha do primeiro`,
    );
    const habilidades = prof.locator("[data-habilidades-do-juri]");
    await habilidades.waitFor({ timeout: 30_000 });
    await habilidades.getByText("EF06CO10").first().waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await habilidades.innerText();
    r.exigir(
      ["EF06CO10", "EF06CO01", "EF06CO03"].every((codigo) => textoDasHabilidades.includes(codigo)),
      "o painel de habilidades mostra EF06CO10, EF06CO01 e EF06CO03",
    );
    const painelDeHabilidades = await lerApi(prof, `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`);
    r.exigir(painelDeHabilidades.status === 200, `a api do painel de habilidades responde para esta atividade (HTTP ${painelDeHabilidades.status})`);
    await linhaDoPrimeiro.scrollIntoViewIfNeeded();
    await r.registrar(prof, "resultados-e-habilidades", {
      titulo: "A folha da turma, as categorias buscadas e as habilidades",
      mostra: "Onde cada um está, a coluna “Categorias buscadas” com a hashtag que o primeiro usou, e o painel de habilidades da BNCC.",
      prova: "A folha diz só o progresso e o que cada um buscou — nunca voto, taxa ou nível ligados a nome. O nível mora no painel de habilidades.",
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
