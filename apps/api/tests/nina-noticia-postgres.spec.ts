import { HttpException } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { conteudoDoBancoPadrao } from "../src/nina-noticia/banco-padrao";
import {
  EstadoSchema,
  GateDaTurmaSchema,
  GatePublicoSchema,
  MaterialSchema,
  PacotesSchema,
  PainelSchema,
  RespostaDaFichaSchema,
  RespostaDaRotinaSchema,
  RespostaDoConcluirSchema,
  RespostaDoFiltroSchema,
  RespostaDoReparoSchema,
  RespostaDosSelosSchema,
  SessaoSchema,
  ZerarTurmaSchema,
} from "../src/nina-noticia/contrato-de-rotas";
import { EXP_ID, NinaNoticiaService } from "../src/nina-noticia/nina-noticia.service";
import { PROIBIDO_NA_LINHA_DO_PAINEL } from "../src/nina-noticia/regras/painel";
import { DISCIPLINAS, ETAPAS, PASSOS, SEQUENCIA_CERTA, VERSAO_DO_INSTRUMENTO } from "../src/nina-noticia/vocabulario";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Nina e a Notícia que Desapareceu (exp03ef1b, ADR-197) no Postgres: o que só
 * o banco responde.
 *
 * A porta da sala, a missão que nasce vazia, o banco padrão no ar num toque, a
 * sessão sem gabarito, os selos, o LATCH da escolha (inclusive concorrente),
 * os dois portões e a pausa, o filtro honesto que conta tentativa, a ficha do
 * telão, os carimbos, o reparo certo e errado, a rotina inválida e válida, o
 * fim, as cinco marcas da ficha E14, o painel sem acerto na linha, os CHECKs
 * (comparados ao vocabulário), a RLS com a role sem `BYPASSRLS` e o zerar.
 *
 * Os testes dependem da ORDEM: é a aula, na sequência em que ela acontece.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-nina-noticia";
const OUTRA_ESCOLA = "teste-nina-noticia-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
evidencias.onModuleInit();
const service = new NinaNoticiaService(prisma, evidencias);

const ids = { turma: "", turmaFechada: "", turmaVizinha: "", prof: "", profB: "", ana: "", bia: "", caio: "", fabi: "", vizinho: "", pacote: "" };

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.equipesMontagem.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp03ef1bGateHistorico.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp03ef1bGateTurma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp03ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.matricula.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.escola.deleteMany({ where: { id: { in: ESCOLAS } } });
}

async function recusa(promessa: Promise<unknown>): Promise<{ status: number; corpo: Record<string, unknown> }> {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), corpo: e.getResponse() as Record<string, unknown> };
    throw e;
  }
  throw new Error("era para recusar, e passou");
}
const codigo = async (p: Promise<unknown>) => (await recusa(p)).corpo.codigo;

async function nivel(estudanteId: string, marcador: string) {
  const m = await prisma.evidenciaMarca.findFirst({ where: { escolaId: ESCOLA, expId: EXP_ID, estudanteId, marcador } });
  return m?.status ?? null;
}

const sessao = async (estudanteId: string) => SessaoSchema.parse(await service.sessao(ESCOLA, estudanteId, ids.turma));
const linha = (estudanteId: string) => prisma.exp03ef1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId }, orderBy: { rodada: "desc" } });
const gate = (acao: "liberar" | "pausar" | "retomar", para?: (typeof ETAPAS)[number]) =>
  service.mudarGate(ESCOLA, ids.turma, ids.prof, ids.prof, { acao, para });

/** Os ids das reportagens por suporte, nesta sessão. */
async function reportagens(estudanteId: string) {
  const s = await sessao(estudanteId);
  return Object.fromEntries(s.jornal.reportagens.map((r) => [r.suporte, r.id])) as Record<"mural" | "portal" | "telao", string>;
}

/** E1 e E2: os três selos e a escolha travada. */
async function ateAEscolha(estudanteId: string, escolha: ("mural" | "portal" | "telao")[]) {
  const rp = await reportagens(estudanteId);
  await service.selos(ESCOLA, estudanteId, ids.turma, [rp.mural, rp.portal, rp.telao]);
  await service.previsao(ESCOLA, estudanteId, ids.turma, escolha.map((s) => rp[s]));
}

/** E3 a E4-02 (com os dois portões já liberados): a busca, o confronto, a ficha e os carimbos. */
async function ateOReparo(estudanteId: string, o: { erros: number; dica: boolean; e4: Record<"k1" | "k2" | "k3", "v" | "x" | "duvida"> }) {
  for (let i = 0; i < o.erros; i++) await service.filtro(ESCOLA, estudanteId, ids.turma, "quando", "segunda");
  await service.filtro(ESCOLA, estudanteId, ids.turma, "onde", "patio");
  await service.pedirPasso(ESCOLA, estudanteId, ids.turma, "ficha");
  await service.ficha(ESCOLA, estudanteId, ids.turma, o.dica);
  await service.carimbos(ESCOLA, estudanteId, ids.turma, "e4", o.e4);
}

