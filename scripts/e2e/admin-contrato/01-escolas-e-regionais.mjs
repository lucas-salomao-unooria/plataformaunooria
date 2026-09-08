import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, escolas } from "../lib/credenciais.mjs";

/**
 * A REDE: as regionais que agrupam, as escolas que guardam o dado e as lotações
 * que dão acesso.
 *
 * A distinção que esta suíte existe para tornar visível: REGIONAL AGRUPA,
 * LOTAÇÃO AUTORIZA. Uma diretoria de ensino serve para trabalhar em lote — ela
 * não dá acesso a nada por si. Quem dá acesso é o vínculo da pessoa com a
 * escola. Confundir as duas coisas é o caminho mais curto para um supervisor
 * enxergar uma unidade em que ninguém o lotou.
 *
 * DUAS TELAS desde 2026-09-08 (ADR-79). Eram uma só, e a mistura era visível: o
 * tipo numa etiqueta, "—" nas colunas de turma e estudante das regionais, um
 * resumo que somava níveis diferentes ("3 registros · 2 unidades") e um filtro
 * de Tipo que existia apenas para desfazer a mistura. Este roteiro percorre as
 * duas na ordem do menu, que é a ordem da hierarquia.
 *
 * O `gestor_contrato` é a ÚNICA exceção cross-escola do sistema. Ele viaja com
 * `escolaId` vazio no token, e por isso toda tela dele precisa dizer de qual
 * escola está falando.
 */
const { segunda: ESCOLA_2 } = escolas();

