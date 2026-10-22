import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import type { AuthClaims } from "../src/auth/claims";
import { EXP_ID, PACOTE_PADRAO, conteudoDoPadrao } from "../src/efeito-amplificador/conteudo";
import {
  EstadoSchema,
  GateDoEstudanteSchema,
  GerarRespostaSchema,
  PacoteDaTurmaSchema,
  PainelSchema,
  SessaoSchema,
} from "../src/efeito-amplificador/contrato-de-rotas";
import { EfeitoAmplificadorTurmasController } from "../src/efeito-amplificador/efeito-amplificador-turmas.controller";
import { ConversaDaExp02em1bService } from "../src/efeito-amplificador/conversa.service";
import { EfeitoAmplificadorService } from "../src/efeito-amplificador/efeito-amplificador.service";
import { PreparoDaExp02em1bService } from "../src/efeito-amplificador/preparo.service";
import { SYSTEM_DA_CONVERSA } from "../src/efeito-amplificador/prompts-da-conversa";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O Efeito Amplificador (exp02em1b, ADR-181) no Postgres: o que só o banco
 * responde.
 *
 * A porta da sala em TODA rota de estudante, a missão que nasce vazia, o
 * preparo com a quota (e o 404 antes de gastar token), a régua da homologação,
 * o caminho curto do banco padrão, o LATCH com as marcas da EM13CO14 e da
 * EM13CO26 na MESMA transação, o gabarito ausente da saída do estudante, a
 * pausa do professor, o feed que fecha no Explicar marcando a EM13CO24 e a
 * EM13CO08, o painel sem o texto do menor, a RLS com a role sem `BYPASSRLS` e o
 * zerar que apaga a evidência e guarda as sessões.
 *
 * Os testes dependem da ORDEM: é a aula, na sequência em que ela acontece.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-efeito-amplificador";
const OUTRA_ESCOLA = "teste-efeito-amplificador-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/**
 * A IA de mentira. No PREPARO, escreve o banco padrão no formato do modelo, ou
 * falha. Na CONVERSA da aula, devolve `respostaDaConversa` pelo `validar` de
 * verdade (os guardrails correm), demora, ou está fora — o padrão, para os
 * testes da aula provarem a RESERVA (a árvore de intenções).
 */
let modoDaIa: "escreve" | "falha" = "escreve";
let chamadasDaIa = 0;
let respostaDaConversa: { intencao: string; resposta: string } | "fora" | "lenta" = "fora";
let chamadasDaConversa = 0;
let ultimoPromptDaConversa = "";
const ia = {
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    if (req.system === SYSTEM_DA_CONVERSA) {
      chamadasDaConversa += 1;
      ultimoPromptDaConversa = req.prompt;
      if (respostaDaConversa === "fora") throw new Error("vendor fora do ar");
      if (respostaDaConversa === "lenta") await new Promise((r) => setTimeout(r, 300));
      req.aoUsarTokens?.(120);
      return req.validar(respostaDaConversa === "lenta" ? { intencao: "fora_do_tema", resposta: "Tarde demais." } : respostaDaConversa);
    }
    chamadasDaIa += 1;
    if (modoDaIa === "falha") throw new Error("vendor fora do ar");
    req.aoUsarTokens?.(900);
    const c = conteudoDoPadrao();
    return req.validar({ ...c, rascunho: c.rascunho.map((p) => ({ ...p, no: p.no ?? "" })) });
  },
} as unknown as AiProvider;

const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
const quota = new QuotaService(prisma);
const preparo = new PreparoDaExp02em1bService(ia, quota);
const service = new EfeitoAmplificadorService(prisma, evidencias, preparo, new ConversaDaExp02em1bService(ia, quota));
/* Dois serviços de reserva: sem saldo (a IA nem é chamada) e com prazo de 30 ms (a IA lenta perde). */
const semSaldo = { temSaldo: async () => false, consumir: async () => undefined } as unknown as QuotaService;
const servicoSemSaldo = new EfeitoAmplificadorService(prisma, evidencias, preparo, new ConversaDaExp02em1bService(ia, semSaldo));
const servicoComPrazoCurto = new EfeitoAmplificadorService(prisma, evidencias, preparo, new ConversaDaExp02em1bService(ia, quota, 30));
const controller = new EfeitoAmplificadorTurmasController(service);
evidencias.onModuleInit();

