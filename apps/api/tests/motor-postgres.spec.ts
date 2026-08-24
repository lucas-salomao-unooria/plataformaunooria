import { normalizarEstado } from "../src/motor/estado";
import { proximoBlocoDoFeed } from "../src/motor/servico";
import { contextoDeTeste, prisma } from "./motor-fixture-db";

const ctx = contextoDeTeste("teste-motor-postgres");
const ESCOLA_TESTE = ctx.escolaId;

/** Motor rodando de verdade contra o Postgres de teste — porte do
 *  `tests/integracao/motor-postgres.test.ts` do origem (Vitest → Jest,
 *  assinatura nova `proximoBlocoDoFeed(prisma, runId, escolaId)`). */

describe("feed servido pelo Postgres", () => {
  let runId = "";
  let activityId = "";
  let relogio = 1_700_000_000_000;

  beforeAll(async () => {
    await ctx.limpar();
    const fixture = await ctx.criar({ posts: 30 });
    runId = fixture.run.id;
    activityId = fixture.atividade.id;
  });

  afterAll(async () => {
    await ctx.limpar();
    await prisma.$disconnect();
  });

  /** Simula o cliente: manda eventos de dwell (e curtidas) e pede outro bloco. */
  async function consumirBloco(
    posts: { id: string }[],
    comportamento: (postId: string) => { dwellMs: number; curtiu?: boolean },
  ) {
    const metas = await prisma.post.findMany({
      where: { id: { in: posts.map((post) => post.id) } },
      select: { id: true, lado: true },
    });

    for (const post of metas) {
      const acao = comportamento(post.id);
      relogio += 1000;
      await prisma.event.create({
        data: {
          escolaId: ESCOLA_TESTE,
          runId,
          postId: post.id,
          tipo: "visto",
          payload: { dwellMs: acao.dwellMs },
          clientTs: BigInt(relogio),
        },
      });
      if (acao.curtiu) {
        relogio += 1;
        await prisma.event.create({
          data: {
            escolaId: ESCOLA_TESTE,
            runId,
            postId: post.id,
            tipo: "curtiu",
            payload: {},
            clientTs: BigInt(relogio),
          },
        });
      }
    }
  }

  it("primeiro bloco tem 8 posts sanitizados e sem campos reveladores", async () => {
    const bloco = await proximoBlocoDoFeed(prisma, runId, ESCOLA_TESTE);

    expect(bloco.posts).toHaveLength(8);
    for (const post of bloco.posts) {
      const chaves = Object.keys(post);
      expect(chaves).not.toContain("lado");
      expect(chaves).not.toContain("intensidade");
      expect(chaves).not.toContain("categoria");
      expect(chaves).not.toContain("emotionalHook");
      expect(post.author.handle.startsWith("@")).toBe(true);
      expect(post.commentsTotal).toBeGreaterThan(0);
      // Imagem ou arte procedural: o card nunca fica sem nada para desenhar.
      expect(Boolean(post.imageUrl) || Boolean(post.fallbackArt)).toBe(true);
    }
  });

  it("engaja o lado A e a bolha se fecha nos blocos seguintes", async () => {
    let ultimo = await prisma.post.findMany({
      where: {
        id: {
          in: normalizarEstado(
            (await prisma.run.findUniqueOrThrow({ where: { id: runId } })).engineState,
          ).servedPostIds,
        },
      },
      select: { id: true, lado: true },
    });

    for (let bloco = 0; bloco < 5; bloco += 1) {
      const ladoPorId = new Map(ultimo.map((post) => [post.id, post.lado]));
      await consumirBloco(ultimo, (postId) =>
        ladoPorId.get(postId) === "A" ? { dwellMs: 9000, curtiu: true } : { dwellMs: 800 },
      );

      const resposta = await proximoBlocoDoFeed(prisma, runId, ESCOLA_TESTE);
      if (resposta.posts.length === 0) break;

      ultimo = await prisma.post.findMany({
        where: { id: { in: resposta.posts.map((post) => post.id) } },
        select: { id: true, lado: true },
      });
    }

    const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
    const estado = normalizarEstado(run.engineState);

    expect(estado.scoreA).toBeGreaterThan(estado.scoreB);
    expect(estado.baselineDwellMs).toBeGreaterThan(0);
    expect(new Set(estado.servedPostIds).size).toBe(estado.servedPostIds.length);
    expect(estado.intensityUnlocked.A).toBeGreaterThan(1);
  });

  it("idempotência: reprocessar não pontua duas vezes", async () => {
    const antes = normalizarEstado(
      (await prisma.run.findUniqueOrThrow({ where: { id: runId } })).engineState,
    );
    await proximoBlocoDoFeed(prisma, runId, ESCOLA_TESTE);
    const depois = normalizarEstado(
      (await prisma.run.findUniqueOrThrow({ where: { id: runId } })).engineState,
    );

    expect(depois.scoreA).toBe(antes.scoreA);
    expect(depois.scoreB).toBe(antes.scoreB);
  });

  it("encerra a sessão ao consumir o limite de posts", async () => {
    // O gatilho por posts tem piso de tempo (minMinutos): envelhece a sessão,
    // senão uma rolagem instantânea encerraria fora da janela de 12–18 min.
    const dezMinutosAtras = new Date(Date.now() - 10 * 60_000);
    const estadoAtual = normalizarEstado(
      (await prisma.run.findUniqueOrThrow({ where: { id: runId } })).engineState,
    );
    await prisma.run.update({
      where: { id: runId },
      data: {
        startedAt: dezMinutosAtras,
        engineState: {
          ...estadoAtual,
          feedIniciadoEm: dezMinutosAtras.toISOString(),
        } as unknown as object,
      },
    });

    // 70 > maxPosts (60): o limite de posts precisa ser efetivamente cruzado.
    const posts = await prisma.post.findMany({ where: { activityId }, select: { id: true }, take: 70 });
    let ts = 1_900_000_000_000;

    await prisma.event.createMany({
      data: posts.map((post) => {
        ts += 10;
        return {
          escolaId: ESCOLA_TESTE,
          runId,
          postId: post.id,
          tipo: "visto",
          payload: { dwellMs: 3000 },
          clientTs: BigInt(ts),
        };
      }),
    });

    const bloco = await proximoBlocoDoFeed(prisma, runId, ESCOLA_TESTE);
    expect(bloco.modulos.some((modulo) => modulo.tipo === "fim_sessao")).toBe(true);

    const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
    expect(run.fase).toBe("encerramento");
  });
});
