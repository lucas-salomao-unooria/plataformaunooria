import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { contarEquipesDaTurma, mapaDeEquipes } from "../src/equipes/consulta";
import {
  EquipesDaMissaoSchema,
  MinhaEquipeSchema,
  SugestaoSchema,
  UltimaMontagemSchema,
} from "../src/equipes/contrato-de-rotas";
import { EquipesService } from "../src/equipes/equipes.service";
import { MODOS, NOME_MAX } from "../src/equipes/regras";
import { PrismaService } from "../src/prisma/prisma.service";
import { SalaDoProfessorSchema } from "../src/salas/contrato-de-rotas";
import { SalasService } from "../src/salas/salas.service";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * As EQUIPES NA MISSÃO no Postgres (E13, ADR-111): a RLS das três tabelas, o
 * UNIQUE de uma equipe por criança por missão, os CHECKs contra o vocabulário
 * do código, e o serviço inteiro — montar, reler, conflito de versão, desfazer,
 * a visão do estudante, a proposta que não grava e a reprojeção da última
 * montagem.
 *
 * O que só o banco responde, e a suíte pura não alcança: que a RLS ISOLA (não
 * só que a política existe), que o UNIQUE segura a criança em dois computadores
 * mesmo com o código errado, e que a role SEM ownership grava pelo serviço.
 *
 * UMA ESCOLA POR SUÍTE (mais a vizinha, para a RLS) — o Jest serializa, mas a
 * limpeza de uma suíte não pode depender da outra. Molde:
 * `quem-mandou-isso-postgres.spec.ts` e `salas-postgres.spec.ts`.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-equipes";
const OUTRA_ESCOLA = "teste-equipes-2";

const prisma = new PrismaService({
  datasources: { db: { url: URL } },
}) as PrismaService & PrismaClient;

/**
 * O MESMO Prisma, com a role SEM `BYPASSRLS`. Sem isto a prova de isolamento
 * passa em falso: o usuário administrativo é SUPERUSER, e superusuário ignora
 * RLS mesmo com `FORCE ROW LEVEL SECURITY`.
 */
const runtime = new PrismaService({
  datasources: { db: { url: urlDeRuntime(URL) } },
}) as PrismaService & PrismaClient;

const equipes = new EquipesService(prisma);
const salas = new SalasService(prisma);

const INSTA = "exp08ef1b";
const TEMPESTADE = "exp02em1b";
const TUBE = "exp04ef1b";
/** Missão real que NÃO aceita equipe. */
const QUEM_MANDOU = "exp05ef1b";

const TABELAS = ["equipes_montagens", "equipes", "equipes_membros"] as const;

const ids = {
  turma8A: "",
  turma8B: "",
  turmaVizinha: "",
  prof8A: "",
  prof8B: "",
  profVizinho: "",
  ana: "",
  bia: "",
  caio: "",
  duda: "",
  enzo: "",
  fabi: "",
  vizinho: "",
};

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  /* Equipes e membros caem por CASCADE da montagem. */
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.matricula.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}

/** O status e o corpo de uma recusa — para afirmar os dois de uma vez. */
async function recusa(promessa: Promise<unknown>): Promise<{ status: number; corpo: Record<string, unknown> }> {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof HttpException) {
      return { status: e.getStatus(), corpo: e.getResponse() as Record<string, unknown> };
    }
    throw e;
  }
  throw new Error("era para recusar, e gravou");
}

