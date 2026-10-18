import type { PrismaClient } from "@prisma/client";
import type { AiProvider } from "../src/ai/provider";
import { QuotaService } from "../src/ai/quota.service";
import type { AssetsService } from "../src/assets/assets.service";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import { DISCIPLINA_PADRAO, TEMA_PADRAO, noticiasPadrao } from "../src/jornal-escola/catalogo";
import { DiagramacaoService } from "../src/jornal-escola/diagramacao.service";
import { JornalEscolaService } from "../src/jornal-escola/jornal-escola.service";
import * as Jornal from "../src/jornal-escola/podcast";
import { fonteDoPodcastDaExp04ef1b } from "../src/jornal-escola/podcast-fonte";
import { PodcastService } from "../src/podcast/podcast.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { mensagensDoPadrao, PACOTE_PADRAO } from "../src/quem-mandou-isso/catalogo";
import * as Quem from "../src/quem-mandou-isso/podcast";
import { PreparoDaExp05ef1bService } from "../src/quem-mandou-isso/preparo.service";
import { QuemMandouIssoService } from "../src/quem-mandou-isso/quem-mandou-isso.service";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * O podcast de recapitulação (ADR-150) — o que só o banco responde: a RLS de
 * `podcast_roteiros` ISOLANDO (com a role de runtime, sem `BYPASSRLS`), os
 * CHECKs, e as homologações do 4º e do 5º ano gravando as falas que o
 * professor revisou — também no segundo clique, que não cria atividade nova.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-podcast";
const OUTRA_ESCOLA = "teste-podcast-outra";
const ESCOLAS = [ESCOLA, OUTRA_ESCOLA];

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const runtime = new PrismaService({ datasources: { db: { url: urlDeRuntime(URL) } } }) as PrismaService & PrismaClient;

/** A IA não é chamada aqui: a homologação não usa, e o podcast não sintetiza. */
const ia = {} as AiProvider;
const quota = new QuotaService(prisma);
const evidencias = new EvidenciasService(prisma, new EquipesService(prisma));
evidencias.onModuleInit();
const jornal = new JornalEscolaService(prisma, evidencias, new DiagramacaoService(ia, quota, prisma, 300));
const quem = new QuemMandouIssoService(prisma, evidencias, new PreparoDaExp05ef1bService(ia, quota));
quem.onModuleInit();

const assets = { midiaDeExperienciaExiste: async () => false } as unknown as AssetsService;
const podcast = new PodcastService(ia, assets, quota, prisma);
podcast.registrarFonte(fonteDoPodcastDaExp04ef1b(jornal));

const ids = { turma4: "", turma5: "", turmaVizinha: "", professora: "", vizinha: "" };

const FALAS_EDITADAS = {
  ...Jornal.FALAS_DO_TEMA_PADRAO,
  boato:
    "E aquela outra mensagem gritando que a escola ia fechar a cantina? Ninguém assinava, e a secretaria parou para explicar!",
};

const corpoDoJornal = (podcastFalas = Jornal.FALAS_DO_TEMA_PADRAO) => ({
  disciplina: DISCIPLINA_PADRAO,
  tema: TEMA_PADRAO,
  origem: "padrao" as const,
  noticias: noticiasPadrao(),
  podcast: podcastFalas,
});

