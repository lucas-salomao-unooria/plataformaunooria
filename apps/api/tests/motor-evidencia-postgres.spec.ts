import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import type { AiJsonRequest, AiProvider, AiResult } from "../src/ai/provider";
import { QuotaService, perfilDaQuota } from "../src/ai/quota.service";
import { MockProvider } from "../src/ai/mock.provider";
import { limparDadosDosEstudantes } from "../src/atividades/manutencao";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { LeituraDaReflexaoService } from "../src/motor/canal-a/leitura-da-reflexao.service";
import { TarefasDoUnoovista } from "../src/motor/canal-a/tarefas.service";
import { TAREFAS } from "../src/motor/canal-a/vocabulario";
import { RODADA_DO_UNOOVISTA } from "../src/motor/contexto-da-evidencia";
import { RunsController } from "../src/motor/runs.controller";
import { PrismaService } from "../src/prisma/prisma.service";
import { comEscolaNoContexto } from "../src/tenancy/tenancy-context";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O CANAL A DO UNOOVISTA (exp08ef1b, ADR-167) no Postgres: a FICHA REAL do
 * registro, as tarefas 6a, 6b e 6c pelo serviço real, a leitura da reflexão
 * com uma IA falsa, e o ciclo de vida do reinício e do "Apagar as sessões".
 *
 * O que só o banco responde: as travas por fase e pelo fim da revelação, o
 * "vale o primeiro envio" mesmo depois do reinício (as marcas não saem), a
 * unicidade da leitura, a cascata, os CHECKs contra o vocabulário do código e
 * a RLS das duas tabelas novas.
 *
 * UMA ESCOLA POR SUÍTE: o Jest paraleliza, e limpeza compartilhada corromperia
 * a outra.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-motor-evidencia";
const UNOOVISTA = "exp08ef1b";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;

/** A IA da leitura, controlada pela suíte. Por padrão ela FALHA, como o mock. */
class IaControlada implements AiProvider {
  resposta: unknown = null;
  /** Uma resposta por chamada, na ordem; `null` = a chamada falha. Vazia, vale `resposta`. */
  fila: unknown[] = [];
  chamadas = 0;
  prompts: string[] = [];
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    this.chamadas += 1;
    this.prompts.push(req.prompt);
    req.aoUsarTokens?.(40);
    const resposta = this.fila.length > 0 ? this.fila.shift() : this.resposta;
    if (resposta === null) throw new Error("IA de teste desligada");
    return req.validar(resposta);
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
    throw new Error("não usado");
  }
  conversar(): Promise<AiResult> {
    throw new Error("não usado");
  }
}

class QuotaZeradaDoEstudante extends QuotaService {
  override async limite(perfil: string): Promise<number> {
    return perfilDaQuota(perfil) === "estudante" ? 0 : super.limite(perfil);
  }
}

const ia = new IaControlada();
const quota = new QuotaService(prisma);
const evidencias = new EvidenciasService(prisma, new EquipesService(prisma));
evidencias.onModuleInit();
const tarefas = new TarefasDoUnoovista(prisma, evidencias);
const leitura = new LeituraDaReflexaoService(prisma, ia, quota, evidencias, 300, 10);
const runsController = new RunsController(prisma, new MockProvider(), tarefas, leitura);

let turmaId = "";
let professorId = "";
let atividadeId = "";
let atividadeLimitadaId = "";
let atividadeSemTurmaId = "";
const estudantes: Record<string, string> = {};
const runs: Record<string, string> = {};
/** Os posts da atividade principal, por lado. */
const acervo: { A: string[]; B: string[]; neutro: string[]; fora: string[]; fofocaA: string; humorB: string } = {
  A: [],
  B: [],
  neutro: [],
  fora: [],
  fofocaA: "",
  humorB: "",
};

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.evidencia.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.liberacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.run.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.activity.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: ESCOLA } }).catch(() => undefined);
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

async function criarAtividade(turma: string | null) {
  const { id } = await prisma.activity.create({
    data: {
      escolaId: ESCOLA,
      professorId,
      turmaId: turma,
      status: "ativa",
      titulo: "T",
      disciplina: "D",
      temaGeral: "TG",
      recorte: "R",
      perguntaChave: "PC",
      estiloVisual: "EV",
      proporcoes: {},
      engineConfig: {},
      antagonismo: {
        ladoA: { label: "Lado A", tese: "a", tom_tipico: "a" },
        ladoB: { label: "Lado B", tese: "b", tom_tipico: "b" },
      },
    },
    select: { id: true },
  });
  return id;
}

