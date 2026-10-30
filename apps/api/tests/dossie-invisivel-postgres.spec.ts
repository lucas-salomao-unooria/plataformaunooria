import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import { EXP_ID, conteudoDoPadrao, type BlocoId } from "../src/dossie-invisivel/conteudo";
import { RespostaGerarConteudoSchema, RespostaMaterialProfessorSchema, RespostaPainelSchema, SessaoSchema } from "../src/dossie-invisivel/contrato-de-rotas";
import { DossieInvisivelService } from "../src/dossie-invisivel/dossie-invisivel.service";
import { IaDaAulaDaExp09ef1bService, PreparoDaExp09ef1bService } from "../src/dossie-invisivel/ia.service";
import { SCHEMA_DO_CLASSIFICADOR, SCHEMA_DO_PREPARO } from "../src/dossie-invisivel/prompts";
import { GABARITO_DO_PROTOCOLO } from "../src/dossie-invisivel/regras/evidencia";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O Dossiê Invisível (exp09ef1b, ADR-202) no Postgres: a porta da sala, a
 * missão que nasce vazia, o preparo com a quota, os três caminhos (A1, A2, B)
 * com a IA que classifica e a árvore de reserva, os dois latches, as três
 * travas, as marcas NA MESMA transação, o gabarito ausente, o painel sem o
 * texto do menor, a RLS com a role sem `BYPASSRLS` e o zerar.
 *
 * Os testes dependem da ORDEM: é a aula, na sequência em que ela acontece.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-dossie";
const OUTRA_ESCOLA = "teste-dossie-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/** A IA de mentira: o preparo devolve o banco padrão; o classificador lê o que o teste mandar (ou falha). */
let classificacao: { intencao: string; confianca: number } | "falha" = "falha";
const ia = {
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    req.aoUsarTokens?.(100);
    if (req.responseSchema === SCHEMA_DO_PREPARO) return req.validar(conteudoDoPadrao());
    if (req.responseSchema === SCHEMA_DO_CLASSIFICADOR) {
      if (classificacao === "falha") throw new Error("vendor fora do ar");
      return req.validar(classificacao);
    }
    throw new Error("pedido inesperado");
  },
} as unknown as AiProvider;

const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
const quota = new QuotaService(prisma);
const service = new DossieInvisivelService(prisma, evidencias, new PreparoDaExp09ef1bService(ia, quota), new IaDaAulaDaExp09ef1bService(ia, quota, 2_000));
evidencias.onModuleInit();

const ids = { turmaA: "", turmaC: "", turmaVizinha: "", prof: "", ana: "", bia: "", caio: "", fabi: "", vizinho: "", pacote: "" };

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp09ef1bGateHistorico.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp09ef1bSessao.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp09ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp09ef1bGateTurma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.matricula.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.escola.deleteMany({ where: { id: { in: ESCOLAS } } });
}

async function recusa(promessa: Promise<unknown> | (() => unknown)): Promise<{ status: number; corpo: Record<string, unknown> }> {
  try {
    await (typeof promessa === "function" ? promessa() : promessa);
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), corpo: e.getResponse() as Record<string, unknown> };
    throw e;
  }
  throw new Error("era para recusar, e passou");
}
const codigo = async (p: Promise<unknown> | (() => unknown)) => (await recusa(p)).corpo.codigo;

async function nivel(estudanteId: string, marcador: string) {
  const m = await prisma.evidenciaMarca.findFirst({ where: { escolaId: ESCOLA, expId: EXP_ID, estudanteId, marcador } });
  return m?.status ?? null;
}

