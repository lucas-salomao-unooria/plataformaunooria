import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";
import { abrirAba, revelar, textoDeTodasAsAbas } from "../lib/abas.mjs";

/**
 * O guia da aula de cada missão publicada (ADR-65).
 *
 * Antes só o Instanooria tinha guia, e ele era uma página escrita à mão. Hoje o
 * conteúdo é dado e a ordem é de um renderizador único — o que esta suíte
 * comprova é justamente o que o typecheck não pega: que as seis missões TÊM
 * guia, que as seções aparecem na mesma ordem em todas, e que o caminho até lá
 * existe a partir da SALA DE AULA, onde o professor está.
 *
 * **Todo guia tem bloco vivo, e todo bloco vivo é cobrado aqui** (ADR-86). Duas
 * missões tinham `vivo: []` e a do Rastro do Boato não estava nesta lista: era
 * a suíte concordando com o defeito que o produto tinha, porque o guia
 * DESCREVIA o conteúdo em vez de mostrá-lo — e descrição não quebra, só
 * envelhece.
 *
 * O caminho pela sala é o que mais importa: o guia por si já era alcançável
 * pela ficha da missão. O que faltava era abri-lo com a turma na frente,
 * enquanto se decide o que rodar hoje.
 */
const TURMA = process.env.TURMA ?? "8A";

