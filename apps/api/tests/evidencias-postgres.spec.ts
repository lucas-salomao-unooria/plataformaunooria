import { ForbiddenException, HttpException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PrismaClient } from "@prisma/client";
import type { Perfil } from "../src/auth/claims";
import { RolesGuard } from "../src/auth/roles";
import { EquipesService } from "../src/equipes/equipes.service";
import {
  PainelDaAtividadeSchema,
  PerfilDoEstudanteSchema,
  PerguntaSchema,
} from "../src/evidencias/contrato-de-rotas";
import { EvidenciasEstudanteController } from "../src/evidencias/evidencias-estudante.controller";
import { EvidenciasProfessorController } from "../src/evidencias/evidencias-professor.controller";
import { EvidenciasService, type ContextoDaAtividade } from "../src/evidencias/evidencias.service";
import type { FichaPedagogica } from "../src/evidencias/fichas";
import {
  ORIGENS,
  SITUACOES,
  STATUS,
  STATUS_DE_MARCA,
  TIPOS_DE_EVENTO,
  TIPOS_DE_MARCADOR,
  type Nivel,
} from "../src/evidencias/regras";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * A EVIDÊNCIA PEDAGÓGICA no Postgres (E14): a RLS das três tabelas, os CHECKs
 * contra o vocabulário do código, o histórico append-only, e o serviço inteiro
 * — a marca e a cópia para a equipe, o recálculo quando as equipes mudam, a
 * projeção que espera o professor, o ajuste, a pergunta de múltipla escolha,
 * o painel e o perfil.
 *
 * A suíte registra uma ficha DE TESTE para a exp08ef1b com `registrarFicha`
 * (a única ficha real do registro é a da exp05ef1b, que a suíte dela exercita),
 * e um resolvedor de contexto que ela controla. Os códigos são da BNCC de
 * verdade — o `registrarFicha` valida como o registro estático.
 *
 * UMA ESCOLA POR SUÍTE (mais a vizinha, para a RLS). Molde:
 * `equipes-postgres.spec.ts`.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-evidencias";
const OUTRA_ESCOLA = "teste-evidencias-2";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

/**
 * O MESMO Prisma, com a role SEM `BYPASSRLS`. Sem isto a prova de isolamento
 * passa em falso: o usuário administrativo é SUPERUSER, e superusuário ignora
 * RLS mesmo com `FORCE ROW LEVEL SECURITY`.
 */
const runtime = new PrismaService({
  datasources: { db: { url: urlDeRuntime(URL) } },
}) as PrismaService & PrismaClient;

const INSTA = "exp08ef1b";
/** Missão real que aceita equipe e NÃO tem ficha (a Missão Tempestade). */
const SEM_FICHA = "exp02em1b";
const H1 = "EF08CO01";
const H2 = "EF08CO02";
/**
 * A atividade da 8A: uma `activity` REAL do Instanooria, criada no
 * `beforeAll` — desde a ADR-130 a montagem das equipes é da atividade, e o
 * serviço confere que ela existe e é da turma. As outras (`atv-2`…) seguem
 * opacas: só levam marca, nunca montagem.
 */
let ATV = "";

const FICHA: FichaPedagogica = {
  expId: INSTA,
  versao: 1,
  habilidades: [
    {
      codigo: H1,
      marcadores: [
        { id: "h1-acao", tipo: "acao" },
        { id: "h1-pergunta", tipo: "multipla_escolha", perguntaId: "p1" },
      ],
    },
    { codigo: H2, marcadores: [{ id: "h2-acao", tipo: "acao" }] },
  ],
  perguntas: [
    {
      id: "p1",
      enunciado: "Chegou um boato no grupo. O que fazer?",
      alternativas: [
        { id: "checar", texto: "Checar a fonte antes", status: "atingiu" },
        { id: "perguntar", texto: "Perguntar a um colega", status: "em_processo" },
        { id: "repassar", texto: "Repassar para todo mundo", status: "nao_atingiu" },
      ],
    },
  ],
};

/** O contexto que o resolvedor devolve — a suíte o troca por teste. */
let contexto: ContextoDaAtividade | null = null;

function montarServicos(cliente: PrismaService) {
  const equipes = new EquipesService(cliente);
  const evidencias = new EvidenciasService(cliente, equipes);
  evidencias.onModuleInit();
  evidencias.registrarFicha(FICHA);
  evidencias.registrarContexto(INSTA, async () => contexto);
  return { equipes, evidencias };
}

const { equipes, evidencias } = montarServicos(prisma);

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

/** Tudo de evidência e de equipe das duas escolas — entre um teste e outro. */
async function zerar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
}

async function limpar() {
  await zerar();
  await prisma.activity.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.matricula.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.escola.deleteMany({ where: { id: { in: ESCOLAS } } });
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
  throw new Error("era para recusar, e passou");
}

/** A porta das missões, como um módulo de missão a chamaria — da transação dele. */
function marcar(
  estudanteId: string,
  marcador: string,
  status: Nivel,
  extra: { atividadeId?: string; rodada?: number; escolaId?: string; turmaId?: string } = {},
  servico: EvidenciasService = evidencias,
  cliente: PrismaService = prisma,
) {
  const escolaId = extra.escolaId ?? ESCOLA;
  return cliente.comTenancy(
    (tx) =>
      servico.marcar(tx, {
        escolaId,
        turmaId: extra.turmaId ?? ids.turma8A,
        expId: INSTA,
        atividadeId: extra.atividadeId ?? ATV,
        rodada: extra.rodada ?? 1,
        estudanteId,
        marcador,
        status,
      }),
    escolaId,
  );
}

/** A evidência de uma criança numa habilidade, lida por fora (superusuário). */
async function evidenciaDe(estudanteId: string, habilidade: string, rodada = 1, atividadeId = ATV) {
  return prisma.evidencia.findUnique({
    where: {
      escolaId_expId_atividadeId_rodada_estudanteId_habilidade: {
        escolaId: ESCOLA,
        expId: INSTA,
        atividadeId,
        rodada,
        estudanteId,
        habilidade,
      },
    },
    select: { status: true, origem: true, situacao: true, fonteEstudanteId: true },
  });
}

