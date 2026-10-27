import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import type { AuthClaims } from "../src/auth/claims";
import { AssistenteInvisivelTurmasController } from "../src/assistente-invisivel/assistente-invisivel-turmas.controller";
import { AssistenteInvisivelService } from "../src/assistente-invisivel/assistente-invisivel.service";
import {
  EXP_ID,
  MARCADOR_CO01,
  MARCADOR_CO03,
  MARCADOR_CO18,
  MARCADOR_CO20,
  OPCAO_CERTA_DO_BLOCO,
  PACOTE_PADRAO,
  type ConteudoDoPacote,
} from "../src/assistente-invisivel/conteudo";
import {
  EmAndamentoSchema,
  EstadoSchema,
  GateDaTurmaSchema,
  GateDoEstudanteSchema,
  GerarRespostaSchema,
  PacoteDaTurmaSchema,
  PacotesDaTurmaSchema,
  PainelSchema,
  RascunhoSchema,
  RespostaDoRetesteSchema,
  SessaoSchema,
} from "../src/assistente-invisivel/contrato-de-rotas";
import { PreparoDaExp01em1bService } from "../src/assistente-invisivel/preparo.service";
import { SYSTEM_DO_PREPARO } from "../src/assistente-invisivel/prompts";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O Assistente Invisível (exp01em1b, ADR-185) no Postgres: o que só o banco
 * responde.
 *
 * A porta da sala em TODA rota de estudante, a missão que nasce vazia, o
 * preparo com a quota do professor e a reserva no banco padrão, a curadoria
 * (regenerar e editar), a homologação, o banco padrão num toque, as fases só
 * para a frente e o 409 sem 100% das apostas, os dois latches, o reteste e o
 * revisar, a publicação com a página desligada, as marcas no publicar e no
 * encerrar, o painel, o gabarito ausente da saída do estudante, os CHECKs, a
 * RLS com a role sem `BYPASSRLS` e o zerar.
 *
 * Os testes dependem da ORDEM: é a aula, na sequência em que ela acontece.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-assistente-invisivel";
const OUTRA_ESCOLA = "teste-assistente-invisivel-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/** O pacote que a IA de mentira escreve (passa pela régua de verdade, no `validar`). */
const PACOTE_DA_IA: Omit<ConteudoDoPacote, "versao"> = {
  trilhaAvancada: { titulo: "Trilha Avançada: Cruzamentos Genéticos Complexos", enunciado: "Monte o quadro de Punnett de um diibridismo e explique a proporção 9:3:3:1." },
  reforcoBasico: { titulo: "Reforço Básico: Dominante e Recessivo", enunciado: "Marque quais características são dominantes e quais são recessivas." },
  duvidas: {
    lucas: "Como eu sei quando usar o quadro de Punnett com dois genes?",
    beatriz: "Por que a proporção 9:3:3:1 só vale com genes independentes?",
    thiago1: "O que é um alelo recessivo?",
    thiago2: "Um heterozigoto sempre mostra a característica dominante?",
    thiago3: "Qual a chance de dois heterozigotos terem um filho recessivo?",
  },
  respostas: {
    lucas: "Use o quadro quando os dois genes segregam de forma independente: combine os gametas possíveis de cada pai. Sua trilha avançada já está liberada.",
    beatriz: "Porque a segunda lei de Mendel supõe que os genes estão em cromossomos diferentes; ligados, a proporção muda.",
    thiago1: "É a versão do gene que só aparece quando a pessoa tem duas cópias dela.",
    thiago2: "Na dominância completa, sim; em dominância incompleta ou codominância, não.",
    thiago3: "Um em quatro, ou 25%: cada um passa o alelo recessivo com metade de chance.",
  },
  leitura: { titulo: "Leitura Recomendada: As Leis de Mendel", resumo: "Um guia curto sobre as duas leis de Mendel, com exemplos de cruzamentos resolvidos." },
};

/** A IA de mentira: escreve o pacote, regera um item, ou está fora do ar. */
let modoDaIa: "escreve" | "falha" = "escreve";
let chamadasDaIa = 0;
let versaoDoItem = 0;
const ia = {
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    expect(req.system).toBe(SYSTEM_DO_PREPARO);
    chamadasDaIa += 1;
    if (modoDaIa === "falha") throw new Error("vendor fora do ar");
    if (req.responseSchema.required?.includes("trilhaAvancada")) {
      req.aoUsarTokens?.(900);
      return req.validar(structuredClone(PACOTE_DA_IA));
    }
    req.aoUsarTokens?.(300);
    versaoDoItem += 1;
    return req.validar({ titulo: `Trilha Avançada: Herança Ligada ao Sexo ${versaoDoItem}`, texto: `Explique a herança ligada ao X com o exemplo ${versaoDoItem}.` });
  },
} as unknown as AiProvider;

