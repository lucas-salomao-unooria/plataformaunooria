import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { RecursosAdminController } from "../src/recursos/recursos-admin.controller";

/**
 * O PAINEL DA UNOORIA no Postgres (ADR-87/88): as duas rotas de escrita e os
 * três estados do interruptor.
 *
 * O que mais importa aqui é a IDEMPOTÊNCIA do escopo-contrato. O `upsert` do
 * Prisma não consegue endereçar aquela linha (o único composto não casa `NULL`),
 * então a gravação é `ON CONFLICT ... WHERE escola_id IS NULL` — inferindo o
 * índice PARCIAL da migration. Se esse alvo estiver errado, o segundo clique em
 * "desligar para a rede" cria uma SEGUNDA linha e o resolvedor passa a depender
 * da ordem do `findMany`.
 *
 * **NUNCA desligamos no escopo-contrato aqui.** Aquela linha vale para a stack
 * inteira e o Jest paraleliza — foi o que derrubou `vila-postgres` e
 * `o-eco-no-grupo-postgres` uma vez. A idempotência do índice se prova
 * igualmente bem com `ligado: true`, que não muda comportamento de ninguém.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const REGIONAL = "teste-painel-regional";
const ESCOLA = "teste-painel";
const VILA = "exp-70-vila-do-lume";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const painel = new RecursosAdminController(prisma);

let admin = "";
const comoAdmin = () => ({ auth: { usuarioId: admin, escolaId: "", perfil: "admin" as const } });

/** O recurso que esta suíte pode levar ao escopo-contrato, e só com `ligado`. */
const NO_CONTRATO = "produto:bem-estar";

async function limpar() {
  await prisma.disponibilidade.deleteMany({
    where: {
      OR: [
        { escolaId: { in: [ESCOLA, REGIONAL] } },
        { escolaId: null, recursoId: NO_CONTRATO },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: { in: [ESCOLA, REGIONAL] } } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: REGIONAL, nome: "Regional do painel", tipo: "regional" } });
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola do painel", paiId: REGIONAL } });
  admin = (
    await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "painel-admin",
        role: "admin",
        displayName: "Admin do painel",
        passwordHash: "x",
      },
    })
  ).id;
});

afterEach(async () => {
  await prisma.disponibilidade.deleteMany({
    where: {
      OR: [
        { escolaId: { in: [ESCOLA, REGIONAL] } },
        { escolaId: null, recursoId: NO_CONTRATO },
      ],
    },
  });
});

afterAll(async () => {
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
});

const doProduto = <T extends { slug: string }>(p: readonly T[] | undefined, slug: string) =>
  (p ?? []).find((x) => x.slug === slug);

