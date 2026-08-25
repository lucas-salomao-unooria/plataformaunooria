import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { VIDEOS } from "../src/unootube/catalogo";
import { UnootubeService } from "../src/unootube/unootube.service";

/**
 * Integração da exp-02-unootube no Postgres: fluxo completo, corrida em
 * "salvar", congelamento e tenancy. UMA ESCOLA POR SUÍTE (o Jest paraleliza
 * suítes; limpeza compartilhada corromperia a outra).
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-unootube";
const OUTRA_ESCOLA = "teste-unootube-outra";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const service = new UnootubeService(prisma);

const FAKES = VIDEOS.filter((v) => !v.factual).map((v) => v.id);
const CONFIAVEIS = VIDEOS.filter((v) => v.factual).map((v) => v.id);

let turmaId = "";
let alunoA = "";
let alunoB = "";
let alunoSemTurma = "";

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  await prisma.unootubeSessao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}

async function codigoDe(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    if (e instanceof HttpException) {
      const corpo = e.getResponse() as { codigo?: string };
      return corpo.codigo ?? `HTTP_${e.getStatus()}`;
    }
    throw e;
  }
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola UnooTube (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  const turma = await prisma.turma.create({ data: { escolaId: ESCOLA, nome: "4A", serie: "4EF" } });
  turmaId = turma.id;
  const criar = (username: string, displayName: string, comTurma: boolean) =>
    prisma.user.create({
      data: {
        role: "aluno",
        escolaId: ESCOLA,
        turmaId: comTurma ? turmaId : null,
        username,
        displayName,
        passwordHash: "x",
      },
      select: { id: true },
    });
  alunoA = (await criar("ut.ana", "Ana Teste", true)).id;
  alunoB = (await criar("ut.bia", "Bia Teste", true)).id;
  alunoSemTurma = (await criar("ut.sem", "Sem Turma", false)).id;
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("sessão", () => {
  test("sem linha devolve estado inicial, catálogo sem gabarito e NÃO cria linha", async () => {
    const r = await service.sessao(ESCOLA, alunoA);
    expect(r.estado).toEqual({
      salvos: [],
      curtidos: [],
      rankingDesbloqueado: false,
      credibilidadeAdicionada: false,
      concluidoEm: null,
    });
    expect(r.catalogo.videos).toHaveLength(21);
    expect(JSON.stringify(r)).not.toContain("factual");
    expect(r.aluno).toEqual({ nome: "Ana Teste", avatar: "A" });
    expect(r.ranking).toBeNull();
    expect(await prisma.unootubeSessao.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });
});

describe("fluxo da missão", () => {
  test("3 salvos desbloqueiam o ranking; o 4º é LIMITE_SALVOS", async () => {
    await service.salvar(ESCOLA, alunoA, CONFIAVEIS[0]!);
    await service.salvar(ESCOLA, alunoA, CONFIAVEIS[1]!);
    const r = await service.salvar(ESCOLA, alunoA, FAKES[0]!);
    expect(r.estado.rankingDesbloqueado).toBe(true);
    expect(r.derivados).toMatchObject({ inscritos: 1100, fontesConfiaveis: 2, salvos: 3, vagas: 0 });
    expect(await codigoDe(service.salvar(ESCOLA, alunoA, FAKES[1]!))).toBe("LIMITE_SALVOS");
  });

  test("remover mantém o ranking; ranking tem 40 linhas com o aluno real", async () => {
    const r = await service.remover(ESCOLA, alunoA, FAKES[0]!);
    expect(r.estado.salvos).toEqual([CONFIAVEIS[0], CONFIAVEIS[1]]);
    expect(r.estado.rankingDesbloqueado).toBe(true);
    const ranking = await service.ranking(ESCOLA, alunoA);
    expect(ranking.linhas).toHaveLength(40);
    expect(ranking.linhas.filter((l) => l.voce)).toEqual([
      expect.objectContaining({ nome: "Ana Teste", fontesConfiaveis: 2, inscritos: 100 }),
    ]);
  });

  test("curtir é toggle e não mexe nos salvos", async () => {
    const ligado = await service.curtir(ESCOLA, alunoA, "v03");
    expect(ligado.estado.curtidos).toEqual(["v03"]);
    const desligado = await service.curtir(ESCOLA, alunoA, "v03");
    expect(desligado.estado.curtidos).toEqual([]);
    expect(desligado.estado.salvos).toHaveLength(2);
  });

  test("credibilidade devolve score, congela salvos e é idempotente", async () => {
    await service.salvar(ESCOLA, alunoA, CONFIAVEIS[2]!);
    const r = await service.credibilidade(ESCOLA, alunoA);
    expect(r.score).toBe(3);
    expect(r.estado.credibilidadeAdicionada).toBe(true);
    expect(r.estado.concluidoEm).not.toBeNull();
    const denovo = await service.credibilidade(ESCOLA, alunoA);
    expect(denovo.estado.concluidoEm).toBe(r.estado.concluidoEm);
    expect(await codigoDe(service.salvar(ESCOLA, alunoA, FAKES[0]!))).toBe("MISSAO_CONCLUIDA");
    expect(await codigoDe(service.remover(ESCOLA, alunoA, CONFIAVEIS[0]!))).toBe("MISSAO_CONCLUIDA");
  });

  test("ranking bloqueado para quem não chegou a 3", async () => {
    await service.salvar(ESCOLA, alunoB, FAKES[0]!);
    expect(await codigoDe(service.ranking(ESCOLA, alunoB))).toBe("RANKING_BLOQUEADO");
    expect(await codigoDe(service.credibilidade(ESCOLA, alunoB))).toBe("RANKING_BLOQUEADO");
  });
});

describe("corrida", () => {
  test("com 1 salvo, três salvamentos simultâneos: exatamente 2 entram", async () => {
    await service.reiniciar(ESCOLA, alunoB);
    await service.salvar(ESCOLA, alunoB, FAKES[0]!);
    const resultados = await Promise.allSettled([
      service.salvar(ESCOLA, alunoB, FAKES[1]!),
      service.salvar(ESCOLA, alunoB, FAKES[2]!),
      service.salvar(ESCOLA, alunoB, FAKES[3]!),
    ]);
    const ok = resultados.filter((r) => r.status === "fulfilled");
    const falhas = resultados.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(2);
    expect(falhas).toHaveLength(1);
    const linha = await prisma.unootubeSessao.findUniqueOrThrow({
      where: { escolaId_alunoId: { escolaId: ESCOLA, alunoId: alunoB } },
    });
    expect(linha.salvos).toHaveLength(3);
    expect(linha.rankingDesbloqueado).toBe(true);
  });

  test("o mesmo vídeo três vezes em paralelo entra uma vez", async () => {
    await service.reiniciar(ESCOLA, alunoB);
    await Promise.all([
      service.salvar(ESCOLA, alunoB, "v02"),
      service.salvar(ESCOLA, alunoB, "v02"),
      service.salvar(ESCOLA, alunoB, "v02"),
    ]);
    const linha = await prisma.unootubeSessao.findUniqueOrThrow({
      where: { escolaId_alunoId: { escolaId: ESCOLA, alunoId: alunoB } },
    });
    expect(linha.salvos).toEqual(["v02"]);
    expect(linha.reinicios).toBe(2);
  });
});

describe("professor", () => {
  test("resultados da turma: inclui quem não iniciou, exclui aluno sem turma, resume", async () => {
    const r = await service.resultadosDaTurma(ESCOLA, turmaId);
    expect(r.turma).toMatchObject({ id: turmaId, nome: "4A", serie: "4EF" });
    expect(r.alunos.map((a) => a.nome)).toEqual(["Ana Teste", "Bia Teste"]);
    const ana = r.alunos.find((a) => a.nome === "Ana Teste")!;
    expect(ana).toMatchObject({
      iniciou: true,
      salvos: 3,
      fontesConfiaveis: 3,
      inscritos: 150,
      credibilidadeAdicionada: true,
    });
    expect(ana.concluidoEm).not.toBeNull();
    const bia = r.alunos.find((a) => a.nome === "Bia Teste")!;
    expect(bia).toMatchObject({ iniciou: true, salvos: 1, credibilidadeAdicionada: false });
    expect(r.resumo).toMatchObject({ total: 2, iniciaram: 2, concluiram: 1, distribuicaoFontes: { "3": 1 } });
    expect(JSON.stringify(r)).not.toContain(alunoSemTurma);
  });

  test("lista de turmas da escola", async () => {
    const r = await service.turmas(ESCOLA);
    expect(r.turmas).toEqual([{ id: turmaId, nome: "4A", serie: "4EF", alunos: 2 }]);
  });
});

describe("tenancy", () => {
  test("outra escola não vê a turma nem a sessão", async () => {
    expect(await codigoDe(service.resultadosDaTurma(OUTRA_ESCOLA, turmaId))).toBe("TURMA_NAO_ENCONTRADA");
    // aluno da escola A consultado sob a escola B: o usuário não pertence a ela
    expect(await codigoDe(service.sessao(OUTRA_ESCOLA, alunoA))).toBe("TURMA_NAO_ENCONTRADA");
    expect(await codigoDe(service.salvar(OUTRA_ESCOLA, alunoA, "v02"))).not.toBeNull();
  });

  test("a RLS da tabela nova está armada (policy + FORCE)", async () => {
    const policies = await prisma.$queryRaw<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies WHERE tablename = 'unootube_sessoes'`;
    expect(policies.map((p) => p.policyname)).toEqual(["unootube_sessoes_por_escola"]);
    const [tabela] = await prisma.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'unootube_sessoes'`;
    expect(tabela).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
});