/** A montagem que as suítes de serviço gravam: Ana+Bia num computador, Caio+Duda no outro. */
const duasEquipes = (versao: number) => ({
  versao,
  modo: "manual" as const,
  computadores: 2,
  ausentes: [ids.enzo],
  equipes: [
    { nome: "Equipe 1", membros: [ids.ana, ids.bia] },
    { nome: "  Verde  ", membros: [ids.caio, ids.duda] },
  ],
});

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola das equipes (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Escola vizinha (teste)" } });

  ids.turma8A = (await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF")).id;
  ids.turma8B = (await criarTurmaDeTeste(prisma, ESCOLA, "8B", "8EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "8A vizinha", "8EF")).id;

  const pessoa = async (escolaId: string, username: string, role: string, nome: string, turmaId?: string) =>
    (
      await prisma.user.create({
        data: { escolaId, username, role, displayName: nome, passwordHash: "x", turmaId },
        select: { id: true },
      })
    ).id;

  ids.prof8A = await pessoa(ESCOLA, "equipes-prof-8a", "professor", "Marta Prof");
  ids.prof8B = await pessoa(ESCOLA, "equipes-prof-8b", "professor", "Rui Prof");
  ids.profVizinho = await pessoa(OUTRA_ESCOLA, "equipes-prof-viz", "professor", "Vera Prof");
  ids.ana = await pessoa(ESCOLA, "equipes-ana", "estudante", "Ana Clara Souza", ids.turma8A);
  ids.bia = await pessoa(ESCOLA, "equipes-bia", "estudante", "Bia Lima", ids.turma8A);
  ids.caio = await pessoa(ESCOLA, "equipes-caio", "estudante", "Caio Reis", ids.turma8A);
  ids.duda = await pessoa(ESCOLA, "equipes-duda", "estudante", "Duda Melo", ids.turma8A);
  ids.enzo = await pessoa(ESCOLA, "equipes-enzo", "estudante", "Enzo Paz", ids.turma8A);
  ids.fabi = await pessoa(ESCOLA, "equipes-fabi", "estudante", "Fabi Nunes", ids.turma8B);
  ids.vizinho = await pessoa(OUTRA_ESCOLA, "equipes-vizinho", "estudante", "Vito Vizinho", ids.turmaVizinha);

  /* A MATRÍCULA de professor que `professorLeciona` procura. */
  const lecionar = (escolaId: string, turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: {
        escolaId,
        turmaId,
        usuarioId,
        papel: "professor",
        principal: false,
        inicio: new Date(Date.UTC(2026, 0, 1)),
      },
    });
  await lecionar(ESCOLA, ids.turma8A, ids.prof8A);
  await lecionar(ESCOLA, ids.turma8B, ids.prof8B);
  await lecionar(OUTRA_ESCOLA, ids.turmaVizinha, ids.profVizinho);

  /**
   * O catálogo é GLOBAL e o `globalSetup` já o preenche com os manifestos
   * reais. O `upsert` aqui é a garantia mínima do que o `PUT` exige — existir e
   * ser de estudante —, e o `update` NÃO toca em nome, versão nem série: é a
   * lição de `salas-postgres.spec.ts` (valor inventado gravado sobre linha real
   * aparecia no painel da Unooria como estado do produto).
   */
  for (const [expId, serie] of [
    [INSTA, "8EF"],
    [TEMPESTADE, "2EM"],
    [TUBE, "4EF"],
  ] as const) {
    await prisma.experiencia.upsert({
      where: { expId },
      update: { publico: "estudante" },
      create: { expId, nome: expId, versaoAtiva: "1.0.0", series: [serie], publico: "estudante" },
    });
  }
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("tenancy no banco (regra inviolável nº 1)", () => {
  beforeAll(async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: [ESCOLA, OUTRA_ESCOLA] } } });
    await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);
    await equipes.salvar(
      OUTRA_ESCOLA,
      ids.turmaVizinha,
      INSTA,
      { versao: 0, modo: "sorteio", computadores: 1, ausentes: [], equipes: [{ nome: "Equipe 1", membros: [ids.vizinho] }] },
      ids.profVizinho,
    );
  });

  test("as três tabelas têm RLS habilitada E forçada, com uma política por escola", async () => {
    for (const tabela of TABELAS) {
      const [linha] = await prisma.$queryRawUnsafe<
        { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
      >(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${tabela}'`);
      expect({ tabela, ...linha }).toEqual({ tabela, relrowsecurity: true, relforcerowsecurity: true });

      const policies = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tabela}'`,
      );
      expect(policies.map((p) => p.policyname)).toEqual([`${tabela}_por_escola`]);
    }
  });

  test("a RLS isola DE VERDADE: com a escola de cá armada, a de lá some", async () => {
    const daqui = await runtime.comTenancy(
      async (tx) => ({
        equipes_montagens: await tx.equipesMontagem.findMany({ select: { escolaId: true } }),
        equipes: await tx.equipe.findMany({ select: { escolaId: true } }),
        equipes_membros: await tx.equipeMembro.findMany({ select: { escolaId: true } }),
      }),
      ESCOLA,
    );
    for (const [tabela, linhas] of Object.entries(daqui)) {
      expect({ tabela, tem: linhas.length > 0 }).toEqual({ tabela, tem: true });
      expect({ tabela, sóDaqui: linhas.every((l) => l.escolaId === ESCOLA) }).toEqual({
        tabela,
        sóDaqui: true,
      });
    }

    const deLa = await runtime.comTenancy(
      (tx) => tx.equipeMembro.findMany({ select: { escolaId: true } }),
      OUTRA_ESCOLA,
    );
    expect(deLa.length).toBeGreaterThan(0);
    expect(deLa.every((l) => l.escolaId === OUTRA_ESCOLA)).toBe(true);
  });

  test("uma sessão SEM tenancy armada não enxerga linha nenhuma", async () => {
    for (const tabela of TABELAS) {
      const [linha] = await runtime.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${tabela}`);
      expect({ tabela, n: Number(linha?.n) }).toEqual({ tabela, n: 0 });
    }
  });

  test("a role sem ownership monta e relê pelo serviço — os GRANTs e o WITH CHECK da política", async () => {
    const pelaRuntime = new EquipesService(runtime);
    const lido = await pelaRuntime.daMissao(ESCOLA, ids.turma8A, INSTA, ids.prof8A);
    const salvo = await pelaRuntime.salvar(
      ESCOLA,
      ids.turma8A,
      INSTA,
      { ...duasEquipes(lido.montagem?.versao ?? 0) },
      ids.prof8A,
    );
    expect(salvo.equipes.map((e) => e.nome)).toEqual(["Equipe 1", "Verde"]);
  });

  test("UMA equipe por criança por missão: o UNIQUE segura mesmo com o código errado", async () => {
    const outra = await prisma.equipe.create({
      data: { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA, nome: "Intrusa", ordem: 9 },
    });
    await expect(
      prisma.equipeMembro.create({
        data: {
          escolaId: ESCOLA,
          equipeId: outra.id,
          turmaId: ids.turma8A,
          expId: INSTA,
          estudanteId: ids.ana,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await prisma.equipe.delete({ where: { id: outra.id } });
  });

  test("os CHECKs são o MESMO vocabulário do código (`MODOS`, `NOME_MAX`)", async () => {
    const checks = await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname IN ('equipes_montagens_modo_check', 'equipes_nome_check')`,
    );
    const def = new Map(checks.map((c) => [c.conname, c.def]));
    const modos = [...(def.get("equipes_montagens_modo_check") ?? "").matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(modos.sort()).toEqual([...MODOS].sort());
    /* O Postgres guarda o `BETWEEN` desmontado em `>= 1 AND <= 30`. */
    expect(def.get("equipes_nome_check")).toContain(`<= ${NOME_MAX})`);

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE equipes_montagens SET modo = 'aleatorio'
          WHERE escola_id = '${ESCOLA}' AND turma_id = '${ids.turma8A}'::uuid AND exp_id = '${INSTA}'`,
      ),
    ).rejects.toThrow();
    await expect(
      prisma.equipe.create({
        data: { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA, nome: "   ", ordem: 7 },
      }),
    ).rejects.toThrow();
  });
});

describe("montar, reler e desfazer", () => {
  beforeEach(async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
  });

  test("sem montagem: todo mundo sem equipe, e a resposta segue o contrato", async () => {
    const lido = EquipesDaMissaoSchema.parse(await equipes.daMissao(ESCOLA, ids.turma8A, INSTA, ids.prof8A));
    expect(lido).toMatchObject({ permitida: true, montagem: null, equipes: [], estudantes: 5 });
    expect(lido.semEquipe.map((e) => e.nome)).toEqual([
      "Ana Clara Souza",
      "Bia Lima",
      "Caio Reis",
      "Duda Melo",
      "Enzo Paz",
    ]);
  });

  test("PUT e GET dão a mesma montagem — nome sem espaço, ordem, ausente em `semEquipe`", async () => {
    const salvo = EquipesDaMissaoSchema.parse(
      await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A),
    );
    const lido = EquipesDaMissaoSchema.parse(await equipes.daMissao(ESCOLA, ids.turma8A, INSTA, ids.prof8A));
    expect(lido).toEqual(salvo);

    expect(lido.montagem).toMatchObject({ modo: "manual", computadores: 2, ausentes: [ids.enzo], versao: 1 });
    expect(lido.equipes.map((e) => [e.nome, e.ordem, e.membros.map((m) => m.nome)])).toEqual([
      ["Equipe 1", 0, ["Ana Clara Souza", "Bia Lima"]],
      ["Verde", 1, ["Caio Reis", "Duda Melo"]],
    ]);
    expect(lido.semEquipe.map((e) => e.id)).toEqual([ids.enzo]);
  });

  test("gestor (sem professorId) lê as equipes da turma", async () => {
    await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);
    const lido = await equipes.daMissao(ESCOLA, ids.turma8A, INSTA, undefined);
    expect(lido.equipes).toHaveLength(2);
  });

  test("versão velha é 409 com a versão atual — as duas telas não se sobrescrevem", async () => {
    await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);

    /* A segunda tela abriu ANTES da primeira salvar: acha que não havia nada. */
    expect(await recusa(equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A))).toEqual({
      status: 409,
      corpo: {
        codigo: "equipes-desatualizadas",
        mensagem: "As equipes foram alteradas em outra tela. Recarregue para ver a versão atual.",
        versaoAtual: 1,
      },
    });

    const segunda = await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(1), ids.prof8A);
    expect(segunda.montagem?.versao).toBe(2);
    expect((await recusa(equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(1), ids.prof8A))).corpo).toMatchObject({
      versaoAtual: 2,
    });
  });

  test("versão > 0 sem montagem nenhuma também é 409, com `versaoAtual: 0`", async () => {
    expect((await recusa(equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(3), ids.prof8A))).corpo).toMatchObject({
      codigo: "equipes-desatualizadas",
      versaoAtual: 0,
    });
  });

  test("salvar de novo TROCA a montagem inteira", async () => {
    await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);
    const trocada = await equipes.salvar(
      ESCOLA,
      ids.turma8A,
      INSTA,
      {
        versao: 1,
        modo: "sorteio",
        computadores: 1,
        ausentes: [],
        equipes: [{ nome: "Todos", membros: [ids.ana, ids.bia, ids.caio, ids.duda, ids.enzo] }],
      },
      ids.prof8A,
    );
    expect(trocada.equipes.map((e) => e.nome)).toEqual(["Todos"]);
    expect(trocada.semEquipe).toEqual([]);
    expect(await prisma.equipe.count({ where: { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA } })).toBe(1);
  });

  test("missão fora da lista é 400 no PUT, e o GET responde 200 com `permitida: false`", async () => {
    expect(
      await recusa(equipes.salvar(ESCOLA, ids.turma8A, QUEM_MANDOU, duasEquipes(0), ids.prof8A)),
    ).toMatchObject({ status: 400, corpo: { codigo: "missao-sem-equipes" } });

    const lido = EquipesDaMissaoSchema.parse(
      await equipes.daMissao(ESCOLA, ids.turma8A, QUEM_MANDOU, ids.prof8A),
    );
    expect(lido).toEqual({ permitida: false, montagem: null, equipes: [], semEquipe: [], estudantes: 5 });
  });

  test("estudante de OUTRA turma na equipe é 400, com a frase para o professor", async () => {
    const corpo = {
      ...duasEquipes(0),
      equipes: [{ nome: "Equipe 1", membros: [ids.ana, ids.fabi] }],
    };
    const { status, corpo: resposta } = await recusa(
      equipes.salvar(ESCOLA, ids.turma8A, INSTA, corpo, ids.prof8A),
    );
    expect(status).toBe(400);
    expect(resposta).toMatchObject({
      codigo: "montagem-invalida",
      erros: ['A equipe "Equipe 1" tem alguém que não é desta turma.'],
    });
    expect(await prisma.equipesMontagem.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("professor que não leciona a turma recebe 404 — em ler, montar, propor e desfazer", async () => {
    const naoEncontrada = { status: 404, corpo: { mensagem: "Turma não encontrada." } };
    expect(await recusa(equipes.daMissao(ESCOLA, ids.turma8A, INSTA, ids.prof8B))).toEqual(naoEncontrada);
    expect(await recusa(equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8B))).toEqual(
      naoEncontrada,
    );
    expect(
      await recusa(
        equipes.sugerir(ESCOLA, ids.turma8A, INSTA, { modo: "sorteio", computadores: 2, ausentes: [] }, ids.prof8B),
      ),
    ).toEqual(naoEncontrada);
    expect(await recusa(equipes.ultima(ESCOLA, ids.turma8A, INSTA, ids.prof8B))).toEqual(naoEncontrada);
    expect(await recusa(equipes.desfazer(ESCOLA, ids.turma8A, INSTA, ids.prof8B))).toEqual(naoEncontrada);
  });

  test("turma de outra escola é 404 também — a escola do token é a tranca", async () => {
    expect((await recusa(equipes.daMissao(ESCOLA, ids.turmaVizinha, INSTA, undefined))).status).toBe(404);
  });

  test("DESFAZER apaga montagem, equipes e membros; e repetir devolve o mesmo `ok`", async () => {
    await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);
    expect(await equipes.desfazer(ESCOLA, ids.turma8A, INSTA, ids.prof8A)).toEqual({ ok: true });
    expect(await equipes.desfazer(ESCOLA, ids.turma8A, INSTA, ids.prof8A)).toEqual({ ok: true });

    expect(await prisma.equipe.count({ where: { escolaId: ESCOLA } })).toBe(0);
    expect(await prisma.equipeMembro.count({ where: { escolaId: ESCOLA } })).toBe(0);
    const lido = await equipes.daMissao(ESCOLA, ids.turma8A, INSTA, ids.prof8A);
    expect(lido.montagem).toBeNull();
    expect(lido.semEquipe).toHaveLength(5);
  });
});

describe("a equipe do estudante", () => {
  beforeAll(async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
  });

  test("sem equipe: 200 com `equipe: null`, nunca um 404", async () => {
    expect(MinhaEquipeSchema.parse(await equipes.minha(ESCOLA, ids.ana, INSTA))).toEqual({ equipe: null });
  });

  test("com equipe: o nome dela e o PRIMEIRO nome dos outros — nunca o completo, nunca o próprio", async () => {
    await equipes.salvar(
      ESCOLA,
      ids.turma8A,
      INSTA,
      { versao: 0, modo: "manual", computadores: 1, ausentes: [], equipes: [{ nome: "Azul", membros: [ids.ana, ids.bia, ids.caio] }] },
      ids.prof8A,
    );
    expect(MinhaEquipeSchema.parse(await equipes.minha(ESCOLA, ids.ana, INSTA))).toEqual({
      equipe: { nome: "Azul", colegas: ["Bia", "Caio"] },
    });
    expect(await equipes.minha(ESCOLA, ids.caio, INSTA)).toEqual({
      equipe: { nome: "Azul", colegas: ["Ana", "Bia"] },
    });
  });

  test("a equipe é DAQUELA missão: na outra, a mesma criança continua sem", async () => {
    expect(await equipes.minha(ESCOLA, ids.ana, TUBE)).toEqual({ equipe: null });
    expect(await equipes.minha(ESCOLA, ids.ana, QUEM_MANDOU)).toEqual({ equipe: null });
  });
});

describe("as leituras que os painéis vão usar", () => {
  test("`mapaDeEquipes` e `contarEquipesDaTurma` dentro da tenancy", async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
    await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);

    const [mapa, contagem] = await prisma.comTenancy(
      (tx) =>
        Promise.all([
          mapaDeEquipes(tx, ESCOLA, ids.turma8A, INSTA),
          contarEquipesDaTurma(tx, ESCOLA, ids.turma8A),
        ]),
      ESCOLA,
    );
    expect(mapa.get(ids.ana)?.nome).toBe("Equipe 1");
    expect(mapa.get(ids.ana)).toBe(mapa.get(ids.bia));
    expect(mapa.get(ids.caio)?.membros.map((m) => m.nome)).toEqual(["Caio Reis", "Duda Melo"]);
    expect(mapa.has(ids.enzo)).toBe(false);
    expect(Object.fromEntries(contagem)).toEqual({ [INSTA]: 2 });
  });
});

describe("a proposta (sugestão) nunca grava", () => {
  beforeEach(async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
  });

  test("sorteio sem os ausentes, e o banco continua vazio", async () => {
    const r = SugestaoSchema.parse(
      await equipes.sugerir(
        ESCOLA,
        ids.turma8A,
        INSTA,
        { modo: "sorteio", computadores: 2, ausentes: [ids.enzo] },
        ids.prof8A,
      ),
    );
    expect(r.equipes.map((e) => e.membros.length)).toEqual([2, 2]);
    const sorteados = r.equipes.flatMap((e) => e.membros.map((m) => m.id));
    expect(sorteados).not.toContain(ids.enzo);
    expect(sorteados.sort()).toEqual([ids.ana, ids.bia, ids.caio, ids.duda].sort());
    expect(r.semEquipe).toEqual([]);
    expect(r.agrupamento).toBeNull();

    for (const tabela of TABELAS) {
      const [linha] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM ${tabela} WHERE escola_id = '${ESCOLA}'`,
      );
      expect({ tabela, n: Number(linha?.n) }).toEqual({ tabela, n: 0 });
    }
  });

  test("manual: N equipes vazias e todos os presentes esperando", async () => {
    const r = SugestaoSchema.parse(
      await equipes.sugerir(ESCOLA, ids.turma8A, INSTA, { modo: "manual", computadores: 3, ausentes: [] }, ids.prof8A),
    );
    expect(r.equipes.map((e) => [e.nome, e.membros.length])).toEqual([
      ["Equipe 1", 0],
      ["Equipe 2", 0],
      ["Equipe 3", 0],
    ]);
    expect(r.semEquipe).toHaveLength(5);
    expect(await prisma.equipesMontagem.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("com fonte de grupo registrada, o sorteio usa os lados e conta o agrupamento", async () => {
    const comFonte = new EquipesService(prisma);
    comFonte.registrarFonteDeGrupo(TEMPESTADE, async () => ({
      grupos: new Map([
        [ids.ana, "A"],
        [ids.bia, "A"],
        [ids.caio, "B"],
        [ids.duda, "B"],
      ]),
      descricao: "Os lados do teste",
      aviso: null,
    }));
    const r = SugestaoSchema.parse(
      await comFonte.sugerir(
        ESCOLA,
        ids.turma8A,
        TEMPESTADE,
        { modo: "sorteio", computadores: 2, ausentes: [] },
        ids.prof8A,
      ),
    );
    expect(r.agrupamento).toEqual({
      fonte: "Os lados do teste",
      comGrupo: 4,
      neutros: 1,
      equipesMistas: 0,
      aviso: null,
    });
    expect(r.equipes.map((e) => e.grupo).sort()).toEqual(["A", "B"]);

    /* A fonte é da missão: em outra, o sorteio ignora lados. */
    const semFonte = await comFonte.sugerir(
      ESCOLA,
      ids.turma8A,
      INSTA,
      { modo: "sorteio", computadores: 2, ausentes: [] },
      ids.prof8A,
    );
    expect(semFonte.agrupamento).toBeNull();
  });

  test("missão fora da lista é 400", async () => {
    expect(
      await recusa(
        equipes.sugerir(ESCOLA, ids.turma8A, QUEM_MANDOU, { modo: "sorteio", computadores: 2, ausentes: [] }, ids.prof8A),
      ),
    ).toMatchObject({ status: 400, corpo: { codigo: "missao-sem-equipes" } });
  });
});

describe("a sala do professor mostra quantas equipes cada missão tem", () => {
  test("`equipes` na grade, e zero onde não há", async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
    await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);

    const sala = SalaDoProfessorSchema.parse(await salas.daTurma(ESCOLA, ids.turma8A, ids.prof8A));
    expect(sala.missoes.find((m) => m.expId === INSTA)?.equipes).toBe(2);
    expect(sala.missoes.filter((m) => m.expId !== INSTA).every((m) => m.equipes === 0)).toBe(true);
  });
});

