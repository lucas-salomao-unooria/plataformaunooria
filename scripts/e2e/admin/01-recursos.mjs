import { BFF, HUB, suite } from "../lib/roteiro.mjs";
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
 * O QUE ELA DEIXA NO BANCO, de propósito: as linhas de `recursos_auditoria`
 * (ADR-89) das duas mudanças que ela faz. Elas NÃO são limpas — o histórico é
 * append-only, e apagar o registro do que aconteceu de verdade seria mentir na
 * própria tela que esta suíte prova. É o contrário das `disponibilidades`, que
 * ela devolve ao estado anterior porque ali a linha MUDA o produto. Em dev isso
 * dá conteúdo real à tela da rede; se um dia incomodar, o lugar de apagar é o
 * `conferir-catalogo-remoto.mjs`, que sabe o que é fixture.
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
      "Uma rede não contratou o acompanhamento de bem-estar; outra teve uma missão quebrar no meio da " +
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
      "A janela de versão mostra o histórico publicado e diz quando a experiência está em rollback",
      "O histórico registra cada mudança com o motivo e o nome de quem a fez — e sem UPDATE possível",
      "A REDE lê o histórico dela em /admin/recursos, e não alcança nenhuma escrita (403)",
      "O Porta-Voz dos Dados (exp03em1b) aparece no Entre Redes e DESLIGA na escola: a rota do estudante responde 403 recurso-indisponivel, e herdar devolve o acesso",
      "As imagens do banco padrão do Júri Estadual: a tela do admin com o progresso “X de 40”, uma aba por área — e o professor recebe 403",
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
    /* H01.2.2: a barra lateral só tem o que leva a algum lugar. O "Iniciativas"
       do DS abriria um painel de aplicativos que este hub não tem. */
    r.exigir(
      (await p.locator(".unooria-sidebar").getByText("Iniciativas").count()) === 0,
      "a barra lateral da Unooria não mostra o \"Iniciativas\", que não levava a lugar nenhum",
    );

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

    /* A missão mais nova (exp01em1b, ADR-185) entra no Entre Redes pelo
       `produto` do manifesto, com o interruptor próprio (regra 8): o modo de
       falhar seria MUDO — a missão abriria para todos e não haveria como
       desligá-la nesta rede. */
    const linhaDoAssistente = cartao(p, "Entre Redes").locator("li").filter({ hasText: "exp01em1b" });
    r.exigir(
      (await linhaDoAssistente.count()) === 1 &&
        (await linhaDoAssistente.innerText()).includes("O Assistente Invisível") &&
        (await linhaDoAssistente.locator("button[role=combobox]").count()) === 1,
      "O Assistente Invisível (exp01em1b) aparece dentro do Entre Redes, com o interruptor “Neste escopo”",
    );

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

    /* Quantas linhas o histórico JÁ tem neste escopo, medido ANTES de mexer em
       nada. Corridas anteriores deixam registro (é append-only de propósito),
       então o número absoluto não diz nada — a DIFERENÇA diz: as duas mudanças
       deste roteiro têm de aparecer sem recarregar a página, e é isso que o
       `key` que remonta a lista garante. Sem ele, esta conta fecha em 0. */
    const historicoAntes = await p.locator("table").last().locator("tbody tr").count();

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
        "A home do professor daquela escola, sem o cartão do acompanhamento de bem-estar. Os outros " +
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

    // ── o histórico (ADR-89) ────────────────────────────────────────────
    /* A tabela vive na MESMA página, abaixo dos produtos, e ela precisa ter as
       DUAS linhas que este roteiro acabou de gravar — sem recarregar nada. Se
       aparecer só a primeira, o `key` que remonta a lista voltou a faltar: a
       lista busca na montagem, e sem a chave a tela mente sobre o que ela mesma
       fez (foi assim que o defeito apareceu). */
    const historico = p.locator("table").last();
    await historico.waitFor({ timeout: 30_000 });
    await historico.getByText("Voltou a herdar").first().waitFor({ timeout: 20_000 });
    await historico.getByText("Desligado", { exact: false }).first().waitFor({ timeout: 20_000 });
    await historico.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);

    const linhasDoHistorico = await historico.locator("tbody tr").count();
    r.exigir(
      linhasDoHistorico === historicoAntes + 2,
      `o histórico releu sozinho: ${historicoAntes} linhas antes, ${linhasDoHistorico} depois ` +
        "(o desligamento e o retorno a herdar) — sem recarregar a página",
    );
    const motivoNaTabela = (await historico.innerText()).includes(MOTIVO);
    r.exigir(
      motivoNaTabela,
      "o motivo escrito no diálogo aparece no histórico — é o que a rede vai ler",
    );

    await r.registrar(p, "historico-do-painel", {
      titulo: "Quem mudou, quando e por quê",
      mostra:
        "As duas mudanças que este roteiro acabou de fazer, na ordem inversa: o desligamento " +
        "com o motivo escrito no diálogo, e o retorno a herdar. A lista se atualizou sozinha, " +
        "sem recarregar a página.",
      prova:
        "A linha de disponibilidade é SOBRESCRITA a cada mudança — ela responde o estado de " +
        "agora, não a história. Este registro é append-only de verdade: UPDATE é recusado por " +
        "trigger no banco, e a role da aplicação só tem SELECT, INSERT e DELETE. O nome de quem " +
        "operou fica CONGELADO na linha, porque o histórico tem de dizer quem era aquela pessoa " +
        "naquele dia, e não o nome de hoje.",
      detalhe:
        `linhas no histórico: ${historicoAntes} antes, ${linhasDoHistorico} depois ` +
        `· motivo presente: ${motivoNaTabela}`,
      inteira: true,
    });

    // ── a missão mais nova DESLIGA (exp03em1b, ADR-198) ─────────────────
    /* Regra 8 inteira para O Porta-Voz dos Dados: entrar no painel não basta —
       ela tem de DESLIGAR. Desligada na escola, o funil das rotas do estudante
       (`exigirMissaoLiberada` → `exigirRecursoDisponivel`) responde 403
       `recurso-indisponivel` mesmo com a missão liberada na sala; herdar de
       volta devolve o acesso. Feito DEPOIS da conta do histórico, que mede as
       duas mudanças do produto. A sonda vai por `page.request`: um 403 esperado
       no console pintaria a suíte de vermelho pelo próprio sucesso. */
    const linhaDoPortaVoz = cartao(p, "Entre Redes").locator("li").filter({ hasText: "exp03em1b" });
    r.exigir(
      (await linhaDoPortaVoz.count()) === 1 &&
        (await linhaDoPortaVoz.innerText()).includes("O Porta-Voz dos Dados") &&
        (await linhaDoPortaVoz.locator("button[role=combobox]").count()) === 1,
      "O Porta-Voz dos Dados (exp03em1b) aparece dentro do Entre Redes, com o interruptor “Neste escopo”",
    );
    const estudanteTerceiraEM = conta("estudante", { turma: "3EM-A" });
    const pe = await r.pagina("estudante 3EM");
    await r.entrar(pe, estudanteTerceiraEM.login, estudanteTerceiraEM.senha || senhaDemo());
    const sessaoDoPortaVoz = async () => {
      const resp = await pe.request.get(`${HUB}/api/plataforma/porta-voz-dos-dados/sessao`);
      return { status: resp.status(), codigo: (await resp.json().catch(() => null))?.codigo ?? null };
    };
    const antesDeDesligar = await sessaoDoPortaVoz();

    await p.bringToFront();
    await p.waitForTimeout(400);
    await escolher(p, linhaDoPortaVoz, "Neste escopo", "Desligado");
    const modalDaMissao = p.locator(".unooria-modal-overlay").last();
    await modalDaMissao.locator("textarea").waitFor({ timeout: 15_000 });
    await modalDaMissao.locator("textarea").fill(MOTIVO);
    await p.waitForTimeout(400);
    await modalDaMissao.getByRole("button", { name: "Desligar" }).click();
    await esperarOuFalharCedo(
      linhaDoPortaVoz.getByText(/desligad/i),
      p.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "o desligamento do Porta-Voz dos Dados na escola" },
    );
    const desligada = await sessaoDoPortaVoz();
    r.exigir(
      desligada.status === 403 && desligada.codigo === "recurso-indisponivel",
      `desligada na escola, a rota do estudante da 3EM-A responde 403 recurso-indisponivel (${desligada.status} ${desligada.codigo ?? ""}; antes: ${antesDeDesligar.status})`,
    );
    await linhaDoPortaVoz.scrollIntoViewIfNeeded();
    await r.registrar(p, "porta-voz-desligado", {
      titulo: "O Porta-Voz dos Dados desliga nesta escola",
      mostra: "A linha da exp03em1b dentro do Entre Redes com o interruptor em Desligado e a explicação do estado.",
      prova:
        "Experiência nova nasce com interruptor (regra 8): desligada, o estudante recebe 403 recurso-indisponivel " +
        "no funil da missão, mesmo com ela liberada na sala — a disponibilidade é PRÉ-CONDIÇÃO da liberação.",
      detalhe: `GET /porta-voz-dos-dados/sessao: ${antesDeDesligar.status} antes, ${desligada.status} desligada`,
    });

    await escolher(p, linhaDoPortaVoz, "Neste escopo", "Herda de cima");
    await linhaDoPortaVoz.getByText(/desligad/i).waitFor({ state: "detached", timeout: 30_000 });
    const religada = await sessaoDoPortaVoz();
    r.exigir(
      religada.status === antesDeDesligar.status,
      `herdando de novo, a rota do estudante volta ao que era (${religada.status})`,
    );

    // ── o mesmo histórico, do lado da REDE ──────────────────────────────
    /* A assimetria da ADR-88 medida nas duas direções, com a conta do
       CONTRATO: ela LÊ o histórico e não alcança escrita nenhuma. As sondas vão
       por `page.request` (fora da página) porque o vigia de console trata 4xx
       como erro — uma sonda que ESPERA 403 pintaria a suíte de vermelho pelo
       próprio sucesso. */
    const gestor = conta("gestor_contrato");
    const pr = await r.pagina("rede");
    await r.entrar(pr, gestor.login, gestor.senha ?? senhaDemo());
    await pr.goto(`${HUB}/admin/recursos`, { waitUntil: "domcontentloaded" });
    const tabelaDaRede = pr.locator("table").last();
    await tabelaDaRede.waitFor({ timeout: 30_000 });
    await pr.waitForTimeout(800);
    r.exigir(
      (await pr.locator(".unooria-sidebar").getByText("Iniciativas").count()) === 0 &&
        (await pr.locator(".unooria-sidebar").count()) === 1,
      "a barra lateral da gestão também não mostra o \"Iniciativas\"",
    );

    const escritaNegada = await pr.request.put(`${HUB}/api/plataforma/recursos/produto:bem-estar`, {
      data: { ligado: false, motivo: "sonda da suite: isto tem de ser recusado" },
      failOnStatusCode: false,
    });
    const painelNegado = await pr.request.get(`${HUB}/api/plataforma/recursos/painel`, {
      failOnStatusCode: false,
    });
    r.exigir(
      escritaNegada.status() === 403 && painelNegado.status() === 403,
      `a rede não escreve nem abre o painel (PUT ${escritaNegada.status()}, painel ${painelNegado.status()})`,
    );

    await r.registrar(pr, "a-rede-le-o-historico-dela", {
      titulo: "Do lado da rede: o registro, sem os interruptores",
      mostra:
        "A mesma tabela em /admin/recursos, na área administrativa da rede — e nenhum controle. " +
        "A copy diz quem opera: 'Quem opera estes interruptores é a Unooria; esta tela é o registro.'",
      prova:
        "É a ÚNICA rota de /recursos/* que a rede alcança, e a exceção é declarada: ler por que o " +
        `produto da própria rede mudou de estado é informação do cliente; decidir o estado não é. ` +
        `Medido nesta corrida: PUT /recursos/:id responde ${escritaNegada.status()} e ` +
        `GET /recursos/painel responde ${painelNegado.status()} para o gestor do contrato. ` +
        "Gestor de escola e de regional não entram nem na tela (404): o histórico é do CONTRATO, e " +
        "recortá-lo por unidade daria a uma escola a notícia de que a rede perdeu um produto antes " +
        "de a coordenação da rede saber.",
      inteira: true,
    });

    await p.bringToFront();
    await p.waitForTimeout(400);

    // ── a versão ────────────────────────────────────────────────────────
    /* De volta ao escopo da REDE: é ali que "ativar" existe. Fixar versão é a
       alavanca do escopo menor, e as duas nunca aparecem juntas — fixar no
       contrato seria um segundo jeito, mais fraco, de fazer o que ativar faz
       (ele não restaura o manifesto da versão). */
    await p.goto(`${HUB}/unooria/recursos`, { waitUntil: "domcontentloaded" });
    await cartao(p, PRODUTO).waitFor({ timeout: 30_000 });
    await p.waitForTimeout(800);

    const etiquetaDeVersao = p.locator("button[aria-label^='Versão de']").first();
    await etiquetaDeVersao.click();
    const janela = p.locator(".unooria-modal-overlay").last();
    await janela.locator("button[role=combobox]").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(900);

    const acoesOferecidas = await janela.getByRole("button").allInnerTexts();

    await r.registrar(p, "janela-de-versao", {
      titulo: "Que versão está no ar, e quais existem",
      mostra:
        "O histórico publicado da experiência, com a que está no ar marcada, e a única alavanca " +
        "que o escopo da rede oferece: ativar.",
      prova:
        "Ativar troca a versão E RESTAURA o manifesto daquela versão — viewport, permissões de " +
        "iframe, séries. É o defeito que o histórico existe para consertar: " +
        "'publicar-manifesto.mjs --versao' mandava o número antigo com o manifesto ATUAL, e a " +
        "app-70 reabria sem 'allow-pointer-lock' — a criança entrava na Vila e a câmera não " +
        "girava, sem erro em lugar nenhum.",
      detalhe: `ações oferecidas no escopo da rede: ${acoesOferecidas.filter(Boolean).join(" | ")}`,
      inteira: true,
    });

    await janela.getByRole("button", { name: "Fechar", exact: true }).click();
    await p.waitForTimeout(400);

    // ── as imagens do banco padrão do Júri Estadual (exp06ef1b) ─────────
    /* Conteúdo de PRODUTO, o mesmo para toda rede: o cartão fica no fim de
       Recursos, fora do escopo do painel. Uma imagem por projeto do banco
       padrão (40), gerada uma vez pela conta da Unooria; o storage é o
       registro. A suíte prova a tela, o progresso e a guarda de papel. GERAR
       custa (IA real, e as 40 levam minutos): a rodada de geração — UMA ida,
       até quatro imagens — só roda com `E2E_GERAR_IMAGENS_DO_JURI=1`. */
    await p.goto(`${HUB}/unooria/recursos`, { waitUntil: "domcontentloaded" });
    const cartaoDoBanco = cartao(p, "Conteúdo padrão das missões");
    await cartaoDoBanco.waitFor({ timeout: 30_000 });
    const linkDoBanco = cartaoDoBanco.locator('a[href="/unooria/recursos/imagens-do-juri"]');
    r.exigir(
      (await linkDoBanco.count()) === 1,
      "Recursos tem o cartão “Conteúdo padrão das missões” com o caminho para as imagens do banco do Júri",
    );
    await linkDoBanco.click();
    await p.waitForURL("**/unooria/recursos/imagens-do-juri", { timeout: 30_000 });
    const telaDoBanco = p.locator("[data-imagens-do-banco-do-juri]");
    await esperarOuFalharCedo(telaDoBanco, p.locator(ALERTA_DE_ERRO), {
      timeout: 60_000,
      oQue: "a tela das imagens do banco padrão do Júri",
    });
    const lerBanco = async (pagina) => {
      const resposta = await pagina.request.get(`${BFF}/juri-estadual/banco-padrao/imagens`);
      return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
    };
    const banco = await lerBanco(p);
    r.exigir(
      banco.status === 200 && banco.corpo?.total === 40 && banco.corpo.prontas + banco.corpo.faltam.length === 40,
      `a api do banco padrão responde ao admin: ${banco.corpo?.prontas} de ${banco.corpo?.total} prontas, ${banco.corpo?.faltam?.length} faltando (HTTP ${banco.status})`,
    );
    const progressoNaTela = `${banco.corpo?.prontas} de ${banco.corpo?.total}`;
    r.exigir(
      (await telaDoBanco.getByRole("heading", { name: "Imagens do banco padrão do Júri Estadual" }).count()) > 0 &&
        (await telaDoBanco.getByText(progressoNaTela).count()) > 0,
      `a tela “Imagens do banco padrão do Júri Estadual” mostra o progresso da api: “${progressoNaTela}”`,
    );
    const gerarBanco = telaDoBanco.getByRole("button", { name: "Gerar as imagens que faltam" });
    r.exigir(
      (await gerarBanco.count()) === 1 && (await gerarBanco.isDisabled()) === Boolean(banco.corpo?.completo),
      `o botão “Gerar as imagens que faltam” existe, e só fica desligado com as 40 prontas (completo=${banco.corpo?.completo})`,
    );
    /* Só a aba aberta é desenhada: a prova dos 40 anda pelas quatro. */
    const abasDoBanco = telaDoBanco.getByRole("tab");
    const porAba = [];
    for (let i = 0; i < (await abasDoBanco.count()); i += 1) {
      await abasDoBanco.nth(i).click();
      await p.waitForFunction((el) => el.getAttribute("aria-selected") === "true", await abasDoBanco.nth(i).elementHandle(), {
        timeout: 10_000,
      });
      porAba.push({
        rotulo: (await abasDoBanco.nth(i).innerText()).replace(/\s+/g, " ").trim().replace(/^add /, ""),
        itens: await telaDoBanco.locator("[data-imagem-do-banco]").count(),
      });
    }
    if (porAba.length > 0) await abasDoBanco.first().click();
    r.exigir(
      porAba.length === 4 && porAba.every((a) => a.itens === 10),
      `a grade tem uma aba por área, dez projetos em cada (${porAba.map((a) => `${a.rotulo} → ${a.itens}`).join("; ")})`,
    );
    await r.registrar(p, "imagens-do-banco-do-juri", {
      titulo: "As imagens do banco padrão do Júri Estadual",
      mostra:
        `Recursos › Imagens do banco padrão do Júri Estadual: o progresso “${progressoNaTela}”, o botão ` +
        "“Gerar as imagens que faltam” e a grade por área (Área A–D, dez projetos cada), com Pronta/Falta.",
      prova:
        "Uma imagem por projeto do banco (40), gerada UMA vez pela conta da Unooria e usada por toda atividade " +
        "criada com o banco padrão; o projeto sem imagem segue com a arte desenhada. É custo da plataforma — " +
        "sem quota de professor, medido no painel de custos — e só o admin chega aqui.",
      detalhe: `${progressoNaTela} · ${porAba.map((a) => `${a.rotulo} → ${a.itens}`).join("; ")}`,
      inteira: true,
    });

    if (process.env.E2E_GERAR_IMAGENS_DO_JURI === "1" && !banco.corpo?.completo) {
      /* UMA ida (até quatro imagens), pela mesma rota que o botão chama em
         laço — clicar no botão geraria TODAS as que faltam. IA real. */
      const ida = await p.request.fetch(`${BFF}/juri-estadual/banco-padrao/imagens`, { method: "POST", timeout: 200_000 });
      const geracao = await ida.json().catch(() => null);
      r.exigir(
        ida.status() === 200 && Array.isArray(geracao?.geradas) && geracao.geradas.length > 0 && geracao.geradas.length <= 4,
        `uma rodada gera até quatro imagens com a IA real (HTTP ${ida.status()}: ${geracao?.geradas?.length ?? "?"} geradas, ${geracao?.prontas} de ${geracao?.total})`,
      );
      await p.reload({ waitUntil: "domcontentloaded" });
      await telaDoBanco.waitFor({ timeout: 60_000 });
      const depois = `${geracao?.prontas} de ${geracao?.total}`;
      r.exigir(
        geracao?.prontas === banco.corpo.prontas + geracao.geradas.length && (await telaDoBanco.getByText(depois).count()) > 0,
        `o progresso anda com a rodada: de “${progressoNaTela}” para “${depois}”, e a tela relida diz o mesmo`,
      );
      await r.registrar(p, "imagens-do-banco-uma-rodada", {
        titulo: "Uma rodada de geração",
        mostra: `A mesma tela depois de UMA ida à api: “${depois}”, e as imagens novas na grade como Pronta.`,
        prova:
          "A api gera até quatro por chamada (o BFF corta a espera em 3 min) e só as que faltam: a mesma rota é " +
          "idempotente, e o botão da tela a repete até não faltar nenhuma.",
        detalhe: `geradas: ${(geracao?.geradas ?? []).join(", ")}`,
        inteira: true,
      });
    } else if (!banco.corpo?.completo) {
      r.ressalva(
        "a geração das imagens do banco não foi exercida (custa IA real): rode com E2E_GERAR_IMAGENS_DO_JURI=1 para uma rodada de até quatro",
      );
    }

    /* A guarda de papel: o professor não lê nem gera as imagens do banco. A
       sonda vai por `page.request` (sem evento de rede na página: o vigia de
       console pintaria a suíte de vermelho pelo 403 esperado). */
    const doProfessor = await lerBanco(pp);
    r.exigir(
      doProfessor.status === 403,
      `para o professor, a rota das imagens do banco responde 403 pelo BFF (veio ${doProfessor.status})`,
    );
  },
);