const ids = { turmaA: "", turmaB: "", turmaC: "", turmaVizinha: "", prof: "", profB: "", ana: "", bia: "", caio: "", duda: "", eva: "", fe: "", fabi: "", vizinho: "" };
const TEXTO_DE_MENOR = "isso é plágio do jornal? coloca aspas e dá crédito";

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp02em1bGateHistorico.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp02em1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp02em1bGateTurma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
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

async function nivel(estudanteId: string, marcador: string) {
  const m = await prisma.evidenciaMarca.findFirst({ where: { escolaId: ESCOLA, expId: EXP_ID, estudanteId, marcador } });
  return m?.status ?? null;
}

function corpoDoPadrao() {
  return {
    disciplina: PACOTE_PADRAO.disciplina,
    tema: PACOTE_PADRAO.tema,
    assuntos: [...PACOTE_PADRAO.assuntos],
    contexto: null,
    origem: "padrao",
    conteudo: conteudoDoPadrao(),
  };
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Efeito Amplificador (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  ids.turmaA = (await criarTurmaDeTeste(prisma, ESCOLA, "2EM-A", "2EM")).id;
  ids.turmaB = (await criarTurmaDeTeste(prisma, ESCOLA, "2EM-B", "2EM")).id;
  ids.turmaC = (await criarTurmaDeTeste(prisma, ESCOLA, "2EM-C", "2EM")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "2EM vizinha", "2EM")).id;
  const pessoa = (escolaId: string, turmaId: string | null, username: string, nome: string, role = "estudante") =>
    prisma.user
      .create({ data: { role, escolaId, turmaId, username, displayName: nome, passwordHash: "x" }, select: { id: true } })
      .then((u) => u.id);
  ids.ana = await pessoa(ESCOLA, ids.turmaA, "ea.ana", "Ana Teste");
  ids.bia = await pessoa(ESCOLA, ids.turmaA, "ea.bia", "Bia Teste");
  ids.caio = await pessoa(ESCOLA, ids.turmaB, "ea.caio", "Caio Teste");
  ids.duda = await pessoa(ESCOLA, ids.turmaB, "ea.duda", "Duda Teste");
  ids.eva = await pessoa(ESCOLA, ids.turmaB, "ea.eva", "Eva Teste");
  ids.fe = await pessoa(ESCOLA, ids.turmaB, "ea.fe", "Fe Teste");
  ids.fabi = await pessoa(ESCOLA, ids.turmaC, "ea.fabi", "Fabi Teste");
  ids.vizinho = await pessoa(OUTRA_ESCOLA, ids.turmaVizinha, "ea.vizinho", "Vizinho Teste");
  ids.prof = await pessoa(ESCOLA, null, "ea.marta", "Marta Teste", "professor");
  ids.profB = await pessoa(ESCOLA, null, "ea.rui", "Rui Teste", "professor");
  const lecionar = (turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: { escolaId: ESCOLA, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
    });
  await lecionar(ids.turmaA, ids.prof);
  await lecionar(ids.turmaB, ids.profB);
  /* A PORTA DA SALA: a 2EM-C fica SEM liberação, de propósito. */
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
    for (const chamada of [
      () => service.sessao(ESCOLA, ids.fabi),
      () => service.gate(ESCOLA, ids.fabi),
      () => service.entrar(ESCOLA, ids.fabi),
      () => service.mensagem(ESCOLA, ids.fabi, "monte o post"),
      () => service.paragrafo(ESCOLA, ids.fabi, "p1", true),
      () => service.publicar(ESCOLA, ids.fabi, "neutra"),
      () => service.acaoNoFeed(ESCOLA, ids.fabi, { acao: "ajuda" }),
      () => service.abrirExplicar(ESCOLA, ids.fabi),
      () => service.apontarIndicador(ESCOLA, ids.fabi, "retencao"),
      () => service.concluir(ESCOLA, ids.fabi),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 403, corpo: { codigo: "missao-nao-liberada" } });
    }
  });

  test("estudante de OUTRA escola: 404", async () => {
    expect(await recusa(service.sessao(ESCOLA, ids.vizinho))).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
  });
});

