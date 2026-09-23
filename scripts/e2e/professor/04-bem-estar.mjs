import { BFF, suite } from "../lib/roteiro.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O acompanhamento de bem-estar (app-91): o único produto da plataforma cujo sujeito
 * é o PROFESSOR.
 *
 * As três frases do dia são verbatim do DASS-21 — instrumento validado, e por
 * isso intocável: reescrevê-las para soar mais gentil invalidaria a escala. O
 * que a IA faz é o ENTORNO (o acolhimento depois do envio), nunca o item.
 *
 * A regra que mais importa aqui é negativa: NÃO existe visão de gestor. Nenhuma
 * tela da plataforma mostra o bem-estar de um professor a outra pessoa, e o
 * próprio professor pode apagar tudo. Um painel de "saúde mental do corpo
 * docente" transformaria a ferramenta em vigilância — e ninguém responderia
 * com honestidade a um instrumento que o chefe lê.
 *
 * A resposta é UMA POR DIA. O roteiro apaga os dados no começo para exercitar o
 * formulário inteiro — e, de graça, isso cobre o caminho destrutivo, que é uma
 * garantia do produto.
 */
await suite(
  {
    slug: "professor/04-bem-estar",
    papel: "professor",
    titulo: "Bem-estar do professor",
    subtitulo: "DASS-21 verbatim, acolhimento gerado, e o direito de apagar tudo",
    contexto:
      "Um minuto por dia: três frases de um instrumento validado e uma pergunta aberta. " +
      "O que volta é acolhimento, não diagnóstico — e o que fica é do professor, de mais ninguém.",
    prova: [
      "As três frases do dia vêm do DASS-21 sem reescrita",
      "Uma resposta por frase, e a pergunta aberta é opcional",
      "O envio devolve acolhimento e o progresso do ciclo",
      "A resposta é uma por dia: reabrir mostra a de hoje já feita",
      "O histórico é só do próprio professor",
      "Apagar os dados apaga de verdade — e é o professor quem decide",
    ],
    comando: "node scripts/e2e/professor/04-bem-estar.mjs",
  },
  async (r) => {
    const p = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    p.on("dialog", (d) => void d.accept());
    await r.entrar(p, conta("professor", { turma: "8A" }).login);

    const cartao = p.locator('a[href="/professor/bem-estar"]');
    r.exigir((await cartao.count()) === 1, "o bem-estar é um dos três produtos do hub");
    const situacao = await cartao
      .locator("span")
      .filter({ hasText: /respond|minuto|segundos/ })
      .first()
      .innerText()
      .catch(() => "(sem situação no cartão)");
    await r.registrar(p, "cartao-no-hub", {
      titulo: "O convite, no hub",
      mostra: `O cartão do bem-estar com a situação do dia: "${situacao}".`,
      prova:
        "A situação aparece no cartão para o professor não precisar ABRIR para descobrir que já " +
        "fez. Ferramenta de um minuto que cobra dois cliques para dizer 'nada a fazer' não é usada.",
      detalhe: situacao,
    });

    await cartao.first().click();
    await p.waitForURL((url) => url.pathname === "/professor/bem-estar", { timeout: 30_000 });
    let bem = p.frameLocator('iframe[title="experiencia"]');
    await bem.getByText(/Como você está|Você já respondeu hoje/).first().waitFor({ timeout: 60_000 });

    /* APAGAR ANTES, e pela TELA. A resposta é uma por dia: sem limpar, a segunda
       execução do dia encontra "já feito" e não exercita o formulário.
       Pela tela, e não pelo BFF do hub, porque `bemestar` NÃO está na allowlist
       dele — e não deve estar: nenhuma tela do hub lê bem-estar, só a
       experiência, com o token dela. Exercitar o caminho destrutivo aqui é de
       graça, e ele é uma garantia do produto. */
    if (await bem.getByText("Você já respondeu hoje").isVisible().catch(() => false)) {
      await bem.getByRole("button", { name: "Histórico" }).click();
      await bem.getByText("Seu histórico").waitFor({ timeout: 20_000 });
      const apagar = bem.getByRole("button", { name: "Apagar meus dados" });
      await apagar.scrollIntoViewIfNeeded();
      await apagar.click();
      await p.waitForTimeout(3000);
      await p.reload({ waitUntil: "domcontentloaded" });
      bem = p.frameLocator('iframe[title="experiencia"]');
      await bem.getByText(/Como você está|Você já respondeu hoje/).first().waitFor({ timeout: 60_000 });
      await r.registrar(p, "dados-apagados", {
        titulo: "O professor apaga os próprios dados",
        mostra: "Depois de apagar, a resposta do dia volta a estar em branco.",
        prova:
          "O botão é dele e apaga TUDO, de todos os ciclos, sem pedir motivo a ninguém. É a " +
          "contrapartida de pedir que ele responda com honestidade a um instrumento clínico.",
      });
    }

    const jaFeito = await bem.getByText("Você já respondeu hoje").isVisible().catch(() => false);
    r.exigir(!jaFeito, "com os dados apagados, a resposta do dia abre em branco");

    const grupos = bem.locator("fieldset");
    const frases = await grupos.count();
    r.exigir(frases === 3, `três frases do dia na tela (${frases})`);

    /*
     * A promessa de privacidade da caixa de texto livre, cobrada como fato.
     * A copy dizia "Só você lê o que escreve aqui" enquanto o texto era enviado
     * ao Vertex para gerar o acolhimento — verdade sobre PESSOAS (o controller
     * é `@Roles("professor")` e não há visão de gestor), silêncio sobre a IA.
     * Aqui o professor decide se conta que não está bem: uma garantia que ele
     * descobre depois ser parcial custa o instrumento, não só a frase. Nenhum
     * typecheck protege uma string de UI, e a regressão volta em silêncio.
     */
    const dica = await bem.locator("textarea").locator("xpath=ancestor::*[1]").innerText();
    r.exigir(
      !/só você lê/i.test(dica),
      "a caixa de texto livre NÃO promete sigilo absoluto de leitura",
    );
    r.exigir(
      /\bIA\b|intelig/i.test(dica),
      "a caixa de texto livre diz que uma IA lê o texto para escrever o acolhimento",
    );
    await r.registrar(p, "resposta-do-dia", {
      titulo: "As três frases",
      mostra: "Três itens do DASS-21, com quatro respostas cada, e uma pergunta aberta opcional.",
      prova:
        "O texto dos itens é VERBATIM do instrumento. Suavizar a redação para soar mais gentil " +
        "quebraria a validação da escala e o resultado deixaria de significar o que significa.",
      detalhe: `${frases} frases`,
    });

    /* Marca pelo `<input>`: o DS põe o input (opacity 0) POR CIMA do rótulo, e
       o Playwright recusa clicar num `<span>` coberto. Para o humano é o mesmo
       clique. */
    for (let i = 0; i < frases; i += 1) {
      await grupos.nth(i).locator('input[type=radio][aria-label="Às vezes"]').check();
    }
    await bem.locator("textarea").fill("Semana corrida, mas a aula de hoje rendeu.");
    await r.registrar(p, "respondido", {
      titulo: "Respondido",
      mostra: "As três frases marcadas e a pergunta aberta preenchida.",
      prova:
        "A pergunta aberta é opcional de propósito: obrigar a escrever num instrumento de um " +
        "minuto é o jeito mais rápido de fazer o professor abandonar no meio.",
    });

    await bem.getByRole("button", { name: "Enviar respostas" }).click();
    await esperarOuFalharCedo(
      bem.getByText("Você já respondeu hoje"),
      bem.locator(ALERTA_DE_ERRO),
      { timeout: 90_000, oQue: "o envio das respostas (app-91)" },
    );
    await p.waitForTimeout(1500);
    await r.registrar(p, "acolhimento", {
      titulo: "O que volta é acolhimento",
      mostra: "A tela de confirmação, com uma devolutiva breve e o progresso do ciclo.",
      prova:
        "Nenhum número, nenhuma classificação, nenhum diagnóstico. A IA escreve o ENTORNO com " +
        "guardrails; o item validado ela não toca.",
    });

    // ── um por dia ──────────────────────────────────────────────────────
    await p.reload({ waitUntil: "domcontentloaded" });
    const bem2 = p.frameLocator('iframe[title="experiencia"]');
    await bem2.getByText(/Como você está|Você já respondeu hoje/).first().waitFor({ timeout: 60_000 });
    const agoraJaFeito = await bem2.getByText("Você já respondeu hoje").isVisible().catch(() => false);
    r.exigir(agoraJaFeito, "reabrir no mesmo dia mostra a resposta de hoje já feita — é uma por dia");

    await bem2.getByRole("button", { name: "Histórico" }).click();
    await bem2.getByText("Seu histórico").waitFor({ timeout: 20_000 });
    await p.waitForTimeout(1500);
    await r.registrar(p, "historico", {
      titulo: "O histórico, só dele",
      mostra: "Os ciclos concluídos e as anotações deste professor.",
      prova:
        "Não existe rota, tela ou export que mostre isto a um gestor. O bem-estar do professor não " +
        "é indicador de gestão — se fosse, ninguém responderia com honestidade.",
    });

    /* A prova negativa, dita como o produto a garante. `bemestar` não está nem
       na allowlist do BFF do hub: nenhuma tela da plataforma lê bem-estar de
       ninguém — só a experiência, com o token do próprio professor. */
    const peloBff = await p.request.get(`${BFF}/bemestar/historico`);
    r.exigir(
      peloBff.status() === 404,
      `o BFF do hub NÃO repassa bem-estar (HTTP ${peloBff.status()}): não há por onde uma tela da plataforma ler isso`,
    );
    r.ressalva(
      "não existe rota de bem-estar por escola ou por turma: a ausência é a garantia, e por isso " +
        "ela não tem tela para fotografar",
    );
  },
);
