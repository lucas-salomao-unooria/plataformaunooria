import { PrismaClient } from "@prisma/client";
import { normalizarPerfil } from "../src/perfis/afinidade";
import { resolverLargada } from "../src/perfis/largada";
import { PerfisController } from "../src/perfis/perfis.controller";
import { comEscolaNoContexto } from "../src/tenancy/tenancy-context";
import { PrismaService } from "../src/prisma/prisma.service";
import { VERSAO_MAPEAMENTO } from "../src/vila/mapeamento";
import {
  colapsarEmQuadrantes,
  NOMES_DOS_QUADRANTES,
  todosOsValoresMapeados,
} from "../src/vila/quadrantes";
import { VilaService } from "../src/vila/vila.service";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O Ato 1 nativo: o perfil da Vila do Lume virando `exp_01_exp_70_perfis_importados`, que é o
 * que decide de que lado o feed do Instanooria nasce.
 *
 * UMA ESCOLA POR SUÍTE (o Jest paraleliza suítes).
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-vila-ato1";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const service = new VilaService(prisma);

/** Um perfil com os dez valores `scored`, todos observáveis. */
function perfilCheio(): { valores: Record<string, number>; graus: Record<string, string> } {
  return {
    valores: {
      selfDirection: 60, stimulation: 40, hedonism: 20,
      universalism: 80, benevolence: 70,
      achievement: 30, power: 10,
      security: 50, conformity: 45, tradition: 25,
    },
    graus: Object.fromEntries(
      ["selfDirection", "stimulation", "hedonism", "universalism", "benevolence",
       "achievement", "power", "security", "conformity", "tradition"].map((v) => [v, "scored"]),
    ),
  };
}

/* ---------------------------------------------------------- colapso (puro) */

describe("colapso nos quatro quadrantes", () => {
  test("os dez valores estão em exatamente um quadrante", () => {
    expect(todosOsValoresMapeados()).toBe(true);
    expect(NOMES_DOS_QUADRANTES).toEqual([
      "abertura", "autotranscendencia", "autopromocao", "conservacao",
    ]);
  });

  test("cada quadrante é a média dos membros observados", () => {
    const { valores, graus } = perfilCheio();
    const r = colapsarEmQuadrantes(valores, graus, true);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.escores.abertura).toBeCloseTo((0.6 + 0.4 + 0.2) / 3, 5);
    expect(r.escores.autotranscendencia).toBeCloseTo((0.8 + 0.7) / 2, 5);
    expect(r.escores.autopromocao).toBeCloseTo((0.3 + 0.1) / 2, 5);
    expect(r.escores.conservacao).toBeCloseTo((0.5 + 0.45 + 0.25) / 3, 5);
  });

  test("valor NÃO observado fica fora da média — nunca entra como zero", () => {
    // A trava central. Com Hedonismo `indicative`, Abertura é a média de DOIS
    // valores; tratá-lo como zero puxaria o quadrante para baixo e diria que a
    // criança não tem aquele valor, quando ela só não foi observada nele.
    const { valores, graus } = perfilCheio();
    graus.hedonism = "indicative";
    const r = colapsarEmQuadrantes(valores, graus, true);
    if (!r.ok) throw new Error("devia colapsar");
    expect(r.escores.abertura).toBeCloseTo((0.6 + 0.4) / 2, 5);
    // e é MAIOR que a média com zero, provando que não entrou como zero
    expect(r.escores.abertura).toBeGreaterThan((0.6 + 0.4 + 0) / 3);
  });

  test("`zero` observado ENTRA na média, e vale zero de verdade", () => {
    // "Teve a chance e não foi por ali" é um zero legítimo — diferente de
    // "a oportunidade não chegou".
    const { valores, graus } = perfilCheio();
    graus.hedonism = "zero";
    const r = colapsarEmQuadrantes(valores, graus, true);
    if (!r.ok) throw new Error("devia colapsar");
    expect(r.escores.abertura).toBeCloseTo((0.6 + 0.4 + 0) / 3, 5);
  });

  test("quadrante sem NENHUM valor observado invalida o perfil inteiro", () => {
    const { valores, graus } = perfilCheio();
    graus.security = "none";
    graus.conformity = "none";
    graus.tradition = "indicative";
    const r = colapsarEmQuadrantes(valores, graus, true);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("quadrante-sem-observacao");
      expect(r.detalhe).toMatch(/conservacao/);
    }
  });

  test("amostra insuficiente não vira perfil, mesmo com os dez valores", () => {
    // O relatório do professor se recusa a dizer qualquer coisa sobre essa
    // partida. Deixá-la decidir o lado de um debate — e virar linha no CSV do
    // /analise — seria dizer pelas costas o que a tela não diz na frente.
    const { valores, graus } = perfilCheio();
    const r = colapsarEmQuadrantes(valores, graus, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("amostra-insuficiente");
  });

  test("o colapso é aceito pelo `normalizarPerfil` do Instanooria", () => {
    // O contrato entre os dois módulos: quatro escores que a api reescala para
    // somar 1 e das quais deriva o dominante.
    const { valores, graus } = perfilCheio();
    const r = colapsarEmQuadrantes(valores, graus, true);
    if (!r.ok) throw new Error("devia colapsar");
    const perfil = normalizarPerfil(r.escores);
    const soma = Object.values(perfil.escores).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(1, 5);
    // Universalismo 80 + Benevolência 70 é o quadrante mais forte deste perfil.
    expect(perfil.dominante).toBe("autotranscendencia");
  });
});