const RANKING_R = ["regularidade", "capacidade", "urgencia"] as const;
const RANKING_U = ["urgencia", "regularidade", "capacidade"] as const;
const [A, B, C] = GABARITO_DO_PROTOCOLO as [BlocoId, BlocoId, BlocoId];

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Dossiê (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  ids.turmaA = (await criarTurmaDeTeste(prisma, ESCOLA, "9A", "9EF")).id;
  ids.turmaC = (await criarTurmaDeTeste(prisma, ESCOLA, "9C", "9EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "9 vizinha", "9EF")).id;
  const pessoa = (escolaId: string, turmaId: string | null, username: string, nome: string, role = "estudante") =>
    prisma.user.create({ data: { role, escolaId, turmaId, username, displayName: nome, passwordHash: "x" }, select: { id: true } }).then((u) => u.id);
  ids.ana = await pessoa(ESCOLA, ids.turmaA, "di.ana", "Ana Teste");
  ids.bia = await pessoa(ESCOLA, ids.turmaA, "di.bia", "Bia Teste");
  ids.caio = await pessoa(ESCOLA, ids.turmaA, "di.caio", "Caio Teste");
  ids.fabi = await pessoa(ESCOLA, ids.turmaC, "di.fabi", "Fabi Teste");
  ids.vizinho = await pessoa(OUTRA_ESCOLA, ids.turmaVizinha, "di.vizinho", "Vizinho Teste");
  ids.prof = await pessoa(ESCOLA, null, "di.marta", "Marta Teste", "professor");
  await prisma.matricula.create({ data: { escolaId: ESCOLA, turmaId: ids.turmaA, usuarioId: ids.prof, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) } });
  /* A PORTA DA SALA: a 9C fica SEM liberação, de propósito. */
  await liberarParaTeste(prisma, ESCOLA, ids.turmaA, EXP_ID, ids.prof);
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("a porta da sala (ADR-69)", () => {
  test("TODA rota de estudante recusa quem está numa turma sem a missão liberada", async () => {
    for (const chamada of [
      () => service.sessao(ESCOLA, ids.fabi),
      () => service.entrar(ESCOLA, ids.fabi),
      () => service.mensagem(ESCOLA, ids.fabi, "oi"),
      () => service.verProjetos(ESCOLA, ids.fabi),
      () => service.digitalizar(ESCOLA, ids.fabi),
      () => service.decidir(ESCOLA, ids.fabi, "nuvem", [...RANKING_R]),
      () => service.pilula(ESCOLA, ids.fabi, "custo"),
      () => service.revotar(ESCOLA, ids.fabi, "papel", [...RANKING_U]),
      () => service.marcarAncoras(ESCOLA, ids.fabi, []),
      () => service.enviarProtocolo(ESCOLA, ids.fabi, { slots: [A, null, null], descarte: [] }),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 403, corpo: { codigo: "missao-nao-liberada" } });
    }
  });
  test("estudante de OUTRA escola: 404", async () => {
    expect(await recusa(service.sessao(ESCOLA, ids.vizinho))).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
  });
});

describe("o preparo do professor", () => {
  test("sem pacote no ar: espera, e o gate do professor também", async () => {
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana))).toMatchObject({ preparada: false, passo: "abertura", conteudo: null });
    expect(await codigo(service.entrar(ESCOLA, ids.ana))).toBe("atividade-nao-preparada");
    expect(await codigo(service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "revelacao"))).toBe("pacote-nao-aprovado");
  });
  test("gerar com IA grava o rascunho e debita a quota do professor; aprovar e liberar põe no ar", async () => {
    const r = RespostaGerarConteudoSchema.parse(await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "geografia", tema: "Orçamento do bairro", assuntos: ["Verba", "Vagas", "Registros"] }));
    expect(r).toMatchObject({ usouIa: true, pacote: { origem: "ia", aprovadoEm: null } });
    expect(await prisma.iaUsoDiario.count({ where: { escolaId: ESCOLA, usuarioId: ids.prof } })).toBeGreaterThan(0);
    await service.homologar(ESCOLA, ids.turmaA, ids.prof, r.pacote.id);
    const noAr = await service.colocarEmAndamento(ESCOLA, ids.turmaA, ids.prof, r.pacote.id);
    expect(noAr).toMatchObject({ etapa: "exploracao", mudou: true, atividade: { rodada: 1 } });
    ids.pacote = r.pacote.id;
  });
  test("a aprovação recusa o pacote que desmonta a virada", async () => {
    const outro = await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "geografia", tema: "Outro tema", assuntos: ["a1", "b2", "c3"] });
    const c = conteudoDoPadrao();
    const quebrado = { ...c, projetos: { ...c.projetos, parcial: { ...c.projetos.parcial, vagas: 50 }, nuvem: { ...c.projetos.nuvem, vagas: 10 } } };
    expect(await recusa(service.homologar(ESCOLA, ids.turmaA, ids.prof, outro.pacote.id, quebrado))).toMatchObject({ status: 400, corpo: { codigo: "pacote-invalido" } });
  });
});