describe("a missão nasce VAZIA", () => {
  test("sem pacote no ar: espera, e entrar é 409; os botões do professor também esperam", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s).toMatchObject({ passo: "abertura", preparada: false, fase: null, tema: null });
    expect(s.textos.abertura).toBeNull();
    expect(await codigo(service.entrar(ESCOLA, ids.ana))).toBe("campanha-em-preparo");
    expect(await codigo(service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "pausar"))).toBe("pacote-nao-aprovado");
  });
});

describe("o preparo do professor", () => {
  test("404, nunca 403, na turma que não leciona — e o gerar não gasta token antes", async () => {
    const antes = chamadasDaIa;
    for (const chamada of [
      () => service.pacoteDaTurma(ESCOLA, ids.turmaB, ids.prof),
      () => service.gerar(ESCOLA, ids.turmaB, ids.prof, "professor", { disciplina: "biologia", tema: "Telas e sono", assuntos: ["a1", "b2", "c3"] }),
      () => service.usarBancoPadrao(ESCOLA, ids.turmaB, ids.prof),
      () => service.painel(ESCOLA, ids.turmaB, ids.prof),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
    }
    expect(chamadasDaIa).toBe(antes);
  });

  test("gerar com IA grava UM rascunho (origem ia), conta a geração e debita a quota", async () => {
    const r = GerarRespostaSchema.parse(
      await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", {
        disciplina: "biologia",
        tema: "Impacto das Telas no Sono",
        assuntos: ["Luz azul", "Privação de sono", "Retenção comercial"],
      }),
    );
    expect(r).toMatchObject({ usouIa: true, motivo: null, rascunho: { origem: "ia", tema: "Impacto das Telas no Sono", aprovadoEm: null } });
    const linha = await prisma.exp02em1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } });
    expect(linha).toMatchObject({ iaGeracoes: 1, iaTokens: 900 });
    expect(await prisma.iaUsoDiario.count({ where: { escolaId: ESCOLA, usuarioId: ids.prof } })).toBeGreaterThan(0);
  });

  test("com o vendor fora, o rascunho sai do banco curado — e continua um só", async () => {
    modoDaIa = "falha";
    const r = await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "historia", tema: "Memória", assuntos: ["a1", "b2", "c3"] });
    modoDaIa = "escreve";
    expect(r).toMatchObject({ usouIa: false, motivo: "indisponivel", rascunho: { origem: "padrao", tema: PACOTE_PADRAO.tema } });
    expect(await prisma.exp02em1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } })).toBe(1);
  });

  test("a homologação cobra a régua inteira (400 pacote-invalido com TODAS as frases)", async () => {
    const corpo = corpoDoPadrao();
    corpo.conteudo.comentarios = corpo.conteudo.comentarios.map((c) => ({ ...c, tipo: "neutro" as const }));
    const r = await recusa(() => controller.homologar(ids.turmaA, undefined, corpo, req(ids.prof)));
    expect(r).toMatchObject({ status: 400, corpo: { codigo: "pacote-invalido" } });
    expect((r.corpo.erros as string[]).join(" ")).toMatch(/saúde física[\s\S]*saúde mental/);
  });

  test("homologar o banco padrão vira atividade PRONTA (não no ar); de novo, o mesmo pacote", async () => {
    const um = await controller.homologar(ids.turmaA, undefined, corpoDoPadrao(), req(ids.prof));
    const dois = await controller.homologar(ids.turmaA, undefined, corpoDoPadrao(), req(ids.prof));
    expect(dois.id).toBe(um.id);
    expect(um).toMatchObject({ ativo: false, origem: "padrao" });
    const r = await service.colocarEmAndamento(ESCOLA, ids.turmaA, ids.prof, um.id);
    expect(r).toMatchObject({ mudou: true, fase: "aberta", atividade: { pacoteId: um.id, rodada: 1 } });
    expect(PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turmaA, ids.prof)).ativo?.id).toBe(um.id);
  });

  test("o caminho curto: banco padrão homologado E no ar, num toque", async () => {
    const r = await service.usarBancoPadrao(ESCOLA, ids.turmaB, ids.profB);
    expect(r).toMatchObject({ mudou: true, fase: "aberta" });
    expect((await service.usarBancoPadrao(ESCOLA, ids.turmaB, ids.profB)).mudou).toBe(false);
  });
});

