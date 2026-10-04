import { ForbiddenException, NotFoundException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PrismaClient } from "@prisma/client";
import type { AuthClaims, Perfil } from "../src/auth/claims";
import { RolesGuard } from "../src/auth/roles";
import { EquipesService } from "../src/equipes/equipes.service";
import {
  EscolaConsolidadaSchema,
  PerfilDoEstudanteSchema,
  RedeConsolidadaSchema,
  TurmaConsolidadaSchema,
} from "../src/evidencias/contrato-de-rotas";
import { EvidenciasConsolidadoController } from "../src/evidencias/evidencias-consolidado.controller";
import { EvidenciasConsolidadoService } from "../src/evidencias/evidencias-consolidado.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { EscolasService } from "../src/rostering/escolas.service";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O PAINEL DE HABILIDADES (F14.7) no Postgres: a turma, a escola e a rede,
 * com a ficha REAL da exp05ef1b (EF05CO08, EF05CO03, EF05CO04).
 *
 * Duas regionais, três escolas: a regional da suíte tem a escola principal e
 * uma irmã; a outra regional tem a vizinha. É o que prova a porta do
 * `gestor_regional` — a irmã abre, a vizinha não.
 *
 * As evidências são gravadas DIRETO (o superusuário passa pela RLS): o que se
 * prova aqui é a leitura, não a marca — a marca tem a suíte dela.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const REGIONAL = "teste-cons-de";
const OUTRA_REGIONAL = "teste-cons-de2";
const ESCOLA = "teste-cons-a";
const IRMA = "teste-cons-b";
const VIZINHA = "teste-cons-c";
const ESCOLAS = [ESCOLA, IRMA, VIZINHA];
const MISSAO = "exp05ef1b";
/** Dentro do "Ano letivo 2026" de `turma-de-teste.ts` — o painel lê só o ano vigente. */
const AGORA = new Date(Date.UTC(2026, 5, 1));

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const evidencias = new EvidenciasService(prisma, new EquipesService(prisma));
const escolas = new EscolasService(prisma);
const consolidado = new EvidenciasConsolidadoService(prisma, evidencias, escolas);

const ids: Record<string, string> = {};
/** A linha do catálogo, se a suíte precisou criá-la (banco recém-migrado, sem seed). */
let criouOCatalogo = false;

async function limpar() {
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.matricula.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.user.deleteMany({
    where: { OR: [{ escolaId: { in: ESCOLAS } }, { regionalId: { in: [REGIONAL, OUTRA_REGIONAL] } }] },
  });
  await prisma.turma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.escola.deleteMany({ where: { id: { in: ESCOLAS } } });
  await prisma.escola.deleteMany({ where: { id: { in: [REGIONAL, OUTRA_REGIONAL] } } });
}

async function estudante(escolaId: string, turmaId: string, nome: string) {
  const u = await prisma.user.create({
    data: { role: "estudante", escolaId, turmaId, username: `cons.${nome}`, displayName: nome, passwordHash: "x" },
    select: { id: true },
  });
  ids[nome] = u.id;
  return u.id;
}

/** Uma evidência válida, de origem própria — ou o "Não participou" do professor. */
function evidencia(
  escolaId: string,
  turmaId: string,
  estudanteId: string,
  atividadeId: string,
  habilidade: string,
  status: "atingiu" | "em_processo" | "nao_atingiu" | "nao_participou",
) {
  const doProfessor = status === "nao_participou";
  return prisma.evidencia.create({
    data: {
      escolaId,
      turmaId,
      expId: MISSAO,
      atividadeId,
      rodada: 1,
      estudanteId,
      habilidade,
      status,
      origem: doProfessor ? "professor" : "propria",
      situacao: "valida",
      ...(doProfessor ? { editadoPor: ids.prof5A } : {}),
    },
  });
}

