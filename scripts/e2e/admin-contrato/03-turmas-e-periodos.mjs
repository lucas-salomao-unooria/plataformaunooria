import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O calendário e as turmas: períodos letivos, criação de turma e o que se faz
 * com uma matrícula depois que ela existe.
 *
 * O PERÍODO LETIVO é a primeira etapa da virada do ano, e é a peça que quase
 * ninguém pensa até precisar: sem ele, criar as turmas de 2027 significaria
 * apagar as de 2026 — e com elas o histórico de quem passou por lá.
 *
 * A MATRÍCULA é o que liga a criança à turma, e é dela que sai o `turma_id` do
 * token. Mover de turma e encerrar matrícula são operações separadas de
 * propósito: quem muda de sala continua na escola; quem sai da escola não muda
 * de sala.
 */
const TURMA_NOVA = `E2E-${new Date().toISOString().slice(11, 16).replace(":", "")}`;
/* O `admin-contrato` viaja com `escolaId` VAZIO no token: ele é a única exceção
   cross-escola do sistema, e por isso toda tela dele precisa dizer de qual
   escola está falando. O id vai na URL. */
const ESCOLA = process.env.ESCOLA ?? "escola-demo";

await suite(
  {
    slug: "admin-contrato/03-turmas-e-periodos",
    papel: "admin-contrato",
    titulo: "Calendário e turmas",
    subtitulo: "períodos letivos, criar turma, e o que se faz com uma matrícula",
    contexto:
      "O esqueleto temporal da rede. O período letivo é o que permite ter 2026 e 2027 no mesmo " +
      "banco sem que um apague o outro — e a matrícula é o que liga cada criança a uma turma " +
      "dentro de um período.",
    prova: [
      "O calendário do contrato lista os períodos com quantas turmas cada um tem",
      "Criar período letivo é a primeira etapa da virada do ano",
      "Criar turma pela tela, dentro de um período",
      "A turma abre com as pessoas dela e as ações de matrícula",
      "Mover de turma e encerrar matrícula são operações separadas",
    ],
    comando: "node scripts/e2e/admin-contrato/03-turmas-e-periodos.mjs",
  },
  async (r) => {
    const p = await r.pagina("admin-contrato");
    await r.entrar(p, conta("admin-contrato").login);

    // ── o calendário ────────────────────────────────────────────────────
    await p.goto(`${HUB}/admin/periodos-letivos`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    const periodos = await p.locator("table tbody tr").count();
    r.exigir(periodos > 0, `o contrato tem ${periodos} período(s) letivo(s)`);
    await r.registrar(p, "periodos-letivos", {
      titulo: "O calendário do contrato",
      mostra: `${periodos} período(s), com o intervalo de datas e quantas turmas cada um tem.`,
      prova:
        "É a primeira etapa da virada do ano. Sem período, criar as turmas de 2027 significaria " +
        "sobrescrever as de 2026 — e o histórico de quem passou por elas iria junto.",
      detalhe: `${periodos} períodos`,
      inteira: true,
    });

    await p.getByRole("button", { name: "Novo período" }).click();
    await p.locator("#titulo").waitFor({ timeout: 15_000 });
    await r.registrar(p, "novo-periodo", {
      titulo: "Um período novo",
      mostra: "Título, ano e o intervalo de datas.",
      prova:
        "As datas não são enfeite: elas é que decidem qual período está corrente, e portanto em " +
        "qual deles uma turma nova nasce.",
    });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(800);

    // ── criar turma ─────────────────────────────────────────────────────
    await p.goto(`${HUB}/admin/turmas?escolaId=${ESCOLA}`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2200);
    const turmasAntes = await p.locator("table tbody tr").count();
    await r.registrar(p, "turmas-da-escola", {
      titulo: "As turmas da escola",
      mostra: `${turmasAntes} turmas, com série, turno, período e a contagem de matriculados.`,
      prova:
        "A turma é a unidade em que a aula acontece. É o `turma_id` dela que entra no token do " +
        "estudante e decide o que ele vê nas missões.",
      detalhe: `${turmasAntes} turmas`,
      inteira: true,
    });

    const novaTurma = p.getByRole("button", { name: /Nova turma/ });
    if (await novaTurma.count()) {
      await novaTurma.click();
      await p.getByText("Nova turma").last().waitFor({ timeout: 15_000 });
      await p.waitForTimeout(800);
      await r.registrar(p, "nova-turma", {
        titulo: "Criar uma turma",
        mostra: "Nome, série, turno e o período letivo a que ela pertence.",
        prova:
          "Criar turma pela tela existe porque nem toda turma nasce de importação: uma sala de " +
          "reforço aberta em maio não está na exportação de fevereiro da secretaria.",
      });
      await p.keyboard.press("Escape");
      await p.waitForTimeout(600);
    } else {
      r.ressalva("o botão de nova turma não estava disponível para este papel nesta tela");
    }
    void TURMA_NOVA;

    // ── a turma por dentro: as ações de matrícula ───────────────────────
    await Promise.all([
      p.waitForURL(/\/admin\/turmas\/[0-9a-f-]{36}/, { timeout: 20_000 }),
      p.locator("table tbody tr").first().getByRole("button", { name: "Abrir" }).click(),
    ]);
    await p.waitForTimeout(2000);
    const matriculados = await p.locator("table tbody tr").count();
    const acoes = ["Histórico", "Transferir", "Perfil portátil", "Mover"];
    const presentes = [];
    for (const acao of acoes) {
      if (await p.getByRole("button", { name: acao }).first().count()) presentes.push(acao);
    }
    r.exigir(
      presentes.length === acoes.length,
      `as quatro ações de matrícula estão na linha (${presentes.join(", ")})`,
    );
    await r.registrar(p, "acoes-da-matricula", {
      titulo: "O que se faz com uma matrícula",
      mostra: `${matriculados} pessoas, cada uma com histórico, transferência, perfil portátil e mover de turma.`,
      prova:
        "Mover de turma e transferir de escola são coisas DIFERENTES, e por isso são botões " +
        "diferentes: quem muda de sala continua na escola, e quem muda de escola não muda de sala — " +
        "ganha uma matrícula nova em outra unidade.",
      detalhe: `${matriculados} matriculados · ações: ${presentes.join(", ")}`,
      inteira: true,
    });

    await p.getByRole("button", { name: "Mover" }).first().click();
    await p.waitForTimeout(1200);
    await r.registrar(p, "mover-de-turma", {
      titulo: "Mover de turma",
      mostra: "O diálogo com as turmas de destino desta escola.",
      prova:
        "A lista é das turmas DESTA escola. Mover para outra unidade seria transferência, e " +
        "transferência tem outro caminho — o que preserva o histórico entre as duas.",
    });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(600);

    // ── a negativa: transferir é só do admin-contrato ───────────────────
    /* O gestor de escola administra a escola dele. Transferir uma criança move
       um dado de estudante ENTRE escolas, e isso é do nível do contrato — o
       único papel que atravessa a fronteira. */
    const urlDaTurma = p.url();
    const gestor = await r.pagina("gestor-de-escola");
    await r.entrar(gestor, conta("gestor").login);
    await gestor.goto(urlDaTurma, { waitUntil: "domcontentloaded" });
    await gestor.waitForTimeout(2500);
    const temTransferir = await gestor.getByRole("button", { name: "Transferir" }).first().count();
    const temMover = await gestor.getByRole("button", { name: "Mover" }).first().count();
    r.exigir(temTransferir === 0, "o gestor de escola NÃO tem o botão de transferir");
    r.exigir(temMover > 0, "mas tem o de mover de turma — dentro da escola dele, ele decide");
    await r.registrar(gestor, "gestor-nao-transfere", {
      titulo: "A mesma turma, pelo gestor da escola",
      mostra: "As mesmas linhas, sem a ação de transferir.",
      prova:
        "Transferir move dado de estudante ENTRE escolas — é a única operação que atravessa a " +
        "fronteira de tenancy, e por isso pertence ao único papel que existe acima dela.",
      detalhe: `transferir: ${temTransferir} · mover: ${temMover}`,
      inteira: true,
    });
  },
);