/** Uma linha por missão publicada: onde mora o guia e o que só ele diz. */
const GUIAS = [
  {
    rota: "/professor/entre-redes/8-ano/unidade-1/guia",
    missao: "Unoovista · 8º ano",
    /* Vem de `CONTROLE_DO_PROFESSOR` e de `@edu/conteudo-exp08ef1b`: se o bloco
       vivo quebrar, o guia continua renderizando e some em silêncio. */
    vivo: [/Você conduz — os \d+ momentos/i, /O que a turma lê na revelação/i],
    bncc: "EF08CO11",
  },
  {
    rota: "/professor/entre-redes/2-serie/unidade-1/guia",
    missao: "O Efeito Amplificador · 2ª série EM",
    /* Desde a ADR-181 a unidade é O Efeito Amplificador (a Tempestade virou
       versão anterior, fora do catálogo). Os dois blocos vivos vêm de
       `GET /efeito-amplificador/professor/material`: o pacote padrão com o
       gabarito, para ler antes, e o critério de cada nível, para o depois. */
    vivo: [/O pacote padrão — “/, /O critério de cada nível/],
    bncc: "EM13CO24",
    /* A 2.1.0 (ADR-191): o debate fecha no TC-24, literal, e a pergunta de
       TRANSFERÊNCIA saiu com a etapa dela ("Que outro aplicativo… muda de
       comportamento à noite?"). Guia que ainda a traz manda o professor
       perguntar algo que a missão deixou de preparar. */
    literal: [/quem é o verdadeiro cliente da rede social e o que está sendo vendido\?/],
    ausente: [/Que outro aplicativo que vocês usam muda de comportamento à noite/],
  },
  {
    rota: "/professor/entre-redes/7-ano/unidade-1/guia",
    missao: "A Seleção · 7º ano",
    /* Os gatilhos dos três momentos, as três perguntas do debate e as seleções
       dos colegas virtuais vêm de `GET /a-selecao/professor/material`. A
       pergunta é conferida pelo texto exato: o professor a lê no debate, e
       paráfrase no guia deixaria a turma comentando uma frase que ninguém viu. */
    vivo: [
      /Os colegas virtuais: Tomás e Malu/i,
      /qual detalhe fundamental do evento ele mostrou/i,
    ],
    bncc: "EF07CO11",
  },
  {
    rota: "/professor/entre-redes/6-ano/unidade-2/guia",
    missao: "O Rastro do Boato · 6º ano",
    /* A missão que faltava nesta suíte inteira. As três intervenções vêm de
       `GET /rastro-boato/professor/material`; a reação repetida é a prova de
       que A e C terminam IGUAIS — a peça central da missão, que a paráfrase
       do guia apagava. */
    vivo: [
      /As três intervenções e o que cada uma faz — só para você/i,
      /Denunciar conteúdo e responder fixando o laudo oficial/i,
      /recebi em mais três grupos agora/i,
      /O ciclo, na ordem certa/i,
    ],
    bncc: "EF06CO08",
  },
  {
    rota: "/professor/entre-redes/6-ano/unidade-1/guia",
    missao: "O Júri Estadual de Projetos · 6º ano",
    /* Os dois blocos vivos vêm de `GET /juri-estadual/professor/material`: a
       regra do feed com o gabarito (as peças da regra SE … ENTÃO com a certa
       marcada, ADR-174; o caso Mariana saiu na ADR-176) e as quatro perguntas da plenária. A
       pergunta é conferida pelo texto exato: é a mesma que o painel da aula
       projeta, e paráfrase no guia deixaria a turma comentando outra frase. */
    vivo: [
      /A regra do feed e o gabarito — só para você/i,
      /A regra SE … ENTÃO, peça por peça/,
      /o jurado curtir 2 ou mais posts do mesmo tema/,
      /As quatro perguntas da plenária — entre o voto e a galeria/i,
      /parte da turma tenha votado em robôs e outra parte em projetos de meio ambiente/,
      /* 40 projetos (2026-10-14): a regra do feed não repete post — a área
         líder traz OUTROS projetos dela, não os mesmos em outros formatos — e
         o total escondido é igual para todos; o que muda é quais áreas. Os
         números saem da api (`regra.postsNoFeed`) e do total da mostra. */
      /outros projetos da mesma área,\s+nenhum repetido/,
      /Com 40 estandes e 10 publicações, todo computador que chega ao fim do feed\s+fica com 30 estandes fora dele/,
    ],
    /* A principal desde a ficha 5 (ADR-174; ficha 6, ADR-176): a EF06CO10 saiu da missão. */
    bncc: "EF06CO01",
  },
  {
    rota: "/professor/entre-redes/2-ano/unidade-1/guia",
    missao: "O Enigma da Capa da Rádio · 2º ano",
    /* Os três blocos vivos vêm de `GET /enigma-capa/professor/material`: as
       cenas prontas COM o gabarito (os dois objetos iguais de cada uma), o
       roteiro da conversa individual (a frase do arraste é conferida pelo
       texto exato: o professor a repete em todo arraste) e o critério de cada
       nível da régua. Desde a 2.0.0 (ADR-186) o bloco das cenas também lista os
       componentes do 2º ano que a personalização aceita. */
    vivo: [
      /As cenas prontas, com o gabarito — só para você/,
      /Biblioteca Escolar — /,
      /Para personalizar com IA, escolha o componente:.*Ensino Religioso.*Computação.*Outro componente/,
      /A conversa individual: a pausa, os três cartões e as perguntas/,
      /Você pode mover a foto, mas não mudar o tamanho\./,
      /O critério de cada nível \(registrado pelo que a criança faz\)/,
    ],
    bncc: "EF02CO05",
  },
  {
    rota: "/professor/entre-redes/1-serie/unidade-1/guia",
    missao: "O Assistente Invisível · 1ª série EM",
    /* Os dois blocos vivos vêm de `GET /assistente-invisivel/professor/material`:
       as quatro perguntas do roteiro de debate (one-pager §9a), cada uma no
       momento dela; e o critério de cada nível das quatro habilidades. A
       pergunta é conferida pelo texto exato: é a mesma que o painel da aula
       projeta na Mediação 1. O caso de mercado da Etapa 6 saiu (ADR-189): o
       passo do roteiro, abaixo, cobra que ele não volte. */
    vivo: [
      /O roteiro de debate mediado — as quatro perguntas/,
      /Estudar às 23h45 significa necessariamente que um estudante não tem capacidade/,
      /Por que a LGPD proíbe caixas-pretas e garante o direito de pedir revisão humana\?/,
      /O critério de cada nível \(registrado pelo que o estudante faz\)/,
    ],
    bncc: "EM13CO20",
  },
  {
    rota: "/professor/entre-redes/3-serie/unidade-1/guia",
    missao: "O Porta-Voz dos Dados · 3ª série EM",
    /* Os três blocos vivos vêm de `GET /porta-voz-dos-dados/professor/material`
       (ADR-198): o banco padrão com a perícia e o GABARITO (só o professor o
       vê — o estudante recebe os cartões sem rótulo), o laudo do Explicar com
       o fator na forma corrigida pelo PO ("≈ 6,3", nunca 6,37) e o critério de
       cada nível das seis habilidades. */
    vivo: [
      /O banco padrão — “Vigilância Sanitária da Água”, e a perícia com o gabarito/,
      /O distorcido · motivo: escala/,
      /O laudo do Explicar — Fator de Mentira ≈ 6,3/,
      /O critério de cada nível \(registrado pelo que o estudante faz\)/,
    ],
    ausente: [/6,37/],
    bncc: "EM13CO12",
  },
  {
    rota: "/professor/entre-redes/vila-do-lume/guia",
    missao: "Vila do Lume · transversal",
    vivo: [/não foi um colega de verdade/i],
    bncc: "EF07CO07",
  },
];

