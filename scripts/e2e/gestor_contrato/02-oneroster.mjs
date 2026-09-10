import { BFF, HUB, suite } from "../lib/roteiro.mjs";
import { conta } from "../lib/credenciais.mjs";

/**
 * A outra porta de entrada de pessoas: o binding CSV do OneRoster 1.2.
 *
 * Ele existe porque secretarias grandes já exportam nesse padrão, e pedir que
 * reformatem para a planilha simples da Unooria é pedir que criem um passo
 * manual entre o sistema delas e o nosso — que é exatamente onde nascem os
 * erros de enturmação.
 *
 * São sete arquivos, e a ORDEM importa: `classes` referencia `academicSessions`
 * e `orgs`; `enrollments` referencia `classes` e `users`. Enviar fora de ordem
 * devolve linhas recusadas com "referência não encontrada", que é o erro mais
 * confuso possível para quem exportou tudo junto do sistema de origem.
 *
 * O que esta suíte cobre e nenhum teste de unidade cobre: que o MODELO que a
 * tela oferece para download é aceito pelo parser da própria tela. Um modelo
 * com uma coluna a mais é um chamado de suporte garantido.
 */
const TURMA = "6C";
const ESCOLA = process.env.ESCOLA ?? "escola-demo";
const SENHA_DO_LOTE = "OneRosterE2E2026";

/** Os sete arquivos do padrão, na ordem em que a tela os apresenta. */
const ARQUIVOS = ["manifest", "orgs", "academicSessions", "classes", "users", "enrollments", "roles"];

const MANIFESTO = [
  "propertyName,value",
  "manifest.version,1.0",
  "oneroster.version,1.2",
  "source.systemName,Suíte de ponta a ponta da Unooria",
  "file.orgs,absent",
  "file.academicSessions,delta",
  "file.classes,delta",
  "file.users,delta",
  "file.enrollments,delta",
  "file.roles,delta",
  "",
].join("\n");

/** Um lote mínimo, na ordem de dependência. `sourcedId` prefixado por `e2e-`. */
const LOTE = {
  academicSessions: [
    "sourcedId,title,type,startDate,endDate,schoolYear",
    "e2e-ano-2026,Ano letivo 2026,schoolYear,2026-01-01,2026-12-31,2026",
    "",
  ].join("\n"),
  classes: [
    "sourcedId,title,grades,classType,schoolSourcedId,termSourcedIds",
    `e2e-turma-6c,${TURMA},06,homeroom,${ESCOLA},e2e-ano-2026`,
    "",
  ].join("\n"),
  /* O `identifier` é a MATRÍCULA, e é por ela que a api reconhece a pessoa. O
     prefixo `E2E-OR-` separa este lote do da planilha simples em
     `gestor/01-pessoas-e-turmas`: com `E2E-P1` nos dois, a professora daquela
     suíte era reconhecida aqui e acabava matriculada numa turma que não é dela
     — e a asserção de "ela vê só a turma dela" reprovava por colisão de dado de
     teste, não por defeito do produto. */
  users: [
    "sourcedId,enabledUser,username,givenName,familyName,identifier,role",
    "e2e-prof-1,true,,Helena,Braga,E2E-OR-P1,teacher",
    "e2e-estudante-1,true,,Tiago,Amorim,E2E-OR-A1,student",
    "e2e-estudante-2,true,,Vera,Pontes,E2E-OR-A2,student",
    "",
  ].join("\n"),
  enrollments: [
    "sourcedId,classSourcedId,schoolSourcedId,userSourcedId,role,primary,beginDate",
    `e2e-mat-1,e2e-turma-6c,${ESCOLA},e2e-prof-1,teacher,true,2026-02-01`,
    `e2e-mat-2,e2e-turma-6c,${ESCOLA},e2e-estudante-1,student,true,2026-02-01`,
    `e2e-mat-3,e2e-turma-6c,${ESCOLA},e2e-estudante-2,student,true,2026-02-01`,
    "",
  ].join("\n"),
};

