import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { revelar } from "../lib/abas.mjs";

/**
 * A análise pedagógica da turma — a tela do DEPOIS da aula.
 *
 * Ela mora numa rota própria, e não numa aba da tela da atividade, de
 * propósito: durante a aula o professor deve olhar a sala, não o resultado.
 * Misturar as duas convidaria exatamente o contrário.
 *
 * A primeira seção é a tabela CONCLUSÃO × LADO SEMEADO, e essa ordem não é
 * decorativa — é o resultado experimental da turma, e tudo abaixo dela existe
 * para explicá-la. Se a diagonal for forte, o viés do feed previu a conclusão
 * de quem escreveu antes de saber que havia lados.
 *
 * Esta suíte também cobre o ATO 1: trazer os perfis medidos na Vila do Lume
 * para dentro da atividade do Instanooria. O que mais importa ali é quem ficou
 * DE FORA — nomeado e com motivo. Uma tela que só diga "23 perfis importados"
 * faz o professor achar que a turma inteira entrou.
 */
const TURMA = process.env.TURMA ?? "8A";

await suite(
  {
    slug: "professor/07-analise-da-turma",
    papel: "professor",
    titulo: "A análise da turma",
    subtitulo: "conclusão × lado semeado, o Ato 1 e a planilha para levar embora",
    contexto:
      "Depois da aula, o professor abre a tela que diz se o experimento funcionou naquela turma: " +
      "quantos concluíram do lado em que o feed deles nasceu, quantos inverteram, e quem achou a " +
      "busca sozinho.",
    prova: [
      "A tabela conclusão × lado semeado abre a tela — é o resultado da aula",
      "Cada número traz a base de cálculo, e a inversão aparece ao lado do viés",
      "Estudante por estudante: nome, lado de nascimento, conclusão e envolvimento",
      "Os perfis da Vila do Lume entram nomeando quem ficou de fora, e por quê",
      "A planilha da turma é baixável pelo professor",
    ],
    comando: "node scripts/e2e/professor/07-analise-da-turma.mjs",
  },
  async (r) => {
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(p, conta("professor", { turma: TURMA }).login);

    const lista = await p.request.get(`${BFF}/atividades`);
    const { atividades } = await lista.json();
    const atividade = (atividades ?? []).find((a) => a.sessoes > 0) ?? atividades?.[0];
    if (!atividade) throw new Error("nenhuma atividade no seed — rode `pnpm --filter @edu/api seed:demo`");

    // ── o Ato 1: os perfis vêm da Vila ──────────────────────────────────
    await p.goto(`${HUB}/professor/atividades/${atividade.id}`, { waitUntil: "domcontentloaded" });
    const botaoDaVila = p.locator("button", { hasText: "Trazer perfis da Vila do Lume" }).first();
    if (await botaoDaVila.count()) {
      /* A distribuição dos lados mora na aba Equipes da atividade (ADR-182). */
      await revelar(p, botaoDaVila);
      await botaoDaVila.scrollIntoViewIfNeeded();
      await botaoDaVila.click();
      await p.locator("text=/perfil importado|perfis importados/").first().waitFor({ timeout: 30_000 });
      await p.waitForTimeout(1000);

      const painel = await p.locator("main").innerText();
      const quantos = Number(/(\d+)\s+(?:perfil importado|perfis importados)/.exec(painel)?.[1] ?? 0);
      const temDescartados = /Ficaram de fora/.test(painel);
      r.exigir(
        quantos > 0 || temDescartados,
        `a importação relatou o que fez (${quantos} importados${temDescartados ? ", com descartados nomeados" : ""})`,
      );
      if (temDescartados) {
        r.exigir(
          /curta demais|nenhum valor observado/.test(painel),
          "quem ficou de fora aparece com o MOTIVO, não só na contagem",
        );
      }
      await r.registrar(p, "perfis-do-ato-1", {
        titulo: "O Ato 1 alimenta o Ato 2",
        mostra: `${quantos} perfis medidos na Vila do Lume trazidos para a largada desta atividade.`,
        prova:
          "O lado em que o feed de cada criança nasce vem do que ela FEZ na Vila — não de um " +
          "sorteio. E quem não jogou aparece nomeado: o professor decide se completa à mão ou " +
          "pede para jogar antes.",
        detalhe: `${quantos} importados${temDescartados ? " · descartados nomeados com motivo" : ""}`,
      });
    } else {
      /* O painel do Ato 1 só existe quando a atividade TEM turma: sem ela a
         atividade vale para a escola inteira, e não há de quem importar perfil.
         Dizer isso é diferente de dizer "o botão não estava lá". */
      const detalhe = await p.request.get(`${BFF}/atividades/${atividade.id}`);
      const turma = (await detalhe.json())?.atividade?.turma;
      r.ressalva(
        turma
          ? `o painel do Ato 1 não apareceu para a atividade "${atividade.titulo}" (status ${atividade.status})`
          : `a atividade "${atividade.titulo}" não tem turma — ela vale para a escola inteira, e o ` +
            "Ato 1 importa perfis de UMA turma. O caminho completo está em professor/02-atividade-do-zero",
      );
    }

    // ── a análise ───────────────────────────────────────────────────────
    await p.goto(`${HUB}/professor/atividades/${atividade.id}/analise`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3000);
    const corpo = await p.locator("main").innerText();

    r.exigir(
      /Conclusão × lado em que o feed nasceu/.test(corpo),
      "a tabela conclusão × lado semeado abre a tela",
    );
    const posTabela = corpo.indexOf("Conclusão × lado em que o feed nasceu");
    const posEstudantes = corpo.indexOf("Estudante por estudante");
    r.exigir(
      posEstudantes === -1 || posTabela < posEstudantes,
      "e ela vem ANTES da lista nominal — o resultado da turma primeiro, a explicação depois",
    );
    r.exigir(
      /antes de saber que existia um lado/.test(corpo),
      "a tela explica que a conclusão foi escrita ANTES da revelação",
    );
    await r.registrar(p, "conclusao-por-lado", {
      titulo: "Conclusão × lado em que o feed nasceu",
      mostra: "A matriz da turma: quem nasceu de cada lado e o que escreveu no fim.",
      prova:
        "É o resultado experimental da aula, e o insumo do momento-espelho. Diagonal forte " +
        "significa que o viés previu a conclusão — que é exatamente o que a turma vai discutir.",
      inteira: true,
    });

    if (/A saída que existia/.test(corpo)) {
      await p.locator("text=A saída que existia").scrollIntoViewIfNeeded();
      await p.waitForTimeout(800);
      await r.registrar(p, "a-saida-que-existia", {
        titulo: "A saída que existia",
        mostra: "Quantos usaram a busca, e o que digitaram.",
        prova:
          "A busca devolve o acervo inteiro, sem curadoria de bolha, e ninguém a aponta. Quantos " +
          "descobriram sozinhos é a medida mais interessante da missão.",
      });
    }

    const linhas = await p.locator("table tbody tr").count();
    r.exigir(linhas > 0, `a lista nominal traz ${linhas} linha(s)`);
    await p.locator("text=Estudante por estudante").scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(800);
    await r.registrar(p, "estudante-por-estudante", {
      titulo: "Estudante por estudante",
      mostra: "Nome, perfil do jogo, lado de nascimento, lado de chegada, tempo e envolvimento.",
      prova:
        "O envolvimento é composto de cinco componentes e nunca aparece sem eles — um número " +
        "solitário de 'engajamento' seria exatamente o tipo de métrica que ninguém sabe explicar.",
      detalhe: `${linhas} estudantes`,
      inteira: true,
    });

    // ── a planilha ──────────────────────────────────────────────────────
    const csv = await p.request.get(`${BFF}/atividades/${atividade.id}/analise/csv`);
    const conteudo = await csv.text();
    const linhasCsv = conteudo.trim().split("\n").length;
    r.exigir(csv.ok(), `a planilha da turma baixa (HTTP ${csv.status()}, ${linhasCsv} linhas)`);
    r.exigir(
      (csv.headers()["content-type"] ?? "").includes("csv"),
      `e vem como CSV (content-type: ${csv.headers()["content-type"]})`,
    );
    const temBotao = await p.locator("a", { hasText: "Baixar CSV" }).count();
    r.exigir(temBotao > 0, "e o botão está na tela, não escondido numa rota");
    r.ressalva(
      "a análise da TURMA é nominal porque é a sala do professor; a comparação ENTRE turmas é " +
        "outra tela, do gestor, e ela é agregada",
    );
  },
);
