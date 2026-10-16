import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

import { MockProvider } from "../src/ai/mock.provider";
import { QuotaService } from "../src/ai/quota.service";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { SalasService } from "../src/salas/salas.service";
import { CanalADaTempestade } from "../src/unoogpt/canal-a.service";
import { PARTES_DO_ALERTA } from "../src/unoogpt/regras/alerta";
import { TAREFAS } from "../src/unoogpt/regras/canal-a";
import type { CartaoDaFonte } from "../src/unoogpt/regras/cartoes-das-fontes";
import type { Comparacao } from "../src/unoogpt/regras/e-se";
import type { ParDaLeitura } from "../src/unoogpt/regras/leitura-dos-pares";
import { CERTA } from "../src/unoogpt/regras/moradora";
import { UnoogptService } from "../src/unoogpt/unoogpt.service";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O CANAL A DA MISSÃO TEMPESTADE (exp02em1b, ADR-169) no Postgres, com a FICHA
 * REAL (v2, sem pergunta) e as tarefas de verdade:
 *
 *   - a tabela nova tem RLS e o vocabulário do CHECK é o do código;
 *   - o desfecho fica RETIDO até o registro da operação;
 *   - "primeira da rodada" não muda na segunda tentativa; "melhor tentativa"
 *     melhora com o relógio aberto e não marca a tentativa que começou fechada;
 *   - o fechamento responde 409 antes de o professor abrir, e com ele aberto o
 *     "Tentar de novo" é recusado;
 *   - só conta ao encerrar a missão, e a marca de um marcador que saiu da ficha
 *     (a `p1` da v1) não vira nível;
 *   - "Zerar a turma" fecha o fechamento e apaga as tarefas (ADR-155).
 *
 * O `MockProvider` só existe porque o construtor pede: nada aqui chama a IA (a
 * tabela que o Cientista teria mostrado é gravada direto, como anexo).
 *
 * UMA ESCOLA POR SUÍTE: o Jest paraleliza, e limpeza compartilhada corromperia
 * a outra.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-unoogpt-evidencia";
const TEMPESTADE = "exp02em1b";
const TURMA = "turma";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const salas = new SalasService(prisma);
const evidencias = new EvidenciasService(prisma, new EquipesService(prisma), salas);
evidencias.onModuleInit();
const canalA = new CanalADaTempestade(prisma, evidencias);
const missao = new UnoogptService(prisma, new MockProvider(), new QuotaService(prisma), canalA);

let turmaId = "";
let professorId = "";
const estudantes: Record<string, string> = {};

async function limpar() {
  await prisma.evidenciaEvento.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.evidencia.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.evidenciaMarca.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.unoogptGateTurma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.unoogptRelogioTurma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.unoogptSessao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.liberacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.iaUsoDiario.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

async function codigoDe(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    if (e instanceof HttpException) return (e.getResponse() as { codigo?: string }).codigo ?? `HTTP_${e.getStatus()}`;
    throw e;
  }
}

const id = (nome: string) => estudantes[nome]!;

const marcaDe = async (nome: string, marcador: string) =>
  (
    await prisma.evidenciaMarca.findFirst({
      where: { escolaId: ESCOLA, expId: TEMPESTADE, estudanteId: id(nome), marcador },
      select: { status: true },
    })
  )?.status ?? null;

const evidenciaDe = (nome: string, habilidade: string) =>
  prisma.evidencia.findMany({
    where: { escolaId: ESCOLA, expId: TEMPESTADE, estudanteId: id(nome), habilidade },
    select: { status: true, origem: true, marcador: true },
  });

const tarefa = (nome: string, t: string, tentativa?: number) =>
  prisma.unoogptTarefa.findFirstOrThrow({
    where: { escolaId: ESCOLA, estudanteId: id(nome), tarefa: t, ...(tentativa ? { tentativa } : {}) },
    orderBy: { tentativa: "desc" },
  });

