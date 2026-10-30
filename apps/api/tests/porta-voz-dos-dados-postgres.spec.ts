import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import type { AiJsonRequest, AiProvider } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import type { AuthClaims } from "../src/auth/claims";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { CAMADAS_DO_COMPOSITOR, EXP_ID, PACOTE_PADRAO, TEXTO_DA_PROJECAO, conteudoDoPadrao } from "../src/porta-voz-dos-dados/conteudo";
import {
  RespostaEmAndamentoSchema,
  RespostaGerarConteudoSchema,
  RespostaHomologarPacoteSchema,
  RespostaListarPacotesSchema,
  RespostaMaterialProfessorSchema,
  RespostaPacoteSchema,
  RespostaPainelSchema,
  SessaoSchema,
} from "../src/porta-voz-dos-dados/contrato-de-rotas";
import { PortaVozDosDadosTurmasController } from "../src/porta-voz-dos-dados/porta-voz-dos-dados-turmas.controller";
import { PortaVozDosDadosService } from "../src/porta-voz-dos-dados/porta-voz-dos-dados.service";
import { PreparoDaExp03em1bService } from "../src/porta-voz-dos-dados/preparo.service";
import { SCHEMA_DO_PREPARO } from "../src/porta-voz-dos-dados/prompts";
import { PrismaService } from "../src/prisma/prisma.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O Porta-Voz dos Dados (exp03em1b, ADR-198) no Postgres: o que só o banco
 * responde. A porta da sala em TODA rota de estudante, a missão que nasce
 * vazia, o preparo com a quota (e o 404 antes de gastar token), a curadoria
 * (regenerar, homologar que só aprova, em-andamento), o latch com a EM13CO13,
 * a pausa, a errata e a perícia com as marcas NA MESMA transação, os latches
 * concorrentes, a idempotência, o gabarito ausente, o painel só de contagens,
 * a RLS com a role sem `BYPASSRLS` e o zerar.
 *
 * Os testes dependem da ORDEM: é a aula, na sequência em que ela acontece.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-porta-voz";
const OUTRA_ESCOLA = "teste-porta-voz-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/** A IA de mentira: o pacote inteiro é o banco padrão; o item regenerado troca o recorte. */
let modoDaIa: "escreve" | "falha" = "escreve";
let chamadasDaIa = 0;
const ia = {
  async generateJson<T>(req: AiJsonRequest<T>): Promise<T> {
    chamadasDaIa += 1;
    if (modoDaIa === "falha") throw new Error("vendor fora do ar");
    req.aoUsarTokens?.(700);
    if (req.responseSchema === SCHEMA_DO_PREPARO) return req.validar(conteudoDoPadrao());
    const item = req.responseSchema.required?.[0] ?? "";
    const novo: Record<string, unknown> = { grupo: "Qualidade da Água do Bairro" };
    return req.validar({ [item]: novo[item] ?? (conteudoDoPadrao() as unknown as Record<string, unknown>)[item] });
  },
} as unknown as AiProvider;

const equipes = new EquipesService(prisma);
const evidencias = new EvidenciasService(prisma, equipes);
const quota = new QuotaService(prisma);
const preparo = new PreparoDaExp03em1bService(ia, quota);
const service = new PortaVozDosDadosService(prisma, evidencias, preparo);
const controller = new PortaVozDosDadosTurmasController(service);
evidencias.onModuleInit();

const ids = { turmaA: "", turmaB: "", turmaC: "", turmaVizinha: "", prof: "", profB: "", ana: "", bia: "", caio: "", davi: "", edu: "", fabi: "", vizinho: "", rascunho: "" };

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidencia.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp03em1bGateHistorico.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp03em1bPublicacao.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp03em1bSessao.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp03em1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp03em1bGateTurma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
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

