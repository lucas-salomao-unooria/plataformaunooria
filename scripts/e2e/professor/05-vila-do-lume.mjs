import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

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

    // ── o relatório de uma criança ──────────────────────────────────────
    const abrir = p.locator("table tbody a", { hasText: "Abrir" }).first();
    r.exigir((await abrir.count()) > 0, "há ao menos um estudante com partida para abrir");
    await abrir.click();
    await p.waitForURL((url) => /vila-do-lume\/estudantes\//.test(url.pathname), { timeout: 20_000 });
    await p.locator("text=Os dez valores").first().waitFor({ timeout: 20_000 });
    await p.waitForTimeout(800);

    const relatorio = await p.locator("main").innerText();
    const faltando = VALORES.filter((v) => !relatorio.includes(v));
    r.exigir(faltando.length === 0, `os dez valores aparecem (faltando: ${faltando.join(", ") || "nenhum"})`);

    const posRessalva = relatorio.indexOf("não um teste");
    const posValores = relatorio.indexOf("Os dez valores");
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
  },
);
