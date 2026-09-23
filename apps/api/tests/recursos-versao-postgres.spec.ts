import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { RecursosAdminController } from "../src/recursos/recursos-admin.controller";

/**
 * VERSÃO: o histórico, o rollback e a fixação por escopo (ADR-87).
 *
 * O que mais importa aqui é a FIDELIDADE do rollback. `publicar-manifesto.mjs
 * --versao x.y.z` manda o número antigo com o manifesto ATUAL do repositório —
 * então voltar a versão nunca voltou `viewport` nem `permissoes`, e a app-70
 * reabria sem `allow-pointer-lock`: a criança entrava na Vila e a câmera não
 * girava, sem erro em lugar nenhum. A ativação pela tela restaura o manifesto
 * guardado, e é isso que os testes de fidelidade cobram.
 *
 * UMA EXPERIÊNCIA DE MENTIRA, só desta suíte — e ela é `publico: "professor"`
 * DE PROPÓSITO, o que a mantém fora de TODA grade de turma.
 *
 * `experiencias` é tabela GLOBAL (sem `escola_id`, sem RLS) e o Jest paraleliza.
 * Uma linha `publico: "estudante"` com `series: ["8EF"]` entra na grade do 8º
 * ano de TODA escola enquanto existir — e `salas-postgres` afirma que a grade do
 * 8A é exatamente `[VILA, INSTA]`. Foi medido: a suíte vizinha ficou vermelha
 * dizendo que a grade tinha uma missão a mais, com o sintoma apontando para a
 * sala de aula e a causa aqui. `gradeDaTurma` filtra `publico === "estudante"`,
 * então "professor" é o que garante o isolamento — não o prefixo do id.
 *
 * A fidelidade do rollback se prova igualmente bem: o par de manifestos varia
 * `permissoes`, `viewport`, `series`, `unidade` e `nome`, que é o que o
 * defeito do `--versao` deixava para trás.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const EXP = "app-99-versao-de-teste";
const ESCOLA = "teste-versao";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const painel = new RecursosAdminController(prisma);

let admin = "";
const comoAdmin = () => ({ auth: { usuarioId: admin, escolaId: "", perfil: "admin" as const } });

/** O manifesto da 1.0.0 declara `pointer-lock` e um viewport de aparelho; o da
 *  2.0.0 não declara nenhum dos dois. É esse par que prova a fidelidade. */
const MANIFESTO_ANTIGO = {
  id: EXP,
  nome: "Versão de teste (antiga)",
  versao: "1.0.0",
  produto: "entre-redes",
  series: ["8EF"],
  unidade: 1,
  capabilities: ["telemetria"],
  viewport: { largura: 375, altura: 812 },
  publico: "professor",
  permissoes: ["pointer-lock"],
};

const MANIFESTO_NOVO = {
  id: EXP,
  nome: "Versão de teste (nova)",
  versaoAtiva: "2.0.0",
  produto: "entre-redes",
  series: ["8EF", "9EF"],
  unidade: 2,
  capabilities: ["telemetria", "ia"],
  viewport: null,
  publico: "professor",
  permissoes: [],
};

async function limpar() {
  /* A AUDITORIA TAMBÉM É LIXO DE TESTE (ADR-89). Ela é append-only e ninguém
     mais a limpa, então cada escrita destes testes fica no banco de dev para
     sempre — foi visto no print da suíte e2e: o histórico da REDE aberto em
     `/admin/recursos` com dezenas de linhas de `app-99-...` e "Admin da
     versão". Mesma família do `salas-postgres` reescrevendo o catálogo: linha
     em tabela sem RLS é estado global, e a tela do cliente é onde ela aparece. */
  await prisma.recursoAuditoria.deleteMany({
    where: { OR: [{ escolaId: ESCOLA }, { recursoId: `experiencia:${EXP}` }] },
  });
  await prisma.disponibilidade.deleteMany({
    where: { OR: [{ escolaId: ESCOLA }, { recursoId: `experiencia:${EXP}` }] },
  });
  await prisma.experienciaVersao.deleteMany({ where: { expId: EXP } });
  await prisma.experiencia.deleteMany({ where: { expId: EXP } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola da versão" } });
  admin = (
    await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "versao-admin",
        role: "admin",
        displayName: "Admin da versão",
        passwordHash: "x",
      },
    })
  ).id;
});

