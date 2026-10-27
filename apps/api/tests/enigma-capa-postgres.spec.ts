import { HttpException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import type { AiImagemOpcoes, AiJsonRequest, AiProvider } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import type { AssetsService } from "../src/assets/assets.service";
import type { AuthClaims } from "../src/auth/claims";
import { EXP_ID, PACOTES_PRONTOS, conteudoPronto, type FotoId, type Ponto, type SeloId } from "../src/enigma-capa/conteudo";
import {
  EstadoSchema,
  GateDoEstudanteSchema,
  GerarRespostaSchema,
  MaterialSchema,
  PacoteDaTurmaSchema,
  PainelSchema,
  RespostaDaLupaSchema,
  RespostaDoPublicarSchema,
  RespostaDoToqueSchema,
  SessaoSchema,
} from "../src/enigma-capa/contrato-de-rotas";
import { EnigmaCapaTurmasController } from "../src/enigma-capa/enigma-capa-turmas.controller";
import { EnigmaCapaService } from "../src/enigma-capa/enigma-capa.service";
import { PreparoDaExp02ef1bService } from "../src/enigma-capa/preparo.service";
import { SYSTEM_DO_PREPARO, type CenaGerada } from "../src/enigma-capa/prompts";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O Enigma da Capa da Rádio (exp02ef1b, ADR-184; 2.0.0, ADR-186) no Postgres:
 * o que só o banco responde.
 *
 * A porta da sala em TODA rota de estudante, a missão que nasce vazia, o
 * preparo com a quota do professor (texto + imagem) e a reserva no pacote
 * pronto, os alvos que o professor marca, a homologação, o banco padrão em um
 * toque, o piso da lupa, o LATCH da capa com a fala da visitante, a virada
 * GERAL (só para a frente), a busca com a ajuda e a EF02CO01, o "o que ficou
 * fora" com a EF02CO05, a segunda foto que conclui, o gabarito ausente da
 * saída do estudante (e a exceção da lupa), o painel, a RLS com a role sem
 * `BYPASSRLS`, os CHECKs da 2.0.0 e o zerar.
 *
 * Os testes dependem da ORDEM: é a aula, na sequência em que ela acontece.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-enigma-capa";
const OUTRA_ESCOLA = "teste-enigma-capa-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/** A cena que a IA de mentira escreve (passa pela régua de verdade, no `validar`). */
const CENA_DA_IA: CenaGerada = {
  espaco: "Quadra da Escola",
  espacoCurto: "a quadra",
  alt: "A quadra inteira: à esquerda, crianças jogando vôlei; à direita, crianças descansando na arquibancada.",
  atividade1: { acao: "Jogo de vôlei", visitante: "Na foto, vi crianças jogando!", selo: { texto: "HORA DO JOGO", emoji: "🏐" }, descricao: "crianças jogando vôlei" },
  atividade2: { acao: "Descanso", visitante: "Na foto, vi crianças descansando!", selo: { texto: "HORA DE DESCANSAR", emoji: "😴" }, descricao: "crianças sentadas" },
  invariantes: [
    { nome: "RELÓGIO AZUL", descricao: "um relógio azul de parede" },
    { nome: "BANDEIRA VERDE", descricao: "uma bandeira verde lisa" },
  ],
};

/** A IA de mentira: escreve a cena e a imagem, ou está fora do ar. */
let modoDaIa: "escreve" | "falha" = "escreve";
let chamadasDaIa = 0;
const ia = {
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    expect(req.system).toBe(SYSTEM_DO_PREPARO);
    chamadasDaIa += 1;
    if (modoDaIa === "falha") throw new Error("vendor fora do ar");
    req.aoUsarTokens?.(900);
    return req.validar(CENA_DA_IA);
  },
  async generateImage(prompt: string, opcoes?: AiImagemOpcoes): Promise<Buffer> {
    chamadasDaIa += 1;
    expect(prompt).toMatch(/^Ilustração/);
    expect(opcoes?.proporcao).toBe("16:9");
    opcoes?.aoUsarTokens?.(1300);
    return Buffer.from("imagem");
  },
} as unknown as AiProvider;

const salvas: string[] = [];
const assets = {
  async salvarMidiaDeExperiencia(o: { expId: string; nome: string }) {
    salvas.push(o.nome);
    return `http://localhost:3001/assets/experiencias/${o.expId}/${o.nome}`;
  },
} as unknown as AssetsService;

const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
const quota = new QuotaService(prisma);
const service = new EnigmaCapaService(prisma, evidencias, new PreparoDaExp02ef1bService(ia, quota, assets));
const semSaldo = { temSaldo: async () => false, consumir: async () => undefined } as unknown as QuotaService;
const servicoSemSaldo = new EnigmaCapaService(prisma, evidencias, new PreparoDaExp02ef1bService(ia, semSaldo, assets));
const controller = new EnigmaCapaTurmasController(service);
evidencias.onModuleInit();

const ids = { turmaA: "", turmaB: "", turmaC: "", turmaVizinha: "", prof: "", profB: "", ana: "", bia: "", caio: "", duda: "", fabi: "", vizinho: "" };

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp02ef1bGateHistorico.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp02ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp02ef1bGateTurma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
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