const P0 = { escala: 0 as const, explicacao: true, fonte: true, contexto: false, projecao: false };
const P80 = { escala: 80 as const, explicacao: false, fonte: false, contexto: false, projecao: false };

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Porta-Voz (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  ids.turmaA = (await criarTurmaDeTeste(prisma, ESCOLA, "3EM-A", "3EM")).id;
  ids.turmaB = (await criarTurmaDeTeste(prisma, ESCOLA, "3EM-B", "3EM")).id;
  ids.turmaC = (await criarTurmaDeTeste(prisma, ESCOLA, "3EM-C", "3EM")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "3EM vizinha", "3EM")).id;
  const pessoa = (escolaId: string, turmaId: string | null, username: string, nome: string, role = "estudante") =>
    prisma.user.create({ data: { role, escolaId, turmaId, username, displayName: nome, passwordHash: "x" }, select: { id: true } }).then((u) => u.id);
  ids.ana = await pessoa(ESCOLA, ids.turmaA, "pv.ana", "Ana Teste");
  ids.bia = await pessoa(ESCOLA, ids.turmaA, "pv.bia", "Bia Teste");
  ids.caio = await pessoa(ESCOLA, ids.turmaA, "pv.caio", "Caio Teste");
  ids.davi = await pessoa(ESCOLA, ids.turmaA, "pv.davi", "Davi Teste");
  ids.edu = await pessoa(ESCOLA, ids.turmaB, "pv.edu", "Edu Teste");
  ids.fabi = await pessoa(ESCOLA, ids.turmaC, "pv.fabi", "Fabi Teste");
  ids.vizinho = await pessoa(OUTRA_ESCOLA, ids.turmaVizinha, "pv.vizinho", "Vizinho Teste");
  ids.prof = await pessoa(ESCOLA, null, "pv.marta", "Marta Teste", "professor");
  ids.profB = await pessoa(ESCOLA, null, "pv.rui", "Rui Teste", "professor");
  const lecionar = (turmaId: string, usuarioId: string) =>
    prisma.matricula.create({ data: { escolaId: ESCOLA, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) } });
  await lecionar(ids.turmaA, ids.prof);
  await lecionar(ids.turmaB, ids.profB);
  /* A PORTA DA SALA: a 3EM-C fica SEM liberação, de propósito. */
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
      () => service.marco(ESCOLA, ids.fabi, "chat_aberto"),
      () => service.publicar(ESCOLA, ids.fabi, P0),
      () => service.publicarErrata(ESCOLA, ids.fabi, P0),
      () => service.pularErrata(ESCOLA, ids.fabi),
      () => service.emitirParecer(ESCOLA, ids.fabi, { sinalizouA: false, motivoA: null, sinalizouB: true, motivoB: "escala" }),
      () => service.pularPericia(ESCOLA, ids.fabi),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 403, corpo: { codigo: "missao-nao-liberada" } });
    }
  });

  test("estudante de OUTRA escola: 404", async () => {
    expect(await recusa(service.sessao(ESCOLA, ids.vizinho))).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
  });
});

describe("a missão nasce VAZIA", () => {
  test("sem pacote no ar: espera; as jogadas e o gate do professor também esperam", async () => {
    const s = SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana));
    expect(s).toMatchObject({ preparada: false, passo: "abertura", etapaDaTurma: null, conteudo: null, slotsRestantes: 3 });
    expect(await codigo(service.marco(ESCOLA, ids.ana, "chat_aberto"))).toBe("atividade-nao-preparada");
    expect(await codigo(service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "pausa"))).toBe("pacote-nao-aprovado");
  });
});

