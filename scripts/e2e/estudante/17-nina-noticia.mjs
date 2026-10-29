import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { revelar } from "../lib/abas.mjs";

/**
 * Nina e a Notícia que Desapareceu (exp03ef1b 0.1.0, ADR-197 — 3º ano,
 * unidade 1), nas duas pontas da sala: a professora prepara o pacote de
 * notícias com a IA REAL e conduz os portões; uma criança da 3A investiga, no
 * Unoojornal, por que a busca "Onde: Pátio" deixa uma das três reportagens da
 * feira de fora.
 *
 * O que esta suíte cobra, e por que cada item é uma regra do software:
 *
 * 1. **O preparo pela IA** (E0-PROF-02 a 05): componente, tema e "Assunto da
 *    matéria" (spec §7.2); "Gerar Notícias com IA" é UMA chamada que escreve só
 *    o TEXTO — a espera corre contra a falha (o quadro E0-PROF-03 ou o alerta).
 *    A conferência edita uma manchete e regenera uma notícia; "Homologar
 *    Pacote" grava os textos (fase 1) e as imagens se geram sozinhas, com a do
 *    TELÃO em destaque ("confira se o pátio aparece"); "Aprovar imagens" fecha
 *    a fase 2; "Liberar Atividade para a Turma" põe no ar E libera na sala. A
 *    geração NÃO tem fixture: falhou de verdade, a verificação reprova
 *    (memória "Teste sempre com IA real") e a suíte segue pelo "Carregar Banco
 *    Padrão" do próprio quadro de falha.
 * 2. **E1 — a galeria**: as três fotos abrem ampliadas com o cartaz; tocar no
 *    cartaz acende "Mesma feira" no cartão; "Avançar" com os três selos.
 * 3. **E2 — a ESCOLHA** (spec §7.1: nada visível diz "aposta"): a caixa vazia
 *    não trava ("Coloque ao menos uma notícia na caixa"); "Travar Escolha" é o
 *    latch, e a tela fica sob o vidro esperando a professora, sem botão.
 * 4. **Os portões da professora**: "Liberar Filtro", "Pausar Turma" (a criança
 *    vê a pausa) / "Retomar Turma" e "Liberar Inspeção" — o painel mostra as
 *    "Escolhas da Etapa 2" só no agregado.
 * 5. **E3 — o filtro HONESTO**: a fala longa de Nina (spec §7.3) com a
 *    instrução logo abaixo; a busca errada devolve "0 notícias encontradas" e a
 *    criança fica; Onde = Pátio traz DUAS, e a moldura do telão diz "Notícia não
 *    encontrada". "Confrontar e Aguardar Turma" leva à espera da conversa.
 * 6. **E4 — a ficha, os carimbos e o reparo**: a ficha do telão com o Onde
 *    vazio; três cartões com as TRÊS opções visíveis (spec §7.5); a ficha
 *    montada com Pátio em QUEM (errado de propósito) leva ao ERRO EXPLICADO com
 *    as três notícias — e nunca a "Tentar de novo" (spec §7.6).
 * 7. **E5 — a rotina**: a ponte, os blocos embaralhados, a rotina errada ("A
 *    rotina não para") → Reorganizar → a certa → a simulação → sucesso.
 * 8. **E6 — o caso novo e o fim**: as ferramentas, K4–K6, o "Painel da
 *    Investigação" ("Investigação concluída!") e o Desafio Extra só leitura.
 * 9. **O painel e a evidência**: as escolhas e o progresso da turma, e as
 *    cinco marcas da ficha da exp03ef1b com o nível que a régua dá.
 *
 * O gabarito nunca desce: a sessão do estudante não traz gabarito, a bandeja
 * da rotina nunca vem na ordem certa e os ids são opacos.
 *
 * ─── O estado de ontem ─────────────────────────────────────────────────────
 *
 * Cada corrida homologa um pacote NOVO (a IA escreve textos diferentes) e o põe
 * no ar: a turma recomeça nele, rodada 1, etapa da escolha. Se a corrida cair
 * no banco padrão e ele já estiver no ar, a suíte zera a turma (ADR-155).
 */
const SERIE = "3EF";
const EXP_ID = "exp03ef1b";
const FICHA = `${HUB}/professor/entre-redes/3-ano/unidade-1`;
const TITULO_DA_MISSAO = "Nina e a Notícia que Desapareceu";
/** `NINA_IA=pular` dispensa a IA (só quando o ADC está vencido, e a corrida diz isso). */
const MODO_DA_IA = (process.env.NINA_IA ?? "real").toLowerCase();

const ESTUDANTE = conta("estudante", { serie: SERIE, turma: process.env.TURMA ?? "3A" });
const TURMA = ESTUDANTE.turma;

/** Os parâmetros do preparo por IA, como a professora os digita. */
const PARAMETROS = {
  rotuloDaDisciplina: "Língua Portuguesa",
  tema: "Feira de Livros da Primavera",
  assuntos: "notícia escolar, suportes de comunicação, local do evento",
};
const MANCHETE_EDITADA = "Livros trocam de mãos";

/** A copy (`apps/experiencias/exp03ef1b/src/lib/textos.ts` e `apps/hub/lib/nina-noticia-tipos.ts`). */
const COPY = {
  ninaGaleria: "Encontre as reportagens do pátio!",
  selo: "Mesma feira",
  tocarNaFoto: "Toque na foto",
  cartazToque: "Toque no cartaz para confirmar",
  confirmar: "Confirmar Mesma Feira",
  avancar: "Avançar",
  bandeja: "Notícias da feira",
  caixa: "Caixa de resultados esperados",
  vazia: "Coloque ao menos uma notícia na caixa",
  esvaziar: "Esvaziar Caixa",
  travar: "Travar Escolha",
  travada: "Escolha travada!",
  esperaFiltro: "Espere a professora liberar o filtro.",
  ninaFiltro:
    "A Nina sabe que existem três reportagens sobre a feira de livros da escola. Você consegue ajudá-la a encontrar, no jornal, todas as reportagens que se referem ao pátio?",
  instrucaoDoFiltro: "Utilize o filtro para encontrar a(s) reportagem(ns) do local.",
  buscar: "Buscar",
  zero: "0 notícias encontradas",
  duasNoPatio: "2 notícias no pátio",
  naoEncontrada: "Notícia não encontrada",
  confrontar: "Confrontar e Aguardar Turma",
  conversar: "Momento de conversar com a turma!",
  conversarApoio: 'A professora está conduzindo o debate oral na sala: "O que o filtro olhou?".',
  pausa: "A professora pausou a turma. Espere ela retomar.",
  ninaFicha: "Uma notícia não apareceu! O que o seu filtro deixou de fora?",
  inspecionar: "Inspecionar Ficha",
  fichaTitulo: "Ficha da Reportagem",
  campoVazio: "Campo vazio",
  fichaEmBranco: "A foto mostra o pátio, mas a ficha está em branco!",
  opcoes: ["É verdade", "Não é verdade", "Não dá para saber"],
  fichaDoTelao: "Ficha do Telão",
  concluir: "Concluir",
  ninaErro: "O pátio indica o local. Coloque no campo Onde!",
  previa: "Veja como ficariam as 3 notícias completas:",
  correto: "Pátio (correto)",
  continuar: "Continuar",
  ninaPonte:
    "Você encontrou o que faltava nessa reportagem! Mas chegaram outras ao jornal. Será que alguma também deixou a ficha incompleta?",
  testar: "Testar Rotina",
  rotinaNaoPara: "A rotina não para. Revise os blocos!",
  reorganizar: "Reorganizar",
  rotinaOk: "Rotina testada com sucesso!",
  irParaCaso: "Ir para o Caso Novo",
  painel: "Painel da Investigação",
  concluida: "Investigação concluída!",
  somenteLeitura: "Modo somente-leitura. Os dados foram salvos e travados para a professora.",
  desafioExtra: "Desafio Extra",
  // a professora
  rotuloDosAssuntos: "Assunto da matéria",
  gerar: "Gerar Notícias com IA",
  destaqueDoTelao: "Confira se o pátio aparece nesta foto: é ela que a busca deixa de fora.",
  liberar: "Liberar Atividade para a Turma",
  liberarFiltro: "Liberar Filtro",
  liberarInspecao: "Liberar Inspeção",
  escolhasDaEtapa2: "Escolhas da Etapa 2",
  congeladas: "Todas as telas dos estudantes estão congeladas.",
};

/** Os blocos da rotina, na ordem certa (`vocabulario.ts#SEQUENCIA_CERTA`). */
const SEQUENCIA_CERTA = ["enquanto", "pegar", "se", "ok", "senao", "revisar", "fim"];
/** A rotina errada: o laço sem o "FIM: voltar à pilha" no fim — trocado com o Pegar. */
const SEQUENCIA_ERRADA = ["enquanto", "fim", "se", "ok", "senao", "revisar", "pegar"];