/** As seções que TODO guia tem, na ordem em que o renderizador as escreve. */
const SECOES = [
  "O que a turma aprende",
  "Antes da aula",
  "Cuidados",
  "Roteiro",
  "Perguntas para o debate",
  "Mediação",
  "Depois da aula",
  "Adaptações",
  "Dúvidas frequentes",
];

/** Os quatro tempos — as abas do guia (ADR-182), e a seção que prova cada um. */
const TEMPOS = [
  { aba: "Preparar", secao: "O que a turma aprende" },
  { aba: "Conduzir", secao: "Roteiro da aula" },
  { aba: "Fechar", secao: "Depois da aula" },
  { aba: "Consultar", secao: "Dúvidas frequentes" },
];

await suite(
  {
    slug: "professor/08-guias-de-aula",
    papel: "professor",
    titulo: "O guia da aula de cada missão",
    subtitulo: "as mesmas seções em toda missão, e o caminho até elas a partir da sala",
    contexto:
      "O professor abre o guia na véspera para preparar e na hora para conduzir. Ele é o mesmo " +
      "documento em toda missão — mudam o conteúdo e os blocos que vêm de fonte viva.",
    prova: [
      "As nove missões desta lista têm guia, e nenhuma cai em 404",
      "As nove seções aparecem na mesma ordem em todas, divididas em quatro tempos (abas)",
      "Cada tempo mostra só as seções dele",
      "Cada guia traz a habilidade da BNCC Computação com o código",
      "Todo guia tem bloco vivo, e todos chegam preenchidos da fonte de verdade",
      "O conteúdo que a turma lê aparece com as PALAVRAS dela, não descrito",
      "Os números do guia são contados no catálogo — 11 e 10 vídeos, não 'metade'",
      "Da sala de aula sai um link de guia por missão, com a turma na frente",
    ],
    comando: "node scripts/e2e/professor/08-guias-de-aula.mjs",
  },
  async (r) => {
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1100 } });
    await r.entrar(p, conta("professor", { turma: TURMA }).login);

    for (const guia of GUIAS) {
      await p.goto(`${HUB}${guia.rota}`, { waitUntil: "domcontentloaded" });
      /* A espera corre contra o erro: se a página cair, o alerta aparece antes
         do h1 e o roteiro reporta a CAUSA em vez do seletor que faltou. */
      await esperarOuFalharCedo(
        p.locator("h1", { hasText: "Guia da aula" }),
        p.locator(ALERTA_DE_ERRO),
        { oQue: `o guia de ${guia.missao}`, timeout: 30_000 },
      );
      await p.waitForTimeout(400);

      /* O guia é dividido em quatro tempos (ADR-182), e a aba fechada não entra
         no `innerText`: o texto do guia inteiro é o das quatro abas. */
      const texto = await textoDeTodasAsAbas(p, "guia");

      const faltando = SECOES.filter((secao) => !texto.includes(secao));
      r.exigir(
        faltando.length === 0,
        `${guia.missao}: as 9 seções do guia estão na tela${faltando.length ? ` (faltou: ${faltando.join(", ")})` : ""}`,
      );
      r.exigir(texto.includes(guia.bncc), `${guia.missao}: traz a habilidade ${guia.bncc}`);
      for (const vivo of guia.vivo) {
        r.exigir(vivo.test(texto), `${guia.missao}: o bloco vivo ${vivo} chegou preenchido`);
      }
      for (const literal of guia.literal ?? []) {
        r.exigir(literal.test(texto), `${guia.missao}: o guia traz ${literal}`);
      }
      for (const ausente of guia.ausente ?? []) {
        r.exigir(!ausente.test(texto), `${guia.missao}: o guia NÃO traz ${ausente}`);
      }
      /* O botão de imprimir É o recurso: o professor conduz com o papel na mão
         enquanto o computador projeta a tela da turma. */
      r.exigir(
        (await p.locator("button", { hasText: "Imprimir" }).count()) > 0,
        `${guia.missao}: dá para imprimir`,
      );
    }

    /* Os quatro tempos: cada aba mostra só o seu pedaço, e o que ela mostra é
       o que o professor procura naquela hora. A aba fechada continua no DOM
       (o papel imprime as quatro), mas fica fora da tela. */
    for (const tempo of TEMPOS) {
      await abrirAba(p, tempo.aba);
      const secao = p.getByRole("heading", { name: tempo.secao, level: 2 });
      r.exigir(await secao.isVisible(), `a aba ${tempo.aba} mostra "${tempo.secao}"`);
      const outras = TEMPOS.filter((t) => t !== tempo);
      for (const outra of outras) {
        r.exigir(
          !(await p.getByRole("heading", { name: outra.secao, level: 2 }).isVisible()),
          `e a aba ${tempo.aba} não mostra "${outra.secao}", que é de ${outra.aba}`,
        );
      }
    }
    /* A missão nova (exp02ef1b, ADR-184) — tela nova, passo novo: as cenas
       prontas com os dois objetos marcados, que o professor lê ANTES da aula. */
    await p.goto(`${HUB}/professor/entre-redes/2-ano/unidade-1/guia`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(p.locator("h1", { hasText: "Guia da aula" }), p.locator(ALERTA_DE_ERRO), {
      oQue: "o guia do Enigma da Capa da Rádio",
      timeout: 30_000,
    });
    const cenasProntas = p.locator(":text('As cenas prontas, com o gabarito')").first();
    await revelar(p, cenasProntas);
    await cenasProntas.scrollIntoViewIfNeeded();
    r.exigir(
      (await p.locator("[data-cena-do-enigma] [data-alvo]").count()) >= 6,
      "o guia do Enigma mostra as três cenas prontas com os dois objetos marcados em cada uma",
    );
    const textoDoEnigma = (await p.locator("main").textContent()) ?? "";
    r.exigir(
      /ABRIR BANCADA/.test(textoDoEnigma) && /Colocar no álbum/.test(textoDoEnigma) && !/crach|A HORTA ACABOU/i.test(textoDoEnigma),
      "o guia do Enigma segue a 2.0.0: começa no card (ABRIR BANCADA) e termina no Colocar no álbum",
    );
    await r.registrar(p, "guia-do-enigma-cenas-prontas", {
      titulo: "O Enigma da Capa da Rádio: as cenas prontas, com o gabarito",
      mostra: "A Biblioteca, a Horta e o Museu, cada uma com as duas molduras das fotos e os círculos dos dois objetos iguais do fundo.",
      prova: "O bloco é vivo (GET /enigma-capa/professor/material): o professor lê a cena que a turma vai ver, com os alvos que a api usa — e não projeta.",
    });

    /* A missão da 1ª série (exp01em1b, ADR-185) — tela nova, passo novo: o
       roteiro de debate com as quatro perguntas, cada uma no momento dela. */
    await p.goto(`${HUB}/professor/entre-redes/1-serie/unidade-1/guia`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(p.locator("h1", { hasText: "Guia da aula" }), p.locator(ALERTA_DE_ERRO), {
      oQue: "o guia do Assistente Invisível",
      timeout: 30_000,
    });
    const roteiroDoAssistente = p.locator("[data-roteiro-do-assistente]").first();
    await revelar(p, roteiroDoAssistente);
    await roteiroDoAssistente.scrollIntoViewIfNeeded();
    /* `textContent`, não `innerText`: o momento vem em caixa alta por CSS (`uppercase`), e o `innerText` devolve o texto transformado. */
    const momentos = await roteiroDoAssistente.locator("li").evaluateAll((lis) => lis.map((li) => li.textContent ?? ""));
    r.exigir(
      momentos.length === 4 &&
        momentos.slice(0, 2).every((m) => m.includes("Mediação 1, depois das fichas (Etapa 4)")) &&
        momentos.slice(2).every((m) => m.includes("Fechamento coletivo (Etapa 6)")),
      "o guia do Assistente Invisível traz as quatro perguntas do roteiro, duas na Mediação 1 e duas no fechamento",
    );
    const textoDoRoteiro = (await roteiroDoAssistente.textContent()) ?? "";
    r.exigir(
      !/transfer[eê]ncia|aplicativo de transporte/i.test(textoDoRoteiro),
      "o roteiro do Assistente Invisível não traz mais o caso de transferência da Etapa 6 (ADR-189)",
    );
    await r.registrar(p, "guia-do-assistente-roteiro", {
      titulo: "O Assistente Invisível: o roteiro de debate mediado",
      mostra: "As quatro perguntas do PO, cada uma com o momento da aula em que entra — e só elas (ADR-189).",
      prova: "O bloco é vivo (GET /assistente-invisivel/professor/material): a pergunta do guia é a mesma que o painel da aula projeta.",
    });

    /* A missão da 3ª série (exp03em1b, ADR-198) — tela nova, passo novo: a
       perícia com o gabarito, que só o professor vê. Volta ao guia do
       Assistente depois, para os passos dos tempos seguirem como eram. */
    await p.goto(`${HUB}/professor/entre-redes/3-serie/unidade-1/guia`, { waitUntil: "domcontentloaded" });
    await esperarOuFalharCedo(p.locator("h1", { hasText: "Guia da aula" }), p.locator(ALERTA_DE_ERRO), {
      oQue: "o guia do Porta-Voz dos Dados",
      timeout: 30_000,
    });
    const gabaritoDoPortaVoz = p.locator(".guia-bloco", { hasText: "A perícia técnica: os dois cartões eleitorais" }).first();
    await revelar(p, gabaritoDoPortaVoz);
    const textoDoGabarito = (await gabaritoDoPortaVoz.textContent()) ?? "";
    r.exigir(
      /Cartão Eleitoral B[\s\S]*O distorcido · motivo: escala/.test(textoDoGabarito) && /Cartão Eleitoral A[\s\S]*Sem distorção/.test(textoDoGabarito),
      "o guia do Porta-Voz dá o gabarito da perícia: o cartão B é o distorcido, pela escala; o A não",
    );
    await gabaritoDoPortaVoz.getByText("A perícia técnica: os dois cartões eleitorais").scrollIntoViewIfNeeded();
    await r.registrar(p, "guia-do-porta-voz-gabarito", {
      titulo: "O Porta-Voz dos Dados: o banco padrão e a perícia com o gabarito",
      mostra: "A tabela 95 → 94 → 92 → 88 do banco padrão, a nota técnica e os dois cartões eleitorais, com o distorcido marcado.",
      prova: "O bloco é vivo (GET /porta-voz-dos-dados/professor/material): o gabarito fica com o professor — o estudante recebe os cartões sem rótulo.",
    });
    await p.goto(`${HUB}/professor/entre-redes/1-serie/unidade-1/guia`, { waitUntil: "domcontentloaded" });
    await p.locator("h1", { hasText: "Guia da aula" }).waitFor({ timeout: 30_000 });

    await abrirAba(p, "Conduzir");
    await r.registrar(p, "guia-tempo-conduzir", {
      titulo: "O guia em quatro tempos: Conduzir",
      mostra:
        "A barra dos tempos (Preparar, Conduzir, Fechar, Consultar) presa no topo, o resumo da aula em " +
        "números, os avisos num bloco só e o roteiro como linha do tempo, com o botão de cada momento.",
      prova:
        "Na frente da turma o professor vê só o roteiro, o debate e a mediação — o guia corrido tinha 8 a " +
        "17 mil pixels. Nada saiu: cada seção mora num tempo, e a impressão leva os quatro.",
      inteira: false,
    });
    await abrirAba(p, "Preparar");

    await r.registrar(p, "guia-de-uma-missao", {
      titulo: "O guia, por dentro",
      mostra:
        "Objetivos e BNCC Computação, preparo técnico e pedagógico, o que não dizer, roteiro " +
        "minuto a minuto, banco de perguntas em quatro níveis, mediação, rubrica e adaptações.",
      prova:
        "Toda missão tem as mesmas nove seções, na mesma ordem: a segunda missão que o professor " +
        "rodar tem a informação no mesmo lugar da primeira. O conteúdo é dado; a ordem é do " +
        "renderizador.",
      /* `inteira: false` de propósito: o guia passa do teto de altura do
         `captureScreenshot` do Chrome, e o print inteiro falha em silêncio —
         o passo fica sem imagem no deck. A dobra já mostra o índice, o
         cabeçalho e a primeira seção, que é o que o slide precisa dizer. */
      inteira: false,
    });

    // ── o caminho que importa: a sala de aula ───────────────────────────
    await p.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
    await p.locator("a", { hasText: TURMA }).first().click();
    await p.waitForURL("**/professor/turmas/**", { timeout: 20_000 });
    await esperarOuFalharCedo(
      p.locator("text=Missões").first(),
      p.locator(ALERTA_DE_ERRO),
      { oQue: "a sala de aula", timeout: 30_000 },
    );
    await p.waitForTimeout(600);

    /* UM caminho por missão (ADR-100). A sala tinha três links e o de
       "Conduzir" apontava para a tela de resultados — que não existe para toda
       missão, e foi assim que o 8º ano recebeu um 404. Agora a sala leva à
       ficha, com a turma, e o guia está lá dentro. */
    const conduzir = p.locator("a", { hasText: "Conduzir com esta turma" });
    const quantos = await conduzir.count();
    r.exigir(quantos > 0, `a sala oferece a condução em ${quantos} missão(ões)`);
    r.exigir(
      (await p.locator("a", { hasText: "Guia da aula" }).count()) === 0,
      "e NÃO oferece mais três links por missão — o guia mora na ficha",
    );

    await r.registrar(p, "guia-a-partir-da-sala", {
      titulo: "O guia a partir da sala de aula",
      mostra:
        "A grade da turma, com o estado de cada missão e, em cada linha, UM caminho: " +
        "conduzir com esta turma.",
      prova:
        "É aqui que o professor decide o que rodar hoje, com a turma na frente. Um link só, " +
        "porque a sala não tem como saber o que cada missão oferece: o Unoovista não tem " +
        "tela de resultados e o Rastro do Boato não tem guia. Quem responde isso é a ficha.",
      inteira: true,
    });

    const primeiro = conduzir.first();
    await primeiro.scrollIntoViewIfNeeded();
    await primeiro.click();
    await p.waitForURL("**turmaId=**", { timeout: 20_000 });
    await esperarOuFalharCedo(
      p.locator("text=Conduzindo com a turma").first(),
      p.locator(ALERTA_DE_ERRO),
      { oQue: "a ficha aberta pela sala", timeout: 30_000 },
    );
    r.exigir(true, "e o link da sala abre a ficha JÁ na turma");

    /* E o guia continua a um clique — agora de dentro da ficha, que é quem sabe
       se aquela missão tem um. */
    const guiaDaFicha = p.locator("a", { hasText: "Abrir guia da aula" });
    if ((await guiaDaFicha.count()) > 0) {
      await guiaDaFicha.first().click();
      await p.waitForURL("**/guia**", { timeout: 20_000 });
      await esperarOuFalharCedo(
        p.locator("h1", { hasText: "Guia da aula" }),
        p.locator(ALERTA_DE_ERRO),
        { oQue: "o guia aberto pela ficha", timeout: 30_000 },
      );
      r.exigir(true, "e a ficha abre o guia da missão");
    }
  },
);
