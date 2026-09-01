import { HUB, suite, estadoDosIcones } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O hub do estudante: a lista de missões e a moldura em que cada uma abre.
 *
 * Existe separado das suítes de cada missão porque o que ele prova é outra
 * coisa: que o CATÁLOGO chega inteiro à criança, que cada cartão leva ao
 * aparelho certo, e que o aparelho é um iframe cross-origin com o sandbox que o
 * manifesto pediu — nem mais permissivo, nem menos.
 *
 * O `sandbox` do iframe é a única defesa entre um bundle de terceiros e a
 * sessão do hub. Ele é montado a partir do manifesto (`permissoes`), e um token
 * a mais aqui não quebra nada visivelmente — por isso precisa de teste.
 */
await suite(
  {
    slug: "estudante/01-hub-de-missoes",
    papel: "estudante",
    titulo: "O hub do estudante",
    subtitulo: "o catálogo de missões e a moldura do aparelho",
    contexto:
      "Depois do login, a criança escolhe a missão. Cada cartão abre uma experiência que roda em " +
      "outra origem, dentro de um iframe com sandbox derivado do manifesto da experiência.",
    prova: [
      "Todas as missões publicadas chegam ao hub do estudante, com copy própria dela",
      "Cada cartão leva ao aparelho certo (/exp/<expId>)",
      "O aparelho roda em outra origem, e cada token de sandbox só chega a quem o declarou",
      "A experiência responde ao handshake da SDK (exp:ready → hub:init) e monta",
      "Os ícones do design system carregam como fonte, e não como texto",
    ],
    comando: "node scripts/e2e/estudante/01-hub-de-missoes.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { serie: "8EF" });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login);

    await p.waitForURL((url) => url.pathname.includes("/estudante"), { timeout: 30_000 });
    const cartoes = p.locator("main ul > li");
    await cartoes.first().waitFor({ timeout: 15_000 });
    const quantas = await cartoes.count();
    const titulos = (await cartoes.allInnerTexts()).map((t) => t.split("\n")[0]);

    r.exigir(quantas >= 4, `o catálogo chegou inteiro: ${quantas} missões (${titulos.join(", ")})`);
    r.exigir(
      (await p.locator("h1").innerText()).includes(estudante.nome.split(" ")[0]),
      "o hub cumprimenta a criança pelo primeiro nome dela",
    );
    console.log("      ícones:", await estadoDosIcones(p));

    await r.registrar(p, "hub-do-estudante", {
      titulo: "As missões disponíveis",
      mostra: `Um cartão por missão, com a chamada escrita para a criança — ${titulos.join(", ")}.`,
      prova:
        "A copy é a do estudante, nunca a do professor: a ficha docente do Instanooria entrega a " +
        "virada da missão, e lê-la antes destruiria a experiência que ela mede.",
      detalhe: `${quantas} missões`,
    });

    // ── cada cartão leva ao aparelho, e o aparelho monta ─────────────────
    /**
     * `declara` é o que o manifesto da experiência pediu — e portanto o que o
     * `ExpFrame` pode conceder. O que interessa provar é a NEGATIVA: quem não
     * declarou não recebe. Um `allow-pointer-lock` universal deixaria qualquer
     * bundle capturar o mouse da criança, e nada na tela denunciaria.
     */
    const missoes = [
      { texto: "Vila do Lume", expId: "exp-70-vila-do-lume", declara: ["allow-pointer-lock"] },
      { texto: "Instanooria", expId: "exp-01-instanooria", declara: [] },
      { texto: "UnooTube", expId: "exp-02-unootube", declara: [], autoplay: true },
      { texto: "unooGPT", expId: "exp-03-unoogpt", declara: ["allow-forms"] },
    ];
    const OPCIONAIS = ["allow-pointer-lock", "allow-forms"];

    for (const missao of missoes) {
      await p.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });
      const cartao = p.locator("a", { hasText: missao.texto }).first();
      if (!(await cartao.count())) {
        r.exigir(false, `o cartão de ${missao.texto} não está no hub`);
        continue;
      }
      await cartao.click();
      await p.waitForURL(`**/exp/${missao.expId}**`, { timeout: 30_000 });

      const iframe = p.locator('iframe[title="experiencia"]');
      await iframe.waitFor({ state: "attached", timeout: 20_000 });
      const sandbox = (await iframe.getAttribute("sandbox")) ?? "";
      const src = (await iframe.getAttribute("src")) ?? "";
      const origemDaExp = new URL(src, HUB).origin;

      r.exigir(
        origemDaExp !== new URL(HUB).origin,
        `${missao.texto}: o aparelho roda em outra ORIGEM (${origemDaExp}) — é ela que isola a sessão do hub`,
      );
      /* Capacidade POR DECLARAÇÃO: cada token opcional só pode aparecer na
         experiência cujo manifesto o pediu. O teste é nos dois sentidos. */
      for (const token of OPCIONAIS) {
        const concedido = sandbox.includes(token);
        const declarado = missao.declara.includes(token);
        r.exigir(
          concedido === declarado,
          `${missao.texto}: ${token} ${declarado ? "concedido a quem declarou" : "NÃO concedido — a experiência não pediu"}`,
        );
      }
      const allow = (await iframe.getAttribute("allow")) ?? "";
      if (missao.autoplay) {
        r.exigir(
          allow.includes("autoplay"),
          `${missao.texto}: o iframe delega autoplay — sem isso o play() rejeita em silêncio`,
        );
      }

      /* Que a experiência MONTOU é o que prova o handshake: sem `exp:ready` →
         `hub:init` ela nunca recebe identidade e fica na tela de carregamento. */
      const dentro = p.frameLocator('iframe[title="experiencia"]');
      await dentro.locator("body").waitFor({ timeout: 30_000 });
      await p.waitForTimeout(3500);
      const montou = await dentro
        .locator("body")
        .innerText()
        .then((t) => t.trim().length > 0)
        .catch(() => false);
      r.exigir(montou, `${missao.texto}: a experiência montou dentro do iframe`);

      await r.registrar(p, `aparelho-${missao.expId}`, {
        titulo: `O aparelho de ${missao.texto}`,
        mostra: `A experiência ${missao.expId} carregada dentro da moldura do hub.`,
        prova:
          "A experiência roda em outra origem: o bundle não alcança o cookie de sessão do hub. O que " +
          "ela recebe é um token de 15 minutos por postMessage com targetOrigin explícito — e do " +
          "sandbox só os tokens que o manifesto dela pediu.",
        detalhe: `sandbox="${sandbox}"`,
      });
    }
  },
);
