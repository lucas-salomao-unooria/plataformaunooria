import { HUB, suite } from "../lib/roteiro.mjs";

/**
 * A porta pública: `/` sem sessão nenhuma — o site ENTRE REDES (ADR-107).
 *
 * Esta suíte trocou de objeto em 2026-09-16. Ela cobria a landing da ADR-40,
 * feita com o design system; a raiz passou a ser o PORTE do site de marketing,
 * que tem folha, tipografia e movimento próprios. A landing anterior continua
 * viva em `/landing-anterior` e é coberta no fim deste roteiro — sem ela,
 * `/privacidade` e `/termos` (que montam o fundo e a folha dela) quebrariam
 * sem nada acusar.
 *
 * O que o typecheck não pega e esta suíte cobra:
 *  - a raiz é o site, e não um redirecionamento para o login;
 *  - a Manrope carregada. O `<body>` do hub traz `font-family` INLINE, e estilo
 *    inline vence folha: sem a regra do container o site inteiro sai em
 *    system-ui, com o desenho intacto — defeito que nenhum teste de texto vê;
 *  - os dois canvas com contexto e tamanho. O infinito é amostrado do PIXEL do
 *    logo do rodapé: se a imagem não carregar, o módulo esconde o palco e a
 *    seção "Sobre a Unooria" perde a peça central, em silêncio;
 *  - a revelação ao rolar chegando ao fim (`.reveal` sem `.visible` é conteúdo
 *    invisível para sempre);
 *  - as quinze seções da versão final do material, na ordem;
 *  - o carrossel das missões e o folhear das páginas dos livros, que são
 *    efeito montado DEPOIS da hidratação: a marcação sozinha não anda;
 *  - nada transbordando na largura em celular;
 *  - o diálogo de navegação abrindo e o convite levando ao cadastro.
 *
 * A api NÃO é necessária: o site não lê sessão nem dado nenhum. O formulário de
 * cadastro, que precisa dela, é provado de ponta a ponta em `admin/03-prospeccao`.
 */
