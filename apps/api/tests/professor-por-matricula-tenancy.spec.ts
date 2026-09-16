import { PrismaClient } from "@prisma/client";
import { MockProvider } from "../src/ai/mock.provider";
import { QuotaService } from "../src/ai/quota.service";
import { professorEnsinaOEstudante } from "../src/comum/turmas-do-professor";
import { PrismaService } from "../src/prisma/prisma.service";
import { UnoogptService } from "../src/unoogpt/unoogpt.service";
import { VilaService } from "../src/vila/vila.service";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O ESCOPO DO PROFESSOR É A MATRÍCULA, e esta suíte cobra as rotas que ficaram
 * de fora quando `comum/turmas-do-professor.ts` nasceu.
 *
 * Os seletores e as folhas de turma já passavam pela porta única; estas seis não
 * passavam, e a única prova que exigiam era "mesma escola do token" — que é a
 * regra de TENANCY, não a de quem dá aula ali. O que dava, em concreto:
 * qualquer professor da escola ZERAVA a missão de qualquer turma, DAVA A LARGADA
 * na aula de uma turma que não é dele, e abria o relatório individual — com
 * leitura de perfil e transcrição de texto livre de menor — de qualquer criança.
 *
 * Roda como SUPERUSUÁRIO de propósito, como `perfis-distribuicao-tenancy`: a RLS
 * de `matriculas` mascararia a falta de um `where` e faria o teste passar pelo
 * motivo errado. O que se prova aqui é o filtro da APLICAÇÃO. A política de RLS
 * tem suíte própria (`matriculas-tenancy`).
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-prof-matricula";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const vila = new VilaService(prisma);
const unoogpt = new UnoogptService(
  prisma,
  new MockProvider(),
  new QuotaService(prisma),
);

/** `undefined` é gestor/gestor_contrato: enxergam a escola inteira, de propósito. */
const GESTOR = undefined;

const ids = { turma8A: "", turma9B: "", prof8A: "", prof9B: "", ana: "", bruno: "", semTurma: "" };

async function limpar() {
  await prisma.unoogptRelogioTurma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do teste de matrícula" } });

  ids.turma8A = (await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF")).id;
  ids.turma9B = (await criarTurmaDeTeste(prisma, ESCOLA, "9B", "9EF")).id;

  const pessoa = async (username: string, role: string, turmaId?: string) =>
    (
      await prisma.user.create({
        data: { escolaId: ESCOLA, username, role, displayName: username, passwordHash: "x", turmaId },
      })
    ).id;

  ids.prof8A = await pessoa("prof-8a", "professor");
  ids.prof9B = await pessoa("prof-9b", "professor");
  ids.ana = await pessoa("ana-8a", "estudante", ids.turma8A);
  ids.bruno = await pessoa("bruno-9b", "estudante", ids.turma9B);
  /* Cache preenchido e matrícula AUSENTE: é a divergência que a guarda tem de
     tolerar, senão o nome que a folha lista abre uma tela que diz "não
     encontrado" — as listagens destes módulos partem de `users.turma_id`. */
  ids.semTurma = await pessoa("carla-8a-so-cache", "estudante", ids.turma8A);

  const matricular = (turmaId: string, usuarioId: string, papel: string) =>
    prisma.matricula.create({
      data: {
        escolaId: ESCOLA,
        turmaId,
        usuarioId,
        papel,
        principal: papel === "estudante",
        inicio: new Date(Date.UTC(2026, 0, 1)),
      },
    });

  await matricular(ids.turma8A, ids.prof8A, "professor");
  await matricular(ids.turma9B, ids.prof9B, "professor");
  await matricular(ids.turma8A, ids.ana, "estudante");
  await matricular(ids.turma9B, ids.bruno, "estudante");
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

const ensina = (estudanteId: string, professorId?: string) =>
  prisma.comTenancy((tx) => professorEnsinaOEstudante(tx, ESCOLA, estudanteId, professorId), ESCOLA);

describe("professorEnsinaOEstudante", () => {
  test("aceita a criança da turma dele, pela matrícula", async () => {
    await expect(ensina(ids.ana, ids.prof8A)).resolves.toBe(true);
  });

  test("RECUSA a criança da turma do colega", async () => {
    await expect(ensina(ids.bruno, ids.prof8A)).resolves.toBe(false);
    await expect(ensina(ids.ana, ids.prof9B)).resolves.toBe(false);
  });

  test("aceita pelo CACHE quando a matrícula ainda não existe", async () => {
    await expect(ensina(ids.semTurma, ids.prof8A)).resolves.toBe(true);
    // …e o cache não vira porta dos fundos: continua sendo uma turma DELE.
    await expect(ensina(ids.semTurma, ids.prof9B)).resolves.toBe(false);
  });

  test("gestor passa: o papel dele é da ESCOLA, não da turma", async () => {
    await expect(ensina(ids.bruno, GESTOR)).resolves.toBe(true);
  });

  test("matrícula ENCERRADA não vale — e o cache limpo não a resgata", async () => {
    const fora = await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "davi-saiu",
        role: "estudante",
        displayName: "davi",
        passwordHash: "x",
      },
    });
    await prisma.matricula.create({
      data: {
        escolaId: ESCOLA,
        turmaId: ids.turma8A,
        usuarioId: fora.id,
        papel: "estudante",
        principal: true,
        inicio: new Date(Date.UTC(2026, 0, 1)),
        fim: new Date(Date.UTC(2026, 5, 30)),
      },
    });
    await expect(ensina(fora.id, ids.prof8A)).resolves.toBe(false);
  });
});

