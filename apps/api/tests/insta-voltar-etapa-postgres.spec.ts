import { AtividadesController } from "../src/atividades/atividades.controller";
import type { AssetsService } from "../src/assets/assets.service";
import { comEscolaNoContexto } from "../src/tenancy/tenancy-context";
import { contextoDeTeste, prisma } from "./motor-fixture-db";

/**
 * O RELÓGIO DA AULA contra o Postgres: encerrar a investigação e VOLTAR.
 *
 * A regra pura vive em `insta-etapas.spec.ts`. O que só aparece aqui é o PAR
 * que produziu o defeito da ADR-92: sair da investigação **congela** toda run
 * que entrou no aparelho (`encerrarRun` grava o dossiê e `finished_at`), e era
 * esse congelamento que fazia o retorno virar no-op. Uma suíte pura nunca o
 * pegaria — as duas metades moram em arquivos diferentes, e cada uma, sozinha,
 * está certa.
 */

const ctx = contextoDeTeste("teste-voltar-etapa");
const ESCOLA = ctx.escolaId;

/** `moverEtapa` não toca em assets; o stub existe só para o construtor. */
const assetsFalso = {} as AssetsService;

describe("voltar para a investigação depois de encerrá-la", () => {
  const controller = new AtividadesController(prisma, assetsFalso);
  let activityId = "";
  let runId = "";
  let professorId = "";

  const req = () =>
    ({ auth: { usuarioId: professorId, escolaId: ESCOLA, perfil: "professor" } }) as never;
  /**
   * Fora de uma requisição HTTP não há `TenancyInterceptor`, e `comTenancy`
   * lança sem escola no contexto — o mesmo caminho que o seed e o worker usam.
   */
  const mover = (etapa: string) =>
    comEscolaNoContexto(ESCOLA, () => controller.moverEtapa(activityId, { etapa }, req()));
  const aRun = () =>
    prisma.run.findUniqueOrThrow({
      where: { id: runId },
      select: { fase: true, finishedAt: true },
    });
  const dossies = () => prisma.dossier.count({ where: { runId } });

  beforeAll(async () => {
    await ctx.limpar();
    const fixture = await ctx.criar({ posts: 12 });
    activityId = fixture.atividade.id;
    runId = fixture.run.id;
    professorId = fixture.professor.id;

    /**
     * A criança entrou no aparelho e rolou o feed. O evento importa: sem ele o
     * dossiê é computado sobre nada, e o que este teste afirma sobre RECOMPUTO
     * não teria como falhar.
     */
    await prisma.run.update({ where: { id: runId }, data: { fase: "feed" } });
    const post = await prisma.post.findFirstOrThrow({ where: { activityId }, select: { id: true } });
    await prisma.event.create({
      data: {
        escolaId: ESCOLA,
        runId,
        postId: post.id,
        tipo: "visto",
        payload: { dwellMs: 4200 },
        clientTs: BigInt(1_700_000_000_000),
      },
    });
  });

  afterAll(async () => {
    await ctx.limpar().catch(() => undefined);
    await prisma.$disconnect();
  });

  it("encerrar a investigação congela a sessão — é a metade que já existia", async () => {
    const resposta = await mover("conclusao");
    expect(resposta.etapa).toBe("conclusao");
    expect(resposta.voltou).toBe(false);
    expect(resposta.reabertas).toBe(0);

    const run = await aRun();
    expect(run.fase).toBe("conclusao");
    expect(run.finishedAt).not.toBeNull();
    expect(await dossies()).toBe(1);
  });

  it("VOLTAR devolve o feed, reabre a sessão e descarta o relatório", async () => {
    const resposta = await mover("investigacao");
    expect(resposta.etapa).toBe("investigacao");
    expect(resposta.voltou).toBe(true);
    // O sintoma do card era exatamente este número em zero.
    expect(resposta.movidos).toBe(1);
    expect(resposta.reabertas).toBe(1);

    const run = await aRun();
    expect(run.fase).toBe("feed");
    expect(run.finishedAt).toBeNull();
    // Sem apagar o dossiê, `encerrarRun` devolveria o de antes sem recomputar,
    // e o relatório não teria nada do que a criança fizesse daqui em diante.
    expect(await dossies()).toBe(0);
  });

  it("o que o estudante PRODUZIU sobrevive ao retorno", async () => {
    // Voltar um momento não é `POST /runs/:id/reset` — aquele apaga a sessão.
    expect(await prisma.event.count({ where: { runId } })).toBe(1);
  });

  it("encerrar de novo recomputa o relatório", async () => {
    const resposta = await mover("conclusao");
    expect(resposta.reabertas).toBe(0);

    const run = await aRun();
    expect(run.fase).toBe("conclusao");
    expect(run.finishedAt).not.toBeNull();
    expect(await dossies()).toBe(1);
  });

  it("quem JÁ VIU a revelação para na resposta, e a sessão NÃO reabre", async () => {
    await mover("explicabilidade");
    expect((await aRun()).fase).toBe("explicabilidade");

    const resposta = await mover("investigacao");
    expect(resposta.voltou).toBe(true);
    expect(resposta.reabertas).toBe(0);

    const run = await aRun();
    expect(run.fase).toBe("conclusao");
    // Continua congelada: quem já sabe do viés não volta a ser medido pelo feed.
    expect(run.finishedAt).not.toBeNull();
    expect(await dossies()).toBe(1);
  });

  it("quem nunca entrou no aparelho não é arrastado nem reaberto", async () => {
    const estudante = await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        role: "estudante",
        username: `estudante.fora.${Date.now()}`,
        displayName: "Não entrou",
        passwordHash: "x",
      },
    });
    const segunda = await prisma.run.create({
      data: {
        escolaId: ESCOLA,
        activityId,
        estudanteId: estudante.id,
        fase: "onboarding",
        ladoInicial: "A",
        engineState: {},
      },
    });

    const resposta = await mover("investigacao");
    expect(resposta.foraDoAparelho).toBe(1);

    const run = await prisma.run.findUniqueOrThrow({
      where: { id: segunda.id },
      select: { fase: true, finishedAt: true },
    });
    expect(run.fase).toBe("onboarding");
    expect(run.finishedAt).toBeNull();
  });
});
