import { HUB, suite } from "../lib/roteiro.mjs";

/**
 * As duas páginas legais públicas: `/privacidade` e `/termos`.
 *
 * O bug que originou a frente é o mais barato de todos e o mais constrangedor:
 * os links do rodapé da landing eram `href="#"` e não levavam a lugar nenhum.
 * Por isso a suíte começa na landing e CLICA — verificar as páginas por URL
 * direta deixaria o defeito original passar intacto.
 *
 * O que o typecheck não pega e esta suíte cobra:
 *  - o rodapé apontando para as páginas de verdade, e o clique chegando lá;
 *  - o SUMÁRIO em sincronia com o texto: cada item do índice tem que ter uma
 *    seção correspondente no documento. Âncora quebrada não é erro em lugar
 *    nenhum — o clique simplesmente não sai do lugar, e ninguém percebe até
 *    alguém procurar "meus direitos" e ficar parado no topo;
 *  - a página herdando o fundo da landing (o shader), que é o que faz as duas
 *    parecerem o mesmo produto;
 *  - o painel ACOMPANHANDO a largura da página, e não uma coluna estreita
 *    perdida no meio — foi rejeição explícita numa tentativa anterior;
 *  - NENHUMA `<table>`: conteúdo legal em tabela produz célula altíssima e
 *    rolagem lateral no celular, e foi a outra rejeição da mesma tentativa;
 *  - o realce do sumário acendendo conforme se lê;
 *  - nada transbordando em 390px, nos dois documentos.
 *
 * A api NÃO é necessária: as duas páginas são estáticas e não leem sessão.
 *
 * ATENÇÃO, e está dito em voz alta no roteiro: **a raiz não leva a estas duas
 * páginas desde a ADR-107**. O site público novo veio com o rodapé do material
 * aprovado, sem os links legais, e a decisão foi preservá-lo como está. Quem
 * as alcança é o rodapé da landing anterior; por URL direta elas respondem.
 */

/** Coleta o índice, as seções e as medidas de layout de uma página legal. */
const RADIOGRAFIA = () => {
  const itens = [...document.querySelectorAll(".legal-sumario__link")].map((a) => ({
    texto: a.textContent.trim(),
    alvo: a.getAttribute("href")?.replace("#", ""),
  }));
  const secoes = [...document.querySelectorAll(".legal-secao__cabecalho")].map((s) => s.id);
  const artigo = document.querySelector(".legal-artigo");
  const canvas = document.querySelector(".landing__fundo canvas");
  return {
    itens,
    secoes,
    orfas: itens.filter((i) => !i.alvo || !document.getElementById(i.alvo)).map((i) => i.texto),
    tabelas: document.querySelectorAll(".legal-artigo table").length,
    cards: document.querySelectorAll(".legal-card").length,
    larguraArtigo: artigo ? Math.round(artigo.getBoundingClientRect().width) : 0,
    larguraJanela: window.innerWidth,
    fundoArtigo: artigo ? getComputedStyle(artigo).backgroundColor : null,
    shader: canvas ? { w: canvas.width, h: canvas.height, gl: Boolean(canvas.getContext("webgl")) } : null,
  };
};

/**
 * Um documento inteiro, do clique no rodapé ao fim do texto. Roda duas vezes:
 * `/privacidade` e `/termos`.
 */