const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
const quota = new QuotaService(prisma);
const service = new AssistenteInvisivelService(prisma, evidencias, new PreparoDaExp01em1bService(ia, quota));
const semSaldo = { temSaldo: async () => false, consumir: async () => undefined } as unknown as QuotaService;
const servicoSemSaldo = new AssistenteInvisivelService(prisma, evidencias, new PreparoDaExp01em1bService(ia, semSaldo));
const controller = new AssistenteInvisivelTurmasController(service);
evidencias.onModuleInit();

const ids = { turmaA: "", turmaB: "", turmaC: "", turmaVizinha: "", prof: "", profB: "", ana: "", bia: "", caio: "", duda: "", fabi: "", vizinho: "", pacoteIa: "" };
const SEM = {};

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp01em1bGateHistorico.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp01em1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp01em1bGateTurma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
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

const req = (usuarioId: string): { auth: AuthClaims } => ({ auth: { usuarioId, escolaId: ESCOLA, perfil: "professor" } as AuthClaims });

async function niveis(estudanteId: string) {
  const marcas = await prisma.evidenciaMarca.findMany({ where: { escolaId: ESCOLA, expId: EXP_ID, estudanteId } });
  const de = (m: string) => marcas.find((x) => x.marcador === m)?.status ?? null;
  return { co20: de(MARCADOR_CO20), co01: de(MARCADOR_CO01), co18: de(MARCADOR_CO18), co03: de(MARCADOR_CO03) };
}

const tokensDoProf = async () => (await prisma.iaUsoDiario.findFirst({ where: { escolaId: ESCOLA, usuarioId: ids.prof } }))?.tokensUsados ?? 0;
const gate = (para: Parameters<AssistenteInvisivelService["mudarGate"]>[3]) => service.mudarGate(ESCOLA, ids.turmaA, ids.prof, para);

/** Da boas-vindas até a aposta travada (E1–E3). */
async function ateAAposta(estudanteId: string, aposta: "a" | "b" | "c") {
  await service.sessao(ESCOLA, estudanteId);
  await service.iniciar(ESCOLA, estudanteId, SEM);
  await service.navegar(ESCOLA, estudanteId, SEM, ["exercicios"]);
  return EstadoSchema.parse(await service.apostar(ESCOLA, estudanteId, SEM, aposta));
}

/** Da simulação até a bancada (E4) — depois da "Liberar Início da Simulação". */
async function ateABancada(estudanteId: string) {
  await service.concluirSimulacao(ESCOLA, estudanteId, SEM);
  await service.abrirFichas(ESCOLA, estudanteId, SEM);
  return EstadoSchema.parse(await service.concluirInspecao(ESCOLA, estudanteId, SEM));
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Assistente Invisível (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  ids.turmaA = (await criarTurmaDeTeste(prisma, ESCOLA, "1EM-A-ASSIST", "1EM")).id;
  ids.turmaB = (await criarTurmaDeTeste(prisma, ESCOLA, "1EM-B-ASSIST", "1EM")).id;
  ids.turmaC = (await criarTurmaDeTeste(prisma, ESCOLA, "1EM-C-ASSIST", "1EM")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "1EM-A vizinha", "1EM")).id;
  const pessoa = (escolaId: string, turmaId: string | null, username: string, nome: string, role = "estudante") =>
    prisma.user
      .create({ data: { role, escolaId, turmaId, username, displayName: nome, passwordHash: "x" }, select: { id: true } })
      .then((u) => u.id);
  ids.ana = await pessoa(ESCOLA, ids.turmaA, "ai.ana", "Ana Teste");
  ids.bia = await pessoa(ESCOLA, ids.turmaA, "ai.bia", "Bia Teste");
  ids.caio = await pessoa(ESCOLA, ids.turmaA, "ai.caio", "Caio Teste");
  ids.duda = await pessoa(ESCOLA, ids.turmaB, "ai.duda", "Duda Teste");
  ids.fabi = await pessoa(ESCOLA, ids.turmaC, "ai.fabi", "Fabi Teste");
  ids.vizinho = await pessoa(OUTRA_ESCOLA, ids.turmaVizinha, "ai.vizinho", "Vizinho Teste");
  ids.prof = await pessoa(ESCOLA, null, "ai.marta", "Marta Teste", "professor");
  ids.profB = await pessoa(ESCOLA, null, "ai.rui", "Rui Teste", "professor");
  const lecionar = (turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: { escolaId: ESCOLA, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
    });
  await lecionar(ids.turmaA, ids.prof);
  await lecionar(ids.turmaB, ids.profB);
  /* A PORTA DA SALA: a 1EM-C fica SEM liberação, de propósito. */
  await liberarParaTeste(prisma, ESCOLA, ids.turmaA, EXP_ID, ids.prof);
  await liberarParaTeste(prisma, ESCOLA, ids.turmaB, EXP_ID, ids.profB);
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("a porta da sala (ADR-69)", () => {
  test("TODA rota de estudante recusa quem está numa turma sem a missão liberada", async () => {
    const f = ids.fabi;
    for (const chamada of [
      () => service.sessao(ESCOLA, f),
      () => service.gate(ESCOLA, f),
      () => service.iniciar(ESCOLA, f, SEM),
      () => service.navegar(ESCOLA, f, SEM, ["exercicios"]),
      () => service.apostar(ESCOLA, f, SEM, "a"),
      () => service.concluirSimulacao(ESCOLA, f, SEM),
      () => service.abrirFichas(ESCOLA, f, SEM),
      () => service.concluirInspecao(ESCOLA, f, SEM),
      () => service.classificar(ESCOLA, f, SEM, {}),
      () => service.abrirAlgoritmo(ESCOLA, f, SEM),
      () => service.marcarAlgoritmo(ESCOLA, f, SEM, [2]),
      () => service.concluirAlgoritmo(ESCOLA, f, SEM),
      () => service.retestar(ESCOLA, f, SEM, { exercicios: "a", duvidas: "a", sugestoes: "a" }),
      () => service.revisar(ESCOLA, f, SEM),
      () => service.avancar(ESCOLA, f, SEM),
      () => service.publicar(ESCOLA, f, SEM, true, {}),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 403, corpo: { codigo: "missao-nao-liberada" } });
    }
  });

  test("estudante de OUTRA escola: 404", async () => {
    expect(await recusa(service.sessao(ESCOLA, ids.vizinho))).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
  });
});

