import { suite } from "../lib/roteiro.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O planejamento de ensino (exp-92), embedado no hub do professor.
 *
 * A exp-92 vivia sem suíte, e a ausência custou: o plano de aulas quebrou com
 * o pedido de IA montado com os nomes de campo do OUTRO método do provider
 * (`user`/`schema` em vez de `prompt`/`responseSchema`), e um `as never` calou
 * o compilador. Typecheck verde, lint verde, e a tela do professor dizia
 * "Falhou" sem causa. Nada além de uma corrida de ponta a ponta pegaria isso:
 * o defeito só existe quando há um Vertex do outro lado.
 *
 * A suíte anda o caminho inteiro porque cada passo depende do anterior de um
 * jeito que não se finge: o calendário sai da regência, a distribuição sai da
 * BNCC do ano escolhido, o plano anual sai da distribuição e as aulas saem do
 * plano. Um roteiro que só abrisse a tela não descobre que o 1º bimestre
 * começou em dezembro.
 *
 * Cinco armadilhas registradas aqui:
 *
 *  - os seletores da regência são `role="combobox"`, NÃO `button`. Procurar
 *    por botão devolve "timeout esperando Selecione o ano", que não diz que o
 *    papel é outro;
 *  - **o professor precisa ter UMA escola.** O primeiro professor do CSV está
 *    lotado em duas, e aí o hub mostra o seletor de escola ativa ANTES de
 *    montar o iframe: a experiência nunca carrega e o erro sai como "timeout
 *    esperando Regência". Daí o recorte por turma;
 *  - **o `Stepper` é indicador, não navegação** — seus botões são `disabled`.
 *    Andar entre passos é pelos botões de ação de cada tela;
 *  - **a GRADE de horários é obrigatória para existir aula.** Sem ela o
 *    planejamento nasce válido, o produto marca "Grade incompleta" e as
 *    semanas chegam com "0 aula(s)": a suíte passaria por todas as telas sem
 *    nunca ter uma aula para gerar — falso verde;
 *  - **um planejamento é único por componente e ano**, e a suíte roda muitas
 *    vezes na mesma base. Recriar o mesmo falha, então ela abre o que existe.
 *    Ao abrir, o produto leva o professor para ONDE ELE PAROU (as aulas, se o
 *    plano está pronto), e é a suíte que volta até a distribuição.
 *
 * As duas gerações são de IA REAL e a espera corre contra o alerta de erro —
 * `AI_PROVIDER=mock` não serve aqui, porque o `generateJson` do mock lança
 * sempre e era justamente o caminho do Vertex que estava quebrado.
 */
