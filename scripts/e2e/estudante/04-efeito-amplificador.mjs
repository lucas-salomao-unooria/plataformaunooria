import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { esperarOuFalharPorHttp } from "../lib/smoke.mjs";

/**
 * O EFEITO AMPLIFICADOR (exp02em1b, 2ª série do EM, unidade 1 — ADR-180), das
 * duas pontas da sala.
 *
 * A professora põe o pacote padrão no ar (o caminho curto, `banco-padrao`); o
 * estudante abre a missão, ouve a fala do PO, audita o rascunho no UnooriaAI
 * (fonte, substituição, crédito e o colega fora), publica, vive a madrugada no
 * feed e usa as três proteções; a professora pausa as telas e libera a Etapa 5,
 * e o estudante aponta os bastidores e conclui. No fim, o painel de habilidades
 * mostra as quatro habilidades atingidas.
 *
 * Os seletores são CONTRATO com a experiência (`src/lib/textos.ts`) e com o
 * hub (`resultados/painel-da-aula-efeito-amplificador.tsx`).
 */

const SERIE = "2EM";
const EXP_ID = "exp02em1b";
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;
const FICHA = `${HUB}/professor/entre-redes/2-serie/unidade-1`;
const ABERTURA = /Olá, vamos montar seu post para .+, você pode me pedir para montar o post, questionar minhas fontes e perguntar sobre direito digital\. Vamos começar\?/;

