import { PrismaClient } from "@prisma/client";
import { MockProvider } from "../src/ai/mock.provider";
import { RunsController } from "../src/motor/runs.controller";
import { exigirMissaoLiberada, MISSAO_NAO_LIBERADA } from "../src/comum/liberacao";
import { PrismaService } from "../src/prisma/prisma.service";
import { SalasService } from "../src/salas/salas.service";
import { comEscolaNoContexto } from "../src/tenancy/tenancy-context";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * A SALA DE AULA no Postgres (ADR-69): a grade, o liberar/encerrar e — o que
 * mais importa — a PORTA.
 *
 * A porta é o ponto do desenho inteiro: filtrar o card no hub é UX, e
 * `/exp/:expId` é endereço adivinhável. Antes disto, qualquer estudante logado
 * abria qualquer missão digitando a URL.
 *
 * UMA ESCOLA POR SUÍTE — o Jest paraleliza, e limpeza compartilhada corromperia
 * a vizinha.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-salas";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const salas = new SalasService(prisma);

const INSTA = "exp-01-instanooria";
const VILA = "exp-70-vila-do-lume";
const TUBE = "exp-02-unootube";
const PLANO = "exp-90-plano-de-aula";

const ids = { turma8A: "", turma8B: "", prof8A: "", prof8B: "", ana: "", bruno: "" };

async function limpar() {
  await prisma.liberacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola das salas" } });

  ids.turma8A = (await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF")).id;
  ids.turma8B = (await criarTurmaDeTeste(prisma, ESCOLA, "8B", "8EF")).id;

  const pessoa = async (username: string, role: string, turmaId?: string) =>
    (
      await prisma.user.create({
        data: { escolaId: ESCOLA, username, role, displayName: username, passwordHash: "x", turmaId },
      })
    ).id;

  ids.prof8A = await pessoa("salas-prof-8a", "professor");
  ids.prof8B = await pessoa("salas-prof-8b", "professor");
  ids.ana = await pessoa("salas-ana-8a", "estudante", ids.turma8A);
  ids.bruno = await pessoa("salas-bruno-8b", "estudante", ids.turma8B);

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
  await matricular(ids.turma8B, ids.prof8B, "professor");
  await matricular(ids.turma8A, ids.ana, "estudante");
  await matricular(ids.turma8B, ids.bruno, "estudante");

  /* O catálogo é global (sem `escola_id`): o `upsert` não colide com outra suíte
     porque escreve exatamente o mesmo conteúdo. */
  for (const [expId, series, publico] of [
    [INSTA, ["8EF"], "estudante"],
    [VILA, [], "estudante"],
    [TUBE, ["4EF"], "estudante"],
    [PLANO, [], "professor"],
  ] as const) {
    const dados = { nome: expId, versaoAtiva: "1.0.0", series: [...series], publico };
    await prisma.experiencia.upsert({
      where: { expId },
      update: dados,
      create: { expId, ...dados },
    });
  }
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

const porta = (estudanteId: string, expId: string) =>
  prisma.comTenancy((tx) => exigirMissaoLiberada(tx, ESCOLA, estudanteId, expId), ESCOLA);

describe("a porta da sala", () => {
  test("sem liberação, a missão NÃO abre — nem a da série da criança", async () => {
    await expect(porta(ids.ana, INSTA)).rejects.toMatchObject({
      response: { codigo: MISSAO_NAO_LIBERADA },
    });
  });

  test("liberada na turma dela, abre", async () => {
    await salas.definirEstado(ESCOLA, ids.turma8A, INSTA, "liberada", ids.prof8A);
    await expect(porta(ids.ana, INSTA)).resolves.toBeUndefined();
  });

  test("liberar na 8A NÃO abre para a 8B — é a sala, não a série", async () => {
    await expect(porta(ids.bruno, INSTA)).rejects.toMatchObject({
      response: { codigo: MISSAO_NAO_LIBERADA },
    });
  });

  test("ENCERRADA fecha a porta, e o dado da criança não é tocado", async () => {
    await salas.definirEstado(ESCOLA, ids.turma8A, INSTA, "encerrada", ids.prof8A);
    await expect(porta(ids.ana, INSTA)).rejects.toMatchObject({
      response: { codigo: MISSAO_NAO_LIBERADA },
    });

    const linha = await prisma.liberacao.findFirst({
      where: { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA },
    });
    expect(linha?.encerradaEm).not.toBeNull();
  });

  test("reliberar reabre e LIMPA a data de encerramento", async () => {
    await salas.definirEstado(ESCOLA, ids.turma8A, INSTA, "liberada", ids.prof8A);
    await expect(porta(ids.ana, INSTA)).resolves.toBeUndefined();

    const linha = await prisma.liberacao.findFirst({
      where: { escolaId: ESCOLA, turmaId: ids.turma8A, expId: INSTA },
    });
    expect(linha?.encerradaEm).toBeNull();
  });

  test("estudante SEM turma não tem sala, logo não tem missão", async () => {
    const solto = await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "salas-sem-turma",
        role: "estudante",
        displayName: "solto",
        passwordHash: "x",
      },
    });
    await expect(porta(solto.id, INSTA)).rejects.toMatchObject({
      response: { codigo: MISSAO_NAO_LIBERADA },
    });
  });
});

