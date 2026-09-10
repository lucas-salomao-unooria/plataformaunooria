import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * O PAINEL DA UNOORIA (ADR-87/88): ligar e desligar o que a rede tem.
 *
 * Esta suíte é do papel `admin` — a conta da Unooria —, e é o único lugar do
 * produto onde `admin` faz algo que `gestor_contrato` não pode. Ela mostra o
 * caminho inteiro: o painel, o escopo, o diálogo que cobra motivo, e a
 * consequência do outro lado (o professor deixa de ver o produto).
 *
 * **NUNCA MEXA NO ESCOPO-CONTRATO AQUI.** A linha com `escola_id` nulo vale
 * para a stack INTEIRA, e a suíte compartilha banco com todas as outras: uma
 * corrida que morra no meio deixa um produto desligado para a rede toda, e as
 * suítes seguintes falham como se o produto tivesse quebrado. O roteiro opera
 * numa ESCOLA e devolve o estado no fim — a mesma razão pela qual
 * `disponibilidade-porta-postgres.spec.ts` também não escreve lá.
 *
 * ARMADILHA de seletor, a mesma de `gestor_escola/03`: o `Selection` do DS é um
 * `button[role=combobox]` dentro de `div.unooria-selection`, e o `<label>` não
 * está ligado ao controle — `getByLabel` não acha nada. E as opções abrem num
 * `[role=option]` que precisa ser buscado DEPOIS do clique.
 */

const PRODUTO = "Como você está?";
const MOTIVO = "Suite e2e: nao contratado neste termo.";

/** O bloco (cartão) de um produto, pelo título dele. */
function cartao(pagina, titulo) {
  return pagina.locator("div.unooria-card").filter({ hasText: titulo }).first();
}

/** O combobox do DS pelo texto do rótulo, escopado num contêiner.
 *  A PÁGINA vem à parte: `escopo` pode ser a própria `Page` (o seletor de
 *  escopo, que vive fora de qualquer cartão), e `Page` não tem `.page()` —
 *  só `Locator` tem. Custou uma corrida com `escopo.page is not a function`. */
function combo(pagina, escopo, rotulo) {
  return escopo
    .locator("div.unooria-selection")
    .filter({ has: pagina.locator(`text="${rotulo}"`) })
    .locator("button[role=combobox]")
    .first();
}

async function escolher(pagina, escopo, rotulo, opcao) {
  await combo(pagina, escopo, rotulo).click();
  await pagina.waitForTimeout(500);
  await pagina.locator("[role=option]", { hasText: opcao }).first().click();
  await pagina.waitForTimeout(600);
}

