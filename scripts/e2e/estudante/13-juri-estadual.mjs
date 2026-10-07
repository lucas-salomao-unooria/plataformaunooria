import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";
import { esperarFalasDoTema, provarFalasNaCriacao, provarPodcastNaAula } from "../lib/podcast.mjs";

/**
 * O Júri Estadual de Projetos (exp06ef1b, 6º ano, unidade 1), nas três pontas
 * da sala: a professora cria a atividade e conduz, e dois estudantes da mesma
 * turma julgam a mesma mostra — um curte, o outro não.
 *
 * O que esta suíte cobra, e por que cada item é uma regra do software:
 *
 * 1. **A mostra é da professora, e nasce da IA** (decisão de 2026-10-02: não há
 *    acervo padrão). Parametrizar → gerar → curar → aprovar os TEXTOS (grava) →
 *    aprovar as IMAGENS (o pedido do PO: vistas, refeitas e aprovadas antes da
 *    turma; sem isso, 409 `imagens-nao-aprovadas`) → criar (ADR-66/67, ADR-130).
 * 2. **As curtidas afunilam o feed EM SILÊNCIO, no servidor.** Quem curte duas
 *    vezes a mesma área vê menos da mostra do que quem não curte nada — e a
 *    prova de que a taxa da Galeria Oculta é REAL (calculada pela api para cada
 *    sessão, nunca cravada na copy) é que os dois chegam a ela com números
 *    DIFERENTES, e o de quem curtiu é maior.
 * 3. **O voto é um latch, e o pico tem três elementos.** Depois da cédula, o
 *    lacre e a plenária: o brasão, a ordem da comissão e o pulso — nada mais.
 *    Um F5 no latch volta à plenária, nunca ao feed; e depois da revisão do voto
 *    (o latch 2), volta à cadeia, nunca à galeria.
 * 4. **A lousa do pico é anônima e só a professora move a sala**: "X de Y
 *    votaram" e os votos por área, sem nome; a taxa média só depois da galeria;
 *    UM botão (Liberar a Galeria Oculta), que não volta.
 * 5. **A galeria é auditoria**: os ocultos primeiro, a busca por hashtag, a
 *    ficha que diz se o estande chegou ao feed, e manter ou trocar o voto.
 * 6. **A engrenagem é da escola**: a cadeia Interações → Dados → Algoritmo →
 *    Bolha (EF06CO03), aberta pela frase do Léo, com a errada que devolve
 *    à bandeja sem dizer qual vaga errou; depois o caso Mariana e as três
 *    enquetes, sem acerto, e o crachá homologado.
 * 7. **O painel da professora não tem voto, taxa nem nível por criança**, e as
 *    três habilidades da ficha (EF06CO10, EF06CO01, EF06CO03) ficam no painel de
 *    habilidades, com a régua de cada nível (ADR-145).
 * 8. **O carrossel anda com o MOUSE** (o pedido do PO): arrasto real com
 *    `page.mouse`, e as setas sobre a mídia.
 * 9. **O podcast de recapitulação é da plataforma** (ADR-150): na criação, as
 *    três falas que citam a mostra chegam de `falas-do-tema` e são revisadas
 *    antes de aprovar os textos (o `homologar` as exige); na página da
 *    atividade, Bia e Rafa nos cinco blocos do roteiro, o áudio sintetizado
 *    trecho a trecho e o AVISO de que o episódio revela a virada — o módulo
 *    não trava por etapa, então só depois da Galeria Oculta é recado à
 *    professora (`[data-aviso-do-podcast]`).
 *
 * ─── A IA, e por que a suíte NÃO depende dela ──────────────────────────────
 *
 * A missão não tem acervo padrão: sem a geração, não há atividade. E a geração
 * dos dezesseis estandes é inviável como pré-condição de uma suíte:
 *
 * - em dev e na e2e a IA costuma ser o MOCK (`AI_PROVIDER=mock`, o padrão do
 *   compose), e o `generateJson` do mock SEMPRE lança — a api responde 503
 *   `ia-indisponivel` (memória "AI_PROVIDER=mock quebra a criação de atividade");
 * - com o Vertex de verdade, os dezesseis estandes passam com folga dos 30 s
 *   que o BFF dá a uma chamada: o 504 do BFF é moeda ao ar, como na A Seleção
 *   (memória "Teto de 30s do BFF corta a geração por IA"), e parece IA fora do ar;
 * - o professor demo pode estar sem saldo (429 `sem-saldo-de-ia`, ADR-105).
 *
 * Por isso a suíte faz assim (`JURI_IA`, padrão `auto`):
 *
 * 1. clica no botão REAL "Gerar Mostra Personalizada com IA" e espera a UNIÃO
 *    dos desfechos — a curadoria com os 16 estandes, o aviso de falha da IA
 *    (`[data-falha-da-ia]`) ou o alerta de erro (o 504 do BFF) — correndo contra
 *    o erro, nunca pelo relógio;
 * 2. se a IA respondeu, segue com o que ela escreveu: a suíte não lê título nem
 *    hashtag do código, só da api e da tela;
 * 3. se não respondeu, declara o erro como PROVOCADO, registra a ressalva e
 *    responde a `POST …/gerar-conteudo` pelo `page.route` do Playwright com a
 *    MOSTRA DE FIXTURE (a cópia de `apps/api/tests/juri-estadual-fixture.ts`,
 *    abaixo) — o que a IA devolveria. Clica de novo no MESMO botão: a curadoria,
 *    a edição, o "Criar atividade" (`homologar`, que revalida tudo pelo mesmo
 *    schema da api), as equipes e o "pôr no ar" seguem sendo os de verdade.
 *    Só a resposta do gerador é fixture, e o rascunho não persiste (a rota não
 *    grava nada), então nada entra no banco sem passar pela api.
 *
 * `JURI_IA=fixture` pula a tentativa real (poupa a quota e os 30 s); `JURI_IA=real`
 * a exige e reprova se ela falhar. O "Regenerar estande" não é exercido: ele é
 * a mesma IA atrás do mesmo teto, e os três desfechos dele (novo, "ficou como
 * estava", sem saldo) estão em `apps/api/tests/juri-estadual-postgres.spec.ts`.
 *
 * As IMAGENS são opcionais por desenho (sem elas, a arte procedural): a suíte
 * aperta "Gerar imagens" e espera só a PRIMEIRA ida (até duas imagens), e o
 * que ela disser — prontas, falharam, sem saldo — é um desfecho legítimo.
 *
 * ─── O estado de ontem ─────────────────────────────────────────────────────
 *
 * FIXTURE: a 6A (o seed libera a exp06ef1b lá). O estado é do servidor e
 * sobrevive ao roteiro. Criar de novo EXATAMENTE o pacote mais recente devolve
 * a mesma atividade (`homologar` é idempotente); se ela já estava no ar (a
 * corrida de ontem com a fixture), a suíte zera a turma — zerar abre a rodada
 * seguinte sem apagar nada. Atividade nova, ou que volta ao ar, já começa numa
 * rodada nova. Na rodada nova do MESMO pacote, quem já foi avaliado não ganha
 * marca nova nas ações (ADR-120): o painel de habilidades mostra as três
 * habilidades do mesmo jeito.
 */
const SERIE = "6EF";
const EXP_ID = "exp06ef1b";
const FICHA = `${HUB}/professor/entre-redes/6-ano/unidade-1`;
const TITULO_DA_MISSAO = "O Júri Estadual de Projetos";
const MODO_DA_IA = (process.env.JURI_IA ?? "auto").toLowerCase();

/* A turma vem do CSV do seed, não fixada aqui. */
const PRIMEIRO = conta("estudante", { serie: SERIE });
const TURMA = process.env.TURMA ?? PRIMEIRO.turma;
const SEGUNDO = contasDe("estudante").find((c) => c.turma === PRIMEIRO.turma && c.login !== PRIMEIRO.login);
if (!SEGUNDO) throw new Error(`a turma ${TURMA} precisa de dois estudantes (rode o seed)`);

/** Os parâmetros do preparo, como a professora os digita. */
const PARAMETROS = {
  disciplina: "ciencias",
  rotuloDaDisciplina: "Ciências",
  tema: "Ciência que cuida da cidade",
  assuntos: "Energia, água, alimentação e reaproveitamento de materiais na escola.",
};

/** A curadoria da suíte: um título trocado, o mesmo a cada corrida (a idempotência depende disso). */
const TITULO_CURADO = "Protótipo revisado pela professora";

/** O que nunca pode aparecer na tela da criança: carimbo, nota, acerto. */
const CARIMBO_OU_ACERTO = /\b(correta|incorreta|errou|acertou|errada|pontos|sua nota)\b/i;

/** O que a missão não diz antes da galeria (o `textos.test.ts` da experiência cobra o mesmo da copy). */
const SPOILER = /\b(algoritmo|bolha|filtro|ocult[ao]s?)\b/i;

// ─────────────────────────────────────────────── a mostra de fixture

/**
 * CÓPIA de `apps/api/tests/juri-estadual-fixture.ts#conteudoDeTeste` — a mostra
 * que a IA devolveria, dentro da régua de `invariantes.ts`. A suíte não importa
 * o `.ts` da api (o ESM do Node não resolve o import sem extensão de lá); se a
 * régua mudar, o "Criar atividade" recusa com a lista de problemas e a suíte
 * reprova dizendo qual.
 */