/** Monta as equipes da 8A nesta missão, como o professor faria. */
async function montar(grupos: string[][], computadores = grupos.length) {
  const alvo = { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA, atividadeId: ATV };
  const atual = await equipes.daMissao(alvo, ids.prof8A);
  return equipes.salvar(
    alvo,
    {
      versao: atual.montagem?.versao ?? 0,
      modo: "manual",
      computadores,
      ausentes: [],
      equipes: grupos.map((membros, i) => ({ nome: `Equipe ${i + 1}`, membros })),
    },
    ids.prof8A,
  );
}

function eventos(tipo?: string) {
  return prisma.evidenciaEvento.findMany({
    where: { escolaId: ESCOLA, ...(tipo ? { tipo } : {}) },
    orderBy: { criadoEm: "asc" },
  });
}

const ajustar = (rodada: number, ajustes: { estudanteId: string; habilidade: string; status: (typeof STATUS)[number] }[]) =>
  evidencias.ajustar(ESCOLA, ids.turma8A, INSTA, ATV, rodada, ids.prof8A, ajustes);

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola da evidência (teste)" } });
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

  ids.prof8A = await pessoa(ESCOLA, "evid-prof-8a", "professor", "Marta Prof");
  ids.prof8B = await pessoa(ESCOLA, "evid-prof-8b", "professor", "Rui Prof");
  ids.profVizinho = await pessoa(OUTRA_ESCOLA, "evid-prof-viz", "professor", "Vera Prof");
  ids.ana = await pessoa(ESCOLA, "evid-ana", "estudante", "Ana Clara Souza", ids.turma8A);
  ids.bia = await pessoa(ESCOLA, "evid-bia", "estudante", "Bia Lima", ids.turma8A);
  ids.caio = await pessoa(ESCOLA, "evid-caio", "estudante", "Caio Reis", ids.turma8A);
  ids.duda = await pessoa(ESCOLA, "evid-duda", "estudante", "Duda Melo", ids.turma8A);
  ids.enzo = await pessoa(ESCOLA, "evid-enzo", "estudante", "Enzo Paz", ids.turma8A);
  ids.fabi = await pessoa(ESCOLA, "evid-fabi", "estudante", "Fabi Nunes", ids.turma8B);
  ids.vizinho = await pessoa(OUTRA_ESCOLA, "evid-vizinho", "estudante", "Vito Vizinho", ids.turmaVizinha);

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

  ATV = (
    await prisma.activity.create({
      data: {
        escolaId: ESCOLA,
        turmaId: ids.turma8A,
        professorId: ids.prof8A,
        titulo: "Atividade de teste",
        disciplina: "Língua Portuguesa",
        temaGeral: "tema",
        recorte: "recorte",
        perguntaChave: "pergunta?",
        estiloVisual: "fotografico",
        proporcoes: {},
        engineConfig: {},
        status: "ativa",
      },
      select: { id: true },
    })
  ).id;

  /* A missão aberta SÓ na 8A: a 8B é a turma sem liberação. */
  await liberarParaTeste(prisma, ESCOLA, ids.turma8A, INSTA, ids.prof8A);

  /* O `PUT` das equipes exige a missão no catálogo e de estudante. O `update`
     não toca em nome nem versão — a lição de `salas-postgres.spec.ts`. */
  await prisma.experiencia.upsert({
    where: { expId: INSTA },
    update: { publico: "estudante" },
    create: { expId: INSTA, nome: INSTA, versaoAtiva: "1.0.0", series: ["8EF"], publico: "estudante" },
  });
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

const TABELAS = ["evidencias_marcas", "evidencias", "evidencias_eventos"] as const;