await suite(
  {
    slug: "admin/01-recursos",
    papel: "admin",
    titulo: "O painel de recursos da Unooria",
    subtitulo: "o que cada rede tem no ar, e o interruptor que fecha o produto sem deploy",
    contexto:
      "Uma rede não contratou o check-in de bem-estar; outra teve uma missão quebrar no meio da " +
      "manhã. Até aqui, as duas coisas se resolviam editando código e fazendo deploy — e para UMA " +
      "rede era impossível, porque a lista de produtos era a mesma para todas as instalações. " +
      "Este painel é o terceiro eixo de acesso da plataforma: não é 'o professor liberou?', é " +
      "'este produto existe nesta rede?'.",
    prova: [
      "O painel lista os quatro produtos e, dentro de cada um, as experiências que o compõem",
      "O escopo escolhe entre a rede inteira, uma regional e uma escola — o mais específico ganha",
      "Desligar exige MOTIVO, e o diálogo avisa quando o alcance é a rede inteira",
      "Desligado na escola, o professor daquela escola deixa de ver o produto",
      "Voltar a herdar devolve tudo — a liberação por turma do professor nunca foi tocada",
    ],
    comando: "node scripts/e2e/admin/01-recursos.mjs",
  },
  async (r) => {
    const admin = conta("admin");
    const professor = conta("professor");
    const escolaDoProfessor = professor.escola.split(" + ")[0].trim();

    const p = await r.pagina("admin");
    await r.entrar(p, admin.login, admin.senha ?? senhaDemo());

    /* O login do `admin` cai DIRETO aqui: a casa dele é o painel da Unooria, e
       não a área administrativa que ele divide com os gestores (ADR-88). */
    await p.waitForURL("**/unooria/recursos", { timeout: 30_000 });
    await cartao(p, PRODUTO).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1200);

    await r.registrar(p, "painel-no-escopo-da-rede", {
      titulo: "O que esta rede tem no ar",
      mostra:
        "Os quatro produtos, cada um com o estado efetivo e as experiências que o manifesto " +
        "declara como parte dele. O escopo abre na rede inteira.",
      prova:
        "A composição produto → experiências é DERIVADA do `produto` do `experiencia.json`: " +
        "nenhuma lista mantida à mão. Experiência nova aparece aqui sozinha, e é isso que " +
        "impede o painel de envelhecer.",
      inteira: true,
    });

    // ── o escopo ────────────────────────────────────────────────────────
    await escolher(p, p, "Escopo", escolaDoProfessor);
    await p.waitForURL("**/unooria/recursos?escolaId=*", { timeout: 20_000 });
    await cartao(p, PRODUTO).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1000);

    /* NÃO CONFIE NA URL. O escopo que as escritas usam sai do painel
       RENDERIZADO, e houve um defeito em que a URL trocava e a tela continuava
       no escopo anterior — o desligamento ia para o contrato, a rede inteira,
       com a tela afirmando que era a escola. A prova é o rótulo do interruptor:
       "Herda de cima" só existe fora do contrato. */
    const rotuloDoInterruptor = await combo(p, cartao(p, PRODUTO), "Neste escopo").innerText();
    if (!rotuloDoInterruptor.includes("Herda de cima")) {
      throw new Error(
        "o painel não está no escopo da ESCOLA (o interruptor diz " +
          `"${rotuloDoInterruptor.trim()}") — desligar aqui atingiria a rede inteira`,
      );
    }

    await r.registrar(p, "escopo-na-escola", {
      titulo: "O mesmo painel, uma escola",
      mostra: `O escopo trocado para ${escolaDoProfessor}. Cada interruptor volta a "Herda de cima".`,
      prova:
        "'Herda' é a AUSÊNCIA de linha neste nível, e é o terceiro estado do controle. Sem ele, " +
        "'ligado nesta escola' ficaria idêntico a 'herdado ligado' — e desfazer uma exceção " +
        "criada por engano seria impossível.",
      detalhe: `escopo na URL: ${new URL(p.url()).searchParams.get("escolaId")}`,
    });

    // ── desligar, com motivo ────────────────────────────────────────────
    await escolher(p, cartao(p, PRODUTO), "Neste escopo", "Desligado");
    const modal = p.locator(".unooria-modal-overlay").last();
    await modal.locator("textarea").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(600);

    const desligar = modal.getByRole("button", { name: "Desligar" });
    const bloqueadoSemMotivo = await desligar.isDisabled();

    await r.registrar(p, "dialogo-cobra-motivo", {
      titulo: "Desligar pede motivo",
      mostra:
        "O diálogo diz o alcance (esta escola e o que estiver abaixo dela) e trava o botão " +
        "enquanto o motivo estiver vazio.",
      prova:
        "'Desligado sem motivo' é o estado que ninguém sabe desfazer: meses depois não há como " +
        "saber se aquilo foi decisão comercial ou incidente que ninguém reverteu. O motivo é " +
        `obrigatório no Zod E no banco. Botão travado sem motivo: ${bloqueadoSemMotivo}.`,
      detalhe: `botão desabilitado sem motivo: ${bloqueadoSemMotivo}`,
    });

    await modal.locator("textarea").fill(MOTIVO);
    await p.waitForTimeout(400);
    await desligar.click();

    await esperarOuFalharCedo(
      cartao(p, PRODUTO).getByText("desligado", { exact: true }),
      p.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "o desligamento do produto na escola" },
    );
    await p.waitForTimeout(800);

    await r.registrar(p, "produto-desligado-na-escola", {
      titulo: "Desligado, e o painel diz por quê",
      mostra:
        "O produto com a etiqueta 'desligado' e, ao lado, o motivo que acabou de ser escrito. " +
        "As experiências dentro dele ficam com o interruptor desabilitado: o produto é um TETO.",
      prova:
        "Mostrar o controle da experiência ativo aqui prometeria uma mudança que o resolvedor " +
        "ignoraria. Ele fica visível e desabilitado, com o motivo ao lado — controle que " +
        "desaparece parece defeito.",
      inteira: true,
    });

    // ── o outro lado: o professor daquela escola ────────────────────────
    const pp = await r.pagina("professor");
    await r.entrar(pp, professor.login, professor.senha ?? senhaDemo());
    await pp.waitForTimeout(1500);

    const cardVisivel = await pp.locator('a[href="/professor/bem-estar"]').count();
    /* A SONDA DO 404 VAI FORA DA PÁGINA (`page.request`), e não por um `fetch`
       dentro dela. O vigia de console da suíte trata todo recurso 4xx como
       erro — corretamente, porque é assim que ele pega imagem quebrada e rota
       de api caída. Uma sonda que ESPERA 404 pinta a suíte de vermelho pelo
       próprio sucesso. `page.request` compartilha os cookies da sessão e não
       gera evento de rede na página. */
    const resposta = await pp.request.get(`${HUB}/professor/bem-estar`);
    const statusDaRota = resposta.status();

    await r.registrar(pp, "professor-nao-ve-o-produto", {
      titulo: "Do outro lado, o produto não existe",
      mostra:
        "A home do professor daquela escola, sem o card do check-in de bem-estar. Os outros " +
        "produtos continuam ali.",
      prova:
        `Esconder o card é UX; a porta é do servidor. O endereço direto responde ${statusDaRota} — ` +
        "e é 404, não uma tela dizendo 'produto desativado': para o professor daquela rede o " +
        "produto não existe, e explicar que existe mas foi desligado contaria ao cliente o que a " +
        "Unooria vendeu a quem.",
      detalhe: `cards do produto na home: ${cardVisivel} · GET /professor/bem-estar: ${statusDaRota}`,
      inteira: true,
    });

    // ── voltar a herdar ─────────────────────────────────────────────────
    /* A ABA DO ADMIN VOLTA À FRENTE, e isto não é zelo: abrir a página do
       professor tirou o foco desta, e o `Selection` do DS fecha no blur — o
       clique abria o dropdown e ele sumia antes de a opção existir. O sintoma é
       um timeout em `[role=option]`, que aponta para o seletor e não para o
       foco. Medido: o listbox abre com as três opções quando a aba está à frente. */
    await p.bringToFront();
    await p.waitForTimeout(400);
    await escolher(p, cartao(p, PRODUTO), "Neste escopo", "Herda de cima");
    await esperarOuFalharCedo(
      cartao(p, PRODUTO).getByText("no ar", { exact: true }),
      p.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "a remoção da exceção" },
    );
    await p.waitForTimeout(800);

    await pp.goto(`${HUB}/professor`, { waitUntil: "domcontentloaded" });
    await pp.locator('a[href="/professor/bem-estar"]').waitFor({ timeout: 30_000 });

    await r.registrar(p, "voltou-a-herdar", {
      titulo: "Desfazer devolve tudo",
      mostra: "O produto de volta a 'no ar', e o interruptor de novo em 'Herda de cima'.",
      prova:
        "Desligar NUNCA apagou a liberação por turma do professor — os dois eixos são " +
        "independentes. Religar devolve a sala exatamente como ela estava, e é por isso que o " +
        "interruptor pode ser usado num incidente sem custo pedagógico.",
      inteira: true,
    });
  },
);
