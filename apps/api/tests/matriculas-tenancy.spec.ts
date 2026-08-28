import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { RosteringService } from "../src/rostering/rostering.service";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { periodoDeTeste } from "./turma-de-teste";

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
let runtime: PrismaService;
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
  ids.ana = await pessoa(ESCOLA, "ana-8a", "aluno");

  const matricular = (escolaId: string, turmaId: string, usuarioId: string, papel: string) =>
    admin.matricula.create({
      data: { escolaId, turmaId, usuarioId, papel, principal: papel === "aluno", inicio: periodo.inicio },
    });
  await matricular(ESCOLA, ids.turma8A, ids.prof8A, "professor");
  await matricular(ESCOLA, ids.turma9B, ids.prof9B, "professor");
  await matricular(ESCOLA, ids.turma8A, ids.ana, "aluno");

  runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(ADMIN_URL) } } });
  rostering = new RosteringService(runtime);
});

afterAll(async () => {
  await limpar();
  await runtime.$disconnect();
  await admin.$disconnect();
});

describe("as turmas do professor", () => {
  test("cada professor recebe as SUAS turmas, não as da escola", async () => {
    const doOito = await rostering.turmasDoProfessor(ESCOLA, ids.prof8A);
    expect(doOito.map((t) => t.nome)).toEqual(["8A"]);
    expect(doOito[0]?.alunos).toBe(1);

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

  test("a lista nominal da turma traz os alunos matriculados", async () => {
    const turma = await rostering.pessoasDaTurma(ESCOLA, ids.turma8A);
    expect(turma?.alunos.map((a) => a.usuario)).toEqual(["ana-8a"]);
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

  test("encerrar matrícula tira da turma sem apagar a linha", async () => {
    const matricula = await admin.matricula.findFirstOrThrow({
      where: { escolaId: ESCOLA, usuarioId: ids.ana, papel: "aluno" },
    });
    await rostering.encerrarMatricula(ESCOLA, matricula.id);

    const turma = await rostering.pessoasDaTurma(ESCOLA, ids.turma8A);
    expect(turma?.alunos).toHaveLength(0);
    const depois = await admin.matricula.findUniqueOrThrow({ where: { id: matricula.id } });
    expect(depois.fim).not.toBeNull();
  });
});