describe("o preparo do professor", () => {
  test("404, nunca 403, na turma que não leciona — e o gerar não gasta token antes", async () => {
    const antes = chamadasDaIa;
    for (const chamada of [
      () => service.pacotes(ESCOLA, ids.turmaB, ids.prof),
      () => service.gerar(ESCOLA, ids.turmaB, ids.prof, "professor", { disciplina: "biologia", tema: "Água", assuntos: ["a1", "b2", "c3"] }),
      () => service.usarPadrao(ESCOLA, ids.turmaB, ids.prof),
      () => service.painel(ESCOLA, ids.turmaB, ids.prof),
      () => service.mudarGate(ESCOLA, ids.turmaB, ids.prof, "pausa"),
    ]) {
      expect(await recusa(chamada)).toMatchObject({ status: 404, corpo: { codigo: "turma-nao-encontrada" } });
    }
    expect(chamadasDaIa).toBe(antes);
  });

  test("gerar com IA grava UM rascunho (origem ia), conta a geração e debita a quota do professor", async () => {
    const r = RespostaGerarConteudoSchema.parse(
      await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "biologia", tema: "Água da cidade", assuntos: ["Coleta", "Amostras", "Tubulação"], contexto: "Vila Nova" }),
    );
    expect(r).toMatchObject({ usouIa: true, motivo: null, pacote: { origem: "ia", tema: "Água da cidade", contexto: "Vila Nova", aprovadoEm: null } });
    ids.rascunho = r.pacote.id;
    expect(await prisma.exp03em1bPacote.findUniqueOrThrow({ where: { id: ids.rascunho } })).toMatchObject({ iaGeracoes: 1, iaTokens: 700 });
    expect(await prisma.iaUsoDiario.count({ where: { escolaId: ESCOLA, usuarioId: ids.prof } })).toBeGreaterThan(0);
  });

  test("com o vendor fora, o rascunho sai do banco curado — e continua um só", async () => {
    modoDaIa = "falha";
    const r = await service.gerar(ESCOLA, ids.turmaA, ids.prof, "professor", { disciplina: "historia", tema: "Memória", assuntos: ["a1", "b2", "c3"] });
    modoDaIa = "escreve";
    expect(r).toMatchObject({ usouIa: false, motivo: "indisponivel", pacote: { id: ids.rascunho, origem: "padrao", tema: PACOTE_PADRAO.tema } });
    expect(await prisma.exp03em1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, aprovadoEm: null } })).toBe(1);
  });

  test("Regenerar Item: só o item pedido muda", async () => {
    const r = RespostaGerarConteudoSchema.parse(await service.regenerar(ESCOLA, ids.turmaA, ids.prof, "professor", ids.rascunho, "grupo"));
    expect(r.usouIa).toBe(true);
    expect(r.pacote.conteudo.grupo).toBe("Qualidade da Água do Bairro");
    expect(r.pacote.conteudo.reacoes).toEqual(conteudoDoPadrao().reacoes);
  });

  test("a lista e o detalhe trazem o rascunho", async () => {
    const l = RespostaListarPacotesSchema.parse(await service.pacotes(ESCOLA, ids.turmaA, ids.prof));
    expect(l.emAndamento).toBeNull();
    expect(l.pacotes).toHaveLength(1);
    expect(l.pacotes[0]).toMatchObject({ id: ids.rascunho, aprovadoEm: null });
    expect(l.padrao.tema).toBe(PACOTE_PADRAO.tema);
    expect(RespostaPacoteSchema.parse(await service.pacote(ESCOLA, ids.turmaA, ids.prof, ids.rascunho)).rodadas).toBe(0);
  });

  test("rascunho não vai ao ar; a homologação passa a régua; homologar só aprova", async () => {
    expect(await codigo(controller.emAndamento(ids.turmaA, undefined, { pacoteId: ids.rascunho }, req(ids.prof)))).toBe("pacote-nao-homologado");
    const ruim = { ...conteudoDoPadrao(), camadas: { ...conteudoDoPadrao().camadas, explicacao: { zero: "eixo em 80% desde o começo", oitenta: "eixo em 80% desde o começo" } } };
    const r = await recusa(controller.homologar(ids.turmaA, ids.rascunho, undefined, { conteudo: ruim }, req(ids.prof)));
    expect(r).toMatchObject({ status: 400, corpo: { codigo: "pacote-invalido" } });
    expect((r.corpo.erros as string[]).length).toBeGreaterThan(0);

    const h = RespostaHomologarPacoteSchema.parse(await controller.homologar(ids.turmaA, ids.rascunho, undefined, {}, req(ids.prof)));
    expect(h).toMatchObject({ pacoteId: ids.rascunho, pacote: { ativo: false } });
    /* De novo: idempotente. Mudar um homologado: 409. Regenerar um homologado: 409. */
    expect((await controller.homologar(ids.turmaA, ids.rascunho, undefined, {}, req(ids.prof))).homologadoEm).toBe(h.homologadoEm);
    expect(await codigo(service.homologar(ESCOLA, ids.turmaA, ids.prof, ids.rascunho, conteudoDoPadrao()))).toBe("pacote-ja-homologado");
    expect(await codigo(service.regenerar(ESCOLA, ids.turmaA, ids.prof, "professor", ids.rascunho, "grupo"))).toBe("pacote-ja-homologado");
  });

  test("em-andamento põe no ar, abre a rodada 1 e é idempotente", async () => {
    const r = RespostaEmAndamentoSchema.parse(await controller.emAndamento(ids.turmaA, undefined, { pacoteId: ids.rascunho }, req(ids.prof)));
    expect(r).toEqual({ atividade: { pacoteId: ids.rascunho, rodada: 1 }, etapa: "exploracao", mudou: true });
    expect((await service.colocarEmAndamento(ESCOLA, ids.turmaA, ids.prof, ids.rascunho)).mudou).toBe(false);
  });

  test("o banco padrão em 2 toques: homologado e no ar, idempotente", async () => {
    const r = RespostaEmAndamentoSchema.parse(await service.usarPadrao(ESCOLA, ids.turmaB, ids.profB));
    expect(r).toMatchObject({ etapa: "exploracao", mudou: true });
    expect((await service.usarPadrao(ESCOLA, ids.turmaB, ids.profB)).mudou).toBe(false);
    expect(await prisma.exp03em1bPacote.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaB } })).toBe(1);
  });
});

