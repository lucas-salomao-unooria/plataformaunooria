import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";

/**
 * Regra inviolável nº 1 para as tabelas da exp-90: `exp_90_planos` obedece a
 * RLS por escola com a role de runtime; `exp_90_referencias` é catálogo do
 * CONTRATO e fica FORA da RLS de propósito (legível sem set_config).
 */

const ADMIN_URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const RUNTIME_URL = urlDeRuntime(ADMIN_URL);

const ESCOLA_A = "teste-planos-rls-a";
const ESCOLA_B = "teste-planos-rls-b";
const DISCIPLINA = "teste-planos-rls";

const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
let runtime: PrismaService;

async function limpar() {
  await admin.planoDeAula.deleteMany({ where: { escolaId: { in: [ESCOLA_A, ESCOLA_B] } } });
  await admin.planoReferencia.deleteMany({ where: { disciplina: DISCIPLINA } });
  await admin.user.deleteMany({ where: { escolaId: { in: [ESCOLA_A, ESCOLA_B] } } });
  await admin.escola.deleteMany({ where: { id: { in: [ESCOLA_A, ESCOLA_B] } } });
}

beforeAll(async () => {
  await criarRoleDeRuntime(admin);

  await limpar();
  for (const id of [ESCOLA_A, ESCOLA_B]) {
    await admin.escola.create({ data: { id, nome: `Escola ${id}` } });
    const prof = await admin.user.create({
      data: { role: "professor", escolaId: id, username: `prof-${id}`, displayName: "Prof", passwordHash: "x" },
      select: { id: true },
    });
    await admin.planoDeAula.create({
      data: { escolaId: id, professorId: prof.id, serie: "8EF", disciplina: DISCIPLINA, titulo: `Plano ${id}` },
    });
  }
  await admin.planoReferencia.create({
    data: { disciplina: DISCIPLINA, serie: "8EF", nome: "Ref", texto: "texto do contrato" },
  });
  runtime = new PrismaService({ datasources: { db: { url: RUNTIME_URL } } });
});

afterAll(async () => {
  await limpar();
  await runtime.$disconnect();
  await admin.$disconnect();
});

describe("planos_de_aula sob RLS (role de runtime)", () => {
  test("sem set_config a runtime não enxerga nenhum plano", async () => {
    expect(await runtime.planoDeAula.findMany({ where: { disciplina: DISCIPLINA } })).toHaveLength(0);
  });

  test("comTenancy(A) enxerga só A, mesmo sem where de escola", async () => {
    const linhas = await runtime.comTenancy(
      (tx) => tx.planoDeAula.findMany({ where: { disciplina: DISCIPLINA } }),
      ESCOLA_A,
    );
    expect(linhas.map((l) => l.escolaId)).toEqual([ESCOLA_A]);
  });

  test("comTenancy(A) não atualiza nem apaga plano de B", async () => {
    const deB = await admin.planoDeAula.findFirstOrThrow({ where: { escolaId: ESCOLA_B } });
    const upd = await runtime.comTenancy(
      (tx) => tx.planoDeAula.updateMany({ where: { id: deB.id }, data: { titulo: "invadido" } }),
      ESCOLA_A,
    );
    expect(upd.count).toBe(0);
    const del = await runtime.comTenancy((tx) => tx.planoDeAula.deleteMany({ where: { id: deB.id } }), ESCOLA_A);
    expect(del.count).toBe(0);
    expect((await admin.planoDeAula.findUniqueOrThrow({ where: { id: deB.id } })).titulo).toBe(`Plano ${ESCOLA_B}`);
  });

  test("inserir plano com escola_id de B dentro da transação de A é recusado", async () => {
    const profB = await admin.user.findFirstOrThrow({ where: { escolaId: ESCOLA_B } });
    await expect(
      runtime.comTenancy(
        (tx) =>
          tx.planoDeAula.create({
            data: { escolaId: ESCOLA_B, professorId: profB.id, serie: "8EF", disciplina: DISCIPLINA, titulo: "x" },
          }),
        ESCOLA_A,
      ),
    ).rejects.toThrow();
  });
});

describe("planos_referencias fora da RLS (catálogo do contrato)", () => {
  test("a runtime lê as referências SEM set_config — é intencional", async () => {
    const refs = await runtime.planoReferencia.findMany({ where: { disciplina: DISCIPLINA } });
    expect(refs).toHaveLength(1);
  });
});
