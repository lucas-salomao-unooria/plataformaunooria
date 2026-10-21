import { PrismaClient } from "@prisma/client";
import { MISSAO_NAO_LIBERADA, exigirMissaoLiberada } from "../src/comum/liberacao";
import {
  RECURSO_INDISPONIVEL,
  exigirProdutoDisponivel,
  exigirRecursoDisponivel,
} from "../src/comum/disponibilidade";
import { PrismaService } from "../src/prisma/prisma.service";
import { RecursosController } from "../src/recursos/recursos.controller";
import { PRODUTOS, ligadoPorPadrao } from "../src/recursos/catalogo";
import { SalasService } from "../src/salas/salas.service";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * A PORTA do interruptor da rede (ADR-87), no Postgres.
 *
 * O que se prova aqui é a coisa que decide se a criança entra: a
 * disponibilidade dentro de `exigirMissaoLiberada`, a cadeia de escopos com
 * regional de verdade, o teto do produto, o filtro da grade e o bloqueio do
 * liberar. Nenhuma delas aparece no typecheck — desligar um produto e a missão
 * continuar abrindo é uma passagem silenciosa, e é a que este arquivo fecha.
 *
 * UMA ESCOLA POR SUÍTE, e uma regra a MAIS que as outras suítes não têm:
 *
 *   **NUNCA escreva linha de escopo-CONTRATO (`escola_id IS NULL`) aqui.**
 *
 * `disponibilidades` está fora da RLS por desenho, e a linha de contrato vale
 * para a stack INTEIRA. Enquanto ela existe, toda suíte que roda em paralelo vê
 * o produto desligado — e o Jest paraleliza. Custou duas suítes vermelhas
 * (`vila-postgres` e `o-eco-no-grupo-postgres`) que passam sozinhas e falham
 * juntas, com o sintoma apontando para a Vila e a causa aqui.
 *
 * O escopo-contrato é exercitado com um `expId` que NÃO existe no catálogo e que
 * ninguém mais usa; a cadeia inteira (escola \seta regional \seta contrato) já se
 * prova sem banco em `recursos-regras.spec.ts`.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const REGIONAL = "teste-porta-regional";
const ESCOLA = "teste-porta";
const VILA = "app-70-vila-do-lume";
const INSTA = "exp08ef1b";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService & PrismaClient;
const salas = new SalasService(prisma);
const recursos = new RecursosController(prisma);

const ids = { turma: "", estudante: "", professor: "", admin: "" };

/** O recurso de escopo-contrato desta suíte: `expId` que não existe no catálogo
 *  e que nenhuma outra suíte conhece. É o único que pode ir a `escola_id NULL`. */
const SO_MEU = "app-99-porta-de-teste";

async function limparDisponibilidades() {
  /* A AUDITORIA TAMBÉM É LIXO DE TESTE (ADR-89). Ela é append-only e ninguém
     mais a limpa, então cada escrita destes testes fica no banco de dev para
     sempre — foi visto no print da suíte e2e: o histórico da REDE aberto em
     `/admin/recursos` com dezenas de linhas de `exp-99-...` e "Admin da
     versão". Mesma família do `salas-postgres` reescrevendo o catálogo: linha
     em tabela sem RLS é estado global, e a tela do cliente é onde ela aparece. */
  await prisma.recursoAuditoria.deleteMany({
    where: {
      OR: [
        { escolaId: { in: [ESCOLA, REGIONAL] } },
        { escolaId: null, recursoId: `experiencia:${SO_MEU}` },
      ],
    },
  });
  await prisma.disponibilidade.deleteMany({
    where: {
      OR: [
        { escolaId: { in: [ESCOLA, REGIONAL] } },
        { escolaId: null, recursoId: `experiencia:${SO_MEU}` },
      ],
    },
  });
}

