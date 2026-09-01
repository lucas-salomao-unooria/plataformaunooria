import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * Uma atividade do Instanooria criada DO ZERO, pela tela, até ficar ativa.
 *
 * É o caminho mais longo do produto e o único que gasta IA de verdade em
 * volume: a pergunta-chave é destilada por um modelo, os dois lados são
 * propostos por ele, e centenas de posts com imagem são gerados em fila.
 *
 * O roteiro cria a atividade com o MÍNIMO de posts (múltiplo de 8: dois lados
 * × quatro perfis de linguagem). Isso não é economia de teste — é o que faz o
 * ciclo caber numa execução sem trocar nada do caminho: as mesmas rotas, o
 * mesmo motor, a mesma fila.
 *
 * O que ele prova e o painel sozinho não provaria:
 *  - a IA propõe perguntas COM NOTA DE EQUILÍBRIO, e a palavra final é do
 *    professor (ele pode reescrever e reanalisar);
 *  - a geração não pode ser aprovada com equilíbrio ruim sem o professor
 *    assumir isso explicitamente;
 *  - a grade de revisão existe e é filtrável ANTES de qualquer criança entrar;
 *  - ativar é um ato separado, e é ele que abre a atividade para a turma.
 */
const TURMA = process.env.TURMA ?? "8A";
/** Múltiplo de 8 (2 lados × 4 perfis): é o piso que o formulário aceita. */
const POSTS_DE_TESE = 8;

/** A atividade criada nesta execução — apagada no fim, mesmo se algo quebrar. */
let criadaNesta = null;

