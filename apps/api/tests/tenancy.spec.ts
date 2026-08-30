import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { comEscolaNoContexto } from "../src/tenancy/tenancy-context";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";

/**
 * Teste de contrato da regra inviolável nº 1: a RLS impede que uma conexão de
 * runtime leia/escreva dados de outra escola, MESMO que o código da aplicação
 * esqueça o WHERE escola_id.
 *
 * O superusuário local (postgres) ignora RLS por definição, então o teste cria
 * uma role de runtime sem ownership (`app_runtime_test`) — o mesmo desenho da
 * produção (role `app_runtime` criada pela infra) — e conecta com ela.
 */

const ADMIN_URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const RUNTIME_URL = urlDeRuntime(ADMIN_URL);

const ESCOLA_A = "teste-escola-a";
const ESCOLA_B = "teste-escola-b";

const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
let runtime: PrismaService;

async function limparDadosDeTeste() {
  await admin.progresso.deleteMany({ where: { escolaId: { in: [ESCOLA_A, ESCOLA_B] } } });
  await admin.user.deleteMany({ where: { escolaId: { in: [ESCOLA_A, ESCOLA_B] } } });
  await admin.escola.deleteMany({ where: { id: { in: [ESCOLA_A, ESCOLA_B] } } });
}

beforeAll(async () => {
  await criarRoleDeRuntime(admin);

  await limparDadosDeTeste();
  for (const [id, nome] of [
    [ESCOLA_A, "Escola A (teste)"],
    [ESCOLA_B, "Escola B (teste)"],
  ] as const) {
    await admin.escola.create({ data: { id, nome } });
    await admin.progresso.create({
      data: { escolaId: id, estudanteId: `aluno-${id}`, expId: "exp-teste", dados: { origem: id } },
    });
  }

  runtime = new PrismaService({ datasources: { db: { url: RUNTIME_URL } } });
});

afterAll(async () => {
  await limparDadosDeTeste();
  await runtime.$disconnect();
  await admin.$disconnect();
});

describe("RLS por escola (role de runtime, sem ownership)", () => {
  test("sem set_config, a conexão de runtime não enxerga NENHUMA linha", async () => {
    const linhas = await runtime.progresso.findMany({ where: { expId: "exp-teste" } });
    expect(linhas).toHaveLength(0);
  });

  test("comTenancy(escola A) enxerga só a escola A — mesmo SEM where de escola", async () => {
    const linhas = await runtime.comTenancy(
      (tx) => tx.progresso.findMany({ where: { expId: "exp-teste" } }),
      ESCOLA_A,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.escolaId).toBe(ESCOLA_A);
  });

  test("comTenancy(escola A) não alcança linha da escola B nem por chave direta", async () => {
    const linha = await runtime.comTenancy(
      (tx) =>
        tx.progresso.findUnique({
          where: {
            escolaId_estudanteId_expId: {
              escolaId: ESCOLA_B,
              estudanteId: `aluno-${ESCOLA_B}`,
              expId: "exp-teste",
            },
          },
        }),
      ESCOLA_A,
    );
    expect(linha).toBeNull();
  });

  test("escrita cross-escola é rejeitada pelo WITH CHECK da política", async () => {
    await expect(
      runtime.comTenancy(
        (tx) =>
          tx.progresso.create({
            data: { escolaId: ESCOLA_B, estudanteId: "intruso", expId: "exp-teste", dados: {} },
          }),
        ESCOLA_A,
      ),
    ).rejects.toThrow();
  });

  test("o set_config é LOCAL à transação: a conexão volta limpa ao pool", async () => {
    await runtime.comTenancy((tx) => tx.progresso.findMany(), ESCOLA_A);
    const depois = await runtime.progresso.findMany({ where: { expId: "exp-teste" } });
    expect(depois).toHaveLength(0);
  });

  test("comTenancy sem escola no contexto e sem escolaId explícito falha alto", async () => {
    await expect(runtime.comTenancy((tx) => tx.progresso.findMany())).rejects.toThrow(
      /comTenancy sem escola/,
    );
  });

  test("comTenancy lê a escola do AsyncLocalStorage quando o contexto existe", async () => {
    const linhas = await comEscolaNoContexto(ESCOLA_A, () =>
      runtime.comTenancy((tx) => tx.progresso.findMany({ where: { expId: "exp-teste" } })),
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.escolaId).toBe(ESCOLA_A);
  });
});
