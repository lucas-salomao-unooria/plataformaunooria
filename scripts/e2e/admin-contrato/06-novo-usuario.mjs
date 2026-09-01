import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * O cadastro unitário visto de cima — e o único papel que não nasce de planilha.
 *
 * O `admin-contrato` cadastra na escola que ELE escolher (`?escolaId=`, a
 * exceção cross-escola do sistema) e é o único que pode criar outro
 * `admin-contrato`. Esse papel não passa pelo importador porque não cabe numa
 * planilha da escola: não tem `escola_id`, não tem lotação e não tem turma.
 * Conceder o alcance da rede inteira é decisão do contrato, nunca de uma
 * unidade — e a suíte do gestor prova o outro lado da mesma regra, com o 403.
 *
 * O último passo é o que fecha o ciclo: o admin recém-criado entra e não chega
 * a lugar nenhum antes de trocar a senha. Nasce provisória como qualquer outra
 * pessoa — o poder do papel não compra exceção à regra do primeiro acesso.
 */
const SELO = new Date().toISOString().slice(11, 19).replace(/:/g, "");
const NOME_DO_PROFESSOR = `Prof Rede ${SELO}`;
const MATRICULA = `E2E-AC-${SELO}`;
const NOME_DO_ADMIN = `Admin Rede ${SELO}`;
const LOGIN_DO_ADMIN = `e2e.admin.${SELO}`;
const SENHA_DO_ADMIN = "AdminDaRede2026";

function combo(modal, rotulo) {
  return modal
    .locator("div.unooria-selection")
    .filter({ has: modal.page().locator(`text="${rotulo}"`) })
    .locator("button[role=combobox]")
    .first();
}

