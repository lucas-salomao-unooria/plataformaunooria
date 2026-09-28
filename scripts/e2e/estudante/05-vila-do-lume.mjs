import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/* Globais do JOGO, que só existem DENTRO da página (`public/jogo/`, ~10k linhas
   de JS clássico com estado compartilhado — a exceção de ADR das convenções).
   Elas aparecem em `evaluate()`, cujo corpo roda no navegador. A lista é
   explícita para que se veja de relance TUDO o que este roteiro alcança de
   dentro do jogo: se crescer sem motivo, é o shim (`window.VILA`) que deveria
   estar sendo usado. */
/* global state, zones, openDM, buildResults, gatilhoAtendido, construirPayloadSessao */

/**
 * A Vila do Lume (app-70): o jogo 3D em primeira pessoa dentro do iframe.
 *
 * Aqui o typecheck não cobre quase nada — o jogo é JavaScript clássico fora do
 * `tsc` (ADR-0001 da experiência), e as três coisas que podem quebrar são todas
 * de runtime e todas invisíveis num teste de unidade:
 *
 *   · a ORDEM de injeção dos 19 scripts — errada, o sintoma é `state is not
 *     defined` num arquivo aleatório, diferente a cada recarga;
 *   · o WebGL dentro do iframe — sem canvas, a tela fica preta e o jogo não
 *     avisa nada;
 *   · o `allow-pointer-lock` do sandbox — sem o token, o jogo monta, a intro
 *     aparece, a criança clica em ENTRAR NA VILA e a câmera não anda. Nada no
 *     console diz por quê.
 *
 * POINTER LOCK e o CHROME DO SISTEMA. Medido (2026-08-26), com página servida
 * por HTTP real:
 *
 *   |                                | Chromium do Playwright | Chrome do sistema |
 *   | topo, sem iframe               | WrongDocumentError     | OK                |
 *   | iframe SEM allow-pointer-lock  | SecurityError          | SecurityError     |
 *   | iframe COM allow-pointer-lock  | WrongDocumentError     | OK                |
 *
 * O Chromium do Playwright não concede o lock NEM no topo da página, então nele
 * o teste não distingue "o sandbox está errado" de "o navegador não faz isso".
 * Sem o Chrome instalado a suíte segue e AVISA que a checagem não valeu:
 * checagem que falha por limitação do ambiente e não diz isso é pior que
 * checagem nenhuma.
 */
const EXP = "app-70-vila-do-lume";

