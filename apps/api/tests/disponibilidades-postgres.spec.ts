import { PrismaClient } from "@prisma/client";
import { PRODUTOS, RECURSO_ID_RE } from "../src/recursos/catalogo";

/**
 * As GARANTIAS DE BANCO do painel da Unooria (ADR-87).
 *
 * Nada aqui se prova em TypeScript: são constraints, e o que elas seguram é
 * exatamente o que passa no typecheck e quebra em produção. Três delas já têm
 * precedente caro neste repo:
 *
 *  - vocabulário em DOIS lugares (Zod + CHECK) que divergiu e custou um deploy
 *    inteiro, com o 500 visível só no log da api (`permissoes-de-iframe.spec.ts`);
 *  - índice único sobre coluna NULÁVEL, que no Postgres não é único;
 *  - RLS ausente por DESENHO, que a próxima migração "conserta" sem saber.
 *
 * UMA ESCOLA POR SUÍTE — o Jest paraleliza e limpeza compartilhada corromperia
 * a vizinha.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-disp";
const REGIONAL = "teste-disp-regional";

const prisma = new PrismaClient({ datasources: { db: { url: URL } } });

/** Preenchido no `beforeAll`: a FK de `definido_por` exige linha em `users`. */
let autor = "";

/** Um recurso por teste, para nenhum deles depender da limpeza do outro. */
const recurso = (sufixo: string) => `experiencia:exp-99-${sufixo}`;

async function limpar() {
  await prisma.disponibilidade.deleteMany({
    where: { OR: [{ escolaId: ESCOLA }, { escolaId: REGIONAL }, { escolaId: null }] },
  });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: { in: [ESCOLA, REGIONAL] } } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: REGIONAL, nome: "Regional de teste", tipo: "regional" } });
  await prisma.escola.create({
    data: { id: ESCOLA, nome: "Escola das disponibilidades", paiId: REGIONAL },
  });
  autor = (
    await prisma.user.create({
      data: {
        escolaId: ESCOLA,
        username: "disp-admin",
        role: "admin",
        displayName: "Admin de teste",
        passwordHash: "x",
      },
    })
  ).id;
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

/** O texto do CHECK, para os testes que comparam banco e código. */
async function definicaoDoCheck(nome: string): Promise<string> {
  const [linha] = await prisma.$queryRaw<{ definicao: string }[]>`
    SELECT pg_get_constraintdef(oid) AS definicao FROM pg_constraint WHERE conname = ${nome}`;
  if (!linha) throw new Error(`constraint ${nome} não existe`);
  return linha.definicao;
}

describe("o vocabulário vive em dois lugares e eles têm de concordar", () => {
  test("o CHECK de `produto` aceita exatamente os PRODUTOS do código", async () => {
    const definicao = await definicaoDoCheck("ck_experiencias_produto");
    const noBanco = [...definicao.matchAll(/'([a-z-]+)'::text/g)].map((m) => m[1]);
    expect(noBanco.sort()).toEqual([...PRODUTOS].sort());
  });

  test("o CHECK de `recurso_id` é a MESMA expressão de RECURSO_ID_RE", async () => {
    const definicao = await definicaoDoCheck("ck_disponibilidades_recurso_id");
    // `CHECK ((recurso_id ~ '^(produto|experiencia):[a-z0-9-]+$'::text))`
    const [, doBanco] = /~ '(.+)'::text/.exec(definicao) ?? [];
    expect(doBanco).toBe(RECURSO_ID_RE.source);
  });

  test("produto fora do vocabulário é recusado pelo banco", async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO experiencias (exp_id, nome, versao_ativa, produto)
        VALUES ('exp-99-produto-invalido', 'teste', '1.0.0', 'gamificacao')`,
    ).rejects.toThrow();
  });

  test("`recurso_id` sem prefixo do vocabulário é recusado", async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO disponibilidades (recurso_id, ligado, motivo, definido_por)
        VALUES ('jogo', false, 'motivo', ${autor}::uuid)`,
    ).rejects.toThrow();
  });
});

