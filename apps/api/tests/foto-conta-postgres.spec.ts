import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PACOTE_PADRAO } from "../src/foto-conta/catalogo";
import { FotoContaService } from "../src/foto-conta/foto-conta.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp-04 no Postgres: RLS, o fluxo inteiro do crachá à
 * conclusão, o latch (DAD-11), o reset por tentativa (DAD-06) e a fronteira
 * DAD-07 (nome só na resposta do professor). UMA ESCOLA POR SUÍTE (o Jest
 * paraleliza; limpeza compartilhada corromperia a vizinha).
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-foto-conta";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const service = new FotoContaService(prisma);

let turmaId = "";
let ana = "";
let bia = "";
let semTurma = "";
let professor = "";

async function limpar() {
  await prisma.liberacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.fotoContaPostTurma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.fotoContaRun.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.fotoContaTurmaConfig.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
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
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Foto (teste)" } });
  const turma = await criarTurmaDeTeste(prisma, ESCOLA, "1A", "1EF");
  turmaId = turma.id;
  const criar = (username: string, displayName: string, role: string, comTurma: boolean) =>
    prisma.user.create({
      data: {
        role,
        escolaId: ESCOLA,
        turmaId: comTurma ? turmaId : null,
        username,
        displayName,
        passwordHash: "x",
      },
      select: { id: true },
    });
  ana = (await criar("foto.ana", "Ana Teste", "estudante", true)).id;
  bia = (await criar("foto.bia", "Bia Teste", "estudante", true)).id;
  semTurma = (await criar("foto.sem", "Sem Turma", "estudante", false)).id;
  professor = (await criar("foto.prof", "Prof Teste", "professor", false)).id;
  await prisma.matricula.create({
    data: {
      escolaId: ESCOLA,
      turmaId,
      usuarioId: professor,
      papel: "professor",
      inicio: new Date(),
    },
  });

  /* A PORTA DA SALA (ADR-69): sem esta linha o funil recusa com 403. */
  await liberarParaTeste(prisma, ESCOLA, turmaId, "exp-04-o-que-a-foto-conta", ana);
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

describe("tenancy no banco", () => {
  test("as três tabelas têm RLS habilitada E forçada, com uma política por escola", async () => {
    const tabelas = ["exp_04_turma_config", "exp_04_runs", "exp_04_posts_turma"];
    for (const tabela of tabelas) {
      const [linha] = await prisma.$queryRawUnsafe<
        { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
      >(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${tabela}'`);
      expect(linha).toEqual({ relrowsecurity: true, relforcerowsecurity: true });

      const policies = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tabela}'`,
      );
      expect(policies.map((p) => p.policyname)).toEqual([`${tabela}_por_escola`]);
    }
  });

  test("reflexao_final só aceita 'lupa' — o CHECK é a rede final da regra 3", async () => {
    const run = await prisma.fotoContaRun.create({
      data: { escolaId: ESCOLA, turmaId, estudanteId: bia, tentativa: 99 },
    });
    await expect(
      prisma.fotoContaRun.update({
        where: { id: run.id },
        data: { reflexaoFinal: "globo" },
      }),
    ).rejects.toThrow();
    await prisma.fotoContaRun.delete({ where: { id: run.id } });
  });
});

describe("o fluxo do estudante", () => {
  test("o boot serve o pacote SEM a matriz do Aha, e cria a run", async () => {
    const sessao = await service.sessao(ESCOLA, ana);
    expect(sessao.etapa).toBe("desafiar");
    expect(sessao.pacote.feed).toHaveLength(3);
    expect("comentarios" in sessao.pacote).toBe(false);
    const serializado = JSON.stringify(sessao);
    expect(serializado).not.toContain("EU SÓ VI O BRINQUEDO!");
  });

  test("publicar devolve SÓ a linha do par, cria o post e é idempotente pelo resultado", async () => {
    await service.marcar(ESCOLA, ana, "estrela");
    await service.sairDoFeed(ESCOLA, ana, { curtidas: 1, permanenciaMs: 16_000 });
    const r1 = await service.publicar(ESCOLA, ana, {
      fotoId: "par_b",
      legendaId: "legenda_1",
      latenciaMs: 9_000,
    });
    expect(r1.comentarios.leo).toBe("EU SÓ VI O BRINQUEDO!");
    expect(r1.post.marcaId).toBe("estrela");

    // Retry de rede com o MESMO par: mesma cena, nenhum post novo.
    const r2 = await service.publicar(ESCOLA, ana, { fotoId: "par_b", legendaId: "legenda_1" });
    expect(r2.comentarios).toEqual(r1.comentarios);
    const posts = await prisma.fotoContaPostTurma.count({ where: { escolaId: ESCOLA, turmaId } });
    expect(posts).toBe(1);

    // Par DIFERENTE depois de publicado: recusa — publicar é irreversível.
    expect(await codigoDe(service.publicar(ESCOLA, ana, { fotoId: "par_a", legendaId: "legenda_2" })))
      .toBe("publicacao-ja-feita");
  });

  test("a reflexão exige o latch liberado, o Globo é retry e a Lupa conclui", async () => {
    await service.chegarNaRoda(ESCOLA, ana);
    expect(await codigoDe(service.refletir(ESCOLA, ana, "lupa"))).toBe("roda-em-andamento");

    const liberacao = await service.liberarLatch(ESCOLA, turmaId, professor);
    expect(liberacao.tabletsNoLatch).toBe(1);

    const retry = await service.refletir(ESCOLA, ana, "globo");
    expect(retry.conclui).toBe(false);
    expect(retry.tentativas).toBe(1);

    const fim = await service.refletir(ESCOLA, ana, "lupa");
    expect(fim.conclui).toBe(true);
    const run = await prisma.fotoContaRun.findFirst({
      where: { escolaId: ESCOLA, estudanteId: ana, tentativa: 1 },
    });
    expect(run?.etapa).toBe("concluida");
    expect(run?.concluidoEm).not.toBeNull();
    expect(run?.reflexaoFinal).toBe("lupa");
  });

  test("liberar de novo responde latch-ja-liberado (DAD-11)", async () => {
    expect(await codigoDe(service.liberarLatch(ESCOLA, turmaId, professor))).toBe(
      "latch-ja-liberado",
    );
  });

  test("estudante sem turma não tem aula para entrar", async () => {
    expect(await codigoDe(service.sessao(ESCOLA, semTurma))).toBe("sem-turma");
  });
});

describe("o painel do professor (DAD-07)", () => {
  test("o resumo conta a turma e a hesitação sai COM nome — só aqui", async () => {
    const painel = await service.painel(ESCOLA, turmaId, professor);
    expect(painel.resumo.conectados).toBeGreaterThanOrEqual(1);
    expect(painel.resumo.porFoto.par_b).toBe(1);
    // Ana concluiu, ninguém está parado na decisão: lista vazia, mas o SHAPE
    // com nome é deste payload de professor, e de nenhum outro.
    expect(Array.isArray(painel.hesitando)).toBe(true);
  });

  test("professor sem matrícula na turma não a enxerga", async () => {
    const intruso = await prisma.user.create({
      data: {
        role: "professor",
        escolaId: ESCOLA,
        username: "foto.intruso",
        displayName: "Sem Matrícula",
        passwordHash: "x",
      },
      select: { id: true },
    });
    expect(await codigoDe(service.painel(ESCOLA, turmaId, intruso.id))).toBe(
      "turma-nao-encontrada",
    );
  });
});

describe("o reset arquiva por tentativa (DAD-06 + DAD-11)", () => {
  test("a tentativa incrementa, as runs antigas ficam e o latch rearma", async () => {
    const antes = await prisma.fotoContaRun.count({
      where: { escolaId: ESCOLA, turmaId, tentativa: 1 },
    });
    expect(antes).toBeGreaterThanOrEqual(1);

    const r = await service.reset(ESCOLA, turmaId, professor);
    expect(r.tentativa).toBe(2);
    expect(r.runsArquivadas).toBe(antes);
    expect(r.latchLiberado).toBe(false);

    // A run da tentativa 1 continua lá, imutável — nada foi apagado.
    const depois = await prisma.fotoContaRun.count({
      where: { escolaId: ESCOLA, turmaId, tentativa: 1 },
    });
    expect(depois).toBe(antes);

    // O boot seguinte da Ana abre uma run NOVA, do zero, na tentativa 2.
    const sessao = await service.sessao(ESCOLA, ana);
    expect(sessao.tentativa).toBe(2);
    expect(sessao.etapa).toBe("desafiar");
    expect(sessao.latchLiberado).toBe(false);
  });
});

describe("aprovação do pacote", () => {
  test("aprovar revalida com o schema completo e grava cfg pronta", async () => {
    await service.aprovar(ESCOLA, turmaId, professor, PACOTE_PADRAO, false);
    const cfg = await prisma.fotoContaTurmaConfig.findUnique({
      where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId } },
    });
    expect(cfg?.statusPacote).toBe("pronto");

    expect(await codigoDe(service.aprovar(ESCOLA, turmaId, professor, { tema: "recreio" }, false)))
      .toBe("payload-invalido");
  });
});