await suite(
  {
    slug: "admin-contrato/06-novo-usuario",
    papel: "admin-contrato",
    titulo: "Cadastrar pessoa em qualquer escola, e o papel da rede",
    subtitulo: "o admin escolhe a unidade, e é o único que pode criar outro admin",
    contexto:
      "O admin do contrato atende a rede inteira: cadastra na escola que indicar, e é o único " +
      "que pode conceder o papel que enxerga todas elas. Esse papel não nasce de planilha — ele " +
      "não pertence a unidade nenhuma, e não há coluna na planilha da escola onde ele caiba.",
    prova: [
      "O admin do contrato precisa dizer em QUAL escola está cadastrando",
      "Ele cadastra professor na unidade escolhida, como o gestor faria",
      "Só ele vê a opção 'Admin do contrato' na lista de papéis",
      "O admin recém-criado nasce com senha provisória e é preso na troca",
    ],
    comando: "node scripts/e2e/admin-contrato/06-novo-usuario.mjs",
  },
  async (r) => {
    const admin = conta("admin-contrato");
    const p = await r.pagina("admin-contrato");
    await r.entrar(p, admin.login, admin.senha ?? senhaDemo());

    /* O id da escola vem da api, não fixado aqui: o seed pode renomear as
       unidades, e um id inventado falharia como "lista vazia" em vez de dizer
       que o nome mudou. */
    const escola = await p.evaluate(async () => {
      const resposta = await fetch("/api/plataforma/escolas");
      const lista = await resposta.json();
      return (Array.isArray(lista) ? lista : []).find((e) => e.tipo === "escola") ?? null;
    });
    r.exigir(Boolean(escola?.id), "o admin do contrato enxerga as escolas da rede");

    await p.goto(`${HUB}/admin/usuarios?escolaId=${encodeURIComponent(escola.id)}`, {
      waitUntil: "domcontentloaded",
    });
    await p.getByRole("button", { name: "Novo usuário" }).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(2000);

    await r.registrar(p, "admin-escolhe-a-escola", {
      titulo: "Antes de cadastrar, dizer onde",
      mostra: `A tela de usuários com o campo 'Escola (id)' preenchido: ${escola.nome}.`,
      prova:
        "O gestor tem uma escola e ela vem do token. O admin do contrato tem todas, e por isso " +
        "precisa DIZER de qual está falando — sem `?escolaId=` a api recusa com 400, em vez de " +
        "escolher uma por ele. É a exceção cross-escola do sistema, e ela é explícita.",
      detalhe: `escolaId: ${escola.id}`,
      inteira: true,
    });

    // ── professor na unidade escolhida ──────────────────────────────────
    await p.getByRole("button", { name: "Novo usuário" }).click();
    const modal = p.locator(".unooria-modal-overlay").last();
    await modal.locator("#novo-nome").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(800);

    await combo(modal, "Papel").click();
    await p.waitForTimeout(600);
    const papeisOferecidos = await p.locator("[role=option]").allInnerTexts();
    r.exigir(
      papeisOferecidos.join(" ").includes("Admin do contrato"),
      `só o admin do contrato vê o papel da rede na lista (viu: ${papeisOferecidos.join(", ")})`,
    );
    await p.locator("[role=option]", { hasText: "Professor" }).first().click();
    await p.waitForTimeout(500);

    await modal.locator("#novo-nome").fill(NOME_DO_PROFESSOR);
    await modal.locator("#novo-matricula").fill(MATRICULA);

    await r.registrar(p, "papeis-do-admin", {
      titulo: "Quatro papéis, não três",
      mostra: `A lista de papéis deste formulário: ${papeisOferecidos.join(" | ")}.`,
      prova:
        "É a única diferença de tela entre gestor e admin do contrato neste formulário — e ela " +
        "não é a tranca. Quem separa os dois é o guard da api: o gestor que chamar a rota do " +
        "papel da rede recebe 403, e a suíte de gestor prova isso.",
      detalhe: papeisOferecidos.join(" | "),
    });

    await modal.getByRole("button", { name: "Criar" }).click();
    await esperarOuFalharCedo(p.getByText("Acesso criado"), p.locator(ALERTA_DE_ERRO), {
      timeout: 45_000,
      oQue: "o cadastro do professor pelo admin do contrato",
    });
    await p.waitForTimeout(800);

    let acesso = p.locator(".unooria-modal-overlay").last();
    const credencialDoProfessor = (await acesso.locator("code").allInnerTexts()).join(" · ");
    await r.registrar(p, "professor-criado-pelo-admin", {
      titulo: "Cadastrar na escola do outro",
      mostra: `${NOME_DO_PROFESSOR} nasce em ${escola.nome}, com login e senha provisória.`,
      prova:
        "A pessoa é gravada na escola do `?escolaId=`, não numa escola do admin — ele não tem " +
        "nenhuma. Toda a escrita continua escopada por `escola_id`; o que muda é quem escolhe o " +
        "valor.",
      detalhe: credencialDoProfessor,
    });
    await acesso.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.waitForTimeout(1200);

    // ── o papel da rede ─────────────────────────────────────────────────
    await p.getByRole("button", { name: "Novo usuário" }).click();
    const modalAdmin = p.locator(".unooria-modal-overlay").last();
    await modalAdmin.locator("#novo-nome").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(600);

    await combo(modalAdmin, "Papel").click();
    await p.waitForTimeout(600);
    await p.locator("[role=option]", { hasText: "Admin do contrato" }).first().click();
    await p.waitForTimeout(600);

    await modalAdmin.locator("#novo-nome").fill(NOME_DO_ADMIN);
    await modalAdmin.locator("#novo-usuario").fill(LOGIN_DO_ADMIN);
    /* Senha definida na hora: o passo seguinte precisa dela para entrar, e ler
       a sorteada do print seria a suíte dependendo do próprio screenshot. */
    /* `check()` no input, não clique no `<span>` do rótulo: o próprio input do
       DS fica por cima e intercepta o clique no texto. */
    await modalAdmin.locator('input[type=radio][value="definir"]').check({ force: true });
    await p.waitForTimeout(400);
    await modalAdmin.locator("#nova-senha").fill(SENHA_DO_ADMIN);

    const semTurma = (await modalAdmin.locator("div.unooria-selection").count()) === 1;
    r.exigir(semTurma, "o formulário do admin do contrato não pede turma nem turno");

    await r.registrar(p, "formulario-do-admin-da-rede", {
      titulo: "O papel que não tem escola",
      mostra:
        "Ao escolher 'Admin do contrato', os campos de turma, turno e matrícula da rede somem do " +
        "formulário.",
      prova:
        "Não é enfeite: esse papel nasce com `escola_id` nulo e sem lotação nenhuma. Manter os " +
        "campos prometeria um vínculo que a api ignora — e vínculo prometido e não gravado é o " +
        "tipo de mentira que só aparece semanas depois, quando alguém procura a pessoa na escola.",
    });

    await modalAdmin.getByRole("button", { name: "Criar" }).click();
    await esperarOuFalharCedo(p.getByText("Acesso criado"), p.locator(ALERTA_DE_ERRO), {
      timeout: 45_000,
      oQue: "o cadastro do admin do contrato",
    });
    await p.waitForTimeout(800);
    acesso = p.locator(".unooria-modal-overlay").last();
    await r.registrar(p, "admin-da-rede-criado", {
      titulo: "Um novo admin do contrato",
      mostra: `${NOME_DO_ADMIN} recebe o login ${LOGIN_DO_ADMIN} e uma senha provisória.`,
      prova:
        "O login desse papel é único na REDE inteira, não na escola: o índice de login por escola " +
        "não cobre linha sem escola, e a autenticação procura o nome de usuário na rede toda. " +
        "Dois donos do mesmo login virariam recusa no login dos dois.",
      detalhe: `login: ${LOGIN_DO_ADMIN}`,
    });
    await acesso.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.waitForTimeout(800);

    // ── ele entra, e não passa da troca de senha ────────────────────────
    const novo = await r.pagina("admin-recem-criado");
    await novo.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
    await novo.locator("#username").pressSequentially(LOGIN_DO_ADMIN, { delay: 20 });
    await novo.locator("#password").pressSequentially(SENHA_DO_ADMIN, { delay: 20 });
    await novo.locator("button[type=submit]:not([disabled])").waitFor({ timeout: 20_000 });
    await novo.locator("button[type=submit]").click();
    await novo.waitForURL(/\/trocar-senha/, { timeout: 30_000 });
    await novo.waitForTimeout(1200);

    r.exigir(
      /\/trocar-senha/.test(novo.url()),
      "o admin recém-criado é preso na troca de senha antes de qualquer tela",
    );
    await r.registrar(novo, "primeiro-acesso-do-admin", {
      titulo: "Nem o admin da rede escapa da troca",
      mostra: "O primeiro acesso do admin recém-criado cai direto em /trocar-senha.",
      prova:
        "A senha entregue no balcão foi vista por quem cadastrou, e por isso vale uma vez só. A " +
        "trava é tripla — middleware, BFF e emissão de token de experiência —, e o papel mais " +
        "poderoso do sistema passa por ela igual a um estudante do 1º ano.",
      inteira: true,
    });
  },
);