/* ------------------------------------------------ leitura (com Postgres) */

describe("perfisParaOAto1", () => {
  let turmaId = "";
  let comPerfil = "";
  let curto = "";
  let semPartida = "";

  async function limpar() {
    await prisma.vilaPerfil.deleteMany({ where: { escolaId: ESCOLA } });
    await prisma.vilaSessao.deleteMany({ where: { escolaId: ESCOLA } });
    await prisma.vilaBolha.deleteMany({ where: { escolaId: ESCOLA } });
    await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
    await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
    await prisma.escola.deleteMany({ where: { id: ESCOLA } });
  }

  /** Grava uma partida concluída com o perfil pedido, sem passar pelo jogo. */
  async function semear(alunoId: string, amostraSuficiente: boolean, graus?: Record<string, string>) {
    const base = perfilCheio();
    const sessao = await prisma.vilaSessao.create({
      data: {
        escolaId: ESCOLA, estudanteId: alunoId, turmaId, expVersion: "1.0.0", schemaVersion: 1,
        bolha: "A", cartoesServidos: 4, status: "completa", concluidaEm: new Date(),
      },
      select: { id: true },
    });
    await prisma.vilaPerfil.create({
      data: {
        escolaId: ESCOLA, sessaoId: sessao.id, estudanteId: alunoId, versaoMapeamento: VERSAO_MAPEAMENTO,
        valores: base.valores, graus: graus ?? base.graus, amostraSuficiente,
      },
    });
    return sessao.id;
  }

  beforeAll(async () => {
    await limpar();
    await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Ato1 (teste)" } });
    const turma = await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF");
    turmaId = turma.id;
    const criar = (username: string) =>
      prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA, turmaId, username, displayName: username, passwordHash: "x" },
        select: { id: true },
      });
    comPerfil = (await criar("ato1.a")).id;
    curto = (await criar("ato1.b")).id;
    semPartida = (await criar("ato1.c")).id;

    await semear(comPerfil, true);
    await semear(curto, false);
  });

  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  test("separa pronto, descartado e sem partida — e NOMEIA quem ficou de fora", async () => {
    const r = await service.perfisParaOAto1(ESCOLA, turmaId);
    expect(r.prontos.map((p) => p.alunoId)).toEqual([comPerfil]);
    expect(r.descartados.map((d) => d.nome)).toEqual(["ato1.b"]);
    expect(r.descartados[0]!.motivo).toMatch(/curta demais/);
    expect(r.semPartida).toBe(1);
    expect(semPartida).toBeTruthy();
  });

  test("usa o perfil MAIS RECENTE, não a média das partidas", async () => {
    // Quem jogou três vezes tem três perfis; a média misturaria partidas de dias
    // diferentes num número que não descreve nenhuma delas.
    const graus = Object.fromEntries(
      Object.keys(perfilCheio().graus).map((v) => [v, v === "power" ? "zero" : "scored"]),
    );
    await new Promise((r) => setTimeout(r, 10)); // createdAt distinto
    await semear(comPerfil, true, graus);
    const r = await service.perfisParaOAto1(ESCOLA, turmaId);
    expect(r.prontos.length).toBe(1);
    // Poder virou `zero`: Autopromoção cai para a média de (0,30 e 0).
    expect(r.prontos[0]!.escores.autopromocao).toBeCloseTo(0.15, 5);
  });

  test("outra escola não enxerga estes perfis", async () => {
    const r = await service.perfisParaOAto1("escola-que-nao-existe", turmaId);
    expect(r.prontos).toEqual([]);
    expect(r.semPartida).toBe(0);
  });
});

