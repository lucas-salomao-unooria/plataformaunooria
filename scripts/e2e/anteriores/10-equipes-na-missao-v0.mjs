import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta, contasDe } from "../lib/credenciais.mjs";
import { ALERTA_DE_ERRO, esperarOuFalharCedo } from "../lib/smoke.mjs";

/**
 * EQUIPES NA MISSÃO (E13): quando estudantes dividem um computador, o
 * professor monta as equipes na ficha da missão, na turma.
 *
 * O que esta suíte cobra e nenhuma outra cobre:
 *
 *  - a seção só existe na ficha aberta COM turma e numa missão que a api aceita
 *    (`permitida`) — aqui o unooGPT, da 2ª série do EM (o UnooTube, do 4º ano,
 *    fazia este papel até ser ARQUIVADO, ADR-116);
 *  - a plataforma SEMPRE pergunta como montar: sortear ou "Eu separo". O
 *    sorteio distribui por tamanho (diferença de no máximo 1); o "Eu separo"
 *    cria as equipes vazias;
 *  - salvar grava de verdade: a SALA da turma passa a mostrar a tag "N equipes
 *    prontas" — uma tag, não um link (ADR-100);
 *  - "Mostrar equipes", a tela que vai para o projetor, tem o nome da equipe e
 *    o PRIMEIRO nome de cada estudante, e mais nada;
 *  - a faixa "Sua equipe" chega ao ESTUDANTE, acima do aparelho;
 *  - na ficha de Quem mandou isso? (exp05ef1b, 5º ano) a seção de equipes NÃO
 *    existe mais: a equipe é de cada atividade (ADR-130) e mora na página
 *    dela; a ficha mostra a lista das atividades. Só leitura: nada é salvo ali.
 *
 * FIXTURE. O fluxo da professora roda na 2EM-B, e termina DESFAZENDO: o estado
 * final é o inicial, então rodar de novo prova a mesma coisa. Nenhuma missão é
 * liberada na 2EM-B — as turmas "B" ficam fechadas para a `professor/01` exercitar
 * o liberar. A faixa do estudante precisa de missão ABERTA, e por isso usa a 2EM-A
 * (o seed libera o unooGPT lá): as equipes entram pelo BFF, com a sessão da
 * professora da 2EM-A, e saem no fim — inclusive quando a suíte quebra no meio.
 */
const TURMA = process.env.TURMA_EQUIPES ?? "2EM-B";
const TURMA_ABERTA = process.env.TURMA_EQUIPES_ABERTA ?? "2EM-A";
const EXP_ID = "exp02em1b-v0";
const FICHA = `${HUB}/professor/entre-redes/2-serie/unidade-1`;
const COMPUTADORES = 10;

/** O docente precisa LECIONAR na turma: `conta` casa o começo da coluna, e ela pode ser "2EM-A + 2EM-B". */
const professorDa = (turma) =>
  contasDe("professor").find((c) => c.turma.split(" + ").includes(turma)) ?? conta("professor", { turma });

/* O unooGPT é a missão SEM atividade (ADR-130): uma montagem por turma, com o
   id fixo `turma` — e é por isso que ela continua montando equipes na ficha. */
const rotaDasEquipes = (turmaId) => `${BFF}/equipes/turma/${turmaId}/missao/${EXP_ID}/atividade/turma`;

async function idDaTurma(p, nome) {
  const resposta = await p.request.get(`${BFF}/turmas/minhas`);
  const turmas = resposta.ok() ? await resposta.json() : [];
  return (Array.isArray(turmas) ? turmas : []).find((t) => t.nome === nome)?.id ?? null;
}