describe("a aula", () => {
  test("ana: o anexo antes do compositor → CO13 atingiu; a 1ª publicação gasta o slot 1", async () => {
    await service.marco(ESCOLA, ids.ana, "chat_aberto");
    await service.marco(ESCOLA, ids.ana, "anexo_aberto");
    await service.marco(ESCOLA, ids.ana, "compositor_aberto");
    const s = SessaoSchema.parse(await service.publicar(ESCOLA, ids.ana, P0));
    expect(s).toMatchObject({ passo: "feed", slotsRestantes: 2, errataLiberada: false, publicacoes: { inicial: { escala: 0, fonte: true }, errata: null } });
    expect(s.conteudo?.grupo.nome).toBe("Comitê Municipal de Políticas Públicas — Qualidade da Água do Bairro");
    expect(s.conteudo?.servico.serie.map((x) => x.valor)).toEqual([95, 94, 92, 88]);
    /* ADR-203: a 4ª camada (a incorreta) e a ordem das quatro, embaralhada por estudante e estável no F5. */
    expect(s.conteudo?.camadas.projecao).toBe(TEXTO_DA_PROJECAO);
    expect([...(s.conteudo?.camadas.ordem ?? [])].sort()).toEqual([...CAMADAS_DO_COMPOSITOR].sort());
    /* O feed do ramo 0, e o post espelho com a escala OPOSTA. */
    expect(s.feed?.reacoes[0]?.texto).toBe("Ah, tudo tranquilo, oscilação normal de rotina");
    expect(s.feed?.rival).toMatchObject({ escola: "Escola Estadual Santos Dumont", escala: 80 });
    expect(await nivel(ids.ana, "inspecao_anexo")).toBe("atingiu");
    /* Nenhuma marca do conjunto final antes da errata. */
    expect(await nivel(ids.ana, "boletim_final")).toBeNull();
  });

  test("a mesma publicação é idempotente; outra é 409; a errata antes da retomada é 409", async () => {
    expect(SessaoSchema.parse(await service.publicar(ESCOLA, ids.ana, P0)).slotsRestantes).toBe(2);
    expect(await codigo(service.publicar(ESCOLA, ids.ana, P80))).toBe("ja-publicado");
    expect(await codigo(service.publicarErrata(ESCOLA, ids.ana, P0))).toBe("errata-nao-liberada");
    expect(await codigo(service.pularErrata(ESCOLA, ids.ana))).toBe("errata-nao-liberada");
    expect(await prisma.exp03em1bPublicacao.count({ where: { escolaId: ESCOLA, estudanteId: ids.ana } })).toBe(1);
  });

  test("bia: o anexo só depois do nudge → CO13 em processo; publica 80 sem camadas e vê o ramo 80", async () => {
    await service.marco(ESCOLA, ids.bia, "chat_aberto");
    await service.marco(ESCOLA, ids.bia, "nudge_e2");
    await new Promise((r) => setTimeout(r, 5));
    await service.marco(ESCOLA, ids.bia, "anexo_aberto");
    const s = SessaoSchema.parse(await service.publicar(ESCOLA, ids.bia, P80));
    expect(s.feed?.reacoes[0]?.texto).toBe("Meu Deus, a água da cidade está contaminada!");
    expect(s.feed?.rival.escala).toBe(0);
    expect(await nivel(ids.bia, "inspecao_anexo")).toBe("em_processo");
  });

  test("caio: dois publicar concorrentes — um passa, o outro é 409, uma linha só", async () => {
    await service.marco(ESCOLA, ids.caio, "compositor_aberto");
    const r = await Promise.allSettled([service.publicar(ESCOLA, ids.caio, P0), service.publicar(ESCOLA, ids.caio, P80)]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.exp03em1bPublicacao.count({ where: { escolaId: ESCOLA, estudanteId: ids.caio, tipo: "inicial" } })).toBe(1);
    expect(await nivel(ids.caio, "inspecao_anexo")).toBe("nao_atingiu");
  });

  test("a pausa: toda jogada é 409 para quem não concluiu, e a sessão diz pausada", async () => {
    const g = await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "pausa");
    expect(g).toMatchObject({ etapa: "pausa", atividade: { rodada: 1 } });
    expect(await codigo(service.marco(ESCOLA, ids.davi, "chat_aberto"))).toBe("telas-pausadas");
    expect(await codigo(service.publicar(ESCOLA, ids.davi, P0))).toBe("telas-pausadas");
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana))).toMatchObject({ pausada: true, etapaDaTurma: "pausa", passo: "feed" });
    const p = RespostaPainelSchema.parse(await service.painel(ESCOLA, ids.turmaA, ids.prof));
    expect(p.resumo.pausados).toBe(3);
    /* O gate não volta. */
    expect((await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "pausa")).etapa).toBe("pausa");
    expect(await prisma.exp03em1bGateHistorico.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(1);
  });

  test("a retomada: a errata se oferece a quem publicou", async () => {
    expect((await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "liberada")).etapa).toBe("liberada");
    expect((await service.mudarGate(ESCOLA, ids.turmaA, ids.prof, "pausa")).etapa).toBe("liberada");
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana))).toMatchObject({ pausada: false, passo: "errata", errataLiberada: true });
  });

  test("ana (1ª adequada) pula a errata: as quatro do conjunto final, com a 1ª", async () => {
    const s = SessaoSchema.parse(await service.pularErrata(ESCOLA, ids.ana));
    expect(s).toMatchObject({ passo: "laudo", slotsRestantes: 2, publicacoes: { errataPulada: true, errata: null } });
    expect(await nivel(ids.ana, "boletim_final")).toBe("atingiu");
    expect(await nivel(ids.ana, "anotacao_escala")).toBe("atingiu");
    expect(await nivel(ids.ana, "camadas_do_boletim")).toBe("atingiu");
    expect(await nivel(ids.ana, "errata_responsavel")).toBe("atingiu");
    expect(SessaoSchema.parse(await service.pularErrata(ESCOLA, ids.ana)).passo).toBe("laudo");
    expect(await codigo(service.publicarErrata(ESCOLA, ids.ana, P0))).toBe("errata-ja-decidida");
  });

  test("bia corrige na errata (80 → 0 + fonte + contexto): o 2º slot, a 1ª no histórico", async () => {
    const errata = { escala: 0 as const, explicacao: false, fonte: true, contexto: true, projecao: false };
    const s = SessaoSchema.parse(await service.publicarErrata(ESCOLA, ids.bia, errata));
    expect(s).toMatchObject({ passo: "laudo", slotsRestantes: 1, publicacoes: { inicial: { escala: 80 }, errata: { escala: 0, contexto: true } } });
    expect(await prisma.exp03em1bPublicacao.count({ where: { escolaId: ESCOLA, estudanteId: ids.bia } })).toBe(2);
    expect(await nivel(ids.bia, "boletim_final")).toBe("atingiu");
    expect(await nivel(ids.bia, "anotacao_escala")).toBe("nao_atingiu");
    expect(await nivel(ids.bia, "camadas_do_boletim")).toBe("atingiu");
    expect(await nivel(ids.bia, "errata_responsavel")).toBe("atingiu");
    expect(SessaoSchema.parse(await service.publicarErrata(ESCOLA, ids.bia, errata)).slotsRestantes).toBe(1);
    expect(await codigo(service.pularErrata(ESCOLA, ids.bia))).toBe("errata-ja-decidida");
  });

  test("caio: errata e pular concorrentes — uma decisão só", async () => {
    const r = await Promise.allSettled([service.publicarErrata(ESCOLA, ids.caio, P80), service.pularErrata(ESCOLA, ids.caio)]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const linha = await prisma.exp03em1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.caio } });
    expect(linha.errataEm).not.toBeNull();
  });

  test("davi publica DEPOIS da retomada: não pausa e vai direto à errata (decisão 7)", async () => {
    await service.marco(ESCOLA, ids.davi, "chat_aberto");
    const s = SessaoSchema.parse(await service.publicar(ESCOLA, ids.davi, P80));
    expect(s).toMatchObject({ passo: "errata", errataLiberada: true, pausada: false });
    expect(s.feed?.coordenador.autor).toBe("Coordenador Silva");
  });

  test("a perícia: só depois da errata; o parecer conclui, marca a CO14 e não diz se acertou", async () => {
    expect(await codigo(service.emitirParecer(ESCOLA, ids.davi, { sinalizouA: false, motivoA: null, sinalizouB: true, motivoB: "escala" }))).toBe("errata-pendente");
    expect(await codigo(service.marco(ESCOLA, ids.davi, "pericia_aberta"))).toBe("errata-pendente");
    await service.marco(ESCOLA, ids.ana, "pericia_aberta");
    const parecer = { sinalizouA: false, motivoA: null, sinalizouB: true, motivoB: "escala" as const };
    const s = SessaoSchema.parse(await service.emitirParecer(ESCOLA, ids.ana, parecer));
    expect(s).toMatchObject({ passo: "concluida", concluido: true, pericia: { pulou: false, sinalizouB: true, motivoB: "escala" } });
    expect(JSON.stringify(s)).not.toMatch(/cartaoDistorcido|gabarito|correto/i);
    expect(await nivel(ids.ana, "pericia_eleitoral")).toBe("atingiu");
    expect(SessaoSchema.parse(await service.emitirParecer(ESCOLA, ids.ana, parecer)).concluido).toBe(true);
    expect(await codigo(service.emitirParecer(ESCOLA, ids.ana, { ...parecer, motivoB: "fonte" }))).toBe("pericia-ja-concluida");
    expect(await codigo(service.pularPericia(ESCOLA, ids.ana))).toBe("pericia-ja-concluida");
  });

  test("bia pula a perícia: conclui, e a CO14 fica não atingiu", async () => {
    const s = SessaoSchema.parse(await service.pularPericia(ESCOLA, ids.bia));
    expect(s).toMatchObject({ concluido: true, pericia: { pulou: true } });
    expect(await nivel(ids.bia, "pericia_eleitoral")).toBe("nao_atingiu");
    expect(SessaoSchema.parse(await service.pularPericia(ESCOLA, ids.bia)).concluido).toBe(true);
  });

  test("o CHECK do banco recusa a perícia sem errata e o motivo sem sinalização", async () => {
    const linha = await prisma.exp03em1bSessao.findFirstOrThrow({ where: { escolaId: ESCOLA, estudanteId: ids.davi } });
    const chave = { escolaId_estudanteId_pacoteId_rodada: { escolaId: ESCOLA, estudanteId: ids.davi, pacoteId: linha.pacoteId, rodada: linha.rodada } };
    await expect(prisma.exp03em1bSessao.update({ where: chave, data: { periciaAbertaEm: new Date() } })).rejects.toThrow();
    await expect(prisma.exp03em1bSessao.update({ where: chave, data: { slotsRestantes: 3 } })).rejects.toThrow();
  });
});