await suite(
  {
    slug: "admin-contrato/01-escolas-e-regionais",
    papel: "gestor_contrato",
    titulo: "A rede inteira",
    subtitulo: "regionais, escolas e a lotação em lote que cria um supervisor",
    contexto:
      "Um contrato é uma rede: dezenas ou centenas de escolas dentro de uma stack, isoladas por " +
      "`escola_id`. Esta é a única área do produto que enxerga mais de uma — e mesmo aqui, uma " +
      "por vez quando o assunto é dado de estudante.",
    prova: [
      "Regionais e Escolas são telas distintas, cada uma listando só o seu nível",
      "Toda escola pertence a uma regional, e o cadastro não fecha sem ela",
      "Regionais são um NÍVEL de agrupamento, não um nível de acesso",
      "Selecionar escolas e vincular alguém a elas cria um supervisor em um passo",
      "Excluir uma regional com escolas exige dizer para onde elas vão",
    ],
    comando: "node scripts/e2e/admin-contrato/01-escolas-e-regionais.mjs",
  },
  async (r) => {
    const p = await r.pagina("gestor_contrato");
    await r.entrar(p, conta("gestor_contrato").login);

    // ── Regionais: o nível que agrupa ───────────────────────────────────
    await p.goto(`${HUB}/admin/regionais`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2200);
    const linhasDeRegional = await p.locator("table tbody tr").allInnerTexts();
    r.exigir(linhasDeRegional.length > 0, `a rede tem ${linhasDeRegional.length} regional(is)`);
    /* A tela de Regionais não tem coluna de turma nem de estudante: a regional
       não é uma escola grande, e somar as unidades dela numa métrica só seria a
       visão que a ADR-34 recusa. O único número dela é quantas escolas agrupa. */
    const cabecalhos = await p.locator("table thead th").allInnerTexts();
    r.exigir(
      !cabecalhos.some((c) => /Estudantes|Turmas/.test(c)),
      "a listagem de regionais não soma estudante nem turma das unidades",
    );
    await r.registrar(p, "regionais", {
      titulo: "As regionais da rede",
      mostra: `${linhasDeRegional.length} regional(is), cada uma com o id e quantas escolas agrupa.`,
      prova:
        "A regional AGRUPA para trabalhar em lote. Ela não autoriza nada — quem autoriza é a " +
        "lotação, e os passos seguintes mostram os dois um depois do outro.",
      detalhe: linhasDeRegional.map((t) => t.split("\n")[0]).join(", "),
      inteira: true,
    });

    /* A regional padrão é a linha que a rede sem divisão administrativa usa. Ela
       nasce com a rede, chamada "Rede", e o nome é editável — o nome real do
       contrato não existe no banco, porque o contrato é a stack e não uma
       linha. */
    const temPadrao = await p.getByText("Regional padrão").count();
    if (temPadrao > 0) {
      await r.registrar(p, "regional-padrao", {
        titulo: "A regional padrão",
        mostra: "A etiqueta na regional que a plataforma criou junto com a rede.",
        prova:
          "É ela que permite exigir regional de TODA escola sem obrigar a rede de uma unidade a " +
          "inventar uma diretoria. O nome sai de 'Rede' pelo botão Editar.",
      });
    } else {
      r.ressalva("esta rede já está organizada em diretorias: não há regional padrão para mostrar");
    }

    // ── da regional para as escolas dela ────────────────────────────────
    await p.locator("table tbody tr").first().getByRole("button", { name: "Ver escolas" }).click();
    await p.waitForURL(/\/admin\/escolas\?regional=/, { timeout: 20_000 });
    await p.waitForTimeout(2000);
    const daRegional = await p.locator("table tbody tr").allInnerTexts();
    await r.registrar(p, "escolas-da-regional", {
      titulo: "As escolas de uma regional",
      mostra: `${daRegional.length} escola(s): ${daRegional.map((t) => t.split("\n")[0]).join(", ")}.`,
      prova:
        "É esta lista que vira uma seleção em lote. Sem o agrupamento, vincular um supervisor a " +
        "quarenta escolas seria quarenta vezes o mesmo formulário.",
      detalhe: `${daRegional.length} escolas`,
    });

    // ── Escolas: só escolas, e o resumo fala do que a tabela mostra ─────
    await p.goto(`${HUB}/admin/escolas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2200);
    const unidades = await p.locator("table tbody tr").count();
    r.exigir(unidades > 0, `a rede tem ${unidades} escola(s) listadas`);
    /* O filtro de Tipo morreu com a separação — ele existia só para desfazer a
       mistura de níveis. Se ele voltar, é porque a tabela voltou a misturar. */
    const temFiltroDeTipo = await p.getByRole("combobox", { name: /^Tipo/ }).count();
    r.exigir(temFiltroDeTipo === 0, "não há filtro de Tipo: a tela lista um nível só");
    const resumo = await p.locator("p", { hasText: /escolas? ·/ }).first().innerText();
    r.exigir(
      !/registros?/.test(resumo) && /vínculos de professores/.test(resumo),
      `o resumo conta escolas e VÍNCULOS de professores: "${resumo}"`,
    );
    await r.registrar(p, "escolas-da-rede", {
      titulo: "As escolas do contrato",
      mostra: `${unidades} escolas, cada uma com id, código INEP, município, a regional a que pertence e a contagem de pessoas e turmas.`,
      prova:
        "O id da escola vem da REDE (`escola-demo`), não é uuid gerado: é ele que a secretaria já " +
        "usa nos sistemas dela, e é ele que aparece nas planilhas de importação. O resumo diz " +
        "'vínculos de professores' porque o total soma escolas, e o professor de duas conta duas vezes.",
      detalhe: resumo,
      inteira: true,
    });

    // ── lotação em lote: é assim que nasce um supervisor ────────────────
    /* O `<input>` do Checkbox do DS é sr-only e o `<label>` cobre o clique:
       `force` mira o input em vez de esperar que ele receba o ponteiro. */
    await p.getByRole("checkbox", { name: "Selecionar todas as linhas" }).check({ force: true });
    await p.waitForTimeout(700);
    await r.registrar(p, "escolas-selecionadas", {
      titulo: "Todas as escolas marcadas",
      mostra: "A barra de ação em lote aparecendo com as escolas selecionadas.",
      prova:
        "Trabalhar em lote é o que torna uma rede de 100 escolas administrável por uma secretaria " +
        "de duas pessoas.",
      detalhe: `${unidades} marcadas`,
    });

    /* A SUPERVISORA DAS DUAS ESCOLAS é a prova do defeito que este passo
       conserta. Ela existe em `escola-demo` e em `escola-demo-2`, e a
       PRINCIPAL dela é a primeira. A busca antiga filtrava por
       `users.escola_id` — o cache da lotação principal —, então procurá-la
       pela segunda escola devolvia VAZIO e quem administra concluía que ela
       não existe. Aqui ela é achada sem dizer escola nenhuma. */
    const supervisora = conta("gestor_escola (supervisora");
    await p
      .getByRole("button", { name: "Vincular professor ou gestor", exact: true })
      .click();
    const dialogo = p.getByTestId("unooria-modal");
    /* Pelo id, não por `getByLabel`: o `SearchInput` do DS não amarra o
       `<label>` ao input de um jeito que o papel acessível alcance. */
    await dialogo.locator("#busca-pessoa-lote").waitFor({ timeout: 20_000 });
    /* Antes de digitar, a tela ORIENTA — não afirma ausência. A mensagem
       "nenhum encontrado" antes de qualquer busca era o bug de estado que o
       card de textos registrou. */
    const antesDeBuscar = await dialogo.innerText();
    r.exigir(
      /Digite o nome, login ou CPF/.test(antesDeBuscar) && !/Nenhum professor/.test(antesDeBuscar),
      "antes da busca a tela orienta, em vez de dizer que não há ninguém",
    );
    r.exigir(
      !/Onde a pessoa está hoje/.test(antesDeBuscar),
      "não há campo de escola de origem: a busca é na rede",
    );
    await r.registrar(p, "vinculo-estado-inicial", {
      titulo: "Buscar na rede, sem escola de origem",
      mostra: "O diálogo aberto, com o campo de busca e a orientação inicial.",
      prova:
        "O campo 'Onde a pessoa está hoje' saiu, e não por gosto: ele filtrava pelo CACHE da " +
        "lotação principal, e quem trabalha em duas escolas só era achado por uma delas. " +
        "O estado inicial ORIENTA — dizer 'nenhum encontrado' antes de procurar afirma sobre uma " +
        "consulta que nunca aconteceu.",
    });

    const primeiroNome = supervisora.nome.split(" ")[0];
    await dialogo.locator("#busca-pessoa-lote").pressSequentially(primeiroNome, { delay: 20 });
    await p.waitForTimeout(2500);

    const seletor = dialogo.getByRole("combobox", { name: /Professor ou gestor encontrado/ });
    if ((await seletor.count()) > 0) {
      await seletor.click();
      await p.getByRole("option", { name: new RegExp(supervisora.nome) }).first().click();
      await p.waitForTimeout(1200);

      const comEscolhido = await dialogo.innerText();
      r.exigir(
        /Escolas com vínculo/.test(comEscolhido),
        "os vínculos que ela JÁ tem aparecem antes dos destinos",
      );
      r.exigir(
        /Já vinculado a esta escola/.test(comEscolhido),
        "o destino já vinculado é marcado, e sai da criação",
      );
      await r.registrar(p, "vinculo-ja-existente", {
        titulo: "Achada na rede, com os vínculos que já tem",
        mostra:
          `${supervisora.nome} encontrada digitando só "${primeiroNome}" — sem dizer escola — com ` +
          "as escolas em que já está e a marca 'Já vinculado a esta escola' nos destinos.",
        prova:
          "É a prova dupla: a pessoa em DUAS escolas é achada por uma busca de rede, e o vínculo " +
          "que existe não é oferecido de novo. O card pede as duas coisas, e a segunda é o que " +
          "impede uma segunda linha de lotação na mesma escola.",
        inteira: true,
      });

      /* Ela já está nas duas escolas da rede de demonstração, então não há
         destino novo — e a tela diz isso em vez de oferecer um botão que não
         faria nada. */
      const semNovos = await dialogo.innerText();
      if (/já está vinculado a todas as escolas/.test(semNovos)) {
        r.exigir(true, "com todos os destinos já vinculados, a tela diz que não há o que criar");
        await r.registrar(p, "vinculo-nada-a-criar", {
          titulo: "Nada a criar",
          mostra: "O aviso de que o profissional já está vinculado a todas as escolas selecionadas.",
          prova:
            "Confirmar não é oferecido quando não há vínculo novo: o card pede exatamente esta " +
            "mensagem, e o botão fica desabilitado em vez de escrever nada e dizer 'pronto'.",
        });
      } else {
        r.ressalva("havia destino novo nesta base — o caminho de 'nada a criar' não foi exercido");
      }
      await dialogo.getByRole("button", { name: "Cancelar", exact: true }).click();
    } else {
      r.ressalva(`a busca na rede não encontrou "${primeiroNome}"`);
    }

    // ── cadastrar escola: a regional é obrigatória ──────────────────────
    await p.goto(`${HUB}/admin/escolas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    r.exigir(
      (await p.getByRole("button", { name: "Cadastrar escola" }).count()) > 0,
      "cadastrar escola é feito pela tela, não por script no banco",
    );
    /* "Nova regional" saiu DESTA tela: cadastrar regional é da tela de
       Regionais. Se o botão voltar aqui, os dois níveis voltaram a se misturar. */
    r.exigir(
      (await p.getByRole("button", { name: /regional/i }).count()) === 0,
      "e cadastrar REGIONAL não é operação desta tela",
    );
    await p.getByRole("button", { name: "Cadastrar escola" }).click();
    await p.locator("#escola-id").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(600);
    const campoDeRegional = await p.getByTestId("unooria-modal").getByText("Regional").count();
    r.exigir(campoDeRegional > 0, "o formulário pede a regional da escola");
    await r.registrar(p, "nova-escola", {
      titulo: "Uma escola nova, com regional",
      mostra:
        "O formulário com id da rede, nome, a regional a que a escola pertence, INEP, município e UF.",
      prova:
        "Toda escola pertence a uma regional (ADR-79) e o botão não fecha sem ela — com uma " +
        "regional só na rede, ela já vem escolhida. O INEP e o município não são enfeite: são o " +
        "que permite conciliar esta base com o Censo Escolar.",
    });
    await p.getByTestId("unooria-modal").getByRole("button", { name: "Cancelar" }).click();

    // ── excluir regional: exige dizer para onde vão as escolas ──────────
    await p.goto(`${HUB}/admin/regionais`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    /* A regional com escolas é a que prova a regra. A exclusão NÃO é concluída
       aqui de propósito: a suíte roda muitas vezes contra o mesmo banco, e uma
       diretoria a menos por execução transformaria o roteiro na causa da
       próxima falha. O que se fotografa é o impedimento. */
    const comEscolas = p
      .locator("table tbody tr")
      .filter({ hasNot: p.getByText("Regional padrão") })
      .first();
    if ((await comEscolas.count()) > 0) {
      await comEscolas.getByRole("button", { name: "Excluir" }).click();
      await p.getByText("Excluir regional").waitFor({ timeout: 15_000 });
      await p.waitForTimeout(800);
      const aviso = await p.getByTestId("unooria-modal").innerText();
      r.exigir(
        /Transfira as escolas|Nenhuma escola está vinculada/.test(aviso),
        "a exclusão diz o que precisa acontecer antes",
      );
      await r.registrar(p, "excluir-regional", {
        titulo: "Excluir uma regional",
        mostra: aviso.split("\n").find((l) => /Transfira|Nenhuma escola/.test(l)) ?? aviso,
        prova:
          "Regional com escolas só sai depois de dizer para onde elas vão, e a transferência " +
          "acontece na MESMA transação da exclusão. A rede também nunca fica sem regional: a " +
          "última é recusada. ESCOLA, por sua vez, não se exclui em lugar nenhum — ela é tenant, " +
          "com turma, dado de menor e histórico atrás.",
      });
      await p.getByTestId("unooria-modal").getByRole("button", { name: "Cancelar" }).click();
    } else {
      r.ressalva("só há a regional padrão nesta rede: sem segunda linha para exercitar a exclusão");
    }
  },
);