async function limpar() {
  await limparDisponibilidades();
  await prisma.liberacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: { in: [ESCOLA, REGIONAL] } } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: REGIONAL, nome: "Regional da porta", tipo: "regional" } });
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola da porta", paiId: REGIONAL } });

  ids.turma = (await criarTurmaDeTeste(prisma, ESCOLA, "8P", "8EF")).id;

  const pessoa = async (username: string, role: string, turmaId?: string) =>
    (
      await prisma.user.create({
        data: { escolaId: ESCOLA, username, role, displayName: username, passwordHash: "x", turmaId },
      })
    ).id;
  ids.professor = await pessoa("porta-prof", "professor");
  ids.estudante = await pessoa("porta-ana", "estudante", ids.turma);
  ids.admin = await pessoa("porta-admin", "admin");

  await prisma.matricula.create({
    data: {
      escolaId: ESCOLA,
      turmaId: ids.turma,
      usuarioId: ids.professor,
      papel: "professor",
      principal: false,
      inicio: new Date(Date.UTC(2026, 0, 1)),
    },
  });
  await prisma.matricula.create({
    data: {
      escolaId: ESCOLA,
      turmaId: ids.turma,
      usuarioId: ids.estudante,
      papel: "estudante",
      principal: true,
      inicio: new Date(Date.UTC(2026, 0, 1)),
    },
  });

  /* A Vila liberada nesta turma: é o estado em que a disponibilidade é a ÚNICA
     coisa que pode fechar a porta — sem isso, todo teste abaixo passaria por
     falta de liberação e não provaria nada. */
  await prisma.liberacao.create({
    data: {
      escolaId: ESCOLA,
      turmaId: ids.turma,
      expId: VILA,
      liberadaPor: ids.professor,
      estado: "liberada",
    },
  });
});

afterEach(limparDisponibilidades);

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

/** Liga/desliga como o painel fará. */
function definir(recursoId: string, escolaId: string | null, ligado: boolean) {
  return prisma.disponibilidade.create({
    data: { recursoId, escolaId, ligado, motivo: ligado ? null : "teste", definidoPor: ids.admin },
  });
}

/** O `codigo` do 403 — é por ele que a tela e o log decidem. */
async function codigoDoErro(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (erro) {
    const resposta = (erro as { response?: { codigo?: string } }).response;
    return resposta?.codigo ?? "sem-codigo";
  }
}

const aPorta = () =>
  prisma.comTenancy(
    (tx) => exigirMissaoLiberada(tx, ESCOLA, ids.estudante, VILA),
    ESCOLA,
  );

describe("a porta do estudante", () => {
  test("abre quando o professor liberou e nada está desligado", async () => {
    expect(await codigoDoErro(aPorta)).toBeNull();
  });

  test("produto desligado na ESCOLA fecha a porta, com o código do eixo certo", async () => {
    await definir("produto:entre-redes", ESCOLA, false);
    // NÃO `missao-nao-liberada`: o código é o que diz em qual dos dois eixos
    // procurar, e a liberação continua lá, intacta.
    expect(await codigoDoErro(aPorta)).toBe(RECURSO_INDISPONIVEL);
  });

  test("desligar NÃO apaga a liberação do professor — religar devolve tudo", async () => {
    await definir("produto:entre-redes", ESCOLA, false);
    expect(await codigoDoErro(aPorta)).toBe(RECURSO_INDISPONIVEL);

    const linha = await prisma.liberacao.findUnique({
      where: { escolaId_turmaId_expId: { escolaId: ESCOLA, turmaId: ids.turma, expId: VILA } },
    });
    expect(linha?.estado).toBe("liberada");

    await limparDisponibilidades();
    expect(await codigoDoErro(aPorta)).toBeNull();
  });

  test("a REGIONAL desliga a escola que pende dela", async () => {
    await definir("produto:entre-redes", REGIONAL, false);
    expect(await codigoDoErro(aPorta)).toBe(RECURSO_INDISPONIVEL);
  });

  test("e a ESCOLA reabre o teto que a REGIONAL fechou", async () => {
    /* A regional é o escopo MENOS específico que esta suíte pode usar sem
       poluir as outras — e prova a mesma precedência que o contrato provaria. */
    await definir("produto:entre-redes", REGIONAL, false);
    await definir("produto:entre-redes", ESCOLA, true);
    expect(await codigoDoErro(aPorta)).toBeNull();
  });

  test("linha de escopo-CONTRATO é lida (o único recurso que esta suíte pode usar lá)", async () => {
    await definir(`experiencia:${SO_MEU}`, null, false);
    expect(
      await codigoDoErro(() =>
        prisma.comTenancy((tx) => exigirRecursoDisponivel(tx, ESCOLA, SO_MEU), ESCOLA),
      ),
    ).toBe(RECURSO_INDISPONIVEL);
  });

  test("desligar só a EXPERIÊNCIA fecha ela, com o produto ligado", async () => {
    await definir(`experiencia:${VILA}`, ESCOLA, false);
    expect(await codigoDoErro(aPorta)).toBe(RECURSO_INDISPONIVEL);
  });

  test("sem liberação, o código volta a ser o da SALA — os dois eixos não se misturam", async () => {
    expect(
      await codigoDoErro(() =>
        prisma.comTenancy((tx) => exigirMissaoLiberada(tx, ESCOLA, ids.estudante, INSTA), ESCOLA),
      ),
    ).toBe(MISSAO_NAO_LIBERADA);
  });
});