/**
 * A exp-01 é a única cujas entradas ficam no CONTROLLER, não no service — e
 * nenhuma outra suíte a exercita por ali (as do motor chamam o engine direto).
 * Sem este teste, apagar a guarda de `POST /runs` não quebraria nada.
 */
describe("a porta da exp-01, pelo controller", () => {
  const runs = new RunsController(prisma, new MockProvider());
  const req = (usuarioId: string) =>
    ({ auth: { usuarioId, escolaId: ESCOLA, perfil: "estudante" as const } }) as never;

  /* O controller chama `comTenancy` SEM escola explícita: em produção quem a põe
     no AsyncLocalStorage é o `TenancyInterceptor`, que aqui não existe. É o
     mesmo `comEscolaNoContexto` que o seed e o worker usam. Sem ele o erro é
     "comTenancy sem escola", que não tem nada a ver com liberação. */
  const noContexto = <T>(fn: () => Promise<T>) => comEscolaNoContexto(ESCOLA, fn);

  test("POST /runs recusa quem não tem a missão liberada", async () => {
    await expect(noContexto(() => runs.criar({}, req(ids.bruno)))).rejects.toMatchObject({
      response: { codigo: MISSAO_NAO_LIBERADA },
    });
  });

  test("GET /runs/boot recusa igual — o primeiro fetch do aparelho não é exceção", async () => {
    await expect(noContexto(() => runs.boot(req(ids.bruno)))).rejects.toMatchObject({
      response: { codigo: MISSAO_NAO_LIBERADA },
    });
  });
});

describe("liberar e encerrar", () => {
  test("é idempotente: dois cliques do professor nervoso dão no mesmo", async () => {
    const um = await salas.definirEstado(ESCOLA, ids.turma8B, VILA, "liberada", ids.prof8B);
    const dois = await salas.definirEstado(ESCOLA, ids.turma8B, VILA, "liberada", ids.prof8B);
    expect(dois.estado).toBe(um.estado);

    const linhas = await prisma.liberacao.findMany({
      where: { escolaId: ESCOLA, turmaId: ids.turma8B, expId: VILA },
    });
    expect(linhas).toHaveLength(1);
  });

  test("professor de outra turma NÃO libera — e a resposta não confirma a turma", async () => {
    await expect(
      salas.definirEstado(ESCOLA, ids.turma8A, VILA, "liberada", ids.prof8B),
    ).rejects.toMatchObject({ status: 404 });
  });

  test("ferramenta de professor é recusada: seria um botão que não abre nada", async () => {
    await expect(
      salas.definirEstado(ESCOLA, ids.turma8A, PLANO, "liberada", ids.prof8A),
    ).rejects.toMatchObject({ status: 403 });
  });

  test("experiência fora do catálogo é recusada, com a causa dita", async () => {
    await expect(
      salas.definirEstado(ESCOLA, ids.turma8A, "exp-99-inexistente", "liberada", ids.prof8A),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("a sala do professor", () => {
  test("traz a grade da série + transversais, com quem liberou", async () => {
    const sala = await salas.daTurma(ESCOLA, ids.turma8A, ids.prof8A);
    expect(sala.turma.nome).toBe("8A");

    const ids8A = sala.missoes.map((m) => m.expId);
    expect(ids8A).toEqual([VILA, INSTA]);
    expect(ids8A).not.toContain(TUBE);

    const insta = sala.missoes.find((m) => m.expId === INSTA);
    expect(insta?.estado).toBe("liberada");
    expect(insta?.liberadaPor).toBe("salas-prof-8a");
  });

  test("`todas` acrescenta as de outra série", async () => {
    const sala = await salas.daTurma(ESCOLA, ids.turma8A, ids.prof8A, true);
    const tube = sala.missoes.find((m) => m.expId === TUBE);
    expect(tube?.deOutraSerie).toBe(true);
  });

  test("turma do colega responde 404, não 403", async () => {
    await expect(salas.daTurma(ESCOLA, ids.turma8A, ids.prof8B)).rejects.toMatchObject({
      status: 404,
    });
  });

  test("gestor (sem professorId) lê a sala inteira", async () => {
    const sala = await salas.daTurma(ESCOLA, ids.turma8A, undefined);
    expect(sala.turma.nome).toBe("8A");
  });
});

describe("as salas do estudante", () => {
  test("devolve a grade INTEIRA da turma, com a bloqueada junto", async () => {
    const { salas: minhas } = await salas.minhas(ESCOLA, ids.bruno);
    expect(minhas).toHaveLength(1);
    expect(minhas[0]?.turma.nome).toBe("8B");

    const porId = new Map(minhas[0]?.missoes.map((m) => [m.expId, m.estado]));
    expect(porId.get(VILA)).toBe("liberada");
    /* O cadeado: a missão continua na lista. É a promessa do que vem depois, e
       uma lista que muda de tamanho sozinha não deixa ninguém entender isso. */
    expect(porId.get(INSTA)).toBe("bloqueada");
  });

  test("estudante sem turma volta sem sala — e a tela é que explica", async () => {
    const solto = await prisma.user.findFirst({
      where: { escolaId: ESCOLA, username: "salas-sem-turma" },
    });
    const { salas: minhas } = await salas.minhas(ESCOLA, solto!.id);
    expect(minhas).toEqual([]);
  });
});