/* --------------------------------------- a importação para a atividade */

describe("importar para a atividade (Ato 1)", () => {
  const ESCOLA_AT = "teste-vila-ato1-imp";
  const controller = new PerfisController(prisma, service);
  let turmaId = "";
  let professorId = "";
  let activityId = "";
  let redistribuido = "";
  let normal = "";

  async function limpar() {
    await prisma.perfilImportado.deleteMany({ where: { escolaId: ESCOLA_AT } });
    await prisma.activity.deleteMany({ where: { escolaId: ESCOLA_AT } });
    await prisma.vilaPerfil.deleteMany({ where: { escolaId: ESCOLA_AT } });
    await prisma.vilaSessao.deleteMany({ where: { escolaId: ESCOLA_AT } });
    await prisma.user.deleteMany({ where: { escolaId: ESCOLA_AT } });
    await prisma.turma.deleteMany({ where: { escolaId: ESCOLA_AT } });
    await prisma.escola.deleteMany({ where: { id: ESCOLA_AT } });
  }

  async function semearPerfil(alunoId: string) {
    const base = perfilCheio();
    const sessao = await prisma.vilaSessao.create({
      data: {
        escolaId: ESCOLA_AT, estudanteId: alunoId, turmaId, expVersion: "1.0.0", schemaVersion: 1,
        bolha: "A", cartoesServidos: 4, status: "completa", concluidaEm: new Date(),
      },
      select: { id: true },
    });
    await prisma.vilaPerfil.create({
      data: {
        escolaId: ESCOLA_AT, sessaoId: sessao.id, estudanteId: alunoId, versaoMapeamento: VERSAO_MAPEAMENTO,
        valores: base.valores, graus: base.graus, amostraSuficiente: true,
      },
    });
  }

  beforeAll(async () => {
    await limpar();
    await prisma.escola.create({ data: { id: ESCOLA_AT, nome: "Escola Ato1 imp (teste)" } });
    const turma = await criarTurmaDeTeste(prisma, ESCOLA_AT, "8B", "8EF");
    turmaId = turma.id;
    professorId = (
      await prisma.user.create({
        data: { role: "professor", escolaId: ESCOLA_AT, username: "at.prof", displayName: "Prof", passwordHash: "x" },
        select: { id: true },
      })
    ).id;
    const criar = (u: string) =>
      prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA_AT, turmaId, username: u, displayName: u, passwordHash: "x" },
        select: { id: true },
      });
    redistribuido = (await criar("at.a")).id;
    normal = (await criar("at.b")).id;
    await semearPerfil(redistribuido);
    await semearPerfil(normal);

    activityId = (
      await prisma.activity.create({
        data: {
          escolaId: ESCOLA_AT, professorId, titulo: "T", disciplina: "D", temaGeral: "TG",
          recorte: "R", perguntaChave: "PC", estiloVisual: "EV",
          proporcoes: {}, engineConfig: {},
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(limpar);

  const req = () => ({ auth: { usuarioId: professorId, escolaId: ESCOLA_AT, perfil: "professor" } }) as never;

  /* O controller chama `comTenancy` SEM escola explícita — quem abre o contexto
     em produção é o `TenancyInterceptor`, que roda depois do guard. O teste
     abre o mesmo contexto em vez de mudar a rota para aceitar um atalho: o
     caminho exercitado tem de ser o que roda de verdade. */
  const importar = (auth?: unknown) =>
    comEscolaNoContexto(ESCOLA_AT, () =>
      controller.importarDaVila(activityId, { turmaId }, (auth ?? req()) as never),
    );

  test("importa os perfis do jogo e nomeia quem ficou de fora", async () => {
    const r = (await importar()) as { importados: number; semPartida: number; descartados: unknown[] };
    expect(r.importados).toBe(2);
    expect(r.semPartida).toBe(0);
    expect(r.descartados).toEqual([]);

    const linhas = await prisma.perfilImportado.findMany({ where: { activityId } });
    expect(linhas.length).toBe(2);
    for (const linha of linhas) {
      expect(linha.origem).toBe("jogo");
      expect(linha.dominante).toBe("autotranscendencia");
    }
  });

  test("`ladoForcado` SOBREVIVE a uma reimportação", async () => {
    // A trava desta rota. `largada.ts` dá precedência a `ladoForcado` justamente
    // porque a redistribuição é decisão pedagógica do professor, tomada antes da
    // aula — e uma importação que a apagasse faria isso em silêncio, com o feed
    // do aluno nascendo do outro lado sem ninguém entender por quê.
    await prisma.perfilImportado.update({
      where: { activityId_estudanteId: { activityId, estudanteId: redistribuido } },
      data: { ladoForcado: "B" },
    });

    await importar();

    const movido = await prisma.perfilImportado.findUniqueOrThrow({
      where: { activityId_estudanteId: { activityId, estudanteId: redistribuido } },
    });
    expect(movido.ladoForcado).toBe("B");
    // e o resto FOI atualizado — a reimportação não é no-op.
    expect(movido.origem).toBe("jogo");

    const outro = await prisma.perfilImportado.findUniqueOrThrow({
      where: { activityId_estudanteId: { activityId, estudanteId: normal } },
    });
    expect(outro.ladoForcado).toBeNull();
  });

  test("atividade de outro professor é 404", async () => {
    const intruso = await prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA_AT, username: "at.outro", displayName: "Outro", passwordHash: "x" },
      select: { id: true },
    });
    await expect(
      importar({ auth: { usuarioId: intruso.id, escolaId: ESCOLA_AT, perfil: "professor" } }),
    ).rejects.toThrow();
  });
});