describe("Vila do Lume: as rotas que conferiam só a escola", () => {
  test("bolhasDaTurma responde para o professor da turma, e não para o colega", async () => {
    await expect(vila.bolhasDaTurma(ESCOLA, ids.turma8A, ids.prof8A)).resolves.not.toBeNull();
    await expect(vila.bolhasDaTurma(ESCOLA, ids.turma8A, ids.prof9B)).resolves.toBeNull();
    await expect(vila.bolhasDaTurma(ESCOLA, ids.turma8A, GESTOR)).resolves.not.toBeNull();
  });

  test("zerarTurma RECUSA o professor que não leciona ali", async () => {
    await expect(vila.zerarTurma(ESCOLA, ids.turma8A, ids.prof9B)).resolves.toBeNull();
    await expect(vila.zerarTurma(ESCOLA, ids.turma8A, ids.prof8A)).resolves.not.toBeNull();
  });

  test("doEstudante não entrega a criança do colega", async () => {
    await expect(vila.doEstudante(ESCOLA, ids.bruno, ids.prof8A)).resolves.toBeNull();
  });
});

describe("unooGPT: o relógio da AULA e a linha da criança", () => {
  test("a largada do colega é recusada — e o relógio NÃO anda", async () => {
    await expect(unoogpt.mexerNoRelogio(ESCOLA, ids.turma8A, "largada", ids.prof9B)).rejects.toThrow();

    const relogio = await prisma.unoogptRelogioTurma.findUnique({
      where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: ids.turma8A } },
    });
    /* O que importa não é o erro: é a aula não ter começado. Antes desta
       checagem, a linha nascia com `iniciadoEm` e a turma inteira via o
       cronômetro correr por causa do clique de quem não estava na sala. */
    expect(relogio?.iniciadoEm ?? null).toBeNull();
  });

  test("o professor da turma dá a largada", async () => {
    const retrato = await unoogpt.mexerNoRelogio(ESCOLA, ids.turma8A, "largada", ids.prof8A);
    expect(retrato).toBeTruthy();
    const relogio = await prisma.unoogptRelogioTurma.findUnique({
      where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: ids.turma8A } },
    });
    expect(relogio?.iniciadoEm).not.toBeNull();
  });

  test("zerarTurma e doEstudante recusam quem não é da sala", async () => {
    await expect(unoogpt.zerarTurma(ESCOLA, ids.turma8A, ids.prof9B)).rejects.toThrow();
    await expect(unoogpt.doEstudante(ESCOLA, ids.ana, ids.prof9B)).rejects.toThrow();
  });
});
