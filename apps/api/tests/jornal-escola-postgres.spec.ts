import { HttpException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider, AiResult } from "../src/ai/provider";
import { QuotaService, perfilDaQuota } from "../src/ai/quota.service";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { NOTICIAS_PADRAO, TEMA_PADRAO, noticiasPadrao } from "../src/jornal-escola/catalogo";
import {
  ComparativoSchema,
  EstadoSchema,
  PacotesSchema,
  PainelSchema,
  PistaReveladaSchema,
  ResultadoSchema,
  SessaoSchema,
  TentativaDaChaveSchema,
  type NoticiaDoPacote,
} from "../src/jornal-escola/contrato-de-rotas";
import { DiagramacaoService } from "../src/jornal-escola/diagramacao.service";
import { PROIBIDO_NA_LINHA_DO_PAINEL } from "../src/jornal-escola/invariantes";
import { EXP_ID, JornalEscolaService } from "../src/jornal-escola/jornal-escola.service";
import { PreparoDaExp04ef1bService } from "../src/jornal-escola/preparo.service";
import { emFormatoDaIa, gabaritoDoPapel, sortearMolde } from "../src/jornal-escola/regras/molde";
import { ETAPAS, PASSOS } from "../src/jornal-escola/regras/passos";
import type { IdDeNoticia, TipoDePista } from "../src/jornal-escola/vocabulario";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp04ef1b no Postgres: a RLS das quatro tabelas e os CHECKs, a
 * porta da sala, `garantirPacote` sob concorrência, as pistas, os dois latches
 * concorrentes, o motivo, os portões do professor, a Chave, atividade × rodada
 * (zerar guarda, pacote novo volta à 1, o mesmo pacote é idempotente), o painel
 * POR COMPUTADOR, o resolvedor de P1/P2, a diagramação com IA falsa e o cache,
 * e o preparo.
 *
 * UMA ESCOLA POR SUÍTE (mais a vizinha, para a RLS). Molde:
 * `a-selecao-postgres.spec.ts`.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-jornal-escola";
const OUTRA_ESCOLA = "teste-jornal-escola-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

/**
 * O MESMO Prisma, com a role SEM `BYPASSRLS`. Sem isto a prova de isolamento
 * passa em falso: o usuário administrativo é SUPERUSER.
 */
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/**
 * A IA controlada pela suíte. Por padrão ela FALHA, como o mock: a diagramação
 * de toda criança cai no modelo, e só os testes que querem a IA dizem o que ela
 * responde. `resposta` pode ser uma função do pedido (o preparo).
 */
class IaControlada implements AiProvider {
  resposta: unknown = null;
  atrasoMs = 0;
  tokens = 20;
  chamadas = 0;
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    this.chamadas += 1;
    if (this.atrasoMs) await new Promise((r) => setTimeout(r, this.atrasoMs));
    req.aoUsarTokens?.(this.tokens);
    if (this.resposta === null) throw new Error("IA de teste desligada");
    const bruto = typeof this.resposta === "function" ? (this.resposta as (r: AiJsonRequest<T>) => unknown)(req) : this.resposta;
    return req.validar(bruto);
  }
  generate(): Promise<AiResult> {
    throw new Error("não usado");
  }
  generateImage(): Promise<Buffer> {
    throw new Error("não usado");
  }
  generateSpeech(): Promise<Buffer> {
    throw new Error("não usado");
  }
  conversar(): Promise<AiResult> {
    throw new Error("não usado");
  }
}

/** A subclasse do `ai/AGENTS.md`: teto zerado sem mexer em `ia_quotas`, que é do contrato. */
class QuotaZerada extends QuotaService {
  override async limite(perfil: string): Promise<number> {
    return perfilDaQuota(perfil) === "estudante" || perfilDaQuota(perfil) === "professor" ? 0 : super.limite(perfil);
  }
}

const ia = new IaControlada();
const quota = new QuotaService(prisma);
const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
evidencias.onModuleInit();
const diagramacao = new DiagramacaoService(ia, quota, prisma, 300);
const service = new JornalEscolaService(prisma, evidencias, diagramacao);
service.onModuleInit();

const ids = {
  turma: "",
  turmaSemLiberacao: "",
  turmaCorrida: "",
  turmaVazia: "",
  turmaVizinha: "",
  professora: "",
  outroProfessor: "",
  ana: "",
  bia: "",
  caio: "",
  duda: "",
  enzo: "",
  fabi: "",
  vizinho: "",
  /* Os da diagramação: o rate limit dela é por estudante e em memória. */
  gabi: "",
  hugo: "",
  iris: "",
  joao: "",
  corrida: [] as string[],
};

/** Tudo da missão, das equipes, da evidência e da quota das duas escolas — entre um bloco e outro. */
async function zerarMissao() {
  /* O pacote leva o gate, as sessões e as diagramações por cascata. */
  await prisma.exp04ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  ia.resposta = null;
  ia.atrasoMs = 0;
}

async function limpar() {
  await zerarMissao();
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.matricula.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.escola.deleteMany({ where: { id: { in: ESCOLAS } } });
}

/** O código de uma recusa (`codigo` do corpo, ou o status). */
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

const entrar = (estudanteId: string, turmaId = ids.turma, escolaId = ESCOLA) =>
  service.sessao(escolaId, estudanteId, turmaId);

async function naMesa(estudanteId: string) {
  await entrar(estudanteId);
  return service.pedirPasso(ESCOLA, estudanteId, ids.turma, "mesa");
}

const pista = (estudanteId: string, noticiaId: IdDeNoticia, tipo: TipoDePista) =>
  service.abrirPista(ESCOLA, estudanteId, ids.turma, { noticiaId, tipo });

async function abrirTodas(estudanteId: string, noticias: IdDeNoticia[]) {
  for (const n of noticias) for (const t of ["fonte", "data", "autoria"] as const) await pista(estudanteId, n, t);
}

const publicacao = (slots: IdDeNoticia[]) => ({ slots, layout: "classic" as const, origemDoLayout: "modelo" as const });

async function publicar(estudanteId: string, slots: IdDeNoticia[]) {
  await naMesa(estudanteId);
  return service.publicar(ESCOLA, estudanteId, ids.turma, publicacao(slots));
}

const etapa = (para: (typeof ETAPAS)[number]) => service.mudarEtapa(ESCOLA, ids.turma, ids.professora, para);

/** A atividade em andamento na turma — a montagem das equipes é dela (ADR-130). */
async function atividadeAtual(): Promise<string> {
  const linha = await prisma.exp04ef1bPacote.findFirst({
    where: { escolaId: ESCOLA, turmaId: ids.turma, ativo: true },
    select: { id: true },
  });
  if (linha) return linha.id;
  /* A primeira leitura do painel cria a atividade padrão da turma. */
  await service.painel(ESCOLA, ids.turma, ids.professora);
  return atividadeAtual();
}

