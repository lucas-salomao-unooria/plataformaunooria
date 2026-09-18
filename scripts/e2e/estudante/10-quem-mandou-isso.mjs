import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";

/**
 * Quem mandou isso? (exp-05), nas duas pontas da sala.
 *
 * A missão prova quatro coisas, e cada uma é uma regra que o software instala:
 *
 * 1. **A missão NASCE VAZIA.** Sem o clique da professora em "Aprovar e
 *    publicar" não há grupo: o estudante entra e vê uma tela de espera. Por
 *    isso o roteiro prepara o lote ANTES de abrir a tela da criança — e é a
 *    curadoria docente que o PRD exige (RF-001).
 * 2. **O gabarito não desce ao cliente.** O lote que a api entrega ao estudante
 *    não tem `veracidade`, `tom` nem `explicacao`, e a suíte lê o JSON cru para
 *    afirmar isso. Ele cruza a fronteira UMA vez, dentro de `revelacao`, depois
 *    de a professora acender o telão (regra inviolável nº 3).
 * 3. **As duas portas do Mural são coisas diferentes.** Fechar com menos de 3
 *    mensagens é 409 `piso-nao-atingido`; fechar sem ter rolado até a 8ª é 409
 *    `leitura-incompleta`. São dois códigos porque são duas frases, e a criança
 *    precisa saber o que falta — não que "não pode".
 * 4. **A sala anda junta por POLLING HTTP de 5 s, nunca por WebSocket**
 *    (ADR-93). O roteiro aperta os dois botões da professora e espera o efeito
 *    aparecer na tela do estudante SEM recarregar: é o único jeito de provar
 *    que as trinta telas viram o telão no mesmo minuto.
 *
 * A casca do mensageiro roda na seção `whatsappmobile` do design system, em
 * tema escuro (o pacote não publica outro). A abertura de Nina, a pergunta do
 * tio e o fechamento falam pela escola — a fronteira é QUEM FALA, e aqui ela
 * cai mais tarde que na exp-06: o Mural revelado ainda é o app, porque
 * mensageiro real tem etiqueta de checagem.
 */
const SERIE = "5EF";
/* A turma vem do CSV do seed, não fixada aqui: o seed já renomeou turma uma
   vez, e um roteiro que fixa o nome falha com "timeout esperando option" — um
   sintoma que não aponta para a causa. */
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;

/** O assunto que a professora digita no preparo. De 10 a 60 caracteres (Zod). */
const TEMA_DA_AULA = "Mudança no intervalo e na fila da cantina";
/* O DS não liga `<label>` a `<input>` (sem `htmlFor`/`id`), então `getByLabel`
   não acha campo nenhum nesta tela. O `placeholder` é o que o componente
   repassa ao `<input>` — e é o único gancho estável dos dois campos do preparo. */
const PLACEHOLDER_DO_TEMA = "ex.: Mudança nas regras do intervalo e da cantina";

/**
 * Os três balões que a criança manda ao Mural, por POSIÇÃO no feed.
 *
 * `msg-1` (comunicado da coordenação), `msg-2` (o boato em CAIXA ALTA) e
 * `msg-4` (a foto do mural da secretaria) — texto, texto e imagem. O áudio
 * (`msg-3`) e o link (`msg-5`) ficam FORA de propósito: os dois têm botão
 * próprio dentro do balão, e um clique de seleção no meio deles acionaria o
 * player ou fecharia a transcrição em vez de marcar a mensagem.
 */
const A_ENCAMINHAR = [0, 1, 3];

/** A resposta ao dilema do tio. Sem nenhuma palavra que a régua do fim proíbe. */
const RESPOSTA_AO_TIO =
  "Eu não encaminho na hora. Pergunto pro meu tio de onde ele tirou isso e procuro no site da prefeitura antes de passar pra frente.";