/** A tabela que o Cientista teria mostrado: dois bairros cruzados e um separado. */
async function leituraDoCientista(nome: string) {
  const s = await prisma.unoogptSessao.findUniqueOrThrow({
    where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: id(nome) } },
  });
  const linha = (bairro: string, min: number, esperado: number, max: number) => ({
    bairro,
    cobertura: 0.5,
    chanceDeEventoSevero: { min: 0.2, esperado: 0.3, max: 0.4 },
    pessoasEmRisco: { min, esperado, max },
    confianca: "média",
    sustentadaPor: [],
  });
  await prisma.unoogptMensagem.create({
    data: {
      escolaId: ESCOLA,
      estudanteId: id(nome),
      papel: "agente",
      texto: "[teste] a tabela",
      passo: "investigacao",
      tentativa: s.tentativa,
      anexo: {
        tipo: "tendencia",
        hora: "17h10",
        rodada: {
          estimativas: [
            linha("ribeirinha", 2000, 2400, 2800),
            linha("morroalto", 1900, 2200, 2500),
            linha("industrial", 300, 400, 500),
          ],
        },
      },
    },
  });
}

/** Do começo até "Enviar equipes", com duas fontes citadas e a tabela na tela. */
async function ateOEnvio(nome: string, opcoes: { comLeitura?: boolean } = {}) {
  await missao.sessao(ESCOLA, id(nome));
  await missao.irParaPasso(ESCOLA, id(nome), "orientacao");
  await missao.irParaPasso(ESCOLA, id(nome), "investigacao");
  await missao.carregarConjuntos(ESCOLA, id(nome), ["censo", "telefonia"]);
  if (opcoes.comLeitura !== false) await leituraDoCientista(nome);
  await missao.alocar(ESCOLA, id(nome), "alfa", "morroalto", "censo");
  await missao.alocar(ESCOLA, id(nome), "bravo", "ribeirinha", "telefonia");
  return missao.mandar(ESCOLA, id(nome));
}

/** As respostas certas, lidas da apresentação gravada (o gabarito é do servidor). */
async function respostasCertas(nome: string) {
  const leitura = (await tarefa(nome, "leitura")).apresentacao as unknown as { pares: ParDaLeitura[] };
  const fontes = (await tarefa(nome, "fontes")).apresentacao as unknown as { cartoes: CartaoDaFonte[] };
  return {
    leitura: Object.fromEntries(leitura.pares.map((p, i) => [`p${i + 1}`, p.gabarito])) as { p1: string; p2: string },
    fontes: Object.fromEntries(fontes.cartoes.map((c) => [c.id, c.certas[0]!])) as Record<string, string>,
    alerta: Object.fromEntries(PARTES_DO_ALERTA.map((p) => [p.id, p.opcoes.find((o) => o.certa)!.id])) as Record<string, string>,
  };
}

async function registroCerto(nome: string) {
  const certas = await respostasCertas(nome);
  await canalA.responderLeitura(ESCOLA, id(nome), certas.leitura);
  await canalA.responderFontes(ESCOLA, id(nome), certas.fontes);
  return canalA.responderAlerta(ESCOLA, id(nome), certas.alerta);
}

