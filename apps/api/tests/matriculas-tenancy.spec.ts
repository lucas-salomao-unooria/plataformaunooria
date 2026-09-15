import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { RosteringService } from "../src/rostering/rostering.service";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { periodoDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

/**
 * O enturmamento como ESCOPO: "as turmas do professor" são as turmas em que ele
 * tem matrícula — não todas as turmas da escola, como era antes desta migração.
 *
 * Roda com a role de runtime (sem BYPASSRLS) para valer também a política de
 * `matriculas`, e não só o filtro da aplicação.
 */

const ADMIN_URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-matriculas-rls";
const OUTRA = "teste-matriculas-rls-b";

const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
/* O cliente de runtime nasce no MÓDULO, não no `beforeAll`. Criado dentro do
   hook, qualquer falha ANTES da atribuição deixava a variável undefined e o
   `afterAll` estourava com `TypeError: ... reading '$disconnect'` — que o Jest
   reporta como "Test suite failed to run" e que SUBSTITUI o erro real. A suíte
   falhava dizendo a coisa errada. A URL é constante de módulo: nunca houve
   motivo para esperar o hook. */
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(ADMIN_URL) } } });
let rostering: RosteringService;

const ids = { prof8A: "", prof9B: "", turma8A: "", turma9B: "", turmaOutra: "", ana: "" };

async function limpar() {
  const escolas = { in: [ESCOLA, OUTRA] };
  await admin.matricula.deleteMany({ where: { escolaId: escolas } });
  await admin.user.deleteMany({ where: { escolaId: escolas } });
  await admin.turma.deleteMany({ where: { escolaId: escolas } });
  await admin.escola.deleteMany({ where: { id: escolas } });
}

beforeAll(async () => {
  await criarRoleDeRuntime(admin);
  await limpar();
  const periodo = await periodoDeTeste(admin);

  for (const id of [ESCOLA, OUTRA]) {
    await admin.escola.create({ data: { id, nome: `Escola ${id}` } });
  }

  const turma = async (escolaId: string, nome: string, serie: string) =>
    (await admin.turma.create({ data: { escolaId, periodoLetivoId: periodo.id, nome, serie } })).id;
  ids.turma8A = await turma(ESCOLA, "8A", "8EF");
  ids.turma9B = await turma(ESCOLA, "9B", "9EF");
  ids.turmaOutra = await turma(OUTRA, "8A", "8EF");

  const pessoa = async (escolaId: string, username: string, role: string) =>
    (
      await admin.user.create({
        data: { escolaId, username, role, displayName: username, passwordHash: "x" },
      })
    ).id;
  ids.prof8A = await pessoa(ESCOLA, "prof-8a", "professor");
  ids.prof9B = await pessoa(ESCOLA, "prof-9b", "professor");
  ids.ana = await pessoa(ESCOLA, "ana-8a", "estudante");

  const matricular = (escolaId: string, turmaId: string, usuarioId: string, papel: string) =>
    admin.matricula.create({
      data: { escolaId, turmaId, usuarioId, papel, principal: papel === "estudante", inicio: periodo.inicio },
    });
  await matricular(ESCOLA, ids.turma8A, ids.prof8A, "professor");
  await matricular(ESCOLA, ids.turma9B, ids.prof9B, "professor");
  await matricular(ESCOLA, ids.turma8A, ids.ana, "estudante");
  rostering = servicosDeTeste(runtime).rostering;
});

