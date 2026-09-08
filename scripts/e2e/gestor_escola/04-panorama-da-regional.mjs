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
  },
);
