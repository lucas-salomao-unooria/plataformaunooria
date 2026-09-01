import { HUB, suite } from "../lib/roteiro.mjs";

/**
 * A porta pública: `/` sem sessão nenhuma.
 *
 * O que o typecheck não pega e esta suíte cobra:
 *  - a fonte do DS (Open Sans) e a fonte de LIGADURA dos ícones (Material
 *    Symbols Rounded) carregadas — sem a segunda, o ícone vira a palavra
 *    "warning" escrita na tela;
 *  - o shader de fundo desenhando (canvas com contexto WebGL e tamanho > 0);
 *  - a revelação ao rolar chegando ao fim, e o card de vidro com cor de fundo
 *    COMPUTADA (classe de cor inexistente não é erro em lugar nenhum — o
 *    elemento só fica transparente);
 *  - nada transbordando na largura em celular;
 *  - "Começar Agora" levando ao /login.
 *
 * A api NÃO é necessária: a landing não lê sessão nem dado nenhum.
 */
await suite(
  {
    slug: "publico/01-landing",
    papel: "publico",
    titulo: "A porta pública",
    subtitulo: "landing sem sessão, no desktop e no celular",
    contexto:
      "A primeira tela que qualquer pessoa vê — família, secretaria, edital — antes de existir " +
      "qualquer credencial. Ela é servida pelo hub sem tocar na api e sem ler cookie de sessão.",
    prova: [
      "A raiz sem sessão é a landing: nada de redirecionar para o login",
      "As duas fontes do design system carregam — sem a de ligadura, todo ícone vira texto",
      "O fundo é um shader WebGL de verdade, com contexto e dimensão",
      "A revelação ao rolar termina: nenhum bloco fica invisível para sempre",
      "Nada transborda na largura em 390px, e o CTA leva ao login",
    ],
    comando: "node scripts/e2e/publico/01-landing.mjs",
  },
  async (r) => {
    // ── desktop ──────────────────────────────────────────────────────────
    const p = await r.pagina("desktop", { viewport: { width: 1280, height: 900 } });
    await p.goto(`${HUB}/`, { waitUntil: "domcontentloaded" });
    await p.locator("h1").waitFor({ timeout: 30_000 });

    r.exigir(p.url() === `${HUB}/`, "a raiz sem sessão é a landing, não um redirecionamento");
    r.exigir(
      (await p.locator("h1").innerText()).includes("Educação Digital e Midiática"),
      "o título do hero é o do modelo aprovado",
    );

    /* Hidratação + fontes. O DS auto-hospeda as duas; `fonts.ready` espera o
       download terminar antes de perguntar se elas existem. */
    await p.waitForFunction(
      () => document.getElementById("landing")?.classList.contains("landing--animada"),
      null,
      { timeout: 15_000 },
    );
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(800);

    const fontes = await p.evaluate(() => ({
      openSans: document.fonts.check('16px "Open Sans"'),
      simbolos: document.fonts.check('24px "Material Symbols Rounded"'),
      h1: getComputedStyle(document.querySelector("h1")).fontFamily,
      icone: getComputedStyle(document.querySelector(".material-symbols-rounded")).fontFamily,
      icones: document.querySelectorAll(".material-symbols-rounded").length,
    }));
    r.exigir(fontes.openSans, `Open Sans carregou (h1 em "${fontes.h1.split(",")[0]}")`);
    r.exigir(
      fontes.simbolos,
      `Material Symbols Rounded carregou — sem ela o ícone sai como texto ("${fontes.icone.split(",")[0]}")`,
    );
    r.exigir(fontes.icones >= 8, `${fontes.icones} ícones do DS na página (esperado ≥ 8)`);

    const canvas = await p.evaluate(() => {
      const c = document.querySelector(".landing__fundo canvas");
      if (!c) return null;
      return { w: c.width, h: c.height, gl: Boolean(c.getContext("webgl")) };
    });
    r.exigir(
      canvas && canvas.gl && canvas.w > 0 && canvas.h > 0,
      `o shader de fundo tem contexto WebGL e tamanho (${canvas?.w}×${canvas?.h})`,
    );

    const cta = p.locator("nav a", { hasText: "Começar Agora" });
    r.exigir((await cta.count()) === 1, "o botão 'Começar Agora' está na navegação");
    r.exigir((await cta.getAttribute("href")) === "/login", "'Começar Agora' aponta para /login");

    await r.registrar(p, "hero", {
      titulo: "Hero e proposta de valor",
      mostra:
        "Cabeçalho institucional com a marca, a chamada sobre educação digital e midiática, e o botão de acesso.",
      prova:
        "É a única tela do produto que existe sem credencial: nada aqui pode depender de sessão, de api ou de dado de estudante.",
      detalhe: `${fontes.icones} ícones · canvas ${canvas?.w}×${canvas?.h}`,
    });

    // ── a revelação ao rolar tem de chegar ao fim ────────────────────────
    await p.locator("#problema").scrollIntoViewIfNeeded();
    /* Espera ATIVA pela revelação terminar, em vez de um sleep fixo: a
       transição é de CSS e o tempo dela depende da carga da máquina. Com 900 ms
       cravados, a suíte reprovava "o bloco ficou visível" quando a animação
       ainda estava correndo — culpando o produto pela lentidão do computador. */
    await p
      .waitForFunction(
        () => getComputedStyle(document.querySelector("#problema .landing-vidro")).opacity === "1",
        null,
        { timeout: 15_000 },
      )
      .catch(() => {});
    const cartao = await p.evaluate(() => {
      const el = document.querySelector("#problema .landing-vidro");
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, opacidade: cs.opacity, blur: cs.backdropFilter || cs.webkitBackdropFilter };
    });
    r.exigir(
      cartao.bg && cartao.bg !== "rgba(0, 0, 0, 0)" && cartao.bg !== "transparent",
      `o card de vidro tem cor de fundo COMPUTADA (${cartao.bg}) — token/color-mix resolveu`,
    );
    r.exigir(Number(cartao.opacidade) === 1, "o bloco do desafio ficou visível ao rolar");
    await r.registrar(p, "desafio", {
      titulo: "O desafio que o produto endereça",
      mostra: "Bloco sobre superexposição a telas, algoritmos opacos e desinformação, num card de vidro sobre o shader.",
      prova:
        "A cor do card vem de token com `color-mix`. Uma classe inexistente não é erro em lugar nenhum: o elemento só ficaria transparente, e só a cor computada denuncia.",
      detalhe: `fundo ${cartao.bg} · blur "${cartao.blur}"`,
    });

    await p.locator("#resposta").scrollIntoViewIfNeeded();
    await p.waitForTimeout(1200);
    const simbolo = await p.locator(".landing-conceito img, .landing-conceito svg").count();
    r.exigir(simbolo >= 1, "o símbolo da marca está no painel de resposta");
    await r.registrar(p, "resposta", {
      titulo: "A resposta pedagógica",
      mostra: "Apresentação das experiências imersivas e da mediação docente orientada por evidências.",
      prova: "É a promessa que o resto da suíte vai verificar tela a tela.",
    });

    await p.locator("footer").scrollIntoViewIfNeeded();
    /* Mesma razão do bloco do desafio: espera pelo ESTADO, não pelo relógio. */
    await p
      .waitForFunction(
        () => document.querySelectorAll(".landing-revelar:not(.landing-revelar--visivel)").length === 0,
        null,
        { timeout: 15_000 },
      )
      .catch(() => {});
    const pendentes = await p.evaluate(
      () => document.querySelectorAll(".landing-revelar:not(.landing-revelar--visivel)").length,
    );
    r.exigir(pendentes === 0, `a revelação ao rolar chegou ao fim (${pendentes} blocos pendentes)`);
    await r.registrar(p, "rodape", {
      titulo: "Rodapé institucional",
      mostra: "Conformidade com a LGPD, links institucionais e termos.",
      prova: "O compromisso de privacidade é declarado na porta de entrada, não escondido numa tela interna.",
      detalhe: `${pendentes} blocos de revelação pendentes`,
    });

    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(400);
    await r.registrar(p, "pagina-inteira", {
      titulo: "A landing inteira",
      mostra: "Composição completa da página, do hero ao rodapé.",
      prova: "Hierarquia visual e espaçamento consistentes: tudo vem do design system, nada é CSS local.",
      inteira: true,
    });

    // ── o CTA leva ao login ──────────────────────────────────────────────
    await cta.click();
    await p.waitForURL("**/login", { timeout: 30_000 });
    await p.locator("button[type=submit]").waitFor({ timeout: 15_000 });
    await r.registrar(p, "login", {
      titulo: "Portal de autenticação",
      mostra: "O formulário único de entrada: usuário e senha.",
      prova:
        "Uma porta só para os quatro papéis. Quem entra é roteado pelo papel do token, não por URL diferente — não existe '/login-do-professor' para alguém adivinhar.",
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
      titulo: "A mesma landing no celular",
      mostra: "Viewport de 390×844, tipografia e botões reajustados.",
      prova:
        "A família que recebe o link abre no telefone. Transbordo horizontal aqui é o defeito mais comum e o mais invisível no desktop.",
      detalhe: `scrollWidth ${larguras.scroll} / viewport ${larguras.viewport}`,
    });

    await m.locator("#problema").scrollIntoViewIfNeeded();
    await m.waitForTimeout(900);
    await r.registrar(m, "celular-conteudo", {
      titulo: "Conteúdo empilhado no celular",
      mostra: "Blocos em coluna única, com área de toque adequada.",
      prova: "A mesma revelação ao rolar funciona sem mouse — o IntersectionObserver não depende de hover.",
    });
  },
);