await suite(
  {
    slug: "publico/01-site",
    papel: "publico",
    titulo: "A porta pública",
    subtitulo: "o site ENTRE REDES sem sessão, no desktop e no celular",
    contexto:
      "A primeira tela que qualquer pessoa vê — família, secretaria, edital — antes de existir " +
      "qualquer credencial. É material de marketing aprovado fora do repositório e portado 1:1 para o " +
      "hub (ADR-107): o design system começa na porta do login, não aqui.",
    prova: [
      "A raiz sem sessão é o site: nada de redirecionar para o login",
      "A Manrope carrega — o `font-family` inline do hub venceria a folha sem a regra do container",
      "O campo de estrelas da rolagem e o infinito desenham",
      "A revelação ao rolar termina: nenhum bloco fica invisível para sempre",
      "O carrossel das missões anda, e os livros se folheiam na imagem ampliada",
      "Nada transborda na largura em 390px, e o diálogo de navegação abre",
      "O convite \"Quero conhecer a solução\" abre a janela do cadastro, que o Esc fecha",
      "O cabeçalho leva ao login e o rodapé à Política de Privacidade e aos Termos de Uso",
      "A landing anterior continua de pé em /landing-anterior — /privacidade e /termos dependem dela",
    ],
    comando: "node scripts/e2e/publico/01-site.mjs",
  },
  async (r) => {
    /* O 401 do trace do navegador é ESPERADO em superfície pública: o hub
       instrumenta, o BFF recusa sem sessão e o exportador descarta o lote —
       está escrito em `apps/hub/instrumentation-client.ts` ("aceito"). Com a
       amostragem de dev/hml (5%) ele aparece em uma corrida a cada vinte, e
       sem esta declaração o smoke do deploy fica vermelho por sorteio. */
    r.provocado(/observabilidade\/v1\/traces/, "o trace do navegador sem sessão: o hub o envia e o BFF recusa com 401 de propósito (instrumentation-client.ts), e o lote é descartado — só aparece quando a sessão cai na amostragem");
    // ── desktop ──────────────────────────────────────────────────────────
    const p = await r.pagina("desktop", { viewport: { width: 1280, height: 900 } });
    await p.goto(`${HUB}/`, { waitUntil: "domcontentloaded" });
    await p.locator("h1").waitFor({ timeout: 30_000 });

    r.exigir(p.url() === `${HUB}/`, "a raiz sem sessão é o site, não um redirecionamento");
    r.exigir(
      (await p.locator("h1").innerText()).includes("A vida mudou de tela"),
      "o título do hero é o do material aprovado",
    );

    /* `fonts.ready` espera o download terminar antes de perguntar se a família
       existe — e a pergunta é sobre o CONTAINER, não sobre o body: é ali que a
       regra acrescentada no porte vive. */
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    const tipografia = await p.evaluate(() => ({
      carregou: document.fonts.check('16px Manrope'),
      container: getComputedStyle(document.querySelector(".site-entre-redes")).fontFamily.split(",")[0],
      h1: getComputedStyle(document.querySelector("h1")).fontFamily.split(",")[0],
    }));
    r.exigir(tipografia.carregou, "a Manrope carregou");
    r.exigir(
      tipografia.h1.replace(/"/g, "") === "Manrope",
      `o h1 desenha em Manrope e não na fonte do sistema (${tipografia.h1})`,
    );

    /* DOIS canvas: o campo de estrelas ÚNICO (revisão 19), criado pelo efeito e
       fixo atrás da página inteira, e o infinito da marca. Os dois do material
       original (`#opening-stars` e `#ambient-dust`) saíram da marcação na
       versão final (2026-10-28). */
    const canvas = await p.evaluate(() => {
      const medir = (seletor) => {
        const c = document.querySelector(seletor);
        return c ? { w: c.width, h: c.height, ctx: Boolean(c.getContext("2d")) } : null;
      };
      return { rolagem: medir("#unooria-scroll-stars"), infinito: medir("#brand-infinity") };
    });
    for (const [nome, medida] of Object.entries(canvas)) {
      r.exigir(
        medida && medida.ctx && medida.w > 0 && medida.h > 0,
        `o canvas "${nome}" tem contexto e tamanho (${medida?.w}×${medida?.h})`,
      );
    }

    const secoes = await p.evaluate(() =>
      Array.from(document.querySelectorAll("main > section")).map((s) => s.id).filter(Boolean),
    );
    r.exigir(secoes.length === 15, `as ${secoes.length} seções do material estão na página (esperado 15)`);
    r.exigir(secoes[0] === "inicio" && secoes.at(-1) === "unooria", "a ordem vai do hero ao \"Sobre a Unooria\"");

    await r.registrar(p, "hero", {
      titulo: "A abertura do ENTRE REDES",
      mostra: "Campo de estrelas, a marca do ENTRE REDES, a chamada sobre a vida que mudou de tela e os livros ao lado.",
      prova:
        "É a única tela do produto que existe sem credencial: nada aqui pode depender de sessão, de api ou de dado de estudante.",
      detalhe: `${secoes.length} seções · Manrope no h1 · estrelas ${canvas.rolagem?.w}×${canvas.rolagem?.h}`,
    });

    // ── o diálogo de navegação ───────────────────────────────────────────
    await p.getByRole("button", { name: "Abrir navegação" }).click();
    await p.locator("#index-dialog[open]").waitFor({ timeout: 10_000 });
    const itens = await p.locator("#index-dialog .index-links a").count();
    r.exigir(itens >= 9, `o índice abre com os ${itens} capítulos do site`);
    await r.registrar(p, "indice", {
      titulo: "O índice completo",
      mostra: "Diálogo modal com os oito capítulos e a subseção dos materiais do estudante, sobre a página escurecida.",
      prova:
        "É um `<dialog>` nativo com `showModal`: foco preso, Esc fecha e a rolagem da página trava por trás — comportamento que um menu montado à mão não tem de graça.",
      detalhe: `${itens} itens`,
    });
    /* Fecha pelo BOTÃO, e confirma que a rolagem voltou. O `Escape` depende do
       foco estar no diálogo e nem sempre chega nele em janela sem foco: com o
       diálogo aberto o `<body>` fica `locked` (`overflow:hidden`), `scrollTo`
       não move nada e a varredura das revelações abaixo reprovava o produto por
       uma tecla que não foi entregue. */
    await p.locator("#index-dialog [data-close]").click();
    await p.locator("#index-dialog[open]").waitFor({ state: "detached", timeout: 10_000 }).catch(() => {});
    await p.waitForTimeout(400);
    const travado = await p.evaluate(() => document.body.classList.contains("locked"));
    r.exigir(!travado, "fechar o índice devolve a rolagem da página (o `locked` sai do body)");

    // ── a revelação ao rolar tem de chegar ao fim ────────────────────────
    /* PASSA POR CADA BLOCO, um a um, com a espera do próprio Playwright — e
       não com um laço de `scrollTo` dentro de um `evaluate`.
       Quem revela é um `IntersectionObserver`: um salto direto para o fim
       deixa os blocos do meio sem nunca terem entrado no viewport, e uma
       varredura por saltos de tela perde os que as imagens `lazy` (230 KB cada)
       empurram para baixo DEPOIS que a rolagem já passou por ali — era vermelho
       em uma corrida e verde na seguinte, sempre com o material de origem
       fechando em zero. Bloco a bloco, a varredura não depende de quanto o
       layout andou no meio do caminho. */
    const blocos = p.locator(".reveal");
    const quantos = await blocos.count();
    for (let i = 0; i < quantos; i++) {
      await blocos.nth(i).scrollIntoViewIfNeeded({ timeout: 10_000 }).catch(() => {});
      await p.waitForTimeout(80);
    }
    await p.locator("#contato").scrollIntoViewIfNeeded();
    /* Espera ATIVA pelo estado, não um sleep: a transição é de CSS e o tempo
       dela depende da carga da máquina. */
    await p
      .waitForFunction(() => document.querySelectorAll(".reveal:not(.visible)").length === 0, null, { timeout: 20_000 })
      .catch(() => {});
    /* Conta só o que o layout MOSTRA: um `.reveal` dentro de um `<details>`
       fechado tem `display:none`, nunca intersecta e nunca revelaria — cobrar
       dele é cobrar o impossível, e é o tipo de asserção que fica vermelha em
       dia de máquina carregada e verde no dia seguinte. */
    /* A mensagem DIZ QUAIS ficaram, não só quantos: "3 blocos pendentes" manda
       procurar na página inteira; a classe e a seção mandam direto ao lugar. */
    const pendentes = await p.evaluate(() =>
      Array.from(document.querySelectorAll(".reveal:not(.visible)"))
        .filter((el) => el.offsetParent !== null)
        .map((el) => `${el.closest("section")?.id ?? "?"}:${el.className.replace("reveal", "").trim() || el.tagName}`),
    );
    r.exigir(
      pendentes.length === 0,
      `a revelação ao rolar chegou ao fim${pendentes.length ? ` — ficaram: ${pendentes.join(", ")}` : ""}`,
    );

    /* O FORMULÁRIO NÃO ESTÁ NA PÁGINA: ele abre numa janela. Na versão final do
       material (2026-10-28) sobrou UM convite "Quero conhecer a solução", o do
       fechamento (`#contato`) — o do cabeçalho e a seção `#cadastro` saíram. */
    const convites = await p.evaluate(() =>
      Array.from(document.querySelectorAll("[data-abrir-cadastro]")).map((b) => ({
        rotulo: b.getAttribute("aria-label") || b.innerText.trim().split("\n")[0],
        secao: b.closest("section")?.id ?? null,
      })),
    );
    r.exigir(
      convites.length === 1 && convites[0].secao === "contato",
      `o convite do cadastro mora no fechamento (${convites.map((c) => c.secao).join(" · ") || "nenhum"})`,
    );
    r.exigir(
      convites.every((c) => c.rotulo.includes("Quero conhecer a solução")),
      `ele diz "Quero conhecer a solução" (${convites.map((c) => c.rotulo).join(" · ")})`,
    );
    /* O formulário existe, mas DENTRO da janela — e a janela FORA do
       `.closing-side`: lá dentro, a regra `.closing-side .button` do material
       esticaria os botões do formulário. */
    const ondeMoraOForm = await p.evaluate(() => {
      const form = document.querySelector("#registration-form");
      return { janela: form?.closest("dialog")?.id ?? "solto na página", noConvite: Boolean(form?.closest(".closing-side")) };
    });
    r.exigir(ondeMoraOForm.janela === "cadastro-dialog", `o formulário mora na janela, não no corpo da página (${ondeMoraOForm.janela})`);
    r.exigir(!ondeMoraOForm.noConvite, "a janela não mora dentro do bloco do convite");

    await p.locator("#contato [data-abrir-cadastro]").click();
    await p.locator("#cadastro-dialog[open]").waitFor({ timeout: 15_000 });
    const janela = await p.evaluate(() => {
      const dialogo = document.querySelector("#cadastro-dialog");
      const caixa = dialogo.getBoundingClientRect();
      return {
        campos: Array.from(dialogo.querySelectorAll("#registration-form [name]")).map((e) => e.name),
        acao: dialogo.querySelector("#registration-form").getAttribute("action"),
        fechadores: Array.from(dialogo.querySelectorAll("[data-close]")).map(
          (b) => b.innerText.trim() || b.getAttribute("aria-label"),
        ),
        travou: document.body.classList.contains("locked"),
        cabe: caixa.width <= innerWidth && caixa.height <= innerHeight,
        privacidade: dialogo.querySelector(".form-privacidade a")?.getAttribute("href") ?? null,
        linkNoRotulo: Boolean(dialogo.querySelector("label a")),
      };
    });
    for (const campo of ["nome", "email", "telefone", "organizacao", "cargo", "consentimento"]) {
      r.exigir(janela.campos.includes(campo), `o formulário tem o campo "${campo}"`);
    }
    r.exigir(
      janela.acao === "/api/cadastro-de-interesse",
      "o formulário aponta para a rota do hub, não para o Worker de origem",
    );
    r.exigir(janela.fechadores.length === 2, `a janela oferece DUAS saídas além do Esc (${janela.fechadores.join(" · ")})`);
    r.exigir(janela.travou, "a página atrás da janela para de rolar enquanto ela está aberta");
    r.exigir(janela.cabe, "a janela cabe na tela — nenhuma ação fica fora do alcance");
    /* H11.2.1: quem autoriza o contato alcança a política antes de enviar — e
       o link fica FORA do rótulo, senão clicá-lo marcaria a caixa do aceite. */
    r.exigir(janela.privacidade === "/privacidade", `a janela leva à Política de Privacidade (${janela.privacidade})`);
    r.exigir(!janela.linkNoRotulo, "o link não está dentro do rótulo do aceite");
    await r.registrar(p, "cadastro", {
      titulo: "O cadastro de interesse, numa janela",
      mostra: "Nome, e-mail profissional, telefone, organização, cargo, o aceite e o link da Política de Privacidade, sobre a página escurecida.",
      prova:
        "É a única parte do site que não é porte: o destino mudou de um SQLite fora da plataforma para a api (ADR-107). O envio de verdade é provado em admin/03-prospeccao.",
      detalhe: `${janela.campos.length} campos · saídas: ${janela.fechadores.join(", ")}`,
    });

    /* O Esc fecha E devolve a rolagem: uma janela que fecha deixando o `<body>`
       travado deixa a página inteira parada, e ninguém liga uma coisa à outra. */
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    const depoisDoEsc = await p.evaluate(() => ({
      aberta: document.querySelector("#cadastro-dialog").open,
      travada: document.body.classList.contains("locked"),
    }));
    r.exigir(!depoisDoEsc.aberta, "o Esc fecha a janela do cadastro");
    r.exigir(!depoisDoEsc.travada, "e devolve a rolagem da página");

    // ── o carrossel das missões ──────────────────────────────────────────
    /* O SERVIDOR entrega o primeiro slide ativo e os outros `inert`; quem faz o
       "Próximo" andar é o `efeitos/carrossel.ts`. Botão que não anda não dá
       erro nenhum — a prova é o contador e o slide que deixou de ser `inert`. */
    await p.locator("#missoes").scrollIntoViewIfNeeded();
    await p.locator("#mission-carousel [data-next]").click();
    await p
      .waitForFunction(() => document.querySelector(".carousel-count")?.textContent === "02 / 05", null, { timeout: 10_000 })
      .catch(() => {});
    const carrossel = await p.evaluate(() => {
      const slides = [...document.querySelectorAll("#mission-carousel .content-slide")];
      const ativo = slides.findIndex((s) => s.classList.contains("is-active"));
      return {
        contador: document.querySelector(".carousel-count")?.textContent,
        ativo,
        inertes: slides.filter((s) => s.inert).length,
        ativoInerte: slides[ativo]?.inert ?? null,
      };
    });
    r.exigir(
      carrossel.contador === "02 / 05" && carrossel.ativo === 1,
      `o "Próximo" leva ao segundo slide das missões (${carrossel.contador})`,
    );
    r.exigir(
      carrossel.ativoInerte === false && carrossel.inertes === 4,
      "só o slide da vez fica alcançável pelo teclado — os outros quatro ficam `inert`",
    );
    await r.registrar(p, "missoes-carrossel", {
      titulo: "As missões, uma por vez",
      mostra: "O segundo slide do carrossel: o UnooTube, com a animação do feed e o botão da tela real.",
      prova:
        "O carrossel é efeito montado depois da hidratação: sem ele a página mostra o primeiro slide e os botões não fazem nada, sem erro na tela.",
      detalhe: `slide ${carrossel.contador}`,
    });

    // ── os livros, folheados na imagem ampliada ──────────────────────────
    await p.locator("#livros .material-zoom").first().click();
    await p.locator("#print-dialog[open]").waitFor({ timeout: 10_000 });
    await p.locator("#print-dialog .page-next").click();
    await p
      .waitForFunction(() => document.querySelector(".page-pager")?.textContent === "Página 2 de 4", null, { timeout: 10_000 })
      .catch(() => {});
    const livro = await p.evaluate(() => ({
      pagina: document.querySelector(".page-pager")?.textContent,
      titulo: document.querySelector("#print-title")?.textContent,
      modo: document.querySelector("#print-dialog").classList.contains("is-book"),
    }));
    r.exigir(livro.modo && livro.pagina === "Página 2 de 4", `as páginas dos livros se folheiam (${livro.pagina})`);
    r.exigir(livro.titulo?.includes("investigar"), `o título acompanha a página (${livro.titulo})`);
    await r.registrar(p, "livros-folhear", {
      titulo: "As páginas do livro, ampliadas",
      mostra: "A segunda das quatro páginas de exemplo, com as setas e o contador.",
      prova:
        "Só os cartões dos livros ligam o modo de folhear; as telas das missões e as jornadas abrem como imagem única. As páginas são relidas da própria marcação.",
      detalhe: livro.titulo,
    });
    await p.locator("#print-dialog .close-button").click();
    await p.waitForTimeout(400);

    /* Sem print de página INTEIRA: o site tem mais de 11.000px de altura e o
       Chrome recusa a captura ("Unable to capture screenshot"). O que substitui
       é a medida, que é como o porte se confere de qualquer forma. */
    const medidas = await p.evaluate(() => ({
      altura: document.documentElement.scrollHeight,
      imagens: document.querySelectorAll("img").length,
      revelacoes: document.querySelectorAll(".reveal").length,
    }));
    /* O caminho de quem já tem conta, e os documentos legais (H11.1.2). */
    const saidas = await p.evaluate(() => ({
      entrar: document.querySelector(".header .header-entrar")?.getAttribute("href") ?? null,
      legais: [...document.querySelectorAll(".footer-legal a")].map((a) => `${a.textContent?.trim()}→${a.getAttribute("href")}`),
    }));
    r.exigir(saidas.entrar === "/login", `o cabeçalho tem "Entrar", que leva ao login (${saidas.entrar})`);
    r.exigir(
      saidas.legais.includes("Política de Privacidade→/privacidade") && saidas.legais.includes("Termos de Uso→/termos"),
      `o rodapé leva aos dois documentos legais (${saidas.legais.join(" · ")})`,
    );
    await p.locator(".footer").scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    await r.registrar(p, "rodape", {
      titulo: "O fim do percurso",
      mostra: "A marca, os links da Política de Privacidade e dos Termos de Uso, a assinatura do programa e o botão de voltar ao início.",
      prova:
        "A conferência do porte é por MEDIDA, não por impressão: altura do documento e topo de cada seção, comparados com o material de origem (components/site/AGENTS.md).",
      detalhe: `altura ${medidas.altura}px · ${medidas.imagens} imagens · ${medidas.revelacoes} revelações`,
    });

    // ── celular: nada transborda ─────────────────────────────────────────
    const m = await r.pagina("celular", { viewport: { width: 390, height: 844 }, mobile: true });
    await m.goto(`${HUB}/`, { waitUntil: "domcontentloaded" });
    await m.locator("h1").waitFor({ timeout: 30_000 });
    await m.waitForTimeout(1200);
    const larguras = await m.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    r.exigir(
      larguras.scroll <= larguras.viewport,
      `nada transborda na largura em celular (${larguras.scroll} ≤ ${larguras.viewport})`,
    );
    /* O "Entrar" divide o canto com o menu: o "Explorar" não pode sair da tela. */
    const menuCabe = await m.evaluate(
      () => document.querySelector(".menu-button").getBoundingClientRect().right <= window.innerWidth,
    );
    r.exigir(menuCabe, "no celular, o cabeçalho cabe inteiro: a marca, o Entrar e o menu");
    await r.registrar(m, "celular-hero", {
      titulo: "O mesmo site no celular",
      mostra: "Viewport de 390×844: o trilho de capítulos sai, o menu vira só o ícone e os livros descem para baixo do texto.",
      prova:
        "O material foi desenhado da menor tela para cima, e é no telefone que a secretaria abre o link. Transbordo horizontal aqui é o defeito mais comum e o mais invisível no desktop.",
      detalhe: `scrollWidth ${larguras.scroll} / viewport ${larguras.viewport}`,
    });

    await m.locator("#unooria").scrollIntoViewIfNeeded();
    await m.waitForTimeout(1500);
    await r.registrar(m, "celular-unooria", {
      titulo: "Sobre a Unooria, no celular",
      mostra: "O texto sobre a Unooria e, abaixo dele, o infinito de estrelas.",
      prova:
        "O infinito é amostrado do pixel do logo da Unooria no rodapé; num celular o número de partículas cai pela metade, e a figura tem de continuar reconhecível.",
    });

    // ── a landing anterior continua de pé ────────────────────────────────
    await p.goto(`${HUB}/landing-anterior`, { waitUntil: "domcontentloaded" });
    await p.locator("h1").waitFor({ timeout: 30_000 });
    /* O shader é montado por efeito, DEPOIS da hidratação: perguntar pelo
       contexto assim que o `h1` aparece reprova uma página que está correta. */
    await p
      .waitForFunction(
        () => Boolean(document.querySelector(".landing__fundo canvas")?.getContext("webgl")),
        null,
        { timeout: 20_000 },
      )
      .catch(() => {});
    const anterior = await p.evaluate(() => ({
      titulo: document.querySelector("h1")?.innerText ?? "",
      shader: Boolean(document.querySelector(".landing__fundo canvas")?.getContext("webgl")),
      robots: document.querySelector('meta[name="robots"]')?.content ?? "",
    }));
    r.exigir(
      anterior.titulo.includes("Educação Digital e Midiática"),
      "a landing anterior (ADR-40) continua respondendo em /landing-anterior",
    );
    r.exigir(anterior.shader, "o shader WebGL dela desenha — é o mesmo fundo de /privacidade e /termos");
    r.exigir(anterior.robots.includes("noindex"), `ela é noindex ("${anterior.robots}")`);
    await r.registrar(p, "landing-anterior", {
      titulo: "A landing anterior, preservada",
      mostra: "A proposta da ADR-40, feita com o design system, agora fora da raiz.",
      prova:
        "Ela não foi apagada porque /privacidade e /termos montam o fundo e a folha dela. O `noindex` evita que duas páginas públicas com a mesma proposta disputem o buscador.",
      detalhe: `robots: ${anterior.robots}`,
    });
  },
);