describe("a aula: os três caminhos", () => {
  test("E1 → E2: entrar abre a conversa; a escolha só depois de 3 consultas ou do Ver Projetos", async () => {
    for (const e of [ids.ana, ids.bia, ids.caio]) await service.entrar(ESCOLA, e);
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s).toMatchObject({ passo: "conversa", chat: { podeEscolher: false, sugestoesVisiveis: true, cadernosOferecidos: false } });
    expect(s.conteudo?.cadernos).toBeNull();
    expect(await codigo(service.decidir(ESCOLA, ids.ana, "nuvem", [...RANKING_R]))).toBe("escolha-nao-liberada");
  });

  test("Ana (A1): a IA lê a pergunta vaga como lacuna, a oferta vem, ela digitaliza ANTES da escolha", async () => {
    classificacao = { intencao: "investigar_lacuna_cadernos", confianca: 0.9 };
    let s = SessaoSchema.parse(await service.mensagem(ESCOLA, ids.ana, "e a comida, onde fica anotada?"));
    expect(s.chat).toMatchObject({ cadernosOferecidos: true, sugestoesVisiveis: false });
    const sessao = await prisma.exp09ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect((sessao.conversa as Array<{ classificador?: string }>)[1]?.classificador).toBe("ia");
    s = SessaoSchema.parse(await service.digitalizar(ESCOLA, ids.ana));
    expect(s.chat.cadernosDigitalizados).toBe(true);
    expect(s.conteudo?.cadernos?.amostras).toHaveLength(3);
    expect(s.chat.mensagens.some((m) => m.ancora === "inversao")).toBe(true);
    await service.verProjetos(ESCOLA, ids.ana);
    s = SessaoSchema.parse(await service.decidir(ESCOLA, ids.ana, "papel", [...RANKING_U]));
    expect(s).toMatchObject({ passo: "espera1", caminho: "A1", decisao: { projeto: "papel" } });
    expect(await nivel(ids.ana, "investigacao_e_revisao")).toBe("atingiu");
  });

  test("Bia (A2): sem IA, a árvore lê a lacuna; ela recusa a oferta pelo Ver Projetos", async () => {
    classificacao = "falha";
    const s = SessaoSchema.parse(await service.mensagem(ESCOLA, ids.bia, "Por que o Mesa Aberta não tem relatórios?"));
    expect(s.chat.cadernosOferecidos).toBe(true);
    await service.verProjetos(ESCOLA, ids.bia);
    expect(SessaoSchema.parse(await service.decidir(ESCOLA, ids.bia, "nuvem", [...RANKING_R])).caminho).toBe("A2");
    expect(await nivel(ids.bia, "investigacao_e_revisao")).toBe("atingiu");
  });

  test("Caio (B): três consultas, o parecer enviesado, o limite de 5 e a escolha na nuvem", async () => {
    await service.mensagem(ESCOLA, ids.caio, "Qual projeto atende mais pessoas pelo menor custo por vaga?");
    await service.mensagem(ESCOLA, ids.caio, "Compare a regularidade e os relatórios enviados pelos três projetos.");
    let s = SessaoSchema.parse(await service.mensagem(ESCOLA, ids.caio, "Quais são as evidências de impacto de cada iniciativa?"));
    expect(s.chat).toMatchObject({ consultas: 3, podeEscolher: true, cadernosOferecidos: false });
    expect(s.chat.mensagens.filter((m) => m.ancora === "parecer-inicial")).toHaveLength(1);
    expect(s.chat.mensagens.filter((m) => m.ancora === "contraste")).toHaveLength(1);
    await service.mensagem(ESCOLA, ids.caio, "oi");
    s = SessaoSchema.parse(await service.mensagem(ESCOLA, ids.caio, "tudo bem?"));
    expect(s.chat.limiteAtingido).toBe(true);
    expect(await codigo(service.mensagem(ESCOLA, ids.caio, "mais uma"))).toBe("limite-do-chat");
    s = SessaoSchema.parse(await service.decidir(ESCOLA, ids.caio, "nuvem", [...RANKING_R]));
    expect(s.caminho).toBe("B");
    expect(await nivel(ids.caio, "investigacao_e_revisao")).toBeNull();
    /* O latch: a mesma decisão é idempotente; outra é 409. */
    expect(SessaoSchema.parse(await service.decidir(ESCOLA, ids.caio, "nuvem", [...RANKING_R])).decisao?.projeto).toBe("nuvem");
    expect(await codigo(service.decidir(ESCOLA, ids.caio, "papel", [...RANKING_R]))).toBe("ja-decidido");
  });

  test("o texto do estudante não desce com a auditoria do classificador", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    for (const m of s.chat.mensagens) expect(Object.keys(m).sort()).toEqual(["ancora", "anexos", "autor", "id", "texto"]);
  });
});

