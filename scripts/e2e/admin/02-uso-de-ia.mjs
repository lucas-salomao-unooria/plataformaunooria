import { HUB, estadoDosIcones, suite } from "../lib/roteiro.mjs";
import { conta, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * O USO DE IA DA REDE (ADR-105): o teto diário de tokens por perfil, editável
 * pelo `admin` sem deploy.
 *
 * Esta suíte é do papel `admin` — a conta da Unooria — e é a segunda coisa que
 * `admin` faz e `gestor_contrato` não (a primeira é o interruptor, `01-recursos`).
 * Ela mostra o caminho inteiro: a tela, o diálogo que cobra motivo, o valor novo
 * valendo na api na chamada seguinte, o histórico com o de/para, e a rede sem
 * alcançar a escrita.
 *
 * A LINHA DE `ia_quotas` VALE PARA A STACK INTEIRA, e a suíte escreve nela — é
 * a rota sob teste, e não existe variante por escola. Duas precauções, as
 * mesmas de `quotas-de-ia-postgres.spec.ts`: o roteiro só SOBE o teto (um valor
 * acima do atual não recusa ninguém, então uma corrida abortada não derruba a
 * IA de outra suíte) e DEVOLVE o valor original no fim. O que ela deixa no
 * banco, de propósito, são as duas linhas de `recursos_auditoria`: o histórico
 * é append-only, e apagar o registro do que aconteceu seria mentir na própria
 * tela que a suíte prova (mesma decisão de `01-recursos`).
 */

const MOTIVO_SUBIR = "Suite e2e: a rede contratou o pacote ampliado.";
const MOTIVO_DEVOLVER = "Suite e2e: devolvendo o valor anterior.";
const ACRESCIMO = 10_000;

const numero = (n) => n.toLocaleString("pt-BR");

/** O cartão de um perfil, pelo título dele. */
function cartao(pagina, titulo) {
  return pagina.locator("div.unooria-card").filter({ hasText: titulo }).first();
}

/** O teto que o cartão mostra, lido da tela — a fonte é a tela, não a URL. */
async function tetoNoCartao(pagina, titulo) {
  const texto = await cartao(pagina, titulo).innerText();
  const casou = /([\d.]+)\s*tokens por dia/.exec(texto);
  if (!casou) throw new Error(`o cartão "${titulo}" não mostra "N tokens por dia": ${texto.slice(0, 120)}`);
  return Number(casou[1].replace(/\./g, ""));
}

async function alterar(pagina, r, titulo, novoValor, motivo) {
  await cartao(pagina, titulo).getByRole("button", { name: `Alterar a quota de ${titulo.toLowerCase()}` }).click();
  const modal = pagina.locator(".unooria-modal-overlay").last();
  await modal.locator("textarea").waitFor({ timeout: 15_000 });
  await pagina.waitForTimeout(500);
  const gravar = modal.getByRole("button", { name: "Gravar" });
  const travadoAntes = await gravar.isDisabled();
  await modal.locator("input").fill(String(novoValor));
  await modal.locator("textarea").fill(motivo);
  await pagina.waitForTimeout(400);
  await gravar.click();
  await esperarOuFalharCedo(
    cartao(pagina, titulo).getByText(numero(novoValor), { exact: false }),
    pagina.locator(ALERTA_DE_ERRO),
    { timeout: 30_000, oQue: `o novo teto (${numero(novoValor)}) no cartão de ${titulo}` },
  );
  await pagina.waitForTimeout(800);
  return { travadoAntes };
}

await suite(
  {
    slug: "admin/02-uso-de-ia",
    papel: "admin",
    titulo: "O uso de IA da rede",
    subtitulo: "o teto diário de tokens por perfil, alterado pela Unooria sem deploy",
    contexto:
      "Uma rede contratou mais IA; outra teve um consumo anormal numa manhã. Até aqui o teto de cada " +
      "perfil vivia em duas variáveis de ambiente, e mudá-lo era editar o Terraform de outro repositório " +
      "e fazer deploy da api. Agora é uma linha por perfil no banco, semeada com o valor que já valia, " +
      "lida pela api antes de toda chamada de IA e editada por esta tela — com motivo, e deixando rastro.",
    prova: [
      "A tela mostra o teto de estudantes e de professores, traduzido em uso real (partidas, planos)",
      "Alterar exige MOTIVO e avisa que vale para a rede inteira, na próxima chamada",
      "O valor novo aparece no cartão e a api já o devolve — sem deploy nem reinício",
      "O histórico registra a mudança com o valor anterior, o novo, o motivo e quem a fez",
      "A REDE (gestor do contrato) não lê nem escreve a quota (403), e não entra na tela",
      "O roteiro devolve o valor original no fim; as duas linhas do histórico ficam, porque aconteceram",
    ],
    comando: "node scripts/e2e/admin/02-uso-de-ia.mjs",
  },
  async (r) => {
    const admin = conta("admin");
    const p = await r.pagina("admin");
    await r.entrar(p, admin.login, admin.senha ?? senhaDemo());
    await p.waitForURL("**/unooria/recursos", { timeout: 30_000 });

    // ── a tela ──────────────────────────────────────────────────────────
    /* Pelo MENU, e não pela URL: é o segundo item da barra da Unooria, e a
       suíte precisa provar que ele existe e leva ao lugar certo. O rótulo do
       item do `SideBar` do DS vive num tooltip OCULTO (`__tooltip-content`), então
       `getByText` acha o texto e não consegue clicar — o alvo é o item inteiro. */
    await p.locator(".unooria-sidebar-item").filter({ hasText: "Uso de IA" }).first().click();
    await p.waitForURL("**/unooria/uso-de-ia", { timeout: 20_000 });
    await cartao(p, "Estudantes").waitFor({ timeout: 30_000 });
    await cartao(p, "Professores").waitFor({ timeout: 30_000 });
    await p.waitForTimeout(1000);

    const icones = await estadoDosIcones(p);
    r.exigir(icones !== "texto", `os ícones da barra renderizam como glifo, não como nome (${icones})`);

    const tetoEstudanteAntes = await tetoNoCartao(p, "Estudantes");
    const tetoProfessorAntes = await tetoNoCartao(p, "Professores");

    await r.registrar(p, "tetos-por-perfil", {
      titulo: "Quanto cada perfil pode gastar por dia",
      mostra:
        "Dois cartões: estudantes e professores, cada um com o teto em tokens, a tradução em uso real " +
        "(partidas da Missão Tempestade, planos anuais), quem definiu e por quê. O histórico embaixo.",
      prova:
        "O teto é DADO, não variável de ambiente (ADR-105): a linha de `ia_quotas` nasce da migration " +
        "com o valor que valia por env, e a api a lê a cada `temSaldo` — sem cache, então a tela e o " +
        "processo nunca discordam.",
      detalhe: `estudantes: ${numero(tetoEstudanteAntes)} · professores: ${numero(tetoProfessorAntes)}`,
      inteira: true,
    });

    // ── o diálogo ───────────────────────────────────────────────────────
    const historicoAntes = await p.locator("table").last().locator("tbody tr").count().catch(() => 0);

    await cartao(p, "Estudantes").getByRole("button", { name: "Alterar a quota de estudantes" }).click();
    const modal = p.locator(".unooria-modal-overlay").last();
    await modal.locator("textarea").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(600);
    const gravar = modal.getByRole("button", { name: "Gravar" });
    const travadoSemMudanca = await gravar.isDisabled();

    await r.registrar(p, "dialogo-cobra-motivo", {
      titulo: "Alterar pede motivo e avisa o alcance",
      mostra:
        "O diálogo com o valor atual no campo, o aviso de que vale para a rede inteira na próxima " +
        "chamada, e o botão travado enquanto nada mudou e o motivo está vazio.",
      prova:
        "Aqui toda mudança é exceção ao padrão da plataforma, e o motivo é obrigatório SEMPRE (Zod). " +
        "Zero e negativo o banco recusa por CHECK: fechar a IA de um produto é o interruptor da ADR-87, " +
        `não a quota. Botão travado sem mudança nem motivo: ${travadoSemMudanca}.`,
      detalhe: `botão desabilitado sem mudança: ${travadoSemMudanca}`,
    });

    const novoTeto = tetoEstudanteAntes + ACRESCIMO;
    await modal.locator("input").fill(String(novoTeto));
    await modal.locator("textarea").fill(MOTIVO_SUBIR);
    await p.waitForTimeout(400);
    await gravar.click();
    await esperarOuFalharCedo(
      cartao(p, "Estudantes").getByText(numero(novoTeto), { exact: false }),
      p.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "o novo teto no cartão de estudantes" },
    );
    await p.waitForTimeout(800);

    // ── a api já devolve o valor novo ───────────────────────────────────
    /* Por `page.request` (fora da página): compartilha os cookies da sessão e
       não gera evento de rede que o vigia de console leria como erro. */
    const naApi = await p.request.get(`${HUB}/api/plataforma/recursos/quotas-de-ia`);
    const quotas = (await naApi.json()).quotas ?? [];
    const estudanteNaApi = quotas.find((q) => q.perfil === "estudante");
    r.exigir(
      estudanteNaApi?.tokensPorDia === novoTeto,
      `a api já devolve o teto novo para estudantes (${numero(estudanteNaApi?.tokensPorDia ?? 0)}) — é o que o QuotaService lê na próxima chamada`,
    );
    r.exigir(
      estudanteNaApi?.definidoPorNome === admin.nome,
      `quem decidiu ficou na linha: ${estudanteNaApi?.definidoPorNome}`,
    );

    await r.registrar(p, "teto-alterado", {
      titulo: "O valor novo, valendo",
      mostra:
        `O cartão de estudantes com ${numero(novoTeto)} tokens por dia, quem alterou e o motivo escrito ` +
        "no diálogo. A tradução em partidas mudou junto.",
      prova:
        "Não houve deploy nem reinício: a api lê a linha a cada chamada. Quem já passou do teto " +
        "novo hoje fica sem IA até amanhã; quem estava abaixo ganha o espaço na hora.",
      detalhe: `GET /recursos/quotas-de-ia → estudante: ${numero(estudanteNaApi?.tokensPorDia ?? 0)}`,
      inteira: true,
    });

    // ── o histórico ─────────────────────────────────────────────────────
    const historico = p.locator("table").last();
    await historico.waitFor({ timeout: 30_000 });
    await historico.getByText("Quota de IA alterada", { exact: false }).first().waitFor({ timeout: 20_000 });
    const textoDoHistorico = await historico.innerText();
    r.exigir(textoDoHistorico.includes(MOTIVO_SUBIR), "o motivo escrito no diálogo aparece no histórico");
    r.exigir(
      textoDoHistorico.includes(`de ${numero(tetoEstudanteAntes)} para ${numero(novoTeto)}`),
      `a linha diz de quanto para quanto: de ${numero(tetoEstudanteAntes)} para ${numero(novoTeto)}`,
    );
    const linhasDepois = await historico.locator("tbody tr").count();
    r.exigir(
      linhasDepois === historicoAntes + 1,
      `o histórico releu sozinho: ${historicoAntes} linhas antes, ${linhasDepois} depois — sem recarregar a página`,
    );
    await historico.scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);

    await r.registrar(p, "historico-da-quota", {
      titulo: "Quem mudou, de quanto para quanto, e por quê",
      mostra:
        "A linha nova no histórico: a ação, o valor anterior e o novo na etiqueta, o motivo e o nome de " +
        "quem alterou. Só mudanças de quota aparecem aqui — o interruptor tem a tela dele.",
      prova:
        "É o MESMO registro append-only do painel de recursos (ADR-89), com uma ação nova e o `detalhe` " +
        "{de, para} — uma tabela de histórico própria seria a segunda tela de 'quem mudou o quê' que " +
        "ninguém abre. UPDATE é recusado por trigger; o nome de quem operou fica congelado na linha.",
      detalhe: `linhas: ${historicoAntes} → ${linhasDepois}`,
      inteira: true,
    });

    // ── a rede não alcança ──────────────────────────────────────────────
    const gestor = conta("gestor_contrato");
    const pr = await r.pagina("rede");
    await r.entrar(pr, gestor.login, gestor.senha ?? senhaDemo());
    await pr.waitForTimeout(1000);
    const leituraNegada = await pr.request.get(`${HUB}/api/plataforma/recursos/quotas-de-ia`, { failOnStatusCode: false });
    const escritaNegada = await pr.request.put(`${HUB}/api/plataforma/recursos/quotas-de-ia/estudante`, {
      data: { tokensPorDia: 999_999, motivo: "sonda da suite: isto tem de ser recusado" },
      failOnStatusCode: false,
    });
    const telaDaRede = await pr.request.get(`${HUB}/unooria/uso-de-ia`, { failOnStatusCode: false, maxRedirects: 0 });
    r.exigir(
      leituraNegada.status() === 403 && escritaNegada.status() === 403,
      `o gestor do contrato não lê nem escreve a quota (GET ${leituraNegada.status()}, PUT ${escritaNegada.status()})`,
    );
    r.exigir(
      telaDaRede.status() >= 300 && telaDaRede.status() < 400,
      `a tela /unooria/uso-de-ia manda o gestor do contrato embora (${telaDaRede.status()}): a área é só do admin`,
    );
    /* O valor não mudou por causa da sonda. */
    const conferencia = await p.request.get(`${HUB}/api/plataforma/recursos/quotas-de-ia`);
    const aindaNovo = ((await conferencia.json()).quotas ?? []).find((q) => q.perfil === "estudante")?.tokensPorDia;
    r.exigir(aindaNovo === novoTeto, `a sonda recusada não mexeu em nada (${numero(aindaNovo ?? 0)})`);

    await r.registrar(pr, "a-rede-nao-alcanca", {
      titulo: "Do lado da rede: nada",
      mostra: "A casa do gestor do contrato, sem nenhum caminho para a quota.",
      prova:
        "Quanto de IA uma rede pode gastar por dia é decisão comercial da fornecedora (ADR-88/105): um " +
        `gestor que pudesse SUBIR a quota decidiria o custo variável da Unooria. Medido: GET ${leituraNegada.status()}, ` +
        `PUT ${escritaNegada.status()}, tela ${telaDaRede.status()}.`,
    });

    // ── devolver o valor ────────────────────────────────────────────────
    await p.bringToFront();
    await p.waitForTimeout(400);
    await alterar(p, r, "Estudantes", tetoEstudanteAntes, MOTIVO_DEVOLVER);
    r.exigir((await tetoNoCartao(p, "Estudantes")) === tetoEstudanteAntes, `o teto de estudantes voltou a ${numero(tetoEstudanteAntes)}`);

    await r.registrar(p, "valor-devolvido", {
      titulo: "Devolvido — e o histórico guarda as duas idas",
      mostra: "O cartão de volta ao valor original, e o histórico com a subida e a volta, na ordem inversa.",
      prova:
        "A linha da quota é sobrescrita; o histórico não. Devolver o valor apaga a mudança do estado e " +
        "acrescenta uma linha ao registro — é assim que, meses depois, alguém sabe que isto aconteceu.",
      inteira: true,
    });
  },
);