const AREAS = ["area_a", "area_b", "area_c", "area_d"];
const CATEGORIAS = {
  area_a: {
    nome: "Energia limpa",
    hashtag: "#energialimpa",
    tema: "energia",
    titulos: ["Placa solar de garrafa", "Cata-vento que acende luz", "Forno solar de caixa", "Pedal que carrega celular"],
  },
  area_b: {
    nome: "Água e cuidado",
    hashtag: "#aguaecuidado",
    tema: "água",
    titulos: ["Filtro de areia e carvão", "Cisterna da quadra", "Sensor de vazamento", "Chuveiro que avisa o tempo"],
  },
  area_c: {
    nome: "Alimentação",
    hashtag: "#alimentacao",
    tema: "comida",
    titulos: ["Horta vertical de pallet", "Composteira da cantina", "Mapa do lanche nutritivo", "Secador solar de frutas"],
  },
  area_d: {
    nome: "Robótica de sucata",
    hashtag: "#roboticasucata",
    tema: "robô",
    titulos: ["Braço hidráulico de seringa", "Carrinho de motor reciclado", "Robô que separa lixo", "Semáforo para a escola"],
  },
};
const ESCOLAS = [
  "Escola Municipal Professora Lúcia Andrade",
  "Escola Estadual Rio das Pedras",
  "Escola Municipal Vila Esperança",
  "Escola Estadual Monte Verde",
  "Escola Municipal Dona Cecília Prado",
  "Escola Estadual Campo Alegre",
  "Escola Municipal Sítio Novo",
  "Escola Estadual Vale do Sol",
  "Escola Municipal Mestre Benedito",
  "Escola Estadual Lagoa Azul",
  "Escola Municipal Recanto das Flores",
  "Escola Estadual Serra Bonita",
  "Escola Municipal Ponte Alta",
  "Escola Estadual Boa Vista do Norte",
  "Escola Municipal Jardim Primavera",
  "Escola Estadual Porto Seguro do Sul",
];
const EQUIPES = [
  "ana.e.joao",
  "lab.da.julia",
  "davi_e_yasmin",
  "equipe.kaua",
  "isadora.ciencia",
  "pedro.e.lara",
  "maria.eduarda.lab",
  "time.do.enzo",
  "beatriz.e.caio",
  "gabriel.inventa",
  "sofia.e.miguel",
  "clube.da.alice",
  "heitor.e.lis",
  "valentina.lab",
  "arthur.e.manu",
  "laura.e.theo",
];

function mostraDeFixture(tema) {
  const ids = AREAS.flatMap((area) => [1, 2, 3, 4].map((n) => `proj-${area.slice(-1)}${n}`));
  return {
    tema,
    categorias: AREAS.map((area) => ({ area, nome: CATEGORIAS[area].nome, hashtag: CATEGORIAS[area].hashtag })),
    projetos: ids.map((id, i) => {
      const area = `area_${id.charAt(5)}`;
      const c = CATEGORIAS[area];
      const titulo = c.titulos[Number(id.charAt(6)) - 1];
      return {
        id,
        area,
        titulo,
        escola: ESCOLAS[i],
        perfil: `@${EQUIPES[i]}`,
        legenda: `Nossa equipe montou o projeto ${titulo} com material reciclado da escola. A ideia ajuda a cuidar da ${c.tema} no bairro.`,
        bastidor: `Hoje testamos o protótipo do ${titulo} no pátio e anotamos o que precisa melhorar.`,
        hashtags: [c.hashtag, "#mostraestadual"],
        imagem: {
          descricao: `Ilustração colorida do protótipo ${titulo} em um estande de feira de ciências escolar.`,
          alt: `Protótipo ${titulo} no estande da mostra.`,
        },
      };
    }),
  };
}

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

/** A frase da taxa, igual à da experiência (`lib/textos.ts#E4.taxa`) — o número vem da api. */
function fraseDaTaxa({ ocultos, total, percentual }) {
  return ocultos === 0
    ? `Todos os ${total} estandes da mostra chegaram ao seu feed.`
    : `${ocultos} de ${total} estandes ${ocultos === 1 ? "nunca chegou" : "nunca chegaram"} ao seu feed (${percentual}% da mostra).`;
}

/** "2 de 30 jurados votaram." — a mesma frase de `juri-estadual-tipos.ts#textoDosVotos`. */
function fraseDosVotos({ votaram, total }, porComputador) {
  const sujeito = porComputador ? (total === 1 ? "computador" : "computadores") : total === 1 ? "jurado" : "jurados";
  return `${votaram} de ${total} ${sujeito} ${votaram === 1 && total === 1 ? "votou" : "votaram"}.`;
}

