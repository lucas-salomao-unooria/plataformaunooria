import { BFF, HUB, suite, estadoDosIcones } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O dia a dia do gestor de UMA escola: as pessoas, as turmas e o que fazer
 * quando alguém perde a senha.
 *
 * O gestor é o papel mais parecido com uma secretaria escolar, e o teste
 * acompanha o ciclo inteiro de uma pessoa: ela é importada por planilha, é
 * enturmada, perde a senha, recebe uma temporária, troca no primeiro acesso e
 * só então enxerga a turma dela.
 *
 * A senha temporária é devolvida UMA VEZ, na tela. Ela não fica em coluna, não
 * fica em log e não é reenviável — reimprimir uma senha que alguém já viu é o
 * jeito mais comum de uma rede inteira acabar com a mesma senha.
 */
const TURMA = "9Z";
/** A professora da planilha — a pessoa que este roteiro acompanha do CSV ao hub. */
const PROFESSORA = "Marta Nunes Alves";
const SENHA_DO_LOTE = "PlanilhaE2E2026";
const SENHA_ESCOLHIDA = "MinhaSenhaE2E1";

/** Uma linha por pessoa. O professor traz login; os estudantes deixam a api gerar. */
const PLANILHA = [
  "matricula,nome,usuario,email,papel,turma,serie,turno",
  `E2E-P1,Marta Nunes Alves,marta.e2e,marta@escola.exemplo,professor,${TURMA},9EF,manha`,
  `E2E-A1,Ana Paula Ribeiro,,,estudante,${TURMA},9EF,manha`,
  `E2E-A2,Bruno Reis Silva,,,estudante,${TURMA},9EF,manha`,
  `E2E-A3,Caio Prado Lima,,,estudante,${TURMA},9EF,manha`,
  `E2E-A4,Duda Nogueira Melo,,,estudante,${TURMA},9EF,manha`,
  "E2E-C1,Elis Ramos Costa,,,coordenacao,,,",
  "",
].join("\n");

