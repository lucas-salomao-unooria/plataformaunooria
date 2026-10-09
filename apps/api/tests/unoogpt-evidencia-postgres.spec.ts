import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { MockProvider } from "../src/ai/mock.provider";
import { QuotaService } from "../src/ai/quota.service";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { SalasService } from "../src/salas/salas.service";
import { ContextoDaEvidenciaDaTempestade } from "../src/unoogpt/contexto-da-evidencia";
import { UnoogptService } from "../src/unoogpt/unoogpt.service";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * A EVIDÊNCIA DA MISSÃO TEMPESTADE (exp02em1b, ADR-154) no Postgres, com a
 * FICHA REAL e o resolvedor REAL. As duas regras só desta régua:
 *
 *   - **vale a MELHOR resposta** da rodada — uma marca só, que a resposta nova
 *     substitui quando é melhor;
 *   - **só conta quando o professor ENCERRA a missão na Sala de Aula**: antes, o
 *     painel vem sem nível e `aguardandoEncerramento`; o encerramento grava a
 *     evidência, e depois a porta fecha.
 *
 * E a rodada é a da TURMA: o "Zerar a turma" a sobe, e a sessão de uma rodada
 * que acabou não responde mais. O `MockProvider` só existe porque o construtor
 * do serviço o pede: nada aqui chama a IA.
 *
 * UMA ESCOLA POR SUÍTE: o Jest paraleliza, e limpeza compartilhada corromperia
 * a outra.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-unoogpt-evidencia";
const TEMPESTADE = "exp02em1b";
const TURMA = "turma";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const salas = new SalasService(prisma);
const evidencias = new EvidenciasService(prisma, new EquipesService(prisma), salas);
evidencias.onModuleInit();
new ContextoDaEvidenciaDaTempestade(evidencias).onModuleInit();
const missao = new UnoogptService(prisma, new MockProvider(), new QuotaService(prisma));

let turmaId = "";
let professorId = "";
const estudantes: Record<string, string> = {};

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.evidencia.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.unoogptGateTurma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.unoogptRelogioTurma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.unoogptSessao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.liberacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
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

/** A sessão de um estudante, no passo dado, na rodada dada (o que `garantirSessao` faria). */
const sessao = (nome: string, passo: string, rodada = 1) =>
  prisma.unoogptSessao.upsert({
    where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: estudantes[nome]! } },
    update: { passo, rodada },
    create: { escolaId: ESCOLA, estudanteId: estudantes[nome]!, turmaId, passo, rodada },
  });

const responder = (nome: string, pergunta: string, alternativa: string) =>
  evidencias.responder(ESCOLA, estudantes[nome]!, TEMPESTADE, pergunta, alternativa);

const marcaDe = (nome: string, marcador: string) =>
  prisma.evidenciaMarca.findMany({
    where: { escolaId: ESCOLA, expId: TEMPESTADE, estudanteId: estudantes[nome]!, marcador },
    select: { status: true, atividadeId: true, rodada: true },
  });

const evidenciaDe = (nome: string, habilidade: string) =>
  prisma.evidencia.findMany({
    where: { escolaId: ESCOLA, expId: TEMPESTADE, estudanteId: estudantes[nome]!, habilidade },
    select: { status: true, origem: true, situacao: true, rodada: true },
    orderBy: { rodada: "asc" },
  });

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola da evidência da Tempestade (teste)" } });
  turmaId = (await criarTurmaDeTeste(prisma, ESCOLA, "2A", "2EM")).id;
  professorId = (
    await prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA, username: "uev.prof", displayName: "Prof", passwordHash: "x" },
      select: { id: true },
    })
  ).id;
  await prisma.matricula.create({
    data: { escolaId: ESCOLA, turmaId, usuarioId: professorId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
  });
  for (const nome of ["ana", "bia", "caio"]) {
    estudantes[nome] = (
      await prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA, turmaId, username: `uev.${nome}`, displayName: nome, passwordHash: "x" },
        select: { id: true },
      })
    ).id;
  }
  /* O catálogo é GLOBAL: o `update` só garante o que a Sala de Aula exige, sem
     tocar em nome nem versão (a lição de `salas-postgres.spec.ts`). */
  await prisma.experiencia.upsert({
    where: { expId: TEMPESTADE },
    update: { publico: "estudante" },
    create: { expId: TEMPESTADE, nome: TEMPESTADE, versaoAtiva: "1.0.0", series: ["2EM"], publico: "estudante" },
  });
  await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "liberada", professorId);
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

