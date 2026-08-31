import { PrismaClient } from "@prisma/client";

import { distribuicaoDaTurma } from "../src/perfis/distribuicao";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * A distribuição da atividade do Instanooria não pode enxergar estudante de outra
 * escola.
 *
 * Este teste existe porque `distribuicaoDaTurma` rodava
 * `user.findMany({ where: { role: 'aluno' } })` — sem `escolaId`. E `users` está
 * FORA da RLS: a lista de tabelas com policy em `20260824145301_init` não a
 * inclui, e o `comTenancy` só arma `app.escola_id`, sem tocar no `where` do
 * Prisma. O painel do professor listava nome e login de crianças de toda escola
 * do contrato, e `POST :id/redistribuir` decidia quantos estudantes mover a partir
 * dessa contagem.
 *
 * Roda como superusuário (é o Postgres local do README), então a RLS está
 * bypassada de qualquer jeito — o que este teste mede é o `where` explícito, que
 * é a tranca que a regra nº 1 exige ALÉM da RLS.
 *
 * UMA ESCOLA POR SUÍTE não vale aqui: o ponto é justamente haver duas. Os dois
 * ids começam com `teste-`, que é o que mantém `identidade-unica.spec.ts` fora
 * do caminho (ele filtra `escola_id NOT LIKE 'teste-%'`).
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA_A = "teste-distrib-a";
const ESCOLA_B = "teste-distrib-b";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

let activityId = "";

async function limpar() {
  for (const escolaId of [ESCOLA_A, ESCOLA_B]) {
    await prisma.run.deleteMany({ where: { escolaId } });
    await prisma.perfilImportado.deleteMany({ where: { escolaId } });
    await prisma.activity.deleteMany({ where: { escolaId } });
    await prisma.user.deleteMany({ where: { escolaId } });
    await prisma.turma.deleteMany({ where: { escolaId } });
    await prisma.escola.deleteMany({ where: { id: escolaId } });
  }
}

beforeAll(async () => {
  await limpar();

  await prisma.escola.create({ data: { id: ESCOLA_A, nome: "Escola A (teste)" } });
  await prisma.escola.create({ data: { id: ESCOLA_B, nome: "Escola B (teste)" } });

  const turmaA = await criarTurmaDeTeste(prisma, ESCOLA_A, "8A", "8EF");
  const turmaB = await criarTurmaDeTeste(prisma, ESCOLA_B, "8A", "8EF");

  const professor = await prisma.user.create({
    data: {
      role: "professor", escolaId: ESCOLA_A,
      username: "distrib.prof", displayName: "Prof A", passwordHash: "x",
    },
    select: { id: true },
  });

  for (const i of [0, 1]) {
    await prisma.user.create({
      data: {
        role: "estudante", escolaId: ESCOLA_A, turmaId: turmaA.id,
        username: `distrib.a${i}`, displayName: `Estudante A${i}`, passwordHash: "x",
      },
    });
  }
  await prisma.user.create({
    data: {
      role: "estudante", escolaId: ESCOLA_B, turmaId: turmaB.id,
      username: "distrib.b0", displayName: "Estudante da outra escola", passwordHash: "x",
    },
  });

  activityId = (
    await prisma.activity.create({
      data: {
        escolaId: ESCOLA_A, professorId: professor.id,
        titulo: "T", disciplina: "D", temaGeral: "TG", recorte: "R",
        perguntaChave: "PC", estiloVisual: "EV", proporcoes: {}, engineConfig: {},
      },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("distribuição da atividade e as fronteiras da escola", () => {
  test("só lista estudantes da escola da atividade", async () => {
    const distribuicao = await distribuicaoDaTurma(prisma, activityId, null, ESCOLA_A);

    expect(distribuicao.alunos).toHaveLength(2);
    expect(distribuicao.alunos.map((a) => a.username).sort()).toEqual([
      "distrib.a0",
      "distrib.a1",
    ]);
  });

  test("o estudante da outra escola não aparece nem pelo nome", async () => {
    const distribuicao = await distribuicaoDaTurma(prisma, activityId, null, ESCOLA_A);

    const nomes = distribuicao.alunos.map((a) => a.displayName);
    expect(nomes).not.toContain("Estudante da outra escola");
    expect(distribuicao.alunos.some((a) => a.username.startsWith("distrib.b"))).toBe(false);
  });

  /**
   * `semLado` alimenta `desequilibrio` e `precisaRedistribuir`, e é a partir
   * deles que `POST :id/redistribuir` decide QUANTOS mover. Contar a escola
   * inteira aqui movia estudante a mais na sala certa.
   */
  test("a contagem que decide a redistribuição também é só desta escola", async () => {
    const distribuicao = await distribuicaoDaTurma(prisma, activityId, null, ESCOLA_A);

    expect(distribuicao.semLado).toBe(2);
    expect(distribuicao.contagem).toEqual({ A: 0, B: 0 });
  });
});