describe("GET /recursos/painel", () => {
  test("o escopo-contrato se identifica, e nada nasce decidido", async () => {
    const r = await painel.painel();
    expect(r.escopo).toEqual({ escolaId: null, nome: "Rede (contrato inteiro)", tipo: null });
    for (const produto of r.produtos) {
      expect(produto.estadoAqui).toBe("herda");
      expect(produto.efetivo).toMatchObject({ ligado: true, origem: "padrao" });
    }
  });

  test("as experiências vêm DENTRO do produto que o manifesto declara", async () => {
    const r = await painel.painel();
    const entreRedes = r.produtos.find((p) => p.slug === "entre-redes");
    // A composição é derivada de `experiencias.produto` — nenhuma lista à mão.
    expect(entreRedes?.experiencias.map((e) => e.expId)).toContain(VILA);
    const bemEstar = r.produtos.find((p) => p.slug === "bem-estar");
    expect(bemEstar?.experiencias.map((e) => e.expId)).toEqual(["exp-91-bem-estar"]);
    // E cada uma traz a versão que o hub monta hoje.
    expect(entreRedes?.experiencias[0]?.versaoAtiva).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("a escola se identifica pelo nome e pelo tipo", async () => {
    const r = await painel.painel(ESCOLA);
    expect(r.escopo).toEqual({ escolaId: ESCOLA, nome: "Escola do painel", tipo: "escola" });
  });

  test("escola inexistente é 404 — o admin atravessa escolas, então é endereço errado", async () => {
    await expect(painel.painel("nao-existe")).rejects.toThrow();
  });
});

describe("os TRÊS estados do interruptor", () => {
  test("`herda` é a ausência de linha, e não se confunde com `ligado`", async () => {
    await painel.definir("produto:entre-redes", { escolaId: ESCOLA, ligado: true }, comoAdmin());
    const comLinha = await painel.painel(ESCOLA);
    expect(doProduto(comLinha.produtos, "entre-redes")?.estadoAqui).toBe("ligado");

    await painel.remover("produto:entre-redes", ESCOLA, comoAdmin());
    const semLinha = await painel.painel(ESCOLA);
    const p = doProduto(semLinha.produtos, "entre-redes");
    // O EFETIVO é o mesmo (ligado) nos dois casos — o que muda é a origem, e é
    // dela que a tela tira o terceiro estado.
    expect(p?.estadoAqui).toBe("herda");
    expect(p?.efetivo).toMatchObject({ ligado: true, origem: "padrao" });
  });

  test("`herdado` diz de ONDE vem, e o interruptor daqui continua em `herda`", async () => {
    await painel.definir(
      "produto:entre-redes",
      { escolaId: REGIONAL, ligado: false, motivo: "piloto suspenso na diretoria" },
      comoAdmin(),
    );
    const r = await painel.painel(ESCOLA);
    const p = doProduto(r.produtos, "entre-redes");
    expect(p?.estadoAqui).toBe("herda");
    expect(p?.efetivo).toMatchObject({
      ligado: false,
      origem: "herdado",
      decididoEm: REGIONAL,
      motivo: "piloto suspenso na diretoria",
    });
  });

  test("o TETO do produto desabilita o interruptor da experiência, sem mentir que ela está ligada", async () => {
    await painel.definir(
      "produto:entre-redes",
      { escolaId: ESCOLA, ligado: false, motivo: "incidente na trilha" },
      comoAdmin(),
    );
    const r = await painel.painel(ESCOLA);
    const vila = doProduto(r.produtos, "entre-redes")?.experiencias.find((e) => e.expId === VILA);
    expect(vila?.tetoDoProduto).toBe(true);
    expect(vila?.efetivo.ligado).toBe(false);
    // A linha PRÓPRIA dela continua inexistente: religar o produto devolve tudo.
    expect(vila?.estadoAqui).toBe("herda");
  });
});

describe("PUT /recursos/:recursoId", () => {
  test("desligar SEM motivo é recusado antes de tocar o banco", async () => {
    await expect(
      painel.definir("produto:entre-redes", { escolaId: ESCOLA, ligado: false }, comoAdmin()),
    ).rejects.toThrow();
    expect(await prisma.disponibilidade.count({ where: { escolaId: ESCOLA } })).toBe(0);
  });

  test("é IDEMPOTENTE no escopo de escola: dois cliques, uma linha", async () => {
    for (const motivo of ["primeiro", "segundo"]) {
      await painel.definir(`experiencia:${VILA}`, { escolaId: ESCOLA, ligado: false, motivo }, comoAdmin());
    }
    const linhas = await prisma.disponibilidade.findMany({
      where: { recursoId: `experiencia:${VILA}`, escolaId: ESCOLA },
    });
    expect(linhas).toHaveLength(1);
    // O segundo ATUALIZOU, não inseriu.
    expect(linhas[0]?.motivo).toBe("segundo");
  });

  test("é IDEMPOTENTE no escopo-CONTRATO — o índice PARCIAL é o que garante isso", async () => {
    /* Só `ligado: true`: a linha de contrato vale para a stack inteira e o Jest
       paraleliza. O que se prova aqui é o alvo do `ON CONFLICT`, e ele não
       depende do valor de `ligado`. */
    await painel.definir(NO_CONTRATO, { escolaId: null, ligado: true }, comoAdmin());
    await painel.definir(NO_CONTRATO, { escolaId: null, ligado: true }, comoAdmin());

    const linhas = await prisma.disponibilidade.findMany({
      where: { recursoId: NO_CONTRATO, escolaId: null },
    });
    // Sem o índice parcial, aqui haveria DUAS — e o resolvedor passaria a
    // depender da ordem do `findMany`, sem erro e sem sintoma.
    expect(linhas).toHaveLength(1);
  });

  test("no escopo-contrato, decidir ALI lê como `aqui` — não como `contrato`", async () => {
    /* Regressão de um defeito visto na TELA: no contrato, `escopo` e
       `decididoEm` são os dois nulos, e testar `=== null` antes de
       `=== escopo` fazia a própria decisão aparecer como "vem da rede" —
       herdada de um nível acima que não existe. */
    await painel.definir(NO_CONTRATO, { escolaId: null, ligado: true }, comoAdmin());
    const r = await painel.painel();
    expect(doProduto(r.produtos, "bem-estar")?.efetivo).toMatchObject({
      origem: "aqui",
      decididoEm: null,
    });
  });

  test("`atualizado_em` anda no segundo clique (SQL cru passa por baixo do @updatedAt)", async () => {
    await painel.definir(`experiencia:${VILA}`, { escolaId: ESCOLA, ligado: true }, comoAdmin());
    const antes = await prisma.disponibilidade.findFirstOrThrow({
      where: { recursoId: `experiencia:${VILA}`, escolaId: ESCOLA },
    });
    await new Promise((r) => setTimeout(r, 15));
    await painel.definir(
      `experiencia:${VILA}`,
      { escolaId: ESCOLA, ligado: false, motivo: "segunda decisão" },
      comoAdmin(),
    );
    const depois = await prisma.disponibilidade.findFirstOrThrow({
      where: { recursoId: `experiencia:${VILA}`, escolaId: ESCOLA },
    });
    expect(depois.atualizadoEm.getTime()).toBeGreaterThan(antes.atualizadoEm.getTime());
  });

  test("recurso fora do vocabulário e experiência fora do catálogo são recusados", async () => {
    await expect(
      painel.definir("jogo", { escolaId: ESCOLA, ligado: true }, comoAdmin()),
    ).rejects.toThrow();
    /* Sem esta recusa, um `expId` digitado errado criaria linha que não desliga
       nada e apareceria no painel como experiência que não existe. */
    await expect(
      painel.definir("experiencia:exp-99-nao-existe", { escolaId: ESCOLA, ligado: true }, comoAdmin()),
    ).rejects.toThrow();
  });

  test("escopo inexistente é recusado — nada de linha pendurada em escola fantasma", async () => {
    await expect(
      painel.definir("produto:entre-redes", { escolaId: "esc-fantasma", ligado: true }, comoAdmin()),
    ).rejects.toThrow();
  });
});

describe("DELETE /recursos/:recursoId", () => {
  test("remove a exceção e devolve o que fez", async () => {
    await painel.definir("produto:entre-redes", { escolaId: ESCOLA, ligado: true }, comoAdmin());
    expect(await painel.remover("produto:entre-redes", ESCOLA, comoAdmin())).toEqual({
      recursoId: "produto:entre-redes",
      escolaId: ESCOLA,
      removida: true,
    });
  });

  test("remover o que não existe NÃO é erro: o estado final pedido já valia", async () => {
    expect(await painel.remover("produto:entre-redes", ESCOLA, comoAdmin())).toMatchObject({
      removida: false,
    });
  });

  test("não atinge o escopo vizinho", async () => {
    await painel.definir("produto:entre-redes", { escolaId: ESCOLA, ligado: true }, comoAdmin());
    await painel.definir("produto:entre-redes", { escolaId: REGIONAL, ligado: true }, comoAdmin());
    await painel.remover("produto:entre-redes", ESCOLA, comoAdmin());
    expect(
      await prisma.disponibilidade.count({
        where: { recursoId: "produto:entre-redes", escolaId: REGIONAL },
      }),
    ).toBe(1);
  });
});