describe("a grade da sala", () => {
  test("perde a missão indisponível — ela SAI, não fica com cadeado", async () => {
    const antes = await salas.daTurma(ESCOLA, ids.turma, ids.professor);
    expect(antes.missoes.map((m) => m.expId)).toContain(VILA);

    await definir(`experiencia:${VILA}`, ESCOLA, false);
    const depois = await salas.daTurma(ESCOLA, ids.turma, ids.professor);
    expect(depois.missoes.map((m) => m.expId)).not.toContain(VILA);
    // As outras continuam: o filtro é por recurso, não um apagão da grade.
    expect(depois.missoes.length).toBeGreaterThan(0);
  });

  test("e a sala do ESTUDANTE também", async () => {
    await definir("produto:entre-redes", ESCOLA, false);
    const { salas: minhas } = await salas.minhas(ESCOLA, ids.estudante);
    const daTurma = minhas.find((s) => s.turma.id === ids.turma);
    expect(daTurma?.missoes ?? []).toHaveLength(0);
  });
});

describe("liberar uma missão indisponível", () => {
  test("é recusado — esconder o card na tela não fecha a rota", async () => {
    await definir(`experiencia:${VILA}`, ESCOLA, false);
    expect(
      await codigoDoErro(() =>
        salas.definirEstado(ESCOLA, ids.turma, VILA, "liberada", ids.professor),
      ),
    ).toBe(RECURSO_INDISPONIVEL);
  });
});

describe("a ferramenta de professor", () => {
  test("fecha pelo produto dela, e a mensagem NÃO é a da missão disfarçada", async () => {
    await definir("produto:bem-estar", ESCOLA, false);
    try {
      await prisma.comTenancy(
        (tx) => exigirRecursoDisponivel(tx, ESCOLA, "app-91-bem-estar"),
        ESCOLA,
      );
      throw new Error("devia ter recusado");
    } catch (erro) {
      const r = (erro as { response?: { codigo?: string; mensagem?: string } }).response;
      expect(r?.codigo).toBe(RECURSO_INDISPONIVEL);
      // Dentro do aparelho da criança a mensagem é copy de produto; aqui não há
      // disfarce a proteger, então ela pode dizer o que aconteceu.
      expect(r?.mensagem).toContain("rede");
    } finally {
      await prisma.disponibilidade.deleteMany({
        where: { recursoId: "produto:bem-estar", escolaId: ESCOLA },
      });
    }
  });
});