/** "aposta" é nome INTERNO: nenhuma tela o diz (spec §7.1). */
const APOSTA = /\baposta/i;

// ─────────────────────────────────────────────────────── utilitários

async function lerApi(p, caminho) {
  const resposta = await p.request.get(`${BFF}${caminho}`);
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

/** Espera a API chegar a um estado, e PERDE A CORRIDA para um erro dela. */
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

/** PORTÃO DE HIDRATAÇÃO: o nó só responde depois que o React pendurou os handlers nele. */
async function hidratado(p, locator) {
  const alvo = locator.first();
  await alvo.waitFor({ timeout: 30_000 });
  await p.waitForFunction((el) => Object.keys(el).some((k) => k.startsWith("__react")), await alvo.elementHandle(), {
    timeout: 20_000,
  });
}

/** A UNIÃO de desfechos legítimos: devolve o NOME do que apareceu primeiro. */
async function primeiroQueAparecer(desfechos, { timeout, oQue }) {
  const nomes = Object.keys(desfechos);
  try {
    return await Promise.any(
      nomes.map((nome) =>
        desfechos[nome]
          .first()
          .waitFor({ timeout })
          .then(() => nome),
      ),
    );
  } catch {
    throw new Error(`${oQue}: nenhum desfecho em ${timeout / 1000}s (${nomes.join(", ")})`);
  }
}

const texto = async (locator) => (await locator.innerText().catch(() => "")).replace(/\s+/g, " ").trim();

await suite(
  {
    slug: "estudante/17-nina-noticia",
    papel: "estudante",
    titulo: "Nina e a Notícia que Desapareceu — a ficha que esconde a notícia",
    subtitulo: "a feira em três suportes, a escolha travada, o filtro que deixa o telão de fora e a rotina que confere as fichas",
    contexto:
      "A criança do 3º ano investiga, no Unoojornal da escola, as três reportagens da feira de livros — mural, portal " +
      "e telão, as três com fotos do pátio. Ela trava uma escolha de quais notícias a busca “Onde: Pátio” vai trazer, " +
      "e a busca traz só duas: a ficha do telão tem o campo Onde vazio. Ela carimba o que a foto e a ficha dizem, " +
      "monta a ficha, organiza uma rotina que confere a pilha inteira e aplica tudo num caso novo. A professora " +
      "prepara o pacote com a IA e conduz a sala em dois portões.",
    prova: [
      "A professora prepara pela IA real: “Assunto da matéria”, a conferência (edita uma manchete, regenera uma notícia), homologa, aprova as imagens com o telão em destaque e libera para a turma",
      "E1: as três fotos abrem com o cartaz, e tocar no cartaz acende “Mesma feira”; Avançar só com os três",
      "E2: a escolha trava no servidor e espera a professora; nada visível diz “aposta”",
      "Os portões: Liberar Filtro, Pausar/Retomar (a criança vê a pausa) e Liberar Inspeção; o painel mostra as Escolhas da Etapa 2 no agregado",
      "E3: a busca errada devolve 0 notícias; Onde = Pátio traz duas, e a moldura do telão diz “Notícia não encontrada”",
      "E4: a ficha com o Onde vazio, os carimbos com as três opções visíveis, e o reparo errado leva ao erro explicado com as três notícias — sem “Tentar de novo”",
      "E5: a rotina errada não para; Reorganizar; a certa roda a simulação até o sucesso",
      "E6: as ferramentas, K4–K6, o Painel da Investigação e o Desafio Extra",
      "O gabarito não desce para a tela nem para a sessão; o painel de habilidades registra as cinco marcas com o nível da régua",
    ],
    comando: "node scripts/e2e/estudante/17-nina-noticia.mjs",
  },
  async (r) => {
    // ═══ PROFESSORA: a ficha da missão ═══════════════════════════════════
    const professora =
      contasDe("professor").find((c) => c.escola === ESTUDANTE.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login);

    const turmas = await lerApi(prof, "/nina-noticia/turmas");
    const turmaId = turmas.corpo?.turmas?.find((t) => t.nome === TURMA)?.id ?? null;
    if (!r.exigir(Boolean(turmaId), `${professora.login} vê a ${TURMA} no seletor da Nina (HTTP ${turmas.status})`)) return;
    const caminhoDaTurma = `/nina-noticia/turmas/${turmaId}`;
    const pacotesAntes = await lerApi(prof, `${caminhoDaTurma}/pacotes`);
    if (pacotesAntes.status !== 200) {
      throw new Error(`a api não listou as atividades da ${TURMA} (HTTP ${pacotesAntes.status}): ${JSON.stringify(pacotesAntes.corpo).slice(0, 200)}`);
    }
    const noArAntes = pacotesAntes.corpo?.ativo ?? null;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: new RegExp(TITULO_DA_MISSAO) }).first().waitFor({ timeout: 60_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 3º ano, unidade 1",
      mostra: "A missão explicada para quem conduz: as três reportagens da feira, a ficha do telão com o Onde vazio e os três momentos da condução.",
      prova: "A professora sabe ANTES da aula onde está a virada e que a escolha travada não volta.",
    });

    // ═══ PROFESSORA: o preparo (E0-PROF-02) ══════════════════════════════
    const abrirNovaAtividade = async () => {
      await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
      await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
      const preparo = prof.locator('[data-passo-conteudo] [data-preparo-nina][data-fase="textos"]');
      await preparo.waitFor({ timeout: 30_000 });
      return preparo;
    };
    const preparo = await abrirNovaAtividade();
    r.exigir(
      (await preparo.locator('[data-caminho-curto] [data-acao="usar-banco-padrao"]').count()) === 1,
      "o caminho curto “Usar Banco Padrão” fica no topo do preparo, antes de qualquer campo",
    );
    const textoDoPreparo = await texto(preparo);
    r.exigir(
      textoDoPreparo.includes(COPY.rotuloDosAssuntos) && !/Tópicos Abordados|Palavras-chave de contexto/.test(textoDoPreparo),
      "o campo de tópicos se chama “Assunto da matéria” (spec §7.2)",
    );

    let usouIa = false;
    /**
     * Aplica o banco padrão pelo botão dado, passa pela grade das imagens
     * (ADR-199: as do banco chegam prontas, as que faltam se geram ali) e
     * espera a fase pronta. O reaproveitado completo e aprovado já abre pronto.
     */
    const aplicarBancoPadrao = async (botao) => {
      await hidratado(prof, botao);
      await botao.click();
      const fase = prof.locator('[data-preparo-nina][data-fase="banco-padrao"]');
      await esperarOuFalharCedo(fase.locator("[data-imagens-da-nina]"), prof.locator(`[data-preparo-nina] ${ALERTA_DE_ERRO}`), {
        timeout: 30_000,
        oQue: "usar o banco padrão",
      });
      const aprovar = fase.locator('[data-acao="aprovar-imagens"]');
      if ((await fase.locator('[data-imagens-da-nina][data-imagens-aprovadas="sim"]').count()) === 0) {
        const inicio = Date.now();
        await esperarOuFalharCedo(fase.locator('[data-acao="aprovar-imagens"]:not([disabled])'), fase.locator(ALERTA_DE_ERRO), {
          timeout: 300_000,
          oQue: "gerar as imagens que faltam no banco padrão",
        });
        const comImagem = await fase.locator("[data-imagem] img").count();
        await r.registrar(prof, "banco-padrao-imagens", {
          titulo: "O banco padrão também passa pelas imagens",
          mostra: `A mesma grade da IA, com as quatro imagens da feira (${comImagem} com imagem), o telão em destaque e “Refazer imagem”.`,
          prova:
            "As que o banco já tem chegam prontas; as que faltam se geram ali (de graça se o arquivo já existe). Nada chega à turma sem o OK da professora.",
          detalhe: `${comImagem} de 4 com imagem em ${Math.round((Date.now() - inicio) / 1000)}s`,
        });
        await aprovar.click();
      }
      await esperarOuFalharCedo(fase.locator("[data-pacote-pronto]"), prof.locator(`[data-preparo-nina] ${ALERTA_DE_ERRO}`), {
        timeout: 30_000,
        oQue: "aprovar as imagens do banco padrão",
      });
      await r.registrar(prof, "banco-padrao", {
        titulo: "O banco padrão, com as imagens aprovadas",
        mostra: "“Pacote homologado e pronto.”: a Feira de Troca de Livros com as três notícias, sem IA nos textos, e as imagens aprovadas.",
        prova: "O caminho curto e o fallback da IA: a atividade fica gravada, fora do ar, com as imagens que a professora aprovou.",
      });
    };

    if (MODO_DA_IA === "pular") {
      r.ressalva("NINA_IA=pular: a geração por IA não foi exercida nesta corrida");
      await aplicarBancoPadrao(preparo.locator('[data-acao="usar-banco-padrao"]'));
    } else {
      const disciplina = prof.getByRole("combobox", { name: /^Componente Curricular/i });
      await hidratado(prof, disciplina);
      await disciplina.click();
      const opcao = prof.getByRole("listbox").getByRole("option", { name: new RegExp(PARAMETROS.rotuloDaDisciplina) }).first();
      await opcao.waitFor({ timeout: 10_000 }).catch(() => {
        throw new Error("o seletor de componente curricular não abriu: a página ainda não estava hidratada");
      });
      await opcao.click();
      const tema = preparo.getByRole("textbox", { name: /^Tema do Evento/i });
      await tema.click();
      await tema.pressSequentially(PARAMETROS.tema);
      const assuntos = preparo.getByRole("textbox", { name: new RegExp(`^${COPY.rotuloDosAssuntos}`, "i") });
      await assuntos.click();
      await assuntos.pressSequentially(PARAMETROS.assuntos);
      await prof.locator('[data-acao="gerar-noticias"]:not([disabled])').waitFor({ timeout: 10_000 });
      await r.registrar(prof, "preparo-parametros", {
        titulo: "Dois caminhos: o banco padrão ou a IA",
        mostra:
          "No topo, “Caminho Curto: Pacote Curado Padrão” com “Usar Banco Padrão”; abaixo, o Componente Curricular, o " +
          "Tema do Evento e o “Assunto da matéria”, e “Gerar Notícias com IA”.",
        prova: "O caminho curto não usa IA; o personalizado escreve as notícias sobre a aula, e nada gerado chega à turma sem a aprovação dela.",
      });

      const conferencia = prof.locator("[data-conferencia-do-pacote]");
      const falhaDaIa = prof.locator(`[data-preparo-nina] [data-falha-da-ia], [data-preparo-nina] ${ALERTA_DE_ERRO}`);
      const inicioDaIa = Date.now();
      await prof.locator('[data-acao="gerar-noticias"]').click();
      /* O estado novo PRIMEIRO (o alerta de uma tentativa antiga não pode
         abortar esta), depois a união dos desfechos com o teto acima do BFF. */
      await prof.locator("[data-gerando-noticias]").waitFor({ timeout: 10_000 }).catch(() => undefined);
      const desfecho = await primeiroQueAparecer({ conferencia, falha: falhaDaIa }, { timeout: 200_000, oQue: "a geração das notícias com IA" });
      const segundosDaIa = Math.round((Date.now() - inicioDaIa) / 1000);
      if (desfecho === "falha") {
        const recado = await texto(falhaDaIa.first());
        await r.registrar(prof, "preparo-ia-falhou", {
          titulo: "Quando a IA não responde",
          mostra: `O quadro de falha na voz da plataforma: “${recado.slice(0, 160)}”, e “Carregar Banco Padrão”.`,
          prova: "Sem saldo ou com a IA fora, a aula não para: o banco padrão entra no lugar.",
        });
        r.exigir(false, `a IA REAL gerou as notícias (a tela respondeu em ${segundosDaIa}s: “${recado.slice(0, 200)}”)`);
        const contingencia = prof.locator('[data-acao="carregar-banco-padrao"]');
        if ((await contingencia.count()) > 0) await aplicarBancoPadrao(contingencia);
        else await aplicarBancoPadrao(preparo.locator('[data-acao="usar-banco-padrao"]'));
      } else {
        usouIa = true;
        const cartoes = conferencia.locator("[data-reportagem]");
        r.exigir((await cartoes.count()) === 3, `a IA real escreveu as três notícias em ${segundosDaIa}s`);
        const fichaDoTelao = await texto(conferencia.locator('[data-reportagem="telao"]'));
        r.exigir(/Onde vazio, de propósito/.test(fichaDoTelao), "a ficha do telão chega com o Onde vazio — a estrutura é do servidor, não da IA");
        r.exigir(
          (await conferencia.locator('[data-reportagem="telao"]').evaluate((el) => getComputedStyle(el).borderStyle)) === "dashed",
          "o cartão do telão tem a moldura tracejada de destaque",
        );
        await conferencia.scrollIntoViewIfNeeded();
        await r.registrar(prof, "conferencia-da-ia", {
          titulo: "A conferência do pacote escrito pela IA",
          mostra:
            "“Conferência do Pacote de Notícias”: as três reportagens (mural, portal e telão) com manchete, legenda, a " +
            "ficha e a cena da foto; o telão tracejado, com “Ficha: Onde vazio, de propósito”.",
          prova: "A IA escreveu só os TEXTOS; os suportes, as fichas e o lugar são do servidor, e o rascunho não persiste até homologar.",
          detalhe: `${segundosDaIa}s de geração`,
        });

        // Editar uma manchete
        const mural = conferencia.locator('[data-reportagem="mural"]');
        await mural.locator('[data-acao="editar-manchete"]').click();
        const campoDaManchete = mural.getByRole("textbox", { name: /^Manchete/ });
        await campoDaManchete.fill("");
        await campoDaManchete.pressSequentially(MANCHETE_EDITADA);
        await r.registrar(prof, "editar-manchete", {
          titulo: "Editar Manchete",
          mostra: `A manchete do mural vira um campo; a professora escreve “${MANCHETE_EDITADA}” (até quatro palavras).`,
          prova: "A professora tem a última palavra no texto que a turma lê.",
        });
        await mural.locator('[data-acao="editar-manchete"]').click();
        r.exigir((await texto(mural)).includes(MANCHETE_EDITADA), "a manchete editada fica no cartão do mural");

        // Regenerar uma notícia (a do portal)
        const portal = conferencia.locator('[data-reportagem="portal"]');
        const mancheteAntes = await texto(portal.locator("p").first());
        const inicioDaRegeneracao = Date.now();
        await portal.locator('[data-acao="regenerar-noticia"]').click();
        const recadoDaRegeneracao = prof.locator("[data-preparo-nina] .unooria-feedback-alert--success, [data-preparo-nina] .unooria-feedback-alert--warning");
        const comoRegenerou = await primeiroQueAparecer(
          { recado: recadoDaRegeneracao, erro: prof.locator(`[data-preparo-nina] ${ALERTA_DE_ERRO}`) },
          { timeout: 150_000, oQue: "regenerar a notícia do portal" },
        );
        const textoDoRecado = await texto((comoRegenerou === "recado" ? recadoDaRegeneracao : prof.locator(`[data-preparo-nina] ${ALERTA_DE_ERRO}`)).first());
        r.exigir(
          /regenerada/.test(textoDoRecado),
          `“Regenerar Notícia” trouxe outra notícia do portal em ${Math.round((Date.now() - inicioDaRegeneracao) / 1000)}s (“${textoDoRecado.slice(0, 120)}”; antes: “${mancheteAntes}”)`,
        );
        r.exigir((await texto(mural)).includes(MANCHETE_EDITADA), "regenerar o portal não desfaz a edição do mural");
        await r.registrar(prof, "regenerar-noticia", {
          titulo: "Regenerar Notícia",
          mostra: `O recado “${textoDoRecado.slice(0, 100)}” e o cartão do portal com a notícia nova.`,
          prova: "Uma notícia por vez, sem tocar nas outras: a edição do mural continua lá.",
        });

        // Homologar (fase 1) → imagens (fase 2)
        const homologar = conferencia.locator('[data-acao="homologar-pacote"]:not([disabled])');
        await homologar.waitFor({ timeout: 10_000 });
        await homologar.click();
        const faseDasImagens = prof.locator('[data-preparo-nina][data-fase="imagens"]');
        await esperarOuFalharCedo(faseDasImagens, prof.locator(`[data-preparo-nina] ${ALERTA_DE_ERRO}`), {
          timeout: 30_000,
          oQue: "homologar o pacote",
        });
        const grade = faseDasImagens.locator("[data-imagens-da-nina]");
        const inicioDasImagens = Date.now();
        /* As imagens se geram sozinhas ao abrir: o desfecho é o botão de aprovar
           LIVRE (a geração terminou), correndo contra o aviso de falha. */
        await esperarOuFalharCedo(
          faseDasImagens.locator('[data-acao="aprovar-imagens"]:not([disabled])'),
          faseDasImagens.locator(".unooria-feedback-alert--warning, " + ALERTA_DE_ERRO),
          { timeout: 300_000, oQue: "gerar as imagens do pacote" },
        );
        const comImagem = await grade.locator("[data-imagem] img").count();
        const segundosDasImagens = Math.round((Date.now() - inicioDasImagens) / 1000);
        r.exigir(comImagem === 4, `a IA real gerou as quatro imagens do pacote (mural, portal, telão e cartaz): ${comImagem} de 4 em ${segundosDasImagens}s`);
        const telao = grade.locator('[data-imagem="telao"]');
        r.exigir(
          (await telao.getAttribute("data-destaque")) === "sim" && (await texto(telao)).includes(COPY.destaqueDoTelao),
          "a imagem do telão vem em destaque: “Confira se o pátio aparece nesta foto”",
        );
        await telao.scrollIntoViewIfNeeded();
        await r.registrar(prof, "imagens-com-o-telao", {
          titulo: "As imagens, com o telão em destaque",
          mostra:
            "Fase 2 de 2: as quatro imagens (mural, portal, telão e cartaz), cada uma com o que deve mostrar e “Refazer " +
            "imagem”; o telão tracejado, com “Confira se o pátio aparece nesta foto”.",
          prova: "K1 (“A foto mostra o pátio?”) é ✔: a professora confere a cena antes de a turma ver. Nenhuma imagem aparece sem o OK dela.",
          detalhe: `${comImagem} imagens em ${segundosDasImagens}s`,
        });
        await faseDasImagens.locator('[data-acao="aprovar-imagens"]').click();
        await esperarOuFalharCedo(
          faseDasImagens.locator('[data-imagens-da-nina][data-imagens-aprovadas="sim"]'),
          faseDasImagens.locator(".unooria-feedback-alert--warning, " + ALERTA_DE_ERRO),
          { timeout: 30_000, oQue: "aprovar as imagens" },
        );
        await faseDasImagens.locator("[data-pacote-pronto]").waitFor({ timeout: 10_000 });
        await faseDasImagens.locator("[data-pacote-pronto]").scrollIntoViewIfNeeded();
        await r.registrar(prof, "pacote-pronto", {
          titulo: "Pacote homologado e pronto",
          mostra: "As imagens aprovadas e “Pacote homologado e pronto. Os textos e as imagens estão aprovados.”",
          prova: "As duas fases fecharam (ADR-146): só agora o assistente deixa seguir.",
        });
      }
    }

    // ═══ PROFESSORA: equipes, revisão e "Liberar Atividade para a Turma" ═
    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').waitFor({ timeout: 10_000 });
    await prof.locator('[data-acao="continuar-criacao"]').click();
    const umPorComputador = prof.getByRole("radio", { name: "Um aluno por computador", exact: true });
    await umPorComputador.click();
    r.exigir(await umPorComputador.isChecked(), "o passo de equipes marca “Um aluno por computador”");
    await prof.locator('[data-acao="continuar-criacao"]').click();
    const revisao = prof.locator("[data-revisao-da-criacao]");
    await revisao.waitFor({ timeout: 10_000 });
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    r.exigir(await noAr.isChecked(), "“Pôr esta atividade no ar agora” fica ligado");
    const criar = prof.locator('[data-acao="criar-atividade"]');
    r.exigir((await texto(criar)) === COPY.liberar, `o botão final diz “${COPY.liberar}” (veio “${await texto(criar)}”)`);
    await r.registrar(prof, "revisar-e-liberar", {
      titulo: "Revisar e liberar",
      mostra: "A revisão da criação (turma, conteúdo, equipes), “Pôr esta atividade no ar agora” ligado e “Liberar Atividade para a Turma”.",
      prova: "Um botão só põe a atividade no ar E libera a missão na sala (E0-PROF-05).",
    });
    await criar.click();
    await esperarOuFalharCedo(
      prof.locator('[data-estado-da-atividade="em-andamento"]'),
      revisao.locator(`${ALERTA_DE_ERRO}, .unooria-feedback-alert--warning`),
      { timeout: 60_000, oQue: "liberar a atividade para a turma" },
    );
    await prof.waitForURL("**/resultados?**pacote=**", { timeout: 30_000 });
    const atividadeId = new URL(prof.url()).searchParams.get("pacote");
    if (!r.exigir(Boolean(atividadeId), `a página da atividade leva o id dela na URL (${prof.url()})`)) return;
    const pacotesDepois = (await lerApi(prof, `${caminhoDaTurma}/pacotes`)).corpo;
    r.exigir(pacotesDepois?.ativo?.id === atividadeId, "a atividade criada é a EM ANDAMENTO da turma");
    r.exigir(
      pacotesDepois?.ativo?.origem === (usouIa ? "ia" : "padrao"),
      `a origem gravada é “${usouIa ? "ia" : "padrao"}” (veio ${pacotesDepois?.ativo?.origem})`,
    );
    if (noArAntes?.id === atividadeId) {
      /* O banco padrão é idempotente por turma: se ele já estava no ar, a turma é zerada. */
      const zerar = prof.locator("[data-zerar-turma]");
      await revelar(prof, zerar);
      await hidratado(prof, zerar);
      await zerar.click();
      await prof.locator('[data-acao="confirmar-zerar"]').click();
      await esperarNaApi(prof, `${caminhoDaTurma}/painel`, (c) => c?.rodada === noArAntes.rodada + 1, { oQue: "zerar a turma" });
      await prof.reload({ waitUntil: "domcontentloaded" });
      r.ressalva(`o pacote já estava no ar (corrida anterior): a turma foi zerada para a ${noArAntes.rodada + 1}ª rodada`);
    }
    const painelDaAula = prof.locator("[data-painel-da-aula]");
    await painelDaAula.waitFor({ timeout: 30_000 });
    r.exigir((await painelDaAula.getAttribute("data-etapa")) === "aposta", "a turma começa na etapa da escolha");
    const botaoDoFiltro = prof.locator('[data-gate="filtro"]');
    r.exigir((await texto(botaoDoFiltro)).endsWith(COPY.liberarFiltro), `o próximo portão é “${COPY.liberarFiltro}”`);
    r.exigir(!APOSTA.test(await texto(prof.locator("main"))), "a página da atividade não diz “aposta” em lugar nenhum");
    await r.registrar(prof, "painel-da-aula", {
      titulo: "O Painel da Sala em Tempo Real",
      mostra:
        "A atividade em andamento: “Painel da Sala em Tempo Real”, Pausar Turma e Liberar Filtro, as equipes por etapa, " +
        "“Escolhas da Etapa 2”, os alertas, o roteiro de mediação e a folha da turma.",
      prova: "A turma inteira avança junto e o portão não volta; a linha da folha diz só onde cada um está — nunca acerto.",
      inteira: true,
    });

    // ═══ ESTUDANTE: entra na missão ═════════════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 900 } });
    await r.entrar(p, ESTUDANTE.login);
    if (!new URL(p.url()).pathname.startsWith("/estudante")) await p.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });
    const cartao = p.locator("main a", { hasText: TITULO_DA_MISSAO }).first();
    await cartao.waitFor({ timeout: 30_000 }).catch(() => {
      throw new Error(`o cartão “${TITULO_DA_MISSAO}” não está ABERTO na grade da ${TURMA}`);
    });
    await hidratado(p, cartao);
    await cartao.click();
    await p.waitForURL(`**/exp/${EXP_ID}**`, { timeout: 30_000 });
    const q = () => p.frameLocator("iframe[data-experiencia]");
    const corpo = () => q().locator("body");
    const semAposta = async (onde) => r.exigir(!APOSTA.test(await texto(corpo())), `${onde}: nenhum texto visível diz “aposta”`);
    const sessaoDoEstudante = async () => {
      const s = await lerApi(p, "/nina-noticia/sessao");
      if (s.status !== 200) throw new Error(`a sessão da missão não abriu (HTTP ${s.status}): ${JSON.stringify(s.corpo).slice(0, 200)}`);
      return s.corpo;
    };

    // ── E1: a galeria ────────────────────────────────────────────────────
    await esperarOuFalharPorHttp(p, q().getByText(COPY.ninaGaleria), /\/nina-noticia\//, { timeout: 60_000, oQue: "abrir a missão" });
    const reportagens = q().locator(".reportagem");
    await reportagens.nth(2).waitFor({ timeout: 20_000 });
    const avancarDaGaleria = q().getByRole("button", { name: COPY.avancar, exact: true });
    r.exigir(await avancarDaGaleria.isDisabled(), "Avançar começa desligado: faltam os três selos");
    await r.registrar(p, "e1-galeria", {
      titulo: "E1 — as três reportagens da feira",
      mostra: "Nina pede “Encontre as reportagens do pátio!”; o mural, o portal e o telão, cada um com a manchete, “Pátio escolar” e “Toque na foto”.",
      prova: "As três reportagens são da mesma feira e as três fotos são do pátio — o que muda é a ficha, que a criança ainda não vê.",
    });
    const sessao1 = await sessaoDoEstudante();
    const jsonDaSessao = JSON.stringify(sessao1);
    r.exigir(
      !/gabarito|correta|corretos|certa"|SEQUENCIA/i.test(jsonDaSessao) && !/"onde":\s*null/.test(jsonDaSessao),
      "a sessão do estudante não traz gabarito nem a ficha do telão antes da hora",
    );
    r.exigir(
      sessao1.jornal.reportagens.every((x) => /^rp-/.test(x.id)),
      "as reportagens chegam com ids OPACOS (rp-…), que não dizem o suporte",
    );

    for (let i = 0; i < 3; i += 1) {
      const cartaoDaReportagem = reportagens.nth(i);
      await cartaoDaReportagem.locator(".ujn-article-card__link").click();
      const janela = q().getByRole("dialog");
      await janela.waitFor({ timeout: 10_000 });
      const cartaz = janela.getByRole("button", { name: new RegExp(COPY.cartazToque) }).or(janela.getByRole("img", { name: new RegExp(COPY.cartazToque) })).first();
      await cartaz.waitFor({ timeout: 10_000 });
      if (i === 0) {
        await r.registrar(p, "e1-foto-ampliada", {
          titulo: "A foto ampliada, com o cartaz",
          mostra: "A foto da reportagem em tamanho grande e, ao lado, o cartaz da feira para tocar; “Confirmar Mesma Feira”.",
          prova: "O cartaz comum é a pista de que as três coberturas são do mesmo evento.",
        });
      }
      await cartaz.click();
      await janela.waitFor({ state: "hidden", timeout: 10_000 });
      await esperarOuFalharPorHttp(p, cartaoDaReportagem.getByText(COPY.selo), /\/nina-noticia\/selos/, { timeout: 15_000, oQue: `o selo da reportagem ${i + 1}` });
    }
    r.exigir((await q().getByText(COPY.selo, { exact: true }).count()) === 3, "os três cartões ganham o selo “Mesma feira”");
    await q().getByRole("button", { name: COPY.avancar, exact: true }).and(q().locator(":not([disabled])")).waitFor({ timeout: 10_000 });
    await r.registrar(p, "e1-tres-selos", {
      titulo: "Três selos “Mesma feira”",
      mostra: "Os três cartões com o selo “Mesma feira” e a moldura forte; Avançar acende.",
      prova: "O servidor guarda os selos: só com os três o passo vai à escolha.",
    });
    await semAposta("E1");
    await q().getByRole("button", { name: COPY.avancar, exact: true }).click();

    // ── E2: a escolha ────────────────────────────────────────────────────
    const travar = q().getByRole("button", { name: COPY.travar });
    await travar.waitFor({ timeout: 20_000 });
    r.exigir(await travar.isDisabled(), "Travar Escolha começa desligado, com a caixa vazia");
    r.exigir((await q().getByText(COPY.vazia).count()) > 0, `a caixa vazia diz “${COPY.vazia}”`);
    const bandeja = q().locator(".bandeja");
    const kickers = sessao1.jornal.reportagens.map((x) => x.kicker);
    for (const k of kickers) await bandeja.getByRole("button", { name: k }).first().click();
    await q().getByRole("button", { name: COPY.esvaziar }).click();
    r.exigir(await travar.isDisabled(), "“Esvaziar Caixa” devolve as três e Travar volta a desligar");
    for (const k of kickers) await bandeja.getByRole("button", { name: k }).first().click();
    r.exigir(!(await travar.isDisabled()), "com as três notícias na caixa, Travar Escolha acende");
    await r.registrar(p, "e2-escolha", {
      titulo: "E2 — a escolha, antes de travar",
      mostra: "A bandeja “Notícias da feira” vazia e a “Caixa de resultados esperados” (Pátio) com as três notícias; “Travar Escolha”.",
      prova: "A criança escolhe quais notícias a busca pelo pátio vai trazer — a maioria põe as três, porque as três fotos são do pátio.",
    });
    await semAposta("E2");
    await travar.click();
    await esperarOuFalharPorHttp(p, q().getByText(COPY.travada), /\/nina-noticia\/previsao/, { timeout: 15_000, oQue: "travar a escolha" });
    r.exigir((await q().getByText(COPY.esperaFiltro).count()) > 0, "sob o vidro: “Espere a professora liberar o filtro.”");
    r.exigir((await q().locator(".escolha__caixa").getByRole("button", { name: COPY.travar }).count()) === 0, "travada, a escolha não tem botão: nada leva de volta");
    await r.registrar(p, "e2-travada", {
      titulo: "Escolha travada!",
      mostra: "O vidro sobre a caixa: “Escolha travada!”, quantas notícias e “Espere a professora liberar o filtro.” — sem botão.",
      prova: "O latch é do servidor (`POST previsao`): a escolha não muda depois, e é ela que dá força à virada.",
    });
    await semAposta("E2 travada");

    // ═══ PROFESSORA: as escolhas e "Liberar Filtro" ═════════════════════
    const painelComEscolha = await esperarNaApi(prof, `${caminhoDaTurma}/painel`, (c) => (c?.resumo?.escolhas?.travadas ?? 0) >= 1, {
      oQue: "a escolha travada no painel",
    });
    r.exigir(painelComEscolha.resumo.escolhas.tres >= 1, `o painel conta quem escolheu as três notícias (${JSON.stringify(painelComEscolha.resumo.escolhas)})`);
    const linhaDaCrianca = painelComEscolha.linhas.find((l) => l.usuario === ESTUDANTE.login);
    r.exigir(
      linhaDaCrianca && !Object.keys(linhaDaCrianca).some((k) => /escolh|previs|acert|nivel|certo/i.test(k)),
      `a linha da criança diz só progresso e alerta (chaves: ${Object.keys(linhaDaCrianca ?? {}).join(", ")})`,
    );
    const cartaoDasEscolhas = prof.locator("main").getByText(COPY.escolhasDaEtapa2).first();
    await cartaoDasEscolhas.waitFor({ timeout: 15_000 });
    await prof.locator('[data-equipes-por-etapa]').getByText(/^\s*1\s*\/\s*\d+/).first().waitFor({ timeout: 15_000 }).catch(() => undefined);
    await cartaoDasEscolhas.scrollIntoViewIfNeeded();
    await r.registrar(prof, "painel-escolhas", {
      titulo: "As Escolhas da Etapa 2, no agregado",
      mostra: "O card “Escolhas da Etapa 2” com quantos escolheram três, duas ou uma notícia — sem nome —, e quem está em cada etapa.",
      prova: "A escolha não vai para a linha da criança: o painel pode ir para o projetor.",
    });
    await hidratado(prof, botaoDoFiltro);
    await botaoDoFiltro.click();
    await esperarOuFalharCedo(prof.locator('[data-painel-da-aula][data-etapa="filtro"]'), prof.locator(`[data-painel-da-aula] ${ALERTA_DE_ERRO}`), {
      timeout: 20_000,
      oQue: "Liberar Filtro",
    });
    r.exigir((await texto(prof.locator('[data-gate="inspecao"]'))).endsWith(COPY.liberarInspecao), `o próximo portão vira “${COPY.liberarInspecao}”`);

    // ── E3: o filtro ─────────────────────────────────────────────────────
    const falaDoFiltro = q().locator(".fala-da-nina");
    await q().getByText(COPY.ninaFiltro).waitFor({ timeout: 20_000 });
    r.exigir(
      (await texto(falaDoFiltro.locator(".fala-da-nina__fala"))) === COPY.ninaFiltro &&
        (await texto(falaDoFiltro.locator(".fala-da-nina__apoio"))) === COPY.instrucaoDoFiltro,
      "a fala de Nina é a do ajuste do PO, e a instrução do filtro vem logo abaixo (spec §7.3)",
    );
    const pastilhas = q().getByRole("group", { name: "Campos da busca" }).last();
    r.exigir(
      (await pastilhas.locator('[aria-pressed="true"], [aria-selected="true"], [data-selected="true"]').count()) === 0,
      "nenhuma pastilha nasce escolhida: acertar o campo de primeira é da criança",
    );
    await r.registrar(p, "e3-filtro", {
      titulo: "E3 — o filtro do jornal",
      mostra:
        "Nina: “A Nina sabe que existem três reportagens sobre a feira de livros da escola…”, e logo abaixo “Utilize o " +
        "filtro para encontrar a(s) reportagem(ns) do local.”; as pastilhas Quem, Onde e Quando, e Buscar.",
      prova: "A professora liberou o filtro: a tela veio pelo polling do portão, sem recarregar.",
    });
    const buscarNo = async (campo, valor) => {
      /* Depois de uma busca com 0, a pastilha Onde PULSA sem parar (spec decisão 8): o
         Playwright nunca a acha "estável", mas a criança toca nela normalmente. */
      await pastilhas.getByRole("button", { name: campo }).click({ force: true });
      await q().getByRole("group", { name: `Valores para ${campo}:` }).getByRole("button", { name: valor, exact: true }).click();
      await q().getByRole("button", { name: COPY.buscar }).click();
    };
    await buscarNo("Quem", "professores");
    await esperarOuFalharPorHttp(p, q().getByText(COPY.zero), /\/nina-noticia\/filtro/, { timeout: 15_000, oQue: "a busca errada" });
    r.exigir((await q().getByText(COPY.ninaFiltro).count()) > 0, "a busca errada deixa a criança no filtro, para tentar de novo");
    await r.registrar(p, "e3-busca-errada", {
      titulo: "A busca errada: 0 notícias",
      mostra: "Quem = professores devolve “0 notícias encontradas” e “Nenhuma reportagem tem esse valor na ficha. Tente outro campo.”; a pastilha Onde pulsa.",
      prova: "O filtro é honesto: a busca olha a ficha, e nenhuma ficha tem esse valor. A tentativa conta para a EF15CO08.",
    });
    await buscarNo("Onde", "Pátio");
    await esperarOuFalharPorHttp(p, q().getByText(COPY.duasNoPatio), /\/nina-noticia\/(filtro|sessao)/, { timeout: 15_000, oQue: "a busca Onde = Pátio" });
    const encontradas = q().locator(".omissao__encontradas .reportagem");
    r.exigir((await encontradas.count()) === 2, `Onde = Pátio traz DUAS reportagens (${await encontradas.count()})`);
    const molduraAusente = q().locator(".moldura--ausente");
    r.exigir(
      (await molduraAusente.count()) === 1 && (await texto(molduraAusente)).includes("Telão") && (await texto(molduraAusente)).includes(COPY.naoEncontrada),
      "na Meta de Nina, a moldura do telão diz “Notícia não encontrada”",
    );
    await r.registrar(p, "e3-omissao", {
      titulo: "A omissão: duas de três",
      mostra: "“Sua escolha travada” (três notícias) ao lado de “Notícias encontradas” com “2 notícias no pátio”; na Meta de Nina, o telão tracejado: “Notícia não encontrada”.",
      prova: "A escolha travada contra o resultado: a criança esperava três e o jornal trouxe duas.",
    });
    await semAposta("E3");
    await q().getByRole("button", { name: COPY.confrontar }).click();
    await q().getByText(COPY.conversarApoio).waitFor({ timeout: 15_000 });
    r.exigir(
      (await q().locator(".espera").getByRole("button").count()) === 0,
      "a espera da conversa não tem botão: só a professora libera a inspeção",
    );
    await r.registrar(p, "e3-espera", {
      titulo: "Momento de conversar com a turma!",
      mostra: "O véu sobre a omissão e Nina: “Momento de conversar com a turma!” — “A professora está conduzindo o debate oral na sala: “O que o filtro olhou?”.”",
      prova: "A criança não vê a ficha antes de a turma conversar: o passo efetivo fica na omissão até o portão.",
    });
    const sessaoNaEspera = await sessaoDoEstudante();
    r.exigir(sessaoNaEspera.ficha === null, "na espera, a sessão ainda não traz a ficha do telão");

    // ═══ PROFESSORA: Pausar → a criança vê → Retomar → Liberar Inspeção ══
    await prof.locator('[data-acao="pausar-turma"]').click();
    await esperarOuFalharCedo(prof.locator("[data-quadro-da-pausa]"), prof.locator(`[data-painel-da-aula] ${ALERTA_DE_ERRO}`), {
      timeout: 20_000,
      oQue: "Pausar Turma",
    });
    r.exigir((await texto(prof.locator("[data-quadro-da-pausa]"))).includes(COPY.congeladas), `a professora vê “${COPY.congeladas}”`);
    await r.registrar(prof, "painel-pausado", {
      titulo: "Sala pausada",
      mostra: "“Sala pausada”, “Todas as telas dos estudantes estão congeladas.” e “Retomar Turma”; o botão do portão some enquanto a sala está parada.",
      prova: "A pausa congela todas as telas para o debate oral, e o portão não avança durante ela.",
    });
    await q().getByText(COPY.pausa).waitFor({ timeout: 15_000 });
    await r.registrar(p, "estudante-pausado", {
      titulo: "A tela congelada",
      mostra: "Por cima da tela, Nina: “Momento de conversar com a turma!” e “A professora pausou a turma. Espere ela retomar.”",
      prova: "A criança vê a pausa em até 3 s (o polling do portão), e a tela por baixo fica inerte.",
    });
    await prof.locator('[data-acao="retomar-turma"]').click();
    await esperarOuFalharCedo(prof.locator('[data-painel-da-aula][data-pausada="nao"]'), prof.locator(`[data-painel-da-aula] ${ALERTA_DE_ERRO}`), {
      timeout: 20_000,
      oQue: "Retomar Turma",
    });
    await q().getByText(COPY.pausa).waitFor({ state: "hidden", timeout: 15_000 });
    r.exigir(true, "Retomar Turma tira a pausa da tela da criança");
    const botaoDaInspecao = prof.locator('[data-gate="inspecao"]');
    await hidratado(prof, botaoDaInspecao);
    await botaoDaInspecao.click();
    await esperarOuFalharCedo(prof.locator('[data-painel-da-aula][data-etapa="inspecao"]'), prof.locator(`[data-painel-da-aula] ${ALERTA_DE_ERRO}`), {
      timeout: 20_000,
      oQue: "Liberar Inspeção",
    });
    r.exigir((await prof.locator("[data-gate]").count()) === 0, "depois de Liberar Inspeção, não há mais portão: ele não volta");

    // ── E4: a ficha ──────────────────────────────────────────────────────
    const inspecionar = q().getByRole("button", { name: COPY.inspecionar });
    await inspecionar.waitFor({ timeout: 20_000 });
    r.exigir((await q().getByText(COPY.ninaFicha).count()) > 0, `Nina: “${COPY.ninaFicha}”`);
    await r.registrar(p, "e4-ficha-fechada", {
      titulo: "E4 — a reportagem do telão",
      mostra: "A foto grande do telão (o pátio à vista), a manchete e “Inspecionar Ficha”.",
      prova: "A professora liberou a inspeção: agora a criança abre a ficha da notícia que sumiu.",
    });
    await inspecionar.click();
    const gaveta = q().getByRole("complementary", { name: COPY.fichaTitulo });
    await esperarOuFalharPorHttp(p, gaveta, /\/nina-noticia\/ficha/, { timeout: 15_000, oQue: "abrir a ficha" });
    const textoDaGaveta = await texto(gaveta);
    r.exigir(textoDaGaveta.includes(COPY.campoVazio) && textoDaGaveta.includes(COPY.fichaEmBranco), "a ficha do telão mostra o campo Onde vazio, e “A foto mostra o pátio, mas a ficha está em branco!”");
    r.exigir(/estudantes/i.test(textoDaGaveta) && /sexta/i.test(textoDaGaveta), "Quem e Quando vêm preenchidos (estudantes, sexta)");
    await r.registrar(p, "e4-ficha-aberta", {
      titulo: "A ficha do telão: Onde vazio",
      mostra: "A gaveta “Ficha da Reportagem” (TELÃO): Quem estudantes, Onde “Campo vazio” tracejado, Quando sexta.",
      prova: "A causa da omissão: o filtro olha o CAMPO, e não a imagem.",
    });
    await gaveta.getByRole("button", { name: COPY.avancar }).click();

    // ── E4: os carimbos K1–K3 ───────────────────────────────────────────
    const cartoesK = q().locator(".cartao-carimbo");
    await cartoesK.nth(2).waitFor({ timeout: 15_000 });
    const opcoesPorCartao = await cartoesK.evaluateAll((els) =>
      els.map((el) => [...el.querySelectorAll(".cartao-carimbo__opcoes button")].map((b) => b.textContent.replace(/\s+/g, " ").trim())),
    );
    r.exigir(
      opcoesPorCartao.length === 3 && opcoesPorCartao.every((o) => o.length === 3 && COPY.opcoes.every((t) => o.some((x) => x.endsWith(t)))),
      `cada cartão traz as TRÊS opções visíveis — É verdade, Não é verdade, Não dá para saber (spec §7.5): ${JSON.stringify(opcoesPorCartao)}`,
    );
    const carimbar = async (i, opcao) => {
      const botao = cartoesK.nth(i).getByRole("button", { name: new RegExp(`${opcao}$`) });
      await botao.click();
      await q().locator(".cartao-carimbo").nth(i).locator('[aria-pressed="true"]').waitFor({ timeout: 5_000 });
    };
    await carimbar(0, "É verdade");
    await carimbar(1, "Não é verdade");
    await carimbar(2, "É verdade");
    const textoDosCarimbos = await texto(corpo());
    r.exigir(!/\b(correto|correta|errado|errada|acertou|errou)\b/i.test(textoDosCarimbos), "carimbar não mostra certo nem errado: nenhum retorno de acerto");
    await r.registrar(p, "e4-carimbos", {
      titulo: "Os carimbos K1–K3",
      mostra: "“A foto mostra o pátio?”, “A ficha diz pátio?” e “A ficha NÃO diz pátio?”, cada um com ✔ É verdade, ✖ Não é verdade e ? Não dá para saber — os três carimbados.",
      prova: "As três opções visíveis, sem cor de certo ou errado; o gabarito fica no servidor.",
    });
    await q().getByRole("button", { name: COPY.avancar, exact: true }).click();

    // ── E4: o reparo (errado de propósito) ───────────────────────────────
    await q().getByText(COPY.fichaDoTelao).waitFor({ timeout: 15_000 });
    const concluir = q().getByRole("button", { name: COPY.concluir, exact: true });
    r.exigir(await concluir.isDisabled(), "Concluir começa desligado: a ficha do telão começa com os três campos vazios");
    const etiquetas = q().locator(".etiquetas");
    const colocar = async (rotulo, campo) => {
      await etiquetas.getByRole("button").filter({ hasText: new RegExp(`^\\s*${rotulo}\\s*$`) }).first().click();
      await q().getByRole("button", { name: `Colocar no campo ${campo}` }).click();
    };
    await colocar("Pátio", "Quem");
    await colocar("estudantes", "Onde");
    await colocar("sexta", "Quando");
    await concluir.and(q().locator(":not([disabled])")).waitFor({ timeout: 5_000 });
    await r.registrar(p, "e4-reparo-montado", {
      titulo: "O reparo: a ficha montada (errada)",
      mostra: "A “Ficha do Telão” com Pátio em QUEM, estudantes em Onde e sexta em Quando; as etiquetas marcadas como posicionadas e Concluir aceso.",
      prova: "A criança monta a ficha à vontade e só o Concluir avalia (spec §7.6) — aqui, de propósito, o Pátio no campo errado.",
    });
    await concluir.click();
    await esperarOuFalharPorHttp(p, q().getByText(COPY.ninaErro), /\/nina-noticia\/reparo/, { timeout: 15_000, oQue: "concluir o reparo" });
    const telaDoErro = await texto(corpo());
    r.exigir(telaDoErro.includes(COPY.previa), `o erro é explicado: “${COPY.previa}”`);
    r.exigir((await q().locator(".reportagem").count()) === 3 && telaDoErro.includes(COPY.correto), "as três notícias aparecem, com o telão em “Pátio (correto)”");
    r.exigir(!/Tentar de novo/i.test(telaDoErro), "a tela de erro NÃO tem “Tentar de novo”");
    r.exigir((await q().getByRole("button", { name: COPY.continuar }).count()) === 1, "a tela de erro segue com “Continuar”");
    await r.registrar(p, "e4-erro-explicado", {
      titulo: "O erro explicado",
      mostra: "Nina: “O pátio indica o local. Coloque no campo Onde!”, “Veja como ficariam as 3 notícias completas:” e as três reportagens, o telão tracejado com “Pátio (correto)”; Continuar.",
      prova: "O desfecho é do servidor (válido ⇔ Pátio em Onde) e o erro ensina sem punir: nunca “Tentar de novo”.",
    });
    await q().getByRole("button", { name: COPY.continuar }).click();

    // ── E5: a ponte e a rotina ───────────────────────────────────────────
    await q().getByText(COPY.ninaPonte).waitFor({ timeout: 15_000 });
    await r.registrar(p, "e5-ponte", {
      titulo: "E5 — a ponte",
      mostra: "Nina: “Você encontrou o que faltava nessa reportagem! Mas chegaram outras ao jornal…” e “Precisamos de uma rotina automática!”.",
      prova: "A virada vira problema maior: conferir a pilha inteira pede uma rotina.",
    });
    await q().getByRole("button", { name: COPY.continuar }).click();
    const testar = q().getByRole("button", { name: COPY.testar });
    await testar.waitFor({ timeout: 15_000 });
    const sessaoDaRotina = await sessaoDoEstudante();
    const blocos = sessaoDaRotina.rotina?.blocos ?? [];
    r.exigir(blocos.length === 7 && blocos.every((b) => /^bl-/.test(b.id)), "sete blocos com ids opacos (bl-…)");
    r.exigir(
      blocos.map((b) => b.bloco).join(",") !== SEQUENCIA_CERTA.join(","),
      `a bandeja vem EMBARALHADA, nunca na ordem certa (${blocos.map((b) => b.bloco).join(", ")})`,
    );
    await r.registrar(p, "e5-blocos", {
      titulo: "A rotina: os blocos embaralhados",
      mostra: "“Pilha: 3 fichas pendentes”; à esquerda os sete blocos (ENQUANTO, Pegar, SE, ok, SENÃO, revisar, FIM) fora de ordem; à direita a esteira vazia.",
      prova: "A ordem da bandeja é sorteada no servidor e nunca é a certa: a criança organiza a rotina sozinha.",
    });
    const rotuloDe = (bloco) => blocos.find((b) => b.bloco === bloco)?.rotulo;
    const montarRotina = async (sequencia) => {
      for (let i = 0; i < sequencia.length; i += 1) {
        await q().locator(".blocos").getByRole("button", { name: rotuloDe(sequencia[i]) }).first().click();
        await q().getByRole("button", { name: `Vaga ${i + 1}: tocar para colocar` }).click();
      }
    };
    await montarRotina(SEQUENCIA_ERRADA);
    await testar.and(q().locator(":not([disabled])")).waitFor({ timeout: 5_000 });
    await r.registrar(p, "e5-rotina-errada", {
      titulo: "Uma rotina montada errada",
      mostra: "A esteira com os sete blocos, o “FIM: voltar à pilha” logo depois do ENQUANTO e o “Pegar próxima ficha” no fim.",
      prova: "A criança testa a rotina que montou; o servidor decide se ela para.",
    });
    await testar.click();
    await esperarOuFalharPorHttp(p, q().getByText(COPY.rotinaNaoPara), /\/nina-noticia\/rotina/, { timeout: 15_000, oQue: "testar a rotina errada" });
    await r.registrar(p, "e5-rotina-nao-para", {
      titulo: "A rotina não para",
      mostra: "“A rotina não para. Revise os blocos!” e “O computador continuaria rodando sem fim porque falta a condição de parada. Vamos reorganizar?”; Reorganizar.",
      prova: "O erro explica a falha (o laço sem parada) e devolve a esteira como estava.",
    });
    await q().getByRole("button", { name: COPY.reorganizar }).click();
    await testar.waitFor({ timeout: 10_000 });
    const naEsteira = q().locator(".esteira__trilho").getByRole("button", { name: rotuloDe("fim") });
    r.exigir((await naEsteira.count()) === 1, "Reorganizar volta à esteira COMO ESTAVA (os blocos continuam encaixados)");
    // Devolve todos os blocos encaixados (tocar no encaixado devolve), e monta a certa.
    for (const bloco of SEQUENCIA_ERRADA) {
      await q().locator(".esteira__trilho").getByRole("button", { name: rotuloDe(bloco) }).first().click();
    }
    await montarRotina(SEQUENCIA_CERTA);
    await testar.click();
    await esperarOuFalharPorHttp(p, q().getByText(/Ficha em teste/), /\/nina-noticia\/rotina/, { timeout: 15_000, oQue: "testar a rotina certa" });
    await r.registrar(p, "e5-simulacao", {
      titulo: "A simulação",
      mostra: "A ficha em teste passando pela esteira, o bloco ativo aceso, e a pilha descendo.",
      prova: "A rotina certa é a que o SERVIDOR aceitou; a simulação é a resposta dele, ficha a ficha.",
    });
    await q().getByText(COPY.rotinaOk).waitFor({ timeout: 15_000 });
    await r.registrar(p, "e5-rotina-ok", {
      titulo: "Rotina testada com sucesso!",
      mostra: "“Pilha: 0 fichas (finalizado)”, “Rotina testada com sucesso!” e a ficha incompleta com a bandeira de revisão; “Ir para o Caso Novo”.",
      prova: "Duas tentativas, contando a válida: a régua da EF03CO02 dá “atingiu”.",
    });
    await q().getByRole("button", { name: COPY.irParaCaso }).click();

    // ── E6: o caso novo ──────────────────────────────────────────────────
    const ferramentas = q().getByRole("region", { name: "Ferramentas da investigação" });
    await ferramentas.waitFor({ timeout: 15_000 });
    const botoesDasFerramentas = ferramentas.getByRole("button");
    const quantasFerramentas = await botoesDasFerramentas.count();
    r.exigir(quantasFerramentas === 3, `o caso traz as três ferramentas da investigação (${quantasFerramentas})`);
    for (let i = 0; i < quantasFerramentas; i += 1) {
      await botoesDasFerramentas.nth(i).click();
      await ferramentas.locator('[aria-pressed="true"]').waitFor({ timeout: 5_000 });
    }
    r.exigir((await texto(ferramentas.locator(".ferramentas__retorno"))).length > 0, "cada ferramenta devolve uma resposta neutra do banco");
    const cartoesDoCaso = q().locator(".cartao-carimbo");
    await cartoesDoCaso.nth(2).waitFor({ timeout: 10_000 });
    const carimbarCaso = async (i, opcao) => {
      await cartoesDoCaso.nth(i).getByRole("button", { name: new RegExp(`${opcao}$`) }).click();
      await cartoesDoCaso.nth(i).locator('[aria-pressed="true"]').waitFor({ timeout: 5_000 });
    };
    await carimbarCaso(0, "É verdade");
    await carimbarCaso(1, "Não dá para saber");
    await carimbarCaso(2, "Não é verdade");
    await r.registrar(p, "e6-caso", {
      titulo: "E6 — o caso novo",
      mostra: "O Festival de Ciências: as três ferramentas e os cartões K4–K6 (“As duas fotos tratam do Festival?”, “O Festival foi na sexta-feira?”, “A ficha diz que foi no sábado?”) carimbados.",
      prova: "A criança aplica o que aprendeu num caso que não viu — e “Não dá para saber” é uma resposta legítima.",
    });
    await q().getByRole("button", { name: COPY.avancar, exact: true }).click();

    // ── E6: o fim ────────────────────────────────────────────────────────
    await esperarOuFalharPorHttp(p, q().getByText(COPY.concluida), /\/nina-noticia\/(carimbos|concluir)/, { timeout: 20_000, oQue: "concluir a missão" });
    const textoDoFim = await texto(corpo());
    r.exigir(textoDoFim.includes(COPY.painel), `o fim é o “${COPY.painel}”`);
    /* Os títulos das colunas são caixa-alta por CSS: o `innerText` os devolve em maiúsculas. */
    r.exigir(["1. Suportes", "2. Omissão", "3. Reparo", "4. Automação"].every((c) => textoDoFim.toLowerCase().includes(c.toLowerCase())), "as quatro colunas do resumo: Suportes, Omissão, Reparo, Automação");
    r.exigir(textoDoFim.includes(COPY.somenteLeitura), "o rodapé diz que o painel é somente leitura");
    r.exigir(/2 testes/.test(textoDoFim), "a coluna Automação conta os dois testes da rotina");
    await r.registrar(p, "e6-painel-da-investigacao", {
      titulo: "Investigação concluída!",
      mostra: "“Painel da Investigação” com o selo “Investigação concluída!”, as quatro colunas com o resumo da própria sessão e o rodapé somente leitura.",
      prova: "O resumo é da sessão gravada no servidor; nada aqui muda mais.",
    });
    await semAposta("o fim");
    await q().getByRole("button", { name: COPY.desafioExtra }).click();
    const desafio = q().getByRole("dialog", { name: COPY.desafioExtra });
    await desafio.waitFor({ timeout: 10_000 });
    await r.registrar(p, "e6-desafio-extra", {
      titulo: "O Desafio Extra",
      mostra: "A janela “Desafio Extra”: duas fichas do banco, com foto e campos, para olhar com calma.",
      prova: "Só leitura: nada aqui é gravado.",
    });
    const sessaoFinal = await sessaoDoEstudante();
    r.exigir(sessaoFinal.concluida === true, "a sessão fica concluída");
    r.exigir(!/gabarito|correta|corretos|certa"/i.test(JSON.stringify(sessaoFinal)), "nem no fim a sessão traz gabarito");

    // ═══ PROFESSORA: o painel e as habilidades ══════════════════════════
    const painelFinal = await esperarNaApi(prof, `${caminhoDaTurma}/painel`, (c) => (c?.resumo?.concluiram ?? 0) >= 1, {
      oQue: "a conclusão no painel",
    });
    const linhaFinal = painelFinal.linhas.find((l) => l.usuario === ESTUDANTE.login);
    r.exigir(linhaFinal?.concluiu === true && linhaFinal?.passo === "fim", `a linha da criança diz que ela concluiu (${linhaFinal?.passo})`);
    r.exigir(
      painelFinal.resumo.escolhas.travadas >= 1 && painelFinal.resumo.escolhas.tres >= 1,
      `as Escolhas da Etapa 2 seguem no agregado (${JSON.stringify(painelFinal.resumo.escolhas)})`,
    );
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.locator("[data-painel-da-aula]").waitFor({ timeout: 30_000 });
    const folha = prof.locator("[data-folha]");
    await revelar(prof, folha);
    const linhaNaFolha = folha.getByRole("row").filter({ hasText: ESTUDANTE.nome }).first();
    await linhaNaFolha.waitFor({ timeout: 20_000 });
    const colunas = await folha.getByRole("columnheader").allInnerTexts();
    r.exigir(
      !colunas.some((c) => /acert|nota|pontos|n[íi]vel|escolha/i.test(c)),
      `a folha não tem coluna de acerto, nota, nível nem escolha (colunas: ${colunas.join(", ")})`,
    );
    r.exigir(!APOSTA.test(await texto(prof.locator("main"))), "o painel da professora não diz “aposta”");
    await prof.locator("[data-equipes-por-etapa]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "painel-final", {
      titulo: "O painel depois da aula",
      mostra: "Os estudantes por etapa (um na etapa 6), as Escolhas da Etapa 2, os alertas da sala e a folha com a criança em “Concluída”.",
      prova: "O progresso e o agregado, nunca o acerto ligado a um nome.",
      inteira: true,
    });

    const habilidades = prof.locator("[data-habilidades-nina-noticia]");
    await revelar(prof, habilidades);
    await habilidades.waitFor({ timeout: 30_000 });
    await habilidades.getByText("EF15CO08").first().waitFor({ timeout: 30_000 });
    const textoDasHabilidades = await texto(habilidades);
    const CODIGOS = ["EF15CO08", "EF03CO01", "EF03CO02", "EF03CO03", "EF15CO01"];
    r.exigir(
      CODIGOS.every((c) => textoDasHabilidades.includes(c)),
      `o painel de habilidades mostra as cinco da ficha da exp03ef1b (${CODIGOS.filter((c) => textoDasHabilidades.includes(c)).join(", ")})`,
    );
    const caminhoDaEvidencia = `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`;
    const nivelDe = (c, codigo) => {
      const e = c?.estudantes?.find((x) => x.nome === ESTUDANTE.nome);
      return Object.values(e?.porRodada ?? {}).map((rodada) => rodada?.[codigo]?.status).find(Boolean) ?? null;
    };
    const evidencia = await esperarNaApi(prof, caminhoDaEvidencia, (c) => nivelDe(c, "EF03CO01") !== null, {
      oQue: "as marcas da missão no painel de habilidades",
      timeout: 30_000,
    });
    const esperado = {
      "EF15CO08 (buscou errado antes de Onde = Pátio)": [nivelDe(evidencia, "EF15CO08"), "em_processo"],
      "EF03CO01 (os seis carimbos certos, K3 ✔ e K5 ?)": [nivelDe(evidencia, "EF03CO01"), "atingiu"],
      "EF03CO02 (rotina válida na 2ª tentativa)": [nivelDe(evidencia, "EF03CO02"), "atingiu"],
      "EF03CO03 (Pátio fora do campo Onde)": [nivelDe(evidencia, "EF03CO03"), "em_processo"],
      "EF15CO01 (escolha travada + reparo inválido)": [nivelDe(evidencia, "EF15CO01"), "em_processo"],
    };
    for (const [quem, [veio, regua]] of Object.entries(esperado)) {
      r.exigir(veio === regua, `${ESTUDANTE.login} ${quem}: o painel registra “${veio}”, e a régua dá “${regua}”`);
    }
    await habilidades.scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades", {
      titulo: "As habilidades da missão",
      mostra: "A aba Habilidades: EF15CO08, EF03CO01, EF03CO02, EF03CO03 e EF15CO01, com o nível de cada criança na rodada.",
      prova: "As marcas nascem das AÇÕES gravadas no servidor (a busca, os carimbos, a rotina, o reparo), com a régua da ficha E14.",
      inteira: true,
    });
  },
);
