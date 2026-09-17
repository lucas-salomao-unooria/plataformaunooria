import { PrismaClient } from "@prisma/client";
import { ROLES_KEY } from "../src/auth/roles";
import { PERFIS_COM_QUOTA, QUOTA_PADRAO, QuotaService, perfilDaQuota } from "../src/ai/quota.service";
import { DefinirQuotaDeIaSchema } from "../src/recursos/contrato-de-rotas";
import { QuotasDeIaController } from "../src/recursos/quotas-de-ia.controller";
import { RecursosAuditoriaController } from "../src/recursos/recursos-auditoria.controller";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * A QUOTA DE IA COMO DADO (ADR-105): a linha de `ia_quotas` é o teto que o
 * `QuotaService` aplica, e só o `admin` a muda — com motivo, e deixando rastro.
 *
 * `ia_quotas` é tabela de CONTRATO (sem `escola_id`), e esta suíte ESCREVE nela
 * — é a rota sob teste, e não existe variante por escola. Duas precauções, e
 * as duas são deliberadas: (a) a suíte só SOBE o teto (um valor acima do padrão
 * não recusa ninguém, então uma corrida abortada no meio não derruba outra
 * suíte — a lição das linhas de escopo-contrato de `disponibilidades`); (b) o
 * valor original volta no `afterEach`, mesmo em falha. O aperto (recusa) se
 * prova por SUBCLASSE, como `planos.spec.ts` faz.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-quotas-ia";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const controller = new QuotasDeIaController(prisma);
const historico = new RecursosAuditoriaController(prisma);
const quota = new QuotaService(prisma);

let admin = "";
const comoAdmin = () => ({ auth: { usuarioId: admin, escolaId: "", perfil: "admin" as const } });

/** O que valia antes da suíte, para devolver no fim. */
const original = new Map<string, { tokensPorDia: number; motivo: string | null; definidoPor: string | null }>();

async function limparHistorico() {
  await prisma.recursoAuditoria.deleteMany({ where: { recursoId: { startsWith: "quota:" }, escolaId: null, motivo: { startsWith: "[suite]" } } });
}

beforeAll(async () => {
  for (const perfil of PERFIS_COM_QUOTA) {
    const linha = await prisma.iaQuota.findUnique({ where: { perfil } });
    if (linha) original.set(perfil, { tokensPorDia: linha.tokensPorDia, motivo: linha.motivo, definidoPor: linha.definidoPor });
  }
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola das quotas" } });
  admin = (
    await prisma.user.create({
      data: { escolaId: ESCOLA, username: "quotas-admin", role: "admin", displayName: "Rita da Unooria", passwordHash: "x" },
    })
  ).id;
  await limparHistorico();
});