describe("a aula: o UnooriaAI e o latch", () => {
  test("a abertura é a fala do PO com o tema do pacote", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s.textos.abertura).toBe(
      `Olá, vamos montar seu post para ${PACOTE_PADRAO.tema}, você pode me pedir para montar o post, questionar minhas fontes e perguntar sobre direito digital. Vamos começar?`,
    );
  });

  test("antes do rascunho, pedir a fonte responde que ainda não há post — e a prévia não muda", async () => {
    await service.entrar(ESCOLA, ids.ana);
    const e = EstadoSchema.parse(await service.mensagem(ESCOLA, ids.ana, "qual a fonte?"));
    expect(e.previa?.gerada).toBe(false);
    expect(e.conversa.mensagens.at(-1)?.texto).toMatch(/Ainda não montei o post/);
    expect(e.conversa.restantes).toBe(4);
  });

  test("a Ana audita: gera, pergunta a fonte, aceita a substituição e pede o crédito e a anonimização", async () => {
    await service.mensagem(ESCOLA, ids.ana, "monte o post");
    const fonte = EstadoSchema.parse(await service.mensagem(ESCOLA, ids.ana, "esse DataBrasil existe?"));
    expect(fonte.conversa.mensagens.at(-1)?.texto).toMatch(/não possuo registros de verificação do DataBrasil 2026/);
    await service.mensagem(ESCOLA, ids.ana, "sim");
    const e = EstadoSchema.parse(await service.mensagem(ESCOLA, ids.ana, TEXTO_DE_MENOR));
    expect(e.conversa.restantes).toBe(0);
    expect(e.conversa.mensagens.at(-1)?.texto).toMatch(/Atingimos o limite/);
    expect(await codigo(service.mensagem(ESCOLA, ids.ana, "tira o Lucas"))).toBe("limite-do-chat");
    /* O colega sai pela mão dela, na prévia. */
    const lgpd = conteudoDoPadrao().rascunho.find((p) => p.no === "lgpd")!;
    const depois = EstadoSchema.parse(await service.paragrafo(ESCOLA, ids.ana, lgpd.id, true));
    expect(depois.previa?.paragrafos.find((p) => p.id === lgpd.id)?.removido).toBe(true);
  });

  test("a saída do estudante não carrega o gabarito (nó, categoria de saúde, comprova)", async () => {
    const s = JSON.stringify(await service.sessao(ESCOLA, ids.ana));
    expect(s).not.toMatch(/"no":|"tipo":|"comprova":|"corrigido":"[A-Z]/);
  });

  test("PUBLICAR é o latch: as marcas da EM13CO14 e da EM13CO26 na mesma transação, e o trecho pinçado é o recorte", async () => {
    const e = EstadoSchema.parse(await service.publicar(ESCOLA, ids.ana, "neutra"));
    expect(e.passo).toBe("feed");
    expect(e.publicacao?.trechoPincado).toBe(conteudoDoPadrao().recorte);
    expect(e.publicacao?.texto).not.toContain("Lucas Mendonça");
    expect(await nivel(ids.ana, "auditoria-da-fonte")).toBe("atingiu");
    expect(await nivel(ids.ana, "direito-digital-no-post")).toBe("atingiu");
    /* O duplo toque é idempotente; outra manchete, 409. Depois do latch, o chat fecha. */
    expect(EstadoSchema.parse(await service.publicar(ESCOLA, ids.ana, "neutra")).passo).toBe("feed");
    expect(await codigo(service.publicar(ESCOLA, ids.ana, "sensacionalista"))).toBe("ja-publicado");
    expect(await codigo(service.paragrafo(ESCOLA, ids.ana, "p1", true))).toBe("ja-publicado");
  });

  test("a Bia publica o rascunho bruto: não atingiu nas duas, e o algoritmo pinça a estatística", async () => {
    await service.entrar(ESCOLA, ids.bia);
    await service.mensagem(ESCOLA, ids.bia, "Gerar rascunho de post sobre celular na escola");
    const e = EstadoSchema.parse(await service.publicar(ESCOLA, ids.bia, "sensacionalista"));
    expect(e.publicacao?.trechoPincado).toContain("DataBrasil 2026");
    expect(await nivel(ids.bia, "auditoria-da-fonte")).toBe("nao_atingiu");
    expect(await nivel(ids.bia, "direito-digital-no-post")).toBe("nao_atingiu");
  });
});