/** Faz de conta que a criança entrou há um minuto: a lupa é limitada ao tempo desde a entrada. */
const envelhecer = (estudanteId: string) =>
  prisma.exp02ef1bSessao.updateMany({ where: { escolaId: ESCOLA, estudanteId }, data: { entrouEm: new Date(Date.now() - 60_000) } });

const LUPA_CHEIA = { alvo1Ms: 4000, alvo2Ms: 4000, avancar: true };
const relogio = PACOTES_PRONTOS.biblioteca.conteudo.cena.invariantes[0]!.alvo!;
const cartaz = PACOTES_PRONTOS.biblioteca.conteudo.cena.invariantes[1]!.alvo!;
const LONGE = { x: 10, y: 95 };

/** A criança até a capa publicada (E1–E3). */
async function ateACapa(estudanteId: string, foto: FotoId, selo: SeloId, alertas = 0) {
  await service.iniciar(ESCOLA, estudanteId);
  await envelhecer(estudanteId);
  for (let i = 0; i < alertas; i += 1) await service.lupa(ESCOLA, estudanteId, { ...LUPA_CHEIA, alvo2Ms: 0 });
  await service.lupa(ESCOLA, estudanteId, LUPA_CHEIA);
  return RespostaDoPublicarSchema.parse(await service.publicar(ESCOLA, estudanteId, foto, selo, { x: 0.5, y: 0.5 }));
}

/** Da virada ao fim (E4–E5): a busca, o slider, os alfinetes do "fora", o par e a segunda foto, que conclui. */
async function daViradaAoFim(estudanteId: string, o: { errosAntes: number; errosDepois: number; fora: Ponto[] }) {
  for (let i = 0; i < o.errosAntes + o.errosDepois; i += 1) await service.tocarInvariante(ESCOLA, estudanteId, "foto-1", LONGE);
  for (const foto of ["foto-1", "foto-2"] as const) {
    await service.tocarInvariante(ESCOLA, estudanteId, foto, relogio);
    await service.tocarInvariante(ESCOLA, estudanteId, foto, cartaz);
  }
  await service.abrirPanoramica(ESCOLA, estudanteId);
  await service.marcarFora(ESCOLA, estudanteId, o.fora);
  await service.formarPar(ESCOLA, estudanteId, ["carta-a", "carta-c"], "atividade");
  return EstadoSchema.parse(await service.segundaFoto(ESCOLA, estudanteId, "crianca-lendo", { x: 0, y: 0 }));
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Enigma da Capa (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  ids.turmaA = (await criarTurmaDeTeste(prisma, ESCOLA, "2A-ENIGMA", "2EF")).id;
  ids.turmaB = (await criarTurmaDeTeste(prisma, ESCOLA, "2B-ENIGMA", "2EF")).id;
  ids.turmaC = (await criarTurmaDeTeste(prisma, ESCOLA, "2C-ENIGMA", "2EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "2A vizinha", "2EF")).id;
  const pessoa = (escolaId: string, turmaId: string | null, username: string, nome: string, role = "estudante") =>
    prisma.user
      .create({ data: { role, escolaId, turmaId, username, displayName: nome, passwordHash: "x" }, select: { id: true } })
      .then((u) => u.id);
  ids.ana = await pessoa(ESCOLA, ids.turmaA, "ec.ana", "Ana Teste");
  ids.bia = await pessoa(ESCOLA, ids.turmaA, "ec.bia", "Bia Teste");
  ids.caio = await pessoa(ESCOLA, ids.turmaA, "ec.caio", "Caio Teste");
  ids.duda = await pessoa(ESCOLA, ids.turmaB, "ec.duda", "Duda Teste");
  ids.fabi = await pessoa(ESCOLA, ids.turmaC, "ec.fabi", "Fabi Teste");
  ids.vizinho = await pessoa(OUTRA_ESCOLA, ids.turmaVizinha, "ec.vizinho", "Vizinho Teste");
  ids.prof = await pessoa(ESCOLA, null, "ec.marta", "Marta Teste", "professor");
  ids.profB = await pessoa(ESCOLA, null, "ec.rui", "Rui Teste", "professor");
  const lecionar = (turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: { escolaId: ESCOLA, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
    });
  await lecionar(ids.turmaA, ids.prof);
  await lecionar(ids.turmaB, ids.profB);
  /* A PORTA DA SALA: a 2C fica SEM liberação, de propósito. */
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
      () => service.iniciar(ESCOLA, ids.fabi),
      () => service.lupa(ESCOLA, ids.fabi, LUPA_CHEIA),
      () => service.publicar(ESCOLA, ids.fabi, "foto-1", "selo-1", { x: 0.5, y: 0.5 }),
      () => service.tocarInvariante(ESCOLA, ids.fabi, "foto-1", relogio),
      () => service.abrirPanoramica(ESCOLA, ids.fabi),
      () => service.marcarFora(ESCOLA, ids.fabi, [{ x: 80, y: 70 }]),
      () => service.formarPar(ESCOLA, ids.fabi, ["carta-a", "carta-c"], "atividade"),
      () => service.segundaFoto(ESCOLA, ids.fabi, "crianca-lendo", { x: 0, y: 0 }),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 403, corpo: { codigo: "missao-nao-liberada" } });
    }
  });

  test("estudante de OUTRA escola: 404", async () => {
    expect(await recusa(service.sessao(ESCOLA, ids.vizinho))).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
  });
});

