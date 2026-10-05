import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import type { AuthClaims } from "../src/auth/claims";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  CONDICOES,
  DISCIPLINAS,
  EXP_ID,
  MOTIVOS,
  ORIGENS,
  PACOTE_PADRAO,
  VERSAO_DO_INSTRUMENTO,
  falaDaNina,
  mensagensDoPadrao,
  type MensagemDoPacote,
} from "../src/quem-mandou-isso/catalogo";
import {
  EstadoSchema,
  GateDaTurmaSchema,
  GateDoEstudanteSchema,
  GerarRespostaSchema,
  MaterialSchema,
  PacoteDaTurmaSchema,
  PacoteDoProfessorSchema,
  PacotesDaTurmaSchema,
  PainelSchema,
  SessaoSchema,
} from "../src/quem-mandou-isso/contrato-de-rotas";
import { PreparoDaExp05ef1bService } from "../src/quem-mandou-isso/preparo.service";
import { QuemMandouIssoTurmasController } from "../src/quem-mandou-isso/quem-mandou-isso-turmas.controller";
import { QuemMandouIssoService } from "../src/quem-mandou-isso/quem-mandou-isso.service";
import { FASES } from "../src/quem-mandou-isso/regras/passos";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Quem Mandou Isso? v2.2 (exp05ef1b) no Postgres: o que só o banco responde.
 *
 * A RLS das quatro tabelas ISOLANDO (com a role sem `BYPASSRLS`, senão passa em
 * falso), os CHECKs recusando o que dizem recusar e o vocabulário deles igual
 * ao do código, a porta da sala (ADR-69) em TODA rota de estudante, a missão
 * que nasce vazia, o preparo com a quota (e o 404 antes de gastar token), os
 * três latches — inclusive sob dois toques em paralelo —, a marca da
 * EF05CO08 na MESMA transação do Mural, o gabarito ausente antes da revelação,
 * o painel POR COMPUTADOR, o texto do menor só para quem leciona, e a rodada
 * nova que guarda o histórico.
 *
 * UMA ESCOLA POR SUÍTE (mais a vizinha, para a RLS). Os testes de um
 * `describe` dependem da ordem — é a aula, na sequência em que ela acontece.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-quem-mandou-v2";
const OUTRA_ESCOLA = "teste-quem-mandou-v2-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
/** A MESMA base, com a role SEM `BYPASSRLS` — o desenho da produção. */
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/** O provider de IA de mentira: escreve, falha, ou cobra e falha (a tentativa paga e rejeitada). */
let modoDaIa: "escreve" | "falha" | "cobra-e-falha" = "escreve";
let chamadasDaIa = 0;
const ia = {
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    chamadasDaIa += 1;
    if (modoDaIa === "falha") throw new Error("vendor fora do ar");
    req.aoUsarTokens?.(400);
    if (modoDaIa === "cobra-e-falha") throw new Error("o validar recusou as três tentativas");
    return req.validar({
      mensagens: Array.from({ length: 8 }, (_, i) => ({
        remetente: `Colega ${i + 1}`,
        texto: `Mensagem ${i + 1} sobre a feira de livros da escola.`,
        legenda: "Jornal do Bairro: a feira de livros foi adiada.",
      })),
    });
  },
} as unknown as AiProvider;

const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
const quota = new QuotaService(prisma);
const preparo = new PreparoDaExp05ef1bService(ia, quota);
const service = new QuemMandouIssoService(prisma, evidencias, preparo);
const controller = new QuemMandouIssoTurmasController(service);
evidencias.onModuleInit();
service.onModuleInit();

const TABELAS = ["exp05ef1b_pacotes", "exp05ef1b_gates_turma", "exp05ef1b_sessoes", "exp05ef1b_reflexoes"] as const;

const ids = {
  turma5A: "",
  turma5B: "",
  turma5C: "",
  turmaVizinha: "",
  professora: "",
  profOutra: "",
  profVizinho: "",
  ana: "",
  bia: "",
  caio: "",
  duda: "",
  enzo: "",
  fabi: "",
  vizinho: "",
};

/** O pacote ativo da 5A — preenchido na aprovação. */
let pacote5A = "";

const REGRA_DA_ANA = "Eu procuro a mesma notícia em outro lugar antes de encaminhar pra família.";

/** Uma regra Se/Então de ANTES da ADR-145, na rodada 1 — pelo cliente sem RLS, como a migração a deixou. */
function reflexaoHistorica(escolaId: string, estudanteId: string, pacoteId: string) {
  return prisma.exp05ef1bReflexao.create({
    data: {
      escolaId,
      estudanteId,
      pacoteId,
      rodada: 1,
      condicionalSe: "parente_proximo",
      acaoEntao: REGRA_DA_ANA,
      charsCount: REGRA_DA_ANA.length,
    },
  });
}

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  /* Sessões e reflexões caem pela cascata do pacote. */
  await prisma.exp05ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp05ef1bGateTurma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.matricula.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.escola.deleteMany({ where: { id: { in: ESCOLAS } } });
}

/** O status e o corpo de uma recusa — para afirmar os dois de uma vez. */
async function recusa(promessa: Promise<unknown>): Promise<{ status: number; corpo: Record<string, unknown> }> {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), corpo: e.getResponse() as Record<string, unknown> };
    throw e;
  }
  throw new Error("era para recusar, e passou");
}

async function codigo(promessa: Promise<unknown>): Promise<unknown> {
  return (await recusa(promessa)).corpo.codigo;
}

/** O pacote curado, como a tela o manda ao aprovar sem editar nada. */
function corpoDoPreset(mensagens: MensagemDoPacote[] = mensagensDoPadrao()) {
  return {
    disciplina: "letramento-digital",
    tema: PACOTE_PADRAO.tema,
    assuntos: [...PACOTE_PADRAO.assuntos],
    contexto: null,
    origem: "padrao",
    mensagens,
  };
}

function req(usuarioId: string, perfil: AuthClaims["perfil"] = "professor"): { auth: AuthClaims } {
  return { auth: { usuarioId, escolaId: ESCOLA, perfil } as AuthClaims };
}

/**
 * Aprova pelo CONTROLLER: é ele que roda o Zod e a régua do pacote. `async`
 * porque a recusa do Zod é SÍNCRONA (lança antes de haver promessa) — sem isto
 * o `recusa(...)` nem chegaria a ser chamado.
 */
async function aprovar(turmaId: string, professorId: string, corpo: unknown, escolaId = ESCOLA) {
  return controller.aprovar(turmaId, undefined, corpo, { auth: { ...req(professorId).auth, escolaId } });
}