describe("a conversa HÍBRIDA: a IA entende e redige, o servidor decide (ADR-181)", () => {
  const ultima = (e: { conversa: { mensagens: Array<{ texto: string; origem?: string }> } }) => e.conversa.mensagens.at(-1)!;
  const lgpd = conteudoDoPadrao().rascunho.find((p) => p.no === "lgpd")!;
  afterAll(() => {
    respostaDaConversa = "fora";
  });

  test("a intenção da IA move a prévia, o texto dela chega à tela, e a quota é a do ESTUDANTE", async () => {
    await service.entrar(ESCOLA, ids.caio);
    respostaDaConversa = {
      intencao: "gerar_rascunho",
      resposta: "Redigi a proposta da campanha e enviei o texto para a Prévia da Publicação. Quer verificar algum ponto ou ajustar o tom?",
    };
    const gerado = EstadoSchema.parse(await service.mensagem(ESCOLA, ids.caio, "bora fazer esse negócio aí"));
    expect(gerado.previa?.gerada).toBe(true);
    expect(ultima(gerado)).toMatchObject({ origem: "ia", texto: respostaDaConversa.resposta });

    /* "a doença do menino" não está em gatilho nenhum da árvore — que diria "fora do tema". */
    respostaDaConversa = {
      intencao: "auditar_lgpd",
      resposta: "Você tem razão: expor um caso de saúde sem autorização viola a Lei Geral de Proteção de Dados. Removi a identificação na prévia e tratei o tema de forma anônima.",
    };
    const e = EstadoSchema.parse(await service.mensagem(ESCOLA, ids.caio, "acho errado falar da doença do menino"));
    expect(e.previa?.paragrafos.find((p) => p.id === lgpd.id)?.corrigido).toBe(true);
    expect(ultima(e).origem).toBe("ia");
    /* O texto do menor vai CERCADO, como dado; o bastidor vai junto para a IA ser honesta quando questionada. */
    expect(ultimoPromptDaConversa).toContain("<<<acho errado falar da doença do menino>>>");
    expect(ultimoPromptDaConversa).toContain("Colega exposto: Lucas Mendonça");
    const uso = await prisma.iaUsoDiario.findFirst({ where: { escolaId: ESCOLA, usuarioId: ids.caio } });
    expect(uso?.tokensUsados).toBe(240);
  });

  test("a dúvida conceitual RESPONDE sem mexer no post — a árvore teria anonimizado ao ler \"LGPD\"", async () => {
    const antes = EstadoSchema.parse(await service.sessao(ESCOLA, ids.caio)).previa;
    respostaDaConversa = {
      intencao: "duvida_conceitual",
      resposta: "A Lei Geral de Proteção de Dados protege informações pessoais, sobretudo as sensíveis, como as de saúde. Quer que eu revise o rascunho com esse olhar?",
    };
    const e = EstadoSchema.parse(await service.mensagem(ESCOLA, ids.caio, "o que é LGPD?"));
    expect(e.previa).toEqual(antes);
    expect(ultima(e).origem).toBe("ia");
  });

  test("guardrail: a IA que entrega o rascunho ADMITINDO o problema é recusada, e a árvore responde com o tema", async () => {
    await service.entrar(ESCOLA, ids.duda);
    respostaDaConversa = { intencao: "gerar_rascunho", resposta: "Redigi o post, mas a estatística do DataBrasil 2026 foi inventada por mim." };
    const e = EstadoSchema.parse(await service.mensagem(ESCOLA, ids.duda, "monte o post"));
    expect(e.previa?.gerada).toBe(true);
    expect(ultima(e).origem).toBe("regras");
    expect(ultima(e).texto).toContain(PACOTE_PADRAO.tema);
    expect(ultima(e).texto).not.toMatch(/inventad/);
  });

  test("sem saldo de IA, a árvore responde e o modelo nem é chamado", async () => {
    await service.entrar(ESCOLA, ids.eva);
    respostaDaConversa = { intencao: "gerar_rascunho", resposta: "Redigi a proposta." };
    const antes = chamadasDaConversa;
    const e = EstadoSchema.parse(await servicoSemSaldo.mensagem(ESCOLA, ids.eva, "monte o post"));
    expect(chamadasDaConversa).toBe(antes);
    expect(ultima(e).origem).toBe("regras");
    expect(e.previa?.gerada).toBe(true);
  });

  test("a IA lenta perde a corrida do prazo: a árvore responde, e o estudante não espera", async () => {
    await service.entrar(ESCOLA, ids.fe);
    respostaDaConversa = "lenta";
    const e = EstadoSchema.parse(await servicoComPrazoCurto.mensagem(ESCOLA, ids.fe, "monte o post"));
    expect(ultima(e).origem).toBe("regras");
    expect(e.previa?.gerada).toBe(true);
  });
});