describe("o painel, o material e a RLS", () => {
  test("só contagens; a folha diz o passo — nunca a escala nem o parecer de ninguém", async () => {
    const p = RespostaPainelSchema.parse(await service.painel(ESCOLA, ids.turmaA, ids.prof));
    expect(p.etapa).toBe("liberada");
    expect(p.resumo).toMatchObject({
      estudantes: 4,
      entraram: 4,
      pausados: 0,
      abriramAnexo: 2,
      primeiraPublicacao: { escala0: 1 + (await prisma.exp03em1bPublicacao.count({ where: { estudanteId: ids.caio, escala: 0, tipo: "inicial" } })), escala80: 1 + 1 + (await prisma.exp03em1bPublicacao.count({ where: { estudanteId: ids.caio, escala: 80, tipo: "inicial" } })) },
      pericia: { emitiram: 1, pularam: 1 },
    });
    expect(p.resumo.errata.publicaram + p.resumo.errata.pularam).toBe(3);
    expect(p.resumo.porPasso.concluida).toBe(2);
    expect(Object.keys(p.linhas[0] ?? {}).sort()).toEqual(["estudanteId", "nome", "passo", "segundosInativo"]);
    expect((await prisma.exp03em1bPacote.findUniqueOrThrow({ where: { id: ids.rascunho } })).painelVistas).toBeGreaterThan(0);
  });

  test("o material do professor traz o gabarito da perícia e as seis réguas", () => {
    const m = RespostaMaterialProfessorSchema.parse(service.material());
    expect(m.pericia).toMatchObject({ cartaoDistorcido: "B", motivo: "escala" });
    expect(m.habilidades.map((h) => h.codigo)).toEqual(["EM13CO12", "EM13CO13", "EM13CO14", "EM13CO21", "EM13CO22", "EM13CO26"]);
    expect(m.laudo.fator).toBe("≈ 6,3");
  });

  test("a role SEM BYPASSRLS só enxerga a própria escola, e as cinco tabelas têm a RLS forçada", async () => {
    const daEscola = await runtime.comTenancy((tx) => tx.exp03em1bSessao.count(), ESCOLA);
    const daVizinha = await runtime.comTenancy((tx) => tx.exp03em1bPublicacao.count({ where: { escolaId: ESCOLA } }), OUTRA_ESCOLA);
    expect(daEscola).toBeGreaterThan(0);
    expect(daVizinha).toBe(0);
    for (const tabela of ["exp03em1b_pacotes", "exp03em1b_gates_turma", "exp03em1b_gates_historico", "exp03em1b_sessoes", "exp03em1b_publicacoes"]) {
      const [linha] = await prisma.$queryRawUnsafe<{ rls: boolean; forcada: boolean }[]>(
        `SELECT relrowsecurity AS rls, relforcerowsecurity AS forcada FROM pg_class WHERE relname = '${tabela}'`,
      );
      expect(linha).toEqual({ rls: true, forcada: true });
    }
    /* A escrita com a escola errada é recusada pela política. */
    await expect(
      runtime.comTenancy(
        (tx) => tx.exp03em1bGateTurma.create({ data: { escolaId: ESCOLA, turmaId: ids.turmaVizinha, etapa: "pausa" } }),
        OUTRA_ESCOLA,
      ),
    ).rejects.toThrow();
  });

  test("zerar: rodada 2, a evidência do pacote apagada, as sessões guardadas, o gate no início", async () => {
    const r = await service.zerar(ESCOLA, ids.turmaA, ids.prof, 1);
    expect(r).toEqual({ etapa: "exploracao", atividade: { pacoteId: ids.rascunho, rodada: 2 } });
    expect(await prisma.evidenciaMarca.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA, expId: EXP_ID } })).toBe(0);
    expect(await prisma.exp03em1bSessao.count({ where: { escolaId: ESCOLA, turmaId: ids.turmaA } })).toBe(4);
    expect(SessaoSchema.parse(await service.sessao(ESCOLA, ids.ana))).toMatchObject({ passo: "abertura", slotsRestantes: 3, publicacoes: { inicial: null } });
    /* O mesmo clique de novo (a rodada vista) é idempotente; uma rodada velha é 409. */
    expect((await service.zerar(ESCOLA, ids.turmaA, ids.prof, 1)).atividade.rodada).toBe(2);
    expect(await codigo(service.zerar(ESCOLA, ids.turmaA, ids.prof, 5))).toBe("rodada-desatualizada");
  });
});