await suite(
  {
    slug: "estudante/13-juri-estadual",
    papel: "estudante",
    titulo: "O Júri Estadual de Projetos — o feed que esconde a mostra",
    subtitulo: "curtir, lacrar o voto, ver o que nunca chegou ao feed e montar a engrenagem que escondeu",
    contexto:
      "A criança é jurada de uma mostra científica estadual num feed de rede social: dezesseis estandes " +
      "de quatro áreas, escritos sobre o tema da aula. As curtidas dela mudam o que o feed mostra, sem " +
      "aviso. Depois de dez publicações ela lacra o voto e a turma espera junta, enquanto a professora " +
      "projeta como os votos se dividiram. Na Galeria Oculta, cada uma vê o que não chegou à própria " +
      "tela — com a parte real que ficou de fora — e depois remonta a curtida e a engrenagem do feed.",
    prova: [
      "A atividade nasce da professora: parametrizar, gerar com IA, curar, aprovar os textos e depois as imagens (vistas, refeitas e aprovadas antes da turma) e criar",
      "As curtidas afunilam o feed no servidor: quem curte duas vezes a mesma área chega à galeria com uma taxa de invisibilidade MAIOR que a de quem não curte",
      "Votar é um latch: o lacre, e a plenária com exatamente três elementos; o F5 volta à plenária",
      "A lousa do pico diz quantos votaram e como os votos se dividiram por área, sem nome; a taxa média só aparece depois da galeria",
      "Só o botão da professora abre a Galeria Oculta, e ele não volta",
      "Na galeria: os ocultos primeiro, a busca por hashtag e por texto, a ficha de cada estande e o voto mantido ou trocado; o F5 depois da revisão volta à cadeia",
      "O carrossel do feed anda arrastando com o mouse e pelas setas",
      "A cadeia é tela da escola, aberta pelo Léo: a ordem errada volta para a bandeja sem dizer qual vaga errou",
      "Caso Mariana, as três enquetes sem acerto e o crachá homologado",
      "O painel da professora não tem voto, taxa nem nível por criança, e mostra EF06CO10, EF06CO01 e EF06CO03 com a régua",
    ],
    comando: "node scripts/e2e/estudante/13-juri-estadual.mjs",
  },
  async (r) => {
    /**
     * Aperta o botão da aula e espera a etapa nova no painel — e a hidratação,
     * porque depois de um reload o botão do SSR já está no DOM sem o handler.
     */
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

    /* O que a turma JÁ TEM no ar (ADR-130): só quando a atividade criada é a
       que já estava no ar (a mesma de ontem, pela idempotência) a turma
       precisa ser zerada. */
    const pacotesAntes = await lerApi(prof, `${caminhoDaTurma}/pacotes`);
    if (pacotesAntes.status !== 200) {
      throw new Error(
        `a api não listou as atividades da ${TURMA} (HTTP ${pacotesAntes.status}): ${JSON.stringify(pacotesAntes.corpo).slice(0, 200)}`,
      );
    }
    const noArAntes = pacotesAntes.corpo?.ativo ?? null;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: new RegExp(TITULO_DA_MISSAO) }).first().waitFor({ timeout: 30_000 });
    await prof.getByText("Prepare antes: esta missão não tem mostra pronta").first().waitFor({ timeout: 15_000 });
    await prof.locator("[data-atividades-da-missao]").waitFor({ timeout: 20_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 6º ano",
      mostra:
        "A missão explicada para quem conduz, o aviso “Prepare antes: esta missão não tem mostra pronta” e a " +
        "lista “Suas atividades com a turma”, com Nova atividade.",
      prova:
        "A professora sabe ANTES que os dezesseis estandes são escritos pela IA sobre o tema da aula dela, que " +
        "durante a aula é um botão só, e que a missão só abre com uma atividade dela em andamento (ADR-130).",
    });

    // ═══ PROFESSORA: parametrizar ════════════════════════════════════════
    /* O `LinkButton` é um `<a>` com `role="button"` (o `Button` do DS
       polimórfico): pelo elemento, e não pelo papel. */
    await prof.locator("a", { hasText: "Nova atividade" }).first().click();
    await prof.waitForURL("**/atividades/nova**", { timeout: 30_000 });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 30_000 });
    const preparo = prof.locator("[data-passo-conteudo] [data-preparo-juri]");
    await preparo.waitFor({ timeout: 30_000 });
    r.exigir(
      (await prof.locator("[data-mostra-vazia]").count()) === 1 && (await prof.locator("[data-curadoria-da-mostra]").count()) === 0,
      "a criação nasce VAZIA: nenhum estande antes de a professora gerar a mostra",
    );

    /* O componente curricular é o `Selection` do DS (combobox + listbox, o
       rótulo liga por `aria-labelledby`). O portão é o próprio listbox: sem
       hidratação o clique não abre nada. */
    const disciplina = prof.getByRole("combobox", { name: /^Componente Curricular/ });
    await hidratado(prof, disciplina);
    await disciplina.click();
    const opcao = prof.getByRole("listbox").getByRole("option", { name: new RegExp(PARAMETROS.rotuloDaDisciplina) }).first();
    await opcao.waitFor({ timeout: 10_000 }).catch(() => {
      throw new Error("o seletor de componente curricular não abriu: a página ainda não estava hidratada");
    });
    await opcao.click();
    /* Digitado, não `fill`: é o `onChange` de cada tecla que move o estado do React. */
    const tema = preparo.getByRole("textbox", { name: /^Tema Geral da Feira/ });
    await tema.click();
    await tema.pressSequentially(PARAMETROS.tema);
    const assuntos = preparo.getByRole("textbox", { name: /^Objetos de Conhecimento da Aula/ });
    await assuntos.click();
    await assuntos.pressSequentially(PARAMETROS.assuntos);
    const gerar = prof.locator('[data-acao="gerar-mostra"]');
    await prof.waitForFunction(
      () => !document.querySelector('[data-acao="gerar-mostra"]')?.hasAttribute("disabled"),
      null,
      { timeout: 10_000 },
    );
    await r.registrar(prof, "preparo-parametros", {
      titulo: "Parametrizar a mostra",
      mostra:
        `O passo Conteúdo da criação: o componente curricular (${PARAMETROS.rotuloDaDisciplina}), o tema geral da feira ` +
        "e os objetos de conhecimento da aula, e o botão Gerar Mostra Personalizada com IA.",
      prova:
        "A missão é transversal: qualquer professor escreve a mostra sobre a própria aula. Os tetos dos campos " +
        "(tema de 3 a 60, assuntos de 10 a 600) são a primeira barreira contra instrução injetada no gerador.",
    });

    // ═══ PROFESSORA: gerar com IA (ou a fixture, se a IA não responder) ══
    const curadoria = prof.locator("[data-curadoria-da-mostra]");
    const falhaDaIa = preparo.locator(`[data-falha-da-ia], ${ALERTA_DE_ERRO}`);
    let origemDaMostra = "ia";

    const usarFixture = async (motivo) => {
      origemDaMostra = "fixture";
      if (MODO_DA_IA === "real") throw new Error(`JURI_IA=real e a geração não respondeu: ${motivo}`);
      if (motivo) {
        r.provocado(
          /gerar-conteudo/,
          "a geração da mostra falhou (mock, sem saldo ou o teto de 30 s do BFF) e a suíte seguiu com a fixture",
        );
        r.ressalva(`a IA não gerou a mostra (${motivo}): a suíte respondeu ao gerador com a mostra de fixture`);
      } else {
        r.ressalva("JURI_IA=fixture: a resposta do gerador é a mostra de fixture, sem tentar a IA");
      }
      /* SÓ a resposta do gerador é fixture: os parâmetros são os que a tela
         mandou, e o rascunho não persiste — quem grava é o `homologar` real. */
      await prof.route("**/api/plataforma/juri-estadual/turmas/*/gerar-conteudo", async (rota) => {
        const enviados = rota.request().postDataJSON() ?? {};
        await rota.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ parametros: enviados, conteudo: mostraDeFixture(enviados.tema ?? PARAMETROS.tema) }),
        });
      });
      await gerar.click();
      /* Vigiar o alerta só DEPOIS de o estado novo começar: o clique limpa o
         aviso da tentativa anterior, e a corrida não pode ver o alerta velho. */
      await falhaDaIa.first().waitFor({ state: "detached", timeout: 10_000 });
      await esperarOuFalharCedo(curadoria, falhaDaIa, { timeout: 20_000, oQue: "gerar a mostra com a fixture" });
    };

    /* As falas do podcast são pedidas logo depois que a mostra chega (ADR-150):
       a espera nasce ANTES do clique — e, se a IA falhar, a mesma espera pega
       o pedido do clique da fixture. O `catch` vazio só impede a rejeição
       solta: quem decide o que a falta significa é o passo das falas. */
    const respostaDasFalas = esperarFalasDoTema(prof, "exp06ef1b");
    respostaDasFalas.catch(() => undefined);

    if (MODO_DA_IA === "fixture") {
      await usarFixture(null);
    } else {
      await gerar.click();
      const desfecho = await primeiroQueAparecer(
        { curadoria, falha: falhaDaIa },
        /* 30 s é o teto do BFF; o resto é folga para o 504 chegar à tela. */
        { timeout: 60_000, oQue: "a geração da mostra com IA" },
      );
      if (desfecho === "falha") {
        const texto = (await falhaDaIa.first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
        await r.registrar(prof, "preparo-ia-falhou", {
          titulo: "Quando a IA não responde",
          mostra: `O aviso da falha na voz da plataforma: “${texto.slice(0, 160)}”.`,
          prova:
            "Sem acervo padrão, a tela não oferece saída que não existe: sem saldo diz que a atividade sai quando " +
            "o saldo voltar; com o gerador fora, oferece tentar de novo. Nada é gravado.",
        });
        await usarFixture(texto || "sem texto na tela");
      }
    }
    if (origemDaMostra === "ia") r.ressalva("a IA respondeu: a mostra desta corrida foi escrita pelo gerador de verdade");

    const estandes = await curadoria.locator("[data-estande]").count();
    const areasNaTela = await curadoria.locator("section[data-area]").count();
    r.exigir(estandes === 16 && areasNaTela === 4, `a curadoria mostra 16 estandes em 4 áreas (${estandes} em ${areasNaTela})`);
    await curadoria.scrollIntoViewIfNeeded();
    await r.registrar(prof, "curadoria-da-mostra", {
      titulo: "Curadoria da Mostra: 16 Estandes",
      mostra:
        "Os dezesseis estandes em quatro áreas, cada uma com a hashtag dela, com Editar estande e Regenerar " +
        `estande em cada cartão${origemDaMostra === "fixture" ? " (a mostra de fixture, no lugar da resposta do gerador)" : ""}.`,
      prova:
        "Nenhum texto gerado por IA chega à turma sem a aprovação da professora: o rascunho não persiste, e só o " +
        "“Criar atividade” grava. A primeira hashtag de cada estande é a da área — é por ela que a galeria busca.",
      inteira: true,
    });

    // ═══ PROFESSORA: as falas do podcast, na criação ═════════════════════
    const tituloDasFalas = "As falas do podcast, para revisar";
    const mostraDasFalas =
      "Abaixo da curadoria, as três falas do podcast de recapitulação que citam esta mostra: duas da Bia e " +
      "uma do Rafa, editáveis antes de aprovar os textos.";
    if (origemDaMostra === "ia") {
      await provarFalasNaCriacao(r, prof, await respostaDasFalas, {
        comIa: true,
        passo: "criacao-falas-do-podcast",
        titulo: tituloDasFalas,
        mostra: mostraDasFalas,
        prova:
          "A IA escreve as falas a partir dos estandes da mostra (Vertex), e a professora as revisa e edita na " +
          "criação: elas vão no mesmo “Aprovar textos”, que as exige. O resto do roteiro é o aprovado pela Unooria.",
      });
    } else {
      /* Com a fixture, a IA pode não responder também às falas: a api devolve as
         do roteiro, sem IA, e isso é desfecho legítimo — não se exige `usouIa`. */
      const resposta = await respostaDasFalas.catch(() => null);
      const corpo = resposta ? await resposta.json().catch(() => null) : null;
      if (corpo?.usouIa !== true) {
        r.ressalva(
          `as falas do podcast vieram sem IA (falas-do-tema ${resposta?.status() ?? "sem resposta"}, ` +
            `motivo=${corpo?.motivo ?? "?"}): a mostra é de fixture`,
        );
      }
      const caixas = prof.locator("[data-falas-do-podcast] textarea");
      await caixas.first().waitFor({ timeout: 20_000 });
      const textos = await caixas.evaluateAll((ts) => ts.map((t) => t.value.trim()));
      r.exigir(
        textos.length === 3 && textos.every((t) => t.length > 0),
        `a criação mostra as 3 falas do podcast, preenchidas, para a professora revisar (${textos.length} na tela)`,
      );
      await r.registrar(prof, "criacao-falas-do-podcast", {
        titulo: tituloDasFalas,
        mostra: `${mostraDasFalas} Com a mostra de fixture, as falas podem ser as do roteiro, sem IA.`,
        prova:
          "As falas vão no mesmo “Aprovar textos”, que as exige: sem elas na régua, o botão não acende e a lista " +
          "de pendências diz o que falta.",
        inteira: true,
      });
    }

    // ═══ PROFESSORA: curar um estande ════════════════════════════════════
    const estande = curadoria.locator('[data-estande="proj-a1"]');
    const editar = estande.getByRole("button", { name: "Editar estande" });
    await hidratado(prof, editar);
    await editar.click();
    const editor = prof.locator('[data-editor-do-estande="proj-a1"]');
    await editor.waitFor({ timeout: 10_000 });
    const titulo = editor.getByRole("textbox", { name: /^Título do estande/ });
    /* De UMA vez, não `fill("")` + `pressSequentially`: digitar logo depois de
       esvaziar corria contra o render do campo vazio (que acende o erro) no
       next dev, e o React devolvia o campo a um valor anterior no meio da
       digitação — "Prótipo", "Proótipo". Com uma pausa entre os dois, 3 de 3
       corridas passavam; sem ela, 3 de 3 perdiam letra. */
    await titulo.fill(TITULO_CURADO);
    r.exigir((await titulo.inputValue()) === TITULO_CURADO, "o campo do título ficou com o que a professora escreveu");
    await r.registrar(prof, "curadoria-editar-estande", {
      titulo: "Editar o que a criança lê",
      mostra: "A janela Editar Projeto Escolar: o título, a legenda da apresentação e o bastidor, com a régua de palavras à vista.",
      prova:
        "O que se edita é o que a criança lê. A área, as hashtags e a descrição da imagem ficam como a geração " +
        "os deixou: trocar a hashtag da área desmontaria a busca da Galeria Oculta.",
    });
    await prof.getByRole("button", { name: "Pronto", exact: true }).click();
    await editor.waitFor({ state: "detached", timeout: 10_000 });
    r.exigir(
      (await estande.getByText(TITULO_CURADO).count()) > 0,
      "o cartão do estande mostra o título que a professora escreveu",
    );

    // ═══ PROFESSORA: as DUAS FASES da aprovação (o pedido do PO) ═════════
    /* Fase 1, os textos: "Aprovar textos e gerar as imagens" grava o pacote
       (homologar), PRONTO e fora do ar. Fase 2, as imagens: geram-se sozinhas
       na grade; a professora vê cada uma, gera outra para a que não serve e
       aprova. O "Continuar" só acende depois das duas. */
    const continuar = prof.locator('[data-acao="continuar-criacao"]');
    r.exigir(await continuar.isDisabled(), "antes de aprovar textos e imagens, o “Continuar” da criação fica apagado");
    const aprovarTextos = prof.locator('[data-acao="aprovar-textos"]');
    await prof.locator('[data-acao="aprovar-textos"]:not([disabled])').waitFor({ timeout: 20_000 }).catch(() => undefined);
    if (await aprovarTextos.isDisabled()) {
      const pendencias = await prof.locator("[data-preparo-juri] [role='status']").allInnerTexts();
      throw new Error(`a curadoria recusou a mostra gerada pela IA: ${pendencias.join(" | ").slice(0, 400)}`);
    }
    await aprovarTextos.click();
    await esperarOuFalharCedo(
      prof.locator('[data-preparo-juri][data-fase="imagens"] [data-imagens-do-juri]'),
      prof.locator("[data-preparo-juri]").locator(ALERTA_DE_ERRO),
      { timeout: 60_000, oQue: "aprovar os textos e abrir a fase das imagens" },
    );
    const grade = prof.locator("[data-imagens-do-juri]");
    const pacoteDaCriacao = await grade.getAttribute("data-pacote-das-imagens");
    const jaAprovada = (await grade.getAttribute("data-imagens-aprovadas")) === "sim";
    /** Espera a geração parar — e falha CEDO no aviso da grade (sem saldo, provedor fora). */
    const imagensProntas = async (oQue) => {
      const fim = Date.now() + 300_000;
      for (;;) {
        const gerando = await grade.locator('[data-estado-da-imagem="gerando"]').count();
        const sem = await grade.locator('[data-estado-da-imagem="sem-imagem"]').count();
        if (gerando === 0 && (sem === 0 || jaAprovada)) return;
        const aviso = grade.locator(".unooria-feedback-alert--warning");
        if ((await aviso.count()) > 0 && gerando === 0) {
          throw new Error(`${oQue}: ${(await aviso.first().innerText()).trim()}`);
        }
        if (Date.now() > fim) throw new Error(`${oQue}: a geração não terminou em 5 minutos`);
        await prof.waitForTimeout(1_000);
      }
    };
    await imagensProntas("gerar as imagens dos estandes (o ADC está válido?)");
    const cartoesDeImagem = grade.locator("[data-imagem-do-estande]");
    r.exigir((await cartoesDeImagem.count()) === 16, "a fase 2 mostra os 16 estandes, cada um com a sua imagem");

    /* A atividade gravada ainda não vai ao ar: a api recusa sem o OK. */
    if (pacoteDaCriacao && !jaAprovada) {
      const recusa = await mandarApi(prof, `${caminhoDaTurma}/pacotes/${pacoteDaCriacao}/em-andamento`);
      r.exigir(
        recusa.status === 409 && recusa.corpo?.codigo === "imagens-nao-aprovadas",
        `sem as imagens aprovadas, pôr no ar é recusado com 409 imagens-nao-aprovadas (veio ${recusa.status} ${recusa.corpo?.codigo ?? ""})`,
      );
      r.exigir(
        (await cartoesDeImagem.locator("img").count()) === 16,
        "cada estande aparece com a imagem gerada, grande, junto do título e do que ela deveria mostrar",
      );
    }
    await r.registrar(prof, "criacao-imagens", {
      titulo: "As imagens, antes da turma",
      mostra:
        "A fase 2 da criação: os 16 estandes por área, cada um com a imagem gerada por IA, o título, o que ela " +
        "deveria mostrar, o estado “Aguardando seu OK” e os botões “Gerar outra imagem” e “Aprovar as imagens”.",
      prova:
        "Nenhuma imagem gerada por IA chega ao feed das crianças sem o OK da professora (o pedido do PO): os textos " +
        "já estão gravados, e a atividade não vai ao ar sem a segunda fase.",
      inteira: true,
    });

    if (!jaAprovada) {
      /* "Gerar outra imagem" troca SÓ aquela, num arquivo novo. */
      const primeira = cartoesDeImagem.first();
      const idDaPrimeira = await primeira.getAttribute("data-imagem-do-estande");
      const srcAntes = await primeira.locator("img").getAttribute("src");
      await primeira.locator('[data-acao="gerar-outra-imagem"]').click();
      const daPrimeira = grade.locator(`[data-imagem-do-estande="${idDaPrimeira}"]`);
      await esperarOuFalharCedo(
        daPrimeira.locator(`img:not([src="${srcAntes}"])`),
        grade.locator(".unooria-feedback-alert--warning"),
        { timeout: 90_000, oQue: "gerar outra imagem para um estande" },
      );
      r.exigir(
        (await daPrimeira.getAttribute("data-estado-da-imagem")) === "aguardando",
        "a imagem refeita é outra, e continua esperando o OK",
      );

      await grade.locator('[data-acao="aprovar-imagens"]').click();
      await esperarOuFalharCedo(
        prof.locator('[data-imagens-do-juri][data-imagens-aprovadas="sim"]'),
        grade.locator(".unooria-feedback-alert--warning"),
        { timeout: 30_000, oQue: "aprovar as imagens" },
      );
      r.exigir(
        (await grade.locator('[data-acao="gerar-outra-imagem"]').count()) === 0,
        "aprovadas, as imagens congelam: some o “Gerar outra imagem”",
      );
      const depois = await mandarApi(prof, `${caminhoDaTurma}/pacotes/${pacoteDaCriacao}/imagens/proj-a1/refazer`);
      r.exigir(
        depois.status === 409 && depois.corpo?.codigo === "imagens-ja-aprovadas",
        `depois da aprovação, refazer é 409 imagens-ja-aprovadas (veio ${depois.status} ${depois.corpo?.codigo ?? ""})`,
      );
    } else {
      r.ressalva("a mostra criada é a mesma de uma corrida anterior, já com as imagens aprovadas: a fase 2 só confere");
    }
    r.exigir(!(await continuar.isDisabled()), "com textos e imagens aprovados, o “Continuar” acende");
    await r.registrar(prof, "criacao-imagens-aprovadas", {
      titulo: "Imagens aprovadas",
      mostra: "Os 16 estandes com a etiqueta “Aprovada” e a barra cheia.",
      prova: "É esta aprovação que deixa a atividade ir ao ar; depois dela, as imagens não mudam mais.",
    });

    // ═══ PROFESSORA: equipes, revisar, criar ═════════════════════════════
    await continuar.click();
    /* Rádio do DS pelo PAPEL: o `<input>` transparente cobre o rótulo inteiro. */
    const umPorComputador = prof.getByRole("radio", { name: "Um aluno por computador", exact: true });
    await umPorComputador.click();
    r.exigir(await umPorComputador.isChecked(), "o passo de equipes marca “Um aluno por computador”");

    await prof.locator('[data-acao="continuar-criacao"]').click();
    const revisao = prof.locator("[data-revisao-da-criacao]");
    await revisao.waitFor({ timeout: 10_000 });
    /* "Pôr no ar agora" nasce desligado quando a turma já tem uma em andamento.
       O `<input>` do `Toggle` do DS é invisível de propósito (opacidade 0, sem
       ponteiro): espera-se o input no DOM e o toque vai como evento. */
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    r.exigir(await noAr.isChecked(), "“Pôr esta atividade no ar agora” fica ligado");
    r.exigir(
      /16 estandes em 4 áreas/.test(await revisao.innerText()),
      "a revisão resume o tema, o componente curricular e os 16 estandes em 4 áreas",
    );
    await r.registrar(prof, "criacao-revisar", {
      titulo: "Revisar e criar",
      mostra:
        "O último passo: a turma, o tema com os 16 estandes em 4 áreas, um aluno por computador e o interruptor " +
        "“Pôr esta atividade no ar agora”, ligado.",
      prova:
        "Os textos e as imagens já foram aprovados nas duas fases (a mostra está gravada, PRONTA); criar só faz o " +
        "resto — o interruptor a põe em andamento.",
    });

    await prof.locator('[data-acao="criar-atividade"]').click();
    /* O desfecho é a PÁGINA DA ATIVIDADE em andamento; a corrida é contra o
       erro da criação (o `pacote-invalido` traz a lista de problemas) e contra
       o aviso "A atividade foi criada" (criou, mas não entrou no ar). */
    await esperarOuFalharCedo(
      prof.locator('[data-estado-da-atividade="em-andamento"]'),
      revisao.locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`),
      { timeout: 60_000, oQue: "criar a atividade e pô-la no ar" },
    );
    await prof.waitForURL("**/resultados?**pacote=**", { timeout: 30_000 });
    const atividadeId = new URL(prof.url()).searchParams.get("pacote");
    if (!r.exigir(Boolean(atividadeId), `a página da atividade leva o id dela na URL (${prof.url()})`)) return;
    await prof.locator(`[data-pacote="${atividadeId}"]`).waitFor({ timeout: 20_000 });
    const pacotesDepois = (await lerApi(prof, `${caminhoDaTurma}/pacotes`)).corpo;
    r.exigir(
      pacotesDepois?.ativo?.id === atividadeId,
      "a atividade criada é a EM ANDAMENTO da turma (GET /juri-estadual/turmas/:turmaId/pacotes)",
    );
    r.exigir(
      pacotesDepois?.ativo?.conteudo?.projetos?.find((x) => x.id === "proj-a1")?.titulo === TITULO_CURADO,
      "a api gravou a mostra como a professora a deixou (o título curado)",
    );
    const jaExistia = (pacotesAntes.corpo?.historico ?? []).some((h) => h.id === atividadeId);
    if (!jaExistia) {
      r.exigir(
        pacotesDepois?.ativo?.rodada === 1,
        `a atividade nova começa na 1ª rodada (veio ${pacotesDepois?.ativo?.rodada ?? "nada"})`,
      );
    }

    /* ZERAR só quando a atividade criada é a que JÁ estava no ar: sem isto a
       segunda corrida encontra os estudantes já votados, e o roteiro passa por
       cima do latch que ele existe para provar. */
    if (noArAntes?.id === atividadeId) {
      const rodada = noArAntes.rodada;
      const zerar = prof.locator("[data-zerar-turma]");
      await hidratado(prof, zerar);
      await zerar.click();
      await prof.getByRole("dialog").getByRole("button", { name: /Zerar a turma/ }).click();
      await esperarOuFalharCedo(
        prof.locator(`[data-pacote="${atividadeId}"]`, { hasText: `rodada ${rodada + 1} em andamento` }),
        prof.getByRole("dialog").locator(ALERTA_DE_ERRO),
        { timeout: 30_000, oQue: "zerar a turma" },
      );
      r.ressalva(
        `a atividade criada é a que já estava no ar (corrida anterior, mesma mostra): a turma foi zerada para a ${rodada + 1}ª rodada`,
      );
    }
    await prof.waitForSelector('[data-etapa="exploracao"]', { timeout: 20_000 });
    await prof.locator("[data-estandes-da-atividade]").waitFor({ timeout: 20_000 });

    await r.registrar(prof, "atividade-em-andamento", {
      titulo: "A atividade em andamento: imagens aprovadas, estandes e o botão da aula",
      mostra:
        "A página da atividade: em andamento, as equipes, as imagens dos estandes já aprovadas, os 16 estandes " +
        "por área (as hashtags quebram linha dentro do cartão) e o painel da aula na exploração, com Liberar a " +
        "Galeria Oculta.",
      prova:
        "As imagens foram vistas e aprovadas na criação; aqui elas não mudam mais. As hashtags vão no rodapé do " +
        "cartão, que quebra linha — no cabeçalho, sem quebra, elas vazavam (o pedido do PO).",
      inteira: true,
    });
    const hashtagsDoEstande = prof.locator('[data-estandes-da-atividade] [data-estande="proj-a1"] .unooria-card__subtags-container');
    r.exigir(
      (await hashtagsDoEstande.count()) === 1,
      "as hashtags do estande moram no contêiner do DS que quebra linha (subtags), não no cabeçalho do cartão",
    );

    // ═══ ESTUDANTES: a grade, a credencial e o feed ══════════════════════
    /** Entra pela GRADE do hub do estudante — o cartão da missão, não a URL. */
    const entrarPelaGrade = async (pagina, login) => {
      await r.entrar(pagina, login);
      if (!new URL(pagina.url()).pathname.startsWith("/estudante")) {
        await pagina.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });
      }
      const cartao = pagina.locator("main a", { hasText: TITULO_DA_MISSAO }).first();
      await cartao.waitFor({ timeout: 20_000 }).catch(() => {
        throw new Error(
          `o cartão “${TITULO_DA_MISSAO}” não está ABERTO na grade da ${TURMA}: o seed libera a missão lá, e a ` +
            "atividade criada acima precisa estar em andamento",
        );
      });
      await hidratado(pagina, cartao);
      await cartao.click();
      await pagina.waitForURL(`**/exp/${EXP_ID}**`, { timeout: 30_000 });
    };
    const frameDe = (pagina) => () => pagina.frameLocator('iframe[title="experiencia"]');
    /**
     * Espera o FIM das animações finitas antes da captura (o fade das folhas do
     * Unoovista saía desbotado no print). A infinita (o pulso da plenária)
     * nunca termina e não entra na conta.
     */
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

    /** A credencial: o crachá e o botão. */
    const abrirACredencial = async (q) => {
      const acessar = q().getByRole("button", { name: "Acessar Feed da Mostra" });
      await acessar.waitFor({ timeout: 40_000 });
      return acessar;
    };

    /**
     * Rola o feed até os dez. O feed é servido UM post por vez: cada vez que o
     * último servido fica ≥ 60% visível, a tela pede o próximo ao motor da api.
     * `aoChegar(post)` roda a cada post novo, antes da rolagem seguinte.
     */
    const rolarAteOsDez = async (pagina, q, aoChegar = async () => {}) => {
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
      await q().getByText("10 estandes avaliados. Toque abaixo para emitir seu voto final.").first().waitFor({ timeout: 15_000 });
    };

    /** A cédula: o projeto pelo título, a convicção, e o latch. */
    const votar = async (q, tituloDoProjeto, conviccao) => {
      await q().getByRole("button", { name: "Cédula Oficial de Votação — Jurado" }).click();
      const urna = q().getByRole("dialog", { name: "Urna Oficial de Votação do Júri" });
      await urna.waitFor({ timeout: 10_000 });
      const opcao = tituloDoProjeto
        ? urna.getByRole("radio", { name: new RegExp(`^${escaparRegex(tituloDoProjeto)}`) }).first()
        : urna.getByRole("radio").first();
      await opcao.click();
      await urna.getByRole("button", { name: conviccao, exact: true }).click();
      return urna;
    };

    // ── ESTUDANTE 1: o que curte ─────────────────────────────────────────
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await entrarPelaGrade(p, PRIMEIRO.login);
    const q = frameDe(p);
    const acessar1 = await abrirACredencial(q);
    r.exigir(
      (await q().getByText("Credencial Oficial de Jurado Estudantil").count()) > 0,
      "a missão abre pelo crachá da comissão",
    );
    r.exigir(
      (await q().getByText(`Mostra: ${PARAMETROS.tema}`).count()) > 0,
      "o crachá traz o tema da mostra da professora",
    );
    await r.registrar(p, "credencial", {
      titulo: "A credencial de jurado",
      mostra: "O crachá da Comissão Estadual: o tema da mostra, as quatro áreas em disputa e o mandato de jurado.",
      prova:
        "A missão abre pelo papel de jurado e pela promessa de explorar as escolas concorrentes. Nenhuma palavra " +
        "sobre o feed se adaptar: a descoberta é dela, depois.",
    });

    await acessar1.click();
    const artigos1 = q().locator("article[data-post-id]");
    await artigos1.nth(3).waitFor({ timeout: 20_000 });
    const abertura = (await sessaoDe(p)).feed.posts;
    r.exigir(
      abertura.length === 4 && new Set(abertura.map((x) => x.area)).size === 4,
      `a abertura do feed traz 4 posts, um de cada área (${abertura.map((x) => x.area).join(", ")})`,
    );

    /* A 2ª lâmina do carrossel (a ficha técnica), ARRASTANDO COM O MOUSE — o
       pedido do PO: o carrossel era só de toque, e no computador da escola o
       arrasto nativo da imagem cancelava o gesto. O teclado já funcionava e
       escondia o defeito; por isso a prova é o mouse de verdade. */
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
    await primeiroPost.getByText("Ficha técnica").first().waitFor({ timeout: 10_000 });
    /* E as SETAS, a navegação por clique: a anterior volta, a próxima avança. */
    await primeiroPost.locator('[data-seta="anterior"]').click();
    await primeiroPost.getByRole("button", { name: "Próxima lâmina" }).waitFor({ timeout: 10_000 });
    r.exigir(
      (await primeiroPost.getByText("Ficha técnica").count()) === 0,
      "a seta “Lâmina anterior” volta à fotografia do estande",
    );
    await primeiroPost.locator('[data-seta="proxima"]').click();
    await primeiroPost.getByText("Ficha técnica").first().waitFor({ timeout: 10_000 });
    await r.registrar(p, "feed-ficha-tecnica", {
      titulo: "O feed da mostra, e a ficha técnica",
      mostra:
        "O primeiro post da abertura com a 2ª lâmina do carrossel — aberta ARRASTANDO COM O MOUSE — e a seta de " +
        "voltar sobre a mídia: projeto, escola, área e perfil.",
      prova:
        "O carrossel anda com o dedo, com o mouse e pelas setas (o pedido do PO). A abertura mostra um estande de " +
        "cada área — a mostra é variada antes de a bolha fechar; o que não desce é o acervo: só os posts servidos.",
    });
    await primeiroPost.locator('[data-seta="anterior"]').click();

    /* CURTIR DUAS VEZES A MESMA ÁREA. A primeira curtida é no 1º post; a área
       dele vira a do jurado. Sem bolha, o motor serve a apresentação nova da
       área de MAIOR peso — a 2ª curtida acontece cedo, como num app de verdade.
       Cada curtida espera a API registrá-la ANTES da rolagem seguinte: é a
       curtida que entra antes de o motor escolher o próximo. */
    const areaCurtida = abertura[0].area;
    const curtidas = [];
    const curtir = async (postId) => {
      const artigo = q().locator(`article[data-post-id="${postId}"]`);
      /* `exact`: sem ele, "Curtir publicação" casa também "Descurtir publicação". */
      await artigo.getByRole("button", { name: "Curtir publicação", exact: true }).click();
      await artigo.getByRole("button", { name: "Descurtir publicação", exact: true }).waitFor({ timeout: 5_000 });
      await esperarNaApi(p, "/juri-estadual/sessao", (s) => s?.feed?.curtidos?.includes(postId), {
        oQue: `a curtida em ${postId}`,
      });
      curtidas.push(postId);
    };
    await curtir(abertura[0].id);
    await rolarAteOsDez(p, q, async (postId) => {
      if (curtidas.length >= 2 || curtidas.includes(postId)) return;
      const post = (await sessaoDe(p)).feed.posts.find((x) => x.id === postId);
      if (post?.area === areaCurtida) await curtir(postId);
    });
    const feed1 = (await sessaoDe(p)).feed;
    if (
      !r.exigir(
        curtidas.length === 2 && feed1.curtidos.length === 2,
        `o primeiro estudante curtiu DUAS vezes a mesma área (${areaCurtida}: ${curtidas.join(", ") || "nenhuma"})`,
      )
    ) {
      throw new Error(
        `pré-condição da prova da taxa: o feed não serviu um segundo post de ${areaCurtida} para curtir — o motor ` +
          "deveria puxar a área de maior peso (regras/afunilamento.ts#proximoPost)",
      );
    }
    const daArea = feed1.posts.filter((x) => x.area === areaCurtida).length;
    r.exigir(
      feed1.posts.length === 10 && daArea >= 7,
      `com duas curtidas na mesma área, o resto do feed é dela (${daArea} de ${feed1.posts.length} posts de ${areaCurtida})`,
    );
    await semAnimacao(q);
    await r.registrar(p, "feed-completo", {
      titulo: "Dez estandes, e a cédula acende",
      mostra:
        "O fim do feed, com o coração das duas curtidas, a linha da comissão “10 estandes avaliados…” e a barra " +
        "fixa da cédula.",
      prova:
        "O feed fechou numa área só depois de duas curtidas, e a tela não disse nada: a regra roda no servidor " +
        "(o cliente só mede), e a criança vai votar achando que viu a mostra.",
      detalhe: `${daArea} de 10 posts de ${areaCurtida}`,
    });

    const votado1 = feed1.posts.find((x) => x.area === areaCurtida && x.tipo === "apresentacao");
    const urna1 = await votar(q, votado1.titulo, "Com certeza, vi tudo.");
    await r.registrar(p, "cedula", {
      titulo: "A cédula lacrada",
      mostra: "A urna oficial com os estandes que apareceram no feed, o escolhido marcado e a convicção “Com certeza, vi tudo.”",
      prova:
        "A cédula só oferece o que o feed serviu (a api recusa o resto), e as duas convicções afirmam certeza: é a " +
        "aposta que a galeria vai confrontar.",
    });
    await urna1.getByRole("button", { name: "Confirmar Voto Oficial" }).click();
    await q().getByText("Voto Registrado e Lacrado no Sistema").first().waitFor({ timeout: 15_000 });
    await r.registrar(p, "lacre", {
      titulo: "O lacre",
      mostra: "O carimbo “Voto Registrado e Lacrado no Sistema”, o estande votado e o protocolo.",
      prova: "O voto é o LATCH 1: só existe quando a api confirma, e não tem volta.",
    });

    /* O PICO: exatamente três elementos — o brasão, a ordem e o pulso. */
    const plenaria = (qq) => qq().locator(".tela.plenaria");
    const conferirOPico = async (qq, quem) => {
      await plenaria(qq).waitFor({ timeout: 20_000 });
      const elementos = await plenaria(qq).evaluate((el) => el.children.length);
      const texto = await plenaria(qq).innerText();
      r.exigir(elementos === 3, `${quem}: a plenária tem exatamente três elementos (${elementos})`);
      r.exigir(
        (await plenaria(qq).locator("button, [role=tab], article").count()) === 0,
        `${quem}: na plenária não há botão, aba nem post — nada leva de volta`,
      );
      r.exigir(!SPOILER.test(texto), `${quem}: a plenária não diz algoritmo, bolha, filtro nem oculto`);
    };
    await conferirOPico(q, "o primeiro estudante");
    await r.registrar(p, "plenaria-o-pico", {
      titulo: "O pico: a plenária",
      mostra: "O brasão da comissão, a ordem “Acompanhe a projeção da sala com seu professor” e o pulso da mesa.",
      prova:
        "Três elementos, e nenhum a mais: tudo recua porque o que importa agora está na lousa. Quem tira a " +
        "criança daqui é o polling de 3 s do gate, quando a professora libera a galeria.",
    });

    /* F5 NO LATCH: volta à plenária, nunca ao feed nem à cédula. */
    await p.reload({ waitUntil: "domcontentloaded" });
    await plenaria(q).waitFor({ timeout: 40_000 });
    r.exigir(
      (await q().locator("article[data-post-id]").count()) === 0,
      "o F5 depois do voto volta à plenária — o feed e a cédula não voltam",
    );

    // ── ESTUDANTE 2: o que não curte nada ────────────────────────────────
    const p2 = await r.pagina("estudante-2", { viewport: { width: 1280, height: 950 } });
    await entrarPelaGrade(p2, SEGUNDO.login);
    const q2 = frameDe(p2);
    const acessar2 = await abrirACredencial(q2);
    await acessar2.click();
    await q2().locator("article[data-post-id]").nth(3).waitFor({ timeout: 20_000 });
    /* A Cédula antes do décimo post responde com a frase da comissão. */
    await q2().getByRole("tab", { name: "Cédula" }).click();
    await q2().getByText("Avalie os dez estandes do feed antes de votar.").first().waitFor({ timeout: 10_000 });
    await r.registrar(p2, "cedula-antes-da-hora", {
      titulo: "A cédula antes da hora",
      mostra: "O feed do segundo estudante e o aviso da comissão: “Avalie os dez estandes do feed antes de votar.”",
      prova: "O voto só abre com os dez posts servidos — e quem decide é a api (409 `feed-incompleto`), não a aba.",
    });
    /* Rola SEM curtir: o feed passivo segue variado. */
    await rolarAteOsDez(p2, q2);
    const feed2 = (await sessaoDe(p2)).feed;
    r.exigir(feed2.curtidos.length === 0, "o segundo estudante não curtiu nada");
    r.exigir(
      new Set(feed2.posts.map((x) => x.projetoId)).size > new Set(feed1.posts.map((x) => x.projetoId)).size,
      `quem não curtiu viu MAIS projetos diferentes (${new Set(feed2.posts.map((x) => x.projetoId)).size} contra ${new Set(feed1.posts.map((x) => x.projetoId)).size})`,
    );
    const urna2 = await votar(q2, null, "Sim, examinei bem.");
    await urna2.getByRole("button", { name: "Confirmar Voto Oficial" }).click();
    await q2().getByText("Voto Registrado e Lacrado no Sistema").first().waitFor({ timeout: 15_000 });
    await conferirOPico(q2, "o segundo estudante");

    // ═══ PROFESSORA: a lousa do pico, e o botão ══════════════════════════
    const painelNoPico = await esperarNaApi(
      prof,
      `${caminhoDaTurma}/painel`,
      (c) => (c?.resumo?.computadores?.votaram ?? 0) >= 2,
      { oQue: "os dois votos no painel da aula" },
    );
    const { resumo } = painelNoPico;
    r.exigir(resumo.computadores.votaram === 2, `o painel conta os dois votos desta rodada (${resumo.computadores.votaram})`);
    r.exigir(
      resumo.votosPorArea.reduce((n, a) => n + a.votos, 0) === 2 &&
        (resumo.votosPorArea.find((a) => a.area === areaCurtida)?.votos ?? 0) >= 1,
      `os votos por área somam 2, e a área curtida tem o voto do primeiro (${resumo.votosPorArea.map((a) => `${a.area}=${a.votos}`).join(", ")})`,
    );
    await prof.reload({ waitUntil: "domcontentloaded" });
    const lousa = prof.locator("[data-painel-para-projetar]");
    await lousa.waitFor({ timeout: 30_000 });
    const fraseDoPico = fraseDosVotos(resumo.computadores, resumo.porComputador);
    r.exigir(
      (await prof.locator("main").innerText()).includes(fraseDoPico),
      `o painel diz “${fraseDoPico}”`,
    );
    r.exigir((await lousa.locator("[data-votos-por-area] li").count()) === 4, "a lousa lista os votos das quatro áreas");
    r.exigir(
      /Aparece quando você liberar a Galeria Oculta/.test(await lousa.innerText()),
      "antes da galeria, a invisibilidade média NÃO está na lousa: ela contaria à turma o que a galeria vai mostrar",
    );
    await lousa.scrollIntoViewIfNeeded();
    await r.registrar(prof, "lousa-do-pico", {
      titulo: "A lousa do pico",
      mostra: `“${fraseDoPico}”, o gráfico dos votos por área e as contagens de cada uma — o cartão que vai para o projetor.`,
      prova:
        "Sem nome: a lousa diz como a turma se dividiu, nunca quem votou em quê (PED-07). A taxa média fica de " +
        "fora até a galeria, e as perguntas da plenária vêm da api, verbatim.",
      inteira: true,
    });
    await apertar(prof, "galeria");
    r.exigir(
      (await prof.locator("[data-gate]").count()) === 0,
      "depois de liberar, o botão da aula some: ele não volta",
    );

    // ═══ A GALERIA OCULTA: duas taxas, as duas reais ═════════════════════
    const comunicado = (qq) => qq().locator(".galeria__comunicado");
    await comunicado(q).waitFor({ timeout: 40_000 });
    await comunicado(q2).waitFor({ timeout: 40_000 });
    const galeria1 = await lerApi(p, "/juri-estadual/galeria");
    const galeria2 = await lerApi(p2, "/juri-estadual/galeria");
    if (galeria1.status !== 200 || galeria2.status !== 200) {
      throw new Error(`a galeria não abriu pela api (HTTP ${galeria1.status} e ${galeria2.status})`);
    }
    const taxa1 = galeria1.corpo.invisibilidade;
    const taxa2 = galeria2.corpo.invisibilidade;
    const frase1 = fraseDaTaxa(taxa1);
    const frase2 = fraseDaTaxa(taxa2);
    r.exigir((await q().getByText(frase1).count()) > 0, `a tela do primeiro diz a taxa da api: “${frase1}”`);
    r.exigir((await q2().getByText(frase2).count()) > 0, `a tela do segundo diz a taxa da api: “${frase2}”`);
    r.exigir(
      taxa1.percentual > taxa2.percentual,
      `a taxa de quem curtiu duas vezes a mesma área (${taxa1.percentual}%) é MAIOR que a de quem não curtiu (${taxa2.percentual}%)`,
    );
    await semAnimacao(q);
    await r.registrar(p, "galeria-oculta", {
      titulo: "A Galeria Oculta",
      mostra: `O comunicado da comissão e a taxa REAL desta sessão — “${frase1}” — sobre a grade dos estandes que nunca chegaram ao feed.`,
      prova:
        "O número é calculado no servidor sobre o que o feed serviu a ESTA criança. Nada é cravado na copy: a " +
        "grade tem o tamanho que tiver.",
      detalhe: `${taxa1.ocultos} de ${taxa1.total} ocultos`,
    });
    await semAnimacao(q2);
    await r.registrar(p2, "galeria-de-quem-nao-curtiu", {
      titulo: "A mesma galeria, outra taxa",
      mostra: `A galeria de quem não curtiu nada: “${frase2}”.`,
      prova:
        `Os dois rolaram dez posts da mesma mostra; ${taxa1.percentual}% contra ${taxa2.percentual}%. A diferença é ` +
        "a prova de que a taxa é real — e de que foram as curtidas que esconderam a mostra.",
      detalhe: `${taxa2.ocultos} de ${taxa2.total} ocultos`,
    });

    // ── ESTUDANTE 1: abrir ocultos, buscar por hashtag, manter o voto ────
    const projetos1 = galeria1.corpo.projetos;
    const ocultos1 = projetos1.filter((x) => !x.exibidoNoSeuFeed);
    const fecharFicha = async (qq, nome) => {
      const ficha = qq().getByRole("dialog", { name: nome });
      await ficha.press("Escape");
      await ficha.waitFor({ state: "detached", timeout: 10_000 });
    };
    /* Um oculto de outra área, pela grade dos ocultos (a ordem é a da api). */
    const outro = ocultos1.findIndex((x) => x.area !== areaCurtida);
    const gradeOculta = q().getByRole("list", { name: "Estandes que não chegaram ao seu feed" });
    await gradeOculta.getByRole("listitem").nth(outro).click();
    const ficha1 = q().getByRole("dialog", { name: ocultos1[outro].titulo });
    await ficha1.waitFor({ timeout: 10_000 });
    r.exigir(
      (await ficha1.getByText("Não chegou ao seu feed").count()) > 0,
      "a ficha do estande oculto diz que ele não chegou ao feed",
    );
    await r.registrar(p, "galeria-ficha", {
      titulo: "A ficha de um estande que não chegou",
      mostra: `A ficha de “${ocultos1[outro].titulo}”: a etiqueta “Não chegou ao seu feed”, a escola, a área, o perfil e a legenda.`,
      prova: "Abrir um estande oculto é o registro da EF06CO10 (e, depois da hashtag de outra área, da EF06CO01), lido no latch da revisão do voto.",
    });
    await fecharFicha(q, ocultos1[outro].titulo);

    /* A busca por HASHTAG: o chip de uma terceira área. */
    const areaBuscada =
      AREAS.find((a) => a !== areaCurtida && a !== ocultos1[outro].area) ?? AREAS.find((a) => a !== areaCurtida);
    const categoriaBuscada = (await sessaoDe(p)).categorias.find((c) => c.area === areaBuscada);
    const chip = `#${categoriaBuscada.hashtag.replace(/^#+/, "")}`;
    await q().getByRole("group", { name: "Hashtags oficiais da mostra" }).getByRole("button", { name: chip, exact: true }).click();
    const gradeDaBusca = q().getByRole("list", { name: "Estandes encontrados" });
    await gradeDaBusca.waitFor({ timeout: 10_000 });
    r.exigir(
      (await gradeDaBusca.getByRole("listitem").count()) === 4,
      `a hashtag ${chip} mostra os quatro estandes da área, os vistos e os ocultos`,
    );
    const primeiroDaBusca = projetos1.find((x) => x.area === areaBuscada);
    await gradeDaBusca.getByRole("listitem").first().click();
    await q().getByRole("dialog", { name: primeiroDaBusca.titulo }).waitFor({ timeout: 10_000 });
    await fecharFicha(q, primeiroDaBusca.titulo);
    await semAnimacao(q);
    await r.registrar(p, "galeria-busca-hashtag", {
      titulo: "A busca por hashtag",
      mostra: `O chip ${chip} tocado e os quatro estandes de “${categoriaBuscada.nome}”, inclusive os que o feed nunca mostrou.`,
      prova:
        "A busca é a ferramenta que fura a bolha. Da busca, a api recebe só o TIPO e a área que casou — o texto " +
        "digitado é de menor e nunca sai do aparelho.",
    });

    await q().getByRole("button", { name: "Manter meu voto inicial" }).click();
    await q().getByText("Você viveu em tela o que Léo investigou no livro didático!").first().waitFor({ timeout: 20_000 });

    // ── ESTUDANTE 2: buscar por texto, trocar o voto, e o F5 do latch 2 ──
    const categoriaDoTexto = (await sessaoDe(p2)).categorias[0];
    const busca = q2().getByRole("searchbox", { name: "Pesquisar projetos ou #tags" });
    await busca.click();
    await busca.pressSequentially(categoriaDoTexto.hashtag.startsWith("#") ? categoriaDoTexto.hashtag : `#${categoriaDoTexto.hashtag}`);
    const gradeDaBusca2 = q2().getByRole("list", { name: "Estandes encontrados" });
    await gradeDaBusca2.waitFor({ timeout: 10_000 });
    await gradeDaBusca2.getByRole("listitem").first().click();
    await q2().getByRole("dialog").first().waitFor({ timeout: 10_000 });
    await q2().getByRole("dialog").first().press("Escape");
    await q2().getByRole("dialog").first().waitFor({ state: "detached", timeout: 10_000 });

    await q2().locator(".doca").getByRole("button", { name: "Revisar Voto Oficial" }).click();
    const revisaoDoVoto = q2().getByRole("dialog", { name: "Cédula Extraordinária de Revisão" });
    await revisaoDoVoto.waitFor({ timeout: 10_000 });
    await revisaoDoVoto.getByRole("radio").first().click();
    await semAnimacao(q2);
    await r.registrar(p2, "revisao-do-voto", {
      titulo: "A cédula extraordinária",
      mostra: "A revisão do voto depois da galeria: os dezesseis estandes, menos o do voto lacrado, e um escolhido.",
      prova:
        "Manter ou trocar é o LATCH 2. A troca aceita qualquer estande que a galeria mostrou, e a api grava o " +
        "voto FINAL ao lado do lacrado — o painel mostra quantos mantiveram e quantos trocaram.",
    });
    await revisaoDoVoto.getByRole("button", { name: "Revisar Voto Oficial" }).click();
    const leo = (qq) => qq().getByText("Você viveu em tela o que Léo investigou no livro didático!").first();
    await leo(q2).waitFor({ timeout: 20_000 });
    /* F5 NO LATCH 2: volta à cadeia, nunca à galeria. */
    await p2.reload({ waitUntil: "domcontentloaded" });
    await leo(q2).waitFor({ timeout: 40_000 });
    r.exigir(
      (await q2().locator(".galeria__comunicado").count()) === 0,
      "o F5 depois da revisão do voto volta à cadeia — a galeria não reabre",
    );
    const sessao2 = await sessaoDe(p2);
    r.exigir(
      sessao2.revisao?.acao === "trocar" && sessao2.revisao.projetoId !== sessao2.voto?.projetoId,
      "a api guardou a troca, com o voto final diferente do lacrado",
    );

    // ═══ PROFESSORA: a lousa depois da galeria ═══════════════════════════
    const painelDepois = await esperarNaApi(
      prof,
      `${caminhoDaTurma}/painel`,
      (c) => (c?.resumo?.revisaram ?? 0) >= 2,
      { oQue: "as duas revisões no painel" },
    );
    r.exigir(
      painelDepois.resumo.revisao.mantiveram === 1 && painelDepois.resumo.revisao.trocaram === 1,
      `um manteve e um trocou (${JSON.stringify(painelDepois.resumo.revisao)})`,
    );
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.locator("[data-revisao-da-turma]").waitFor({ timeout: 30_000 });
    r.exigir(
      painelDepois.resumo.invisibilidadeMedia !== null &&
        (await prof.locator("[data-painel-para-projetar]").innerText()).includes(`${painelDepois.resumo.invisibilidadeMedia}%`),
      `depois da galeria, a lousa mostra a invisibilidade média da turma (${painelDepois.resumo.invisibilidadeMedia}%)`,
    );
    await prof.locator("[data-painel-para-projetar]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "lousa-depois-da-galeria", {
      titulo: "A lousa depois da galeria",
      mostra:
        "Os votos por área antes e depois da Galeria Oculta, a invisibilidade média da turma e quantos trocaram " +
        "e mantiveram o voto.",
      prova:
        "A média é a da taxa REAL de quem votou, e só aparece agora: a descoberta chegou pela tela de cada criança, " +
        "não pela lousa. Ainda sem nome.",
      inteira: true,
    });

    // ═══ ESTUDANTE 1: a cadeia (EF06CO03), errando uma vez ═══════════════
    /* Sem a tela dos pacotes (a EF06CO07 saiu, o pedido do PO): a revisão leva
       direto à cadeia, e a frase do Léo abre a tela dela. */
    await q().getByRole("region", { name: "Blocos da engrenagem" }).waitFor({ timeout: 20_000 });
    r.exigir(
      (await leo(q).count()) > 0 && (await q().getByText(/pacotes? numerad|Remontar mensagem/).count()) === 0,
      "a cadeia abre com a frase do Léo, e não há mais tela de pacotes",
    );
    await semAnimacao(q);
    await r.registrar(p, "cadeia-com-o-leo", {
      titulo: "O Léo, no topo da cadeia",
      mostra: "A tela da escola: “Você viveu em tela o que Léo investigou no livro didático!”, a instrução e os quatro blocos.",
      prova:
        "A missão sai do clone para EXPLICAR (a fronteira do disfarce é quem fala). A única exclamação da missão " +
        "é a ponte com o livro didático, agora no primeiro momento em que a Unooria mostra a engrenagem.",
    });
    const bandejaDaCadeia = () => q().getByRole("region", { name: "Blocos da engrenagem" });
    const bloco = (rotulo) => bandejaDaCadeia().getByRole("button", { name: new RegExp(`^${escaparRegex(rotulo)}`) });
    const DADOS = "Registro de dados e padrões";
    const INTERACOES = "Interações do jurado (curtidas)";
    const ALGORITMO = "Algoritmo de recomendação";
    const BOLHA = "Formação de bolha temática";
    for (const rotulo of [DADOS, INTERACOES, ALGORITMO, BOLHA]) await bloco(rotulo).click();
    await q().getByRole("button", { name: "Validar Cadeia Lógica" }).click();
    await q().getByText(/A sequência lógica ainda não encaixou/).first().waitFor({ timeout: 15_000 });
    r.exigir(
      (await q().getByText("Voltou para a bandeja").count()) > 0,
      "na ordem errada, os blocos voltam para a bandeja",
    );
    r.exigir(
      !CARIMBO_OU_ACERTO.test(await q().locator("body").innerText()),
      "e a tela não diz qual vaga errou nem fala em erro",
    );
    await r.registrar(p, "cadeia-errada", {
      titulo: "A cadeia que não encaixou",
      mostra: "Os quatro blocos de volta à bandeja e a frase de apoio: “Pense no que você fez primeiro e como o aplicativo respondeu.”",
      prova:
        "O servidor confere a ordem (os ids são opacos e a certa nunca desce) e responde só certo ou não. Cada " +
        "envio é uma tentativa: é delas que sai o nível da EF06CO03.",
    });
    for (const rotulo of [INTERACOES, DADOS, ALGORITMO, BOLHA]) await bloco(rotulo).click();
    await q().getByRole("button", { name: "Validar Cadeia Lógica" }).click();
    await q().getByText("Cadeia lógica montada").first().waitFor({ timeout: 15_000 });
    await semAnimacao(q);
    await r.registrar(p, "cadeia-montada", {
      titulo: "Interações → Dados → Algoritmo → Bolha",
      mostra: "A cadeia lógica montada na calha, na segunda tentativa.",
      prova: "A regra que o feed executou vira descrição precisa: o “se… então…” que a enquete da EF06CO03 pergunta.",
    });
    await q().getByRole("button", { name: "Continuar", exact: true }).click();

    // ═══ ESTUDANTE 1: o caso Mariana ═════════════════════════════════════
    /* Os cartões vêm EMBARALHADOS: casa-se pelo texto, pelo papel. */
    const mecanismo = q().getByRole("radio", { name: /^O aplicativo usou a curtida como dado/ });
    await mecanismo.waitFor({ timeout: 20_000 });
    await mecanismo.click();
    await q().getByRole("radio", { name: /^Fazer buscas ativas pelos canais da Chapa B/ }).click();
    await semAnimacao(q);
    await r.registrar(p, "caso-mariana", {
      titulo: "O caso de Mariana",
      mostra: "A eleição do grêmio contada pela comissão, e um cartão de mecanismo e um de atitude escolhidos.",
      prova:
        "A transferência para um caso novo, de volta ao clone. A tela não diz qual cartão é o certo — nem depois: " +
        "a escolha vai para a plenária, e não vira nota.",
    });
    await q().getByRole("button", { name: "Registrar Explicação e Avançar" }).click();

    // ═══ ESTUDANTE 1: as três enquetes nos Stories ═══════════════════════
    const ENQUETES = [
      /* A P1 é a da EF06CO10 (o foco primário), verbatim da spec 9.6, item 1. */
      { alternativa: /^Revela um engano: o jurado não percebeu/, confirmada: "Resposta registrada na ata do júri." },
      { alternativa: /^O sistema associou cada curtida a um tipo de dado temático/, confirmada: "Dados computados na ata oficial." },
      { alternativa: /^SE o jurado curtir dois ou mais posts do mesmo tema/, confirmada: "Regra lógica conferida e arquivada." },
    ];
    for (const [i, enquete] of ENQUETES.entries()) {
      /* As alternativas vêm EMBARALHADAS a cada leitura: casa-se pelo texto. */
      await q().getByRole("button", { name: enquete.alternativa }).click({ timeout: 30_000 });
      await q().getByText(enquete.confirmada).first().waitFor({ timeout: 15_000 });
      r.exigir(
        !CARIMBO_OU_ACERTO.test(await q().locator("body").innerText()),
        `a enquete ${i + 1} confirma o registro na ata, sem acerto`,
      );
      if (i === 0) {
        r.exigir(
          (await q().getByText(/^Ao final da mostra, um jurado disse:/).count()) > 0,
          "a primeira enquete é a da EF06CO10: a frase do jurado que só viu robótica",
        );
        await r.registrar(p, "enquete", {
          titulo: "A consulta aos jurados",
          mostra:
            "Os Stories da comissão, em tema escuro: a primeira pergunta — a frase do jurado (EF06CO10) —, a " +
            "alternativa tocada e “Resposta registrada na ata do júri.”",
          prova:
            "O gabarito mora na ficha da api e a ordem muda a cada leitura (ADR-118). A criança não sabe se " +
            "“acertou” — é evidência para a professora, não prova.",
        });
      }
      if (i < ENQUETES.length - 1) await q().locator("button", { hasText: "Próxima pergunta" }).last().click();
    }
    await q().getByRole("button", { name: "Encerrar consulta" }).click();
    await q().locator(".fim__carimbo").waitFor({ timeout: 20_000 });
    r.exigir(
      (await q().getByText("Missão Cumprida · Credencial de Jurado Homologada").count()) > 0,
      "a missão termina com o crachá homologado",
    );
    await semAnimacao(q);
    await r.registrar(p, "cracha-homologado", {
      titulo: "Missão cumprida",
      mostra: "O mesmo crachá da entrada, agora homologado, e o infográfico de leitura silenciosa: como os robôs leem nossas curtidas.",
      prova: "O fim não tem botão nem nota: a missão acabou, e o nível de cada habilidade é do servidor.",
    });

    // ═══ PROFESSORA: a folha e as habilidades ════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    const habilidades = prof.locator("[data-habilidades-do-juri]");
    await habilidades.waitFor({ timeout: 30_000 });
    await habilidades.getByText("EF06CO10").first().waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await habilidades.innerText();
    r.exigir(
      ["EF06CO10", "EF06CO01", "EF06CO03"].every((codigo) => textoDasHabilidades.includes(codigo)) &&
        !textoDasHabilidades.includes("EF06CO07"),
      "o painel de habilidades mostra EF06CO10, EF06CO01 e EF06CO03 — e não a EF06CO07",
    );
    /* A RÉGUA (ADR-145): o critério de cada nível, em texto, no fim do painel —
       a da EF06CO10 conta os estandes ocultos; a da EF06CO01, a hashtag de outra área. */
    r.exigir(
      textoDasHabilidades.includes("pelo menos dois estandes que o feed escondeu") &&
        textoDasHabilidades.includes("busca pela hashtag de uma área que não a do voto"),
      "o painel lista a régua da EF06CO10 (ocultos abertos) e a da EF06CO01 (hashtag de outra área)",
    );
    /* E toda rodada mede as ações (ADR-145): a revisão do voto marcou as duas. */
    const painelDeHabilidades = await lerApi(
      prof,
      `/evidencias/turma/${turmaId}/missao/exp06ef1b/atividade/${atividadeId}`,
    );
    const textoDoPainel = JSON.stringify(painelDeHabilidades.corpo ?? {});
    r.exigir(
      painelDeHabilidades.status === 200 && textoDoPainel.includes("EF06CO10") && textoDoPainel.includes("EF06CO01"),
      `a api do painel de habilidades traz a EF06CO10 e a EF06CO01 desta atividade (HTTP ${painelDeHabilidades.status})`,
    );
    /* Pelos CABEÇALHOS das colunas, não pelo texto da página: a folha explica à
       professora que "não há coluna de voto, de taxa nem de nível", e a frase
       que nega a coluna não pode reprovar a suíte que prova a ausência dela. */
    const colunas = await prof.locator("main").getByRole("columnheader").allInnerTexts();
    r.exigir(colunas.length > 0, "a folha da turma está na tela, com as colunas");
    r.exigir(
      !colunas.some((c) => /^\s*voto\b|\b(taxa|n[íi]vel|invisibilidade|pontos|nota|ranking|acerto)\b/i.test(c)),
      `a folha não tem coluna de voto, taxa nem nível (colunas: ${colunas.join(", ")})`,
    );
    await habilidades.scrollIntoViewIfNeeded();
    await r.registrar(prof, "resultados-e-habilidades", {
      titulo: "A folha da turma, e as habilidades",
      mostra:
        "Onde cada computador está — cédula, galeria, busca, revisão, missão — e o painel de habilidades da BNCC " +
        "desta atividade: EF06CO10, EF06CO01 e EF06CO03, com a régua de cada nível.",
      prova:
        "A folha diz só o progresso: ela tem nomes, então não liga nome a voto nem a taxa. O nível vem da " +
        "auditoria da galeria (os ocultos abertos para a EF06CO10, a hashtag de outra área para a EF06CO01), da " +
        "cadeia e das três enquetes, e fica no painel de habilidades, com a confirmação da professora.",
      inteira: true,
    });

    // ═══ PROFESSORA: o podcast de recapitulação ══════════════════════════
    /* O episódio revela a virada, e o módulo de podcast não trava por etapa:
       o cartão leva o aviso de quando tocar. Ele existe em toda etapa (o texto
       muda com a galeria), então a prova é estar à vista. */
    const avisoDoPodcast = prof.locator("[data-aviso-do-podcast]");
    await avisoDoPodcast.waitFor({ timeout: 20_000 }).catch(() => undefined);
    r.exigir(
      await avisoDoPodcast.isVisible(),
      "o cartão do podcast avisa que o episódio revela a virada e só toca depois da Galeria Oculta",
    );
    await provarPodcastNaAula(r, prof, {
      blocos: ["Abertura", "Recapitulação da vivência", "A grande revelação", "Provocação e transferência", "Encerramento"],
      vozes: ["Bia", "Rafa"],
      trechos: 5,
      passo: "podcast",
      descricao: "Bia e Rafa, cerca de 3 min 45 s",
    });
  },
);
