import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { AgenteProfessorMock } from "../src/ai/agent-engine.client";
import type { QuotaService } from "../src/ai/quota.service";
import { AgenteProfessorService } from "../src/agente-professor/agente-professor.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";

/**
 * O agente de IA do professor no Postgres: a tabela da POSSE com RLS de
 * verdade (pela role de runtime, sem ownership — a do postgres é superusuário e
 * atravessaria a política), `escola_id NOT NULL`, as FKs, e a posse por
 * (professor, escola ativa) com o professor lotado em DUAS escolas.
 *
 * UMA ESCOLA POR SUÍTE (mais a segunda, só desta suíte). O agente é o `mock`.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-agente-professor";
const OUTRA = "teste-agente-professor-b";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

const quotaFalsa = { temSaldo: async () => true, consumir: async () => 0 } as unknown as QuotaService;
const service = new AgenteProfessorService(runtime, new AgenteProfessorMock(), quotaFalsa);

const ids = { professor: "", colega: "" };

async function limpar() {
  await prisma.agenteProfessorConversa.deleteMany({ where: { escolaId: { in: [ESCOLA, OUTRA] } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: [ESCOLA, OUTRA] } } });
  await prisma.escola.deleteMany({ where: { id: { in: [ESCOLA, OUTRA] } } });
}

async function statusDe(p: Promise<unknown>): Promise<number | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof HttpException) return e.getStatus();
    throw e;
  }
}

beforeAll(async () => {
  await limpar();
  await criarRoleDeRuntime(prisma);
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do agente" } });
  await prisma.escola.create({ data: { id: OUTRA, nome: "Segunda escola do agente" } });
  const pessoa = async (username: string, displayName: string) =>
    (await prisma.user.create({ data: { escolaId: ESCOLA, username, role: "professor", displayName, passwordHash: "x" } })).id;
  ids.professor = await pessoa("agente-prof", "Carla Mendes");
  ids.colega = await pessoa("agente-colega", "Rui Alves");
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("a tabela", () => {
  test("RLS LIGADA e FORÇADA, com a política por escola", async () => {
    const [t] = await prisma.$queryRaw<Array<{ ligada: boolean; forcada: boolean }>>`
      SELECT relrowsecurity AS ligada, relforcerowsecurity AS forcada
        FROM pg_class WHERE relname = 'agente_professor_conversas'`;
    expect(t).toEqual({ ligada: true, forcada: true });
    const politicas = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'agente_professor_conversas'`;
    expect(politicas.map((p) => p.policyname)).toEqual(["agente_professor_conversas_por_escola"]);
  });

  test("escola_id e usuario_id NOT NULL, com FK para escolas e users; sessao_id único", async () => {
    const colunas = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
      SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'agente_professor_conversas' AND column_name IN ('escola_id', 'usuario_id', 'sessao_id', 'titulo')
       ORDER BY column_name`;
    expect(colunas).toEqual([
      { column_name: "escola_id", is_nullable: "NO" },
      { column_name: "sessao_id", is_nullable: "NO" },
      { column_name: "titulo", is_nullable: "YES" },
      { column_name: "usuario_id", is_nullable: "NO" },
    ]);
    const fks = await prisma.$queryRaw<Array<{ alvo: string }>>`
      SELECT ccu.table_name AS alvo
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
       WHERE tc.table_name = 'agente_professor_conversas' AND tc.constraint_type = 'FOREIGN KEY'
       ORDER BY 1`;
    expect(fks.map((f) => f.alvo)).toEqual(["escolas", "users"]);
    await prisma.agenteProfessorConversa.create({ data: { escolaId: ESCOLA, usuarioId: ids.professor, sessaoId: "dup-1" } });
    await expect(
      prisma.agenteProfessorConversa.create({ data: { escolaId: ESCOLA, usuarioId: ids.colega, sessaoId: "dup-1" } }),
    ).rejects.toThrow();
    await prisma.agenteProfessorConversa.deleteMany({ where: { sessaoId: "dup-1" } });
  });

  test("título acima de 120 caracteres o banco recusa", async () => {
    await expect(
      prisma.agenteProfessorConversa.create({
        data: { escolaId: ESCOLA, usuarioId: ids.professor, sessaoId: "longo-1", titulo: "x".repeat(121) },
      }),
    ).rejects.toThrow();
  });
});

describe("a posse, pela role de runtime (RLS valendo)", () => {
  test("criar, listar, ler, conversar e apagar — e nada atravessa escola nem professor", async () => {
    const eu = { escolaId: ESCOLA, usuarioId: ids.professor };
    const { id } = await service.criar(eu);

    expect((await service.listar(eu)).map((c) => c.id)).toEqual([id]);
    /* O mesmo professor, com a OUTRA escola ativa: a lista é outra. */
    expect(await service.listar({ escolaId: OUTRA, usuarioId: ids.professor })).toEqual([]);
    expect(await statusDe(service.ler({ escolaId: OUTRA, usuarioId: ids.professor }, id))).toBe(404);
    /* O colega da MESMA escola. */
    expect(await statusDe(service.ler({ escolaId: ESCOLA, usuarioId: ids.colega }, id))).toBe(404);

    /* A RLS por si: numa transação da outra escola, a linha não existe. */
    const vistas = await runtime.comTenancy((tx) => tx.agenteProfessorConversa.count({ where: { id } }), OUTRA);
    expect(vistas).toBe(0);

    const conversa = await service.ler(eu, id);
    expect(conversa).toEqual({ id, titulo: null, mensagens: [] });

    await service.apagar(eu, id);
    expect(await service.listar(eu)).toEqual([]);
  });
});