describe("tenancy no banco (regra inviolável nº 1)", () => {
  beforeAll(async () => {
    await zerar();
    await marcar(ids.ana, "h1-acao", "atingiu");
    await marcar(ids.vizinho, "h1-acao", "em_processo", { escolaId: OUTRA_ESCOLA, turmaId: ids.turmaVizinha });
  });

  test("as três tabelas têm RLS habilitada E forçada, com uma política por escola", async () => {
    for (const tabela of TABELAS) {
      const [linha] = await prisma.$queryRawUnsafe<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${tabela}'`,
      );
      expect({ tabela, ...linha }).toEqual({ tabela, relrowsecurity: true, relforcerowsecurity: true });

      const policies = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tabela}'`,
      );
      expect(policies.map((p) => p.policyname)).toEqual([`${tabela}_por_escola`]);
    }
  });

  test("a RLS isola DE VERDADE: com a escola de cá armada, a de lá some", async () => {
    for (const escola of ESCOLAS) {
      const vistas = await runtime.comTenancy(
        async (tx) => ({
          evidencias_marcas: await tx.evidenciaMarca.findMany({ select: { escolaId: true } }),
          evidencias: await tx.evidencia.findMany({ select: { escolaId: true } }),
          evidencias_eventos: await tx.evidenciaEvento.findMany({ select: { escolaId: true } }),
        }),
        escola,
      );
      for (const [tabela, linhas] of Object.entries(vistas)) {
        expect({ escola, tabela, tem: linhas.length > 0 }).toEqual({ escola, tabela, tem: true });
        expect({ escola, tabela, sóDaqui: linhas.every((l) => l.escolaId === escola) }).toEqual({
          escola,
          tabela,
          sóDaqui: true,
        });
      }
    }
  });

  test("uma sessão SEM tenancy armada não enxerga linha nenhuma", async () => {
    for (const tabela of TABELAS) {
      const [linha] = await runtime.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${tabela}`);
      expect({ tabela, n: Number(linha?.n) }).toEqual({ tabela, n: 0 });
    }
  });

  test("a role sem ownership marca, ajusta e lê pelo serviço — os GRANTs e o WITH CHECK da política", async () => {
    const pelaRuntime = montarServicos(runtime).evidencias;
    const r = await marcar(ids.bia, "h2-acao", "em_processo", {}, pelaRuntime, runtime);
    expect(r.registrada).toBe(true);
    const painel = await pelaRuntime.ajustar(ESCOLA, ids.turma8A, INSTA, ATV, 1, ids.prof8A, [
      { estudanteId: ids.bia, habilidade: H2, status: "atingiu" },
    ]);
    expect(painel.estudantes.find((e) => e.id === ids.bia)?.porRodada["1"]?.[H2]).toEqual({
      status: "atingiu",
      origem: "professor",
      situacao: "valida",
    });
  });

  test("os CHECKs são o MESMO vocabulário do código", async () => {
    const checks = await prisma.$queryRawUnsafe<{ conname: string; def: string }[]>(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname LIKE 'evidencias%_check'`,
    );
    const def = new Map(checks.map((c) => [c.conname, c.def]));
    const valores = (nome: string) => [...(def.get(nome) ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();

    expect(valores("evidencias_marcas_status_check")).toEqual([...STATUS_DE_MARCA].sort());
    expect(valores("evidencias_marcas_tipo_check")).toEqual([...TIPOS_DE_MARCADOR].sort());
    expect(valores("evidencias_status_check")).toEqual([...STATUS].sort());
    expect(valores("evidencias_origem_check")).toEqual([...ORIGENS].sort());
    expect(valores("evidencias_situacao_check")).toEqual([...SITUACOES].sort());
    expect(valores("evidencias_eventos_tipo_check")).toEqual([...TIPOS_DE_EVENTO].sort());
    for (const tabela of TABELAS) {
      expect(def.get(`${tabela}_atividade_id_check`)).toContain("^[A-Za-z0-9_.:-]{1,100}$");
      expect(def.get(`${tabela}_rodada_check`)).toContain(">= 1");
    }
  });

  test("a COERÊNCIA entre as colunas é cobrada pelo banco", async () => {
    const base = {
      escolaId: ESCOLA,
      turmaId: ids.turma8A,
      expId: INSTA,
      atividadeId: "atv-coerencia",
      rodada: 1,
      estudanteId: ids.caio,
      habilidade: H1,
      status: "atingiu",
    };
    /* `a_revisar` fora da projeção; cópia sem fonte; ajuste sem autor; `nao_participou` sem ser ajuste. */
    for (const ruim of [
      { origem: "equipe", situacao: "a_revisar", fonteEstudanteId: ids.ana },
      { origem: "equipe", situacao: "valida" },
      { origem: "professor", situacao: "valida" },
      { origem: "propria", situacao: "valida", status: "nao_participou" },
      { origem: "propria", situacao: "valida", atividadeId: "com espaço" },
      { origem: "propria", situacao: "valida", rodada: 0 },
    ]) {
      await expect(prisma.evidencia.create({ data: { ...base, ...ruim } })).rejects.toThrow();
    }
    /* O controle: a mesma base, coerente, entra — as recusas acima são dos CHECKs, e não da base. */
    const boa = await prisma.evidencia.create({ data: { ...base, origem: "propria", situacao: "valida" } });
    await prisma.evidencia.delete({ where: { id: boa.id } });
  });

  test("o histórico é APPEND-ONLY: `UPDATE` é recusado pelo banco, até para a dona da tabela", async () => {
    const [evento] = await eventos();
    expect(evento).toBeDefined();
    await expect(
      prisma.evidenciaEvento.update({ where: { id: evento!.id }, data: { tipo: "ajuste" } }),
    ).rejects.toThrow(/append-only/);
  });

  test("a evidência é dado da criança: apagar a conta leva marca, evidência e histórico — o trigger não trava", async () => {
    const gabi = await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "evid-gabi",
        role: "estudante",
        displayName: "Gabi Temporária",
        passwordHash: "x",
        turmaId: ids.turma8A,
      },
      select: { id: true },
    });
    await marcar(gabi.id, "h2-acao", "atingiu");
    const dela = { where: { escolaId: ESCOLA, estudanteId: gabi.id } };
    expect(await prisma.evidenciaEvento.count(dela)).toBe(1);

    await prisma.user.delete({ where: { id: gabi.id } });
    expect(await prisma.evidenciaMarca.count(dela)).toBe(0);
    expect(await prisma.evidencia.count(dela)).toBe(0);
    expect(await prisma.evidenciaEvento.count(dela)).toBe(0);
  });
});