async function eSeCerto(nome: string, certo: boolean) {
  await canalA.eSe(ESCOLA, id(nome));
  const ap = (await tarefa(nome, "e-se")).apresentacao as unknown as { comparacoes: Comparacao[] };
  const errada = (g: string) => (g === "depende" ? "mais" : "depende");
  const respostas = Object.fromEntries(
    ap.comparacoes.map((c, i) => [`e${i + 1}`, certo ? c.gabarito : errada(c.gabarito)]),
  ) as Record<string, string>;
  return canalA.responderESe(ESCOLA, id(nome), respostas);
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do Canal A da Tempestade (teste)" } });
  turmaId = (await criarTurmaDeTeste(prisma, ESCOLA, "2A", "2EM")).id;
  professorId = (
    await prisma.user.create({
      data: { role: "professor", escolaId: ESCOLA, username: "uev.prof", displayName: "Prof", passwordHash: "x" },
      select: { id: true },
    })
  ).id;
  await prisma.matricula.create({
    data: { escolaId: ESCOLA, turmaId, usuarioId: professorId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
  });
  for (const nome of ["ana", "bia", "caio", "dani"]) {
    estudantes[nome] = (
      await prisma.user.create({
        data: { role: "estudante", escolaId: ESCOLA, turmaId, username: `uev.${nome}`, displayName: nome, passwordHash: "x" },
        select: { id: true },
      })
    ).id;
  }
  /* O catálogo é GLOBAL: o `update` só garante o que a Sala de Aula exige, sem
     tocar em nome nem versão (a lição de `salas-postgres.spec.ts`). */
  await prisma.experiencia.upsert({
    where: { expId: TEMPESTADE },
    update: { publico: "estudante" },
    create: { expId: TEMPESTADE, nome: TEMPESTADE, versaoAtiva: "1.0.0", series: ["2EM"], publico: "estudante" },
  });
  await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "liberada", professorId);
  await missao.mexerNoRelogio(ESCOLA, turmaId, "largada", professorId);
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

describe("a tabela das tarefas", () => {
  test("o vocabulário do CHECK é o do código, e a tabela tem RLS forçada", async () => {
    const [check] = await prisma.$queryRaw<{ def: string }[]>`
      SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'exp02em1b_tarefas_tarefa_check'`;
    for (const t of TAREFAS) expect(check!.def).toContain(`'${t}'`);
    expect((check!.def.match(/'[a-z-]+'/g) ?? []).length).toBe(TAREFAS.length);
    const [rls] = await prisma.$queryRaw<{ rls: boolean; forcada: boolean }[]>`
      SELECT relrowsecurity AS rls, relforcerowsecurity AS forcada FROM pg_class WHERE relname = 'exp02em1b_tarefas'`;
    expect(rls).toEqual({ rls: true, forcada: true });
    const politicas = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_policies WHERE tablename = 'exp02em1b_tarefas'`;
    expect(Number(politicas[0]!.n)).toBe(1);
  });
});

describe("a missão inteira, de uma vez", () => {
  test("o primeiro destino traz a ligação da Saúde, e a contagem pedida dá 'em desenvolvimento'", async () => {
    await missao.sessao(ESCOLA, id("ana"));
    await missao.irParaPasso(ESCOLA, id("ana"), "orientacao");
    await missao.irParaPasso(ESCOLA, id("ana"), "investigacao");
    expect((await canalA.saude(ESCOLA, id("ana"))).ofertada).toBe(false);
    await missao.carregarConjuntos(ESCOLA, id("ana"), ["censo", "telefonia"]);
    await leituraDoCientista("ana");
    const r = await missao.alocar(ESCOLA, id("ana"), "alfa", "morroalto", "censo");
    expect(r.sessao.ofertaSaude).toBe(true);
    const saude = await canalA.responderSaude(ESCOLA, id("ana"), "contagem");
    expect(saude.entrega?.contagem?.map((c) => c.pessoas)).toEqual([2150, 980, 850, 190]);
    expect(saude.entrega?.aviso).toBeNull();
    expect(await marcaDe("ana", "saude")).toBe("em_processo");
    // A segunda resposta da tentativa não muda nada.
    await canalA.responderSaude(ESCOLA, id("ana"), "lista-completa");
    expect(await marcaDe("ana", "saude")).toBe("em_processo");
  });

  test("'Enviar equipes' abre o registro e RETÉM o resultado até ele", async () => {
    await missao.alocar(ESCOLA, id("ana"), "bravo", "ribeirinha", "telefonia");
    const registro = await missao.mandar(ESCOLA, id("ana"));
    expect(registro.concluido).toBe(false);
    expect(registro.leitura?.pares).toHaveLength(2);
    expect(registro.leitura?.pares[0]?.pergunta).toMatch(/^Pelo que esta tabela mostra, há mais gente em risco/);
    expect(registro.fontes?.cartoes).toHaveLength(2);
    expect(registro.alerta?.partes).toHaveLength(3);
    // Nada do gabarito atravessa: nem o tipo do par, nem as perguntas certas.
    const cru = JSON.stringify(registro);
    for (const proibido of ["gabarito", "certas", "separado", "cruzado", "certa"]) expect(cru).not.toContain(proibido);
    expect(await codigoDe(missao.resultado(ESCOLA, id("ana")))).toBe("registro-pendente");
    expect(await codigoDe(canalA.eSe(ESCOLA, id("ana")))).toBe("registro-pendente");
  });

  test("o registro feito libera o resultado, e as três tarefas marcam", async () => {
    const r = await registroCerto("ana");
    expect(r.concluido).toBe(true);
    expect((await missao.resultado(ESCOLA, id("ana"))).desfecho.totais.salvas).toBeGreaterThanOrEqual(0);
    expect(await marcaDe("ana", "leitura")).toBe("atingiu");
    expect(await marcaDe("ana", "fontes")).toBe("atingiu");
    expect(await marcaDe("ana", "alerta")).toBe("atingiu");
  });

  test("o 'E se…' mostra duas comparações de 20 tempestades e marca", async () => {
    const vista = await canalA.eSe(ESCOLA, id("ana"));
    expect(vista.comparacoes).toHaveLength(2);
    for (const c of vista.comparacoes!) expect(c.quadradinhos).toHaveLength(20);
    await eSeCerto("ana", true);
    expect(await marcaDe("ana", "e-se")).toBe("atingiu");
  });

  test("o fechamento responde 409 até o professor abrir; aberto, 'Tentar de novo' é recusado", async () => {
    expect(await codigoDe(canalA.fechamento(ESCOLA, id("ana")))).toBe("fechamento-fechado");
    // Bia faz a 1ª tentativa e recomeça ANTES de o fechamento abrir (o teste de
    // "primeira da rodada" usa isso abaixo).
    await ateOEnvio("bia");
    await canalA.responderSaude(ESCOLA, id("bia"), null).catch(() => undefined);
    await canalA.responderLeitura(ESCOLA, id("bia"), { p1: "cruzam", p2: "cruzam" });
    await canalA.responderFontes(ESCOLA, id("bia"), { c1: "nada", c2: "nada" });
    await canalA.responderAlerta(ESCOLA, id("bia"), { frequencia: "cinco-minutos", tom: "assustador", conteudo: "link" });
    await eSeCerto("bia", false);
    await missao.reiniciar(ESCOLA, id("bia"), "resultado");

    const relogio = await missao.mexerNoRelogio(ESCOLA, turmaId, "abrir-fechamento", professorId);
    expect(relogio.fechamentoAberto).toBe(true);
    expect(await codigoDe(missao.reiniciar(ESCOLA, id("ana"), "resultado"))).toBe("fechamento-aberto");

    const f = await canalA.fechamento(ESCOLA, id("ana"));
    expect(f.whatsapp.respostas).toHaveLength(4);
    expect(f.whatsapp.avisos).toHaveLength(3);
    expect(f.moradora.partes.map((p) => p.opcoes.length)).toEqual([3, 3, 3, 3]);
    await canalA.responderWhatsapp(ESCOLA, id("ana"), "nenhum-dado", "coordenacao");
    await canalA.responderMoradora(ESCOLA, id("ana"), { dados: CERTA, criterio: CERTA, quem: CERTA, contestar: CERTA });
    expect(await marcaDe("ana", "whatsapp")).toBe("atingiu");
    expect(await marcaDe("ana", "moradora")).toBe("atingiu");
    // Enviado, o segundo envio não muda a marca.
    await canalA.responderWhatsapp(ESCOLA, id("ana"), "lista-para-conferir", "ignora");
    expect(await marcaDe("ana", "whatsapp")).toBe("atingiu");
  });

  test("a folha do professor conta o fechamento e o que cada grupo perguntou sobre cada fonte", async () => {
    const folha = await missao.turmaDoProfessor(ESCOLA, turmaId, professorId);
    expect(folha.fechamento.aberto).toBe(true);
    expect(folha.fechamento.enviaram).toBe(1);
    expect(folha.perguntasPorFonte.length).toBeGreaterThan(0);
    expect(folha.alcanceDoAlerta).toContain("não chega a quem não tem aparelho");
    const relatorio = await missao.doEstudante(ESCOLA, id("ana"), professorId);
    expect(relatorio.canalA.map((t) => t.tarefa)).toEqual(
      expect.arrayContaining(["saude", "leitura", "fontes", "alerta", "e-se", "whatsapp", "moradora"]),
    );
    // Escolha em texto, nunca o nível.
    expect(JSON.stringify(relatorio.canalA)).not.toMatch(/atingiu|em_processo/);
  });
});

describe("as duas réguas de agregação", () => {
  test("'primeira da rodada' não muda na segunda tentativa; o alerta não volta", async () => {
    // Na 1ª tentativa a Bia errou o alerta e o "E se…".
    expect(await marcaDe("bia", "alerta")).toBe("nao_atingiu");
    expect(await marcaDe("bia", "e-se")).toBe("nao_atingiu");
    await missao.mexerNoRelogio(ESCOLA, turmaId, "redefinir", professorId);
    await missao.mexerNoRelogio(ESCOLA, turmaId, "largada", professorId);
    const registro = await ateOEnvio("bia");
    expect(registro.alerta).toBeNull();
    const certas = await respostasCertas("bia");
    await canalA.responderLeitura(ESCOLA, id("bia"), certas.leitura);
    const feito = await canalA.responderFontes(ESCOLA, id("bia"), certas.fontes);
    expect(feito.concluido).toBe(true);
    await canalA.eSe(ESCOLA, id("bia"));
    await eSeCerto("bia", true);
    expect(await marcaDe("bia", "e-se")).toBe("nao_atingiu");
    expect(await marcaDe("bia", "alerta")).toBe("nao_atingiu");
  });

  test("'melhor tentativa' melhora com o relógio aberto", async () => {
    // Bia errou as fontes e a leitura na 1ª e acertou na 2ª, as duas abertas.
    expect(await marcaDe("bia", "fontes")).toBe("atingiu");
    expect(await marcaDe("bia", "leitura")).toBe("atingiu");
  });

  test("a tentativa que COMEÇOU com o relógio fechado não marca leitura nem fontes", async () => {
    await missao.mexerNoRelogio(ESCOLA, turmaId, "encerrar", professorId);
    await missao.sessao(ESCOLA, id("dani"));
    await missao.irParaPasso(ESCOLA, id("dani"), "orientacao");
    await missao.irParaPasso(ESCOLA, id("dani"), "investigacao");
    const sessao = await prisma.unoogptSessao.findUniqueOrThrow({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: id("dani") } },
    });
    expect(sessao.inicioComRelogioAberto).toBe(false);
    // As fontes não entram com o relógio fechado; o cenário as põe direto, para
    // provar que mesmo assim nada marca.
    await prisma.unoogptSessao.update({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: id("dani") } },
      data: { conjuntos: ["censo", "telefonia"] },
    });
    await leituraDoCientista("dani");
    await missao.alocar(ESCOLA, id("dani"), "alfa", "morroalto", "censo");
    await missao.alocar(ESCOLA, id("dani"), "bravo", "ribeirinha", "telefonia");
    await missao.mandar(ESCOLA, id("dani"));
    await registroCerto("dani");
    expect(await marcaDe("dani", "leitura")).toBeNull();
    expect(await marcaDe("dani", "fontes")).toBeNull();
    // O alerta é "primeira da rodada": marca assim mesmo.
    expect(await marcaDe("dani", "alerta")).toBe("atingiu");
  });
});

describe("o encerramento", () => {
  test("só conta ao encerrar; a marca 'p1' da ficha v1 não vira nível", async () => {
    // A turma estava com a missão aberta no dia da troca da ficha: uma marca de
    // marcador que saiu.
    await prisma.evidenciaMarca.create({
      data: {
        escolaId: ESCOLA,
        turmaId,
        expId: TEMPESTADE,
        atividadeId: TURMA,
        rodada: 1,
        estudanteId: id("caio"),
        marcador: "p1",
        habilidade: "EM13CO14",
        status: "atingiu",
        tipo: "multipla_escolha",
        versaoFicha: 1,
      },
    });
    expect(await evidenciaDe("ana", "EM13CO08")).toEqual([]);
    await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "encerrada", professorId);
    expect(await evidenciaDe("caio", "EM13CO14")).toEqual([]);
    expect(await evidenciaDe("ana", "EM13CO08")).toEqual([{ status: "atingiu", origem: "propria", marcador: "whatsapp" }]);
    // EM13CO26: vale o melhor entre a Saúde (em desenvolvimento) e a moradora.
    expect(await evidenciaDe("ana", "EM13CO26")).toEqual([{ status: "atingiu", origem: "propria", marcador: "moradora" }]);
    expect(await evidenciaDe("ana", "EM13CO12")).toEqual([{ status: "atingiu", origem: "propria", marcador: "leitura" }]);
  });

  test("zerar a turma fecha o fechamento e apaga as tarefas e a evidência (ADR-155)", async () => {
    await salas.definirEstado(ESCOLA, turmaId, TEMPESTADE, "liberada", professorId);
    await missao.zerarTurma(ESCOLA, turmaId, professorId);
    expect(await prisma.unoogptTarefa.count({ where: { escolaId: ESCOLA } })).toBe(0);
    expect(await prisma.evidencia.count({ where: { escolaId: ESCOLA, turmaId, expId: TEMPESTADE } })).toBe(0);
    const relogio = await prisma.unoogptRelogioTurma.findUnique({ where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId } } });
    expect(relogio?.fechamentoAbertoEm ?? null).toBeNull();
    await missao.sessao(ESCOLA, id("ana"));
    await missao.mexerNoRelogio(ESCOLA, turmaId, "largada", professorId);
    expect(await codigoDe(canalA.fechamento(ESCOLA, id("ana")))).toBe("fechamento-fechado");
  });
});