test("experiência FORA do catálogo não é trancada por isto", async () => {
  /* Stack de dev ou recém-provisionada tem `experiencias` VAZIA, e o hub já sabe
     cair no `experiencia.json` do bundle. Recusar aqui faria toda missão morrer
     num ambiente novo, com um 403 que não explica nada. */
  expect(
    await codigoDoErro(() =>
      prisma.comTenancy((tx) => exigirRecursoDisponivel(tx, ESCOLA, "app-99-inexistente"), ESCOLA),
    ),
  ).toBeNull();
});

describe("GET /recursos/efetivos — o que o hub lê para montar os cards", () => {
  /** O `req` que o OidcGuard injeta, com a escola do claim. */
  const comoEstudante = { auth: { usuarioId: ids.estudante, escolaId: ESCOLA, perfil: "estudante" as const } };

  test("traz SEMPRE todos os produtos (hoje cinco, com o agente-professor), ligados ou não", async () => {
    const r = await recursos.efetivos(comoEstudante);
    // Um mapa que só lista o ligado obriga quem lê a saber a lista completa de
    // cor — e o hub passaria a ter a segunda fonte do vocabulário.
    expect(Object.keys(r.produtos).sort()).toEqual([...PRODUTOS].sort());
    // Sem linha, cada produto vale o SEU padrão: ligado, salvo o que está em
    // teste interno (a Ajuda com avatar, `PRODUTOS_DESLIGADOS_POR_PADRAO`).
    for (const slug of PRODUTOS) expect(r.produtos[slug]?.ligado).toBe(ligadoPorPadrao(slug));
    expect(r.produtos.ajuda?.ligado).toBe(false);
  });

  test("reflete o desligamento e aplica o teto nas experiências do produto", async () => {
    await definir("produto:entre-redes", ESCOLA, false);
    const r = await recursos.efetivos(comoEstudante);
    expect(r.produtos["entre-redes"]?.ligado).toBe(false);
    // O teto desce: a Vila é do Entre Redes e não tem linha própria nenhuma.
    expect(r.experiencias[VILA]?.ligado).toBe(false);
    // E não vaza para outro produto.
    expect(r.produtos["bem-estar"]?.ligado).toBe(true);
  });

  test("o produto SEM experiência (agente-professor) desliga na leitura e na porta", async () => {
    await expect(exigirProdutoDisponivel(prisma, ESCOLA, "agente-professor")).resolves.toBeUndefined();
    await definir("produto:agente-professor", REGIONAL, false);
    const r = await recursos.efetivos(comoEstudante);
    expect(r.produtos["agente-professor"]?.ligado).toBe(false);
    await expect(exigirProdutoDisponivel(prisma, ESCOLA, "agente-professor")).rejects.toMatchObject({
      response: { codigo: RECURSO_INDISPONIVEL },
    });
    /* A escola religa: o escopo mais específico ganha. */
    await definir("produto:agente-professor", ESCOLA, true);
    await expect(exigirProdutoDisponivel(prisma, ESCOLA, "agente-professor")).resolves.toBeUndefined();
  });

  test("a versão fixada de uma experiência chega na resposta", async () => {
    await prisma.disponibilidade.create({
      data: {
        recursoId: `experiencia:${VILA}`,
        escolaId: ESCOLA,
        ligado: true,
        versaoFixa: "1.0.0",
        definidoPor: ids.admin,
      },
    });
    const r = await recursos.efetivos(comoEstudante);
    expect(r.experiencias[VILA]).toEqual({ ligado: true, versao: "1.0.0" });
  });

  test("perfil de contrato (sem escola no token) IGNORA a linha da escola", async () => {
    await definir("produto:entre-redes", ESCOLA, false);
    const r = await recursos.efetivos({
      auth: { usuarioId: ids.admin, escolaId: "", perfil: "admin" as const },
    });
    /* A linha da ESCOLA não vale para quem não está olhando escola nenhuma — e
       o padrão do código é LIGADO. Sem linha de contrato aqui de propósito:
       ela seria estado global (ver o cabeçalho). */
    expect(r.produtos["entre-redes"]?.ligado).toBe(true);
  });
});