describe("o feed da madrugada, a pausa e o Explicar", () => {
  test("a Ana lê as duas dimensões, modera e usa as três proteções: atingiu na EM13CO24 e na EM13CO08", async () => {
    for (const a of [
      { acao: "inspecionar", comentarioId: "c1" },
      { acao: "inspecionar", comentarioId: "c2" },
      { acao: "moderar", moderacao: "restringir" },
      { acao: "privacidade" },
      { acao: "denunciar", comentarioId: "c4" },
      { acao: "ajuda" },
    ] as const) {
      await service.acaoNoFeed(ESCOLA, ids.ana, a);
    }
    expect(await nivel(ids.ana, "cuidado-com-a-saude")).toBe("atingiu");
    expect(await nivel(ids.ana, "protecao-na-rede")).toBe("atingiu");
    expect(await codigo(service.acaoNoFeed(ESCOLA, ids.ana, { acao: "moderar", moderacao: "arquivar" }))).toBe("veja-as-metricas");
  });

  test("a Bia só rola: sem ação, sem marca (ainda)", async () => {
    expect(await nivel(ids.bia, "cuidado-com-a-saude")).toBeNull();
  });

  test("Pausar Telas: a tela congela e as jogadas esperam; o Explicar ainda não abre", async () => {
    await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "pausar");
    expect(GateDoEstudanteSchema.parse(await service.gate(ESCOLA, ids.bia))).toMatchObject({ pausada: true, fase: "debate", passo: "feed" });
    expect(await codigo(service.acaoNoFeed(ESCOLA, ids.bia, { acao: "metricas" }))).toBe("telas-pausadas");
    expect(await codigo(service.abrirExplicar(ESCOLA, ids.bia))).toBe("explicar-nao-liberado");
  });

  test("Liberar Etapa 5: abrir o Explicar fecha o feed e marca o que a Bia não fez como não atingiu", async () => {
    await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "liberar_explicar");
    /* A fase só anda para a frente. */
    expect((await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "pausar")).fase).toBe("explicar");
    expect(await prisma.exp02em1bGateHistorico.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(2);
    const e = EstadoSchema.parse(await service.abrirExplicar(ESCOLA, ids.bia));
    expect(e.passo).toBe("explicar");
    expect(await nivel(ids.bia, "cuidado-com-a-saude")).toBe("nao_atingiu");
    expect(await nivel(ids.bia, "protecao-na-rede")).toBe("nao_atingiu");
    expect(await codigo(service.acaoNoFeed(ESCOLA, ids.bia, { acao: "ajuda" }))).toBe("explicar-nao-liberado");
  });

  test("os indicadores: o que não comprova acende a dica; concluir exige os dois", async () => {
    await service.abrirExplicar(ESCOLA, ids.ana);
    const errado = EstadoSchema.parse(await service.apontarIndicador(ESCOLA, ids.ana, "curtidas"));
    expect(errado.explicar).toMatchObject({ ultimoNaoComprova: true, completo: false });
    await service.apontarIndicador(ESCOLA, ids.ana, "pico-madrugada");
    expect(await codigo(service.concluir(ESCOLA, ids.ana))).toBe("evidencias-incompletas");
    const certo = EstadoSchema.parse(await service.apontarIndicador(ESCOLA, ids.ana, "retencao"));
    expect(certo.explicar).toMatchObject({ ultimoNaoComprova: false, completo: true });
    expect(EstadoSchema.parse(await service.concluir(ESCOLA, ids.ana))).toMatchObject({ passo: "concluida", concluido: true });
  });
});