describe("as três travas, a revelação e o segundo voto", () => {
  test("antes da revelação, a E4 espera", async () => {
    expect(await codigo(service.digitalizar(ESCOLA, ids.caio))).toBe("revelacao-nao-liberada");
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.caio)).revelacao).toBeNull();
  });

  test("trava 1 (revelação): Caio digitaliza na E4; a tabela compara o 1º voto com o papel", async () => {
    await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "revelacao");
    let s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.caio));
    expect(s).toMatchObject({ passo: "revelacao", revotoAberto: false, revelacao: { comparado: "nuvem", contrafactual: null, tabela: [] } });
    expect(await codigo(service.pilula(ESCOLA, ids.caio, "custo"))).toBe("cadernos-pendentes");
    s = SessaoSchema.parse(await service.digitalizar(ESCOLA, ids.caio));
    expect(s.revelacao?.tabela.map((l) => l.projeto)).toEqual(["nuvem", "papel"]);
    s = SessaoSchema.parse(await service.pilula(ESCOLA, ids.caio, "custo"));
    expect(s.revelacao?.pilulas).toEqual(["custo"]);
    expect(await codigo(service.revotar(ESCOLA, ids.caio, "nuvem", [...RANKING_R]))).toBe("revoto-nao-liberado");
  });

  test("Ana (A1) vê o contrafactual; quem votou no papel compara com a recomendação da IA", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s.revelacao?.contrafactual).toContain("Mesa Aberta");
    expect(s.revelacao?.tabela.map((l) => l.projeto)).toEqual(["nuvem", "papel"]);
  });

  test("trava 2 (debate → revoto): o 2º voto abre, com as marcas da EF09CO08", async () => {
    await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "revoto");
    /* Caio (B) mantém o projeto e o ranking: não atingiu. */
    let s = SessaoSchema.parse(await service.revotar(ESCOLA, ids.caio, "nuvem", [...RANKING_R]));
    expect(s).toMatchObject({ passo: "espera2", revoto: { projeto: "nuvem", manteve: true }, decisao: { projeto: "nuvem" } });
    expect(await nivel(ids.caio, "investigacao_e_revisao")).toBe("nao_atingiu");
    expect(await codigo(service.revotar(ESCOLA, ids.caio, "papel", [...RANKING_U]))).toBe("ja-revotado");
    /* Bia (A2) precisa de uma pílula antes; depois troca para o papel. */
    await service.digitalizar(ESCOLA, ids.bia);
    expect(await codigo(service.revotar(ESCOLA, ids.bia, "papel", [...RANKING_U]))).toBe("pilula-pendente");
    await service.pilula(ESCOLA, ids.bia, "assinaturas");
    s = SessaoSchema.parse(await service.revotar(ESCOLA, ids.bia, "papel", [...RANKING_U]));
    expect(s.revoto).toMatchObject({ projeto: "papel", manteve: false });
    await service.pilula(ESCOLA, ids.ana, "custo");
    await service.revotar(ESCOLA, ids.ana, "papel", [...RANKING_U]);
  });

  test("trava 3 (explicar): Amara com o voto, o protocolo embaralhado e sem gabarito", async () => {
    expect(await codigo(service.enviarProtocolo(ESCOLA, ids.ana, { slots: [A, B, C], descarte: [] }))).toBe("explicar-nao-liberado");
    await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "explicar");
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s.passo).toBe("explicar");
    /* A turma votou 2 de 3 na nuvem: a fala afirma a indução. */
    expect(s.explicar?.falaDeAmara).toContain("Você escolheu o projeto Mesa Aberta, enquanto boa parte da turma");
    expect([...(s.protocolo?.banco ?? [])].sort()).toEqual([...GABARITO_DO_PROTOCOLO, "desclassificar-sem-pdf"].sort());
    expect(JSON.stringify(s)).not.toContain("gabarito");
  });

  test("o protocolo conclui e marca a EF09CO07 pela régua do servidor", async () => {
    await service.marcarAncoras(ESCOLA, ids.ana, ["parecer-inicial", "inversao"]);
    let s = SessaoSchema.parse(await service.enviarProtocolo(ESCOLA, ids.ana, { slots: [A, B, C], descarte: ["desclassificar-sem-pdf"] }));
    expect(s).toMatchObject({ passo: "concluida", concluido: true, explicar: { ancoras: ["parecer-inicial", "inversao"] } });
    expect(await nivel(ids.ana, "protocolo_assistente")).toBe("atingiu");
    /* Sem trava no cliente: um bloco basta, e a régua decide. */
    s = SessaoSchema.parse(await service.enviarProtocolo(ESCOLA, ids.bia, { slots: [A, null, null], descarte: [] }));
    expect(s.concluido).toBe(true);
    expect(await nivel(ids.bia, "protocolo_assistente")).toBe("nao_atingiu");
    expect(await codigo(service.enviarProtocolo(ESCOLA, ids.ana, { slots: [C, B, A], descarte: [] }))).toBe("missao-concluida");
  });

  test("o CHECK do banco recusa o 2º voto sem os cadernos e a conclusão sem protocolo", async () => {
    const linha = await prisma.exp09ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.caio } });
    const chave = { escolaId_estudanteId_pacoteId_rodada: { escolaId: ESCOLA, estudanteId: ids.caio, pacoteId: linha.pacoteId, rodada: linha.rodada } };
    await expect(prisma.exp09ef1bSessao.update({ where: chave, data: { cadernosEm: null, cadernosNaEtapa: null } })).rejects.toThrow();
    await expect(prisma.exp09ef1bSessao.update({ where: chave, data: { concluidoEm: new Date() } })).rejects.toThrow();
  });
});