await suite(
  {
    slug: "professor/09-plano-de-ensino",
    papel: "professor",
    titulo: "Planejamento de ensino",
    subtitulo: "da regência à aula da semana, dirigido pela BNCC",
    contexto:
      "A ferramenta para a rede que NÃO tem documento curricular próprio: o planejamento sai da " +
      "BNCC estruturada, cobre do 1º ano do EF à 3ª série do EM, e desce do plano anual até a " +
      "aula de cada semana — com o calendário real do professor.",
    prova: [
      "O componente e o ano definem quais habilidades da BNCC aparecem",
      "O calendário do plano nasce da data de início do ano letivo que o professor declarou",
      "O plano anual é gerado a partir da distribuição que ele fez, não de conhecimento genérico",
      "As aulas vêm com data, horário e habilidade — o esqueleto é do calendário, não do modelo",
      "Nenhuma habilidade fora do recorte do período chega ao plano",
      "Erro de geração aparece na tela em vez de virar espera silenciosa",
    ],
    comando: "node scripts/e2e/professor/09-plano-de-ensino.mjs",
  },
  async (r) => {
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1100 } });
    /* Turma explícita: garante professor de UMA escola só (ver o cabeçalho). */
    await r.entrar(p, conta("professor", { turma: "8A" }).login);

    const cartao = p.locator('a[href="/professor/plano-de-ensino"]');
    r.exigir(
      (await cartao.count()) === 1,
      "o planejamento de ensino é um cartão do hub do professor",
    );
    await cartao.first().click();
    await p.waitForURL((url) => url.pathname === "/professor/plano-de-ensino", { timeout: 30_000 });

    const exp = p.frameLocator('iframe[title="experiencia"]');
    await exp.getByText(/Regência|Meus planejamentos/).first().waitFor({ timeout: 60_000 });

    const doOitavo = exp
      .locator("button.planejamento")
      .filter({ hasText: /Matemática/ })
      .filter({ hasText: /8º ano/ })
      .first();

    if (await doOitavo.isVisible().catch(() => false)) {
      await r.registrar(p, "meus-planejamentos", {
        titulo: "Meus planejamentos",
        mostra: "Um planejamento por componente e ano que o professor leciona.",
        prova:
          "Um professor de verdade leciona mais de um componente, e às vezes o mesmo em anos " +
          "diferentes. Cada um tem calendário, distribuição e documento próprios.",
      });
      await doOitavo.click();
      await voltarAteADistribuicao(p, exp);
      r.ressalva(
        "a regência não foi refotografada: o planejamento do 8º ano já existia nesta base, e " +
          "o produto abre onde o professor parou. Numa base recém-semeada a suíte monta a " +
          "regência do zero e o print existe",
      );
    } else {
      const novo = exp.getByRole("button", { name: /Novo planejamento|Criar o primeiro/ });
      if (await novo.isVisible().catch(() => false)) {
        await novo.click();
        await p.waitForTimeout(1500);
      }
      await montarRegencia(r, p, exp);
    }

    // ── 1. currículo: as habilidades por período ────────────────────────
    await exp
      .getByText(/ainda fora do plano|Currículo do ano coberto/)
      .first()
      .waitFor({ timeout: 60_000 });

    const periodos = await exp.locator("button").filter({ hasText: /º Bimestre/ }).count();
    r.exigir(periodos === 4, `a divisão bimestral gerou 4 períodos (${periodos})`);
    const primeiro = await exp
      .locator("button")
      .filter({ hasText: /1º Bimestre/ })
      .first()
      .innerText();
    r.exigir(
      /02\/02/.test(primeiro),
      `o 1º bimestre começa na data declarada, não no ano civil (${primeiro.replace(/\n/g, " ")})`,
    );

    const pendentes = exp.getByText(/ainda fora do plano/);
    if (await pendentes.isVisible().catch(() => false)) {
      await r.registrar(p, "curriculo-por-distribuir", {
        titulo: "As habilidades da BNCC do ano, ainda por distribuir",
        mostra:
          "Os quatro bimestres com as datas que saíram do calendário, e as habilidades do " +
          "componente esperando decisão.",
        prova:
          "Que habilidade cai em que bimestre é decisão do PROFESSOR, não do modelo — é dado " +
          "estruturado no banco, e é a entrada da geração. O organizador acima da habilidade " +
          "tem três nomes na Base (unidade temática, prática de linguagem, eixo), e o " +
          "servidor manda o certo: chamar tudo de unidade temática faz o professor de " +
          "Português não reconhecer o próprio currículo.",
      });
      await exp.getByRole("button", { name: /Distribuir as pendentes/ }).click();
      await exp.getByText("Currículo do ano coberto").waitFor({ timeout: 15_000 });
      r.exigir(true, "distribuir proporcionalmente às aulas cobriu o currículo do ano");
    } else {
      r.exigir(
        await exp.getByText("Currículo do ano coberto").isVisible(),
        "o currículo do ano já estava coberto pela distribuição salva",
      );
    }

    await r.registrar(p, "curriculo-distribuido", {
      titulo: "O currículo do ano, repartido",
      mostra: "Cada bimestre com suas habilidades e a contagem de aulas.",
      prova:
        "A distribuição é a barreira mais alta contra código de habilidade inventado: o " +
        "`PUT .../distribuicao` recusa código fora do recorte, e depois a costura filtra o que " +
        "o modelo devolveu. Um plano que cita `EF67LP42` chega à coordenação como erro do " +
        "professor.",
    });

    // ── 2. o plano anual, gerado ────────────────────────────────────────
    /* Este "Escrever o plano anual" é o da DISTRIBUIÇÃO: salva o que o
       professor decidiu e avança. O da tela seguinte tem o mesmo rótulo e é o
       que dispara a geração — daí a espera pelo passo no meio. */
    await exp.getByRole("button", { name: "Escrever o plano anual" }).click();
    await exp.getByText(/O plano anual: fundamentação/).waitFor({ timeout: 30_000 });
    /* "Gerar de novo" quando já há documento: a suíte gera SEMPRE, porque é o
       caminho do Vertex que ela existe para provar. */
    await exp
      .getByRole("button", { name: /Escrever o plano anual|Tentar de novo|Gerar de novo/ })
      .first()
      .click();

    /* Primeiro provar que a geração COMEÇOU. Sem isto a suíte dava verde na
       hora quando o documento já estava na tela de uma corrida anterior: o
       editor estava visível, a espera passava de imediato e nada tinha sido
       gerado — falso verde exatamente no passo que existe para provar que a
       geração funciona. Enquanto gera, o editor SAI da tela (é o estado
       `gerando`), e as etapas do progresso aparecem. */
    await esperarOuFalharCedo(
      exp.getByText(/Lendo as habilidades|Organizando a progressão|Escrevendo estratégias|Redigindo o atendimento/).first(),
      exp.locator(ALERTA_DE_ERRO),
      { timeout: 60_000, oQue: "o início da geração do plano anual (exp-92)" },
    );
    /* A espera corre contra o alerta: com ADC vencido a api falha em ~300ms, e
       uma espera cega pagaria 5 minutos para reportar o seletor que faltou. */
    await esperarOuFalharCedo(exp.locator('[contenteditable="true"]'), exp.locator(ALERTA_DE_ERRO), {
      timeout: 300_000,
      oQue: "a geração do plano anual (exp-92)",
    });
    await p.waitForTimeout(1500);

    const prosa = await exp.locator('[contenteditable="true"]').first().innerText();
    r.exigir(
      prosa.length > 800,
      `o plano anual veio como documento de prosa (${prosa.length} caracteres)`,
    );

    await r.registrar(p, "plano-anual", {
      titulo: "O plano anual do componente",
      mostra:
        "Fundamentação, progressão por período, avaliação e atendimento à diversidade, num " +
        "editor de texto.",
      prova:
        "É o único lugar do produto onde a IA escreve prosa corrida, e ela sai da distribuição " +
        "que o professor fez — não de conhecimento genérico do modelo. O documento é editável " +
        "e vai impresso para a coordenação com o nome dele.",
    });

    // ── 3. as aulas da semana ───────────────────────────────────────────
    await exp.getByRole("button", { name: /Planejar as aulas/ }).click();
    await exp.getByText(/Suas aulas/).waitFor({ timeout: 60_000 });

    const semanas = await exp.locator("button").filter({ hasText: /ª Semana/ }).count();
    /* O count pega o ANO, não o 1º bimestre: o corpo fechado do `Collapse` fica
       no DOM, então as semanas dos quatro bimestres estão todas aqui. A frase
       dizia "no 1º bimestre" e reportava ~40 — prova que mede uma coisa e
       afirma outra é pior que prova nenhuma. */
    r.exigir(semanas > 0, `o ano abriu em semanas planejáveis (${semanas} no ano)`);

    await r.registrar(p, "semanas-do-ano", {
      titulo: "As semanas do ano, uma a uma",
      mostra: "Os bimestres abertos em semanas, cada uma com quantas aulas tem e o que falta.",
      prova:
        "O esqueleto é do CALENDÁRIO, não do modelo: quantas aulas, em que data, em que " +
        "horário. Deixar o modelo decidir quantas aulas cabem na semana produzia cinco — o " +
        "número redondo — para quem tem uma. O passo é SEMPRE semanal (ADR-76): entregar de " +
        "quinze em quinze dias é recorte de exportação, não de planejamento.",
    });

    /* O corpo FECHADO do `Collapse` do DS não pode sequestrar o teclado. Ele
       recebe `aria-hidden="true"` e altura 0, mas o pacote não põe `inert` nem
       `visibility: hidden` — e descendente FOCÁVEL dentro de `aria-hidden` é
       foco fantasma: o Tab entra, o leitor de tela não anuncia nada. Aqui são
       as ~30 semanas dos três bimestres fechados. A compensação está em
       `src/estilos/globals.css` da exp-92, e esta verificação é o que impede
       que ela seja removida sem ninguém notar. */
    const focaveisEscondidas = await exp
      .locator('[role="region"][aria-hidden="true"] button.semana')
      .evaluateAll((bs) =>
        bs.filter((b) => {
          b.focus();
          return document.activeElement === b;
        }).length,
      );
    r.exigir(
      focaveisEscondidas === 0,
      `nenhuma semana de bimestre fechado recebe foco do teclado (${focaveisEscondidas} focáveis)`,
    );

    /* Todos os bimestres ABERTOS antes de escolher a semana. Só o 1º vem aberto
       (`defaultOpen`), e o corpo fechado fica no DOM: o filtro achava uma semana
       de bimestre fechado, o Playwright a considerava visível e o clique morria
       interceptado pelo corpo colapsado. Foi assim que esta suíte quebrou em
       2026-09-10 — no dia em que as dez semanas do 1º bimestre ficaram todas
       planejadas por corridas anteriores. */
    const bimestres = exp.getByRole("button", { name: /º Bimestre/ });
    for (let i = 0; i < (await bimestres.count()); i++) {
      const cabecalho = bimestres.nth(i);
      if ((await cabecalho.getAttribute("aria-expanded")) === "false") await cabecalho.click();
    }
    await p.waitForTimeout(600);

    /* "Falhou" conta como candidata, de propósito: é o caminho "Tentar de novo",
       e a semana que falhou na geração é a que mais precisa ser exercitada. Sem
       isso, uma falha de IA de ONTEM deixava a suíte sem candidata hoje, e o
       vermelho não era de quem estava rodando. */
    const candidata = exp
      .locator("button.semana")
      .filter({ hasText: /A planejar|Falhou/ })
      .first();
    r.exigir(
      await candidata.isVisible().catch(() => false),
      "há semana a planejar (ou a retomar depois de falha) no ano",
    );
    await candidata.click();
    await p.waitForTimeout(1200);
    await exp
      .getByRole("button", { name: /Planejar estas aulas|Tentar de novo/ })
      .first()
      .click();

    /* Primeiro provar que a geração COMEÇOU — e aqui isto NÃO é a mesma
       precaução do plano anual. Quando a semana vem de `erro`, o botão "Tentar
       de novo" fica DENTRO do `FeedbackAlert`, e o alerta continua na tela até
       o POST voltar: o `esperarOuFalharCedo` seguinte via o alerta ANTIGO e
       abortava com "a geração falhou" antes de a geração começar. Em 2026-09-10
       isso fez a suíte reportar vermelho enquanto o banco gravava a semana como
       `pronto` NA MESMA corrida — o pior tipo de falso negativo, porque manda
       investigar um produto que funcionou. Por isso esta espera é `waitFor`
       puro: vigiar o alerta aqui é vigiar o passado. */
    await exp.getByText(/Detalhando as aulas/).waitFor({ timeout: 60_000 });

    /* Pronta, a semana abre na visão DETALHADA e a lista com o badge
       "Planejada" sai da tela: esperar pelo badge era esperar por um elemento
       que a própria conclusão remove. O que fica é o cartão da aula. */
    await esperarOuFalharCedo(exp.getByText(/Tema da aula/).first(), exp.locator(ALERTA_DE_ERRO), {
      timeout: 300_000,
      oQue: "a geração das aulas da semana (exp-92)",
    });
    await p.waitForTimeout(2000);

    const corpo = await exp.locator("body").innerText();
    r.exigir(/\d\d:\d\d/.test(corpo), "as aulas trazem o horário da grade do professor");
    r.exigir(
      /EF08MA\d\d|EF08CO\d\d/.test(corpo),
      "as habilidades citadas são do 8º ano — o recorte do período, não código inventado",
    );
    r.exigir(!/Falhou/.test(corpo), "a semana não ficou com o rótulo de falha");
    r.exigir(
      /Sequência da aula/.test(corpo) && /Retomada/.test(corpo),
      "cada aula vem com a sequência dos quatro momentos, com os minutos de cada um",
    );

    await r.registrar(p, "aulas-planejadas", {
      titulo: "A semana, aula a aula",
      mostra:
        "Cada aula com tema, objetivo, os quatro momentos com seus minutos, recursos, " +
        "avaliação, tarefa de casa e adaptações.",
      prova:
        "É dado ESTRUTURADO, não prosa formatada pelo modelo — é isso que deixa o professor " +
        "editar a aula de quinta sem reescrever a semana, e que garante que a aula da tela é a " +
        "aula que sai no papel. A geração passa pela quota de IA do professor: a resposta " +
        "estruturada informa quanto o vendor cobrou, e o débito acontece mesmo quando a " +
        "geração falha no meio (ADR-74).",
      inteira: true,
    });

    // ── 4. a ENTREGA: exportar por recorte ──────────────────────────────
    /* O planejamento é semanal, mas a escola recolhe por quinzena ou por
       bimestre. Os botões de recorte são o que resolve isso — e cada um só
       aparece quando TEM conteúdo: o da quinzena exige a semana seguinte já
       planejada, senão o documento sairia com uma semana e o nome mentiria. */
    const exportarSemana = exp.getByRole("button", { name: /Baixar esta semana/ });
    r.exigir(
      await exportarSemana.isVisible(),
      "a semana pronta oferece o download do documento dela",
    );

    /* O download só acontece com `allow-downloads` no sandbox do iframe, que
       vem da permissão `downloads` do manifesto E do repasse de `permissoes`
       pela rota do hub. Sem um dos dois o navegador bloqueia em SILÊNCIO — sem
       erro na tela, sem linha no console —, e é exatamente o defeito que a
       ADR-76 corrigiu. Por isso o teste é o ARQUIVO, não o clique. */
    const [arquivo] = await Promise.all([
      p.waitForEvent("download", { timeout: 30_000 }).catch(() => null),
      exportarSemana.click(),
    ]);
    r.exigir(
      Boolean(arquivo) && /\.doc$/.test(arquivo.suggestedFilename()),
      arquivo
        ? `o .doc da semana chegou ao disco (${arquivo.suggestedFilename()})`
        : "NADA baixou em 30s — confira o allow-downloads do sandbox do iframe (ADR-76)",
    );

    const sandbox = await p.locator("iframe").first().getAttribute("sandbox");
    r.exigir(
      /allow-downloads/.test(sandbox ?? ""),
      `o sandbox do iframe tem allow-downloads (${sandbox})`,
    );

    await r.registrar(p, "entrega-por-recorte", {
      titulo: "A entrega: uma semana, a quinzena ou o bimestre",
      mostra:
        "Os botões de exportação da semana aberta: baixar só ela, ela com a próxima (a " +
        "quinzena) ou o período de avaliação inteiro.",
      prova:
        "O professor PLANEJA semana a semana e ENTREGA no recorte que a escola pede — são " +
        "decisões diferentes, e é por isso que não existe mais um passo configurável de " +
        "planejamento (ADR-76). O documento sai do dado estruturado, com uma semana por " +
        "página, e só entram as semanas prontas: nenhuma folha em branco chega à coordenação.",
    });

    // ── 5. apagar o planejamento ────────────────────────────────────────
    /* Este passo existe porque a funcionalidade NÃO existia: o professor criava
       um planejamento e ficava com ele. A suíte para no diálogo, sem confirmar
       — o estado que ela acabou de produzir é o que os passos anteriores
       fotografam, e apagá-lo aqui deixaria a próxima corrida sem nada. */
    await exp.getByRole("button", { name: /Meus planejamentos/ }).click();
    await p.waitForTimeout(1500);

    const excluir = exp.getByRole("button", { name: /^Excluir o planejamento de/ }).first();
    r.exigir(await excluir.isVisible(), "cada planejamento da lista tem como ser excluído");
    await excluir.click();
    await exp.getByText(/Isso apaga, e não tem volta/).waitFor({ timeout: 15_000 });

    const dialogo = await exp.locator('[role="alertdialog"]').innerText();
    r.exigir(
      /semanas já detalhadas/.test(dialogo) && /Gerar de novo/.test(dialogo),
      "o diálogo diz o que se perde E oferece a alternativa não destrutiva",
    );

    await r.registrar(p, "excluir-planejamento", {
      titulo: "Excluir um planejamento",
      mostra:
        "O diálogo de confirmação: a lista do que será apagado — regência, distribuição, " +
        "plano anual e todas as semanas — e o caminho alternativo para quem só quer " +
        "reescrever o documento.",
      prova:
        "Apagar leva a regência, o plano anual e as semanas pela cascata do banco, e varre o " +
        "conteúdo no object storage ANTES do delete (depois dele não haveria como saber quais " +
        "prefixos eram). É irreversível, então quem confirma precisa saber o que perde — e " +
        "quem só quer o texto de novo tem o \"Gerar de novo\", dito no próprio diálogo.",
    });

    await exp.getByRole("button", { name: "Cancelar" }).click();
    await p.waitForTimeout(800);
    r.exigir(
      await exp.getByRole("button", { name: /^Excluir o planejamento de/ }).first().isVisible(),
      "cancelar mantém o planejamento na lista",
    );
  },
);