describe("a missão nasce VAZIA", () => {
  test("sem pacote no ar: espera; a jogada é 409; o botão do professor também espera; nenhuma sessão nasce", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s).toMatchObject({ passo: "boas-vindas", preparada: false, fase: null, pacote: null, aguardandoProfessor: true, medidor: null });
    expect(s.material.blocos.map((b) => b.id)).toEqual(["problema", "inferencia", "regra", "salvaguarda"]);
    expect(await codigo(service.iniciar(ESCOLA, ids.ana, SEM))).toBe("missao-em-preparo");
    expect(await codigo(gate("testes"))).toBe("pacote-nao-aprovado");
    expect(await prisma.exp01em1bSessao.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });
});

describe("o preparo do professor (IA com a quota do perfil professor)", () => {
  const recorte = { disciplina: "biologia" as const, tema: "Genética Mendeliana", topicos: ["alelos", "dominância", "Punnett"], contexto: null };

  test("404, nunca 403, na turma que não leciona — e o gerar não gasta token antes", async () => {
    const antes = chamadasDaIa;
    for (const chamada of [
      () => service.pacoteDaTurma(ESCOLA, ids.turmaB, ids.prof),
      () => service.gerar(ESCOLA, ids.turmaB, ids.prof, "professor", recorte),
      () => service.usarBancoPadrao(ESCOLA, ids.turmaB, ids.prof),
      () => service.painel(ESCOLA, ids.turmaB, ids.prof),
      () => service.mudarGate(ESCOLA, ids.turmaB, ids.prof, "testes"),
      () => service.encerrar(ESCOLA, ids.turmaB, ids.prof),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
    }
    expect(chamadasDaIa).toBe(antes);
  });

  test("gerar com IA: UM rascunho do pacote inteiro (com a dúvida do Lucas e as respostas), e o pago debitado", async () => {
    const r = GerarRespostaSchema.parse(await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", recorte));
    expect(r).toMatchObject({ usouIa: true, motivo: null, rascunho: { origem: "ia", contingencia: false, aprovadoEm: null, editados: [], tema: "Genética Mendeliana" } });
    expect(r.rascunho.conteudo.duvidas.lucas).toBe(PACOTE_DA_IA.duvidas.lucas);
    expect(r.rascunho.conteudo.respostas.thiago3).toBe(PACOTE_DA_IA.respostas.thiago3);
    expect(await prisma.exp01em1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } })).toMatchObject({
      iaGeracoes: 1,
      iaTokens: 900,
    });
    expect(await tokensDoProf()).toBe(900);
  });

  test("regenerar um item: só ele muda, com a quota; editar: o selo de editado e a régua", async () => {
    const { rascunho } = PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turmaA, ids.prof));
    const editado = RascunhoSchema.parse(
      await controller.editar(ids.turmaA, undefined, { rascunhoId: rascunho!.id, item: "trilhaAvancada", titulo: "Trilha Avançada: Diibridismo", texto: "Resolva o cruzamento AaBb x AaBb." }, req(ids.prof)),
    );
    expect(editado.rascunho.editados).toEqual(["trilhaAvancada"]);
    expect(editado.rascunho.conteudo.trilhaAvancada.titulo).toBe("Trilha Avançada: Diibridismo");

    const regenerado = RascunhoSchema.parse(await controller.regenerar(ids.turmaA, undefined, { rascunhoId: rascunho!.id, item: "trilhaAvancada" }, req(ids.prof)));
    expect(regenerado.rascunho.conteudo.trilhaAvancada.titulo).toMatch(/^Trilha Avançada: Herança Ligada ao Sexo/);
    expect(regenerado.rascunho.editados).toEqual([]);
    expect(regenerado.rascunho.conteudo.duvidas).toEqual(PACOTE_DA_IA.duvidas);
    expect(await tokensDoProf()).toBe(1200);

    /* A régua: a pista da inferência é recusada, com a frase para o professor. */
    const ruim = await recusa(() =>
      controller.editar(ids.turmaA, undefined, { rascunhoId: rascunho!.id, item: "duvidas.beatriz", texto: "Posso estudar à noite e ainda fazer a trilha?" }, req(ids.prof)),
    );
    expect(ruim).toMatchObject({ status: 400, corpo: { codigo: "pacote-invalido" } });
    expect((ruim.corpo.erros as string[]).join(" ")).toMatch(/A dúvida da Beatriz cita "noite"/);
    expect(await codigo(() => controller.editar(ids.turmaA, undefined, { rascunhoId: rascunho!.id, item: "duvidas.lucas", titulo: "x", texto: "y" }, req(ids.prof)))).toBe(
      "payload-invalido",
    );
    expect(await codigo(() => controller.editar(ids.turmaA, undefined, { rascunhoId: "00000000-0000-4000-8000-000000000000", item: "leitura", texto: "y" }, req(ids.prof)))).toBe(
      "rascunho-desatualizado",
    );
  });

  test("regenerar sem saldo é 429; com o vendor fora, 503 — e o rascunho fica como estava", async () => {
    const { rascunho } = PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turmaA, ids.prof));
    const antes = rascunho!.conteudo;
    const sem = await recusa(servicoSemSaldo.regenerarItem(ESCOLA, ids.turmaA, ids.prof, "professor", { rascunhoId: rascunho!.id, item: "leitura" }));
    expect(sem).toMatchObject({ status: 429, corpo: { codigo: "sem-saldo-de-ia" } });
    modoDaIa = "falha";
    const fora = await recusa(service.regenerarItem(ESCOLA, ids.turmaA, ids.prof, "professor", { rascunhoId: rascunho!.id, item: "leitura" }));
    modoDaIa = "escreve";
    expect(fora).toMatchObject({ status: 503, corpo: { codigo: "ia-indisponivel" } });
    expect(PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turmaA, ids.prof)).rascunho!.conteudo).toEqual(antes);
  });

  test("aprovar: outro rascunho é 409; o certo vira atividade PRONTA (não no ar); o duplo clique é idempotente", async () => {
    const { rascunho } = PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turmaA, ids.prof));
    expect(await codigo(() => controller.homologar(ids.turmaA, undefined, { rascunhoId: "00000000-0000-4000-8000-000000000000" }, req(ids.prof)))).toBe(
      "rascunho-desatualizado",
    );
    const um = await controller.homologar(ids.turmaA, undefined, { rascunhoId: rascunho!.id }, req(ids.prof));
    const dois = await controller.homologar(ids.turmaA, undefined, { rascunhoId: rascunho!.id }, req(ids.prof));
    expect(dois.id).toBe(um.id);
    expect(um).toMatchObject({ ativo: false, origem: "ia", contingencia: false });
    ids.pacoteIa = um.id;
    expect(PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turmaA, ids.prof))).toMatchObject({ ativo: null, rascunho: null });
  });

  test("com o vendor fora, o rascunho é o banco padrão de LP com contingência (503 na tela)", async () => {
    modoDaIa = "falha";
    const r = GerarRespostaSchema.parse(await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", recorte));
    modoDaIa = "escreve";
    expect(r).toMatchObject({ usouIa: false, motivo: "indisponivel", rascunho: { origem: "padrao", contingencia: true, tema: PACOTE_PADRAO.tema } });
    expect(r.rascunho.conteudo).toEqual(PACOTE_PADRAO.conteudo);
  });

  test("sem saldo, a IA nem é chamada, e o rascunho continua UM só", async () => {
    const antes = chamadasDaIa;
    const r = await servicoSemSaldo.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", recorte);
    expect(chamadasDaIa).toBe(antes);
    expect(r).toMatchObject({ usouIa: false, motivo: "sem-saldo", rascunho: { contingencia: true } });
    expect(await prisma.exp01em1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } })).toBe(1);
  });

  test("o caminho curto: o banco padrão aprovado E no ar num toque; de novo, a mesma atividade", async () => {
    const r = EmAndamentoSchema.parse(await service.usarBancoPadrao(ESCOLA, ids.turmaA, ids.prof));
    expect(r).toMatchObject({ mudou: true, fase: "aguardando-inicio", atividade: { rodada: 1 } });
    const de_novo = EmAndamentoSchema.parse(await service.usarBancoPadrao(ESCOLA, ids.turmaA, ids.prof));
    expect(de_novo).toMatchObject({ mudou: false, atividade: { pacoteId: r.atividade.pacoteId } });
    expect(await prisma.exp01em1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } })).toBe(1);
    const p = PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turmaA, ids.prof));
    expect(p.ativo).toMatchObject({ origem: "padrao", contingencia: false, ativo: true });
  });
});

