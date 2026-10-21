import { HttpException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider, AiResult } from "../src/ai/provider";
import { QuotaService, USUARIO_DA_AVALIACAO, type PerfilDaQuota } from "../src/ai/quota.service";
import { ASelecaoService, EXP_ID } from "../src/a-selecao/a-selecao.service";
import { POSTS_PADRAO, TEMA_PADRAO, type PostDaCobertura } from "../src/a-selecao/catalogo";
import { ClassificacaoService } from "../src/a-selecao/classificacao.service";
import { MuralSchema, PainelSchema, SessaoSchema } from "../src/a-selecao/contrato-de-rotas";
import { FALAS_DO_TEMA_PADRAO } from "../src/a-selecao/podcast";
import { PROIBIDO_NO_PAINEL } from "../src/a-selecao/invariantes";
import { ETAPAS, PASSOS } from "../src/a-selecao/regras/passos";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp07ef1b no Postgres: a RLS das quatro tabelas e os CHECKs, a
 * porta da sala, o latch concorrente, a atividade × rodada (zerar guarda, tema
 * novo volta à 1), o pareamento POR COMPUTADOR e o par que sobrevive a um PUT
 * das equipes, o recorte do gestor, o resolvedor das enquetes, o Canal A com IA
 * falsa, e a cópia para a equipe e a projeção `a_revisar`.
 *
 * UMA ESCOLA POR SUÍTE (mais a vizinha, para a RLS): o Jest paraleliza suítes.
 * Molde: o `quem-mandou-isso-postgres.spec.ts` da v1 da exp05ef1b e o
 * `evidencias-postgres.spec.ts`.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-a-selecao";
const OUTRA_ESCOLA = "teste-a-selecao-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

/**
 * O MESMO Prisma, com a role SEM `BYPASSRLS`. Sem isto a prova de isolamento
 * passa em falso: o usuário administrativo é SUPERUSER, e superusuário ignora
 * RLS mesmo com `FORCE ROW LEVEL SECURITY`.
 */
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/**
 * A IA do Canal A, controlada pela suíte. Por padrão ela FALHA, como o mock:
 * a publicação de toda criança passa pelo Canal A, e só os testes que querem
 * uma marca dizem o que a IA responde.
 */
class IaControlada implements AiProvider {
  resposta: unknown = null;
  atrasoMs = 0;
  tokens = 50;
  chamadas = 0;
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    this.chamadas += 1;
    if (this.atrasoMs) await new Promise((r) => setTimeout(r, this.atrasoMs));
    req.aoUsarTokens?.(this.tokens);
    if (this.resposta === null) throw new Error("IA de teste desligada");
    return req.validar(this.resposta);
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

/** A subclasse do `ai/AGENTS.md`: teto apertado sem mexer em `ia_quotas`, que é do contrato. */
class QuotaDeAvaliacaoZerada extends QuotaService {
  override async limiteDaLinha(linha: PerfilDaQuota): Promise<number> {
    return linha === "avaliacao" ? 0 : super.limiteDaLinha(linha);
  }
}

const ia = new IaControlada();
const quota = new QuotaService(prisma);
const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
evidencias.onModuleInit();
const service = new ASelecaoService(prisma, evidencias, new ClassificacaoService(ia, quota, 300, 1));

const ids = {
  turma: "",
  turmaSemLiberacao: "",
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
  /* Os do Canal A: o rate limit dele é por estudante e em memória (três por
     janela), e a Ana já publicou nas rodadas dos blocos anteriores. */
  gabi: "",
  hugo: "",
  iris: "",
  joao: "",
  lara: "",
};

const INSTITUCIONAL = ["post_a_1", "post_a_2", "post_a_3"];
const COMUNITARIO = ["post_b_1", "post_b_2", "post_b_3"];
const ESTATISTICO = ["post_c_1", "post_c_2", "post_c_3"];
const MISTA = ["post_a_1", "post_b_1", "post_c_1"];

const REFLEXAO =
  "Se o repórter ouvir só a diretoria, as salas quebradas e o calor que a gente passa ficam invisíveis. Nos Stories eu fiz igual: escolhi um lado só.";

/** Tudo da missão, das equipes, da evidência e da quota das duas escolas — entre um bloco e outro. */
/**
 * A atividade que a professora criaria e poria no ar: a plataforma não cria
 * atividade (ADR-130), então a suíte faz o caminho dela — criar (pronta) e
 * "Usar esta atividade agora". É o banco curado, como o preparo oferece.
 */
async function prepararAtividade(turmaId = ids.turma, escolaId = ESCOLA): Promise<string> {
  const criada = await service.homologar(escolaId, turmaId, undefined, ids.professora, {
    tema: TEMA_PADRAO,
    origem: "padrao",
    posts: POSTS_PADRAO.map((p) => ({ ...p })),
    podcast: { ...FALAS_DO_TEMA_PADRAO },
  });
  await service.aprovarImagens(escolaId, turmaId, undefined, criada.id);
  await service.colocarEmAndamento(escolaId, turmaId, undefined, criada.id);
  return criada.id;
}

/** Tudo da missão, sem atividade nenhuma — a turma que o professor ainda não preparou. */
async function limparMissao() {
  /* A cobertura leva o gate e as sessões por cascata, e a sessão leva a reflexão. */
  await prisma.exp07ef1bCobertura.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  ia.resposta = null;
  ia.atrasoMs = 0;
}

/** Tudo da missão, e uma atividade em andamento na turma. */
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

const entrar = (estudanteId: string, turmaId = ids.turma, escolaId = ESCOLA) =>
  service.sessao(escolaId, estudanteId, turmaId);

async function publicar(estudanteId: string, selecao: string[], legenda = "Escolhi estes posts para a escola.") {
  await entrar(estudanteId);
  await service.pedirPasso(ESCOLA, estudanteId, ids.turma, { para: "feed" });
  await service.pedirPasso(ESCOLA, estudanteId, ids.turma, { para: "salvos" });
  const estado = await service.decidir(ESCOLA, estudanteId, ids.turma, { selecao, legenda });
  /* A leitura da legenda roda DEPOIS da resposta (ADR-170): a suíte a espera
     para afirmar o que ela gravou. A rota nunca espera. */
  await service.esperarLeituras();
  return estado;
}

/**
 * A professora leva a turma ATÉ `para`, uma etapa por vez (o botão único nunca
 * pula — e a marcação, entre o Mural e as fichas, é obrigatória).
 */
async function etapa(para: (typeof ETAPAS)[number]) {
  const gate = await prisma.exp07ef1bGateTurma.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma } });
  let r = await service.mudarEtapa(ESCOLA, ids.turma, ids.professora, gate.etapa as (typeof ETAPAS)[number]);
  for (let i = ETAPAS.indexOf(gate.etapa as (typeof ETAPAS)[number]) + 1; i <= ETAPAS.indexOf(para); i++) {
    r = await service.mudarEtapa(ESCOLA, ids.turma, ids.professora, ETAPAS[i]!);
  }
  return r;
}

