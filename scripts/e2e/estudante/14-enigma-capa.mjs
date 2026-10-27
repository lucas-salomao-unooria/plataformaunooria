import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { revelar, textoDeTodasAsAbas } from "../lib/abas.mjs";
import { provarPodcastNaAula } from "../lib/podcast.mjs";
import { arrastar, comResposta, esperarNaApi, hidratado, idDaTurma, lerApi, pontoEm, primeiroQueAparecer, tocarNoMeio } from "../lib/enigma-capa.mjs";

/**
 * O ENIGMA DA CAPA DA RÁDIO (exp02ef1b, 2º ano EF, unidade 1 — ADR-184; a
 * 2.0.0 segue o protótipo do time, ADR-186), das duas pontas da sala, com a IA
 * REAL no preparo.
 *
 * A professora abre a ficha e o guia, CRIA a atividade com "Gerar com IA" e um
 * tema dela (o Vertex escreve o texto e desenha a panorâmica), marca na
 * curadoria os dois objetos iguais do fundo (a IA não devolve coordenada),
 * aprova e põe no ar. O estudante, num celular, lê a missão (ENCONTRE NAS
 * FOTOS 2 OBJETOS…), abre a bancada, tenta avançar antes do piso uma vez (o
 * aviso OLHE O FUNDO), acha os dois objetos com a lupa (ela brilha e o anel
 * enche em 3 s), escolhe uma foto, a desloca na moldura de tamanho fixo, cola o
 * selo e PUBLICA A CAPA (LATCH 1, o aviso CAPA PUBLICADA!). A visitante diz o
 * que o recorte mostrou, e o aviso AGUARDE O PROFESSOR espera. LIBERAR VIRADA
 * (geral) divide a tela: a criança erra um toque, acha os dois objetos nas
 * duas fotos (com um F5 no meio), arrasta a alça do slider de comparação do
 * centro até o fim (A CENA COMPLETA), finca dois alfinetes no que ficou fora,
 * monta o par e a segunda foto, que conclui. No fim, a folha da turma, as
 * habilidades EF02CO05 e EF02CO01 com o nível da régua e o podcast fixo.
 *
 * A suíte joga com o gabarito que o PROFESSOR vê (`GET …/pacotes/:id`): os
 * alvos que ele marcou, a foto e o selo coerentes. A sessão do estudante, ela
 * prova, não carrega nada disso.
 *
 * Os seletores são CONTRATO com a experiência (`src/lib/textos.ts`,
 * `src/telas/*`) e com o hub (`atividades/nova/criar-enigma-capa.tsx`,
 * `resultados/painel-da-aula-enigma-capa.tsx`, `resultados/cena-do-enigma.tsx`).
 */

const SERIE = "2EF";
const EXP_ID = "exp02ef1b";
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;
const FICHA = `${HUB}/professor/entre-redes/2-ano/unidade-1`;

/** O recorte que a professora pede à IA — nada dos pacotes prontos. */
const RECORTE = {
  disciplina: "Ciências",
  tema: "A horta da escola e os bichinhos do solo",
  palavras: ["minhoca", "joaninha", "formiga", "terra", "folhas"],
};

/** Onde a professora toca na imagem gerada: o layout pedido põe os dois objetos no centro da parede (faixa comum 32–68). */
const TOQUES_DA_PROFESSORA = [
  { x: 44, y: 25 },
  { x: 58, y: 25 },
];