let sequencia = 0;
async function criarPost(activityId: string, lado: string, tipoDoAutor: string, categoria = lado === "neutro" ? "tema" : "x") {
  sequencia += 1;
  const autor = await prisma.author.create({
    data: { escolaId: ESCOLA, activityId, handle: `@autor.${sequencia}`, displayName: `Autor ${sequencia}`, tipo: tipoDoAutor, lado, bio: `bio ${sequencia}` },
    select: { id: true },
  });
  const { id } = await prisma.post.create({
    data: {
      escolaId: ESCOLA,
      activityId,
      authorId: autor.id,
      lado,
      perfil: "abertura",
      intensidade: 1 + (sequencia % 3),
      categoria,
      caption: `post ${sequencia}`,
      imageBrief: "x",
      likesCount: 10,
      timestampLabel: "1h",
      imageStatus: "fallback",
    },
    select: { id: true },
  });
  return id;
}

/** Uma run que viu os posts dados, em `fase`. */
async function criarRun(nome: string, activityId: string, vistos: string[], fase: string) {
  const { id } = await prisma.run.create({
    data: {
      escolaId: ESCOLA,
      activityId,
      estudanteId: estudantes[nome]!,
      fase,
      ladoInicial: "A",
      engineState: {
        servedPostIds: vistos,
        vistosPorPost: Object.fromEntries(vistos.map((p) => [p, 1])),
        dwellPorPost: Object.fromEntries(vistos.map((p, i) => [p, 1000 + i])),
      },
    },
    select: { id: true },
  });
  return id;
}

async function recusa(promessa: Promise<unknown>) {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), corpo: e.getResponse() as Record<string, unknown> };
    throw e;
  }
  throw new Error("era para recusar");
}

const evidenciaDe = (estudanteId: string, habilidade: string, atividade = atividadeId) =>
  prisma.evidencia.findFirst({
    where: { escolaId: ESCOLA, expId: UNOOVISTA, estudanteId, habilidade, atividadeId: atividade },
    select: { status: true, origem: true, marcador: true, atividadeId: true, rodada: true },
  });

const fase = (runId: string, f: string) => prisma.run.update({ where: { id: runId }, data: { fase: f } });
const st = (nome: string) => tarefas.situacao(runs[nome]!, estudantes[nome]!, ESCOLA);

/** Responde o Raio-x inteiro certo, lendo o gabarito do banco. */
async function raioXCerto(nome: string) {
  const { posts } = await tarefas.lerRaioX(runs[nome]!, estudantes[nome]!, ESCOLA);
  const lados = await prisma.post.findMany({ where: { id: { in: posts.map((p) => p.id) } }, select: { id: true, lado: true } });
  return Object.fromEntries(lados.map((p) => [p.id, (p.lado === "neutro" ? "neutro" : p.lado) as "A" | "B" | "neutro"]));
}