async function lerEquipes(p, turmaId) {
  const resposta = await p.request.get(rotaDasEquipes(turmaId));
  return resposta.ok() ? resposta.json() : null;
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

/** Leva o `NumberButton` ao valor pelos botões do próprio componente — sem depender do teclado. */
async function ajustarComputadores(p, alvo) {
  const campo = p.getByRole("spinbutton", { name: "Quantos computadores vocês vão usar?" });
  await hidratado(p, campo);
  for (let i = 0; i < 80; i += 1) {
    const atual = Number(await campo.getAttribute("aria-valuenow"));
    if (atual === alvo) return atual;
    await p.getByRole("button", { name: atual > alvo ? "Um computador a menos" : "Um computador a mais" }).click();
    await p.waitForTimeout(60);
  }
  return Number(await campo.getAttribute("aria-valuenow"));
}

await suite(
  {
    slug: "professor/10-equipes-na-missao",
    papel: "professor",
    titulo: "Equipes na missão",
    subtitulo: "quando a turma divide computadores: sortear, separar, mostrar e desfazer",
    contexto:
      "A maioria das escolas não tem um computador por estudante. Na ficha da missão, com a turma, " +
      "o professor diz quantos computadores há e escolhe: a plataforma sorteia as equipes, ou ele " +
      "separa. Quem entra na missão representa a equipe, e cada estudante vê a sua acima do aparelho.",
    prova: [
      "A seção de equipes aparece na ficha aberta pela sala, com a turma",
      "A plataforma sempre pergunta: sortear ou separar",
      "O sorteio divide a turma por computador, com diferença de no máximo 1 entre as equipes",
      "Salvar grava: a sala da turma mostra a tag com o número de equipes prontas",
      "Mostrar equipes traz só o nome da equipe e o primeiro nome de cada estudante",
      '"Eu separo" cria uma equipe vazia por computador',
      "Desfazer apaga as equipes e a turma volta ao estado de antes",
      "O estudante vê a própria equipe numa faixa acima da missão, só com primeiros nomes",
      "A ficha de Quem mandou isso? (5º ano) nasce com a seção de equipes, ao lado das habilidades que ela mede",
    ],
    comando: "node scripts/e2e/professor/10-equipes-na-missao.mjs",
  },
  async (r) => {
    const erroNaTela = (p) => p.locator(ALERTA_DE_ERRO);

    // ── a professora da 2EM-B, na ficha do unooGPT ─────────────────────
    const professora = professorDa(TURMA);
    const p = await r.pagina("professor");
    await r.entrar(p, professora.login);

    const turmaId = await idDaTurma(p, TURMA);
    if (!r.exigir(Boolean(turmaId), `a professora leciona na ${TURMA} (GET /turmas/minhas)`)) return;

    /* Estado de ONTEM não pode reprovar hoje: uma corrida que quebrou no meio
       deixou equipes salvas, e a suíte começaria em "ver" em vez de "montar". */
    await p.request.delete(rotaDasEquipes(turmaId)).catch(() => {});

    try {
      await p.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
      const titulo = p.getByRole("heading", { name: "Equipes desta turma" });
      const apareceu = await titulo
        .waitFor({ timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      if (
        !r.exigir(
          apareceu,
          "a ficha do unooGPT, aberta com a turma, tem a seção Equipes desta turma (a api respondeu permitida)",
        )
      ) {
        return;
      }

      const valor = await ajustarComputadores(p, COMPUTADORES);
      r.exigir(valor === COMPUTADORES, `o campo de computadores ficou em ${valor} (esperado ${COMPUTADORES})`);
      const opcoes = await p.getByRole("radio").count();
      r.exigir(
        (await p.getByRole("radio", { checked: true }).count()) === 0,
        "nenhuma forma de montar vem marcada: a plataforma pergunta",
      );
      await r.registrar(p, "montar-as-equipes", {
        titulo: "Quantos computadores, e como montar",
        mostra: `A seção na ficha da ${TURMA}: ${COMPUTADORES} computadores, a lista de quem faltou e a pergunta — sortear ou "Eu separo".`,
        prova:
          "A pergunta é SEMPRE feita, sem opção marcada: um padrão escolhido pela plataforma viraria a " +
          "resposta de quem não leu. A opção de usar as equipes da atividade anterior só aparece quando a " +
          "turma tem equipes salvas em outra missão.",
        detalhe: `${opcoes} opção(ões) de montagem`,
      });

      // ── sortear ────────────────────────────────────────────────────────
      /* Pelo PAPEL, e não pelo texto: no `RadioGroup` do DS o `<input>` é
         transparente e cobre o `<label>` inteiro (`position: absolute`,
         `z-index: 2`). Clicar no `<span>` do rótulo morre em "<input>
         intercepts pointer events" até o timeout — o span não é o alvo do
         clique, o input é. O nome acessível do input é o `aria-label`, que o
         DS preenche com o próprio rótulo. */
      const sortear = p.getByRole("radio", { name: "Sortear as equipes", exact: true });
      await sortear.click();
      r.exigir(await sortear.isChecked(), "a opção de sorteio ficou marcada");
      await p.getByRole("button", { name: "Continuar", exact: true }).click();
      await esperarOuFalharCedo(p.locator("[data-equipe]").nth(COMPUTADORES - 1), erroNaTela(p), {
        timeout: 30_000,
        oQue: "a sugestão de equipes",
      });
      const cartoes = p.locator("[data-equipe]");
      const tamanhos = [];
      for (let i = 0; i < (await cartoes.count()); i += 1) {
        tamanhos.push(await cartoes.nth(i).getByRole("combobox").count());
      }
      r.exigir(tamanhos.length === COMPUTADORES, `o sorteio devolveu ${tamanhos.length} equipes para ${COMPUTADORES} computadores`);
      r.exigir(
        Math.max(...tamanhos) - Math.min(...tamanhos) <= 1,
        `as equipes têm tamanhos ${tamanhos.join(", ")} — diferença de no máximo 1`,
      );
      await r.registrar(p, "equipes-sorteadas", {
        titulo: "O sorteio, antes de salvar",
        mostra: "Uma equipe por computador, cada estudante com a escolha de mudar de equipe, e o cartão de quem ficou sem equipe.",
        prova:
          "O sorteio NÃO grava: é uma sugestão da api, e o professor ajusta o que quiser antes. O tamanho " +
          "é regra rígida (diferença de no máximo 1); quem fica onde é dele.",
        detalhe: `tamanhos ${tamanhos.join(", ")}`,
        inteira: true,
      });

      // ── salvar ─────────────────────────────────────────────────────────
      await p.getByRole("button", { name: "Salvar equipes", exact: true }).click();
      await esperarOuFalharCedo(p.getByText("Equipes salvas.", { exact: true }), erroNaTela(p), {
        timeout: 20_000,
        oQue: "salvar as equipes",
      });
      const salvas = await lerEquipes(p, turmaId);
      r.exigir(
        salvas?.montagem !== null && salvas?.equipes?.length === COMPUTADORES,
        `o servidor guardou ${salvas?.equipes?.length ?? 0} equipes (GET /equipes/turma/…/missao/${EXP_ID})`,
      );
      await p.getByRole("button", { name: "Mostrar equipes", exact: true }).waitFor({ timeout: 15_000 });
      await r.registrar(p, "equipes-salvas", {
        titulo: "Equipes salvas",
        mostra: 'Os cartões das equipes com o nome completo de cada estudante, e as ações "Mostrar equipes", "Editar equipes", "Refazer" e "Desfazer equipes".',
        prova:
          "Salvar substitui a montagem inteira, com controle de versão: se outra aba salvou antes, a api " +
          "responde 409 e a tela pede para recarregar em vez de apagar o que o outro fez.",
        inteira: true,
      });

      // ── a sala: uma tag, não um link ───────────────────────────────────
      await p.goto(`${HUB}/professor/turmas/${turmaId}`, { waitUntil: "domcontentloaded" });
      const tag = p.getByText(`${COMPUTADORES} equipes prontas`, { exact: true });
      const temTag = await tag
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      r.exigir(temTag, `a sala da ${TURMA} mostra "${COMPUTADORES} equipes prontas" na linha do unooGPT`);
      r.exigir(
        (await p.locator("a", { hasText: "equipes prontas" }).count()) === 0,
        "a contagem é uma tag, não um link (ADR-100)",
      );
      await r.registrar(p, "tag-na-sala", {
        titulo: "A sala sabe que há equipes",
        mostra: `A linha do unooGPT na sala da ${TURMA}, com a tag "${COMPUTADORES} equipes prontas".`,
        prova:
          "A sala faz UMA pergunta por missão — onde fica? — e o caminho é a ficha. Montar e editar " +
          "equipes mora lá; aqui a tag só avisa, e link novo na sala seria o sintoma de a ficha não dar conta.",
      });

      // ── mostrar equipes: a tela do projetor ────────────────────────────
      await p.goto(`${FICHA}?turmaId=${turmaId}`, { waitUntil: "domcontentloaded" });
      const mostrar = p.getByRole("button", { name: "Mostrar equipes", exact: true });
      await hidratado(p, mostrar);
      await mostrar.click();
      /* Pelo PAPEL e pelo NOME: o nome do diálogo é o título, ligado por
         `aria-labelledby`. O `Modal` do DS (0.2.2) só faz essa ligação no atalho
         `title=` — montado com `ModalTitle`, o diálogo nascia SEM nome, o leitor
         de tela anunciava "diálogo" e mais nada, e este seletor esperava até o
         timeout com a janela aberta na foto. Quem liga é a tela
         (`mostrar-equipes.tsx`); se este passo voltar a esperar à toa, é isso. */
      const janela = p.getByRole("dialog", { name: "Equipes", exact: true });
      await janela.waitFor({ timeout: 15_000 });
      const titulos = await janela.locator("h3").count();
      const texto = await janela.innerText();
      const membros = (salvas?.equipes ?? []).flatMap((e) => e.membros);
      const nomesCompletos = membros.map((m) => m.nome).filter((nome) => nome.trim().split(/\s+/).length > 1);
      const vazou = nomesCompletos.filter((nome) => texto.includes(nome));
      /* Cada rótulo projetado desempata: quantos rótulos DIFERENTES há tem de ser
         quantos NOMES diferentes há — sem caixa e sem acento, como a sala lê. Um
         homônimo perfeito conta uma vez dos dois lados, então não reprova. */
      const semAcento = (t) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
      const rotulos = (await janela.locator("section p").allInnerTexts())
        .flatMap((linha) => linha.split(/, | e /))
        .map((rotulo) => rotulo.trim())
        .filter(Boolean);
      const rotulosDistintos = new Set(rotulos.map(semAcento)).size;
      const nomesDistintos = new Set(membros.map((m) => semAcento(m.nome))).size;
      const desempatados = rotulos.filter((rotulo) => /\s/.test(rotulo)).length;
      r.exigir(titulos === COMPUTADORES, `a tela projetada lista as ${titulos} equipes`);
      r.exigir(vazou.length === 0, `nenhum nome completo na tela projetada (${vazou.length} vazaram)`);
      r.exigir(
        rotulos.length === membros.length && rotulosDistintos === nomesDistintos,
        `cada estudante acha o próprio nome: ${rotulosDistintos} rótulos diferentes para ${nomesDistintos} nomes diferentes (${rotulos.length} na tela)`,
      );
      r.exigir(!/faltou|Sem equipe/.test(texto), "nem quem faltou, nem quem ficou sem equipe aparece para a sala");
      await r.registrar(p, "mostrar-equipes", {
        titulo: "Mostrar equipes, para a turma",
        mostra: "A janela em tela quase cheia: o nome de cada equipe em letra grande e o primeiro nome de quem está nela.",
        prova:
          "É a tela que a sala inteira lê. Nome completo, falta e desempenho não entram. Nome que empata " +
          "na turma ganha só o que desempata: a inicial do sobrenome e, se duas ainda ficam iguais " +
          '("Gabriela C."), o último sobrenome inteiro — nunca o nome todo quando algo mais curto separa.',
        detalhe: `${titulos} equipes, ${nomesCompletos.length} nomes conferidos, ${desempatados} desempatados`,
      });
      await janela.getByRole("button", { name: "Fechar", exact: true }).click();
      await janela.waitFor({ state: "hidden", timeout: 10_000 });

      // ── refazer → "Eu separo" ──────────────────────────────────────────
      await p.getByRole("button", { name: "Refazer", exact: true }).click();
      const deNovo = await ajustarComputadores(p, COMPUTADORES);
      r.exigir(deNovo === COMPUTADORES, `o Refazer começa do que está salvo (${deNovo} computadores)`);
      /* Pelo papel, pela mesma razão do sorteio: o input do DS cobre o rótulo. */
      const euSeparo = p.getByRole("radio", { name: "Eu separo", exact: true });
      await euSeparo.click();
      r.exigir(await euSeparo.isChecked(), 'a opção "Eu separo" ficou marcada');
      await p.getByRole("button", { name: "Continuar", exact: true }).click();
      await esperarOuFalharCedo(p.locator("[data-equipe]").nth(COMPUTADORES - 1), erroNaTela(p), {
        timeout: 30_000,
        oQue: 'o "Eu separo"',
      });
      const vazias = await p.getByText("Ninguém nesta equipe ainda.", { exact: true }).count();
      const semEquipe = (await p.getByRole("heading", { name: /^Sem equipe \(\d+\)$/ }).first().innerText()).trim();
      r.exigir(vazias === COMPUTADORES, `"Eu separo" criou ${vazias} equipes vazias`);
      r.exigir(!/\(0\)$/.test(semEquipe), `e a turma inteira espera em "${semEquipe}"`);
      r.exigir(
        (await p.getByRole("button", { name: "Salvar equipes", exact: true }).isDisabled()) === true,
        "com equipe vazia, Salvar fica travado e a tela diz por quê",
      );
      await r.registrar(p, "eu-separo", {
        titulo: '"Eu separo": uma equipe vazia por computador',
        mostra: `${vazias} equipes vazias e ${semEquipe}, cada estudante com a escolha da equipe.`,
        prova:
          "Na separação manual a plataforma não decide ninguém: cria os computadores e o professor põe " +
          "cada estudante num deles. Salvar só destrava quando toda equipe tem alguém.",
        inteira: true,
      });

      /* Cancelar descarta o rascunho: o que está salvo continua o sorteio. */
      await p.getByRole("button", { name: "Cancelar", exact: true }).click();
      await p.getByRole("button", { name: "Mostrar equipes", exact: true }).waitFor({ timeout: 10_000 });
      r.exigir(
        (await lerEquipes(p, turmaId))?.equipes?.length === COMPUTADORES,
        "cancelar a edição não mexe no que está salvo",
      );

      // ── desfazer: o estado final é o inicial ───────────────────────────
      await p.getByRole("button", { name: "Desfazer equipes", exact: true }).click();
      /* O nome vem do mesmo `aria-labelledby` da janela do projetor. */
      const confirmacao = p.getByRole("dialog", { name: "Desfazer as equipes?", exact: true });
      await confirmacao.waitFor({ timeout: 10_000 });
      await confirmacao.getByRole("button", { name: "Sim, desfazer", exact: true }).click();
      await esperarOuFalharCedo(
        p.getByRole("spinbutton", { name: "Quantos computadores vocês vão usar?" }),
        erroNaTela(p),
        { timeout: 20_000, oQue: "desfazer as equipes" },
      );
      const depois = await lerEquipes(p, turmaId);
      r.exigir(depois?.montagem === null && depois?.equipes?.length === 0, "desfeitas: o servidor não tem mais equipes nesta turma");
      await r.registrar(p, "equipes-desfeitas", {
        titulo: "Desfeitas, e de volta ao começo",
        mostra: "A seção volta à pergunta dos computadores, como antes da primeira montagem.",
        prova:
          "Desfazer passa por uma confirmação e apaga a montagem inteira. A suíte termina aqui de " +
          "propósito: rodar de novo prova a mesma coisa.",
      });
    } finally {
      await p.request.delete(rotaDasEquipes(turmaId)).catch(() => {});
    }

    // ── Quem mandou isso? (5º ano): a ficha também monta equipes ─────────
    /* Só LEITURA, de propósito: montar e desfazer já foi provado acima, no
       unooGPT. O que falta provar é que a segunda missão com equipe acende a
       seção sozinha — a lista é da api (`EXPERIENCIAS_COM_EQUIPE`), e uma
       missão fora dela teria a ficha sem a seção, em silêncio. A professora é
       a de UMA lotação: com duas, a escola ativa pode ser a outra. */
    const TURMA_QUEM_MANDOU = process.env.TURMA_QUEM_MANDOU ?? "5A";
    const professora5 =
      contasDe("professor").find((c) => c.papel === "professor" && c.turma.split(" + ").includes(TURMA_QUEM_MANDOU)) ??
      professorDa(TURMA_QUEM_MANDOU);
    const p5 = await r.pagina("professor-5a");
    await r.entrar(p5, professora5.login);
    const turma5Id = await idDaTurma(p5, TURMA_QUEM_MANDOU);
    if (r.exigir(Boolean(turma5Id), `a professora leciona na ${TURMA_QUEM_MANDOU}`)) {
      /* A EQUIPE É DA ATIVIDADE (ADR-130): na exp05ef1b ela mora na página de
         cada atividade (o pacote), não na ficha. A atividade da 5A é a que a
         estudante/10 criou e pôs no ar, antes desta suíte. */
      const pacotes5 = await p5.request.get(`${BFF}/quem-mandou-isso/turmas/${turma5Id}/pacotes`);
      const lista5 = pacotes5.ok() ? await pacotes5.json() : null;
      const atividade5 = lista5?.emAndamento?.pacoteId ?? lista5?.historico?.[0]?.id ?? null;
      if (atividade5) {
        const equipes5 = await p5.request.get(`${BFF}/equipes/turma/${turma5Id}/missao/exp05ef1b/atividade/${atividade5}`);
        const corpo5 = equipes5.ok() ? await equipes5.json() : null;
        r.exigir(
          corpo5?.permitida === true,
          `a api aceita equipe na atividade da exp05ef1b (GET /equipes/…/atividade/:pacote → permitida=${String(corpo5?.permitida)})`,
        );
      }
      await p5.goto(`${HUB}/professor/entre-redes/5-ano/unidade-1?turmaId=${turma5Id}`, { waitUntil: "domcontentloaded" });
      await p5.getByRole("heading", { name: "Quem Mandou Isso?", exact: true }).waitFor({ timeout: 30_000 });
      const lista = await p5
        .locator("[data-atividades-da-missao]")
        .waitFor({ timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      r.exigir(lista, "a ficha de Quem mandou isso?, aberta com a turma, tem a lista das atividades da turma");
      r.exigir(
        (await p5.getByRole("heading", { name: "Equipes desta turma" }).count()) === 0,
        "e NÃO tem mais a seção de equipes da turma: a equipe é de cada atividade",
      );
      const textoDaFicha = await p5.locator("body").innerText();
      r.exigir(
        ["EF05CO08", "EF05CO03", "EF05CO04"].every((codigo) => textoDaFicha.includes(codigo)),
        "e diz as habilidades que a missão mede: EF05CO08, EF05CO03 e EF05CO04",
      );
      await p5.locator("[data-atividades-da-missao]").scrollIntoViewIfNeeded().catch(() => {});
      await r.registrar(p5, "ficha-quem-mandou-isso", {
        titulo: "Quem mandou isso? e as atividades da turma",
        mostra: `A ficha do 5º ano aberta com a ${TURMA_QUEM_MANDOU}: as etapas, as habilidades e as atividades da turma.`,
        prova:
          "A equipe é de cada atividade (ADR-130): ela se monta na criação e se ajusta na página da " +
          "atividade. Quem entra representa a equipe, e o painel da aula conta por computador.",
      });
    }

    // ── a faixa do estudante (2EM-A, onde o unooGPT está aberto) ───────
    const professoraAberta = professorDa(TURMA_ABERTA);
    const pa = await r.pagina("professor-aberta");
    await r.entrar(pa, professoraAberta.login);
    const turmaAbertaId = await idDaTurma(pa, TURMA_ABERTA);
    if (!r.exigir(Boolean(turmaAbertaId), `a professora leciona na ${TURMA_ABERTA}`)) return;

    const antes = await lerEquipes(pa, turmaAbertaId);
    const jaTinha = Boolean(antes?.montagem);
    if (jaTinha) {
      r.ressalva(`a ${TURMA_ABERTA} já tinha equipes no unooGPT: a suíte usa as que estão lá e não as apaga`);
    }
    try {
      let equipes = antes;
      /* Montagem de OUTRO dia no modo individual não tem equipe: sorteia por cima
         dela (com a versão gravada), senão não há estudante com equipe a provar. */
      if (!jaTinha || !(antes?.equipes?.length)) {
        const sugestao = await pa.request.post(`${rotaDasEquipes(turmaAbertaId)}/sugestao`, {
          data: { modo: "sorteio", computadores: COMPUTADORES, ausentes: [] },
        });
        r.exigir(sugestao.ok(), `a api sugere as equipes da ${TURMA_ABERTA} (HTTP ${sugestao.status()})`);
        const proposta = await sugestao.json();
        const gravado = await pa.request.put(rotaDasEquipes(turmaAbertaId), {
          data: {
            versao: antes?.montagem?.versao ?? 0,
            modo: "sorteio",
            computadores: proposta.equipes.length,
            ausentes: [],
            equipes: proposta.equipes.map((e) => ({ nome: e.nome, membros: e.membros.map((m) => m.id) })),
          },
        });
        r.exigir(gravado.ok(), `as equipes da ${TURMA_ABERTA} foram salvas pelo BFF (HTTP ${gravado.status()})`);
        equipes = await gravado.json();
      }

      /* Um estudante que ESTÁ numa equipe — casado pelo nome, porque a
         credencial não carrega o id. */
      const naEquipe = new Map(
        (equipes?.equipes ?? []).flatMap((e) => e.membros.map((m) => [m.nome, { equipe: e, id: m.id }])),
      );
      const estudante = contasDe("estudante").find(
        (c) => c.turma.split(" + ").includes(TURMA_ABERTA) && naEquipe.has(c.nome),
      );
      if (!r.exigir(Boolean(estudante), `há um estudante da ${TURMA_ABERTA} com credencial e equipe`)) return;
      const { equipe, id } = naEquipe.get(estudante.nome);
      const colegas = equipe.membros.filter((m) => m.id !== id);

      const pe = await r.pagina("estudante-aberta");
      await r.entrar(pe, estudante.login);
      await pe.goto(`${HUB}/exp/${EXP_ID}`, { waitUntil: "domcontentloaded" });
      const faixa = pe.getByTestId("faixa-da-equipe");
      const temFaixa = await faixa
        .waitFor({ timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      r.exigir(temFaixa, "a missão abre com a faixa da equipe acima do aparelho");
      /* O texto SEM o ícone: o `Icon` do DS é uma ligadura do Material Symbols, e o
         `innerText` devolve o nome dele ("groups") mesmo com o ícone desenhado. O que o
         estudante lê é o que não é `aria-hidden`. */
      const textoDaFaixa = temFaixa
        ? (await faixa.evaluate((el) =>
            [...el.childNodes]
              .filter((n) => !(n instanceof Element && n.getAttribute("aria-hidden") === "true"))
              .map((n) => n.textContent ?? "")
              .join(" ")
              .replace(/\s+/g, " "),
          )).trim()
        : "";
      r.exigir(textoDaFaixa.startsWith(`Sua equipe: ${equipe.nome}`), `a faixa diz "${textoDaFaixa}"`);
      r.exigir(
        colegas.every((m) => textoDaFaixa.includes(m.nome.trim().split(/\s+/)[0])),
        "e nomeia os colegas da equipe",
      );
      r.exigir(
        colegas.every((m) => m.nome.trim().split(/\s+/).length < 2 || !textoDaFaixa.includes(m.nome)),
        "só pelo primeiro nome",
      );
      await r.registrar(pe, "faixa-do-estudante", {
        titulo: "A equipe, na tela do estudante",
        mostra: `A faixa entre o header e a missão: "${textoDaFaixa}".`,
        prova:
          "É chrome do hub, fora do iframe: a experiência não sabe da equipe. Só primeiros nomes e sem " +
          "link — é a tela de uma criança, e o que ela precisa saber é com quem senta.",
        detalhe: `${colegas.length} colega(s)`,
      });
      /* Sai do aparelho: o iframe continua carregando e falando com a api
         enquanto a página estiver nele. */
      await pe.goto(`${HUB}/estudante`, { waitUntil: "domcontentloaded" });
    } finally {
      if (!jaTinha || !(antes?.equipes?.length)) await pa.request.delete(rotaDasEquipes(turmaAbertaId)).catch(() => {});
    }
  },
);
