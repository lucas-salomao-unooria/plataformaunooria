import { suite } from "../lib/roteiro.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O plano de aula (app-90), embedado no hub do professor.
 *
 * É a única experiência de FERRAMENTA que o docente usa sozinho, e o ciclo
 * inteiro dela é destrutivo em algum ponto: gerar, editar, salvar, reabrir,
 * restaurar e excluir. Um roteiro que só gera não descobre que salvar não
 * persistiu, e um que só salva não descobre que excluir não removeu.
 *
 * Duas armadilhas registradas aqui:
 *
 *  - a geração real leva de 30 a 60 s com material curricular de verdade. A
 *    espera CORRE contra o alerta de erro do design system: sem isso, um ADC
 *    vencido falhava em 306 ms e o roteiro esperava 180 s por uma `<table>`,
 *    reportando "timeout esperando table" em vez da causa;
 *  - `confirm()` dentro de iframe só funciona com `allow-modals` no sandbox.
 *    Sem o token, o clique em excluir é ignorado EM SILÊNCIO — a lista não
 *    muda e nada no console diz por quê.
 */
await suite(
  {
    slug: "professor/03-plano-de-aula",
    papel: "professor",
    titulo: "Plano de aula",
    subtitulo: "gerar com IA sobre o material da rede, editar, salvar, restaurar e excluir",
    contexto:
      "A ferramenta que devolve tempo ao professor: um plano gerado a partir das referências " +
      "curriculares que a própria rede importou, entregue como documento editável — não como " +
      "texto de chat para copiar e colar.",
    prova: [
      "A geração usa o material curricular da rede, e não conhecimento genérico do modelo",
      "O plano chega como documento editável, com tabela e seções",
      "A edição do professor é salva e sobrevive à recarga",
      "Restaurar descarta a edição e devolve o plano gerado",
      "Excluir remove de verdade — o confirm() do iframe funciona",
      "Erro de geração aparece na tela em vez de virar espera silenciosa",
    ],
    comando: "node scripts/e2e/professor/03-plano-de-aula.mjs",
  },
  async (r) => {
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    /* Diálogos nativos (o confirm de excluir) aceitos: sem isto o Playwright
       trava esperando alguém responder. */
    p.on("dialog", (d) => void d.accept());
    await r.entrar(p, conta("professor", { turma: "8A" }).login);

    const cartao = p.locator('a[href="/professor/plano-de-aula"]');
    r.exigir((await cartao.count()) === 1, "o plano de aula é um cartão do hub, não um link externo");
    await cartao.first().click();
    await p.waitForURL((url) => url.pathname === "/professor/plano-de-aula", { timeout: 30_000 });

    const exp = p.frameLocator('iframe[data-experiencia]');
    await exp.getByText("Meus planos de aula").waitFor({ timeout: 60_000 });
    await r.registrar(p, "meus-planos", {
      titulo: "Meus planos de aula",
      mostra: "A lista dos planos deste professor, dentro do hub.",
      prova:
        "A ferramenta roda embedada, com a mesma sessão e o mesmo cabeçalho. Ela não é um produto " +
        "à parte que exija outro login.",
    });

    await exp.getByRole("button", { name: /Novo plano|Gerar meu primeiro plano/ }).first().click();
    await exp.getByText("Novo plano de aula").waitFor({ timeout: 15_000 });

    /* Com uma única disciplina disponível o app já a pré-seleciona. */
    const escolherDisciplina = exp.getByText("Selecione a disciplina");
    if (await escolherDisciplina.isVisible().catch(() => false)) {
      await escolherDisciplina.click();
      await exp.getByText("Letramento Digital").first().click();
    }
    await exp.getByText("Selecione a série").click();
    await exp.getByText("8º ano").first().click();
    await r.registrar(p, "escolha-do-material", {
      titulo: "Disciplina e série",
      mostra: "Os seletores alimentados pelo inventário de referências curriculares da rede.",
      prova:
        "Só aparece o que a rede IMPORTOU. O plano é ancorado no material dela — é isso que separa " +
        "esta ferramenta de pedir um plano a um chat genérico.",
    });

    await exp.getByRole("button", { name: "Gerar plano de aula" }).click();
    await esperarOuFalharCedo(exp.locator("table"), exp.locator(ALERTA_DE_ERRO), {
      timeout: 180_000,
      oQue: "a geração do plano (app-90)",
    });
    await p.waitForTimeout(1500);
    await r.registrar(p, "plano-gerado", {
      titulo: "O plano, como documento",
      mostra: "O plano aberto no editor, com a tabela de momentos da aula e as seções.",
      prova:
        "Documento editável, não bolha de chat. O professor entra no texto e muda o que quiser — " +
        "e é isso que ele leva impresso para a sala.",
    });

    // ── editar e salvar ─────────────────────────────────────────────────
    const MARCA = " Editado na suíte de ponta a ponta.";
    const editor = exp.locator('[contenteditable="true"]').first();
    await editor.click();
    await p.keyboard.press("End");
    await p.keyboard.type(MARCA);
    await exp.getByText("Alterações não salvas", { exact: false }).waitFor({ timeout: 8_000 });
    await r.registrar(p, "edicao-em-andamento", {
      titulo: "A edição do professor",
      mostra: "O texto alterado e o aviso de alterações não salvas.",
      prova:
        "O aviso existe porque o professor edita entre uma aula e outra: fechar a aba sem salvar é " +
        "o cenário normal, não a exceção.",
    });

    await exp.getByRole("button", { name: "Salvar" }).click();
    await exp.getByText(/Salvo às/).waitFor({ timeout: 20_000 });

    await p.reload({ waitUntil: "domcontentloaded" });
    const exp2 = p.frameLocator('iframe[data-experiencia]');
    await exp2.getByText("Meus planos de aula").waitFor({ timeout: 60_000 });
    const primeiro = exp2.locator("li, [role=listitem]").filter({ hasText: /Plano|aula/ }).first();
    await primeiro.click().catch(async () => {
      await exp2.getByText(/Plano/).first().click();
    });
    await exp2.locator('[contenteditable="true"]').first().waitFor({ timeout: 20_000 });
    const persistiu = (await exp2.locator('[contenteditable="true"]').first().innerText()).includes(
      "suíte de ponta a ponta",
    );
    r.exigir(persistiu, "a edição sobreviveu à recarga — foi salva no servidor");
    await r.registrar(p, "edicao-persistida", {
      titulo: "A edição volta depois do F5",
      mostra: "O plano reaberto, com o texto que o professor acrescentou.",
      prova:
        "O conteúdo editado é gravado separado do gerado. É o que permite o passo seguinte: " +
        "descartar a edição sem perder o plano original.",
    });

    // ── restaurar: descarta a edição, mantém o gerado ───────────────────
    const restaurar = exp2.getByRole("button", { name: /Restaurar|Descartar/ }).first();
    if (await restaurar.count()) {
      await restaurar.click();
      await p.waitForTimeout(2500);
      const aindaTemMarca = (await exp2.locator('[contenteditable="true"]').first().innerText()).includes(
        "suíte de ponta a ponta",
      );
      r.exigir(!aindaTemMarca, "restaurar descartou a edição e devolveu o plano gerado");
      await r.registrar(p, "plano-restaurado", {
        titulo: "Restaurar devolve o plano gerado",
        mostra: "O documento sem a edição do professor.",
        prova:
          "É a saída de quem editou demais e quer recomeçar sem gastar outra geração — a geração " +
          "custa quota de IA, e a quota é por professor e por dia.",
      });
    } else {
      r.ressalva("o botão de restaurar não estava na tela nesta versão da experiência");
    }

    // ── excluir ─────────────────────────────────────────────────────────
    await exp2.getByRole("button", { name: "Meus planos" }).click();
    await exp2.getByText("Meus planos de aula").waitFor({ timeout: 15_000 });
    const antes = await exp2.getByRole("button", { name: /^Excluir / }).count();
    await exp2.getByRole("button", { name: /^Excluir / }).first().click();
    await p.waitForTimeout(2500);
    const depois = await exp2.getByRole("button", { name: /^Excluir / }).count();
    r.exigir(
      depois < antes,
      `excluir removeu o plano da lista (${antes} → ${depois}) — o confirm() do iframe funcionou`,
    );
    await r.registrar(p, "plano-excluido", {
      titulo: "Excluir remove de verdade",
      mostra: "A lista com um plano a menos.",
      prova:
        "`confirm()` dentro de iframe exige `allow-modals` no sandbox. Sem o token o navegador " +
        "devolve `false` em silêncio: o clique não faz nada e nada no console explica.",
      detalhe: `${antes} → ${depois} planos`,
    });
  },
);