describe("E1–E3: a Trava 0, o 100% das apostas e o latch 1", () => {
  test("a sessão nasce no GET, com o pacote e o material; a Trava 0 segura o E1", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s).toMatchObject({ passo: "boas-vindas", preparada: true, fase: "aguardando-inicio", aguardandoProfessor: true, pacote: { contingencia: false } });
    expect(s.pacote?.conteudo).toEqual(PACOTE_PADRAO.conteudo);
    expect(s.criterios).toEqual({ exercicios: "b", duvidas: "b", sugestoes: "a" });
    expect(await prisma.exp01em1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(1);
    expect(await codigo(service.iniciar(ESCOLA, ids.ana, SEM))).toBe("aguardando-professor");
  });

  test("as fases: só para a frente, sem pular a liberação; repetir é idempotente e não suja o histórico", async () => {
    expect(await codigo(gate("simulacao"))).toBe("transicao-de-etapa-invalida");
    expect(GateDaTurmaSchema.parse(await gate("testes")).fase).toBe("testes");
    expect((await gate("testes")).fase).toBe("testes");
    expect(await prisma.exp01em1bGateHistorico.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(1);
    expect(GateDoEstudanteSchema.parse(await service.gate(ESCOLA, ids.ana))).toMatchObject({ fase: "testes", passo: "boas-vindas", aguardandoProfessor: false });
  });

  test("jogada à frente é 409; a aposta é o latch: a mesma é idempotente, outra é 409", async () => {
    await service.iniciar(ESCOLA, ids.ana, SEM);
    expect(await codigo(service.apostar(ESCOLA, ids.ana, SEM, "a"))).toBe("passo-invalido");
    expect(EstadoSchema.parse(await service.navegar(ESCOLA, ids.ana, SEM, ["duvidas", "exercicios"]))).toMatchObject({
      passo: "aposta",
      funcoesAbertas: ["exercicios", "duvidas"],
    });
    const e = EstadoSchema.parse(await service.apostar(ESCOLA, ids.ana, SEM, "a"));
    expect(e).toMatchObject({ passo: "simulacao", aposta: "a", aguardandoProfessor: true });
    expect(e.apostadaEm).not.toBeNull();
    expect(EstadoSchema.parse(await service.apostar(ESCOLA, ids.ana, SEM, "a")).aposta).toBe("a");
    expect(await codigo(service.apostar(ESCOLA, ids.ana, SEM, "b"))).toBe("ja-apostou");
    expect(await codigo(service.iniciar(ESCOLA, ids.ana, { atividade: { pacoteId: e.atividade!.pacoteId, rodada: 99 } }))).toBe("rodada-mudou");
  });

  test("sem 100% das sessões abertas, a simulação não libera; o painel diz quem falta", async () => {
    await service.sessao(ESCOLA, ids.bia);
    await service.sessao(ESCOLA, ids.caio);
    expect(await codigo(gate("simulacao"))).toBe("apostas-pendentes");
    const p = PainelSchema.parse(await service.painel(ESCOLA, ids.turmaA, ids.prof));
    expect(p.resumo).toMatchObject({ sessoes: 3, todosApostaram: false, faltamApostar: ["Bia Teste", "Caio Teste"], apostas: { a: 1, b: 0, c: 0 } });
  });

  test("o medidor: nada antes da própria aposta, nada com menos de 3, agregado depois", async () => {
    await ateAAposta(ids.bia, "b");
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana)).medidor).toBeNull();
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.caio)).medidor).toBeNull();
    await ateAAposta(ids.caio, "c");
    expect(GateDoEstudanteSchema.parse(await service.gate(ESCOLA, ids.ana)).medidor).toEqual({ a: 34, b: 33, c: 33, total: 3 });
    expect(GateDaTurmaSchema.parse(await gate("simulacao")).fase).toBe("simulacao");
  });
});