/** As chaves do gabarito, em qualquer profundidade de um JSON. */
function chavesDeGabarito(valor: unknown): string[] {
  const achadas: string[] = [];
  const andar = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(andar);
    else if (v && typeof v === "object") {
      for (const [k, filho] of Object.entries(v)) {
        if (k === "veracidade" || k === "tom") achadas.push(k);
        andar(filho);
      }
    }
  };
  andar(valor);
  return achadas;
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Quem Mandou v2 (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });

  ids.turma5A = (await criarTurmaDeTeste(prisma, ESCOLA, "5A", "5EF")).id;
  ids.turma5B = (await criarTurmaDeTeste(prisma, ESCOLA, "5B", "5EF")).id;
  ids.turma5C = (await criarTurmaDeTeste(prisma, ESCOLA, "5C", "5EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "5A vizinha", "5EF")).id;

  const pessoa = (escolaId: string, turmaId: string | null, username: string, nome: string, role = "estudante") =>
    prisma.user
      .create({
        data: { role, escolaId, turmaId, username, displayName: nome, passwordHash: "x" },
        select: { id: true },
      })
      .then((u) => u.id);
  ids.ana = await pessoa(ESCOLA, ids.turma5A, "qmv2.ana", "Ana Teste");
  ids.bia = await pessoa(ESCOLA, ids.turma5A, "qmv2.bia", "Bia Teste");
  ids.caio = await pessoa(ESCOLA, ids.turma5A, "qmv2.caio", "Caio Teste");
  ids.duda = await pessoa(ESCOLA, ids.turma5A, "qmv2.duda", "Duda Teste");
  ids.enzo = await pessoa(ESCOLA, ids.turma5B, "qmv2.enzo", "Enzo Teste");
  ids.fabi = await pessoa(ESCOLA, ids.turma5C, "qmv2.fabi", "Fabi Teste");
  ids.vizinho = await pessoa(OUTRA_ESCOLA, ids.turmaVizinha, "qmv2.vizinho", "Vizinho Teste");
  ids.professora = await pessoa(ESCOLA, null, "qmv2.marta", "Marta Teste", "professor");
  ids.profOutra = await pessoa(ESCOLA, null, "qmv2.rui", "Rui Teste", "professor");
  ids.profVizinho = await pessoa(OUTRA_ESCOLA, null, "qmv2.lia", "Lia Teste", "professor");

  const lecionar = (escolaId: string, turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: { escolaId, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
    });
  await lecionar(ESCOLA, ids.turma5A, ids.professora);
  await lecionar(ESCOLA, ids.turma5B, ids.profOutra);
  await lecionar(OUTRA_ESCOLA, ids.turmaVizinha, ids.profVizinho);

  /* A PORTA DA SALA: a 5C fica SEM liberação, de propósito. */
  await liberarParaTeste(prisma, ESCOLA, ids.turma5A, EXP_ID, ids.professora);
  await liberarParaTeste(prisma, ESCOLA, ids.turma5B, EXP_ID, ids.profOutra);
  await liberarParaTeste(prisma, OUTRA_ESCOLA, ids.turmaVizinha, EXP_ID, ids.profVizinho);
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("a porta da sala (ADR-69)", () => {
  test("TODA rota de estudante recusa quem está numa turma sem a missão liberada", async () => {
    const naoLiberada = { status: 403, corpo: expect.objectContaining({ codigo: "missao-nao-liberada" }) };
    for (const chamada of [
      () => service.sessao(ESCOLA, ids.fabi),
      () => service.gate(ESCOLA, ids.fabi),
      () => service.entrar(ESCOLA, ids.fabi),
      () => service.guardarSelecao(ESCOLA, ids.fabi, ["msg_1"]),
      () => service.enviarAoMural(ESCOLA, ids.fabi, ["msg_1", "msg_2", "msg_3"]),
      () => service.votar(ESCOLA, ids.fabi, "urgencia"),
      () => service.concluir(ESCOLA, ids.fabi),
      /* As perguntas de evidência (E14) passam pela mesma porta. */
      () => evidencias.pergunta(ESCOLA, ids.fabi, EXP_ID, "p1"),
      () => evidencias.responder(ESCOLA, ids.fabi, EXP_ID, "p1", "A1"),
    ]) {
      expect(await recusa(chamada())).toEqual(naoLiberada);
    }
  });

  test("estudante de OUTRA escola não alcança esta: 404", async () => {
    expect(await recusa(service.sessao(ESCOLA, ids.vizinho))).toMatchObject({
      status: 404,
      corpo: { codigo: "turma-nao-encontrada" },
    });
  });
});

describe("a missão nasce VAZIA", () => {
  test("sem pacote aprovado: sessão de espera, sem mensagens — e entrar é 409", async () => {
    const sessao = SessaoSchema.parse(await service.sessao(ESCOLA, ids.enzo));
    expect(sessao).toMatchObject({ passo: "abertura", preparada: false, fase: null, atividade: null, pacote: null, revelacao: null });
    expect(sessao.textos.nina.convite).toBeNull();
    expect(await recusa(service.entrar(ESCOLA, ids.enzo))).toMatchObject({
      status: 409,
      corpo: { codigo: "grupo-em-preparo" },
    });
    expect(GateDoEstudanteSchema.parse(await service.gate(ESCOLA, ids.enzo))).toMatchObject({ preparada: false, passo: "abertura" });
  });

  test("os botões do professor também esperam o pacote: 409 pacote-nao-aprovado", async () => {
    expect(await codigo(service.mudarGate(ESCOLA, ids.turma5B, ids.profOutra, "liberar_revelacao"))).toBe("pacote-nao-aprovado");
    expect(await codigo(service.novaRodada(ESCOLA, ids.turma5B, ids.profOutra, 1))).toBe("pacote-nao-aprovado");
  });
});

describe("o professor: 404, nunca 403, na turma que não leciona", () => {
  test("pacote, painel, gerar (sem gastar token), aprovar, gate e nova rodada", async () => {
    const naoEncontrada = { status: 404, corpo: expect.objectContaining({ codigo: "turma-nao-encontrada" }) };
    const antes = chamadasDaIa;
    for (const chamada of [
      () => service.pacoteDaTurma(ESCOLA, ids.turma5A, ids.profOutra),
      () => service.painel(ESCOLA, ids.turma5A, ids.profOutra),
      () =>
        service.gerar(ESCOLA, ids.turma5A, ids.profOutra, "professor", {
          disciplina: "ciencias",
          tema: "a feira de livros",
          assuntos: ["um", "dois", "três"],
        }),
      () => aprovar(ids.turma5A, ids.profOutra, corpoDoPreset()),
      () => service.mudarGate(ESCOLA, ids.turma5A, ids.profOutra, "liberar_revelacao"),
      () => service.novaRodada(ESCOLA, ids.turma5A, ids.profOutra, 1),
      () => service.pacotes(ESCOLA, ids.turma5A, ids.profOutra),
      () => service.colocarEmAndamento(ESCOLA, ids.turma5A, ids.profOutra, "00000000-0000-4000-8000-000000000000"),
    ]) {
      expect(await recusa(chamada())).toEqual(naoEncontrada);
    }
    expect(chamadasDaIa).toBe(antes);
  });

  test("turma de outra escola, pelo token desta: 404", async () => {
    expect(await codigo(service.pacoteDaTurma(ESCOLA, ids.turmaVizinha))).toBe("turma-nao-encontrada");
  });
});

describe("o preparo e a aprovação", () => {
  const recorte = {
    disciplina: "lingua-portuguesa" as const,
    tema: "a feira de livros da escola",
    assuntos: ["adiamento do evento", "aviso da biblioteca", "post indignado de aluno"],
    contexto: "  Escola com grêmio ativo  ",
  };

  test("antes de tudo: sem ativo, sem rascunho, e o banco curado à mão", async () => {
    const p = PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turma5A, ids.professora));
    expect(p).toMatchObject({ ativo: null, rascunho: null, padrao: { nome: "O Mistério do Passeio ao Museu" } });
    expect(p.padrao.mensagens).toHaveLength(8);
    expect(p.disciplinas.map((d) => d.slug)).toEqual([...DISCIPLINAS]);
  });

  test("gerar com IA: o rascunho é GRAVADO, com o recorte limpo, e a quota paga o que o vendor cobrou", async () => {
    modoDaIa = "escreve";
    const r = GerarRespostaSchema.parse(await service.gerar(ESCOLA, ids.turma5A, ids.professora, "professor", recorte));
    expect(r).toMatchObject({ usouIa: true, motivo: null });
    expect(r.rascunho).toMatchObject({ origem: "ia", tema: recorte.tema, contexto: "Escola com grêmio ativo", aprovadoEm: null, ativo: false });
    expect(r.rascunho.mensagens).toHaveLength(8);
    const uso = await prisma.iaUsoDiario.findFirst({ where: { escolaId: ESCOLA, usuarioId: ids.professora } });
    expect(uso?.tokensUsados).toBe(400);

    /* Gerar de novo SUBSTITUI o rascunho — um por turma. */
    const de = await service.gerar(ESCOLA, ids.turma5A, ids.professora, "professor", recorte);
    expect(de.rascunho.id).toBe(r.rascunho.id);
    expect(await prisma.exp05ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turma5A } })).toBe(1);
  });

  test("vendor fora: o rascunho sai do banco curado, com a disciplina do recorte — e o que foi pago é debitado", async () => {
    await prisma.iaUsoDiario.deleteMany({ where: { escolaId: ESCOLA } });
    modoDaIa = "cobra-e-falha";
    const r = await service.gerar(ESCOLA, ids.turma5A, ids.professora, "professor", recorte);
    expect(r).toMatchObject({ usouIa: false, motivo: "indisponivel" });
    expect(r.rascunho).toMatchObject({ origem: "padrao", disciplina: "lingua-portuguesa", tema: PACOTE_PADRAO.tema, contexto: null });
    expect(r.rascunho.mensagens).toEqual(mensagensDoPadrao());
    expect((await prisma.iaUsoDiario.findFirst({ where: { escolaId: ESCOLA, usuarioId: ids.professora } }))?.tokensUsados).toBe(400);
  });

  test("sem saldo: nem chama o provider (temSaldo ANTES), e o motivo é o do 429", async () => {
    modoDaIa = "escreve";
    const limite = await quota.limite("professor");
    await prisma.iaUsoDiario.upsert({
      where: { escolaId_usuarioId_dia: { escolaId: ESCOLA, usuarioId: ids.professora, dia: new Date().toISOString().slice(0, 10) } },
      update: { tokensUsados: limite },
      create: { escolaId: ESCOLA, usuarioId: ids.professora, dia: new Date().toISOString().slice(0, 10), tokensUsados: limite },
    });
    const antes = chamadasDaIa;
    const r = await service.gerar(ESCOLA, ids.turma5A, ids.professora, "professor", recorte);
    expect(r).toMatchObject({ usouIa: false, motivo: "sem-saldo", rascunho: { origem: "padrao" } });
    expect(chamadasDaIa).toBe(antes);
    await prisma.iaUsoDiario.deleteMany({ where: { escolaId: ESCOLA } });
  });

  test("o recorte fora da régua é 400 preparo-invalido, com TODAS as frases", async () => {
    const r = await recusa(
      (async () =>
        controller.gerar(
          ids.turma5A,
          undefined,
          { ...recorte, tema: "a nota da prova de hoje foi cancelada pela escola toda", assuntos: ["só"] },
          req(ids.professora),
        ))(),
    );
    expect(r.status).toBe(400);
    expect(r.corpo).toMatchObject({ codigo: "preparo-invalido" });
    expect(r.corpo.erros).toEqual([
      "O tema passa de 8 palavras.",
      "O tema usa um termo que quebra a simulação: nota.",
      "Liste de 3 a 6 fatos da aula.",
    ]);
  });

  test("o pacote fora da régua é 400 pacote-invalido, com a lista inteira — e nada é gravado", async () => {
    const tortas = mensagensDoPadrao().map((m): MensagemDoPacote => {
      if (m.id === "msg_5") return { ...m, tipo: "texto", legenda: undefined };
      if (m.id === "msg_7") return { ...m, tipo: "link", legenda: "Alerta Web: incêndio no museu." };
      if (m.id === "msg_1") return { ...m, texto: "A atividade de hoje mudou!" };
      return m;
    });
    const r = await recusa(aprovar(ids.turma5A, ids.professora, corpoDoPreset(tortas)));
    expect(r).toMatchObject({ status: 400, corpo: { codigo: "pacote-invalido" } });
    expect(r.corpo.erros).toEqual([
      "As duas mensagens de link precisam ser uma verdadeira e uma falsa — senão o formato entrega a resposta.",
      "msg_1: usa um termo que quebra a simulação (atividade).",
    ]);
    expect(await prisma.exp05ef1bPacote.count({ where: { escolaId: ESCOLA, ativo: true } })).toBe(0);
  });

  /**
   * CRIAR NÃO PÕE NO AR (ADR-130): o pacote aprovado é uma atividade PRONTA, e
   * quem escolhe o que a turma joga é o professor ("Usar esta atividade agora").
   */
  test("aprovar: o rascunho VIRA uma atividade pronta (mesmo id); pô-la no ar abre a rodada 1, na triagem", async () => {
    const rascunho = await prisma.exp05ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma5A, aprovadoEm: null } });
    const aprovado = PacoteDoProfessorSchema.parse(await aprovar(ids.turma5A, ids.professora, corpoDoPreset()));
    expect(aprovado).toMatchObject({ id: rascunho.id, ativo: false, rodadaAtual: 1, origem: "padrao", disciplina: "letramento-digital" });
    expect(aprovado.aprovadoEm).not.toBeNull();
    pacote5A = aprovado.id;
    /* Pronta: a turma ainda espera. */
    expect((await service.sessao(ESCOLA, ids.ana)).preparada).toBe(false);
    expect(PacotesDaTurmaSchema.parse(await service.pacotes(ESCOLA, ids.turma5A, ids.professora))).toEqual({
      emAndamento: null,
      historico: [expect.objectContaining({ id: pacote5A, ativo: false, rodadas: 0 })],
    });

    const r = await service.colocarEmAndamento(ESCOLA, ids.turma5A, ids.professora, pacote5A);
    expect(r).toEqual({ atividade: { pacoteId: pacote5A, rodada: 1 }, fase: "triagem", mudou: true });
    expect(await service.colocarEmAndamento(ESCOLA, ids.turma5A, ids.professora, pacote5A)).toMatchObject({ mudou: false });
    expect(await prisma.exp05ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: ids.turma5A } } })).toMatchObject({
      fase: "triagem",
    });
  });

  test("aprovar de novo EXATAMENTE o mesmo pacote é idempotente: nenhuma atividade nova", async () => {
    const de = await aprovar(ids.turma5A, ids.professora, corpoDoPreset());
    expect(de.id).toBe(pacote5A);
    expect(await prisma.exp05ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turma5A } })).toBe(1);
  });

  test("gestor LÊ o pacote (com o gabarito, é o roteiro da aula)", async () => {
    const p = await service.pacoteDaTurma(ESCOLA, ids.turma5A);
    expect(p.ativo?.id).toBe(pacote5A);
    expect(p.rascunho).toBeNull();
    expect(chavesDeGabarito(p.ativo?.mensagens)).toHaveLength(16);
  });
});

