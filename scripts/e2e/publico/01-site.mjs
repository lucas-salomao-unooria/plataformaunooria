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
 *  - os três canvas com contexto e tamanho. O infinito é amostrado do PIXEL do
 *    logo: se a imagem não carregar, o módulo esconde o palco e a seção das
 *    missões perde a peça central, em silêncio;
 *  - a revelação ao rolar chegando ao fim (`.reveal` sem `.visible` é conteúdo
 *    invisível para sempre);
 *  - as treze seções do material, na ordem;
 *  - nada transbordando na largura em celular;
 *  - o diálogo de navegação abrindo e o CTA levando ao cadastro.
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
      "Os três canvas têm contexto e tamanho: as estrelas e o infinito amostrado do logo",
      "A revelação ao rolar termina: nenhum bloco fica invisível para sempre",
      "Nada transborda na largura em 390px, e o diálogo de navegação abre",
      "A landing anterior continua de pé em /landing-anterior — /privacidade e /termos dependem dela",
    ],
    comando: "node scripts/e2e/publico/01-site.mjs",
  },
  async (r) => {
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

    const canvas = await p.evaluate(() => {
      const medir = (seletor) => {
        const c = document.querySelector(seletor);
        return c ? { w: c.width, h: c.height, ctx: Boolean(c.getContext("2d")) } : null;
      };
      return { poeira: medir("#ambient-dust"), estrelas: medir("#opening-stars"), infinito: medir("#brand-infinity") };
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
    r.exigir(secoes.length === 13, `as ${secoes.length} seções do material estão na página (esperado 13)`);
    r.exigir(secoes[0] === "inicio" && secoes.at(-1) === "cadastro", "a ordem vai do hero ao cadastro");

    await r.registrar(p, "hero", {
      titulo: "A abertura do ENTRE REDES",
      mostra: "Campo de estrelas, a marca, a chamada sobre a vida que mudou de tela e o convite ao cadastro.",
      prova:
        "É a única tela do produto que existe sem credencial: nada aqui pode depender de sessão, de api ou de dado de estudante.",
      detalhe: `${secoes.length} seções · Manrope no h1 · estrelas ${canvas.estrelas?.w}×${canvas.estrelas?.h}`,
    });

    // ── o diálogo de navegação ───────────────────────────────────────────
    await p.getByRole("button", { name: "Abrir navegação" }).click();
    await p.locator("#index-dialog[open]").waitFor({ timeout: 10_000 });
    const itens = await p.locator("#index-dialog .index-links a").count();
    r.exigir(itens >= 9, `o índice abre com os ${itens} capítulos do site`);
    await r.registrar(p, "indice", {
      titulo: "O índice completo",
      mostra: "Diálogo modal com as nove seções e as duas subseções, sobre a página escurecida.",
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
       Quem revela é um `IntersectionObserver`: um salto direto para `#cadastro`
       deixa 29 blocos do meio sem nunca terem entrado no viewport, e uma
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
    await p.locator("#cadastro").scrollIntoViewIfNeeded();
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

    const campos = await p.evaluate(() =>
      Array.from(document.querySelectorAll("#registration-form [name]")).map((e) => e.name),
    );
    for (const campo of ["nome", "email", "telefone", "organizacao", "cargo", "consentimento"]) {
      r.exigir(campos.includes(campo), `o formulário tem o campo "${campo}"`);
    }
    r.exigir(
      (await p.locator("#registration-form").getAttribute("action")) === "/api/cadastro-de-interesse",
      "o formulário aponta para a rota do hub, não para o Worker de origem",
    );
    await r.registrar(p, "cadastro", {
      titulo: "O cadastro de interesse",
      mostra: "Formulário com nome, e-mail profissional, telefone, organização, cargo e o aceite de contato.",
      prova:
        "É a única parte do site que não é porte: o destino mudou de um SQLite fora da plataforma para a api (ADR-107). O envio de verdade é provado em admin/03-prospeccao.",
      detalhe: `${campos.length} campos · ${pendentes} revelações pendentes`,
    });

    /* Sem print de página INTEIRA: o site tem mais de 20.000px de altura e o
       Chrome recusa a captura ("Unable to capture screenshot"). O que substitui
       é a medida, que é como o porte se confere de qualquer forma. */
    const medidas = await p.evaluate(() => ({
      altura: document.documentElement.scrollHeight,
      imagens: document.querySelectorAll("img").length,
      revelacoes: document.querySelectorAll(".reveal").length,
    }));
    await p.locator(".footer").scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    await r.registrar(p, "rodape", {
      titulo: "O fim do percurso",
      mostra: "A marca, a assinatura do programa e o botão de voltar ao início.",
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
    await r.registrar(m, "celular-hero", {
      titulo: "O mesmo site no celular",
      mostra: "Viewport de 390×844: o trilho de capítulos sai, o CTA encurta para 'Cadastro'.",
      prova:
        "O material foi desenhado da menor tela para cima, e é no telefone que a secretaria abre o link. Transbordo horizontal aqui é o defeito mais comum e o mais invisível no desktop.",
      detalhe: `scrollWidth ${larguras.scroll} / viewport ${larguras.viewport}`,
    });

    await m.locator("#missoes").scrollIntoViewIfNeeded();
    await m.waitForTimeout(1500);
    await r.registrar(m, "celular-missoes", {
      titulo: "As missões, no celular",
      mostra: "O infinito de estrelas e os quatro momentos da missão, empilhados.",
      prova:
        "O infinito é amostrado do pixel da marca no cabeçalho; num celular o número de partículas cai pela metade, e a figura tem de continuar reconhecível.",
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