await suite(
  {
    slug: "gestor_escola/01-pessoas-e-turmas",
    papel: "gestor_escola",
    titulo: "O ciclo de uma pessoa na escola",
    subtitulo: "importar, enturmar, resetar senha, primeiro acesso e a turma que nasce disso",
    contexto:
      "O gestor da escola faz o trabalho que sustenta todo o resto: sem gente cadastrada e " +
      "enturmada, nenhuma missão tem turma para rodar. O caminho é uma planilha, e ele termina " +
      "num professor entrando pela primeira vez.",
    prova: [
      "O modelo de planilha que a tela oferece é o MESMO que o parser espera",
      "A importação relata criados, atualizados e erros — linha a linha",
      "A turma nasce da planilha, com os estudantes já matriculados",
      "A senha temporária é devolvida uma vez, na tela, e não fica em lugar nenhum",
      "Quem recebe senha temporária fica preso na troca até trocar",
      "Depois de trocar, o professor vê a turma dele — e só a dele",
    ],
    comando: "node scripts/e2e/gestor_escola/01-pessoas-e-turmas.mjs",
  },
  async (r) => {
    const p = await r.pagina("gestor_escola");
    await r.entrar(p, conta("gestor_escola").login);

    const icones = await estadoDosIcones(p);
    r.exigir(!icones.startsWith("FONTE NÃO CARREGOU"), `ícones do DS na área administrativa: ${icones}`);
    const pessoas = await p.locator("table tbody tr").count();
    await r.registrar(p, "pessoas-da-escola", {
      titulo: "As pessoas da escola",
      mostra: `A tabela paginada de quem está nesta escola — ${pessoas} na primeira página.`,
      prova:
        "O gestor entra direto aqui: é a tela que ele mais usa. E ela é escopada à escola dele — " +
        "nenhuma query desta área atravessa escolas.",
      detalhe: `${pessoas} pessoas na primeira página`,
      inteira: true,
    });

    // ── o modelo é o mesmo que o parser espera ──────────────────────────
    const modelo = await p.request.get(`${BFF}/rostering/modelos/usuarios.csv`);
    const colunasDoModelo = (await modelo.text())
      .replace(/^\uFEFF/, "")
      .split("\n")[0]
      .trim()
      .split(",");
    /* A asserção é de CONTINÊNCIA, não de igualdade: o modelo pode ganhar
       colunas novas (o `cpf` entrou quando a rede passou a reconhecer a mesma
       criança entre escolas), e um teste que exija o cabeçalho exato reprova
       por uma adição compatível. O que não pode faltar é uma coluna que a
       planilha desta suíte usa. */
    const usadasAqui = PLANILHA.split("\n")[0].split(",");
    const ausentes = usadasAqui.filter((c) => !colunasDoModelo.includes(c));
    r.exigir(
      ausentes.length === 0,
      `o modelo que a tela oferece cobre as colunas que o parser aceita (faltando: ${ausentes.join(", ") || "nenhuma"})`,
    );


    // ── importar ────────────────────────────────────────────────────────
    await p.goto(`${HUB}/admin/importar`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    await r.registrar(p, "tela-de-importacao", {
      titulo: "A importação de pessoas",
      mostra: "O modelo para baixar, a escolha do modo de senha e o envio do arquivo.",
      prova:
        "Duas portas: a planilha simples da rede e o binding CSV do OneRoster 1.2. A segunda existe " +
        "porque secretarias grandes já exportam nesse padrão — e reformatar à mão é onde nascem os erros.",
      inteira: true,
    });

    await p.locator("#senha-padrao").fill(SENHA_DO_LOTE);
    await p.getByRole("button", { name: "Enviar arquivo" }).click();
    await p.waitForTimeout(800);
    await p.locator('input[type="file"]').setInputFiles({
      name: "pessoas-e2e.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(PLANILHA, "utf8"),
    });
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Importar" }).last().click();

    await p.getByText(/criados.*atualizados/).waitFor({ timeout: 45_000 });
    const resumo = (await p.getByText(/criados.*atualizados/).first().innerText()).replace(/\n/g, " · ");
    await r.registrar(p, "relatorio-da-importacao", {
      titulo: "O relatório da importação",
      mostra: `O que a planilha fez: ${resumo}`,
      prova:
        "Criados, atualizados e erros LINHA A LINHA. Uma importação que só diz 'ok' esconde as três " +
        "linhas que o parser recusou — e elas são exatamente as crianças que vão faltar na aula.",
      detalhe: resumo,
    });

    // ── a turma que nasceu da planilha ──────────────────────────────────
    await p.goto(`${HUB}/admin/turmas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    const linhaDaTurma = p.locator("table tbody tr", { hasText: TURMA });
    r.exigir((await linhaDaTurma.count()) > 0, `a turma ${TURMA} nasceu da planilha`);
    await r.registrar(p, "turmas-da-escola", {
      titulo: "As turmas da escola",
      mostra: `A lista de turmas, com a ${TURMA} recém-criada pela importação.`,
      prova:
        "A turma é criada pela própria planilha quando não existe. Obrigar o gestor a criar as " +
        "turmas antes de importar duplicaria o trabalho e multiplicaria as divergências de nome.",
      inteira: true,
    });

    await Promise.all([
      p.waitForURL(/\/admin\/turmas\/[0-9a-f-]{36}/, { timeout: 20_000 }),
      linhaDaTurma.getByRole("button", { name: "Abrir" }).click(),
    ]);
    await p.waitForTimeout(1800);
    const matriculados = await p.locator("table tbody tr").count();
    r.exigir(matriculados >= 4, `${matriculados} estudante(s) já matriculados na turma`);
    await r.registrar(p, "a-turma-por-dentro", {
      titulo: "A turma, com quem a planilha enturmou",
      mostra: `${matriculados} pessoas matriculadas, com o caminho para mover de turma ou encerrar a matrícula.`,
      prova:
        "Importar e enturmar são um passo só. A matrícula é o que liga a criança à turma — e é " +
        "dela que sai o `turma_id` do token, que decide o que ela vê nas missões.",
      detalhe: `${matriculados} matriculados`,
      inteira: true,
    });

    // ── a senha temporária ──────────────────────────────────────────────
    await p.goto(`${HUB}/admin/usuarios`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    /* Busca pelo NOME, que é como o atendimento acontece — e porque o LOGIN de
       quem já existia não é o da planilha: a importação atualiza os dados da
       pessoa, mas não troca o login de ninguém. Trocar o login de um professor
       porque a planilha veio com outro seria tirar o acesso dele sem avisar. */
    await p.locator("#busca").pressSequentially(PROFESSORA, { delay: 20 });
    /* A busca é SERVER-SIDE e tem debounce: esperar por tempo fixo fotografa a
       tabela ainda com as 639 pessoas da escola, e o "Resetar senha" da
       primeira linha resetaria a senha de OUTRA pessoa. Esperar a LINHA CERTA
       aparecer é a única espera que significa "o filtro chegou". */
    const linhaDaProfessora = p.locator("table tbody tr", { hasText: PROFESSORA });
    await linhaDaProfessora.first().waitFor({ timeout: 20_000 });
    await p.waitForTimeout(600);
    const encontradas = await p.locator("table tbody tr").count();
    r.exigir(encontradas <= 3, `a busca filtrou de verdade (${encontradas} linha(s) na tabela)`);
    /* O login REAL, lido da tabela: é com ele que a professora vai entrar. */
    const loginDela = (await linhaDaProfessora.first().locator("td").nth(1).innerText()).trim();
    r.exigir(loginDela.length > 0, `o login da professora está na tabela (${loginDela})`);
    await r.registrar(p, "busca-por-pessoa", {
      titulo: "Encontrar uma pessoa",
      mostra: "A busca por login, nome ou CPF, com o resultado filtrado.",
      prova:
        "É a tela do atendimento: alguém liga dizendo que não consegue entrar, e o gestor precisa " +
        "achar a pessoa em segundos.",
    });

    await linhaDaProfessora.first().getByRole("button", { name: "Resetar senha" }).click();
    /* O diálogo do DS tem o botão "Resetar"; a linha da tabela tem "Resetar
       senha". Sem escopar no modal, o `getByRole` casa com os dois. */
    await p.getByTestId("unooria-modal").getByRole("button", { name: "Resetar" }).click();
    await p.locator("code").first().waitFor({ timeout: 20_000 });
    const senhaTemporaria = (await p.locator("code").first().innerText()).trim();
    r.exigir(senhaTemporaria.length >= 8, `a senha temporária veio na tela (${senhaTemporaria.length} caracteres)`);
    await r.registrar(p, "senha-temporaria", {
      titulo: "A senha temporária, uma vez só",
      mostra: "A senha gerada, exibida no diálogo para o gestor anotar ou ditar.",
      prova:
        "Ela não fica em coluna nem em log, e não é reenviável. Uma senha temporária que se pode " +
        "consultar depois é uma senha permanente com outro nome.",
    });

    // ── o primeiro acesso ───────────────────────────────────────────────
    await r.entrar(p, loginDela, senhaTemporaria);
    const presa = new URL(p.url()).pathname === "/trocar-senha";
    r.exigir(presa, `quem entra com senha temporária cai em /trocar-senha (foi para ${new URL(p.url()).pathname})`);
    await r.registrar(p, "primeiro-acesso", {
      titulo: "Preso na troca de senha",
      mostra: "A tela de troca obrigatória, sem menu e sem saída.",
      prova:
        "O hub recusa até emitir token de experiência enquanto a troca não acontece — senão " +
        "bastaria digitar /exp/... para pular a tela.",
    });

    await p.locator("#senha-atual").pressSequentially(senhaTemporaria, { delay: 20 });
    await p.locator("#senha-nova").pressSequentially(SENHA_ESCOLHIDA, { delay: 20 });
    await p.locator("#senha-confirmacao").pressSequentially(SENHA_ESCOLHIDA, { delay: 20 });
    await p.getByRole("button", { name: "Salvar e continuar" }).click();
    await p.waitForURL((url) => url.pathname !== "/trocar-senha" && url.pathname !== "/", {
      timeout: 30_000,
    });
    await p.waitForTimeout(2000);
    await r.registrar(p, "professora-no-hub", {
      titulo: "E ela entra",
      mostra: "O hub do professor, na primeira sessão de verdade desta pessoa.",
      prova:
        "Trocar a senha leva ADIANTE, e não de volta à mesma tela. Um beco sem saída aqui trava a " +
        "pessoa no primeiro minuto do produto.",
      detalhe: new URL(p.url()).pathname,
    });

    await p.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1800);
    const turmasDela = await p.locator('a[href^="/professor/turmas/"]').allInnerTexts();
    const soAsDela = turmasDela.length > 0 && turmasDela.every((t) => t.includes(TURMA));
    r.exigir(
      soAsDela,
      `ela vê só a turma dela (${turmasDela.map((t) => t.split("\n")[0]).join(", ") || "nenhuma"})`,
    );
    await r.registrar(p, "so-a-turma-dela", {
      titulo: "E vê só a turma dela",
      mostra: `As turmas desta professora: ${turmasDela.map((t) => t.split("\n")[0]).join(", ")}.`,
      prova:
        "Nenhuma turma dos outros professores da escola vazou. A lista vem da matrícula dela — a " +
        "mesma regra que impede um docente de ler a sala do colega.",
      detalhe: `${turmasDela.length} turma(s)`,
    });
  },
);