/** A ficha montada, por etiqueta, com os ids da sessão. */
async function montar(estudanteId: string, ficha: Record<"quem" | "onde" | "quando", "patio" | "estudantes" | "sexta">) {
  const s = await sessao(estudanteId);
  const id = (e: string) => s.reparo!.etiquetas.find((x) => x.etiqueta === e)!.id;
  return { quem: id(ficha.quem), onde: id(ficha.onde), quando: id(ficha.quando) };
}

/** A sequência dos blocos na ordem certa (os ids da sessão). */
async function rotinaCerta(estudanteId: string) {
  const s = await sessao(estudanteId);
  return SEQUENCIA_CERTA.map((b) => s.rotina!.blocos.find((x) => x.bloco === b)!.id);
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Nina (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  ids.turma = (await criarTurmaDeTeste(prisma, ESCOLA, "3A-NINA", "3EF")).id;
  ids.turmaFechada = (await criarTurmaDeTeste(prisma, ESCOLA, "3B-NINA", "3EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "3A vizinha", "3EF")).id;
  const pessoa = (escolaId: string, turmaId: string | null, username: string, nome: string, role = "estudante") =>
    prisma.user
      .create({ data: { role, escolaId, turmaId, username, displayName: nome, passwordHash: "x" }, select: { id: true } })
      .then((u) => u.id);
  ids.ana = await pessoa(ESCOLA, ids.turma, "nn.ana", "Ana Teste");
  ids.bia = await pessoa(ESCOLA, ids.turma, "nn.bia", "Bia Teste");
  ids.caio = await pessoa(ESCOLA, ids.turma, "nn.caio", "Caio Teste");
  ids.fabi = await pessoa(ESCOLA, ids.turmaFechada, "nn.fabi", "Fabi Teste");
  ids.vizinho = await pessoa(OUTRA_ESCOLA, ids.turmaVizinha, "nn.vizinho", "Vizinho Teste");
  ids.prof = await pessoa(ESCOLA, null, "nn.marta", "Marta Teste", "professor");
  ids.profB = await pessoa(ESCOLA, null, "nn.rui", "Rui Teste", "professor");
  await prisma.matricula.create({
    data: { escolaId: ESCOLA, turmaId: ids.turma, usuarioId: ids.prof, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
  });
  /* A PORTA DA SALA: a 3B fica SEM liberação, de propósito. */
  await liberarParaTeste(prisma, ESCOLA, ids.turma, EXP_ID, ids.prof);
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("a porta da sala e a missão vazia", () => {
  test("TODA rota de estudante recusa a turma sem a missão liberada (ADR-69)", async () => {
    const t = ids.turmaFechada;
    for (const chamada of [
      () => service.sessao(ESCOLA, ids.fabi, t),
      () => service.gate(ESCOLA, ids.fabi, t),
      () => service.selos(ESCOLA, ids.fabi, t, []),
      () => service.previsao(ESCOLA, ids.fabi, t, []),
      () => service.filtro(ESCOLA, ids.fabi, t, "onde", "patio"),
      () => service.ficha(ESCOLA, ids.fabi, t, false),
      () => service.carimbos(ESCOLA, ids.fabi, t, "e4", { k1: "v", k2: "x", k3: "v" }),
      () => service.reparo(ESCOLA, ids.fabi, t, { quem: "et-aaa", onde: "et-bbb", quando: "et-ccc" }),
      () => service.pedirPasso(ESCOLA, ids.fabi, t, "ficha"),
      () => service.rotina(ESCOLA, ids.fabi, t, []),
      () => service.concluir(ESCOLA, ids.fabi, t),
    ]) {
      expect(await codigo(chamada())).toBe("missao-nao-liberada");
    }
  });

  test("estudante de outra escola: 404; turma liberada sem atividade: 403 atividade-nao-preparada", async () => {
    expect(await codigo(service.sessao(ESCOLA, ids.vizinho, ids.turmaVizinha))).toBe("turma-nao-encontrada");
    const r = await recusa(service.sessao(ESCOLA, ids.ana, ids.turma));
    expect(r).toMatchObject({ status: 403, corpo: { codigo: "atividade-nao-preparada" } });
    expect(await codigo(service.painel(ESCOLA, ids.turma, ids.prof))).toBe("atividade-nao-preparada");
  });

  test("ADR-199: o banco padrão SEM pôr no ar nasce EM PREPARO (as imagens passam pela grade); o de novo é o MESMO, ganha as do banco que faltavam e segue em preparo", async () => {
    const r = await service.usarBancoPadrao(ESCOLA, ids.turma, ids.prof, ids.prof, false, { telao: "https://cdn/telao.webp" });
    expect(r).toMatchObject({ origem: "padrao", ativo: false });
    const lido = await prisma.exp03ef1bPacote.findUniqueOrThrow({ where: { id: r.id } });
    expect(lido.imagensAprovadasEm).toBeNull();
    expect(lido.midia).toEqual({ telao: "https://cdn/telao.webp" });
    expect(await codigo(service.colocarEmAndamento(ESCOLA, ids.turma, ids.prof, r.id))).toBe("imagens-nao-aprovadas");
    /* A grade da professora pode gerar: o pacote está em validação. */
    await expect(service.pacoteParaMidia(ESCOLA, ids.turma, ids.prof, r.id)).resolves.toMatchObject({ id: r.id });

    const denovo = await service.usarBancoPadrao(ESCOLA, ids.turma, ids.prof, ids.prof, false, {
      mural: "https://cdn/mural.webp",
      telao: "https://cdn/OUTRA.webp",
      "caso-a": "https://cdn/caso-a.webp",
    });
    expect(denovo.id).toBe(r.id);
    const relido = await prisma.exp03ef1bPacote.findUniqueOrThrow({ where: { id: r.id } });
    /* O que o pacote já tinha (inclusive uma imagem refeita) vence a do banco. */
    expect(relido.midia).toEqual({ telao: "https://cdn/telao.webp", mural: "https://cdn/mural.webp", "caso-a": "https://cdn/caso-a.webp" });
    expect(relido.imagensAprovadasEm).toBeNull();
  });

  test("ADR-199: o reaproveitado APROVADO e fora do ar com imagem faltando volta à aprovação; completo, segue aprovado", async () => {
    const pacote = await prisma.exp03ef1bPacote.findFirstOrThrow({ where: { escolaId: ESCOLA, turmaId: ids.turma, origem: "padrao" } });
    await service.aprovarImagens(ESCOLA, ids.turma, ids.prof, pacote.id);
    await service.usarBancoPadrao(ESCOLA, ids.turma, ids.prof, ids.prof, false);
    expect((await prisma.exp03ef1bPacote.findUniqueOrThrow({ where: { id: pacote.id } })).imagensAprovadasEm).toBeNull();

    const completas = { mural: "m", portal: "p", telao: "t", cartaz: "c" };
    await prisma.exp03ef1bPacote.update({ where: { id: pacote.id }, data: { midia: completas, imagensAprovadasEm: new Date() } });
    await service.usarBancoPadrao(ESCOLA, ids.turma, ids.prof, ids.prof, false);
    expect((await prisma.exp03ef1bPacote.findUniqueOrThrow({ where: { id: pacote.id } })).imagensAprovadasEm).not.toBeNull();
    /* Volta ao estado do teste seguinte: em preparo, sem imagens. */
    await prisma.exp03ef1bPacote.update({ where: { id: pacote.id }, data: { midia: {}, imagensAprovadasEm: null } });
  });

  test("o banco padrão no ar num toque; de novo, a MESMA atividade; a professora de outra turma recebe 404", async () => {
    expect(await codigo(service.usarBancoPadrao(ESCOLA, ids.turma, ids.profB, ids.profB, true))).toBe("turma-nao-encontrada");
    const r = await service.usarBancoPadrao(ESCOLA, ids.turma, ids.prof, ids.prof, true);
    expect(r).toMatchObject({ origem: "padrao", ativo: true, tema: "Feira de Troca de Livros" });
    ids.pacote = r.id;
    const denovo = await service.usarBancoPadrao(ESCOLA, ids.turma, ids.prof, ids.prof, true);
    expect(denovo.id).toBe(r.id);
    const pacotes = PacotesSchema.parse(await service.pacotes(ESCOLA, ids.turma, ids.prof));
    expect(pacotes.ativo).toMatchObject({ id: r.id, rodada: 1, etapa: "aposta" });
    expect(pacotes.historico).toHaveLength(1);
  });
});

describe("E1 e E2: a galeria e a escolha", () => {
  test("a sessão traz o jornal SEM ficha e sem gabarito, com ids opacos, na versão do instrumento", async () => {
    const s = await sessao(ids.ana);
    expect(s).toMatchObject({ passo: "galeria", etapa: "aposta", pausada: false, aguardandoOProfessor: false, rodada: 1 });
    expect(s.jornal.reportagens.map((r) => r.suporte)).toEqual(["mural", "portal", "telao"]);
    expect(s.jornal.reportagens.every((r) => r.lugar === "Pátio escolar")).toBe(true);
    for (const bloco of [s.filtro, s.ficha, s.reparo, s.rotina, s.caso, s.fim]) expect(bloco).toBeNull();
    const texto = JSON.stringify(s);
    expect(texto).not.toMatch(/"certo"|"ficha":\{|"onde":/);
    expect((await linha(ids.ana)).versaoInstrumento).toBe(VERSAO_DO_INSTRUMENTO);
  });

  test("os selos se somam; com os três, o passo vai à escolha", async () => {
    const rp = await reportagens(ids.ana);
    const um = RespostaDosSelosSchema.parse(await service.selos(ESCOLA, ids.ana, ids.turma, [rp.mural]));
    expect(um).toMatchObject({ passo: "galeria", selos: [rp.mural] });
    expect(await codigo(service.selos(ESCOLA, ids.ana, ids.turma, ["rp-zzz"]))).toBe("reportagem-desconhecida");
    const tres = await service.selos(ESCOLA, ids.ana, ids.turma, [rp.portal, rp.telao]);
    expect(tres).toMatchObject({ passo: "aposta" });
    expect(tres.selos).toHaveLength(3);
  });

  test("PAUSAR congela tudo (409 turma-pausada) e aparece no polling; RETOMAR solta; o histórico guarda os dois", async () => {
    const p = GateDaTurmaSchema.parse(await gate("pausar"));
    expect(p).toMatchObject({ pausada: true, mudou: true, etapa: "aposta", proximaEtapa: "filtro" });
    expect((await gate("pausar")).mudou).toBe(false);
    expect(GatePublicoSchema.parse(await service.gate(ESCOLA, ids.ana, ids.turma))).toMatchObject({ pausada: true, passo: "aposta" });
    expect(await codigo(service.previsao(ESCOLA, ids.ana, ids.turma, []))).toBe("turma-pausada");
    expect((await sessao(ids.ana)).pausada).toBe(true);
    await gate("retomar");
    const historico = await prisma.exp03ef1bGateHistorico.findMany({ where: { escolaId: ESCOLA }, orderBy: { em: "asc" } });
    expect(historico.map((h) => h.acao)).toEqual(["pausar", "retomar"]);
    expect(historico[0]).toMatchObject({ professorId: ids.prof, rodada: 1, etapa: "aposta" });
  });

  test("TRAVAR ESCOLHA é o latch: vazia é 409, a primeira trava e espera o portão, a segunda é 409", async () => {
    expect(await codigo(service.previsao(ESCOLA, ids.ana, ids.turma, []))).toBe("previsao-vazia");
    const rp = await reportagens(ids.ana);
    const r = EstadoSchema.parse(await service.previsao(ESCOLA, ids.ana, ids.turma, [rp.mural, rp.portal]));
    expect(r).toMatchObject({ passo: "aposta", aguardandoOProfessor: true });
    expect(await codigo(service.previsao(ESCOLA, ids.ana, ids.turma, [rp.telao]))).toBe("previsao-ja-travada");
    expect((await linha(ids.ana)).previsaoItens).toEqual(["mural", "portal"]);
    const s = await sessao(ids.ana);
    expect(s).toMatchObject({ passoDoEstudante: "filtro", previsao: { travada: true } });
  });

  test("dois toques SIMULTÂNEOS no Travar Escolha: um trava, o outro é 409", async () => {
    const rp = await reportagens(ids.bia);
    await service.selos(ESCOLA, ids.bia, ids.turma, [rp.mural, rp.portal, rp.telao]);
    const [a, b] = await Promise.allSettled([
      service.previsao(ESCOLA, ids.bia, ids.turma, [rp.mural]),
      service.previsao(ESCOLA, ids.bia, ids.turma, [rp.mural]),
    ]);
    const ok = [a, b].filter((x) => x.status === "fulfilled");
    const falhou = [a, b].filter((x): x is PromiseRejectedResult => x.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(((falhou[0]!.reason as HttpException).getResponse() as { codigo: string }).codigo).toBe("previsao-ja-travada");
    await ateAEscolha(ids.caio, ["mural", "portal", "telao"]);
  });
});

describe("E3: os portões e o filtro", () => {
  test("antes do Liberar Filtro, a busca é 403 etapa-nao-liberada; o portão só avança", async () => {
    expect(await codigo(service.filtro(ESCOLA, ids.ana, ids.turma, "onde", "patio"))).toBe("etapa-nao-liberada");
    expect(await codigo(service.mudarGate(ESCOLA, ids.turma, ids.prof, ids.prof, { acao: "liberar", para: "inspecao" }))).toBe(
      "transicao-de-etapa-invalida",
    );
    const r = await gate("liberar");
    expect(r).toMatchObject({ etapa: "filtro", mudou: true, proximaEtapa: "inspecao" });
    expect((await gate("liberar", "filtro")).mudou).toBe(false);
    expect(await codigo(gate("liberar", "aposta"))).toBe("transicao-de-etapa-invalida");
    expect(await sessao(ids.ana)).toMatchObject({ passo: "filtro", aguardandoOProfessor: false });
  });

  test("o filtro errado devolve zero e CONTA; Onde = Pátio encontra as duas do pátio (o telão fica de fora)", async () => {
    const quem = RespostaDoFiltroSchema.parse(await service.filtro(ESCOLA, ids.ana, ids.turma, "quem", "professores"));
    expect(quem).toMatchObject({ total: 0, encontradas: [], passo: "filtro" });
    expect((await service.filtro(ESCOLA, ids.ana, ids.turma, "onde", "quadra")).total).toBe(0);
    expect(await codigo(service.filtro(ESCOLA, ids.ana, ids.turma, "onde", "sotao"))).toBe("valor-de-filtro-invalido");
    expect((await linha(ids.ana)).filtroTentativas).toBe(2);
    const rp = await reportagens(ids.ana);
    const certo = await service.filtro(ESCOLA, ids.ana, ids.turma, "onde", "patio");
    expect(certo).toMatchObject({ total: 2, encontradas: [rp.mural, rp.portal], passo: "omissao" });
    /* Depois da certa, buscar de novo só responde, sem contar. */
    await service.filtro(ESCOLA, ids.ana, ids.turma, "quem", "familias");
    expect((await linha(ids.ana)).filtroTentativas).toBe(2);
    const s = await sessao(ids.ana);
    expect(s.filtro?.encontradas).toEqual([rp.mural, rp.portal]);
    expect(s.ficha).toBeNull();
  });

  test("Confrontar e Aguardar Turma: a ficha espera o Liberar Inspeção (403 antes dele)", async () => {
    const r = await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "ficha");
    expect(r).toMatchObject({ passo: "omissao", aguardandoOProfessor: true });
    expect(await codigo(service.ficha(ESCOLA, ids.ana, ids.turma, false))).toBe("etapa-nao-liberada");
    expect(await codigo(service.pedirPasso(ESCOLA, ids.ana, ids.turma, "ponte"))).toBe("passo-invalido");
    expect((await sessao(ids.ana)).ficha).toBeNull();
    await gate("liberar", "inspecao");
    expect(await codigo(gate("liberar"))).toBe("transicao-de-etapa-invalida");
    expect(await sessao(ids.ana)).toMatchObject({ passo: "ficha", aguardandoOProfessor: false });
  });
});

describe("E4: a ficha, os carimbos e o reparo", () => {
  test("a ficha do telão tem Onde VAZIO; abrir marca a EF15CO08 — em processo para quem errou o filtro", async () => {
    const r = RespostaDaFichaSchema.parse(await service.ficha(ESCOLA, ids.ana, ids.turma, false));
    expect(r.ficha.ficha).toEqual({ quem: "estudantes", onde: null, quando: "sexta" });
    expect(r.passo).toBe("carimbos");
    expect(await nivel(ids.ana, "inspecao")).toBe("em_processo");
    /* Abrir de novo devolve a ficha e não marca outra vez. */
    await service.ficha(ESCOLA, ids.ana, ids.turma, true);
    expect((await linha(ids.ana)).dicaInspecaoUsada).toBe(false);
  });

  test("certo de primeira e sem o pulso: atingiu; com o pulso: em processo", async () => {
    await service.filtro(ESCOLA, ids.caio, ids.turma, "onde", "patio");
    await service.pedirPasso(ESCOLA, ids.caio, ids.turma, "ficha");
    await service.ficha(ESCOLA, ids.caio, ids.turma, false);
    expect(await nivel(ids.caio, "inspecao")).toBe("atingiu");
    await ateOReparo(ids.bia, { erros: 0, dica: true, e4: { k1: "v", k2: "v", k3: "v" } });
    expect(await nivel(ids.bia, "inspecao")).toBe("em_processo");
  });

  test("os carimbos da E4 vão uma vez, sem retorno de acerto, e levam ao reparo", async () => {
    expect(await codigo(service.carimbos(ESCOLA, ids.ana, ids.turma, "e6", { k4: "v", k5: "duvida", k6: "x" }))).toBe(
      "passo-fora-de-ordem",
    );
    const r = await service.carimbos(ESCOLA, ids.ana, ids.turma, "e4", { k1: "v", k2: "x", k3: "v" });
    expect(Object.keys(r).sort()).toEqual(["aguardandoOProfessor", "etapa", "passo", "pausada"]);
    expect(r.passo).toBe("reparo");
    expect(await codigo(service.carimbos(ESCOLA, ids.ana, ids.turma, "e4", { k1: "v", k2: "x", k3: "v" }))).toBe(
      "carimbos-ja-enviados",
    );
    await service.carimbos(ESCOLA, ids.caio, ids.turma, "e4", { k1: "v", k2: "x", k3: "duvida" });
  });

  test("o reparo recusa a etiqueta repetida e a de outra sessão; Pátio em Onde é SUCESSO (EF03CO03 atingiu; a EF15CO01 saiu da ficha, ADR-200)", async () => {
    const s = await sessao(ids.ana);
    expect(s.reparo?.etiquetas.map((e) => e.etiqueta)).toEqual(["patio", "estudantes", "sexta"]);
    expect(s.reparo?.desfecho).toBeNull();
    const repetida = await montar(ids.ana, { quem: "patio", onde: "patio", quando: "sexta" });
    expect(await codigo(service.reparo(ESCOLA, ids.ana, ids.turma, repetida))).toBe("reparo-incompleto");
    const certa = await montar(ids.ana, { quem: "estudantes", onde: "patio", quando: "sexta" });
    expect(await codigo(service.reparo(ESCOLA, ids.ana, ids.turma, { ...certa, quem: "et-zzz" }))).toBe("etiqueta-desconhecida");
    const r = RespostaDoReparoSchema.parse(await service.reparo(ESCOLA, ids.ana, ids.turma, certa));
    expect(r).toMatchObject({ desfecho: "sucesso", passo: "desfecho" });
    expect(await nivel(ids.ana, "reparo")).toBe("atingiu");
    expect(await nivel(ids.ana, "previsao")).toBeNull();
    expect(await codigo(service.reparo(ESCOLA, ids.ana, ids.turma, certa))).toBe("reparo-ja-enviado");
    expect((await sessao(ids.ana)).reparo).toMatchObject({ desfecho: "sucesso", enviada: certa });
  });

  test("Pátio fora de Onde é ERRO (em processo), sem 'tentar de novo'", async () => {
    const errada = await montar(ids.bia, { quem: "patio", onde: "sexta", quando: "estudantes" });
    expect(await service.reparo(ESCOLA, ids.bia, ids.turma, errada)).toMatchObject({ desfecho: "erro" });
    expect(await nivel(ids.bia, "reparo")).toBe("em_processo");
    expect(await nivel(ids.bia, "previsao")).toBeNull();
    expect((await linha(ids.bia)).reparoPosicoes).toEqual({ quem: "patio", onde: "sexta", quando: "estudantes" });
  });
});

describe("E5 e E6: a rotina, o caso novo e o fim", () => {
  test("ponte e rotina: a bandeja é embaralhada e gravada; incompleta não conta; inválida conta; válida marca (2 testes = atingiu)", async () => {
    await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "ponte");
    await service.pedirPasso(ESCOLA, ids.ana, ids.turma, "rotina");
    const s = await sessao(ids.ana);
    expect(s.rotina?.blocos.map((b) => b.bloco)).not.toEqual([...SEQUENCIA_CERTA]);
    expect((await linha(ids.ana)).rotinaOrdemBandeja).toEqual(s.rotina?.blocos.map((b) => b.bloco));
    const bandeja = s.rotina!.blocos.map((b) => b.id);
    expect(await codigo(service.rotina(ESCOLA, ids.ana, ids.turma, bandeja.slice(0, 6)))).toBe("rotina-incompleta");
    const invalida = RespostaDaRotinaSchema.parse(await service.rotina(ESCOLA, ids.ana, ids.turma, bandeja));
    expect(invalida).toMatchObject({ valida: false, simulacao: null, passo: "rotina" });
    expect((await linha(ids.ana)).rotinaTentativas).toBe(1);
    const valida = await service.rotina(ESCOLA, ids.ana, ids.turma, await rotinaCerta(ids.ana));
    expect(valida).toMatchObject({ valida: true, passo: "caso" });
    expect(valida.simulacao?.map((p) => p.marca)).toEqual(["ok", "revisar", "ok"]);
    expect(await nivel(ids.ana, "rotina")).toBe("atingiu");
    expect((await linha(ids.ana)).rotinaTentativas).toBe(2);
  });

  test("o caso novo: concluir sem carimbos é 409; os seis carimbos marcam a EF03CO01; o fim traz o painel, sem o Desafio Extra (ADR-201)", async () => {
    const s = await sessao(ids.ana);
    expect(s.caso?.materias.map((m) => m.ficha.quando)).toEqual([null, null]);
    expect(await codigo(service.concluir(ESCOLA, ids.ana, ids.turma))).toBe("carimbos-pendentes");
    await service.carimbos(ESCOLA, ids.ana, ids.turma, "e6", { k4: "v", k5: "duvida", k6: "x" });
    expect(await nivel(ids.ana, "carimbos")).toBe("atingiu");
    const fim = RespostaDoConcluirSchema.parse(await service.concluir(ESCOLA, ids.ana, ids.turma));
    expect(fim).toMatchObject({
      passo: "fim",
      resumo: { suportes: { escolhidas: 2 }, omissao: { encontradas: 2, deFora: "telao" }, reparo: { desfecho: "sucesso" }, automacao: { testes: 2 } },
    });
    expect((await service.concluir(ESCOLA, ids.ana, ids.turma)).passo).toBe("fim");
    const final = await sessao(ids.ana);
    expect(final.concluida).toBe(true);
    expect(final.fim).toEqual({ resumo: expect.any(Object) });
  });

  test("carimbos uniformes NÃO atingem; mais de três testes sem parar acendem o alerta", async () => {
    await service.pedirPasso(ESCOLA, ids.bia, ids.turma, "ponte");
    await service.pedirPasso(ESCOLA, ids.bia, ids.turma, "rotina");
    const bandeja = (await sessao(ids.bia)).rotina!.blocos.map((b) => b.id);
    for (let i = 0; i < 4; i++) await service.rotina(ESCOLA, ids.bia, ids.turma, bandeja);
    expect(await nivel(ids.bia, "rotina")).toBeNull();
    const painel = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.prof));
    const daBia = painel.linhas.find((l) => l.estudanteId === ids.bia)!;
    expect(daBia.alertas).toEqual({ semParada: true, uniformes: true });
    await service.rotina(ESCOLA, ids.bia, ids.turma, await rotinaCerta(ids.bia));
    expect(await nivel(ids.bia, "rotina")).toBe("em_processo");
    await service.carimbos(ESCOLA, ids.bia, ids.turma, "e6", { k4: "v", k5: "duvida", k6: "x" });
    expect(await nivel(ids.bia, "carimbos")).toBe("nao_atingiu");
  });
});

describe("o painel, o material e o banco", () => {
  test("o painel: progresso e alerta por linha, nunca acerto ou escolha; as escolhas da Etapa 2 só no agregado", async () => {
    const p = PainelSchema.parse(await service.painel(ESCOLA, ids.turma, ids.prof));
    expect(p).toMatchObject({ etapa: "inspecao", pausada: false, proximaEtapa: null, rodada: 1 });
    for (const l of p.linhas) {
      for (const chave of Object.keys(l)) {
        for (const proibido of PROIBIDO_NA_LINHA_DO_PAINEL) expect(chave.toLowerCase()).not.toContain(proibido);
      }
    }
    expect(p.linhas.find((l) => l.estudanteId === ids.ana)).toMatchObject({ passo: "fim", etapaVisivel: 6, concluiu: true });
    expect(p.resumo.escolhas).toMatchObject({ travadas: 3, uma: 1, duas: 1, tres: 1, deFora: { mural: 0, portal: 1, telao: 2 } });
    expect(p.resumo).toMatchObject({ total: 3, entraram: 3, concluiram: 1, porComputador: false });
    expect(p.resumo.alertas.uniformes).toBe(1);
  });

  test("o material da professora traz o gabarito, o roteiro e os gatilhos", async () => {
    const m = MaterialSchema.parse(await service.material(ESCOLA, ids.turma, ids.prof));
    expect(m.cartoes.map((c) => c.certo)).toEqual(["v", "x", "v", "v", "duvida", "x"]);
    expect(m.rotina.sequencia.map((b) => b.bloco)).toEqual([...SEQUENCIA_CERTA]);
    expect(m.pacote?.reportagens[2]?.ficha.onde).toBeNull();
    expect(m.gatilhos.join(" ")).not.toMatch(/aposta/i);
  });

  test("os CHECKs são a rede final, e repetem o vocabulário", async () => {
    const onde = { escolaId: ESCOLA, estudanteId: ids.ana };
    await expect(prisma.exp03ef1bSessao.updateMany({ where: onde, data: { concluidaEm: null } })).rejects.toThrow(/exp03ef1b_sessoes_conclusao_check/);
    await expect(prisma.exp03ef1bSessao.updateMany({ where: onde, data: { reparoValido: false } })).rejects.toThrow(/exp03ef1b_sessoes_reparo_check/);
    await expect(prisma.exp03ef1bSessao.updateMany({ where: onde, data: { previsaoItens: [] } })).rejects.toThrow(/exp03ef1b_sessoes_previsao_check/);
    await expect(prisma.exp03ef1bSessao.updateMany({ where: onde, data: { carimbosE6: { k4: "talvez" } } })).rejects.toThrow(
      /exp03ef1b_sessoes_carimbos_e6_check/,
    );
    await expect(prisma.exp03ef1bGateTurma.updateMany({ where: { escolaId: ESCOLA }, data: { pausada: true } })).rejects.toThrow(
      /exp03ef1b_gates_turma_pausa_check/,
    );
    await expect(prisma.exp03ef1bPacote.updateMany({ where: { escolaId: ESCOLA }, data: { disciplina: "quimica" } })).rejects.toThrow(
      /exp03ef1b_pacotes_disciplina_check/,
    );
    /* Um segundo pacote no ar na mesma turma: o índice parcial recusa. */
    await expect(
      prisma.exp03ef1bPacote.create({
        data: {
          escolaId: ESCOLA,
          turmaId: ids.turma,
          origem: "padrao",
          disciplina: "arte",
          tema: "x",
          assuntos: "x",
          conteudo: conteudoDoBancoPadrao() as object,
          ativo: true,
          imagensAprovadasEm: new Date(),
          criadoPor: ids.prof,
        },
      }),
    ).rejects.toThrow(/exp03ef1b_pacotes_um_ativo_por_turma|Unique constraint/);

    const definicao = async (nome: string) =>
      (
        await prisma.$queryRawUnsafe<{ def: string }[]>(
          `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = '${nome}'`,
        )
      )[0]!.def;
    const disciplinas = await definicao("exp03ef1b_pacotes_disciplina_check");
    for (const d of DISCIPLINAS) expect(disciplinas).toContain(`'${d}'`);
    expect(disciplinas.match(/'[a-z-]+'/g)).toHaveLength(DISCIPLINAS.length);
    const passos = await definicao("exp03ef1b_sessoes_passo_check");
    expect(passos.match(/'[a-z]+'/g)).toEqual(PASSOS.map((p) => `'${p}'`));
    const etapas = await definicao("exp03ef1b_gates_turma_etapa_check");
    expect(etapas.match(/'[a-z]+'/g)).toEqual(ETAPAS.map((e) => `'${e}'`));
  });

  test("a role SEM BYPASSRLS só enxerga a própria escola, nas quatro tabelas", async () => {
    const daEscola = await runtime.comTenancy((tx) => tx.exp03ef1bSessao.count(), ESCOLA);
    const daVizinha = await runtime.comTenancy((tx) => tx.exp03ef1bSessao.count({ where: { escolaId: ESCOLA } }), OUTRA_ESCOLA);
    expect(daEscola).toBeGreaterThan(0);
    expect(daVizinha).toBe(0);
    expect(await runtime.comTenancy((tx) => tx.exp03ef1bPacote.count(), OUTRA_ESCOLA)).toBe(0);
    for (const tabela of ["exp03ef1b_pacotes", "exp03ef1b_gates_turma", "exp03ef1b_gates_historico", "exp03ef1b_sessoes"]) {
      const [l] = await prisma.$queryRawUnsafe<{ rls: boolean; forcada: boolean }[]>(
        `SELECT relrowsecurity AS rls, relforcerowsecurity AS forcada FROM pg_class WHERE relname = '${tabela}'`,
      );
      expect(l).toEqual({ rls: true, forcada: true });
    }
  });

  test("zerar: rodada 2, a evidência da atividade apagada, as sessões antigas guardadas, a etapa de volta à escolha", async () => {
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, expId: EXP_ID } })).toBeGreaterThan(0);
    await gate("pausar");
    const r = ZerarTurmaSchema.parse(await service.zerar(ESCOLA, ids.turma, ids.prof, ids.prof));
    expect(r).toEqual({ pacoteId: ids.pacote, rodada: 2, etapa: "aposta" });
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, expId: EXP_ID } })).toBe(0);
    expect(await prisma.evidencia.count({ where: { escolaId: ESCOLA, expId: EXP_ID } })).toBe(0);
    expect(await prisma.exp03ef1bSessao.count({ where: { escolaId: ESCOLA, rodada: 1 } })).toBe(3);
    const s = await sessao(ids.ana);
    expect(s).toMatchObject({ rodada: 2, passo: "galeria", pausada: false, concluida: false });
    const g = await prisma.exp03ef1bGateTurma.findFirstOrThrow({ where: { escolaId: ESCOLA } });
    expect(g).toMatchObject({ filtroLiberadoEm: null, inspecaoLiberadaEm: null, pausadaEm: null });
    const ultimo = await prisma.exp03ef1bGateHistorico.findFirstOrThrow({ where: { escolaId: ESCOLA }, orderBy: { em: "desc" } });
    expect(ultimo).toMatchObject({ acao: "zerar", rodada: 2, etapa: "aposta" });
  });
});
