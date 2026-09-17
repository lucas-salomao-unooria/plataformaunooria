import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * PROSPECÇÃO (ADR-107): do formulário do site até a tela do `admin`.
 *
 * É a única suíte que atravessa as duas pontas do produto numa corrida só —
 * começa SEM SESSÃO, como um visitante, e termina no painel da Unooria. O
 * caminho inteiro é o que ela prova: navegador \seta rota do hub \seta api
 * \seta Postgres \seta painel \seta CSV.
 *
 * Por que não está em `publico/`: aquela suíte é o canário mais barato do
 * runner e não depende da api de propósito (ver `rodar.mjs`). Esta depende, e
 * ainda precisa de uma sessão de `admin` para fechar o ciclo.
 *
 * O QUE ELA DEIXA NO BANCO: uma linha em `prospeccao_leads`, com e-mail em
 * `@suite-e2e.invalid` (domínio reservado pela RFC 2606, então nunca colide com
 * cadastro real) e carimbo de hora no nome. A linha FICA, de propósito: não há
 * rota de exclusão (é decisão da ADR-107, e a tela diz isso), e apagá-la por
 * fora do produto seria a suíte usando um caminho que o produto não tem.
 */

const AGORA = new Date().toISOString().replace(/[:.]/g, "-");
const EMAIL = `suite-${AGORA}@suite-e2e.invalid`.toLowerCase();
const NOME = `Suíte e2e ${AGORA}`;
const ORGANIZACAO = 'Secretaria "Modelo"; Diretoria de TI';

