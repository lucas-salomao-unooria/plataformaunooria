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
 * O QUE ELA DEIXA NO BANCO: nada, quando chega ao fim. A linha que ela cria em
 * `prospeccao_leads` (e-mail em `@suite-e2e.invalid`, domínio reservado pela
 * RFC 2606, e carimbo de hora no nome) sai pelo próprio produto, no
 * "Eliminar a pedido do titular" (H10.5.2) — o mesmo caminho do titular real.
 * Corrida que cai no meio deixa a linha, e a próxima não depende dela.
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
      "Um visitante SEM SESSÃO abre a janela, envia o cadastro, e a janela fecha deixando a confirmação",
      "O mesmo cadastro aparece no painel da Unooria, com data, organização e cargo",
      "O CSV baixa de verdade, com o separador e o BOM que o Excel em português precisa",
      "O admin elimina o cadastro a pedido do titular, depois de uma confirmação que diz quem sai",
      "A rede (gestor_contrato) não alcança a lista: é o funil comercial da fornecedora",
    ],
    comando: "node scripts/e2e/admin/03-prospeccao.mjs",
  },
  async (r) => {
    // ── 1. o visitante, sem sessão nenhuma ───────────────────────────────
    const visitante = await r.pagina("visitante", { viewport: { width: 1280, height: 900 } });
    /* UM IP FICTÍCIO POR CORRIDA, e é o que torna esta suíte repetível: a rota
       pública aceita 5 cadastros por hora POR IP, e rodar a suíte cinco vezes
       na mesma hora — o que acontece num dia de ajuste — derrubava a sexta com
       429, com o sintoma "a janela não envia" e o produto intacto. O `hub`
       repassa este cabeçalho à api, que o usa só como chave de cota.
       203.0.113.0/24 é a faixa que a RFC 5737 reserva para documentação. */
    await visitante.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${1 + (Date.now() % 250)}` });
    await visitante.goto(`${HUB}/#cadastro`, { waitUntil: "domcontentloaded" });
    const convite = visitante.locator("#cadastro [data-abrir-cadastro]");
    await convite.waitFor({ timeout: 30_000 });

    /* Portão de hidratação: em dev o HTML do servidor chega antes do bundle, e
       nem o clique que ABRE a janela existe antes disso — quem liga os três
       convites é o `efeitos/navegacao.ts`, num `useEffect`. Sem o portão, o
       primeiro clique cai no vazio e a suíte reprova um produto que funciona. */
    await visitante.waitForFunction(
      () => {
        const botao = document.querySelector("#cadastro [data-abrir-cadastro]");
        return botao && Object.keys(botao).some((k) => k.startsWith("__react"));
      },
      null,
      { timeout: 20_000 },
    );

    await convite.click();
    await visitante.locator("#cadastro-dialog[open]").waitFor({ timeout: 15_000 });
    r.exigir(
      await visitante.evaluate(() => document.body.classList.contains("locked")),
      "a janela do cadastro abriu e travou a rolagem da página atrás dela",
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
    /* ENVIAR FECHA A JANELA, e a confirmação fica na página: é o que distingue
       "enviou" de "a janela sumiu". A espera é pelo texto, não pelo fechamento —
       o fechamento sozinho também aconteceria num Cancelar. */
    await visitante.locator("#cadastro-confirmado").waitFor({ timeout: 30_000 });
    /* A rolagem volta pelo evento `close` do `<dialog>`, que o navegador
       entrega em OUTRA tarefa: a confirmação já está na tela quando o `locked`
       ainda não saiu. Ler uma vez reprovava a suíte por um quadro de diferença
       — esperar pelo estado continua provando que ele chega (e o timeout ainda
       reprova se não chegar). */
    await visitante
      .waitForFunction(() => !document.body.classList.contains("locked"), null, { timeout: 10_000 })
      .catch(() => {});
    const depoisDoEnvio = await visitante.evaluate(() => ({
      janelaAberta: document.querySelector("#cadastro-dialog").open,
      travada: document.body.classList.contains("locked"),
      confirmacao: document.querySelector("#cadastro-confirmado").innerText.trim(),
      nomeVazio: document.querySelector("#lead-name").value === "",
      conviteSumiu: document.querySelector("#cadastro [data-abrir-cadastro]") === null,
    }));
    r.exigir(!depoisDoEnvio.janelaAberta, "a janela fecha sozinha ao enviar");
    r.exigir(!depoisDoEnvio.travada, "e a rolagem da página volta");
    r.exigir(
      depoisDoEnvio.confirmacao.includes("Cadastro enviado"),
      `a confirmação fica na página, onde o convite estava ("${depoisDoEnvio.confirmacao}")`,
    );
    r.exigir(depoisDoEnvio.conviteSumiu, "o convite da seção dá lugar à confirmação — não se cadastra duas vezes sem querer");
    r.exigir(depoisDoEnvio.nomeVazio, "os campos foram limpos — reabrir a janela não reenvia o mesmo cadastro");
    await r.registrar(visitante, "cadastro-enviado", {
      titulo: "A janela fecha e a confirmação fica",
      mostra: "“Cadastro enviado. A equipe da Unooria entrará em contato.”, no lugar do convite.",
      prova:
        "A api responde a MESMA coisa se gravou, se o e-mail já se cadastrara na última hora ou se a armadilha pegou um robô. Dizer qual foi transformaria a rota num verificador de quem procurou a Unooria.",
      detalhe: "janela fechada, rolagem devolvida, campos limpos",
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

    // ── 4. eliminar a pedido do titular (H10.5.2) ────────────────────────
    await linha.getByRole("button", { name: "Eliminar a pedido do titular" }).click();
    const confirmacao = p.getByRole("dialog");
    await confirmacao.waitFor({ timeout: 10_000 });
    const textoDaConfirmacao = await confirmacao.innerText();
    r.exigir(
      textoDaConfirmacao.includes(NOME) && /não volta/.test(textoDaConfirmacao),
      "a confirmação diz QUEM sai, e que não volta",
    );
    await r.registrar(p, "eliminar-confirmacao", {
      titulo: "Eliminar a pedido do titular",
      mostra: "A janela de confirmação, com o nome e a organização de quem vai sair da base.",
      prova:
        "É o direito de eliminação da LGPD (art. 18, VI) atendido pela tela, sem o time técnico. Não há editar: cadastro não se edita, só se elimina.",
      detalhe: NOME,
    });
    await confirmacao.getByRole("button", { name: "Eliminar", exact: true }).click();
    await esperarOuFalharCedo(p.getByText("Cadastro eliminado"), p.locator(ALERTA_DE_ERRO), {
      timeout: 15_000,
      oQue: "a confirmação de que o cadastro saiu da base",
    });
    r.exigir((await p.locator("tr", { hasText: NOME }).count()) === 0, "a linha some da lista");
    /* Relida do zero: a linha não pode voltar — apagar é na base, não na tela. */
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: "Atualizar" }).waitFor({ timeout: 30_000 });
    r.exigir((await p.locator("tr", { hasText: NOME }).count()) === 0, "e não volta ao recarregar a página");
    await r.registrar(p, "eliminado", {
      titulo: "O contato saiu da base",
      mostra: "“Cadastro eliminado”, e a lista sem a linha — também depois de recarregar.",
      prova:
        "A linha é apagada de verdade, não marcada. Fica só o registro de que um cadastro foi eliminado, por quem e quando, sem nenhum dado da pessoa.",
      detalhe: NOME,
    });

    // ── 5. a rede não alcança ────────────────────────────────────────────
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
