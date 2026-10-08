import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { ContextoDaEvidenciaDoUnoovista, RODADA_DO_UNOOVISTA } from "../src/motor/contexto-da-evidencia";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * A EVIDÊNCIA DO UNOOVISTA (exp08ef1b) no Postgres: a FICHA REAL do registro
 * e o resolvedor REAL do motor (`motor/contexto-da-evidencia.ts`), sem nada
 * trocado por teste. A suíte da plataforma (`evidencias-postgres.spec.ts`)
 * prova as regras com uma ficha falsa; esta prova que a missão está ligada:
 * a pergunta só conta depois da reflexão salva, só em atividade de turma, e
 * sempre na rodada 1.
 *
 * UMA ESCOLA POR SUÍTE: o Jest paraleliza, e limpeza compartilhada corromperia
 * a outra.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-motor-evidencia";
const UNOOVISTA = "exp08ef1b";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

const evidencias = new EvidenciasService(prisma, new EquipesService(prisma));
evidencias.onModuleInit();
new ContextoDaEvidenciaDoUnoovista(evidencias).onModuleInit();

let turmaId = "";
let professorId = "";
let atividadeId = "";
let atividadeSemTurmaId = "";
const estudantes: Record<string, string> = {};
const runs: Record<string, string> = {};

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.evidencia.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.liberacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.run.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.activity.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

async function criarAtividade(turma: string | null) {
  const { id } = await prisma.activity.create({
    data: {
      escolaId: ESCOLA,
      professorId,
      turmaId: turma,
      status: "ativa",
      titulo: "T",
      disciplina: "D",
      temaGeral: "TG",
      recorte: "R",
      perguntaChave: "PC",
      estiloVisual: "EV",
      proporcoes: {},
      engineConfig: {},
    },
    select: { id: true },
  });
  return id;
}

async function recusa(promessa: Promise<unknown>) {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), corpo: e.getResponse() };
    throw e;
  }
  throw new Error("era para recusar");
}

const evidenciaDe = (estudanteId: string, habilidade: string) =>
  prisma.evidencia.findFirst({
    where: { escolaId: ESCOLA, expId: UNOOVISTA, estudanteId, habilidade },
    select: { status: true, origem: true, situacao: true, atividadeId: true, rodada: true },
  });

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola da evidência do Unoovista (teste)" } });
  turmaId = (await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF")).id;
  professorId = (
    await prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA, username: "mev.prof", displayName: "Prof", passwordHash: "x" },
      select: { id: true },
    })
  ).id;
  for (const nome of ["ana", "bia", "caio"]) {
    estudantes[nome] = (
      await prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA, turmaId, username: `mev.${nome}`, displayName: nome, passwordHash: "x" },
        select: { id: true },
      })
    ).id;
  }
  await liberarParaTeste(prisma, ESCOLA, turmaId, UNOOVISTA, professorId);

  atividadeId = await criarAtividade(turmaId);
  atividadeSemTurmaId = await criarAtividade(null);
  for (const nome of ["ana", "bia"]) {
    runs[nome] = (
      await prisma.run.create({
        data: { escolaId: ESCOLA, activityId: atividadeId, estudanteId: estudantes[nome]!, fase: "reflexao", ladoInicial: "A", engineState: {} },
        select: { id: true },
      })
    ).id;
  }
  // O Caio só tem run na atividade SEM turma (a legada, da escola inteira).
  runs.caio = (
    await prisma.run.create({
      data: { escolaId: ESCOLA, activityId: atividadeSemTurmaId, estudanteId: estudantes.caio!, fase: "reflexao", ladoInicial: "A", engineState: {} },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

const salvarReflexao = (runId: string) =>
  prisma.reflexao.create({ data: { runId, escolaId: ESCOLA, texto: "x".repeat(80) } });

describe("a evidência do Unoovista, com a ficha e o resolvedor reais", () => {
  it("a ficha do registro serve as três perguntas, sem gabarito", async () => {
    for (const id of ["p1", "p2", "p3"]) {
      const p = await evidencias.pergunta(ESCOLA, estudantes.ana!, UNOOVISTA, id);
      expect(p.alternativas).toHaveLength(3);
      expect(JSON.stringify(p)).not.toContain("status");
    }
  });

  it("antes da reflexão salva, a resposta não conta: 409", async () => {
    expect(await recusa(evidencias.responder(ESCOLA, estudantes.ana!, UNOOVISTA, "p1", "A1"))).toMatchObject({
      status: 409,
      corpo: { codigo: "sem-atividade-em-andamento" },
    });
    expect(await evidenciaDe(estudantes.ana!, "EF08CO11")).toBeNull();
  });

  it("depois da reflexão, cai na atividade da run, rodada 1, e vale a primeira", async () => {
    await salvarReflexao(runs.ana!);
    await evidencias.responder(ESCOLA, estudantes.ana!, UNOOVISTA, "p1", "A2");
    await evidencias.responder(ESCOLA, estudantes.ana!, UNOOVISTA, "p1", "A1");
    expect(await evidenciaDe(estudantes.ana!, "EF08CO11")).toEqual({
      status: "em_processo",
      origem: "propria",
      situacao: "valida",
      atividadeId,
      rodada: RODADA_DO_UNOOVISTA,
    });
  });

  it("cada pergunta mede a sua habilidade", async () => {
    await salvarReflexao(runs.bia!);
    await evidencias.responder(ESCOLA, estudantes.bia!, UNOOVISTA, "p2", "B1");
    await evidencias.responder(ESCOLA, estudantes.bia!, UNOOVISTA, "p3", "C3");
    expect((await evidenciaDe(estudantes.bia!, "EF08CO09"))?.status).toBe("atingiu");
    expect((await evidenciaDe(estudantes.bia!, "EF08CO07"))?.status).toBe("nao_atingiu");
    expect(await evidenciaDe(estudantes.bia!, "EF08CO11")).toBeNull();
  });

  it("atividade sem turma (a legada) não gera evidência: 409", async () => {
    await salvarReflexao(runs.caio!);
    expect(await recusa(evidencias.responder(ESCOLA, estudantes.caio!, UNOOVISTA, "p1", "A1"))).toMatchObject({
      status: 409,
    });
  });
});
