import { HUB, suite } from "../lib/roteiro.mjs";
import { esperarOuFalharCedo } from "../lib/smoke.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * O AGENTE DE IA DO PROFESSOR: o chat flutuante do canto das telas de
 * `/professor` (contrato em `docs/regras/agente-professor.md`).
 *
 * Roda com a api em `AGENTE_PROFESSOR_MODO=mock` — o turno determinístico de
 * `apps/api/src/ai/agent-engine.client.ts`: três trechos de texto citando
 * EF06MA01, UMA fonte ("BNCC — Ensino Fundamental", p. 300–301) e, no 1º
 * turno, o título "Números naturais no 6º ano". Mensagem com `EF99ZZ99` faz o
 * mock citar o código de volta, e a api avisa que ele não existe na BNCC.
 * Sem o modo `mock` a api responde `AGENTE_INDISPONIVEL` (o padrão é
 * `desligado`) e esta suíte reprova no primeiro turno, dizendo isso.
 *
 * O que só esta suíte cobra:
 *
 *  - o chat NÃO é card na home: a superfície é o botão flutuante;
 *  - a resposta chega por STREAM, pelo hub (`/api/plataforma/...`), com a
 *    fonte e a página — e o título da conversa vem do agente, não da tela;
 *  - o painel não é modal, mas cuida do foco: abre no campo, Esc devolve ao
 *    botão;
 *  - fechar o painel no meio da resposta NÃO a perde (o selo do botão avisa);
 *  - apagar pede confirmação na própria linha e a conversa some.
 */

const PERGUNTA = "Quais habilidades de Matemática do 6º ano falam de números naturais?";
const PERGUNTA_COM_CODIGO_INEXISTENTE = "E a habilidade EF99ZZ99, o que ela pede?";
const TITULO = "Números naturais no 6º ano";
const FONTE = "BNCC — Ensino Fundamental, p. 300–301";
const NOME = "Agente de IA do professor";