describe("a marca e a cópia para a equipe", () => {
  beforeEach(zerar);

  test("a marca grava a evidência PRÓPRIA e copia só o NÍVEL para os colegas de computador", async () => {
    await montar([
      [ids.ana, ids.bia, ids.caio],
      [ids.duda, ids.enzo],
    ]);
    expect(await marcar(ids.ana, "h1-acao", "em_processo")).toEqual({
      registrada: true,
      evidencia: "em_processo",
      copias: 2,
    });

    expect(await evidenciaDe(ids.ana, H1)).toEqual({
      status: "em_processo",
      origem: "propria",
      situacao: "valida",
      fonteEstudanteId: null,
    });
    for (const colega of [ids.bia, ids.caio]) {
      expect(await evidenciaDe(colega, H1)).toEqual({
        status: "em_processo",
        origem: "equipe",
        situacao: "valida",
        fonteEstudanteId: ids.ana,
      });
    }
    /* A outra equipe e a outra habilidade não recebem nada: N/A é ausência de linha. */
    expect(await evidenciaDe(ids.duda, H1)).toBeNull();
    expect(await evidenciaDe(ids.bia, H2)).toBeNull();

    expect((await eventos("marca")).map((e) => e.estudanteId)).toEqual([ids.ana]);
    expect((await eventos("copia")).map((e) => e.estudanteId).sort()).toEqual([ids.bia, ids.caio].sort());
  });

  test("dois marcadores da mesma habilidade: vale o MELHOR — e a ação guarda a melhor marca", async () => {
    await marcar(ids.ana, "h1-acao", "atingiu");
    expect(await marcar(ids.ana, "h1-acao", "nao_atingiu")).toMatchObject({ registrada: false, evidencia: "atingiu" });
    const marca = await prisma.evidenciaMarca.findFirst({
      where: { escolaId: ESCOLA, estudanteId: ids.ana, marcador: "h1-acao" },
    });
    expect(marca?.status).toBe("atingiu");

    /* A pergunta da mesma habilidade saiu pior: a evidência fica com a ação. */
    await marcar(ids.ana, "h1-pergunta", "em_processo");
    expect((await evidenciaDe(ids.ana, H1))?.status).toBe("atingiu");

    /* E ao contrário: a ação em processo, a pergunta acertada. */
    await marcar(ids.bia, "h1-acao", "em_processo");
    await marcar(ids.bia, "h1-pergunta", "atingiu");
    expect((await evidenciaDe(ids.bia, H1))?.status).toBe("atingiu");
  });

  test("colega com marca PRÓPRIA não é sobrescrito; e a marca própria vence a cópia, mesmo pior", async () => {
    await montar([
      [ids.ana, ids.bia],
      [ids.caio, ids.duda, ids.enzo],
    ]);
    await marcar(ids.bia, "h1-acao", "nao_atingiu");
    expect((await evidenciaDe(ids.ana, H1))?.origem).toBe("equipe");

    await marcar(ids.ana, "h1-acao", "atingiu");
    expect(await evidenciaDe(ids.ana, H1)).toMatchObject({ status: "atingiu", origem: "propria" });
    expect(await evidenciaDe(ids.bia, H1)).toMatchObject({ status: "nao_atingiu", origem: "propria" });

    /* A cópia atingiu da Ana sobre o Caio, e depois o Caio marca pior: fica a dele. */
    await montar([
      [ids.ana, ids.caio],
      [ids.bia, ids.duda, ids.enzo],
    ]);
    await marcar(ids.ana, "h2-acao", "atingiu");
    expect(await evidenciaDe(ids.caio, H2)).toMatchObject({ status: "atingiu", origem: "equipe" });
    await marcar(ids.caio, "h2-acao", "nao_atingiu");
    expect(await evidenciaDe(ids.caio, H2)).toMatchObject({ status: "nao_atingiu", origem: "propria" });
  });

  test("entre duas fontes da mesma equipe fica a MELHOR", async () => {
    await montar([
      [ids.ana, ids.bia, ids.caio],
      [ids.duda, ids.enzo],
    ]);
    await marcar(ids.ana, "h2-acao", "atingiu");
    await marcar(ids.bia, "h2-acao", "nao_atingiu");
    expect(await evidenciaDe(ids.caio, H2)).toMatchObject({ status: "atingiu", fonteEstudanteId: ids.ana });
  });

  test("o AJUSTE do professor não é sobrescrito — nem pela cópia, nem pela marca da própria criança", async () => {
    await montar([
      [ids.ana, ids.bia],
      [ids.caio, ids.duda, ids.enzo],
    ]);
    await ajustar(1, [{ estudanteId: ids.bia, habilidade: H1, status: "em_processo" }]);

    await marcar(ids.ana, "h1-acao", "atingiu");
    expect(await evidenciaDe(ids.bia, H1)).toMatchObject({ status: "em_processo", origem: "professor" });

    expect(await marcar(ids.bia, "h1-acao", "atingiu")).toMatchObject({ registrada: true, evidencia: "em_processo" });
    expect(await evidenciaDe(ids.bia, H1)).toMatchObject({ status: "em_processo", origem: "professor" });
  });

  test("marcador fora da ficha é 400, e nada é gravado", async () => {
    expect(await recusa(marcar(ids.ana, "inventado", "atingiu"))).toMatchObject({
      status: 400,
      corpo: { codigo: "marcador-desconhecido" },
    });
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });
});

