import { HUB, suite, estadoDosIcones } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O hub do estudante: a TURMA dele, as missões dela e a moldura em que cada uma
 * abre.
 *
 * Esta suíte mudou de assunto com a sala de aula (ADR-69). Ela provava que o
 * CATÁLOGO INTEIRO chegava à criança — cinco missões, iguais para toda criança
 * de toda escola. Agora prova o contrário, que é o ponto do produto: chega a
 * grade da TURMA dela, e só abre o que o professor liberou naquela sala.
 *
 * O par 8A/8B é o coração do teste. Mesma série, mesmas duas missões na grade,
 * estados diferentes: na 8A o seed liberou, na 8B não. Era exatamente isto que
 * não existia — duas turmas do mesmo ano eram indistinguíveis.
 *
 * O `sandbox` do iframe continua sendo provado aqui: ele é a única defesa entre
 * um bundle de terceiros e a sessão do hub, é montado a partir do manifesto
 * (`permissoes`), e um token a mais não quebra nada visivelmente.
 */
await suite(
  {
    slug: "estudante/01-hub-de-missoes",
    papel: "estudante",
    titulo: "O hub do estudante",
    subtitulo: "a turma, as missões dela e a moldura do aparelho",
    contexto:
      "Depois do login, a criança vê a TURMA dela e as missões daquela sala. Só abre o que o " +
      "professor liberou; o resto aparece com cadeado. Cada missão aberta roda em outra origem, " +
      "dentro de um iframe com sandbox derivado do manifesto da experiência.",
    prova: [
      "O estudante entra na TURMA dele — a grade é a do ano dela, não o catálogo inteiro",
      "Missão não liberada aparece com CADEADO, e não some da tela",
      "Duas turmas do MESMO ano têm estados diferentes: 8A aberta, 8B fechada",
      "Missão de outra série não entra na grade (o unooGPT é da 2ª série do EM)",
      "URL direta de missão não liberada responde 404 — o cadeado não é só enfeite",
      "Cada cartão aberto leva ao aparelho certo, em outra origem, com o sandbox que o manifesto pediu",
    ],
    comando: "node scripts/e2e/estudante/01-hub-de-missoes.mjs",
  },
  async (r) => {
    /* A grade do 8º ano: a transversal (Vila, `series: []`) e as missões do ano
       (Unoovista na unidade 1, Manifesto da IA na 4 — as duas com
       `series: ["8EF"]`). O seed libera TODAS na 8A e NENHUMA na 8B — as turmas
       "B" ficam fechadas de propósito, para o professor exercitar liberar sem
       interferir em suíte de estudante.

       **Missão nova do 8º ano entra NESTA lista.** A contagem abaixo é
       `abertos === missoes.length`: publicar uma missão para o 8º e não a
       acrescentar aqui derruba esta suíte com "as N missões da 8A estão
       abertas" — que culpa a liberação por uma lista desatualizada. Aconteceu
       com a exp08ef4b em 2026-09-11, e o mesmo efeito colateral já tinha quebrado
       `apps/api/tests/salas-postgres.spec.ts`. */
    const missoes = [
      { texto: "Vila do Lume", expId: "app-70-vila-do-lume", declara: ["allow-pointer-lock"] },
      { texto: "Unoovista", expId: "exp08ef1b", declara: [] },
      { texto: "Manifesto da IA", expId: "exp08ef4b", declara: ["allow-forms"] },
    ];
    const OPCIONAIS = ["allow-pointer-lock", "allow-forms"];
    /* Da 2ª série do EM: não pertence à grade do 8º. Não é "bloqueada" — é de outra
       série, e nem aparece. São coisas diferentes, e a tela precisa distingui-las. */
    const DE_OUTRA_SERIE = { texto: "unooGPT", expId: "exp02em1b" };

    /* O 404 é PROVOCADO: esta suíte digita de propósito a URL de uma missão que
       não é desta turma, e é o servidor recusando que ela existe para provar. */
    r.provocado(
      /404.*\/exp\/exp02em1b/,
      "a porta da sala recusando a URL adivinhada de uma missão de outra série",
    );

    // ══ a turma ABERTA (8A) ═════════════════════════════════════════════
    const daOitoA = conta("estudante", { turma: "8A" });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, daOitoA.login);

    await p.waitForURL((url) => url.pathname.includes("/estudante"), { timeout: 30_000 });
    const cartoes = p.locator("main ul > li");
    await cartoes.first().waitFor({ timeout: 15_000 });
    const titulos = (await cartoes.allInnerTexts()).map((t) => t.split("\n")[0]);

    r.exigir(
      (await p.locator("main h2").first().innerText()).includes(daOitoA.turma),
      `o hub abre pela TURMA da criança (${daOitoA.turma})`,
    );
    r.exigir(
      (await p.locator("h1").innerText()).includes(daOitoA.nome.split(" ")[0]),
      "o hub cumprimenta a criança pelo primeiro nome dela",
    );
    for (const missao of missoes) {
      r.exigir(
        titulos.some((t) => t.includes(missao.texto)),
        `${missao.texto} está na grade do 8º ano`,
      );
    }
    r.exigir(
      !titulos.some((t) => t.includes(DE_OUTRA_SERIE.texto)),
      `${DE_OUTRA_SERIE.texto} NÃO entra na grade: é da 2ª série do EM, não desta turma`,
    );
    const abertos = await p.locator('[data-estado="liberada"]').count();
    r.exigir(abertos === missoes.length, `as ${missoes.length} missões da 8A estão abertas`);
    console.log("      ícones:", await estadoDosIcones(p));

    await r.registrar(p, "hub-do-estudante", {
      titulo: "A turma e as missões dela",
      mostra: `A turma ${daOitoA.turma} no topo e um cartão por missão da grade do ano — ${titulos.join(", ")}.`,
      prova:
        "A lista não é mais o catálogo inteiro: é a grade da TURMA. A copy é a do estudante, nunca " +
        "a do professor — a ficha docente do Unoovista entrega a virada da missão, e lê-la antes " +
        "destruiria a experiência que ela mede.",
      detalhe: `${titulos.length} missões, ${abertos} abertas`,
    });

    // ══ a URL direta de missão que não é desta turma ════════════════════
    const resposta = await p.goto(`${HUB}/exp/${DE_OUTRA_SERIE.expId}`, {
      waitUntil: "domcontentloaded",
    });
    r.exigir(
      resposta?.status() === 404,
      `a URL direta de ${DE_OUTRA_SERIE.texto} responde 404 (veio ${resposta?.status()})`,
    );
    await r.registrar(p, "url-direta-recusada", {
      titulo: "A URL adivinhada não abre",
      mostra: "O endereço da missão da 2ª série do EM, digitado por um estudante do 8º.",
      prova:
        "Esconder o cartão é UX; a porta é do servidor. Antes da sala de aula qualquer estudante " +
        "logado abria qualquer missão digitando /exp/<expId> — o bundle é público e o endereço é " +
        "adivinhável. A api recusa com 403 `missao-nao-liberada` e o hub responde 404 antes de " +
        "assinar token nenhum.",
    });

    // ══ cada cartão aberto leva ao aparelho, e o aparelho monta ═════════
    /**
     * `declara` é o que o manifesto da experiência pediu — e portanto o que o
     * `ExpFrame` pode conceder. O que interessa provar é a NEGATIVA: quem não
     * declarou não recebe. Um `allow-pointer-lock` universal deixaria qualquer
     * bundle capturar o mouse da criança, e nada na tela denunciaria.
     */
    for (const missao of missoes) {
      await p.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });
      const cartao = p.locator("a", { hasText: missao.texto }).first();
      if (!(await cartao.count())) {
        r.exigir(false, `o cartão de ${missao.texto} não está clicável no hub da 8A`);
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

    // ══ ficar na missão CONTA como uso (ADR-96) ═════════════════════════
    /**
     * A criança está DENTRO de uma missão, e é exatamente aqui que o defeito
     * morava. A sessão do hub é uma janela de INATIVIDADE, mas só o middleware
     * devolve o `Set-Cookie` que a desliza — e `GET /api/exp-token`, que a
     * experiência pede de 10 em 10 minutos, está fora do `matcher` dele. Quem
     * ficava no aparelho via o prazo envelhecer como se estivesse parado, e a
     * sessão morria com a criança trabalhando.
     *
     * O que se prova aqui NÃO depende do TTL: o prazo do cookie é reescrito
     * para `agora + maxAge` a cada renovação, então basta vê-lo ANDAR.
     */
    const prazoDaSessao = async () => {
      const cookies = await p.context().cookies();
      return cookies.find((c) => c.name.includes("session-token"))?.expires ?? 0;
    };
    const prazoAntes = await prazoDaSessao();
    r.exigir(prazoAntes > 0, "a sessão do estudante tem cookie com prazo");
    /* Não é espera por estado — é RELÓGIO. O prazo do cookie tem resolução de
       segundo: sem deixar o tempo andar, o prazo novo sairia idêntico ao velho
       e a asserção passaria sem provar nada. */
    await p.waitForTimeout(2_000);
    const statusDoPasse = await p.evaluate(() =>
      fetch("/api/exp-token", { cache: "no-store" }).then((resp) => resp.status),
    );
    r.exigir(statusDoPasse === 200, `o pedido de passe respondeu 200 (veio ${statusDoPasse})`);
    const prazoDepois = await prazoDaSessao();
    r.exigir(
      prazoDepois > prazoAntes,
      `o prazo da sessão ANDOU com o pedido de passe (${prazoAntes} \u2192 ${prazoDepois})`,
    );

    await r.registrar(p, "passe-conta-como-atividade", {
      titulo: "Ficar na missão conta como uso",
      mostra: "A última missão aberta, com o aparelho montado, logo depois de um pedido de passe.",
      prova:
        "A sessão do hub expira por INATIVIDADE, e até a ADR-96 só navegar no hub contava como uso. " +
        "Quem ficava dentro do aparelho perdia a sessão no meio da aula, sem nada na tela — e do " +
        "401 em diante nada do que a criança fizesse era gravado. Agora o pedido de passe renova o " +
        `cookie: o prazo andou de ${prazoAntes} para ${prazoDepois}.`,
      detalhe: `prazo +${Math.round(prazoDepois - prazoAntes)}s`,
    });

    // ══ a turma FECHADA (8B) — o mesmo ano, o outro estado ══════════════
    const daOitoB = conta("estudante", { turma: "8B" });
    const pb = await r.pagina("estudante-8b", { viewport: { width: 1280, height: 950 } });
    await r.entrar(pb, daOitoB.login);
    await pb.waitForURL((url) => url.pathname.includes("/estudante"), { timeout: 30_000 });

    const cartoesB = pb.locator("main ul > li");
    await cartoesB.first().waitFor({ timeout: 15_000 });
    const titulosB = (await cartoesB.allInnerTexts()).map((t) => t.split("\n")[0]);

    r.exigir(
      titulos.length === titulosB.length,
      `8A e 8B têm a MESMA grade (${titulos.length} missões nas duas) — o que muda é o estado`,
    );
    const bloqueados = await pb.locator('[data-estado="bloqueada"]').count();
    r.exigir(
      bloqueados === titulosB.length,
      `na 8B as ${titulosB.length} missões estão com CADEADO (${bloqueados} bloqueadas)`,
    );
    r.exigir(
      (await pb.locator("main ul > li a").count()) === 0,
      "nenhum cartão da 8B é clicável — link para 404 é pior que link nenhum",
    );

    await r.registrar(pb, "hub-com-cadeado", {
      titulo: "A mesma grade, na turma em que ninguém liberou",
      mostra: `A turma ${daOitoB.turma} — mesmo ano da anterior — com as duas missões em cadeado e "Ainda não abriu".`,
      prova:
        "É o problema que a sala de aula existe para resolver: 8A e 8B eram indistinguíveis, e " +
        "toda criança do 8º ano via as mesmas missões abertas. A missão bloqueada NÃO some da " +
        "tela — a grade do ano é a promessa do que vem depois, e uma lista que muda de tamanho " +
        "sozinha não deixa a criança entender que a próxima unidade existe.",
      detalhe: `${bloqueados} de ${titulosB.length} com cadeado`,
    });
  },
);
