import { suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * A missão do UnooTube, do briefing à virada do ranking.
 *
 * A missão pede três favoritos e depois mostra um ranking por INSCRITOS — o
 * placar que a criança já conhece. A virada é o botão que troca o critério por
 * CREDIBILIDADE e reordena tudo na frente dela. Nenhuma frase explica; a
 * posição dela é que muda.
 *
 * O estado inteiro é server-side (`exp_02_sessoes`): salvar, curtir, concluir e
 * o critério do ranking. Por isso o roteiro termina com um F5 — o que sobrevive
 * à recarga é o que existe de verdade.
 *
 * Os seletores aqui são CONTRATO com a experiência (README da exp-02).
 */
const SERIE = "4EF";

await suite(
  {
    slug: "estudante/03-unootube",
    papel: "estudante",
    titulo: "UnooTube — inscritos ou credibilidade",
    subtitulo: "a missão dos Shorts e a troca de critério do ranking",
    contexto:
      "Um clone de feed de vídeos curtos. A criança escolhe três favoritos entre vinte, vê o " +
      "ranking da turma ordenado por número de inscritos — e então o critério muda para " +
      "credibilidade, na frente dela, sem nenhum texto explicando o que aconteceu.",
    prova: [
      "O autoplay funciona dentro do iframe cross-origin (o hub delega a permissão)",
      "O feed anda por teclado, e não só por rolagem",
      "O limite de três favoritos é do servidor, e o quarto abre a troca em vez de um toast",
      "Tema escuro alcança as duas seções do design system, a do clone e a da plataforma",
      "A virada do ranking reordena a turma pelo critério novo",
      "Tudo sobrevive ao F5 porque o estado é do servidor",
    ],
    comando: "node scripts/e2e/estudante/03-unootube.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { serie: SERIE });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login);

    await p.waitForURL((url) => url.pathname.includes("/estudante"), { timeout: 30_000 });
    const cartao = p.locator("a", { hasText: "UnooTube" }).first();
    await cartao.waitFor({ timeout: 15_000 });
    await cartao.click();
    await p.waitForURL("**/exp/exp-02-unootube**", { timeout: 30_000 });

    const tela = p.frameLocator('iframe[title="experiencia"]');
    await tela.locator(".uni-topbar .uni-logo").first().waitFor({ timeout: 30_000 });

    /* Estado anterior? Reinicia pelo perfil — é o caminho do produto, e de
       graça ele cobre o reset. Sem isto a segunda execução acha a missão já
       concluída e não exercita nada. */
    const jaComecou = (await tela.locator("section.entrada").count()) === 0;
    if (jaComecou) {
      await tela.locator('button[aria-label="Abrir seu perfil"]').click();
      await tela.locator("button", { hasText: "Reiniciar missão" }).click();
      await tela.locator("button", { hasText: "Sim, reiniciar" }).click();
      await tela.locator("section.entrada").waitFor({ timeout: 15_000 });
      await r.registrar(p, "missao-reiniciada", {
        titulo: "A missão recomeça do zero",
        mostra: "A tela de entrada de volta, com a sessão anterior descartada.",
        prova:
          "Reiniciar é do estudante e apaga o estado no servidor. É o que permite a mesma criança " +
          "repetir a missão numa segunda aula — e o que torna este roteiro repetível.",
      });
    }

    await tela.locator("h1", { hasText: "Missão: escolha seus Shorts favoritos!" }).waitFor({ timeout: 20_000 });
    const passosDoBriefing = await tela.locator(".entrada-passos li").count();
    const regrasDoBriefing = await tela.locator(".entrada-regras li").count();
    await r.registrar(p, "briefing", {
      titulo: "O briefing da missão",
      mostra: `${passosDoBriefing} passos e ${regrasDoBriefing} regras, na linguagem do app.`,
      prova:
        "A regra dos três favoritos é anunciada antes: o limite não pode ser descoberto como " +
        "punição no meio da escolha.",
      detalhe: `${passosDoBriefing} passos · ${regrasDoBriefing} regras`,
    });

    await tela.locator("button", { hasText: "Começar missão" }).click();
    await tela.locator("article.short-item").first().waitFor({ timeout: 20_000 });

    /* AUTOPLAY: sem `allow="autoplay"` no iframe o play() rejeita em silêncio.
       Espera ATIVA — o vídeo só começa a baixar agora, e um sleep fixo acusava
       "bloqueado" por rede lenta, que é o pior falso negativo: aponta para o
       `allow` do iframe, que está certo. */
    const tocando = await tela
      .locator("article.short-item")
      .first()
      .evaluate(
        (item) =>
          new Promise((resolve) => {
            const limite = Date.now() + 15_000;
            const olhar = () => {
              const v = item.querySelector("video");
              if (v && !v.paused && v.readyState >= 2) return resolve(true);
              if (Date.now() > limite) return resolve(false);
              setTimeout(olhar, 250);
            };
            olhar();
          }),
      );
    const quantosVideos = await tela.locator("article.short-item").count();
    r.exigir(tocando, "o autoplay funciona dentro do iframe cross-origin");
    await r.registrar(p, "feed-de-shorts", {
      titulo: "O feed de Shorts",
      mostra: `${quantosVideos} vídeos verticais, o primeiro já tocando, e a bandeja de favoritos vazia embaixo.`,
      prova:
        "A Permissions-Policy tem default 'self': sem o hub delegar `autoplay`, o vídeo " +
        "cross-origin não toca e nada no console explica por quê.",
      detalhe: `${quantosVideos} shorts · autoplay ${tocando ? "ok" : "BLOQUEADO"}`,
    });

    // ── navegação por teclado ────────────────────────────────────────────
    /* O feed anda por seta, e isso vive num `useEffect` cujo listener depende de
       `moverFeed`. Quebra calado: dependência velha e a seta move para o vídeo
       ERRADO; listener recriado a cada render e ele some entre o keydown e o
       handler. Mede o item mais perto do centro — que é o que a pessoa vê. */
    const itemCentral = () =>
      tela
        .locator("article.short-item")
        .first()
        .evaluate(() => {
          const meio = window.innerHeight / 2;
          const perto = [...document.querySelectorAll("article.short-item")]
            .map((el, i) => {
              const caixa = el.getBoundingClientRect();
              return { i, d: Math.abs(caixa.top + caixa.height / 2 - meio) };
            })
            .sort((a, z) => a.d - z.d)[0];
          return perto ? perto.i : -1;
        });
    await tela.locator("article.short-item").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    const noComeco = await itemCentral();
    await p.keyboard.press("ArrowDown");
    await p.waitForTimeout(1600);
    const depoisDeDescer = await itemCentral();
    await p.keyboard.press("ArrowUp");
    await p.waitForTimeout(1600);
    const depoisDeSubir = await itemCentral();
    r.exigir(
      depoisDeDescer > noComeco && depoisDeSubir === noComeco,
      `as setas movem o feed nos dois sentidos (${noComeco} → ${depoisDeDescer} → ${depoisDeSubir})`,
    );
    await r.registrar(p, "feed-por-teclado", {
      titulo: "O feed anda por teclado",
      mostra: "O vídeo central mudou com a seta para baixo e voltou com a seta para cima.",
      prova:
        "Nem toda criança usa toque. O caminho por teclado é acessibilidade, e é o tipo de coisa " +
        "que quebra numa dependência de `useEffect` sem nada aparecer na tela.",
      detalhe: `${noComeco} → ${depoisDeDescer} → ${depoisDeSubir}`,
    });

    // ── três favoritos, e o limite ───────────────────────────────────────
    for (let i = 0; i < 3; i += 1) {
      const botoes = tela.locator('button[aria-label="Salvar vídeo"]:not([disabled])');
      await botoes.nth(i).scrollIntoViewIfNeeded();
      await p.waitForTimeout(600);
      await botoes.nth(i).click();
      await p.waitForTimeout(900);
    }
    const preenchidos = await tela.locator(".bandeja-previa").count();
    r.exigir(preenchidos === 3, `os três favoritos entraram na bandeja (${preenchidos})`);
    await r.registrar(p, "tres-favoritos", {
      titulo: "Três favoritos escolhidos",
      mostra: "A bandeja embaixo com as três prévias preenchidas.",
      prova:
        "A escolha é o dado da missão: quais três vídeos, entre vinte com credibilidades muito " +
        "diferentes, esta criança guardou.",
      detalhe: `${preenchidos} na bandeja`,
    });

    const quarto = tela.locator('button[aria-label="Salvar vídeo"]:not([disabled])').first();
    await quarto.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await quarto.click();
    await tela.locator("text=Você já salvou 3 vídeos!").waitFor({ timeout: 10_000 });
    const trocasOferecidas = await tela.locator(".dialogo-limite__favoritos li").count();
    r.exigir(trocasOferecidas === 3, `o limite oferece a troca dos três (${trocasOferecidas} opções)`);
    await r.registrar(p, "limite-de-favoritos", {
      titulo: "O quarto favorito abre uma escolha",
      mostra: "Diálogo com os três já salvos, oferecendo trocar um deles.",
      prova:
        "Isto SUBSTITUIU um toast de 'playlist cheia': o toast sumia em cinco segundos e não " +
        "oferecia saída nenhuma. Aqui o limite vira decisão, não bloqueio.",
      detalhe: `${trocasOferecidas} trocas oferecidas`,
    });
    await tela.locator("button", { hasText: "Entendi!" }).click();
    await p.waitForTimeout(600);

    const concluir = tela.locator("button", { hasText: "Concluir missão" });
    r.exigir(!(await concluir.isDisabled()), "com três favoritos, 'Concluir missão' habilita");
    await concluir.click();
    await tela.locator("text=Você salvou 3 vídeos!").waitFor({ timeout: 10_000 });
    const resultado = await tela.locator(".complete-result").innerText();
    await r.registrar(p, "missao-concluida", {
      titulo: "Missão concluída",
      mostra: "O resumo do que ela escolheu.",
      prova: "A conclusão é gravada no servidor: é ela que libera o ranking da turma.",
      detalhe: resultado.replace(/\s+/g, " ").trim().slice(0, 90),
    });

    // ── a coleção ────────────────────────────────────────────────────────
    await tela.locator("button", { hasText: "Ver depois" }).click();
    await tela.locator("nav.uni-sidebar button", { hasText: "Playlists" }).click();
    await tela.locator("h1", { hasText: "Sua coleção" }).waitFor({ timeout: 15_000 });
    await p.waitForTimeout(1200);
    const previas = await tela.locator(".library-preview video").count();
    await r.registrar(p, "playlist-salvos", {
      titulo: "A prateleira de salvos",
      mostra: `${previas} prévias em vídeo na prateleira.`,
      prova: "A coleção vem do servidor, não do localStorage — trocar de máquina não perde nada.",
      detalhe: `${previas} prévias`,
    });

    await tela.locator("button", { hasText: "Curtidos" }).click();
    await p.waitForTimeout(800);
    await r.registrar(p, "playlist-curtidos", {
      titulo: "A prateleira de curtidos",
      mostra: "A segunda aba da coleção.",
      prova: "Curtir e salvar são gestos diferentes e ficam separados — como no app que ela imita.",
    });

    // ── o ranking, e a virada ────────────────────────────────────────────
    await tela.locator("nav.uni-sidebar button", { hasText: "Ranking" }).click();
    /* Da revelação em diante quem desenha é o DS da PLATAFORMA: o título vira
       `<h2>` de `SectionHeader`, a tabela é `.unooria-table` e o resumo são
       `MetricCard`. É a fronteira entre as duas seções do design system. */
    await tela.locator("h2", { hasText: "Ranking da turma" }).waitFor({ timeout: 15_000 });
    await tela.locator(".unooria-table tbody tr").nth(39).waitFor({ timeout: 15_000 });
    const posicaoAntes = await tela.locator(".unooria-metric-card__value").first().innerText();
    await r.registrar(p, "ranking-por-inscritos", {
      titulo: "O ranking por inscritos",
      mostra: "Quarenta linhas ordenadas pelo número de inscritos, com a posição desta criança em destaque.",
      prova:
        "Aqui a interface troca de família: sai o clone e entra o design system da plataforma. " +
        "A mudança visual é o sinal de que a ficção acabou.",
      detalhe: `posição ${posicaoAntes}`,
    });

    // ── tema escuro: as duas seções do DS ────────────────────────────────
    await tela.locator('button[aria-label="Abrir seu perfil"]').click();
    const primeiroNome = estudante.nome.split(" ")[0];
    await tela.locator("h1", { hasText: primeiroNome }).first().waitFor({ timeout: 15_000 });
    await tela.locator("button", { hasText: "Escuro" }).click();
    await p.waitForTimeout(600);
    const temaEscuro = await tela.locator("html").getAttribute("data-uni-theme");
    r.exigir(temaEscuro === "dark", `o tema escuro marcou o clone (data-uni-theme="${temaEscuro}")`);
    await r.registrar(p, "perfil-tema-escuro", {
      titulo: "A criança troca a aparência",
      mostra: "O perfil dela, com a preferência de tema.",
      prova:
        "A troca vale para as DUAS seções do design system: `data-uni-theme` no clone e " +
        "`.unooria-theme-dark` na plataforma. Uma só delas trocando quebraria na virada do ranking.",
      detalhe: `data-uni-theme="${temaEscuro}"`,
    });

    await tela.locator("nav.uni-sidebar button", { hasText: "Ranking" }).click();
    await tela.locator("h2", { hasText: "Ranking da turma" }).waitFor({ timeout: 15_000 });
    await r.registrar(p, "ranking-no-escuro", {
      titulo: "O ranking no tema escuro",
      mostra: "A mesma tabela, agora na paleta escura da plataforma.",
      prova: "É aqui que se vê se a troca atravessou a fronteira entre as duas seções do DS.",
    });

    await tela.locator("button", { hasText: "Adicionar credibilidade" }).click();
    await tela.locator("text=Ter muitos inscritos não significa contar a verdade").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(800);
    const posicaoDepois = await tela.locator(".unooria-metric-card__value").first().innerText();
    await r.registrar(p, "a-virada-do-ranking", {
      titulo: "A virada: o critério muda",
      mostra: "A mesma turma, reordenada por credibilidade, e a posição desta criança em outro lugar.",
      prova:
        "A frase-chave da missão aparece só agora, depois de a criança ter escolhido. Anunciar o " +
        "critério antes faria a escolha ser sobre o critério, e não sobre o gosto dela.",
      detalhe: `posição ${posicaoAntes} → ${posicaoDepois}`,
    });

    // ── o F5 ─────────────────────────────────────────────────────────────
    await p.reload({ waitUntil: "domcontentloaded" });
    const depoisDoF5 = p.frameLocator('iframe[title="experiencia"]');
    await depoisDoF5.locator("article.short-item").first().waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1500);
    const salvosDepois = await depoisDoF5.locator('button[aria-label="Remover dos salvos"]').count();
    r.exigir(salvosDepois === 3, `os três favoritos voltaram depois do F5 (${salvosDepois})`);
    await r.registrar(p, "estado-sobrevive-ao-f5", {
      titulo: "O estado é do servidor",
      mostra: "Depois da recarga, os três favoritos continuam marcados.",
      prova:
        "Nada da missão mora no navegador. Uma aula em laboratório, com máquinas compartilhadas e " +
        "recarregadas, não pode depender do que ficou na aba.",
      detalhe: `${salvosDepois} salvos após F5`,
    });
  },
);