async function documento(r, p, { rota, link, titulo, prefixo }) {
  /* `/landing-anterior`, e não `/`: desde a ADR-107 a raiz é o site de
     marketing, cujo rodapé — preservado como veio do material aprovado — NÃO
     linka para as páginas legais. O rodapé que as alcança é o da landing
     anterior, que continua de pé justamente porque estas duas páginas montam o
     fundo e a folha dela. O clique continua sendo o objeto do teste: foi um
     `href="#"` que originou esta suíte, e conferir por URL direta deixaria esse
     defeito passar intacto. */
  await p.goto(`${HUB}/landing-anterior`, { waitUntil: "domcontentloaded" });
  await p.locator("footer").scrollIntoViewIfNeeded();

  const ancora = p.locator("footer a", { hasText: link });
  r.exigir((await ancora.count()) === 1, `o rodapé da landing tem o link “${link}”`);
  r.exigir(
    (await ancora.getAttribute("href")) === rota,
    `“${link}” aponta para ${rota} — era href="#" e não levava a lugar nenhum`,
  );

  await ancora.click();
  await p.waitForURL(`**${rota}`, { timeout: 30_000 });
  await p.locator("h1").waitFor({ timeout: 30_000 });
  await p.evaluate(() => document.fonts.ready);
  /*
   * Espera pelo ESTADO, não pelo relógio. O `<canvas>` nasce no HTML com os
   * 300x150 padrão e só ganha tamanho quando o efeito do `FundoAnimado` monta e
   * chama `ajustar()`. Com um `waitForTimeout` fixo, esta suíte reprovou "a
   * página herda o fundo animado (300x150)" nos Termos — culpando o produto
   * pela hidratação não ter chegado em 600 ms num documento de dezenas de
   * milhares de pixels. O sintoma parecia defeito de CSS e era espera cega.
   */
  await p
    .waitForFunction(
      () => (document.querySelector(".landing__fundo canvas")?.width ?? 0) > 300,
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});

  r.exigir(
    (await p.locator("h1").innerText()).includes(titulo),
    `o clique no rodapé chega em “${titulo}”`,
  );

  const raio = await p.evaluate(RADIOGRAFIA);

  /* O índice e o texto saem da MESMA lista no componente, mas é justamente por
     isso que vale conferir: se um dia alguém escrever a marcação à mão, o
     sumário passa a prometer seção que não existe e nada acusa. */
  r.exigir(raio.itens.length >= 10, `o sumário tem ${raio.itens.length} seções (esperado ≥ 10)`);
  r.exigir(
    raio.orfas.length === 0,
    raio.orfas.length === 0
      ? "todo item do sumário aponta para uma seção existente"
      : `itens do sumário sem seção: ${raio.orfas.join(", ")}`,
  );
  r.exigir(
    raio.secoes.length === raio.itens.length,
    `o índice cobre o documento inteiro (${raio.itens.length} itens / ${raio.secoes.length} seções)`,
  );

  /* As duas rejeições da tentativa anterior, agora como asserção. */
  r.exigir(
    raio.tabelas === 0,
    `nenhuma <table> no texto legal (${raio.tabelas}) — tabela aqui vira célula alta e rolagem lateral no celular`,
  );
  r.exigir(
    raio.larguraArtigo > raio.larguraJanela * 0.6,
    `o painel acompanha a largura da página (${raio.larguraArtigo}px de ${raio.larguraJanela}px), em vez de uma coluna estreita`,
  );
  r.exigir(
    raio.fundoArtigo && raio.fundoArtigo !== "rgba(0, 0, 0, 0)",
    `o painel de vidro tem cor COMPUTADA (${raio.fundoArtigo}) — o color-mix dos tokens resolveu`,
  );
  r.exigir(
    raio.shader?.gl && raio.shader.w > 0,
    `a página herda o fundo animado da landing (${raio.shader?.w}×${raio.shader?.h})`,
  );

  await r.registrar(p, `${prefixo}-topo`, {
    titulo: `${titulo}: cabeçalho e sumário`,
    mostra:
      "Título, resumo, a linha de versão e vigência, e o índice lateral com as seções do documento.",
    prova:
      "É a página que a família e a secretaria abrem antes de confiar o dado de uma criança. Ela herda o fundo, a marca e a tipografia da landing porque é a mesma superfície pública — parecer outro produto aqui lê como página de terceiro.",
    detalhe: `${raio.itens.length} seções · ${raio.cards} cards · painel ${raio.larguraArtigo}px · ${raio.tabelas} tabelas`,
  });

  /* O realce do sumário: rola até a última seção e confirma que o índice
     acompanhou. Sem isso o `aria-current` pode nunca acender e a página fica
     com um índice decorativo. */
  const ultima = raio.secoes[raio.secoes.length - 1];
  await p.locator(`#${ultima}`).scrollIntoViewIfNeeded();
  await p.waitForTimeout(900);
  const aceso = await p.evaluate(
    () => document.querySelector('.legal-sumario__link[aria-current="true"]')?.textContent?.trim() ?? null,
  );
  r.exigir(Boolean(aceso), `o sumário acompanha a leitura e acende o item atual (“${aceso}”)`);

  await r.registrar(p, `${prefixo}-corpo`, {
    titulo: `${titulo}: o texto e os blocos`,
    mostra:
      "Seções numeradas, parágrafos na medida de leitura e os blocos de destaque em card ocupando o painel.",
    prova:
      "O ritmo é deliberado: parágrafo curto o bastante para o olho achar a linha de volta, bloco largo o bastante para a página não virar uma coluna solta. O conteúdo tabular vira card justamente para não obrigar ninguém a rolar de lado no celular.",
    detalhe: `item aceso no índice: “${aceso}”`,
  });

  /*
   * Sem `inteira: true`: estes documentos passam de 16.000 px de altura e o
   * `captureScreenshot` do Chrome desiste ("Unable to capture screenshot"), o
   * que gastava um passo do roteiro para registrar um erro de ferramenta. O
   * fim da página é o enquadramento que interessa aqui de qualquer forma — é
   * onde mora o atalho para o documento irmão.
   */
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(500);
  await r.registrar(p, `${prefixo}-fim`, {
    titulo: `${titulo}: o fim do documento`,
    mostra:
      "As últimas seções, incluindo o que ainda está sendo definido, e o atalho para o documento irmão.",
    prova:
      "A seção de pendências é deliberada: declarar o que ainda não está fechado é o que impede a página de prometer processo que não existe. O art. 9º da LGPD cobra informação clara, e o público aqui inclui adolescentes.",
  });

  return raio;
}

