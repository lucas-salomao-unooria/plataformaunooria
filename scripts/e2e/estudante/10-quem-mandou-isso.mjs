import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";

/**
 * Quem mandou isso? v2.2 (exp05ef1b), nas duas pontas da sala: a professora
 * prepara e conduz, o estudante joga. Dois contextos de navegador, porque
 * metade do que a missão instala só se prova com as duas telas vivas.
 *
 * O que esta suíte cobra, e por que cada item é uma regra do software:
 *
 * 1. **A missão NASCE VAZIA** (a fala da Nina leva o tema do pacote). Sem o
 *    clique em "Aprovar Pacote" a lista de conversas fica vazia — e, na
 *    corrida em que a turma ainda não tem pacote, o estudante vê a Nina
 *    chegar SOZINHA, pelo polling, quando a professora aprova.
 * 2. **O gabarito não desce antes da hora.** A sessão do estudante é lida
 *    CRUA (pelo BFF, com a sessão dele) antes de entrar, depois do voto e só
 *    então depois da revelação: as mensagens nunca têm `veracidade` nem `tom`,
 *    e `revelacao` é `null` até o voto E o botão da professora.
 * 3. **Exatamente 3, e o Mural é um latch.** A quarta seta FALA (o aviso de
 *    limite) sem abrir a folha; o servidor recusa 4 e recusa 2; confirmado, o
 *    Mural não muda mais — nem pela tela, nem por chamada direta.
 * 4. **Os três botões chegam por polling HTTP** (ADR-93): revelação, síntese
 *    e reflexão trocam a tela do estudante SEM recarregar. E um F5 no meio
 *    devolve a mesma tela, porque o passo é do servidor.
 * 5. **O Se/Então tem piso de 15 contado depois do trim**, e o servidor recusa
 *    o curto e o texto sem sentido — mas NÃO corrige a regra (a EF05CO04 vem
 *    só da P2).
 * 6. **As perguntas do PO não expõem acerto**: o recibo é `{ enviada: true }`
 *    e a tela diz só "Resposta enviada". Quem sabe o nível é a professora, no
 *    bloco "Habilidades da BNCC" — e a suíte confere que o nível dali é o que
 *    a régua dá para as 3 escolhidas (EF05CO08) e para as alternativas
 *    marcadas (EF05CO03 e EF05CO04).
 * 7. **O Termômetro não tem nome**, nem no painel nem no telão.
 *
 * A suíte NÃO aperta "Gerar Atividade com IA": uma corrida que depende do
 * Vertex reprova por fornecedor e reporta como se o produto tivesse quebrado.
 * Ela aprova o pacote curado padrão, que também é curadoria (passa pelos olhos
 * da professora e pelo clique dela).
 *
 * FIXTURE: a turma A do 5º ano (o seed libera a exp05ef1b lá). O estado é do
 * servidor e sobrevive ao roteiro, então a suíte começa pelo que a turma TEM:
 * se o pacote já estava aprovado (a corrida de ontem), ela o reaprova (é
 * idempotente — mesma atividade) e, se a turma já andou, aperta "Zerar Turma
 * para Nova Aplicação", que abre a rodada seguinte sem apagar nada.
 */
const SERIE = "5EF";
const EXP_ID = "exp05ef1b";
/* A turma vem do CSV do seed, não fixada aqui: um roteiro que fixa o nome
   falha com "timeout esperando option" quando o seed renomeia — um sintoma que
   não aponta para a causa. */
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;
const FICHA = `${HUB}/professor/entre-redes/5-ano/unidade-1`;

/** O Então de 14 caracteres (depois do trim): um a menos que o piso. */
const ENTAO_CURTO = "pergunto à mãe   ";
/** A regra que a criança envia. Sem palavra que o filtro de texto sem sentido recuse. */
const ENTAO = "confiro no site oficial da escola antes de passar pra frente";

/** Rótulos dos crachás, como a experiência os escreve (`textos.ts`). */
const ROTULO_DA_VERACIDADE = { verdadeira: "Verdadeira", falsa: "Falsa" };
const ROTULO_DO_TOM = { emocional: "Emocional", neutra: "Neutra" };

/** O que nunca pode aparecer na tela da criança: nível, acerto, nota. */
const PALAVRAS_DE_ACERTO = /\b(atingiu|em processo|n[aã]o atingiu|acertou|acertei|errou|errada|correta|incorreta|pontos|nota)\b/i;

/**
 * A régua da EF05CO08 (decisão de 2026-09-25), escrita AQUI de novo, à parte
 * da api: é o oráculo contra o qual a suíte confere o nível que o painel da
 * professora mostra. Se as duas divergirem, uma das duas mudou sem a outra.
 */
function nivelEsperadoCO08(escolhidas) {
  const falsas = escolhidas.filter((m) => m.veracidade === "falsa");
  if (falsas.length === 0) return "atingiu";
  if (falsas.length === 1) return falsas[0].tom === "emocional" ? "atingiu" : "em_processo";
  return "nao_atingiu";
}

