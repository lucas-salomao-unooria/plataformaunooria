import { HUB, estadoDosIcones, suite } from "../lib/roteiro.mjs";
import { conta, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * OS CUSTOS DE IA DA REDE (ADR-161): o FinOps da Unooria — tokens de entrada e
 * de saída, custo em dólar e em real (PTAX do Banco Central), por produto,
 * modelo, modalidade e escola, e a tabela de preços de onde o custo sai.
 *
 * O que a suíte LÊ é o consumo que a stack já tem (rode antes uma suíte que
 * chame IA, como `professor/03-plano-de-aula`, para a tabela não sair vazia):
 * o roteiro não fabrica consumo, porque consumo fabricado provaria a conta e
 * não a medição. Sem consumo nenhum, ela segue e diz isso no detalhe.
 *
 * O que ela ESCREVE é um preço para um modelo que não existe
 * (`e2e-modelo-de-teste`), a partir de hoje: `ia_precos` é tabela de contrato,
 * e um preço de modelo real mudaria o custo de toda a rede. A linha fica — a
 * tabela é o próprio histórico, e a tela não tem "apagar" de propósito.
 */

const MODELO_DE_TESTE = "e2e-modelo-de-teste";
const MOTIVO = "Suite e2e: preço de um modelo que não existe.";

await suite(
  {
    slug: "admin/05-custos-de-ia",
    papel: "admin",
    titulo: "Os custos de IA da rede",
    subtitulo: "tokens, dólar e real (PTAX do Banco Central), por produto, modelo e escola",
    contexto:
      "A IA é o custo variável da Unooria: cada plano de aula, cada imagem de missão, cada fala do " +
      "podcast e cada minuto da Ajuda em vídeo sai na fatura do Google ou da LiveAvatar. Até aqui só se " +
      "sabia o total do mês, pela fatura. Agora cada chamada registra o que pagou, com o produto e a " +
      "escola que a fizeram, e esta tela converte para real com a cotação oficial do dia.",
    prova: [
      "A tela mostra o custo em real e em dólar, os tokens de entrada e de saída e a cotação PTAX usada",
      "O consumo aparece por produto, por modelo (com a unidade que ele produz) e por escola",
      "Cadastrar um preço exige motivo e data de vigência, e a linha nova aparece valendo hoje",
      "A REDE (gestor do contrato) não lê os custos nem a tabela de preços (403), e não entra na tela",
    ],
    comando: "node scripts/e2e/admin/05-custos-de-ia.mjs",
  },
  async (r) => {
    const admin = conta("admin");
    const p = await r.pagina("admin");
    await r.entrar(p, admin.login, admin.senha ?? senhaDemo());
    await p.waitForURL("**/unooria/recursos", { timeout: 30_000 });

    // ── a tela ──────────────────────────────────────────────────────────
    /* Pelo ITEM do `SideBar`, não pelo texto: o rótulo vive num tooltip oculto. */
    await p.locator(".unooria-sidebar-item").filter({ hasText: "Custos de IA" }).first().click();
    await p.waitForURL("**/unooria/custos-de-ia", { timeout: 20_000 });
    await esperarOuFalharCedo(p.getByText("Custo total (R$)"), p.locator(ALERTA_DE_ERRO), {
      timeout: 60_000,
      oQue: "o painel de custos",
    });
    await p.waitForTimeout(1000);

    const icones = await estadoDosIcones(p);
    r.exigir(icones !== "texto", `os ícones da barra renderizam como glifo, não como nome (${icones})`);

    /* A fonte é a api, e a tela tem de concordar com ela. */
    const resposta = await p.request.get(`${HUB}/api/plataforma/recursos/custos-de-ia`);
    r.exigir(resposta.ok(), `a api devolve o painel ao admin (${resposta.status()})`);
    const painel = await resposta.json();
    const temCotacao = Boolean(painel.cotacao?.ultima);
    r.exigir(
      !temCotacao || (await p.getByText(/Dólar \(PTAX de venda/).count()) > 0,
      "com cotação guardada, a tela diz qual PTAX usou",
    );

    await r.registrar(p, "o-total", {
      titulo: "Quanto a IA custou nos últimos 30 dias",
      mostra:
        "O custo em real e em dólar, os tokens de entrada e de saída, as chamadas, as imagens, os minutos de " +
        "áudio e de vídeo, a curva por dia e a divisão por modalidade. Acima, a cotação PTAX usada.",
      prova:
        "O custo é DERIVADO na leitura — consumo × preço vigente no dia × PTAX de venda do mesmo dia — e " +
        "nunca gravado: corrigir um preço com data no passado corrige o painel para trás.",
      detalhe: temCotacao
        ? `US$ ${painel.totais.usd.toFixed(4)} · R$ ${(painel.totais.brl ?? 0).toFixed(2)} · PTAX ${painel.cotacao.ultima.venda} (${painel.cotacao.ultima.dia})`
        : `US$ ${painel.totais.usd.toFixed(4)} · sem cotação guardada (BCB não respondeu)`,
      inteira: true,
    });

    // ── por produto e por modelo ────────────────────────────────────────
    const produtos = painel.porRecurso ?? [];
    if (produtos.length > 0) {
      const primeiro = produtos[0].nome;
      r.exigir((await p.getByText(primeiro, { exact: true }).count()) > 0, `o produto mais caro (${primeiro}) aparece na tabela`);
    }
    await p.getByText("Por modelo", { exact: true }).first().scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    await r.registrar(p, "por-produto-e-modelo", {
      titulo: "Em quê se gastou",
      mostra:
        "Uma linha por produto da plataforma (a rota que chamou a IA) e uma por modelo, com a unidade que ele " +
        "produz: imagens, minutos de áudio, minutos de vídeo. A voz aparece com ≈: a síntese não devolve " +
        "contagem de tokens e ela é estimada pela duração.",
      prova:
        "O registro sai do decorator que embrulha o provider de IA (`MedidorDeProvider`), então todo consumidor " +
        "novo nasce medido; o agente do professor e o mascote da Ajuda, que não passam por ele, se registram " +
        "nas próprias portas, e o avatar em vídeo sai das sessões que a Ajuda já mede.",
      detalhe:
        produtos.length > 0
          ? produtos.map((x) => `${x.nome}: US$ ${x.usd.toFixed(4)}`).join(" · ")
          : "sem consumo de IA no período nesta stack",
      inteira: true,
    });

    // ── cadastrar um preço ──────────────────────────────────────────────
    await p.getByRole("button", { name: "Cadastrar preço" }).click();
    const modal = p.locator(".unooria-modal-overlay").last();
    await modal.locator("#preco-modelo").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(600);
    const gravar = modal.getByRole("button", { name: "Gravar" });
    r.exigir(await gravar.isDisabled(), "Gravar começa travado (sem modelo, valor e motivo)");

    await modal.locator("#preco-modelo").fill(MODELO_DE_TESTE);
    await modal.locator("#preco-valor").fill("1,25");
    r.exigir(await gravar.isDisabled(), "sem motivo, Gravar continua travado");
    await modal.locator("#preco-motivo").fill(MOTIVO);
    await p.waitForTimeout(300);
    r.exigir(!(await gravar.isDisabled()), "com modelo, valor, data e motivo, Gravar destrava");

    await r.registrar(p, "janela-do-preco", {
      titulo: "Um preço novo, a partir de uma data",
      mostra: "A janela com o modelo, o que é cobrado, o valor em dólar, a data de vigência e o motivo obrigatório.",
      prova:
        "A tabela só ACRESCENTA: o preço anterior continua valendo antes da data. É por isso que não há " +
        "editar nem apagar — um preço apagado tiraria o custo dos dias em que ele valeu.",
    });

    await gravar.click();
    await modal.waitFor({ state: "hidden", timeout: 20_000 });
    const linha = p.locator("tr").filter({ hasText: MODELO_DE_TESTE }).first();
    await linha.waitFor({ timeout: 20_000 });
    const textoDaLinha = await linha.innerText();
    r.exigir(/vale hoje/.test(textoDaLinha), `a linha nova aparece valendo hoje (${textoDaLinha.replace(/\s+/g, " ").slice(0, 120)})`);
    r.exigir(textoDaLinha.includes(MOTIVO), "a linha guarda o motivo");
    await linha.scrollIntoViewIfNeeded();

    await r.registrar(p, "preco-gravado", {
      titulo: "O preço entrou na tabela",
      mostra: "A linha nova com o valor, a etiqueta “vale hoje”, quem gravou e o motivo — e o painel acima recalculado.",
      prova:
        "O nome de quem gravou é congelado na linha. O painel relê o mesmo período depois de gravar: a conta " +
        "velha não fica ao lado da tabela nova.",
    });

    // ── a rede não alcança ──────────────────────────────────────────────
    const gestor = conta("gestor_contrato");
    const pr = await r.pagina("rede");
    await r.entrar(pr, gestor.login, gestor.senha ?? senhaDemo());
    await pr.waitForTimeout(1000);
    const painelNegado = await pr.request.get(`${HUB}/api/plataforma/recursos/custos-de-ia`, { failOnStatusCode: false });
    const precoNegado = await pr.request.post(`${HUB}/api/plataforma/recursos/custos-de-ia/precos`, {
      data: { modelo: MODELO_DE_TESTE, componente: "saida", usd: 0, vigenteDesde: "2026-01-01", motivo: "sonda: tem de ser recusada" },
      failOnStatusCode: false,
    });
    const telaDaRede = await pr.request.get(`${HUB}/unooria/custos-de-ia`, { failOnStatusCode: false, maxRedirects: 0 });
    r.exigir(
      painelNegado.status() === 403 && precoNegado.status() === 403,
      `o gestor do contrato não lê os custos nem grava preço (GET ${painelNegado.status()}, POST ${precoNegado.status()})`,
    );
    r.exigir(
      telaDaRede.status() >= 300 && telaDaRede.status() < 400,
      `a tela /unooria/custos-de-ia manda o gestor do contrato embora (${telaDaRede.status()})`,
    );

    await r.registrar(pr, "a-rede-nao-alcanca", {
      titulo: "Do lado da rede: nada",
      mostra: "A casa do gestor do contrato, sem caminho para os custos.",
      prova:
        "Quanto a IA de uma rede custa à Unooria é a margem do contrato: mostrá-la ao cliente seria entregar a " +
        `conta da fornecedora (ADR-161). Medido: GET ${painelNegado.status()}, POST ${precoNegado.status()}, tela ${telaDaRede.status()}.`,
    });
  },
);