describe("o painel, o material, a RLS e o zerar", () => {
  test("só contagens; a folha diz o passo — nunca o voto, o caminho nem o chat de ninguém", async () => {
    const p = RespostaPainelSchema.parse(await service.painel(ESCOLA, ids.turmaA, ids.prof));
    expect(p.etapa).toBe("explicar");
    expect(p.resumo).toMatchObject({
      estudantes: 3,
      entraram: 3,
      caminhos: { A1: 1, A2: 1, B: 1 },
      escolhaInicial: { papel: 1, parcial: 0, nuvem: 2 },
      escolhaFinal: { papel: 2, parcial: 0, nuvem: 1 },
      migracao: { mantiveram: 2, trocaram: 1, para: { papel: 1, parcial: 0, nuvem: 0 } },
      protocolosEnviados: 2,
    });
    expect(Object.keys(p.linhas[0] ?? {}).sort()).toEqual(["estudanteId", "nome", "passo", "segundosInativo"]);
    expect(JSON.stringify(p)).not.toContain("comida");
  });

  test("o material traz a conta da virada e o gabarito do protocolo", () => {
    const m = RespostaMaterialProfessorSchema.parse(service.material());
    expect(m.virada.antes[0]?.projeto).toBe("nuvem");
    expect(m.virada.depois[0]?.projeto).toBe("papel");
    expect(m.protocolo.gabarito).toEqual([...GABARITO_DO_PROTOCOLO]);
    expect(m.habilidades.map((h) => h.codigo)).toEqual(["EF09CO07", "EF09CO08"]);
  });

  test("a role SEM BYPASSRLS só enxerga a própria escola, e as quatro tabelas têm a RLS forçada", async () => {
    expect(await runtime.comTenancy((tx) => tx.exp09ef1bSessao.count(), ESCOLA)).toBeGreaterThan(0);
    expect(await runtime.comTenancy((tx) => tx.exp09ef1bSessao.count({ where: { escolaId: ESCOLA } }), OUTRA_ESCOLA)).toBe(0);
    for (const tabela of ["exp09ef1b_pacotes", "exp09ef1b_gates_turma", "exp09ef1b_gates_historico", "exp09ef1b_sessoes"]) {
      const [linha] = await prisma.$queryRawUnsafe<{ rls: boolean; forcada: boolean }[]>(`SELECT relrowsecurity AS rls, relforcerowsecurity AS forcada FROM pg_class WHERE relname = '${tabela}'`);
      expect(linha).toEqual({ rls: true, forcada: true });
    }
    await expect(runtime.comTenancy((tx) => tx.exp09ef1bGateTurma.create({ data: { escolaId: ESCOLA, turmaId: ids.turmaVizinha, etapa: "revoto" } }), OUTRA_ESCOLA)).rejects.toThrow();
  });

  test("zerar: rodada 2, a evidência do pacote apagada, as sessões guardadas, o gate no início", async () => {
    const r = await service.zerar(ESCOLA, ids.turmaA, ids.prof, 1);
    expect(r).toEqual({ etapa: "exploracao", atividade: { pacoteId: ids.pacote, rodada: 2 } });
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, expId: EXP_ID } })).toBe(0);
    expect(await prisma.exp09ef1bSessao.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(3);
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana))).toMatchObject({ passo: "abertura", decisao: null });
    expect(await codigo(service.zerar(ESCOLA, ids.turmaA, ids.prof, 5))).toBe("rodada-desatualizada");
  });
});