describe("E4: a simulação, a inspeção e a Trava 1", () => {
  test("quem conclui a inspeção espera a bancada; a pausa trava todo mundo da E4", async () => {
    const e = await ateABancada(ids.ana);
    expect(e).toMatchObject({ passo: "classificacao", aguardandoProfessor: true });
    expect(await codigo(service.classificar(ESCOLA, ids.ana, SEM, { horario: "observados" }))).toBe("aguardando-professor");
    await gate("debate-1");
    expect(await codigo(service.concluirSimulacao(ESCOLA, ids.bia, SEM))).toBe("aguardando-professor");
    expect(GateDoEstudanteSchema.parse(await service.gate(ESCOLA, ids.bia))).toMatchObject({ passo: "simulacao", aguardandoProfessor: true });
    await gate("explicar");
    expect(await codigo(gate("testes"))).toBe("transicao-de-etapa-invalida");
    await ateABancada(ids.bia);
    await ateABancada(ids.caio);
  });
});

describe("E5: a bancada, o painel opcional e o reteste", () => {
  test("os cartões: a tabela causal desce, os acertos não", async () => {
    const e = EstadoSchema.parse(
      await service.classificar(ESCOLA, ids.ana, SEM, {
        "trilha-avancada": "fornecidos",
        "nome-turma": "fornecidos",
        horario: "observados",
        "sinal-de-rede": "observados",
        "endereco-ip": "observados",
        "modelo-aparelho": "observados",
      }),
    );
    expect(e).toMatchObject({ passo: "algoritmo", classificacao: { completa: true, cadeiaCausal: true } });
    expect(JSON.stringify(e)).not.toMatch(/acertos|alinhamento|correto/);
  });

  test("o painel opcional: marcar só aberto; marcar é repetível; Pular Etapa conclui", async () => {
    expect(await codigo(service.marcarAlgoritmo(ESCOLA, ids.ana, SEM, [2]))).toBe("passo-invalido");
    await service.abrirAlgoritmo(ESCOLA, ids.ana, SEM);
    await service.marcarAlgoritmo(ESCOLA, ids.ana, SEM, [2, 5]);
    const e = EstadoSchema.parse(await service.marcarAlgoritmo(ESCOLA, ids.ana, SEM, [4, 3, 2]));
    expect(e.algoritmo).toEqual({ aberto: true, marcados: [2, 3, 4], concluido: false });
    expect(EstadoSchema.parse(await service.concluirAlgoritmo(ESCOLA, ids.ana, SEM)).passo).toBe("criterios");
  });

  test("o reteste com 1B-2B: alerta de viés; a mesma de novo devolve o resultado; outra sem revisar é 409; revisar e retestar", async () => {
    const vies = { exercicios: "b", duvidas: "b", sugestoes: "a" } as const;
    const r = RespostaDoRetesteSchema.parse(await service.retestar(ESCOLA, ids.ana, SEM, vies));
    expect(r).toMatchObject({ passo: "reteste", retestes: 1, reteste: { equidade: "nenhuma", beatrizAvancada: false, thiagoLivre: false } });
    expect(RespostaDoRetesteSchema.parse(await service.retestar(ESCOLA, ids.ana, SEM, vies))).toMatchObject({ retestes: 1, reteste: { equidade: "nenhuma" } });
    expect(await codigo(service.retestar(ESCOLA, ids.ana, SEM, { exercicios: "a", duvidas: "c", sugestoes: "a" }))).toBe("passo-invalido");
    expect(EstadoSchema.parse(await service.revisar(ESCOLA, ids.ana, SEM)).passo).toBe("criterios");
    const ok = RespostaDoRetesteSchema.parse(await service.retestar(ESCOLA, ids.ana, SEM, { exercicios: "a", duvidas: "c", sugestoes: "c" }));
    expect(ok).toMatchObject({ retestes: 2, reteste: { equidade: "total", beatrizAvancada: true, thiagoLivre: true }, ultimoReteste: { equidade: "total" } });
    const linha = await prisma.exp01em1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(linha).toMatchObject({ equidadeNo1oReteste: "nenhuma", ultimaEquidade: "total", revisando: false });
  });

  test("avançar abre a Trava 2; a Bia e o Caio avançam mantendo o viés (o Aviso Discreto)", async () => {
    expect(EstadoSchema.parse(await service.avancar(ESCOLA, ids.ana, SEM))).toMatchObject({ passo: "publicacao", aguardandoProfessor: true });
    expect(await codigo(service.publicar(ESCOLA, ids.ana, SEM, true, { ...OPCAO_CERTA_DO_BLOCO }))).toBe("aguardando-professor");
    for (const [quem, criterios] of [
      [ids.bia, { exercicios: "c", duvidas: "b", sugestoes: "a" }],
      [ids.caio, { exercicios: "b", duvidas: "b", sugestoes: "c" }],
    ] as const) {
      await service.classificar(ESCOLA, quem, SEM, { horario: "observados" });
      await service.concluirAlgoritmo(ESCOLA, quem, SEM);
      await service.retestar(ESCOLA, quem, SEM, criterios);
      await service.avancar(ESCOLA, quem, SEM);
    }
    await gate("debate-2");
    await gate("publicar");
  });
});