await suite(
  {
    slug: "professor/12-agente-de-ia",
    papel: "professor",
    titulo: "Agente de IA do professor",
    subtitulo: "o chat flutuante: BNCC e acervo, com fonte, título e histórico",
    contexto:
      "Um botão no canto de toda tela do professor abre um chat sobre a BNCC (inclusive a de " +
      "Computação) e os livros da Unooria. A resposta chega aos poucos, cita a fonte com a página, " +
      "e a conversa fica guardada — até o professor apagá-la.",
    prova: [
      "O agente não é card na home: é o botão flutuante, presente em toda tela do professor",
      "Abrir leva o foco ao campo; o aviso para não escrever nomes de estudantes está sempre à vista",
      "A resposta chega pelo hub, cita EF06MA01 e mostra a fonte com a página",
      "O título da conversa é o que o agente escreveu, e aparece no histórico",
      "O painel expande e recolhe",
      "Código de habilidade que não existe na BNCC vira aviso na resposta",
      "Fechar no meio da resposta não a perde: o selo do botão avisa que chegou",
      "Apagar pede confirmação na linha, e a conversa some do histórico",
      "Esc fecha o painel e devolve o foco ao botão",
    ],
    comando: "node scripts/e2e/professor/12-agente-de-ia.mjs",
  },
  async (r) => {
    /* 1280px: a largura em que o botão mora FORA da coluna do conteúdo. A
       folga embaixo do `main` em janela estreita tem prova visual nos prints. */
    const p = await r.pagina("professor", { viewport: { width: 1280, height: 900 } });
    await r.entrar(p, conta("professor", { turma: "8A" }).login);
    if (!new URL(p.url()).pathname.startsWith("/professor")) await p.goto(`${HUB}/professor`);

    /* ── 1. O botão, e NÃO um card ─────────────────────────────────────── */
    const botao = p.getByRole("button", { name: NOME, exact: true });
    await botao.waitFor({ timeout: 30_000 });
    const painel = p.locator("#agente-de-ia-do-professor");
    r.exigir((await botao.getAttribute("aria-controls")) === "agente-de-ia-do-professor", "o botão aponta o painel (aria-controls)");
    const cards = await p.locator("main a").filter({ hasText: /Agente de IA/i }).count();
    r.exigir(cards === 0, `o agente NÃO é card na home (${cards} cartão(ões) com o nome)`);
    await r.registrar(p, "botao-flutuante", {
      titulo: "O botão no canto",
      mostra: "A home do professor com o mascote do agente no canto inferior direito — e nenhum card dele.",
      prova:
        "A superfície do agente é o botão, montado pelo LAYOUT da área: aparece em toda tela do " +
        "professor sem cada página lembrar dele, e some inteiro quando a rede desliga o produto.",
    });

    /* ── 2. Abrir: foco no campo, aviso fixo ───────────────────────────── */
    /* Portão de hidratação: em dev o botão do SSR existe antes do React. Um
       clique cedo demais não abre nada — repete até o `aria-expanded` mudar. */
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
      await botao.click();
      const abriu = await p
        .waitForFunction(() => document.querySelector("[data-agente-professor]")?.getAttribute("aria-expanded") === "true", null, { timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (abriu) break;
    }
    await painel.waitFor({ state: "visible", timeout: 10_000 });
    const campo = painel.getByRole("textbox", { name: "Mensagem para o agente de IA do professor" });
    await p.waitForFunction(
      () => document.activeElement?.getAttribute("aria-label") === "Mensagem para o agente de IA do professor",
      null,
      { timeout: 5_000 },
    ).catch(() => {});
    const focoNoCampo = await campo.evaluate((el) => el === document.activeElement);
    r.exigir(focoNoCampo, "abrir leva o foco ao campo da mensagem");
    r.exigir((await painel.getAttribute("data-clarity-mask")) === "true", "o painel inteiro é mascarado no Clarity");
    r.exigir(await painel.getByText("Não escreva nomes de estudantes.").isVisible(), "o aviso para não escrever nomes de estudantes está à vista");
    r.exigir(await painel.getByText(/Tiro dúvidas sobre a BNCC/).isVisible(), "a mensagem de boas-vindas diz o que o agente faz");
    await r.registrar(p, "painel-aberto", {
      titulo: "O painel abre no campo",
      mostra: "O painel compacto: boas-vindas do agente, o aviso fixo e o campo com o cursor.",
      prova:
        "As boas-vindas são LOCAIS (não gastam quota). O aviso fica junto do campo porque é na hora " +
        "de escrever que ele serve — e o painel inteiro é mascarado na gravação do Clarity, porque o " +
        "aviso não é trava.",
    });

    /* ── 3. A primeira resposta, por stream ────────────────────────────── */
    const respostas = painel.getByRole("article", { name: NOME });
    const comErro = painel.locator('article[data-estado="erro"]');
    await campo.fill(PERGUNTA);
    await campo.press("Enter");
    await esperarOuFalharCedo(painel.getByText(/Encontrei no acervo uma boa referência/), comErro, {
      timeout: 60_000,
      oQue: "a primeira resposta do agente (a api está com AGENTE_PROFESSOR_MODO=mock?)",
    });
    await esperarOuFalharCedo(painel.getByText(FONTE), comErro, { timeout: 30_000, oQue: "a fonte da resposta" });
    const ultima = respostas.last();
    await p.waitForFunction(
      () => {
        const todas = document.querySelectorAll("#agente-de-ia-do-professor article[aria-label='Agente de IA do professor']");
        return todas[todas.length - 1]?.getAttribute("aria-busy") === null;
      },
      null,
      { timeout: 30_000 },
    );
    const texto = await ultima.innerText();
    r.exigir(/EF06MA01/.test(texto), "a resposta cita EF06MA01");
    r.exigir(texto.includes(FONTE), `a fonte aparece com a página: "${FONTE}"`);
    await r.registrar(p, "resposta-com-fonte", {
      titulo: "A resposta, com a fonte",
      mostra: `O texto do agente citando EF06MA01 e a linha "Fontes: ${FONTE}".`,
      prova:
        "A resposta chegou em trechos pelo hub — o navegador nunca fala com a api nem com o agente — " +
        "e a fonte vem do retorno da busca no acervo, com a página: o professor confere no livro.",
    });

    /* ── 4. O título do agente, no cabeçalho ───────────────────────────── */
    await painel.getByText(TITULO).first().waitFor({ timeout: 20_000 });
    r.exigir(await painel.locator("header").getByText(TITULO).isVisible(), `o cabeçalho mostra o título que o agente deu: "${TITULO}"`);

    /* ── 5. Expandir e recolher ────────────────────────────────────────── */
    await painel.getByRole("button", { name: "Expandir" }).click();
    await p.waitForFunction(() => document.querySelector("#agente-de-ia-do-professor")?.getAttribute("data-size") === "expandido", null, { timeout: 5_000 });
    await p.waitForTimeout(400);
    await r.registrar(p, "expandido", {
      titulo: "Expandido",
      mostra: "O painel grande, para ler uma resposta longa sem sair da tela.",
      prova: "O tamanho é preferência visual e fica lembrado no navegador — nunca a conversa, que é da api.",
    });
    await painel.getByRole("button", { name: "Recolher" }).click();
    await p.waitForFunction(() => document.querySelector("#agente-de-ia-do-professor")?.getAttribute("data-size") === "compacto", null, { timeout: 5_000 });
    r.exigir(true, "expande e recolhe pelo cabeçalho");

    /* ── 6. O histórico ────────────────────────────────────────────────── */
    await painel.getByRole("button", { name: "Histórico de conversas" }).click();
    const historico = painel.getByRole("navigation", { name: "Histórico de conversas" });
    await historico.waitFor({ timeout: 10_000 });
    const ativa = historico.locator('button[aria-current="true"]');
    await ativa.waitFor({ timeout: 15_000 });
    // A linha é título + quando; o título vem primeiro.
    const linhaDaAtiva = (await ativa.innerText()).replace(/\s+/g, " ").trim();
    r.exigir(linhaDaAtiva.startsWith(TITULO), `a conversa aberta aparece no histórico com o título do agente ("${linhaDaAtiva}")`);
    await r.registrar(p, "historico", {
      titulo: "O histórico",
      mostra: `A lista de conversas, com "${TITULO}" marcada como a aberta e a hora da última mensagem.`,
      prova:
        "O título é o que o AGENTE escreveu depois do 1º turno, espelhado pela api. A lista é desta " +
        "escola: trocar de escola no cabeçalho troca a lista.",
    });
    // No compacto o histórico toma o lugar da conversa: escolher a ativa volta a ela.
    await ativa.click();
    await campo.waitFor({ state: "visible", timeout: 10_000 });

    /* ── 7. Código que não existe ──────────────────────────────────────── */
    const antes = await respostas.count();
    await campo.fill(PERGUNTA_COM_CODIGO_INEXISTENTE);
    await campo.press("Enter");
    await p.waitForFunction(
      (n) => document.querySelectorAll("#agente-de-ia-do-professor article[aria-label='Agente de IA do professor']").length > n,
      antes,
      { timeout: 10_000 },
    );
    await esperarOuFalharCedo(respostas.last().getByText(/EF99ZZ99.*não existe na BNCC/), comErro, {
      timeout: 60_000,
      oQue: "o aviso de código inexistente",
    });
    await r.registrar(p, "aviso-de-codigo", {
      titulo: "Código que não existe",
      mostra: "A segunda resposta cita EF99ZZ99 e traz o aviso de que o código não existe na BNCC.",
      prova:
        "A api confere cada código citado contra a BNCC no fim do turno. Um código inventado num " +
        "plano de aula é o erro mais caro que um modelo pode cometer aqui — e o mais fácil de não ver.",
    });

    /* ── 8. Fechar no meio da resposta não a perde ─────────────────────── */
    const antesDoFechar = await respostas.count();
    await campo.fill("Obrigado! Pode resumir em uma frase?");
    await campo.press("Enter");
    await p.keyboard.press("Escape");
    await painel.waitFor({ state: "hidden", timeout: 5_000 });
    const selo = await p
      .getByText(/1 resposta nova/)
      .waitFor({ state: "attached", timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (selo) {
      r.exigir(true, "a resposta que terminou com o painel fechado acende o selo do botão");
      await r.registrar(p, "selo-de-resposta-nova", {
        titulo: "Resposta nova, com o painel fechado",
        mostra: "O botão com o selo: a resposta terminou enquanto o painel estava fechado.",
        prova:
          "Fechar só esconde o painel — o turno continua e a resposta não se perde (a quota já foi " +
          "paga). Só o \"Parar\" interrompe.",
      });
    } else {
      r.ressalva(
        "o mock terminou o turno antes de o painel fechar, então o selo não tinha o que contar — " +
          "a regra (fechar não aborta) segue coberta pela resposta completa ao reabrir",
      );
    }
    await botao.click();
    await painel.waitFor({ state: "visible", timeout: 5_000 });
    await p.waitForFunction(
      (n) => {
        const todas = document.querySelectorAll("#agente-de-ia-do-professor article[aria-label='Agente de IA do professor']");
        return todas.length > n && todas[todas.length - 1]?.getAttribute("aria-busy") === null;
      },
      antesDoFechar,
      { timeout: 30_000 },
    );
    const terceira = await respostas.last().innerText();
    r.exigir(/Encontrei no acervo/.test(terceira) && !/interrompida/i.test(terceira), "reaberto, a resposta está inteira — fechar não a interrompeu");

    /* ── 9. Apagar, com confirmação ────────────────────────────────────── */
    await painel.getByRole("button", { name: "Histórico de conversas" }).click();
    await historico.waitFor({ timeout: 10_000 });
    const linhaAtiva = historico.locator("li").filter({ has: p.locator('button[aria-current="true"]') });
    await linhaAtiva.waitFor({ timeout: 15_000 });
    const idDaConversa = await linhaAtiva.getAttribute("data-conversa-id");
    await linhaAtiva.getByRole("button", { name: `Excluir a conversa “${TITULO}”` }).click();
    const confirmacao = historico.getByRole("group", { name: new RegExp(`Excluir esta conversa\\?.*${TITULO}`) });
    await confirmacao.waitFor({ timeout: 5_000 });
    await r.registrar(p, "confirmar-exclusao", {
      titulo: "Excluir pede confirmação",
      mostra: "A linha da conversa vira a pergunta \"Excluir esta conversa?\", com Cancelar e Excluir.",
      prova: "Dois passos, na própria linha e sem janela: apagar é definitivo — a sessão no agente some junto.",
    });
    await confirmacao.getByRole("button", { name: "Excluir", exact: true }).click();
    await historico.locator(`li[data-conversa-id="${idDaConversa}"]`).waitFor({ state: "detached", timeout: 15_000 });
    r.exigir(true, "a conversa apagada some do histórico");
    await r.registrar(p, "conversa-apagada", {
      titulo: "A conversa sumiu",
      mostra: "O histórico sem a conversa apagada; o chat volta a uma conversa nova.",
      prova:
        "Apagar escapa do interruptor da rede: com o produto desligado, o professor continua podendo " +
        "apagar o que é dele (ADR-87).",
    });

    /* ── 10. Esc fecha e devolve o foco ────────────────────────────────── */
    await painel.getByRole("button", { name: "Nova conversa" }).focus();
    await p.keyboard.press("Escape");
    await painel.waitFor({ state: "hidden", timeout: 5_000 });
    const focoNoBotao = await botao.evaluate((el) => el === document.activeElement);
    r.exigir(focoNoBotao, "Esc fecha o painel e o foco volta ao botão");
    r.exigir((await botao.getAttribute("aria-expanded")) === "false", "fechado, o botão diz aria-expanded=false");
    await r.registrar(p, "fechado", {
      titulo: "Fechado",
      mostra: "A tela de volta, com o botão no canto.",
      prova: "O painel não é modal (não prende o foco nem cobre a tela), mas devolve o foco a quem o abriu.",
    });
  },
);
