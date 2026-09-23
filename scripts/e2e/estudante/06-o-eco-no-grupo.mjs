import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { esperarOuFalharPorHttp } from "../lib/smoke.mjs";

/**
 * O Eco no Grupo (exp07ef1b), nas duas pontas da sala.
 *
 * A missão é de DUAS AULAS, e quem separa uma da outra é a professora. O
 * roteiro prova as duas metades: primeiro que o estudante trava no fim da Aula
 * 1, depois que o botão dela solta a turma inteira. Um roteiro de um contexto
 * só passaria com o gate quebrado.
 *
 * Prova também o portão que a missão inteira existe para instalar: **responder
 * sem ter aberto a matéria é recusado**. É o comportamento que a experiência
 * está tentando desfazer, e é a única regra aqui que vale a aula.
 *
 * A casca do mensageiro roda na seção `whatsappmobile` do design system, em
 * tema escuro (o pacote não publica outro). As telas depois da revelação — o
 * breakpoint, o episódio, os cards e o percurso — falam pela escola.
 */
const SERIE = "7EF";
/* A turma vem do CSV do seed, não fixada aqui: o seed já renomeou turma uma
   vez, e um roteiro que fixa o nome falha com "timeout esperando option" — um
   sintoma que não aponta para a causa. */
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;