await suite(
  {
    slug: "estudante/10-quem-mandou-isso",
    papel: "estudante",
    titulo: "Quem mandou isso? — o grupo da turma e o mural da escola",
    subtitulo: "a curadoria sem aviso, o envio irreversível e o telão da sala",
    contexto:
      "O grupo da Turma 5ºB recebe oito mensagens em dez minutos sobre uma mudança na escola: o " +
      "comunicado da coordenação, um boato em caixa alta, o áudio de um colega que ouviu no " +
      "corredor, a foto do mural, uma notícia de 2022. A criança encaminha para o Mural da Turma " +
      "o que julga importante, confirma — e só então a professora acende o telão com o que a " +
      "sala inteira escolheu, e com o que era verdade.",
    prova: [
      "A missão NASCE VAZIA: sem o clique da professora em Aprovar e publicar não há grupo",
      "O lote que desce ao cliente não tem veracidade, tom nem explicação — o gabarito fica no servidor",
      "Fechar o Mural com menos de 3 mensagens é recusado; sem ter rolado até a 8ª, também, com OUTRO código",
      "Confirmar é latch: a tela vira espera ativa e o Mural não muda mais",
      "A revelação chega à tela do estudante por polling HTTP de 5 s, sem WebSocket e sem F5",
      "O telão é anônimo por construção: nenhum dos nomes da turma aparece nele",
      "Só depois do telão o gabarito cruza a fronteira — e o boato em CAIXA ALTA volta marcado como falso",
      "No Mural o remetente SOME: a autoria se perde no primeiro repasse, e é o título da missão",
      "A folha da turma não tem coluna de pontos, nota nem taxa de acerto",
    ],
    comando: "node scripts/e2e/estudante/10-quem-mandou-isso.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { serie: SERIE });

    /**
     * Aperta um botão do painel da aula e ESPERA o efeito na tela dela.
     *
     * Duas coisas juntas, e nenhuma é opcional:
     *
     * - **espera a hidratação, e espera a de VERDADE.** Depois de um `reload`,
     *   o botão do SSR já está no DOM mas o React ainda não ligou o `onClick`.
     *   Um `click` ali é aceito pelo Playwright e não faz NADA — e o roteiro só
     *   descobre 40 s depois, no estudante, com "não achei a fita": um sintoma
     *   que não aponta para a causa.
     *
     *   O portão pergunta pela CHAVE `__react*` que o React pendura no nó ao
     *   ligar os handlers, e é a única pergunta que testemunha sobre isso. A
     *   versão anterior esperava o botão perder o `disabled` — e o HTML do SSR
     *   nasce SEM o atributo, então a condição já era verdadeira antes de o
     *   bundle existir. Restava um `waitForTimeout` de 600 ms, que é espera
     *   cega: passa na máquina rápida, reprova no runner carregado, e em nenhum
     *   dos dois casos o motivo aparece.
     * - **confere que a etapa mudou** — e confere no `<p>`, NÃO em
     *   `[data-etapa]` solto. Neste painel o atributo tem DOIS sentidos: no
     *   parágrafo "Agora:" ele é a etapa em que a turma ESTÁ, e em cada botão é
     *   a etapa para onde aquele botão LEVA. `[data-etapa="revelacao"]` casa
     *   sempre, porque o botão existe desde o carregamento — a espera passaria
     *   no mesmo instante e não provaria nada. `p[data-etapa=…]` é o único dos
     *   dois que testemunha sobre o estado da sala.
     */
    const apertar = async (pagina, acao, etapaEsperada) => {
      const botao = pagina.locator(`[data-gate="${acao}"]`);
      await botao.waitFor({ timeout: 20_000 });
      await pagina.waitForFunction(
        (sel) => {
          const b = document.querySelector(sel);
          if (!b || b.hasAttribute("disabled")) return false;
          /* A marca que o React deixa no nó quando LIGA os handlers. Sem ela o
             clique cai no vazio, e o `disabled` sozinho não a substitui: o SSR
             entrega o botão sem o atributo, então ele já estaria "habilitado"
             antes de o bundle chegar. */
          return Object.keys(b).some((k) => k.startsWith("__react"));
        },
        `[data-gate="${acao}"]`,
        { timeout: 20_000 },
      );
      await botao.click();
      await pagina.waitForSelector(`p[data-etapa="${etapaEsperada}"]`, { timeout: 20_000 });
    };

    /**
     * Uma chamada à api pelo BFF do hub, com a sessão do navegador.
     *
     * É por aqui que o roteiro lê o JSON CRU — o que a criança recebe de fato,
     * e não o que a tela escolheu mostrar. Nenhuma prova de segredo de servidor
     * pode sair de um seletor: a ausência na tela é consequência, o que importa
     * é a ausência no corpo da resposta.
     */
    const naApi = (pagina, caminho, init) =>
      pagina.evaluate(
        async ([rota, opcoes]) => {
          const resposta = await fetch(`/api/plataforma${rota}`, opcoes ?? undefined);
          return { status: resposta.status, corpo: await resposta.json().catch(() => ({})) };
        },
        [caminho, init ?? null],
      );

    /**
     * O toque longo do aplicativo: 400 ms com o dedo parado no balão.
     *
     * `click()` do Playwright é `pointerdown` + `pointerup` no mesmo instante —
     * o timer de `usePressaoLonga` é cancelado e a seleção nunca abre. E o
     * gesto precisa ser o real: um roteiro que selecionasse por teclado passaria
     * com os handlers de ponteiro quebrados, que é o caminho que trinta tablets
     * de escola usam.
     *
     * `hover()` antes do `mouse.down()` porque ele rola o balão até um ponto
     * CLICÁVEL e deixa o ponteiro lá: com `boundingBox()` em balão alto, o
     * centro calculado pode cair fora da janela do aparelho.
     */
    const toqueLongo = async (pagina, alvo) => {
      await alvo.hover();
      await pagina.mouse.down();
      /* Espera de RITMO, não de carregamento: do outro lado há um `setTimeout`
         de 400 ms, não uma requisição, então ela não tem contra o que correr.
         A rede que protege é a conferência da barra de seleção, logo abaixo. */
      await pagina.waitForTimeout(900);
      await pagina.mouse.up();
    };

    // ═══ PROFESSORA: a ficha, o preparo do grupo e os dois botões ══════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, conta("professor", { serie: SERIE }).login);

    await prof.goto(`${HUB}/professor/entre-redes/5-ano/unidade-1`, {
      waitUntil: "domcontentloaded",
    });
    await prof.waitForSelector("text=/nasce vazia/i", { timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do professor",
      mostra:
        "A missão explicada para quem vai conduzir: os atos, a faixa de aviso de que a missão só " +
        "abre depois da aprovação do lote, e o que o software não conta ao estudante.",
      prova:
        "A professora precisa saber ANTES que esta missão nasce vazia. Descobrir isso com trinta " +
        "crianças de 10 anos diante de uma tela de espera é o pior jeito, e é o chamado de " +
        "suporte que a faixa existe para evitar.",
    });

    await prof.click("text=Abrir a aula e os resultados");
    await prof.waitForURL("**/resultados**", { timeout: 20_000 });
    /* `select#turma`, NÃO o primeiro `<select>`: quem tem mais de uma lotação
       ganhou um seletor de ESCOLA no cabeçalho, que vem antes no DOM. */
    const seletor = prof.locator("select#turma");
    await seletor.waitFor({ timeout: 15_000 });
    const opcoes = await seletor
      .locator("option")
      .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
    const alvo = opcoes.find((o) => o.label.includes(TURMA) && o.value);
    if (!alvo) throw new Error(`turma ${TURMA} não está no seletor (rode o seed)`);
    const turmaId = alvo.value;
    await prof.selectOption("select#turma", turmaId);
    await prof.waitForURL("**turmaId=**", { timeout: 20_000 });
    await prof.waitForSelector("text=Preparação da missão", { timeout: 20_000 });

    /* ZERAR PRIMEIRO: o estado é server-side e sobrevive ao roteiro. Sem isto a
       segunda execução encontra o estudante já confirmado, e o roteiro passa
       por cima das duas portas que ele existe para provar. O lote aprovado NÃO
       vai junto — é curadoria da professora, não execução de estudante. */
    if (await prof.locator("[data-zerar-turma]").count()) {
      await prof.click("[data-zerar-turma]");
      /* A janela é React puro: sem ela na tela, o clique acima caiu no HTML do
         SSR antes de a hidratação ligar o `onClick` — e o roteiro seguiria sem
         ter zerado nada, para falhar 3 minutos depois no lugar errado. */
      await prof
        .locator(`text=Zerar ${TURMA}?`)
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => {
          throw new Error(
            "o botão de zerar não abriu a janela de confirmação: a página ainda não estava " +
              "hidratada quando o roteiro clicou",
          );
        });
      await prof.getByRole("button", { name: /^Zerar a turma$/ }).last().click();
      /* A janela só fecha quando o DELETE volta ok — esperar o desaparecimento
         dela é esperar o DESFECHO, não o relógio. */
      await prof.locator(`text=Zerar ${TURMA}?`).first().waitFor({
        state: "detached",
        timeout: 30_000,
      });
    }
    /* E a aula volta para a exploração: zerar já devolve o gate, mas conferir é
       barato — se a rodada anterior tivesse deixado o telão aceso, o estudante
       nem chegaria a encaminhar, e a metade mais importante do roteiro passaria
       por vazio. */
    await apertar(prof, "voltar-exploracao", "exploracao");

    // ─── E0-PROF-01: a curadoria humana, sem passar pela IA ────────────────
    /* A suíte NÃO aperta "Gerar lote de mensagens com IA": uma corrida que
       depende do Vertex estar de pé reprova por vendor e reporta como se o
       produto tivesse quebrado. O que ela exercita é o caminho que a professora
       usa quando não quer gerar nada — aprovar o banco curado da Unooria, que
       também é curadoria, porque passou pelos olhos dela. */
    const campoDoTema = prof.getByPlaceholder(PLACEHOLDER_DO_TEMA);
    await campoDoTema.waitFor({ timeout: 20_000 });
    /* PORTÃO DE HIDRATAÇÃO, e ele é do React, não do relógio: com menos de 10
       caracteres no tema o botão de gerar fica desabilitado, e esse atributo só
       muda se o `onChange` tiver chegado ao componente. Sem este portão o
       `fill` põe texto no input sem mover o estado, e a homologação seguinte
       enviaria o tema ANTIGO — com o campo mostrando o novo na foto. */
    const geradorDesabilitado = (esperado) =>
      prof.waitForFunction(
        (queroDesabilitado) =>
          document.querySelector('[data-acao="gerar-lote"]')?.hasAttribute("disabled") ===
          queroDesabilitado,
        esperado,
        { timeout: 20_000 },
      );
    await campoDoTema.fill("x");
    await geradorDesabilitado(true).catch(() => {
      throw new Error(
        "o campo do tema não moveu o estado do React: a página ainda não estava hidratada, e " +
          "publicar daqui mandaria à turma um lote com o tema ANTIGO — com o campo mostrando o " +
          "novo na foto",
      );
    });
    await campoDoTema.fill(TEMA_DA_AULA);
    await geradorDesabilitado(false);

    /* O gatilho que combina com o lote curado: as três mensagens falsas dele
       são alarmistas/urgentes. O clique é no `<label>` — o `<input>` do
       `RadioButton` é o alvo escondido do componente. */
    await prof.locator("label.unooria-radio", { hasText: "Urgência" }).first().click();

    await prof.locator('[data-acao="aprovar-lote"]').click();
    /* A frase que se espera é a do AVISO pós-clique, não "lote publicado": o
       seletor `text=` casa sem olhar maiúscula, e o parágrafo de estado da
       turma já diz "Esta turma já tem lote publicado" quando a rodada anterior
       homologou. Esperar por ele passaria no mesmo instante, numa segunda
       execução, sem que clique nenhum tivesse funcionado. */
    await esperarOuFalharCedo(
      prof.locator("text=A turma já pode entrar no grupo"),
      prof.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "publicar o lote da turma" },
    );

    const publicado = await naApi(prof, `/quem-mandou-isso/turmas/${turmaId}/painel`);
    r.exigir(
      publicado.corpo?.turma?.preparada === true,
      `o clique em "Aprovar e publicar" é o que abre a missão para a turma (a api diz preparada=${String(publicado.corpo?.turma?.preparada)})`,
    );
    await r.registrar(prof, "preparo-publicado", {
      titulo: "A curadoria humana, e o portão do RF-001",
      mostra:
        "O assunto que circula na escola, o gatilho emocional e as 8 mensagens editáveis — com o " +
        "aviso de que nada gerado por inteligência artificial chega aos estudantes sem aprovação.",
      prova:
        "Esta missão NASCE VAZIA: não há lote de reserva assumindo sozinho. Sem este clique o " +
        "estudante entra e vê uma tela de espera — a aprovação não é revisão, é a porta.",
    });

    await prof.locator('[data-gate="iniciar-revelacao"]').scrollIntoViewIfNeeded();
    await r.registrar(prof, "painel-da-aula", {
      titulo: "Os dois botões que movem a sala, e o inverso deles",
      mostra:
        "Iniciar revelação coletiva, Liberar reflexão final e Voltar para a exploração, cada um " +
        "com o que faz escrito embaixo.",
      prova:
        "São dois momentos coletivos e não um: a revelação FECHA o Mural de todo mundo, e a " +
        "reflexão vem depois do debate, que acontece fora da tela. O inverso existe para o " +
        "clique errado às 7h50 — e ele não apaga nada.",
    });

    // ═══ ESTUDANTE: a abertura e o grupo ══════════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login);

    await p.goto(`${HUB}/exp/exp-05-quem-mandou-isso`, { waitUntil: "domcontentloaded" });
    let q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/Entrar no grupo/i").waitFor({ timeout: 40_000 });
    await r.registrar(p, "abertura-da-missao", {
      titulo: "O pedido da direção",
      mostra:
        "Nina explica a tarefa: ler o que chegou no grupo da turma e encaminhar para o Mural da " +
        "Turma só o que for importante de verdade. E o card com 8 mensagens novas.",
      prova:
        "Em nenhum lugar se diz que a aula é sobre mentira na internet. É esse silêncio que faz a " +
        "missão medir o comportamento espontâneo — anunciar o tema o substituiria pelo " +
        "comportamento que a criança acha que a professora espera.",
    });

    await q.getByRole("button", { name: /Entrar no grupo/i }).click();
    await esperarOuFalharPorHttp(p, q.locator(".feed__balao").first(), /quem-mandou-isso\/entrar/, {
      oQue: "entrar no grupo da turma",
      timeout: 40_000,
    });

    const quantosBaloes = await q.locator(".feed__balao").count();
    r.exigir(quantosBaloes === 8, `o grupo abre com as 8 mensagens do lote (${quantosBaloes} no DOM)`);
    r.exigir(
      (await q.locator(".tarja-de-admin").count()) === 1,
      "no lugar do teclado há a tarja de grupo só-administradores: não existe digitação livre nesta missão",
    );
    await r.registrar(p, "feed-do-grupo", {
      titulo: "Turma 5ºB, oito mensagens em dez minutos",
      mostra:
        "O comunicado da coordenação, o boato em caixa alta, o áudio do colega com a transcrição " +
        "aberta, a foto do mural, o link de 2022 — e, no rodapé, a tarja de só-administradores.",
      prova:
        "A tarja no lugar do teclado é guardrail, não limitação: campo aberto num clone de " +
        "mensageiro com crianças de 10 anos é a porta para conteúdo fora da faixa. E nenhuma " +
        "mensagem chega marcada como falsa.",
    });

    // ═══ O SEGREDO DE SERVIDOR: o gabarito não desce ══════════════════════
    const sessaoCrua = await naApi(p, "/quem-mandou-isso/sessao");
    const loteCru = JSON.stringify(sessaoCrua.corpo?.lote ?? null);
    const vazou = ["veracidade", "explicacao", "falsa"].filter((termo) => loteCru.includes(termo));
    r.exigir(
      vazou.length === 0,
      `o lote que chega ao cliente não carrega o gabarito (achei: ${vazou.join(", ") || "nada"})`,
    );
    r.exigir(
      sessaoCrua.corpo?.revelacao === null,
      "e `revelacao` é nula antes do telão: não há o que esconder no bundle porque não há o que baixar",
    );

    /**
     * O boato em CAIXA ALTA, achado pelo TEXTO e não pelo id.
     *
     * A paridade do molde fixa `msg-2` como a mensagem em maiúsculas, mas quem
     * a suíte precisa reencontrar depois da revelação é a que a criança viu
     * gritando na tela — e é o texto que grita, não o identificador. Se um dia
     * o molde mudar de posição, esta busca continua certa e a afirmação
     * continua sendo sobre a mesma coisa.
     */
    const mensagensPublicas = sessaoCrua.corpo?.lote?.mensagens ?? [];
    const boato = mensagensPublicas.find(
      (m) => typeof m.corpo === "string" && m.corpo.length > 20 && !/[a-zà-ÿ]/.test(m.corpo),
    );
    if (!boato) {
      throw new Error(
        "o lote publicado não tem nenhuma mensagem em CAIXA ALTA: o molde do lote mudou, e a " +
          "missão perdeu a mensagem que a turma inteira encaminha sem checar",
      );
    }

    // ═══ A PRIMEIRA PORTA: fechar o Mural sem ter escolhido nada ══════════
    /* Os 409 abaixo são o COMPORTAMENTO SENDO EXERCITADO, não um defeito: sem
       declará-los, a suíte que prova que as travas funcionam ficaria vermelha
       por causa delas — e vermelho que não significa nada é o começo do fim de
       um smoke. Os erros não somem do relatório: mudam de seção, com o motivo
       ao lado. */
    r.provocado(
      /quem-mandou-isso\/confirmar/,
      "a suíte tenta fechar o Mural sem nada dentro, e depois sem ter rolado o grupo: são as duas portas que a missão existe para instalar",
    );

    const semPiso = await naApi(p, "/quem-mandou-isso/confirmar", { method: "POST" });
    r.exigir(
      semPiso.status === 409 && semPiso.corpo?.codigo === "piso-nao-atingido",
      `fechar o Mural sem encaminhar nada é recusado (veio ${semPiso.status} ${semPiso.corpo?.codigo ?? ""})`,
    );

    // ═══ A CURADORIA: o áudio, o toque longo e a folha ════════════════════
    /* O play é ANTES de entrar em seleção: dentro dela, um clique no botão do
       player sobe para o balão e vira marcação da mensagem. O que ele grava é
       `midiasAbertas` — indicativo de leitura, nunca mérito: nada no produto
       depende dele. */
    await q.getByRole("button", { name: "Tocar áudio" }).first().click();
    await q.getByRole("button", { name: "Pausar áudio" }).first().waitFor({ timeout: 15_000 });

    const baloes = q.locator(".feed__balao");
    await toqueLongo(p, baloes.nth(A_ENCAMINHAR[0]));
    await q
      .locator(".barra-selecao")
      .waitFor({ timeout: 10_000 })
      .catch(() => {
        throw new Error(
          "o toque longo de 400 ms não abriu a barra de seleção: o gesto do aplicativo não " +
            "responde ao ponteiro, e sem ele a criança não tem como encaminhar nada",
        );
      });
    await r.registrar(p, "toque-longo", {
      titulo: "Tocar e segurar, como no aplicativo de verdade",
      mostra:
        "A barra contextual substituindo o cabeçalho: o X, o contador de selecionadas e a seta " +
        "de encaminhar.",
      prova:
        "O gesto é o do aplicativo real, com cancelamento no movimento e folga de 10 px para o " +
        "tremor de um dedo de criança — sem isso, rolar o feed viraria seleção acidental num " +
        "Mural que o latch não desfaz.",
    });

    for (const indice of A_ENCAMINHAR.slice(1)) await baloes.nth(indice).click();
    await q.locator("text=3 selecionadas").waitFor({ timeout: 10_000 });

    await q.getByRole("button", { name: "Encaminhar para..." }).click();
    await q.locator(".folha").waitFor({ timeout: 10_000 });
    await r.registrar(p, "folha-de-encaminhar", {
      titulo: "Encaminhar para…",
      mostra: "A folha inferior com UM destino: o Mural da Turma.",
      prova:
        "Um destino, e só um. O aplicativo real listaria conversas recentes; encher a folha de " +
        "destinos falsos daria à criança escolhas que não são da missão — a decisão que ela está " +
        "tomando é O QUE encaminhar, não para onde.",
    });

    await q.locator(".folha").getByRole("button", { name: /Mural da Turma/ }).click();
    await esperarOuFalharPorHttp(
      p,
      q.getByText(/Ver Mural da Turma \(3 selecionadas\)/),
      /quem-mandou-isso\/encaminhar/,
      { oQue: "encaminhar as três mensagens", timeout: 30_000 },
    );
    r.exigir(
      (await q.locator(".selo-encaminhada").count()) === 3,
      "as três mensagens ganham o selo Encaminhada no próprio feed, como no aplicativo real",
    );

    // ═══ A SEGUNDA PORTA: decidir sem ter lido o fim do grupo ═════════════
    const semRolagem = await naApi(p, "/quem-mandou-isso/confirmar", { method: "POST" });
    r.exigir(
      semRolagem.status === 409 && semRolagem.corpo?.codigo === "leitura-incompleta",
      `com o piso atingido mas sem ter rolado até a 8ª, a recusa muda de código (veio ${semRolagem.status} ${semRolagem.corpo?.codigo ?? ""})`,
    );

    /* E a recusa FALA na tela: a doutrina do repo é que alvo que não faz nada
       ensina a desconfiar do produto. O botão do Mural nunca fica mudo — aqui
       ele responde com o toast da rolagem, que é a outra metade do par de
       códigos da api. */
    await q.getByRole("button", { name: /Ver Mural da Turma/ }).click();
    await q
      .locator(".rodape__toast")
      .waitFor({ timeout: 10_000 })
      .catch(() => {
        throw new Error(
          "o botão do Mural não disse o que faltava: sem o aviso da rolagem ele vira um alvo " +
            "mudo, que é o que ensina a criança a desconfiar da tela",
        );
      });

    /**
     * A leitura integral é um `IntersectionObserver` na 8ª mensagem — então
     * quem a marca é a ROLAGEM, não uma chamada do roteiro.
     *
     * A espera corre contra o erro: o `waitForResponse` é armado ANTES do
     * scroll e o status vem na asserção. Marcar pela api atalharia o gesto e,
     * pior, deixaria o cliente sem saber — o `leuTudo` dele só muda quando a
     * resposta desta chamada chega, e o botão do Mural continuaria recusando.
     */
    const leituraIntegral = p.waitForResponse(
      (resposta) =>
        /quem-mandou-isso\/leitura-integral/.test(resposta.url()) &&
        resposta.request().method() === "POST",
      { timeout: 30_000 },
    );
    await baloes.nth(7).scrollIntoViewIfNeeded();
    const respostaDaLeitura = await leituraIntegral;
    r.exigir(
      respostaDaLeitura.status() === 200,
      `rolar até a última mensagem marca a leitura integral no servidor (HTTP ${respostaDaLeitura.status()})`,
    );

    await q.getByRole("button", { name: /Ver Mural da Turma/ }).click();
    await q
      .locator(".card-de-sistema__acoes")
      .waitFor({ timeout: 20_000 })
      .catch(() => {
        throw new Error(
          "o Mural não abriu depois da leitura integral: ou o piso de 3 não foi contado, ou a " +
            "marca da rolagem não chegou ao estado do cliente",
        );
      });

    r.exigir(
      (await q.locator(".feed__autor").count()) === 0,
      "no Mural o remetente SOME — o aplicativo real não carrega a autoria numa mensagem encaminhada, e essa perda é o título da missão",
    );
    const antesDeConfirmar = await naApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      (antesDeConfirmar.corpo?.midiasAbertas ?? []).length === 1,
      "tocar o áudio ficou registrado como mídia aberta — conduta que a professora lê, nunca acerto",
    );
    r.exigir(
      antesDeConfirmar.corpo?.totalEncaminhadas === 3 && antesDeConfirmar.corpo?.podeConfirmar === true,
      `com 3 encaminhadas E o grupo lido até o fim, o servidor libera a confirmação (podeConfirmar=${String(antesDeConfirmar.corpo?.podeConfirmar)})`,
    );
    await r.registrar(p, "mural-antes-de-confirmar", {
      titulo: "O último instante em que dá para voltar atrás",
      mostra:
        "As três mensagens escolhidas, sem o nome de quem as mandou, e o card de sistema com " +
        "Confirmar envio e Revisar seleção.",
      prova:
        "A curadoria é revisível ATÉ aqui: quem repassou no impulso e voltou atrás fez exatamente " +
        "o que a missão ensina. Depois do próximo toque, não.",
    });

    // ═══ O LATCH: confirmar, e esperar a turma ════════════════════════════
    await q.getByRole("button", { name: "Confirmar envio" }).click();
    await esperarOuFalharPorHttp(p, q.locator(".cabecalho-travado"), /quem-mandou-isso\/confirmar/, {
      oQue: "confirmar o envio ao Mural",
      timeout: 30_000,
    });
    await r.registrar(p, "espera-ativa", {
      titulo: "O Mural fechou, e a turma ainda não chegou",
      mostra:
        "O cadeado sobre o cabeçalho, os balões recuados para o fundo e a pergunta de releitura de " +
        "Nina: qual das suas mensagens você defenderia para a diretora, e qual detalhe prova isso.",
      prova:
        "A espera é ATIVA de propósito. É ela que faz as trinta telas chegarem juntas à revelação " +
        "— e a criança não fica olhando um relógio, fica relendo a própria escolha.",
    });

    const esperando = await naApi(p, "/quem-mandou-isso/sessao");
    /* Quem diz "ele está esperando" é o PASSO, não a bandeira `aguardandoATurma`
       — e a distinção é registrada em `regras/passos.ts`. Na espera depois do
       latch a bandeira é `false` de propósito: quem confirmou está EXATAMENTE no
       teto da etapa `exploracao`, e a bandeira responde outra pergunta ("a turma
       me puxou para trás?"). Afirmá-la aqui reprovaria a suíte por uma leitura
       errada do contrato, com o dedo apontado para o produto. */
    r.exigir(
      esperando.corpo?.passo === "espera" && esperando.corpo?.confirmou === true,
      `depois de confirmar, o servidor põe o estudante na espera da turma (passo=${esperando.corpo?.passo}, confirmou=${String(esperando.corpo?.confirmou)})`,
    );
    r.exigir(
      typeof esperando.corpo?.confirmadoEm === "string",
      "e carimba o instante da confirmação: é esta linha que entra no histograma da sala",
    );
    r.exigir(
      esperando.corpo?.revelacao === null,
      "e o gabarito continua do outro lado da fronteira: confirmar não revela nada",
    );

    // ═══ A PROFESSORA ACENDE O TELÃO ══════════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.locator("[data-histograma]").waitFor({ timeout: 25_000 });
    const telaoAntes = await prof.locator("[data-histograma]").innerText();
    r.exigir(
      !/FALSA|VERDADEIRA|AMBÍGUA/.test(telaoAntes),
      "ANTES do clique o telão não tem etiqueta de veracidade — é o que deixa a professora projetar desde o começo da aula",
    );

    await apertar(prof, "iniciar-revelacao", "revelacao");
    await prof.locator("[data-histograma]").scrollIntoViewIfNeeded();
    const telaoDepois = await prof.locator("[data-histograma]").innerText();
    r.exigir(
      /FALSA/.test(telaoDepois),
      "e DEPOIS dele as etiquetas aparecem: quem esconde é a etapa, não a rota (o dado sempre esteve aqui, porque esta rota é professor-only)",
    );

    const painelRevelado = await naApi(prof, `/quem-mandou-isso/turmas/${turmaId}/painel`);
    const nomesDaTurma = (painelRevelado.corpo?.estudantes ?? []).map((e) => e.nome);
    const nomeVazado = nomesDaTurma.find((nome) => nome && telaoDepois.includes(nome));
    r.exigir(
      nomesDaTurma.length > 0 && !nomeVazado,
      `nenhum dos ${nomesDaTurma.length} nomes da turma aparece no telão (achei "${nomeVazado ?? ""}")`,
    );
    r.exigir(
      painelRevelado.corpo?.resumo?.confirmaram >= 1,
      `a barra de prontidão conta quem confirmou (${painelRevelado.corpo?.resumo?.confirmaram}/${painelRevelado.corpo?.resumo?.total})`,
    );
    await r.registrar(prof, "telao", {
      titulo: "O telão: o que a turma encaminhou, e o que era verdade",
      mostra:
        "Uma barra por mensagem, com quantas pessoas a encaminharam e a etiqueta de veracidade ao " +
        "lado, mais a frase de síntese e o aviso de que as respostas foram compiladas anonimamente.",
      prova:
        "A anonimização é ESTRUTURAL, não disciplina: a função que monta este histograma não tem " +
        "parâmetro para nome. A folha nominal existe, mas é para a tela dela — não para a parede.",
    });

    // ═══ A REVELAÇÃO CHEGA SOZINHA À TELA DA CRIANÇA ══════════════════════
    /* O polling é de 5 s (ADR-93, não há WebSocket de aplicação no Cloud Run):
       a espera aqui tem de caber mais de um ciclo, senão a suíte reprova por
       ritmo e não por defeito. E ela é SEM reload: recarregar aqui provaria
       outra coisa, e esconderia justamente o defeito que deixa trinta crianças
       esperando um F5 que ninguém pediu. */
    await q
      .locator(".fita")
      .first()
      .waitFor({ timeout: 45_000 })
      .catch(() => {
        throw new Error(
          "a revelação não chegou sozinha à tela do estudante em 45 s: o polling do gate (5 s) " +
            "não está trocando a tela, e numa aula real a sala inteira ficaria esperando um F5",
        );
      });
    r.exigir(
      (await q.locator(".fita").count()) === 3,
      "as três mensagens do Mural ganham a fita de veracidade sem ninguém recarregar nada — a sala anda junta por polling HTTP de 5 s",
    );

    /* E o F5 no meio da aula: o estado é do SERVIDOR, e a tela tem de voltar
       exatamente onde estava. */
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator(".fita").first().waitFor({ timeout: 45_000 });

    const revelada = await naApi(p, "/quem-mandou-isso/sessao");
    const revelacao = revelada.corpo?.revelacao ?? null;
    r.exigir(
      revelacao !== null && (revelacao.mensagens ?? []).length === 8,
      `agora o gabarito cruza a fronteira, e só agora (${(revelacao?.mensagens ?? []).length} mensagens em revelacao)`,
    );
    const boatoRevelado = (revelacao?.mensagens ?? []).find((m) => m.id === boato.id);
    r.exigir(
      boatoRevelado?.veracidade === "falsa",
      `a mensagem em CAIXA ALTA (${boato.id}) volta marcada como falsa (veio "${boatoRevelado?.veracidade ?? "nada"}")`,
    );
    const metrica = await q.locator(".fita__metrica").first().innerText();
    r.exigir(
      /Encaminhada por \d+ de \d+ que confirmaram o Mural/.test(metrica),
      `o selo traz a métrica da SALA, nunca um veredito sobre a criança ("${metrica}")`,
    );
    await r.registrar(p, "mural-revelado", {
      titulo: "O Mural com os selos, depois do F5",
      mostra:
        "Cada mensagem encaminhada com a fita de veracidade — pictograma, rótulo por extenso, a " +
        "explicação e o quantos-de-quantos —, e o card de síntese da turma no fim.",
      prova:
        "O estado é do servidor: recarregar no meio da aula devolve a criança exatamente onde ela " +
        "estava. E as fitas se distinguem SEM cor, por forma e por palavra.",
    });

    // ═══ A PROFESSORA LIBERA A PERGUNTA DO TIO ═══════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await apertar(prof, "liberar-reflexao", "reflexao");

    const irParaAPergunta = q.getByRole("button", { name: "Responder a última pergunta" });
    await irParaAPergunta
      .waitFor({ timeout: 45_000 })
      .catch(() => {
        throw new Error(
          "o segundo botão da professora não chegou à tela do estudante em 45 s: 'Liberar " +
            "reflexão final' NÃO muda o passo efetivo de quem já está em `revelado`, então o " +
            "polling só percebe a mudança se comparar TAMBÉM a etapa da turma",
        );
      });
    await irParaAPergunta.click();
    await esperarOuFalharPorHttp(p, q.locator("textarea"), /quem-mandou-isso\/avancar/, {
      oQue: "abrir a pergunta do dilema",
      timeout: 30_000,
    });

    const telaDaPergunta = await q.locator(".escola__pilha").innerText();
    r.exigir(
      /tio/i.test(telaDaPergunta) && /encaminhar/i.test(telaDaPergunta),
      "a última pergunta sai do grupo da turma e vai para o grupo da FAMÍLIA — é a transferência para fora da tela que a missão existe para produzir",
    );
    await r.registrar(p, "dilema-do-tio", {
      titulo: "O áudio do tio, no grupo da família",
      mostra:
        "A pergunta de transferência e o campo de texto livre, com o contador de caracteres e o " +
        "mínimo à vista.",
      prova:
        "É o único texto livre da missão, e o dado mais sensível dela: caixa escrita por menor de " +
        "idade. Nenhuma rota de gestor o alcança — quem lê é o professor da turma dela.",
    });

    await q.locator("textarea").fill(RESPOSTA_AO_TIO);
    await q.getByRole("button", { name: "Concluir Missão" }).click();
    await esperarOuFalharPorHttp(p, q.getByText("Missão Concluída!"), /quem-mandou-isso\/reflexao/, {
      oQue: "entregar a resposta ao dilema",
      timeout: 30_000,
    });

    const telaFinal = await q.locator(".escola__pilha").innerText();
    r.exigir(
      telaFinal.includes("Pausa Digital"),
      "o episódio de recapitulação vem em TEXTO e DEPOIS da entrega — na tela da pergunta ele seria a resposta impressa acima do campo",
    );
    r.exigir(
      !/pontos|nota |score|acertou|acerto/i.test(telaFinal),
      "e não há nota, pontuação nem acerto em lugar nenhum do fechamento",
    );
    await r.registrar(p, "missao-concluida", {
      titulo: "Missão concluída",
      mostra:
        "A resposta gravada em modo leitura e o episódio da Pausa Digital, bloco a bloco, em texto.",
      prova:
        "A gravação do episódio não existe, e a transcrição não é remendo: é o conteúdo acessível " +
        "para a sala sem fone de ouvido. O registro é definitivo, e não há botão de editar.",
    });

    // ═══ A FOLHA DA TURMA ════════════════════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.waitForSelector("text=1º encaminhamento", { timeout: 25_000 });
    const cabecalhos = await prof.locator("table thead th").allTextContents();
    const proibido = cabecalhos.find((c) => /pontos|nota|score|acerto|taxa|ranking/i.test(c));
    r.exigir(
      !proibido,
      `a folha da turma não tem coluna de pontos, nota nem taxa de acerto (achei "${proibido ?? ""}")`,
    );

    const linhaDele = prof.locator(`[data-estudante="${estudante.login}"]`);
    const quantasLinhas = await linhaDele.count();
    r.exigir(
      quantasLinhas === 1,
      `a linha de ${estudante.login} está na folha da turma — é por ela que a professora chega na carteira`,
    );
    const oQueAFolhaDiz = quantasLinhas === 1 ? await linhaDele.innerText() : "";
    r.exigir(
      oQueAFolhaDiz.includes("Eu não encaminho na hora"),
      "e o texto que a criança escreveu aparece AQUI, e só aqui: caixa livre de menor, na rota do professor da turma dela (LGPD art. 14)",
    );
    r.exigir(
      /até o fim/.test(oQueAFolhaDiz),
      "a folha diz se a escolha foi feita com as oito mensagens à vista ou com as três primeiras — conduta, não mérito",
    );
    await linhaDele.scrollIntoViewIfNeeded();
    await r.registrar(prof, "folha-da-turma", {
      titulo: "O retrato da turma, sem placar",
      mostra:
        "Onde cada um está, quantas mensagens encaminhou, se leu o grupo inteiro, se ouviu o " +
        "áudio, quanto tempo levou até o primeiro encaminhamento e o que escreveu sobre o tio.",
      prova:
        "Não há coluna de acerto, e a ausência é deliberada: com o gabarito a um JOIN de " +
        "distância, \"quantas falsas cada um encaminhou\" é a coluna que se escreve sozinha — e " +
        "numa turma de 10 anos ela é o ranking de quem caiu no boato.",
    });
  },
);
