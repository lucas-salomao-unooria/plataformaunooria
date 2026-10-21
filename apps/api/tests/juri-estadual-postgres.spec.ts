import { HttpException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider, AiResult } from "../src/ai/provider";
import { QuotaService, perfilDaQuota } from "../src/ai/quota.service";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { conteudoDoBancoPadrao } from "../src/juri-estadual/banco-padrao";
import {
  EstadoSchema,
  FeedSchema,
  GaleriaSchema,
  GatePublicoSchema,
  PacotesSchema,
  PainelSchema,
  RespostaDaRegraSchema,
  SessaoSchema,
} from "../src/juri-estadual/contrato-de-rotas";
import { EXP_ID, JuriEstadualService } from "../src/juri-estadual/juri-estadual.service";
import { FALAS_DO_TEMA_PADRAO } from "../src/juri-estadual/podcast";
import { fonteDoPodcastDaExp06ef1b } from "../src/juri-estadual/podcast-fonte";
import { PreparoDaExp06ef1bService } from "../src/juri-estadual/preparo.service";
import { PROIBIDO_NA_LINHA_DO_PAINEL } from "../src/juri-estadual/regras/painel";
import { ETAPAS, PASSOS } from "../src/juri-estadual/regras/passos";
import { pecasCertas, pecasDaSessao } from "../src/juri-estadual/regras/regra";
import { AREAS, DISCIPLINAS, ID_DE_PROJETO_RE, VERSAO_DO_INSTRUMENTO, areaDoProjeto, type Area } from "../src/juri-estadual/vocabulario";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  PARAMETROS_DE_TESTE,
  areaDaIaDeTeste,
  categoriasDaIaDeTeste,
  conteudoDeTeste,
  conteudoLegadoDeTeste,
} from "./juri-estadual-fixture";

/** A IA do preparo por área: as categorias, ou os dez projetos da área que o prompt pede. */
const respostaDoPreparo = (estragar?: Area) => (req: AiJsonRequest<unknown>) => {
  const area = AREAS.find((a) => req.prompt.includes(`A área destes projetos é ${a}`));
  if (!area) return categoriasDaIaDeTeste();
  if (area === estragar) return { projetos: [] };
  return areaDaIaDeTeste(area);
};
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp06ef1b no Postgres (PRD v2): a RLS das quatro tabelas e os
 * CHECKs, a porta da sala, o feed afunilado e saturado servido pelo motor, o
 * relógio de 8 minutos, o batimento da cédula, os dois latches concorrentes,
 * o portão da galeria, o "Manter" que pede um oculto aberto, a auditoria
 * (EF06CO10 e EF06CO01), a cadeia com ids opacos e o 422, as imagens aprovadas
 * antes de ir ao ar, o banco padrão, o caso Mariana, atividade × rodada, o
 * painel POR COMPUTADOR com os ociosos, a telemetria docente, o resolvedor das
 * enquetes e o preparo com IA falsa.
 *
 * UMA ESCOLA POR SUÍTE (mais a vizinha, para a RLS). Molde:
 * `jornal-escola-postgres.spec.ts`.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-juri-estadual";
const OUTRA_ESCOLA = "teste-juri-estadual-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

/**
 * O MESMO Prisma, com a role SEM `BYPASSRLS`. Sem isto a prova de isolamento
 * passa em falso: o usuário administrativo é SUPERUSER.
 */
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/**
 * A IA controlada pela suíte. Por padrão ela FALHA, como o mock. `resposta`
 * pode ser uma função do pedido: o preparo faz cinco chamadas diferentes (as
 * categorias e as quatro áreas).
 */
class IaControlada implements AiProvider {
  resposta: unknown = null;
  tokens = 20;
  chamadas = 0;
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    this.chamadas += 1;
    req.aoUsarTokens?.(this.tokens);
    if (this.resposta === null) throw new Error("IA de teste desligada");
    return req.validar(typeof this.resposta === "function" ? (this.resposta as (r: AiJsonRequest<T>) => unknown)(req) : this.resposta);
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
  conversarEmFluxo(): never {
    throw new Error("conversarEmFluxo não é usado nesta suíte");
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
const service = new JuriEstadualService(prisma, evidencias);

const ids = {
  turma: "",
  turmaSemLiberacao: "",
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
};

/**
 * A atividade que o professor criaria e poria no ar: a plataforma não cria
 * atividade (ADR-130), e esta missão nem tem acervo padrão — a suíte faz o
 * caminho dele, com a mostra da fixture no lugar da que a IA geraria.
 */
async function prepararAtividade(turmaId = ids.turma, escolaId = ESCOLA, tema?: string): Promise<string> {
  const criado = await service.homologar(escolaId, turmaId, undefined, ids.professora, {
    parametros: PARAMETROS_DE_TESTE,
    conteudo: conteudoDeTeste(tema),
    podcast: FALAS_DO_TEMA_PADRAO,
  });
  /* A segunda fase da aprovação (as imagens): sem ela, não vai ao ar. */
  await service.aprovarImagens(escolaId, turmaId, undefined, criado.id);
  await service.colocarEmAndamento(escolaId, turmaId, undefined, criado.id);
  return criado.id;
}

async function limparMissao() {
  /* O pacote leva o gate e as sessões por cascata. */
  await prisma.exp06ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.podcastRoteiro.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp06ef1bGateHistorico.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  ia.resposta = null;
}

async function zerarMissao() {
  await limparMissao();
  await prepararAtividade();
}

async function limpar() {
  await limparMissao();
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

const entrar = (estudanteId: string, turmaId = ids.turma, escolaId = ESCOLA) => service.sessao(escolaId, estudanteId, turmaId);
const sessaoDe = (estudanteId: string) =>
  prisma.exp06ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId }, orderBy: { criadoEm: "desc" } });
const etapa = (para: (typeof ETAPAS)[number]) => service.mudarEtapa(ESCOLA, ids.turma, ids.professora, para);
const semEventos = { curtidas: [], salvamentos: [], permanencias: [], proximo: true };
const curtindo = (curtidas: { postId: string; curtiu: boolean }[], proximo: boolean) => ({ curtidas, salvamentos: [], permanencias: [], proximo });

/**
 * Rola o feed até os dez. Com `area`, curte os dois primeiros posts dela que
 * chegarem — a bolha fecha. Com `modo: "salvar"`, SALVA os três primeiros (que
 * não pesam). Devolve o feed completo.
 */
async function rolarFeed(estudanteId: string, area?: Area, turmaId = ids.turma, escolaId = ESCOLA, modo: "curtir" | "salvar" = "curtir") {
  let feed = FeedSchema.parse(await service.pedirPasso(escolaId, estudanteId, turmaId, "feed"));
  const quantos = modo === "curtir" ? 2 : 3;
  let feitos = 0;
  const tocar = () => {
    const ja = modo === "curtir" ? feed.curtidos : feed.salvos;
    /* Salvar não pesa, então o feed sem foco gira as áreas e uma delas pode
       chegar só duas vezes: salva o que vier, de qualquer área. */
    const alvos = feed.posts
      .filter((p) => (modo === "salvar" || (area && p.area === area)) && !ja.includes(p.id))
      .slice(0, quantos - feitos);
    feitos += alvos.length;
    return alvos.map((p) => p.id);
  };
  while (!feed.completo) {
    const alvos = tocar();
    feed = FeedSchema.parse(
      await service.eventosDoFeed(escolaId, estudanteId, turmaId, {
        curtidas: modo === "curtir" ? alvos.map((postId) => ({ postId, curtiu: true })) : [],
        salvamentos: modo === "salvar" ? alvos.map((postId) => ({ postId, salvou: true })) : [],
        permanencias: [],
        proximo: true,
      }),
    );
  }
  return feed;
}

/**
 * A SEPARAÇÃO (EF06CO01) nas PASTAS do feed (ADR-176): salva cada estande que
 * o feed serviu na pasta da área dele. `erradas` = quantos dos primeiros
 * estandes vão para uma pasta errada. Devolve o feed como o servidor o deixou.
 */
async function guardarNasPastas(estudanteId: string, erradas = 0, turmaId = ids.turma, escolaId = ESCOLA) {
  const s = SessaoSchema.parse(await service.sessao(escolaId, estudanteId, turmaId));
  const vistos = new Set<string>();
  const salvamentos: { postId: string; salvou: boolean; pasta: Area }[] = [];
  for (const post of s.feed.posts) {
    if (vistos.has(post.projetoId)) continue;
    vistos.add(post.projetoId);
    const certa = areaDoProjeto(post.projetoId);
    const pasta = vistos.size <= erradas ? (AREAS.find((a) => a !== certa) as Area) : certa;
    salvamentos.push({ postId: post.id, salvou: true, pasta });
  }
  return FeedSchema.parse(
    await service.eventosDoFeed(escolaId, estudanteId, turmaId, { curtidas: [], salvamentos, permanencias: [], proximo: false }),
  );
}

/** Rola, guarda nas pastas — salvo `pastas: false` — e vota: a sessão chega à espera (`lacrada`), com a separação corrigida. */
async function votar(estudanteId: string, area?: Area, opcoes: { pastas?: boolean; erradas?: number } = {}) {
  const feed = await rolarFeed(estudanteId, area);
  if (opcoes.pastas !== false) await guardarNasPastas(estudanteId, opcoes.erradas ?? 0);
  const projetoId = (feed.posts.find((p) => !area || p.area === area) ?? feed.posts[0])!.projetoId;
  await service.votar(ESCOLA, estudanteId, ids.turma, ({ projetoId, conviccao: "vi_tudo" as const }));
  return { feed, projetoId };
}

/** As peças certas (ou não) da regra desta sessão, em ids opacos. */
async function escolhaDaRegra(estudanteId: string, certas: { se: boolean; entao: boolean } = { se: true, entao: true }) {
  const pecas = pecasDaSessao((await sessaoDe(estudanteId)).semente);
  const certa = pecasCertas(pecas);
  const errada = (lado: typeof pecas.se) => lado.find((p) => !p.peca.certa)?.opaco as string;
  return { se: certas.se ? certa.se : errada(pecas.se), entao: certas.entao ? certa.entao : errada(pecas.entao) };
}

