import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * Cadastrar UMA pessoa, sem montar planilha — o balcão que a ADR-59 abriu.
 *
 * O que esta suíte precisa mostrar não é o formulário: é que ele NÃO é um
 * segundo caminho de escrita. Por trás do botão, a plataforma monta a mesma
 * linha de planilha que a escola escreveria e chama o mesmo importador de
 * `/admin/importar` — por isso a pessoa nasce com turma, lotação e senha
 * provisória, exatamente como as importadas, e não uma linha solta em `users`.
 *
 * E prova a AUSÊNCIA que o pedido carrega junto: o gestor não vê "Admin do
 * contrato" na lista de papéis, e a api recusa com 403 quem contornar a tela.
 * A tranca que vale é a segunda — a primeira só evita oferecer o que seria
 * negado. Por isso o roteiro chama a rota na mão, e não confia na tela.
 *
 * ARMADILHA de seletor, medida aqui: o `TextField` do DS não liga `<label>` ao
 * input por `for`, então `getByLabel` não acha campo nenhum — os campos se
 * alcançam pelo `id`. E o combobox do `Selection` precisa ser buscado DENTRO do
 * overlay do modal: a tela por trás tem os seus próprios filtros, o `.first()`
 * casa com um deles, e o clique morre em "overlay intercepts pointer events".
 */
/**
 * Selo por SEGUNDO, não por minuto.
 *
 * As outras suítes reusam matrícula fixa e contam com a idempotência do
 * importador. Aqui não dá: o cadastro unitário é create-only de propósito —
 * repetir a mesma matrícula devolve 409, que é justamente o que o último passo
 * prova. Duas corridas no mesmo minuto colidiriam antes de chegar lá.
 */
const SELO = new Date().toISOString().slice(11, 19).replace(/:/g, "");
const NOME_DO_ESTUDANTE = `Ana Balcao ${SELO}`;
const MATRICULA = `E2E-NU-${SELO}`;

/** O combobox do DS pelo texto do rótulo, escopado no modal aberto. */
function combo(modal, rotulo) {
  return modal
    .locator("div.unooria-selection")
    .filter({ has: modal.page().locator(`text="${rotulo}"`) })
    .locator("button[role=combobox]")
    .first();
}