await suite(
  {
    slug: "professor/02-atividade-do-zero",
    papel: "professor",
    titulo: "Uma atividade nascendo",
    subtitulo: "do tema à turma: destilar, aprovar os dois lados, gerar e ativar",
    contexto:
      "O professor traz um recorte de aula. A IA propõe perguntas com dois lados defensáveis e " +
      "mede o equilíbrio de cada uma; ele escolhe, edita ou escreve a sua. Só depois de aprovado " +
      "o antagonismo é que o conteúdo é gerado — e nada chega à turma antes de ele ativar.",
    prova: [
      "A pergunta-chave não é digitada: a IA propõe candidatas com nota de equilíbrio",
      "Os dois lados vêm com tese, argumentos e tom, e são editáveis pelo professor",
      "Gerar com equilíbrio ruim exige o professor assumir isso por escrito",
      "A geração roda em fila, com progresso visível e contagem de imagens",
      "A grade de revisão é filtrável por lado, perfil, intensidade e imagem",
      "Com conteúdo de menos, a api RECUSA ativar e lista as pendências",
      "Ativar é um ato separado — é ele que abre a atividade para a turma",
    ],
    comando: "node scripts/e2e/professor/02-atividade-do-zero.mjs",
  },
  async (r) => {
    const professor = conta("professor", { turma: TURMA });
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(p, professor.login);
    /* O 422 de "conteúdo de menos" é a trava que esta suíte EXERCITA — ver o
       passo da ativação. Sem declará-lo, ele pintaria de vermelho a corrida que
       está justamente provando que ele existe. */
    r.provocado(/422.*\/ativar/, "a trava de volume recusando a ativação com o mínimo de posts");
    try {

    // ── passo 1: tema e recorte ─────────────────────────────────────────
    await p.goto(`${HUB}/professor/atividades/nova`, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("#titulo", { timeout: 20_000 });
    await p.waitForTimeout(1500); // portão de hidratação

    const TITULO = `E2E — Trabalho infantil no século XIX (${new Date().toISOString().slice(11, 19)})`;
    await p.locator("#titulo").pressSequentially(TITULO, { delay: 10 });
    await p.locator("#disciplina").pressSequentially("História", { delay: 15 });
    await p.locator("#recorte").pressSequentially("Revolução Industrial na Inglaterra", { delay: 10 });
    await p.locator("#contexto").pressSequentially(
      "A turma já viu as máquinas a vapor e o êxodo rural.",
      { delay: 5 },
    );
    /* A turma é opcional: sem ela a atividade vale para a escola inteira. Com
       ela, o painel de perfis e a entrada dos estudantes falam da MESMA sala. */
    if (await p.locator("#turma").count()) {
      const opcoes = await p
        .locator("#turma option")
        .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
      const alvo = opcoes.find((o) => o.label.includes(TURMA) && o.value);
      if (alvo) await p.selectOption("#turma", alvo.value);
    }
    await p.locator("#qtd").fill(String(POSTS_DE_TESE));
    await p.waitForTimeout(800);

    await r.registrar(p, "formulario-da-atividade", {
      titulo: "O tema, o recorte e o volume",
      mostra:
        `Título, disciplina, recorte, a turma, ${POSTS_DE_TESE} posts de tese e a proporção de neutros.`,
      prova:
        "A pergunta do debate NÃO é digitada aqui — e o cartão no meio do formulário diz isso. " +
        "Deixar o professor escrever a pergunta antes de medir o equilíbrio dela era o caminho " +
        "mais curto para uma bolha que não se forma.",
      detalhe: `${POSTS_DE_TESE} posts de tese (múltiplo de 8: 2 lados × 4 perfis)`,
      inteira: true,
    });

    await p.getByRole("button", { name: "Analisar pergunta" }).click();
    await p.waitForURL(/\/professor\/atividades\/[0-9a-f-]{36}/, { timeout: 60_000 });
    const atividadeId = p.url().match(/atividades\/([0-9a-f-]{36})/)[1];
    /* Guardada FORA do caminho feliz: se a suíte quebrar no meio, o `finally`
       lá embaixo ainda apaga. Sem isso, cada execução vermelha deixava uma
       atividade órfã no banco de demonstração. */
    criadaNesta = atividadeId;

    // ── passo 2: a IA destila os dois lados ─────────────────────────────
    /* A geração real leva de 10 a 60 s. A CORRIDA contra o alerta é o que
       impede pagar o teto inteiro quando a api já respondeu erro — o ADC
       vencido falha em 300 ms. */
    await esperarOuFalharPorHttp(p, p.locator("text=Perguntas propostas pela IA"), /\/destilar$/, {
      timeout: 180_000,
      oQue: "a destilação da pergunta-chave",
    });
    await p.waitForTimeout(1500);

    const candidatas = p.locator('button[aria-pressed]');
    const quantasCandidatas = await candidatas.count();
    r.exigir(quantasCandidatas >= 2, `a IA propôs ${quantasCandidatas} perguntas candidatas`);
    const notas = await p.locator("text=/equilíbrio \\d+%/").allInnerTexts();
    r.exigir(notas.length > 0, `cada candidata vem com nota de equilíbrio (${notas.join(", ")})`);
    await r.registrar(p, "perguntas-propostas", {
      titulo: "A IA propõe, o professor escolhe",
      mostra: `${quantasCandidatas} perguntas candidatas, cada uma com a nota de equilíbrio e a justificativa.`,
      prova:
        "Equilíbrio é a medida de que os dois lados são defensáveis. Uma pergunta com resposta " +
        "óbvia não forma bolha nenhuma: os dois grupos concordariam, e a aula perderia o objeto.",
      detalhe: notas.join(" · "),
      inteira: true,
    });

    /* A escolha é do professor, e ele pode reescrever: é o que "a palavra final
       é sua" significa na prática. */
    await candidatas.first().click();
    await p.waitForTimeout(800);

    const lados = p.locator('[aria-label^="Rótulo do lado"]');
    await lados.first().waitFor({ timeout: 30_000 });
    const rotulos = await lados.allInnerTexts().catch(async () =>
      Promise.all([lados.nth(0).inputValue(), lados.nth(1).inputValue()]),
    );
    r.exigir((await lados.count()) === 2, "os dois lados chegaram, com rótulo editável");
    await r.registrar(p, "os-dois-lados", {
      titulo: "Os dois lados, editáveis",
      mostra: `Cada lado com rótulo, tese, argumentos e tom típico — ${rotulos.filter(Boolean).join(" × ")}.`,
      prova:
        "O professor pode reescrever tudo. A IA propõe uma leitura do debate; quem conhece a turma " +
        "e o currículo é ele, e é o texto DELE que vira o prompt dos posts.",
      inteira: true,
    });

    // ── passo 3: aprovar e gerar ────────────────────────────────────────
    const equilibrioRuim = await p.locator("text=Gerar mesmo assim").count();
    if (equilibrioRuim) {
      /* A trava: com equilíbrio abaixo do limiar, o botão de gerar fica
         desabilitado até o professor marcar que assume o risco. */
      r.exigir(
        await p.getByRole("button", { name: "Aprovar e gerar conteúdo" }).isDisabled(),
        "com equilíbrio ruim, gerar fica bloqueado até o professor assumir por escrito",
      );
      await p.locator('input[type="checkbox"]').first().check();
      await r.registrar(p, "equilibrio-assumido", {
        titulo: "Equilíbrio ruim exige assumir",
        mostra: "A caixa em que o professor declara que aceita gerar mesmo com a nota baixa.",
        prova:
          "Bloquear de vez seria paternalista: às vezes o professor quer exatamente aquela pergunta. " +
          "O que não pode é ele descobrir depois, com a turma na sala, que a bolha não se formou.",
      });
    }

    const gerar = p.getByRole("button", { name: "Aprovar e gerar conteúdo" });
    r.exigir(!(await gerar.isDisabled()), "com os dois lados aprovados e as categorias neutras, gerar habilita");
    await gerar.click();

    // ── passo 4: a geração em fila ──────────────────────────────────────
    await esperarOuFalharCedo(
      p.locator("text=/Posts criados|Imagens prontas/"),
      p.locator(ALERTA_DE_ERRO),
      { timeout: 120_000, oQue: "o início da geração" },
    );
    await p.waitForTimeout(2500);
    await r.registrar(p, "geracao-em-fila", {
      titulo: "A geração roda em fila, com progresso",
      mostra: "Posts criados, imagens prontas, itens na fila e quantos caíram na arte procedural.",
      prova:
        "A geração é assíncrona e demorada. Sem progresso visível, o professor recarregaria a " +
        "página achando que travou — e cada recarga é uma chance de disparar a fila de novo.",
      inteira: true,
    });

    /**
     * Espera a atividade sair de `gerando` PERGUNTANDO PELO PROGRESSO, e não só
     * pelo status.
     *
     * Não é indiferente: `GET .../geracao/progresso` é a rota que o painel do
     * professor consulta, e é ela que RETOMA a fila órfã — a api não tem
     * retomada no boot, de propósito (o disparo é o polling da tela). Perguntar
     * só `GET /atividades/:id` observa sem empurrar: numa execução os 26 jobs
     * terminaram todos `ok` e a atividade ficou presa em `gerando`, esperando
     * alguém olhar o progresso.
     */
    const ateRevisao = Date.now() + 15 * 60_000;
    let status = "gerando";
    let etapa = "";
    while (Date.now() < ateRevisao) {
      const progresso = await p.request.get(`${BFF}/atividades/${atividadeId}/geracao/progresso`);
      if (progresso.ok()) {
        const corpoDoProgresso = await progresso.json();
        etapa = corpoDoProgresso?.etapa ?? etapa;
        status = corpoDoProgresso?.status ?? status;
      }
      if (status !== "gerando") break;
      await p.waitForTimeout(5000);
    }
    console.log(`      geração: etapa ${etapa}, status ${status}`);
    r.exigir(
      status === "revisao",
      `a geração terminou e a atividade foi para revisão (etapa ${etapa}, status ${status})`,
    );
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3000);

    // ── passo 5: a grade de revisão ─────────────────────────────────────
    const filtros = await p.locator('select[aria-label^="Filtrar por"]').count();
    r.exigir(filtros >= 5, `a grade tem ${filtros} filtros (lado, perfil, intensidade, categoria, imagem, aprovação)`);
    await r.registrar(p, "grade-de-revisao", {
      titulo: "A revisão, antes de qualquer criança entrar",
      mostra: "A grade dos posts gerados, com filtros por lado, perfil de linguagem, intensidade, categoria e imagem.",
      prova:
        "Todo post passa pelo olho do professor antes de virar feed. É o que separa 'a IA gerou' de " +
        "'a escola aprovou' — e é o filtro por INTENSIDADE que deixa ele tirar o que passou do ponto.",
      detalhe: `${filtros} filtros`,
      inteira: true,
    });

    // ── passo 6: a distribuição da turma ────────────────────────────────
    const painelPerfis = p.locator("text=Quem começa de cada lado");
    if (await painelPerfis.count()) {
      await painelPerfis.scrollIntoViewIfNeeded();
      await p.waitForTimeout(1200);
      await r.registrar(p, "distribuicao-da-turma", {
        titulo: "Quem começa de cada lado",
        mostra: "A distribuição prevista da turma entre os dois lados, com a origem do lado de cada estudante.",
        prova:
          "O lado de cada criança vem do perfil medido na Vila do Lume — e, para quem não jogou, de " +
          "um sorteio balanceado. O professor vê a origem ANTES da aula, e pode redistribuir.",
      });
    }

    // ── passo 7: ativar ─────────────────────────────────────────────────
    p.on("dialog", (d) => void d.accept());
    const ativar = p.getByRole("button", { name: "Ativar atividade" });
    await ativar.scrollIntoViewIfNeeded();
    await ativar.click();
    await p.waitForTimeout(4000);

    /**
     * A TRAVA DE VOLUME, e ela é o passo mais interessante desta suíte.
     *
     * Com 8 posts de tese — o mínimo que o formulário aceita — a matriz de
     * 2 lados × 4 perfis fica com uma célula rasa, e a api recusa a ativação
     * com 422 e uma lista de PENDÊNCIAS. Não é bug: é o produto avisando que o
     * feed vai parecer panfleto. A saída existe e é explícita — "Ativar mesmo
     * assim", em vermelho —, porque às vezes o professor quer justamente uma
     * atividade pequena para uma turma pequena.
     */
    const faltaAlgo = await p.locator("text=Ainda falta alguma coisa").count();
    if (faltaAlgo) {
      const pendencias = await p.locator('[class*="alert"], [role="alert"]').last().innerText();
      await r.registrar(p, "trava-de-volume", {
        titulo: "A api recusa ativar com conteúdo de menos",
        mostra: "O aviso com as pendências e o botão de assumir a responsabilidade.",
        prova:
          "Com o mínimo de posts a matriz de 2 lados × 4 perfis fica rasa, e o feed passa a " +
          "parecer panfleto desde o primeiro post. Recusar de vez seria paternalista; avisar e " +
          "deixar o professor decidir é o desenho.",
        detalhe: pendencias.replace(/\s+/g, " ").slice(0, 150),
      });
      await p.getByRole("button", { name: "Ativar mesmo assim" }).click();
      await p.waitForTimeout(4000);
    }

    const depois = await p.request.get(`${BFF}/atividades/${atividadeId}`);
    const statusFinal = (await depois.json())?.atividade?.status;
    r.exigir(statusFinal === "ativa", `a atividade ficou ativa (status: ${statusFinal})`);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
    await r.registrar(p, "atividade-ativa", {
      titulo: "Ativa — a turma pode entrar",
      mostra: "A atividade com o selo de ativa, o relógio da aula e o monitor da turma.",
      prova:
        "Ativar é um ato separado da geração de propósito: o professor pode gerar hoje, revisar " +
        "amanhã e ativar na hora da aula. Enquanto ele não ativa, nenhuma criança entra.",
      detalhe: `status: ${statusFinal}`,
      inteira: true,
    });

    /* Limpeza: esta suíte CRIA uma atividade a cada execução, e um banco de
       demonstração com trinta "E2E — Trabalho infantil" é um banco que ninguém
       consegue mais usar para demonstrar nada. */
    const exclusao = await p.request.delete(`${BFF}/atividades/${atividadeId}`);
    r.exigir(exclusao.ok(), `a atividade de teste foi excluída ao fim (HTTP ${exclusao.status()})`);
    criadaNesta = null;
    } finally {
      if (criadaNesta) {
        await p.request.delete(`${BFF}/atividades/${criadaNesta}`).catch(() => {});
        console.log(`      (a atividade ${criadaNesta} foi apagada apesar da interrupção)`);
      }
    }
  },
);