describe("a missão nasce VAZIA", () => {
  test("sem pacote no ar: espera; o ABRIR BANCADA é 409; o botão do professor também espera", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s).toMatchObject({ passo: "inicio", preparada: false, fase: null, cena: null, lupa: null });
    expect(s.geometria.recortes["foto-2"]).toEqual({ x: 32, y: 0, w: 68, h: 100 });
    expect(await codigo(service.iniciar(ESCOLA, ids.ana))).toBe("radio-em-preparo");
    expect(await codigo(service.mudarGate(ESCOLA, ids.turmaA, ids.prof))).toBe("pacote-nao-aprovado");
  });
});

describe("o preparo do professor (IA com a quota do perfil professor)", () => {
  test("404, nunca 403, na turma que não leciona — e o gerar não gasta token antes", async () => {
    const antes = chamadasDaIa;
    for (const chamada of [
      () => service.pacoteDaTurma(ESCOLA, ids.turmaB, ids.prof),
      () => service.gerar(ESCOLA, ids.turmaB, ids.prof, "professor", { disciplina: "outra", tema: "Recreio", palavras: ["bola", "pátio", "lanche"] }),
      () => service.usarBancoPadrao(ESCOLA, ids.turmaB, ids.prof, "biblioteca"),
      () => service.painel(ESCOLA, ids.turmaB, ids.prof),
      () => service.mudarGate(ESCOLA, ids.turmaB, ids.prof),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
    }
    expect(chamadasDaIa).toBe(antes);
  });

  test("gerar com IA: texto + panorâmica salva no bucket, UM rascunho sem alvos, e o pago debitado (texto E imagem)", async () => {
    const r = GerarRespostaSchema.parse(
      await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "outra", tema: "Recreio na quadra", palavras: ["quadra", "vôlei", "descanso"] }),
    );
    expect(r).toMatchObject({ usouIa: true, motivo: null, rascunho: { origem: "ia", chaveDaCena: "ia", aprovadoEm: null } });
    expect(r.rascunho.conteudo.cena.imagem).toEqual({ tipo: "url", url: expect.stringMatching(/^http:\/\/localhost:3001\/assets\/experiencias\/exp02ef1b\/cenas\/.+\.webp$/) });
    expect(r.rascunho.conteudo.cena.invariantes.map((i) => i.alvo)).toEqual([null, null]);
    expect(r.rascunho.pendencias.join(" ")).toMatch(/Toque no RELÓGIO AZUL/);
    const linha = await prisma.exp02ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } });
    expect(linha).toMatchObject({ iaGeracoes: 1, iaTokens: 2200 });
    const uso = await prisma.iaUsoDiario.findFirst({ where: { escolaId: ESCOLA, usuarioId: ids.prof } });
    expect(uso?.tokensUsados).toBe(2200);
  });

  test("sem os alvos, a aprovação recusa; o professor toca nos dois objetos (fora da faixa comum, 400)", async () => {
    const { rascunho } = await service.rascunho(ESCOLA, ids.turmaA, ids.prof);
    const r = await recusa(() => controller.homologar(ids.turmaA, undefined, { rascunhoId: rascunho!.id }, req(ids.prof)));
    expect(r).toMatchObject({ status: 400, corpo: { codigo: "pacote-invalido" } });
    const fora = await recusa(() =>
      controller.alvos(ids.turmaA, undefined, { alvos: [{ id: "inv-1", x: 10, y: 30 }, { id: "inv-2", x: 56, y: 30 }] }, req(ids.prof)),
    );
    expect(fora).toMatchObject({ status: 400, corpo: { codigo: "pacote-invalido" } });
    expect((fora.corpo.erros as string[]).join(" ")).toMatch(/RELÓGIO AZUL precisa estar na parte do meio/);
    const marcado = await service.marcarAlvos(ESCOLA, ids.turmaA, ids.prof, { alvos: [{ id: "inv-1", x: 42, y: 25 }, { id: "inv-2", x: 58, y: 25 }] });
    expect(marcado.pendencias).toEqual([]);
    expect(marcado.conteudo.cena.invariantes.map((i) => i.alvo)).toEqual([
      { x: 42, y: 25, r: 7 },
      { x: 58, y: 25, r: 7 },
    ]);
  });

  test("aprovar: outro rascunho é 409; o certo vira atividade PRONTA (não no ar); o duplo clique é idempotente", async () => {
    const { rascunho } = await service.rascunho(ESCOLA, ids.turmaA, ids.prof);
    expect(await codigo(() => controller.homologar(ids.turmaA, undefined, { rascunhoId: "00000000-0000-4000-8000-000000000000" }, req(ids.prof)))).toBe(
      "rascunho-desatualizado",
    );
    const corpo = { rascunhoId: rascunho!.id, selos: [{ id: "selo-1", texto: "HORA DO VÔLEI", emoji: "🏐" }, { id: "selo-2", texto: "HORA DE DESCANSAR", emoji: "😴" }] };
    const um = await controller.homologar(ids.turmaA, undefined, corpo, req(ids.prof));
    const dois = await controller.homologar(ids.turmaA, undefined, corpo, req(ids.prof));
    expect(dois.id).toBe(um.id);
    expect(um).toMatchObject({ ativo: false, origem: "ia" });
    expect(um.conteudo.cena.selos[0]?.texto).toBe("HORA DO VÔLEI");
    expect(PacoteDaTurmaSchema.parse(await service.pacoteDaTurma(ESCOLA, ids.turmaA, ids.prof)).ativo).toBeNull();
  });

  test("com o vendor fora, o rascunho sai do pacote PRONTO da disciplina (História → Museu)", async () => {
    modoDaIa = "falha";
    const r = await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "historia", tema: "Objetos antigos", palavras: ["museu", "tinteiro", "caneta"] });
    modoDaIa = "escreve";
    expect(r).toMatchObject({ usouIa: false, motivo: "indisponivel", rascunho: { origem: "padrao", chaveDaCena: "museu", tema: PACOTES_PRONTOS.museu.tema, pendencias: [] } });
  });

  test("sem saldo, a IA nem é chamada, e o rascunho continua UM só", async () => {
    const antes = chamadasDaIa;
    const r = await servicoSemSaldo.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "ciencias", tema: "Horta", palavras: ["horta", "alface", "minhoca"] });
    expect(chamadasDaIa).toBe(antes);
    expect(r).toMatchObject({ usouIa: false, motivo: "sem-saldo", rascunho: { chaveDaCena: "horta" } });
    expect(await prisma.exp02ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } })).toBe(1);
  });

  test("o caminho curto: o banco padrão aprovado E no ar num toque; de novo, a mesma atividade", async () => {
    const r = await service.usarBancoPadrao(ESCOLA, ids.turmaA, ids.prof, "biblioteca");
    expect(r).toMatchObject({ mudou: true, fase: "aberta", atividade: { rodada: 1 } });
    const de_novo = await service.usarBancoPadrao(ESCOLA, ids.turmaA, ids.prof, "biblioteca");
    expect(de_novo).toMatchObject({ mudou: false, atividade: { pacoteId: r.atividade.pacoteId } });
    /* O rascunho da curadoria continua lá. */
    expect(await prisma.exp02ef1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } })).toBe(1);
  });
});