describe("E6: o latch 2 e as quatro marcas", () => {
  test("a Ana publica com a página ativa e os quatro blocos certos: quatro atingiu", async () => {
    const e = EstadoSchema.parse(await service.publicar(ESCOLA, ids.ana, SEM, true, { ...OPCAO_CERTA_DO_BLOCO }));
    expect(e).toMatchObject({ passo: "concluida", concluido: true, publicacao: { paginaAtiva: true } });
    expect(await niveis(ids.ana)).toEqual({ co20: "atingiu", co01: "atingiu", co18: "atingiu", co03: "atingiu" });
    expect(EstadoSchema.parse(await service.publicar(ESCOLA, ids.ana, SEM, true, { ...OPCAO_CERTA_DO_BLOCO })).concluido).toBe(true);
    expect(await codigo(service.publicar(ESCOLA, ids.ana, SEM, false, { ...OPCAO_CERTA_DO_BLOCO }))).toBe("ja-publicado");
  });

  test("a Bia publica com a página DESLIGADA: os níveis intermediários", async () => {
    await service.publicar(ESCOLA, ids.bia, SEM, false, { ...OPCAO_CERTA_DO_BLOCO });
    expect(await niveis(ids.bia)).toEqual({ co20: "em_processo", co01: "em_processo", co18: "nao_atingiu", co03: "nao_atingiu" });
  });

  test("o painel: as escolhas por unidade, o Aviso Discreto, o comunicado em texto e a matriz", async () => {
    const p = PainelSchema.parse(await service.painel(ESCOLA, ids.turmaA, ids.prof));
    expect(p.resumo).toMatchObject({
      sessoes: 3,
      apostas: { a: 1, b: 1, c: 1 },
      todosApostaram: true,
      criterioExercicios: { a: 1, b: 1, c: 1 },
      avancaramComVies: ["Bia Teste", "Caio Teste"],
      publicaram: 2,
      paginasAtivas: 1,
      habilidades: { co20: 33, co01: 33, co18: 33, co03Participou: 33 },
    });
    const ana = p.linhas.find((l) => l.unidadeId === ids.ana)!;
    expect(ana).toMatchObject({
      passo: "concluida",
      cartoes: { acertos: 6, completa: true },
      algoritmo: { aberto: true, marcados: [2, 3, 4], correto: true },
      retestes: 2,
      equidade: "total",
      avancouComVies: false,
      publicacao: { paginaAtiva: true, alinhamento: "pleno" },
      niveis: { co20: "atingiu", co01: "atingiu", co18: "atingiu", co03: "atingiu" },
    });
    expect(ana.publicacao!.texto).toMatch(/^Identificamos que o assistente estava restringindo acessos automaticamente/);
    expect(p.linhas.find((l) => l.unidadeId === ids.caio)).toMatchObject({ passo: "publicacao", aguardandoProfessor: false, publicacao: null, niveis: null });
    expect(p.roteiro.perguntas).toHaveLength(4);
  });

  test("encerrar: quem apostou e não publicou recebe as quatro; a Ana não muda", async () => {
    expect(await service.encerrar(ESCOLA, ids.turmaA, ids.prof)).toEqual({ marcadas: 1 });
    expect(await niveis(ids.caio)).toEqual({ co20: "nao_atingiu", co01: "nao_atingiu", co18: "nao_atingiu", co03: "nao_atingiu" });
    expect(await niveis(ids.ana)).toEqual({ co20: "atingiu", co01: "atingiu", co18: "atingiu", co03: "atingiu" });
  });

  test("o gabarito não desce na sessão do estudante", async () => {
    const json = JSON.stringify(await service.sessao(ESCOLA, ids.ana));
    expect(json).not.toMatch(/"acertos"|"alinhamento"|"correto"|"niveis"|"blocosCorretos"|"cartoesAcertos"/);
  });
});

