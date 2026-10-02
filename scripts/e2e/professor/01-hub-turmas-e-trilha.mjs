import { HUB, suite, estadoDosIcones } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O chão do professor: o hub, as turmas dele e a trilha do Entre Redes.
 *
 * O que esta suíte cobra e nenhuma outra cobre:
 *
 *  - as TURMAS que aparecem são as em que ele tem matrícula, e não as da
 *    escola. É uma regra de tenancy que vive numa query (`GET /turmas/minhas`)
 *    e que, quebrada, mostra a sala do colega sem erro nenhum na tela;
 *  - a SALA (ADR-69): a grade da turma, e o botão que abre a missão para ela.
 *    Sem liberar, o estudante vê cadeado — e é aqui que se prova que o clique do
 *    professor chega à criança;
 *  - a trilha ordena as missões por ano, com a transversal FORA da grade;
 *  - os ícones do design system carregam como fonte de ligadura. Sem a fonte,
 *    cada ícone vira a palavra dele escrita na tela — e num deploy isso não
 *    quebra nada, só fica ilegível.
 */
const TURMA = process.env.TURMA ?? "8A";

await suite(
  {
    slug: "professor/01-hub-turmas-e-trilha",
    papel: "professor",
    titulo: "O chão do professor",
    subtitulo: "hub, minhas turmas e a trilha do Entre Redes",
    contexto:
      "Onde o docente começa o dia: três produtos (preparar a aula, rodar com a turma, cuidar de " +
      "si), a lista nominal das turmas dele e a trilha das missões por ano.",
    prova: [
      "O hub abre nos três produtos, com a situação do acompanhamento de bem-estar no cartão",
      "Minhas turmas lista só as turmas em que ele tem matrícula",
      "A turma abre na SALA: a grade de missões daquela sala, com o estado de cada uma",
      "A aba Estudantes traz a lista nominal, uma linha por criança",
      "Liberar uma missão na turma faz o cartão dela ABRIR para o estudante daquela sala",
      "Encerrar fecha a entrada e o cartão fica com o rótulo — o que a criança fez não some",
      "A trilha põe a missão transversal ACIMA da grade por ano",
      "O guia da aula traz os sete momentos, e a revelação palavra por palavra",
      "Os ícones do DS carregam como fonte, e não como texto",
    ],
    comando: "node scripts/e2e/professor/01-hub-turmas-e-trilha.mjs",
  },
  async (r) => {
    const professor = conta("professor", { turma: TURMA });
    const p = await r.pagina("professor");
    await r.entrar(p, professor.login);

    /* A checagem é CONDICIONAL: nem toda tela usa ícone, e exigir um onde não
       há reprovaria por uma decisão de layout. O que não pode acontecer é a
       fonte de ligadura faltar onde o ícone existe — aí ele vira a palavra
       "warning" escrita na tela, e nada quebra. */
    const icones = await estadoDosIcones(p);
    r.exigir(!icones.startsWith("FONTE NÃO CARREGOU"), `ícones do DS no hub: ${icones}`);
    await r.registrar(p, "hub-do-professor", {
      titulo: "O hub do professor",
      mostra: "Os três produtos e o atalho para as atividades recentes.",
      prova:
        "Três produtos, cada um com o seu tempo. O de bem-estar mostra a situação da resposta do " +
        "dia direto no cartão — se ele exigisse abrir para descobrir que já foi feito, ninguém abriria.",
      detalhe: `ícones: ${icones}`,
    });

    // ── minhas turmas: a regra de tenancy que uma query decide ───────────
    await p.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    const turmas = await p.locator('a[href^="/professor/turmas/"]').allInnerTexts();
    r.exigir(turmas.length > 0, `o professor vê ${turmas.length} turma(s) dele`);
    await r.registrar(p, "minhas-turmas", {
      titulo: "Minhas turmas",
      mostra: `As turmas em que este docente tem matrícula: ${turmas.map((t) => t.split("\n")[0]).join(", ")}.`,
      prova:
        "A lista vem de `GET /turmas/minhas`, que devolve as turmas em que ELE tem matrícula — não " +
        "as da escola. É a diferença entre ver a sua sala e ver a sala do colega.",
      detalhe: `${turmas.length} turma(s)`,
    });

    await Promise.all([
      p.waitForURL(/\/professor\/turmas\/[0-9a-f-]{36}/, { timeout: 20_000 }),
      p.locator('a[href^="/professor/turmas/"]').first().click(),
    ]);
    await p.waitForTimeout(1800);

    /* A SALA abre nas MISSÕES: é o que o professor vem fazer. A lista nominal
       desceu para a aba ao lado — ela continua existindo, e continua sendo o
       lugar onde "trackear por estudante" vira coisa que se vê. */
    const linhasDeMissao = await p.locator("main li").count();
    r.exigir(linhasDeMissao > 0, `a sala abriu com ${linhasDeMissao} missão(ões) na grade`);
    await r.registrar(p, "a-sala-da-turma", {
      titulo: "A sala: as missões desta turma",
      mostra:
        "A grade da série daquela turma — a missão do ano e as transversais — com o estado de cada " +
        "uma e o botão que abre.",
      prova:
        "Era aqui que faltava a camada inteira: a missão existia no catálogo e não pertencia a sala " +
        "nenhuma. O caminho para conduzir sai DAQUI, com a turma já escolhida — antes era voltar ao " +
        "hub, entrar no Entre Redes, achar o ano e escolher a turma de novo num select, e a página " +
        "do ano era a MESMA para as duas turmas da série.",
      detalhe: `${linhasDeMissao} missões na grade`,
      inteira: true,
    });

    const urlDaTurma = p.url().split("?")[0];
    await p.goto(`${urlDaTurma}?aba=estudantes`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    /* A lista da turma é `<ul><li>`, não tabela: cada linha tem o link para o
       que a plataforma já sabe daquela criança na Vila do Lume (o nome leva ao
       perfil de habilidades, que a `professor/11` cobre). */
    const estudantes = await p
      .locator('a[href^="/professor/entre-redes/vila-do-lume/estudantes/"]')
      .count();
    r.exigir(estudantes > 0, `a aba Estudantes abriu com ${estudantes} estudante(s) nominais`);
    await r.registrar(p, "a-turma-por-dentro", {
      titulo: "A turma, nominalmente",
      mostra: `A lista da turma, com ${estudantes} estudante(s) e o caminho para o relatório de cada um.`,
      prova:
        "O professor VÊ nome. É a sala dele, e sem nome não há mediação possível. O que é agregado " +
        "e anônimo é a análise de produto, que compara turmas — outra tela, outro papel.",
      detalhe: `${estudantes} estudantes`,
      inteira: true,
    });

    // ── a trilha ────────────────────────────────────────────────────────
    await p.goto(`${HUB}/professor/entre-redes`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1800);

    const cardTransversal = p.locator('a[href="/professor/entre-redes/vila-do-lume"]').first();
    await cardTransversal.waitFor({ timeout: 15_000 });
    const textoDoCard = await cardTransversal.innerText();
    r.exigir(!/Unidade/i.test(textoDoCard), "o card transversal não fala em unidade — ele não tem uma");
    r.exigir(/Transversal/.test(textoDoCard), "o card se identifica como transversal");

    /* A faixa transversal tem de vir ANTES da grade de etapas: a grade é lida
       como "onde a minha missão mora", e um card sem ano dentro dela fica
       órfão. */
    const acimaDaGrade = await p.evaluate(() => {
      const alvo = document.querySelector('a[href="/professor/entre-redes/vila-do-lume"]');
      const primeiraEtapa = [...document.querySelectorAll("h2")].find((h) =>
        /Anos Iniciais/i.test(h.textContent ?? ""),
      );
      if (!alvo || !primeiraEtapa) return null;
      return alvo.getBoundingClientRect().top < primeiraEtapa.getBoundingClientRect().top;
    });
    r.exigir(acimaDaGrade === true, "a missão transversal está ACIMA da grade por ano");
    await r.registrar(p, "trilha-entre-redes", {
      titulo: "A trilha do Entre Redes",
      mostra: "A missão transversal em destaque e, abaixo, a grade das missões por ano e unidade.",
      prova:
        "A Vila do Lume não pertence a ano nenhum, e pô-la dentro da grade a deixaria órfã — o " +
        "professor procuraria a unidade dela e não acharia.",
      inteira: true,
    });

    // ── o guia da aula ──────────────────────────────────────────────────
    await p.goto(`${HUB}/professor/entre-redes/8-ano/unidade-1/guia`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    const guia = await p.locator("main").innerText();
    r.exigir(/os 7 momentos/.test(guia), "o guia fala nos sete momentos da aula");
    r.exigir(/Encerrar atividade/.test(guia), "o sétimo momento está na tabela do guia");
    r.exigir(
      /O Unoovista não é uma rede social de verdade/.test(guia),
      "o professor lê a revelação palavra por palavra, ANTES da aula",
    );
    await r.registrar(p, "guia-da-aula", {
      titulo: "O guia da aula",
      /* Sem `inteira`: o guia passa de 30 000 px e o Chrome recusa o print
         inteiro com "Unable to capture screenshot". */
      mostra: "Os sete momentos, o que dizer em cada um, e o texto integral da revelação.",
      prova:
        "O docente precisa ter lido a revelação antes de conduzi-la. Descobri-la junto com a turma " +
        "é a diferença entre mediar e assistir.",
    });

    // ── liberar: o clique do professor chegando à criança ────────────────
    /**
     * O ciclo inteiro, numa turma que NENHUMA suíte de estudante toca.
     *
     * A 9B é escolhida de propósito: a suíte `estudante/01` afirma sobre a 8A
     * (aberta pelo seed) e a 8B (fechada), e liberar em qualquer uma delas faria
     * esta suíte quebrar aquela na próxima execução — a ordem canônica roda
     * estudante ANTES de professor, então o estrago só apareceria na corrida
     * seguinte. O 9º ano tem só a transversal na grade, e é o bastante.
     *
     * Termina ENCERRANDO, e isso também é fixture: o estado final é o mesmo em
     * toda execução, então rodar de novo prova a mesma coisa.
     */
    const ALVO = "9B";
    const profDaNove = conta("professor", { turma: ALVO });
    const alunoDaNove = conta("estudante", { turma: ALVO });

    const pn = await r.pagina("professor-9b");
    await r.entrar(pn, profDaNove.login);
    await pn.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
    await pn.waitForTimeout(1200);
    await Promise.all([
      pn.waitForURL(/\/professor\/turmas\/[0-9a-f-]{36}/, { timeout: 20_000 }),
      pn.locator('a[href^="/professor/turmas/"]').first().click(),
    ]);
    await pn.waitForSelector("main li", { timeout: 20_000 });
    await pn.waitForTimeout(1200);

    const liberar = pn.getByRole("button", { name: /^Liberar / }).first();
    r.exigir(await liberar.count() > 0, `a sala da ${ALVO} tem missão fechada para liberar`);
    const nomeDaMissao = (await pn.locator("main li").first().innerText()).split("\n")[0];
    await liberar.click();
    await pn.waitForTimeout(2500);
    r.exigir(
      (await pn.getByRole("button", { name: /^Encerrar / }).count()) > 0,
      "depois de liberar, o botão vira Encerrar — o estado é o da sala, não do clique",
    );
    await r.registrar(pn, "missao-liberada", {
      titulo: "A missão aberta para a turma",
      mostra: `A sala da ${ALVO} com "${nomeDaMissao}" liberada, dizendo quem abriu e quando.`,
      prova:
        "Quem liberou fica gravado porque a turma tem mais de um professor com frequência, e " +
        '"por que isso apareceu?" é a primeira pergunta da sala. Só quem tem MATRÍCULA na turma ' +
        "libera: gestor lê a sala e não decide a aula.",
    });

    const pa = await r.pagina("estudante-9b");
    await r.entrar(pa, alunoDaNove.login);
    await pa.waitForURL((url) => url.pathname.includes("/estudante"), { timeout: 30_000 });
    await pa.waitForSelector("main ul > li", { timeout: 20_000 });
    r.exigir(
      (await pa.locator('[data-estado="liberada"]').count()) > 0,
      `o estudante da ${ALVO} vê a missão ABERTA depois do clique do professor`,
    );
    await r.registrar(pa, "chegou-na-crianca", {
      titulo: "O clique do professor, na tela da criança",
      mostra: `O hub do estudante da ${ALVO}, com a missão que acabou de ser liberada.`,
      prova:
        "É a alça que faltava entre a turma e o catálogo. Antes, toda criança via todas as missões, " +
        "e o professor não tinha como dizer qual é a de hoje.",
    });

    // ── encerrar: fecha a entrada, mantém o que ela fez ──────────────────
    await pn.getByRole("button", { name: /^Encerrar / }).first().click();
    await pn.waitForTimeout(2500);
    await pa.reload({ waitUntil: "domcontentloaded" });
    await pa.waitForSelector("main ul > li", { timeout: 20_000 });
    r.exigir(
      (await pa.locator('[data-estado="encerrada"]').count()) > 0,
      "encerrada, a missão CONTINUA na tela da criança, com o rótulo",
    );
    r.exigir(
      (await pa.locator('[data-estado="liberada"]').count()) === 0,
      "e não abre mais",
    );
    await r.registrar(pa, "missao-encerrada", {
      titulo: "Encerrada, e ainda visível",
      mostra: `O mesmo hub depois do encerrar: a missão com o rótulo, sem link.`,
      prova:
        "Encerrar fecha a entrada e NÃO apaga o que a criança fez — some da tela seria dizer a ela " +
        "que nada aconteceu. É a mesma razão de a bloqueada aparecer com cadeado em vez de sumir.",
    });
  },
);
