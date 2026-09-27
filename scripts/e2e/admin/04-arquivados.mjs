import { HUB, estadoDosIcones, suite } from "../lib/roteiro.mjs";
import { conta, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * AS EXPERIÊNCIAS ARQUIVADAS (ADR-116): o que saiu do produto sem ser apagado.
 *
 * Uma missão é arquivada quando outra toma o código dela (o código é derivado da
 * série e da unidade, ADR-110). O UnooTube foi o primeiro: o Jornal da Escola
 * ocupa o 4º ano, unidade 1, e o UnooTube virou `backup-exp04ef1b` — saiu da
 * sala, do catálogo e de Recursos, e os dados ficaram.
 *
 * A suíte só LÊ: a tela não tem ação, e o seed escreve a arquivada a partir de
 * `apps/experiencias/backup-*` (numa stack antiga, a migração a moveu de
 * `experiencias`). Nada fica no banco.
 */

await suite(
  {
    slug: "admin/04-arquivados",
    papel: "admin",
    titulo: "As experiências arquivadas",
    subtitulo: "o que saiu do produto sem ser apagado",
    contexto:
      "Quando uma missão nova ocupa o lugar de outra na trilha, a antiga não é apagada: ela é " +
      "arquivada. Sai da sala das turmas, do catálogo e do painel de recursos, e os dados que as " +
      "turmas produziram ficam guardados. Esta tela é onde a Unooria vê o que já teve.",
    prova: [
      "O quarto item da barra da Unooria leva a Arquivados",
      "O UnooTube está na lista, com o código de origem, onde ficava na trilha e por que saiu",
      "Os dados guardados aparecem como a fotografia do dia do arquivamento, e a tela diz isso",
      "O UnooTube NÃO aparece mais em Recursos: arquivada não se liga nem se desliga",
      "A REDE (gestor do contrato) não lê a lista (403) e não entra na tela",
    ],
    comando: "node scripts/e2e/admin/04-arquivados.mjs",
  },
  async (r) => {
    const admin = conta("admin");
    const p = await r.pagina("admin");
    await r.entrar(p, admin.login, admin.senha ?? senhaDemo());
    await p.waitForURL("**/unooria/recursos", { timeout: 30_000 });

    // ── a tela ──────────────────────────────────────────────────────────
    /* Pelo MENU, e não pela URL: o item precisa existir e levar ao lugar certo.
       O rótulo do item do `SideBar` vive num tooltip oculto, então o alvo é o
       item inteiro (a armadilha registrada em `unooria/AGENTS.md`). */
    await p.locator(".unooria-sidebar-item").filter({ hasText: "Arquivados" }).first().click();
    await p.waitForURL("**/unooria/arquivados", { timeout: 20_000 });
    const linha = p.locator("table tbody tr").filter({ hasText: "UnooTube" }).first();
    await esperarOuFalharCedo(linha, p.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "a linha do UnooTube na lista de arquivadas",
    });
    await p.waitForTimeout(800);

    const icones = await estadoDosIcones(p);
    r.exigir(icones !== "texto", `os ícones da barra renderizam como glifo, não como nome (${icones})`);

    const textoDaLinha = await linha.innerText();
    r.exigir(/exp04ef1b/.test(textoDaLinha), "a linha traz o código de origem (exp04ef1b)");
    r.exigir(/4º ano, unidade 1/.test(textoDaLinha), "e onde a missão ficava na trilha (4º ano, unidade 1)");
    r.exigir(/Jornal da Escola/.test(textoDaLinha), "e o motivo: o Jornal da Escola tomou o código");
    r.exigir(/\bturmas?\b/.test(textoDaLinha) && /\bestudantes?\b/.test(textoDaLinha), "e os dados guardados (turmas e estudantes)");
    /* A página inteira, não `main`: a área `/unooria` não tem o marco `<main>`
       (só a do professor tem), e o `locator("main")` esperava até o timeout. */
    const rodape = await p.locator("body").innerText();
    r.exigir(
      /contagem do dia do arquivamento/.test(rodape),
      "a tela diz que os números são os do dia do arquivamento, não uma recontagem",
    );

    await r.registrar(p, "lista-de-arquivadas", {
      titulo: "O que saiu do produto sem ser apagado",
      mostra:
        "A lista de arquivadas com o UnooTube: código de origem, onde ficava na trilha, última versão, " +
        "dados guardados, motivo e data.",
      prova:
        "Apagar teria sido o caminho do Eco no Grupo, que nunca teve dado a guardar. O UnooTube esteve " +
        "em nuvem: arquivar o tira de toda turma e mantém o que as turmas produziram, e esta tela é o " +
        "registro de que ele existiu (ADR-116).",
      inteira: true,
    });

    // ── fora de Recursos ────────────────────────────────────────────────
    const painel = await p.request.get(`${HUB}/api/plataforma/recursos/painel`);
    const idsNoPainel = painel.ok()
      ? ((await painel.json()).produtos ?? []).flatMap((pr) => (pr.experiencias ?? []).map((e) => e.expId))
      : [];
    r.exigir(painel.ok(), `o painel de recursos respondeu (${painel.status()})`);
    r.exigir(
      !idsNoPainel.some((id) => /04ef1b/.test(id) && id !== "exp04ef1b"),
      "o UnooTube arquivado não aparece em Recursos: arquivada não se liga nem se desliga",
    );

    // ── do lado da rede ─────────────────────────────────────────────────
    const gestor = conta("gestor_contrato");
    const pr = await r.pagina("rede");
    await r.entrar(pr, gestor.login, gestor.senha ?? senhaDemo());
    await pr.waitForTimeout(1000);
    const leituraNegada = await pr.request.get(`${HUB}/api/plataforma/recursos/arquivadas`, { failOnStatusCode: false });
    const telaDaRede = await pr.request.get(`${HUB}/unooria/arquivados`, { failOnStatusCode: false, maxRedirects: 0 });
    r.exigir(leituraNegada.status() === 403, `o gestor do contrato não lê a lista de arquivadas (${leituraNegada.status()})`);
    r.exigir(
      telaDaRede.status() >= 300 && telaDaRede.status() < 400,
      `a tela /unooria/arquivados manda o gestor do contrato embora (${telaDaRede.status()}): a área é só do admin`,
    );
    await r.registrar(pr, "a-rede-nao-alcanca", {
      titulo: "Do lado da rede: nada",
      mostra: "A casa do gestor do contrato, sem caminho para a lista de arquivadas.",
      prova:
        "O catálogo do que a Unooria já tirou do produto é da fornecedora (ADR-88/116). Medido: " +
        `GET ${leituraNegada.status()}, tela ${telaDaRede.status()}.`,
    });
  },
);