describe("campo que não faria nada é recusado", () => {
  test("`versao_fixa` numa linha de PRODUTO é recusada", async () => {
    await expect(
      prisma.disponibilidade.create({
        data: { recursoId: "produto:bem-estar", ligado: true, versaoFixa: "1.0.0", definidoPor: autor },
      }),
    ).rejects.toThrow();
  });

  test("`versao_fixa` numa linha de EXPERIÊNCIA é aceita", async () => {
    const criada = await prisma.disponibilidade.create({
      data: { recursoId: recurso("com-versao"), escolaId: ESCOLA, ligado: true, versaoFixa: "1.0.0", definidoPor: autor },
    });
    expect(criada.versaoFixa).toBe("1.0.0");
  });
});

describe("desligar exige motivo", () => {
  test("desligado sem motivo é recusado", async () => {
    await expect(
      prisma.disponibilidade.create({
        data: { recursoId: recurso("sem-motivo"), escolaId: ESCOLA, ligado: false, definidoPor: autor },
      }),
    ).rejects.toThrow();
  });

  test("LIGADO sem motivo é aceito — ligado é o estado normal", async () => {
    const criada = await prisma.disponibilidade.create({
      data: { recursoId: recurso("ligado-sem-motivo"), escolaId: ESCOLA, ligado: true, definidoPor: autor },
    });
    expect(criada.motivo).toBeNull();
  });
});

describe("o índice único PARCIAL do escopo-contrato", () => {
  /**
   * A armadilha central da migration: `@@unique([recursoId, escolaId])` NÃO
   * impede duas linhas de contrato, porque no Postgres `NULL` é distinto de
   * `NULL` num índice único. Sem o parcial, dois cliques em "desligar para a
   * rede" criam duas linhas e o resolvedor passa a depender da ordem do
   * `findMany` — sem erro e sem sintoma, até as duas discordarem.
   */
  test("duas linhas de CONTRATO para o mesmo recurso são recusadas", async () => {
    const id = recurso("duplo-contrato");
    await prisma.disponibilidade.create({
      data: { recursoId: id, escolaId: null, ligado: false, motivo: "primeira", definidoPor: autor },
    });
    await expect(
      prisma.disponibilidade.create({
        data: { recursoId: id, escolaId: null, ligado: true, definidoPor: autor },
      }),
    ).rejects.toThrow();
  });

  test("e ele NÃO é abrangente demais: contrato + regional + escola convivem", async () => {
    const id = recurso("tres-escopos");
    for (const escolaId of [null, REGIONAL, ESCOLA]) {
      await prisma.disponibilidade.create({
        data: { recursoId: id, escolaId, ligado: true, definidoPor: autor },
      });
    }
    expect(await prisma.disponibilidade.count({ where: { recursoId: id } })).toBe(3);
  });
});

describe("a ausência de RLS é DESENHO, não esquecimento", () => {
  /**
   * Toda tabela nova deste repo entra na política da regra inviolável nº 1, e
   * estas duas ficam FORA de propósito: são configuração da rede (não dado de
   * estudante), e a linha de escopo-contrato tem `escola_id` NULO por desenho —
   * uma política `escola_id = current_setting('app.escola_id')` esconderia
   * justamente a resposta que a tabela existe para dar. É o mesmo motivo de
   * `users`, `turmas` e `lotacoes`.
   *
   * O teste existe para que a próxima migração não "conserte" isso: ligar RLS
   * aqui faz TODO produto parecer ligado (a linha que o desligava fica
   * invisível), e o sintoma é o oposto de um erro de permissão.
   */
  test.each(["disponibilidades", "experiencias_versoes"])("%s não tem RLS", async (tabela) => {
    const [linha] = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`
      SELECT relrowsecurity FROM pg_class WHERE relname = ${tabela}`;
    expect(linha?.relrowsecurity).toBe(false);
  });
});

test("o histórico nasceu com a versão que já estava no ar", async () => {
  const experiencias = await prisma.experiencia.findMany({ select: { expId: true, versaoAtiva: true } });
  for (const exp of experiencias) {
    const linha = await prisma.experienciaVersao.findUnique({
      where: { expId_versao: { expId: exp.expId, versao: exp.versaoAtiva } },
    });
    // Sem isto o painel abriria com "nenhuma versão conhecida" para as nove
    // experiências — a tela vazia que faz a pessoa duvidar da tela, não do dado.
    expect(linha).not.toBeNull();
  }
});