await suite(
  {
    slug: "gestor/03-novo-usuario",
    papel: "gestor_escola",
    titulo: "Cadastrar uma pessoa no balcão",
    subtitulo: "o formulário que monta a linha da planilha, e o papel que o gestor não pode dar",
    contexto:
      "O gestor percebe, no meio da manhã, que a Ana não entrou na planilha de fevereiro. Até " +
      "aqui o caminho era montar um arquivo de uma linha e importar. Agora há um formulário — e " +
      "ele passa exatamente pelo mesmo importador, para as duas portas nunca divergirem.",
    prova: [
      "A tela de usuários oferece cadastrar e importar, lado a lado",
      "Uma pessoa cadastrada no formulário nasce com turma, login e senha provisória",
      "A senha aparece UMA vez, e a pessoa já consta na lista da escola",
      "O gestor não pode criar admin do contrato: a opção não existe, e a api recusa",
    ],
    comando: "node scripts/e2e/gestor/03-novo-usuario.mjs",
  },
  async (r) => {
    const gestor = conta("gestor_escola");
    const p = await r.pagina("gestor_escola");
    await r.entrar(p, gestor.login, gestor.senha ?? senhaDemo());

    await p.goto(`${HUB}/admin/usuarios`, { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: "Novo usuário" }).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1500);

    await r.registrar(p, "dois-caminhos-de-entrada", {
      titulo: "Duas portas para a mesma coisa",
      mostra:
        "A tela de usuários com os dois botões: 'Importar pessoas', para a planilha da " +
        "secretaria, e 'Novo usuário', para uma pessoa só.",
      prova:
        "Importar continua sendo o caminho do lote. O botão novo existe porque montar um arquivo " +
        "de UMA linha é atrito de balcão — e não porque a plataforma passou a ter dois jeitos de " +
        "criar gente: por baixo, os dois chamam o mesmo importador.",
      inteira: true,
    });

    // ── o formulário ────────────────────────────────────────────────────
    await p.getByRole("button", { name: "Novo usuário" }).click();
    const modal = p.locator(".unooria-modal-overlay").last();
    await modal.locator("#novo-nome").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(800);

    /* Os papéis que ESTE gestor pode dar. Lidos do dropdown aberto, não de uma
       lista repetida aqui: uma cópia diria "passou" no dia em que a tela
       ganhasse a opção que a api recusa. */
    await combo(modal, "Papel").click();
    await p.waitForTimeout(600);
    const papeisOferecidos = await p.locator("[role=option]").allInnerTexts();
    await p.locator("[role=option]", { hasText: "Estudante" }).first().click();
    await p.waitForTimeout(500);

    await modal.locator("#novo-nome").fill(NOME_DO_ESTUDANTE);
    await modal.locator("#novo-matricula").fill(MATRICULA);

    /* A primeira turma real da escola: fixar "8A" aqui faria a suíte falhar
       como "timeout no option" no dia em que o seed renomeasse as turmas. */
    await combo(modal, "Turma").click();
    await p.waitForTimeout(600);
    const opcoesDeTurma = p.locator("[role=option]").filter({ hasText: "—" });
    const turmaEscolhida = (await opcoesDeTurma.first().innerText()).trim();
    await opcoesDeTurma.first().click();
    await p.waitForTimeout(500);

    await r.registrar(p, "formulario-de-cadastro", {
      titulo: "O formulário de uma pessoa",
      mostra:
        `Papel, nome, CPF, matrícula da rede, login, e-mail, turma (${turmaEscolhida}), turno e a ` +
        "senha do primeiro acesso — gerada automaticamente ou definida na hora.",
      prova:
        "A turma se ESCOLHE numa lista, nunca se digita. A importação cria a turma que não " +
        "existe, o que é virtude num arquivo de mil linhas e armadilha aqui: '8A ' com um espaço " +
        "abriria uma segunda oitava série A, indistinguível da primeira na listagem.",
      detalhe: `papéis oferecidos: ${papeisOferecidos.join(" | ")}`,
    });

    await modal.getByRole("button", { name: "Criar" }).click();

    await esperarOuFalharCedo(p.getByText("Acesso criado"), p.locator(ALERTA_DE_ERRO), {
      timeout: 45_000,
      oQue: "o cadastro da pessoa",
    });
    await p.waitForTimeout(800);

    const acesso = p.locator(".unooria-modal-overlay").last();
    const credencial = (await acesso.locator("code").allInnerTexts()).join(" · ");
    r.exigir(credencial.length > 0, "a tela mostra o login e a senha do acesso recém-criado");
    await r.registrar(p, "acesso-criado", {
      titulo: "O acesso sai UMA vez",
      mostra: `Login e senha provisória de ${NOME_DO_ESTUDANTE}, na turma ${turmaEscolhida}.`,
      prova:
        "A senha não fica em coluna nem em log — se a tela perder, o caminho é resetar, não " +
        "consultar. E ela é provisória: o primeiro acesso cai em /trocar-senha sem saída.",
      detalhe: credencial,
    });

    /* `exact`: o X do cabeçalho tem aria-label "Fechar modal" e casaria junto. */
    await acesso.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.waitForTimeout(1200);

    // ── ela está na lista, como qualquer importada ───────────────────────
    await p.locator("#busca").fill(MATRICULA);
    await p.waitForTimeout(3000);
    const linha = await p
      .locator("table tbody tr")
      .first()
      .innerText()
      .catch(() => "");
    r.exigir(
      linha.includes(NOME_DO_ESTUDANTE),
      "a pessoa cadastrada no formulário aparece na busca por matrícula da rede",
    );
    await r.registrar(p, "pessoa-na-lista", {
      titulo: "Ela é uma pessoa como as outras",
      mostra: `A busca pela matrícula ${MATRICULA} encontra ${NOME_DO_ESTUDANTE}, já com turma.`,
      prova:
        "Nasceu pelo mesmo caminho das importadas: linha em `users`, lotação na escola e " +
        "matrícula na turma, na mesma transação. Se o formulário escrevesse por conta própria, o " +
        "que faltaria aqui seria justamente a turma — e ela sumiria da tela do professor.",
      detalhe: linha.replace(/\s+/g, " ").slice(0, 160),
      inteira: true,
    });

    // ── criar é criar: a segunda vez é recusada ──────────────────────────
    r.provocado(/409/, "a suíte cadastra a MESMA matrícula duas vezes, para provar a recusa");
    const repetida = await p.evaluate(async (matricula) => {
      const resposta = await fetch("/api/plataforma/usuarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ papel: "professor", nome: "Ana Balcao De Novo", matricula }),
      });
      return { status: resposta.status, corpo: (await resposta.text()).slice(0, 200) };
    }, MATRICULA);
    r.exigir(
      repetida.status === 409,
      `cadastrar a mesma matrícula de novo é recusado (HTTP ${repetida.status})`,
    );
    await r.registrar(p, "criar-e-criar", {
      titulo: "Criar é criar, não atualizar",
      mostra:
        `A mesma matrícula ${MATRICULA} enviada uma segunda vez: HTTP ${repetida.status}, e nada ` +
        "foi escrito.",
      prova:
        "A importação é idempotente de propósito — reimportar a planilha do ano inteiro não pode " +
        "duplicar ninguém. Num formulário chamado 'Novo usuário' a mesma virtude vira armadilha: " +
        "o gestor digitaria a Ana de novo, a linha antiga seria atualizada e a tela diria " +
        "'criado'. Por isso o cadastro pergunta antes e recusa, apontando o caminho certo.",
      detalhe: `HTTP ${repetida.status} · ${repetida.corpo.replace(/\s+/g, " ")}`,
    });

    // ── a ausência: gestor não cria admin do contrato ────────────────────
    r.exigir(
      !papeisOferecidos.join(" ").includes("Admin do contrato"),
      `o gestor NÃO recebe a opção de criar admin do contrato (viu: ${papeisOferecidos.join(", ")})`,
    );

    r.provocado(/403/, "o gestor chama de propósito a rota de admin do contrato, para provar o 403");
    const recusa = await p.evaluate(async () => {
      const resposta = await fetch("/api/plataforma/usuarios/admin-contrato", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: "Tentativa Pelo Gestor" }),
      });
      return { status: resposta.status, corpo: (await resposta.text()).slice(0, 160) };
    });
    r.exigir(
      recusa.status === 403,
      `a api recusa o gestor na rota de admin do contrato (HTTP ${recusa.status})`,
    );
    /* Reabrir o formulário e o dropdown: os dois passos anteriores provaram pela
       api, e prova de api não tem foto. A ausência precisa ser VISÍVEL — três
       opções na lista, e nenhuma delas é o papel da rede. */
    await p.getByRole("button", { name: "Novo usuário" }).click();
    const modalDeNovo = p.locator(".unooria-modal-overlay").last();
    await modalDeNovo.locator("#novo-nome").waitFor({ timeout: 15_000 });
    await combo(modalDeNovo, "Papel").click();
    await p.waitForTimeout(700);

    await r.registrar(p, "gestor-nao-cria-admin", {
      titulo: "O papel que o gestor não pode dar",
      mostra:
        `A lista de papéis do gestor tem ${papeisOferecidos.join(", ").toLowerCase()} — e mais ` +
        `nada. Chamada direta à rota de admin do contrato: HTTP ${recusa.status}.`,
      prova:
        "Admin do contrato enxerga a rede inteira, e conceder esse alcance é decisão do contrato, " +
        "nunca de uma unidade. A opção ausente na tela é conveniência; o 403 da api é a tranca — " +
        "e é por isso que a suíte chama a rota na mão em vez de confiar no que a tela mostra.",
      detalhe: `HTTP ${recusa.status} · ${recusa.corpo.replace(/\s+/g, " ")}`,
    });
  },
);