/* ------------------------------------------ o loop fechado com o Instanooria */

/**
 * A pergunta que sobra depois de tudo: o perfil da Vila REALMENTE decide de que
 * lado o feed do Instanooria nasce?
 *
 * Os testes acima provam cada elo (colapso → `normalizarPerfil` → linha em
 * `exp_01_exp_70_perfis_importados`). Este prova o elo final, que é o único que importa para o
 * aluno: `resolverLargada` — a função que o `POST /api/runs` chama quando a
 * criança entra na atividade — devolvendo `ladoOrigem: "perfil"` em vez de
 * `"sorteio"`.
 *
 * O antagonismo abaixo é fixture, e é intencionalmente COMPLETO: `afinidadeDaAtividade`
 * roda `antagonismoSchema.safeParse`, e um campo faltando faz o parse falhar em
 * silêncio → `afinidade: null` → sorteio balanceado. Ou seja: uma atividade com
 * antagonismo malformado ignora o perfil sem erro nenhum, e o professor veria
 * "sorteado" sem entender por quê. Montar o fixture inteiro é o que prova que
 * não é esse o caso aqui.
 */
describe("o perfil da Vila decide o lado no Instanooria", () => {
  const ESCOLA_LG = "teste-vila-largada";
  let turmaId = "";
  let professorId = "";
  let activityId = "";
  let aluno = "";

  const ANTAGONISMO = {
    perguntas_candidatas: [
      {
        pergunta: "As Grandes Navegações foram descoberta ou invasão?",
        equilibrio: { ok: true, nota: 0.5, aviso: null },
        por_que: "Os dois lados têm defensores com argumento.",
      },
    ],
    escolhida: 0,
    equilibrio: { ok: true, nota: 0.5, aviso: null },
    ladoA: {
      label: "Intenção e Planejamento",
      tese: "As navegações foram um projeto deliberado de expansão.",
      argumentos: ["Havia investimento da coroa", "Havia cartografia prévia"],
      tom_tipico: "analítico e documental",
    },
    ladoB: {
      label: "Acaso e Navegação",
      tese: "As navegações foram largamente resultado de acaso e correntes.",
      argumentos: ["Rotas mudaram por vento", "Chegadas não previstas"],
      tom_tipico: "narrativo e circunstancial",
    },
    afinidade: {
      abertura: "B",
      autopromocao: "A",
      por_que_abertura: "Quem gosta de novidade entra pelo acaso e pela descoberta.",
      por_que_autopromocao: "Quem valoriza conquista entra pelo projeto e pelo mérito.",
    },
    categorias_neutras_sugeridas: ["culinária", "esportes", "música"],
  };

  async function limpar() {
    await prisma.run.deleteMany({ where: { escolaId: ESCOLA_LG } });
    await prisma.perfilImportado.deleteMany({ where: { escolaId: ESCOLA_LG } });
    await prisma.activity.deleteMany({ where: { escolaId: ESCOLA_LG } });
    await prisma.vilaPerfil.deleteMany({ where: { escolaId: ESCOLA_LG } });
    await prisma.vilaSessao.deleteMany({ where: { escolaId: ESCOLA_LG } });
    await prisma.user.deleteMany({ where: { escolaId: ESCOLA_LG } });
    await prisma.turma.deleteMany({ where: { escolaId: ESCOLA_LG } });
    await prisma.escola.deleteMany({ where: { id: ESCOLA_LG } });
  }

  beforeAll(async () => {
    await limpar();
    await prisma.escola.create({ data: { id: ESCOLA_LG, nome: "Escola largada (teste)" } });
    turmaId = (await criarTurmaDeTeste(prisma, ESCOLA_LG, "8A", "8EF")).id;
    professorId = (
      await prisma.user.create({
        data: { role: "professor", escolaId: ESCOLA_LG, username: "lg.prof", displayName: "Prof", passwordHash: "x" },
        select: { id: true },
      })
    ).id;
    aluno = (
      await prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA_LG, turmaId, username: "lg.a", displayName: "Aluno LG", passwordHash: "x" },
        select: { id: true },
      })
    ).id;

    /* Perfil da Vila com Autotranscendência claramente no topo (Universalismo 80
       e Benevolência 70 contra o resto), para o dominante não cair em `misto`. */
    const base = perfilCheio();
    const sessao = await prisma.vilaSessao.create({
      data: {
        escolaId: ESCOLA_LG, estudanteId: aluno, turmaId, expVersion: "1.0.0", schemaVersion: 1,
        bolha: "A", cartoesServidos: 4, status: "completa", concluidaEm: new Date(),
      },
      select: { id: true },
    });
    await prisma.vilaPerfil.create({
      data: {
        escolaId: ESCOLA_LG, sessaoId: sessao.id, estudanteId: aluno, versaoMapeamento: VERSAO_MAPEAMENTO,
        valores: base.valores, graus: base.graus, amostraSuficiente: true,
      },
    });

    activityId = (
      await prisma.activity.create({
        data: {
          escolaId: ESCOLA_LG, professorId, titulo: "T", disciplina: "D", temaGeral: "TG",
          recorte: "R", perguntaChave: "PC", estiloVisual: "EV",
          proporcoes: {}, engineConfig: {}, antagonismo: ANTAGONISMO,
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(limpar);

  test("SEM importar, a largada cai no sorteio", async () => {
    const antes = await resolverLargada(prisma, activityId, aluno, ANTAGONISMO);
    expect(antes.ladoOrigem).toBe("sorteio");
    expect(antes.perfilOrigem).toBe("ausente");
  });

  test("DEPOIS de importar da Vila, a largada vem do perfil", async () => {
    const controller = new PerfisController(prisma, service);
    await comEscolaNoContexto(ESCOLA_LG, () =>
      controller.importarDaVila(
        activityId,
        { turmaId },
        { auth: { usuarioId: professorId, escolaId: ESCOLA_LG, perfil: "professor" } } as never,
      ),
    );

    const depois = await resolverLargada(prisma, activityId, aluno, ANTAGONISMO);
    expect(depois.perfilOrigem).toBe("jogo");
    expect(depois.perfilDominante).toBe("autotranscendencia");
    expect(depois.ladoOrigem).toBe("perfil");
    /* Autotranscendência é o OPOSTO de Autopromoção, que a afinidade pôs no lado
       A — então esta criança começa no B. É a regra `ladoPorPerfil`, e é o que
       fecha o Ato 1: a escolha dela no jogo decidiu o feed que ela vai ver. */
    expect(depois.ladoInicial).toBe("B");
  });

  test("o professor redistribuir continua vencendo o perfil", async () => {
    await prisma.perfilImportado.update({
      where: { activityId_estudanteId: { activityId, estudanteId: aluno } },
      data: { ladoForcado: "A" },
    });
    const depois = await resolverLargada(prisma, activityId, aluno, ANTAGONISMO);
    expect(depois.ladoOrigem).toBe("redistribuido");
    expect(depois.ladoInicial).toBe("A");
  });
});

/* ------------------------------- a turma da atividade, e a versão da medida */

/**
 * Duas coisas que a integração não sabia dizer, e que faziam o painel do
 * professor afirmar o que não podia.
 *
 * **A turma.** `POST :id/perfis/da-vila` só recebia turma pelo CORPO, e a tela
 * mandava `{}` — então a importação varria a ESCOLA e o "N ainda não jogaram"
 * contava crianças de outras salas. Desde
 * `20260830090000_atividade_por_turma` a atividade declara a turma, e ela é o
 * default.
 *
 * **A versão.** O perfil importado não guardava de que partida vinha nem sob que
 * `VERSAO_MAPEAMENTO`. Ao subir a constante, a Vila recalcularia e esta cópia
 * ficaria velha em silêncio — a armadilha do `expires_at`.
 */
describe("a importação sabe de que turma e de que medida está falando", () => {
  const ESCOLA_TT = "teste-vila-ato1-turma";
  const controller = new PerfisController(prisma, service);
  let professorId = "";
  let turmaA = "";
  let turmaB = "";
  let alunoDaTurmaA = "";
  let alunoDaTurmaB = "";
  let atividadeDaTurmaA = "";
  let atividadeSemTurma = "";

  async function limpar() {
    await prisma.perfilImportado.deleteMany({ where: { escolaId: ESCOLA_TT } });
    await prisma.activity.deleteMany({ where: { escolaId: ESCOLA_TT } });
    await prisma.vilaPerfil.deleteMany({ where: { escolaId: ESCOLA_TT } });
    await prisma.vilaSessao.deleteMany({ where: { escolaId: ESCOLA_TT } });
    await prisma.user.deleteMany({ where: { escolaId: ESCOLA_TT } });
    await prisma.turma.deleteMany({ where: { escolaId: ESCOLA_TT } });
    await prisma.escola.deleteMany({ where: { id: ESCOLA_TT } });
  }

  /** Uma partida completa, com perfil medido na versão vigente. */
  async function semear(alunoId: string, turmaId: string) {
    const base = perfilCheio();
    const sessao = await prisma.vilaSessao.create({
      data: {
        escolaId: ESCOLA_TT, estudanteId: alunoId, turmaId, expVersion: "1.0.0", schemaVersion: 1,
        bolha: "A", cartoesServidos: 4, status: "completa", concluidaEm: new Date(),
      },
      select: { id: true },
    });
    await prisma.vilaPerfil.create({
      data: {
        escolaId: ESCOLA_TT, sessaoId: sessao.id, estudanteId: alunoId, versaoMapeamento: VERSAO_MAPEAMENTO,
        valores: base.valores, graus: base.graus, amostraSuficiente: true,
      },
    });
    return sessao.id;
  }

  const criarAtividade = (turmaId: string | null) =>
    prisma.activity.create({
      data: {
        escolaId: ESCOLA_TT, professorId, turmaId, titulo: "T", disciplina: "D",
        temaGeral: "TG", recorte: "R", perguntaChave: "PC", estiloVisual: "EV",
        proporcoes: {}, engineConfig: {},
      },
      select: { id: true },
    });

  beforeAll(async () => {
    await limpar();
    await prisma.escola.create({ data: { id: ESCOLA_TT, nome: "Escola turma (teste)" } });

    turmaA = (await criarTurmaDeTeste(prisma, ESCOLA_TT, "8A", "8EF")).id;
    turmaB = (await criarTurmaDeTeste(prisma, ESCOLA_TT, "8B", "8EF")).id;

    professorId = (
      await prisma.user.create({
        data: { role: "professor", escolaId: ESCOLA_TT, username: "tt.prof", displayName: "Prof", passwordHash: "x" },
        select: { id: true },
      })
    ).id;

    const criarAluno = (username: string, turmaId: string) =>
      prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA_TT, turmaId, username, displayName: username, passwordHash: "x" },
        select: { id: true },
      });

    alunoDaTurmaA = (await criarAluno("tt.a", turmaA)).id;
    alunoDaTurmaB = (await criarAluno("tt.b", turmaB)).id;
    await semear(alunoDaTurmaA, turmaA);
    await semear(alunoDaTurmaB, turmaB);

    atividadeDaTurmaA = (await criarAtividade(turmaA)).id;
    atividadeSemTurma = (await criarAtividade(null)).id;
  });

  afterAll(limpar);

  const req = () =>
    ({ auth: { usuarioId: professorId, escolaId: ESCOLA_TT, perfil: "professor" } }) as never;

  const importar = (activityId: string, corpo: unknown = {}) =>
    comEscolaNoContexto(ESCOLA_TT, () =>
      controller.importarDaVila(activityId, corpo, req()),
    ) as Promise<{ importados: number; semPartida: number; descartados: unknown[] }>;

  test("com CORPO VAZIO, a turma sai da atividade — não é a escola inteira", async () => {
    const r = await importar(atividadeDaTurmaA);

    /* A escola tem dois alunos com partida, um em cada turma. Só o da turma da
       atividade entra — e `semPartida` conta zero, porque a única criança da
       turma A já jogou. Antes, isto importava 2 e dizia "0 ainda não jogaram"
       sobre uma sala que o professor nem tem. */
    expect(r.importados).toBe(1);
    expect(r.semPartida).toBe(0);

    const linhas = await prisma.perfilImportado.findMany({
      where: { activityId: atividadeDaTurmaA },
      select: { estudanteId: true },
    });
    expect(linhas.map((l) => l.estudanteId)).toEqual([alunoDaTurmaA]);
  });

  test("o aluno de outra turma não entra", async () => {
    await importar(atividadeDaTurmaA);
    const doOutro = await prisma.perfilImportado.findFirst({
      where: { activityId: atividadeDaTurmaA, estudanteId: alunoDaTurmaB },
    });
    expect(doOutro).toBeNull();
  });

  test("atividade SEM turma continua valendo para a escola inteira", async () => {
    const r = await importar(atividadeSemTurma);
    // O comportamento anterior à coluna, preservado para as atividades antigas.
    expect(r.importados).toBe(2);
  });

  test("o perfil importado guarda a partida e a versão do mapeamento", async () => {
    await importar(atividadeDaTurmaA);

    const linha = await prisma.perfilImportado.findUniqueOrThrow({
      where: { activityId_estudanteId: { activityId: atividadeDaTurmaA, estudanteId: alunoDaTurmaA } },
      select: { vilaSessaoId: true, versaoMapeamento: true, origem: true },
    });

    expect(linha.origem).toBe("jogo");
    expect(linha.versaoMapeamento).toBe(VERSAO_MAPEAMENTO);
    expect(linha.vilaSessaoId).not.toBeNull();

    /* E o id tem de ser o da sessão REAL daquela criança — não um qualquer.
       Sem isso, a coluna existiria sem dizer nada, que é o defeito que ela
       veio corrigir. */
    const sessao = await prisma.vilaSessao.findUniqueOrThrow({
      where: { id: linha.vilaSessaoId! },
      select: { estudanteId: true },
    });
    expect(sessao.estudanteId).toBe(alunoDaTurmaA);
  });

  test("reimportar ATUALIZA a versão, senão o aviso da tela nunca sumiria", async () => {
    await importar(atividadeDaTurmaA);
    const chave = { activityId_estudanteId: { activityId: atividadeDaTurmaA, estudanteId: alunoDaTurmaA } };

    // Simula uma linha medida sob mapeamento antigo (o estado que a tela avisa).
    await prisma.perfilImportado.update({
      where: chave,
      data: { versaoMapeamento: VERSAO_MAPEAMENTO - 1, ladoForcado: "A" },
    });

    await importar(atividadeDaTurmaA);

    const depois = await prisma.perfilImportado.findUniqueOrThrow({
      where: chave,
      select: { versaoMapeamento: true, ladoForcado: true },
    });
    expect(depois.versaoMapeamento).toBe(VERSAO_MAPEAMENTO);
    // E a redistribuição do professor CONTINUA de pé — o invariante de sempre.
    expect(depois.ladoForcado).toBe("A");
  });
});