/** A atividade em andamento na turma — a montagem das equipes é dela (ADR-130). */
async function atividadeAtual(): Promise<string> {
  const linha = await prisma.exp07ef1bCobertura.findFirstOrThrow({
    where: { escolaId: ESCOLA, turmaId: ids.turma, ativa: true },
    select: { id: true },
  });
  return linha.id;
}

async function montarEquipes(grupos: string[][], computadores: number, ausentes: string[] = [], nomes?: string[]) {
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
      equipes: grupos.map((membros, i) => ({ nome: nomes?.[i] ?? `Equipe ${i + 1}`, membros })),
    },
    ids.professora,
  );
}

function evidenciaDe(estudanteId: string, habilidade = "EF07CO11") {
  return prisma.evidencia.findMany({
    where: { escolaId: ESCOLA, expId: EXP_ID, estudanteId, habilidade },
    select: { status: true, origem: true, situacao: true, rodada: true, atividadeId: true },
  });
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola da Seleção (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Escola vizinha (teste)" } });

  ids.turma = (await criarTurmaDeTeste(prisma, ESCOLA, "7A", "7EF")).id;
  ids.turmaSemLiberacao = (await criarTurmaDeTeste(prisma, ESCOLA, "7B", "7EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "7A vizinha", "7EF")).id;

  const pessoa = async (escolaId: string, username: string, role: string, nome: string, turmaId?: string) =>
    (
      await prisma.user.create({
        data: { escolaId, username, role, displayName: nome, passwordHash: "x", turmaId },
        select: { id: true },
      })
    ).id;

  ids.professora = await pessoa(ESCOLA, "selecao-prof", "professor", "Marta Prof");
  ids.outroProfessor = await pessoa(ESCOLA, "selecao-prof-7b", "professor", "Rui Prof");
  ids.ana = await pessoa(ESCOLA, "selecao-ana", "estudante", "Ana Clara Souza", ids.turma);
  ids.bia = await pessoa(ESCOLA, "selecao-bia", "estudante", "Bia Lima", ids.turma);
  ids.caio = await pessoa(ESCOLA, "selecao-caio", "estudante", "Caio Reis", ids.turma);
  ids.duda = await pessoa(ESCOLA, "selecao-duda", "estudante", "Duda Melo", ids.turma);
  ids.enzo = await pessoa(ESCOLA, "selecao-enzo", "estudante", "Enzo Paz", ids.turma);
  ids.fabi = await pessoa(ESCOLA, "selecao-fabi", "estudante", "Fabi Nunes", ids.turmaSemLiberacao);
  ids.gabi = await pessoa(ESCOLA, "selecao-gabi", "estudante", "Gabi Costa", ids.turma);
  ids.hugo = await pessoa(ESCOLA, "selecao-hugo", "estudante", "Hugo Dias", ids.turma);
  ids.iris = await pessoa(ESCOLA, "selecao-iris", "estudante", "Iris Rocha", ids.turma);
  ids.joao = await pessoa(ESCOLA, "selecao-joao", "estudante", "João Alves", ids.turma);
  ids.lara = await pessoa(ESCOLA, "selecao-lara", "estudante", "Lara Pinto", ids.turma);
  ids.vizinho = await pessoa(OUTRA_ESCOLA, "selecao-vizinho", "estudante", "Vito Vizinho", ids.turmaVizinha);

  const lecionar = (turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: { escolaId: ESCOLA, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
    });
  await lecionar(ids.turma, ids.professora);
  await lecionar(ids.turmaSemLiberacao, ids.outroProfessor);

  /* A PORTA DA SALA (ADR-69): a 7B é a turma SEM liberação. */
  await liberarParaTeste(prisma, ESCOLA, ids.turma, EXP_ID, ids.professora);
  await liberarParaTeste(prisma, OUTRA_ESCOLA, ids.turmaVizinha, EXP_ID, ids.vizinho);

  /* O `PUT` das equipes exige a missão no catálogo e de estudante. O `update`
     não toca em nome nem versão — a lição de `salas-postgres.spec.ts`. */
  await prisma.experiencia.upsert({
    where: { expId: EXP_ID },
    update: { publico: "estudante" },
    create: { expId: EXP_ID, nome: "A Seleção", versaoAtiva: "1.0.0", series: ["7EF"], publico: "estudante" },
  });
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

const TABELAS = ["exp07ef1b_coberturas", "exp07ef1b_gates_turma", "exp07ef1b_sessoes", "exp07ef1b_reflexoes"] as const;

describe("tenancy no banco (regra inviolável nº 1)", () => {
  beforeAll(async () => {
    await zerarMissao();
    await prepararAtividade(ids.turmaVizinha, OUTRA_ESCOLA);
    await entrar(ids.ana);
    await entrar(ids.vizinho, ids.turmaVizinha, OUTRA_ESCOLA);
    /* A reflexão entra CRUA: no fluxo ela só existe depois da explicação, e a
       RLS precisa ser provada agora nas quatro tabelas. */
    for (const [escolaId, estudanteId] of [
      [ESCOLA, ids.ana],
      [OUTRA_ESCOLA, ids.vizinho],
    ] as const) {
      const sessao = await prisma.exp07ef1bSessao.findFirstOrThrow({ where: { escolaId, estudanteId } });
      await prisma.exp07ef1bReflexao.create({
        data: { sessaoId: sessao.id, escolaId, texto: REFLEXAO, chars: [...REFLEXAO].length },
      });
    }
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

  /**
   * A prova que a leitura de código não dá: com a escola de cá armada, a linha
   * de lá SOME — nas quatro tabelas. A que pesa mais é a cobertura: ali mora o
   * GABARITO de cada post.
   */
  test("a RLS isola DE VERDADE: nada da escola vizinha existe daqui", async () => {
    const daqui = await runtime.comTenancy(
      async (tx) => ({
        coberturas: await tx.exp07ef1bCobertura.findMany({ select: { escolaId: true } }),
        gates: await tx.exp07ef1bGateTurma.findMany({ select: { escolaId: true } }),
        sessoes: await tx.exp07ef1bSessao.findMany({ select: { escolaId: true } }),
        reflexoes: await tx.exp07ef1bReflexao.findMany({ select: { escolaId: true } }),
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
  let sessaoDaAna = "";
  let coberturaId = "";

  beforeAll(async () => {
    await zerarMissao();
    const s = await entrar(ids.ana);
    sessaoDaAna = s.sessaoId;
    coberturaId = s.coberturaId;
  });

  const falha = (sql: string) => expect(prisma.$executeRawUnsafe(sql)).rejects.toThrow();
  const naSessao = (set: string) =>
    falha(`UPDATE exp07ef1b_sessoes SET ${set} WHERE id = '${sessaoDaAna}'::uuid`);

  test("o vocabulário dos passos e das etapas é o MESMO do código", async () => {
    const def = async (nome: string) =>
      (
        await prisma.$queryRawUnsafe<{ d: string }[]>(
          `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = '${nome}'`,
        )
      )[0]?.d ?? "";
    const passos = await def("exp07ef1b_sessoes_passo_check");
    for (const p of PASSOS) expect(passos).toContain(`'${p}'`);
    expect(passos.match(/'[a-z]+'::text/g)).toHaveLength(PASSOS.length);
    const etapas = await def("exp07ef1b_gates_turma_etapa_check");
    for (const e of ETAPAS) expect(etapas).toContain(`'${e}'`);
    expect(etapas.match(/'[a-z]+'::text/g)).toHaveLength(ETAPAS.length);
  });

  test("o LATCH: carimbo sem tríade, tríade sem carimbo e passo de antes com carimbo", async () => {
    await naSessao("publicada_em = now()");
    await naSessao(
      `selecao = ARRAY['post_a_1','post_b_1','post_c_1'], legenda = 'uma legenda qualquer', matriz = '{"institucional":1,"comunitario":1,"estatistico":1}'`,
    );
    await naSessao(
      `selecao = ARRAY['post_a_1','post_b_1','post_c_1'], legenda = 'uma legenda qualquer', matriz = '{"institucional":1,"comunitario":1,"estatistico":1}', publicada_em = now(), passo = 'feed'`,
    );
  });

  test("a tríade: três diferentes, dos doze ids — e a legenda de 10 a 140", async () => {
    const pub = (selecao: string, legenda = "uma legenda qualquer") =>
      naSessao(
        `selecao = ARRAY[${selecao}], legenda = '${legenda}', matriz = '{"institucional":1,"comunitario":1,"estatistico":1}', publicada_em = now(), passo = 'publicado'`,
      );
    await pub(`'post_a_1','post_a_1','post_c_1'`);
    await pub(`'post_a_1','post_b_1','post_z_9'`);
    await pub(`'post_a_1','post_b_1'`);
    await pub(`'post_a_1','post_b_1','post_c_1'`, "curta");
  });

  test("`fim` e `concluida_em` não divergem; o par é um só, e só depois do latch", async () => {
    await naSessao("passo = 'fim'");
    await naSessao("par_virtual = 'tomas', par_rotulo = 'Tomás'");
    await naSessao("par_virtual = 'joao', par_rotulo = 'João'");
  });

  test("a reflexão: 100 a 500 code points, e `chars` é o mesmo número", async () => {
    await falha(
      `INSERT INTO exp07ef1b_reflexoes (sessao_id, escola_id, texto, chars) VALUES ('${sessaoDaAna}'::uuid, '${ESCOLA}', '${"a".repeat(99)}', 99)`,
    );
    await falha(
      `INSERT INTO exp07ef1b_reflexoes (sessao_id, escola_id, texto, chars) VALUES ('${sessaoDaAna}'::uuid, '${ESCOLA}', '${"a".repeat(98)}😀😀', 102)`,
    );
    // O emoji conta UM no banco, como no Zod: 98 letras + 2 emojis = 100 code points.
    await prisma.$executeRawUnsafe(
      `INSERT INTO exp07ef1b_reflexoes (sessao_id, escola_id, texto, chars) VALUES ('${sessaoDaAna}'::uuid, '${ESCOLA}', '${"a".repeat(98)}😀😀', 100)`,
    );
    await prisma.exp07ef1bReflexao.deleteMany({ where: { sessaoId: sessaoDaAna } });
  });

  test("a cobertura: IA só homologada, doze posts, e UMA ativa por turma", async () => {
    const posts = JSON.stringify(POSTS_PADRAO);
    await falha(
      `INSERT INTO exp07ef1b_coberturas (escola_id, turma_id, tema, origem, posts, ativa) VALUES ('${ESCOLA}', '${ids.turma}'::uuid, 'Tema da IA', 'ia', '${posts.replace(/'/g, "''")}'::jsonb, false)`,
    );
    await falha(
      `INSERT INTO exp07ef1b_coberturas (escola_id, turma_id, tema, origem, posts, ativa) VALUES ('${ESCOLA}', '${ids.turma}'::uuid, 'Tema curto', 'padrao', '[]'::jsonb, false)`,
    );
    // O índice único PARCIAL: a turma já tem a cobertura que a professora pôs no ar.
    expect(coberturaId).not.toBe("");
    await falha(
      `INSERT INTO exp07ef1b_coberturas (escola_id, turma_id, tema, origem, posts, ativa) VALUES ('${ESCOLA}', '${ids.turma}'::uuid, 'Outra ativa', 'padrao', '${posts.replace(/'/g, "''")}'::jsonb, true)`,
    );
  });
});

describe("a porta da sala e a primeira entrada", () => {
  beforeAll(limparMissao);

  test("sem liberação na turma: 403 `missao-nao-liberada`, na sessão E no polling", async () => {
    expect(await codigoDe(entrar(ids.fabi, ids.turmaSemLiberacao))).toBe("missao-nao-liberada");
    expect(await codigoDe(service.gate(ESCOLA, ids.fabi, ids.turmaSemLiberacao))).toBe("missao-nao-liberada");
    expect(await prisma.exp07ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.fabi } })).toBe(0);
  });

  /**
   * A PLATAFORMA NUNCA CRIA A ATIVIDADE (ADR-130). Antes, a primeira entrada
   * criava a cobertura da Praça Central sozinha; agora a turma sem atividade em
   * andamento é a porta fechada — 403, a tela de "ainda não foi aberta" que a
   * experiência já mostra para a liberação — e NADA nasce no banco.
   */
  test("sem atividade em andamento: 403 `atividade-nao-preparada` — e nada é criado", async () => {
    expect(await codigoDe(entrar(ids.ana))).toBe("atividade-nao-preparada");
    expect(await codigoDe(service.painel(ESCOLA, ids.turma, ids.professora))).toBe("atividade-nao-preparada");
    expect(await codigoDe(service.zerar(ESCOLA, ids.turma, ids.professora))).toBe("atividade-nao-preparada");
    /* O polling não escreve nem recusa: devolve a etapa inicial, sem rodada. */
    expect(await service.gate(ESCOLA, ids.ana, ids.turma)).toMatchObject({ rodada: null, coberturaId: null });
    expect((await service.coberturas(ESCOLA, ids.turma, ids.professora)).ativa).toBeNull();
    expect(await prisma.exp07ef1bCobertura.count({ where: { escolaId: ESCOLA } })).toBe(0);
    expect(await prisma.exp07ef1bGateTurma.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("com a atividade da professora em andamento, a entrada abre a rodada 1 dela", async () => {
    const coberturaId = await prepararAtividade();
    const s = SessaoSchema.parse(await entrar(ids.ana));
    expect(s).toMatchObject({ coberturaId, rodada: 1, etapa: "exploracao", passo: "desafio", publicada: false, selecao: null });
    expect(s.cobertura.tema).toBe(TEMA_PADRAO);
    expect(s.cobertura.posts).toHaveLength(12);
    // A segunda entrada (outra criança, o F5) não cria outra.
    await entrar(ids.bia);
    await entrar(ids.ana);
    expect(await prisma.exp07ef1bCobertura.count({ where: { escolaId: ESCOLA } })).toBe(1);
    expect(await prisma.exp07ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(1);
  });

  test("os posts saem na ORDEM DO FEED e SEM o gabarito", async () => {
    const s = await entrar(ids.ana);
    expect(s.cobertura.posts.slice(0, 3).map((p) => p.perfil)).toEqual(["@folhaoficial_", "@voz_coletiva", "@metrica_urbana"]);
    const json = JSON.stringify(s);
    for (const chave of ["enquadramento", "tagFonte", "tagAngulo", "matriz", "autoridadeCitada"]) {
      expect({ chave, tem: json.includes(`"${chave}"`) }).toEqual({ chave, tem: false });
    }
    for (const p of POSTS_PADRAO) expect(json).not.toContain(p.tagFonte);
    for (const lente of ["institucional", "comunitario", "estatistico"]) expect(json).not.toContain(lente);
  });

  test("o polling do gate é magro e responde a etapa, a rodada e o passo", async () => {
    const g = await service.gate(ESCOLA, ids.ana, ids.turma);
    expect(g).toMatchObject({ etapa: "exploracao", rodada: 1, passoEfetivo: "desafio", aguardandoOProfessor: false });
  });
});

describe("o latch", () => {
  beforeAll(zerarMissao);

  test("dois toques simultâneos em Confirmar: um publica, o outro recebe 409 `latch-ja-confirmado`", async () => {
    await entrar(ids.ana);
    const [a, b] = await Promise.allSettled([
      service.decidir(ESCOLA, ids.ana, ids.turma, { selecao: INSTITUCIONAL, legenda: "Escolhi as fontes oficiais." }),
      service.decidir(ESCOLA, ids.ana, ids.turma, { selecao: COMUNITARIO, legenda: "Escolhi os moradores." }),
    ]);
    const estados = [a, b].map((r) => (r.status === "fulfilled" ? "publicou" : r.reason));
    expect(estados.filter((e) => e === "publicou")).toHaveLength(1);
    const recusa = estados.find((e) => e !== "publicou");
    expect(recusa).toBeInstanceOf(HttpException);
    expect((recusa as HttpException).getResponse()).toMatchObject({ codigo: "latch-ja-confirmado" });

    const sessao = await prisma.exp07ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(sessao.passo).toBe("publicado");
    expect(sessao.publicadaEm).not.toBeNull();
    // A matriz foi calculada NO SERVIDOR, a partir da cobertura.
    expect([
      { institucional: 3, comunitario: 0, estatistico: 0 },
      { institucional: 0, comunitario: 3, estatistico: 0 },
    ]).toContainEqual(sessao.matriz);
    expect(await codigoDe(service.decidir(ESCOLA, ids.ana, ids.turma, { selecao: MISTA, legenda: "De novo, por favor." }))).toBe(
      "latch-ja-confirmado",
    );
    expect(await codigoDe(service.pedirPasso(ESCOLA, ids.ana, ids.turma, { para: "feed" }))).toBe("latch-ja-confirmado");
  });

  test("a legenda com link volta 422 e não publica nada", async () => {
    await entrar(ids.bia);
    const r = await codigoDe(
      service.decidir(ESCOLA, ids.bia, ids.turma, { selecao: MISTA, legenda: "Leiam em www.praca.com.br" }),
    );
    expect(r).toBe("legenda-com-link");
    const sessao = await prisma.exp07ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.bia } });
    expect(sessao.publicadaEm).toBeNull();
  });

  test("antes do Mural, o Mural não abre; sem publicar, também não", async () => {
    expect(await codigoDe(service.mural(ESCOLA, ids.ana, ids.turma))).toBe("mural-nao-liberado");
    expect(await codigoDe(service.mural(ESCOLA, ids.bia, ids.turma))).toBe("stories-nao-publicados");
  });
});

describe("o pareamento POR COMPUTADOR, e o par que sobrevive a um PUT das equipes", () => {
  beforeAll(async () => {
    await zerarMissao();
    /* Dois computadores (Ala A × Ala B) e o Enzo AUSENTE na montagem. */
    await montarEquipes(
      [
        [ids.ana, ids.bia],
        [ids.caio, ids.duda],
      ],
      2,
      [ids.enzo],
    );
    await publicar(ids.ana, INSTITUCIONAL, "Escolhi o que a prefeitura anunciou.");
    await publicar(ids.caio, COMUNITARIO, "Escolhi quem mora perto da praça.");
  });

  test("abrir o Mural pareia os dois computadores entre si, com o nome da equipe congelado", async () => {
    const r = await etapa("mural");
    expect(r).toMatchObject({ etapa: "mural", proximaEtapa: "marcacao", pareadas: 2 });

    const mural = MuralSchema.parse(await service.mural(ESCOLA, ids.ana, ids.turma));
    expect(mural.par).toMatchObject({ rotulo: "Equipe 2", virtual: false, legenda: "Escolhi quem mora perto da praça." });
    expect(mural.par.posts.map((p) => p.id)).toEqual(COMUNITARIO);
    expect(mural.minha.posts.map((p) => p.id)).toEqual(INSTITUCIONAL);
    // Antes das fichas: a tela nua — o gabarito NÃO está na resposta.
    expect(mural.fichasReveladas).toBe(false);
    expect(mural.minha.fichas).toBeNull();
    expect(mural.par.equilibrio).toBeNull();
    const json = JSON.stringify(mural);
    for (const p of POSTS_PADRAO) expect(json).not.toContain(p.tagFonte);

    const doCaio = await service.mural(ESCOLA, ids.caio, ids.turma);
    expect(doCaio.par).toMatchObject({ rotulo: "Equipe 1", virtual: false });
  });

  test("o segundo clique no botão não pareia de novo; pular etapa é 409", async () => {
    expect(await etapa("mural")).toMatchObject({ etapa: "mural", pareadas: 0 });
    const pedir = (para: (typeof ETAPAS)[number]) => service.mudarEtapa(ESCOLA, ids.turma, ids.professora, para);
    expect(await codigoDe(pedir("explicacao"))).toBe("transicao-de-etapa-invalida");
    /* A marcação é obrigatória (ADR-170): do Mural não se pula para as fichas. */
    expect(await codigoDe(pedir("fichas"))).toBe("transicao-de-etapa-invalida");
    expect(await codigoDe(pedir("exploracao"))).toBe("transicao-de-etapa-invalida");
  });

  test("quem publica DEPOIS do Mural aberto recebe o colega virtual mais distante", async () => {
    await publicar(ids.enzo, ESTATISTICO, "Escolhi os números da obra.");
    const mural = await service.mural(ESCOLA, ids.enzo, ids.turma);
    expect(mural.par).toMatchObject({ rotulo: "Tomás", virtual: true });
    expect(mural.par.posts.map((p) => p.id)).toEqual(["post_a_1", "post_a_2", "post_a_4"]);
  });

  test("o painel conta por COMPUTADOR, e o Y do \"X de Y\" vem da montagem", async () => {
    const painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.professora));
    expect(painel.resumo.porComputador).toBe(true);
    // Ana+Bia e Caio+Duda viram UMA linha cada; quem não está em equipe é a própria linha.
    expect(painel.linhas.slice(0, 3).map((l) => l.equipe?.nome ?? l.nome)).toEqual(["Equipe 1", "Equipe 2", "Enzo Paz"]);
    expect(painel.linhas).toHaveLength(8);
    expect(painel.resumo.total).toBe(8);
    // Três publicaram; a montagem declarou DOIS computadores — o colapso contaria oito.
    expect(painel.resumo.computadores).toEqual({ publicaram: 3, total: 2 });
    expect(painel.linhas.filter((l) => l.publicou).every((l) => l.passo === "mural")).toBe(true);
    expect(painel.linhas.find((l) => l.nome === "Gabi Costa")).toMatchObject({ iniciou: false, passo: "desafio" });
    expect(painel.resumo.distribuicaoMedia).toEqual({ institucional: 34, comunitario: 33, estatistico: 33 });
  });

  test("o PUT das equipes recria os ids — e o par da Ana continua o mesmo", async () => {
    await montarEquipes(
      [
        [ids.ana, ids.bia],
        [ids.caio, ids.duda],
      ],
      2,
      [],
      ["Ala A", "Ala B"],
    );
    const mural = await service.mural(ESCOLA, ids.ana, ids.turma);
    expect(mural.par).toMatchObject({ rotulo: "Equipe 2", virtual: false });
    expect(mural.par.posts.map((p) => p.id)).toEqual(COMUNITARIO);
  });

  test("as fichas acendem com a etapa `fichas`: fonte, ângulo, lente e equilíbrio", async () => {
    await etapa("fichas");
    const mural = MuralSchema.parse(await service.mural(ESCOLA, ids.ana, ids.turma));
    expect(mural.fichasReveladas).toBe(true);
    expect(mural.minha.fichas?.[0]).toEqual({
      postId: "post_a_1",
      fonte: "Gabinete da Prefeitura",
      angulo: "Maquete digital do projeto concluído",
      enquadramento: "institucional",
    });
    expect(mural.minha.equilibrio).toEqual({ institucional: 100, comunitario: 0, estatistico: 0 });
    expect(mural.par.equilibrio).toEqual({ institucional: 0, comunitario: 100, estatistico: 0 });
  });

  test("nenhuma chave do painel ordena crianças", async () => {
    const painel = await service.painel(ESCOLA, ids.turma, ids.professora);
    const chavesDe = (valor: unknown): string[] =>
      valor === null || typeof valor !== "object"
        ? []
        : Array.isArray(valor)
          ? valor.flatMap(chavesDe)
          : Object.entries(valor as Record<string, unknown>).flatMap(([k, v]) => [k, ...chavesDe(v)]);
    const chaves = chavesDe(painel).map((c) => c.toLowerCase());
    for (const proibido of PROIBIDO_NO_PAINEL) {
      expect({ proibido, colisao: [...new Set(chaves.filter((c) => c.includes(proibido)))] }).toEqual({ proibido, colisao: [] });
    }
  });
});

describe("a sala de UM computador (projeção)", () => {
  beforeAll(async () => {
    await zerarMissao();
    await montarEquipes([[ids.ana, ids.bia, ids.caio, ids.duda, ids.enzo]], 1);
  });

  test("todo mundo recebe o colega virtual — não há outra tela para comparar", async () => {
    await publicar(ids.ana, COMUNITARIO);
    await etapa("mural");
    const mural = await service.mural(ESCOLA, ids.ana, ids.turma);
    expect(mural.par).toMatchObject({ rotulo: "Tomás", virtual: true });
  });
});

describe("atividade × rodada: zerar guarda a sessão (a evidência sai), a atividade nova nasce pronta", () => {
  beforeAll(zerarMissao);

  test("zerar abre a rodada 2 e a sessão da rodada 1 FICA, com a tríade", async () => {
    await publicar(ids.ana, MISTA, "Juntei as três fontes para a escola ver tudo.");
    const antes = await entrar(ids.ana);
    expect(antes).toMatchObject({ rodada: 1, publicada: true });

    const z = await service.zerar(ESCOLA, ids.turma, ids.professora);
    expect(z).toMatchObject({ rodada: 2, etapa: "exploracao", coberturaId: antes.coberturaId });

    const depois = await entrar(ids.ana);
    expect(depois).toMatchObject({ rodada: 2, coberturaId: antes.coberturaId, publicada: false, passo: "desafio" });
    expect(depois.sessaoId).not.toBe(antes.sessaoId);

    const sessoes = await prisma.exp07ef1bSessao.findMany({
      where: { escolaId: ESCOLA, estudanteId: ids.ana },
      orderBy: { rodada: "asc" },
      select: { rodada: true, selecao: true },
    });
    expect(sessoes).toEqual([
      { rodada: 1, selecao: MISTA },
      { rodada: 2, selecao: [] },
    ]);
  });

  /**
   * CRIAR NÃO PÕE NO AR (ADR-130): a professora prepara a próxima aula com a de
   * hoje rodando. Quem troca o que a turma faz é o "Usar esta atividade agora".
   */
  test("tema novo é ATIVIDADE nova: nasce pronta, e a em andamento continua até a professora trocar", async () => {
    const anterior = await entrar(ids.ana);
    const posts: PostDaCobertura[] = POSTS_PADRAO.map((p) => ({ ...p }));
    const falasDoTema = {
      institucional:
        "A Folha Oficial vinha com a planta nova da biblioteca, o comunicado da secretaria e a data de entrega, tudo arrumadinho.",
      comunitario:
        "Aí logo embaixo você rolava mais um pouco e via a Voz Coletiva: vizinhos reclamando do barulho e da falta de lugar para estudar.",
      estatistico:
        "E se não bastasse, tinha a Métrica Urbana com gráficos do custo da reforma e dos empréstimos de livros antes e depois.",
    };
    // A cobertura curada lê as falas do sheet.
    expect((await service.coberturas(ESCOLA, ids.turma, ids.professora)).ativa?.podcast).toEqual(FALAS_DO_TEMA_PADRAO);
    const nova = await service.homologar(ESCOLA, ids.turma, ids.professora, ids.professora, {
      tema: "A reforma da biblioteca do bairro",
      origem: "ia",
      posts,
      podcast: falasDoTema,
    });
    expect(nova.podcast).toEqual(falasDoTema);
    expect(nova).toMatchObject({ ativa: false, origem: "ia" });
    expect(nova.id).not.toBe(anterior.coberturaId);

    /* Pronta: a turma segue na anterior, na mesma rodada. */
    expect(await entrar(ids.ana)).toMatchObject({ coberturaId: anterior.coberturaId, rodada: 2 });
    expect(await service.cobertura(ESCOLA, ids.turma, ids.professora, nova.id)).toMatchObject({
      ativa: false,
      rodada: null,
      etapa: null,
      rodadas: 0,
      tema: "A reforma da biblioteca do bairro",
      imagensAprovadasEm: null,
    });

    /* As duas fases (ADR-146): os textos foram aprovados, as imagens não — não
       vai ao ar, e a lista diz por quê. */
    expect(await codigoDe(service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, nova.id))).toBe(
      "imagens-nao-aprovadas",
    );
    expect(
      (await service.coberturas(ESCOLA, ids.turma, ids.professora)).historico.find((c) => c.id === nova.id),
    ).toMatchObject({ imagensAprovadas: false });
    const aprovada = await service.aprovarImagens(ESCOLA, ids.turma, ids.professora, nova.id);
    // Idempotente: a segunda aprovação devolve o carimbo da primeira.
    expect(await service.aprovarImagens(ESCOLA, ids.turma, ids.professora, nova.id)).toEqual(aprovada);
    // Aprovadas, as imagens não mudam mais.
    expect(await codigoDe(service.coberturaEmValidacao(ESCOLA, ids.turma, ids.professora, nova.id))).toBe(
      "imagens-ja-aprovadas",
    );

    const trocou = await service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, nova.id);
    expect(trocou).toMatchObject({ coberturaId: nova.id, rodada: 1, etapa: "exploracao", mudou: true });
    /* O segundo clique não muda nada. */
    expect(await service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, nova.id)).toMatchObject({ mudou: false });

    const s = await entrar(ids.ana);
    expect(s).toMatchObject({ coberturaId: nova.id, rodada: 1, publicada: false });
    expect(s.cobertura.tema).toBe("A reforma da biblioteca do bairro");

    const coberturas = await service.coberturas(ESCOLA, ids.turma, ids.professora);
    expect(coberturas.ativa?.id).toBe(nova.id);
    // As falas do tema da IA ficam na cobertura: são o Bloco 2 do podcast desta atividade.
    expect(coberturas.ativa?.podcast).toEqual(falasDoTema);
    expect(coberturas.historico.map((c) => [c.ativa, c.rodadas])).toEqual([
      [true, 1],
      [false, 2],
    ]);
    // A sessão da atividade anterior não foi apagada.
    expect(await prisma.exp07ef1bSessao.count({ where: { escolaId: ESCOLA, coberturaId: anterior.coberturaId } })).toBe(2);
    const cobertura = await prisma.exp07ef1bCobertura.findUniqueOrThrow({ where: { id: nova.id } });
    expect(cobertura.aprovadaPor).toBe(ids.professora);

    /* Voltar à anterior, que já rodou duas rodadas, abre a TERCEIRA: retomar a
       segunda depois do Mural seria o "voltar" que o botão único proíbe. */
    const voltou = await service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, anterior.coberturaId);
    expect(voltou).toMatchObject({ coberturaId: anterior.coberturaId, rodada: 3, etapa: "exploracao", mudou: true });
    expect(await entrar(ids.ana)).toMatchObject({ coberturaId: anterior.coberturaId, rodada: 3, publicada: false });
    expect(await prisma.exp07ef1bCobertura.count({ where: { escolaId: ESCOLA, turmaId: ids.turma, ativa: true } })).toBe(1);
  });

  test("a cobertura de OUTRA turma não é desta: 404 ao ler e ao pôr no ar", async () => {
    const daVizinha = await prepararAtividade(ids.turmaVizinha, OUTRA_ESCOLA);
    expect(await codigoDe(service.cobertura(ESCOLA, ids.turma, ids.professora, daVizinha))).toBe("atividade-nao-encontrada");
    expect(await codigoDe(service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, daVizinha))).toBe(
      "atividade-nao-encontrada",
    );
    expect(await codigoDe(service.colocarEmAndamento(ESCOLA, ids.turma, ids.professora, "nao-e-uuid"))).toBe(
      "atividade-nao-encontrada",
    );
  });

  test("turma que o professor não leciona é 404, nunca 403", async () => {
    expect(await codigoDe(service.painel(ESCOLA, ids.turma, ids.outroProfessor))).toBe("turma-nao-encontrada");
    expect(await codigoDe(service.zerar(ESCOLA, ids.turma, ids.outroProfessor))).toBe("turma-nao-encontrada");
  });
});

describe("a reflexão encerra a missão (o Canal B saiu, ADR-170)", () => {
  beforeAll(zerarMissao);

  test("a reflexão só com a explicação liberada, e leva direto ao fim", async () => {
    await publicar(ids.ana, INSTITUCIONAL, "Escolhi o que a prefeitura anunciou.");
    expect(await codigoDe(service.refletir(ESCOLA, ids.ana, ids.turma, REFLEXAO))).toBe("reflexao-nao-liberada");
    await etapa("explicacao");
    const r = await service.pedirPasso(ESCOLA, ids.ana, ids.turma, { para: "reflexao" });
    expect(r.passo).toBe("reflexao");

    const comEmoji = `${REFLEXAO} 😀`;
    const estado = await service.refletir(ESCOLA, ids.ana, ids.turma, comEmoji);
    expect(estado).toMatchObject({ passo: "fim", reflexaoEnviada: true });
    expect(estado.concluidaEm).not.toBeNull();
    const linha = await prisma.exp07ef1bReflexao.findFirstOrThrow({ where: { escolaId: ESCOLA } });
    expect(linha.chars).toBe([...comEmoji].length);
    expect(await codigoDe(service.refletir(ESCOLA, ids.ana, ids.turma, REFLEXAO))).toBe("reflexao-ja-enviada");
  });

  test("concluir é idempotente (fica para a sessão de antes e para a tela antiga)", async () => {
    const a = await service.concluir(ESCOLA, ids.ana, ids.turma);
    expect(a.passo).toBe("fim");
    const b = await service.concluir(ESCOLA, ids.ana, ids.turma);
    expect(b.concluidaEm).toBe(a.concluidaEm);
    expect(await codigoDe(service.concluir(ESCOLA, ids.bia, ids.turma))).toBe("reflexao-pendente");
  });

  test("a sessão de antes, parada em `enquetes`, ainda conclui", async () => {
    await publicar(ids.bia, COMUNITARIO);
    await prisma.exp07ef1bSessao.updateMany({ where: { escolaId: ESCOLA, estudanteId: ids.bia }, data: { passo: "enquetes" } });
    expect((await service.concluir(ESCOLA, ids.bia, ids.turma)).passo).toBe("fim");
  });

  test("o recorte do gestor: a legenda e a reflexão só para quem leciona", async () => {
    const daProfessora = await service.painel(ESCOLA, ids.turma, ids.professora);
    const doGestor = await service.painel(ESCOLA, ids.turma, undefined);
    const linhaP = daProfessora.linhas.find((l) => l.estudanteId === ids.ana)!;
    const linhaG = doGestor.linhas.find((l) => l.estudanteId === ids.ana)!;
    expect(linhaP).toMatchObject({ entregouReflexao: true, legenda: "Escolhi o que a prefeitura anunciou." });
    expect(linhaP.reflexaoTexto).toContain("salas quebradas");
    expect(linhaG).toMatchObject({ entregouReflexao: true, publicou: true, legenda: null, reflexaoTexto: null });
  });
});

describe("a marcação do post do colega (EF07CO08, ADR-170)", () => {
  beforeAll(async () => {
    await zerarMissao();
    /* Ana institucional × Bia comunitária: o pareamento as junta (a maior distância). */
    await publicar(ids.ana, INSTITUCIONAL);
    await publicar(ids.bia, COMUNITARIO);
    await publicar(ids.caio, MISTA);
    await etapa("mural");
  });

  const marcaDaMarcacao = (estudanteId: string) =>
    prisma.evidenciaMarca.findMany({
      where: { escolaId: ESCOLA, expId: EXP_ID, marcador: "marcacao-colega", estudanteId },
      select: { status: true },
    });

  test("fora da etapa `marcacao`: 409 marcacao-fechada", async () => {
    expect(await codigoDe(service.marcar(ESCOLA, ids.ana, ids.turma, { postId: "post_b_1" }))).toBe("marcacao-fechada");
  });

  test("só um post do PAR: o resto é 422 marcacao-fora-do-par", async () => {
    await etapa("marcacao");
    expect(await codigoDe(service.marcar(ESCOLA, ids.ana, ids.turma, { postId: "post_c_4" }))).toBe(
      "marcacao-fora-do-par",
    );
  });

  test("o por quê só depois de marcar, e passa pelo sanitizador", async () => {
    expect(await codigoDe(service.explicarMarcacao(ESCOLA, ids.ana, ids.turma, "porque sim"))).toBe("marcacao-pendente");
    const estado = await service.marcar(ESCOLA, ids.ana, ids.turma, { postId: "post_b_1" });
    expect(estado.marcacao).toEqual({ postId: "post_b_1", nenhum: false, porque: null });
    expect(await codigoDe(service.explicarMarcacao(ESCOLA, ids.ana, ids.turma, "veja www.site.com"))).toBe(
      "legenda-com-link",
    );
    const com = await service.explicarMarcacao(ESCOLA, ids.ana, ids.turma, "os moradores contam o outro lado");
    expect(com.marcacao?.porque).toBe("os moradores contam o outro lado");
  });

  test("a última marcação vale, e 'nada' e post não convivem", async () => {
    await service.marcar(ESCOLA, ids.bia, ids.turma, { postId: "post_a_1" });
    const estado = await service.marcar(ESCOLA, ids.bia, ids.turma, { nenhum: true });
    expect(estado.marcacao).toMatchObject({ postId: null, nenhum: true });
  });

  test("o painel conta quem marcou, e o por quê só para quem leciona", async () => {
    const daProfessora = await service.painel(ESCOLA, ids.turma, ids.professora);
    expect(daProfessora.resumo.marcaram).toBe(2);
    expect(daProfessora.linhas.find((l) => l.estudanteId === ids.ana)).toMatchObject({
      marcacao: { postId: "post_b_1", nenhum: false },
      marcacaoPorque: "os moradores contam o outro lado",
    });
    const doGestor = await service.painel(ESCOLA, ids.turma, undefined);
    expect(doGestor.linhas.find((l) => l.estudanteId === ids.ana)?.marcacaoPorque).toBeNull();
  });

  test("NENHUMA marca antes das fichas: o nível congela na abertura delas", async () => {
    expect(await marcaDaMarcacao(ids.ana)).toEqual([]);
    await etapa("fichas");
    expect(await marcaDaMarcacao(ids.ana)).toEqual([{ status: "atingiu" }]);
    expect(await marcaDaMarcacao(ids.bia)).toEqual([{ status: "nao_atingiu" }]);
    /* Caio não marcou: sem marca — "Não avaliado", nunca "não atingiu". */
    expect(await marcaDaMarcacao(ids.caio)).toEqual([]);
    expect(await evidenciaDe(ids.ana, "EF07CO08")).toMatchObject([{ status: "atingiu", origem: "propria" }]);
  });

  test("depois das fichas a marcação fecha", async () => {
    expect(await codigoDe(service.marcar(ESCOLA, ids.caio, ids.turma, { nenhum: true }))).toBe("marcacao-fechada");
  });
});

describe("a leitura da legenda com IA falsa (EF07CO11, ADR-170)", () => {
  beforeEach(zerarMissao);

  const marcasDaLegenda = () =>
    prisma.evidenciaMarca.findMany({
      where: { escolaId: ESCOLA, expId: EXP_ID, marcador: "legenda-publicada" },
      select: { estudanteId: true, status: true },
    });
  const leituraDe = (estudanteId: string) =>
    prisma.exp07ef1bSessao.findFirstOrThrow({
      where: { escolaId: ESCOLA, estudanteId },
      select: { legendaLeitura: true, legendaRazao: true, legendaConteudo: true, legendaNivel: true },
    });

  test("válida: os indicadores viram o nível, a EF07CO11 é marcada, e paga a quota de AVALIAÇÃO", async () => {
    ia.resposta = { razao: true, conteudo: true, semRelacao: false };
    const avaliacaoAntes = await quota.usadoHoje(ESCOLA, USUARIO_DA_AVALIACAO);
    await publicar(ids.gabi, MISTA, "Juntei a prefeitura, os moradores e os números.");
    expect(await marcasDaLegenda()).toEqual([{ estudanteId: ids.gabi, status: "atingiu" }]);
    expect(await leituraDe(ids.gabi)).toEqual({
      legendaLeitura: "ia",
      legendaRazao: true,
      legendaConteudo: true,
      legendaNivel: "atingiu",
    });
    expect(await quota.usadoHoje(ESCOLA, USUARIO_DA_AVALIACAO)).toBe(avaliacaoAntes + 50);
    expect(await quota.usadoHoje(ESCOLA, ids.gabi)).toBe(0);
  });

  test("a resposta do latch não espera a IA: a leitura nasce PENDENTE", async () => {
    ia.resposta = { razao: false, conteudo: true, semRelacao: false };
    await entrar(ids.hugo);
    await service.pedirPasso(ESCOLA, ids.hugo, ids.turma, { para: "feed" });
    await service.pedirPasso(ESCOLA, ids.hugo, ids.turma, { para: "salvos" });
    await service.decidir(ESCOLA, ids.hugo, ids.turma, { selecao: MISTA, legenda: "A praça vai ter pista de skate." });
    expect((await leituraDe(ids.hugo)).legendaLeitura).toBe("pendente");
    await service.esperarLeituras();
    expect(await leituraDe(ids.hugo)).toMatchObject({ legendaLeitura: "ia", legendaNivel: "em_processo" });
  });

  test("a IA falhou: a RESERVA grava só a sugestão — sem marca, Não avaliado até o professor", async () => {
    ia.resposta = null;
    await publicar(ids.iris, INSTITUCIONAL, "Escolhi porque a prefeitura anunciou a reforma da praça.");
    expect(await marcasDaLegenda()).toEqual([]);
    expect(await leituraDe(ids.iris)).toMatchObject({ legendaLeitura: "reserva", legendaRazao: true });
    const linha = (await service.painel(ESCOLA, ids.turma, ids.professora)).linhas.find((l) => l.estudanteId === ids.iris);
    expect(linha?.leituraDaLegenda).toMatchObject({ estado: "reserva", explicaAEscolha: true });
  });

  test("sem saldo de AVALIAÇÃO: nem chama a IA, cai na reserva", async () => {
    const semSaldo = new ASelecaoService(prisma, evidencias, new ClassificacaoService(ia, new QuotaDeAvaliacaoZerada(prisma), 300, 1));
    ia.resposta = { razao: true, conteudo: true, semRelacao: false };
    const antes = ia.chamadas;
    await entrar(ids.joao);
    await semSaldo.decidir(ESCOLA, ids.joao, ids.turma, { selecao: MISTA, legenda: "Escolhi um de cada veículo." });
    await semSaldo.esperarLeituras();
    expect(ia.chamadas).toBe(antes);
    expect(await marcasDaLegenda()).toEqual([]);
    expect((await leituraDe(ids.joao)).legendaLeitura).toBe("reserva");
  });

  test("a cópia para a EQUIPE: o colega de computador recebe o nível, valendo", async () => {
    await montarEquipes([[ids.lara, ids.bia], [ids.caio]], 2);
    ia.resposta = { razao: false, conteudo: true, semRelacao: false };
    await publicar(ids.lara, INSTITUCIONAL, "A praça vai ter pista nova e segurança.");
    expect(await evidenciaDe(ids.lara)).toMatchObject([{ status: "em_processo", origem: "propria", situacao: "valida" }]);
    expect(await evidenciaDe(ids.bia)).toMatchObject([{ status: "em_processo", origem: "equipe", situacao: "valida" }]);
  });

  test("a PROJEÇÃO (um computador): a cópia nasce `a_revisar` até o professor confirmar", async () => {
    await montarEquipes([[ids.gabi, ids.bia, ids.caio, ids.duda, ids.enzo]], 1);
    ia.resposta = { razao: true, conteudo: true, semRelacao: false };
    await publicar(ids.gabi, MISTA, "Juntei as três fontes para mostrar o evento inteiro.");
    expect(await evidenciaDe(ids.caio)).toMatchObject([{ status: "atingiu", origem: "projecao", situacao: "a_revisar" }]);
  });
});