/** Do zero até o passo `cadeia` (a regra): guarda nas pastas, vota, a turma libera a galeria, busca e abre dois ocultos de outras áreas, mantém e avança. */
async function ateACadeia(estudanteId: string) {
  const { projetoId } = await votar(estudanteId, "area_b");
  const gate = await service.gate(ESCOLA, estudanteId, ids.turma);
  if (gate.etapa !== "galeria") await etapa("galeria");
  const g = GaleriaSchema.parse(await service.galeria(ESCOLA, estudanteId, ids.turma));
  const voto = areaDoProjeto(projetoId);
  const ocultos = g.projetos.filter((p) => !p.exibidoNoSeuFeed && p.area !== voto);
  const areas = [...new Set(ocultos.map((p) => p.area))].slice(0, 2);
  await service.acaoDaGaleria(ESCOLA, estudanteId, ids.turma, { tipo: "buscar", busca: "hashtag", area: areas[0]! });
  for (const a of areas) {
    await service.acaoDaGaleria(ESCOLA, estudanteId, ids.turma, { tipo: "abrir", projetoId: ocultos.find((p) => p.area === a)!.id });
  }
  await service.revisar(ESCOLA, estudanteId, ids.turma, { acao: "manter" as const });
  await service.pedirPasso(ESCOLA, estudanteId, ids.turma, "cadeia");
  return { projetoId };
}

async function montarEquipes(grupos: string[][], computadores: number, ausentes: string[] = []) {
  const ativo = await prisma.exp06ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma, ativo: true } });
  const alvo = { escolaId: ESCOLA, turmaId: ids.turma, expId: EXP_ID, atividadeId: ativo.id };
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
    select: { status: true, origem: true, rodada: true },
    orderBy: { rodada: "asc" },
  });
}