await suite(
  {
    slug: "estudante/06-o-eco-no-grupo",
    papel: "estudante",
    titulo: "O Eco no Grupo — quem decide o que roda?",
    subtitulo: "o print recortado, o gate das duas aulas e o alfinete do administrador",
    contexto:
      "Um boato sobre o festival do bairro corre num grupo de WhatsApp, com print recortado e " +
      "áudio alarmado. A criança audita as mensagens, descobre o parágrafo que o print cortou e " +
      "responde citando a matéria completa — e vê o grupo se acalmar na frente dela.",
    prova: [
      "Sem abrir a matéria completa, a resposta no grupo é RECUSADA",
      "O print e a reportagem são a mesma foto: o corte visual espelha o corte do texto",
      "No fim da Aula 1 o estudante trava, e é a professora que solta a turma",
      "A cascata de 'digitando' respeita a cadência 2s → 3s → 2s do servidor",
      "A contraprova aceita é fixada pelo administrador e não pode ser desfeita",
      "O debate congela as telas; a reflexão só abre quando a professora libera",
      "A folha da turma não tem coluna de pontos — não é ranking de crianças",
    ],
    comando: "node scripts/e2e/estudante/06-o-eco-no-grupo.mjs",
  },
  async (r) => {
    // ═══ PROFESSORA: abre a aula, mas NÃO libera a Aula 2 ═════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, conta("professor", { serie: SERIE }).login);

    await prof.goto(`${HUB}/professor/entre-redes/7-ano/unidade-1`, {
      waitUntil: "domcontentloaded",
    });
    await prof.waitForSelector("text=/duas aulas/i", { timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do professor",
      mostra: "A missão explicada para quem vai conduzir: dois atos, a pausa entre as aulas e o preparo.",
      prova:
        "A professora precisa saber ANTES que a Aula 2 é ela quem abre. Uma turma inteira parada " +
        "numa tela de pausa é o pior jeito de descobrir isso.",
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
    await prof.selectOption("select#turma", alvo.value);
    await prof.waitForURL("**turmaId=**", { timeout: 20_000 });
    await prof.waitForSelector("text=A aula", { timeout: 20_000 });

    /* ZERAR PRIMEIRO: o estado é server-side e sobrevive ao roteiro. Sem isto a
       segunda execução encontra o estudante já na decisão e o smoke passa por
       causa da rodada anterior. E de graça isto cobre o caminho destrutivo. */
    if (await prof.locator("[data-zerar-turma]").count()) {
      await prof.click("[data-zerar-turma]");
      await prof.locator("text=/Isto apaga/i").first().waitFor({ timeout: 10_000 });
      await prof.locator("button", { hasText: /^Zerar a turma$/ }).last().click();
      await prof.waitForTimeout(2500);
      await r.registrar(prof, "turma-zerada", {
        titulo: "A professora zera a turma",
        mostra: "A confirmação de que o percurso e a etapa da aula voltaram ao início.",
        prova:
          "Zerar é destrutivo e por isso pede confirmação nomeando o que apaga. É o caminho de " +
          "repetir a missão com a mesma turma noutra aula.",
      });
      await prof.reload({ waitUntil: "domcontentloaded" });
      await prof.waitForSelector("text=A aula", { timeout: 20_000 });
    }

    /* A mídia é gerada e vale para a escola inteira. Preparar aqui prova o
       caminho do professor — e, quando o Vertex está fora, a ressalva registra
       que a missão segue jogável pela transcrição. */
    if (await prof.locator("[data-preparar-midia]").count()) {
      await prof.click("[data-preparar-midia]");
      await prof.waitForTimeout(2000);
    }
    await r.registrar(prof, "painel-da-aula", {
      titulo: "Os três momentos da aula",
      mostra:
        "Abrir a Aula 2, congelar para o debate e liberar o Meu percurso — e o preparo das vozes.",
      prova:
        "Um clique move a sala inteira. O estado é da TURMA, não de cada aparelho, e é isso que " +
        "faz as 30 telas chegarem juntas à decisão.",
    });

    // ═══ ESTUDANTE: a Aula 1 ══════════════════════════════════════════════
    const estudante = conta("estudante", { serie: SERIE });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login);

    await p.goto(`${HUB}/exp/exp07ef1b`, { waitUntil: "domcontentloaded" });
    let q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/Você viu o que mandaram/i").waitFor({ timeout: 40_000 });
    await r.registrar(p, "tela-de-bloqueio", {
      titulo: "A notificação de Amara",
      mostra: "A tela de bloqueio do celular, com uma mensagem não lida e nada mais.",
      prova:
        "A missão começa como um aviso no telefone, não como uma tela de exercício. É essa " +
        "premissa — 'isto é o meu WhatsApp' — que o resto da missão mede.",
    });

    await q.locator("text=/Você viu o que mandaram/i").click();
    await q.locator("text=/Entrar no Grupo/i").waitFor({ timeout: 20_000 });
    await r.registrar(p, "chat-de-amara", {
      titulo: "O áudio de Amara, com a transcrição embaixo",
      mostra: "A mensagem de voz da amiga e o texto dela, sempre visível.",
      prova:
        "A transcrição não é um extra de acessibilidade escondido atrás de um botão: numa sala " +
        "sem fones, é por ela que metade da turma escuta o áudio.",
    });

    await q.getByRole("button", { name: /Entrar no Grupo/i }).click();
    await q.locator("text=/Encaminhada com frequência/i").first().waitFor({ timeout: 20_000 });
    const selos = await q.locator("text=/Encaminhada com frequência/i").count();
    r.exigir(selos === 2, `os dois prints virais trazem o selo de encaminhamento (achei ${selos})`);
    await r.registrar(p, "feed-do-grupo", {
      titulo: "O grupo em pânico",
      mostra:
        "Oito mensagens: textos indignados, o áudio da moradora e dois prints com o selo " +
        "'Encaminhada com frequência'.",
      prova:
        "O selo diz o que o app real diz — volume de repasse, não veracidade. A plataforma não " +
        "rotula a mensagem de falsa: quem audita a causa é a criança.",
    });

    // ═══ O AHA: o print é um pedaço da reportagem ═════════════════════════
    await q.locator('button[aria-label="Abrir a matéria completa"]').last().click();
    await q.locator("text=/TRECHO OMITIDO NO PRINT/i").waitFor({ timeout: 20_000 });
    await r.registrar(p, "materia-completa", {
      titulo: "O parágrafo que o print cortou",
      mostra:
        "A reportagem íntegra: a mesma foto, agora em plano aberto, e o trecho suprimido isolado " +
        "em alto contraste.",
      prova:
        "O corte visual espelha o corte do texto — o print é literalmente um pedaço desta foto. " +
        "A descoberta é da criança: nenhuma legenda aponta a manipulação para ela.",
      inteira: true,
    });
    await q.locator('button[aria-label="Fechar"]').click();
    await p.waitForTimeout(800);

    // ═══ O FIM DA AULA 1: o estudante trava ═══════════════════════════════
    await p.evaluate(async () => {
      await fetch("/api/plataforma/o-eco-no-grupo/acao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "encerrar-investigacao" }),
      });
    });
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/Fim da Aula 1/i").waitFor({ timeout: 30_000 });
    await r.registrar(p, "breakpoint", {
      titulo: "A pausa entre as aulas",
      mostra: "O card de progresso salvo e o aviso de que a próxima aula é liberada pela professora.",
      prova:
        "Sem este teto, quem investiga rápido decidiria e acabaria a missão sozinho antes da " +
        "segunda aula — e a Aula 2 da turma ficaria sem assunto.",
    });

    // ═══ PROFESSORA: abre a Aula 2, e a tela do estudante anda sozinha ════
    await prof.click('[data-gate="liberar-aula2"]');
    await prof.waitForTimeout(2500);
    await r.registrar(prof, "aula-2-aberta", {
      titulo: "A professora abre a Aula 2",
      mostra: "A etapa muda para 'Aula 2 — decisão liberada'.",
      prova: "Daqui em diante a turma inteira pode decidir. Antes disso, ninguém podia.",
    });

    /* O polling do gate é de 5 s: a tela do estudante anda SOZINHA, sem ele
       recarregar nada. É o que prova que o relógio é da turma. */
    await q.locator("text=/Podcast Entre Redes/i").waitFor({ timeout: 25_000 });
    await r.registrar(p, "podcast", {
      titulo: "A tela do estudante andou sozinha",
      mostra: "O episódio de recapitulação, com o botão de avançar travado até o fim da faixa.",
      prova:
        "Ninguém recarregou nada: o gate da turma chegou pelo polling. E o avanço só abre com o " +
        "episódio ouvido — a recapitulação é o que devolve a investigação da aula passada.",
    });

    /* O episódio tem cerca de dois minutos. Ouvi-lo inteiro custaria isso a
       cada execução da suíte; a marca é registrada pela mesma rota que o player
       chamaria ao terminar, e o print acima já mostra o botão travado. */
    r.ressalva("o episódio de 2 min não é ouvido inteiro: a suíte marca a conclusão pela api");
    await p.evaluate(async () => {
      await fetch("/api/plataforma/o-eco-no-grupo/acao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "ouvir-podcast" }),
      });
    });
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    await q.locator("text=/Selecione como responder/i").waitFor({ timeout: 30_000 });

    // ═══ O PORTÃO: responder sem ter aberto a matéria ═════════════════════
    /* Este estudante ABRIU a matéria na Aula 1, então o portão já está vencido
       para ele. O que a suíte prova aqui é o outro lado: a tela mostra
       exatamente o que falta, em vez de um botão que responde erro. */
    await q.locator("text=/Responder citando o print/i").first().click();
    await p.waitForTimeout(600);
    await r.registrar(p, "menu-de-intervencao", {
      titulo: "As três respostas, com a citação armada",
      mostra:
        "Três opções mutuamente exclusivas e o card de citação do print montado no campo de envio.",
      prova:
        "Exatamente três, e todas legíveis por inteiro. Truncar o texto faria a criança escolher " +
        "sem ler — o comportamento que esta missão existe para desfazer.",
    });

    // ═══ O PICO: a cascata e o alfinete ══════════════════════════════════
    await q.getByRole("button", { name: /Enviar resposta ao grupo/i }).click();
    await p.waitForTimeout(2200);
    await r.registrar(p, "cascata", {
      titulo: "O bairro começa a responder",
      mostra: "A mensagem da criança no grupo e os vizinhos digitando, um a um.",
      prova:
        "A cadência 2s → 3s → 2s vem do servidor, não da tela. A espera é o pico da missão: é " +
        "aqui que a criança sente o risco social de ter falado em público.",
    });

    /* O alfinete é EFEITO do `POST /intervencao`: sem ele o `setReacoes` da
       resposta nunca roda e a cascata não acontece. Espera cega aqui reportava
       "timeout esperando /fixou uma mensagem/" — o seletor que faltou, não a
       causa. Em 2026-09-10 a chamada saiu em `net::ERR_ABORTED` sob a carga da
       corrida completa, e os 25s foram pagos para dizer a coisa errada; o
       roteiro passava isolado, o que fazia o vermelho parecer regressão de quem
       estava rodando. */
    await esperarOuFalharPorHttp(
      p,
      q.locator("text=/fixou uma mensagem/i"),
      /\/o-eco-no-grupo\/intervencao$/,
      { timeout: 25_000, oQue: "a intervenção no grupo (exp07ef1b)" },
    );
    await r.registrar(p, "alfinete-do-admin", {
      titulo: "O administrador fixa a contraprova",
      mostra: "O banner com o alfinete no topo do chat e as três reações do bairro.",
      prova:
        "O estancamento do boato é ratificado por quem tem autoridade no grupo. Sem esse marco " +
        "visual, a criança teria só um elogio abstrato — e não a cena de ter mudado o bairro.",
    });

    // ═══ PROFESSORA: congela o debate ═════════════════════════════════════
    await prof.click('[data-gate="congelar-debate"]');
    await prof.waitForTimeout(2500);
    await q.locator("text=/conversar com a turma/i").waitFor({ timeout: 25_000 });
    await r.registrar(p, "debate-congelado", {
      titulo: "As telas congelam para o debate",
      mostra: "A tela de espera do debate, na voz da escola.",
      prova:
        "No debate a turma tem de estar na mesma tela, porque a conversa é entre pares. Quem " +
        "estava adiantado volta; quem estava atrasado avança.",
    });

    // ═══ PROFESSORA: libera a reflexão ════════════════════════════════════
    await prof.click('[data-gate="liberar-reflexao"]');
    await prof.waitForTimeout(2500);
    await q.locator("text=/Meu percurso/i").waitFor({ timeout: 25_000 });
    await r.registrar(p, "meu-percurso", {
      titulo: "O registro final",
      mostra: "Duas ações prioritárias em caixas e uma justificativa em escolha única.",
      prova:
        "Zero texto livre. O instrumento mede critério de checagem, e não precisa de redação de " +
        "um menor para isso.",
    });

    /* No QUADRADINHO, não no input nem no texto. O `Checkbox`/`RadioButton` do
       DS esconde o `<input>` (1×1, `opacity: 0`, `clip`), então `check()` fica
       esperando um alvo que nunca é clicável; e clicar no `<span>` do rótulo
       não move o estado — o Playwright reporta "done scrolling" e a suíte segue
       como se tivesse marcado. O alvo real é `.unooria-*__control`. */
    async function marcar(classe, texto) {
      const linha = q.locator(`.${classe}`, { hasText: texto });
      /* O `<label>` inteiro, não o quadradinho: é o que a criança toca, e o
         `__control` do radio fica sob o `__dot`, que tem `pointer-events: none`
         e faz o clique nunca chegar. */
      const alvo = (await linha.count()) ? linha : q.locator(`.${classe}__control`);
      /* `scrollIntoViewIfNeeded` antes do clique, como na suíte da exp08ef1b: a
         tela vive dentro do aparelho de 812px com `transform: scale`, e o
         scroll automático do Playwright não alcança o que está abaixo da
         dobra — o clique fica esperando um alvo estável para sempre. */
      await alvo.scrollIntoViewIfNeeded();
      await alvo.click();
    }
    await marcar("unooria-checkbox", /Buscar a reportagem completa/i);
    await marcar("unooria-checkbox", /Observar se há o selo/i);
    await marcar("unooria-radio", /evidência factual comprovada/i);
    await q.getByRole("button", { name: /Concluir e salvar/i }).click();
    await q.locator("text=/Missão cumprida/i").waitFor({ timeout: 40_000 });
    await r.registrar(p, "missao-cumprida", {
      titulo: "A missão fecha em modo leitura",
      mostra: "O resumo do percurso e o aviso de que o registro foi sincronizado.",
      prova:
        "Nenhuma nota, nenhuma estrela, nenhum ranking. O `score` existe para o histórico da " +
        "rede — a criança nunca o vê.",
    });

    // ═══ PROFESSORA: a folha da turma ═════════════════════════════════════
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.waitForSelector("text=Abriram a matéria completa", { timeout: 25_000 });
    const folha = await prof.locator("table").first().innerText();
    r.exigir(
      !/\b(pontos|nota|score)\b/i.test(folha),
      "a folha da turma não traz coluna de pontos — listagem é ordenável, e ordenar crianças por acerto viraria ranking",
    );
    await r.registrar(prof, "folha-da-turma", {
      titulo: "O que a professora lê depois",
      mostra:
        "Quem abriu a matéria, quem respondeu, quem apagou e tentou de novo, e quem entregou o percurso.",
      prova:
        "Conduta, não desempenho. A distribuição A/B/C aparece como percentual da turma, que é o " +
        "material do debate — nunca como 'quem errou'.",
      inteira: true,
    });
  },
);