describe("a aula: o ABRIR BANCADA, a lupa e a capa", () => {
  test("a sessão traz a cena SEM o gabarito, a geometria, o material e os textos com o espaço", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s).toMatchObject({ passo: "inicio", preparada: true, fase: "aberta", cena: { chave: "biblioteca", imagem: { tipo: "bundle", nome: "cenas/biblioteca.webp" } } });
    expect(s.textos.e1).toMatchObject({
      tag: "RASCUNHO PENDENTE",
      contexto: "A capa sobre a biblioteca causou confusão entre os ouvintes.",
      missao: "ENCONTRE NAS FOTOS 2 OBJETOS DA BIBLIOTECA",
      abrir: "ABRIR BANCADA",
    });
    expect(s.textos.e4?.fora).toBe("Marque na biblioteca o que ficou fora da sua foto.");
    expect(s.textos.e4?.mesmoLugar).toBe("MESMO LUGAR · MESMO MINUTO (14:15)");
    expect(s.textos.e2?.rotuloDaFoto1).toBe("FOTO 1 — BIBLIOTECA ESCOLAR 14:15");
    /* O contador fica para a tela. */
    expect(s.textos.e2?.contador).toBe("{n} DE 2 ENCONTRADOS");
    expect(Object.keys(s.textos)).toEqual(["e1", "e2", "e3", "e4", "e5", "erros"]);
    expect(Object.keys(s.material).sort()).toEqual(["cartas", "motivos", "segundaFoto"]);
    const json = JSON.stringify(await service.sessao(ESCOLA, ids.ana));
    expect(json).not.toMatch(/"nucleo"|"seloCoerente"|"alvo"|"alvos":\[|"marcaveis"|"atividade":"leitura"|"cor":|Na foto, vi crianças/);
  });

  test("jogada fora do passo é 409; o ABRIR BANCADA abre a sessão (idempotente) e os dois alvos descem para o brilho da lente", async () => {
    expect(await codigo(service.publicar(ESCOLA, ids.ana, "foto-1", "selo-1", { x: 0.5, y: 0.5 }))).toBe("sessao-nao-aberta");
    const e = EstadoSchema.parse(await service.iniciar(ESCOLA, ids.ana));
    expect(e).toMatchObject({ passo: "lupa", lupa: { alvo1Ms: 0, alvo2Ms: 0, alertas: 0, liberada: false } });
    /* A exceção da ADR-186: no passo da lupa, os DOIS invariantes descem. */
    expect(e.lupa?.alvos).toEqual([
      { id: "inv-1", ...relogio },
      { id: "inv-2", ...cartaz },
    ]);
    /* O duplo toque devolve o estado; a sessão é uma só. */
    expect(EstadoSchema.parse(await service.iniciar(ESCOLA, ids.ana)).passo).toBe("lupa");
    expect(await prisma.exp02ef1bSessao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(1);
    const linha = await prisma.exp02ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(linha.versaoInstrumento).toBe("2.0.0");
    expect(await codigo(service.publicar(ESCOLA, ids.ana, "foto-1", "selo-1", { x: 0.5, y: 0.5 }))).toBe("passo-invalido");
  });

  test("a lupa: avançar sem o piso conta o alerta; o tempo é limitado ao da sessão; com 3 s em cada objeto, libera", async () => {
    const cedo = RespostaDaLupaSchema.parse(await service.lupa(ESCOLA, ids.ana, LUPA_CHEIA));
    /* A sessão acabou de nascer: os 4 s relatados viram o tempo que passou de verdade. */
    expect(cedo).toMatchObject({ liberado: false, alerta: true, lupa: { alertas: 1, liberada: false } });
    expect(cedo.lupa!.alvo1Ms).toBeLessThan(4000);
    await envelhecer(ids.ana);
    /* Só um dos dois objetos: o relato fica, sem avançar não há alerta. */
    const meio = RespostaDaLupaSchema.parse(await service.lupa(ESCOLA, ids.ana, { alvo1Ms: 4000, alvo2Ms: 0, avancar: false }));
    expect(meio).toMatchObject({ liberado: false, alerta: false, passo: "lupa", lupa: { alvo1Ms: 4000, alertas: 1 } });
    const ok = RespostaDaLupaSchema.parse(await service.lupa(ESCOLA, ids.ana, LUPA_CHEIA));
    expect(ok).toMatchObject({ liberado: true, alerta: false, passo: "decidir", lupa: { alvo1Ms: 4000, alvo2Ms: 4000, alertas: 1, liberada: true, alvos: null } });
    expect(RespostaDaLupaSchema.parse(await service.lupa(ESCOLA, ids.ana, { ...LUPA_CHEIA, alvo1Ms: 0 }))).toMatchObject({ liberado: true, lupa: { alertas: 1 } });
  });

  test("PUBLICAR CAPA é o latch: a fala da visitante, a espera da virada; a mesma escolha é idempotente, outra é 409", async () => {
    const r = RespostaDoPublicarSchema.parse(await service.publicar(ESCOLA, ids.ana, "foto-1", "selo-1", { x: 0.5, y: 0.5 }));
    expect(r).toMatchObject({ visitante: "Na foto, vi crianças lendo!", passo: "feed", aguardandoVirada: true, capa: { fotoId: "foto-1", outraFotoId: "foto-2" } });
    expect(r.invariantes).toBeNull();
    expect((await service.publicar(ESCOLA, ids.ana, "foto-1", "selo-1", { x: 0, y: 0 })).visitante).toBe("Na foto, vi crianças lendo!");
    expect(await codigo(service.publicar(ESCOLA, ids.ana, "foto-2", "selo-2", { x: 0.5, y: 0.5 }))).toBe("ja-publicado");
    expect(await codigo(service.tocarInvariante(ESCOLA, ids.ana, "foto-1", relogio))).toBe("virada-nao-liberada");
    expect(await codigo(service.abrirPanoramica(ESCOLA, ids.ana))).toBe("virada-nao-liberada");
  });

  test("a Bia (selo incoerente) e o Caio publicam; o painel conta quem aguarda a virada", async () => {
    await ateACapa(ids.bia, "foto-1", "selo-2");
    await ateACapa(ids.caio, "foto-2", "selo-2");
    const p = PainelSchema.parse(await service.painel(ESCOLA, ids.turmaA, ids.prof));
    expect(p.resumo).toMatchObject({ unidades: 3, entraram: 3, publicaram: 3, aguardandoVirada: 3, concluiram: 0, marcaramFora: 0 });
    expect(p.linhas.find((l) => l.estudanteId === ids.bia)?.capa).toMatchObject({ seloCoerente: false, visitante: "Na foto, vi crianças lendo!" });
    expect(GateDoEstudanteSchema.parse(await service.gate(ESCOLA, ids.bia))).toMatchObject({ fase: "aberta", passo: "feed", rodada: 1 });
  });
});