describe("o painel e a RLS", () => {
  test("a lousa é agregada; a folha diz passo e manchete — nunca o chat do estudante", async () => {
    const p = PainelSchema.parse(await service.painel(ESCOLA, ids.turmaA, ids.prof));
    expect(p.resumo).toMatchObject({ publicaram: 2, picoNaMadrugada: 2, manchetes: { neutra: 1, construtiva: 0, sensacionalista: 1 } });
    expect(p.linhas.find((l) => l.estudanteId === ids.ana)).toMatchObject({ passo: "concluida", manchete: "neutra" });
    expect(JSON.stringify(p)).not.toContain(TEXTO_DE_MENOR);
  });

  test("a role SEM BYPASSRLS só enxerga a própria escola", async () => {
    const daEscola = await runtime.comTenancy((tx) => tx.exp02em1bSessao.count(), ESCOLA);
    const daVizinha = await runtime.comTenancy((tx) => tx.exp02em1bSessao.count({ where: { escolaId: ESCOLA } }), OUTRA_ESCOLA);
    expect(daEscola).toBeGreaterThan(0);
    expect(daVizinha).toBe(0);
    for (const tabela of ["exp02em1b_pacotes", "exp02em1b_gates_turma", "exp02em1b_gates_historico", "exp02em1b_sessoes"]) {
      const [linha] = await prisma.$queryRawUnsafe<{ rls: boolean; forcada: boolean }[]>(
        `SELECT relrowsecurity AS rls, relforcerowsecurity AS forcada FROM pg_class WHERE relname = '${tabela}'`,
      );
      expect(linha).toEqual({ rls: true, forcada: true });
    }
  });

  test("zerar: rodada 2, a evidência do pacote apagada, as sessões guardadas", async () => {
    const r = await service.novaRodada(ESCOLA, ids.turmaA, ids.prof, 1);
    expect(r).toMatchObject({ fase: "aberta", atividade: { rodada: 2 } });
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, expId: EXP_ID } })).toBe(0);
    expect(await prisma.exp02em1bSessao.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(2);
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana)).passo).toBe("abertura");
    expect(await codigo(service.novaRodada(ESCOLA, ids.turmaA, ids.prof, 5))).toBe("rodada-desatualizada");
  });
});