afterEach(async () => {
  for (const [perfil, o] of original) {
    await prisma.iaQuota.update({ where: { perfil }, data: o });
  }
  await limparHistorico();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } }).catch(() => undefined);
  await prisma.escola.deleteMany({ where: { id: ESCOLA } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("a semente da migration", () => {
  test("existe uma linha por perfil da tupla, e o valor é o que valia por env", async () => {
    /* Só vale num banco onde ninguém mexeu ainda — em dev o admin pode ter
       alterado. O que se afirma sem condição é a EXISTÊNCIA da linha. */
    for (const perfil of PERFIS_COM_QUOTA) {
      const linha = await prisma.iaQuota.findUnique({ where: { perfil } });
      expect(linha).not.toBeNull();
      if (linha!.definidoPor === null) expect(linha!.tokensPorDia).toBe(QUOTA_PADRAO[perfil]);
    }
  });

  test("o CHECK de perfil espelha PERFIS_COM_QUOTA — um perfil fora da tupla é recusado", async () => {
    const [c] = await prisma.$queryRaw<{ definicao: string }[]>`
      SELECT pg_get_constraintdef(oid) AS definicao FROM pg_constraint WHERE conname = 'ck_ia_quotas_perfil'`;
    const noBanco = [...(c?.definicao ?? "").matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
    expect(noBanco.sort()).toEqual([...PERFIS_COM_QUOTA].sort());
    await expect(
      prisma.$executeRaw`INSERT INTO ia_quotas (perfil, tokens_por_dia) VALUES ('gestor_contrato', 10)`,
    ).rejects.toThrow();
  });

  test("zero e negativo são recusados pelo BANCO, não só pelo Zod", async () => {
    await expect(prisma.iaQuota.update({ where: { perfil: "estudante" }, data: { tokensPorDia: 0 } })).rejects.toThrow();
    await expect(prisma.iaQuota.update({ where: { perfil: "estudante" }, data: { tokensPorDia: -5 } })).rejects.toThrow();
  });
});

describe("o QuotaService lê a linha", () => {
  test("todo perfil que não é estudante cai na linha professor", () => {
    expect(perfilDaQuota("estudante")).toBe("estudante");
    for (const p of ["professor", "gestor_escola", "gestor_regional", "gestor_contrato", "admin"]) {
      expect(perfilDaQuota(p)).toBe("professor");
    }
  });

  test("mudar a linha muda o teto na chamada seguinte, sem reiniciar nada", async () => {
    const antes = await quota.limite("estudante");
    await prisma.iaQuota.update({ where: { perfil: "estudante" }, data: { tokensPorDia: antes + 1000 } });
    expect(await quota.limite("estudante")).toBe(antes + 1000);
    // e o gestor lê a régua do professor
    expect(await quota.limite("gestor_contrato")).toBe(await quota.limite("professor"));
  });

  test("temSaldo compara o gasto do dia com a linha do PERFIL", async () => {
    /* Aperto por subclasse, e não por escrita na tabela: baixar a linha de
       verdade recusaria a IA de toda suíte que rodasse junto. */
    class Apertada extends QuotaService {
      override async limite(perfil: string): Promise<number> {
        return perfilDaQuota(perfil) === "estudante" ? 10 : super.limite(perfil);
      }
    }
    const apertada = new Apertada(prisma);
    const estudante = "00000000-0000-4000-8000-00000000c0da";
    await prisma.iaUsoDiario.deleteMany({ where: { escolaId: ESCOLA, usuarioId: estudante } });
    await quota.consumir(ESCOLA, estudante, 50);
    expect(await apertada.temSaldo(ESCOLA, estudante, "estudante")).toBe(false);
    expect(await apertada.temSaldo(ESCOLA, estudante, "professor")).toBe(true);
    await prisma.iaUsoDiario.deleteMany({ where: { escolaId: ESCOLA, usuarioId: estudante } });
  });
});

describe("PUT /recursos/quotas-de-ia/:perfil", () => {
  test("a rota é só do admin — o RolesGuard lê exatamente isto", () => {
    expect(Reflect.getMetadata(ROLES_KEY, QuotasDeIaController)).toEqual(["admin"]);
  });

  test("o Zod recusa zero, negativo, fração, acima do teto de sanidade e sem motivo", () => {
    const ok = { tokensPorDia: 400_000, motivo: "[suite] rede pediu mais" };
    expect(DefinirQuotaDeIaSchema.safeParse(ok).success).toBe(true);
    for (const ruim of [
      { ...ok, tokensPorDia: 0 },
      { ...ok, tokensPorDia: -1 },
      { ...ok, tokensPorDia: 1.5 },
      { ...ok, tokensPorDia: 100_000_001 },
      { ...ok, motivo: "" },
      { ...ok, motivo: "ab" },
      { tokensPorDia: 400_000 },
    ]) {
      expect(DefinirQuotaDeIaSchema.safeParse(ruim).success).toBe(false);
    }
  });

  test("grava a linha, devolve quem decidiu e historia com { de, para }", async () => {
    const antes = (await controller.quotas()).quotas.find((q) => q.perfil === "estudante")!;
    const r = await controller.definir("estudante", { tokensPorDia: antes.tokensPorDia + 50_000, motivo: "[suite] rede pediu mais" }, comoAdmin());
    expect(r).toMatchObject({
      perfil: "estudante",
      alterada: true,
      tokensPorDia: antes.tokensPorDia + 50_000,
      motivo: "[suite] rede pediu mais",
      definidoPorNome: "Rita da Unooria",
    });
    expect(await quota.limite("estudante")).toBe(antes.tokensPorDia + 50_000);

    const h = await historico.auditoria(undefined, undefined, undefined, comoAdmin(), "quota:");
    expect(h.linhas[0]).toMatchObject({
      recursoId: "quota:estudante",
      escolaId: null,
      acao: "quota-alterada",
      versao: null,
      detalhe: { de: antes.tokensPorDia, para: antes.tokensPorDia + 50_000 },
      motivo: "[suite] rede pediu mais",
      autorNome: "Rita da Unooria",
    });
    // e o recorte por prefixo não traz linha de outro tipo
    expect(h.linhas.every((l) => l.recursoId.startsWith("quota:"))).toBe(true);
  });

  test("o mesmo valor não grava nem historia — nada mudou", async () => {
    const atual = (await controller.quotas()).quotas.find((q) => q.perfil === "professor")!;
    const antes = (await historico.auditoria(undefined, undefined, undefined, comoAdmin(), "quota:")).linhas.length;
    const r = await controller.definir("professor", { tokensPorDia: atual.tokensPorDia, motivo: "[suite] igual" }, comoAdmin());
    expect(r.alterada).toBe(false);
    expect(r.motivo).toBe(atual.motivo);
    const depois = (await historico.auditoria(undefined, undefined, undefined, comoAdmin(), "quota:")).linhas.length;
    expect(depois).toBe(antes);
  });

  test("perfil fora da tupla é recusado antes de encostar no banco", async () => {
    await expect(controller.definir("gestor_contrato", { tokensPorDia: 10, motivo: "[suite] x" }, comoAdmin())).rejects.toThrow();
  });
});

describe("o histórico cobra o detalhe onde ele significa algo", () => {
  test("quota-alterada SEM detalhe é recusada; ligado COM detalhe também (CHECK bicondicional)", async () => {
    await expect(
      prisma.recursoAuditoria.create({
        data: { recursoId: "quota:estudante", acao: "quota-alterada", autorId: admin, autorNome: "x", motivo: "[suite] sem detalhe" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.recursoAuditoria.create({
        data: { recursoId: "quota:estudante", acao: "ligado", autorId: admin, autorNome: "x", motivo: "[suite] com detalhe", detalhe: { de: 1, para: 2 } },
      }),
    ).rejects.toThrow();
  });
});
