import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * A Vila do Lume pelo lado do professor: ficha, guia do debate, resultados da
 * turma e o relatório de uma criança.
 *
 * Esta é a suíte mais carregada de regras NEGATIVAS do produto inteiro, e todas
 * são de tela — nenhuma delas tem teste de unidade possível:
 *
 *  · nenhum valor de Schwartz pode aparecer na LISTAGEM da turma. Listagem é
 *    ordenável, e uma coluna "Poder" viraria um ranking de crianças por valor;
 *  · na tela individual, os DEZ valores aparecem sempre — inclusive os que não
 *    deram número. Mostrar só os que deram faz a página parecer um retrato
 *    completo quando ela é um recorte;
 *  · partida ABANDONADA não gera retrato nenhum — a tela diz por quê, em vez de
 *    inventar números a partir de dois minutos de jogo. O relatório é sempre o
 *    da ÚLTIMA partida fechada, então este é um estado NORMAL da tela, não um
 *    defeito: o roteiro prova os dois ramos;
 *  · onde o grau não autoriza número, a linha DIZ POR QUÊ em vez de inventar;
 *  · a ressalva de que isto não é um teste psicológico vem ANTES de qualquer
 *    número — ela existe para ser lida antes, não depois;
 *  · a seção das mensagens abre pelo NÍVEL que a criança recebeu, não pelo que
 *    ela fez: quem caiu num golpe sofisticado não fez a mesma coisa que quem
 *    caiu num grosseiro.
 */
const TURMA = process.env.TURMA ?? "8A";

/** Os dez valores, em português. Nenhum deles pode vazar para a listagem. */
const VALORES = [
  "Autodireção", "Estimulação", "Hedonismo", "Realização", "Poder",
  "Segurança", "Conformidade", "Tradição", "Benevolência", "Universalismo",
];