describe("o banco, a RLS e o zerar", () => {
  test("os CHECKs são a rede final: a publicação pela metade e a aposta fora do vocabulário são recusadas", async () => {
    const onde = { escolaId: ESCOLA, estudanteId: ids.ana };
    await expect(prisma.exp01em1bSessao.updateMany({ where: onde, data: { alinhamento: null } })).rejects.toThrow(/exp01em1b_sessoes_publicacao_check/);
    await expect(prisma.exp01em1bSessao.updateMany({ where: onde, data: { aposta: "z" } })).rejects.toThrow(/exp01em1b_sessoes_aposta_check/);
    await expect(prisma.exp01em1bSessao.updateMany({ where: onde, data: { avancouEm: null, avancouComVies: null } })).rejects.toThrow(
      /exp01em1b_sessoes_publicacao_ordem_check/,
    );
    await expect(prisma.exp01em1bGateTurma.updateMany({ where: { escolaId: ESCOLA }, data: { fase: "virada" } })).rejects.toThrow(/exp01em1b_gates_turma_fase_check/);
  });

  test("a role SEM BYPASSRLS só enxerga a própria escola", async () => {
    const daEscola = await runtime.comTenancy((tx) => tx.exp01em1bSessao.count(), ESCOLA);
    const daVizinha = await runtime.comTenancy((tx) => tx.exp01em1bSessao.count({ where: { escolaId: ESCOLA } }), OUTRA_ESCOLA);
    expect(daEscola).toBeGreaterThan(0);
    expect(daVizinha).toBe(0);
    for (const tabela of ["exp01em1b_pacotes", "exp01em1b_gates_turma", "exp01em1b_gates_historico", "exp01em1b_sessoes"]) {
      const [linha] = await prisma.$queryRawUnsafe<{ rls: boolean; forcada: boolean }[]>(
        `SELECT relrowsecurity AS rls, relforcerowsecurity AS forcada FROM pg_class WHERE relname = '${tabela}'`,
      );
      expect(linha).toEqual({ rls: true, forcada: true });
    }
  });

  test("zerar: rodada 2, a evidência do pacote apagada, as sessões guardadas, a fase de volta ao início", async () => {
    const r = await service.novaRodada(ESCOLA, ids.turmaA, ids.prof, 1);
    expect(r).toMatchObject({ fase: "aguardando-inicio", atividade: { rodada: 2 } });
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, expId: EXP_ID } })).toBe(0);
    expect(await prisma.exp01em1bSessao.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(3);
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana))).toMatchObject({ passo: "boas-vindas", fase: "aguardando-inicio", atividade: { rodada: 2 } });
    /* A fila da tela com a rodada velha não aplica na nova. */
    expect(await codigo(service.iniciar(ESCOLA, ids.ana, { atividade: { pacoteId: r.atividade.pacoteId, rodada: 1 } }))).toBe("rodada-mudou");
    expect(await codigo(service.novaRodada(ESCOLA, ids.turmaA, ids.prof, 5))).toBe("rodada-desatualizada");
    expect((await service.novaRodada(ESCOLA, ids.turmaA, ids.prof, 1)).atividade.rodada).toBe(2);
  });

  test("a atividade da IA continua no histórico e pode voltar ao ar (rodada nova)", async () => {
    const lista = PacotesDaTurmaSchema.parse(await service.historico(ESCOLA, ids.turmaA, ids.prof));
    expect(lista.historico.find((h) => h.id === ids.pacoteIa)).toMatchObject({ origem: "ia", ativo: false, rodadas: 0 });
    const r = await service.colocarEmAndamento(ESCOLA, ids.turmaA, ids.prof, ids.pacoteIa);
    expect(r).toMatchObject({ mudou: true, fase: "aguardando-inicio", atividade: { pacoteId: ids.pacoteIa, rodada: 1 } });
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s.pacote).toMatchObject({ disciplina: "biologia", tema: "Genética Mendeliana", contingencia: false });
  });
});
