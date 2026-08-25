import { ORDEM_DA_GRADE } from "../src/geracao/geracao.controller";
import { contextoDeTeste, prisma } from "./motor-fixture-db";

const ctx = contextoDeTeste("teste-geracao-paginacao");

/**
 * Regressão da grade de revisão do professor (`GET /atividades/:id/posts`).
 *
 * Os posts nascem de um `createMany` só, então TODOS compartilham o
 * `created_at` — o mesmo empate que a geração real produz (o `now()` do
 * Postgres é o timestamp de início da transação do worker). Com a ordenação
 * parcial que existia antes, `LIMIT/OFFSET` sobre a chave empatada devolvia a
 * mesma linha em duas páginas e escondia outra: no app origem, 207 de 208.
 *
 * As 216 linhas do fixture não são exagero: com poucas dezenas o Postgres
 * ordena tudo de uma vez e o empate cai numa ordem estável por acaso — o
 * defeito só aparece quando o planejador troca para top-N heapsort e cada
 * OFFSET reordena os empatados de um jeito. Com este tamanho, a ordenação
 * antiga devolve 213 de 216 (medido); é o que dá dente ao teste.
 */
describe("paginação da grade de revisão", () => {
  const TAMANHO_PAGINA = 24;
  let activityId = "";

  beforeAll(async () => {
    await ctx.limpar();
    const fixture = await ctx.criar({ posts: 24 });
    activityId = fixture.atividade.id;
  });

  afterAll(async () => {
    await ctx.limpar();
    await prisma.$disconnect();
  });

  it("o lote inteiro empata em created_at — é o cenário que quebrava", async () => {
    const instantes = await prisma.post.findMany({
      where: { activityId },
      select: { createdAt: true },
      distinct: ["createdAt"],
    });
    expect(instantes).toHaveLength(1);
  });

  it("percorrer as páginas devolve cada post uma vez, sem sumiço", async () => {
    const total = await prisma.post.count({ where: { activityId } });
    expect(total).toBeGreaterThan(TAMANHO_PAGINA);

    const vistos: string[] = [];
    for (let pagina = 1; pagina <= Math.ceil(total / TAMANHO_PAGINA); pagina += 1) {
      const posts = await prisma.post.findMany({
        where: { activityId },
        orderBy: ORDEM_DA_GRADE,
        skip: (pagina - 1) * TAMANHO_PAGINA,
        take: TAMANHO_PAGINA,
        select: { id: true },
      });
      vistos.push(...posts.map((post) => post.id));
    }

    expect(new Set(vistos).size).toBe(total);
    expect(vistos).toHaveLength(total);
  });
});