/**
 * Monta a regência de um planejamento novo: ano, componente, data de início e
 * a grade de dias e horários. Só roda no PRIMEIRO uso — depois o planejamento
 * existe e a suíte entra por ele.
 */
async function montarRegencia(r, p, exp) {
  const combo = (texto) => exp.locator('[role="combobox"]').filter({ hasText: texto }).first();

  await combo("Selecione o ano").click();
  await exp.getByRole("option", { name: /^8º ano/ }).click();
  await p.waitForTimeout(1000);
  await combo("Selecione o componente").click();
  const componentes = await exp.locator('[role="option"]').allInnerTexts();
  r.exigir(
    componentes.some((c) => /habilidades/.test(c)),
    `os componentes vêm com a contagem de habilidades da BNCC (${componentes.length} ofertados)`,
  );
  await exp.getByRole("option", { name: /^Matemática/ }).click();
  await p.waitForTimeout(1200);

  /* A data ancora o calendário inteiro, e a suíte a DECLARA em vez de aceitar
     a sugestão: `periodos_letivos` é catálogo do CONTRATO e o seed o preenche
     como ano CIVIL (01/01–31/12). Como o calendário alinha cada período na
     segunda-feira, aceitar a sugestão faria o 1º bimestre começar em dezembro
     do ano anterior — bug já registrado no AGENTS.md da exp-92. */
  await exp.locator('input[type="date"]').first().fill("2026-02-02");
  await p.waitForTimeout(1000);

  /* Segunda, terça, quinta e sexta: 4 aulas por semana. Ver a armadilha da
     grade no cabeçalho — sem ela não existe aula para planejar. */
  const colunas = exp.locator(".grade-de-horarios__dia");
  for (const i of [0, 1, 3, 4]) {
    await colunas.nth(i).getByRole("button", { name: "+ aula" }).click();
    await p.waitForTimeout(300);
  }
  const horarios = exp.locator('input[type="time"]');
  const quantos = await horarios.count();
  r.exigir(quantos === 4, `a grade recebeu 4 aulas na semana (${quantos} horários)`);
  for (let i = 0; i < quantos; i += 1) await horarios.nth(i).fill("07:00");
  await p.waitForTimeout(800);

  await r.registrar(p, "regencia", {
    titulo: "O que o professor leciona",
    mostra:
      "Componente, ano, início do ano letivo, divisão em bimestres, aulas por semana, a " +
      "duração de cada uma e a grade de dias e horários.",
    prova:
      'Daqui sai o TAMANHO do plano, e a GRADE é o que transforma "4 aulas por semana" em ' +
      "aulas datadas. As 800h do Fundamental são horas de 60 minutos, não hora-aula: por isso " +
      "a duração é campo, e a carga sugerida é mediana de nove redes públicas — a BNCC não " +
      "define grade horária.",
  });

  const criar = exp.getByRole("button", { name: "Criar planejamento" });
  r.exigir(await criar.isEnabled(), "com a regência declarada, o planejamento pode ser criado");
  await criar.click();
}