const regional = (): AuthClaims => ({ usuarioId: ids.regional!, escolaId: ESCOLA, perfil: "gestor_regional" });
const coordenacao = (): AuthClaims => ({ usuarioId: "coord", escolaId: ESCOLA, perfil: "gestor_escola" });

beforeAll(async () => {
  await limpar();
  if (!(await prisma.experiencia.findUnique({ where: { expId: MISSAO } }))) {
    await prisma.experiencia.create({
      data: { expId: MISSAO, nome: "Quem Mandou Isso?", versaoAtiva: "0.0.0", series: ["5EF"], unidade: 1 },
    });
    criouOCatalogo = true;
  }

  await prisma.escola.create({ data: { id: REGIONAL, nome: "DE do painel (teste)", tipo: "regional" } });
  await prisma.escola.create({ data: { id: OUTRA_REGIONAL, nome: "DE vizinha (teste)", tipo: "regional" } });
  await prisma.escola.create({ data: { id: ESCOLA, nome: "EE Alfa (teste)", paiId: REGIONAL } });
  await prisma.escola.create({ data: { id: IRMA, nome: "EE Beta (teste)", paiId: REGIONAL } });
  await prisma.escola.create({ data: { id: VIZINHA, nome: "EE Gama (teste)", paiId: OUTRA_REGIONAL } });

  ids.t5A = (await criarTurmaDeTeste(prisma, ESCOLA, "5A", "5EF")).id;
  ids.t5B = (await criarTurmaDeTeste(prisma, ESCOLA, "5B", "5EF")).id;
  ids.t5C = (await criarTurmaDeTeste(prisma, IRMA, "5C", "5EF")).id;
  ids.t5D = (await criarTurmaDeTeste(prisma, VIZINHA, "5D", "5EF")).id;

  ids.prof5A = (
    await prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA, username: "cons.prof5a", displayName: "Prof 5A", passwordHash: "x" },
      select: { id: true },
    })
  ).id;
  await prisma.matricula.create({
    data: {
      escolaId: ESCOLA,
      turmaId: ids.t5A,
      usuarioId: ids.prof5A,
      papel: "professor",
      principal: false,
      inicio: new Date(Date.UTC(2026, 0, 1)),
    },
  });
  ids.regional = (
    await prisma.user.create({
      data: {
        role: "gestor_regional",
        regionalId: REGIONAL,
        username: "cons.regional",
        displayName: "Supervisão (teste)",
        passwordHash: "x",
      },
      select: { id: true },
    })
  ).id;

  // 5A: quatro crianças. A Ana fez DUAS atividades da missão.
  for (const nome of ["duda", "ana", "caio", "bia"]) await estudante(ESCOLA, ids.t5A, nome);
  // 5B: ninguém fez a missão ainda.
  for (const nome of ["eli", "fabi"]) await estudante(ESCOLA, ids.t5B, nome);
  await estudante(IRMA, ids.t5C, "gabi");
  await estudante(VIZINHA, ids.t5D, "hugo");

  await evidencia(ESCOLA, ids.t5A, ids.ana!, "atv-1", "EF05CO08", "nao_atingiu");
  await evidencia(ESCOLA, ids.t5A, ids.ana!, "atv-2", "EF05CO08", "atingiu");
  await evidencia(ESCOLA, ids.t5A, ids.ana!, "atv-1", "EF05CO03", "em_processo");
  await evidencia(ESCOLA, ids.t5A, ids.bia!, "atv-1", "EF05CO08", "em_processo");
  await evidencia(ESCOLA, ids.t5A, ids.caio!, "atv-1", "EF05CO08", "nao_participou");
  await evidencia(IRMA, ids.t5C, ids.gabi!, "atv-1", "EF05CO08", "atingiu");
  await evidencia(VIZINHA, ids.t5D, ids.hugo!, "atv-1", "EF05CO08", "atingiu");
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  if (criouOCatalogo) await prisma.experiencia.delete({ where: { expId: MISSAO } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("o painel da turma (H14.7.1)", () => {
  test("cada criança da turma numa caixa; a missão vale o melhor entre as atividades", async () => {
    const painel = TurmaConsolidadaSchema.parse(await consolidado.daTurma(ESCOLA, ids.t5A!));
    const missao = painel.missoes.find((m) => m.expId === MISSAO)!;
    expect(missao).toMatchObject({ aplicada: true, unidade: 1 });
    expect(missao.habilidades.map((h) => h.codigo)).toEqual(["EF05CO08", "EF05CO03", "EF05CO04"]);

    // Ana atingiu (melhor de duas atividades), Bia em processo; Caio "Não participou" e Duda sem nada.
    expect(missao.habilidades[0]!.distribuicao).toEqual({
      atingiu: 1,
      emProcesso: 1,
      naoAtingiu: 0,
      naoAvaliado: 2,
      total: 4,
    });
    // Habilidade que ninguém fez: a turma inteira "não avaliado", nunca "não atingiu".
    expect(missao.habilidades[2]!.distribuicao).toMatchObject({ naoAtingiu: 0, naoAvaliado: 4 });
  });

  test("a lista do drill-down é alfabética, e nunca um ranking", async () => {
    const painel = await consolidado.daTurma(ESCOLA, ids.t5A!);
    expect(painel.estudantes.map((e) => e.nome)).toEqual(["ana", "bia", "caio", "duda"]);
  });

  test("o professor lê a turma em que leciona; a que não leciona é 404", async () => {
    await expect(consolidado.daTurma(ESCOLA, ids.t5A!, ids.prof5A)).resolves.toBeTruthy();
    await expect(consolidado.daTurma(ESCOLA, ids.t5B!, ids.prof5A)).rejects.toBeInstanceOf(NotFoundException);
  });

  test("turma que ainda não fez a missão: aparece sem aplicar, com todos 'não avaliado'", async () => {
    const painel = await consolidado.daTurma(ESCOLA, ids.t5B!);
    const missao = painel.missoes.find((m) => m.expId === MISSAO)!;
    expect(missao.aplicada).toBe(false);
    expect(missao.habilidades[0]!.distribuicao).toMatchObject({ naoAvaliado: 2, total: 2 });
  });
});

describe("o painel da escola (H14.7.2)", () => {
  test("as turmas do ano vigente, por série e nome, com a distribuição de cada uma", async () => {
    const painel = EscolaConsolidadaSchema.parse(await consolidado.daEscola(ESCOLA, AGORA));
    expect(painel.escola.id).toBe(ESCOLA);
    expect(painel.turmas.map((t) => t.nome)).toEqual(["5A", "5B"]);
    const [a, b] = painel.turmas;
    expect(a!.estudantes).toBe(4);
    expect(a!.missoes.find((m) => m.expId === MISSAO)!.habilidades[0]!.distribuicao.atingiu).toBe(1);
    expect(b!.missoes.find((m) => m.expId === MISSAO)!.aplicada).toBe(false);
    // Nada de outra escola entra: a RLS armada nesta escola é a tranca.
    expect(painel.turmas.some((t) => t.id === ids.t5C)).toBe(false);
  });
});

describe("o painel da rede (H14.7.3)", () => {
  test("a regional lê as escolas DELA, por nome, somadas por série", async () => {
    const painel = RedeConsolidadaSchema.parse(await consolidado.daRede(regional(), undefined, AGORA));
    expect(painel.regional?.id).toBe(REGIONAL);
    expect(painel.escolas.map((e) => e.id)).toEqual([ESCOLA, IRMA]);

    const quinto = painel.escolas[0]!.series.find((s) => s.serie === "5EF")!;
    expect(quinto).toMatchObject({ turmas: 2, estudantes: 6 });
    const missao = quinto.missoes.find((m) => m.expId === MISSAO)!;
    expect(missao.turmasAplicadas).toBe(1);
    // A 5B, que não aplicou, entra como "não avaliado": 2 da 5A + 2 da 5B.
    expect(missao.habilidades.find((h) => h.codigo === "EF05CO08")!.distribuicao).toEqual({
      atingiu: 1,
      emProcesso: 1,
      naoAtingiu: 0,
      naoAvaliado: 4,
      total: 6,
    });
  });

  test("o ?regionalId= da regional é IGNORADO: pedir a vizinha devolve a dela", async () => {
    const painel = await consolidado.daRede(regional(), OUTRA_REGIONAL, AGORA);
    expect(painel.regional?.id).toBe(REGIONAL);
    expect(painel.escolas.map((e) => e.id)).not.toContain(VIZINHA);
  });

  test("o perfil de contrato escolhe a regional", async () => {
    const contrato: AuthClaims = { usuarioId: "contrato", escolaId: "", perfil: "gestor_contrato" };
    const painel = await consolidado.daRede(contrato, OUTRA_REGIONAL, AGORA);
    expect(painel.escolas.map((e) => e.id)).toEqual([VIZINHA]);
  });
});

describe("a porta da regional (escolaDaConsulta)", () => {
  test("a regional abre qualquer escola DELA, e só ela", async () => {
    await expect(consolidado.escolaDaConsulta(regional(), IRMA)).resolves.toBe(IRMA);
    await expect(consolidado.escolaDaConsulta(regional(), VIZINHA)).rejects.toBeInstanceOf(ForbiddenException);
  });

  test("a coordenação da escola continua presa à própria", async () => {
    await expect(consolidado.escolaDaConsulta(coordenacao())).resolves.toBe(ESCOLA);
    await expect(consolidado.escolaDaConsulta(coordenacao(), IRMA)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("o perfil do estudante por missão (H14.7.4)", () => {
  test("o melhor entre as atividades, e a habilidade sem nível é 'Não avaliado' (null)", async () => {
    const perfil = PerfilDoEstudanteSchema.parse(await evidencias.perfil(ESCOLA, ids.ana!));
    const missao = perfil.missoes.find((m) => m.expId === MISSAO)!;
    expect(missao.unidade).toBe(1);
    expect(missao.habilidades).toEqual([
      expect.objectContaining({ codigo: "EF05CO08", status: "atingiu" }),
      expect.objectContaining({ codigo: "EF05CO03", status: "em_processo" }),
      expect.objectContaining({ codigo: "EF05CO04", status: null }),
    ]);
    // E embaixo, cada atividade com o que ela mediu.
    expect(missao.atividades.map((a) => a.atividadeId).sort()).toEqual(["atv-1", "atv-2"]);
  });
});

describe("quem chega em cada altura — o RolesGuard lê exatamente isto", () => {
  const guard = new RolesGuard(new Reflector());

  function passa(metodo: string, perfil: Perfil): boolean {
    const classe = EvidenciasConsolidadoController;
    const handler = (classe.prototype as unknown as Record<string, unknown>)[metodo];
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

  test("a turma: professor e os quatro papéis de gestão; o estudante, nunca", () => {
    for (const p of ["professor", "gestor_escola", "gestor_regional", "gestor_contrato", "admin"] as const) {
      expect(passa("turma", p)).toBe(true);
    }
    expect(passa("turma", "estudante")).toBe(false);
  });

  test("a escola: só a gestão — o professor lê a turma dele", () => {
    expect(passa("escola", "professor")).toBe(false);
    expect(passa("escola", "estudante")).toBe(false);
    for (const p of ["gestor_escola", "gestor_regional", "gestor_contrato", "admin"] as const) {
      expect(passa("escola", p)).toBe(true);
    }
  });

  test("a rede: a regional e os perfis de contrato; a coordenação de UMA escola não", () => {
    for (const p of ["gestor_regional", "gestor_contrato", "admin"] as const) expect(passa("rede", p)).toBe(true);
    for (const p of ["gestor_escola", "professor", "estudante"] as const) expect(passa("rede", p)).toBe(false);
  });
});