describe("a virada (geral da turma) e a busca dos invariantes", () => {
  test("LIBERAR VIRADA: todos vão para a busca; só para a frente; uma linha no histórico", async () => {
    expect((await service.mudarGate(ESCOLA, ids.turmaA, ids.prof)).fase).toBe("virada");
    expect((await service.mudarGate(ESCOLA, ids.turmaA, ids.prof)).fase).toBe("virada");
    expect(await prisma.exp02ef1bGateHistorico.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(1);
    expect(GateDoEstudanteSchema.parse(await service.gate(ESCOLA, ids.ana))).toMatchObject({ fase: "virada", passo: "invariantes" });
  });

  test("a Ana erra duas vezes e acha os quatro: atingiu na EF02CO01, e os alvos nunca desceram", async () => {
    await service.tocarInvariante(ESCOLA, ids.ana, "foto-1", LONGE);
    const erro = RespostaDoToqueSchema.parse(await service.tocarInvariante(ESCOLA, ids.ana, "foto-2", { x: 90, y: 95 }));
    expect(erro.toque).toMatchObject({ acerto: null, erros: 2, ajuda: false });
    expect(erro.toque.alvos).toBeUndefined();
    expect(erro.toque.achados).toEqual([]);
    expect(await codigo(service.tocarInvariante(ESCOLA, ids.ana, "foto-2", { x: 5, y: 50 }))).toBe("toque-fora-da-foto");
    /* O relógio achado numa foto: o alvo DELE desce (o F5 redesenha o dourado); o do cartaz, não. */
    const umAchado = RespostaDoToqueSchema.parse(await service.tocarInvariante(ESCOLA, ids.ana, "foto-1", relogio));
    expect(umAchado.toque.achados).toEqual([{ id: "inv-1", ...relogio }]);
    const depoisDoF5 = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(depoisDoF5.invariantes).toMatchObject({ encontrados: ["inv-1:foto-1"], achados: [{ id: "inv-1", ...relogio }], alvos: null });
    expect(JSON.stringify(depoisDoF5)).not.toContain(`"x":${cartaz.x},"y":${cartaz.y}`);
    let ultimo = erro;
    for (const foto of ["foto-1", "foto-2"] as const) {
      await service.tocarInvariante(ESCOLA, ids.ana, foto, relogio);
      ultimo = RespostaDoToqueSchema.parse(await service.tocarInvariante(ESCOLA, ids.ana, foto, cartaz));
    }
    expect(ultimo.toque).toMatchObject({ acerto: "inv-2", completo: true, erros: 2 });
    expect(ultimo).toMatchObject({ passo: "slider", invariantes: { completo: true, alvos: null } });
    expect(ultimo.invariantes?.achados.map((a) => a.id)).toEqual(["inv-1", "inv-2"]);
    expect(await nivel(ids.ana, "invariantes-do-fundo")).toBe("atingiu");
    expect(await nivel(ids.ana, "recorte-da-capa")).toBeNull();
  });

  test("a Bia precisa da ajuda, erra 3 vezes depois dela e não marca nada fora: os alvos descem; não atingiu nas duas", async () => {
    for (let i = 0; i < 2; i += 1) await service.tocarInvariante(ESCOLA, ids.bia, "foto-1", LONGE);
    const terceiro = RespostaDoToqueSchema.parse(await service.tocarInvariante(ESCOLA, ids.bia, "foto-1", LONGE));
    expect(terceiro.toque).toMatchObject({ erros: 3, ajuda: true });
    expect(terceiro.toque.alvos?.map((a) => a.id)).toEqual(["inv-1", "inv-2"]);
    expect(terceiro.invariantes?.alvos?.length).toBe(2);
    /* O alfinete na mesa de leitura, que ESTAVA na capa dela: nada fora. */
    const fim = await daViradaAoFim(ids.bia, { errosAntes: 0, errosDepois: 3, fora: [{ x: 20, y: 60 }] });
    expect(fim).toMatchObject({ passo: "concluida", concluido: true });
    expect(await nivel(ids.bia, "invariantes-do-fundo")).toBe("nao_atingiu");
    /* Nada fora + selo incoerente (e invariantes ausente): não atingiu. */
    expect(await nivel(ids.bia, "recorte-da-capa")).toBe("nao_atingiu");
  });
});

describe("o slider, o fora (a EF02CO05) e a E5, que conclui", () => {
  test("a Ana marca o que ficou fora — a EF02CO05 em processo (1 alerta da lupa) —, forma o par da cor e a segunda foto conclui", async () => {
    await service.abrirPanoramica(ESCOLA, ids.ana);
    expect(await codigo(service.formarPar(ESCOLA, ids.ana, ["carta-a", "carta-d"], "roupa"))).toBe("passo-invalido");
    const fora = EstadoSchema.parse(await service.marcarFora(ESCOLA, ids.ana, [{ x: 80, y: 70 }, { x: 20, y: 60 }]));
    expect(fora).toMatchObject({ passo: "pares", fora: { toques: [{ x: 80, y: 70 }, { x: 20, y: 60 }] } });
    /* Marcada no "Pronto": o tapete ficou fora da capa (fora pleno), mas a lupa teve 1 alerta. */
    expect(await nivel(ids.ana, "recorte-da-capa")).toBe("em_processo");
    /* O "Pronto" de novo devolve o estado, sem regravar. */
    expect(EstadoSchema.parse(await service.marcarFora(ESCOLA, ids.ana, [{ x: 50, y: 95 }])).fora?.toques).toHaveLength(2);
    expect(await codigo(service.formarPar(ESCOLA, ids.ana, ["carta-a", "carta-z"], "roupa"))).toBe("carta-desconhecida");
    await service.formarPar(ESCOLA, ids.ana, ["carta-a", "carta-d"], "roupa");
    const fim = EstadoSchema.parse(await service.segundaFoto(ESCOLA, ids.ana, "mochila", { x: 1, y: 0.5 }));
    expect(fim).toMatchObject({ passo: "concluida", concluido: true, segundaFoto: { elemento: "mochila" } });
    const linha = await prisma.exp02ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.ana } });
    expect(linha.concluidoEm).not.toBeNull();
    expect(linha.concluidoEm?.getTime()).toBe(linha.segundaEm?.getTime());
    /* A mesma jogada de novo é idempotente. */
    expect(EstadoSchema.parse(await service.segundaFoto(ESCOLA, ids.ana, "parede", { x: 0, y: 0 })).segundaFoto?.elemento).toBe("mochila");
    expect(GateDoEstudanteSchema.parse(await service.gate(ESCOLA, ids.ana)).passo).toBe("concluida");
  });

  test("o Caio faz tudo pleno e marca fora a mesa de leitura: atingiu nas duas", async () => {
    /* A capa dele é a foto 2 centrada: a mesa de leitura (à esquerda) ficou fora. */
    await daViradaAoFim(ids.caio, { errosAntes: 0, errosDepois: 0, fora: [{ x: 20, y: 60 }] });
    expect(await nivel(ids.caio, "invariantes-do-fundo")).toBe("atingiu");
    expect(await nivel(ids.caio, "recorte-da-capa")).toBe("atingiu");
  });

  test("o painel: as escolhas por estudante, pelo nome (o fora, o par, a segunda foto) e os agregados", async () => {
    const p = PainelSchema.parse(await service.painel(ESCOLA, ids.turmaA, ids.prof));
    expect(p.resumo).toMatchObject({ publicaram: 3, aguardandoVirada: 0, concluiram: 3, marcaramFora: 2 });
    expect(p.roteiro.introducao).toBe(
      "O Bento postou uma foto da biblioteca e os ouvintes entenderam tudo errado. Encontre nas fotos os 2 objetos da biblioteca e descubra o mistério da capa!",
    );
    const ana = p.linhas.find((l) => l.estudanteId === ids.ana)!;
    expect(ana).toMatchObject({
      nome: "Ana Teste",
      passo: "concluida",
      lupa: { alvo1Ms: 4000, alvo2Ms: 4000, alertas: 1, liberada: true },
      capa: { fotoId: "foto-1", seloCoerente: true, nucleoVisivel: true },
      invariantes: { encontrados: 4, erros: 2, ajuda: false, completo: true },
      fora: { itens: [{ id: "tapete-fantoches", nome: "TAPETE COM FANTOCHES" }] },
      par: { cartas: ["carta-a", "carta-d"], motivo: "roupa", correto: false },
      segundaFoto: { elemento: "mochila", essencialVisivel: false },
    });
    expect(ana.fora!.possiveis).toBeGreaterThanOrEqual(1);
    const bia = p.linhas.find((l) => l.estudanteId === ids.bia)!;
    expect(bia).toMatchObject({ nome: "Bia Teste", invariantes: { ajuda: true, errosPosAjuda: 3 }, fora: { itens: [] } });
    expect(Object.keys(bia).sort()).toEqual(["aguardandoVirada", "capa", "equipe", "estudanteId", "fora", "invariantes", "lupa", "nome", "par", "passo", "segundaFoto"]);
  });

  test("o material do guia: as disciplinas do 2º ano na ordem do catálogo, com Computação e Outro componente no fim", () => {
    const m = MaterialSchema.parse(service.material());
    expect(m.disciplinas.map((d) => d.slug)).toEqual([
      "lingua-portuguesa",
      "arte",
      "educacao-fisica",
      "matematica",
      "ciencias",
      "geografia",
      "historia",
      "ensino-religioso",
      "computacao",
      "outra",
    ]);
    expect(m.disciplinas.at(-1)).toEqual({ slug: "outra", rotulo: "Outro componente" });
    expect(m.habilidades[0]?.rotulo).toBe("A capa da rádio e o que ficou fora");
  });

  test("o recorte aceita a disciplina nova (Geografia → o Museu de reserva, sem saldo)", async () => {
    const r = await servicoSemSaldo.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "geografia", tema: "O bairro da escola", palavras: ["rua", "mapa", "praça"] });
    expect(r).toMatchObject({ usouIa: false, motivo: "sem-saldo", rascunho: { disciplina: "geografia", chaveDaCena: "museu" } });
  });
});