/**
 * O GANCHO `aoMudarEquipes` — por onde a evidência pedagógica (E14) recalcula
 * as cópias. O que ele promete, e que só o banco prova: roda no `PUT` e no
 * `DELETE`, DENTRO da transação (vê as equipes novas antes do commit), e um
 * erro nele desfaz a montagem junto.
 */
describe("o gancho de quem depende das equipes", () => {
  beforeEach(async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
  });

  test("roda no PUT e no DELETE, com o alvo, e já enxerga as equipes novas dentro da transação", async () => {
    const vistos: { alvo: unknown; membrosDaAna: string[] }[] = [];
    const comGancho = new EquipesService(prisma);
    comGancho.aoMudarEquipes(async (tx, alvo) => {
      const mapa = await mapaDeEquipes(tx, alvo.escolaId, alvo.turmaId, alvo.expId);
      vistos.push({ alvo, membrosDaAna: mapa.get(ids.ana)?.membros.map((m) => m.id) ?? [] });
    });

    await comGancho.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);
    await comGancho.desfazer(ESCOLA, ids.turma8A, INSTA, ids.prof8A);

    const alvo = { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA };
    expect(vistos).toEqual([
      { alvo, membrosDaAna: [ids.ana, ids.bia] },
      { alvo, membrosDaAna: [] },
    ]);
  });

  test("um erro no gancho desfaz a montagem — e o serviço sem gancho segue igual", async () => {
    const quebrado = new EquipesService(prisma);
    quebrado.aoMudarEquipes(async () => {
      throw new Error("o interessado falhou");
    });
    await expect(quebrado.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A)).rejects.toThrow(
      "o interessado falhou",
    );
    expect(await prisma.equipesMontagem.count({ where: { escolaId: ESCOLA } })).toBe(0);
    expect(await prisma.equipe.count({ where: { escolaId: ESCOLA } })).toBe(0);

    const salvo = await equipes.salvar(ESCOLA, ids.turma8A, INSTA, duasEquipes(0), ids.prof8A);
    expect(salvo.montagem?.versao).toBe(1);
  });
});

