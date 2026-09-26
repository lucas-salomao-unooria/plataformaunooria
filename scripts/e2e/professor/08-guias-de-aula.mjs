import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

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
    missao: "Instanooria · 8º ano",
    /* Vem de `CONTROLE_DO_PROFESSOR` e de `@edu/conteudo-exp08ef1b`: se o bloco
       vivo quebrar, o guia continua renderizando e some em silêncio. */
    vivo: [/Você conduz — os \d+ momentos/i, /O que a turma lê na revelação/i],
    bncc: "EF08CO11",
  },
  {
    rota: "/professor/entre-redes/4-ano/unidade-1/guia",
    missao: "UnooTube · 4º ano",
    /* A tabela dos 21 vídeos vem de `GET /unootube/professor/videos`. Antes o
       guia DESCREVIA o catálogo — "metade cita fonte verificável" — e a
       descrição tinha derivado: são 11 e 10 (ADR-86). A contagem entra aqui
       como número EXATO de propósito: é ela que denuncia a próxima deriva. */
    vivo: [
      /Os vídeos e o gabarito — só para você/i,
      /11 citam fonte verificável/i,
      /papagaio tradutor/i,
      /sensacionalista/i,
    ],
    bncc: "EF04CO08",
  },
  {
    rota: "/professor/entre-redes/2-serie/unidade-1/guia",
    missao: "unooGPT · 2ª série EM",
    /* A tabela dos 8 vieses vem de `GET /unoogpt/professor/fontes`. É a única
       superfície em que o viés é dito, e o hub não guarda cópia dela. */
    vivo: [/As 8 fontes e o viés de cada uma/i, /Em que ela engana/i, /Histórico de ocorrências/i],
    bncc: "EM13CO12",
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
  "Roteiro",
  "Perguntas para o debate",
  "Mediação",
  "Depois da aula",
  "Cuidados",
  "Adaptações",
  "Dúvidas frequentes",
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
      "As seis missões publicadas têm guia, e nenhuma cai em 404",
      "As nove seções aparecem na mesma ordem em todas",
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

      const texto = await p.locator("main").innerText();

      const faltando = SECOES.filter((secao) => !texto.includes(secao));
      r.exigir(
        faltando.length === 0,
        `${guia.missao}: as 9 seções do guia estão na tela${faltando.length ? ` (faltou: ${faltando.join(", ")})` : ""}`,
      );
      r.exigir(texto.includes(guia.bncc), `${guia.missao}: traz a habilidade ${guia.bncc}`);
      for (const vivo of guia.vivo) {
        r.exigir(vivo.test(texto), `${guia.missao}: o bloco vivo ${vivo} chegou preenchido`);
      }
      /* O botão de imprimir É o recurso: o professor conduz com o papel na mão
         enquanto o computador projeta a tela da turma. */
      r.exigir(
        (await p.locator("button", { hasText: "Imprimir" }).count()) > 0,
        `${guia.missao}: dá para imprimir`,
      );
    }

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
        "porque a sala não tem como saber o que cada missão oferece: o Instanooria não tem " +
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