async function montarEquipes(grupos: string[][], computadores: number, ausentes: string[] = []) {
  /* A equipe é da ATIVIDADE (ADR-130): a em andamento na turma. */
  const atividadeId = await atividadeAtual();
  const alvo = { escolaId: ESCOLA, turmaId: ids.turma, expId: EXP_ID, atividadeId };
  const atual = await equipes.daMissao(alvo, ids.professora);
  return equipes.salvar(
    alvo,
    {
      versao: atual.montagem?.versao ?? 0,
      modo: "manual",
      computadores,
      ausentes,
      equipes: grupos.map((membros, i) => ({ nome: `Equipe ${i + 1}`, membros })),
    },
    ids.professora,
  );
}

function evidenciaDe(estudanteId: string, habilidade: string) {
  return prisma.evidencia.findMany({
    where: { escolaId: ESCOLA, expId: EXP_ID, estudanteId, habilidade },
    select: { status: true, origem: true, situacao: true, rodada: true, atividadeId: true },
    orderBy: { rodada: "asc" },
  });
}

const marcasDe = (marcador: string) =>
  prisma.evidenciaMarca.findMany({
    where: { escolaId: ESCOLA, expId: EXP_ID, marcador },
    select: { estudanteId: true, status: true, rodada: true },
  });

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do Jornal (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Escola vizinha do Jornal (teste)" } });

  ids.turma = (await criarTurmaDeTeste(prisma, ESCOLA, "4A", "4EF")).id;
  ids.turmaSemLiberacao = (await criarTurmaDeTeste(prisma, ESCOLA, "4B", "4EF")).id;
  ids.turmaCorrida = (await criarTurmaDeTeste(prisma, ESCOLA, "4C", "4EF")).id;
  ids.turmaVazia = (await criarTurmaDeTeste(prisma, ESCOLA, "4D", "4EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "4A vizinha", "4EF")).id;

  const pessoa = async (escolaId: string, username: string, role: string, nome: string, turmaId?: string) =>
    (
      await prisma.user.create({
        data: { escolaId, username, role, displayName: nome, passwordHash: "x", turmaId },
        select: { id: true },
      })
    ).id;

  ids.professora = await pessoa(ESCOLA, "jornal-prof", "professor", "Marta Prof");
  ids.outroProfessor = await pessoa(ESCOLA, "jornal-prof-4b", "professor", "Rui Prof");
  ids.ana = await pessoa(ESCOLA, "jornal-ana", "estudante", "Ana Clara Souza", ids.turma);
  ids.bia = await pessoa(ESCOLA, "jornal-bia", "estudante", "Bia Lima", ids.turma);
  ids.caio = await pessoa(ESCOLA, "jornal-caio", "estudante", "Caio Reis", ids.turma);
  ids.duda = await pessoa(ESCOLA, "jornal-duda", "estudante", "Duda Melo", ids.turma);
  ids.enzo = await pessoa(ESCOLA, "jornal-enzo", "estudante", "Enzo Paz", ids.turma);
  ids.gabi = await pessoa(ESCOLA, "jornal-gabi", "estudante", "Gabi Costa", ids.turma);
  ids.hugo = await pessoa(ESCOLA, "jornal-hugo", "estudante", "Hugo Dias", ids.turma);
  ids.iris = await pessoa(ESCOLA, "jornal-iris", "estudante", "Iris Rocha", ids.turma);
  ids.joao = await pessoa(ESCOLA, "jornal-joao", "estudante", "João Alves", ids.turma);
  ids.fabi = await pessoa(ESCOLA, "jornal-fabi", "estudante", "Fabi Nunes", ids.turmaSemLiberacao);
  ids.vizinho = await pessoa(OUTRA_ESCOLA, "jornal-vizinho", "estudante", "Vito Vizinho", ids.turmaVizinha);
  for (let i = 0; i < 6; i++) {
    ids.corrida.push(await pessoa(ESCOLA, `jornal-corrida-${i}`, "estudante", `Corrida ${i}`, ids.turmaCorrida));
  }

  const lecionar = (turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: { escolaId: ESCOLA, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
    });
  await lecionar(ids.turma, ids.professora);
  await lecionar(ids.turmaSemLiberacao, ids.outroProfessor);

  /* A PORTA DA SALA (ADR-69): a 4B é a turma SEM liberação. */
  await liberarParaTeste(prisma, ESCOLA, ids.turma, EXP_ID, ids.professora);
  await liberarParaTeste(prisma, ESCOLA, ids.turmaCorrida, EXP_ID, ids.professora);
  await liberarParaTeste(prisma, OUTRA_ESCOLA, ids.turmaVizinha, EXP_ID, ids.vizinho);

  /* O `PUT` das equipes exige a missão no catálogo e de estudante. */
  await prisma.experiencia.upsert({
    where: { expId: EXP_ID },
    update: { publico: "estudante" },
    create: { expId: EXP_ID, nome: "Jornal da Escola", versaoAtiva: "2.0.0", series: ["4EF"], publico: "estudante" },
  });
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

const TABELAS = ["exp04ef1b_pacotes", "exp04ef1b_gates_turma", "exp04ef1b_sessoes", "exp04ef1b_diagramacoes"] as const;

describe("tenancy no banco (regra inviolável nº 1)", () => {
  beforeAll(async () => {
    await zerarMissao();
    const daqui = await entrar(ids.ana);
    const dela = await entrar(ids.vizinho, ids.turmaVizinha, OUTRA_ESCOLA);
    /* A diagramação entra CRUA: no fluxo ela só existe quando a IA responde. */
    await prisma.exp04ef1bDiagramacao.create({ data: { escolaId: ESCOLA, pacoteId: daqui.pacoteId, chave: "n1,n2,n3", layout: "classic" } });
    await prisma.exp04ef1bDiagramacao.create({
      data: { escolaId: OUTRA_ESCOLA, pacoteId: dela.pacoteId, chave: "n1,n2,n3", layout: "columns" },
    });
  });

  test("as quatro tabelas têm RLS habilitada E forçada, com uma política por escola", async () => {
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

  test("a RLS isola DE VERDADE: nada da escola vizinha existe daqui", async () => {
    const daqui = await runtime.comTenancy(
      async (tx) => ({
        pacotes: await tx.exp04ef1bPacote.findMany({ select: { escolaId: true } }),
        gates: await tx.exp04ef1bGateTurma.findMany({ select: { escolaId: true } }),
        sessoes: await tx.exp04ef1bSessao.findMany({ select: { escolaId: true } }),
        diagramacoes: await tx.exp04ef1bDiagramacao.findMany({ select: { escolaId: true } }),
      }),
      ESCOLA,
    );
    for (const [tabela, linhas] of Object.entries(daqui)) {
      expect({ tabela, tem: linhas.length > 0, soDaqui: linhas.every((l) => l.escolaId === ESCOLA) }).toEqual({
        tabela,
        tem: true,
        soDaqui: true,
      });
    }
  });

  test("uma sessão SEM tenancy armada não enxerga linha nenhuma", async () => {
    for (const tabela of TABELAS) {
      const [n] = await runtime.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${tabela}`);
      expect({ tabela, n: Number(n?.n) }).toEqual({ tabela, n: 0 });
    }
  });
});

describe("os CHECKs recusam o que dizem recusar", () => {
  let sessao = "";
  let pacoteId = "";

  beforeAll(async () => {
    await zerarMissao();
    const s = await entrar(ids.ana);
    sessao = s.sessaoId;
    pacoteId = s.pacoteId;
  });

  const falha = (sql: string) => expect(prisma.$executeRawUnsafe(sql)).rejects.toThrow();
  const naSessao = (set: string) => falha(`UPDATE exp04ef1b_sessoes SET ${set} WHERE id = '${sessao}'::uuid`);
  const publicada = `slots_ed1 = ARRAY['n1','n2','n3'], layout_ed1 = 'classic', origem_layout_ed1 = 'modelo', verificadas_ed1 = 1, publicada1_em = now()`;

  test("o vocabulário dos passos e das etapas é o MESMO do código", async () => {
    const def = async (nome: string) =>
      (
        await prisma.$queryRawUnsafe<{ d: string }[]>(
          `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = '${nome}'`,
        )
      )[0]?.d ?? "";
    const passos = await def("exp04ef1b_sessoes_passo_check");
    for (const p of PASSOS) expect(passos).toContain(`'${p}'`);
    expect(passos.match(/'[a-z]+'::text/g)).toHaveLength(PASSOS.length);
    const etapas = await def("exp04ef1b_gates_turma_etapa_check");
    for (const e of ETAPAS) expect(etapas).toContain(`'${e}'`);
    expect(etapas.match(/'[a-z]+'::text/g)).toHaveLength(ETAPAS.length);
  });

  test("o LATCH da 1ª: carimbo sem vagas, vagas sem carimbo, e publicada com o passo de antes", async () => {
    await naSessao("publicada1_em = now()");
    await naSessao("slots_ed1 = ARRAY['n1','n2','n3'], layout_ed1 = 'classic', origem_layout_ed1 = 'modelo', verificadas_ed1 = 1");
    await naSessao(`${publicada}, passo = 'mesa'`);
    // O caminho certo passa: carimbo e passo juntos.
    await prisma.$executeRawUnsafe(`UPDATE exp04ef1b_sessoes SET ${publicada}, passo = 'motivo' WHERE id = '${sessao}'::uuid`);
    await prisma.$executeRawUnsafe(
      `UPDATE exp04ef1b_sessoes SET slots_ed1 = '{}', layout_ed1 = NULL, origem_layout_ed1 = NULL, verificadas_ed1 = NULL, publicada1_em = NULL, passo = 'desafio' WHERE id = '${sessao}'::uuid`,
    );
  });

  test("as vagas: três diferentes, dos oito ids; e as verificadas de 0 a 3", async () => {
    const pub = (slots: string, extra = "") =>
      naSessao(
        `slots_ed1 = ARRAY[${slots}], layout_ed1 = 'classic', origem_layout_ed1 = 'modelo', verificadas_ed1 = 1, publicada1_em = now(), passo = 'motivo'${extra}`,
      );
    await pub(`'n1','n1','n3'`);
    await pub(`'n1','n2','n9'`);
    await pub(`'n1','n2'`);
    await pub(`'n1','n2','n3'`, ", verificadas_ed1 = 4");
    await pub(`'n1','n2','n3'`, ", layout_ed1 = 'grid'");
  });

  test("o motivo só depois do latch; resultado e chave nunca gravados; fim com carimbo", async () => {
    await naSessao("motivo_ed1 = 'visual'");
    await naSessao(`${publicada}, passo = 'resultado'`);
    await naSessao(`${publicada}, passo = 'chave'`);
    await naSessao(`${publicada}, motivo_ed1 = 'visual', passo = 'revisao'`);
    await naSessao("passo = 'fim'");
  });

  test("o pacote: IA só homologada, oito notícias, e UM ativo por turma", async () => {
    const noticias = JSON.stringify(NOTICIAS_PADRAO).replace(/'/g, "''");
    const inserir = (origem: string, json: string, ativo: boolean, extra = "") =>
      `INSERT INTO exp04ef1b_pacotes (escola_id, turma_id, disciplina, tema, origem, noticias, ativo${extra ? ", aprovado_por, aprovado_em" : ""}) VALUES ('${ESCOLA}', '${ids.turma}'::uuid, 'Ciências', 'Um tema qualquer', '${origem}', '${json}'::jsonb, ${ativo}${extra})`;
    await falha(inserir("ia", noticias, false));
    await falha(inserir("padrao", "[]", false));
    // O índice único PARCIAL: a turma já tem o pacote ativo que nasceu na entrada da Ana.
    expect(pacoteId).not.toBe("");
    await falha(inserir("padrao", noticias, true));
    await falha(inserir("ia", noticias, false, `, '${ids.professora}'::uuid, NULL`));
  });

  test("o gate: carimbo do portão coerente com a etapa", async () => {
    await falha(`UPDATE exp04ef1b_gates_turma SET etapa = 'resultado' WHERE turma_id = '${ids.turma}'::uuid`);
    await falha(`UPDATE exp04ef1b_gates_turma SET revisao_liberada_em = now() WHERE turma_id = '${ids.turma}'::uuid`);
  });

  test("a diagramação: a chave são três ids, e o layout é do enum", async () => {
    const inserir = (chave: string, layout: string) =>
      falha(
        `INSERT INTO exp04ef1b_diagramacoes (escola_id, pacote_id, chave, layout) VALUES ('${ESCOLA}', '${pacoteId}'::uuid, '${chave}', '${layout}')`,
      );
    await inserir("n1,n2", "classic");
    await inserir("n1,n2,n3", "grid");
  });
});

describe("a porta da sala, a primeira entrada e garantirPacote", () => {
  beforeAll(zerarMissao);

  test("sem liberação na turma: 403 `missao-nao-liberada`, na sessão E no polling", async () => {
    expect(await codigoDe(entrar(ids.fabi, ids.turmaSemLiberacao))).toBe("missao-nao-liberada");
    expect(await codigoDe(service.gate(ESCOLA, ids.fabi, ids.turmaSemLiberacao))).toBe("missao-nao-liberada");
    expect(await prisma.exp04ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.fabi } })).toBe(0);
  });

  test("a primeira entrada cria o pacote `padrao` e o gate — e a missão não nasce vazia", async () => {
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s).toMatchObject({ rodada: 1, etapa: "exploracao", passo: "desafio", edicao1: null, blocos: null, chaveTentativas: 0 });
    expect(s.pacote.tema).toBe(TEMA_PADRAO);
    expect(s.pacote.noticias.map((n) => n.id)).toEqual(["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"]);
    const pacote = await prisma.exp04ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, ativo: true } });
    expect(pacote).toMatchObject({ origem: "padrao", aprovadoPor: null, id: s.pacoteId });
    await entrar(ids.bia);
    await entrar(ids.ana);
    expect(await prisma.exp04ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turma } })).toBe(1);
    expect(await prisma.exp04ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(1);
  });

  test("as notícias saem SEM o gabarito, as pistas e a consequência", async () => {
    const json = JSON.stringify(await entrar(ids.ana));
    for (const chave of ["gabarito", "publicavel", "pilarEmFalta", "explicacao", "consequencia", "pistas"]) {
      expect({ chave, tem: json.includes(`"${chave}"`) }).toEqual({ chave, tem: false });
    }
    for (const n of NOTICIAS_PADRAO) {
      expect(json).not.toContain(n.pistas.data);
      expect(json).not.toContain(n.consequencia.fala);
    }
  });

  test("seis primeiras entradas SIMULTÂNEAS numa turma nova: um pacote e um gate", async () => {
    const r = await Promise.all(ids.corrida.map((id) => entrar(id, ids.turmaCorrida)));
    expect(new Set(r.map((s) => s.pacoteId)).size).toBe(1);
    expect(await prisma.exp04ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaCorrida } })).toBe(1);
    expect(await prisma.exp04ef1bGateTurma.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaCorrida } })).toBe(1);
    expect(await prisma.exp04ef1bSessao.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaCorrida } })).toBe(6);
  });

  test("o preparo de uma turma sem nenhuma entrada também tem pacote (GET pacotes e painel)", async () => {
    const pacotes = PacotesSchema.parse(await service.pacotes(ESCOLA, ids.turmaVazia, undefined));
    expect(pacotes.ativo).toMatchObject({ origem: "padrao", rodada: 1, etapa: "exploracao", tema: TEMA_PADRAO });
    expect(pacotes.ativo.noticias).toHaveLength(8);
    expect(pacotes.historico).toHaveLength(1);
    PainelSchema.parse(await service.painel(ESCOLA, ids.turmaVazia, undefined));
    expect(await prisma.exp04ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaVazia } })).toBe(1);
  });

  test("o polling do gate é magro e responde a etapa, a rodada e o passo", async () => {
    const g = await service.gate(ESCOLA, ids.ana, ids.turma);
    expect(g).toMatchObject({ etapa: "exploracao", rodada: 1, passoEfetivo: "desafio", aguardandoOProfessor: false });
  });
});

describe("as pistas", () => {
  beforeAll(zerarMissao);

  test("no desafio, a pista não abre", async () => {
    await entrar(ids.ana);
    expect(await codigoDe(pista(ids.ana, "n1", "fonte"))).toBe("passo-invalido");
  });

  test("na mesa, o texto vem do servidor, e abrir de novo não conta", async () => {
    await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "mesa");
    const r = PistaReveladaSchema.parse(await pista(ids.ana, "n2", "data"));
    expect(r).toEqual({ noticiaId: "n2", tipo: "data", fase: 1, texto: NOTICIAS_PADRAO[1]!.pistas.data, abertas: 1 });
    expect((await pista(ids.ana, "n2", "data")).abertas).toBe(1);
    expect((await pista(ids.ana, "n2", "fonte")).abertas).toBe(2);
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s.pistasAbertas).toEqual([
      { noticiaId: "n2", tipo: "data", fase: 1, texto: NOTICIAS_PADRAO[1]!.pistas.data },
      { noticiaId: "n2", tipo: "fonte", fase: 1, texto: NOTICIAS_PADRAO[1]!.pistas.fonte },
    ]);
  });

  test("`iniciadaEm` é o `criado_em` da sessão", async () => {
    const s = await entrar(ids.ana);
    const linha = await prisma.exp04ef1bSessao.findUniqueOrThrow({ where: { id: s.sessaoId } });
    expect(s.iniciadaEm).toBe(linha.criadoEm.toISOString());
  });
});

describe("os latches, o motivo e os portões", () => {
  beforeAll(zerarMissao);

  test("dois toques simultâneos em Publicar: um publica, o outro recebe 409 `edicao-ja-publicada`", async () => {
    await naMesa(ids.ana);
    await abrirTodas(ids.ana, ["n1", "n4"]);
    const [a, b] = await Promise.allSettled([
      service.publicar(ESCOLA, ids.ana, ids.turma, publicacao(["n1", "n2", "n3"])),
      service.publicar(ESCOLA, ids.ana, ids.turma, publicacao(["n4", "n6", "n8"])),
    ]);
    const estados = [a, b].map((r) => (r.status === "fulfilled" ? "publicou" : r.reason));
    expect(estados.filter((e) => e === "publicou")).toHaveLength(1);
    const recusa = estados.find((e) => e !== "publicou");
    expect((recusa as HttpException).getResponse()).toMatchObject({ codigo: "edicao-ja-publicada" });

    const sessao = await prisma.exp04ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(sessao.passo).toBe("motivo");
    // As verificadas foram calculadas NO SERVIDOR, a partir do gabarito.
    expect([1, 3]).toContain(sessao.verificadasEd1);
    expect(await codigoDe(service.publicar(ESCOLA, ids.ana, ids.turma, publicacao(["n1", "n2", "n3"])))).toBe(
      "edicao-ja-publicada",
    );
  });

  test("a resposta do latch NÃO traz o resultado, e a EF15CO04 foi marcada pelas pistas", async () => {
    const s = EstadoSchema.parse(await entrar(ids.ana));
    expect(JSON.stringify(s)).not.toMatch(/verificadas|reacoes|percentual/);
    expect(await evidenciaDe(ids.ana, "EF15CO04")).toMatchObject([{ status: "atingiu", origem: "propria", rodada: 1 }]);
    await publicar(ids.bia, ["n2", "n3", "n5"]);
    expect(await evidenciaDe(ids.bia, "EF15CO04")).toMatchObject([{ status: "nao_atingiu" }]);
  });

  test("o resultado espera a edição, o motivo e o portão — nesta ordem", async () => {
    await entrar(ids.caio);
    expect(await codigoDe(service.resultado(ESCOLA, ids.caio, ids.turma))).toBe("edicao-nao-publicada");
    expect(await codigoDe(service.resultado(ESCOLA, ids.ana, ids.turma))).toBe("motivo-pendente");
    expect(await codigoDe(service.responderMotivo(ESCOLA, ids.caio, ids.turma, "visual"))).toBe("edicao-nao-publicada");
  });

  test("o motivo, uma vez só — inclusive com dois toques", async () => {
    const [a, b] = await Promise.allSettled([
      service.responderMotivo(ESCOLA, ids.ana, ids.turma, "checagem"),
      service.responderMotivo(ESCOLA, ids.ana, ids.turma, "visual"),
    ]);
    expect([a, b].filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusa = [a, b].find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((recusa.reason as HttpException).getResponse()).toMatchObject({ codigo: "motivo-ja-respondido" });
    expect(await codigoDe(service.responderMotivo(ESCOLA, ids.ana, ids.turma, "visual"))).toBe("motivo-ja-respondido");
    const s = await entrar(ids.ana);
    expect(s).toMatchObject({ passo: "publicada", motivoRespondido: true, aguardandoOProfessor: true });
    expect(await codigoDe(service.resultado(ESCOLA, ids.ana, ids.turma))).toBe("resultado-nao-liberado");
  });

  test("o botão do professor não pula e aceita o segundo clique; o portão grava o carimbo", async () => {
    expect(await codigoDe(etapa("revisao"))).toBe("transicao-de-etapa-invalida");
    const r = await etapa("resultado");
    expect(r).toMatchObject({ etapa: "resultado", proximaEtapa: "revisao" });
    expect((await etapa("resultado")).etapa).toBe("resultado");
    const gate = await prisma.exp04ef1bGateTurma.findUniqueOrThrow({
      where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: ids.turma } },
    });
    expect(gate.resultadoLiberadoEm).not.toBeNull();
    expect(gate.revisaoLiberadaEm).toBeNull();
  });

  test("com o portão aberto: o resultado da Ana, e a Bia ainda no motivo", async () => {
    const r = ResultadoSchema.parse(await service.resultado(ESCOLA, ids.ana, ids.turma));
    expect(r.edicao1.reacoes.map((x) => x.noticiaId)).toEqual(r.edicao1.slots);
    expect(r.edicao1.percentual).toBe(Math.round((r.edicao1.verificadas / 3) * 100));
    expect((await entrar(ids.bia)).passo).toBe("motivo");
    expect(await codigoDe(service.resultado(ESCOLA, ids.bia, ids.turma))).toBe("motivo-pendente");
  });

  test("a publicação ATRASADA: o Caio monta a página com o resultado liberado", async () => {
    const s = await naMesa(ids.caio);
    expect(s.passo).toBe("mesa");
    await service.publicar(ESCOLA, ids.caio, ids.turma, publicacao(["n1", "n4", "n6"]));
    await service.responderMotivo(ESCOLA, ids.caio, ids.turma, "checagem");
    const r = await service.resultado(ESCOLA, ids.caio, ids.turma);
    expect(r.edicao1).toMatchObject({ verificadas: 3, percentual: 100 });
  });
});

describe("a Chave, a revisão, a 2ª edição e o Desafio Final", () => {
  beforeAll(async () => {
    await zerarMissao();
    await naMesa(ids.ana);
    await abrirTodas(ids.ana, ["n1", "n2"]);
    await service.publicar(ESCOLA, ids.ana, ids.turma, publicacao(["n2", "n1", "n3"]));
    await service.responderMotivo(ESCOLA, ids.ana, ids.turma, "visual");
    await etapa("resultado");
  });

  test("antes da revisão, a Chave não abre e os blocos não descem", async () => {
    expect(await codigoDe(service.tentarChave(ESCOLA, ids.ana, ids.turma, ["fonte", "data", "autoria"]))).toBe(
      "revisao-nao-liberada",
    );
    expect((await entrar(ids.ana)).blocos).toBeNull();
    expect(await codigoDe(service.revisao(ESCOLA, ids.ana, ids.turma))).toBe("chave-nao-formada");
  });

  test("com a revisão, a bandeja desce com os seis — e estável num F5", async () => {
    await etapa("revisao");
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s.passo).toBe("chave");
    expect(s.blocos?.map((b) => b.id).sort()).toEqual(["autoria", "compartilhada", "data", "fonte", "foto", "urgencia"]);
    expect((await entrar(ids.ana)).blocos).toEqual(s.blocos);
  });

  test("a isca conta tentativa e volta à bandeja; a Chave forma na segunda, e a EF15CO02 é 'em processo'", async () => {
    const t1 = TentativaDaChaveSchema.parse(await service.tentarChave(ESCOLA, ids.ana, ids.turma, ["fonte", "foto", "data"], 1));
    expect(t1).toMatchObject({ sucesso: false, tentativas: 1, devolvidos: ["foto"] });
    expect(t1.estado.chaveTentativas).toBe(1);
    /* O REENVIO da tentativa 1 (a resposta se perdeu na rede) — sozinho e em dois
       ao mesmo tempo — não conta: devolve o resultado gravado. */
    expect(await service.tentarChave(ESCOLA, ids.ana, ids.turma, ["fonte", "foto", "data"], 1)).toMatchObject({
      sucesso: false,
      tentativas: 1,
      devolvidos: ["foto"],
    });
    const reenvios = await Promise.all([
      service.tentarChave(ESCOLA, ids.ana, ids.turma, ["fonte", "foto", "data"], 1),
      service.tentarChave(ESCOLA, ids.ana, ids.turma, ["fonte", "foto", "data"], 1),
    ]);
    expect(reenvios.map((r) => r.tentativas)).toEqual([1, 1]);
    const gravada = await prisma.exp04ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(gravada.chaveTentativas).toBe(1);

    const t2 = await service.tentarChave(ESCOLA, ids.ana, ids.turma, ["autoria", "fonte", "data"], 2);
    expect(t2).toMatchObject({ sucesso: true, tentativas: 2, devolvidos: [] });
    expect(t2.estado).toMatchObject({ passo: "revisao", chaveFormada: true, chaveTentativas: 2 });
    expect(EstadoSchema.parse(await entrar(ids.ana)).chaveTentativas).toBe(2);
    expect(await evidenciaDe(ids.ana, "EF15CO02")).toMatchObject([{ status: "em_processo" }]);
    // Formada: o reenvio da 2 (dois ao mesmo tempo) e um envio sem número respondem sucesso sem contar nem marcar.
    const [r1, r2] = await Promise.all([
      service.tentarChave(ESCOLA, ids.ana, ids.turma, ["autoria", "fonte", "data"], 2),
      service.tentarChave(ESCOLA, ids.ana, ids.turma, ["autoria", "fonte", "data"], 2),
    ]);
    expect([r1.sucesso, r1.tentativas, r2.sucesso, r2.tentativas]).toEqual([true, 2, true, 2]);
    expect(await service.tentarChave(ESCOLA, ids.ana, ids.turma, ["foto", "urgencia", "compartilhada"])).toMatchObject({
      sucesso: true,
      tentativas: 2,
    });
    expect((await marcasDe("chave")).filter((m) => m.estudanteId === ids.ana)).toEqual([
      { estudanteId: ids.ana, status: "em_processo", rodada: 1 },
    ]);
  });

  test("sem número, todo envio conta — e um número à frente do gravado conta UMA", async () => {
    await naMesa(ids.duda);
    await service.publicar(ESCOLA, ids.duda, ids.turma, publicacao(["n1", "n4", "n6"]));
    await service.responderMotivo(ESCOLA, ids.duda, ids.turma, "checagem");
    expect((await service.tentarChave(ESCOLA, ids.duda, ids.turma, ["foto", "data", "fonte"])).tentativas).toBe(1);
    expect((await service.tentarChave(ESCOLA, ids.duda, ids.turma, ["foto", "data", "fonte"])).tentativas).toBe(2);
    expect((await service.tentarChave(ESCOLA, ids.duda, ids.turma, ["urgencia", "data", "fonte"], 7)).tentativas).toBe(3);
  });

  test("a mesa de revisão marca as vagas, e as pistas da fase 2 registram", async () => {
    expect(await service.revisao(ESCOLA, ids.ana, ids.turma)).toEqual({
      vagas: [
        { noticiaId: "n2", pilarEmFalta: "data" },
        { noticiaId: "n1", pilarEmFalta: null },
        { noticiaId: "n3", pilarEmFalta: "autoria" },
      ],
    });
    await abrirTodas(ids.ana, ["n4"]);
    const r = await pista(ids.ana, "n1", "data");
    expect(r).toMatchObject({ fase: 2, abertas: 9 });
    const s = await prisma.exp04ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect((s.pistas as Array<{ fase: number }>).filter((p) => p.fase === 2)).toHaveLength(4);
    // O par aberto nas duas fases aparece DUAS vezes na lista da tela.
    const tela = (await entrar(ids.ana)).pistasAbertas.filter((p) => p.noticiaId === "n1" && p.tipo === "data");
    expect(tela.map((p) => p.fase)).toEqual([1, 2]);
  });

  test("dois toques em Republicar: um publica, o outro 409; a EF04CO08 é marcada pelo `edicao-2`", async () => {
    const [a, b] = await Promise.allSettled([
      service.republicar(ESCOLA, ids.ana, ids.turma, publicacao(["n1", "n4", "n6"])),
      service.republicar(ESCOLA, ids.ana, ids.turma, publicacao(["n2", "n3", "n5"])),
    ]);
    expect([a, b].filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusa = [a, b].find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((recusa.reason as HttpException).getResponse()).toMatchObject({ codigo: "edicao-ja-publicada" });
    const s = await prisma.exp04ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(s.passo).toBe("comparativo");
    /* Nove pares abertos nas duas fases: "atingiu" com a 2ª em 3/3; senão, em processo. */
    const esperado = s.verificadasEd2 === 3 ? "atingiu" : "em_processo";
    expect(await evidenciaDe(ids.ana, "EF04CO08")).toMatchObject([{ status: esperado, origem: "propria" }]);
  });

  test("o comparativo tem as duas edições e o pilar de cada notícia delas", async () => {
    const c = ComparativoSchema.parse(await service.comparativo(ESCOLA, ids.ana, ids.turma));
    expect(c.edicao1.slots).toEqual(["n2", "n1", "n3"]);
    const todas = new Set([...c.edicao1.slots, ...c.edicao2.slots]);
    expect(new Set(c.vagas.map((v) => v.noticiaId))).toEqual(todas);
    expect(await codigoDe(service.comparativo(ESCOLA, ids.caio, ids.turma))).toBe("edicao-nao-publicada");
  });

  test("o resolvedor: `null` antes do Desafio Final, o contexto nele — e a primeira resposta vale", async () => {
    const antes = await prisma.comTenancy((tx) => service.contextoDaAtividade(tx, ESCOLA, ids.ana), ESCOLA);
    expect(antes).toBeNull();
    expect(await codigoDe(evidencias.responder(ESCOLA, ids.ana, EXP_ID, "p1", "A1"))).toBe("sem-atividade-em-andamento");
    expect(await codigoDe(service.concluir(ESCOLA, ids.ana, ids.turma))).toBe("passo-invalido");

    const s = await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "transferencia");
    expect(s.passo).toBe("transferencia");
    const contexto = await prisma.comTenancy((tx) => service.contextoDaAtividade(tx, ESCOLA, ids.ana), ESCOLA);
    expect(contexto).toEqual({ turmaId: ids.turma, atividadeId: s.pacoteId, rodada: 1 });
    expect(await evidencias.responder(ESCOLA, ids.ana, EXP_ID, "p1", "A1")).toEqual({ enviada: true });
    expect(await evidencias.responder(ESCOLA, ids.ana, EXP_ID, "p1", "A3")).toEqual({ enviada: true });
    expect(await evidenciaDe(ids.ana, "EF04CO08")).toMatchObject([{ status: "atingiu" }]);
  });

  test("concluir é idempotente e carimba `concluidaEm`", async () => {
    const a = await service.concluir(ESCOLA, ids.ana, ids.turma);
    expect(a.passo).toBe("fim");
    expect(a.concluidaEm).not.toBeNull();
    expect((await service.concluir(ESCOLA, ids.ana, ids.turma)).concluidaEm).toBe(a.concluidaEm);
  });

  test("depois de zerar: o resolvedor devolve `null`, a rodada 2 abre limpa e os portões fecham", async () => {
    const z = await service.zerar(ESCOLA, ids.turma, ids.professora);
    expect(z).toMatchObject({ rodada: 2, etapa: "exploracao" });
    const contexto = await prisma.comTenancy((tx) => service.contextoDaAtividade(tx, ESCOLA, ids.ana), ESCOLA);
    expect(contexto).toBeNull();
    const gate = await prisma.exp04ef1bGateTurma.findUniqueOrThrow({
      where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: ids.turma } },
    });
    expect(gate).toMatchObject({ rodada: 2, etapa: "exploracao", resultadoLiberadoEm: null, revisaoLiberadaEm: null });
    const s = await entrar(ids.ana);
    expect(s).toMatchObject({ rodada: 2, passo: "desafio", edicao1: null });
    expect(await prisma.exp04ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(2);
  });

  test("na rodada 2 do MESMO pacote, quem já foi avaliada não é marcada de novo (ADR-120)", async () => {
    await naMesa(ids.ana);
    await abrirTodas(ids.ana, ["n1", "n4"]);
    await service.publicar(ESCOLA, ids.ana, ids.turma, publicacao(["n1", "n4", "n6"]));
    expect((await marcasDe("pistas")).filter((m) => m.estudanteId === ids.ana).map((m) => m.rodada)).toEqual([1]);
  });
});

describe("atividade × rodada: pacote novo volta à 1, o mesmo é idempotente", () => {
  beforeAll(zerarMissao);

  const corpo = (tema: string, noticias: NoticiaDoPacote[] = noticiasPadrao(), origem: "padrao" | "ia" = "ia") => ({
    disciplina: "Ciências",
    tema,
    origem,
    noticias,
  });

  test("homologar o banco padrão com o padrão já ativo não cria atividade: só carimba quem aprovou", async () => {
    const antes = await entrar(ids.ana);
    const r = await service.homologar(ESCOLA, ids.turma, ids.professora, ids.professora, {
      ...corpo(TEMA_PADRAO, noticiasPadrao(), "padrao"),
      disciplina: "Projeto interdisciplinar",
    });
    expect(r.id).toBe(antes.pacoteId);
    const pacote = await prisma.exp04ef1bPacote.findUniqueOrThrow({ where: { id: antes.pacoteId } });
    expect(pacote.aprovadoPor).toBe(ids.professora);
    expect(pacote.aprovadoEm).not.toBeNull();
    expect(await prisma.exp04ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turma } })).toBe(1);
  });

  test("pacote novo é ATIVIDADE nova: o anterior sai de cena (e fica), e o gate volta à rodada 1", async () => {
    const anterior = await entrar(ids.ana);
    await service.zerar(ESCOLA, ids.turma, ids.professora);
    const noticias = noticiasPadrao().map((n) => (n.id === "n1" ? { ...n, manchete: "Feira de Ciências abre inscrições para toda a escola" } : n));
    const novo = await service.homologar(ESCOLA, ids.turma, ids.professora, ids.professora, corpo("A feira da escola", noticias));
    expect(novo).toMatchObject({ rodada: 1, etapa: "exploracao", origem: "ia" });
    expect(novo.id).not.toBe(anterior.pacoteId);
    const s = await entrar(ids.ana);
    expect(s).toMatchObject({ pacoteId: novo.id, rodada: 1, passo: "desafio" });
    const pacotes = PacotesSchema.parse(await service.pacotes(ESCOLA, ids.turma, ids.professora));
    expect(pacotes.ativo.id).toBe(novo.id);
    expect(pacotes.historico.map((p) => [p.ativo, p.rodadas])).toEqual([
      [true, 1],
      [false, 1],
    ]);
    // O mesmo conteúdo de novo (o segundo clique em Aprovar) não cria nada, nem zera a aula.
    await etapa("resultado");
    const deNovo = await service.homologar(ESCOLA, ids.turma, ids.professora, ids.professora, corpo("A feira da escola", noticias));
    expect(deNovo).toMatchObject({ id: novo.id, etapa: "resultado", rodada: 1 });
    expect(await prisma.exp04ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turma } })).toBe(2);
  });

  test("turma que o professor não leciona é 404, nunca 403", async () => {
    expect(await codigoDe(service.painel(ESCOLA, ids.turma, ids.outroProfessor))).toBe("turma-nao-encontrada");
    expect(await codigoDe(service.zerar(ESCOLA, ids.turma, ids.outroProfessor))).toBe("turma-nao-encontrada");
    expect(await codigoDe(service.pacotes(ESCOLA, ids.turma, ids.outroProfessor))).toBe("turma-nao-encontrada");
  });
});

describe("o painel POR COMPUTADOR, e a cópia para a equipe", () => {
  beforeAll(async () => {
    await zerarMissao();
    /* Dois computadores (Ana+Bia × Caio+Duda) e o Enzo AUSENTE na montagem. */
    await montarEquipes(
      [
        [ids.ana, ids.bia],
        [ids.caio, ids.duda],
      ],
      2,
      [ids.enzo],
    );
    await naMesa(ids.ana);
    await abrirTodas(ids.ana, ["n1", "n4"]);
    await service.publicar(ESCOLA, ids.ana, ids.turma, publicacao(["n1", "n4", "n2"]));
    await service.responderMotivo(ESCOLA, ids.ana, ids.turma, "checagem");
    await entrar(ids.caio);
  });

  test("a evidência da Ana é copiada para a Bia, a colega de computador", async () => {
    expect(await evidenciaDe(ids.ana, "EF15CO04")).toMatchObject([{ status: "atingiu", origem: "propria" }]);
    expect(await evidenciaDe(ids.bia, "EF15CO04")).toMatchObject([{ status: "atingiu", origem: "equipe" }]);
  });

  test("uma linha por computador, e o Y do \"X de Y\" vem da montagem", async () => {
    const painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.professora));
    expect(painel.resumo.porComputador).toBe(true);
    expect(painel.linhas.slice(0, 2).map((l) => l.equipe?.nome)).toEqual(["Equipe 1", "Equipe 2"]);
    const [equipe1, equipe2] = painel.linhas;
    expect(equipe1).toMatchObject({ estudanteId: ids.ana, entrou: true, iniciou: true, publicouAPrimeira: true, pistasAbertas: 6 });
    expect(equipe2).toMatchObject({ estudanteId: ids.caio, entrou: true, iniciou: false, passo: "desafio" });
    expect(painel.resumo.computadores).toEqual({ publicaram: 1, total: 2 });
    expect(painel.resumo).toMatchObject({ publicaramAPrimeira: 1, formaramAChave: 0 });
    expect(painel.resumo.histograma.edicao1).toEqual([0, 0, 1, 0]);
    expect(painel.resumo.motivos).toEqual({ visual: 0, checagem: 1 });
    const radar = new Map(painel.resumo.radar.map((r) => [r.noticiaId, r.naEdicao1]));
    expect([radar.get("n1"), radar.get("n2"), radar.get("n3")]).toEqual([1, 1, 0]);
  });

  test("nenhuma chave do painel ordena crianças", async () => {
    const painel = await service.painel(ESCOLA, ids.turma, ids.professora);
    const chavesDe = (valor: unknown): string[] =>
      valor === null || typeof valor !== "object"
        ? []
        : Array.isArray(valor)
          ? valor.flatMap(chavesDe)
          : Object.entries(valor as Record<string, unknown>).flatMap(([k, v]) => [k, ...chavesDe(v)]);
    const linhas = painel.linhas.flatMap((l) => Object.keys(l)).map((c) => c.toLowerCase());
    for (const proibido of PROIBIDO_NA_LINHA_DO_PAINEL) {
      expect({ proibido, colisao: [...new Set(linhas.filter((c) => c.includes(proibido)))] }).toEqual({ proibido, colisao: [] });
    }
    expect(chavesDe(painel)).not.toContain("verificadas");
  });

  test("a leitura do PROFESSOR conta o EVT-P04; a do gestor lê o mesmo painel e não conta", async () => {
    const pacote = () => prisma.exp04ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma, ativo: true } });
    const antes = (await pacote()).painelVistas;
    await service.painel(ESCOLA, ids.turma, ids.professora);
    expect((await pacote()).painelVistas).toBe(antes + 1);
    const doGestor = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, undefined));
    expect(doGestor.linhas).toHaveLength(PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.professora)).linhas.length);
    expect((await pacote()).painelVistas).toBe(antes + 2);
    expect((await pacote()).painelVistoEm).not.toBeNull();
  });
});

describe("a diagramação com IA falsa, e o cache", () => {
  beforeEach(zerarMissao);

  const PAGINA: IdDeNoticia[] = ["n1", "n3", "n5"];
  const diagramar = (estudanteId: string, servico = service) => servico.diagramar(ESCOLA, estudanteId, ids.turma, PAGINA);

  test("fora da mesa e da revisão, não diagrama", async () => {
    await entrar(ids.gabi);
    expect(await codigoDe(diagramar(ids.gabi))).toBe("passo-invalido");
  });

  test("a IA desligada (o mock) cai no modelo automático, sem gravar cache", async () => {
    await naMesa(ids.gabi);
    expect(await diagramar(ids.gabi)).toEqual({ layout: "hero-image", origem: "modelo" });
    expect(await prisma.exp04ef1bDiagramacao.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("válida: o layout da IA, gravado no cache — e a mesma página de outra criança não chama a IA", async () => {
    ia.resposta = { layout: "columns" };
    await naMesa(ids.hugo);
    expect(await diagramar(ids.hugo)).toEqual({ layout: "columns", origem: "ia" });
    expect(await quota.usadoHoje(ESCOLA, ids.hugo)).toBe(20);
    const chamadas = ia.chamadas;
    await naMesa(ids.iris);
    ia.resposta = { layout: "classic" };
    expect(await diagramar(ids.iris)).toEqual({ layout: "columns", origem: "ia" });
    expect(ia.chamadas).toBe(chamadas);
    expect(await prisma.exp04ef1bDiagramacao.findMany({ where: { escolaId: ESCOLA }, select: { chave: true, layout: true } })).toEqual([
      { chave: "n1,n3,n5", layout: "columns" },
    ]);
  });

  test("inválida (fora do enum): o modelo, sem cache", async () => {
    ia.resposta = { layout: "grid" };
    await naMesa(ids.iris);
    expect(await diagramar(ids.iris)).toEqual({ layout: "hero-image", origem: "modelo" });
    expect(await prisma.exp04ef1bDiagramacao.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("sem saldo: nem chama a IA, e o modelo diagrama", async () => {
    const semSaldo = new JornalEscolaService(prisma, evidencias, new DiagramacaoService(ia, new QuotaZerada(prisma), prisma, 300));
    ia.resposta = { layout: "columns" };
    const antes = ia.chamadas;
    await naMesa(ids.joao);
    expect(await diagramar(ids.joao, semSaldo)).toEqual({ layout: "hero-image", origem: "modelo" });
    expect(ia.chamadas).toBe(antes);
  });

  test("atrasada: perde para o teto, o modelo diagrama — e a chamada é cobrada quando chega", async () => {
    ia.resposta = { layout: "columns" };
    ia.atrasoMs = 700;
    await naMesa(ids.gabi);
    expect(await diagramar(ids.gabi)).toEqual({ layout: "hero-image", origem: "modelo" });
    await new Promise((r) => setTimeout(r, 900));
    expect(await quota.usadoHoje(ESCOLA, ids.gabi)).toBe(20);
    expect(await prisma.exp04ef1bDiagramacao.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });
});

describe("o preparo com IA falsa", () => {
  beforeEach(zerarMissao);

  /** Dois geradores IGUAIS: um para o serviço, outro para a suíte saber o molde que ele sorteou. */
  const gerador = () => {
    let x = 42;
    return () => {
      x = (x * 16807) % 2147483647;
      return (x - 1) / 2147483646;
    };
  };

  /** Uma saída da IA que respeita o molde: o texto do banco padrão, com o papel e a imagem da vaga. */
  function saidaNoMolde() {
    const molde = sortearMolde(gerador());
    const porMeio = new Map(NOTICIAS_PADRAO.map((n) => [n.meio, n]));
    return {
      noticias: molde.map((v) => {
        const base = porMeio.get(v.meio)!;
        const g = gabaritoDoPapel(v.papel);
        return emFormatoDaIa({
          ...base,
          id: v.id,
          falante: v.comFalante ? (base.falante ?? "Fulano de Tal") : null,
          descricaoImagem: v.comImagem ? (base.descricaoImagem ?? "Ilustração colorida de uma cena da escola, vista de longe.") : null,
          legenda: v.comImagem ? (base.legenda ?? "Cena da escola") : null,
          gabarito: { ...base.gabarito, ...g },
        });
      }),
    };
  }

  test("válida: o rascunho sai no molde, e a geração conta no EVT-P02", async () => {
    const preparo = new PreparoDaExp04ef1bService(ia, quota, gerador());
    ia.resposta = saidaNoMolde();
    const r = await preparo.gerar(ESCOLA, ids.professora, "professor", { disciplina: "Ciências", tema: "A feira da escola" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toHaveLength(8);
    await service.registrarGeracao(ESCOLA, ids.turma, r.tokens);
    const pacote = await prisma.exp04ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma, ativo: true } });
    expect(pacote).toMatchObject({ geracoes: 1, tokensUsados: 20 });
    expect(await quota.usadoHoje(ESCOLA, ids.professora)).toBe(20);
  });

  test("a IA fora do ar: `ia-indisponivel`, e o que foi pago é debitado", async () => {
    const preparo = new PreparoDaExp04ef1bService(ia, quota, gerador());
    const r = await preparo.gerar(ESCOLA, ids.professora, "professor", { disciplina: "Ciências", tema: "A feira da escola" });
    expect(r).toMatchObject({ ok: false, codigo: "ia-indisponivel", chamouIa: true });
    expect(await quota.usadoHoje(ESCOLA, ids.professora)).toBeGreaterThan(0);
  });

  test("sem saldo: `sem-saldo-de-ia`, sem chamar a IA", async () => {
    const preparo = new PreparoDaExp04ef1bService(ia, new QuotaZerada(prisma), gerador());
    const antes = ia.chamadas;
    const r = await preparo.gerar(ESCOLA, ids.professora, "professor", { disciplina: "Ciências", tema: "A feira da escola" });
    expect(r).toMatchObject({ ok: false, codigo: "sem-saldo-de-ia", chamouIa: false });
    expect(ia.chamadas).toBe(antes);
  });

  test("regenerar sem IA devolve a notícia COMO ESTAVA: a do pacote ativo, pelo id", async () => {
    await entrar(ids.ana);
    const alvo = NOTICIAS_PADRAO[4]!;
    const comoEstava = await service.noticiaComoEstava(ESCOLA, ids.turma, { id: alvo.id, meio: alvo.meio, gabarito: alvo.gabarito });
    expect(comoEstava).toEqual(alvo);
  });
});