await suite(
  {
    slug: "professor/05-vila-do-lume",
    papel: "professor",
    titulo: "A Vila pelo lado do professor",
    subtitulo: "ficha, guia da aula, resultados da turma e o relatório de uma criança",
    contexto:
      "Depois da partida, o professor tem três telas: a ficha (o que a missão faz), o guia do " +
      "debate (o que projetar e o que nunca perguntar) e os resultados. O que essas telas " +
      "escondem é tão desenhado quanto o que elas mostram.",
    prova: [
      "A ficha explica as três bolhas e avisa para não contar nada antes",
      "O guia cobre a aula inteira — preparo, roteiro, debate, mediação e avaliação",
      "O guia proíbe perguntar quem clicou, e manda dizer que não era um colega de verdade",
      "A listagem da turma não traz nenhum valor de Schwartz",
      "A tela individual traz os dez valores, e explica cada ausência de número",
      "A ressalva de que isto não é um teste vem antes dos números",
      "Partida abandonada não gera retrato — e a tela explica a ausência em vez de inventar",
    ],
    comando: "node scripts/e2e/professor/05-vila-do-lume.mjs",
  },
  async (r) => {
    const p = await r.pagina("professor", { viewport: { width: 1400, height: 1000 } });
    await r.entrar(p, conta("professor", { turma: TURMA }).login);

    // ── a ficha ─────────────────────────────────────────────────────────
    await p.goto(`${HUB}/professor/entre-redes/vila-do-lume`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    const ficha = await p.locator("main").innerText();
    for (const trecho of ["golpe grosseiro", "autoridade e urgência", "o colega, e o momento exato"]) {
      r.exigir(ficha.includes(trecho), `a ficha explica a bolha "${trecho}"`);
    }
    r.exigir(/Não conte nada antes/.test(ficha), "a ficha avisa para não contar nada antes da partida");
    r.exigir(/Vale para qualquer ano/.test(ficha), "a ficha diz que a missão vale para qualquer ano");
    r.exigir(/Instanooria/.test(ficha), "a ficha diz qual missão consome o perfil medido aqui");
    await r.registrar(p, "ficha-da-missao", {
      titulo: "A ficha da missão",
      mostra: "As três bolhas explicadas, o aviso de sigilo e o passo a passo da condução.",
      prova:
        "Cada criança recebe UMA das três bolhas. O professor precisa saber disso antes, senão " +
        "conduz o debate como se todos tivessem visto a mesma coisa.",
      inteira: true,
    });

    // ── o guia do debate ────────────────────────────────────────────────
    await p.locator("a", { hasText: "Abrir guia da aula" }).first().click();
    await p.waitForURL("**/vila-do-lume/guia", { timeout: 20_000 });
    await p.locator("text=Em quem dava pra confiar?").first().waitFor({ timeout: 20_000 });
    await p.waitForTimeout(800);
    const guia = await p.locator("main").innerText();

    /* Case-insensitive: o nome do remetente é renderizado com `uppercase` no
       CSS, e `innerText` devolve o texto TRANSFORMADO. */
    const guiaLower = guia.toLowerCase();
    for (const trecho of ["jogador 1000", "suporte da vila", "sentei atrás de ti"]) {
      r.exigir(guiaLower.includes(trecho), `a revelação projeta o golpe "${trecho}"`);
    }
    r.exigir(/pedra de fagulha atrás da Crista/.test(guia), "e a mensagem legítima do Lume");
    r.exigir(/mensagem estranha agora há pouco/.test(guia), "e o aviso legítimo — quem recusou tudo recusou este");
    r.exigir(
      /não foi um colega de verdade/i.test(guia),
      "o guia manda dizer que o remetente não era um colega de verdade",
    );
    r.exigir(/Nunca pergunte quem clicou/i.test(guia), "e proíbe perguntar quem clicou");
    r.exigir(/Confere por outro caminho/.test(guia), "e nomeia a regra que a turma leva embora");
    r.exigir(
      /Escolha a turma para ver só as mensagens que ela recebeu/.test(guia),
      "o guia deixa escolher a turma — os anos iniciais não recebem a bolha B",
    );

    /* O guia deixou de ser só o debate (ADR-65): ele é a aula inteira, e as
       seções abaixo são as que o professor não tinha em lugar nenhum. */
    r.exigir(/Antes da aula/.test(guia), "o guia cobre o ANTES da aula, não só o debate");
    r.exigir(/Roteiro/.test(guia), "traz o roteiro cronometrado da aula");
    r.exigir(/O que NÃO dizer antes da hora/.test(guia), "e diz o que não pode ser dito antes");
    r.exigir(/EF07CO07/.test(guia), "alinha com a BNCC Computação, com o código da habilidade");
    r.exigir(/Mediação/.test(guia), "traz mediação — o que fazer quando a aula descarrila");
    r.exigir(/Avaliação/.test(guia), "e a rubrica: o jogo não pontua, quem avalia é o professor");
    await r.registrar(p, "guia-da-aula", {
      titulo: "O guia da aula",
      mostra:
        "A aula inteira: objetivos e BNCC, preparo, roteiro, as três versões do golpe, as duas " +
        "mensagens legítimas, mediação, rubrica — e as travas da condução.",
      prova:
        "Os textos das mensagens vêm da api, não de cópia no hub: uma vírgula divergente poria " +
        "a turma discutindo uma mensagem que ninguém recebeu. E 'nunca pergunte quem clicou' " +
        "está ali porque a pergunta natural do adulto é exatamente a que expõe a criança.",
      inteira: true,
    });

    // ── resultados da turma ─────────────────────────────────────────────
    await p.goto(`${HUB}/professor/entre-redes/vila-do-lume/resultados`, { waitUntil: "domcontentloaded" });
    await p.locator("#turma").waitFor({ timeout: 20_000 });
    const opcao = p.locator("#turma option", { hasText: TURMA }).first();
    const valorDaTurma = await opcao.getAttribute("value");
    r.exigir(Boolean(valorDaTurma), `a turma ${TURMA} está no seletor do professor`);
    /* PORTÃO DE HIDRATAÇÃO: o `<select>` existe no HTML do SSR antes do bundle.
       Mudá-lo nesse intervalo troca o valor no DOM sem disparar o `onChange` do
       React — o `router.push` não acontece e a página fica parada, sem erro. */
    await p.waitForTimeout(2000);
    await p.selectOption("#turma", valorDaTurma);
    await p.waitForURL("**turmaId=**", { timeout: 20_000 });
    await p.locator("text=As três bolhas nesta turma").first().waitFor({ timeout: 20_000 });
    await p.waitForTimeout(1000);

    const tela = await p.locator("main").innerText();
    const vazaram = VALORES.filter((v) => tela.includes(v));
    r.exigir(
      vazaram.length === 0,
      `nenhum valor de Schwartz na listagem da turma (${vazaram.join(", ") || "nenhum"})`,
    );
    const linhas = await p.locator("table tbody tr").count();
    r.exigir(linhas > 0, `a tabela da turma tem ${linhas} linha(s)`);

    /* A LETRA DA BOLHA TEM DE SER VISÍVEL, e `toBeVisible()` não pega isto: a
       cor vem de classes escritas à mão, e uma classe de fundo que não existe
       não é erro em lugar nenhum — o elemento só fica branco no branco. */
    const circulo = await p.evaluate(() => {
      const el = [...document.querySelectorAll("span")].find(
        (s) => /^[ABC]$/.test(s.textContent?.trim() ?? "") && s.className.includes("rounded-full"),
      );
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { letra: el.textContent?.trim(), fundo: cs.backgroundColor, cor: cs.color };
    });
    r.exigir(circulo !== null, "a letra da bolha (A/B/C) aparece na tela da turma");
    if (circulo) {
      const transparente = /rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(circulo.fundo);
      r.exigir(
        !transparente,
        `a bolha "${circulo.letra}" tem fundo pintado (${circulo.fundo}) — não é texto branco no branco`,
      );
    }
    await r.registrar(p, "resultados-da-turma", {
      titulo: "Os resultados da turma",
      mostra: `Uma linha por criança, com a bolha que ela recebeu e o que fez — ${linhas} linha(s).`,
      prova:
        "Nenhum valor de Schwartz aqui. A listagem é ordenável, e uma coluna 'Poder' viraria um " +
        "ranking de crianças por valor pessoal — o oposto do que a missão se propõe.",
      detalhe: `${linhas} estudantes · nenhum valor vazou`,
      inteira: true,
    });

    // ── o relatório de uma criança: os DOIS desfechos ───────────────────
    /* O relatório é sempre o da ÚLTIMA partida fechada, e partida ABANDONADA
       não gera retrato — POR DESENHO (a tela explica a ausência). Este roteiro
       clicava o PRIMEIRO "Abrir" e esperava "Os dez valores" às cegas:
       reprovava por timeout toda vez que a última partida de quem calhava de
       estar no topo tinha sido largada no meio. Falso negativo de roteiro.
       Agora ele percorre a lista, decide pelo que a TELA diz (o Badge do topo
       e o corpo), e prova os dois ramos: o retrato completo em quem terminou
       e a explicação honesta em quem abandonou. */
    const links = p.locator("table tbody a", { hasText: "Abrir" });
    const totalDeLinks = await links.count();
    r.exigir(totalDeLinks > 0, "há ao menos um estudante com partida para abrir");
    const enderecos = [];
    for (let i = 0; i < totalDeLinks; i += 1) {
      const href = await links.nth(i).getAttribute("href");
      if (href) enderecos.push(href);
    }

    const RETRATO = "Os dez valores";
    const SEM_RETRATO = "Esta partida não gerou retrato de valores";
    const SEM_PARTIDA = "Este estudante ainda não terminou uma partida";

    let retratoProvado = false;
    let ausenciaProvada = false;

    for (const endereco of enderecos) {
      if (retratoProvado && ausenciaProvada) break;
      await p.goto(`${HUB}${endereco}`, { waitUntil: "domcontentloaded" });
      /* A tela individual tem TRÊS estados terminais, e a espera corre contra
         os três de uma vez (e contra o alerta de erro do hub): esperar só o
         retrato é a espera cega que pagava o timeout inteiro e reportava o
         seletor que faltou em vez da causa. */
      const desfecho = p
        .locator(`text=${RETRATO}`)
        .or(p.locator(`text=${SEM_RETRATO}`))
        .or(p.locator(`text=${SEM_PARTIDA}`));
      await esperarOuFalharCedo(desfecho, p.locator(ALERTA_DE_ERRO), {
        timeout: 20_000,
        oQue: `o relatório em ${endereco}`,
      });
      await p.waitForTimeout(800);
      const relatorio = await p.locator("main").innerText();

      if (relatorio.includes(RETRATO) && !retratoProvado) {
        retratoProvado = true;
        r.exigir(/Terminou a vila/.test(relatorio), "o retrato aberto é de uma partida COMPLETA");
        const faltando = VALORES.filter((v) => !relatorio.includes(v));
        r.exigir(faltando.length === 0, `os dez valores aparecem (faltando: ${faltando.join(", ") || "nenhum"})`);

        const posRessalva = relatorio.indexOf("não um teste");
        const posValores = relatorio.indexOf(RETRATO);
        r.exigir(posRessalva > 0, "a tela abre com a ressalva de que isto não é um teste");
        r.exigir(posRessalva < posValores, "e a ressalva vem ANTES dos números, não depois");
        r.exigir(/hipótese de design/i.test(relatorio), "a tela diz que o mapeamento é hipótese de design");
        r.exigir(/Não leia na frente dela/i.test(relatorio), "e avisa para não ler na frente da criança");

        const posNivel = relatorio.indexOf("O golpe que ela recebeu");
        const posTabela = relatorio.indexOf("Mensagem por mensagem");
        r.exigir(posNivel > 0, "a seção das mensagens abre pelo NÍVEL que ela recebeu");
        r.exigir(posTabela === -1 || posNivel < posTabela, "e o nível vem antes do que ela fez");

        const semNumero = [
          "um sinal só — não dá para pôr número",
          "a oportunidade não chegou até ela",
          "teve a chance e não foi por ali",
        ].filter((t) => relatorio.includes(t));
        r.exigir(
          semNumero.length > 0,
          `as ausências de número são explicadas (${semNumero.length} tipos de explicação na tela)`,
        );
        await r.registrar(p, "relatorio-do-estudante", {
          titulo: "O relatório de uma criança",
          mostra: "Os dez valores, com número onde há evidência e a explicação onde não há.",
          prova:
            "Onde o grau não autoriza número, a linha diz POR QUÊ — 'a oportunidade não chegou até " +
            "ela' é diferente de 'ela não fez'. Preencher com zero seria inventar um dado.",
          detalhe: `10 valores · ${semNumero.length} tipos de ausência explicados`,
          inteira: true,
        });
      } else if (relatorio.includes(SEM_RETRATO) && !ausenciaProvada) {
        ausenciaProvada = true;
        r.exigir(/Abandonou no meio/.test(relatorio), "o topo diz que a partida foi abandonada");
        r.exigir(
          /Os dados brutos ficaram guardados/.test(relatorio),
          "e a tela explica a ausência do retrato em vez de inventar números",
        );
        r.exigir(
          relatorio.indexOf("não um teste") > 0,
          "a ressalva de que isto não é um teste continua na tela, mesmo sem retrato",
        );
        await r.registrar(p, "relatorio-sem-retrato", {
          titulo: "A partida que não gerou retrato",
          mostra:
            "O relatório de quem ABANDONOU a última partida: o que fez na vila, e a explicação " +
            "de por que não há retrato de valores.",
          prova:
            "Quem larga no meio não escolheu nada que se possa ler — um retrato a partir de dois " +
            "minutos de jogo diria mais sobre o cansaço da criança do que sobre valores. A " +
            "ausência EXPLICADA é o comportamento desenhado, não um defeito.",
          inteira: true,
        });
      }
    }

    /* Sem nenhuma partida completa na turma, o vermelho tem de dizer ISTO — a
       pré-condição de dado que faltou —, nunca um timeout de seletor. */
    r.exigir(
      retratoProvado,
      `nenhum estudante de ${TURMA} tem a ÚLTIMA partida completa com retrato — não há onde ` +
        "provar os dez valores. Isto é pré-condição de dado, não defeito da tela: rode " +
        "estudante/05-vila-do-lume (que termina uma partida) e repita esta suíte.",
    );
  },
);
