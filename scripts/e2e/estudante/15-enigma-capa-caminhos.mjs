import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe, senhaDemo } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo, esperarOuFalharPorHttp } from "../lib/smoke.mjs";
import { revelar } from "../lib/abas.mjs";
import {
  arrastar,
  comResposta,
  esperarNaApi,
  hidratado,
  idDaTurma,
  lerApi,
  pontoEm,
  postarNaApi,
  primeiroQueAparecer,
  tocarNoMeio,
} from "../lib/enigma-capa.mjs";

/**
 * O ENIGMA DA CAPA DA RÁDIO (exp02ef1b, ADR-184) — os CAMINHOS DE BORDA, com
 * duas crianças da mesma turma e o banco padrão (sem IA na aula).
 *
 * A 14 prova o caminho feliz com a cena gerada pela IA. Esta prova o que a
 * criança e a professora fazem quando a aula não é feliz:
 *
 * 1. a INATIVIDADE na lupa (45 s sem toque: o Bento, "VAMOS INVESTIGAR?", e
 *    nada avança sozinho);
 * 2. a ESPERA longa pela virada (3 min: "O PROFESSOR JÁ VEM!", e a tela
 *    continua travada);
 * 3. a QUEDA DE REDE no meio do PUBLICAR CAPA ("SEM SINAL NA RÁDIO", a fila em
 *    memória entrega quando a rede volta — provado pela api);
 * 4. a AJUDA depois de 3 erros na busca (o pulso amarelo nos alvos que o
 *    servidor manda) e mais 3 erros depois dela (o "não atingiu" da EF02CO01);
 * 5. MOSTRA TUDO na horta (o LATCH 2) com o selo incoerente e dois alertas da
 *    lupa: a EF02CO05 não atingida, enquanto a outra criança, toda plena, atinge;
 * 6. o ZERAR da professora: rodada nova, evidência apagada (ADR-155), virada
 *    fechada e a criança de volta ao crachá.
 *
 * A professora usa "USAR BANCO PADRÃO (BIBLIOTECA)" — o caminho de um toque —,
 * e a suíte joga com o gabarito que ELA vê (`GET …/pacotes/:id`).
 */

const SERIE = "2EF";
const EXP_ID = "exp02ef1b";
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;
const FICHA = `${HUB}/professor/entre-redes/2-ano/unidade-1`;
const BIBLIOTECA = "USAR BANCO PADRÃO (BIBLIOTECA)";
const SEM_SINAL = "SEM SINAL NA RÁDIO";
/** A faixa da casca, pela classe: o `InlineHint` com `announce` tem uma cópia invisível do texto para o leitor de tela, e `getByText(...).first()` cai nela. */
const faixaSemSinal = (q) => q.locator(".casca__sem-sinal");

/** Toques no CHÃO das fotos, longe do relógio e do cartaz da parede do fundo. */
const TOQUES_ERRADOS = [
  ["foto-1", { x: 8, y: 88 }],
  ["foto-1", { x: 20, y: 92 }],
  ["foto-2", { x: 92, y: 88 }],
  ["foto-2", { x: 80, y: 92 }],
  ["foto-1", { x: 12, y: 70 }],
  ["foto-2", { x: 88, y: 70 }],
];

