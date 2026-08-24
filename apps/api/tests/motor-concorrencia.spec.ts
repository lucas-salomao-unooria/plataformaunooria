import { normalizarEstado } from "../src/motor/estado";
import { proximoBlocoDoFeed } from "../src/motor/servico";
import { contextoDeTeste, prisma } from "./motor-fixture-db";

const ctx = contextoDeTeste("teste-motor-concorrencia");
const ESCOLA_TESTE = ctx.escolaId;

/**
 * Regressão do bug alto encontrado na auditoria do origem: dois pedidos
 * simultâneos de bloco na mesma run se sobrescreviam, um bloco inteiro
 * desaparecia do estado e posts já entregues voltavam a ser servidos.
 * O lock consultivo por run (pg_advisory_xact_lock) dentro da transação do
 * comTenancy é o que este teste protege.
 */
describe("dois pedidos de bloco ao mesmo tempo", () => {
  let runId = "";

  beforeAll(async () => {
    await ctx.limpar();
    const fixture = await ctx.criar({ posts: 30 });
    runId = fixture.run.id;
    await proximoBlocoDoFeed(prisma, runId, ESCOLA_TESTE); // bloco inicial
  });

  afterAll(async () => {
    await ctx.limpar();
    await prisma.$disconnect();
  });

  it("não perde bloco nem serve o mesmo post duas vezes", async () => {
    const [primeiro, segundo] = await Promise.all([
      proximoBlocoDoFeed(prisma, runId, ESCOLA_TESTE),
      proximoBlocoDoFeed(prisma, runId, ESCOLA_TESTE),
    ]);

    const entregues = [...primeiro.posts, ...segundo.posts].map((post) => post.id);
    const run = await prisma.run.findUniqueOrThrow({ where: { id: runId } });
    const estado = normalizarEstado(run.engineState);

    // Nada entregue ao aluno fica fora do estado…
    for (const postId of entregues) {
      expect(estado.servedPostIds).toContain(postId);
    }
    // …nem sai duplicado no par concorrente…
    expect(new Set(entregues).size).toBe(entregues.length);
    // …e a série por bloco fica consistente com o contador.
    expect(estado.blocosServidos).toHaveLength(estado.blocksServed);
    expect(new Set(estado.servedPostIds).size).toBe(estado.servedPostIds.length);
  });
});
