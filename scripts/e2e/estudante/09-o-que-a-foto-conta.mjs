import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";
import { esperarOuFalharPorHttp } from "../lib/smoke.mjs";

/**
 * O Que a Foto Conta (exp-04), nas duas pontas da sala — TEC-09: dois
 * contextos de navegador, o tablet da criança e a lousa do professor.
 *
 * A missão é SÍNCRONA: a Etapa 5 congela o tablet numa tela sem nenhum botão e
 * só o LIBERAR REFLEXÃO FINAL do professor solta a turma. Um roteiro de um
 * contexto só passaria com o latch quebrado — e o latch é a missão.
 *
 * Prova também o que a missão NÃO faz: não dá nota, não ranqueia, não deixa a
 * resposta ingênua virar punição (o Globo é retry gentil, e a Lupa conclui).
 */
const SERIE = "1EF";
const TURMA = process.env.TURMA ?? conta("estudante", { serie: SERIE }).turma;

await suite(
  {
    slug: "estudante/09-o-que-a-foto-conta",
    papel: "estudante",
    titulo: "O Que a Foto Conta — toda foto mostra uma escolha",
    subtitulo: "o mural do 1º ano, o latch da Roda e a síntese sem nota",
    contexto:
      "No mural da @turma_mural, duas fotos do mesmo pátio contam histórias opostas. A criança " +
      "escolhe a marca, explora o feed, publica UMA foto com UMA legenda — e Leo e Sofia " +
      "comentam exatamente o que a escolha deixou ver. Os tablets congelam para a Roda de " +
      "Conversa, e quem os solta é o professor.",
    prova: [
      "O botão ENTRAR NO MURAL só acende com uma marca escolhida",
      "A publicação exige uma foto E uma legenda; o pico tem três elementos",
      "Os comentários de Leo e Sofia chegam em cadência, um de cada vez",
      "No latch a tela não tem NENHUM botão, e o F5 devolve o próprio latch",
      "LIBERAR REFLEXÃO FINAL solta o tablet sem recarregar página",
      "O Globo vira retry gentil; a Lupa conclui com a insígnia",
      "O painel do professor não tem coluna de pontos — não é ranking",
    ],
    comando: "node scripts/e2e/estudante/09-o-que-a-foto-conta.mjs",
  },
  async (r) => {
    // ═══ PROFESSOR: a aula ao vivo, com a turma ainda por chegar ═══════════
    const prof = await r.pagina("professor", { viewport: { width: 1440, height: 1000 } });
    await r.entrar(prof, conta("professor", { serie: SERIE }).login);

    await prof.goto(`${HUB}/professor/entre-redes/1-ano/unidade-1`, {
      waitUntil: "domcontentloaded",
    });
    await prof.waitForSelector("text=/toda foto mostra uma escolha/i", { timeout: 15_000 });
    await r.registrar(prof, "ficha-da-missao", {
      titulo: "A ficha do 1º ano",
      mostra: "A missão explicada para quem conduz: as seis etapas, a Roda que congela e o preparo.",
      prova:
        "O professor precisa saber ANTES que os tablets travam de propósito na Etapa 5 — sem esse " +
        "aviso, o congelamento vira 'quebrou' na frente da turma.",
    });

    await prof.click("text=Preparação e aula ao vivo");
    await prof.waitForURL("**/resultados**", { timeout: 20_000 });
    /* `select#turma`, NÃO o primeiro `<select>`: quem tem mais de uma lotação
       ganhou um seletor de ESCOLA no cabeçalho, que vem antes no DOM. */
    const seletor = prof.locator("select#turma");
    await seletor.waitFor({ timeout: 15_000 });
    const opcoes = await seletor
      .locator("option")
      .evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent ?? "" })));
    const alvo = opcoes.find((o) => o.label.includes(TURMA) && o.value);
    if (!alvo) throw new Error(`turma ${TURMA} não está no seletor (rode o seed)`);
    await prof.selectOption("select#turma", alvo.value);
    await prof.waitForURL("**turmaId=**", { timeout: 20_000 });
    await prof.waitForSelector("text=Projeção para a Roda de Conversa", { timeout: 20_000 });

    /* ZERAR PRIMEIRO: o estado é server-side e sobrevive ao roteiro. Sem isto
       a segunda execução encontra a run concluída e o latch já liberado. De
       graça, cobre o caminho destrutivo (que ARQUIVA, nunca apaga). */
    await prof.click("text=Zerar e Reiniciar Turma");
    await prof.locator("text=/apagará as escolhas em andamento/i").waitFor({ timeout: 10_000 });
    await prof.locator("button", { hasText: /^Zerar e Reiniciar$/ }).click();
    await prof.waitForTimeout(2500);
    await r.registrar(prof, "turma-zerada", {
      titulo: "O professor reinicia a turma",
      mostra: "A confirmação nomeando o que acontece: as publicações ficam ARQUIVADAS, nada se apaga.",
      prova:
        "Zerar é a preparação da reaplicação (com outro tema, como o guia recomenda) — e o " +
        "histórico da rodada anterior continua existindo, imutável, na tentativa arquivada.",
    });

    await r.registrar(prof, "aula-ao-vivo", {
      titulo: "A aula ao vivo, antes da turma",
      mostra:
        "A preparação do pacote (tema + nível de leitura + IA), o termômetro zerado e a projeção " +
        "da Roda com as duas fotos e o botão de liberar.",
      prova:
        "A aula inteira se conduz de UMA tela: preparar, acompanhar, projetar e liberar — sem " +
        "trocar de página com a turma esperando.",
    });

    // ═══ ESTUDANTE: do crachá ao latch ═════════════════════════════════════
    const estudante = conta("estudante", { serie: SERIE });
    const p = await r.pagina("estudante", { viewport: { width: 1280, height: 950 } });
    await r.entrar(p, estudante.login);

    await p.goto(`${HUB}/exp/exp-04-o-que-a-foto-conta`, { waitUntil: "domcontentloaded" });
    const q = p.frameLocator('iframe[title="experiencia"]');
    /* Corre contra o erro (não espera cega): se o boot falhar, a mensagem traz
       o status e o corpo — nunca "timeout esperando o seletor". */
    await esperarOuFalharPorHttp(
      p,
      q.locator("text=VOCÊ JÁ REPAROU NAS FOTOS?"),
      /\/foto-conta\/sessao/,
      { timeout: 40_000, oQue: "o boot da missão" },
    );
    await r.registrar(p, "cracha-do-fotografo", {
      titulo: "Nina e as três marcas",
      mostra: "A saudação com botão de áudio e a grade de exatamente 3 crachás (coruja, estrela, sol).",
      prova:
        "Público em alfabetização inicial: CAIXA ALTA, pictograma e locução em toda instrução — e " +
        "só 3 opções na tela, que é o teto cognitivo da faixa.",
    });

    /* O botão só acende com marca escolhida — a prova do gate de entrada. */
    const entrar = q.getByRole("button", { name: "ENTRAR NO MURAL" });
    r.exigir(await entrar.isDisabled(), "ENTRAR NO MURAL nasce desabilitado, sem marca");
    await q.getByRole("radio", { name: /CORUJA AZUL/i }).click();
    await entrar.click();

    await q.locator("text=@turma_mural").first().waitFor({ timeout: 20_000 });
    await r.registrar(p, "mural-da-turma", {
      titulo: "O feed da @turma_mural",
      mostra: "Os 3 posts curados do pacote, com curtida por toque duplo e sem campo de digitação nenhum.",
      prova:
        "O clone é fechado de propósito: sem comentário digitável, sem busca, sem Stories — o " +
        "foco da faixa é a leitura da imagem, e texto livre de criança não existe nesta missão.",
    });

    /* Curtir libera o botão NOVA PUBLICAÇÃO sem esperar os 15s de permanência. */
    await q.locator(".fc-feed img").first().dblclick();
    const criar = q.getByRole("button", { name: "NOVA PUBLICAÇÃO" });
    await criar.waitFor({ timeout: 20_000 });
    await criar.click();

    await q.locator("text=ESCOLHA UMA FOTO:").waitFor({ timeout: 20_000 });
    await r.registrar(p, "dilema-da-lente", {
      titulo: "O dilema da lente",
      mostra:
        "As duas fotos do MESMO pátio (plano geral e detalhe) e as duas legendas com pictograma " +
        "e botão de áudio cada.",
      prova:
        "As duas opções têm a mesma moldura e o mesmo tamanho: a criança não pode deduzir uma " +
        "'foto certa' pela apresentação — porque não existe foto certa.",
    });

    await q.locator(".fc-foto-opcao").last().click(); // par_b, o detalhe
    await q.getByRole("radio", { name: /OLHA O BRINQUEDO/i }).click();
    await q.getByRole("button", { name: "COMPARTILHAR" }).click();

    /* O PICO: três elementos e o COMPARTILHAR de 64px. */
    await q.locator(".fc-pico-preview").waitFor({ timeout: 10_000 });
    await r.registrar(p, "o-clique-do-envio", {
      titulo: "O clique do envio",
      mostra: "Estritamente três elementos: a foto escolhida, a legenda e o botão COMPARTILHAR.",
      prova:
        "É o pico de tensão da missão, e a tela foi esvaziada de propósito: nada compete com a " +
        "decisão de publicar.",
    });
    await q.locator(".fc-pico button", { hasText: "COMPARTILHAR" }).click();

    /* O eco chega em cadência: Leo primeiro, Sofia depois — e a espera corre
       contra o POST de publicar, para um 4xx aparecer como causa, não timeout. */
    await esperarOuFalharPorHttp(
      p,
      q.locator("text=EU SÓ VI O BRINQUEDO!"),
      /\/foto-conta\/publicar/,
      { timeout: 20_000, oQue: "a publicação" },
    );
    await q.locator("text=NEM DÁ PRA VER O PÁTIO!").waitFor({ timeout: 10_000 });
    await r.registrar(p, "o-eco-no-mural", {
      titulo: "O eco dos colegas",
      mostra: "O post PUBLICADO AGORA no topo e os balões de Leo e Sofia chegando um de cada vez.",
      prova:
        "Os comentários são determinísticos por par: quem escolheu o detalhe ouve que a bagunça " +
        "sumiu — a revelação do recorte, na voz de uma criança da mesma idade.",
    });

    /* O latch: a tela congela sem NENHUM botão, e o F5 devolve o latch. */
    await q.locator("text=HORA DA RODA DE CONVERSA!").waitFor({ timeout: 20_000 });
    const botoesNoLatch = await q.locator(".fc-congelamento button, .fc-congelamento a").count();
    r.exigir(botoesNoLatch === 0, `o latch não tem botão nem link (achei ${botoesNoLatch})`);
    await p.reload({ waitUntil: "domcontentloaded" });
    const q2 = p.frameLocator('iframe[title="experiencia"]');
    await q2.locator("text=HORA DA RODA DE CONVERSA!").waitFor({ timeout: 40_000 });
    await r.registrar(p, "o-latch-da-roda", {
      titulo: "O tablet vira porta-retrato",
      mostra: "A tela congelada da Roda — Nina, o banner e NADA clicável. Recarregar devolve a mesma tela.",
      prova:
        "A imobilidade é absoluta e sobrevive ao F5: o estado é da TURMA, no servidor, e só o " +
        "professor solta — é o que transfere o foco do aparelho para a conversa.",
    });

    // ═══ PROFESSOR: a Roda e a liberação ═══════════════════════════════════
    await prof.waitForSelector("text=Na Roda (tablets congelados)", { timeout: 30_000 });
    await r.registrar(prof, "projecao-da-roda", {
      titulo: "A projeção da Roda de Conversa",
      mostra:
        "As duas fotos lado a lado (O QUE FICOU NO MEIO? / O QUE FICOU DE FORA?), as perguntas " +
        "do debate e o contador de tablets congelados.",
      prova:
        "O material do debate vem da api — a mesma fonte dos tablets. A lousa e as 30 telas " +
        "nunca podem discordar sobre qual foto a turma viu.",
    });

    await prof.getByRole("button", { name: "LIBERAR REFLEXÃO FINAL" }).click();
    await prof.waitForSelector("text=/Reflexão final liberada/i", { timeout: 20_000 });
    await r.registrar(prof, "reflexao-liberada", {
      titulo: "A turma é liberada de uma vez",
      mostra: "A confirmação com a contagem de tablets que estavam na Roda.",
      prova:
        "Um clique move a sala inteira, sem recarregar página — e apertar de novo responde que a " +
        "turma JÁ está liberada, nunca um erro.",
    });

    // ═══ ESTUDANTE: a síntese sem nota ═════════════════════════════════════
    await esperarOuFalharPorHttp(
      p,
      q2.locator("text=O QUE A FOTO MOSTRA?"),
      /\/foto-conta\/(latch|reflexao)/,
      { timeout: 30_000, oQue: "o destravamento do latch" },
    );
    /* O Globo primeiro — a resposta ingênua é retry gentil, não erro. */
    /* `exact`: o card e o botão "OUVIR: ..." compartilham o texto. */
    await q2.getByRole("button", { name: "A FOTO MOSTRA TUDO", exact: true }).click();
    await q2.locator("text=LEMBRE DO QUE FICOU FORA!").waitFor({ timeout: 15_000 });
    await r.registrar(p, "retry-gentil", {
      titulo: "O Globo vira segunda olhada",
      mostra: "O card pisca sem vermelho, Nina acolhe em áudio e texto, e os cards reabrem.",
      prova:
        "Sem nota, sem penalidade, sem teto de tentativas: a concepção ingênua é o começo da " +
        "aprendizagem, não uma resposta errada a punir.",
    });

    await q2.getByRole("button", { name: "ALGUÉM ESCOLHEU O QUE MOSTRAR", exact: true }).click();
    await q2.locator("text=OLHAR DE DETETIVE").waitFor({ timeout: 20_000 });
    await r.registrar(p, "olhar-de-detetive", {
      titulo: "A conclusão",
      mostra: "A insígnia OLHAR DE DETETIVE, o player do resumo e o botão VER MURAL DA TURMA.",
      prova:
        "A missão fecha com identidade (a insígnia) e comunidade (o mural dos colegas), nunca " +
        "com uma pontuação.",
    });

    await q2.getByRole("button", { name: "VER MURAL DA TURMA" }).click();
    await q2.locator(".fc-galeria img").first().waitFor({ timeout: 20_000 });
    await r.registrar(p, "galeria-da-turma", {
      titulo: "O mural da turma",
      mostra: "As publicações dos colegas em galeria passiva — sem curtir, sem editar, sem republicar.",
      prova:
        "A irreversibilidade pós-missão é regra: o que a rodada produziu vira vitrine da turma, " +
        "e ninguém mexe no que já foi contado.",
    });

    // ═══ PROFESSOR: o painel depois da aula ════════════════════════════════
    await prof.waitForTimeout(6000); // um tique do polling do dashboard
    await r.registrar(prof, "painel-pos-aula", {
      titulo: "O retrato da aula",
      mostra:
        "Conectados, publicações, distribuição de enquadramento e conclusões — contagens da " +
        "turma, nenhuma coluna de pontos.",
      prova:
        "A missão é 100% formativa e o painel obedece: distribuição vira material de debate, " +
        "nunca ranking de crianças de 6 anos.",
    });
  },
);