const marcasDe = (marcador: string, estudanteId: string) =>
  prisma.evidenciaMarca.findMany({
    where: { escolaId: ESCOLA, expId: EXP_ID, marcador, estudanteId },
    select: { status: true, rodada: true },
  });

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do Júri (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Escola vizinha do Júri (teste)" } });

  ids.turma = (await criarTurmaDeTeste(prisma, ESCOLA, "6A", "6EF")).id;
  ids.turmaSemLiberacao = (await criarTurmaDeTeste(prisma, ESCOLA, "6B", "6EF")).id;
  ids.turmaVazia = (await criarTurmaDeTeste(prisma, ESCOLA, "6C", "6EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "6A vizinha", "6EF")).id;

  const pessoa = async (escolaId: string, username: string, role: string, nome: string, turmaId?: string) =>
    (
      await prisma.user.create({
        data: { escolaId, username, role, displayName: nome, passwordHash: "x", turmaId },
        select: { id: true },
      })
    ).id;

  ids.professora = await pessoa(ESCOLA, "juri-prof", "professor", "Marta Prof");
  ids.outroProfessor = await pessoa(ESCOLA, "juri-prof-6b", "professor", "Rui Prof");
  ids.ana = await pessoa(ESCOLA, "juri-ana", "estudante", "Ana Clara Souza", ids.turma);
  ids.bia = await pessoa(ESCOLA, "juri-bia", "estudante", "Bia Lima", ids.turma);
  ids.caio = await pessoa(ESCOLA, "juri-caio", "estudante", "Caio Reis", ids.turma);
  ids.duda = await pessoa(ESCOLA, "juri-duda", "estudante", "Duda Melo", ids.turma);
  ids.enzo = await pessoa(ESCOLA, "juri-enzo", "estudante", "Enzo Paz", ids.turma);
  ids.fabi = await pessoa(ESCOLA, "juri-fabi", "estudante", "Fabi Nunes", ids.turmaSemLiberacao);
  ids.vizinho = await pessoa(OUTRA_ESCOLA, "juri-vizinho", "estudante", "Vito Vizinho", ids.turmaVizinha);

  const lecionar = (turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: { escolaId: ESCOLA, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
    });
  await lecionar(ids.turma, ids.professora);
  await lecionar(ids.turmaSemLiberacao, ids.outroProfessor);

  /* A PORTA DA SALA (ADR-69): a 6B é a turma SEM liberação. */
  await liberarParaTeste(prisma, ESCOLA, ids.turma, EXP_ID, ids.professora);
  await liberarParaTeste(prisma, OUTRA_ESCOLA, ids.turmaVizinha, EXP_ID, ids.vizinho);

  /* O `PUT` das equipes exige a missão no catálogo e de estudante. */
  await prisma.experiencia.upsert({
    where: { expId: EXP_ID },
    update: { publico: "estudante" },
    create: { expId: EXP_ID, nome: "O Júri Estadual de Projetos", versaoAtiva: "0.1.0", series: ["6EF"], publico: "estudante" },
  });
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

const TABELAS = ["exp06ef1b_pacotes", "exp06ef1b_gates_turma", "exp06ef1b_sessoes", "exp06ef1b_gates_historico"] as const;

describe("tenancy no banco (regra inviolável nº 1)", () => {
  beforeAll(async () => {
    await zerarMissao();
    await prepararAtividade(ids.turmaVizinha, OUTRA_ESCOLA);
    await entrar(ids.ana);
    await entrar(ids.vizinho, ids.turmaVizinha, OUTRA_ESCOLA);
    /* Uma linha de histórico em cada escola (EVT-P05). */
    await etapa("galeria");
    await service.mudarEtapa(OUTRA_ESCOLA, ids.turmaVizinha, undefined, "galeria");
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

  test("a RLS isola DE VERDADE (role sem BYPASSRLS): nada da escola vizinha existe daqui", async () => {
    const daqui = await runtime.comTenancy(
      async (tx) => ({
        pacotes: await tx.exp06ef1bPacote.findMany({ select: { escolaId: true } }),
        gates: await tx.exp06ef1bGateTurma.findMany({ select: { escolaId: true } }),
        sessoes: await tx.exp06ef1bSessao.findMany({ select: { escolaId: true } }),
        historico: await tx.exp06ef1bGateHistorico.findMany({ select: { escolaId: true } }),
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
  beforeAll(async () => {
    await zerarMissao();
    await entrar(ids.ana);
    sessao = (await sessaoDe(ids.ana)).id;
  });

  const falha = (sql: string) => expect(prisma.$executeRawUnsafe(sql)).rejects.toThrow();
  const naSessao = (set: string) => falha(`UPDATE exp06ef1b_sessoes SET ${set} WHERE id = '${sessao}'::uuid`);
  const def = async (nome: string) =>
    (await prisma.$queryRawUnsafe<{ d: string }[]>(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = '${nome}'`))[0]?.d ?? "";
  const votada = "voto_projeto = 'proj-a1', conviccao = 'vi_tudo', votado_em = now()";

  test("o vocabulário dos passos, das etapas e das disciplinas é o MESMO do código", async () => {
    const passos = await def("exp06ef1b_sessoes_passo_check");
    for (const p of PASSOS) expect(passos).toContain(`'${p}'`);
    expect(passos).not.toContain("'pacotes'");
    /* As colunas dos pacotes saíram com o passo (20261006120000). */
    const colunas = await prisma.$queryRawUnsafe<{ c: string }[]>(
      "SELECT column_name AS c FROM information_schema.columns WHERE table_name = 'exp06ef1b_sessoes' AND column_name LIKE 'pacotes%'",
    );
    expect(colunas).toEqual([]);
    expect(passos.match(/'[a-z]+'::text/g)).toHaveLength(PASSOS.length);
    const etapas = await def("exp06ef1b_gates_turma_etapa_check");
    for (const e of ETAPAS) expect(etapas).toContain(`'${e}'`);
    expect(etapas.match(/'[a-z]+'::text/g)).toHaveLength(ETAPAS.length);
    const disciplinas = await def("exp06ef1b_pacotes_disciplina_check");
    for (const d of DISCIPLINAS) expect(disciplinas).toContain(`'${d}'`);
    expect(disciplinas.match(/'[a-z-]+'::text/g)).toHaveLength(DISCIPLINAS.length);
  });

  test("o LATCH 1: carimbo sem voto, voto com o passo de antes, e `galeria` gravado", async () => {
    await naSessao("votado_em = now(), passo = 'lacrada'");
    await naSessao(`${votada}, passo = 'feed'`);
    await naSessao(`${votada}, passo = 'galeria'`);
    await naSessao("passo = 'lacrada'");
    await naSessao("voto_projeto = 'proj-a1', conviccao = 'talvez', votado_em = now(), passo = 'lacrada'");
    await naSessao("voto_projeto = 'proj-z9', conviccao = 'vi_tudo', votado_em = now(), passo = 'lacrada'");
    // O caminho certo passa: carimbo e passo juntos.
    await prisma.$executeRawUnsafe(`UPDATE exp06ef1b_sessoes SET ${votada}, passo = 'lacrada' WHERE id = '${sessao}'::uuid`);
  });

  test("a justificativa é um par, e só existe com o gesto dela", async () => {
    await naSessao("voto_motivo = 'v1'");
    await naSessao("voto_motivo = 'v9', voto_trecho = 0");
    await naSessao("voto_motivo = 'v1', voto_trecho = 12");
    await naSessao("revisao_motivo = 'r1', revisao_trecho = 0");
    await prisma.$executeRawUnsafe(`UPDATE exp06ef1b_sessoes SET voto_motivo = 'v2', voto_trecho = 1 WHERE id = '${sessao}'::uuid`);
  });

  test("o LATCH 2: manter repete o voto, trocar escolhe outro, e o carimbo anda com o passo", async () => {
    const revisada = (acao: string, voto: string, passo = "revisada", extra = "") =>
      `revisao_acao = '${acao}', voto_revisado = '${voto}', revisado_em = now(), passo = '${passo}'${extra}`;
    await naSessao(revisada("manter", "proj-b2"));
    await naSessao(revisada("trocar", "proj-a1"));
    await naSessao(revisada("manter", "proj-a1", "lacrada"));
    /* O complemento das sessões da 0.3.0 continua amarrado pelo CHECK. */
    await naSessao(revisada("manter", "proj-a1", "revisada", ", complemento_projeto = 'proj-b2'"));
    await naSessao("passo = 'revisada'");
    /* `desvio` saiu do vocabulário: nem gravado. */
    await naSessao(revisada("manter", "proj-a1", "desvio"));
    /* Os status das ações só com o gesto, e no vocabulário da evidência. */
    await naSessao("auditoria_status = 'atingiu'");
    await naSessao(`${revisada("manter", "proj-a1")}, auditoria_status = 'otimo'`);
    await prisma.$executeRawUnsafe(
      `UPDATE exp06ef1b_sessoes SET ${revisada("trocar", "proj-c3")}, auditoria_status = 'em_processo' WHERE id = '${sessao}'::uuid`,
    );
    /* Da revisão para a cadeia, direto (sem rodada de desvio). */
    await prisma.$executeRawUnsafe(`UPDATE exp06ef1b_sessoes SET passo = 'cadeia' WHERE id = '${sessao}'::uuid`);
    /* O batimento da cédula só existe antes do voto, e em par. */
    await naSessao("cedula_batimento_em = now(), cedula_inativa_desde = now()");
  });

  test("cadeia, cartões e fim andam com o passo — e `pacotes` não existe mais", async () => {
    /* O passo dos pacotes saiu com a EF06CO07 (2026-10-06): nem gravado. */
    await naSessao("passo = 'pacotes'");
    await naSessao("cadeia_montada_em = now(), cadeia_tentativas = 0, passo = 'mariana'");
    await naSessao("cadeia_montada_em = now(), cadeia_tentativas = 1");
    await naSessao("mecanismo = 'm4'");
    await naSessao("passo = 'fim'");
    await naSessao("concluida_em = now()");
    /* Cartões fora de `enquetes`/`fim` continuam recusados; `fim` SEM cartões passou a valer (ADR-176, a regra conclui). */
    await naSessao("mecanismo = 'm1', atitude = 't1', cartoes_em = now()");
    expect(await def("exp06ef1b_sessoes_cartoes_check")).toContain("cartoes_em IS NULL");
    /* As pastas são um objeto. */
    await naSessao("pastas = '[]'");
  });

  test("a separação e a regra (ADR-174): as colunas andam juntas, os acertos cabem no total, e a regra só com o carimbo", async () => {
    const separada = (acertos: number, total: number) =>
      `classificada_em = now(), classificacao_respostas = '[]', classificacao_acertos = ${acertos}, classificacao_total = ${total}`;
    await naSessao("classificada_em = now()");
    await naSessao("classificacao_acertos = 3");
    await naSessao(separada(11, 10));
    await naSessao(separada(3, 11));
    await naSessao(`${separada(1, 2)}, classificacao_respostas = '{}'`);
    await naSessao("regra_se = 'se-curtir'");
    /* As duas peças sem o carimbo da cadeia. */
    await naSessao("regra_se = 'se-curtir', regra_entao = 'entao-tema'");
    // O caminho certo passa (a sessão já votou e está na cadeia).
    await prisma.$executeRawUnsafe(`UPDATE exp06ef1b_sessoes SET ${separada(7, 10)}, classificacao_status = 'em_processo' WHERE id = '${sessao}'::uuid`);
    const checks = await def("exp06ef1b_sessoes_classificacao_check");
    expect(checks).toContain("votado_em IS NOT NULL");
  });

  test("PROVA 7: o pacote: `ia` ou `padrao`, 40 projetos (ou os 16 da 0.4.x, nunca 15), e UM ativo por turma", async () => {
    const json = (c: unknown) => JSON.stringify(c).replace(/'/g, "''");
    const conteudo = json(conteudoDeTeste());
    const inserir = (origem: string, j: string, ativo: boolean) =>
      `INSERT INTO exp06ef1b_pacotes (escola_id, turma_id, origem, disciplina, tema, assuntos, conteudo, ativo, criado_por) VALUES ('${ESCOLA}', '${ids.turma}'::uuid, '${origem}', 'ciencias', 'Um tema', 'Assuntos da mostra de teste', '${j}'::jsonb, ${ativo}, '${ids.professora}'::uuid)`;
    await falha(inserir("outra", conteudo, false));
    await falha(inserir("ia", json({ ...conteudoDeTeste(), projetos: [] }), false));
    await falha(inserir("ia", json({ ...conteudoDeTeste(), projetos: conteudoLegadoDeTeste().projetos.slice(0, 15) }), false));
    await falha(inserir("ia", json({ ...conteudoDeTeste(), projetos: conteudoDeTeste().projetos.slice(0, 39) }), false));
    // O índice único PARCIAL: a turma já tem a atividade em andamento.
    await falha(inserir("ia", conteudo, true));
    await prisma.$executeRawUnsafe(inserir("ia", conteudo, false));
    await prisma.$executeRawUnsafe(inserir("padrao", conteudo, false));
    /* O pacote de dezesseis da 0.4.x continua aceito: ele existe no banco. */
    await prisma.$executeRawUnsafe(inserir("ia", json(conteudoLegadoDeTeste()), false));
    const def16 = await def("exp06ef1b_pacotes_conteudo_check");
    expect(def16).toMatch(/ANY \(ARRAY\[16, 40\]\)|IN \(16, 40\)/);
  });

  test("PROVA 7: o id de projeto é `proj-[a-d](10|[1-9])` — o mesmo texto do código, nas três colunas", async () => {
    const vocabulario = await def("exp06ef1b_sessoes_vocabulario_check");
    const regex = ID_DE_PROJETO_RE.source;
    expect(vocabulario.split(regex).length - 1).toBe(3);
    expect(vocabulario).not.toContain("[1-4]");
    for (const ruim of ["proj-e1", "proj-a11", "proj-a0", "proj-a"]) {
      await naSessao(`voto_projeto = '${ruim}', conviccao = 'vi_tudo', votado_em = now(), passo = 'lacrada'`);
    }
    await prisma.$executeRawUnsafe(
      `UPDATE exp06ef1b_sessoes SET voto_projeto = 'proj-d10', voto_revisado = NULL WHERE id = '${sessao}'::uuid AND voto_projeto IS NOT NULL AND revisado_em IS NULL`,
    );
    /* Numa linha nova (a da Bia), sem os outros carimbos atrapalhando. */
    await entrar(ids.bia);
    const bia = (await sessaoDe(ids.bia)).id;
    await prisma.$executeRawUnsafe(
      `UPDATE exp06ef1b_sessoes SET voto_projeto = 'proj-d10', conviccao = 'vi_tudo', votado_em = now(), passo = 'lacrada' WHERE id = '${bia}'::uuid`,
    );
    expect((await sessaoDe(ids.bia)).votoProjeto).toBe("proj-d10");
  });

  test("o gate: o carimbo da galeria coerente com a etapa, e o desvio fora do vocabulário", async () => {
    const noGate = (set: string) => `UPDATE exp06ef1b_gates_turma SET ${set} WHERE turma_id = '${ids.turma}'::uuid`;
    await falha(noGate("etapa = 'galeria'"));
    await falha(noGate("galeria_liberada_em = now()"));
    await falha(noGate("etapa = 'desvio', galeria_liberada_em = now()"));
    await falha(noGate("etapa = 'galeria', galeria_liberada_em = now(), desvio_liberado_em = now()"));
    await falha(
      `INSERT INTO exp06ef1b_gates_historico (turma_id, escola_id, etapa) VALUES ('${ids.turma}'::uuid, '${ESCOLA}', 'desvio')`,
    );
  });
});

describe("a porta da sala e a atividade em andamento", () => {
  beforeAll(limparMissao);

  test("sem liberação na turma: 403 `missao-nao-liberada`, na sessão E no polling", async () => {
    expect(await codigoDe(entrar(ids.fabi, ids.turmaSemLiberacao))).toBe("missao-nao-liberada");
    expect(await codigoDe(service.gate(ESCOLA, ids.fabi, ids.turmaSemLiberacao))).toBe("missao-nao-liberada");
    expect(await prisma.exp06ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.fabi } })).toBe(0);
  });

  test("sem atividade em andamento: 403 `atividade-nao-preparada` — e nada é criado", async () => {
    expect(await codigoDe(entrar(ids.ana))).toBe("atividade-nao-preparada");
    expect(await codigoDe(service.gate(ESCOLA, ids.ana, ids.turma))).toBe("atividade-nao-preparada");
    expect(await codigoDe(service.painel(ESCOLA, ids.turma, ids.professora))).toBe("atividade-nao-preparada");
    expect(PacotesSchema.parse(await service.pacotes(ESCOLA, ids.turma, ids.professora))).toEqual({ ativo: null, historico: [] });
    expect(await prisma.exp06ef1bSessao.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("com a atividade no ar, a entrada abre a rodada 1, sem acervo e sem blocos do fim", async () => {
    const pacoteId = await prepararAtividade();
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s).toMatchObject({ pacoteId, rodada: 1, etapa: "exploracao", passo: "credencial", voto: null, cadeia: null });
    expect(s).not.toHaveProperty("mariana");
    expect(s).not.toHaveProperty("classificacao");
    expect(s).not.toHaveProperty("pacotes");
    expect(s).not.toHaveProperty("desvio");
    expect(s).not.toHaveProperty("motivos");
    expect(s.feed).toEqual({
      posts: [],
      curtidos: [],
      salvos: [],
      pastas: {},
      semPasta: 0,
      completo: false,
      tempoEsgotado: false,
      encerraEm: null,
      cedulaLiberada: false,
    });
    expect(s.categorias.map((c) => c.area)).toEqual(["area_a", "area_b", "area_c", "area_d"]);
    expect(GatePublicoSchema.parse(await service.gate(ESCOLA, ids.ana, ids.turma))).toEqual({ pacoteId, rodada: 1, etapa: "exploracao" });
    await entrar(ids.ana);
    expect(await prisma.exp06ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(1);
  });
});

describe("o feed afunilado, servido pelo motor", () => {
  beforeAll(zerarMissao);

  test("o primeiro passo serve a ABERTURA: quatro posts, um de cada área — e o acervo não desce", async () => {
    await entrar(ids.ana);
    const feed = FeedSchema.parse(await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "feed"));
    expect(feed.posts).toHaveLength(4);
    expect(new Set(feed.posts.map((p) => p.area)).size).toBe(4);
    expect(feed.completo).toBe(false);
    /* Pedir de novo devolve o mesmo feed (o F5). */
    expect(await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "feed")).toEqual(feed);
    const json = JSON.stringify(await entrar(ids.ana));
    expect(json).not.toContain("descricao");
    const servidos = new Set(feed.posts.map((p) => p.projetoId));
    const naoServido = conteudoDeTeste().projetos.find((p) => !servidos.has(p.id))!;
    expect(json).not.toContain(naoServido.titulo);
  });

  test("post que o feed não serviu é 400 `post-desconhecido`; voto antes dos dez é `feed-incompleto`", async () => {
    const s = SessaoSchema.parse(await entrar(ids.ana));
    const fora = conteudoDeTeste().projetos.find((p) => !s.feed.posts.some((x) => x.projetoId === p.id))!.id;
    expect(
      await codigoDe(service.eventosDoFeed(ESCOLA, ids.ana, ids.turma, curtindo([{ postId: `${fora}:apresentacao`, curtiu: true }], false))),
    ).toBe("post-desconhecido");
    expect(
      await codigoDe(
        service.eventosDoFeed(ESCOLA, ids.ana, ids.turma, { ...semEventos, salvamentos: [{ postId: `${fora}:apresentacao`, salvou: true }], proximo: false }),
      ),
    ).toBe("post-desconhecido");
    expect(await codigoDe(service.votar(ESCOLA, ids.ana, ids.turma, ({ projetoId: s.feed.posts[0]!.projetoId, conviccao: "vi_tudo" as const })))).toBe(
      "feed-incompleto",
    );
    /* Na credencial, o feed não anda. */
    await entrar(ids.bia);
    expect(await codigoDe(service.eventosDoFeed(ESCOLA, ids.bia, ids.turma, semEventos))).toBe("passo-invalido");
  });

  test("curtir uma área: do 5º post em diante só ela, com projetos NOVOS — dez projetos distintos, só apresentações", async () => {
    const feed = await rolarFeed(ids.ana, "area_c");
    expect(feed.posts).toHaveLength(10);
    expect(feed.completo).toBe(true);
    expect(feed.cedulaLiberada).toBe(true);
    expect(feed.curtidos.length).toBeGreaterThanOrEqual(1);
    /* Do 5º ao 10º, só a área em foco; nenhum post, nem projeto, repetido. */
    expect(feed.posts.slice(4).every((p) => p.area === "area_c")).toBe(true);
    expect(new Set(feed.posts.map((p) => p.projetoId)).size).toBe(10);
    expect(feed.posts.every((p) => p.tipo === "apresentacao" && p.texto === p.legenda && p.bastidor.length > 0)).toBe(true);
    /* O próximo além dos dez não existe. */
    expect((await service.eventosDoFeed(ESCOLA, ids.ana, ids.turma, semEventos)).posts).toHaveLength(10);
    const linha = await sessaoDe(ids.ana);
    expect(new Set((linha.postsServidos as string[]).map((p) => p.split(":")[0])).size).toBe(10);
    expect(linha.versaoInstrumento).toBe(VERSAO_DO_INSTRUMENTO);
    /* A 1ª rolagem ligou o relógio de 8 minutos do servidor. */
    expect(linha.feedIniciadoEm).not.toBeNull();
    expect(feed.encerraEm).not.toBeNull();
  });

  test("salvar é gravado e NÃO pesa: três salvos não fecham a bolha, e o salvo volta num F5", async () => {
    const feed = await rolarFeed(ids.bia, "area_a", ids.turma, ESCOLA, "salvar");
    expect(feed.salvos).toHaveLength(3);
    expect(feed.curtidos).toEqual([]);
    /* Sem curtida nem permanência, o feed segue variado. */
    expect(new Set(feed.posts.slice(4).map((p) => p.area)).size).toBeGreaterThan(1);
    expect(SessaoSchema.parse(await entrar(ids.bia)).feed.salvos).toEqual(feed.salvos);
    /* Salvar sem pasta (o bundle anterior à 0.7.0) não separa: os dez seguem sem pasta. */
    expect(feed.pastas).toEqual({});
    expect(feed.semPasta).toBe(10);
  });

  test("as PASTAS (ADR-176): salvar com pasta guarda, salvar de novo MOVE, tirar dos salvos apaga — e não pesam no feed", async () => {
    const feed = await rolarFeed(ids.bia);
    const [p1, p2] = feed.posts;
    const evento = async (salvamentos: { postId: string; salvou: boolean; pasta?: Area }[]) =>
      FeedSchema.parse(
        await service.eventosDoFeed(ESCOLA, ids.bia, ids.turma, { curtidas: [], salvamentos, permanencias: [], proximo: false }),
      );
    let f = await evento([{ postId: p1!.id, salvou: true, pasta: "area_a" }, { postId: p2!.id, salvou: true, pasta: "area_b" }]);
    expect(f.pastas).toMatchObject({ [p1!.id]: "area_a", [p2!.id]: "area_b" });
    f = await evento([{ postId: p1!.id, salvou: true, pasta: "area_c" }]);
    expect(f.pastas[p1!.id]).toBe("area_c");
    f = await evento([{ postId: p2!.id, salvou: false }]);
    expect(f.pastas).not.toHaveProperty(p2!.id);
    expect(f.salvos).not.toContain(p2!.id);
    /* Um F5 traz as pastas; os curtidos continuam vazios: a pasta não é curtida. */
    const s = SessaoSchema.parse(await entrar(ids.bia));
    expect(s.feed.pastas).toEqual(f.pastas);
    expect(s.feed.curtidos).toEqual([]);
    expect((await sessaoDe(ids.bia)).pastas).toEqual(f.pastas);
  });

  test("os 8 minutos contam no SERVIDOR desde a 1ª rolagem: esgotados, a cédula abre com menos de dez", async () => {
    await entrar(ids.caio);
    await service.pedirPasso(ESCOLA, ids.caio, ids.turma, "feed");
    const f = FeedSchema.parse(await service.eventosDoFeed(ESCOLA, ids.caio, ids.turma, semEventos));
    expect(f.posts).toHaveLength(5);
    expect(await codigoDe(service.votar(ESCOLA, ids.caio, ids.turma, { projetoId: f.posts[0]!.projetoId, conviccao: "vi_tudo" }))).toBe(
      "feed-incompleto",
    );
    /* O relógio é do banco: um F5 não o zera, e o passado o esgota. */
    await prisma.exp06ef1bSessao.updateMany({
      where: { escolaId: ESCOLA, estudanteId: ids.caio },
      data: { feedIniciadoEm: new Date(Date.now() - 9 * 60_000) },
    });
    const esgotado = FeedSchema.parse(await service.eventosDoFeed(ESCOLA, ids.caio, ids.turma, semEventos));
    expect(esgotado).toMatchObject({ tempoEsgotado: true, cedulaLiberada: true, completo: false });
    expect(esgotado.posts).toHaveLength(5);
    /* A cédula abriu, mas o voto espera os cinco estandes nas pastas (ADR-176) — e guardar ainda vale com o tempo esgotado. */
    expect(esgotado.semPasta).toBe(5);
    expect(await codigoDe(service.votar(ESCOLA, ids.caio, ids.turma, { projetoId: f.posts[0]!.projetoId, conviccao: "vi_tudo" }))).toBe(
      "estandes-sem-pasta",
    );
    expect((await guardarNasPastas(ids.caio)).semPasta).toBe(0);
    expect(await service.votar(ESCOLA, ids.caio, ids.turma, { projetoId: f.posts[0]!.projetoId, conviccao: "vi_tudo" })).toMatchObject({
      passo: "lacrada",
    });
    /* Cinco estandes: dá para medir (o mínimo é quatro), e a separação é corrigida no voto. */
    expect(await sessaoDe(ids.caio)).toMatchObject({ classificacaoAcertos: 5, classificacaoTotal: 5, classificacaoStatus: "atingiu" });
  });

  test("o batimento da cédula: grava, o painel acende o ocioso com mais de 60 s, e some com o voto", async () => {
    await entrar(ids.duda);
    await rolarFeed(ids.duda);
    await service.batimentoDaCedula(ESCOLA, ids.duda, ids.turma, { aberta: true, segundosSemToque: 75 });
    let painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.professora));
    expect(painel.linhas.find((l) => l.estudanteId === ids.duda)?.ocioso).toBe(true);
    expect(painel.resumo.ociosos).toBe(1);
    await service.batimentoDaCedula(ESCOLA, ids.duda, ids.turma, { aberta: true, segundosSemToque: 10 });
    painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.professora));
    expect(painel.linhas.find((l) => l.estudanteId === ids.duda)?.ocioso).toBe(false);
    await service.batimentoDaCedula(ESCOLA, ids.duda, ids.turma, { aberta: true, segundosSemToque: 90 });
    await guardarNasPastas(ids.duda);
    const s = SessaoSchema.parse(await entrar(ids.duda));
    await service.votar(ESCOLA, ids.duda, ids.turma, { projetoId: s.feed.posts[0]!.projetoId, conviccao: "examinei_bem" });
    expect(await sessaoDe(ids.duda)).toMatchObject({ cedulaBatimentoEm: null, cedulaInativaDesde: null });
    /* Batimento depois do voto não grava nada. */
    await service.batimentoDaCedula(ESCOLA, ids.duda, ids.turma, { aberta: true, segundosSemToque: 90 });
    expect((await sessaoDe(ids.duda)).cedulaBatimentoEm).toBeNull();
    /* Cada leitura do painel conta (EVT-P04). */
    const pacote = await prisma.exp06ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma, ativo: true } });
    expect(pacote.painelVistas).toBeGreaterThanOrEqual(2);
    expect(pacote.painelVistoEm).not.toBeNull();
  });

  test("projeto fora do feed é recusado; dois votos simultâneos: um lacra, o outro é 409", async () => {
    await guardarNasPastas(ids.ana);
    const s = SessaoSchema.parse(await entrar(ids.ana));
    const vistos = new Set(s.feed.posts.map((p) => p.projetoId));
    const fora = conteudoDeTeste().projetos.find((p) => !vistos.has(p.id))!.id;
    expect(await codigoDe(service.votar(ESCOLA, ids.ana, ids.turma, ({ projetoId: fora, conviccao: "vi_tudo" as const })))).toBe(
      "projeto-fora-do-feed",
    );
    const [a, b] = await Promise.allSettled([
      service.votar(ESCOLA, ids.ana, ids.turma, { projetoId: s.feed.posts[0]!.projetoId, conviccao: "vi_tudo" }),
      service.votar(ESCOLA, ids.ana, ids.turma, ({ projetoId: s.feed.posts[1]!.projetoId, conviccao: "examinei_bem" as const })),
    ]);
    expect([a, b].filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusa = [a, b].find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((recusa.reason as HttpException).getResponse()).toMatchObject({ codigo: "voto-ja-lacrado" });
    const depois = SessaoSchema.parse(await entrar(ids.ana));
    /* Depois do voto, a espera: a separação já foi corrigida pelas pastas, no voto (ADR-176). */
    expect(depois).toMatchObject({ passo: "lacrada", aguardandoOProfessor: true });
    expect(await marcasDe("classificacao", ids.ana)).toEqual([{ status: "atingiu", rodada: 1 }]);
    expect(depois.voto).not.toBeNull();
    expect(Object.keys(depois.voto ?? {}).sort()).toEqual(["conviccao", "projetoId"]);
    expect(await codigoDe(service.eventosDoFeed(ESCOLA, ids.ana, ids.turma, semEventos))).toBe("voto-ja-lacrado");
  });
});

describe("a Galeria Oculta e a revisão do voto", () => {
  let votoDaAna = "";
  beforeAll(async () => {
    await zerarMissao();
    votoDaAna = (await votar(ids.ana, "area_b")).projetoId;
  });

  test("antes do portão do professor, a galeria não abre", async () => {
    expect(await codigoDe(service.galeria(ESCOLA, ids.ana, ids.turma))).toBe("galeria-nao-liberada");
    expect(await codigoDe(service.acaoDaGaleria(ESCOLA, ids.ana, ids.turma, { tipo: "abrir", projetoId: "proj-a1" }))).toBe(
      "galeria-nao-liberada",
    );
    expect(await codigoDe(service.revisar(ESCOLA, ids.ana, ids.turma, ({ acao: "manter" as const })))).toBe("galeria-nao-liberada");
  });

  test("o botão abre a galeria (idempotente, nunca volta); quem não votou continua no feed", async () => {
    await entrar(ids.caio);
    await service.pedirPasso(ESCOLA, ids.caio, ids.turma, "feed");
    expect(await etapa("galeria")).toMatchObject({ etapa: "galeria", proximaEtapa: null });
    /* EVT-P05: uma linha por etapa liberada; o segundo clique não grava outra. */
    expect(await prisma.exp06ef1bGateHistorico.count({ where: { escolaId: ESCOLA, turmaId: ids.turma, etapa: "galeria" } })).toBe(1);
    expect((await etapa("galeria")).etapa).toBe("galeria");
    expect(await codigoDe(etapa("exploracao"))).toBe("transicao-de-etapa-invalida");
    expect((await entrar(ids.caio)).passo).toBe("feed");
    expect(await codigoDe(service.galeria(ESCOLA, ids.caio, ids.turma))).toBe("galeria-nao-liberada");
    expect((await entrar(ids.ana)).passo).toBe("galeria");
  });

  test("a galeria traz os quarenta, os ocultos primeiro, 30 de 40, por área e o contrafactual desta sessão", async () => {
    const g = GaleriaSchema.parse(await service.galeria(ESCOLA, ids.ana, ids.turma));
    expect(g.invisibilidade).toEqual({ ocultos: 30, total: 40 });
    expect(g.projetos).toHaveLength(40);
    expect(g.projetos.slice(0, 30).every((p) => !p.exibidoNoSeuFeed)).toBe(true);
    expect(g.projetos.slice(30).every((p) => p.exibidoNoSeuFeed)).toBe(true);
    /* Curtiu a B: 7 dela e 1 de cada outra. */
    expect(g.porArea).toEqual([
      { area: "area_a", vistos: 1, total: 10 },
      { area: "area_b", vistos: 7, total: 10 },
      { area: "area_c", vistos: 1, total: 10 },
      { area: "area_d", vistos: 1, total: 10 },
    ]);
    /* O contrafactual: a mesma semente sem curtidas — variado, dez posts, e o mesmo a cada leitura. */
    expect(g.semCurtidas.map((a) => a.posts.length).sort()).toEqual([2, 2, 3, 3]);
    expect(GaleriaSchema.parse(await service.galeria(ESCOLA, ids.ana, ids.turma)).semCurtidas).toEqual(g.semCurtidas);
    expect(g).toMatchObject({ ocultosAbertos: 0, podeManter: false });
    expect(JSON.stringify(g)).not.toContain("descricao");
    expect(JSON.stringify(g)).not.toMatch(/"(semente|pesos?|lider)":/);
  });

  test("PROVA 4: sem curtida nem permanência, o contrafactual é IGUAL ao feed real", async () => {
    const semToque = await rolarFeed(ids.enzo);
    await guardarNasPastas(ids.enzo);
    await service.votar(ESCOLA, ids.enzo, ids.turma, { projetoId: semToque.posts[0]!.projetoId, conviccao: "vi_tudo" });
    const g = GaleriaSchema.parse(await service.galeria(ESCOLA, ids.enzo, ids.turma));
    const reais = new Set(semToque.posts.map((p) => p.projetoId));
    expect(new Set(g.semCurtidas.flatMap((a) => a.posts))).toEqual(reais);
    expect(g.porArea.map((a) => a.vistos).sort()).toEqual([2, 2, 3, 3]);
    expect(g.invisibilidade).toEqual({ ocultos: 30, total: 40 });
  });

  test("as ações da galeria gravam a auditoria — sem o texto da busca", async () => {
    const g = GaleriaSchema.parse(await service.galeria(ESCOLA, ids.ana, ids.turma));
    /* Votou na área B: da D, só um projeto chegou ao feed (o da abertura). */
    expect(areaDoProjeto(votoDaAna)).toBe("area_b");
    const ocultoFora = g.projetos.find((p) => !p.exibidoNoSeuFeed && p.area === "area_d")!;
    await service.acaoDaGaleria(ESCOLA, ids.ana, ids.turma, { tipo: "abrir", projetoId: ocultoFora.id });
    await service.acaoDaGaleria(ESCOLA, ids.ana, ids.turma, { tipo: "abrir", projetoId: ocultoFora.id });
    await service.acaoDaGaleria(ESCOLA, ids.ana, ids.turma, { tipo: "buscar", busca: "hashtag", area: "area_d" });
    expect((await sessaoDe(ids.ana)).auditoria).toEqual({ abertos: [ocultoFora.id], buscas: [{ tipo: "hashtag", area: "area_d" }] });
  });

  test("trocar com o mesmo voto é 400; duas revisões simultâneas: uma vale, a outra é 409", async () => {
    expect(GaleriaSchema.parse(await service.galeria(ESCOLA, ids.ana, ids.turma))).toMatchObject({ ocultosAbertos: 1, podeManter: true });
    expect(await codigoDe(service.revisar(ESCOLA, ids.ana, ids.turma, { acao: "trocar" as const, projetoId: votoDaAna }))).toBe(
      "payload-invalido",
    );
    const outro = votoDaAna === "proj-d4" ? "proj-d3" : "proj-d4";
    const [a, b] = await Promise.allSettled([
      service.revisar(ESCOLA, ids.ana, ids.turma, { acao: "trocar" as const, projetoId: outro }),
      service.revisar(ESCOLA, ids.ana, ids.turma, { acao: "manter" as const }),
    ]);
    expect([a, b].filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusa = [a, b].find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((recusa.reason as HttpException).getResponse()).toMatchObject({ codigo: "voto-ja-revisado" });
    /* Sem rodada de desvio: a revisão não espera ninguém. */
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s).toMatchObject({ passo: "revisada", aguardandoOProfessor: false, cadeia: null });
    /* A revisão não marca nada desde a ficha 5 (ADR-174): a EF06CO01 é a da SEPARAÇÃO, e a EF06CO10 saiu. */
    expect(await marcasDe("classificacao", ids.ana)).toEqual([{ status: "atingiu", rodada: 1 }]);
    expect(await evidenciaDe(ids.ana, "EF06CO10")).toEqual([]);
    expect(await marcasDe("auditoria", ids.ana)).toEqual([]);
    expect(await sessaoDe(ids.ana)).toMatchObject({ auditoriaStatus: null, classificacaoStatus: "atingiu" });
    expect(await codigoDe(service.acaoDaGaleria(ESCOLA, ids.ana, ids.turma, { tipo: "abrir", projetoId: "proj-a1" }))).toBe("passo-invalido");
  });

  test("\"Manter\" sem abrir nenhum oculto é 409 `galeria-sem-inspecao`; trocar sem explorar não marca nada", async () => {
    await votar(ids.duda);
    expect(await codigoDe(service.revisar(ESCOLA, ids.duda, ids.turma, { acao: "manter" as const }))).toBe("galeria-sem-inspecao");
    const { voto } = SessaoSchema.parse(await entrar(ids.duda));
    const outro = voto?.projetoId === "proj-a1" ? "proj-a2" : "proj-a1";
    await service.revisar(ESCOLA, ids.duda, ids.turma, { acao: "trocar" as const, projetoId: outro });
    expect(await evidenciaDe(ids.duda, "EF06CO10")).toEqual([]);
    expect(await marcasDe("auditoria", ids.duda)).toEqual([]);
    /* Só a marca da separação, do voto. */
    expect(await marcasDe("classificacao", ids.duda)).toHaveLength(1);
  });

  test("da revisão para a cadeia: o \"avançar\" é da criança, e antes da revisão é recusado", async () => {
    expect(await codigoDe(service.pedirPasso(ESCOLA, ids.caio, ids.turma, "cadeia"))).toBe("passo-invalido");
    expect(await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "cadeia")).toEqual({ passo: "cadeia", etapa: "galeria" });
    expect(await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "cadeia")).toEqual({ passo: "cadeia", etapa: "galeria" });
    const s = SessaoSchema.parse(await entrar(ids.ana));
    /* A regra: três peças de cada lado, sem a certa, e sem revelação antes do envio. */
    expect(s.cadeia?.se).toHaveLength(3);
    expect(s.cadeia?.entao).toHaveLength(3);
    expect(s.cadeia).toMatchObject({ enviada: false, revelacao: null });
    expect(JSON.stringify(s.cadeia)).not.toMatch(/"certa"|se-curtir|entao-tema/);
  });
});

describe("a separação nas pastas e a regra que conclui (ADR-174, ADR-176)", () => {
  beforeAll(async () => {
    await zerarMissao();
    await ateACadeia(ids.ana);
  });

  test("a separação nas pastas: o voto sem todos os estandes guardados é 409; com três erradas, 7 de 10 = em processo", async () => {
    /* A Bia vota com a galeria JÁ liberada (a Ana a liberou ao ir para a cadeia). */
    const feed = await rolarFeed(ids.bia, "area_c");
    const projetoId = feed.posts.find((p) => p.area === "area_c")!.projetoId;
    expect(await codigoDe(service.votar(ESCOLA, ids.bia, ids.turma, { projetoId, conviccao: "vi_tudo" }))).toBe("estandes-sem-pasta");
    const guardado = await guardarNasPastas(ids.bia, 3);
    expect(guardado.semPasta).toBe(0);
    /* A tela recebe as pastas que ELA escolheu, nunca o acerto. */
    expect(JSON.stringify(guardado)).not.toMatch(/acert|certa|"certo"/);
    const r = EstadoSchema.strict().parse(await service.votar(ESCOLA, ids.bia, ids.turma, { projetoId, conviccao: "vi_tudo" }));
    /* Votou e caiu direto na galeria, que já estava liberada: não há mais tela de separação. */
    expect(r).toEqual({ passo: "galeria", etapa: "galeria" });
    const linha = await sessaoDe(ids.bia);
    expect(linha).toMatchObject({ passo: "lacrada", classificacaoAcertos: 7, classificacaoTotal: 10, classificacaoStatus: "em_processo" });
    expect(linha.classificadaEm).not.toBeNull();
    expect(await marcasDe("classificacao", ids.bia)).toEqual([{ status: "em_processo", rodada: 1 }]);
    expect(await evidenciaDe(ids.bia, "EF06CO01")).toMatchObject([{ status: "em_processo", origem: "propria" }]);
    /* Depois do voto, as pastas não mudam mais. */
    expect(await codigoDe(service.eventosDoFeed(ESCOLA, ids.bia, ids.turma, semEventos))).toBe("voto-ja-lacrado");
  });

  test("a sessão ANTIGA parada na tela da separação (0.6.0) segue para a espera, sem marca", async () => {
    await votar(ids.enzo, "area_a", { pastas: true });
    await prisma.$executeRawUnsafe(
      `UPDATE exp06ef1b_sessoes SET passo = 'classificacao', classificada_em = NULL, classificacao_respostas = NULL,
         classificacao_acertos = NULL, classificacao_total = NULL, classificacao_status = NULL
       WHERE escola_id = '${ESCOLA}' AND estudante_id = '${ids.enzo}'::uuid`,
    );
    expect(await service.pedirPasso(ESCOLA, ids.enzo, ids.turma, "lacrada")).toEqual({ passo: "galeria", etapa: "galeria" });
    expect(await sessaoDe(ids.enzo)).toMatchObject({ passo: "lacrada", classificacaoStatus: null });
    /* Antes do voto, pedir a espera é recusado. */
    await entrar(ids.duda);
    expect(await codigoDe(service.pedirPasso(ESCOLA, ids.duda, ids.turma, "lacrada"))).toBe("passo-invalido");
  });

  test("a separação de tudo certo é atingiu; a EF06CO10 não existe mais na missão", async () => {
    expect(await evidenciaDe(ids.ana, "EF06CO01")).toMatchObject([{ status: "atingiu" }]);
    expect(await evidenciaDe(ids.ana, "EF06CO10")).toEqual([]);
    expect(await evidenciaDe(ids.ana, "EF06CO07")).toEqual([]);
  });

  test("a regra: peça de outra sessão é 400; as duas certas = atingiu, com a revelação do feed DELA", async () => {
    const pecasDeOutra = pecasCertas(pecasDaSessao("outra-sessao"));
    expect(await codigoDe(service.montarRegra(ESCOLA, ids.ana, ids.turma, pecasDeOutra))).toBe("payload-invalido");
    const r = RespostaDaRegraSchema.parse(await service.montarRegra(ESCOLA, ids.ana, ids.turma, await escolhaDaRegra(ids.ana)));
    /* A regra CONCLUI desde a 0.7.0 (ADR-176): o caso Mariana saiu. */
    expect(r).toMatchObject({ passo: "fim", etapa: "galeria" });
    expect(await sessaoDe(ids.ana)).toMatchObject({ passo: "fim", cartoesEm: null, mecanismo: null });
    expect((await sessaoDe(ids.ana)).concluidaEm).not.toBeNull();
    /* A Ana curtiu a B: a regra "disparou" pelas curtidas. */
    expect(r.revelacao).toMatchObject({ motivo: "curtidas", area: "area_b" });
    expect(r.revelacao?.escolha).toEqual(r.revelacao?.certa);
    expect(await evidenciaDe(ids.ana, "EF06CO03")).toMatchObject([{ status: "atingiu" }]);
    expect(await marcasDe("regra", ids.ana)).toEqual([{ status: "atingiu", rodada: 1 }]);
    expect(await marcasDe("cadeia", ids.ana)).toEqual([]);
    expect(await sessaoDe(ids.ana)).toMatchObject({ logicaStatus: "atingiu", regraSe: "se-curtir", regraEntao: "entao-tema", cadeiaTentativas: 1 });
    /* Enviar de novo devolve a mesma revelação, sem trocar a escolha nem marcar outra vez. */
    const errada = await escolhaDaRegra(ids.ana, { se: false, entao: false });
    expect(RespostaDaRegraSchema.parse(await service.montarRegra(ESCOLA, ids.ana, ids.turma, errada)).revelacao).toEqual(r.revelacao);
    expect(await marcasDe("regra", ids.ana)).toHaveLength(1);
    /* E a sessão traz a revelação num F5. */
    expect(SessaoSchema.parse(await entrar(ids.ana)).cadeia).toMatchObject({ enviada: true, revelacao: r.revelacao });
  });

  test("concluir é idempotente em `fim`; sem enquetes nem cartões para responder", async () => {
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s.concluida).toBe(true);
    expect(s).not.toHaveProperty("mariana");
    expect(await service.concluir(ESCOLA, ids.ana, ids.turma)).toEqual({ passo: "fim", etapa: "galeria" });
    /* Sem enquetes: as perguntas da ficha saíram, e a rota genérica não tem o que responder. */
    expect(await codigoDe(evidencias.responder(ESCOLA, ids.ana, EXP_ID, "p1", "D1"))).not.toBeNull();
  });

  test("a sessão ANTIGA parada no caso Mariana (0.6.0) conclui sem cartões", async () => {
    await votar(ids.duda, "area_d");
    await prisma.$executeRawUnsafe(
      `UPDATE exp06ef1b_sessoes SET revisao_acao = 'manter', voto_revisado = voto_projeto, revisado_em = now(),
         cadeia_tentativas = 1, cadeia_montada_em = now(), passo = 'mariana'
       WHERE escola_id = '${ESCOLA}' AND estudante_id = '${ids.duda}'::uuid`,
    );
    expect(await service.concluir(ESCOLA, ids.duda, ids.turma)).toEqual({ passo: "fim", etapa: "galeria" });
    expect(await sessaoDe(ids.duda)).toMatchObject({ passo: "fim", cartoesEm: null });
  });

  test("a sessão ANTIGA parada nas enquetes ainda conclui", async () => {
    await votar(ids.caio, "area_a");
    await prisma.$executeRawUnsafe(
      `UPDATE exp06ef1b_sessoes SET revisao_acao = 'manter', voto_revisado = voto_projeto, revisado_em = now(),
         cadeia_tentativas = 1, cadeia_montada_em = now(), mecanismo = 'm1', atitude = 't1', cartoes_em = now(), passo = 'enquetes'
       WHERE escola_id = '${ESCOLA}' AND estudante_id = '${ids.caio}'::uuid`,
    );
    expect(await service.concluir(ESCOLA, ids.caio, ids.turma)).toEqual({ passo: "fim", etapa: "galeria" });
  });

  test("depois de zerar: a rodada 2 abre limpa, a evidência sai (ADR-155) e quem já foi avaliada é medida de novo (ADR-145)", async () => {
    expect((await marcasDe("classificacao", ids.ana)).length).toBeGreaterThan(0);
    expect(await service.zerar(ESCOLA, ids.turma, ids.professora)).toMatchObject({ rodada: 2, etapa: "exploracao" });
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, expId: EXP_ID } })).toBe(0);
    expect(await prisma.evidencia.count({ where: { escolaId: ESCOLA, expId: EXP_ID } })).toBe(0);
    expect(await entrar(ids.ana)).toMatchObject({ rodada: 2, passo: "credencial", voto: null });
    await ateACadeia(ids.ana);
    expect((await marcasDe("classificacao", ids.ana)).map((m) => m.rodada).sort()).toEqual([2]);
    expect(await prisma.exp06ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(2);
  });

  test("zerar no meio de uma jogada que marca: ou ela termina antes, ou recebe `rodada-mudou`", async () => {
    const certa = await escolhaDaRegra(ids.ana);
    const [jogada] = await Promise.allSettled([
      service.montarRegra(ESCOLA, ids.ana, ids.turma, certa),
      service.zerar(ESCOLA, ids.turma, ids.professora),
    ]);
    if (jogada.status === "rejected") {
      expect(["rodada-mudou", "passo-invalido"]).toContain(((jogada.reason as HttpException).getResponse() as { codigo: string }).codigo);
    }
    /* Toda marca da regra caiu numa rodada que tinha sessão da Ana. */
    for (const m of await marcasDe("regra", ids.ana)) expect([1, 2]).toContain(m.rodada);
  });
});

describe("atividade × rodada", () => {
  beforeAll(zerarMissao);

  test("o segundo clique em Criar não cria outra atividade; a nova nasce PRONTA", async () => {
    const antes = await entrar(ids.ana);
    const deNovo = await service.homologar(ESCOLA, ids.turma, ids.professora, ids.professora, {
      parametros: PARAMETROS_DE_TESTE,
      conteudo: conteudoDeTeste(),
      podcast: FALAS_DO_TEMA_PADRAO,
    });
    expect(deNovo).toMatchObject({ id: antes.pacoteId, ativo: true });
    const nova = await service.homologar(ESCOLA, ids.turma, ids.professora, ids.professora, {
      parametros: PARAMETROS_DE_TESTE,
      conteudo: conteudoDeTeste("Outra mostra da cidade"),
      podcast: FALAS_DO_TEMA_PADRAO,
    });
    expect(nova).toMatchObject({ ativo: false, origem: "ia", tema: "Outra mostra da cidade" });
    expect((await entrar(ids.ana)).pacoteId).toBe(antes.pacoteId);

    /* Só os textos aprovados: sem a segunda fase, não vai ao ar. */
    expect(await codigoDe(service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, nova.id))).toBe("imagens-nao-aprovadas");
    expect((await service.pacote(ESCOLA, ids.turma, ids.professora, nova.id)).imagensAprovadasEm).toBeNull();
    const historico = PacotesSchema.parse(await service.pacotes(ESCOLA, ids.turma, ids.professora)).historico;
    expect(historico.map((p) => [p.id, p.imagensAprovadas])).toEqual([
      [nova.id, false],
      [antes.pacoteId, true],
    ]);
    const aprovadas = await service.aprovarImagens(ESCOLA, ids.turma, ids.professora, nova.id);
    /* Idempotente: a segunda aprovação devolve o carimbo da primeira. */
    expect(await service.aprovarImagens(ESCOLA, ids.turma, ids.professora, nova.id)).toEqual(aprovadas);
    /* Aprovadas, as imagens não mudam mais: gerar a que falta é 409. */
    expect(await codigoDe(service.pacoteParaMidia(ESCOLA, ids.turma, ids.professora, nova.id))).toBe("imagens-ja-aprovadas");
    expect(await service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, nova.id)).toMatchObject({ rodada: 1, mudou: true });
    expect(await entrar(ids.ana)).toMatchObject({ pacoteId: nova.id, rodada: 1, passo: "credencial" });
    const pacotes = PacotesSchema.parse(await service.pacotes(ESCOLA, ids.turma, ids.professora));
    expect(pacotes.ativo).toMatchObject({ id: nova.id, midia: { total: 160, prontas: 0 } });
    expect(pacotes.historico.map((p) => [p.ativo, p.rodadas])).toEqual([
      [true, 1],
      [false, 1],
    ]);
    /* Voltar ao anterior, que já rodou, abre a SEGUINTE. */
    expect(await service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, antes.pacoteId)).toMatchObject({ rodada: 2, mudou: true });
    expect(await service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, antes.pacoteId)).toMatchObject({ mudou: false });
  });

  test("o podcast (ADR-151): a homologação grava as falas na transação, o segundo clique as troca, e a atividade vale depois das imagens", async () => {
    /* A mais recente é a "Outra mostra da cidade", de imagens aprovadas no teste anterior; a em andamento é a primeira. */
    const ultima = await prisma.exp06ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma }, orderBy: { criadoEm: "desc" } });
    const ativa = await prisma.exp06ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma, ativo: true } });
    const linha = await prisma.podcastRoteiro.findUniqueOrThrow({
      where: { escolaId_expId_atividadeId: { escolaId: ESCOLA, expId: EXP_ID, atividadeId: ultima.id } },
    });
    expect(linha.falas).toEqual(FALAS_DO_TEMA_PADRAO);
    expect(linha.aprovadoPor).toBe(ids.professora);

    /* O segundo clique, com o MESMO conteúdo e uma fala editada: nenhuma atividade nova, e a fala nova vale. */
    const editadas = {
      ...FALAS_DO_TEMA_PADRAO,
      mesa: "Pois é! E para a mesa ao lado não apareceu nenhum projeto do Rafa, só os de outra área, um atrás do outro.",
    };
    const deNovo = await service.homologar(ESCOLA, ids.turma, ids.professora, ids.professora, {
      parametros: PARAMETROS_DE_TESTE,
      conteudo: conteudoDeTeste("Outra mostra da cidade"),
      podcast: editadas,
    });
    expect(deNovo.id).toBe(ultima.id);
    const trocada = await prisma.podcastRoteiro.findMany({ where: { escolaId: ESCOLA, expId: EXP_ID, atividadeId: ultima.id } });
    expect(trocada).toHaveLength(1);
    expect(trocada[0]!.falas).toEqual(editadas);

    /* A atividade do podcast vale com as imagens APROVADAS (o pacoteParaMidia a recusaria), com a guarda de turma. */
    const fonte = fonteDoPodcastDaExp06ef1b(service);
    expect(await codigoDe(service.pacoteParaMidia(ESCOLA, ids.turma, ids.professora, ultima.id))).toBe("imagens-ja-aprovadas");
    expect(await fonte.atividade(ESCOLA, ids.turma, ids.professora, ultima.id)).toEqual({ id: ultima.id, tema: ultima.tema, padrao: false });
    expect(await fonte.atividade(ESCOLA, ids.turma, ids.professora, undefined)).toMatchObject({ id: ativa.id });
    expect(await codigoDe(fonte.atividade(ESCOLA, ids.turma, ids.outroProfessor, ultima.id))).toBe("turma-nao-encontrada");
    expect(await codigoDe(fonte.atividade(OUTRA_ESCOLA, ids.turmaVizinha, undefined, ultima.id))).toBe("atividade-nao-encontrada");
  });

  test("as imagens: gravadas por concatenação, lâmina a lâmina, e herdadas pelo mesmo pedido", async () => {
    const ativo = await prisma.exp06ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma, ativo: true } });
    await service.registrarMidia(ESCOLA, ativo.id, "proj-a1", "https://cdn/a1.webp");
    await service.registrarMidia(ESCOLA, ativo.id, "proj-b2", "https://cdn/b2.webp");
    await service.registrarMidia(ESCOLA, ativo.id, "proj-a1:bastidor", "https://cdn/a1-bastidor.webp");
    /* Chave que não é de lâmina conhecida não sai do banco. */
    await service.registrarMidia(ESCOLA, ativo.id, "proj-a1:selfie", "https://cdn/x.webp");
    expect((await service.pacote(ESCOLA, ids.turma, ids.professora, ativo.id)).imagens).toEqual({
      "proj-a1": "https://cdn/a1.webp",
      "proj-b2": "https://cdn/b2.webp",
      "proj-a1:bastidor": "https://cdn/a1-bastidor.webp",
    });
    const herdeira = await service.homologar(ESCOLA, ids.turma, ids.professora, ids.professora, {
      parametros: { ...PARAMETROS_DE_TESTE, contexto: "Turma da tarde" },
      conteudo: conteudoDeTeste("Mostra herdeira"),
      podcast: FALAS_DO_TEMA_PADRAO,
    });
    const linha = await prisma.exp06ef1bPacote.findUniqueOrThrow({ where: { id: herdeira.id } });
    expect(linha.midia).toEqual({
      "proj-a1": "https://cdn/a1.webp",
      "proj-b2": "https://cdn/b2.webp",
      "proj-a1:bastidor": "https://cdn/a1-bastidor.webp",
    });
    /* O post do estudante leva a URL. */
    await entrar(ids.bia);
    const feed = FeedSchema.parse(await service.pedirPasso(ESCOLA, ids.bia, ids.turma, "feed"));
    for (const p of feed.posts) {
      expect(p.imagem.url).toBe(p.projetoId === "proj-a1" ? "https://cdn/a1.webp" : p.projetoId === "proj-b2" ? "https://cdn/b2.webp" : null);
      expect(p.laminas).toEqual({ detalhe: null, equipe: null, bastidor: p.projetoId === "proj-a1" ? "https://cdn/a1-bastidor.webp" : null });
    }
  });

  test("o pacote de OUTRA turma não é desta; turma que o professor não leciona é 404", async () => {
    const daVizinha = await prepararAtividade(ids.turmaVizinha, OUTRA_ESCOLA);
    expect(await codigoDe(service.pacote(ESCOLA, ids.turma, ids.professora, daVizinha))).toBe("atividade-nao-encontrada");
    expect(await codigoDe(service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, daVizinha))).toBe("atividade-nao-encontrada");
    expect(await codigoDe(service.painel(ESCOLA, ids.turma, ids.outroProfessor))).toBe("turma-nao-encontrada");
    expect(await codigoDe(service.zerar(ESCOLA, ids.turma, ids.outroProfessor))).toBe("turma-nao-encontrada");
    expect(await codigoDe(service.pacotes(ESCOLA, ids.turmaVazia, ids.professora))).toBe("turma-nao-encontrada");
  });

  test("o banco padrão: um toque, sem IA, imagens aprovadas, no ar com `porNoAr` — e o podcast fixo do sheet", async () => {
    const criado = await service.usarBancoPadrao(ESCOLA, ids.turma, ids.professora, ids.professora, false);
    expect(criado).toMatchObject({ origem: "padrao", ativo: false, tema: "Feira de Ciências e Sustentabilidade" });
    /* Idempotente: a turma já tem o banco padrão. */
    expect((await service.usarBancoPadrao(ESCOLA, ids.turma, ids.professora, ids.professora, false)).id).toBe(criado.id);
    const linha = await prisma.exp06ef1bPacote.findUniqueOrThrow({ where: { id: criado.id } });
    expect(linha).toMatchObject({ origem: "padrao", disciplina: "ciencias", midia: {} });
    expect(linha.imagensAprovadasEm).not.toBeNull();
    expect(linha.aprovadoPor).toBe(ids.professora);
    const fonte = fonteDoPodcastDaExp06ef1b(service);
    expect(await fonte.atividade(ESCOLA, ids.turma, ids.professora, criado.id)).toMatchObject({ id: criado.id, padrao: true });
    /* "Usar Banco Padrão e Pôr no ar": no ar, rodada nova. */
    const noAr = await service.usarBancoPadrao(ESCOLA, ids.turma, ids.professora, ids.professora, true);
    expect(noAr).toMatchObject({ id: criado.id, ativo: true });
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s).toMatchObject({ pacoteId: criado.id, tema: "Feira de Ciências e Sustentabilidade" });
    expect(s.categorias.map((c) => c.hashtag)).toEqual(["#robotica", "#meioambiente", "#artes", "#saude"]);
    /* Homologar o rascunho do fallback como veio também é `padrao` — e leva as imagens do banco que já existem. */
    const homologado = await service.homologar(
      ESCOLA,
      ids.turma,
      ids.professora,
      ids.professora,
      {
        parametros: { disciplina: "ciencias", tema: "Feira de Ciências e Sustentabilidade", assuntos: "Banco padrão oficial da mostra." },
        conteudo: conteudoDoBancoPadrao(),
        podcast: FALAS_DO_TEMA_PADRAO,
      },
      { "proj-c10": "https://cdn/banco-c10.webp", "proj-c10:equipe": "https://cdn/banco-c10-equipe.webp" },
    );
    expect(homologado.origem).toBe("padrao");
    expect((await prisma.exp06ef1bPacote.findUniqueOrThrow({ where: { id: homologado.id } })).midia).toEqual({
      "proj-c10": "https://cdn/banco-c10.webp",
      "proj-c10:equipe": "https://cdn/banco-c10-equipe.webp",
    });
  });

  test("PROVA 9 (ligação): o banco padrão nasce com a `midia` das imagens do banco que existem; o reaproveitado fora do ar ganha as que faltavam", async () => {
    await limparMissao();
    const imagens = { "proj-a1": "https://cdn/banco-a1.webp", "proj-d10": "https://cdn/banco-d10.webp" };
    const criado = await service.usarBancoPadrao(ESCOLA, ids.turma, ids.professora, ids.professora, false, imagens);
    expect((await prisma.exp06ef1bPacote.findUniqueOrThrow({ where: { id: criado.id } })).midia).toEqual(imagens);
    /* De novo, com uma imagem a mais no storage: o pacote (ainda fora do ar) a ganha, sem perder as outras. */
    const mais = { ...imagens, "proj-b5": "https://cdn/banco-b5.webp" };
    expect((await service.usarBancoPadrao(ESCOLA, ids.turma, ids.professora, ids.professora, false, mais)).id).toBe(criado.id);
    expect((await prisma.exp06ef1bPacote.findUniqueOrThrow({ where: { id: criado.id } })).midia).toEqual(mais);
    /* No ar, a imagem não muda no meio da aula. */
    await service.usarBancoPadrao(ESCOLA, ids.turma, ids.professora, ids.professora, true, mais);
    await service.usarBancoPadrao(ESCOLA, ids.turma, ids.professora, ids.professora, false, { ...mais, "proj-c1": "https://cdn/x.webp" });
    expect((await prisma.exp06ef1bPacote.findUniqueOrThrow({ where: { id: criado.id } })).midia).toEqual(mais);
    /* O post do estudante leva a URL do banco; o sem imagem, `null` (a arte procedural). */
    await entrar(ids.ana);
    const feed = FeedSchema.parse(await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "feed"));
    for (const p of feed.posts) expect(p.imagem.url).toBe((mais as Record<string, string>)[p.projetoId] ?? null);
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
    await votar(ids.ana, "area_c");
    await entrar(ids.caio);
    await etapa("galeria");
    await service.acaoDaGaleria(ESCOLA, ids.ana, ids.turma, { tipo: "buscar", busca: "texto", area: null });
    await service.revisar(ESCOLA, ids.ana, ids.turma, ({ acao: "trocar" as const, projetoId: "proj-a1" }));
  });

  test("a evidência da Ana (a separação) é copiada para a Bia, a colega de computador", async () => {
    expect(await evidenciaDe(ids.ana, "EF06CO01")).toMatchObject([{ status: "atingiu", origem: "propria" }]);
    expect(await evidenciaDe(ids.bia, "EF06CO01")).toMatchObject([{ status: "atingiu", origem: "equipe" }]);
  });

  test("uma linha por computador; a lousa conta votos, taxa média e revisões, anônimos", async () => {
    const painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.professora));
    expect(painel.resumo.porComputador).toBe(true);
    expect(painel.linhas.slice(0, 2).map((l) => l.equipe?.nome)).toEqual(["Equipe 1", "Equipe 2"]);
    const [equipe1, equipe2] = painel.linhas;
    expect(equipe1).toMatchObject({
      estudanteId: ids.ana,
      entrou: true,
      votou: true,
      ocioso: false,
      separou: true,
      abriuAGaleria: false,
      buscou: true,
      revisou: true,
    });
    expect(equipe2).toMatchObject({ estudanteId: ids.caio, entrou: true, votou: false, passo: "credencial" });
    expect(painel.resumo.computadores).toEqual({ votaram: 1, total: 2 });
    expect(painel.resumo.separaram).toBe(1);
    expect(painel.resumo.votosPorArea.map((v) => [v.area, v.votos])).toEqual([
      ["area_a", 0],
      ["area_b", 0],
      ["area_c", 1],
      ["area_d", 0],
    ]);
    expect(painel.resumo.votosRevisadosPorArea.find((v) => v.area === "area_a")?.votos).toBe(1);
    /* A concentração: a Ana curtiu (7 de 10 na área dela); ninguém votou sem curtir. */
    expect(painel.resumo.concentracao).toEqual({ curtiram: 70, naoCurtiram: null });
    expect(painel.resumo).not.toHaveProperty("invisibilidadeMedia");
    expect(painel.resumo.revisao).toEqual({ mantiveram: 0, trocaram: 1 });
    expect(painel.resumo.ociosos).toBe(0);
  });

  test("nenhuma linha carrega voto, taxa nem nível — nem por chave, nem por valor", async () => {
    const painel = await service.painel(ESCOLA, ids.turma, ids.professora);
    const chaves = painel.linhas.flatMap((l) => Object.keys(l)).map((c) => c.toLowerCase());
    for (const proibido of PROIBIDO_NA_LINHA_DO_PAINEL) {
      expect({ proibido, colisao: [...new Set(chaves.filter((c) => c.includes(proibido)))] }).toEqual({ proibido, colisao: [] });
    }
    expect(JSON.stringify(painel.linhas)).not.toMatch(/proj-[a-d](10|[1-9])/);
    expect(JSON.stringify(painel.linhas)).not.toMatch(/concentra/i);
  });
});

describe("o preparo com IA falsa", () => {
  beforeEach(zerarMissao);

  test("válida: o rascunho sai normalizado, e a geração conta no pacote em sala", async () => {
    const preparo = new PreparoDaExp06ef1bService(ia, quota);
    ia.resposta = respostaDoPreparo();
    const r = await preparo.gerar(ESCOLA, ids.professora, "professor", PARAMETROS_DE_TESTE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toEqual(conteudoDeTeste(PARAMETROS_DE_TESTE.tema));
    await service.registrarGeracao(ESCOLA, ids.turma, r.tokens);
    const pacote = await prisma.exp06ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma, ativo: true } });
    /* Cinco chamadas (as categorias e as quatro áreas), 20 tokens cada: uma geração, 100 tokens. */
    expect(pacote).toMatchObject({ iaGeracoes: 1, iaTokens: 100 });
    expect(await quota.usadoHoje(ESCOLA, ids.professora)).toBe(100);
  });

  test("a saída fora da régua é regerada e, nas duas, `ia-indisponivel` — com o que foi pago debitado", async () => {
    const preparo = new PreparoDaExp06ef1bService(ia, quota);
    ia.resposta = respostaDoPreparo("area_c");
    const r = await preparo.gerar(ESCOLA, ids.professora, "professor", PARAMETROS_DE_TESTE);
    expect(r).toMatchObject({ ok: false, codigo: "ia-indisponivel", chamouIa: true });
    /* As cinco chamadas (a IA de teste não refaz a tentativa), a ruim inclusive: tudo pago, tudo debitado. */
    expect(await quota.usadoHoje(ESCOLA, ids.professora)).toBe(100);
  });

  test("sem saldo: `sem-saldo-de-ia`, sem chamar a IA", async () => {
    const preparo = new PreparoDaExp06ef1bService(ia, new QuotaZerada(prisma));
    const antes = ia.chamadas;
    const r = await preparo.gerar(ESCOLA, ids.professora, "professor", PARAMETROS_DE_TESTE);
    expect(r).toMatchObject({ ok: false, codigo: "sem-saldo-de-ia", chamouIa: false });
    expect(ia.chamadas).toBe(antes);
  });

  test("regenerar: o projeto novo mantém id e área; a IA fora do ar devolve falha para o controller", async () => {
    const preparo = new PreparoDaExp06ef1bService(ia, quota);
    const base = conteudoDeTeste();
    ia.resposta = { projeto: { ...base.projetos[0], id: undefined, titulo: "Lâmpada de garrafa PET" } };
    const r = await preparo.regenerar(ESCOLA, ids.professora, "professor", PARAMETROS_DE_TESTE, base, "proj-a1");
    expect(r.ok && r.valor).toMatchObject({ id: "proj-a1", area: "area_a", titulo: "Lâmpada de garrafa PET" });
    ia.resposta = null;
    expect(await preparo.regenerar(ESCOLA, ids.professora, "professor", PARAMETROS_DE_TESTE, base, "proj-a1")).toMatchObject({
      ok: false,
      codigo: "ia-indisponivel",
    });
  });
});

describe("PROVA 6: a 0.4.x continua legível — o pacote de 16 e a sessão 2.0.0", () => {
  let pacoteId = "";
  beforeAll(async () => {
    await limparMissao();
    /* O pacote de DEZESSEIS, com protótipo e depoimento, gravado como a 0.4.x gravava. */
    const legado = await prisma.exp06ef1bPacote.create({
      data: {
        escolaId: ESCOLA,
        turmaId: ids.turma,
        origem: "ia",
        disciplina: "ciencias",
        tema: "Mostra antiga",
        assuntos: "Assuntos da mostra antiga de teste",
        conteudo: conteudoLegadoDeTeste("Mostra antiga") as never,
        midia: {},
        ativo: false,
        criadoPor: ids.professora,
        imagensAprovadasEm: new Date(),
      },
    });
    pacoteId = legado.id;
    await service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, pacoteId);
    /* A sessão 2.0.0 da Ana: a saturação por formatos, gravada e votada. */
    await entrar(ids.ana);
    await prisma.exp06ef1bSessao.updateMany({
      where: { escolaId: ESCOLA, estudanteId: ids.ana, pacoteId },
      data: {
        versaoInstrumento: "2.0.0",
        passo: "lacrada",
        postsServidos: [
          "proj-a1:apresentacao",
          "proj-b2:apresentacao",
          "proj-c3:apresentacao",
          "proj-d4:apresentacao",
          "proj-b2:bastidor",
          "proj-b1:apresentacao",
          "proj-b2:prototipo",
          "proj-b2:depoimento",
          "proj-b1:bastidor",
          "proj-b1:prototipo",
        ],
        curtidos: ["proj-b2:apresentacao", "proj-b2:depoimento"],
        votoProjeto: "proj-b2",
        conviccao: "vi_tudo",
        votadoEm: new Date(),
      },
    });
    await etapa("galeria");
  });

  test("a sessão antiga é lida: o post `proj-b2:depoimento` desce com o texto do depoimento", async () => {
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s.feed.posts).toHaveLength(10);
    const depoimento = s.feed.posts.find((p) => p.id === "proj-b2:depoimento");
    const b2 = conteudoLegadoDeTeste().projetos.find((p) => p.id === "proj-b2");
    expect(depoimento).toMatchObject({ tipo: "depoimento", texto: b2?.depoimento });
    expect(s.feed.curtidos).toContain("proj-b2:depoimento");
  });

  test("a galeria do pacote de 16 funciona: 11 de 16, por área de 4, contrafactual de 10", async () => {
    const g = GaleriaSchema.parse(await service.galeria(ESCOLA, ids.ana, ids.turma));
    expect(g.projetos).toHaveLength(16);
    expect(g.invisibilidade).toEqual({ ocultos: 11, total: 16 });
    expect(g.porArea).toEqual([
      { area: "area_a", vistos: 1, total: 4 },
      { area: "area_b", vistos: 2, total: 4 },
      { area: "area_c", vistos: 1, total: 4 },
      { area: "area_d", vistos: 1, total: 4 },
    ]);
    expect(g.semCurtidas.flatMap((a) => a.posts)).toHaveLength(10);
    /* A troca só aceita estande do pacote: `proj-a10` não existe no de dezesseis. */
    expect(await codigoDe(service.revisar(ESCOLA, ids.ana, ids.turma, { acao: "trocar", projetoId: "proj-a10" }))).toBe("payload-invalido");
    expect(await codigoDe(service.acaoDaGaleria(ESCOLA, ids.ana, ids.turma, { tipo: "abrir", projetoId: "proj-c10" }))).toBe(
      "payload-invalido",
    );
  });

  test("o painel do pacote de 16 funciona, com a concentração da sessão antiga (7 de 10 na B)", async () => {
    const painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.professora));
    expect(painel.pacote.midia).toEqual({ total: 64, prontas: 0 });
    expect(painel.resumo.concentracao).toEqual({ curtiram: 70, naoCurtiram: null });
    expect(PacotesSchema.parse(await service.pacotes(ESCOLA, ids.turma, ids.professora)).ativo?.conteudo.projetos).toHaveLength(16);
  });

  test("uma sessão NOVA no pacote de 16 joga com o motor novo: dez projetos distintos, sem repetir", async () => {
    const feed = await rolarFeed(ids.bia, "area_a");
    expect(feed.posts).toHaveLength(10);
    expect(new Set(feed.posts.map((p) => p.projetoId)).size).toBe(10);
    expect(feed.posts.every((p) => p.tipo === "apresentacao")).toBe(true);
  });
});
