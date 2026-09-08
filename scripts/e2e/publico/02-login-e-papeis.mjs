import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * A porta única: quatro papéis, um formulário, quatro destinos.
 *
 * O que só um roteiro de navegador prova aqui: que o ROTEAMENTO POR PAPEL
 * acontece de verdade. A regra vive no middleware e em `app/page.tsx`, e um
 * teste de api nunca a exercita — ela só existe entre o cookie de sessão e o
 * `redirect` do Next. Um papel que caísse na tela de outro seria vazamento de
 * tenancy com cara de bug de navegação.
 *
 * E o caminho negativo: credencial errada não pode passar, e não pode dizer
 * QUAL das duas metades errou (dizer "usuário não existe" entrega a lista de
 * logins da rede a quem estiver adivinhando).
 */
const DESTINOS = [
  {
    papel: "estudante",
    caminho: "/estudante",
    oQueE: "o hub do estudante, com as missões que ele pode abrir",
  },
  {
    papel: "professor",
    caminho: "/professor",
    oQueE: "o hub do professor: trilha, turmas, plano de aula e bem-estar",
  },
  {
    papel: "gestor_escola",
    caminho: "/admin",
    oQueE: "a gestão da escola — pessoas, turmas e importação",
  },
  {
    papel: "gestor_contrato",
    caminho: "/admin",
    oQueE: "a rede inteira: escolas, regionais e períodos letivos",
  },
];

await suite(
  {
    slug: "publico/02-login-e-papeis",
    papel: "publico",
    titulo: "Uma porta, quatro destinos",
    subtitulo: "o roteamento por papel e a recusa de credencial inválida",
    contexto:
      "O mesmo formulário atende estudante, professor, gestor e admin-contrato. Quem decide o " +
      "destino é o papel dentro do token — não a URL que a pessoa digitou. Esta suíte entra com " +
      "as quatro credenciais em sequência e fotografa onde cada uma para.",
    prova: [
      "Cada papel cai no seu próprio ambiente, a partir do mesmo /login",
      "Credencial inválida é recusada sem dizer qual metade errou",
      "Uma rota de outro papel não se alcança digitando a URL",
      "Sair de verdade encerra a sessão: voltar exige logar de novo",
    ],
    comando: "node scripts/e2e/publico/02-login-e-papeis.mjs",
  },
  async (r) => {
    const p = await r.pagina("visitante");

    // ── credencial inválida ──────────────────────────────────────────────
    await p.goto(`${HUB}/login`, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("button[type=submit]");
    await p.waitForTimeout(1500);
    await p.locator("#username").pressSequentially("nao.existe.mesmo", { delay: 20 });
    await p.locator("#password").pressSequentially("senha-errada-de-proposito", { delay: 20 });
    await p.waitForFunction(
      () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
      null,
      { timeout: 10_000 },
    );
    await p.click("button[type=submit]");
    await p.waitForTimeout(3000);

    const recusa = (await p.locator("main").innerText()).replace(/\s+/g, " ");
    r.exigir(new URL(p.url()).pathname === "/login", "credencial inválida não sai do /login");
    r.exigir(
      /incorret|inválid|não foi possível/i.test(recusa),
      "a recusa aparece na tela, e não só no console",
    );
    r.exigir(
      !/usuário não existe|conta não encontrada|senha incorreta para/i.test(recusa),
      "a mensagem NÃO diz qual das duas metades errou — quem adivinha login não recebe confirmação",
    );
    await r.registrar(p, "credencial-recusada", {
      titulo: "Credencial inválida",
      mostra: "O formulário permanece, com o aviso de usuário ou senha incorretos.",
      prova:
        "A mensagem é deliberadamente ambígua entre usuário e senha: dizer 'este usuário não existe' " +
        "transformaria a tela de login num verificador de logins válidos da rede.",
    });

    // ── os quatro papéis ─────────────────────────────────────────────────
    for (const destino of DESTINOS) {
      const credencial = conta(destino.papel);
      await r.entrar(p, credencial.login);
      const caminho = new URL(p.url()).pathname;

      r.exigir(
        caminho.startsWith(destino.caminho),
        `${destino.papel} → ${caminho} (esperado ${destino.caminho}…)`,
      );
      await r.registrar(p, `papel-${destino.papel}`, {
        titulo: `Entrou como ${destino.papel}`,
        mostra: destino.oQueE,
        prova:
          "O destino vem do papel no token, não da URL. Os quatro digitaram a mesma tela de login.",
        detalhe: `${credencial.login} → ${caminho}`,
      });
    }

    // ── uma rota de outro papel não se alcança pela URL ──────────────────
    /* O último login foi o de admin-contrato; a rota do estudante é o teste
       mais claro porque é a que mais tenta: /estudante existe, responde, e o
       middleware precisa recusá-la para quem não é estudante. */
    await p.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    const ondeParou = new URL(p.url()).pathname;
    r.exigir(
      ondeParou !== "/estudante",
      `admin-contrato digitando /estudante foi levado para ${ondeParou}`,
    );
    await r.registrar(p, "rota-de-outro-papel", {
      titulo: "Digitar a rota de outro papel não abre a porta",
      mostra: "O admin-contrato tentou /estudante e foi devolvido ao ambiente dele.",
      prova:
        "A trava é do middleware, não do menu. Esconder o link e deixar a rota aberta seria uma " +
        "porta destrancada com a placa retirada.",
      detalhe: `/estudante → ${ondeParou}`,
    });

    // ── sair encerra a sessão de verdade ─────────────────────────────────
    const sair = p.getByRole("button", { name: /Sair|Encerrar sessão/i }).first();
    if (await sair.count()) {
      await sair.click();
      await p.waitForURL((url) => url.pathname === "/login" || url.pathname === "/", { timeout: 20_000 });
    } else {
      await p.goto(`${HUB}/api/auth/signout`, { waitUntil: "domcontentloaded" });
    }
    await p.goto(`${HUB}/admin/usuarios`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    const depoisDeSair = new URL(p.url()).pathname;
    r.exigir(
      depoisDeSair.startsWith("/login") || depoisDeSair === "/",
      `depois de sair, uma rota interna devolve ao login (foi para ${depoisDeSair})`,
    );
    await r.registrar(p, "sessao-encerrada", {
      titulo: "Sair encerra a sessão",
      mostra: "Voltar a uma rota interna depois de sair devolve ao login.",
      prova:
        "O cookie é apagado no servidor. Sem isso, o computador compartilhado da sala dos professores " +
        "guardaria a sessão de quem usou antes.",
      detalhe: `/admin/usuarios → ${depoisDeSair}`,
    });
  },
);