await suite(
  {
    slug: "estudante/14-enigma-capa",
    papel: "estudante",
    titulo: "O Enigma da Capa da Rádio — a capa é um pedaço do lugar",
    subtitulo: "a cena criada com IA e marcada pela professora, a lupa que brilha, o latch da capa, a virada geral, o slider e o alfinete",
    contexto:
      "O estudante do 2º ano é repórter mirim da Rádio Escola no Unoovista: acha com a lupa dois objetos nas duas " +
      "fotos do mesmo minuto, escolhe UMA, a enquadra numa moldura de tamanho fixo, cola um selo e publica a capa. " +
      "A visitante diz só o que o recorte mostrou. Depois da conversa, a professora libera a virada para a turma " +
      "toda: a criança acha os dois objetos iguais nas duas fotos, o slider de comparação revela o lugar inteiro " +
      "e ela finca alfinetes no que ficou fora. No fim, os pares e a segunda foto, que conclui.",
    prova: [
      "A ficha e o guia em quatro tempos da missão nova",
      "A professora gera a cena com um tema dela (IA real: texto e imagem) e marca os dois objetos tocando na imagem",
      "A atividade aprovada fica pronta; “Usar esta atividade agora” a põe no ar e a missão está liberada na sala",
      "A missão em letra grande e ABRIR BANCADA; a lupa brilha e conta 3 s em cada objeto, recusa o avanço antes do piso (OLHE O FUNDO) e o libera depois",
      "A foto se desloca na moldura sem mudar de tamanho; PUBLICAR CAPA trava a escolha (CAPA PUBLICADA!) e a visitante fala do recorte",
      "A sessão do estudante não carrega o gabarito (alvos, núcleo, selo coerente, marcáveis, falas)",
      "AGUARDE O PROFESSOR (sem retrato) até a virada GERAL; o painel conta quem aguarda",
      "Um toque errado é a onda neutra; os quatro achados redesenham depois de um F5; a alça sai do centro e revela A CENA COMPLETA",
      "Os alfinetes no “fora”, o par e a segunda foto, que conclui (FOTO GUARDADA NO ÁLBUM!)",
      "O painel por estudante e as habilidades EF02CO05 e EF02CO01 com o nível da régua; o podcast fixo",
    ],
    comando: "node scripts/e2e/estudante/14-enigma-capa.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { turma: TURMA, serie: SERIE });
    const professora =
      contasDe("professor").find((c) => c.escola === estudante.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSORA: a ficha e o guia ══════════════════════════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login, senhaDe(professora));
    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professora.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurma = `/enigma-capa/turmas/${turmaId}`;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: "O Enigma da Capa da Rádio", exact: true }).waitFor({ timeout: 30_000 });
    await prof.getByText(/A missão só abre com uma atividade sua em andamento/).first().waitFor({ timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 2º ano, unidade 1",
      mostra: "O Enigma da Capa da Rádio na trilha: o aviso da virada que é um botão só, as habilidades e a lista de atividades da turma.",
      prova: "A ficha é da missão nova (ramo próprio no despachante), e diz antes da aula que é a professora quem libera a virada.",
    });

    await prof.goto(`${FICHA}/guia?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator('[role="tab"][id^="tab-guia-"]').first().waitFor({ timeout: 30_000 });
    const tempos = await prof.locator('[role="tab"][id^="tab-guia-"]').count();
    const textoDoGuia = await textoDeTodasAsAbas(prof, "guia");
    r.exigir(tempos === 4, `o guia tem os quatro tempos (${tempos} abas)`);
    r.exigir(
      textoDoGuia.includes("Você pode mover a foto, mas não mudar o tamanho.") &&
        /ENQUADRAMENTO/.test(textoDoGuia) &&
        /O QUE FICOU DE FORA/.test(textoDoGuia),
      "o guia traz a frase do arraste e os cartões ENQUADRAMENTO / AUTORIA / O QUE FICOU DE FORA",
    );
    await r.registrar(prof, "guia-da-aula", {
      titulo: "O guia da aula em quatro tempos",
      mostra: "Preparar, Conduzir, Fechar e Consultar: a introdução oral, a frase do arraste, a pausa e os três cartões.",
      prova: "A nomeação (ENQUADRAMENTO, AUTORIA, O QUE FICOU DE FORA) é oral, da professora: a tela da criança não explica.",
    });

    // ═══ PROFESSORA: a cena gerada com IA ══════════════════════════════════
    await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
    const passo = prof.locator("[data-passo-conteudo]");
    await passo.locator("[data-gerar-com-ia]").waitFor({ timeout: 30_000 });
    const disciplina = passo.getByRole("combobox", { name: /^Componente curricular/i });
    await hidratado(prof, disciplina);
    await disciplina.click();
    await prof.getByRole("option", { name: RECORTE.disciplina, exact: true }).first().click();
    /* `fill`, não digitação: um rascunho de ONTEM (gerado e não aprovado) volta
       com o recorte dele nos campos, e digitar no meio do texto o emendaria. */
    const tema = passo.getByRole("textbox", { name: /^Tema/i });
    await tema.fill(RECORTE.tema);
    const palavras = passo.getByRole("textbox", { name: /^Palavras-chave/i });
    await palavras.fill(RECORTE.palavras.join(", "));
    r.exigir(
      (await tema.inputValue()) === RECORTE.tema && (await palavras.inputValue()) === RECORTE.palavras.join(", "),
      "o recorte da professora está nos campos (tema e palavras-chave)",
    );
    await r.registrar(prof, "recorte-da-professora", {
      titulo: "O preparo: banco padrão ou a cena da professora",
      mostra: `USAR BANCO PADRÃO (BIBLIOTECA) em um toque, os prontos da Horta e do Museu, e o “Gerar com IA” preenchido: Ciências, “${RECORTE.tema}”, ${RECORTE.palavras.length} palavras-chave.`,
      prova: "A missão é customizável: a cena, os selos e as falas da visitante vão ser escritos e desenhados para esta aula.",
    });

    /* Um rascunho de ONTEM pode já estar na curadoria: o desfecho que vale é o de DEPOIS da barra. */
    const rascunhoDeAntes = await passo.locator("[data-curadoria]").getAttribute("data-rascunho", { timeout: 1000 }).catch(() => null);
    const comecouAGerar = Date.now();
    await passo.locator('[data-acao="gerar-com-ia"]').click();
    await passo.locator("[data-gerando]").waitFor({ timeout: 10_000 });
    await r.registrar(prof, "a-radio-prepara-as-fotos", {
      titulo: "A Rádio Escola está preparando as fotos...",
      mostra: "A barra da geração enquanto o Vertex escreve o pacote e desenha a panorâmica.",
      prova: "A espera tem voz da missão; o botão fica ocupado e os prontos continuam à mão se a IA cair.",
    });
    await passo.locator("[data-gerando]").waitFor({ state: "detached", timeout: 240_000 });
    const curadoria = passo.locator("[data-curadoria]");
    const desfecho = await primeiroQueAparecer(
      { curadoria, semIa: passo.locator("[data-aviso-sem-ia]"), falha: passo.locator(ALERTA_DE_ERRO) },
      { timeout: 240_000, oQue: "a geração da cena com IA" },
    );
    const segundosDaGeracao = Math.round((Date.now() - comecouAGerar) / 1000);
    if (desfecho === "falha") {
      const aviso = (await passo.locator(ALERTA_DE_ERRO).first().innerText()).replace(/\s+/g, " ");
      r.exigir(false, `a geração com IA respondeu (a tela mostrou o erro: “${aviso.slice(0, 200)}”, em ${segundosDaGeracao}s)`);
      return;
    }
    await curadoria.waitFor({ timeout: 30_000 });
    const semIa = await passo.locator("[data-aviso-sem-ia]").getAttribute("data-aviso-sem-ia").catch(() => null);
    const rascunhoId = await curadoria.getAttribute("data-rascunho");
    if (rascunhoDeAntes) r.ressalva(`havia um rascunho de antes na curadoria (${rascunhoDeAntes.slice(0, 8)}); a geração nova o substitui`);
    const rascunho = (await lerApi(prof, `${daTurma}/rascunho`)).corpo?.rascunho ?? null;
    let origemDaCena = rascunho?.origem ?? null;
    if (semIa) {
      /* Ramo LEGÍTIMO: sem saldo ou com o vendor fora, o rascunho é o pronto da disciplina, com o aviso. */
      r.ressalva(`a IA não gerou a cena (motivo: ${semIa}, em ${segundosDaGeracao}s): o rascunho é o pacote pronto de Ciências, com o aviso`);
      r.exigir(origemDaCena === "padrao" && rascunho?.conteudo?.cena?.chave === "horta", "sem IA, o rascunho é a Horta (o pronto de Ciências)");
      await r.registrar(prof, "aviso-sem-ia", {
        titulo: "Sem IA: o pacote pronto da disciplina",
        mostra: "O aviso de que a personalização ficou desligada e a curadoria da Horta, já com os dois objetos marcados.",
        prova: "Sem saldo ou com o vendor fora, a professora não fica sem aula: o rascunho é o pronto da disciplina.",
        inteira: true,
      });
    } else {
      r.exigir(
        origemDaCena === "ia" && rascunho?.conteudo?.cena?.chave === "ia" && rascunho?.conteudo?.cena?.imagem?.tipo === "url",
        `a cena é da IA real: origem “${origemDaCena}”, imagem gerada (${rascunho?.conteudo?.cena?.imagem?.tipo}) — em ${segundosDaGeracao}s`,
      );
      r.exigir(
        (rascunho?.conteudo?.cena?.invariantes ?? []).every((i) => i.alvo === null),
        "a IA não devolve coordenada: os dois objetos nascem sem alvo, para a professora marcar",
      );
      r.exigir((await curadoria.innerText()).includes("Gerada com IA"), "a curadoria mostra a etiqueta “Gerada com IA”");
    }

    /* A marcação dos dois objetos: “Toque no {NOME} na imagem”, um toque por objeto. */
    const cena = curadoria.locator("[data-cena-do-enigma]");
    await cena.waitFor({ timeout: 15_000 });
    if ((await curadoria.locator('[data-marcacao="marcando"]').count()) > 0) {
      const pedido = curadoria.locator("[data-toque-pedido]");
      await pedido.waitFor({ timeout: 10_000 });
      const nomes = (rascunho?.conteudo?.cena?.invariantes ?? []).map((i) => i.nome);
      r.exigir(
        (await pedido.innerText()).trim() === `Toque no ${nomes[0]} na imagem`,
        `a curadoria pede “Toque no ${nomes[0]} na imagem”`,
      );
      await cena.scrollIntoViewIfNeeded();
      await r.registrar(prof, "curadoria-da-ia", {
        titulo: "A cena escrita e desenhada pela IA, na curadoria",
        mostra: `A panorâmica com as duas molduras, os selos, as falas da visitante e o pedido “Toque no ${nomes[0]} na imagem”.`,
        prova: "Nada chega à turma sem a aprovação da professora — e é ela quem diz onde estão os dois objetos iguais.",
        inteira: true,
      });
      const imagem = cena.locator("[data-toque-na-cena]");
      for (const toque of TOQUES_DA_PROFESSORA) {
        const ponto = await pontoEm(imagem, toque.x / 100, toque.y / 100);
        await prof.mouse.click(ponto.x, ponto.y);
        await prof.waitForTimeout(250);
      }
      await esperarOuFalharCedo(curadoria.locator('[data-marcacao="marcada"]'), curadoria.locator(ALERTA_DE_ERRO), {
        timeout: 20_000,
        oQue: "gravar as marcações dos dois objetos",
      });
    }
    const marcados = (await lerApi(prof, `${daTurma}/rascunho`)).corpo?.rascunho;
    r.exigir(
      (marcados?.conteudo?.cena?.invariantes ?? []).every((i) => i.alvo && i.alvo.x - i.alvo.r >= 32 && i.alvo.x + i.alvo.r <= 68),
      `os dois objetos estão marcados, dentro da faixa comum 32–68 (${(marcados?.conteudo?.cena?.invariantes ?? []).map((i) => `${i.nome} x=${i.alvo?.x}`).join(", ")})`,
    );
    r.exigir((marcados?.pendencias ?? ["?"]).length === 0, "o rascunho não tem pendências: pode aprovar");
    r.exigir((await cena.locator("[data-alvo]").count()) === 2, "os dois círculos amarelos aparecem na cena");
    await cena.scrollIntoViewIfNeeded();
    await r.registrar(prof, "objetos-marcados", {
      titulo: "Os dois objetos iguais, marcados pela professora",
      mostra: "Os dois círculos amarelos na parede do meio: o que a criança vai procurar nas duas fotos.",
      prova: "Os alvos ficam na faixa que aparece nas DUAS fotos (32–68); fora dela, a tela avisaria e a aprovação recusaria.",
      inteira: true,
    });

    await curadoria.locator('[data-acao="aprovar-atividade"]:not([disabled])').waitFor({ timeout: 10_000 });
    await curadoria.locator('[data-acao="aprovar-atividade"]').click();
    await esperarOuFalharCedo(passo.locator('[data-fase="gravada"]'), passo.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "aprovar a cena",
    });
    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').waitFor({ timeout: 10_000 });
    await prof.locator('[data-acao="continuar-criacao"]').click();
    await prof.getByRole("radio", { name: "Um aluno por computador", exact: true }).click();
    await prof.locator('[data-acao="continuar-criacao"]').click();
    const revisao = prof.locator("[data-revisao-da-criacao]");
    await revisao.waitFor({ timeout: 10_000 });
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    /* Desligado de propósito: a atividade nasce PRONTA e quem a põe no ar é o “Usar esta atividade agora”. */
    if (await noAr.isChecked()) await noAr.dispatchEvent("click");
    r.exigir(!(await noAr.isChecked()), "“Pôr esta atividade no ar agora” desligado: a atividade nasce pronta");
    await r.registrar(prof, "revisar-e-criar", {
      titulo: "Revisar e criar",
      mostra: "A turma, a cena aprovada e “Um aluno por computador”, com o pôr no ar desligado.",
      prova: "Criar não põe no ar (ADR-130): a atividade fica pronta na lista até a professora escolher.",
    });
    await prof.locator('[data-acao="criar-atividade"]').click();
    await esperarOuFalharCedo(prof.locator("[data-atividade-pronta]"), prof.locator(ALERTA_DE_ERRO), {
      timeout: 60_000,
      oQue: "criar a atividade",
    });
    await r.registrar(prof, "atividade-pronta", {
      titulo: "A atividade pronta, ainda fora do ar",
      mostra: "A página da atividade com o tema da professora, “Pronta”, e o botão “Usar esta atividade agora”.",
      prova: "Sem atividade em andamento a turma vê a missão fechada: a professora escolhe a hora.",
    });
    const usar = prof.locator('[data-acao="usar-esta-atividade"]');
    await hidratado(prof, usar);
    await usar.click();
    const confirmar = prof.getByRole("dialog").getByRole("button", { name: /Usar|Trocar|Confirmar/ });
    const depoisDoUsar = await primeiroQueAparecer(
      { noAr: prof.locator('[data-estado-da-atividade="em-andamento"]'), confirmar, falha: prof.locator(ALERTA_DE_ERRO) },
      { timeout: 30_000, oQue: "usar esta atividade agora" },
    );
    if (depoisDoUsar === "confirmar") await confirmar.first().click();
    if (depoisDoUsar === "falha") throw new Error(`usar esta atividade: ${(await prof.locator(ALERTA_DE_ERRO).first().innerText()).replace(/\s+/g, " ")}`);
    await prof.locator('[data-estado-da-atividade="em-andamento"]').waitFor({ timeout: 30_000 });

    const pacotes = await lerApi(prof, `${daTurma}/pacotes`);
    const atividadeId = pacotes.corpo?.emAndamento?.pacoteId;
    const detalhe = (await lerApi(prof, `${daTurma}/pacotes/${atividadeId}`)).corpo;
    if (
      !r.exigir(
        detalhe?.tema === RECORTE.tema && detalhe?.origem === origemDaCena && (!rascunhoId || detalhe?.id === rascunhoId),
        `a atividade EM ANDAMENTO é a aprovada agora, com o tema da professora (origem ${detalhe?.origem}, “${detalhe?.tema}”)`,
      )
    )
      return;
    const salas = await lerApi(prof, `/salas/turma/${turmaId}`);
    const naSala = salas.corpo?.missoes?.find?.((m) => m.expId === EXP_ID) ?? null;
    r.exigir(naSala?.estado === "liberada", `a missão está liberada na sala da ${TURMA} (GET /salas/turma: ${salas.status}, ${naSala?.estado})`);
    const k = detalhe.conteudo.cena;
    const foto = k.fotos.find((f) => f.id === "foto-1");
    const alvos = Object.fromEntries(k.invariantes.map((i) => [i.id, i.alvo]));
    await r.registrar(prof, "atividade-no-ar", {
      titulo: "A atividade em andamento",
      mostra: "“Usar esta atividade agora” trocou o estado para Em andamento: a Aula ao vivo, com LIBERAR VIRADA, e a turma já entra.",
      prova: `A cena “${k.espaco}” (${k.invariantes.map((i) => i.nome).join(" e ")}) está no ar e a missão está liberada na sala da turma.`,
    });

    // ═══ ESTUDANTE: a missão (a chamada para a ação) ═══════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 412, height: 915 }, mobile: true, deviceScaleFactor: 2 });
    await r.entrar(p, estudante.login, senhaDe(estudante));
    await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    const q = p.frameLocator("iframe[data-experiencia]");
    const abrir = q.getByRole("button", { name: "ABRIR BANCADA" });
    await esperarOuFalharPorHttp(p, abrir, /enigma-capa\/sessao/, { timeout: 40_000, oQue: "o boot da missão" });
    const cta = (await q.locator(".missao__cta").innerText()).replace(/^search\s*/, "").trim();
    r.exigir(/^ENCONTRE NAS FOTOS 2 OBJETOS D[AOE]S? /.test(cta), `a missão em letra grande: “${cta}”`);
    r.exigir((await q.getByText("RASCUNHO PENDENTE").count()) > 0 && (await q.getByText("INVESTIGAR A NOVA CAPA").count()) > 0, "o card do protótipo: RASCUNHO PENDENTE e INVESTIGAR A NOVA CAPA");
    await r.registrar(p, "a-missao", {
      titulo: "A missão, no mural da Rádio",
      mostra: `Um card só: RASCUNHO PENDENTE, INVESTIGAR A NOVA CAPA, o que aconteceu e a missão — “${cta}” — com ABRIR BANCADA.`,
      prova: "A criança sabe o que fazer antes de tocar em nada, e a tela não diz onde estão os objetos (ADR-186).",
    });
    const { status: iniciou, corpo: aberta } = await comResposta(p, /\/enigma-capa\/iniciar$/, () => abrir.click());
    r.exigir(iniciou < 300 && aberta?.passo === "lupa" && (aberta?.lupa?.alvos ?? []).length === 2, "ABRIR BANCADA abre a sessão (POST /iniciar) e a lupa recebe o lugar dos dois objetos");

    // ═══ ESTUDANTE: a lupa que brilha e conta 3 s ══════════════════════════
    const avancar = q.getByRole("button", { name: "AVANÇAR" });
    await avancar.waitFor({ timeout: 15_000 });
    await q.getByText("INVESTIGUE COM A LUPA").first().waitFor({ timeout: 10_000 });
    const contador = q.locator(".contador").first();
    r.exigir((await contador.innerText()).trim() === "0 DE 2 ENCONTRADOS", "o contador começa em 0 DE 2 ENCONTRADOS");
    const fotosDaBancada = q.locator(".bancada__foto");
    await fotosDaBancada.nth(1).waitFor({ timeout: 15_000 });
    const rotulos = await q.locator(".bancada__rotulo").allInnerTexts();
    r.exigir(
      rotulos.length === 2 && rotulos[0].startsWith("FOTO 1 — ") && rotulos[0].includes(k.hora) && rotulos[1].startsWith("FOTO 2 — "),
      `as duas fotos com o rótulo do PO (“${rotulos[0]}” / “${rotulos[1]}”)`,
    );
    /* Tentar avançar ANTES do piso: a régua conta um alerta, e o aviso OLHE O FUNDO abre. */
    const avancou = (req) => req.postDataJSON()?.avancar === true;
    const { corpo: precoce } = await comResposta(p, /\/enigma-capa\/lupa$/, () => tocarNoMeio(p, avancar), avancou);
    await q.getByText("OLHE O FUNDO").first().waitFor({ timeout: 10_000 });
    r.exigir(precoce?.liberado === false && precoce?.alerta === true && precoce?.lupa?.alertas === 1, "avançar antes do piso: recusado, com um alerta contado (lupa_alertas = 1)");
    await r.registrar(p, "olhe-o-fundo", {
      titulo: "OLHE O FUNDO",
      mostra: "O aviso do protótipo: a lupa, OLHE O FUNDO, a frase e VOLTAR À INVESTIGAÇÃO.",
      prova: "O botão esmaecido continua tocável: o toque antes do piso É a evidência que a régua lê.",
    });
    await q.getByRole("button", { name: "VOLTAR À INVESTIGAÇÃO" }).click();

    /* O piso: 3 s com o centro da lente sobre CADA objeto. A lente fica onde é solta. */
    const lente = q.locator(".lupa");
    const naFoto = async (i, f, alvo) => {
      const rec = k.fotos.find((x) => x.id === f).recorte;
      return pontoEm(fotosDaBancada.nth(i), (alvo.x - rec.x) / rec.w, (alvo.y - rec.y) / rec.h);
    };
    await arrastar(p, await pontoEm(lente, 0.5, 0.5), await naFoto(0, "foto-1", alvos["inv-1"]), 16);
    await q.locator(".lupa--brilhando").waitFor({ timeout: 3000 });
    await p.waitForTimeout(1300);
    await r.registrar(p, "a-lupa-brilha", {
      titulo: "A lupa brilha e o anel conta o tempo",
      mostra: `A lente parada sobre o ${k.invariantes[0].nome}: ela brilha, o anel em volta enche e SEGURE A LUPA AQUI!`,
      prova: "O pedido do time: a lupa mostra que está no lugar certo e que é preciso ficar 3 s.",
    });
    await p.waitForTimeout(2300);
    await q.getByText("1 DE 2 ENCONTRADOS").first().waitFor({ timeout: 5000 });
    await arrastar(p, await pontoEm(lente, 0.5, 0.5), await naFoto(1, "foto-2", alvos["inv-2"]), 16);
    await p.waitForTimeout(3700);
    await q.getByText("INVESTIGAÇÃO COMPLETA!").first().waitFor({ timeout: 5000 });
    r.exigir((await contador.innerText()).trim() === "2 DE 2 ENCONTRADOS" && (await q.locator(".achado-na-lupa").count()) === 4, "os dois objetos achados, com o círculo dourado nas duas fotos (2 DE 2)");
    await r.registrar(p, "investigacao-completa", {
      titulo: "INVESTIGAÇÃO COMPLETA!",
      mostra: "Os dois objetos marcados de dourado nas duas fotos, 2 DE 2 ENCONTRADOS, e o AVANÇAR aceso.",
      prova: "O cronômetro é da tela e o piso é do servidor: 3 s sobre cada objeto.",
    });
    const { corpo: piso } = await comResposta(p, /\/enigma-capa\/lupa$/, () => tocarNoMeio(p, avancar), avancou);
    r.exigir(
      piso?.liberado === true && piso?.passo === "decidir" && piso?.lupa?.alvo1Ms >= 3000 && piso?.lupa?.alvo2Ms >= 3000,
      `com o piso cumprido, o avanço é liberado (objeto 1 ${piso?.lupa?.alvo1Ms} ms, objeto 2 ${piso?.lupa?.alvo2Ms} ms)`,
    );

    // ═══ ESTUDANTE: a capa ═════════════════════════════════════════════════
    await q.getByText("ESCOLHA 1 FOTO").first().waitFor({ timeout: 15_000 });
    const miniaturas = q.locator(".decidir__miniatura");
    await miniaturas.nth(0).click();
    await q.getByText("SELECIONE O SELO").first().waitFor({ timeout: 5000 });
    const moldura = q.locator(".moldura");
    await moldura.waitFor({ timeout: 10_000 });
    await q.getByText("(Tamanho fixo, sem zoom)").first().waitFor({ timeout: 5000 });
    const imagemDaMoldura = moldura.locator(".janela__imagem");
    const antes = { caixa: await moldura.boundingBox(), estilo: await imagemDaMoldura.getAttribute("style") };
    /* Arrasta a foto para a direita e para baixo: a moldura mostra mais da esquerda e do alto — a ação 1 continua inteira. */
    const meio = await pontoEm(moldura, 0.5, 0.5);
    await arrastar(p, meio, { x: meio.x + meio.caixa.width * 0.12, y: meio.y + meio.caixa.height * 0.05 }, 10);
    const depois = { caixa: await moldura.boundingBox(), estilo: await imagemDaMoldura.getAttribute("style") };
    r.exigir(
      Math.abs(antes.caixa.width - depois.caixa.width) < 0.5 && Math.abs(antes.caixa.height - depois.caixa.height) < 0.5,
      `o arraste não muda o tamanho da moldura (${Math.round(antes.caixa.width)}×${Math.round(antes.caixa.height)} antes e depois)`,
    );
    r.exigir(antes.estilo !== depois.estilo, "o arraste DESLOCA a foto dentro da moldura");
    const seloCoerente = k.selos.find((s) => s.id === foto.seloCoerente);
    await q.getByRole("button", { name: new RegExp(seloCoerente.texto) }).click();
    await moldura.locator(".carimbo").waitFor({ timeout: 5000 });
    await q.getByText("CAPA PRONTA!").first().waitFor({ timeout: 5000 });
    await q.locator("button:not([disabled])", { hasText: "PUBLICAR CAPA" }).waitFor({ timeout: 5000 });
    await p.waitForTimeout(400); /* o carimbo entra com animação: o print espera ele assentar */
    await r.registrar(p, "capa-pronta", {
      titulo: "ESCOLHA 1 FOTO → SELECIONE O SELO → CAPA PRONTA!",
      mostra: `A foto 1 escolhida, deslocada na moldura de tamanho fixo, com o selo “${seloCoerente.texto}”; o título diz o passo.`,
      prova: "Você pode mover a foto, mas não mudar o tamanho: a moldura tem a mesma medida antes e depois do arraste.",
    });
    const { corpo: publicada } = await comResposta(p, /\/enigma-capa\/publicar$/, () => q.getByRole("button", { name: "PUBLICAR CAPA" }).click());
    r.exigir(
      publicada?.capa?.fotoId === "foto-1" && publicada?.capa?.seloId === seloCoerente.id && publicada?.capa?.deslocamento?.x < 0.5,
      `PUBLICAR CAPA grava a foto 1, o selo e o deslocamento (x=${publicada?.capa?.deslocamento?.x?.toFixed?.(2)}, y=${publicada?.capa?.deslocamento?.y?.toFixed?.(2)})`,
    );
    r.exigir(publicada?.visitante === foto.visitante, `a visitante diz o que o recorte mostrou: “${publicada?.visitante}” (a ação ficou na capa)`);
    await q.getByText("CAPA PUBLICADA!").first().waitFor({ timeout: 10_000 });
    await r.registrar(p, "capa-publicada", {
      titulo: "CAPA PUBLICADA!",
      mostra: "O aviso do protótipo entre a publicação e o feed, com IR PARA O FEED.",
      prova: "LATCH 1: a escolha está gravada e não volta.",
    });
    await q.getByRole("button", { name: /IR PARA O FEED/ }).click();
    const resposta = q.locator(".feed__resposta");
    await resposta.waitFor({ timeout: 10_000 });
    r.exigir((await resposta.innerText()).includes(publicada?.visitante ?? "—"), "a fala da visitante aparece no feed, embaixo da capa");
    await r.registrar(p, "a-visitante", {
      titulo: "A capa no feed e a fala da visitante",
      mostra: `A capa publicada (a janela exata da moldura, com o selo) e a visitante: “${publicada?.visitante}”.`,
      prova: "A visitante só conhece o que a capa mostrou.",
    });
    await q.getByText("AGUARDE O PROFESSOR").first().waitFor({ timeout: 15_000 });
    r.exigir((await q.locator(".aviso [class*='avatar']").count()) === 0, "o aviso AGUARDE O PROFESSOR tem só o cadeado e a mensagem, sem retrato");
    await r.registrar(p, "aguarde-o-professor", {
      titulo: "AGUARDE O PROFESSOR",
      mostra: "O aviso com o cadeado e a mensagem, sobre o feed — sem retrato e sem botão.",
      prova: "A criança não fura o bloqueio: quem abre a comparação é a professora, depois da conversa.",
    });

    /* Regra 3: fora do passo da lupa, o estado do estudante não carrega o gabarito. */
    const sessao = await lerApi(p, "/enigma-capa/sessao");
    const bruto = JSON.stringify(sessao.corpo ?? {});
    const cenaDoEstudante = sessao.corpo?.cena ?? {};
    r.exigir(
      sessao.status === 200 &&
        !/"nucleo"|"seloCoerente"|"marcaveis"|"alvo"/.test(bruto) &&
        (sessao.corpo?.lupa?.alvos ?? null) === null &&
        (cenaDoEstudante.fotos ?? []).every((f) => !("visitante" in f)) &&
        (cenaDoEstudante.invariantes ?? []).every((i) => Object.keys(i).sort().join() === "id,nome") &&
        sessao.corpo?.invariantes === null &&
        (sessao.corpo?.material?.cartas ?? []).every((c) => Object.keys(c).sort().join() === "id,imagem"),
      "GET /enigma-capa/sessao do estudante, depois da lupa, não traz núcleo, selo coerente, marcáveis, alvos nem as falas",
    );

    // ═══ PROFESSORA: a aula ao vivo e a virada ═════════════════════════════
    await prof.goto(`${FICHA}/resultados?turmaId=${turmaId}&pacote=${atividadeId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-lousa]").waitFor({ timeout: 30_000 });
    const aguardam = prof.locator("[data-lousa]").locator(".unooria-metric-card, [class*=metric]").filter({ hasText: "Aguardam a virada" });
    await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.resumo?.aguardandoVirada >= 1, { oQue: "o painel contar quem aguarda a virada" });
    await prof.waitForFunction(
      () => /Aguardam a virada\s*[1-9]/.test(document.querySelector("[data-lousa]")?.innerText ?? ""),
      null,
      { timeout: 20_000 },
    );
    r.exigir((await aguardam.count()) >= 0, "a lousa mostra quantos aguardam a virada");
    await r.registrar(prof, "aguardam-a-virada", {
      titulo: "Aula ao vivo: quem aguarda a virada",
      mostra: "Entraram, publicaram, AGUARDAM A VIRADA e concluíram, o botão LIBERAR VIRADA e a pausa para a conversa.",
      prova: "A professora vê quem já publicou e conversa antes: “O que a visitante conseguiu conhecer pela foto? O que ficou de fora?”",
    });
    await prof.locator('[data-acao="liberar-virada"]').click();
    const dialogo = prof.getByRole("dialog", { name: "Liberar a virada para a turma toda?" });
    await dialogo.waitFor({ timeout: 10_000 });
    await r.registrar(prof, "liberar-virada", {
      titulo: "LIBERAR VIRADA, para a turma toda",
      mostra: "A confirmação: a virada é um botão só, e vale para toda a turma.",
      prova: "Decisão do Lucas: a virada é GERAL (o one-pager falava em liberação por estudante).",
    });
    await dialogo.getByRole("button", { name: "LIBERAR VIRADA" }).click();
    await prof.getByRole("button", { name: "Virada liberada" }).waitFor({ timeout: 20_000 });

    // ═══ ESTUDANTE: a virada, a busca e o slider de comparação ═════════════
    await q.getByText("TOQUE EM 2 COISAS IGUAIS").first().waitFor({ timeout: 20_000 });
    const metade = (f) => q.locator(".dividida__foto").nth(f === "foto-1" ? 0 : 1);
    const recorteDe = (f) => k.fotos.find((x) => x.id === f).recorte;
    const tocarNa = async (f, ponto) => {
      const rec = recorteDe(f);
      const alvo = await pontoEm(metade(f), (ponto.x - rec.x) / rec.w, (ponto.y - rec.y) / rec.h);
      return (await comResposta(p, /\/enigma-capa\/invariantes$/, () => p.mouse.click(alvo.x, alvo.y))).corpo;
    };
    await r.registrar(p, "tela-dividida", {
      titulo: "TOQUE EM 2 COISAS IGUAIS",
      mostra: "SUA FOTO e OUTRA FOTO (do acervo da missão), lado a lado, a frase “Toque na mesma coisa nas duas fotos.” e 0 DE 2 ENCONTRADOS.",
      prova: "A virada chegou pelo polling de 3 s, sem recarregar: o professor tocou uma vez, a turma toda virou.",
    });
    /* Um erro proposital: longe dos dois objetos, no chão da foto 1. */
    const erro = await tocarNa("foto-1", { x: 8, y: 88 });
    r.exigir(erro?.toque?.acerto === null && erro?.toque?.erros === 1 && erro?.toque?.ajuda === false, "o toque fora dos objetos é um erro sem penalidade visível (a onda cinza; 1 erro, sem ajuda)");
    const acertos = [];
    acertos.push(await tocarNa("foto-1", alvos["inv-1"]));
    acertos.push(await tocarNa("foto-2", alvos["inv-1"]));
    r.exigir(
      acertos.every((a) => a?.toque?.acerto === "inv-1") && acertos[1]?.toque?.encontrados?.length === 2,
      `${k.invariantes[0].nome} achado nas duas fotos (${acertos.map((a) => a?.toque?.acerto).join(", ")})`,
    );
    /* `attached`: a linha dourada de dois pontos na mesma altura tem caixa de altura zero, e o Playwright a julga invisível. */
    await q.locator(".linha-dourada").first().waitFor({ state: "attached", timeout: 5000 });
    await q.getByText("1 DE 2 ENCONTRADOS").first().waitFor({ timeout: 5000 });
    /* F5 no meio da busca: os achados redesenham a partir de `invariantes.achados`. */
    await p.reload({ waitUntil: "domcontentloaded" });
    await q.getByText("TOQUE EM 2 COISAS IGUAIS").first().waitFor({ timeout: 40_000 });
    await q.locator("circle.achado").nth(1).waitFor({ state: "attached", timeout: 15_000 });
    await q.locator(".linha-dourada").first().waitFor({ state: "attached", timeout: 5000 });
    r.exigir(
      (await q.locator("circle.achado").count()) === 2 && (await q.locator(".linha-dourada").count()) === 1,
      "depois do F5, os dois círculos dourados e a linha que une o par estão de volta",
    );
    await r.registrar(p, "f5-redesenha", {
      titulo: "F5 no meio da busca",
      mostra: `O ${k.invariantes[0].nome} achado nas duas fotos, com a linha dourada e 1 DE 2 ENCONTRADOS, redesenhado depois do recarregamento.`,
      prova: "O servidor devolve o alvo do invariante JÁ ACHADO (deixou de ser gabarito); o não achado continua sem descer.",
    });
    acertos.push(await tocarNa("foto-1", alvos["inv-2"]));
    acertos.push(await tocarNa("foto-2", alvos["inv-2"]));
    const ultimo = acertos.at(-1);
    r.exigir(
      acertos.slice(2).every((a) => a?.toque?.acerto === "inv-2") && ultimo?.toque?.completo === true && ultimo?.toque?.encontrados?.length === 4 && ultimo?.toque?.erros === 1,
      `os quatro achados (2 objetos × 2 fotos), com 1 erro e sem ajuda: a busca está completa`,
    );

    /* DESLIZE PARA REVELAR: a alça parte do centro; arrastada até o lado escondido, revela o lugar. */
    await q.getByText("DESLIZE PARA REVELAR").first().waitFor({ timeout: 15_000 });
    const alca = q.locator(".comparar__alca");
    await alca.waitFor({ timeout: 10_000 });
    r.exigir((await alca.getAttribute("aria-valuenow")) === "50", "a alça do slider parte do CENTRO (50)");
    await r.registrar(p, "deslize-para-revelar", {
      titulo: "DESLIZE PARA REVELAR",
      mostra: "A mesma imagem com a alça no meio: de um lado o LUGAR INTEIRO, do outro SUA FOTO com o resto em xadrez; o Bento: AGORA EU ENTENDI!",
      prova: "O slider de comparação do protótipo, como a prévia de remover fundo (ADR-186).",
    });
    const comparar = q.locator(".comparar");
    const ladoDireito = publicada.capa.visivel.x <= 100 - (publicada.capa.visivel.x + publicada.capa.visivel.w);
    const inicioDaAlca = await pontoEm(alca, 0.5, 0.5);
    const fimDoCurso = await pontoEm(comparar, ladoDireito ? 0.995 : 0.005, 0.5);
    const meioDoCurso = await pontoEm(comparar, ladoDireito ? 0.78 : 0.22, 0.5);
    await p.mouse.move(inicioDaAlca.x, inicioDaAlca.y);
    await p.mouse.down();
    await p.mouse.move(meioDoCurso.x, meioDoCurso.y, { steps: 10 });
    await r.registrar(p, "slider-no-meio", {
      titulo: "O lugar aparece",
      mostra: "A alça a caminho do fim: o lado da SUA FOTO encolhe e o resto do lugar aparece, na mesma escala.",
      prova: "UMA imagem serve a foto e o lugar inteiro: não há emenda, porque nunca houve duas imagens.",
    });
    const doSlider = await comResposta(p, /\/enigma-capa\/slider$/, async () => {
      await p.mouse.move(fimDoCurso.x, fimDoCurso.y, { steps: 10 });
      await p.mouse.up();
    });
    r.exigir(doSlider.status === 200 && doSlider.corpo?.passo === "fora", "a alça no fim do curso registra a panorâmica aberta (POST /slider)");
    await q.getByText("A CENA COMPLETA").first().waitFor({ timeout: 10_000 });
    await q.getByText("ERA O MESMO LUGAR!").first().waitFor({ timeout: 10_000 });
    r.exigir((await q.locator(".mesmo-lugar").innerText()).includes(k.hora), `MESMO LUGAR · MESMO MINUTO (${k.hora})`);
    await r.registrar(p, "a-cena-completa", {
      titulo: "A CENA COMPLETA",
      mostra: `O lugar inteiro com o contorno da SUA FOTO, “MESMO LUGAR · MESMO MINUTO (${k.hora})” e o Bento: ERA O MESMO LUGAR!`,
      prova: "A revelação do protótipo, antes da marcação: a criança vê o que a foto deixou de fora.",
    });
    await q.getByRole("button", { name: "AVANÇAR" }).click();

    /* O “fora”: um alfinete arrastado da bandeja e outro tocado na cena, fora do contorno da SUA FOTO. */
    const instrucao = (await q.locator(".titulo-da-tela").first().innerText()).trim();
    r.exigir(/o que ficou fora da sua foto\.$/.test(instrucao), `a instrução do “fora”: “${instrucao}”`);
    const pronto = q.getByRole("button", { name: "Pronto", exact: true });
    r.exigir(await pronto.isDisabled(), "“Pronto” apagado enquanto não há alfinete");
    const vis = publicada.capa.visivel;
    const inteira = q.locator(".cena-inteira");
    const pontosFora = [
      { x: Math.min(97, vis.x + vis.w + (100 - vis.x - vis.w) * 0.5), y: 60 },
      { x: Math.min(97, vis.x + vis.w + (100 - vis.x - vis.w) * 0.75), y: 75 },
    ];
    const bandeja = await pontoEm(q.locator(".bandeja__alfinete"), 0.5, 0.5);
    await arrastar(p, bandeja, await pontoEm(inteira, pontosFora[0].x / 100, pontosFora[0].y / 100), 14);
    const toque = await pontoEm(inteira, pontosFora[1].x / 100, pontosFora[1].y / 100);
    await p.mouse.click(toque.x, toque.y);
    await p.waitForTimeout(300);
    r.exigir((await q.locator(".pino").count()) === 2 && !(await pronto.isDisabled()), "os dois alfinetes aparecem fora do contorno da SUA FOTO, e o “Pronto” acende");
    await r.registrar(p, "o-alfinete", {
      titulo: "Marque o que ficou fora da sua foto",
      mostra: `A cena inteira com o contorno da SUA FOTO, o ALFINETE grande na bandeja (ARRASTE O ALFINETE) e dois fincados fora — “${instrucao}”`,
      prova: "O alfinete diz “marque”; o que ele pega fora da capa é o reconhecimento que a EF02CO05 mede (ADR-186).",
    });
    const { corpo: fora } = await comResposta(p, /\/enigma-capa\/fora$/, () => pronto.click());
    r.exigir(fora?.passo === "pares" && fora?.fora?.toques?.length === 2, "“Pronto” grava os dois alfinetes e leva aos pares");

    // ═══ ESTUDANTE: os pares e a segunda foto, que conclui ═════════════════
    await q.getByText("Junte duas fotos da mesma atividade.").first().waitFor({ timeout: 15_000 });
    /* O par certo é a mesma ATIVIDADE (carta-a + carta-c = Foto 1 + Foto 3): arrasta a Foto 1 sobre a Foto 3. */
    const carta1 = await pontoEm(q.getByRole("button", { name: "Foto 1", exact: true }), 0.5, 0.5);
    const carta3 = await pontoEm(q.getByRole("button", { name: "Foto 3", exact: true }), 0.5, 0.5);
    await arrastar(p, carta1, carta3, 14);
    await q.getByText("O que é parecido?").first().waitFor({ timeout: 10_000 });
    await r.registrar(p, "pares", {
      titulo: "Junte duas fotos da mesma atividade.",
      mostra: "A Foto 1 arrastada sobre a Foto 3 forma o par, no alto; O que é parecido? — A atividade / A cor da roupa.",
      prova: "As cartas descem só com id e imagem: a atividade e a cor são o gabarito, e a carta nunca muda de tamanho.",
    });
    const { corpo: pares } = await comResposta(p, /\/enigma-capa\/pares$/, () => q.getByRole("button", { name: /A atividade$/ }).click());
    r.exigir(
      pares?.passo === "segunda-foto" && [...(pares?.pares?.cartas ?? [])].sort().join() === "carta-a,carta-c" && pares?.pares?.motivo === "atividade",
      `o par (${(pares?.pares?.cartas ?? []).join(" + ")}) e o motivo “atividade” gravados`,
    );
    await q.getByText("Foto de leitura: o que precisa aparecer?").first().waitFor({ timeout: 10_000 });
    await q.getByRole("button", { name: /Criança lendo/ }).click();
    const moldura2 = q.locator(".moldura");
    const m2 = await pontoEm(moldura2, 0.5, 0.5);
    const tamanhoAntes = m2.caixa;
    await arrastar(p, m2, { x: m2.x + m2.caixa.width * 0.3, y: m2.y }, 10);
    const tamanhoDepois = await moldura2.boundingBox();
    r.exigir(Math.abs(tamanhoAntes.width - tamanhoDepois.width) < 0.5, "a moldura da segunda foto também não muda de tamanho no arraste");
    await r.registrar(p, "segunda-foto", {
      titulo: "Foto de leitura: o que precisa aparecer?",
      mostra: "Criança lendo escolhida e a foto deslocada na moldura estreita, até a criança e o livro aparecerem.",
      prova: "A moldura PODE cortar a criança: o servidor calcula se a leitura ficou na foto, e isso vai ao painel.",
    });
    const { corpo: segunda } = await comResposta(p, /\/enigma-capa\/segunda-foto$/, () => q.getByRole("button", { name: "Colocar no álbum" }).click());
    r.exigir(
      segunda?.passo === "concluida" && segunda?.concluido === true && segunda?.segundaFoto?.elemento === "crianca-lendo",
      "“Colocar no álbum” grava a segunda foto e CONCLUI a missão (a etapa 6 saiu, ADR-186)",
    );
    await q.getByText("FOTO GUARDADA NO ÁLBUM!").first().waitFor({ timeout: 10_000 });
    await q.getByText("MISSÃO CUMPRIDA!").first().waitFor({ timeout: 10_000 });
    await r.registrar(p, "missao-cumprida", {
      titulo: "FOTO GUARDADA NO ÁLBUM! — MISSÃO CUMPRIDA!",
      mostra: "O aviso final do protótipo: a foto guardada, MISSÃO CUMPRIDA! e “Agora conversem com o professor.”",
      prova: "O álbum é o fim da missão; a conversa sobre ENQUADRAMENTO, AUTORIA e O QUE FICOU DE FORA é do professor, oral.",
    });

    // ═══ PROFESSORA: a folha, as habilidades e o podcast ═══════════════════
    const caminhoDaEvidencia = `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`;
    const nivelDe = (c, codigo) => {
      const e = c?.estudantes?.find((x) => x.nome === estudante.nome);
      return Object.values(e?.porRodada ?? {}).map((rodada) => rodada?.[codigo]?.status).find(Boolean) ?? null;
    };
    const evidencia = await esperarNaApi(prof, caminhoDaEvidencia, (c) => nivelDe(c, "EF02CO05") !== null && nivelDe(c, "EF02CO01") !== null, {
      oQue: "as marcas da EF02CO05 e da EF02CO01",
    });
    /* A régua: lupa PARCIAL (1 alerta), selo coerente, invariantes plenos (1 erro, sem ajuda), o fora pleno → CO05 em processo; CO01 atingiu (sem ajuda). */
    r.exigir(nivelDe(evidencia, "EF02CO05") === "em_processo", `EF02CO05: o painel registra “${nivelDe(evidencia, "EF02CO05")}”, e a régua dá “em_processo” (lupa com 1 alerta)`);
    r.exigir(nivelDe(evidencia, "EF02CO01") === "atingiu", `EF02CO01: o painel registra “${nivelDe(evidencia, "EF02CO01")}”, e a régua dá “atingiu” (achou sem a ajuda)`);

    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.locator("[data-folha]").waitFor({ timeout: 30_000 });
    const painel = (await lerApi(prof, `${daTurma}/painel`)).corpo;
    const linha = painel?.linhas?.find((l) => l.nome === estudante.nome);
    r.exigir(
      linha?.passo === "concluida" &&
        linha?.lupa?.alertas === 1 &&
        linha?.capa?.seloCoerente === true &&
        linha?.invariantes?.completo === true &&
        linha?.invariantes?.erros === 1 &&
        linha?.par?.correto === true &&
        linha?.segundaFoto?.elemento === "crianca-lendo" &&
        (linha?.fora?.itens ?? []).length >= 1,
      `a linha de ${estudante.nome} no painel, pelo nome: lupa (1 alerta), capa coerente, busca (1 erro), o que marcou fora, par certo e segunda foto`,
    );
    const folha = prof.locator("[data-folha]");
    await folha.getByText(estudante.nome).first().scrollIntoViewIfNeeded();
    const cabecalhos = await folha.locator("th").allInnerTexts();
    await r.registrar(prof, "folha-da-turma", {
      titulo: "A folha da turma, por estudante",
      mostra: `As colunas da aula (${cabecalhos.map((c) => c.trim()).filter(Boolean).join(" · ")}), com a linha de ${estudante.nome}.`,
      prova: "Para a tela da professora, não para o projetor: o que cada criança fez, para a conversa — sem nível nem ranking.",
      inteira: true,
    });

    const habilidades = prof.locator("[data-habilidades-enigma-capa]");
    await revelar(prof, habilidades);
    await habilidades.waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await habilidades.innerText();
    r.exigir(/EF02CO05/.test(textoDasHabilidades) && /EF02CO01/.test(textoDasHabilidades), "a aba Habilidades mostra EF02CO05 e EF02CO01");
    await habilidades.scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "As habilidades da BNCC",
      mostra: `EF02CO05 (em processo: a lupa teve um alerta) e EF02CO01 (atingiu: os objetos achados sem a ajuda) para ${estudante.nome}.`,
      prova: "Tudo foi medido pelo que a criança fez — a lupa, o selo, a busca e o que marcou fora. Não há pergunta no fim.",
      inteira: true,
    });

    await provarPodcastNaAula(r, prof, {
      blocos: ["Abertura", "Recapitulação da investigação", "A grande revelação", "Provocação e aprendizado", "Encerramento"],
      vozes: ["Bento", "Iara"],
      trechos: 5,
      passo: "podcast",
      descricao: "Bento e Iara, o roteiro fixo do PO",
    });
  },
);