const req = (nome: string) => ({ auth: { usuarioId: estudantes[nome]!, escolaId: ESCOLA, perfil: "estudante" as const } }) as never;
const noContexto = <T>(fn: () => Promise<T>) => comEscolaNoContexto(ESCOLA, fn);

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola da evidência do Unoovista (teste)" } });
  turmaId = (await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF")).id;
  professorId = (
    await prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA, username: "mev.prof", displayName: "Prof", passwordHash: "x" },
      select: { id: true },
    })
  ).id;
  for (const nome of ["ana", "bia", "caio", "dani", "eli", "fabi", "gil"]) {
    estudantes[nome] = (
      await prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA, turmaId, username: `mev.${nome}`, displayName: nome, passwordHash: "x" },
        select: { id: true },
      })
    ).id;
  }
  await liberarParaTeste(prisma, ESCOLA, turmaId, UNOOVISTA, professorId);

  atividadeId = await criarAtividade(turmaId);
  for (let i = 0; i < 5; i++) acervo.A.push(await criarPost(atividadeId, "A", "pagina_tema"));
  acervo.fofocaA = await criarPost(atividadeId, "A", "fofoca_tema");
  for (let i = 0; i < 5; i++) acervo.B.push(await criarPost(atividadeId, "B", "pagina_tema"));
  acervo.humorB = await criarPost(atividadeId, "B", "humor");
  for (let i = 0; i < 4; i++) acervo.neutro.push(await criarPost(atividadeId, "neutro", "checagem"));
  for (let i = 0; i < 2; i++) acervo.fora.push(await criarPost(atividadeId, "neutro", "vida_escolar", "lanche"));

  /* A atividade SEM fofoca nem humor no lado B: o envio não mede a confiabilidade. */
  atividadeLimitadaId = await criarAtividade(turmaId);
  const limitada = { A: [] as string[], B: [] as string[], neutro: [] as string[] };
  for (let i = 0; i < 4; i++) limitada.A.push(await criarPost(atividadeLimitadaId, "A", "pagina_tema"));
  limitada.A.push(await criarPost(atividadeLimitadaId, "A", "fofoca_tema"));
  for (let i = 0; i < 4; i++) limitada.B.push(await criarPost(atividadeLimitadaId, "B", "pagina_tema"));
  for (let i = 0; i < 3; i++) limitada.neutro.push(await criarPost(atividadeLimitadaId, "neutro", "checagem"));

  atividadeSemTurmaId = await criarAtividade(null);

  /* Viu 4 do A, 2 do B e 3 neutros: feed com lado A, e o Raio-x fecha 2/2/2. */
  const vistos = [...acervo.A.slice(0, 4), ...acervo.B.slice(0, 2), ...acervo.neutro.slice(0, 3), ...acervo.fora];
  for (const nome of ["ana", "bia", "caio"]) runs[nome] = await criarRun(nome, atividadeId, vistos, "feed");
  /* O Eli quase não rolou: um post só — sem Raio-x. */
  runs.eli = await criarRun("eli", atividadeId, [acervo.A[0]!], "conclusao");
  /* A Dani está na atividade limitada. */
  runs.dani = await criarRun("dani", atividadeLimitadaId, [...limitada.A, ...limitada.B.slice(0, 2), ...limitada.neutro], "perdidos");
  /* A Fabi, numa atividade sem turma (a legada). */
  runs.fabi = await criarRun("fabi", atividadeSemTurmaId, [], "perdidos");
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

describe("o banco", () => {
  test("o CHECK da tarefa é o MESMO vocabulário do código", async () => {
    const [linha] = await prisma.$queryRawUnsafe<{ def: string }[]>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'exp08ef1b_tarefas_tarefa_check'`,
    );
    const valores = [...(linha?.def ?? "").matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
    expect(valores).toEqual([...TAREFAS].sort());
  });

  test("as duas tabelas novas têm RLS habilitada E forçada", async () => {
    const linhas = await prisma.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname IN ('exp08ef1b_tarefas', 'exp08ef1b_leituras_da_reflexao')`,
    );
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.relrowsecurity && l.relforcerowsecurity)).toBe(true);
  });

  test("a coerência da leitura e da tarefa é cobrada pelo banco", async () => {
    const base = { escolaId: ESCOLA, activityId: atividadeSemTurmaId, estudanteId: estudantes.fabi!, runId: runs.fabi! };
    await expect(prisma.leituraDaReflexao.create({ data: { ...base, resultado: "nivel" } })).rejects.toThrow();
    await expect(prisma.leituraDaReflexao.create({ data: { ...base, resultado: "sem_marca", nivel: "atingiu", lidaEm: new Date() } })).rejects.toThrow();
    await expect(
      prisma.tarefaDaSessao.create({ data: { escolaId: ESCOLA, runId: runs.fabi!, tarefa: "termos", composicao: {}, frase: "oi" } }),
    ).rejects.toThrow();
    await expect(
      prisma.tarefaDaSessao.create({ data: { escolaId: ESCOLA, runId: runs.fabi!, tarefa: "outra", composicao: {} } }),
    ).rejects.toThrow();
  });
});