describe("o banco, a RLS e o zerar", () => {
  test("os CHECKs são a rede final: a capa pela metade e a conclusão sem a segunda foto são recusadas", async () => {
    const onde = { escolaId: ESCOLA, estudanteId: ids.ana };
    await expect(prisma.exp02ef1bSessao.updateMany({ where: onde, data: { capaSeloId: null } })).rejects.toThrow(/exp02ef1b_sessoes_capa_check/);
    await expect(
      prisma.exp02ef1bSessao.updateMany({
        where: onde,
        data: { segundaEm: null, segundaElemento: null, segundaDeslocamento: Prisma.DbNull, segundaEssencialVisivel: null },
      }),
    ).rejects.toThrow(/exp02ef1b_sessoes_conclusao_check/);
    await expect(prisma.exp02ef1bSessao.updateMany({ where: onde, data: { invariantesErros: 3 } })).rejects.toThrow(/exp02ef1b_sessoes_invariantes_check/);
    await expect(prisma.exp02ef1bSessao.updateMany({ where: onde, data: { lupaAlvo1Ms: -1 } })).rejects.toThrow(/exp02ef1b_sessoes_lupa_check/);
    await expect(prisma.$executeRawUnsafe(`UPDATE exp02ef1b_pacotes SET disciplina = 'quimica' WHERE escola_id = '${ESCOLA}'`)).rejects.toThrow(
      /exp02ef1b_pacotes_disciplina_check/,
    );
  });

  test("a 2.0.0 no banco: as colunas da sessão são EXATAMENTE estas (a lupa por objeto) e a versão nova é o padrão", async () => {
    const colunas = await prisma.$queryRawUnsafe<{ coluna: string; padrao: string | null }[]>(
      `SELECT column_name AS coluna, column_default AS padrao FROM information_schema.columns WHERE table_name = 'exp02ef1b_sessoes'`,
    );
    expect(colunas.map((c) => c.coluna).sort()).toEqual(
      [
        "atualizado_em", "capa_deslocamento", "capa_foto_id", "capa_nucleo_visivel", "capa_publicada_em", "capa_selo_coerente", "capa_selo_id",
        "concluido_em", "criado_em", "entrou_em", "escola_id", "estudante_id", "fora_em", "fora_itens", "fora_toques", "invariantes_ajuda_em",
        "invariantes_concluido_em", "invariantes_encontrados", "invariantes_erros", "invariantes_erros_pos_ajuda", "lupa_alertas", "lupa_alvo1_ms",
        "lupa_alvo2_ms", "lupa_liberada_em", "pacote_id", "panoramica_aberta_em", "par_cartas", "par_correto", "par_em", "par_motivo", "rodada",
        "segunda_deslocamento", "segunda_elemento", "segunda_em", "segunda_essencial_visivel", "turma_id", "versao_instrumento", "visitante_fala",
      ].sort(),
    );
    expect(colunas.find((c) => c.coluna === "versao_instrumento")?.padrao).toMatch(/'2\.0\.0'/);
  });

  test("a role SEM BYPASSRLS só enxerga a própria escola", async () => {
    const daEscola = await runtime.comTenancy((tx) => tx.exp02ef1bSessao.count(), ESCOLA);
    const daVizinha = await runtime.comTenancy((tx) => tx.exp02ef1bSessao.count({ where: { escolaId: ESCOLA } }), OUTRA_ESCOLA);
    expect(daEscola).toBeGreaterThan(0);
    expect(daVizinha).toBe(0);
    for (const tabela of ["exp02ef1b_pacotes", "exp02ef1b_gates_turma", "exp02ef1b_gates_historico", "exp02ef1b_sessoes"]) {
      const [linha] = await prisma.$queryRawUnsafe<{ rls: boolean; forcada: boolean }[]>(
        `SELECT relrowsecurity AS rls, relforcerowsecurity AS forcada FROM pg_class WHERE relname = '${tabela}'`,
      );
      expect(linha).toEqual({ rls: true, forcada: true });
    }
  });

  test("zerar: rodada 2, a evidência do pacote apagada, as sessões guardadas, a fase de volta a aberta", async () => {
    const r = await service.novaRodada(ESCOLA, ids.turmaA, ids.prof, 1);
    expect(r).toMatchObject({ fase: "aberta", atividade: { rodada: 2 } });
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, expId: EXP_ID } })).toBe(0);
    expect(await prisma.exp02ef1bSessao.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(3);
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana))).toMatchObject({ passo: "inicio", fase: "aberta", atividade: { rodada: 2 }, lupa: null });
    expect(await codigo(service.novaRodada(ESCOLA, ids.turmaA, ids.prof, 5))).toBe("rodada-desatualizada");
    /* O duplo clique do zerar (a rodada que ele VIU) devolve a mesma. */
    expect((await service.novaRodada(ESCOLA, ids.turmaA, ids.prof, 1)).atividade.rodada).toBe(2);
  });

  test("a atividade gerada continua na lista e pode voltar ao ar (rodada nova)", async () => {
    const lista = await service.pacotes(ESCOLA, ids.turmaA, ids.prof);
    const daIa = lista.historico.find((h) => h.origem === "ia")!;
    expect(daIa).toMatchObject({ chaveDaCena: "ia", ativo: false });
    const r = await service.colocarEmAndamento(ESCOLA, ids.turmaA, ids.prof, daIa.id);
    expect(r).toMatchObject({ mudou: true, fase: "aberta", atividade: { pacoteId: daIa.id, rodada: 1 } });
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s.cena).toMatchObject({ chave: "ia", imagem: { tipo: "url" } });
    expect(conteudoPronto("biblioteca").cena.chave).toBe("biblioteca");
  });
});