describe("a aula na 5A — os três latches, a evidência e a revelação", () => {
  test("a sessão de quem nunca entrou: o grupo SEM gabarito, a fala da Nina com o tema, e mais nada", async () => {
    const sessao = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(sessao).toMatchObject({ passo: "abertura", preparada: true, fase: "triagem", selecao: [], revelacao: null });
    expect(sessao.atividade).toEqual({ pacoteId: pacote5A, rodada: 1 });
    expect(sessao.pacote?.grupo).toEqual({ nome: "Turma 5ºB", participantes: 4 });
    expect(sessao.textos.nina.convite).toBe(falaDaNina(PACOTE_PADRAO.tema));
    expect(sessao.textos.perguntas.map((p) => p.perguntaId)).toEqual(["p1", "p2"]);
    expect(chavesDeGabarito(sessao)).toEqual([]);
    const texto = JSON.stringify(sessao.pacote);
    for (const valor of ["verdadeira", "falsa", "emocional", "neutra"]) expect(texto).not.toContain(`"${valor}"`);
  });

  test("entrar é idempotente: o F5 não reinicia o relógio", async () => {
    expect((await service.entrar(ESCOLA, ids.ana)).passo).toBe("grupo");
    const antes = await prisma.exp05ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    await service.entrar(ESCOLA, ids.ana);
    const depois = await prisma.exp05ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(depois.entrouEm).toEqual(antes.entrouEm);
    /* A constante, e não o número: a ADR-145 subiu o instrumento para 2.3.0 e
       este teste ficou para trás, porque a suíte de Postgres não rodou. */
    expect(depois.versaoInstrumento).toBe(VERSAO_DO_INSTRUMENTO);
  });

  test("a triagem: 0 a 3 guardadas no servidor (o F5 restaura), com código para cada recusa", async () => {
    expect((await service.guardarSelecao(ESCOLA, ids.ana, ["msg_1", "msg_2"])).selecao).toEqual(["msg_1", "msg_2"]);
    expect((await service.sessao(ESCOLA, ids.ana)).selecao).toEqual(["msg_1", "msg_2"]);
    expect(await codigo(service.guardarSelecao(ESCOLA, ids.ana, ["msg_1", "msg_1"]))).toBe("selecao-repetida");
    expect(await codigo(service.guardarSelecao(ESCOLA, ids.ana, ["msg_1", "msg_2", "msg_3", "msg_4"]))).toBe("selecao-acima-do-limite");
    expect(await codigo(service.guardarSelecao(ESCOLA, ids.ana, ["msg_9"]))).toBe("mensagem-desconhecida");
    expect(await codigo(service.enviarAoMural(ESCOLA, ids.ana, ["msg_1", "msg_2"]))).toBe("selecao-incompleta");
    expect(await codigo(service.votar(ESCOLA, ids.ana, "urgencia"))).toBe("mural-nao-enviado");
    expect(await codigo(service.guardarSelecao(ESCOLA, ids.bia, ["msg_1"]))).toBe("grupo-nao-aberto");
  });

  test("se a evidência falhar, o Mural NÃO fecha — a marca e o latch são a mesma transação", async () => {
    const espiao = jest.spyOn(evidencias, "marcar").mockRejectedValueOnce(new Error("a evidência caiu"));
    await expect(service.enviarAoMural(ESCOLA, ids.ana, ["msg_1", "msg_5", "msg_3"])).rejects.toThrow("a evidência caiu");
    espiao.mockRestore();
    const sessao = await prisma.exp05ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(sessao).toMatchObject({ confirmadoEm: null, tempoFeedSegundos: null, selecao: ["msg_1", "msg_2"] });
  });

  test("o LATCH 1 fecha as três que ela VÊ, e marca a EF05CO08 na mesma transação", async () => {
    /* VE + VE + VN: três verdadeiras → atingiu. */
    const estado = EstadoSchema.parse(await service.enviarAoMural(ESCOLA, ids.ana, ["msg_1", "msg_5", "msg_3"]));
    expect(estado).toMatchObject({ passo: "enquete", confirmado: true, selecao: ["msg_1", "msg_5", "msg_3"], revelacao: null });
    expect(chavesDeGabarito(estado)).toEqual([]);

    const sessao = await prisma.exp05ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(sessao.tempoFeedSegundos).toBeGreaterThanOrEqual(0);
    const marcas = await prisma.evidenciaMarca.findMany({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(marcas.map((m) => [m.expId, m.atividadeId, m.rodada, m.marcador, m.habilidade, m.status])).toEqual([
      [EXP_ID, pacote5A, 1, "selecao-do-mural", "EF05CO08", "atingiu"],
    ]);
  });

  test("o duplo toque é idempotente; outra seleção depois do latch é 409 — e nada muda", async () => {
    expect((await service.enviarAoMural(ESCOLA, ids.ana, ["msg_3", "msg_1", "msg_5"])).confirmado).toBe(true);
    expect(await codigo(service.enviarAoMural(ESCOLA, ids.ana, ["msg_2", "msg_4", "msg_6"]))).toBe("mural-ja-enviado");
    expect(await codigo(service.guardarSelecao(ESCOLA, ids.ana, ["msg_2"]))).toBe("mural-ja-enviado");
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(1);
  });

  test("o LATCH 2: o voto — o mesmo de novo é idempotente, outro é 409; e a turma ainda em triagem = espera", async () => {
    expect((await service.votar(ESCOLA, ids.ana, "urgencia")).passo).toBe("espera");
    expect((await service.votar(ESCOLA, ids.ana, "urgencia")).motivo).toBe("urgencia");
    expect(await codigo(service.votar(ESCOLA, ids.ana, "medo_indignacao"))).toBe("enquete-ja-votada");
    /* As perguntas (a reflexão) só abrem com a fase da turma: concluir antes é 409. */
    expect(await codigo(service.concluir(ESCOLA, ids.ana))).toBe("reflexao-nao-liberada");
    /* A pergunta de evidência só abre no passo das perguntas. */
    expect(await codigo(evidencias.responder(ESCOLA, ids.ana, EXP_ID, "p1", "A1"))).toBe("sem-atividade-em-andamento");
  });

  test("equipe: Bia e Caio num computador — Bia joga (com uma falsa neutra) e o Caio recebe a CÓPIA do nível", async () => {
    /* A equipe é da ATIVIDADE (ADR-130): o pacote aprovado da 5A. */
    await equipes.salvar(
      { escolaId: ESCOLA, turmaId: ids.turma5A, expId: EXP_ID, atividadeId: pacote5A },
      { versao: 0, modo: "manual", computadores: 3, ausentes: [], equipes: [{ nome: "Equipe 1", membros: [ids.bia, ids.caio] }] },
      ids.professora,
    );
    await service.entrar(ESCOLA, ids.bia);
    /* FN + FN + VN: uma verdadeira só → não atingiu. */
    await service.enviarAoMural(ESCOLA, ids.bia, ["msg_2", "msg_6", "msg_8"]);
    await service.votar(ESCOLA, ids.bia, "confianca_remetente");
    const caio = await prisma.evidencia.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.caio, habilidade: "EF05CO08" } });
    expect(caio).toMatchObject({ status: "nao_atingiu", origem: "equipe", fonteEstudanteId: ids.bia, atividadeId: pacote5A });
  });

  test("dois toques SIMULTÂNEOS em cada latch: um latch, uma marca, e o segundo voto diferente é 409", async () => {
    await service.entrar(ESCOLA, ids.duda);
    /* VE + FE + FN: uma verdadeira → não atingiu. */
    const trio = ["msg_1", "msg_4", "msg_2"];
    const murais = await Promise.allSettled([service.enviarAoMural(ESCOLA, ids.duda, trio), service.enviarAoMural(ESCOLA, ids.duda, trio)]);
    expect(murais.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, estudanteId: ids.duda } })).toBe(1);

    const votos = await Promise.allSettled([
      service.votar(ESCOLA, ids.duda, "medo_indignacao"),
      service.votar(ESCOLA, ids.duda, "urgencia"),
    ]);
    expect(votos.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusado = votos.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect((recusado?.reason as HttpException).getResponse()).toMatchObject({ codigo: "enquete-ja-votada" });
  });

  test("o painel ANTES da revelação: só progresso, POR COMPUTADOR — e nenhum Termômetro", async () => {
    const painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma5A, ids.professora));
    expect(painel).toMatchObject({ fase: "triagem", porComputador: true, termometro: null });
    expect(painel.atividade).toEqual({ pacoteId: pacote5A, rodada: 1, tema: PACOTE_PADRAO.tema });
    /* Ana, a Equipe 1 (Bia + Caio) e a Duda: três computadores, não quatro crianças. */
    expect(painel.progresso).toEqual({ unidades: 3, entraram: 3, confirmaram: 3, votaram: 3, concluiram: 0 });
    const linhas = painel.linhas.map((l) => [l.nome, l.equipe?.membros.map((m) => m.nome) ?? null, l.passo]);
    expect(linhas).toEqual([
      ["Ana Teste", null, "espera"],
      ["Bia Teste", ["Bia Teste", "Caio Teste"], "espera"],
      ["Duda Teste", null, "espera"],
    ]);
  });

  test("antes da revelação, a sessão de quem votou continua SEM gabarito", async () => {
    const sessao = await service.sessao(ESCOLA, ids.bia);
    expect(sessao.revelacao).toBeNull();
    expect(chavesDeGabarito(sessao)).toEqual([]);
  });

  test("liberar a revelação: o Termômetro calculado de verdade, por computador", async () => {
    GateDaTurmaSchema.parse(await service.mudarGate(ESCOLA, ids.turma5A, ids.professora, "liberar_revelacao"));
    const painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma5A, ids.professora));
    /* O voto da Duda é o que ganhou a corrida do teste anterior — qualquer um dos dois. */
    const { motivo: daDuda } = await prisma.exp05ef1bSessao.findFirstOrThrow({
      where: { escolaId: ESCOLA, estudanteId: ids.duda },
      select: { motivo: true },
    });
    const urgencia = daDuda === "urgencia";
    /* Ana: 0 FN, 2 VE (urgência) · Equipe 1: 2 FN, 0 VE (confiança) · Duda: 1 FN, 1 VE. N = 3. */
    expect(painel.termometro).toEqual({
      unidades: 3,
      falsaNeutra: { unidades: 2, percentual: 67 },
      verdadeiraEmocionalDescartada: { descartadas: 3, total: 6, percentual: 50 },
      motivos: [
        { motivo: "urgencia", unidades: urgencia ? 2 : 1, comFalsaNeutra: urgencia ? 1 : 0 },
        { motivo: "confianca_remetente", unidades: 1, comFalsaNeutra: 1 },
        { motivo: "medo_indignacao", unidades: urgencia ? 0 : 1, comFalsaNeutra: urgencia ? 0 : 1 },
        { motivo: "imagem_link_real", unidades: 0, comFalsaNeutra: 0 },
      ],
    });
    expect(JSON.stringify(painel.termometro)).not.toContain("Teste");
  });

  test("a revelação da Ana: o gabarito SÓ das três dela, o callback do motivo e as duas barras da turma", async () => {
    const sessao = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(sessao.passo).toBe("revelacao");
    expect(sessao.revelacao).toEqual({
      mensagens: [
        { id: "msg_1", veracidade: "verdadeira", tom: "emocional" },
        { id: "msg_5", veracidade: "verdadeira", tom: "emocional" },
        { id: "msg_3", veracidade: "verdadeira", tom: "neutra" },
      ],
      motivo: "urgencia",
      callback: "Vocês já aprenderam essa: não deixar a pressa decidir por você.",
      turma: { unidades: 3, falsaNeutra: 67, verdadeiraEmocionalDescartada: 50 },
    });
    /* O pacote continua SEM gabarito: ele só existe em `revelacao`. */
    expect(chavesDeGabarito(sessao.pacote)).toEqual([]);
  });

  test("a fase só anda para a frente: síntese, e a revelação de novo não volta", async () => {
    await service.mudarGate(ESCOLA, ids.turma5A, ids.professora, "apresentar_sintese");
    expect((await service.mudarGate(ESCOLA, ids.turma5A, ids.professora, "liberar_revelacao")).fase).toBe("explicar");
    expect((await service.gate(ESCOLA, ids.ana)).passo).toBe("sintese");
  });

  test("liberar a reflexão leva direto às perguntas: elas SÃO a reflexão (ADR-145)", async () => {
    await service.mudarGate(ESCOLA, ids.turma5A, ids.professora, "liberar_reflexao");
    expect((await service.gate(ESCOLA, ids.ana)).passo).toBe("perguntas");
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana)).passo).toBe("perguntas");
    /* A regra Se/Então saiu: nenhuma rota escreve mais na tabela, que só guarda o que já foi escrito. */
    expect(await prisma.exp05ef1bReflexao.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("as perguntas de evidência: embaralhadas, sem nível, e a resposta cai na atividade e na rodada da missão", async () => {
    const p1 = await evidencias.pergunta(ESCOLA, ids.ana, EXP_ID, "p1");
    expect(p1.enunciado).toBe("Você concorda?");
    expect(p1.alternativas.map((a) => a.id).sort()).toEqual(["A1", "A2", "A3"]);
    expect(JSON.stringify(p1)).not.toContain("status");
    expect(await evidencias.responder(ESCOLA, ids.ana, EXP_ID, "p1", "A1")).toEqual({ enviada: true });
    expect(await evidencias.responder(ESCOLA, ids.ana, EXP_ID, "p2", "B2")).toEqual({ enviada: true });
    const marcas = await prisma.evidenciaMarca.findMany({
      where: { escolaId: ESCOLA, estudanteId: ids.ana },
      orderBy: { habilidade: "asc" },
    });
    expect(marcas.map((m) => [m.habilidade, m.marcador, m.status, m.atividadeId, m.rodada])).toEqual([
      ["EF05CO03", "pergunta-tom-e-veracidade", "atingiu", pacote5A, 1],
      ["EF05CO04", "pergunta-regra-condicional", "em_processo", pacote5A, 1],
      ["EF05CO08", "selecao-do-mural", "atingiu", pacote5A, 1],
    ]);
  });

  test("concluir fecha as perguntas: depois dele a resposta é 409, e quem pulou fica Não avaliado", async () => {
    /* O Caio recebeu a cópia da equipe e nunca abriu o grupo: não há o que concluir. */
    expect(await codigo(service.concluir(ESCOLA, ids.caio))).toBe("grupo-nao-aberto");
    expect((await service.concluir(ESCOLA, ids.ana)).passo).toBe("concluida");
    expect((await service.concluir(ESCOLA, ids.ana)).concluido).toBe(true);
    expect(await codigo(evidencias.responder(ESCOLA, ids.ana, EXP_ID, "p2", "B1"))).toBe("sem-atividade-em-andamento");
  });

  test("a folha não tem mais texto livre de menor: a linha é a mesma para professor e gestor", async () => {
    const daProfessora = PainelSchema.parse(await service.painel(ESCOLA, ids.turma5A, ids.professora));
    const doGestor = PainelSchema.parse(await service.painel(ESCOLA, ids.turma5A));
    const linhaDaAna = (p: typeof daProfessora) => p.linhas.find((l) => l.estudanteId === ids.ana);
    expect(linhaDaAna(doGestor)).toEqual(linhaDaAna(daProfessora));
    expect(linhaDaAna(doGestor)).toMatchObject({ passo: "concluida", motivo: "urgencia", selecao: ["msg_1", "msg_5", "msg_3"] });
    expect(Object.keys(linhaDaAna(doGestor) ?? {})).not.toContain("reflexao");
  });
});