async function limpar() {
  await prisma.podcastRoteiro.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp04ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.exp05ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.matricula.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  await prisma.escola.deleteMany({ where: { id: { in: ESCOLAS } } });
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do Podcast (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Escola vizinha do Podcast (teste)" } });
  ids.turma4 = (await criarTurmaDeTeste(prisma, ESCOLA, "4A podcast", "4EF")).id;
  ids.turma5 = (await criarTurmaDeTeste(prisma, ESCOLA, "5A podcast", "5EF")).id;
  ids.turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "4A vizinha podcast", "4EF")).id;

  const pessoa = async (escolaId: string, username: string, nome: string) =>
    (
      await prisma.user.create({
        data: { escolaId, username, role: "professor", displayName: nome, passwordHash: "x" },
        select: { id: true },
      })
    ).id;
  ids.professora = await pessoa(ESCOLA, "podcast-prof", "Marta Prof");
  ids.vizinha = await pessoa(OUTRA_ESCOLA, "podcast-prof-vizinha", "Vera Prof");
  const lecionar = (escolaId: string, turmaId: string, usuarioId: string) =>
    prisma.matricula.create({
      data: { escolaId, turmaId, usuarioId, papel: "professor", principal: false, inicio: new Date(Date.UTC(2026, 0, 1)) },
    });
  await lecionar(ESCOLA, ids.turma4, ids.professora);
  await lecionar(ESCOLA, ids.turma5, ids.professora);
  await lecionar(OUTRA_ESCOLA, ids.turmaVizinha, ids.vizinha);
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("a tabela podcast_roteiros", () => {
  test("tem RLS habilitada E forçada, com uma política por escola", async () => {
    const [linha] = await prisma.$queryRawUnsafe<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>(
      "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'podcast_roteiros'",
    );
    expect(linha).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    const policies = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
      "SELECT policyname FROM pg_policies WHERE tablename = 'podcast_roteiros'",
    );
    expect(policies.map((p) => p.policyname)).toEqual(["podcast_roteiros_por_escola"]);
  });

  test("a role de runtime só vê as falas da escola do contexto", async () => {
    const daqui = await jornal.homologar(ESCOLA, ids.turma4, ids.professora, ids.professora, corpoDoJornal());
    const dela = await jornal.homologar(OUTRA_ESCOLA, ids.turmaVizinha, ids.vizinha, ids.vizinha, corpoDoJornal());
    const vistas = await runtime.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.escola_id', ${ESCOLA}, true)`;
      return tx.podcastRoteiro.findMany({ where: { atividadeId: { in: [daqui.id, dela.id] } }, select: { escolaId: true } });
    });
    expect(vistas).toEqual([{ escolaId: ESCOLA }]);
  });

  test("os CHECKs recusam código de experiência fora do formato e falas que não são objeto", async () => {
    const base = { escolaId: ESCOLA, atividadeId: "44444444-4444-4444-8444-444444444444" };
    await expect(prisma.podcastRoteiro.create({ data: { ...base, expId: "a-selecao", falas: {} } })).rejects.toThrow();
    await expect(prisma.podcastRoteiro.create({ data: { ...base, expId: "exp04ef1b", falas: ["não"] } })).rejects.toThrow();
  });
});

describe("a homologação grava as falas que o professor revisou", () => {
  beforeEach(async () => {
    await prisma.podcastRoteiro.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
    await prisma.exp04ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
    await prisma.exp05ef1bPacote.deleteMany({ where: { escolaId: { in: ESCOLAS } } });
  });

  test("4º ano: criar grava; o segundo clique com uma fala editada troca a fala, sem atividade nova", async () => {
    const primeiro = await jornal.homologar(ESCOLA, ids.turma4, ids.professora, ids.professora, corpoDoJornal());
    const segundo = await jornal.homologar(
      ESCOLA,
      ids.turma4,
      ids.professora,
      ids.professora,
      corpoDoJornal(FALAS_EDITADAS),
    );
    expect(segundo.id).toBe(primeiro.id);
    const linhas = await prisma.podcastRoteiro.findMany({ where: { escolaId: ESCOLA, expId: "exp04ef1b" } });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ atividadeId: primeiro.id, falas: FALAS_EDITADAS, aprovadoPor: ids.professora });
  });

  test("4º ano: o podcast da atividade toca as falas aprovadas, e não as do sheet", async () => {
    const pacote = await jornal.homologar(ESCOLA, ids.turma4, ids.professora, ids.professora, corpoDoJornal(FALAS_EDITADAS));
    const estado = await podcast.estado("exp04ef1b", ESCOLA, ids.turma4, ids.professora, pacote.id);
    const textos = estado.roteiro.flatMap((t) => t.falas.map((f) => f.texto));
    expect(textos).toContain(FALAS_EDITADAS.boato);
    expect(textos).not.toContain(Jornal.FALAS_DO_TEMA_PADRAO.boato);
  });

  test("5º ano: aprovar grava as falas do pacote aprovado", async () => {
    const aprovado = await quem.aprovar(ESCOLA, ids.turma5, ids.professora, {
      disciplina: "letramento-digital",
      tema: PACOTE_PADRAO.tema,
      assuntos: [...PACOTE_PADRAO.assuntos],
      contexto: null,
      origem: "padrao",
      mensagens: mensagensDoPadrao(),
      podcast: Quem.FALAS_DO_TEMA_PADRAO,
    });
    const linha = await prisma.podcastRoteiro.findFirst({ where: { escolaId: ESCOLA, expId: "exp05ef1b" } });
    expect(linha).toMatchObject({ atividadeId: aprovado.id, falas: Quem.FALAS_DO_TEMA_PADRAO });
  });
});