describe("a evidência da Missão Tempestade, com a ficha e o resolvedor reais", () => {
  test("fora da tela de resultado, a resposta não conta: 409", async () => {
    await sessao("ana", "investigacao");
    expect(await recusa(responder("ana", "p1", "A1"))).toMatchObject({
      status: 409,
      corpo: { codigo: "sem-atividade-em-andamento" },
    });
  });

  test("vale a MELHOR resposta: uma marca só, na atividade \"turma\", rodada 1", async () => {
    await sessao("ana", "resultado");
    await responder("ana", "p1", "A3");
    expect(await marcaDe("ana", "p1")).toEqual([{ status: "nao_atingiu", atividadeId: TURMA, rodada: 1 }]);
    await responder("ana", "p1", "A1");
    expect(await marcaDe("ana", "p1")).toEqual([{ status: "atingiu", atividadeId: TURMA, rodada: 1 }]);
    // Pior depois de melhor não derruba.
    await responder("ana", "p1", "A2");
    expect(await marcaDe("ana", "p1")).toEqual([{ status: "atingiu", atividadeId: TURMA, rodada: 1 }]);
  });

  test("com a missão aberta, nada vira evidência e o painel avisa que espera o encerramento", async () => {
    await sessao("bia", "resultado");
    await responder("bia", "p2", "B2");
    expect(await evidenciaDe("ana", "EM13CO14")).toEqual([]);
    expect(await evidenciaDe("bia", "EM13CO08")).toEqual([]);
    const painel = await evidencias.painel(ESCOLA, turmaId, TEMPESTADE, TURMA, professorId);
    expect(painel.aguardandoEncerramento).toBe(true);
    expect(painel.rodadas).toEqual([]);
  });

  test("encerrar a missão grava a evidência própria e fecha a porta", async () => {
    await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "encerrada", professorId);
    expect(await evidenciaDe("ana", "EM13CO14")).toEqual([
      { status: "atingiu", origem: "propria", situacao: "valida", rodada: 1 },
    ]);
    expect(await evidenciaDe("bia", "EM13CO08")).toEqual([
      { status: "em_processo", origem: "propria", situacao: "valida", rodada: 1 },
    ]);
    // Quem não respondeu fica "Não avaliado" — a AUSÊNCIA de linha.
    expect(await evidenciaDe("caio", "EM13CO14")).toEqual([]);
    const painel = await evidencias.painel(ESCOLA, turmaId, TEMPESTADE, TURMA, professorId);
    expect(painel.aguardandoEncerramento).toBe(false);
    expect(painel.rodadas).toEqual([1]);
    // Encerrada, a porta da missão fecha: o nível fica definitivo.
    expect((await recusa(responder("ana", "p1", "A3"))).status).toBe(403);
  });

  test("encerrar de novo não duplica evidência nem histórico", async () => {
    const eventos = () => prisma.evidenciaEvento.count({ where: { escolaId: ESCOLA, expId: TEMPESTADE } });
    const antes = await eventos();
    await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "encerrada", professorId);
    expect(await eventos()).toBe(antes);
    expect(await evidenciaDe("ana", "EM13CO14")).toHaveLength(1);
  });

  test("reliberada, a resposta melhor espera o próximo encerramento", async () => {
    await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "liberada", professorId);
    await responder("bia", "p2", "B1");
    expect((await evidenciaDe("bia", "EM13CO08"))[0]?.status).toBe("em_processo");
    await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "encerrada", professorId);
    expect((await evidenciaDe("bia", "EM13CO08"))[0]?.status).toBe("atingiu");
  });

  test("zerar a turma apaga a evidência (ADR-155), abre a rodada 2, e a sessão da rodada que acabou não responde", async () => {
    await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "liberada", professorId);
    expect(await evidenciaDe("ana", "EM13CO14")).toHaveLength(1);
    await missao.zerarTurma(ESCOLA, turmaId, professorId);
    /* Marca e nível da turma saem, de todas as rodadas: a turma recomeça do
       zero, e o painel não guarda a aplicação anterior. */
    expect(await evidenciaDe("ana", "EM13CO14")).toHaveLength(0);
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, turmaId, expId: TEMPESTADE } })).toBe(0);
    expect(await prisma.evidencia.count({ where: { escolaId: ESCOLA, turmaId, expId: TEMPESTADE } })).toBe(0);
    const gate = await prisma.unoogptGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId } },
      select: { rodada: true },
    });
    expect(gate?.rodada).toBe(2);
    // Uma sessão que sobrou da rodada 1 (a tela aberta durante o zerar).
    await sessao("caio", "resultado", 1);
    expect((await recusa(responder("caio", "p3", "C1"))).status).toBe(409);
    // A da rodada vigente responde, na rodada 2.
    await sessao("caio", "resultado", 2);
    await responder("caio", "p3", "C1");
    expect(await marcaDe("caio", "p3")).toEqual([{ status: "atingiu", atividadeId: TURMA, rodada: 2 }]);
    // Encerrar de novo NÃO ressuscita as respostas de antes do zerar: só a da
    // rodada 2 vira evidência.
    await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "encerrada", professorId);
    expect(await evidenciaDe("ana", "EM13CO14")).toHaveLength(0);
    expect(await prisma.evidencia.findMany({ where: { escolaId: ESCOLA, turmaId, expId: TEMPESTADE }, select: { rodada: true } }))
      .toEqual(expect.arrayContaining([{ rodada: 2 }]));
    expect(await prisma.evidencia.count({ where: { escolaId: ESCOLA, turmaId, expId: TEMPESTADE, rodada: 1 } })).toBe(0);
  });
});