describe("a rodada nova e o pacote novo — o histórico fica", () => {
  test("zerar a turma abre a rodada 2 do MESMO pacote; o duplo clique não pula a 3; rodada velha é 409", async () => {
    expect(await service.novaRodada(ESCOLA, ids.turma5A, ids.professora, 1)).toEqual({
      atividade: { pacoteId: pacote5A, rodada: 2 },
      fase: "triagem",
    });
    expect(await service.novaRodada(ESCOLA, ids.turma5A, ids.professora, 1)).toEqual({
      atividade: { pacoteId: pacote5A, rodada: 2 },
      fase: "triagem",
    });
    expect(await codigo(service.novaRodada(ESCOLA, ids.turma5A, ids.professora, 5))).toBe("rodada-desatualizada");
  });

  test("a Ana recomeça do zero na rodada 2, e a rodada 1 continua no banco — sessão, regra e evidência", async () => {
    const sessao = await service.sessao(ESCOLA, ids.ana);
    expect(sessao).toMatchObject({ passo: "abertura", atividade: { pacoteId: pacote5A, rodada: 2 }, selecao: [] });
    await service.entrar(ESCOLA, ids.ana);
    await service.enviarAoMural(ESCOLA, ids.ana, ["msg_2", "msg_6", "msg_4"]);
    expect(await prisma.exp05ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(2);
    /* Toda rodada mede de novo, também no MESMO pacote (ADR-145): as três
       falsas da Ana marcam "não atingiu" na rodada 2, e o resultado continua
       "atingiu", porque é a melhor rodada da habilidade. */
    expect((await prisma.exp05ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana, rodada: 2 } })).confirmadoEm).not.toBeNull();
    expect(
      await prisma.evidencia.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana, habilidade: "EF05CO08", rodada: 2 } }),
    ).toMatchObject({ origem: "propria", status: "nao_atingiu" });
    const painel = await evidencias.painel(ESCOLA, ids.turma5A, EXP_ID, pacote5A, ids.professora);
    expect(painel.estudantes.find((e) => e.id === ids.ana)?.resultado).toMatchObject({ EF05CO08: "atingiu" });
  });

  test("rodada 2 do MESMO pacote: quem recebeu pela equipe na 1 é medido de novo, e o resultado sobe", async () => {
    await service.entrar(ESCOLA, ids.caio);
    await service.enviarAoMural(ESCOLA, ids.caio, ["msg_1", "msg_3", "msg_5"]);
    expect(
      await prisma.evidencia.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.caio, habilidade: "EF05CO08", rodada: 2 } }),
    ).toMatchObject({ origem: "propria", status: "atingiu" });
    expect(
      await prisma.evidencia.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.caio, habilidade: "EF05CO08", rodada: 1 } }),
    ).toMatchObject({ origem: "equipe", status: "nao_atingiu" });
    const painel = await evidencias.painel(ESCOLA, ids.turma5A, EXP_ID, pacote5A, ids.professora);
    expect(painel.estudantes.find((e) => e.id === ids.caio)?.resultado).toMatchObject({ EF05CO08: "atingiu" });
  });

  test("rodada 2 do MESMO pacote: quem faltou na 1 é medida quando joga", async () => {
    /* A Gabi entra na turma DEPOIS da rodada 1 — é quem faltou. A limpeza do
       fim da suíte é por escola, e a leva junto. */
    const gabi = (
      await prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA, turmaId: ids.turma5A, username: "qmv2.gabi", displayName: "Gabi Teste", passwordHash: "x" },
        select: { id: true },
      })
    ).id;
    await service.entrar(ESCOLA, gabi);
    /* VE + VN + FE: uma falsa → em processo, na régua v2 (na v1 seria atingiu). */
    await service.enviarAoMural(ESCOLA, gabi, ["msg_1", "msg_3", "msg_7"]);
    expect(
      await prisma.evidencia.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: gabi, habilidade: "EF05CO08" } }),
    ).toMatchObject({ rodada: 2, origem: "propria", status: "em_processo", atividadeId: pacote5A });
  });

  test("aprovar um pacote DIFERENTE é atividade nova e PRONTA: a aula de agora segue até o professor trocar", async () => {
    await service.mudarGate(ESCOLA, ids.turma5A, ids.professora, "liberar_revelacao");
    const editadas = mensagensDoPadrao().map((m) =>
      m.id === "msg_8" ? { ...m, texto: "Informo que os monitores da exposição aguardam o 5º ano no saguão principal." } : m,
    );
    const novo = await aprovar(ids.turma5A, ids.professora, corpoDoPreset(editadas));
    expect(novo.id).not.toBe(pacote5A);
    expect(novo).toMatchObject({ ativo: false, rodadaAtual: 1 });
    /* Criar não mexe na aula de agora: o anterior segue no ar, com a revelação aberta. */
    expect((await service.gate(ESCOLA, ids.ana)).fase).toBe("revelacao");
    expect((await service.sessao(ESCOLA, ids.ana)).atividade).toEqual({ pacoteId: pacote5A, rodada: 2 });

    expect(await service.colocarEmAndamento(ESCOLA, ids.turma5A, ids.professora, novo.id)).toEqual({
      atividade: { pacoteId: novo.id, rodada: 1 },
      fase: "triagem",
      mudou: true,
    });
    expect(await prisma.exp05ef1bPacote.findUniqueOrThrow({ where: { id: pacote5A } })).toMatchObject({ ativo: false, rodadaAtual: 2 });
    expect((await service.gate(ESCOLA, ids.ana)).fase).toBe("triagem");
    expect((await service.sessao(ESCOLA, ids.ana)).atividade).toEqual({ pacoteId: novo.id, rodada: 1 });
    /* O que a turma fez no pacote anterior continua lá. */
    /* Ana, Bia e Duda na rodada 1; Ana, Caio e Gabi na 2. */
    expect(await prisma.exp05ef1bSessao.count({ where: { escolaId: ESCOLA, pacoteId: pacote5A } })).toBe(6);
    const lista = PacotesDaTurmaSchema.parse(await service.pacotes(ESCOLA, ids.turma5A, ids.professora));
    expect(lista.emAndamento).toEqual({ pacoteId: novo.id, rodada: 1 });
    expect(lista.historico.map((p) => [p.id, p.ativo, p.rodadas])).toEqual([
      /* Ler a sessão não a cria: quem cria é o `entrar`. */
      [novo.id, true, 0],
      [pacote5A, false, 2],
    ]);
    expect(await service.pacote(ESCOLA, ids.turma5A, ids.professora, pacote5A)).toMatchObject({ ativo: false, rodadas: 2 });

    /* Voltar ao anterior, que rodou duas rodadas, abre a TERCEIRA. */
    expect(await service.colocarEmAndamento(ESCOLA, ids.turma5A, ids.professora, pacote5A)).toMatchObject({
      atividade: { pacoteId: pacote5A, rodada: 3 },
      mudou: true,
    });
    expect(await prisma.exp05ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turma5A, ativo: true } })).toBe(1);
    /* E o novo volta ao ar — o `pacote5A` fica PRONTO para os CHECKs abaixo. */
    await service.colocarEmAndamento(ESCOLA, ids.turma5A, ids.professora, novo.id);
  });

  test("o rascunho e o pacote de outra turma não são atividade daqui: 404", async () => {
    const daVizinha = await aprovar(ids.turmaVizinha, ids.profVizinho, corpoDoPreset(), OUTRA_ESCOLA);
    expect(await codigo(service.pacote(ESCOLA, ids.turma5A, ids.professora, daVizinha.id))).toBe("atividade-nao-encontrada");
    expect(await codigo(service.colocarEmAndamento(ESCOLA, ids.turma5A, ids.professora, daVizinha.id))).toBe(
      "atividade-nao-encontrada",
    );
    const { rascunho } = await service.gerar(ESCOLA, ids.turma5A, ids.professora, "professor", {
      disciplina: "ciencias",
      tema: "a feira de livros",
      assuntos: ["um", "dois", "três"],
    });
    expect(await codigo(service.colocarEmAndamento(ESCOLA, ids.turma5A, ids.professora, rascunho.id))).toBe(
      "atividade-nao-encontrada",
    );
  });
});