beforeEach(async () => {
  await prisma.recursoAuditoria.deleteMany({ where: { recursoId: `experiencia:${EXP}` } });
  await prisma.disponibilidade.deleteMany({ where: { recursoId: `experiencia:${EXP}` } });
  await prisma.experienciaVersao.deleteMany({ where: { expId: EXP } });
  await prisma.experiencia.deleteMany({ where: { expId: EXP } });

  /* O estado inicial: a 2.0.0 no ar, com a 1.0.0 no histórico. É o cenário do
     rollback. As datas são explícitas — a ordem do histórico é por
     `publicada_em`, e sem controlá-la o teste dependeria do relógio. */
  await prisma.experiencia.create({
    data: {
      expId: EXP,
      nome: MANIFESTO_NOVO.nome,
      versaoAtiva: "2.0.0",
      produto: "entre-redes",
      series: MANIFESTO_NOVO.series,
      unidade: 2,
      capabilities: MANIFESTO_NOVO.capabilities,
      publico: "professor",
      permissoes: [],
    },
  });
  await prisma.experienciaVersao.createMany({
    data: [
      {
        expId: EXP,
        versao: "1.0.0",
        manifesto: MANIFESTO_ANTIGO,
        publicadaEm: new Date(Date.UTC(2026, 0, 1)),
        publicadaPor: "ci-deploy",
      },
      {
        expId: EXP,
        versao: "2.0.0",
        manifesto: MANIFESTO_NOVO,
        publicadaEm: new Date(Date.UTC(2026, 5, 1)),
        publicadaPor: "ci-deploy",
      },
    ],
  });
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

describe("GET /recursos/experiencias/:expId/versoes", () => {
  test("lista da mais recente para a mais antiga, marcando a ativa", async () => {
    const r = await painel.versoes(EXP);
    expect(r.versoes.map((v) => v.versao)).toEqual(["2.0.0", "1.0.0"]);
    expect(r.versaoAtiva).toBe("2.0.0");
    expect(r.versoes.find((v) => v.versao === "2.0.0")?.ativa).toBe(true);
  });

  test("`emRollback` é falso quando a ativa é a última publicada", async () => {
    expect((await painel.versoes(EXP)).emRollback).toBe(false);
  });

  test("e VERDADEIRO depois de voltar — é o estado que a tela tem de dizer", async () => {
    await painel.ativar(EXP, { versao: "1.0.0", motivo: "regressão na 2.0.0" }, comoAdmin());
    const r = await painel.versoes(EXP);
    expect(r.versaoAtiva).toBe("1.0.0");
    // Sem este sinal, o próximo deploy "conserta" o rollback sem ninguém ver.
    expect(r.emRollback).toBe(true);
  });

  test("experiência fora do catálogo é 404", async () => {
    await expect(painel.versoes("app-99-nao-existe")).rejects.toThrow();
  });
});

describe("POST .../ativar — o rollback", () => {
  test("RESTAURA O MANIFESTO daquela versão, não só o número", async () => {
    await painel.ativar(EXP, { versao: "1.0.0" }, comoAdmin());
    const depois = await prisma.experiencia.findUniqueOrThrow({ where: { expId: EXP } });

    expect(depois.versaoAtiva).toBe("1.0.0");
    /* O CORAÇÃO DESTA SUÍTE. Com `publicar-manifesto.mjs --versao`, estes três
       campos ficariam nos valores da 2.0.0 — e o iframe da 1.0.0 abriria sem
       `allow-pointer-lock` e sem casca de aparelho, sem erro em lugar nenhum. */
    expect(depois.permissoes).toEqual(["pointer-lock"]);
    expect(depois.viewport).toEqual({ largura: 375, altura: 812 });
    expect(depois.series).toEqual(["8EF"]);
    expect(depois.unidade).toBe(1);
    expect(depois.nome).toBe("Versão de teste (antiga)");
  });

  test("diz se restaurou o manifesto e se conferiu no CDN", async () => {
    const r = await painel.ativar(EXP, { versao: "1.0.0" }, comoAdmin());
    expect(r.manifestoRestaurado).toBe(true);
    /* Sem `CDN_EXP_URL` (o caso de desenvolvimento) a conferência é pulada, e a
       resposta DIZ isso: "ativei sem conferir" e "ativei e conferi" são
       garantias diferentes, e a tela precisa distinguir as duas. */
    expect(r.conferida).toBe(false);
  });

  test("versão fora do histórico é RECUSADA — não se aponta a rede para o desconhecido", async () => {
    await expect(painel.ativar(EXP, { versao: "9.9.9" }, comoAdmin())).rejects.toThrow();
    const intacta = await prisma.experiencia.findUniqueOrThrow({ where: { expId: EXP } });
    expect(intacta.versaoAtiva).toBe("2.0.0");
  });

  test("manifesto guardado no formato do SEED (`versao`) também restaura", async () => {
    /* As linhas em circulação têm duas formas: o corpo do PUT do CI usa
       `versaoAtiva`, o backfill da migration e o seed usam `versao`. A
       diferença é só no nome da versão — que a ativação não lê, porque ela vem
       do parâmetro da rota. Este teste prende isso. */
    const r = await painel.ativar(EXP, { versao: "1.0.0" }, comoAdmin());
    expect(r.manifestoRestaurado).toBe(true);
  });

  test("manifesto ILEGÍVEL troca só a versão, em vez de recusar o rollback", async () => {
    await prisma.experienciaVersao.update({
      where: { expId_versao: { expId: EXP, versao: "1.0.0" } },
      data: { manifesto: { lixo: true } },
    });
    const r = await painel.ativar(EXP, { versao: "1.0.0" }, comoAdmin());
    // Degradar assim é melhor que travar: rollback é operação de incidente.
    expect(r.versaoAtiva).toBe("1.0.0");
    expect(r.manifestoRestaurado).toBe(false);
  });
});

describe("PUT .../versao — a fixação por escopo (o canário)", () => {
  test("fixa numa escola e CRIA a linha como ligada", async () => {
    const r = await painel.fixarVersao(EXP, { escolaId: ESCOLA, versao: "1.0.0" }, comoAdmin());
    expect(r).toMatchObject({ escolaId: ESCOLA, versaoFixa: "1.0.0" });

    const linha = await prisma.disponibilidade.findFirstOrThrow({
      where: { recursoId: `experiencia:${EXP}`, escolaId: ESCOLA },
    });
    expect(linha.versaoFixa).toBe("1.0.0");
    // Quem fixa versão para uma escola está dizendo que a experiência vale ali.
    expect(linha.ligado).toBe(true);
    // E a `versao_ativa` do CONTRATO não foi tocada: é o ponto do canário.
    const catalogo = await prisma.experiencia.findUniqueOrThrow({ where: { expId: EXP } });
    expect(catalogo.versaoAtiva).toBe("2.0.0");
  });

  test("`versao: null` SOLTA a fixação e preserva o `ligado` da linha", async () => {
    await painel.definir(
      `experiencia:${EXP}`,
      { escolaId: ESCOLA, ligado: false, motivo: "incidente" },
      comoAdmin(),
    );
    await painel.fixarVersao(EXP, { escolaId: ESCOLA, versao: "1.0.0" }, comoAdmin());
    await painel.fixarVersao(EXP, { escolaId: ESCOLA, versao: null }, comoAdmin());

    const linha = await prisma.disponibilidade.findFirstOrThrow({
      where: { recursoId: `experiencia:${EXP}`, escolaId: ESCOLA },
    });
    expect(linha.versaoFixa).toBeNull();
    /* A linha SOBREVIVE: ela pode carregar um `ligado` que é decisão à parte.
       Apagá-la aqui religaria em silêncio um recurso desligado de propósito. */
    expect(linha.ligado).toBe(true);
  });

  test("ligar/desligar NÃO apaga a versão fixada", async () => {
    await painel.fixarVersao(EXP, { escolaId: ESCOLA, versao: "1.0.0" }, comoAdmin());
    await painel.definir(
      `experiencia:${EXP}`,
      { escolaId: ESCOLA, ligado: false, motivo: "manutenção" },
      comoAdmin(),
    );

    const linha = await prisma.disponibilidade.findFirstOrThrow({
      where: { recursoId: `experiencia:${EXP}`, escolaId: ESCOLA },
    });
    /* `versaoFixa` ausente no payload = NÃO MEXE. Sem essa distinção, desligar
       e religar apagaria a versão que alguém fixou, em silêncio. */
    expect(linha.versaoFixa).toBe("1.0.0");
    expect(linha.ligado).toBe(false);
  });

  test("a fixação aparece no painel daquele escopo, e não no de outro", async () => {
    await painel.fixarVersao(EXP, { escolaId: ESCOLA, versao: "1.0.0" }, comoAdmin());

    const naEscola = await painel.painel(ESCOLA);
    const daEscola = naEscola.produtos
      .find((p) => p.slug === "entre-redes")
      ?.experiencias.find((e) => e.expId === EXP);
    expect(daEscola).toMatchObject({ versaoFixa: "1.0.0", versaoAtiva: "2.0.0" });

    const noContrato = await painel.painel();
    const doContrato = noContrato.produtos
      .find((p) => p.slug === "entre-redes")
      ?.experiencias.find((e) => e.expId === EXP);
    expect(doContrato?.versaoFixa).toBeNull();
  });

  test("escopo inexistente é recusado", async () => {
    await expect(
      painel.fixarVersao(EXP, { escolaId: "esc-fantasma", versao: "1.0.0" }, comoAdmin()),
    ).rejects.toThrow();
  });
});