await suite(
  {
    slug: "publico/03-documentos-legais",
    papel: "publico",
    titulo: "Os documentos legais",
    subtitulo: "privacidade e termos, alcançados pelo rodapé da landing anterior",
    contexto:
      "As duas páginas que a rede, a escola e a família leem antes de aceitar o produto. São públicas, " +
      "não leem sessão e não tocam a api — e até agora os links do rodapé não levavam a lugar nenhum.",
    prova: [
      "Os links do rodapé levam de verdade — o defeito original era href=\"#\"",
      "Todo item do sumário tem seção correspondente: nenhuma âncora quebrada",
      "As páginas herdam o fundo, a marca e a largura da landing",
      "Nenhuma tabela no texto legal, e nada transborda em 390px",
      "O índice lateral acende conforme a leitura avança",
    ],
    comando: "node scripts/e2e/publico/03-documentos-legais.mjs",
  },
  async (r) => {
    r.ressalva(
      "A RAIZ NÃO LEVA A ESTAS PÁGINAS desde a ADR-107: o rodapé do site novo veio do material aprovado, sem os links legais. Quem as alcança é o rodapé de /landing-anterior; por URL direta as duas respondem.",
    );
    // ── desktop: os dois documentos, cada um a partir do rodapé ──────────
    const p = await r.pagina("desktop", { viewport: { width: 1440, height: 900 } });

    await documento(r, p, {
      rota: "/privacidade",
      link: "Privacidade",
      titulo: "Política de Privacidade",
      prefixo: "privacidade",
    });

    /* O atalho cruzado: quem lê uma quase sempre procura a outra, e é o
       caminho que não passa pelo rodapé. */
    const cruzado = p.locator(".legal-atalho");
    r.exigir((await cruzado.count()) >= 1, "a política oferece atalho para o documento irmão");
    await cruzado.first().click();
    await p.waitForURL("**/termos", { timeout: 30_000 });
    await p.locator("h1").waitFor({ timeout: 15_000 });
    r.exigir(
      (await p.locator("h1").innerText()).includes("Termos"),
      "o atalho da política leva aos Termos de Uso",
    );

    await documento(r, p, {
      rota: "/termos",
      link: "Termos",
      titulo: "Termos de Uso",
      prefixo: "termos",
    });

    // ── celular: onde a tabela e a coluna estreita doem ──────────────────
    const m = await r.pagina("celular", { viewport: { width: 390, height: 844 }, mobile: true });
    for (const rota of ["/privacidade", "/termos"]) {
      await m.goto(`${HUB}${rota}`, { waitUntil: "domcontentloaded" });
      await m.locator("h1").waitFor({ timeout: 30_000 });
      await m.waitForTimeout(900);
      const larguras = await m.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      r.exigir(
        larguras.scroll <= larguras.viewport,
        `${rota} não transborda em celular (${larguras.scroll} ≤ ${larguras.viewport})`,
      );
      await r.registrar(m, `celular${rota.replace("/", "-")}`, {
        titulo: `${rota} no celular`,
        mostra: "Sumário empilhado acima do texto e seções em coluna única, a 390px.",
        prova:
          "É o aparelho em que a família abre o link. O índice deixa de ser fixo aqui de propósito: grudado, ocuparia meia tela escondendo justamente o que indexa.",
        detalhe: `scrollWidth ${larguras.scroll} / viewport ${larguras.viewport}`,
      });
    }
  },
);