await suite(
  {
    slug: "estudante/15-enigma-capa-caminhos",
    papel: "estudante",
    titulo: "O Enigma da Capa da Rádio — os caminhos de borda",
    subtitulo: "banco padrão em um toque, inatividade, a espera longa, sem rede, a ajuda, MOSTRA TUDO e o zerar",
    contexto:
      "Duas crianças da mesma turma do 2º ano jogam a Biblioteca, o banco padrão que a professora põe no ar em um " +
      "toque. Uma delas faz tudo certo — mas a rede cai no meio do PUBLICAR CAPA. A outra fica parada na lupa, tenta " +
      "avançar antes da hora, cola o selo errado, erra a busca até a ajuda acender (e erra de novo) e vota MOSTRA TUDO. " +
      "No fim, as habilidades das duas pela régua, e a professora zera a turma para uma aplicação nova.",
    prova: [
      "USAR BANCO PADRÃO (BIBLIOTECA): um toque aprova a Biblioteca e a põe em andamento, sem IA",
      "45 s sem toque na lupa: o Bento pergunta VAMOS INVESTIGAR? e o passo continua o mesmo na api",
      "A rede cai no PUBLICAR CAPA: SEM SINAL NA RÁDIO, a api não tem a capa; a rede volta e a fila a entrega",
      "3 min esperando a virada: O PROFESSOR JÁ VEM!, e a tela (e a api) continuam travadas",
      "3 erros na busca acendem a ajuda: a api manda os alvos e o pulso amarelo aparece; 3 erros depois dela contam",
      "MOSTRA TUDO trava o voto (LATCH 2); a EF02CO05 fica “não atingiu” para ela e “atingiu” para a colega plena",
      "Zerar: rodada nova, evidência da atividade apagada, virada fechada e as crianças de volta ao crachá",
    ],
    comando: "node scripts/e2e/estudante/15-enigma-capa-caminhos.mjs",
  },
  async (r) => {
    const daSerie = contasDe("estudante").filter((c) => c.turma === TURMA && c.serie.startsWith(SERIE));
    if (!r.exigir(daSerie.length >= 3, `a ${TURMA} tem ao menos 3 estudantes no CSV (${daSerie.length})`)) return;
    /* A 14 joga com a PRIMEIRA conta da turma; esta, com a segunda e a terceira. */
    const [certa, apressada] = [daSerie[1], daSerie[2]];
    const professora =
      contasDe("professor").find((c) => c.escola === certa.escola && c.turma.split(" + ").includes(TURMA)) ??
      conta("professor", { turma: TURMA });
    const senhaDe = (c) => c.senha || senhaDemo();

    r.provocado(
      /ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError|net::ERR_/,
      "a queda de rede é PROVOCADA (context.setOffline) para provar a fila em memória e o SEM SINAL NA RÁDIO",
    );

    // ═══ PROFESSORA: o banco padrão em um toque ════════════════════════════
    const prof = await r.pagina("professora", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, professora.login, senhaDe(professora));
    const turmaId = await idDaTurma(prof, TURMA);
    if (!r.exigir(Boolean(turmaId), `${professora.login} leciona na ${TURMA} (GET /turmas/minhas)`)) return;
    const daTurma = `/enigma-capa/turmas/${turmaId}`;

    await prof.goto(`${FICHA}/atividades/nova?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-assistente-de-atividade]").waitFor({ timeout: 60_000 });
    const passo = prof.locator("[data-passo-conteudo]");
    /* Um preparo de ANTES (atividade já gravada nesta tela) mostra "Escolher outro conteúdo": volta ao começo. */
    const recomecar = passo.locator('[data-acao="recomecar-preparo"]');
    const botaoDaBiblioteca = passo.locator('[data-acao="usar-pronto-biblioteca"]');
    const antes = await primeiroQueAparecer({ biblioteca: botaoDaBiblioteca, recomecar }, { timeout: 60_000, oQue: "o preparo da turma" });
    if (antes === "recomecar") await recomecar.click();
    await hidratado(prof, botaoDaBiblioteca);
    /* `includes`, não igualdade: o ícone do botão é um glifo do Material Symbols, e o nome dele entra no innerText. */
    r.exigir((await botaoDaBiblioteca.innerText()).includes(BIBLIOTECA), `o botão principal é “${BIBLIOTECA}”`);
    await passo.locator("[data-caminho-curto]").scrollIntoViewIfNeeded();
    await r.registrar(prof, "banco-padrao", {
      titulo: BIBLIOTECA,
      mostra: "O caminho curto, antes de qualquer campo: a Biblioteca Escolar em um toque, e os prontos da Horta e do Museu.",
      prova: "A professora que não quer preparar nada tem a aula pronta: sem IA, sem curadoria.",
    });
    await botaoDaBiblioteca.click();
    await esperarOuFalharCedo(passo.locator('[data-fase="gravada"]'), passo.locator(ALERTA_DE_ERRO), {
      timeout: 30_000,
      oQue: "usar o banco padrão",
    });
    const pacotes = await lerApi(prof, `${daTurma}/pacotes`);
    const atividadeId = pacotes.corpo?.emAndamento?.pacoteId ?? null;
    const detalhe = atividadeId ? (await lerApi(prof, `${daTurma}/pacotes/${atividadeId}`)).corpo : null;
    if (
      !r.exigir(
        detalhe?.origem === "padrao" && detalhe?.conteudo?.cena?.chave === "biblioteca" && (detalhe?.conteudo?.cena?.invariantes ?? []).every((i) => i.alvo),
        `um toque: a Biblioteca está EM ANDAMENTO na turma (origem ${detalhe?.origem}, cena ${detalhe?.conteudo?.cena?.chave}, rodada ${pacotes.corpo?.emAndamento?.rodada})`,
      )
    )
      return;
    await r.registrar(prof, "um-toque", {
      titulo: "Atividade pronta, em um toque",
      mostra: "“Atividade pronta”: a Biblioteca, pacote pronto da Unooria, já em andamento na turma.",
      prova: "`banco-padrao` aprova E põe no ar na mesma transação (one-pager §9a); o rascunho da IA, se houver, fica intocado.",
    });

    await prof.locator('[data-acao="continuar-criacao"]:not([disabled])').waitFor({ timeout: 10_000 });
    await prof.locator('[data-acao="continuar-criacao"]').click();
    await prof.getByRole("radio", { name: "Um aluno por computador", exact: true }).click();
    await prof.locator('[data-acao="continuar-criacao"]').click();
    await prof.locator("[data-revisao-da-criacao]").waitFor({ timeout: 10_000 });
    const noAr = prof.getByLabel("Pôr esta atividade no ar agora");
    await noAr.waitFor({ state: "attached", timeout: 10_000 });
    /* Ligado: é ele que libera a missão na SALA (a outra porta da aula). */
    if (!(await noAr.isChecked())) await noAr.dispatchEvent("click");
    r.exigir(await noAr.isChecked(), "“Pôr esta atividade no ar agora” ligado: a missão é liberada na sala");
    await prof.locator('[data-acao="criar-atividade"]').click();
    await esperarOuFalharCedo(prof.locator('[data-estado-da-atividade="em-andamento"]'), prof.locator(ALERTA_DE_ERRO), {
      timeout: 60_000,
      oQue: "criar e usar a atividade do banco padrão",
    });
    const salas = await lerApi(prof, `/salas/turma/${turmaId}`);
    const naSala = salas.corpo?.missoes?.find?.((m) => m.expId === EXP_ID) ?? null;
    r.exigir(naSala?.estado === "liberada", `a missão está liberada na sala da ${TURMA} (${naSala?.estado})`);

    /* Estado de ONTEM não reprova hoje: a Biblioteca reusada pode voltar com sessões ou com a virada aberta. */
    let painel = (await lerApi(prof, `${daTurma}/painel`)).corpo;
    const sujas = (painel?.linhas ?? []).filter((l) => l.cracha !== null);
    if (painel?.fase !== "aberta" || sujas.length > 0) {
      const z = await postarNaApi(prof, `${daTurma}/zerar`, { rodada: painel.atividade.rodada });
      r.ressalva(
        `a Biblioteca já estava no ar com ${sujas.length} sessão(ões) e fase “${painel?.fase}” (de uma corrida anterior): zerada antes de começar (HTTP ${z.status}, rodada ${z.corpo?.atividade?.rodada})`,
      );
      painel = (await lerApi(prof, `${daTurma}/painel`)).corpo;
    }
    const rodada = painel.atividade.rodada;
    r.exigir(painel.fase === "aberta" && painel.resumo.entraram === 0, `a turma começa limpa: fase “aberta”, rodada ${rodada}, ninguém entrou`);

    const k = detalhe.conteudo.cena;
    const alvos = Object.fromEntries(k.invariantes.map((i) => [i.id, i.alvo]));
    const fundoX = k.fundo.x + k.fundo.w / 2;
    const fundoY = k.fundo.y + k.fundo.h / 2;
    const linhaDe = (pn, c) => pn?.linhas?.find((l) => l.nome === c.nome) ?? null;

    // ═══ os gestos de uma criança (as duas jogam pelo mesmo caminho) ═══════
    async function abrirMissao(p, quem) {
      await p.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
      const q = p.frameLocator("iframe[data-experiencia]");
      await esperarOuFalharPorHttp(p, q.getByText("ESCOLHA SEU CRACHÁ", { exact: true }), /enigma-capa\/sessao/, {
        timeout: 40_000,
        oQue: `o boot da missão (${quem})`,
      });
      return q;
    }
    async function escolherCracha(p, q, rotulo) {
      await p.waitForTimeout(3300); /* o toque só libera depois de 3 s (a 14 prova a trava) */
      await q.getByLabel(rotulo, { exact: true }).click();
      await q.getByText("BENTO PRECISA DE AJUDA!").first().waitFor({ timeout: 15_000 });
    }
    const avancou = (req) => req.postDataJSON()?.avancar === true;
    async function cumprirOPiso(p, q) {
      const fotos = q.locator(".bancada__foto");
      await fotos.nth(1).waitFor({ timeout: 15_000 });
      for (const [i, f] of [[0, "foto-1"], [1, "foto-2"]]) {
        const recorte = k.fotos.find((x) => x.id === f).recorte;
        const destino = await pontoEm(fotos.nth(i), (fundoX - recorte.x) / recorte.w, (fundoY - recorte.y) / recorte.h);
        const deLente = await pontoEm(q.locator(".lupa"), 0.5, 0.5);
        await arrastar(p, deLente, destino, 16);
        await p.waitForTimeout(3600);
      }
      const { corpo } = await comResposta(p, /\/enigma-capa\/lupa$/, () => tocarNoMeio(p, q.getByRole("button", { name: "AVANÇAR" })), avancou);
      return corpo;
    }
    async function prepararCapa(q, fotoId, seloId) {
      await q.getByText("ESCOLHA 1 FOTO").first().waitFor({ timeout: 15_000 });
      await q.locator(".decidir__miniatura").nth(fotoId === "foto-1" ? 0 : 1).click();
      await q.locator(".moldura").waitFor({ timeout: 10_000 });
      const selo = k.selos.find((s) => s.id === seloId);
      await q.getByRole("button", { name: new RegExp(selo.texto) }).click();
      await q.locator(".moldura .carimbo").waitFor({ timeout: 5000 });
      await q.locator("button:not([disabled])", { hasText: "PUBLICAR CAPA" }).waitFor({ timeout: 5000 });
      return selo;
    }
    const metade = (q, f) => q.locator(".dividida__foto").nth(f === "foto-1" ? 0 : 1);
    async function tocarNa(p, q, f, ponto) {
      const rec = k.fotos.find((x) => x.id === f).recorte;
      const alvo = await pontoEm(metade(q, f), (ponto.x - rec.x) / rec.w, (ponto.y - rec.y) / rec.h);
      return (await comResposta(p, /\/enigma-capa\/invariantes$/, () => p.mouse.click(alvo.x, alvo.y))).corpo?.toque;
    }
    async function acharOsQuatro(p, q) {
      const toques = [];
      for (const inv of ["inv-1", "inv-2"]) for (const f of ["foto-1", "foto-2"]) toques.push(await tocarNa(p, q, f, alvos[inv]));
      return toques;
    }
    /** Do slider à horta: a revelação, o “fora”, o par e a segunda foto — o caminho que a 14 detalha. */
    async function ateAHorta(p, q) {
      await q.getByText("AGORA EU ENTENDI!").first().waitFor({ timeout: 10_000 });
      const slider = q.locator('input[type="range"]');
      const doSlider = await comResposta(p, /\/enigma-capa\/slider$/, () => slider.fill("100"));
      await q.getByText("ERA O MESMO LUGAR!").first().waitFor({ timeout: 15_000 });
      const vis = (await lerApi(p, "/enigma-capa/sessao")).corpo?.capa?.visivel;
      const inteira = q.locator(".cena-inteira");
      for (const y of [60, 75]) {
        const alvo = await pontoEm(inteira, Math.min(97, vis.x + vis.w + (100 - vis.x - vis.w) * 0.6) / 100, y / 100);
        await p.mouse.click(alvo.x, alvo.y);
        await p.waitForTimeout(200);
      }
      const fora = await comResposta(p, /\/enigma-capa\/fora$/, () => q.getByRole("button", { name: "Pronto", exact: true }).click());
      await q.getByText("Junte duas fotos da mesma atividade.").first().waitFor({ timeout: 15_000 });
      const c1 = await pontoEm(q.getByRole("button", { name: "Foto 1", exact: true }), 0.5, 0.5);
      const c3 = await pontoEm(q.getByRole("button", { name: "Foto 3", exact: true }), 0.5, 0.5);
      await arrastar(p, c1, c3, 14);
      await q.getByText("O que é parecido?").first().waitFor({ timeout: 10_000 });
      const pares = await comResposta(p, /\/enigma-capa\/pares$/, () => q.getByRole("button", { name: /A atividade$/ }).click());
      await q.getByText("Foto de leitura: o que precisa aparecer?").first().waitFor({ timeout: 10_000 });
      await q.getByRole("button", { name: /Criança lendo/ }).click();
      const segunda = await comResposta(p, /\/enigma-capa\/segunda-foto$/, () => q.getByRole("button", { name: "Colocar no álbum" }).click());
      await q.getByText("A HORTA ACABOU?").first().waitFor({ timeout: 15_000 });
      return [doSlider, fora, pares, segunda].every((x) => x.status === 200);
    }

    // ═══ A CRIANÇA CERTA: tudo certo — e a rede cai no PUBLICAR CAPA ═══════════════════
    const pa = await r.pagina("estudante-certa", { viewport: { width: 412, height: 915 }, mobile: true, deviceScaleFactor: 2 });
    await r.entrar(pa, certa.login, senhaDe(certa));
    const qa = await abrirMissao(pa, certa.nome);
    const tempos = (await lerApi(pa, "/enigma-capa/sessao")).corpo?.tempos ?? {};
    const INATIVIDADE_MS = tempos.inatividadeMs ?? 45_000;
    const ESPERA_DO_PROFESSOR_MS = tempos.esperaDoProfessorMs ?? 180_000;
    await escolherCracha(pa, qa, "FONE AZUL");
    await qa.getByText("INVESTIGAR A NOVA CAPA").first().click();
    const pisoDaCerta = await cumprirOPiso(pa, qa);
    r.exigir(pisoDaCerta?.liberado === true && pisoDaCerta?.lupa?.alertas === 0, `${certa.nome}: a lupa com o piso cumprido e nenhum alerta (lupa plena)`);
    const seloDaCerta = await prepararCapa(qa, "foto-1", k.fotos[0].seloCoerente);

    /* A REDE CAI: o toque em PUBLICAR CAPA sai sem conexão. */
    await pa.context().setOffline(true);
    await qa.getByRole("button", { name: "PUBLICAR CAPA" }).click();
    await faixaSemSinal(qa).waitFor({ timeout: 20_000 });
    r.exigir((await faixaSemSinal(qa).innerText()).includes(SEM_SINAL), `a faixa diz “${SEM_SINAL}”`);
    const semCapa = linhaDe((await lerApi(prof, `${daTurma}/painel`)).corpo, certa);
    r.exigir(semCapa?.capa === null && semCapa?.passo === "decidir", `sem rede, a api não tem a capa de ${certa.nome} (passo “${semCapa?.passo}”, capa ${JSON.stringify(semCapa?.capa)})`);
    r.exigir(await qa.locator("button[disabled]", { hasText: "PUBLICAR CAPA" }).count() === 1, "o PUBLICAR CAPA fica travado: a jogada está na fila, não perdida");
    await r.registrar(pa, "sem-sinal-na-radio", {
      titulo: SEM_SINAL,
      mostra: "A faixa de erro no alto da tela, com a capa enquadrada e o PUBLICAR CAPA travado.",
      prova: "A jogada foi para a fila EM MEMÓRIA (nunca localStorage); a api ainda não tem a capa — a professora vê a criança em “decidir”.",
    });
    await pa.waitForTimeout(4000); /* pelo menos uma volta da fila sem rede */
    await pa.context().setOffline(false);
    const comCapa = await esperarNaApi(prof, `${daTurma}/painel`, (c) => linhaDe(c, certa)?.capa !== null, {
      timeout: 30_000,
      oQue: "a fila entregar a capa quando a rede voltou",
    });
    const capaDaCerta = linhaDe(comCapa, certa).capa;
    r.exigir(
      capaDaCerta.fotoId === "foto-1" && capaDaCerta.seloId === seloDaCerta.id && capaDaCerta.seloCoerente === true,
      `a rede voltou e a fila entregou: a api tem a capa de ${certa.nome} (foto 1, “${seloDaCerta.texto}”, selo coerente)`,
    );
    await qa.locator(".feed__resposta").waitFor({ timeout: 20_000 });
    const feedDaCertaEm = Date.now();
    await faixaSemSinal(qa).waitFor({ state: "hidden", timeout: 15_000 });
    r.exigir((await qa.locator(".feed__resposta").innerText()).includes(capaDaCerta.visitante), `a visitante fala depois da entrega: “${capaDaCerta.visitante}”`);
    await r.registrar(pa, "a-fila-entregou", {
      titulo: "A rede voltou: a capa chegou",
      mostra: `A faixa sumiu e a capa está no feed, com a visitante: “${capaDaCerta.visitante}”.`,
      prova: "A fila reenviou o MESMO publicar (idempotente) e a tela seguiu o passo do servidor — a criança não refez nada.",
    });
    await qa.getByText("AGUARDE O PROFESSOR").first().waitFor({ timeout: 15_000 });

    // ═══ A APRESSADA: parada na lupa, apressada e com o selo errado ════════════════
    const pb = await r.pagina("estudante-apressada", { viewport: { width: 412, height: 915 }, mobile: true, deviceScaleFactor: 2 });
    await r.entrar(pb, apressada.login, senhaDe(apressada));
    const qb = await abrirMissao(pb, apressada.nome);
    await escolherCracha(pb, qb, "MICROFONE VERDE");
    const abriuALupaEm = Date.now();
    await qb.getByText("INVESTIGAR A NOVA CAPA").first().click();
    await qb.getByRole("button", { name: "AVANÇAR" }).waitFor({ timeout: 15_000 });
    /* Nenhum toque: o desfecho esperado é o Bento, com folga de 20 s sobre o tempo do produto. */
    const bento = qb.getByText("VAMOS INVESTIGAR?");
    await bento.first().waitFor({ timeout: INATIVIDADE_MS + 20_000 });
    const parada = Date.now() - abriuALupaEm;
    r.exigir(parada >= INATIVIDADE_MS - 1000, `o Bento só aparece depois de ${INATIVIDADE_MS / 1000} s sem toque (apareceu em ${(parada / 1000).toFixed(1)} s)`);
    const paradaNaApi = (await lerApi(pb, "/enigma-capa/sessao")).corpo;
    r.exigir(
      paradaNaApi?.passo === "lupa" && paradaNaApi?.lupa?.liberada === false && paradaNaApi?.lupa?.alertas === 0 && paradaNaApi?.capa === null,
      `nada avançou sozinho: a api segue em “${paradaNaApi?.passo}”, lupa não liberada, 0 alertas, sem capa`,
    );
    r.exigir((await qb.getByText("ESCOLHA 1 FOTO").count()) === 0, "a tela continua na bancada (nenhuma tela seguinte apareceu)");
    await r.registrar(pb, "vamos-investigar", {
      titulo: "VAMOS INVESTIGAR?",
      mostra: "45 s sem toque na lupa: o Bento aparece embaixo das fotos com o convite, acima do AVANÇAR esmaecido.",
      prova: "A inatividade só convida: não há avanço involuntário nem perda de estado — a api segue no passo da lupa.",
    });

    /* Apressada: dois toques em AVANÇAR antes do piso — dois alertas (lupa “ausente” na régua). */
    const avancar = qb.getByRole("button", { name: "AVANÇAR" });
    const cedo1 = await comResposta(pb, /\/enigma-capa\/lupa$/, () => tocarNoMeio(pb, avancar), avancou);
    await bento.first().waitFor({ state: "hidden", timeout: 5000 });
    await qb.getByText("OLHE O FUNDO").first().waitFor({ timeout: 10_000 });
    await pb.waitForTimeout(500);
    const cedo2 = await comResposta(pb, /\/enigma-capa\/lupa$/, () => tocarNoMeio(pb, avancar), avancou);
    r.exigir(
      cedo1.corpo?.liberado === false && cedo2.corpo?.liberado === false && cedo2.corpo?.lupa?.alertas === 2,
      `um toque faz o Bento sair; dois avanços antes do piso: recusados, lupa_alertas = ${cedo2.corpo?.lupa?.alertas}`,
    );
    const pisoDaApressada = await cumprirOPiso(pb, qb);
    r.exigir(pisoDaApressada?.liberado === true && pisoDaApressada?.lupa?.alertas === 2, `${apressada.nome}: o piso libera, com os 2 alertas guardados`);
    const outroSelo = k.selos.find((s) => s.id !== k.fotos[0].seloCoerente);
    await prepararCapa(qb, "foto-1", outroSelo.id);
    const publicadaDaApressada = await comResposta(pb, /\/enigma-capa\/publicar$/, () => qb.getByRole("button", { name: "PUBLICAR CAPA" }).click());
    r.exigir(
      publicadaDaApressada.status === 200 && publicadaDaApressada.corpo?.capa?.seloId === outroSelo.id,
      `${apressada.nome} publica a foto 1 com o selo “${outroSelo.texto}” — o da OUTRA foto (incoerente)`,
    );
    await qb.getByText("AGUARDE O PROFESSOR").first().waitFor({ timeout: 15_000 });

    // ═══ A CRIANÇA CERTA: 3 min esperando a virada ═════════════════════════════════════
    const jaVem = qa.getByText("O PROFESSOR JÁ VEM!");
    const falta = ESPERA_DO_PROFESSOR_MS + 5000 - (Date.now() - feedDaCertaEm);
    await jaVem.first().waitFor({ timeout: Math.max(10_000, falta + 45_000) });
    const esperou = Date.now() - feedDaCertaEm;
    r.exigir(
      esperou >= ESPERA_DO_PROFESSOR_MS - 2000,
      `“O PROFESSOR JÁ VEM!” aparece depois de ${ESPERA_DO_PROFESSOR_MS / 60_000} min de espera (apareceu ${(esperou / 1000).toFixed(0)} s depois do feed)`,
    );
    const travada = (await lerApi(pa, "/enigma-capa/sessao")).corpo;
    const tentarFurar = await postarNaApi(pa, "/enigma-capa/invariantes", { fotoId: "foto-1", x: alvos["inv-1"].x, y: alvos["inv-1"].y });
    r.exigir(
      travada?.passo === "feed" && travada?.fase === "aberta" && travada?.aguardandoVirada === true,
      `a tela continua travada: passo “${travada?.passo}”, fase “${travada?.fase}”, aguardando a virada`,
    );
    r.exigir(
      tentarFurar.status === 409 && JSON.stringify(tentarFurar.corpo ?? {}).includes("virada-nao-liberada"),
      `nem a api deixa furar: um toque na busca antes da virada responde ${tentarFurar.status} virada-nao-liberada`,
    );
    r.exigir((await qa.getByText("TOQUE EM 2 COISAS IGUAIS").count()) === 0 && (await qa.getByText("AGUARDE O PROFESSOR").count()) >= 1, "o cadeado AGUARDE O PROFESSOR continua, sem a tela dividida");
    await r.registrar(pa, "o-professor-ja-vem", {
      titulo: "O PROFESSOR JÁ VEM!",
      mostra: "Depois de 3 min no cadeado, Bento e Iara ganham o balão “O PROFESSOR JÁ VEM!” — e nenhum botão.",
      prova: "A espera longa tranquiliza sem abrir nada: quem libera a virada é a professora, e a api recusa o toque antes dela.",
    });

    // ═══ PROFESSORA: a virada geral ════════════════════════════════════════
    await prof.goto(`${FICHA}/resultados?turmaId=${turmaId}&pacote=${atividadeId}`, { waitUntil: "domcontentloaded" });
    await prof.locator("[data-lousa]").waitFor({ timeout: 30_000 });
    await esperarNaApi(prof, `${daTurma}/painel`, (c) => c?.resumo?.aguardandoVirada >= 2, { oQue: "as duas aguardarem a virada" });
    const liberar = prof.locator('[data-acao="liberar-virada"]');
    await hidratado(prof, liberar);
    await liberar.click();
    const dialogo = prof.getByRole("dialog", { name: "Liberar a virada para a turma toda?" });
    await dialogo.waitFor({ timeout: 10_000 });
    await dialogo.getByRole("button", { name: "LIBERAR VIRADA" }).click();
    await prof.getByRole("button", { name: "Virada liberada" }).waitFor({ timeout: 20_000 });

    // ═══ A CRIANÇA CERTA: a busca sem erro, até SÓ UM PEDAÇO ═══════════════════════════
    await qa.getByText("TOQUE EM 2 COISAS IGUAIS").first().waitFor({ timeout: 20_000 });
    const achadosDaCerta = await acharOsQuatro(pa, qa);
    r.exigir(
      achadosDaCerta.at(-1)?.completo === true && achadosDaCerta.at(-1)?.erros === 0 && achadosDaCerta.at(-1)?.ajuda === false,
      `${certa.nome} acha os quatro sem errar (erros ${achadosDaCerta.at(-1)?.erros}, sem ajuda)`,
    );
    r.exigir(await ateAHorta(pa, qa), `${certa.nome}: slider, “fora”, par e segunda foto gravados`);
    const votoDaCerta = await comResposta(pa, /\/enigma-capa\/transferencia$/, () => qa.getByRole("button", { name: /SÓ UM PEDAÇO$/ }).click());
    r.exigir(votoDaCerta.corpo?.transferencia?.voto === "so-um-pedaco" && votoDaCerta.corpo?.passo === "concluida", `${certa.nome} vota SÓ UM PEDAÇO e conclui`);
    await qa.getByText("MISSÃO CUMPRIDA!").first().waitFor({ timeout: 10_000 });

    // ═══ A APRESSADA: a ajuda depois de 3 erros, e mais 3 erros depois dela ════════
    await qb.getByText("TOQUE EM 2 COISAS IGUAIS").first().waitFor({ timeout: 20_000 });
    const errosAntes = [];
    for (const [f, ponto] of TOQUES_ERRADOS.slice(0, 3)) errosAntes.push(await tocarNa(pb, qb, f, ponto));
    const terceiro = errosAntes.at(-1);
    r.exigir(
      errosAntes.slice(0, 2).every((t) => t?.acerto === null && t?.ajuda === false && !("alvos" in t)),
      "os dois primeiros erros não acendem nada, e a resposta não traz alvo nenhum (gabarito no servidor)",
    );
    r.exigir(
      terceiro?.acerto === null && terceiro?.erros === 3 && terceiro?.ajuda === true && terceiro?.alvos?.length === 2 &&
        terceiro.alvos.every((a) => alvos[a.id] && Math.abs(a.x - alvos[a.id].x) < 0.01 && Math.abs(a.y - alvos[a.id].y) < 0.01),
      `o 3º erro acende a ajuda: ajuda = ${terceiro?.ajuda}, e o servidor manda os alvos (${(terceiro?.alvos ?? []).map((a) => `${a.id} x=${a.x} y=${a.y}`).join("; ")})`,
    );
    const comAjuda = (await lerApi(pb, "/enigma-capa/sessao")).corpo?.invariantes;
    r.exigir(comAjuda?.ajuda === true && comAjuda?.alvos?.length === 2, "o estado da sessão também traz ajuda: true e os dois alvos (um F5 não apaga o pulso)");
    await qb.locator("circle.pulso-amarelo").nth(3).waitFor({ state: "attached", timeout: 5000 });
    r.exigir((await qb.locator("circle.pulso-amarelo").count()) === 4, "o pulso amarelo aparece nos dois objetos das duas fotos (4 alvos)");
    await r.registrar(pb, "a-ajuda-acende", {
      titulo: "Três erros: a ajuda acende",
      mostra: "O relógio e o cartaz amarelo pulsam em amarelo nas duas fotos, nos lugares que o servidor mandou.",
      prova: "Antes do 3º erro o alvo nunca desce; depois dele, desce — o pulso precisa do lugar (one-pager §7).",
    });
    for (const [f, ponto] of TOQUES_ERRADOS.slice(3)) await tocarNa(pb, qb, f, ponto);
    const posAjuda = linhaDe((await lerApi(prof, `${daTurma}/painel`)).corpo, apressada)?.invariantes;
    r.exigir(
      posAjuda?.ajuda === true && posAjuda?.erros === 3 && posAjuda?.errosPosAjuda === 3 && posAjuda?.encontrados === 0,
      `mais 3 erros DEPOIS da ajuda contam à parte (erros ${posAjuda?.erros}, depois da ajuda ${posAjuda?.errosPosAjuda})`,
    );
    const achadosDaApressada = await acharOsQuatro(pb, qb);
    r.exigir(achadosDaApressada.at(-1)?.completo === true, `com o pulso, ${apressada.nome} acha os quatro e o fluxo segue`);
    r.exigir(await ateAHorta(pb, qb), `${apressada.nome}: slider, “fora”, par e segunda foto gravados`);

    // ═══ A APRESSADA: MOSTRA TUDO ══════════════════════════════════════════════════
    await r.registrar(pb, "a-horta-da-apressada", {
      titulo: "A HORTA ACABOU?",
      mostra: "A lagarta na alface e os dois botões: SÓ UM PEDAÇO e MOSTRA TUDO.",
      prova: "A transferência para um cenário novo — o voto é o descritor central da EF02CO05.",
    });
    const votoDaApressada = await comResposta(pb, /\/enigma-capa\/transferencia$/, () => qb.getByRole("button", { name: /MOSTRA TUDO$/ }).click());
    r.exigir(
      votoDaApressada.corpo?.transferencia?.voto === "mostra-tudo" && votoDaApressada.corpo?.passo === "concluida",
      `💥 MOSTRA TUDO: o voto grava e conclui (${votoDaApressada.corpo?.passo})`,
    );
    await qb.getByText("SELEÇÃO ENVIADA").first().waitFor({ timeout: 10_000 });
    const trocarVoto = await postarNaApi(pb, "/enigma-capa/transferencia", { opcao: "so-um-pedaco" });
    const depoisDaTroca = (await lerApi(pb, "/enigma-capa/sessao")).corpo;
    r.exigir(
      trocarVoto.status === 409 && JSON.stringify(trocarVoto.corpo ?? {}).includes("ja-enviado") && depoisDaTroca?.transferencia?.voto === "mostra-tudo",
      `LATCH 2: trocar para SÓ UM PEDAÇO depois responde ${trocarVoto.status} ja-enviado, e o voto continua “${depoisDaTroca?.transferencia?.voto}”`,
    );
    await r.registrar(pb, "selecao-enviada", {
      titulo: "💥 MOSTRA TUDO — SELEÇÃO ENVIADA",
      mostra: "A enquete travada com o sinal em MOSTRA TUDO, e a celebração da missão cumprida.",
      prova: "O voto é o LATCH 2: não volta, nem pela tela nem pela api (409 ja-enviado).",
    });

    // ═══ PROFESSORA: a régua das duas ══════════════════════════════════════
    const caminhoDaEvidencia = `/evidencias/turma/${turmaId}/missao/${EXP_ID}/atividade/${atividadeId}`;
    const nivelDe = (c, quem, codigo) => c?.estudantes?.find((x) => x.nome === quem.nome)?.porRodada?.[String(rodada)]?.[codigo]?.status ?? null;
    const evidencia = await esperarNaApi(
      prof,
      caminhoDaEvidencia,
      (c) => [certa, apressada].every((q) => nivelDe(c, q, "EF02CO05") !== null && nivelDe(c, q, "EF02CO01") !== null),
      { oQue: "as marcas das duas crianças" },
    );
    const final = (await lerApi(prof, `${daTurma}/painel`)).corpo;
    const lb = linhaDe(final, apressada);
    r.exigir(
      lb?.lupa?.alertas === 2 && lb?.capa?.seloCoerente === false && lb?.invariantes?.errosPosAjuda >= 3 && lb?.voto === "mostra-tudo",
      `a linha de ${apressada.nome}: lupa com ${lb?.lupa?.alertas} alertas, selo incoerente, ${lb?.invariantes?.errosPosAjuda} erros depois da ajuda, MOSTRA TUDO`,
    );
    r.exigir(
      nivelDe(evidencia, apressada, "EF02CO05") === "nao_atingiu",
      `EF02CO05 de ${apressada.nome}: “${nivelDe(evidencia, apressada, "EF02CO05")}” — MOSTRA TUDO e mais um ausente (selo, lupa e busca) = não atingiu`,
    );
    r.exigir(
      nivelDe(evidencia, apressada, "EF02CO01") === "nao_atingiu",
      `EF02CO01 de ${apressada.nome}: “${nivelDe(evidencia, apressada, "EF02CO01")}” — 3 erros depois da ajuda = não atingiu`,
    );
    r.exigir(nivelDe(evidencia, certa, "EF02CO05") === "atingiu", `EF02CO05 de ${certa.nome}: “${nivelDe(evidencia, certa, "EF02CO05")}” — os quatro plenos`);
    r.exigir(nivelDe(evidencia, certa, "EF02CO01") === "atingiu", `EF02CO01 de ${certa.nome}: “${nivelDe(evidencia, certa, "EF02CO01")}” — achou sem a ajuda`);
    await prof.reload({ waitUntil: "domcontentloaded" });
    const habilidades = prof.locator("[data-habilidades-enigma-capa]");
    await revelar(prof, habilidades);
    await habilidades.waitFor({ timeout: 30_000 });
    await prof.waitForFunction(
      (nomes) => nomes.every((n) => (document.querySelector("[data-habilidades-enigma-capa]")?.innerText ?? "").includes(n)),
      [certa.nome, apressada.nome],
      { timeout: 20_000 },
    ).catch(() => {});
    /* A tabela do "Resultado da atividade": a linha de cada uma, com o rótulo do nível nas duas colunas. */
    const linhaNaTabela = (raiz, quem) => raiz.locator("tr", { hasText: quem.nome }).first();
    const contar = (texto, rotulo) => texto.split(rotulo).length - 1;
    const naTelaCerta = await linhaNaTabela(habilidades, certa).innerText();
    const naTelaApressada = await linhaNaTabela(habilidades, apressada).innerText();
    r.exigir(
      contar(naTelaCerta, "Atingiu") === 2 && !/Não atingiu|Em processo/.test(naTelaCerta),
      `na tela, ${certa.nome}: “Atingiu” nas duas habilidades`,
    );
    r.exigir(contar(naTelaApressada, "Não atingiu") === 2, `na tela, ${apressada.nome}: “Não atingiu” nas duas habilidades`);
    await habilidades.scrollIntoViewIfNeeded();
    await linhaNaTabela(habilidades, apressada).scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-das-duas", {
      titulo: "As habilidades das duas crianças",
      mostra: `${certa.nome}: EF02CO05 e EF02CO01 atingidas. ${apressada.nome}: as duas não atingidas.`,
      prova: "A régua é 100% Canal A: a lupa, o selo, a busca e o voto decidem o nível — a crença de entrada (MOSTRA TUDO) com mais um sinal ausente.",
      inteira: true,
    });

    // ═══ PROFESSORA: zerar a turma ═════════════════════════════════════════
    const zerar = prof.locator("[data-zerar-turma]");
    await revelar(prof, zerar);
    await zerar.waitFor({ timeout: 30_000 });
    const botaoZerar = zerar.getByRole("button", { name: "Zerar Turma para Nova Aplicação" });
    await hidratado(prof, botaoZerar);
    await botaoZerar.click();
    const confirmacao = prof.getByRole("dialog", { name: /para nova aplicação\?$/ });
    await confirmacao.waitFor({ timeout: 10_000 });
    const confirmar = confirmacao.getByRole("button", { name: "Zerar a turma" });
    r.exigir(await confirmar.isDisabled(), "“Zerar a turma” só habilita depois de marcar que entendeu");
    /* Pelo rótulo: o `<input>` do Checkbox do DS é só para leitor de tela (`sr-input`), fora da área visível. */
    await confirmacao.getByText("Entendi: a turma recomeça do crachá numa rodada nova.").click();
    await confirmar.waitFor({ state: "visible" });
    r.exigir(!(await confirmar.isDisabled()), "com o “Entendi” marcado, “Zerar a turma” habilita");
    await r.registrar(prof, "confirmar-o-zerar", {
      titulo: "Zerar a turma para nova aplicação?",
      mostra: `A confirmação: a ${rodada + 1}ª rodada com a mesma atividade, a virada fechada de novo e as habilidades apagadas do painel.`,
      prova: "Destrutivo, então explícito: o botão só habilita com o “Entendi”, e o texto diz o que some e o que fica.",
    });
    await confirmar.click();
    await esperarOuFalharCedo(prof.getByText(`recomeçou na ${rodada + 1}ª rodada`).first(), confirmacao.locator(ALERTA_DE_ERRO), {
      timeout: 20_000,
      oQue: "zerar a turma",
    });

    const depois = await lerApi(prof, `${daTurma}/pacotes`);
    r.exigir(
      depois.corpo?.emAndamento?.pacoteId === atividadeId && depois.corpo?.emAndamento?.rodada === rodada + 1,
      `a rodada sobe: a mesma atividade agora na rodada ${depois.corpo?.emAndamento?.rodada} (era ${rodada})`,
    );
    const evidenciaDepois = (await lerApi(prof, caminhoDaEvidencia)).corpo;
    const restou = (evidenciaDepois?.estudantes ?? []).filter((e) => Object.keys(e.porRodada ?? {}).length > 0);
    r.exigir(
      (evidenciaDepois?.rodadas ?? ["?"]).length === 0 && restou.length === 0,
      `a evidência da atividade foi APAGADA (ADR-155): ${evidenciaDepois?.rodadas?.length ?? "?"} rodada(s) com marca, ${restou.length} estudante(s) com nível`,
    );
    const painelDepois = (await lerApi(prof, `${daTurma}/painel`)).corpo;
    r.exigir(
      painelDepois?.fase === "aberta" && painelDepois?.atividade?.rodada === rodada + 1 && painelDepois?.resumo?.entraram === 0,
      `a virada fecha: fase “${painelDepois?.fase}”, rodada ${painelDepois?.atividade?.rodada}, ninguém entrou ainda`,
    );
    const gateDaCerta = (await lerApi(pa, "/enigma-capa/gate")).corpo;
    r.exigir(gateDaCerta?.passo === "cracha" && gateDaCerta?.fase === "aberta" && gateDaCerta?.rodada === rodada + 1, `para ${certa.nome}, a api devolve o crachá na rodada ${gateDaCerta?.rodada}`);
    await prof.reload({ waitUntil: "domcontentloaded" });
    const habilidadesDepois = prof.locator("[data-habilidades-enigma-capa]");
    await revelar(prof, habilidadesDepois);
    await habilidadesDepois.waitFor({ timeout: 30_000 });
    await habilidadesDepois.scrollIntoViewIfNeeded();
    for (const quem of [certa, apressada]) {
      const texto = await linhaNaTabela(habilidadesDepois, quem).innerText();
      r.exigir(contar(texto, "Não avaliado") === 2, `na tela, depois do zerar, ${quem.nome}: “Não avaliado” nas duas habilidades`);
    }
    await linhaNaTabela(habilidadesDepois, apressada).scrollIntoViewIfNeeded();
    await r.registrar(prof, "habilidades-zeradas", {
      titulo: "Depois do zerar: as habilidades em branco",
      mostra: "A aba Habilidades sem nível nenhum: a rodada nova avalia a turma do zero.",
      prova: "O zerar apaga a evidência DA ATIVIDADE (todas as rodadas); as sessões da rodada anterior ficam guardadas.",
      inteira: true,
    });

    /* A criança, ao recarregar, volta ao começo; a outra volta pelo polling, sem recarregar. */
    await pa.reload({ waitUntil: "domcontentloaded" });
    await pa.frameLocator("iframe[data-experiencia]").getByText("ESCOLHA SEU CRACHÁ", { exact: true }).waitFor({ timeout: 40_000 });
    await r.registrar(pa, "de-volta-ao-cracha", {
      titulo: "De volta ao crachá",
      mostra: `${certa.nome} recarrega e está no começo: ESCOLHA SEU CRACHÁ, na rodada ${rodada + 1}.`,
      prova: "O passo é derivado do servidor: rodada nova sem sessão é o crachá.",
    });
    await qb.getByText("ESCOLHA SEU CRACHÁ", { exact: true }).waitFor({ timeout: 20_000 });
    r.exigir(true, `${apressada.nome}, sem recarregar, voltou ao crachá pelo polling de 3 s`);
  },
);