await suite(
  {
    slug: "admin/03-prospeccao",
    papel: "admin",
    titulo: "Quem procurou a Unooria",
    subtitulo: "do formulário do site público até o CSV no painel da fornecedora",
    contexto:
      "O site do ENTRE REDES tem um formulário de interesse. Até a ADR-107 ele escrevia num SQLite fora " +
      "da plataforma, servido por um Worker próprio, com uma listagem protegida por um token no fim da " +
      "URL — um banco, um runtime e um modelo de autorização que não apareciam em diagrama nenhum. " +
      "Agora o cadastro entra pela api, no mesmo Postgres, e quem o lê é o admin da Unooria.",
    prova: [
      "Um visitante SEM SESSÃO envia o cadastro e recebe a confirmação na própria tela",
      "O mesmo cadastro aparece no painel da Unooria, com data, organização e cargo",
      "O CSV baixa de verdade, com o separador e o BOM que o Excel em português precisa",
      "A rede (gestor_contrato) não alcança a lista: é o funil comercial da fornecedora",
    ],
    comando: "node scripts/e2e/admin/03-prospeccao.mjs",
  },
  async (r) => {
    // ── 1. o visitante, sem sessão nenhuma ───────────────────────────────
    const visitante = await r.pagina("visitante", { viewport: { width: 1280, height: 900 } });
    await visitante.goto(`${HUB}/#cadastro`, { waitUntil: "domcontentloaded" });
    await visitante.locator("#registration-form").waitFor({ timeout: 30_000 });

    /* Portão de hidratação: em dev o HTML do servidor chega antes do bundle, e
       o `fill` do Playwright não move o estado do React se o componente ainda
       não hidratou. O sinal é o `onSubmit` existir — e a prova barata é o
       botão responder ao clique, então esperamos o formulário estar montado
       como componente client (o React marca o nó com um handler). */
    await visitante.waitForFunction(
      () => {
        const f = document.querySelector("#registration-form");
        return f && Object.keys(f).some((k) => k.startsWith("__react"));
      },
      null,
      { timeout: 20_000 },
    );

    await visitante.fill("#lead-name", NOME);
    await visitante.fill("#lead-email", EMAIL.toUpperCase()); // o e-mail entra em minúsculas: quem normaliza é a api
    await visitante.fill("#lead-phone", "(11) 98888-7777");
    await visitante.fill("#lead-organization", ORGANIZACAO);
    await visitante.selectOption("#lead-role", "Gestão de rede ou secretaria");
    await visitante.check('input[name="consentimento"]');
    await r.registrar(visitante, "formulario-preenchido", {
      titulo: "O cadastro, preenchido por quem não tem conta",
      mostra: "Nome, e-mail profissional, telefone, organização, cargo e o aceite de contato.",
      prova:
        "Nenhuma sessão existe nesta tela. A defesa da rota não é papel: é o Zod, a cota por IP, o campo-armadilha e o dedupe de uma hora.",
      detalhe: `organização com aspas e ponto-e-vírgula, de propósito: ${ORGANIZACAO}`,
    });

    await visitante.getByRole("button", { name: /Enviar cadastro/ }).click();
    await visitante
      .locator("#registration-status")
      .filter({ hasText: "Cadastro enviado" })
      .waitFor({ timeout: 30_000 });
    const depoisDoEnvio = await visitante.evaluate(() => ({
      classe: document.querySelector("#registration-form").className,
      botao: document.querySelector("#registration-form button[type=submit]").innerText.trim(),
      nomeVazio: document.querySelector("#lead-name").value === "",
    }));
    r.exigir(depoisDoEnvio.classe.includes("is-success"), "o formulário entra no estado de sucesso da folha original");
    r.exigir(depoisDoEnvio.nomeVazio, "os campos foram limpos — não dá para reenviar o mesmo cadastro sem querer");
    await r.registrar(visitante, "cadastro-enviado", {
      titulo: "A confirmação, na própria tela",
      mostra: "“Cadastro enviado. A equipe da Unooria entrará em contato.”, e o botão travado.",
      prova:
        "A api responde a MESMA coisa se gravou, se o e-mail já se cadastrara na última hora ou se a armadilha pegou um robô. Dizer qual foi transformaria a rota num verificador de quem procurou a Unooria.",
      detalhe: `botão: "${depoisDoEnvio.botao}"`,
    });

    // ── 2. o painel da Unooria ───────────────────────────────────────────
    const admin = conta("admin");
    const p = await r.pagina("admin", { viewport: { width: 1440, height: 900 } });
    await r.entrar(p, admin.login, admin.senha ?? senhaDemo());
    await p.goto(`${HUB}/unooria/prospeccao`, { waitUntil: "domcontentloaded" });

    const linha = p.locator("tr", { hasText: NOME });
    await esperarOuFalharCedo(linha, p.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "a linha do cadastro que o visitante acabou de enviar",
    });

    const textoDaLinha = await linha.innerText();
    r.exigir(textoDaLinha.includes(EMAIL), `o e-mail aparece em MINÚSCULAS (${EMAIL}) — foi enviado em maiúsculas`);
    r.exigir(textoDaLinha.includes("Gestão de rede ou secretaria"), "o cargo escolhido aparece na linha");
    r.exigir(
      /\d{2}\/\d{2}\/\d{4}/.test(textoDaLinha),
      "a data está formatada no fuso da plataforma, não em ISO cru (ADR-98/99)",
    );
    await r.registrar(p, "painel", {
      titulo: "A lista de quem procurou a Unooria",
      mostra: "Data, nome, e-mail clicável, telefone, organização e cargo — do mais novo para o mais antigo.",
      prova:
        "É a terceira capacidade que `admin` tem e `gestor_contrato` não: o cliente é o assunto desta lista, não o público dela.",
      detalhe: `e-mail normalizado para ${EMAIL}`,
    });

    // ── 3. o CSV, baixado de verdade ─────────────────────────────────────
    const [download] = await Promise.all([
      p.waitForEvent("download", { timeout: 30_000 }),
      p.getByRole("button", { name: "Baixar CSV" }).click(),
    ]);
    const caminho = await download.path();
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(caminho);
    const csv = bytes.toString("utf8");

    r.exigir(
      download.suggestedFilename() === "cadastros-de-interesse.csv",
      `o arquivo chega nomeado (${download.suggestedFilename()})`,
    );
    r.exigir(
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
      "o arquivo começa com BOM UTF-8 — sem ele o Excel em português abre os acentos errados",
    );
    r.exigir(
      csv.includes('"Data";"Nome";"E-mail";"Telefone";"Organização";"Cargo"'),
      "o cabeçalho usa ponto-e-vírgula: com vírgula, a planilha chega numa coluna só",
    );
    r.exigir(
      csv.includes('"Secretaria ""Modelo""; Diretoria de TI"'),
      "aspas internas dobradas e o ponto-e-vírgula preso dentro do campo — a linha não se desloca",
    );
    await r.registrar(p, "csv", {
      titulo: "O CSV na mão de quem vende",
      mostra: "O mesmo recorte da tela, baixado como arquivo.",
      prova:
        "O arquivo é gerado pela API, não pelo navegador: montá-lo a partir da lista em tela sairia calado com menos linhas do que a base tem, porque a tela mostra um recorte.",
      detalhe: `${csv.split("\n").length - 1} linhas · BOM presente`,
    });

    // ── 4. a rede não alcança ────────────────────────────────────────────
    /* O 403 abaixo é PROVOCADO: ele é a prova, não um defeito. Sem declará-lo,
       o smoke reprovaria a suíte pelo erro de console que ela mesma causou. */
    r.provocado(
      /prospeccao\/cadastros/,
      "o gestor de contrato batendo na lista de cadastros: o 403 é o que esta suíte veio provar",
    );
    const gestor = conta("gestor_contrato");
    const rede = await r.pagina("rede", { viewport: { width: 1280, height: 900 } });
    await r.entrar(rede, gestor.login, gestor.senha ?? senhaDemo());
    const recusa = await rede.evaluate(async () => {
      const resposta = await fetch("/api/plataforma/prospeccao/cadastros", { cache: "no-store" });
      return resposta.status;
    });
    r.exigir(
      recusa === 403 || recusa === 401,
      `o gestor de contrato recebe ${recusa} na lista de cadastros — a guarda é da api, não da tela`,
    );
    /* E a tela: o item nem existe na navegação dele, porque a área é outra. */
    await rede.goto(`${HUB}/unooria/prospeccao`, { waitUntil: "domcontentloaded" });
    await rede.waitForTimeout(1500);
    r.exigir(
      !rede.url().includes("/unooria/"),
      `o middleware devolve o gestor para a casa dele (${rede.url().replace(HUB, "")})`,
    );
    await r.registrar(rede, "rede-nao-alcanca", {
      titulo: "A rede não vê o funil da fornecedora",
      mostra: "O gestor de contrato, devolvido à área dele ao tentar abrir o painel da Unooria.",
      prova:
        "Duas trancas, como no resto do hub: o middleware barra a ÁREA e o `@Roles(\"admin\")` da api barra a ROTA. Uma só seria contornável pela outra ponta.",
      detalhe: `a api respondeu ${recusa}`,
    });
  },
);
