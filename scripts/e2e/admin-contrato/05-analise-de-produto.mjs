import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * A análise de PRODUTO: a comparação entre turmas de uma escola.
 *
 * É a única tela em que alguém olha mais de uma turma ao mesmo tempo — e por
 * isso é a única em que a granularidade cai: aqui não há nome de criança, há
 * uma linha por atividade. A tela do professor é nominal porque é a sala dele;
 * esta é agregada porque compara salas.
 *
 * O que ela mede é o produto funcionando, não a turma: "poder do viés" perto de
 * 50% significa que o feed enviesado não previu nada, e a atividade não
 * demonstrou o que se propõe. "Inversão" em 0% é o oposto e é pior — o viés
 * virou determinismo, e o exercício passa a ensinar que não há saída.
 *
 * As métricas são RECALCULADAS dos eventos a cada visita. Nada aqui é número
 * gravado que ninguém sabe mais como foi computado.
 *
 * O PAPEL é `gestor_contrato`, e só ele: o controller inteiro carrega
 * `@Roles("gestor_contrato")`. Nem professor nem gestor alcançam estas rotas —
 * e esta suíte prova a negativa entrando com o gestor e recebendo 403.
 */
/** A escola da demonstração — o id vem da rede, não é uuid gerado. */
const ESCOLA = process.env.ESCOLA ?? "escola-demo";

