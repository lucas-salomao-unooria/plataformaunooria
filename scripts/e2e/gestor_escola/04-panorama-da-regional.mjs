import { HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

await suite(
  {
    slug: "gestor_escola/04-panorama-da-regional",
    papel: "gestor_regional",
    titulo: "A diretoria numa tela",
    subtitulo: "as escolas da regional somadas, sem lotação em nenhuma",
    contexto:
      "O `gestor_regional` cobre as escolas de uma Diretoria de Ensino SEM ter lotação em " +
      "nenhuma delas. O escopo dele vem de `users.regional_id`, e ele continua abrindo uma " +
      "escola por vez — a RLS não muda.",
    prova: [
      "O supervisor entra e recebe as escolas da regional, sem lotação",
      "A tela se intitula pela DIRETORIA, não por 'minhas lotações'",
      "Os números das escolas dela aparecem somados",
    ],
    comando: "node scripts/e2e/gestor_escola/04-panorama-da-regional.mjs",
  },
  async (r) => {
    const supervisor = conta("gestor_regional");
    const p = await r.pagina("gestor_regional");
    await r.entrar(p, supervisor.login);

    await p.goto(`${HUB}/admin/minhas-escolas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2500);

    const linhas = await p.locator("table tbody tr").allInnerTexts();
    r.exigir(linhas.length > 0, `a diretoria tem ${linhas.length} escola(s) no panorama`);

    const titulo = await p.locator("h1, h2").first().innerText();
    r.exigir(
      !/Minhas escolas/.test(titulo),
      `a tela se intitula pela diretoria e não por lotação (viu: "${titulo}")`,
    );

    const resumo = await p.locator("p", { hasText: /escolas? ·/ }).first().innerText();
    r.exigir(
      /turmas/.test(resumo) && /estudantes/.test(resumo) && /vínculos de professores/.test(resumo),
      `os números vêm somados: "${resumo}"`,
    );

    await r.registrar(p, "panorama-da-regional", {
      titulo: "A diretoria numa tela",
      mostra: `${titulo} — ${resumo}`,
      prova:
        "Ele NÃO tem lotação em escola nenhuma: o alcance vem de `users.regional_id`. E a soma " +
        "não custou RLS — turma, estudante e primeiro acesso saem de tabelas que já estão fora " +
        "dela por desenho. 'vínculos de professores' e não 'professores' porque o total soma " +
        "escolas, e quem dá aula em duas conta duas vezes.",
      detalhe: resumo,
      inteira: true,
    });

    // ── o relatório: consolidado E por escola ────────────────────────────
    await p.goto(`${HUB}/admin/relatorios`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(3000);

    const tituloDoRelatorio = await p.locator("h1, h2").first().innerText();
    r.exigir(
      /Relatório/.test(tituloDoRelatorio),
      `o relatório abre pela diretoria (viu: "${tituloDoRelatorio}")`,
    );
    /* Sem seletor de regional: ele lê a PRÓPRIA. Se o seletor aparecer aqui, é
       porque a tela passou a oferecer a diretoria do vizinho. */
    r.exigir(
      (await p.getByRole("combobox", { name: /^Regional/ }).count()) === 0,
      "o supervisor não escolhe a regional: lê a dele, e a api ignora o parâmetro",
    );

    const tabelas = await p.locator("table").count();
    r.exigir(tabelas === 2, `duas tabelas: o consolidado por missão e a quebra por escola (${tabelas})`);

    const cabecalhos = (await p.locator("table thead th").allInnerTexts()).join(" | ");
    r.exigir(
      /Turmas encerradas/.test(cabecalhos) && /Estudantes com registro/.test(cabecalhos),
      `as DUAS medidas aparecem lado a lado: ${cabecalhos}`,
    );
    /* A coluna Missão diz o NOME que a diretoria reconhece, não o código
       interno (H07.2.1). Tabela vazia (regional sem uso) passa sem afirmar. */
    const missoes = await p.locator("table").first().locator("tbody tr td:first-child").allInnerTexts();
    r.exigir(
      missoes.every((m) => !/^(exp\d{2}(ef|em)\d[ab]|app-\d{2})/.test(m.trim())),
      `a coluna Missão mostra o nome, não o código: ${missoes.join(" | ") || "(sem missões)"}`,
    );
    /* Nome de criança não entra: o relatório é contagem. */
    const corpo = await p.locator("main, body").first().innerText();
    r.exigir(
      !/CPF|cpf/.test(corpo),
      "nenhum dado de pessoa no relatório da diretoria — é contagem",
    );

    await r.registrar(p, "relatorio-da-diretoria", {
      titulo: "O relatório da diretoria",
      mostra: `${tituloDoRelatorio} — consolidado por missão e quebra por escola.`,
      prova:
        "As DUAS medidas lado a lado, porque medem coisas diferentes: 'Turmas encerradas' é a " +
        "AULA que o professor fechou; 'Estudantes com registro' é a CRIANÇA que entrou. Turma " +
        "encerrada com poucos registros é aula que passou sem a sala entrar. " +
        "E ele atravessa escolas SEM afrouxar a tranca do banco: o serviço abre a tranca uma " +
        "escola por vez e soma na aplicação.",
      inteira: true,
    });
  },
);