describe("o 6a Raio-x", () => {
  test("no feed, ainda não abriu", async () => {
    expect((await st("ana")).raioX).toBe("aguardando");
  });

  test("depois da resposta, abre: os 6 posts que ele viu, sem lado nenhum na resposta", async () => {
    await fase(runs.ana!, "conclusao");
    expect((await st("ana")).raioX).toBe("pendente");
    const r = await tarefas.lerRaioX(runs.ana!, estudantes.ana!, ESCOLA);
    expect(r.posts).toHaveLength(6);
    expect(r.rotulos).toEqual({ A: "Lado A", B: "Lado B" });
    const texto = JSON.stringify(r.posts);
    expect(texto).not.toMatch(/"lado"|"intensidade"|"categoria"/);
    /* Só post visto, e nunca o neutro fora do tema. */
    expect(r.posts.every((p) => !acervo.fora.includes(p.id))).toBe(true);
    /* A composição fica: ler de novo devolve os mesmos, na mesma ordem. */
    expect((await tarefas.lerRaioX(runs.ana!, estudantes.ana!, ESCOLA)).posts.map((p) => p.id)).toEqual(r.posts.map((p) => p.id));
  });

  test("enquanto pendente, o relatório do estudante esconde o lado; depois do envio, não", async () => {
    expect(await tarefas.raioXPendente(runs.ana!, ESCOLA)).toBe(true);
  });

  test("o envio é corrigido no servidor e marca a EF08CO11; enviar de novo é 409", async () => {
    const respostas = await raioXCerto("ana");
    expect(await tarefas.enviarRaioX(runs.ana!, estudantes.ana!, ESCOLA, respostas)).toEqual({ enviada: true });
    expect(await evidenciaDe(estudantes.ana!, "EF08CO11")).toEqual({
      status: "atingiu",
      origem: "propria",
      marcador: "raio-x",
      atividadeId,
      rodada: RODADA_DO_UNOOVISTA,
    });
    expect((await st("ana")).raioX).toBe("enviada");
    expect(await tarefas.raioXPendente(runs.ana!, ESCOLA)).toBe(false);
    expect(await recusa(tarefas.enviarRaioX(runs.ana!, estudantes.ana!, ESCOLA, respostas))).toMatchObject({
      status: 409,
      corpo: { codigo: "tarefa-ja-enviada" },
    });
  });

  test("resposta que não cobre os 6 posts é 400", async () => {
    await fase(runs.bia!, "conclusao");
    const respostas = await raioXCerto("bia");
    const [primeiro] = Object.keys(respostas);
    delete respostas[primeiro!];
    expect(await recusa(tarefas.enviarRaioX(runs.bia!, estudantes.bia!, ESCOLA, respostas))).toMatchObject({ status: 400 });
  });

  test("quem quase não rolou o feed não tem Raio-x", async () => {
    expect((await st("eli")).raioX).toBe("indisponivel");
    expect(await recusa(tarefas.enviarRaioX(runs.eli!, estudantes.eli!, ESCOLA, {}))).toMatchObject({ status: 409 });
  });

  test("a devolutiva só sai da explicabilidade em diante, e só para quem enviou", async () => {
    expect(await recusa(tarefas.devolutivaDoRaioX(runs.ana!, estudantes.ana!, ESCOLA))).toMatchObject({ status: 404 });
    await fase(runs.ana!, "explicabilidade");
    const { posts } = await tarefas.devolutivaDoRaioX(runs.ana!, estudantes.ana!, ESCOLA);
    expect(posts).toHaveLength(6);
    expect(posts.every((p) => ["A", "B", "neutro"].includes(p.origem))).toBe(true);
    await fase(runs.bia!, "explicabilidade");
    expect((await tarefas.devolutivaDoRaioX(runs.bia!, estudantes.bia!, ESCOLA)).posts).toEqual([]);
  });

  test("o fim da revelação fecha o Raio-x de quem não enviou", async () => {
    await tarefas.concluirRevelacao(runs.bia!, estudantes.bia!, ESCOLA);
    expect((await st("bia")).raioX).toBe("encerrada");
    expect(await recusa(tarefas.enviarRaioX(runs.bia!, estudantes.bia!, ESCOLA, await raioXCerto("bia")))).toMatchObject({
      status: 409,
    });
    expect(await evidenciaDe(estudantes.bia!, "EF08CO11")).toBeNull();
  });
});

