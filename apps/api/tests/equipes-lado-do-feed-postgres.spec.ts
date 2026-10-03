import { PrismaClient } from "@prisma/client";

import { EquipesService } from "../src/equipes/equipes.service";
import { SugestaoSchema } from "../src/equipes/contrato-de-rotas";
import { ladosDaTurma } from "../src/perfis/distribuicao";
import { FonteDeLadoDoUnoovista } from "../src/perfis/fonte-de-lado";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O SORTEIO DE EQUIPES DO UNOOVISTA junta quem está do MESMO lado do feed
 * (H13.4.1). O módulo de equipes não sabe de lado nenhum: é a fonte que o
 * módulo de perfis registra na subida que diz o lado de cada criança — e é o
 * caminho inteiro, fonte registrada + sorteio, que esta suíte percorre.
 *
 * UMA ESCOLA POR SUÍTE: o Jest paraleliza, e limpeza compartilhada corromperia
 * a outra.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-equipes-lado";
const UNOOVISTA = "exp08ef1b";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

let turmaId = "";
let professorId = "";
let activityId = "";
const estudantes: Record<string, string> = {};

async function limpar() {
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.run.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.perfilImportado.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.activity.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do lado do feed (teste)" } });
  turmaId = (await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF")).id;

  professorId = (
    await prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA, username: "lado.prof", displayName: "Prof Lado", passwordHash: "x" },
      select: { id: true },
    })
  ).id;
  await prisma.matricula.create({
    data: { escolaId: ESCOLA, turmaId, usuarioId: professorId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
  });

  for (const nome of ["ana", "bia", "caio", "duda", "eli"]) {
    estudantes[nome] = (
      await prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA, turmaId, username: `lado.${nome}`, displayName: nome, passwordHash: "x" },
        select: { id: true },
      })
    ).id;
  }

  activityId = (
    await prisma.activity.create({
      data: {
        escolaId: ESCOLA, professorId, turmaId,
        titulo: "T", disciplina: "D", temaGeral: "TG", recorte: "R",
        perguntaChave: "PC", estiloVisual: "EV", proporcoes: {}, engineConfig: {},
      },
      select: { id: true },
    })
  ).id;

  /* Dois de cada lado, pelo lado FORÇADO (o professor redistribuiu): é o nível
     da precedência que não depende da pergunta aprovada. A Eli não tem perfil:
     é a NEUTRA, que o sorteio usa para completar. */
  const forcar = (estudanteId: string, lado: "A" | "B") =>
    prisma.perfilImportado.create({
      data: { escolaId: ESCOLA, activityId, estudanteId, escores: {}, dominante: "misto", origem: "professor", ladoForcado: lado, medidoEm: new Date() },
    });
  await forcar(estudantes.ana!, "A");
  await forcar(estudantes.bia!, "A");
  await forcar(estudantes.caio!, "B");
  await forcar(estudantes.duda!, "B");
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("o lado do feed de cada estudante", () => {
  test("o forçado vale; sem perfil é neutro", async () => {
    const { lados, temAfinidade } = await ladosDaTurma(prisma, activityId, null, ESCOLA, turmaId);
    expect(temAfinidade).toBe(false);
    expect(lados.get(estudantes.ana!)).toBe("A");
    expect(lados.get(estudantes.caio!)).toBe("B");
    expect(lados.get(estudantes.eli!)).toBeNull();
    expect(lados.size).toBe(5);
  });
});

describe("o sorteio com a fonte do Unoovista registrada (H13.4.1)", () => {
  const equipes = new EquipesService(prisma);
  new FonteDeLadoDoUnoovista(equipes).onModuleInit();
  const alvo = () => ({ escolaId: ESCOLA, turmaId, expId: UNOOVISTA, atividadeId: activityId });

  test("cada equipe fica de um lado só, e a neutra completa", async () => {
    const r = SugestaoSchema.parse(
      await equipes.sugerir(alvo(), { modo: "sorteio", computadores: 2, ausentes: [] }, professorId),
    );
    expect(r.equipes.map((e) => e.grupo).sort()).toEqual(["A", "B"]);
    expect(r.equipes.every((e) => !e.mista)).toBe(true);
    for (const equipe of r.equipes) {
      const lados = equipe.membros
        .map((m) => m.id)
        .filter((id) => id !== estudantes.eli)
        .map((id) => (id === estudantes.ana || id === estudantes.bia ? "A" : "B"));
      expect(new Set(lados).size).toBe(1);
    }
    expect(r.agrupamento).toMatchObject({ comGrupo: 4, neutros: 1, equipesMistas: 0 });
    /* Sem a pergunta aprovada, a tela avisa que só os de lado definido se agrupam. */
    expect(r.agrupamento?.aviso).toMatch(/não foram aprovados/);
  });

  test("quando a conta não fecha, a tela diz quantas ficaram mistas", async () => {
    // Um computador só: os quatro com lado caem juntos, e a equipe é mista.
    const r = await equipes.sugerir(alvo(), { modo: "sorteio", computadores: 1, ausentes: [] }, professorId);
    expect(r.agrupamento?.equipesMistas).toBe(1);
  });
});