await suite(
  {
    slug: "estudante/05-vila-do-lume",
    papel: "estudante",
    titulo: "Vila do Lume — o jogo 3D",
    subtitulo: "WebGL no iframe, pointer lock, e a partida que a api grava sem gabarito",
    contexto:
      "Uma vila em primeira pessoa onde a criança recebe mensagens de desconhecidos enquanto " +
      "acende fogueiras. As mensagens são golpes de três níveis de sofisticação, e cada criança " +
      "recebe apenas UMA das três bolhas — o que ela vê não é o que o colega ao lado vê. " +
      "É o Ato 1 do Instanooria: o perfil medido aqui decide de que lado o feed nasce lá.",
    prova: [
      "Os 19 scripts do jogo injetam na ordem certa e o WebGL desenha dentro do iframe",
      "A identidade da sessão chega ao jogo — uma partida sem estudante não se atribui a ninguém",
      "O pointer lock é concedido, e perder o ponteiro tem caminho de volta",
      "Os cartões vêm da api SEM gabarito, e só a bolha desta criança viaja no fio",
      "O payload da partida não carrega texto livre nem classificação feita no cliente",
      "A api aceita o payload que o próprio jogo monta",
    ],
    comando: "node scripts/e2e/estudante/05-vila-do-lume.mjs",
    chromeDoSistema: true,
  },
  async (r) => {
    if (r.semChromeReal) {
      r.ressalva("Chrome do sistema ausente: o pointer lock NÃO foi verificado nesta execução");
    }

    const estudante = conta("estudante", { serie: "8EF" });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await r.entrar(p, estudante.login);
    await r.registrar(p, "hub-do-estudante", {
      titulo: "A Vila na lista de missões",
      mostra: "O cartão da Vila do Lume, marcado como transversal.",
      prova:
        "Ela não pertence a ano nenhum (`series: []` no manifesto) e vem PRIMEIRO na lista: é o " +
        "Ato 1, e encontrar o Ato 2 antes deixaria a criança sem o perfil que decide a largada.",
    });

    await p.goto(`${HUB}/exp/${EXP}`, { waitUntil: "domcontentloaded" });
    const aparelho = p.locator('iframe[title="experiencia"]');
    await aparelho.waitFor({ state: "attached", timeout: 20_000 });

    const sandbox = await aparelho.getAttribute("sandbox");
    r.exigir(
      (sandbox ?? "").includes("allow-pointer-lock"),
      `o manifesto pediu pointer-lock e o iframe concedeu (sandbox="${sandbox}")`,
    );

    const tela = p.frameLocator('iframe[title="experiencia"]');
    /* A tela inicial só monta depois do handshake do SDK e da injeção dos 19
       scripts: é a prova de que a ordem está certa e a identidade chegou. */
    await tela.locator(".hub-titulo").waitFor({ timeout: 40_000 });
    const canvas = tela.locator("#canvasHost canvas");
    await canvas.waitFor({ timeout: 20_000 });
    const dim = await canvas.evaluate((c) => `${c.width}×${c.height}`);
    r.exigir(!/^0×|×0$/.test(dim), `o canvas WebGL tem dimensão (${dim})`);
    await r.registrar(p, "jogo-bootou", {
      titulo: "O jogo boota dentro do iframe",
      mostra: "A tela inicial da Vila, com o canvas 3D já desenhando atrás.",
      prova:
        "Dezenove scripts clássicos injetados em ordem por um carregador. Ordem errada dá " +
        "`state is not defined` num arquivo diferente a cada recarga — e nada na tela explica.",
      detalhe: `canvas ${dim} · sandbox="${sandbox}"`,
    });

    // ── a intro, e o nome que veio da sessão ────────────────────────────
    await tela.locator("button", { hasText: "JOGAR" }).click();
    await tela.locator(".intro-nav").waitFor({ timeout: 10_000 });
    await r.registrar(p, "intro", {
      titulo: "A intro do Lume",
      mostra: "O primeiro dos nove cartões que apresentam a vila e a missão.",
      prova: "A ficção se instala antes do jogo — a criança não sabe que está sendo observada.",
    });

    await tela.locator("button", { hasText: "Pular a explicação" }).click();
    const nomeNaPedra = await tela.locator(".slot-escolhido").innerText();
    r.exigir(
      nomeNaPedra.trim().length > 0 && !nomeNaPedra.includes("—"),
      `a identidade da sessão chegou ao jogo (leu "${nomeNaPedra.trim()}")`,
    );
    await r.registrar(p, "identidade-no-jogo", {
      titulo: "O nome da criança, dentro do jogo",
      mostra: "O último cartão da intro, com o nome gravado na pedra.",
      prova:
        "Vazio aqui significaria que o handshake entregou o jogo sem estudante — e uma partida sem " +
        "estudante não pode ser atribuída a ninguém no relatório do professor.",
      detalhe: `nome no jogo: "${nomeNaPedra.trim()}"`,
    });

    // ── dentro da vila ──────────────────────────────────────────────────
    await tela.locator("button", { hasText: "ENTRAR NA VILA" }).click();
    await p.waitForTimeout(3000);
    const fogueiras = await tela.locator("#scoreStars").innerText();

    /* O FRAME DO JOGO, não a página: `f.url().includes(EXP)` casaria a página do
       hub também — a rota dela é `/exp/app-70-vila-do-lume` —, e a checagem
       leria o `document` errado. Filtro por `parentFrame()`. */
    const quadro = p.frames().find((f) => f.parentFrame() !== null);
    const preso = quadro ? await quadro.evaluate(() => document.pointerLockElement !== null) : false;
    if (!r.semChromeReal) {
      r.exigir(preso, "o pointer lock pegou dentro do iframe — a câmera vai girar");
    }
    await r.registrar(p, "dentro-da-vila", {
      titulo: "Dentro da vila",
      mostra: `A visão em primeira pessoa, com o HUD das fogueiras (${fogueiras}/8).`,
      prova:
        "O HUD só aparece com a partida rodando: é o sinal de que `startGame()` passou por " +
        "`initScene`/`animate` sem lançar.",
      detalhe: `${fogueiras}/8 fogueiras · pointer lock ${r.semChromeReal ? "não verificado" : preso ? "ok" : "NÃO pegou"}`,
    });

    // ── andar de verdade ────────────────────────────────────────────────
    const distancia = async () =>
      quadro ? await quadro.evaluate(() => Math.round(state.distanceWalked)) : -1;
    const antes = await distancia();
    await p.keyboard.down("KeyW");
    await p.waitForTimeout(1800);
    await p.keyboard.up("KeyW");
    const depois = await distancia();
    r.exigir(depois > antes, `a criança andou (${antes}m → ${depois}m): o loop do jogo roda`);
    await r.registrar(p, "andou-na-vila", {
      titulo: "A criança anda",
      mostra: "A câmera avançou pela vila.",
      prova:
        "Prova que o loop está RODANDO, não só montado. Um jogo montado e parado tem exatamente " +
        "a mesma aparência num print.",
      detalhe: `${antes}m → ${depois}m`,
    });

    /* PERDER E RETOMAR O PONTEIRO — o caminho que o porte quebrou.
       O `pointerlockchange` do `16-boot.js` estava dentro de um
       `window.addEventListener('load', ...)`. No repo de origem os `<script>`
       ficavam no fim do HTML e o `load` disparava depois deles; aqui o
       carregador injeta os scripts DEPOIS do handshake, quando o `load` já
       passou — o listener nunca era registrado. A consequência não parece um
       bug de listener: a criança perde o ponteiro (Esc, trocar de aba), a câmera
       congela, e o aviso "Clique pra voltar pro jogo" não aparece. */
    if (!r.semChromeReal && preso) {
      await quadro.evaluate(() => document.exitPointerLock());
      await p.waitForTimeout(1200); // o Chrome recusa novo lock por ~1s
      const aviso = await quadro.evaluate(
        () => getComputedStyle(document.getElementById("pausedHint")).display,
      );
      r.exigir(aviso === "flex", `perder o ponteiro mostra o caminho de volta (display=${aviso})`);
      await tela.locator("#pausedHint").click();
      await p.waitForTimeout(600);
      const voltou = await quadro.evaluate(() => document.pointerLockElement !== null);
      r.exigir(voltou, "clicar no aviso devolve o ponteiro");
      await r.registrar(p, "pausa-e-volta", {
        titulo: "Perder e retomar o ponteiro",
        mostra: "O aviso de 'clique pra voltar pro jogo' sobre a cena congelada.",
        prova:
          "É o ÚNICO `controls.lock()` fora dos diálogos. Sem ele, a criança que apertou Esc fica " +
          "com a partida sem caminho de volta.",
        detalhe: `aviso=${aviso} · ponteiro de volta: ${voltou}`,
      });
    }

    // ── a partida veio da api, e sem gabarito ───────────────────────────
    const ponte = await quadro.evaluate(() => ({
      bolha: window.VILA?.bolha ?? null,
      quantos: window.VILA?.cartoes?.length ?? 0,
      fio: JSON.stringify(window.VILA?.cartoes ?? []),
    }));
    r.exigir(["A", "B", "C"].includes(ponte.bolha), `a bolha desta criança veio da api (${ponte.bolha})`);
    r.exigir(ponte.quantos === 4, `${ponte.quantos} cartões servidos (esperado 4)`);
    r.exigir(
      !/legitima|"aceita"|"nivel"/.test(ponte.fio),
      "o GABARITO não está no fio — o cliente não sabe qual mensagem é golpe",
    );
    /* Conta BOLHAS DISTINTAS, não ocorrências: "Suporte da Vila" aparece quatro
       vezes dentro do MESMO cartão da bolha B (a `tag` e o `name` das três
       batidas), e exigir exatamente uma ocorrência acusava vazamento numa
       partida perfeitamente correta. */
    const MARCAS = { A: "jogador 1000", B: "Suporte da Vila", C: "sentei atrás de ti" };
    const bolhasNoFio = Object.entries(MARCAS)
      .filter(([, marca]) => ponte.fio.includes(marca))
      .map(([bolha]) => bolha);
    r.exigir(
      bolhasNoFio.length === 1 && bolhasNoFio[0] === ponte.bolha,
      `só a bolha ${ponte.bolha} viajou no fio (achadas: ${bolhasNoFio.join(", ") || "nenhuma"})`,
    );

    // ── a mensagem: renderiza e vira registro ───────────────────────────
    /* O gatilho `inicio` só abre 20 s depois de entrar na vila, e esperar isso
       não prova nada a mais: o que precisa ser provado é que um cartão que veio
       do servidor, sem gabarito, atravessa `openDM` → opções → `pickDM` e vira
       registro. Abrimos o primeiro pelas funções do próprio jogo. */
    await quadro.evaluate(() => openDM(window.VILA.cartoes[0]));
    await tela.locator("#dmReplies .dm-reply-btn").first().waitFor({ timeout: 15_000 });
    const opcoes = await tela.locator("#dmReplies .dm-reply-btn").count();
    const remetente = await tela.locator("#dmCard .dm-name").innerText();
    r.exigir(opcoes === 3, `a mensagem oferece três respostas (${opcoes})`);
    await r.registrar(p, "mensagem-recebida", {
      titulo: "Uma mensagem de desconhecido",
      mostra: `A mensagem de "${remetente}", com três respostas possíveis.`,
      prova:
        "Ela veio da api já sanitizada. O cliente não recebe se é golpe nem de que nível — o " +
        "julgamento é do servidor, depois da partida.",
      detalhe: `${remetente} · ${opcoes} opções`,
    });

    await p.keyboard.press("Digit2"); // "Ignorar", em todos os cartões
    await p.waitForTimeout(1600);
    const registro = await quadro.evaluate(() => {
      const c = state.dmCartoes[state.dmCartoes.length - 1];
      return {
        id: c.id,
        escolha: c.escolha,
        temGabarito: "legitima" in c || "nivel" in c || "aceitou" in c,
        decisaoMs: c.decisaoMs,
        /* `aposCartao:N` conta cartões resolvidos — era `aposGolpe`, que dizia
           ao cliente qual era o golpe. */
        destravou: gatilhoAtendido("aposCartao:1"),
      };
    });
    r.exigir(registro.escolha === 2, `a escolha foi registrada (opção ${registro.escolha})`);
    r.exigir(!registro.temGabarito, "o registro não carrega gabarito (legitima/nivel/aceitou)");
    r.exigir(typeof registro.decisaoMs === "number", `o tempo de decisão foi medido (${registro.decisaoMs}ms)`);
    r.exigir(registro.destravou, "o gatilho do próximo cartão destravou");
    await r.registrar(p, "mensagem-respondida", {
      titulo: "A resposta vira dado",
      mostra: "A conversa depois da escolha.",
      prova:
        "O que se grava é O QUE ELA FEZ e EM QUANTO TEMPO. A leitura — se aquilo era golpe e de " +
        "que nível — é do servidor, e só o professor a vê.",
      detalhe: `${registro.id} → opção ${registro.escolha} em ${registro.decisaoMs}ms`,
    });

    // ── a costura com a api ─────────────────────────────────────────────
    /* Acender as 8 fogueiras leva 15–25 minutos e não é o que este roteiro
       testa. O que ele testa é a COSTURA: que o payload montado pelo
       `construirPayloadSessao` do jogo passa pelo zod da api e vira linha no
       banco. Forçamos o fim pelas funções do próprio jogo, sem inventar payload. */
    const medida = await quadro.evaluate(() => {
      state.visited = zones.map((z) => z.id);
      const payload = construirPayloadSessao();
      return {
        bytes: JSON.stringify(payload).length,
        eventos: payload.eventos.length,
        status: payload.status,
        temTexto: payload.eventos.some((e) => e.dados && "texto" in e.dados),
        temGabarito: /legitima|"nivel"|aceitou|"bolha"|seguras|"risco"/.test(JSON.stringify(payload)),
      };
    });
    r.exigir(medida.status === "completa", `o payload fecha como partida completa (${medida.status})`);
    r.exigir(!medida.temTexto, "nenhum evento carrega `dados.texto` — não há canal de texto livre");
    r.exigir(!medida.temGabarito, "nenhum evento carrega classificação feita no cliente");

    const gravacao = p.waitForResponse(
      (resp) => /\/vila\/sessoes\/.*\/concluir/.test(resp.url()) && resp.request().method() === "POST",
      { timeout: 60_000 },
    );
    await quadro.evaluate(() => buildResults());
    const respostaDaGravacao = await gravacao;
    r.exigir(
      respostaDaGravacao.ok(),
      `a api aceitou o payload do jogo (POST .../concluir → ${respostaDaGravacao.status()})`,
    );
    await p.waitForTimeout(2500);
    await r.registrar(p, "partida-gravada", {
      titulo: "A partida vira linha no banco",
      mostra: "A tela de fim de partida.",
      prova:
        "O payload que o JOGO monta passa pelo Zod da api sem tradução no meio. É o contrato entre " +
        "10 mil linhas de JS clássico e o resto da plataforma.",
      detalhe: `${medida.bytes} bytes · ${medida.eventos} eventos`,
    });
  },
);