/**
 * Por ÚLTIMO, porque muda a turma de uma criança: a reprojeção só se prova com
 * alguém que saiu e alguém que chegou depois da montagem de origem.
 */
describe("a última montagem, reprojetada sobre a turma de hoje", () => {
  test("sem montagem anterior: `origem: null` e todos sem equipe", async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
    const r = UltimaMontagemSchema.parse(await equipes.ultima(ESCOLA, ids.turma8A, TUBE, ids.prof8A));
    expect(r).toMatchObject({ origem: null, equipes: [], saidas: 0 });
    expect(r.semEquipe).toHaveLength(5);
  });

  test("quem saiu cai (e é contado), quem chegou fica sem equipe, e a missão ATUAL não conta", async () => {
    await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
    await equipes.salvar(
      ESCOLA,
      ids.turma8A,
      INSTA,
      {
        versao: 0,
        modo: "manual",
        computadores: 2,
        ausentes: [],
        equipes: [
          { nome: "Equipe 1", membros: [ids.ana, ids.enzo] },
          { nome: "Equipe 2", membros: [ids.bia, ids.caio, ids.duda] },
        ],
      },
      ids.prof8A,
    );
    /* A montagem da PRÓPRIA missão é a que se quer substituir — nunca a origem. */
    await equipes.salvar(
      ESCOLA,
      ids.turma8A,
      TUBE,
      { versao: 0, modo: "manual", computadores: 1, ausentes: [], equipes: [{ nome: "Só uma", membros: [ids.ana] }] },
      ids.prof8A,
    );

    await prisma.user.update({ where: { id: ids.enzo }, data: { turmaId: ids.turma8B } });
    const gabi = await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "equipes-gabi",
        role: "estudante",
        displayName: "Gabi Novata",
        passwordHash: "x",
        turmaId: ids.turma8A,
      },
      select: { id: true },
    });

    const r = UltimaMontagemSchema.parse(await equipes.ultima(ESCOLA, ids.turma8A, TUBE, ids.prof8A));
    expect(r.origem?.expId).toBe(INSTA);
    expect(r.saidas).toBe(1);
    expect(r.equipes.map((e) => [e.nome, e.membros.map((m) => m.nome)])).toEqual([
      ["Equipe 1", ["Ana Clara Souza"]],
      ["Equipe 2", ["Bia Lima", "Caio Reis", "Duda Melo"]],
    ]);
    expect(r.semEquipe.map((e) => e.id)).toEqual([gabi.id]);

    /* E a tela da missão de origem também já não mostra quem saiu. */
    const lido = await equipes.daMissao(ESCOLA, ids.turma8A, INSTA, ids.prof8A);
    expect(lido.equipes.flatMap((e) => e.membros.map((m) => m.id))).not.toContain(ids.enzo);
  });
});