/**
 * Do ponto em que o produto abriu o planejamento até a distribuição.
 *
 * Abrir um planejamento leva o professor para onde ele parou — as aulas, se o
 * plano anual está pronto. A suíte precisa do caminho completo, então desce
 * pelos botões de voltar de cada tela até o currículo.
 */
async function voltarAteADistribuicao(p, exp) {
  /* A distribuição se reconhece pelo seu resumo de cobertura, não por "1º
     Bimestre": a tela de AULAS também mostra esse texto, no acordeão das
     semanas, e procurar por ele fazia a volta parar antes de chegar. */
  const naDistribuicao = () =>
    exp
      .getByText(/ainda fora do plano|Currículo do ano coberto/)
      .first()
      .isVisible()
      .catch(() => false);

  /* Abrir um planejamento são DUAS chamadas de api (a lista de planos e, se
     for o caso, a criação do plano anual). Enquanto elas correm, a tela tem
     só o cabeçalho e o Stepper: procurar o botão de voltar aqui falhava com
     "não achei como voltar", quando o certo era esperar. */
  for (let tentativa = 0; tentativa < 30; tentativa += 1) {
    if (await naDistribuicao()) return;
    const voltar = exp.locator("button").filter({ hasText: /^Voltar/ }).first();
    if (await voltar.isVisible().catch(() => false)) {
      await voltar.click();
      await p.waitForTimeout(1500);
    } else {
      await p.waitForTimeout(1000);
    }
  }

  const botoes = (await exp.locator("button").allInnerTexts()).map((t) =>
    t.trim().replace(/\n/g, " · "),
  );
  throw new Error(
    `não cheguei à distribuição em 30 tentativas. Botões na tela: ${JSON.stringify(botoes.slice(0, 12))}`,
  );
}