await suite(
  {
    slug: "admin-contrato/05-analise-de-produto",
    papel: "gestor_contrato",
    titulo: "A análise de produto",
    subtitulo: "envolvimento e eficácia entre turmas, e a planilha da rede",
    contexto:
      "O nível acima da sala de aula: comparar as turmas de uma escola para saber se a atividade " +
      "está funcionando — e onde ela não está.",
    prova: [
      "A escola precisa ser escolhida: comparar turmas de escolas diferentes não faz sentido",
      "Sem sessão de estudante, a tela diz isso em vez de mostrar uma tabela vazia",
      "Cada coluna vem com a definição de como foi computada",
      "'Inversão' aparece ao lado de 'poder do viés' — a leitura sozinha engana",
      "O export por run e por evento sai em CSV",
      "Nenhum nome de estudante nesta tela: ela é agregada por atividade",
      "O gestor de escola NÃO alcança estas rotas — a trava está na api, não no menu",
    ],
    comando: "node scripts/e2e/admin-contrato/05-analise-de-produto.mjs",
  },
  async (r) => {
    const p = await r.pagina("gestor_contrato");
    await r.entrar(p, conta("gestor_contrato").login);

    await p.goto(`${HUB}/analise`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);
    const semEscola = await p.locator("main").innerText();
    r.exigir(
      /Escolha a escola acima/.test(semEscola),
      "sem escola escolhida, a tela explica por que ela é obrigatória",
    );
    await r.registrar(p, "escolha-a-escola", {
      titulo: "Primeiro, a escola",
      mostra: "O seletor de escola e a explicação de por que a comparação exige uma.",
      prova:
        "Cada contrato tem muitas escolas, e comparar turmas de escolas diferentes mistura " +
        "realidades. A restrição é pedagógica antes de ser técnica.",
    });

    /* A escola é DIGITADA, não escolhida numa lista — e isso é uma decisão, não
       um atalho. O `gestor_contrato` é a única exceção cross-escola da regra de
       tenancy, e viaja com `escolaId` VAZIO no token: não existe "a escola
       dele". O id vai para a URL, o que de quebra torna a comparação entre
       turmas um link compartilhável. */
    await p.waitForTimeout(1500); // portão de hidratação
    await p.locator("#escola").pressSequentially(ESCOLA, { delay: 20 });
    await p.getByRole("button", { name: "Abrir" }).click();
    await p.waitForURL("**escolaId=**", { timeout: 20_000 });
    await p.waitForTimeout(3000);

    const corpo = await p.locator("main").innerText();
    const linhas = await p.locator("table tbody tr").count();

    r.exigir(/Como ler estas colunas/.test(corpo), "a tela traz o bloco de 'como ler estas colunas'");
    r.exigir(
      /Poder do viés/.test(corpo) && /Inversão/.test(corpo),
      "e as duas leituras aparecem juntas: poder do viés E inversão",
    );
    r.exigir(
      /Conteúdo morto/.test(corpo),
      "o conteúdo morto é nomeado — posts aprovados que nenhum estudante recebeu são geração paga e não usada",
    );
    r.exigir(
      /nada aqui é número gravado/.test(corpo),
      "a tela declara que recalcula das evidências a cada visita",
    );
    await r.registrar(p, "envolvimento-e-eficacia", {
      titulo: linhas > 0 ? "Envolvimento e eficácia entre turmas" : "A escola ainda sem sessões",
      mostra:
        linhas > 0
          ? `Uma linha por atividade, com envolvimento, poder do viés, inversão e conteúdo morto — ${linhas} linha(s).`
          : "A tela explicando que as métricas aparecem depois da primeira turma rodar.",
      prova:
        "'Poder do viés' perto de 50% significa que o feed não previu nada. 'Inversão' em 0% é " +
        "pior: o viés virou determinismo e o exercício passa a ensinar o oposto da mensagem. As " +
        "duas leituras andam juntas de propósito.",
      detalhe: `${linhas} atividade(s) com sessão`,
      inteira: true,
    });

    // ── nenhum nome de criança nesta tela ───────────────────────────────
    /* A prova é por construção: a rota é `/analise/resumo`, uma linha por
       atividade. Se um nome aparecesse aqui, seria um vazamento de
       granularidade — a tela do professor é nominal porque é a sala DELE. */
    const nomeDeEstudante = conta("estudante").nome;
    r.exigir(
      !corpo.includes(nomeDeEstudante),
      `nenhum nome de estudante na tela agregada (conferido com "${nomeDeEstudante}")`,
    );

    // ── o export ────────────────────────────────────────────────────────
    const escolaId = ESCOLA;
    const csv = await p.request.get(`${BFF}/analise/csv?escolaId=${encodeURIComponent(escolaId)}&nivel=run`);
    r.exigir(csv.ok(), `o export por run responde (HTTP ${csv.status()})`);
    const linhasCsv = (await csv.text()).trim().split("\n").length;
    r.exigir(
      (csv.headers()["content-type"] ?? "").includes("csv"),
      `e vem como CSV, com ${linhasCsv} linha(s)`,
    );
    r.ressalva(
      "o mesmo export existe no nível de EVENTO, para quem quiser recalcular as métricas por fora — " +
        "é o antídoto contra número que ninguém sabe conferir",
    );

    // ── o detalhe de uma atividade ──────────────────────────────────────
    /* A linha da tabela leva à atividade, e é lá que a eficácia da ESCRITA por
       perfil aparece. Vale o passo porque é a única tela do produto que cruza
       perfil de valores com o que a criança escreveu — e ela existe para
       responder "a atividade funcionou?", não "quem foi bem?". */
    const linkDaAtividade = p.locator('a[href^="/analise/atividades/"]').first();
    if (await linkDaAtividade.count()) {
      await linkDaAtividade.click();
      await p.waitForURL(/\/analise\/atividades\//, { timeout: 20_000 });
      await p.waitForTimeout(2500);
      const detalhe = await p.locator("main").innerText();
      r.exigir(
        /Imersão e sessão/.test(detalhe),
        "o detalhe traz a imersão e a sessão, e não só o resultado",
      );
      await r.registrar(p, "detalhe-da-atividade", {
        titulo: "Uma atividade, por dentro",
        mostra: "A eficácia da escrita por perfil de valores, a imersão e a duração das sessões.",
        prova:
          "É a tela que responde 'a atividade funcionou?'. Ela cruza perfil com o que foi escrito " +
          "— e continua sem nome de criança: o sujeito aqui é a atividade, não o estudante.",
        inteira: true,
      });
    } else {
      r.ressalva("nenhuma atividade com sessão nesta escola para abrir o detalhe");
    }

    // ── a negativa: o gestor de escola não lê isto ──────────────────────
    /* A tela existe no hub para quem tem o papel; a TRAVA está na api. Testar
       pelo menu provaria só que o link não aparece — e link escondido com rota
       aberta é porta destrancada com a placa retirada. */
    const gestor = await r.pagina("gestor-de-escola");
    await r.entrar(gestor, conta("gestor_escola").login);
    const recusa = await gestor.request.get(`${BFF}/analise/resumo?escolaId=${encodeURIComponent(escolaId)}`);
    r.exigir(
      recusa.status() === 403,
      `o gestor de escola recebe 403 na análise de produto (HTTP ${recusa.status()})`,
    );
    await gestor.goto(`${HUB}/analise`, { waitUntil: "domcontentloaded" });
    await gestor.waitForTimeout(2500);
    await r.registrar(gestor, "gestor-nao-le-a-analise", {
      titulo: "O gestor de escola não lê a análise de produto",
      mostra: "A mesma rota, aberta pelo gestor: sem dado nenhum.",
      prova:
        "O controller inteiro é `@Roles(\"admin-contrato\")`. A comparação entre turmas é do nível " +
        "do contrato — quem administra uma escola vê a escola dele, não o produto.",
      detalhe: `GET /analise/resumo → ${recusa.status()}`,
    });
  },
);
