import { AtividadesController } from "../src/atividades/atividades.controller";
import type { AssetsService } from "../src/assets/assets.service";
import { ENGINE_CONFIG_DEFAULT, PROPORCOES_DEFAULT } from "../src/comum/insta/defaults";
import { comEscolaNoContexto } from "../src/tenancy/tenancy-context";
import { prisma } from "./motor-fixture-db";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * UMA ATIVIDADE EM ANDAMENTO POR TURMA no Instanooria (ADR-130).
 *
 * Era uma por PROFESSOR: ativar a atividade do 8B encerrava a do 8A, e o
 * professor das duas turmas não conseguia rodá-las juntas. Agora ativar encerra
 * a ativa da MESMA turma — de qualquer professor dela, para a sala nunca ter
 * duas —, e a atividade encerrada volta ao ar pelo mesmo botão. A atividade
 * antiga sem turma vale para a escola inteira e mantém a regra de antes.
 */

const ESCOLA = "teste-ativar-por-turma";
const assetsFalso = {} as AssetsService;
const controller = new AtividadesController(prisma, assetsFalso);

const ids = { professor: "", colega: "", turma8A: "", turma8B: "" };

async function limpar() {
  await prisma.activity.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

async function atividade(turmaId: string | null, status: string, professorId = ids.professor): Promise<string> {
  const linha = await prisma.activity.create({
    data: {
      escolaId: ESCOLA,
      professorId,
      turmaId,
      titulo: "Atividade de teste",
      disciplina: "História",
      temaGeral: "tema",
      recorte: "recorte",
      perguntaChave: "pergunta?",
      estiloVisual: "fotografico",
      proporcoes: PROPORCOES_DEFAULT,
      engineConfig: ENGINE_CONFIG_DEFAULT,
      status,
    },
    select: { id: true },
  });
  return linha.id;
}

/** `forcar`: sem posts gerados a matriz é toda pendência — a regra testada é a do encerramento. */
const ativar = (id: string, professorId = ids.professor) =>
  comEscolaNoContexto(ESCOLA, () =>
    controller.ativar(id, { forcar: true }, {
      auth: { usuarioId: professorId, escolaId: ESCOLA, perfil: "professor" },
    } as never),
  );

const statusDe = async (id: string) =>
  (await prisma.activity.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do ativar por turma (teste)" } });
  const pessoa = async (username: string) =>
    (
      await prisma.user.create({
        data: { escolaId: ESCOLA, username, role: "professor", displayName: username, passwordHash: "x" },
        select: { id: true },
      })
    ).id;
  ids.professor = await pessoa("ativar-prof");
  ids.colega = await pessoa("ativar-colega");
  ids.turma8A = (await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF")).id;
  ids.turma8B = (await criarTurmaDeTeste(prisma, ESCOLA, "8B", "8EF")).id;
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.activity.deleteMany({ where: { escolaId: ESCOLA } });
});

test("o 8A e o 8B do mesmo professor rodam juntos: ativar uma turma não encerra a outra", async () => {
  const do8A = await atividade(ids.turma8A, "ativa");
  const do8B = await atividade(ids.turma8B, "revisao");
  await ativar(do8B);
  expect(await statusDe(do8A)).toBe("ativa");
  expect(await statusDe(do8B)).toBe("ativa");
});

test("na MESMA turma, ativar a outra encerra a de agora — e a encerrada volta ao ar pelo mesmo botão", async () => {
  const primeira = await atividade(ids.turma8A, "ativa");
  const segunda = await atividade(ids.turma8A, "revisao");
  await ativar(segunda);
  expect(await statusDe(primeira)).toBe("encerrada");
  expect(await statusDe(segunda)).toBe("ativa");

  await ativar(primeira);
  expect(await statusDe(primeira)).toBe("ativa");
  expect(await statusDe(segunda)).toBe("encerrada");
});

test("a sala nunca tem duas: a ativa de OUTRO professor da mesma turma também sai", async () => {
  const daColega = await atividade(ids.turma8A, "ativa", ids.colega);
  const minha = await atividade(ids.turma8A, "revisao");
  await ativar(minha);
  expect(await statusDe(daColega)).toBe("encerrada");
});

test("a antiga SEM turma vale para a escola inteira, e mantém a regra de antes: encerra as do professor", async () => {
  const do8A = await atividade(ids.turma8A, "ativa");
  const daColega = await atividade(ids.turma8B, "ativa", ids.colega);
  const semTurma = await atividade(null, "revisao");
  await ativar(semTurma);
  expect(await statusDe(do8A)).toBe("encerrada");
  expect(await statusDe(daColega)).toBe("ativa");
  expect(await statusDe(semTurma)).toBe("ativa");
});