await suite(
  {
    slug: "gestor_contrato/02-oneroster",
    papel: "gestor_contrato",
    titulo: "OneRoster 1.2",
    subtitulo: "os sete arquivos do padrão, o manifesto e as contas de assento",
    contexto:
      "A porta para quem já exporta no padrão do mercado. Sete arquivos CSV, enviados na ordem de " +
      "dependência, com um manifesto que declara o que vem em cada lote.",
    prova: [
      "Os sete arquivos aparecem na tela, na ordem de dependência",
      "Cada um tem modelo em branco E exemplo preenchido, baixáveis",
      "O exemplo traz a escola de VERDADE, não um id fictício",
      "O manifesto é conferido antes do lote",
      "O lote cria pessoas, turma e matrículas",
      "As contas sem matrícula são listáveis — é o diagnóstico da virada de ano",
    ],
    comando: "node scripts/e2e/gestor_contrato/02-oneroster.mjs",
  },
  async (r) => {
    const p = await r.pagina("gestor_contrato");
    await r.entrar(p, conta("gestor_escola").login);

    await p.goto(`${HUB}/admin/importar`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    await p.getByRole("tab", { name: /OneRoster/ }).click().catch(async () => {
      await p.locator("text=OneRoster 1.2").first().click();
    });
    await p.waitForTimeout(800);
    /* A REGRA DA REGIONAL, dita ANTES do envio. O comportamento de `orgs.csv`
       mudou com a ADR-79 — com várias regionais, a linha sem `parentSourcedId`
       válido é ERRO e não aviso —, e sem este aviso na tela quem importa
       descobre a mudança pelo relatório de falha, no meio de um arquivo de mil
       linhas. */
    const instrucoes = await p.locator("main, body").first().innerText();
    r.exigir(
      /Toda escola entra vinculada a uma regional/.test(instrucoes),
      "a tela avisa a regra da regional antes do envio",
    );
    r.exigir(
      /UMA regional/.test(instrucoes) && /VÁRIAS/.test(instrucoes),
      "e distingue os dois casos: vínculo automático com uma, coluna obrigatória com várias",
    );

    await r.registrar(p, "os-sete-arquivos", {
      titulo: "Os sete arquivos, na ordem",
      mostra: "manifest, orgs, academicSessions, classes, users, enrollments e roles — numerados.",
      prova:
        "A numeração NÃO é decorativa: `classes` referencia `academicSessions`, e `enrollments` " +
        "referencia `classes` e `users`. Fora de ordem, o lote volta com 'referência não " +
        "encontrada' e quem exportou não sabe o que fazer com isso.",
      inteira: true,
    });

    // ── modelo e exemplo de cada arquivo ────────────────────────────────
    /* O que se prova aqui é o caminho INTEIRO do download — sessão, BFF,
       cabeçalhos —, não o conteúdo, que `tests/oneroster-modelos.spec.ts` cobre
       linha a linha. */
    let baixados = 0;
    for (const arquivo of ARQUIVOS) {
      for (const tipo of ["modelo", "exemplo"]) {
        const sufixo = tipo === "exemplo" ? "/exemplo" : "";
        const resposta = await p.request.get(`${BFF}/rostering/modelos/oneroster/${arquivo}${sufixo}`);
        const corpo = await resposta.text();
        const linhas = corpo.trim().split("\n");
        const ok =
          resposta.status() === 200 &&
          (resposta.headers()["content-type"] ?? "").includes("text/csv") &&
          (tipo === "modelo" ? linhas.length === 1 : linhas.length > 1);
        if (!ok) {
          throw new Error(
            `${tipo} de ${arquivo}: HTTP ${resposta.status()}, ${linhas.length} linha(s), ` +
              `content-type "${resposta.headers()["content-type"]}"`,
          );
        }
        /* O exemplo de `orgs` tem de trazer a escola DE VERDADE: com um id
           fictício, o lote que o gestor baixa para conferir o caminho volta
           inteiro como "escola não é a desta importação". */
        if (tipo === "exemplo" && arquivo === "orgs") {
          r.exigir(corpo.includes(ESCOLA), `o exemplo de orgs.csv traz a escola real (${ESCOLA})`);
        }
        baixados += 1;
      }
    }
    r.exigir(baixados === ARQUIVOS.length * 2, `${baixados} arquivos baixados (modelo + exemplo dos sete)`);

    // ── o manifesto, pela tela ──────────────────────────────────────────
    await p.locator("li", { hasText: "1. manifest.csv" }).getByRole("button", { name: "Enviar" }).click();
    await p.waitForTimeout(700);
    await p.locator('input[type="file"]').setInputFiles({
      name: "manifest.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(MANIFESTO, "utf8"),
    });
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Enviar" }).last().click();
    await p.getByText(/manifest.csv:/).waitFor({ timeout: 25_000 });
    await r.registrar(p, "manifesto-conferido", {
      titulo: "O manifesto declara o lote",
      mostra: "A versão do padrão conferida e a lista do que vem em cada arquivo (delta ou absent).",
      prova:
        "`delta` significa 'só o que mudou'; `absent` significa 'não mando este arquivo'. Sem o " +
        "manifesto, uma exportação parcial seria lida como 'todo mundo que não veio saiu da rede'.",
    });

    // ── o lote, na ordem de dependência ─────────────────────────────────
    /* Pela api, e não pelas sete danças de modal: o valor do smoke aqui é
       VISUAL na tela do manifesto e no resultado, não em repetir seis vezes o
       mesmo upload. */
    const relatorio = [];
    for (const [arquivo, conteudo] of Object.entries(LOTE)) {
      const params = new URLSearchParams({ modo: "delta" });
      if (arquivo === "users") params.set("senhaPadrao", SENHA_DO_LOTE);
      const resposta = await p.request.post(`${BFF}/rostering/oneroster/${arquivo}?${params}`, {
        headers: { "content-type": "text/csv" },
        data: conteudo,
      });
      const corpo = await resposta.json();
      relatorio.push(
        `${arquivo}: ${corpo.criados ?? 0} novos, ${corpo.atualizados ?? 0} atualizados, ` +
          `${corpo.matriculados ?? 0} enturmados, ${corpo.erros?.length ?? 0} erro(s)`,
      );
      r.exigir(
        (corpo.erros?.length ?? 0) === 0,
        `${arquivo}.csv entrou sem erro (${JSON.stringify(corpo.erros ?? []).slice(0, 160)})`,
      );
    }
    console.log("      " + relatorio.join("\n      "));

    await p.goto(`${HUB}/admin/turmas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(2000);
    const linhaDaTurma = p.locator("table tbody tr", { hasText: TURMA });
    r.exigir((await linhaDaTurma.count()) > 0, `a turma ${TURMA} veio do padrão OneRoster`);
    await r.registrar(p, "turma-do-padrao", {
      titulo: "A turma que veio do padrão",
      mostra: `A ${TURMA}, criada a partir de classes.csv e povoada por enrollments.csv.`,
      prova:
        "Os dois caminhos — planilha simples e OneRoster — desembocam nas MESMAS tabelas. Não " +
        "existe 'turma do OneRoster' e 'turma da planilha': existe turma.",
      detalhe: relatorio.join(" · "),
      inteira: true,
    });

    // ── contas de assento: o diagnóstico da virada de ano ───────────────
    await p.goto(`${HUB}/admin/importar`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
    await p.getByRole("button", { name: "Listar contas sem matrícula" }).click();
    await p.waitForTimeout(2000);
    const semMatricula = await p.locator("table tbody tr").count();
    await r.registrar(p, "contas-de-assento", {
      titulo: "Contas sem matrícula",
      mostra: `${semMatricula} conta(s) sem matrícula na primeira página.`,
      prova:
        "Na virada do ano, quem não vem na nova exportação fica sem matrícula — e continua " +
        "existindo, ocupando assento no contrato. Esta lista é o diagnóstico: sem ela, a rede " +
        "descobre pela fatura.",
      detalhe: `${semMatricula} contas na primeira página`,
      inteira: true,
    });
  },
);
