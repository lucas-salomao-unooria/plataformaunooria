import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * EVIDÊNCIA PEDAGÓGICA (E14): o PERFIL do estudante — as habilidades da BNCC
 * que ele demonstrou nas missões, aberto pelo nome na aba Estudantes da sala.
 *
 * O que esta suíte cobra e nenhuma outra cobre:
 *
 *  - na aba Estudantes, o NOME leva ao perfil, já dentro da turma; o relatório
 *    da Vila do Lume continua na linha, ao lado (a `professor/01` conta esse);
 *  - o perfil abre com o nome da criança e, sem evidência, o estado vazio com
 *    a frase exata; com evidência, cada missão traz o MELHOR nível entre as
 *    atividades, e a habilidade sem nível é "Não avaliado" — nunca "Não
 *    atingiu" (F14.7, H14.7.4);
 *  - a trilha do layout volta para a ABA de estudantes da turma, com o nome da
 *    turma e o da criança publicados pela página;
 *  - quem não é da turma do professor não existe: a api responde 404, nunca 403.
 *
 * O PAINEL de habilidades da atividade (as rodadas, o ajuste, "Confirmar para a
 * turma") não entra aqui: a única missão com ficha pedagógica é Quem mandou
 * isso? v2.2 (ADR-118), e o painel dela é provado em
 * `estudante/10-quem-mandou-isso`, na 5A, com o nível de cada habilidade
 * conferido contra a régua.
 *
 * FIXTURE. Só leitura, numa turma "B" (4B): nada é gravado, e rodar de novo
 * prova a mesma coisa. Com o perfil vazio (o estado de hoje), a prova é o
 * estado vazio; se um dia houver evidência, a suíte ramifica e confere os
 * cartões das missões contra a resposta da api.
 */
const TURMA = process.env.TURMA_PERFIL ?? "4B";
const VAZIO = "Nenhuma habilidade registrada ainda.";
/** O que pode aparecer numa `Tag` do perfil: os níveis, o N/A da missão e o selo da mais recente. */
const NIVEIS = ["Atingiu", "Em processo", "Não atingiu", "Não avaliado", "Mais recente"];

/** O docente precisa LECIONAR na turma: `conta` casa o começo da coluna, e ela pode ser "4A + 4B". */
const professorDa = (turma) =>
  contasDe("professor").find((c) => c.turma.split(" + ").includes(turma)) ?? conta("professor", { turma });

async function idDaTurma(p, nome) {
  const resposta = await p.request.get(`${BFF}/turmas/minhas`);
  const turmas = resposta.ok() ? await resposta.json() : [];
  return (Array.isArray(turmas) ? turmas : []).find((t) => t.nome === nome)?.id ?? null;
}

/**
 * PORTÃO DE HIDRATAÇÃO: em dev o HTML do SSR chega antes do bundle, e um clique
 * nesse intervalo não chama handler nenhum. O sinal de que o React assumiu o
 * elemento é a chave `__react*` que ele pendura no nó.
 */
async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

await suite(
  {
    slug: "professor/11-perfil-do-aluno",
    papel: "professor",
    titulo: "O perfil do estudante",
    subtitulo: "as habilidades da BNCC que cada criança demonstrou nas missões",
    contexto:
      "Na sala, o nome de cada estudante leva ao perfil dele: em cada missão, em cada atividade, o nível " +
      "de cada habilidade da BNCC — a melhor rodada, só com o que vale. O painel por atividade, em que o " +
      "professor ajusta e confirma a aula projetada, só aparece quando a missão tem ficha pedagógica; " +
      "hoje só Quem mandou isso? tem, e o painel dela é fotografado na suíte do estudante/10.",
    prova: [
      "Na aba Estudantes da sala, o nome leva ao perfil, dentro da turma",
      "O perfil abre com o nome do estudante",
      `Sem evidência, o perfil diz "${VAZIO}"`,
      "Com evidência, cada missão é um cartão com o melhor nível de cada habilidade entre as atividades; a que não tem nível é \"Não avaliado\", nunca \"Não atingiu\"",
      "A trilha volta para a aba de estudantes da turma, com o nome da turma e o do estudante",
      "Estudante que o professor não ensina não existe: 404, nunca 403",
    ],
    comando: "node scripts/e2e/professor/11-perfil-do-aluno.mjs",
  },
  async (r) => {
    const erroNaTela = (p) => p.locator(ALERTA_DE_ERRO);

    const professora = professorDa(TURMA);
    const p = await r.pagina("professor");
    await r.entrar(p, professora.login);

    const turmaId = await idDaTurma(p, TURMA);
    if (!r.exigir(Boolean(turmaId), `a professora leciona na ${TURMA} (GET /turmas/minhas)`)) return;

    // ── a sala, aba Estudantes ──────────────────────────────────────────
    await p.goto(`${HUB}/professor/turmas/${turmaId}`, { waitUntil: "domcontentloaded" });
    const aba = p.getByRole("tab", { name: /^Estudantes/ });
    await hidratado(p, aba);
    await Promise.all([p.waitForURL(/[?&]aba=estudantes/, { timeout: 20_000 }), aba.click()]);

    const nomes = p.locator(`a[href^="/professor/turmas/${turmaId}/estudantes/"]`);
    await esperarOuFalharCedo(nomes, erroNaTela(p), { timeout: 20_000, oQue: "a lista de estudantes da sala" });
    const quantos = await nomes.count();
    const vila = await p.locator('a[href^="/professor/entre-redes/vila-do-lume/estudantes/"]').count();
    r.exigir(quantos > 0, `a aba Estudantes da ${TURMA} tem ${quantos} nome(s) levando ao perfil`);
    r.exigir(vila === quantos, `e o relatório da Vila do Lume continua em cada linha (${vila} de ${quantos})`);
    await r.registrar(p, "a-aba-estudantes", {
      titulo: "O nome leva ao perfil",
      mostra: `A lista nominal da ${TURMA}: o nome de cada estudante é o caminho para o perfil, e o relatório da Vila do Lume fica ao lado.`,
      prova:
        "O perfil mora DENTRO da turma de onde o professor veio. A linha deixou de ser um link só porque " +
        "passou a ter dois destinos — link dentro de link não existe.",
      detalhe: `${quantos} estudantes`,
      inteira: true,
    });

    // ── o perfil ────────────────────────────────────────────────────────
    const primeiro = nomes.first();
    const nome = (await primeiro.innerText()).trim();
    const href = (await primeiro.getAttribute("href")) ?? "";
    const estudanteId = href.split("/").pop() ?? "";

    /* O que a api diz decide o ramo: na 4B nenhuma missão com ficha rodou, e o
       perfil costuma vir vazio (a única ficha é a da exp05ef1b, do 5º ano). A
       suíte não pode reprovar o dia em que ele deixar de vir. */
    const leitura = await p.request.get(`${BFF}/evidencias/estudante/${estudanteId}`);
    /* A `mensagem` vai junto quando falha: "rota não permitida" é o BFF do hub
       recusando o prefixo, e a api nem foi chamada — sem ela, o 404 do BFF e o
       404 da guarda da api ("Estudante não encontrado.") se leem iguais. */
    const motivo = leitura.ok() ? "" : await leitura.json().then((c) => c?.mensagem ?? "", () => "");
    if (!r.exigir(leitura.ok(), `a api devolve o perfil de ${nome} (HTTP ${leitura.status()}${motivo ? `: ${motivo}` : ""})`)) {
      return;
    }
    const perfil = await leitura.json();
    const missoes = Array.isArray(perfil?.missoes) ? perfil.missoes : [];

    await hidratado(p, primeiro);
    await Promise.all([
      p.waitForURL(new RegExp(`/professor/turmas/${turmaId}/estudantes/${estudanteId}$`), { timeout: 20_000 }),
      primeiro.click(),
    ]);
    await esperarOuFalharCedo(p.getByRole("heading", { level: 1, name: nome, exact: true }), erroNaTela(p), {
      timeout: 30_000,
      oQue: "o perfil do estudante",
    });

    if (missoes.length === 0) {
      const vazio = p.getByText(VAZIO, { exact: true });
      const apareceu = await vazio
        .waitFor({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      r.exigir(apareceu, `sem evidência, o perfil diz "${VAZIO}"`);
      r.exigir((await p.getByText("Não atingiu").count()) === 0, 'e não diz "Não atingiu" de quem não foi avaliado');
      await r.registrar(p, "perfil-vazio", {
        titulo: "O perfil, antes da primeira ficha",
        mostra: `O nome de ${nome}, a turma, e o estado vazio: "${VAZIO}"`,
        prova:
          "Não ter sido avaliado não é ter falhado. O perfil só mostra o que vale — sem a aula projetada " +
          "que ainda espera confirmação, sem N/A, sem 'Não participou' — e, sem nada que valha, diz isso.",
      });
    } else {
      const texto = await p.locator("main").innerText();
      const faltando = missoes.filter((m) => !texto.includes(m.nome));
      r.exigir(
        faltando.length === 0,
        `cada missão com evidência é um cartão (${missoes.length - faltando.length} de ${missoes.length} na tela)`,
      );
      const niveis = [...new Set((await p.locator(".unooria-tag").allInnerTexts()).map((t) => t.trim()))];
      r.exigir(
        niveis.length > 0 && niveis.every((n) => NIVEIS.includes(n)),
        `os níveis na tela são só ${NIVEIS.join(", ")} (vistos: ${niveis.join(", ")})`,
      );
      r.exigir(!/Não participou/.test(texto), "o perfil não mostra 'Não participou' como nível");
      await r.registrar(p, "perfil-com-evidencia", {
        titulo: "O perfil, missão a missão",
        mostra: `${nome}: um cartão por missão, da mais recente para a mais antiga, com o nível de cada habilidade da BNCC.`,
        prova:
          "Em cada missão vale o MELHOR nível entre as atividades, na ordem da ficha; a habilidade sem nível " +
          "é 'Não avaliado'. Sem origem, sem comparação com a turma e sem ranking: é o que ESTA criança demonstrou.",
        detalhe: `${missoes.length} missão(ões)`,
        inteira: true,
      });
    }

    // ── a trilha ────────────────────────────────────────────────────────
    const trilha = p.getByRole("navigation", { name: "Onde você está" });
    /* Os nomes próprios chegam depois da hidratação (a página os publica no
       layout): espere o nome da turma, não o relógio. */
    const comNome = await trilha
      .getByText(`Turma ${TURMA}`, { exact: true })
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    r.exigir(comNome, `a trilha nomeia a turma ("Turma ${TURMA}")`);
    const volta = await trilha.getByRole("link", { name: "Estudantes", exact: true }).getAttribute("href").catch(() => null);
    r.exigir(
      volta === `/professor/turmas/${turmaId}?aba=estudantes`,
      `"Estudantes" na trilha volta para a aba da sala (${volta ?? "sem link"})`,
    );
    /* Por texto, e não pelo último pedaço do `innerText`: o separador da trilha
       é glifo de fonte de ligadura, e o texto dele entra no `innerText`. */
    r.exigir(
      (await trilha.getByText(nome, { exact: true }).count()) > 0 &&
        (await trilha.getByRole("link", { name: nome, exact: true }).count()) === 0,
      "e termina no nome do estudante, que não é link (é a página atual)",
    );

    // ── quem não é da turma: 404, nunca 403 ─────────────────────────────
    const alheio = await p.request.get(`${BFF}/evidencias/estudante/00000000-0000-4000-8000-000000000000`);
    r.exigir(alheio.status() === 404, `estudante que a professora não ensina responde ${alheio.status()} (esperado 404)`);
  },
);