afterAll(async () => {
  /* best-effort: falha na limpeza não pode virar o erro reportado. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await admin.$disconnect();
});

describe("as turmas do professor", () => {
  test("cada professor recebe as SUAS turmas, não as da escola", async () => {
    const doOito = await rostering.turmasDoProfessor(ESCOLA, ids.prof8A);
    expect(doOito.map((t) => t.nome)).toEqual(["8A"]);
    expect(doOito[0]?.estudantes ?? doOito[0]?.estudantes).toBe(1);

    const doNono = await rostering.turmasDoProfessor(ESCOLA, ids.prof9B);
    expect(doNono.map((t) => t.nome)).toEqual(["9B"]);
  });

  test("o gestor continua vendo a escola inteira — papel de org, não de turma", async () => {
    const daEscola = await rostering.turmasDaEscola(ESCOLA);
    expect(daEscola.map((t) => t.nome).sort()).toEqual(["8A", "9B"]);
  });

  test("professor do 8A não leciona no 9B (é o que a rota transforma em 403)", async () => {
    expect(await rostering.professorLecionaNaTurma(ESCOLA, ids.prof8A, ids.turma8A)).toBe(true);
    expect(await rostering.professorLecionaNaTurma(ESCOLA, ids.prof8A, ids.turma9B)).toBe(false);
  });

  test("a lista nominal da turma traz os estudantes matriculados", async () => {
    const turma = await rostering.pessoasDaTurma(ESCOLA, ids.turma8A);
    expect((turma?.estudantes)?.map((a) => a.usuario)).toEqual(["ana-8a"]);
    expect(turma?.professores.map((p) => p.usuario)).toEqual(["prof-8a"]);
  });

  test("turma de outra escola não existe para esta escola", async () => {
    expect(await rostering.pessoasDaTurma(ESCOLA, ids.turmaOutra)).toBeNull();
  });

  test("a RLS de matriculas fecha por escola, não só o filtro da aplicação", async () => {
    const daEscola = await runtime.comTenancy(
      (tx) => tx.matricula.findMany({ select: { escolaId: true } }),
      ESCOLA,
    );
    expect(daEscola).toHaveLength(3);
    expect(new Set(daEscola.map((m) => m.escolaId))).toEqual(new Set([ESCOLA]));

    const daOutra = await runtime.comTenancy(
      (tx) => tx.matricula.findMany({ select: { escolaId: true } }),
      OUTRA,
    );
    expect(daOutra).toHaveLength(0);
  });

  test("matricular numa turma de COMPONENTE não tira o estudante da regular", async () => {
    const periodo = await periodoDeTeste(admin);
    const eletiva = await admin.turma.create({
      data: {
        escolaId: ESCOLA,
        periodoLetivoId: periodo.id,
        nome: "Eletiva de Xadrez",
        serie: "8EF",
        tipo: "componente",
      },
    });

    await rostering.matricular(ESCOLA, eletiva.id, ids.ana, "estudante");

    const ativas = await admin.matricula.findMany({
      where: { escolaId: ESCOLA, usuarioId: ids.ana, papel: "estudante", fim: null },
      include: { turma: { select: { nome: true } } },
      orderBy: { turma: { nome: "asc" } },
    });
    // As duas ao mesmo tempo: é o multi-turma que a coluna `users.turma_id` não
    // conseguia representar. A regular continua sendo a PRINCIPAL.
    expect(ativas.map((m) => m.turma.nome)).toEqual(["8A", "Eletiva de Xadrez"]);
    expect(ativas.find((m) => m.turma.nome === "8A")?.principal).toBe(true);
    expect(ativas.find((m) => m.turma.nome === "Eletiva de Xadrez")?.principal).toBe(false);

    // O cache NÃO foi para a eletiva. (Continua nulo porque a fixture criou a
    // matrícula do 8A direto no banco, sem passar por `matricularEm`.)
    const ana = await admin.user.findUniqueOrThrow({ where: { id: ids.ana } });
    expect(ana.turmaId).not.toBe(eletiva.id);

    await admin.matricula.deleteMany({ where: { turmaId: eletiva.id } });
    await admin.turma.delete({ where: { id: eletiva.id } });
  });

  test("tornar principal troca a referência sem encerrar nada", async () => {
    const periodo = await periodoDeTeste(admin);
    const eletiva = await admin.turma.create({
      data: {
        escolaId: ESCOLA,
        periodoLetivoId: periodo.id,
        nome: "Eletiva de Teatro",
        serie: "8EF",
        tipo: "componente",
      },
    });
    await rostering.matricular(ESCOLA, eletiva.id, ids.ana, "estudante");

    const naEletiva = await admin.matricula.findFirstOrThrow({
      where: { escolaId: ESCOLA, usuarioId: ids.ana, turmaId: eletiva.id },
    });
    await rostering.tornarPrincipal(ESCOLA, naEletiva.id);

    const todas = await admin.matricula.findMany({
      where: { escolaId: ESCOLA, usuarioId: ids.ana, papel: "estudante", fim: null },
    });
    expect(todas).toHaveLength(2); // nada foi encerrado
    expect(todas.filter((m) => m.principal)).toHaveLength(1);
    expect(todas.find((m) => m.principal)?.turmaId).toBe(eletiva.id);

    const ana = await admin.user.findUniqueOrThrow({ where: { id: ids.ana } });
    expect(ana.turmaId).toBe(eletiva.id); // o cache seguiu a referência

    // devolve o estado para os testes seguintes
    await rostering.tornarPrincipal(
      ESCOLA,
      (
        await admin.matricula.findFirstOrThrow({
          where: { escolaId: ESCOLA, usuarioId: ids.ana, turmaId: ids.turma8A },
        })
      ).id,
    );
    await admin.matricula.deleteMany({ where: { turmaId: eletiva.id } });
    await admin.turma.delete({ where: { id: eletiva.id } });
  });

  test("mover de turma encerra na origem E abre no destino, num passo", async () => {
    const daOito = await admin.matricula.findFirstOrThrow({
      where: { escolaId: ESCOLA, usuarioId: ids.ana, turmaId: ids.turma8A, fim: null },
    });
    await rostering.moverDeTurma(ESCOLA, daOito.id, ids.turma9B);

    const ativas = await admin.matricula.findMany({
      where: { escolaId: ESCOLA, usuarioId: ids.ana, papel: "estudante", fim: null },
    });
    expect(ativas.map((m) => m.turmaId)).toEqual([ids.turma9B]);
    // A linha antiga continua lá, encerrada: é ela que dá turma ao histórico.
    const antiga = await admin.matricula.findUniqueOrThrow({ where: { id: daOito.id } });
    expect(antiga.fim).not.toBeNull();

    const ana = await admin.user.findUniqueOrThrow({ where: { id: ids.ana } });
    expect(ana.turmaId).toBe(ids.turma9B);

    // volta para o 8A, que é o que os testes seguintes esperam
    await rostering.moverDeTurma(ESCOLA, ativas[0]!.id, ids.turma8A);
  });

  test("encerrar matrícula tira da turma sem apagar a linha", async () => {
    // `fim: null`: depois de mover e voltar, a Ana tem linhas ENCERRADAS no 8A
    // também — e encerrar uma delas não tiraria ninguém de turma nenhuma.
    const matricula = await admin.matricula.findFirstOrThrow({
      where: { escolaId: ESCOLA, usuarioId: ids.ana, papel: "estudante", fim: null },
    });
    await rostering.encerrarMatricula(ESCOLA, matricula.id);

    const turma = await rostering.pessoasDaTurma(ESCOLA, ids.turma8A);
    expect(turma?.estudantes).toHaveLength(0);
    const depois = await admin.matricula.findUniqueOrThrow({ where: { id: matricula.id } });
    expect(depois.fim).not.toBeNull();
  });
});