async function lerApi(p, caminho) {
  const resposta = await p.request.get(`${BFF}${caminho}`);
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

async function mandarApi(p, caminho, dados) {
  const resposta = await p.request.fetch(`${BFF}${caminho}`, { method: "POST", data: dados ?? {} });
  return { status: resposta.status(), corpo: await resposta.json().catch(() => null) };
}

async function idDaTurma(p, nome) {
  const { status, corpo } = await lerApi(p, "/turmas/minhas");
  return status === 200 && Array.isArray(corpo) ? (corpo.find((t) => t.nome === nome)?.id ?? null) : null;
}

await suite(
  {
    slug: "estudante/04-efeito-amplificador",
    papel: "estudante",
    titulo: "O Efeito Amplificador — o post, a madrugada e os bastidores",
    subtitulo: "o UnooriaAI por intenções, o latch do Publicar, as três proteções e os dois botões da professora",
    contexto:
      "O estudante é o comunicador do grêmio: cria com o UnooriaAI o post da campanha, audita o rascunho — " +
      "um dado inventado, um trecho copiado e um colega exposto — e publica no Unoovista. O relógio corre até " +
      "as 02h30, a rede destaca uma frase e o feed vira crise. A professora pausa as telas para o debate e " +
      "libera a Etapa 5, onde o estudante aponta o que a rede buscou.",
    prova: [
      "O pacote padrão vai ao ar num toque, e a ficha e a página da atividade são da missão nova",
      "O UnooriaAI abre com a fala do PO, com o tema do pacote",
      "Perguntar a fonte não corrige o dado; aceitar a substituição, pedir o crédito e tirar o colega sim",
      "Publicar é definitivo, e o algoritmo destaca a frase do recorte mesmo no post cuidadoso",
      "A sessão do estudante não carrega o gabarito (a categoria de saúde dos comentários, o comprova dos indicadores)",
      "As três proteções e a moderação ficam nos três pontos, e a pausa da professora congela a tela por polling",
      "A Etapa 5 exige os dois indicadores que comprovam; um distrator acende a dica",
      "O painel de habilidades mostra EM13CO24, EM13CO14, EM13CO26 e EM13CO08 com o nível da régua",
    ],
    comando: "node scripts/e2e/estudante/04-efeito-amplificador.mjs",
  },
  async (r) => {
    const estudante = conta("estudante", { turma: TURMA, serie: SERIE });
    const professora =
      contasDe("professor").find((c) => c.escola === estudante.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const senhaDe = (c) => c.senha || senhaDemo();

    // ═══ PROFESSORA: o pacote padrão no ar ═════════════════════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login, senhaDe(professora));
    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professora.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurma = `/efeito-amplificador/turmas/${turmaId}`;

    await prof.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.getByRole("heading", { name: "O Efeito Amplificador", exact: true }).waitFor({ timeout: 30_000 });
    await prof.getByText(/A missão só abre com uma atividade sua em andamento/).first().waitFor({ timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha da 2ª série, unidade 1",
      mostra: "O Efeito Amplificador na trilha: as cinco etapas, o aviso dos dois botões e a lista de atividades.",
      prova: "A Missão Tempestade saiu do catálogo (é a exp02em1b-v0); a ficha da unidade é da missão nova.",
    });

    const noAr = await mandarApi(prof, `${daTurma}/banco-padrao`);
    r.exigir(noAr.status === 200, `POST banco-padrao põe o pacote padrão no ar (HTTP ${noAr.status})`);
    /* Uma corrida anterior pode ter deixado a turma noutra rodada ou fase: o zerar recomeça do começo. */
    const pacote = await lerApi(prof, `${daTurma}/pacote`);
    const rodada = pacote.corpo?.ativo?.rodadaAtual ?? 1;
    const zerada = await mandarApi(prof, `${daTurma}/zerar`, { rodada });
    r.exigir(zerada.status === 200, `zerar abre uma rodada nova, sem pausa (HTTP ${zerada.status})`);

    // ═══ ESTUDANTE: a abertura e o UnooriaAI ═══════════════════════════════
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login, senhaDe(estudante));
    await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
    const q = p.frameLocator("iframe[data-experiencia]");
    await esperarOuFalharPorHttp(p, q.getByRole("button", { name: "Iniciar Campanha" }), /efeito-amplificador\/sessao/, {
      timeout: 40_000,
      oQue: "o boot da missão",
    });
    await r.registrar(p, "pauta-do-gremio", {
      titulo: "A pauta do grêmio",
      mostra: "A tela da escola entrega o desafio: criar a publicação oficial da campanha.",
      prova: "A missão abre porque há atividade em andamento e a sala liberou; o disfarce começa no Iniciar Campanha.",
    });
    await q.getByRole("button", { name: "Iniciar Campanha" }).click();
    await q.getByText(ABERTURA).waitFor({ timeout: 20_000 });
    await r.registrar(p, "abertura-do-unooriaai", {
      titulo: "A fala de abertura do UnooriaAI",
      mostra: "O assistente se apresenta com o tema do pacote e as três sugestões da copy.",
      prova: "É a fala literal do PO (2026-10-22), com o tema no lugar de [tema customizado].",
    });

    const enviar = async (texto) => {
      const campo = q.getByPlaceholder("Pergunte ao UnooriaAI...");
      await campo.fill(texto);
      await campo.press("Enter");
    };
    await q.getByText("Gerar rascunho de post sobre celular na escola", { exact: true }).click();
    await q.getByText(/Redigi uma proposta completa para o Grêmio Estudantil/).waitFor({ timeout: 20_000 });
    await enviar("esse DataBrasil existe mesmo?");
    await q.getByText(/não possuo registros de verificação do DataBrasil 2026/).waitFor({ timeout: 20_000 });
    const depoisDaFonte = await lerApi(p, "/efeito-amplificador/sessao");
    const p2 = depoisDaFonte.corpo?.previa?.paragrafos?.find((x) => /DataBrasil/.test(x.texto));
    r.exigir(Boolean(p2) && p2.corrigido === false, "perguntar a fonte NÃO corrige: a estatística continua na prévia");
    await enviar("sim");
    await q.getByText(/Substituí a estatística/).waitFor({ timeout: 20_000 });
    await enviar("coloca aspas e dá crédito ao jornal");
    await q.getByText(/configura plágio/).waitFor({ timeout: 20_000 });
    await q.getByText("Reescrever protegendo dados de terceiros", { exact: true }).click();
    await q.getByText(/Atingimos o limite de interações/).waitFor({ timeout: 20_000 });
    await r.registrar(p, "auditoria-no-unooriaai", {
      titulo: "A auditoria do rascunho",
      mostra: "A fonte perguntada, a estatística substituída, a citação creditada e o colega anonimizado — e o aviso do limite.",
      prova: "O servidor classifica cada pedido (lista fechada, sem IA na aula) e muda a prévia; o chat fecha na 5ª mensagem.",
    });

    const sessao = await lerApi(p, "/efeito-amplificador/sessao");
    r.exigir(
      !JSON.stringify(sessao.corpo).match(/"tipo":|"comprova":|"no":/),
      "a sessão do estudante não traz a categoria de saúde, o comprova nem o nó (o gabarito é do servidor)",
    );

    await q.getByRole("button", { name: "Revisar Publicação" }).click();
    await q.getByText("Prévia da Publicação").waitFor({ timeout: 10_000 });
    await r.registrar(p, "previa-da-publicacao", {
      titulo: "A Prévia da Publicação",
      mostra: "Os parágrafos como ficaram, cada um com Remover trecho.",
      prova: "Sem edição livre: tirar um parágrafo também resolve o nó para a régua.",
    });
    await q.getByRole("button", { name: "Exportar para o Unoovista" }).click();
    await q.getByRole("radio", { name: /Convivência e Celular: Diálogo e Equilíbrio/ }).click();
    await r.registrar(p, "manchete-de-capa", {
      titulo: "A manchete de capa",
      mostra: "Três manchetes — neutra, construtiva, sensacionalista — e o Publicar no Unoovista.",
      prova: "A aposta: o estudante escolhe a mais equilibrada esperando uma circulação construtiva.",
    });
    await q.getByRole("button", { name: "Publicar no Unoovista" }).click();

    // ═══ ESTUDANTE: a madrugada ════════════════════════════════════════════
    await q.getByText(/Seus dados de localização aproximada/).waitFor({ timeout: 20_000 });
    const publicada = await lerApi(p, "/efeito-amplificador/sessao");
    r.exigir(
      publicada.corpo?.publicacao?.trechoPincado === "O celular transformou as salas de aula em arenas de disputa visual",
      "o post cuidadoso também ganha a frase pinçada em destaque (o recorte do pacote)",
    );
    await r.registrar(p, "feed-da-madrugada", {
      titulo: "O feed da madrugada",
      mostra: "O post com a frase fora de contexto em destaque, o alerta de metadados e os comentários das 02h.",
      prova: "A entrega é a mesma para toda a turma: o incentivo é da rede, não do texto.",
    });

    await q.getByRole("button", { name: "@clara_estudos: ver mais" }).click();
    await q.getByRole("button", { name: "@tomas_2em: ver mais" }).click();
    await q.getByRole("button", { name: "Opções da publicação" }).click();
    await q.getByText("Restringir Comentários", { exact: true }).click();
    await q.getByText("Comentários restritos nesta publicação.").first().waitFor({ timeout: 10_000 });
    await q.getByRole("button", { name: "Opções da publicação" }).click();
    await q.getByText("Configurações de Privacidade", { exact: true }).click();
    await q.getByRole("button", { name: "Opções da publicação" }).click();
    await q.getByText("Central de Apoio / Ajuda e Segurança", { exact: true }).click();
    await q.getByRole("button", { name: "Opções do comentário" }).nth(3).click();
    await q.getByText("Denunciar", { exact: true }).click();
    await q.getByText("Denúncia enviada para análise da moderação.").first().waitFor({ timeout: 10_000 });
    await r.registrar(p, "protecoes-nos-tres-pontos", {
      titulo: "As proteções nos três pontos",
      mostra: "Comentários restritos, conta privada, Central de Apoio e a conta invasiva denunciada.",
      prova: "Ninguém mandou: as ferramentas ficam nos menus, e usá-las é o que a EM13CO08 mede.",
    });

    // ═══ PROFESSORA: a pausa e a Etapa 5 ═══════════════════════════════════
    await prof.goto(`${FICHA}/resultados?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-lousa]").waitFor({ timeout: 30_000 });
    await prof.locator("[data-botoes-da-aula]").getByRole("button", { name: "Pausar Telas para Debate" }).click();
    await prof.getByRole("dialog").getByRole("button", { name: "Pausar Telas para Debate" }).click();
    await q.getByText("Aguardando a liberação do orientador do grêmio para avançar...").first().waitFor({ timeout: 20_000 });
    await r.registrar(prof, "lousa-da-conducao", {
      titulo: "A lousa da condução",
      mostra: "Publicações, a porcentagem com pico de madrugada, as manchetes e a curva de entrega — sem nomes.",
      prova: "É o material do debate: 100% dos posts entregues de madrugada, qualquer que fosse a manchete.",
    });
    await r.registrar(p, "telas-pausadas", {
      titulo: "As telas pausadas",
      mostra: "A espera na voz da ficção, por cima do feed.",
      prova: "A pausa chega ao aparelho pelo polling de 3 s, sem recarregar.",
    });
    await prof.locator("[data-botoes-da-aula]").getByRole("button", { name: "Liberar Etapa 5" }).click();
    await prof.getByRole("dialog").getByRole("button", { name: "Liberar Etapa 5" }).click();

    // ═══ ESTUDANTE: os bastidores ══════════════════════════════════════════
    await q.getByText("Bastidores da Entrega Algorítmica").first().waitFor({ timeout: 20_000 });
    await q.getByRole("button", { name: "Curtidas na publicação: 37" }).click();
    await q.getByText(/Este indicador não mostra o que a rede priorizou/).waitFor({ timeout: 10_000 });
    await q.getByRole("button", { name: "Pico de Notificações: 02h30" }).click();
    await q.getByRole("button", { name: "Tempo de Retenção Compulsiva: +340%" }).click();
    await q.getByText(/Economia da Atenção: o modelo de negócio/).waitFor({ timeout: 10_000 });
    await r.registrar(p, "bastidores-da-entrega", {
      titulo: "Os bastidores da entrega",
      mostra: "Os dois indicadores confirmados, a fala de Nico e os três conceitos.",
      prova: "O gabarito é do servidor: o distrator acendeu a dica; os dois certos liberaram o Concluir.",
    });
    await q.getByRole("button", { name: "Concluir missão" }).click();
    await q.getByText("Missão Concluída").waitFor({ timeout: 15_000 });

    // ═══ PROFESSORA: as habilidades ════════════════════════════════════════
    const atividade = (await lerApi(prof, `${daTurma}/pacotes`)).corpo?.emAndamento?.pacoteId;
    const habilidades = await lerApi(prof, `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividade}`);
    const texto = JSON.stringify(habilidades.corpo ?? {});
    for (const codigo of ["EM13CO24", "EM13CO14", "EM13CO26", "EM13CO08"]) {
      r.exigir(texto.includes(codigo), `o painel de habilidades traz ${codigo}`);
    }
    await prof.reload({ waitUntil: "domcontentloaded" });
    await prof.locator("[data-habilidades-efeito-amplificador]").waitFor({ timeout: 30_000 });
    await prof.locator("[data-habilidades-efeito-amplificador]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-da-bncc", {
      titulo: "As habilidades da BNCC",
      mostra: "EM13CO24, EM13CO14, EM13CO26 e EM13CO08, com o nível que a régua deu ao estudante.",
      prova: "Só Canal A: tudo foi medido pelo que o estudante fez — não há perguntas no fim (decisão do PO).",
    });
  },
);