describe("a revelação e as tarefas 6b e 6c", () => {
  test("antes do fim da revelação, o 6b e o 6c esperam; a revelação só conclui da explicabilidade em diante", async () => {
    await fase(runs.caio!, "conclusao");
    expect(await recusa(tarefas.concluirRevelacao(runs.caio!, estudantes.caio!, ESCOLA))).toMatchObject({ status: 409 });
    await fase(runs.caio!, "perdidos");
    expect(await st("caio")).toMatchObject({ revelacaoConcluida: false, termos: "aguardando", envio: "aguardando" });
    expect(await recusa(tarefas.enviarTermos(runs.caio!, estudantes.caio!, ESCOLA, { marcadas: [], efeitos: {}, mudanca: "forma" }))).toMatchObject({
      status: 409,
    });
  });

  test("terminada a revelação e no cinza, as duas abrem — e a revelação é idempotente", async () => {
    await tarefas.concluirRevelacao(runs.caio!, estudantes.caio!, ESCOLA);
    const primeira = (await prisma.run.findUniqueOrThrow({ where: { id: runs.caio! } })).revelacaoConcluidaEm;
    await tarefas.concluirRevelacao(runs.caio!, estudantes.caio!, ESCOLA);
    expect((await prisma.run.findUniqueOrThrow({ where: { id: runs.caio! } })).revelacaoConcluidaEm).toEqual(primeira);
    expect(await st("caio")).toMatchObject({ revelacaoConcluida: true, termos: "pendente", envio: "pendente" });
  });

  test("o 6b: as cláusulas sem gabarito; o envio marca a EF08CO09", async () => {
    const t = await tarefas.lerTermos(runs.caio!, estudantes.caio!, ESCOLA);
    expect(t.clausulas.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    expect(JSON.stringify(t)).not.toMatch(/explica|"efeito"|controle"?:/);
    await tarefas.enviarTermos(runs.caio!, estudantes.caio!, ESCOLA, {
      marcadas: ["c1", "c3", "c5"],
      efeitos: { c1: "e1", c3: "e2", c5: "e3" },
      mudanca: "controle",
    });
    expect(await evidenciaDe(estudantes.caio!, "EF08CO09")).toMatchObject({ status: "atingiu", marcador: "termos" });
  });

  test("o 6b recusa efeito de cláusula não marcada", async () => {
    await fase(runs.bia!, "perdidos");
    expect(
      await recusa(tarefas.enviarTermos(runs.bia!, estudantes.bia!, ESCOLA, { marcadas: [], efeitos: { c1: "e1" }, mudanca: "controle" })),
    ).toMatchObject({ status: 400 });
  });

  test("o 6c: 9 posts sem lado, com a descrição do perfil; os dois lados sem fofoca e o aviso: atingiu", async () => {
    const e = await tarefas.lerEnvio(runs.caio!, estudantes.caio!, ESCOLA);
    expect(e.posts).toHaveLength(9);
    expect(e.posts.every((p) => typeof p.bio === "string")).toBe(true);
    expect(JSON.stringify(e)).not.toMatch(/"lado"|"tipo"|aviso|ridiculariza/);
    await tarefas.enviarEnvio(runs.caio!, estudantes.caio!, ESCOLA, {
      posts: pegarDoisLados(e.posts.map((p) => p.id)),
      mensagem: "m1",
      frase: "  eu acho que vale olhar os dois  ",
    });
    expect(await evidenciaDe(estudantes.caio!, "EF08CO07")).toMatchObject({ status: "atingiu", marcador: "envio" });
    const linha = await prisma.tarefaDaSessao.findUniqueOrThrow({ where: { runId_tarefa: { runId: runs.caio!, tarefa: "envio" } } });
    expect(linha.frase).toBe("eu acho que vale olhar os dois");
  });

  test("post fora dos 9 é 400", async () => {
    await tarefas.concluirRevelacao(runs.ana!, estudantes.ana!, ESCOLA);
    await fase(runs.ana!, "perdidos");
    await tarefas.lerEnvio(runs.ana!, estudantes.ana!, ESCOLA);
    expect(
      await recusa(tarefas.enviarEnvio(runs.ana!, estudantes.ana!, ESCOLA, { posts: [acervo.fora[0]!], mensagem: "m1" })),
    ).toMatchObject({ status: 400, corpo: { codigo: "post-fora-do-envio" } });
  });

  test("atividade sem fofoca ou humor nos dois lados: a casa do aviso grava o marcador LIMITADO, em processo", async () => {
    await tarefas.concluirRevelacao(runs.dani!, estudantes.dani!, ESCOLA);
    const e = await tarefas.lerEnvio(runs.dani!, estudantes.dani!, ESCOLA);
    const ids = e.posts.map((p) => p.id);
    const lados = await prisma.post.findMany({
      where: { id: { in: ids } },
      select: { id: true, lado: true, author: { select: { tipo: true } } },
    });
    const a = lados.find((p) => p.lado === "A" && p.author.tipo === "pagina_tema")!;
    const b = lados.find((p) => p.lado === "B")!;
    await tarefas.enviarEnvio(runs.dani!, estudantes.dani!, ESCOLA, { posts: [a.id, b.id], mensagem: "m1" });
    expect(await evidenciaDe(estudantes.dani!, "EF08CO07", atividadeLimitadaId)).toMatchObject({
      status: "em_processo",
      marcador: "envio-sem-confiabilidade",
    });
  });

  test("atividade sem turma: a tarefa é aceita, mas não há evidência", async () => {
    await fase(runs.fabi!, "explicabilidade");
    await tarefas.concluirRevelacao(runs.fabi!, estudantes.fabi!, ESCOLA);
    expect((await st("fabi")).termos).toBe("indisponivel");
  });
});

/** Um post de cada lado, nenhum de fofoca ou humor (os de `acervo.A`/`acervo.B` são páginas de tema). */
function pegarDoisLados(ids: string[]): string[] {
  const a = ids.find((id) => acervo.A.includes(id));
  const b = ids.find((id) => acervo.B.includes(id));
  return [a!, b!];
}

describe("a reflexão lida pela IA", () => {
  const salvar = (nome: string, texto: string) =>
    noContexto(() => runsController.salvarReflexao(runs[nome]!, { texto }, req(nome)));
  const leituraDe = (nome: string, atividade = atividadeId) =>
    prisma.leituraDaReflexao.findUnique({
      where: { activityId_estudanteId: { activityId: atividade, estudanteId: estudantes[nome]! } },
    });
  const esperarLeitura = async (nome: string) => {
    for (let i = 0; i < 60; i++) {
      const l = await leituraDe(nome);
      if (l?.lidaEm) return l;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("a leitura não terminou");
  };

  test("o primeiro salvamento guarda o primeiro texto e cria a leitura; a IA marca a EF08CO11 como sugestão", async () => {
    ia.resposta = { resultado: "em_processo", motivo: "mecanismo-sem-gesto-proprio" };
    await fase(runs.caio!, "reflexao");
    const primeiro = "O feed escolhia os posts pelo que eu curtia e salvava, e foi mostrando mais do mesmo.";
    await salvar("caio", primeiro);
    const lida = await esperarLeitura("caio");
    expect(lida).toMatchObject({ resultado: "nivel", nivel: "em_processo", motivo: "mecanismo-sem-gesto-proprio" });
    expect(JSON.stringify(lida)).not.toContain("curtia");
    expect(await evidenciaDe(estudantes.caio!, "EF08CO11")).toMatchObject({ status: "em_processo", marcador: "reflexao" });
    expect((await prisma.reflexao.findUniqueOrThrow({ where: { runId: runs.caio! } })).primeiroTexto).toBe(primeiro);
  });

  test("o segundo salvamento troca o texto, mas não o primeiro, e a IA não lê de novo", async () => {
    const chamadas = ia.chamadas;
    await salvar("caio", "Agora escrevo outra coisa bem diferente, e bem mais longa do que antes, com outro assunto.");
    await new Promise((r) => setTimeout(r, 150));
    expect(ia.chamadas).toBe(chamadas);
    const reflexao = await prisma.reflexao.findUniqueOrThrow({ where: { runId: runs.caio! } });
    expect(reflexao.texto).toMatch(/^Agora/);
    expect(reflexao.primeiroTexto).toMatch(/^O feed/);
  });

  test("falha da IA também encerra a leitura (depois das 3 tentativas): sem marca, e nada é lido de novo", async () => {
    ia.resposta = null;
    await fase(runs.bia!, "reflexao");
    await salvar("bia", "Eu achei muito legal a aula de hoje e gostei bastante de usar o aplicativo do feed.");
    expect(await esperarLeitura("bia")).toMatchObject({ resultado: "falha", nivel: null, tentativas: 3 });
    expect(await evidenciaDe(estudantes.bia!, "EF08CO11")).toBeNull();
  });

  /** Uma leitura agendada à mão, como o primeiro salvamento a criaria. */
  async function agendar(nome: string, runId: string, activityId: string, turma: string | null, texto: string) {
    await prisma.reflexao.create({ data: { runId, escolaId: ESCOLA, texto: `${texto} (editado depois)`, primeiroTexto: texto } });
    const l = await prisma.leituraDaReflexao.create({
      data: { escolaId: ESCOLA, activityId, estudanteId: estudantes[nome]!, runId },
      select: { id: true },
    });
    return { leituraId: l.id, escolaId: ESCOLA, estudanteId: estudantes[nome]!, activityId, turmaId: turma };
  }

  test("falha técnica 2 vezes e acerta na 3ª: a marca é gravada, e as 3 leram o MESMO primeiro texto", async () => {
    ia.fila = [null, { resultado: "nivel_invalido", motivo: "x" }, { resultado: "em_processo", motivo: "mecanismo-sem-gesto-proprio" }];
    const antes = ia.prompts.length;
    await leitura.ler(await agendar("dani", runs.dani!, atividadeLimitadaId, turmaId, "O feed escolhia pelo que eu curtia."));
    const lida = await prisma.leituraDaReflexao.findUniqueOrThrow({
      where: { activityId_estudanteId: { activityId: atividadeLimitadaId, estudanteId: estudantes.dani! } },
    });
    expect(lida).toMatchObject({ resultado: "nivel", nivel: "em_processo", tentativas: 3 });
    const lidos = ia.prompts.slice(antes);
    expect(lidos).toHaveLength(3);
    expect(lidos.every((p) => p.includes("O feed escolhia pelo que eu curtia.") && !p.includes("editado depois"))).toBe(true);
    expect(await evidenciaDe(estudantes.dani!, "EF08CO11", atividadeLimitadaId)).toMatchObject({ status: "em_processo", marcador: "reflexao" });
  });

  test("falha técnica 3 vezes: a leitura fica \"falha\" e encerra", async () => {
    ia.fila = [null, null, null];
    const antes = ia.chamadas;
    const gil = await criarRun("gil", atividadeSemTurmaId, [], "reflexao");
    await leitura.ler(await agendar("gil", gil, atividadeSemTurmaId, null, "Um texto qualquer sobre o feed."));
    expect(ia.chamadas - antes).toBe(3);
    expect(
      await prisma.leituraDaReflexao.findUniqueOrThrow({
        where: { activityId_estudanteId: { activityId: atividadeSemTurmaId, estudanteId: estudantes.gil! } },
      }),
    ).toMatchObject({ resultado: "falha", tentativas: 3, nivel: null });
  });

  test("\"sem marca\" de primeira encerra na hora, sem nova tentativa", async () => {
    ia.fila = [{ resultado: "sem_marca", motivo: "outro-texto" }];
    const antes = ia.chamadas;
    await leitura.ler(await agendar("fabi", runs.fabi!, atividadeSemTurmaId, null, "Gostei da aula."));
    expect(ia.chamadas - antes).toBe(1);
    expect(
      await prisma.leituraDaReflexao.findUniqueOrThrow({
        where: { activityId_estudanteId: { activityId: atividadeSemTurmaId, estudanteId: estudantes.fabi! } },
      }),
    ).toMatchObject({ resultado: "sem_marca", tentativas: 1 });
  });

  test("sem saldo não é falha técnica: encerra sem tentar de novo", async () => {
    const semSaldo = new LeituraDaReflexaoService(prisma, ia, new QuotaZeradaDoEstudante(prisma), evidencias, 300, 10);
    const antes = ia.chamadas;
    const ana2 = await criarRun("ana", atividadeSemTurmaId, [], "reflexao");
    await semSaldo.ler(await agendar("ana", ana2, atividadeSemTurmaId, null, "Texto."));
    expect(ia.chamadas).toBe(antes);
    expect(
      await prisma.leituraDaReflexao.findUniqueOrThrow({
        where: { activityId_estudanteId: { activityId: atividadeSemTurmaId, estudanteId: estudantes.ana! } },
      }),
    ).toMatchObject({ resultado: "falha", motivo: "sem-saldo", tentativas: 1 });
  });

  test("sem saldo: a IA nem é chamada, e a leitura encerra como falha", async () => {
    const semSaldo = new LeituraDaReflexaoService(prisma, ia, new QuotaZeradaDoEstudante(prisma), evidencias, 300);
    ia.resposta = { resultado: "atingiu", motivo: "mecanismo-e-gesto-proprio" };
    const antes = ia.chamadas;
    expect(await semSaldo.classificar(ESCOLA, estudantes.ana!, "texto")).toEqual({ ok: false, codigo: "sem-saldo" });
    expect(ia.chamadas).toBe(antes);
  });

  test("motivo incoerente com o resultado: saída inválida", async () => {
    ia.resposta = { resultado: "atingiu", motivo: "outro-texto" };
    expect(await leitura.classificar(ESCOLA, estudantes.eli!, "texto")).toEqual({ ok: false, codigo: "saida-invalida" });
  });

  test("quem não terminou a revelação não tem a reflexão lida", async () => {
    await fase(runs.eli!, "reflexao");
    await salvar("eli", "Escrevi a minha reflexão sobre o feed, que mostrava posts de um lado só para mim.");
    expect(await leituraDe("eli")).toBeNull();
  });
});

describe("o reinício e o \"Apagar as sessões\"", () => {
  test("o reinício apaga as tarefas, o fim da revelação e a reflexão — e a leitura e a marca ficam", async () => {
    const prof = { auth: { usuarioId: professorId, escolaId: ESCOLA, perfil: "professor" as const } } as never;
    await noContexto(() => runsController.reset(runs.caio!, prof));
    const run = await prisma.run.findUniqueOrThrow({ where: { id: runs.caio! } });
    expect(run.revelacaoConcluidaEm).toBeNull();
    expect(await prisma.tarefaDaSessao.count({ where: { runId: runs.caio! } })).toBe(0);
    expect(await prisma.reflexao.findUnique({ where: { runId: runs.caio! } })).toBeNull();
    expect(await leituraDe2("caio")).not.toBeNull();
    expect(await evidenciaDe(estudantes.caio!, "EF08CO09")).toMatchObject({ status: "atingiu" });
  });

  test("refazer depois do reinício: vale o PRIMEIRO envio, e a tarefa fica como refeita", async () => {
    /* O reinício resorteou a largada e zerou o motor: o feed é refeito como na aula. */
    const vistos = [...acervo.A.slice(0, 4), ...acervo.B.slice(0, 2), ...acervo.neutro.slice(0, 3)];
    await prisma.run.update({
      where: { id: runs.caio! },
      data: {
        fase: "explicabilidade",
        engineState: { servedPostIds: vistos, vistosPorPost: Object.fromEntries(vistos.map((p) => [p, 1])), dwellPorPost: {} },
      },
    });
    await tarefas.concluirRevelacao(runs.caio!, estudantes.caio!, ESCOLA);
    await fase(runs.caio!, "perdidos");
    await tarefas.lerTermos(runs.caio!, estudantes.caio!, ESCOLA);
    await tarefas.enviarTermos(runs.caio!, estudantes.caio!, ESCOLA, { marcadas: [], efeitos: {}, mudanca: "aceitacao" });
    expect(await evidenciaDe(estudantes.caio!, "EF08CO09")).toMatchObject({ status: "atingiu" });
    const linha = await prisma.tarefaDaSessao.findUniqueOrThrow({ where: { runId_tarefa: { runId: runs.caio!, tarefa: "termos" } } });
    expect(linha.refeita).toBe(true);
  });

  test("a leitura é única por atividade e estudante: depois do reinício, a reflexão nova não é lida", async () => {
    const chamadas = ia.chamadas;
    await fase(runs.caio!, "reflexao");
    await noContexto(() =>
      runsController.salvarReflexao(runs.caio!, { texto: "Um texto novo depois do reinício, falando do feed e do que ficou de fora." }, req("caio")),
    );
    await new Promise((r) => setTimeout(r, 150));
    expect(ia.chamadas).toBe(chamadas);
  });

  test("\"Apagar as sessões\" leva a leitura e as tarefas em cascata, e a marca junto (ADR-155)", async () => {
    const atividade = await prisma.activity.findUniqueOrThrow({ where: { id: atividadeId } });
    await prisma.comTenancy((tx) => limparDadosDosEstudantes(tx, atividade), ESCOLA);
    expect(await prisma.leituraDaReflexao.count({ where: { activityId: atividadeId } })).toBe(0);
    expect(await prisma.tarefaDaSessao.count({ where: { escolaId: ESCOLA, run: { activityId: atividadeId } } })).toBe(0);
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, atividadeId } })).toBe(0);
  });
});

const leituraDe2 = (nome: string) =>
  prisma.leituraDaReflexao.findUnique({
    where: { activityId_estudanteId: { activityId: atividadeId, estudanteId: estudantes[nome]! } },
  });
