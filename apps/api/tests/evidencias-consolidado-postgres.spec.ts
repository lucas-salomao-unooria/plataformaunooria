import { BadRequestException, ForbiddenException, NotFoundException, type ExecutionContext } from "@nestjs/common";
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
import {
  EvidenciasConsolidadoService,
  juntarSeries,
  type SerieSomada,
} from "../src/evidencias/evidencias-consolidado.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { FICHA_EXP05EF1B } from "../src/evidencias/fichas/exp05ef1b";
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
const contrato = (): AuthClaims => ({ usuarioId: "contrato", escolaId: "", perfil: "gestor_contrato" });

/** A distribuição de uma habilidade numa lista de séries somadas. */
function daHabilidade(series: readonly SerieSomada[], serie: string, codigo: string) {
  return series
    .find((s) => s.serie === serie)
    ?.missoes.find((m) => m.expId === MISSAO)
    ?.habilidades.find((h) => h.codigo === codigo)?.distribuicao;
}

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
      emProcessoLimitado: 0,
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

  test("o TOPO é a escola inteira: a soma das turmas, com a que não aplicou como 'não avaliado'", async () => {
    const painel = EscolaConsolidadaSchema.parse(await consolidado.daEscola(ESCOLA, AGORA));
    const quinto = painel.total.find((s) => s.serie === "5EF")!;
    expect(quinto).toMatchObject({ turmas: 2, estudantes: 6 });
    expect(quinto.missoes.find((m) => m.expId === MISSAO)!.turmasAplicadas).toBe(1);
    expect(daHabilidade(painel.total, "5EF", "EF05CO08")).toEqual({
      atingiu: 1,
      emProcesso: 1,
      emProcessoLimitado: 0,
      naoAtingiu: 0,
      naoAvaliado: 4,
      total: 6,
    });
    // A veracidade: o topo é EXATAMENTE a soma das linhas que a tela mostra embaixo.
    for (const codigo of ["EF05CO08", "EF05CO03", "EF05CO04"]) {
      const soma = painel.turmas
        .map((t) => t.missoes.find((m) => m.expId === MISSAO)!.habilidades.find((h) => h.codigo === codigo)!.distribuicao)
        .reduce((a, b) => ({
          atingiu: a.atingiu + b.atingiu,
          emProcesso: a.emProcesso + b.emProcesso,
          emProcessoLimitado: a.emProcessoLimitado + b.emProcessoLimitado,
          naoAtingiu: a.naoAtingiu + b.naoAtingiu,
          naoAvaliado: a.naoAvaliado + b.naoAvaliado,
          total: a.total + b.total,
        }));
      expect(daHabilidade(painel.total, "5EF", codigo)).toEqual(soma);
    }
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
      emProcessoLimitado: 0,
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
    const painel = await consolidado.daRede(contrato(), OUTRA_REGIONAL, AGORA);
    expect(painel.escolas.map((e) => e.id)).toEqual([VIZINHA]);
    expect(painel.regionais).toEqual([]);
  });

  test("o TOPO da regional é a soma das escolas DELA — a vizinha não entra", async () => {
    const painel = RedeConsolidadaSchema.parse(await consolidado.daRede(regional(), undefined, AGORA));
    // A regional não tem o degrau das regionais: ela lê só a dela.
    expect(painel.regionais).toEqual([]);
    // 5A (4) + 5B (2) + 5C (1): Ana e Gabi atingiram, Bia em processo; o Hugo, da vizinha, fica de fora.
    expect(painel.total.find((s) => s.serie === "5EF")).toMatchObject({ turmas: 3, estudantes: 7 });
    expect(daHabilidade(painel.total, "5EF", "EF05CO08")).toEqual({
      atingiu: 2,
      emProcesso: 1,
      emProcessoLimitado: 0,
      naoAtingiu: 0,
      naoAvaliado: 4,
      total: 7,
    });
    expect(painel.total).toEqual(juntarSeries(painel.escolas.map((e) => e.series)));
  });

  test("o contrato na rede inteira: o topo, uma linha por regional, e cada regional igual ao painel dela", async () => {
    const painel = RedeConsolidadaSchema.parse(await consolidado.daRede(contrato(), undefined, AGORA));
    // O banco pode ter outras escolas (o seed): o que se prova é a igualdade, não o número.
    expect(painel.total).toEqual(juntarSeries(painel.escolas.map((e) => e.series)));

    const daSuite = painel.regionais.find((r) => r.id === REGIONAL)!;
    const vizinha = painel.regionais.find((r) => r.id === OUTRA_REGIONAL)!;
    expect(daSuite).toMatchObject({ nome: "DE do painel (teste)", escolas: 2 });
    expect(vizinha.escolas).toBe(1);
    // A linha da regional no painel do contrato é o MESMO número que a coordenação regional lê.
    const lidaPelaRegional = await consolidado.daRede(regional(), undefined, AGORA);
    expect(daSuite.series).toEqual(lidaPelaRegional.total);
    expect(daHabilidade(vizinha.series, "5EF", "EF05CO08")).toMatchObject({ atingiu: 1, total: 1 });

    // Cada escola sabe a regional dela; as regionais mais as escolas soltas fecham o topo.
    expect(painel.escolas.find((e) => e.id === VIZINHA)!.regionalId).toBe(OUTRA_REGIONAL);
    const soltas = painel.escolas.filter((e) => e.regionalId === null).map((e) => e.series);
    expect(juntarSeries([...painel.regionais.map((r) => r.series), ...soltas])).toEqual(painel.total);
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

  test("o contrato precisa dizer a escola: sem ?escolaId= é 400, nunca 'a primeira que achar'", async () => {
    await expect(consolidado.escolaDaConsulta(contrato())).rejects.toBeInstanceOf(BadRequestException);
    await expect(consolidado.escolaDaConsulta(contrato(), VIZINHA)).resolves.toBe(VIZINHA);
  });

  test("escola liberada não abre turma de OUTRA escola: a turma é procurada sob a escola armada", async () => {
    // A regional pede a irmã (legítimo) e manda a turma da vizinha no caminho.
    const escolaId = await consolidado.escolaDaConsulta(regional(), IRMA);
    await expect(consolidado.daTurma(escolaId, ids.t5D!)).rejects.toBeInstanceOf(NotFoundException);
    // E a coordenação, presa à dela, não lê a turma da irmã.
    await expect(consolidado.daTurma(ESCOLA, ids.t5C!)).rejects.toBeInstanceOf(NotFoundException);
  });

  test("o perfil de criança de outra escola é 404, mesmo com a escola liberada", async () => {
    const escolaId = await consolidado.escolaDaConsulta(regional(), IRMA);
    await expect(evidencias.perfil(escolaId, ids.gabi!)).resolves.toBeTruthy();
    await expect(evidencias.perfil(escolaId, ids.hugo!)).rejects.toBeInstanceOf(NotFoundException);
    await expect(evidencias.perfil(ESCOLA, ids.gabi!)).rejects.toBeInstanceOf(NotFoundException);
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

  test("o professor abre só criança das turmas em que leciona: a da turma vizinha é 404", async () => {
    await expect(evidencias.perfil(ESCOLA, ids.ana!, ids.prof5A)).resolves.toBeTruthy();
    // Eli é da 5B, mesma escola, outra turma.
    await expect(evidencias.perfil(ESCOLA, ids.eli!, ids.prof5A)).rejects.toBeInstanceOf(NotFoundException);
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

describe('o "em processo" limitado pela atividade (ADR-166)', () => {
  /* A ficha REAL da exp05ef1b com um marcador a mais, limitado pela atividade —
     só nesta instância do serviço, e no fim da suíte, para não mudar as somas
     de cima. */
  beforeAll(async () => {
    evidencias.registrarFicha({
      ...FICHA_EXP05EF1B,
      habilidades: FICHA_EXP05EF1B.habilidades.map((h) =>
        h.codigo === "EF05CO08"
          ? { ...h, marcadores: [...h.marcadores, { id: "teste-limitado", tipo: "acao" as const, limitadoPelaAtividade: true as const }] }
          : h,
      ),
    });
    ids.t5L = (await criarTurmaDeTeste(prisma, ESCOLA, "5L", "5EF")).id;
    for (const nome of ["lia", "leo", "lua"]) await estudante(ESCOLA, ids.t5L, nome);
    const propria = (estudanteId: string, atividadeId: string, marcador: string | null) =>
      prisma.evidencia.create({
        data: {
          escolaId: ESCOLA,
          turmaId: ids.t5L!,
          expId: MISSAO,
          atividadeId,
          rodada: 1,
          estudanteId,
          habilidade: "EF05CO08",
          status: "em_processo",
          origem: "propria",
          situacao: "valida",
          marcador,
        },
      });
    // Lia: só o limitado. Leo: limitado numa atividade, comum na outra (empate = comum). Lua: comum.
    await propria(ids.lia!, "atv-1", "teste-limitado");
    await propria(ids.leo!, "atv-1", "teste-limitado");
    await propria(ids.leo!, "atv-2", null);
    await propria(ids.lua!, "atv-1", null);
  });

  test("a turma conta o limitado À PARTE, e o total continua sendo a soma das caixas", async () => {
    const painel = TurmaConsolidadaSchema.parse(await consolidado.daTurma(ESCOLA, ids.t5L!));
    const d = painel.missoes.find((m) => m.expId === MISSAO)!.habilidades.find((h) => h.codigo === "EF05CO08")!.distribuicao;
    expect(d).toEqual({ atingiu: 0, emProcesso: 2, emProcessoLimitado: 1, naoAtingiu: 0, naoAvaliado: 0, total: 3 });
  });

  test("o topo da escola soma o limitado também, e continua a soma das linhas", async () => {
    const painel = EscolaConsolidadaSchema.parse(await consolidado.daEscola(ESCOLA, AGORA));
    const topo = daHabilidade(painel.total, "5EF", "EF05CO08")!;
    expect(topo.emProcessoLimitado).toBe(1);
    expect(topo.atingiu + topo.emProcesso + topo.emProcessoLimitado + topo.naoAtingiu + topo.naoAvaliado).toBe(topo.total);
  });
});