/** A api pelo BFF do hub, com a sessão do navegador (APIRequestContext divide os cookies do contexto). */
async function lerApi(p, caminho) {
  const resposta = await p.request.get(`${BFF}${caminho}`);
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

async function mandarApi(p, metodo, caminho, dados) {
  const resposta = await p.request.fetch(`${BFF}${caminho}`, { method: metodo, data: dados ?? {} });
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

/**
 * Espera a API chegar a um estado, e PERDE A CORRIDA para um erro dela: um 4xx
 * ou 5xx reprova na hora, com o corpo na mensagem. A pausa entre as leituras é
 * ritmo de sondagem, não espera de desfecho — o desfecho é a condição.
 */
async function esperarNaApi(p, caminho, condicao, { oQue, timeout = 20_000 } = {}) {
  const limite = Date.now() + timeout;
  let ultima = null;
  while (Date.now() < limite) {
    ultima = await lerApi(p, caminho);
    if (ultima.status >= 400) {
      throw new Error(`${oQue}: HTTP ${ultima.status} em ${caminho} — ${JSON.stringify(ultima.corpo).slice(0, 300)}`);
    }
    if (condicao(ultima.corpo)) return ultima.corpo;
    await p.waitForTimeout(500);
  }
  throw new Error(
    `${oQue}: a api não chegou ao estado esperado em ${timeout / 1000}s (última leitura: ${JSON.stringify(ultima?.corpo).slice(0, 300)})`,
  );
}

/**
 * PORTÃO DE HIDRATAÇÃO: em dev o HTML do SSR chega antes do bundle, e um
 * clique nesse intervalo é aceito pelo Playwright e não chama handler nenhum.
 * A pergunta que testemunha é a chave `__react*` que o React pendura no nó ao
 * ligar os handlers — o `disabled` sozinho não serve, o SSR já nasce sem ele.
 */
async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

async function idDaTurma(p, nome) {
  const { status, corpo } = await lerApi(p, "/turmas/minhas");
  return status === 200 && Array.isArray(corpo) ? (corpo.find((t) => t.nome === nome)?.id ?? null) : null;
}

/** Sem `veracidade` e sem `tom` em NENHUMA mensagem — pela CHAVE, não pelo texto (a fala da Nina diz "verdadeira"). */
function semGabarito(mensagens) {
  return Array.isArray(mensagens) && mensagens.every((m) => !("veracidade" in m) && !("tom" in m));
}

await suite(
  {
    slug: "estudante/10-quem-mandou-isso",
    papel: "estudante",
    titulo: "Quem mandou isso? — o grupo da turma e o Mural",
    subtitulo: "exatamente 3, o latch, os três botões da professora e as perguntas da Nina",
    contexto:
      "A Nina pede ajuda: rolou uma confusão sobre o passeio ao museu. No grupo da turma chegam " +
      "oito mensagens — verdadeiras e falsas, calmas e alarmadas —, e a criança encaminha " +
      "exatamente três ao Mural da Turma e vota no motivo. Quando a professora libera a " +
      "revelação, cada mensagem ganha dois selos; depois vêm a síntese, a regra Se/Então fora " +
      "do aplicativo e duas perguntas rápidas da Nina.",
    prova: [
      "Sem o pacote aprovado pela professora a missão não abre; aprovado, a Nina chega sozinha",
      "Antes da revelação a sessão do estudante não carrega veracidade nem tom de mensagem nenhuma",
      "A quarta seta avisa o limite e não abre a folha; o servidor recusa 4 e recusa 2",
      "Confirmado, o Mural não muda mais — nem pela tela, nem por chamada direta",
      "Revelação, síntese e reflexão chegam à tela do estudante por polling, sem recarregar",
      "Os crachás são os do gabarito do servidor, só das 3 escolhidas, e um F5 os devolve",
      "O Termômetro da Turma não tem nome, no painel nem no telão",
      "O Se/Então pede 15 caracteres depois do trim, e o servidor recusa o curto e o sem sentido",
      "As perguntas da Nina respondem só “Resposta enviada” — nenhum acerto chega à criança",
      "O bloco Habilidades da BNCC mostra EF05CO08, EF05CO03 e EF05CO04 com o nível que a régua dá",
    ],
    comando: "node scripts/e2e/estudante/10-quem-mandou-isso.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { turma: TURMA, serie: SERIE });
    /* A professora que LECIONA na turma e está na mesma escola do estudante. A
       de "2 unidades" fica de fora: com duas lotações a escola ativa pode ser a
       outra, e a turma não viria em `/turmas/minhas`. */
    const professora =
      contasDe("professor").find(
        (c) => c.escola === estudante.escola && c.turma.split(" + ").includes(TURMA),
      ) ?? conta("professor", { turma: TURMA });
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSORA: o que a turma já tem ══════════════════════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login, senhaDe(professora));

    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professora.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurma = `/quem-mandou-isso/turmas/${turmaId}`;

    const pacoteAntes = await lerApi(prof, `${daTurma}/pacote`);
    if (pacoteAntes.status !== 200) {
      throw new Error(
        `a api não abriu o pacote da ${TURMA} (HTTP ${pacoteAntes.status}): ${JSON.stringify(pacoteAntes.corpo).slice(0, 200)}`,
      );
    }
    /* Tela com DOIS estados legítimos no começo: a turma sem pacote (a missão
       nasce vazia, e a suíte prova a espera) ou com o pacote de uma corrida
       anterior (a espera não se prova, e a suíte diz isso). */
    const nasceVazia = pacoteAntes.corpo.ativo === null;
    const padrao = pacoteAntes.corpo.padrao;

    /* A régua do pacote curado, lida pela rota do PROFESSOR (a única que tem o
       gabarito): 2 por quadrante, e imagem e link com uma verdadeira e uma
       falsa cada — senão o formato vira a pista ("link é mentira"). */
    const quadrantes = new Map();
    for (const m of padrao.mensagens) {
      const chave = `${m.veracidade}/${m.tom}`;
      quadrantes.set(chave, (quadrantes.get(chave) ?? 0) + 1);
    }
    r.exigir(
      padrao.mensagens.length === 8 && quadrantes.size === 4 && [...quadrantes.values()].every((n) => n === 2),
      `o pacote curado tem 8 mensagens, 2 em cada quadrante (${[...quadrantes].map(([q, n]) => `${q}:${n}`).join(" ")})`,
    );
    for (const tipo of ["imagem", "link"]) {
      const verdades = padrao.mensagens.filter((m) => m.tipo === tipo).map((m) => m.veracidade).sort();
      r.exigir(
        verdades.join(",") === "falsa,verdadeira",
        `no pacote curado, ${tipo} tem uma verdadeira e uma falsa (${verdades.join(", ")}) — o formato não prediz a veracidade`,
      );
    }

    // ═══ ESTUDANTE (só na turma sem pacote): a missão nasce vazia ═══════════
    let p = null;
    let q = null;
    const abrirAMissao = async () => {
      p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
      await r.entrar(p, estudante.login, senhaDe(estudante));
      await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
      q = p.frameLocator('iframe[title="experiencia"]');
      await esperarOuFalharPorHttp(
        p,
        q.locator(".wa-chatlistitem, .lista__vazia, .aviso-de-rede"),
        /quem-mandou-isso\/sessao/,
        { timeout: 40_000, oQue: "o boot da missão" },
      );
      if (await q.locator(".aviso-de-rede").count()) {
        throw new Error(
          `a missão não abriu para ${estudante.login}: "${(await q.locator(".aviso-de-rede").innerText()).trim()}" — ` +
            `a ${TURMA} precisa da liberação na sala (o seed a grava) e a exp05ef1b ligada no painel da Unooria`,
        );
      }
    };

    if (nasceVazia) {
      await abrirAMissao();
      await q.locator(".lista__vazia").waitFor({ timeout: 20_000 });
      const vazia = await lerApi(p, "/quem-mandou-isso/sessao");
      r.exigir(
        vazia.corpo?.preparada === false && vazia.corpo?.pacote === null,
        `sem pacote aprovado a sessão diz preparada=false e não tem grupo (preparada=${vazia.corpo?.preparada})`,
      );
      await r.registrar(p, "grupo-em-preparo", {
        titulo: "A missão nasce vazia",
        mostra: "A lista de conversas sem a Nina, com a linha de espera: o grupo da turma ainda está sendo organizado.",
        prova:
          "O tema do pacote entra na fala da Nina, então sem a aprovação da professora não há conversa " +
          "nenhuma — e a tela não culpa ninguém nem denuncia o exercício: diz que falta pouco.",
      });
    } else {
      r.ressalva(
        `a ${TURMA} já tinha pacote aprovado (corrida anterior): a espera do preparo só se prova numa turma sem pacote`,
      );
    }

    // ═══ PROFESSORA: a ficha e o preparo ══════════════════════════════════
    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: "Quem Mandou Isso?", exact: true }).waitFor({ timeout: 30_000 });
    await prof.getByText(/A missão só abre depois que você aprova o pacote/).first().waitFor({ timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 5º ano",
      mostra:
        "As seis etapas da missão, o preparo e o aviso que muda a condução: sem o pacote aprovado " +
        "a missão não abre, e os três botões da aula são dela.",
      prova:
        "A professora precisa saber ANTES que esta missão nasce vazia. Descobrir isso com trinta " +
        "crianças diante de uma tela de espera é o chamado de suporte que a faixa existe para evitar.",
    });

    /* O `LinkButton` é um `<a>` com `role="button"` (o `Button` do DS polimórfico):
       pelo elemento, e não pelo papel, que aqui diz "botão" para um link. */
    const abrirAAula = prof.locator("a", { hasText: "Abrir a aula e os resultados" });
    await hidratado(prof, abrirAAula);
    await abrirAAula.click();
    await prof.waitForURL(/\/resultados\?turmaId=/, { timeout: 30_000 });
    await prof.locator("[data-preparo]").waitFor({ timeout: 30_000 });

    if (!nasceVazia) {
      /* Com pacote ativo o recorte fica fechado: o preparo de um pacote novo é
         um gesto próprio, e aprovar o MESMO pacote é idempotente (a mesma
         atividade, e nada volta ao começo). */
      const preparar = prof.locator('[data-acao="preparar-novo"]');
      await hidratado(prof, preparar);
      await preparar.click();
    }

    /* O componente curricular é um `Selection` do DS (combobox + listbox). O
       portão é o próprio listbox: sem hidratação o clique não abre nada. */
    const disciplina = prof.getByRole("combobox", { name: /^Componente curricular/ });
    await hidratado(prof, disciplina);
    await disciplina.click();
    const primeiraDisciplina = prof.getByRole("listbox").getByRole("option").first();
    await primeiraDisciplina.waitFor({ timeout: 10_000 }).catch(() => {
      throw new Error("o seletor de componente curricular não abriu: a página ainda não estava hidratada");
    });
    const rotuloDaDisciplina = (await primeiraDisciplina.locator(".unooria-selection-option__label").innerText()).trim();
    await primeiraDisciplina.click();

    const usarPadrao = prof.locator('[data-acao="usar-padrao"]');
    await usarPadrao.click();
    await esperarOuFalharCedo(prof.locator("[data-curadoria]"), prof.locator(ALERTA_DE_ERRO), {
      timeout: 20_000,
      oQue: "carregar o pacote curado na curadoria",
    });
    const cartoes = await prof.locator("[data-curadoria] [data-mensagem]").count();
    const porQuadrante = await prof
      .locator("[data-curadoria] [data-quadrante]")
      .evaluateAll((qs) => qs.map((el) => el.querySelectorAll("[data-mensagem]").length));
    r.exigir(cartoes === 8, `a curadoria mostra as 8 mensagens do pacote (${cartoes})`);
    r.exigir(
      porQuadrante.length === 4 && porQuadrante.every((n) => n === 2),
      `nos 4 quadrantes, 2 em cada (${porQuadrante.join(", ")}) — os selos são só da tela dela`,
    );
    await prof.locator("[data-curadoria]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "curadoria-do-pacote", {
      titulo: "A curadoria do pacote, na matriz 2x2",
      mostra: `O pacote curado “${padrao.nome}” nos quatro quadrantes — verdadeira ou falsa, emocional ou neutra —, com o texto editável e o componente curricular ${rotuloDaDisciplina}.`,
      prova:
        "Os selos de gabarito são só da professora: o gabarito e o formato de cada posição não têm " +
        "campo, porque sustentam a matriz equilibrada, e a api recusaria a troca.",
    });

    await prof.locator('[data-acao="aprovar-pacote"]').click();
    if (!nasceVazia) {
      /* Com pacote ativo, aprovar pede confirmação: um pacote DIFERENTE abriria
         atividade nova. O nome do diálogo vem do `ModalTitle` (DS 0.2.3+). */
      const confirmacao = prof.getByRole("dialog", { name: "Aprovar um pacote novo para a turma?" });
      await confirmacao.waitFor({ timeout: 10_000 });
      await confirmacao.getByRole("button", { name: "Aprovar Pacote", exact: true }).click();
    }
    await esperarOuFalharCedo(
      prof.getByText("Pacote aprovado para a turma.", { exact: true }),
      prof.locator(ALERTA_DE_ERRO),
      { timeout: 30_000, oQue: "aprovar o pacote da turma" },
    );
    const pacoteDepois = await esperarNaApi(prof, `${daTurma}/pacote`, (c) => c?.ativo !== null, {
      oQue: "o pacote aprovado",
    });
    const ativo = pacoteDepois.ativo;
    if (!nasceVazia) {
      r.exigir(
        ativo.id === pacoteAntes.corpo.ativo.id,
        "reaprovar o MESMO pacote é idempotente: a atividade continua a mesma (a evidência é por pacote)",
      );
    }
    const gabarito = new Map(ativo.mensagens.map((m) => [m.id, m]));

    // ─── estado de ONTEM não reprova hoje: zerar abre a rodada seguinte ────
    let painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.atividade !== null, { oQue: "o painel" });
    const linhaDele = (c) => (c?.linhas ?? []).find((l) => l.nome === estudante.nome) ?? null;
    const turmaAndou = painel.fase !== "triagem" || (linhaDele(painel)?.passo ?? "abertura") !== "abertura";
    if (turmaAndou) {
      const rodada = painel.atividade.rodada;
      const zerar = prof.locator("[data-zerar-turma]").getByRole("button", { name: "Zerar Turma para Nova Aplicação" });
      await hidratado(prof, zerar);
      await zerar.click();
      const janela = prof.getByRole("dialog", { name: `Zerar ${painel.turma.nome} para nova aplicação?` });
      await janela.waitFor({ timeout: 10_000 });
      /* A confirmação é DELIBERADA: o botão só acende com a caixa marcada. O
         clique vai no rótulo — o `<input>` do DS é o alvo escondido. */
      await janela.getByText("Entendi: a turma recomeça do começo numa rodada nova.").click();
      const confirmar = janela.getByRole("button", { name: "Zerar Turma para Nova Aplicação" });
      await prof.waitForFunction((el) => !el.disabled, await confirmar.elementHandle(), { timeout: 10_000 });
      await confirmar.click();
      await esperarOuFalharCedo(
        prof.getByText(new RegExp(`a ${rodada + 1}ª rodada fica no histórico`)),
        prof.locator(ALERTA_DE_ERRO),
        { timeout: 30_000, oQue: "zerar a turma" },
      );
      painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.atividade?.rodada === rodada + 1, {
        oQue: "a rodada nova",
      });
      r.exigir(
        painel.atividade.pacoteId === ativo.id && painel.fase === "triagem",
        `zerar abre a ${rodada + 1}ª rodada do MESMO pacote e volta a aula à triagem (fase=${painel.fase})`,
      );
      await prof.locator("[data-zerar-turma]").scrollIntoViewIfNeeded();
      await r.registrar(prof, "turma-zerada", {
        titulo: "Zerar abre uma rodada nova, e nada é apagado",
        mostra: `A ${painel.turma.nome} na ${rodada + 1}ª rodada, com o mesmo pacote; a ${rodada}ª fica no histórico.`,
        prova:
          "É a reaplicação da evidência (E14): a rodada anterior não some — o painel de habilidades " +
          "fica com a melhor de cada habilidade. E a confirmação é deliberada: um toque perdido no " +
          "botão não move a sala inteira para o começo.",
      });
    } else {
      r.ressalva("a turma estava no começo da rodada: zerar não foi preciso nesta corrida");
    }
    const atividade = painel.atividade;

    await prof.locator("[data-painel-da-aula]").scrollIntoViewIfNeeded();
    /* Depois de "Zerar" o painel se relê: contar na hora pegava a lista a meio
       caminho e reprovava com os três botões na tela (2026-09-26). Espera o
       terceiro existir — o desfecho, não o relógio — e só então conta. */
    await prof
      .locator("[data-painel-da-aula] li[data-gate]")
      .nth(2)
      .waitFor({ timeout: 30_000 })
      .catch(() => {});
    r.exigir(
      (await prof.locator("[data-painel-da-aula] li[data-gate]").count()) === 3,
      "o painel da aula tem os três botões, na ordem: revelação, síntese, reflexão",
    );
    await r.registrar(prof, "painel-da-aula", {
      titulo: "A aula, antes de a turma entrar",
      mostra: "O progresso da turma e os três botões — Liberar Revelação, Apresentar Síntese e Liberar Reflexão —, cada um com o que faz.",
      prova:
        "Os três só andam para a frente, e cada um pede confirmação: são cliques na frente de trinta " +
        "crianças, e desfazer uma revelação não existe.",
    });

    // ═══ ESTUDANTE: a Nina e o convite ═════════════════════════════════════
    if (nasceVazia) {
      /* O MESMO frame, sem recarregar: quem tira a criança da espera é o
         polling do gate (`preparada` mudou). */
      await esperarOuFalharPorHttp(p, q.locator(".wa-chatlistitem"), /quem-mandou-isso\/(gate|sessao)/, {
        timeout: 30_000,
        oQue: "a Nina chegar depois da aprovação",
      }).catch((erro) => {
        if (/Timeout/i.test(String(erro))) {
          throw new Error(
            "a aprovação não chegou à tela do estudante em 30 s sem recarregar: o polling do gate não viu `preparada` mudar",
          );
        }
        throw erro;
      });
    } else {
      await abrirAMissao();
    }

    const sessaoInicial = await lerApi(p, "/quem-mandou-isso/sessao");
    const s0 = sessaoInicial.corpo;
    r.exigir(
      sessaoInicial.status === 200 && s0?.passo === "abertura" && s0?.preparada === true,
      `a sessão do estudante começa na abertura, com o pacote aprovado (passo=${s0?.passo})`,
    );
    r.exigir(
      s0?.atividade?.pacoteId === atividade.pacoteId && s0?.atividade?.rodada === atividade.rodada,
      `e na MESMA atividade que o painel mostra (pacote e ${atividade.rodada}ª rodada)`,
    );
    r.exigir(
      semGabarito(s0?.pacote?.mensagens) && s0?.pacote?.mensagens?.length === 8,
      "as 8 mensagens que descem ao estudante não têm veracidade nem tom — o gabarito fica no servidor",
    );
    r.exigir(s0?.revelacao === null, "e a revelação é nula: não há o que esconder no bundle porque não há o que baixar");
    r.exigir(
      (s0?.textos?.nina?.convite ?? "").includes(`Rolou uma confusão sobre ${ativo.tema}`),
      `a fala da Nina leva o tema do pacote aprovado ("${ativo.tema}")`,
    );

    await q.locator(".wa-chatlistitem .wa-listitem__main").click();
    const entrarNoGrupo = q.getByRole("button", { name: "Entrar no grupo", exact: true });
    await entrarNoGrupo.waitFor({ timeout: 15_000 });
    await r.registrar(p, "convite-da-nina", {
      titulo: "O pedido da Nina",
      mostra: "A conversa com a Nina: rolou uma confusão sobre o passeio ao museu, e o convite para o grupo Turma 5ºB.",
      prova:
        "Em nenhum lugar se diz que a aula é sobre mentira na internet — é esse silêncio que faz a " +
        "missão medir o comportamento espontâneo, e não o que a criança acha que a professora espera.",
    });

    await entrarNoGrupo.click();
    await esperarOuFalharPorHttp(p, q.locator(".linha-do-grupo").first(), /quem-mandou-isso\/entrar/, {
      timeout: 30_000,
      oQue: "entrar no grupo da turma",
    });
    const linhas = q.locator(".linha-do-grupo");
    r.exigir((await linhas.count()) === 8, `o grupo abre com as 8 mensagens do pacote (${await linhas.count()})`);
    r.exigir(
      (await q.getByText("Apenas administradores podem enviar mensagens").count()) >= 1,
      "no lugar do teclado, a tarja de só-administradores: não há digitação livre dentro do mensageiro",
    );
    await r.registrar(p, "grupo-da-turma", {
      titulo: "Turma 5ºB, oito mensagens",
      mostra:
        "Textos, o comunicado desenhado e as prévias de link, cada um com a seta de encaminhar; no " +
        "topo, a faixa “Encaminhe 3 mensagens para o Mural da Turma” com 0/3.",
      prova:
        "Nenhuma mensagem chega marcada, e o formato não é pista: imagem e link têm uma verdadeira e " +
        "uma falsa cada. A única ação é a seta.",
    });

    // ═══ EXATAMENTE 3 ══════════════════════════════════════════════════════
    /* A faixa é tocável como a mensagem fixada do app real: com menos de 3 a
       recusa FALA (`e2.erro.toast_menor_3`). */
    await q.locator(".faixa-tocavel").click();
    await q.locator(".wa-toast", { hasText: "exatamente 3 mensagens" }).waitFor({ timeout: 5_000 }).catch(() => {
      throw new Error("tocar a faixa com 0/3 não disse o que faltava: alvo mudo ensina a desconfiar da tela");
    });

    const folha = q.getByRole("dialog", { name: "Encaminhar para..." });
    for (let i = 0; i < 3; i += 1) {
      await linhas.nth(i).locator(".wa-forwardbutton").click();
      await folha.waitFor({ timeout: 10_000 });
      if (i === 0) {
        await r.registrar(p, "folha-de-encaminhar", {
          titulo: "Encaminhar para…",
          mostra: "A folha inferior com UM destino, já marcado: o Mural da Turma, conversa com a professora.",
          prova:
            "Um destino só. A decisão que a missão mede é O QUE encaminhar, não para onde — e a folha é " +
            "o gesto do aplicativo real, não uma escolha a mais.",
        });
      }
      await folha.getByRole("button", { name: "Enviar", exact: true }).click();
      await linhas.nth(i).locator('.wa-forwardbutton[aria-pressed="true"]').waitFor({ timeout: 10_000 });
    }
    r.exigir(
      (await q.locator(".faixa-tocavel").innerText()).includes("3/3"),
      "a faixa do topo conta 3/3",
    );

    /* A QUARTA seta: esmaecida e com `aria-disabled` — e ainda assim ela FALA
       (o `ForwardButton` do DS só esmaece por `:disabled`, que engole o toque;
       a experiência compensa com `aria-disabled`). O Playwright recusa clicar
       em `aria-disabled`, e é por isso que o clique é forçado: o que se prova
       é o que a criança vê quando toca. */
    const quarta = linhas.nth(3).locator(".wa-forwardbutton");
    r.exigir(
      (await quarta.getAttribute("aria-disabled")) === "true",
      "com 3 escolhidas, as outras setas ficam esgotadas (aria-disabled, que o leitor de tela anuncia)",
    );
    await quarta.click({ force: true });
    await q.locator(".wa-toast", { hasText: "Limite de 3 mensagens atingido" }).waitFor({ timeout: 5_000 }).catch(() => {
      throw new Error("a quarta seta não avisou o limite: a recusa ficou muda");
    });
    r.exigir((await folha.count()) === 0, "e a folha de encaminhar não abre para a quarta");
    r.exigir(
      (await q.locator('.linha-do-grupo .wa-forwardbutton[aria-pressed="true"]').count()) === 3,
      "a seleção continua com 3",
    );
    await r.registrar(p, "trava-de-3", {
      titulo: "A quarta mensagem não entra",
      mostra: "As setas que sobraram esmaecidas e o aviso “Limite de 3 mensagens atingido. Desmarque uma mensagem para escolher outra.”",
      prova:
        "Exatamente 3 é parte do instrumento: a régua da EF05CO08 lê três mensagens. A recusa fala e " +
        "diz o que fazer — desmarcar é o caminho, e ele continua aberto até o Mural.",
    });

    /* E o servidor cobra de novo: botão esgotado não é regra, é enfeite sobre
       uma regra. As chamadas vão pelo APIRequestContext — não passam pelo
       console da página, então não pintam a suíte de vermelho e não precisam
       de `provocado` (que esconderia um 4xx de verdade das mesmas rotas). */
    const selecaoServidor = await esperarNaApi(
      p,
      "/quem-mandou-isso/sessao",
      (c) => (c?.selecao ?? []).length === 3,
      { oQue: "a seleção guardada no servidor" },
    );
    const escolhidas = selecaoServidor.selecao;
    const idsDoPacote = s0.pacote.mensagens.map((m) => m.id);
    const umaAMais = idsDoPacote.find((id) => !escolhidas.includes(id));
    const quatro = await mandarApi(p, "PUT", "/quem-mandou-isso/selecao", { selecao: [...escolhidas, umaAMais] });
    r.exigir(
      quatro.status === 400 && quatro.corpo?.codigo === "selecao-acima-do-limite",
      `o servidor recusa 4 mensagens (${quatro.status} ${quatro.corpo?.codigo ?? ""})`,
    );
    const duas = await mandarApi(p, "POST", "/quem-mandou-isso/mural", { selecao: escolhidas.slice(0, 2) });
    r.exigir(
      duas.status === 400 && duas.corpo?.codigo === "selecao-incompleta",
      `e recusa fechar o Mural com 2 (${duas.status} ${duas.corpo?.codigo ?? ""})`,
    );

    // ═══ O MURAL, E O LATCH ════════════════════════════════════════════════
    await q.getByRole("button", { name: "Ir para o Mural da Turma", exact: true }).click();
    const confirmarEnvio = q.getByRole("button", { name: "Confirmar envio", exact: true });
    await confirmarEnvio.waitFor({ timeout: 15_000 });
    r.exigir((await q.locator(".linha-do-mural").count()) === 3, "o Mural mostra as 3 escolhidas");
    r.exigir(
      (await q.locator(".linha-do-mural .wa-messagebubble__forwarded").count()) === 3,
      "cada uma com o selo Encaminhada, como no aplicativo real",
    );
    r.exigir(
      (await q.locator(".linha-do-mural .wa-messagebubble__sender").count()) === 0,
      "e sem o remetente: a autoria se perde no primeiro repasse — é o título da missão",
    );
    await r.registrar(p, "mural-antes-de-confirmar", {
      titulo: "O último instante em que dá para voltar atrás",
      mostra: "As três mensagens no Mural da Turma, sem quem as mandou, e os botões Revisar seleção no grupo e Confirmar envio.",
      prova:
        "A seleção é revisável ATÉ aqui: quem repassou no impulso e voltou atrás fez o que a missão " +
        "ensina. Depois do próximo toque, não — e é esse toque que a EF05CO08 mede.",
    });

    await confirmarEnvio.click();
    await esperarOuFalharPorHttp(p, q.locator(".wa-poll"), /quem-mandou-isso\/mural/, {
      timeout: 30_000,
      oQue: "confirmar o envio ao Mural",
    });
    r.exigir(
      (await q.getByRole("button", { name: "Revisar seleção no grupo" }).count()) === 0,
      "confirmado, o botão de revisar some: o Mural fechou",
    );
    const outraSelecao = [...escolhidas.slice(0, 2), umaAMais];
    const mudar = await mandarApi(p, "POST", "/quem-mandou-isso/mural", { selecao: outraSelecao });
    r.exigir(
      mudar.status === 409 && mudar.corpo?.codigo === "mural-ja-enviado",
      `nem por chamada direta: outra seleção depois do latch é 409 (${mudar.status} ${mudar.corpo?.codigo ?? ""})`,
    );
    const rascunho = await mandarApi(p, "PUT", "/quem-mandou-isso/selecao", { selecao: [] });
    r.exigir(
      rascunho.status === 409 && rascunho.corpo?.codigo === "mural-ja-enviado",
      `e o rascunho também não muda mais (${rascunho.status} ${rascunho.corpo?.codigo ?? ""})`,
    );
    const confirmada = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      confirmada.corpo?.passo === "enquete" && confirmada.corpo?.confirmado === true,
      `o servidor põe o estudante na enquete (passo=${confirmada.corpo?.passo})`,
    );
    r.exigir(confirmada.corpo?.revelacao === null, "e confirmar não revela nada: o gabarito continua do outro lado");

    // ═══ A ENQUETE E A ESPERA ═════════════════════════════════════════════
    const opcoesDaEnquete = q.locator(".wa-poll .wa-poll__option");
    r.exigir(
      (await opcoesDaEnquete.count()) === (s0.opcoes?.motivos?.length ?? -1) && (await opcoesDaEnquete.count()) === 4,
      `a enquete “O que mais te fez escolher essas mensagens?” tem as 4 opções (${await opcoesDaEnquete.count()})`,
    );
    /* O clique vai no rótulo (o `<input>` do Radio do DS é visualmente
       escondido). O botão Votar só acende com uma escolha — é o portão de que
       o `onChange` chegou ao React. */
    await opcoesDaEnquete.first().click();
    const votar = q.locator(".wa-poll__vote:not([disabled])");
    await votar.waitFor({ timeout: 10_000 }).catch(() => {
      throw new Error("escolher uma opção da enquete não acendeu o Votar: o toque não moveu o estado da tela");
    });
    const motivoEscolhido = await q.locator(".wa-poll input[type=radio]:checked").getAttribute("value");
    await r.registrar(p, "enquete-do-motivo", {
      titulo: "O que mais te fez escolher essas mensagens?",
      mostra: "A enquete do WhatsApp no Mural, com as quatro opções e o histórico esmaecido atrás.",
      prova:
        "O motivo é declarado ANTES da revelação — depois dela a resposta seria a que a criança acha " +
        "certa. É o dado que o Termômetro cruza com o que a turma encaminhou.",
    });
    await votar.click();
    await esperarOuFalharPorHttp(p, q.getByText("Mensagens entregues no Mural da Turma"), /quem-mandou-isso\/enquete/, {
      timeout: 30_000,
      oQue: "votar na enquete",
    });
    const esperando = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      esperando.corpo?.passo === "espera" && esperando.corpo?.motivo === motivoEscolhido,
      `votou: o servidor põe o estudante na espera, com o motivo gravado (passo=${esperando.corpo?.passo})`,
    );
    r.exigir(
      esperando.corpo?.revelacao === null && semGabarito(esperando.corpo?.pacote?.mensagens),
      "e o gabarito ainda não desceu: o voto sozinho não revela — falta o botão da professora",
    );
    await r.registrar(p, "espera", {
      titulo: "Mensagens entregues, e a turma ainda chegando",
      mostra: "A mensagem de sistema: você terminou esta etapa, aguarde a orientação do professor para a revelação.",
      prova: "A revelação é da turma, não de cada um: é a espera que faz as trinta telas chegarem juntas ao botão dela.",
    });

    // ═══ PROFESSORA: antes da revelação, só progresso ═════════════════════
    painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => (c?.progresso?.votaram ?? 0) >= 1, {
      oQue: "o voto chegar ao painel",
    });
    r.exigir(painel.termometro === null, "antes da revelação o painel não tem Termômetro: só o progresso");
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.locator("[data-painel-da-aula]").waitFor({ timeout: 30_000 });
    r.exigir(
      (await prof.locator("[data-termometro]").count()) === 0,
      "e a tela diz que ele aparece quando ela liberar a revelação",
    );

    /**
     * Um botão da aula: o portão de hidratação, a confirmação (o nome do
     * diálogo é o título) e o DESFECHO — a fase da turma no atributo da seção,
     * correndo contra o alerta de erro da janela.
     */
    const apertarBotaoDaAula = async (acao, rotulo, tituloDaJanela, fase) => {
      const botao = prof.locator(`[data-painel-da-aula] li[data-gate="${acao}"]`).getByRole("button", { name: rotulo });
      await hidratado(prof, botao);
      await botao.click();
      const janela = prof.getByRole("dialog", { name: tituloDaJanela });
      await janela.waitFor({ timeout: 10_000 });
      await janela.getByRole("button", { name: rotulo, exact: true }).click();
      await esperarOuFalharCedo(prof.locator(`[data-painel-da-aula][data-fase="${fase}"]`), prof.locator(ALERTA_DE_ERRO), {
        timeout: 30_000,
        oQue: rotulo,
      });
    };

    /** O efeito do botão chega à tela do estudante sozinho — e corre contra o gate falhar. */
    const chegaSemRecarregar = async (alvo, oQue) => {
      await esperarOuFalharPorHttp(p, alvo, /quem-mandou-isso\/(gate|sessao)/, { timeout: 30_000, oQue }).catch((erro) => {
        if (/Timeout/i.test(String(erro))) {
          throw new Error(
            `${oQue}: não chegou à tela do estudante em 30 s sem recarregar — o polling do gate (3 s) não ` +
              "trocou a tela, e numa aula real a turma inteira esperaria um F5 que ninguém pediu",
          );
        }
        throw erro;
      });
    };

    // ═══ 1º BOTÃO: a revelação ════════════════════════════════════════════
    await apertarBotaoDaAula("liberar_revelacao", "Liberar Revelação", "Liberar a revelação para a turma?", "revelacao");
    await chegaSemRecarregar(q.locator(".crachas").first(), "a revelação");

    const revelada = await lerApi(p, "/quem-mandou-isso/sessao");
    const revelacao = revelada.corpo?.revelacao ?? null;
    const idsRevelados = (revelacao?.mensagens ?? []).map((m) => m.id).sort();
    r.exigir(
      revelacao !== null && idsRevelados.join(",") === [...escolhidas].sort().join(","),
      `agora o gabarito cruza a fronteira — e só o das 3 escolhidas (${idsRevelados.join(", ")})`,
    );
    r.exigir(
      (revelacao?.mensagens ?? []).every(
        (m) => gabarito.get(m.id)?.veracidade === m.veracidade && gabarito.get(m.id)?.tom === m.tom,
      ),
      "e os dois eixos de cada uma são os do pacote aprovado (conferidos pela rota da professora)",
    );
    r.exigir(
      semGabarito(revelada.corpo?.pacote?.mensagens),
      "as 8 mensagens do grupo continuam sem gabarito: as 5 que ficaram de fora nunca descem",
    );
    /* O Mural está na ordem do GRUPO: a linha i é a i-ésima escolhida nessa ordem. */
    const naOrdemDoGrupo = idsDoPacote.filter((id) => escolhidas.includes(id));
    const crachasNaTela = await q
      .locator(".linha-do-mural")
      .evaluateAll((ls) => ls.map((l) => [...l.querySelectorAll(".wa-messagetag__label")].map((t) => t.textContent.trim())));
    const crachasEsperados = naOrdemDoGrupo.map((id) => {
      const m = gabarito.get(id);
      return [ROTULO_DA_VERACIDADE[m.veracidade], ROTULO_DO_TOM[m.tom]];
    });
    r.exigir(
      JSON.stringify(crachasNaTela) === JSON.stringify(crachasEsperados),
      `cada mensagem do Mural ganha os DOIS crachás certos (${crachasNaTela.map((c) => c.join("+")).join(" · ")})`,
    );
    r.exigir(
      (await q.getByText(/^Seu motivo declarado:/).count()) === 1,
      "e o motivo que ela votou volta, com o lembrete do bimestre",
    );
    await r.registrar(p, "revelacao", {
      titulo: "Os dois selos, sem ninguém recarregar",
      mostra:
        "As três mensagens do Mural com os crachás — verdadeira ou falsa, emocional ou neutra —, o " +
        "motivo declarado, o lembrete do bimestre e as duas barras da turma, como imagem no chat.",
      prova:
        "Um eixo não prediz o outro: a séria pode ser falsa, a alarmada pode ser verdadeira. Os " +
        "crachás se distinguem por pictograma e palavra, não por cor. E chegaram pelo polling de 3 s.",
    });

    /* O F5 no meio da aula: o passo é do servidor, e a tela volta onde estava. */
    await p.reload({ waitUntil: "domcontentloaded" });
    q = p.frameLocator('iframe[title="experiencia"]');
    await esperarOuFalharPorHttp(p, q.locator(".crachas").first(), /quem-mandou-isso\/sessao/, {
      timeout: 40_000,
      oQue: "a revelação depois do F5",
    });
    r.exigir((await q.locator(".crachas").count()) === 3, "o F5 devolve a revelação com os 3 pares de crachás");

    // ─── o Termômetro, na tela dela e no telão ─────────────────────────────
    painel = await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.termometro !== null, { oQue: "o Termômetro" });
    const nomes = new Set(
      (painel.linhas ?? []).flatMap((l) => [l.nome, ...(l.equipe?.membros ?? []).map((m) => m.nome)]).filter(Boolean),
    );
    const termometro = prof.locator("[data-painel-da-aula] [data-termometro]").first();
    await termometro.waitFor({ timeout: 20_000 });
    const textoDoTermometro = await termometro.innerText();
    const nomeNoTermometro = [...nomes].find((n) => textoDoTermometro.includes(n));
    r.exigir(
      nomes.size > 0 && !nomeNoTermometro,
      `nenhum dos ${nomes.size} nomes da turma aparece no Termômetro (achei "${nomeNoTermometro ?? ""}")`,
    );
    r.exigir(
      painel.termometro.unidades >= 1 && (await prof.locator("[data-termometro] [data-sem-dados]").count()) === 0,
      `com ${painel.termometro.unidades} unidade(s) que confirmaram, o Termômetro tem as barras (não “sem dados”)`,
    );
    const roteiro = (await prof.locator("[data-roteiro] li").allInnerTexts()).map((t) => t.trim());
    r.exigir(
      roteiro.length === 3 && roteiro.join("|") === painel.roteiro.perguntas.map((t) => t.trim()).join("|"),
      `depois da revelação aparece o roteiro da roda de conversa, com as 3 perguntas (${roteiro.length})`,
    );
    await termometro.scrollIntoViewIfNeeded();
    await r.registrar(prof, "termometro-da-turma", {
      titulo: "O Termômetro da Turma",
      mostra:
        "Quantas unidades repassaram ao menos uma falsa de formato sério, quantas verdadeiras " +
        "exageradas ficaram de fora e o cruzamento com o motivo votado — e o roteiro da roda.",
      prova:
        "A conta é da sala e não tem lugar para nome: o que vai para a parede não expõe criança nenhuma. " +
        "Com ninguém que confirmou, a tela escreveria “sem dados”, nunca 0%.",
      detalhe: `${painel.termometro.unidades} unidade(s) na conta`,
    });

    await prof.locator('[data-acao="projetar-termometro"]').click();
    const telao = prof.getByRole("dialog", { name: "Termômetro da Turma — Como a sala compartilhou" });
    await telao.waitFor({ timeout: 10_000 });
    const textoDoTelao = await telao.innerText();
    const nomeNoTelao = [...nomes].find((n) => textoDoTelao.includes(n));
    r.exigir(!nomeNoTelao, `o telão também não tem nome nenhum (achei "${nomeNoTelao ?? ""}")`);
    await r.registrar(prof, "telao", {
      titulo: "Projetar o Termômetro",
      mostra: "A janela em tela cheia, em letra grande, só com a conta da turma.",
      prova:
        "A tela da professora tem os selos e a folha com nomes; a parede, não. Projetar é um gesto " +
        "próprio, e o que ele abre não tem para onde vazar um nome.",
    });
    await telao.getByRole("button", { name: "Fechar", exact: true }).click();
    await telao.waitFor({ state: "hidden", timeout: 10_000 });

    // ═══ 2º BOTÃO: a síntese ══════════════════════════════════════════════
    await apertarBotaoDaAula("apresentar_sintese", "Apresentar Síntese", "Apresentar a síntese?", "explicar");
    await chegaSemRecarregar(q.getByText(/Participe da conversa na sala/), "a síntese");
    await r.registrar(p, "sintese", {
      titulo: "O gatilho do compartilhamento",
      mostra:
        "A lâmina desenhada no chat — urgência, autoridade aparente, indignação e calma técnica " +
        "desarmam o filtro de checagem — e o aviso de participar da conversa na sala.",
      prova:
        "A síntese ainda é o mensageiro: ele recebe foto de gráfico. A trava da roda diz o que vem " +
        "depois sem mostrar botão nenhum — quem solta a turma é a professora.",
    });

    // ═══ 3º BOTÃO: a reflexão, fora do aplicativo ═════════════════════════
    await apertarBotaoDaAula("liberar_reflexao", "Liberar Reflexão", "Liberar a reflexão?", "reflexao");
    await chegaSemRecarregar(q.getByText("Monte sua regra de decisão antes de encaminhar:"), "a reflexão");
    r.exigir(
      (await q.locator(".escola .wa-messagebubble").count()) === 0,
      "a regra é montada na casca da escola: nada do mensageiro dentro dela (a fronteira do disfarce)",
    );
    r.exigir(
      (await q.locator(".escola").innerText()).includes("meu tio mandou um áudio na família"),
      "e o desafio é o áudio do tio no grupo da FAMÍLIA — a transferência para fora da tela",
    );

    const se = q.getByRole("combobox", { name: /Se a mensagem for/ });
    await se.click();
    const primeiraCondicao = q.getByRole("listbox").getByRole("option").first();
    await primeiraCondicao.waitFor({ timeout: 10_000 });
    const rotuloDoSe = (await primeiraCondicao.locator(".unooria-selection-option__label").innerText()).trim();
    await primeiraCondicao.click();
    const idDoSe = (s0.opcoes?.condicoes ?? []).find((c) => c.rotulo === rotuloDoSe)?.id;
    r.exigir(Boolean(idDoSe), `a condição “${rotuloDoSe}” é uma das 4 da api`);

    /* 14 caracteres e espaços no fim: o piso conta DEPOIS do trim, como o
       servidor conta — quinze espaços não são uma regra. `pressSequentially`,
       e não `fill`: o campo é controlado, e o `fill` não move o estado. */
    const campo = q.locator(".escola textarea");
    const salvar = q.getByRole("button", { name: "Salvar e Enviar Reflexão" });
    await campo.pressSequentially(ENTAO_CURTO, { delay: 15 });
    await q.getByText("Mínimo de 15 caracteres (falta 1 caractere)").waitFor({ timeout: 10_000 }).catch(() => {
      throw new Error("com 14 caracteres (e espaços no fim) o contador não disse que falta 1: o piso não conta depois do trim");
    });
    r.exigir(await salvar.isDisabled(), "com 14 caracteres depois do trim, Salvar e Enviar Reflexão fica apagado");
    await r.registrar(p, "regra-abaixo-do-piso", {
      titulo: "Se… então…: o piso de 15",
      mostra: "A condição escolhida, o Então com 14 caracteres e o contador “Mínimo de 15 caracteres (falta 1 caractere)”.",
      prova:
        "O piso é contado depois do trim, na tela e no servidor: espaço não completa regra. O botão só " +
        "acende entre 15 e 240.",
    });

    /* O servidor cobra de novo, e recusa também o texto sem sentido que passa
       do piso (RF-013) — cada recusa com o seu código. */
    const curta = await mandarApi(p, "POST", "/quem-mandou-isso/reflexao", { se: idDoSe, entao: ENTAO_CURTO });
    r.exigir(
      curta.status === 400 && curta.corpo?.codigo === "entao-curto",
      `o servidor recusa o Então de 14 (${curta.status} ${curta.corpo?.codigo ?? ""})`,
    );
    const semSentido = await mandarApi(p, "POST", "/quem-mandou-isso/reflexao", {
      se: idDoSe,
      entao: "kkkkkkkkkkkkkkkkkkkkkkkk",
    });
    r.exigir(
      semSentido.status === 400 && semSentido.corpo?.codigo === "entao-sem-sentido",
      `e recusa o texto sem sentido que passa do piso (${semSentido.status} ${semSentido.corpo?.codigo ?? ""})`,
    );

    await campo.click();
    await campo.press("ControlOrMeta+A");
    await campo.press("Backspace");
    await campo.pressSequentially(ENTAO, { delay: 10 });
    await q.locator('.escola button:not([disabled])', { hasText: "Salvar e Enviar Reflexão" }).waitFor({ timeout: 10_000 });
    await salvar.click();
    await esperarOuFalharPorHttp(p, q.getByText(s0.textos.confirmacaoDaRegra), /quem-mandou-isso\/reflexao/, {
      timeout: 30_000,
      oQue: "enviar a regra",
    });
    await r.registrar(p, "regra-enviada", {
      titulo: "A regra vai para a professora",
      mostra: `A confirmação da casca: “${s0.textos.confirmacaoDaRegra}”, com Continuar.`,
      prova:
        "A regra NÃO é corrigida: não há certo nem errado na tela, e a EF05CO04 vem só da P2. É texto " +
        "livre de menor — não vai a log nem a telemetria, e só quem leciona na turma lê.",
    });

    // ═══ AS PERGUNTAS DA NINA, de volta ao mensageiro ═════════════════════
    await q.getByRole("button", { name: "Continuar", exact: true }).click();
    const idsDasPerguntas = (s0.textos?.perguntas ?? []).map((x) => x.perguntaId);
    r.exigir(idsDasPerguntas.length === 2, `são duas perguntas da Nina (${idsDasPerguntas.join(", ")})`);

    /* A pergunta que desce: sem o nível de nenhuma alternativa, e EMBARALHADA
       no servidor a cada leitura — "a primeira é a certa" não pode virar pista.
       Oito leituras: a chance de todas saírem na mesma ordem é (1/6)^7. */
    const leituras = [];
    for (let i = 0; i < 8; i += 1) leituras.push((await lerApi(p, `/evidencias/${EXP_ID}/perguntas/${idsDasPerguntas[0]}`)).corpo);
    r.exigir(
      leituras.every((l) => (l?.alternativas ?? []).length === 3 && l.alternativas.every((a) => Object.keys(a).sort().join() === "id,texto")),
      "a pergunta desce com 3 alternativas, cada uma só com id e texto — o nível fica no servidor",
    );
    const ordens = new Set(leituras.map((l) => (l?.alternativas ?? []).map((a) => a.id).join(",")));
    r.exigir(ordens.size > 1, `as alternativas chegam embaralhadas a cada leitura (${ordens.size} ordens em 8 leituras)`);

    const alternativaDe = {};
    for (const [indice, perguntaId] of idsDasPerguntas.entries()) {
      const enquete = q.locator(".wa-poll:not(.wa-poll--voted)");
      await enquete.first().waitFor({ timeout: 20_000 });
      const opcao = enquete.first().locator(".wa-poll__option").first();
      await opcao.click();
      /* O Votar acende quando a escolha chegou ao estado da tela — só então o
         rádio marcado diz qual alternativa (pelo id, nunca pela posição). */
      const votarNaPergunta = enquete.first().locator(".wa-poll__vote:not([disabled])");
      await votarNaPergunta.waitFor({ timeout: 10_000 });
      alternativaDe[perguntaId] = await enquete.first().locator("input[type=radio]:checked").getAttribute("value");
      /* A resposta do iframe é cross-origin: quem a vê com certeza é o CONTEXTO. */
      const recibo = p
        .context()
        .waitForEvent("response", {
          predicate: (x) => x.url().includes(`/perguntas/${perguntaId}/resposta`) && x.request().method() === "POST",
          timeout: 30_000,
        });
      await votarNaPergunta.click();
      await esperarOuFalharPorHttp(p, q.locator(".wa-poll--voted").nth(indice), /evidencias\/exp05ef1b\/perguntas/, {
        timeout: 30_000,
        oQue: `responder a pergunta ${perguntaId}`,
      });
      const corpo = await (await recibo).json().catch(() => null);
      r.exigir(
        JSON.stringify(corpo) === JSON.stringify({ enviada: true }),
        `o recibo da ${perguntaId} é só { enviada: true } — a criança não sabe, pela resposta, se acertou`,
      );
    }
    r.exigir(
      (await q.locator(".wa-poll__voted", { hasText: "Resposta enviada" }).count()) === 2,
      "as duas enquetes mostram “Resposta enviada”, e nada mais",
    );
    const textoDasPerguntas = await q.locator(".conversa").innerText();
    r.exigir(
      !PALAVRAS_DE_ACERTO.test(textoDasPerguntas),
      `nenhum nível, acerto ou nota na conversa da Nina (achei "${textoDasPerguntas.match(PALAVRAS_DE_ACERTO)?.[0] ?? ""}")`,
    );
    await r.registrar(p, "perguntas-da-nina", {
      titulo: "Duas perguntas rápidas da Nina",
      mostra: "De volta ao chat da Nina: as duas enquetes respondidas, cada uma com “Resposta enviada”, e a despedida dela.",
      prova:
        "São as perguntas de evidência do PO, com a MESMA enquete do Mural. O enunciado e as " +
        "alternativas vêm da ficha pedagógica, embaralhados; o nível nunca desce, e quem o lê é a professora.",
    });

    await esperarOuFalharPorHttp(p, q.getByRole("heading", { name: "Missão Concluída" }), /quem-mandou-isso\/concluir/, {
      timeout: 30_000,
      oQue: "concluir a missão",
    });
    const regraNaTela = await q.locator(".escola__regra-texto").innerText();
    r.exigir(
      regraNaTela.startsWith(`SE a mensagem for ${rotuloDoSe}, ENTÃO eu ${ENTAO}`),
      `o card guarda a regra dela: “${regraNaTela}”`,
    );
    r.exigir(!PALAVRAS_DE_ACERTO.test(await q.locator(".escola").innerText()), "e o fechamento não tem nível, acerto nem nota");
    const concluida = await lerApi(p, "/quem-mandou-isso/sessao");
    r.exigir(
      concluida.corpo?.passo === "concluida" && concluida.corpo?.concluido === true,
      `a missão fecha no servidor (passo=${concluida.corpo?.passo})`,
    );
    await r.registrar(p, "missao-concluida", {
      titulo: "Missão Concluída",
      mostra: "A casca da escola com “Sua Regra Pessoal de Checagem”: SE a mensagem for…, ENTÃO eu…",
      prova:
        "A fronteira cruzou duas vezes, e cada travessia tem razão: a regra é sobre a família do tio " +
        "(fora da ficção), as perguntas são a Nina falando (dentro dela), e o fechamento é a escola.",
    });
    /* Sai do aparelho: o iframe continua falando com a api enquanto a página estiver nele. */
    await p.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });

    // ═══ PROFESSORA: a folha e as habilidades da BNCC ═════════════════════
    const material = await lerApi(prof, "/quem-mandou-isso/professor/material");
    const nivelDaAlternativa = (perguntaId) =>
      (material.corpo?.perguntasDeEvidencia ?? [])
        .find((x) => x.perguntaId === perguntaId)
        ?.alternativas.find((a) => a.id === alternativaDe[perguntaId])?.status ?? null;
    const habilidadeDa = (perguntaId) =>
      (material.corpo?.perguntasDeEvidencia ?? []).find((x) => x.perguntaId === perguntaId)?.habilidade ?? null;
    const esperado = {
      EF05CO08: nivelEsperadoCO08(escolhidas.map((id) => gabarito.get(id))),
      [habilidadeDa(idsDasPerguntas[0])]: nivelDaAlternativa(idsDasPerguntas[0]),
      [habilidadeDa(idsDasPerguntas[1])]: nivelDaAlternativa(idsDasPerguntas[1]),
    };
    r.exigir(
      Object.keys(esperado).sort().join(",") === "EF05CO03,EF05CO04,EF05CO08",
      `a P1 mede a EF05CO03 e a P2 a EF05CO04 (${JSON.stringify(esperado)})`,
    );

    const habilidades = await esperarNaApi(
      prof,
      `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividade.pacoteId}`,
      (c) => Object.keys(c?.estudantes?.find((e) => e.nome === estudante.nome)?.porRodada?.[String(atividade.rodada)] ?? {}).length === 3,
      { oQue: "as três marcas do estudante na evidência" },
    );
    r.exigir(habilidades.temFicha === true, "a exp05ef1b tem ficha pedagógica: o bloco de habilidades acende");
    const marcas = habilidades.estudantes.find((e) => e.nome === estudante.nome).porRodada[String(atividade.rodada)];
    for (const [codigo, nivel] of Object.entries(esperado)) {
      r.exigir(
        marcas[codigo]?.status === nivel,
        `${codigo}: o painel registra “${marcas[codigo]?.status ?? "nada"}”, e a régua dá “${nivel}”`,
      );
    }

    await prof.reload({ waitUntil: "domcontentloaded" });
    const blocoDeHabilidades = prof.locator("section", { has: prof.getByText("Habilidades da BNCC", { exact: true }) }).last();
    await blocoDeHabilidades.waitFor({ timeout: 30_000 });
    const textoDoBloco = await blocoDeHabilidades.innerText();
    r.exigir(
      ["EF05CO08", "EF05CO03", "EF05CO04"].every((c) => textoDoBloco.includes(c)),
      "o bloco Habilidades da BNCC mostra a EF05CO08, a EF05CO03 e a EF05CO04",
    );
    await blocoDeHabilidades.scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "Habilidades da BNCC, por estudante",
      mostra: `A ${atividade.rodada}ª rodada da atividade: a EF05CO08 pela seleção do Mural, a EF05CO03 pela P1 e a EF05CO04 pela P2.`,
      prova:
        "O nível é do servidor e é conferido aqui contra a régua: a EF05CO08 vem das 3 escolhidas " +
        "(falsa neutra pesa mais que falsa emocional), e a CO03/CO04, da alternativa marcada. " +
        "O Se/Então não é corrigido — a professora o lê e ajusta aqui.",
      detalhe: Object.entries(esperado)
        .map(([c, n]) => `${c}=${n}`)
        .join(" · "),
    });

    const folhaDaTurma = prof.locator("[data-folha]");
    const linhaNaFolha = folhaDaTurma.locator("tr", { hasText: estudante.nome });
    await linhaNaFolha.first().waitFor({ timeout: 20_000 });
    r.exigir(
      (await linhaNaFolha.first().innerText()).includes(ENTAO),
      "a folha mostra a regra que a criança escreveu — só para quem leciona na turma",
    );
    const cabecalhos = await folhaDaTurma.locator("thead th").allInnerTexts();
    const colunaProibida = cabecalhos.find((c) => /pontos|nota|acerto|ranking|nível/i.test(c));
    r.exigir(!colunaProibida, `a folha não tem coluna de acerto, nota nem nível (achei "${colunaProibida ?? ""}")`);
    await linhaNaFolha.first().scrollIntoViewIfNeeded();
    await r.registrar(prof, "folha-da-turma", {
      titulo: "O diário de bordo da turma",
      mostra: "Onde cada um está, as 3 mensagens encaminhadas com o quadrante, o motivo declarado e a regra Se/Então.",
      prova:
        "É a tela dela, não a do projetor: tem nome e o texto da criança. Não tem coluna de acerto — " +
        "o nível por habilidade mora no bloco da BNCC, onde ela também o ajusta.",
    });
  },
);
