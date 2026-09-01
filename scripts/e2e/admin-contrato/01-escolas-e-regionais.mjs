import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, escolas } from "../lib/credenciais.mjs";

/**
 * A REDE: as escolas do contrato, as regionais que as agrupam e as lotações
 * que dão acesso.
 *
 * A distinção que esta suíte existe para tornar visível: REGIONAL AGRUPA,
 * LOTAÇÃO AUTORIZA. Uma diretoria de ensino serve para trabalhar em lote — ela
 * não dá acesso a nada por si. Quem dá acesso é o vínculo da pessoa com a
 * escola. Confundir as duas coisas é o caminho mais curto para um supervisor
 * enxergar uma unidade em que ninguém o lotou.
 *
 * O `admin-contrato` é a ÚNICA exceção cross-escola do sistema. Ele viaja com
 * `escolaId` vazio no token, e por isso toda tela dele precisa dizer de qual
 * escola está falando.
 */
const { segunda: ESCOLA_2 } = escolas();

await suite(
  {
    slug: "admin-contrato/01-escolas-e-regionais",
    papel: "admin-contrato",
    titulo: "A rede inteira",
    subtitulo: "escolas, regionais e a lotação em lote que cria um supervisor",
    contexto:
      "Um contrato é uma rede: dezenas ou centenas de escolas dentro de uma stack, isoladas por " +
      "`escola_id`. Esta é a única área do produto que enxerga mais de uma — e mesmo aqui, uma " +
      "por vez quando o assunto é dado de estudante.",
    prova: [
      "As escolas da rede aparecem com contagem de gente e de turmas",
      "Regionais são um NÍVEL de agrupamento, não um nível de acesso",
      "Selecionar unidades e lotar alguém nelas cria um supervisor em um passo",
      "Criar e editar escola é feito pela tela, sem script no banco",
    ],
    comando: "node scripts/e2e/admin-contrato/01-escolas-e-regionais.mjs",
  },
  async (r) => {
    const p = await r.pagina("admin-contrato");
    await r.entrar(p, conta("admin-contrato").login);

    await p.goto(`${HUB}/admin/escolas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2200);
    const unidades = await p.locator("table tbody tr").count();
    r.exigir(unidades > 0, `a rede tem ${unidades} unidade(s) listadas`);
    await r.registrar(p, "escolas-da-rede", {
      titulo: "As escolas do contrato",
      mostra: `${unidades} unidades, cada uma com id, INEP, município e a contagem de pessoas e turmas.`,
      prova:
        "O id da escola vem da REDE (`escola-demo`), não é uuid gerado: é ele que a secretaria já " +
        "usa nos sistemas dela, e é ele que aparece nas planilhas de importação.",
      detalhe: `${unidades} unidades`,
      inteira: true,
    });

    // ── regionais: agrupam, não autorizam ───────────────────────────────
    /* O `Selection` do DS não é `<select>`: é um combobox com `role="option"`. */
    await p.getByRole("combobox", { name: /Tipo|Nível/ }).click();
    await p.getByRole("option", { name: "Regionais" }).click();
    await p.waitForTimeout(1800);
    const regionais = await p.locator("table tbody tr").allInnerTexts();
    r.exigir(regionais.length > 0, `a rede tem ${regionais.length} regional(is)`);
    await r.registrar(p, "regionais", {
      titulo: "As regionais",
      mostra: `O nível entre a escola e o contrato: ${regionais.map((t) => t.split("\n")[0]).join(", ")}.`,
      prova:
        "A regional AGRUPA para trabalhar em lote. Ela não autoriza nada — quem autoriza é a " +
        "lotação, e os dois passos seguintes mostram isso um depois do outro.",
      detalhe: regionais.map((t) => t.split("\n")[0]).join(", "),
    });

    await p.locator("table tbody tr").first().getByRole("button", { name: "Ver unidades" }).click();
    await p.waitForTimeout(1800);
    const daRegional = await p.locator("table tbody tr").allInnerTexts();
    await r.registrar(p, "unidades-da-regional", {
      titulo: "As unidades de uma regional",
      mostra: `${daRegional.length} unidade(s): ${daRegional.map((t) => t.split("\n")[0]).join(", ")}.`,
      prova:
        "É esta lista que vira uma seleção em lote. Sem o agrupamento, lotar um supervisor em " +
        "quarenta escolas seria quarenta vezes o mesmo formulário.",
      detalhe: `${daRegional.length} unidades`,
    });

    // ── lotação em lote: é assim que nasce um supervisor ────────────────
    /* O `<input>` do Checkbox do DS é sr-only e o `<label>` cobre o clique:
       `force` mira o input em vez de esperar que ele receba o ponteiro. */
    await p.getByRole("checkbox", { name: "Selecionar todas as linhas" }).check({ force: true });
    await p.waitForTimeout(700);
    await r.registrar(p, "unidades-selecionadas", {
      titulo: "Todas as unidades marcadas",
      mostra: "A barra de ação em lote aparecendo com as unidades selecionadas.",
      prova:
        "Trabalhar em lote é o que torna uma rede de 100 escolas administrável por uma secretaria " +
        "de duas pessoas.",
      detalhe: `${daRegional.length} marcadas`,
    });

    /* Um gestor que hoje está em UMA escola — é ele que a lotação em lote vai
       transformar em supervisor. A supervisora do seed já está nas duas, e o
       modal não a oferece: lotar quem já está lotado não é caminho. */
    const supervisora = conta("gestor", { escola: ESCOLA_2 });
    await p.getByRole("button", { name: "Lotar pessoa nestas escolas" }).click();
    await p.getByText("Onde a pessoa está hoje").waitFor({ timeout: 20_000 });
    await p.waitForTimeout(900);

    const dialogo = p.getByTestId("unooria-modal");
    await dialogo.getByRole("combobox", { name: /Onde a pessoa está hoje/ }).click();
    await p.getByRole("option", { name: ESCOLA_2 }).first().click();
    await dialogo.locator("#busca-pessoa-lote").pressSequentially(supervisora.nome, { delay: 20 });
    await p.waitForTimeout(2200);

    const seletorDePessoa = dialogo.getByRole("combobox", { name: /^Pessoa/ });
    if ((await seletorDePessoa.count()) > 0) {
      await seletorDePessoa.click();
      await p.getByRole("option", { name: supervisora.nome }).first().click();
      await p.waitForTimeout(500);
      const [resposta] = await Promise.all([
        p.waitForResponse(
          (resp) => resp.url().includes("/escolas/lotacoes-em-lote") && resp.request().method() === "POST",
          { timeout: 25_000 },
        ),
        dialogo.getByRole("button", { name: "Lotar", exact: true }).click(),
      ]);
      r.exigir(resposta.ok(), `a lotação em lote gravou (HTTP ${resposta.status()})`);
      await p.waitForTimeout(1500);
      const texto = await dialogo.innerText();
      r.exigir(
        /agora está em/.test(texto),
        "a tela confirma em quantas escolas a pessoa passou a estar",
      );
      await r.registrar(p, "lotacao-em-lote", {
        titulo: "Um supervisor nasce de um formulário",
        mostra: texto.split("\n").find((l) => /agora está em/.test(l)) ?? "a confirmação da lotação",
        prova:
          "É a LOTAÇÃO que dá acesso — não a regional. A pessoa passou a enxergar aquelas unidades " +
          "porque agora tem vínculo com cada uma delas, uma por uma, no banco.",
      });
      await dialogo.getByRole("button", { name: "Fechar", exact: true }).click();
    } else {
      r.ressalva(`a busca não encontrou "${supervisora.nome}" na escola de origem escolhida`);
    }

    // ── criar e editar escola pela tela ─────────────────────────────────
    await p.goto(`${HUB}/admin/escolas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    const temNovaEscola = await p.getByRole("button", { name: "Nova escola" }).count();
    const temNovaRegional = await p.getByRole("button", { name: "Nova regional" }).count();
    r.exigir(temNovaEscola > 0, "criar escola é feito pela tela, não por script no banco");
    r.exigir(temNovaRegional > 0, "e criar regional também");
    await p.getByRole("button", { name: "Nova escola" }).click();
    await p.locator("#escola-id").waitFor({ timeout: 15_000 });
    await r.registrar(p, "nova-escola", {
      titulo: "Uma escola nova",
      mostra: "O formulário com id da rede, nome, INEP, município e UF.",
      prova:
        "O INEP e o município não são enfeite: são o que permite conciliar esta base com o Censo " +
        "Escolar quando a secretaria for cruzar os dois.",
    });
  },
);