describe("tenancy no banco (regra 1)", () => {
  beforeAll(async () => {
    /* A vizinha com linha nas QUATRO tabelas — a desta escola já tem. */
    const aprovado = await aprovar(ids.turmaVizinha, ids.profVizinho, corpoDoPreset(), OUTRA_ESCOLA);
    await service.colocarEmAndamento(OUTRA_ESCOLA, ids.turmaVizinha, ids.profVizinho, aprovado.id);
    await service.entrar(OUTRA_ESCOLA, ids.vizinho);
    await service.enviarAoMural(OUTRA_ESCOLA, ids.vizinho, ["msg_1", "msg_3", "msg_8"]);
    await service.votar(OUTRA_ESCOLA, ids.vizinho, "urgencia");
    await service.mudarGate(OUTRA_ESCOLA, ids.turmaVizinha, ids.profVizinho, "liberar_reflexao");
    /* A tabela da regra Se/Então guarda o que foi escrito antes da ADR-145, e
       nenhuma rota escreve mais nela: as duas escolas ganham uma linha DIRETO,
       para a RLS continuar provada sobre ela. */
    await reflexaoHistorica(OUTRA_ESCOLA, ids.vizinho, aprovado.id);
    await reflexaoHistorica(ESCOLA, ids.ana, pacote5A);
  });

  test("as quatro tabelas têm RLS habilitada E forçada, com UMA política por escola", async () => {
    for (const tabela of TABELAS) {
      const [linha] = await prisma.$queryRawUnsafe<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${tabela}'`,
      );
      expect({ tabela, ...linha }).toEqual({ tabela, relrowsecurity: true, relforcerowsecurity: true });
      const politicas = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tabela}'`,
      );
      expect(politicas.map((p) => p.policyname)).toEqual([`${tabela}_por_escola`]);
    }
  });

  test("a RLS isola DE VERDADE: com a escola de cá armada, a de lá SOME — o gabarito e o texto do menor inclusive", async () => {
    const ler = (escolaId: string) =>
      runtime.comTenancy(
        async (tx) => ({
          pacotes: await tx.exp05ef1bPacote.findMany({ select: { escolaId: true } }),
          gates: await tx.exp05ef1bGateTurma.findMany({ select: { escolaId: true } }),
          sessoes: await tx.exp05ef1bSessao.findMany({ select: { escolaId: true } }),
          reflexoes: await tx.exp05ef1bReflexao.findMany({ select: { escolaId: true } }),
        }),
        escolaId,
      );
    for (const escolaId of ESCOLAS) {
      const visto = await ler(escolaId);
      for (const [tabela, linhas] of Object.entries(visto)) {
        expect({ escolaId, tabela, tem: linhas.length > 0, soDaqui: linhas.every((l) => l.escolaId === escolaId) }).toEqual({
          escolaId,
          tabela,
          tem: true,
          soDaqui: true,
        });
      }
    }
  });

  test("sem tenancy armada, a role de runtime não vê linha nenhuma", async () => {
    for (const tabela of TABELAS) {
      const [n] = await runtime.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${tabela}`);
      expect({ tabela, n: Number(n?.n) }).toEqual({ tabela, n: 0 });
    }
  });
});

describe("os CHECKs recusam o que dizem recusar", () => {
  const sessaoDaAna = () => `escola_id = '${ESCOLA}' AND estudante_id = '${ids.ana}'::uuid AND rodada = 1`;

  test.each([
    ["seleção com 4", `UPDATE exp05ef1b_sessoes SET selecao = ARRAY['msg_1','msg_2','msg_3','msg_4'] WHERE {S}`],
    ["id fora do grupo", `UPDATE exp05ef1b_sessoes SET selecao = ARRAY['msg_9'] WHERE {S}`],
    ["Mural confirmado com 2", `UPDATE exp05ef1b_sessoes SET selecao = ARRAY['msg_1','msg_2'] WHERE {S}`],
    ["seleção nula", `UPDATE exp05ef1b_sessoes SET selecao = NULL WHERE {S}`],
    ["motivo fora do vocabulário", `UPDATE exp05ef1b_sessoes SET motivo = 'preguica' WHERE {S}`],
    ["voto sem carimbo", `UPDATE exp05ef1b_sessoes SET votou_em = NULL WHERE {S}`],
    ["voto sem o Mural", `UPDATE exp05ef1b_sessoes SET confirmado_em = NULL, tempo_feed_segundos = NULL WHERE {S}`],
    ["regra sem o voto", `UPDATE exp05ef1b_sessoes SET reflexao_em = now(), motivo = NULL, votou_em = NULL, concluido_em = NULL WHERE {S}`],
    ["concluída sem o voto", `UPDATE exp05ef1b_sessoes SET motivo = NULL, votou_em = NULL WHERE {S}`],
    ["tempo de feed negativo", `UPDATE exp05ef1b_sessoes SET tempo_feed_segundos = -1 WHERE {S}`],
    ["Então de espaços", `UPDATE exp05ef1b_reflexoes SET acao_entao = '                    ' WHERE {S}`],
    ["Então curto", `UPDATE exp05ef1b_reflexoes SET acao_entao = 'curto demais' WHERE {S}`],
    ["condição fora do vocabulário", `UPDATE exp05ef1b_reflexoes SET condicional_se = 'sempre' WHERE {S}`],
  ])("sessão/reflexão: %s", async (_nome, sql) => {
    await expect(prisma.$executeRawUnsafe(sql.replace("{S}", sessaoDaAna()))).rejects.toThrow();
  });

  test.each([
    ["disciplina fora do vocabulário", `UPDATE exp05ef1b_pacotes SET disciplina = 'alquimia' WHERE id = '{P}'::uuid`],
    ["tema de 9 palavras", `UPDATE exp05ef1b_pacotes SET tema = 'um dois tres quatro cinco seis sete oito nove' WHERE id = '{P}'::uuid`],
    ["tema de espaços", `UPDATE exp05ef1b_pacotes SET tema = '     ' WHERE id = '{P}'::uuid`],
    ["2 fatos", `UPDATE exp05ef1b_pacotes SET assuntos = ARRAY['um','dois'] WHERE id = '{P}'::uuid`],
    ["7 mensagens", `UPDATE exp05ef1b_pacotes SET mensagens_json = (mensagens_json - 0) WHERE id = '{P}'::uuid`],
    ["origem inventada", `UPDATE exp05ef1b_pacotes SET origem = 'importado' WHERE id = '{P}'::uuid`],
    ["ativo sem aprovação", `UPDATE exp05ef1b_pacotes SET aprovado_em = NULL, aprovado_por = NULL, ativo = true, rodada_atual = 1 WHERE id = '{P}'::uuid`],
    ["aprovação sem autor", `UPDATE exp05ef1b_pacotes SET aprovado_por = NULL WHERE id = '{P}'::uuid`],
    ["dois ativos na turma", `UPDATE exp05ef1b_pacotes SET ativo = true WHERE id = '{P}'::uuid`],
  ])("pacote: %s", async (_nome, sql) => {
    await expect(prisma.$executeRawUnsafe(sql.replace("{P}", pacote5A))).rejects.toThrow();
  });

  test("fase fora do vocabulário", async () => {
    await expect(
      prisma.$executeRawUnsafe(`UPDATE exp05ef1b_gates_turma SET fase = 'intervalo' WHERE escola_id = '${ESCOLA}'`),
    ).rejects.toThrow();
  });

  /** O par que já custou um deploy em `permissoes`: o vocabulário do código e o do CHECK. */
  test("o vocabulário dos CHECKs é EXATAMENTE o do código", async () => {
    const def = async (nome: string) => {
      const [linha] = await prisma.$queryRawUnsafe<{ def: string }[]>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = '${nome}'`,
      );
      return [...(linha?.def ?? "").matchAll(/'([^']+)'::text/g)].map((m) => m[1]);
    };
    expect(await def("exp05ef1b_pacotes_disciplina_check")).toEqual([...DISCIPLINAS]);
    expect(await def("exp05ef1b_pacotes_origem_check")).toEqual([...ORIGENS]);
    expect(await def("exp05ef1b_sessoes_motivo_check")).toEqual([...MOTIVOS]);
    expect(await def("exp05ef1b_reflexoes_condicional_check")).toEqual([...CONDICOES]);
    expect(await def("exp05ef1b_gates_turma_fase_check")).toEqual([...FASES]);
  });
});

describe("o guia da aula", () => {
  test("o banco curado COM gabarito e as perguntas de evidência COM o nível — para quem dá aula", () => {
    const m = MaterialSchema.parse(service.material());
    expect(m.padrao.convite).toBe(falaDaNina(PACOTE_PADRAO.tema));
    expect(m.perguntasDeEvidencia.map((p) => [p.perguntaId, p.habilidade])).toEqual([
      ["p1", "EF05CO03"],
      ["p2", "EF05CO04"],
    ]);
    expect(m.perguntasDeEvidencia[0]?.alternativas[0]).toMatchObject({ id: "A1", status: "atingiu" });
    expect(m.roteiro.perguntas).toHaveLength(3);
  });
});