describe("quando as equipes mudam", () => {
  beforeEach(zerar);

  test("recalcula SÓ a rodada em andamento — a passada fica como estava", async () => {
    await montar([
      [ids.ana, ids.bia],
      [ids.caio, ids.duda, ids.enzo],
    ]);
    await marcar(ids.ana, "h1-acao", "atingiu", { rodada: 1 });
    await marcar(ids.ana, "h1-acao", "em_processo", { rodada: 2 });
    expect((await evidenciaDe(ids.bia, H1, 1))?.status).toBe("atingiu");
    expect((await evidenciaDe(ids.bia, H1, 2))?.status).toBe("em_processo");

    /* A Ana troca de computador: agora senta com o Caio. */
    await montar([
      [ids.ana, ids.caio],
      [ids.bia, ids.duda, ids.enzo],
    ]);

    /* Rodada 2, a em andamento: a cópia sai da Bia e vai para o Caio. */
    expect(await evidenciaDe(ids.bia, H1, 2)).toBeNull();
    expect(await evidenciaDe(ids.caio, H1, 2)).toMatchObject({ status: "em_processo", fonteEstudanteId: ids.ana });
    /* Rodada 1, passada: nada muda. */
    expect(await evidenciaDe(ids.bia, H1, 1)).toMatchObject({ status: "atingiu", origem: "equipe" });
    expect(await evidenciaDe(ids.caio, H1, 1)).toBeNull();

    const recalculos = await eventos("recalculo");
    expect(recalculos.every((e) => e.rodada === 2)).toBe(true);
    expect(recalculos.map((e) => [e.estudanteId, e.de === null, e.para === null]).sort()).toEqual(
      [
        [ids.bia, false, true],
        [ids.caio, true, false],
      ].sort(),
    );
  });

  test("desfazer as equipes apaga as cópias da rodada em andamento, e só elas", async () => {
    await montar([
      [ids.ana, ids.bia],
      [ids.caio, ids.duda, ids.enzo],
    ]);
    await marcar(ids.ana, "h1-acao", "atingiu");
    expect((await evidenciaDe(ids.bia, H1))?.origem).toBe("equipe");

    await equipes.desfazer({ escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA, atividadeId: ATV }, ids.prof8A);
    expect(await evidenciaDe(ids.bia, H1)).toBeNull();
    expect((await evidenciaDe(ids.ana, H1))?.origem).toBe("propria");
  });

  test("`nao_participou` barra a cópia também no recálculo", async () => {
    await montar([
      [ids.ana, ids.bia],
      [ids.caio, ids.duda, ids.enzo],
    ]);
    await marcar(ids.ana, "h1-acao", "atingiu");
    await ajustar(1, [{ estudanteId: ids.bia, habilidade: H1, status: "nao_participou" }]);

    await montar([
      [ids.ana, ids.bia, ids.caio],
      [ids.duda, ids.enzo],
    ]);
    expect(await evidenciaDe(ids.bia, H1)).toMatchObject({ status: "nao_participou", origem: "professor" });
    expect(await evidenciaDe(ids.caio, H1)).toMatchObject({ status: "atingiu", origem: "equipe" });
  });

  test("uma falha no recálculo DESFAZ a montagem — o gancho roda na transação das equipes", async () => {
    const quebrado = new EquipesService(prisma);
    quebrado.aoMudarEquipes(async () => {
      throw new Error("recálculo quebrou");
    });
    await expect(
      quebrado.salvar(
        { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA, atividadeId: ATV },
        { versao: 0, modo: "manual", computadores: 1, ausentes: [], equipes: [{ nome: "Única", membros: [ids.ana] }] },
        ids.prof8A,
      ),
    ).rejects.toThrow("recálculo quebrou");
    expect(await prisma.equipesMontagem.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });
});

describe("a projeção: a turma inteira diante de um computador", () => {
  beforeEach(zerar);
  const turmaInteira = () => [[ids.ana, ids.bia, ids.caio, ids.duda, ids.enzo]];

  test("um computador: a cópia nasce `a_revisar` e fica fora do perfil até o professor confirmar", async () => {
    await montar(turmaInteira(), 1);
    await marcar(ids.ana, "h1-acao", "atingiu");

    for (const colega of [ids.bia, ids.caio, ids.duda, ids.enzo]) {
      expect(await evidenciaDe(colega, H1)).toMatchObject({ origem: "projecao", situacao: "a_revisar" });
    }
    const antes = PainelDaAtividadeSchema.parse(await evidencias.painel(ESCOLA, ids.turma8A, INSTA, ATV, ids.prof8A));
    expect(antes.pendentes).toEqual({ "1": 4 });
    expect(antes.estudantes.find((e) => e.id === ids.bia)?.resultado).toEqual({});
    expect((await evidencias.perfil(ESCOLA, ids.bia, ids.prof8A)).missoes).toEqual([]);

    const depois = PainelDaAtividadeSchema.parse(
      await evidencias.confirmar(ESCOLA, ids.turma8A, INSTA, ATV, 1, ids.prof8A),
    );
    expect(depois.pendentes).toEqual({ "1": 0 });
    expect(depois.estudantes.find((e) => e.id === ids.bia)?.resultado).toEqual({ [H1]: "atingiu" });
    expect(depois.estudantes.find((e) => e.id === ids.bia)?.porRodada["1"]?.[H1]).toEqual({
      status: "atingiu",
      origem: "projecao",
      situacao: "valida",
    });
    const perfil = await evidencias.perfil(ESCOLA, ids.bia, ids.prof8A);
    expect(perfil.missoes[0]?.atividades[0]?.habilidades.map((h) => [h.codigo, h.status])).toEqual([[H1, "atingiu"]]);

    const [confirmacao] = await eventos("confirmacao");
    expect(confirmacao).toMatchObject({
      estudanteId: null,
      habilidade: null,
      autorId: ids.prof8A,
      para: { situacao: "valida", linhas: 4 },
    });

    /* Repetir não muda nada, nem historia de novo. */
    await evidencias.confirmar(ESCOLA, ids.turma8A, INSTA, ATV, 1, ids.prof8A);
    expect(await eventos("confirmacao")).toHaveLength(1);

    /* Depois de confirmar, o professor ainda ajusta uma criança. */
    await ajustar(1, [{ estudanteId: ids.caio, habilidade: H1, status: "em_processo" }]);
    expect(await evidenciaDe(ids.caio, H1)).toMatchObject({ status: "em_processo", origem: "professor" });
  });

  test("salvar as equipes de novo sem mudar ninguém NÃO desfaz a confirmação", async () => {
    await montar(turmaInteira(), 1);
    await marcar(ids.ana, "h1-acao", "atingiu");
    await evidencias.confirmar(ESCOLA, ids.turma8A, INSTA, ATV, 1, ids.prof8A);

    await montar(turmaInteira(), 1);
    expect(await evidenciaDe(ids.bia, H1)).toMatchObject({ origem: "projecao", situacao: "valida" });
    expect(await eventos("recalculo")).toEqual([]);
  });

  test("a equipe com a turma INTEIRA é projeção mesmo com dois computadores", async () => {
    await montar(turmaInteira(), 2);
    await marcar(ids.ana, "h1-acao", "em_processo");
    expect(await evidenciaDe(ids.enzo, H1)).toMatchObject({ origem: "projecao", situacao: "a_revisar" });
  });
});

describe("o ajuste do professor", () => {
  beforeEach(zerar);

  test("um estudante: origem `professor`, e o histórico com de/para, quem e quando", async () => {
    await marcar(ids.ana, "h1-acao", "em_processo");
    const painel = PainelDaAtividadeSchema.parse(
      await ajustar(1, [{ estudanteId: ids.ana, habilidade: H1, status: "atingiu" }]),
    );
    expect(painel.estudantes.find((e) => e.id === ids.ana)?.porRodada["1"]?.[H1]).toEqual({
      status: "atingiu",
      origem: "professor",
      situacao: "valida",
    });

    const [ajuste] = await eventos("ajuste");
    expect(ajuste).toMatchObject({
      estudanteId: ids.ana,
      habilidade: H1,
      rodada: 1,
      autorId: ids.prof8A,
      de: { status: "em_processo", origem: "propria", situacao: "valida" },
      para: { status: "atingiu", origem: "professor", situacao: "valida" },
    });
    expect(ajuste?.criadoEm).toBeInstanceOf(Date);
  });

  test("vários de uma vez — e repetir o mesmo ajuste é ignorado, sem evento", async () => {
    const lote = [
      { estudanteId: ids.bia, habilidade: H1, status: "nao_atingiu" as const },
      { estudanteId: ids.caio, habilidade: H2, status: "atingiu" as const },
      { estudanteId: ids.duda, habilidade: H1, status: "nao_participou" as const },
    ];
    await ajustar(1, lote);
    expect(await eventos("ajuste")).toHaveLength(3);
    expect((await eventos("ajuste")).every((e) => e.de === null)).toBe(true);

    await ajustar(1, lote);
    expect(await eventos("ajuste")).toHaveLength(3);

    /* `nao_participou` é N/A no resultado: a Duda fica sem H1. */
    const painel = await evidencias.painel(ESCOLA, ids.turma8A, INSTA, ATV, ids.prof8A);
    expect(painel.estudantes.find((e) => e.id === ids.duda)?.resultado).toEqual({});
    expect(painel.estudantes.find((e) => e.id === ids.duda)?.porRodada["1"]?.[H1]?.status).toBe("nao_participou");
  });

  test("com a missão ENCERRADA, o ajuste continua", async () => {
    await prisma.liberacao.update({
      where: { escolaId_turmaId_expId: { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA } },
      data: { estado: "encerrada", encerradaEm: new Date() },
    });
    try {
      await ajustar(1, [{ estudanteId: ids.ana, habilidade: H2, status: "em_processo" }]);
      expect((await evidenciaDe(ids.ana, H2))?.origem).toBe("professor");
    } finally {
      await liberarParaTeste(prisma, ESCOLA, ids.turma8A, INSTA, ids.prof8A);
    }
  });

  test("as recusas: a lista inteira em frases, a rodada que não aconteceu — e nada gravado", async () => {
    expect(
      await recusa(
        ajustar(1, [
          { estudanteId: ids.fabi, habilidade: H1, status: "atingiu" },
          { estudanteId: ids.ana, habilidade: "EF01CO01", status: "atingiu" },
          { estudanteId: ids.bia, habilidade: H1, status: "atingiu" },
          { estudanteId: ids.bia, habilidade: H1, status: "em_processo" },
        ]),
      ),
    ).toEqual({
      status: 400,
      corpo: {
        codigo: "ajuste-invalido",
        mensagem: "Os ajustes não puderam ser salvos.",
        erros: [
          "Há um estudante que não é desta turma.",
          "A habilidade EF01CO01 não está na ficha desta missão.",
          "O mesmo estudante aparece duas vezes na mesma habilidade.",
        ],
      },
    });
    expect(await recusa(ajustar(2, [{ estudanteId: ids.ana, habilidade: H1, status: "atingiu" }]))).toMatchObject({
      status: 400,
      corpo: { codigo: "rodada-inexistente" },
    });
    expect(await prisma.evidencia.count({ where: { escolaId: ESCOLA } })).toBe(0);
    expect(await eventos()).toEqual([]);
  });
});

describe("a pergunta de múltipla escolha", () => {
  beforeEach(async () => {
    await zerar();
    contexto = { turmaId: ids.turma8A, atividadeId: ATV, rodada: 1 };
  });

  test("a pergunta sai SEM o gabarito", async () => {
    const p = PerguntaSchema.parse(await evidencias.pergunta(ESCOLA, ids.ana, INSTA, "p1"));
    expect({ ...p, alternativas: [...p.alternativas].sort((a, b) => a.id.localeCompare(b.id)) }).toEqual({
      enunciado: "Chegou um boato no grupo. O que fazer?",
      alternativas: [
        { id: "checar", texto: "Checar a fonte antes" },
        { id: "perguntar", texto: "Perguntar a um colega" },
        { id: "repassar", texto: "Repassar para todo mundo" },
      ],
    });
    const texto = JSON.stringify(p);
    for (const nivel of STATUS) expect(texto).not.toContain(nivel);
    expect(texto).not.toContain("status");
  });

  /**
   * A ficha guarda as alternativas na ordem da régua (atingiu primeiro), e é
   * assim que o pedagógico as escreve. Servidas nessa ordem, "a primeira é a
   * certa" vira a pista. Com 3 alternativas e 60 leituras, a chance de TODAS
   * saírem na mesma ordem por acaso é 6 × (1/6)^60 — zero, na prática.
   */
  test("as alternativas saem EMBARALHADAS, numa ordem nova a cada leitura", async () => {
    const ordens = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const p = await evidencias.pergunta(ESCOLA, ids.ana, INSTA, "p1");
      expect(p.alternativas.map((a) => a.id).sort()).toEqual(["checar", "perguntar", "repassar"]);
      ordens.add(p.alternativas.map((a) => a.id).join(","));
    }
    expect(ordens.size).toBeGreaterThan(1);
    /* A ficha não muda: embaralhar é da resposta, nunca do registro. */
    expect(evidencias.fichaDe(INSTA)?.perguntas[0]?.alternativas.map((a) => a.id)).toEqual([
      "checar",
      "perguntar",
      "repassar",
    ]);
  });

  test("a PRIMEIRA resposta vale; a segunda é aceita, ignorada, e responde igual", async () => {
    expect(await evidencias.responder(ESCOLA, ids.ana, INSTA, "p1", "repassar")).toEqual({ enviada: true });
    expect(await evidencias.responder(ESCOLA, ids.ana, INSTA, "p1", "checar")).toEqual({ enviada: true });

    expect(await evidenciaDe(ids.ana, H1)).toMatchObject({ status: "nao_atingiu", origem: "propria" });
    const marcas = await prisma.evidenciaMarca.findMany({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(marcas.map((m) => [m.marcador, m.status, m.tipo, m.atividadeId, m.rodada])).toEqual([
      ["h1-pergunta", "nao_atingiu", "multipla_escolha", ATV, 1],
    ]);
  });

  test("a atividade e a rodada vêm do CONTEXTO da missão — a resposta cai na rodada dele", async () => {
    contexto = { turmaId: ids.turma8A, atividadeId: "atv-2", rodada: 3 };
    await evidencias.responder(ESCOLA, ids.bia, INSTA, "p1", "checar");
    expect(await evidenciaDe(ids.bia, H1, 3, "atv-2")).toMatchObject({ status: "atingiu" });
  });

  test("sem atividade em andamento: 409 — e sem resolvedor registrado, também", async () => {
    contexto = null;
    const semAtividade = {
      status: 409,
      corpo: { codigo: "sem-atividade-em-andamento", mensagem: "Nada para responder agora." },
    };
    expect(await recusa(evidencias.responder(ESCOLA, ids.ana, INSTA, "p1", "checar"))).toEqual(semAtividade);

    const semResolvedor = new EvidenciasService(prisma, new EquipesService(prisma));
    semResolvedor.registrarFicha(FICHA);
    expect(await recusa(semResolvedor.responder(ESCOLA, ids.ana, INSTA, "p1", "checar"))).toEqual(semAtividade);
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("missão NÃO liberada na turma do estudante: 403, na pergunta e na resposta", async () => {
    const naoLiberada = { status: 403, corpo: { codigo: "missao-nao-liberada" } };
    expect(await recusa(evidencias.responder(ESCOLA, ids.fabi, INSTA, "p1", "checar"))).toMatchObject(naoLiberada);
    expect(await recusa(evidencias.pergunta(ESCOLA, ids.fabi, INSTA, "p1"))).toMatchObject(naoLiberada);
  });

  test("pergunta que não existe é 404; alternativa que não é dela, 400", async () => {
    expect(await recusa(evidencias.pergunta(ESCOLA, ids.ana, INSTA, "p9"))).toMatchObject({
      status: 404,
      corpo: { codigo: "pergunta-nao-encontrada" },
    });
    expect(await recusa(evidencias.responder(ESCOLA, ids.ana, SEM_FICHA, "p1", "checar"))).toMatchObject({ status: 404 });
    expect(await recusa(evidencias.responder(ESCOLA, ids.ana, INSTA, "p1", "talvez"))).toMatchObject({
      status: 400,
      corpo: { codigo: "alternativa-desconhecida" },
    });
  });
});

describe("o painel", () => {
  beforeAll(async () => {
    await zerar();
    await montar([
      [ids.ana, ids.bia],
      [ids.caio, ids.duda, ids.enzo],
    ]);
    /* H1 melhor na rodada 1; H2 melhor na rodada 2. */
    await marcar(ids.ana, "h1-acao", "atingiu", { rodada: 1 });
    await marcar(ids.ana, "h2-acao", "nao_atingiu", { rodada: 1 });
    await marcar(ids.ana, "h1-acao", "em_processo", { rodada: 2 });
    await marcar(ids.ana, "h2-acao", "atingiu", { rodada: 2 });
  });

  test("a forma: habilidades da ficha, rodadas, a equipe, cada rodada e o resultado", async () => {
    const painel = PainelDaAtividadeSchema.parse(await evidencias.painel(ESCOLA, ids.turma8A, INSTA, ATV, ids.prof8A));
    expect(painel.temFicha).toBe(true);
    expect(painel.habilidades.map((h) => h.codigo)).toEqual([H1, H2]);
    expect(painel.habilidades.every((h) => h.descricao.length > 20)).toBe(true);
    expect(painel.rodadas).toEqual([1, 2]);
    expect(painel.pendentes).toEqual({ "1": 0, "2": 0 });
    /* Todos os estudantes da turma, em ordem alfabética — nunca por nível. */
    expect(painel.estudantes.map((e) => e.nome)).toEqual([
      "Ana Clara Souza",
      "Bia Lima",
      "Caio Reis",
      "Duda Melo",
      "Enzo Paz",
    ]);

    const ana = painel.estudantes.find((e) => e.id === ids.ana);
    expect(ana?.equipe?.nome).toBe("Equipe 1");
    expect(ana?.porRodada).toEqual({
      "1": {
        [H1]: { status: "atingiu", origem: "propria", situacao: "valida" },
        [H2]: { status: "nao_atingiu", origem: "propria", situacao: "valida" },
      },
      "2": {
        [H1]: { status: "em_processo", origem: "propria", situacao: "valida" },
        [H2]: { status: "atingiu", origem: "propria", situacao: "valida" },
      },
    });
    /* A melhor rodada POR HABILIDADE: H1 da rodada 1, H2 da rodada 2. */
    expect(ana?.resultado).toEqual({ [H1]: "atingiu", [H2]: "atingiu" });
    /* A Bia herdou pela equipe; o Caio, de outra equipe, não tem nada. */
    expect(painel.estudantes.find((e) => e.id === ids.bia)?.resultado).toEqual({ [H1]: "atingiu", [H2]: "atingiu" });
    expect(painel.estudantes.find((e) => e.id === ids.caio)).toMatchObject({ porRodada: {}, resultado: {} });
  });

  test("outra atividade é outro painel", async () => {
    const painel = await evidencias.painel(ESCOLA, ids.turma8A, INSTA, "atv-outra", ids.prof8A);
    expect(painel.rodadas).toEqual([]);
    expect(painel.estudantes.every((e) => Object.keys(e.porRodada).length === 0)).toBe(true);
  });

  test("missão SEM ficha: 200 com `temFicha: false` e tudo vazio", async () => {
    expect(await evidencias.painel(ESCOLA, ids.turma8A, SEM_FICHA, ATV, ids.prof8A)).toEqual({
      temFicha: false,
      habilidades: [],
      rodadas: [],
      estudantes: [],
      pendentes: {},
    });
  });

  test("gestor (sem professorId) lê o painel e o perfil", async () => {
    expect((await evidencias.painel(ESCOLA, ids.turma8A, INSTA, ATV, undefined)).estudantes).toHaveLength(5);
    expect((await evidencias.perfil(ESCOLA, ids.ana, undefined)).missoes).toHaveLength(1);
  });

  test("professor que não leciona a turma recebe 404 — no painel, na confirmação, no ajuste e no perfil", async () => {
    const naoEncontrada = { status: 404, corpo: { mensagem: "Turma não encontrada." } };
    expect(await recusa(evidencias.painel(ESCOLA, ids.turma8A, INSTA, ATV, ids.prof8B))).toEqual(naoEncontrada);
    expect(await recusa(evidencias.confirmar(ESCOLA, ids.turma8A, INSTA, ATV, 1, ids.prof8B))).toEqual(naoEncontrada);
    expect(
      await recusa(
        evidencias.ajustar(ESCOLA, ids.turma8A, INSTA, ATV, 1, ids.prof8B, [
          { estudanteId: ids.ana, habilidade: H1, status: "atingiu" },
        ]),
      ),
    ).toEqual(naoEncontrada);
    expect(await recusa(evidencias.perfil(ESCOLA, ids.ana, ids.prof8B))).toEqual({
      status: 404,
      corpo: { mensagem: "Estudante não encontrado." },
    });
    /* E turma de outra escola, para o gestor, também. */
    expect((await recusa(evidencias.painel(ESCOLA, ids.turmaVizinha, INSTA, ATV, undefined))).status).toBe(404);
  });
});

describe("o perfil do estudante", () => {
  beforeAll(async () => {
    await zerar();
    await montar(
      [
        [ids.ana, ids.bia],
        [ids.caio, ids.duda, ids.enzo],
      ],
      2,
    );
    await marcar(ids.ana, "h1-acao", "em_processo", { rodada: 1 });
    await marcar(ids.ana, "h1-acao", "atingiu", { rodada: 2 });
    await marcar(ids.ana, "h2-acao", "nao_atingiu", { atividadeId: "atv-2" });
    await ajustar(1, [{ estudanteId: ids.ana, habilidade: H2, status: "nao_participou" }]);
  });

  test("a melhor rodada por habilidade, por atividade — só o que vale, e sem origem", async () => {
    const perfil = PerfilDoEstudanteSchema.parse(await evidencias.perfil(ESCOLA, ids.ana, ids.prof8A));
    const catalogo = await prisma.experiencia.findUnique({
      where: { expId: INSTA },
      select: { nome: true, unidade: true },
    });
    expect(perfil).toEqual({
      estudante: { id: ids.ana, nome: "Ana Clara Souza" },
      missoes: [
        {
          expId: INSTA,
          nome: catalogo?.nome,
          unidade: catalogo?.unidade ?? null,
          ultimaEm: expect.any(String),
          /* A MISSÃO: o melhor entre as atividades, na ordem da ficha (F14.7). */
          habilidades: [
            { codigo: H1, descricao: expect.any(String), status: "atingiu" },
            { codigo: H2, descricao: expect.any(String), status: "nao_atingiu" },
          ],
          /* Na ordem do id da atividade — o `ATV` é um UUID real (ADR-130). */
          atividades: [
            { atividadeId: ATV, habilidades: [{ codigo: H1, descricao: expect.any(String), status: "atingiu" }] },
            { atividadeId: "atv-2", habilidades: [{ codigo: H2, descricao: expect.any(String), status: "nao_atingiu" }] },
          ].sort((a, b) => a.atividadeId.localeCompare(b.atividadeId)),
        },
      ],
    });
    /* `nao_participou` da H2 na atv-1 não aparece; e nenhuma origem vaza. */
    const texto = JSON.stringify(perfil);
    expect(texto).not.toContain("origem");
    expect(texto).not.toContain("nao_participou");
  });

  test("a cópia da equipe VALIDA entra no perfil do colega", async () => {
    const perfil = await evidencias.perfil(ESCOLA, ids.bia, ids.prof8A);
    expect(perfil.missoes[0]?.atividades.find((a) => a.atividadeId === ATV)?.habilidades).toEqual([
      { codigo: H1, descricao: expect.any(String), status: "atingiu" },
    ]);
  });
});

describe("quem pode o quê — o RolesGuard lê exatamente isto", () => {
  const guard = new RolesGuard(new Reflector());

  function passa(classe: { prototype: object }, metodo: string, perfil: Perfil): boolean {
    const handler = (classe.prototype as Record<string, unknown>)[metodo];
    const contextoHttp = {
      getHandler: () => handler,
      getClass: () => classe,
      switchToHttp: () => ({ getRequest: () => ({ auth: { perfil, usuarioId: "x", escolaId: ESCOLA } }) }),
    } as unknown as ExecutionContext;
    try {
      return guard.canActivate(contextoHttp);
    } catch (e) {
      if (e instanceof ForbiddenException) return false;
      throw e;
    }
  }

  test("gestor LÊ o painel e o perfil, e recebe 403 no POST de confirmar e no PATCH de ajustes", () => {
    for (const gestor of ["gestor_escola", "gestor_regional", "gestor_contrato", "admin"] as const) {
      expect(passa(EvidenciasProfessorController, "painel", gestor)).toBe(true);
      expect(passa(EvidenciasProfessorController, "perfil", gestor)).toBe(true);
      expect(passa(EvidenciasProfessorController, "confirmar", gestor)).toBe(false);
      expect(passa(EvidenciasProfessorController, "ajustar", gestor)).toBe(false);
    }
  });

  test("o professor faz tudo do lado dele; o estudante não entra em nenhuma rota do professor", () => {
    for (const metodo of ["painel", "perfil", "confirmar", "ajustar"]) {
      expect(passa(EvidenciasProfessorController, metodo, "professor")).toBe(true);
      expect(passa(EvidenciasProfessorController, metodo, "estudante")).toBe(false);
    }
  });

  test("a pergunta e a resposta são SÓ do estudante", () => {
    for (const metodo of ["pergunta", "responder"]) {
      expect(passa(EvidenciasEstudanteController, metodo, "estudante")).toBe(true);
      expect(passa(EvidenciasEstudanteController, metodo, "professor")).toBe(false);
      expect(passa(EvidenciasEstudanteController, metodo, "gestor_escola")).toBe(false);
    }
  });
});
