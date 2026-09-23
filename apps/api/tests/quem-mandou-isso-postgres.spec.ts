import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { logger } from "../src/observabilidade/logger";
import { PrismaService } from "../src/prisma/prisma.service";
import { LOTE_DEFAULT, TEMA_DEFAULT } from "../src/quem-mandou-isso/catalogo";
import { PROIBIDO_NO_PAINEL } from "../src/quem-mandou-isso/invariantes";
import { EXP_ID, QuemMandouIssoService } from "../src/quem-mandou-isso/quem-mandou-isso.service";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarRoleDeRuntime, urlDeRuntime } from "./role-de-runtime";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp05ef1b no Postgres: a RLS das cinco tabelas, a porta da sala, a
 * missão que nasce VAZIA, as duas portas do Mural, o latch, o telão da turma e
 * o que "Zerar turma" preserva.
 *
 * UMA ESCOLA POR SUÍTE (o Jest paraleliza suítes; limpeza compartilhada
 * corromperia a outra). Molde: `manifesto-ia-postgres.spec.ts`.
 *
 * O que esta suíte prova e os testes de regra pura NÃO alcançam: que a RLS
 * ISOLA (não só que a política existe), que os CHECK recusam o que dizem
 * recusar, que o UNIQUE do encaminhamento aguenta dois toques em paralelo, e
 * que o gabarito não está na resposta do estudante antes de a professora
 * acender o telão — as quatro coisas que só o banco responde.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-quem-mandou";
const OUTRA_ESCOLA = "teste-quem-mandou-outra";

const prisma = new PrismaService({
  datasources: { db: { url: URL } },
}) as PrismaService & PrismaClient;

/**
 * O MESMO Prisma, mas com a role SEM `BYPASSRLS`.
 *
 * Sem isto o teste de isolamento passa em falso: o usuário administrativo é
 * SUPERUSER, e superusuário ignora RLS **mesmo com `FORCE ROW LEVEL SECURITY`**.
 * `app_runtime_test` é o desenho da produção — a api não é dona das tabelas.
 */
const runtime = new PrismaService({
  datasources: { db: { url: urlDeRuntime(URL) } },
}) as PrismaService & PrismaClient;

const service = new QuemMandouIssoService(prisma);

const TABELAS = [
  "exp05ef1b_conteudo_turma",
  "exp05ef1b_sessoes",
  "exp05ef1b_encaminhamentos",
  "exp05ef1b_reflexoes",
  "exp05ef1b_gates_turma",
] as const;

/** As três que assustam: o boato em caixa alta, o áudio do corredor e a chantagem. */
const EMOCIONAIS = ["msg-2", "msg-3", "msg-6"] as const;
/** As três informativas: o comunicado, a foto do mural e o recado do professor. */
const INFORMATIVAS = ["msg-1", "msg-4", "msg-7"] as const;

const RESPOSTA_DA_ANA =
  "Eu ia encaminhar o audio do meu tio sem checar nada. Agora eu vou perguntar pra ele de onde veio antes de repassar.";

let turmaId = "";
let turmaSemPreparo = "";
let turmaVizinha = "";
let ana = "";
let bia = "";
let caio = "";
let dinho = "";
let semTurma = "";
let semPreparo = "";
let vizinho = "";
/** Quem DÁ AULA na 5A. É o único que lê o texto da reflexão no painel. */
let professora = "";

/** O lote curado, como a professora o aprova com um clique no preparo. */
function loteHomologado() {
  return {
    tema: TEMA_DEFAULT,
    gatilho: "urgencia" as const,
    origem: "padrao" as const,
    mensagens: LOTE_DEFAULT.map((m) => ({ ...m })),
  };
}

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: escolas } } });
  /* Encaminhamentos e reflexões caem por CASCADE da FK com a sessão. */
  await prisma.exp05ef1bSessao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.exp05ef1bGateTurma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.exp05ef1bConteudoTurma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}

async function codigoDe(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    if (e instanceof HttpException) {
      const corpo = e.getResponse() as { codigo?: string };
      return corpo.codigo ?? `HTTP_${e.getStatus()}`;
    }
    throw e;
  }
}

/** Entra no grupo e manda os ids para o Mural, sem confirmar. */
async function curar(estudanteId: string, ids: readonly string[]) {
  await service.entrar(ESCOLA, estudanteId, turmaId);
  for (const id of ids) await service.encaminhar(ESCOLA, estudanteId, turmaId, id);
}

beforeAll(async () => {
  await criarRoleDeRuntime(prisma);
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Quem Mandou (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });

  turmaId = (await criarTurmaDeTeste(prisma, ESCOLA, "5A", "5EF")).id;
  turmaSemPreparo = (await criarTurmaDeTeste(prisma, ESCOLA, "5B", "5EF")).id;
  turmaVizinha = (await criarTurmaDeTeste(prisma, OUTRA_ESCOLA, "5A vizinha", "5EF")).id;

  const criar = (escolaId: string, turma: string | null, username: string, nome: string) =>
    prisma.user.create({
      data: {
        role: "estudante",
        escolaId,
        turmaId: turma,
        username,
        displayName: nome,
        passwordHash: "x",
      },
      select: { id: true },
    });
  ana = (await criar(ESCOLA, turmaId, "quemmandou.ana", "Ana Teste")).id;
  bia = (await criar(ESCOLA, turmaId, "quemmandou.bia", "Bia Teste")).id;
  /* Entra no grupo e NUNCA confirma: é quem o telão empurra sem contar. */
  caio = (await criar(ESCOLA, turmaId, "quemmandou.caio", "Caio Teste")).id;
  /* Só fixture de RLS e de CHECK — não participa da aula. */
  dinho = (await criar(ESCOLA, turmaId, "quemmandou.dinho", "Dinho Teste")).id;
  semTurma = (await criar(ESCOLA, null, "quemmandou.sem", "Sem Turma")).id;
  semPreparo = (await criar(ESCOLA, turmaSemPreparo, "quemmandou.crua", "Turma Crua")).id;
  vizinho = (await criar(OUTRA_ESCOLA, turmaVizinha, "quemmandou.vizinho", "Vizinho Teste")).id;

  /* A professora da 5A, com a MATRÍCULA que `professorLeciona` procura. Sem
     ela, `painel(ESCOLA, turmaId, professora)` responderia `turma-nao-encontrada`
     — e o painel chamado sem id nenhum é a leitura do GESTOR, não a dela. */
  professora = (
    await prisma.user.create({
      data: {
        role: "professor",
        escolaId: ESCOLA,
        username: "quemmandou.marta",
        displayName: "Marta Teste",
        passwordHash: "x",
      },
      select: { id: true },
    })
  ).id;
  await prisma.matricula.create({
    data: {
      escolaId: ESCOLA,
      turmaId,
      usuarioId: professora,
      papel: "professor",
      principal: false,
      inicio: new Date(Date.UTC(2026, 0, 1)),
    },
  });

  /* A PORTA DA SALA (ADR-69): sem estas linhas `estudanteDaEscola` — o funil de
     todas as rotas de estudante — recusa com 403 `missao-nao-liberada`. */
  await liberarParaTeste(prisma, ESCOLA, turmaId, EXP_ID, ana);
  await liberarParaTeste(prisma, ESCOLA, turmaSemPreparo, EXP_ID, ana);
  await liberarParaTeste(prisma, OUTRA_ESCOLA, turmaVizinha, EXP_ID, vizinho);
});

afterAll(async () => {
  /* `best-effort`: falha de limpeza não pode substituir o erro do teste. */
  await limpar().catch(() => undefined);
  await runtime.$disconnect();
  await prisma.$disconnect();
});

describe("tenancy no banco (regra inviolável nº 1)", () => {
  beforeAll(async () => {
    /* As duas escolas com linha nas CINCO tabelas. A reflexão entra crua: no
       fluxo ela só existe depois do telão, e a RLS precisa ser provada agora. */
    await service.homologar(ESCOLA, turmaId, undefined, loteHomologado());
    await service.homologar(OUTRA_ESCOLA, turmaVizinha, undefined, loteHomologado());
    await service.entrar(ESCOLA, dinho, turmaId);
    await service.encaminhar(ESCOLA, dinho, turmaId, "msg-2");
    await service.entrar(OUTRA_ESCOLA, vizinho, turmaVizinha);
    await service.encaminhar(OUTRA_ESCOLA, vizinho, turmaVizinha, "msg-2");
    const texto = "Vou conferir com a escola antes de mandar pro grupo.";
    for (const [escolaId, estudanteId] of [
      [ESCOLA, dinho],
      [OUTRA_ESCOLA, vizinho],
    ] as const) {
      await prisma.exp05ef1bReflexao.create({
        data: { escolaId, estudanteId, texto, charsCount: texto.length },
      });
      await prisma.exp05ef1bGateTurma.upsert({
        where: {
          escolaId_turmaId: {
            escolaId,
            turmaId: escolaId === ESCOLA ? turmaId : turmaVizinha,
          },
        },
        create: { escolaId, turmaId: escolaId === ESCOLA ? turmaId : turmaVizinha },
        update: {},
      });
    }
  });

  afterAll(async () => {
    /* A reflexão CRUA existe só para a RLS ter linha nas cinco tabelas. Deixá-la
       viva faria o painel do professor contar como entregue uma criança que
       nunca respondeu ao tio — e o teste do painel mede exatamente isso. */
    await prisma.exp05ef1bReflexao.deleteMany({
      where: { escolaId: { in: [ESCOLA, OUTRA_ESCOLA] } },
    });
  });

  test("as cinco tabelas têm RLS habilitada E forçada, com uma política por escola", async () => {
    for (const tabela of TABELAS) {
      const [linha] = await prisma.$queryRawUnsafe<
        { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
      >(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${tabela}'`);
      expect({ tabela, ...linha }).toEqual({
        tabela,
        relrowsecurity: true,
        relforcerowsecurity: true,
      });

      const policies = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tabela}'`,
      );
      expect(policies.map((p) => p.policyname)).toEqual([`${tabela}_por_escola`]);
    }
  });

  /**
   * A prova que a leitura de código não dá: com a escola de cá armada, a linha
   * de lá SOME — não vem marcada, não vem vazia: some. Nas cinco tabelas, e a
   * que pesa mais é `exp05ef1b_conteudo_turma`: ali mora o GABARITO.
   */
  test("a RLS isola DE VERDADE: nada da escola vizinha existe daqui", async () => {
    const daqui = await runtime.comTenancy(
      async (tx) => ({
        conteudo: await tx.exp05ef1bConteudoTurma.findMany({ select: { escolaId: true } }),
        sessoes: await tx.exp05ef1bSessao.findMany({ select: { escolaId: true } }),
        encaminhamentos: await tx.exp05ef1bEncaminhamento.findMany({ select: { escolaId: true } }),
        reflexoes: await tx.exp05ef1bReflexao.findMany({ select: { escolaId: true } }),
        gates: await tx.exp05ef1bGateTurma.findMany({ select: { escolaId: true } }),
      }),
      ESCOLA,
    );
    for (const [tabela, linhas] of Object.entries(daqui)) {
      expect({ tabela, tem: linhas.length > 0 }).toEqual({ tabela, tem: true });
      expect({ tabela, sóDaqui: linhas.every((l) => l.escolaId === ESCOLA) }).toEqual({
        tabela,
        sóDaqui: true,
      });
    }

    const deLa = await runtime.comTenancy(
      async (tx) => ({
        conteudo: await tx.exp05ef1bConteudoTurma.findMany({ select: { escolaId: true } }),
        reflexoes: await tx.exp05ef1bReflexao.findMany({ select: { escolaId: true } }),
      }),
      OUTRA_ESCOLA,
    );
    expect(deLa.conteudo.every((l) => l.escolaId === OUTRA_ESCOLA)).toBe(true);
    expect(deLa.reflexoes.every((l) => l.escolaId === OUTRA_ESCOLA)).toBe(true);
  });

  test("uma sessão SEM tenancy armada não enxerga linha nenhuma", async () => {
    // `app.escola_id` ausente é o caminho de quem esquecer o `comTenancy`: a
    // política compara com `NULL` e o resultado é o conjunto vazio — nunca a
    // escola inteira.
    const nada = await runtime.$queryRawUnsafe<{ n: bigint }[]>(
      "SELECT count(*) AS n FROM exp05ef1b_sessoes",
    );
    expect(Number(nada[0]!.n)).toBe(0);
  });

  test("a role sem ownership grava um encaminhamento — a sequência do BIGSERIAL", async () => {
    // `exp05ef1b_encaminhamentos` é a única tabela da missão com id BIGSERIAL, e
    // sem `GRANT USAGE` na sequência o INSERT falha SÓ em produção, que é onde a
    // role existe. Seria a missão inteira parando no primeiro toque da criança.
    const gravado = await runtime.comTenancy(
      (tx) =>
        tx.exp05ef1bEncaminhamento.create({
          data: { escolaId: ESCOLA, estudanteId: dinho, mensagemId: "msg-5" },
          select: { mensagemId: true },
        }),
      ESCOLA,
    );
    expect(gravado.mensagemId).toBe("msg-5");
    await prisma.exp05ef1bEncaminhamento.deleteMany({
      where: { escolaId: ESCOLA, estudanteId: dinho, mensagemId: "msg-5" },
    });
  });

  test("o CHECK do latch recusa Mural fechado por quem nunca viu uma mensagem", async () => {
    // `confirmado_em` com `passo = 'contexto'` é o sintoma de um POST direto em
    // `/confirmar`, que é endereço alcançável.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp05ef1b_sessoes SET confirmado_em = now(), passo = 'contexto'
         WHERE escola_id = '${ESCOLA}' AND estudante_id = '${dinho}'::uuid`,
      ),
    ).rejects.toThrow();
  });

  test("`passo = fim` e `concluido_em` não podem divergir", async () => {
    // Uma tela dizendo "missão cumprida" sobre uma linha sem carimbo é um
    // relatório que mente.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp05ef1b_sessoes SET passo = 'fim'
         WHERE escola_id = '${ESCOLA}' AND estudante_id = '${dinho}'::uuid`,
      ),
    ).rejects.toThrow();
  });

  test("`midias_abertas` só aceita os oito ids do grupo", async () => {
    // Um id fora da lista é uma mídia "aberta" que não existe em balão nenhum, e
    // ela apareceria no painel como leitura que ninguém fez.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp05ef1b_sessoes SET midias_abertas = ARRAY['msg-9']
         WHERE escola_id = '${ESCOLA}' AND estudante_id = '${dinho}'::uuid`,
      ),
    ).rejects.toThrow();
  });

  test("a reflexão não aceita texto em branco nem resposta de duas letras", async () => {
    // Cinco espaços passariam o `VARCHAR(500)` e contariam como percurso
    // entregue no painel da professora.
    for (const texto of ["     ", "oi"]) {
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE exp05ef1b_reflexoes SET texto = '${texto}'
           WHERE escola_id = '${ESCOLA}' AND estudante_id = '${dinho}'::uuid`,
        ),
      ).rejects.toThrow();
    }
  });

  test("o lote da turma tem OITO mensagens, e o gatilho é do vocabulário", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp05ef1b_conteudo_turma SET mensagens_json = '[]'::jsonb
         WHERE escola_id = '${ESCOLA}'`,
      ),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp05ef1b_conteudo_turma SET gatilho = 'panico' WHERE escola_id = '${ESCOLA}'`,
      ),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp05ef1b_conteudo_turma SET origem = 'importado' WHERE escola_id = '${ESCOLA}'`,
      ),
    ).rejects.toThrow();
  });
});

describe("a porta da sala (ADR-69)", () => {
  test("estudante sem turma é recusado já na leitura", async () => {
    // Filtrar o card no hub é UX; a regra que vale é esta. `/exp/:expId` é
    // endereço adivinhável e o bundle é público.
    expect(await codigoDe(service.sessao(ESCOLA, semTurma, null))).toBe("missao-nao-liberada");
  });

  test("a recusa vale para TODA rota de estudante, não só a de leitura", async () => {
    // A guarda mora no FUNIL (`estudanteDaEscola`), não em cada rota: rota nova
    // nasce protegida sem ninguém lembrar de protegê-la.
    for (const chamada of [
      () => service.entrar(ESCOLA, semTurma, null),
      () => service.encaminhar(ESCOLA, semTurma, null, "msg-2"),
      () => service.desencaminhar(ESCOLA, semTurma, null, "msg-2"),
      () => service.leituraIntegral(ESCOLA, semTurma, null),
      () => service.midia(ESCOLA, semTurma, null, "msg-3"),
      () => service.confirmar(ESCOLA, semTurma, null),
      () => service.avancarParaReflexao(ESCOLA, semTurma, null),
      () => service.reflexao(ESCOLA, semTurma, null, "um texto qualquer"),
      /* O `gate` entra na lista, e é a diferença desta missão para a exp06ef2b, a
         exp07ef1b e a exp08ef4b: nas três ele fica FORA do funil, e um estudante
         logado sem liberação descobre a etapa da turma dele. Aqui a nota do
         `@Contrato` afirmava a guarda — então a afirmação virou verdade, e este
         caso a prende. */
      () => service.gate(ESCOLA, semTurma, null),
    ]) {
      expect(await codigoDe(chamada())).toBe("missao-nao-liberada");
    }
  });

  test("estudante de outra escola não alcança a turma daqui", async () => {
    // O `escolaId` vem do token; o id do estudante, dele. O cruzamento é 404.
    expect(await codigoDe(service.sessao(ESCOLA, vizinho, turmaVizinha))).toBe(
      "turma-nao-encontrada",
    );
  });
});

describe("a missão nasce VAZIA", () => {
  beforeAll(async () => {
    /* RASCUNHO, não homologação: a rota de geração com IA devolve isto e não
       liga nada. Para o estudante, rascunho e nada são a MESMA coisa (RF-001). */
    await prisma.exp05ef1bConteudoTurma.create({
      data: {
        escolaId: ESCOLA,
        turmaId: turmaSemPreparo,
        tema: "Rascunho que a professora ainda não aprovou",
        gatilho: "medo",
        origem: "ia",
        mensagensJson: LOTE_DEFAULT.map((m) => ({ ...m })),
        aprovadoPorProfessor: false,
      },
    });
  });

  test("sem homologação a tela é de espera: `preparada: false` e lote nulo", async () => {
    const estado = await service.sessao(ESCOLA, semPreparo, turmaSemPreparo);
    expect(estado.preparada).toBe(false);
    expect(estado.lote).toBeNull();
    expect(estado.passo).toBe("contexto");
    // E nem o tema do rascunho vaza: a criança não vê nada do que ela escreveu.
    expect(JSON.stringify(estado)).not.toContain("Rascunho que a professora");
  });

  test("o polling do gate também diz que a turma não está preparada", async () => {
    const gate = await service.gate(ESCOLA, semPreparo, turmaSemPreparo);
    expect(gate.preparada).toBe(false);
    expect(gate.etapa).toBe("exploracao");
    expect(gate.agora).toEqual(expect.any(String) as string);
  });

  test("lote HOMOLOGADO com forma inesperada também é tela de espera, e não é mudo", async () => {
    /* `mensagensValidas` é a leitura do `Json` da linha, e o `Json` do Prisma é
       `unknown` na prática: o Zod validou na ESCRITA, mas uma linha gravada por
       uma versão anterior do schema — ou por um `psql` de migração — chega aqui
       com a forma velha. O desfecho aqui é diferente do da exp08ef4b: **não há
       queda para o banco curado**, porque o lote é do TEMA que a professora
       escolheu. Forma torta = turma não preparada.

       E o `logger.warn` é parte da regra, não decoração: sem ele o sintoma é uma
       turma homologada em que a missão insiste em "ainda estamos organizando o
       grupo", e nada, em lugar nenhum, diz por quê. */
    const original = await prisma.exp05ef1bConteudoTurma.findUniqueOrThrow({
      where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: turmaSemPreparo } },
    });
    const oitoIguais = LOTE_DEFAULT.map(() => ({ ...LOTE_DEFAULT[0] }));
    const tortos: Record<string, unknown> = {
      "não é array": { mensagens: LOTE_DEFAULT },
      "menos de oito": LOTE_DEFAULT.slice(0, 7),
      "item que não é objeto": [...LOTE_DEFAULT.slice(0, 7), "msg-8"],
      "sem o gabarito": LOTE_DEFAULT.map(({ veracidade: _v, ...resto }) => resto),
      "veracidade fora do vocabulário": LOTE_DEFAULT.map((m, i) =>
        i === 0 ? { ...m, veracidade: "meio-verdadeira" } : m,
      ),
      /* Passariam por tudo acima e produziriam duas barras com o MESMO id no
         telão — e um `Map` que conta as duas no mesmo balde. */
      "oito ids repetidos": oitoIguais,
    };

    /* O CHECK da migration recusa tudo isto na ESCRITA, e é por isso que ele é
       derrubado aqui e reposto no `finally`: o cenário que `mensagensValidas`
       cobre é justamente a linha que entrou ANTES do CHECK — gravada por uma
       versão anterior do schema ou por um `psql` de migração. Com o CHECK de pé
       o teste não consegue montar o caso, e a leitura defensiva ficaria sem
       nenhuma prova. A definição é LIDA do catálogo e recolocada verbatim, para
       o teste não virar a fonte de uma regra que mora na migration. */
    const linhas = await prisma.$queryRaw<{ def: string }[]>`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conname = 'exp05ef1b_conteudo_mensagens_check'
    `;
    const def = linhas[0]?.def;
    /* Sem o CHECK no banco não há o que derrubar nem o que repor, e seguir
       adiante deixaria a suíte gravando lixo sem a primeira barreira. */
    expect(def).toEqual(expect.stringContaining("mensagens_json"));
    await prisma.$executeRawUnsafe(
      `ALTER TABLE exp05ef1b_conteudo_turma DROP CONSTRAINT exp05ef1b_conteudo_mensagens_check`,
    );

    const avisos = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    try {
      for (const [caso, mensagensJson] of Object.entries(tortos)) {
        avisos.mockClear();
        await prisma.exp05ef1bConteudoTurma.update({
          where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: turmaSemPreparo } },
          data: { aprovadoPorProfessor: true, mensagensJson: mensagensJson as never },
        });
        const estado = await service.sessao(ESCOLA, semPreparo, turmaSemPreparo);
        expect({ caso, preparada: estado.preparada, lote: estado.lote }).toEqual({
          caso,
          preparada: false,
          lote: null,
        });
        /* E a mutação recusa com ESPERA, não com bloqueio: a criança não fez
           nada errado. */
        expect(await codigoDe(service.entrar(ESCOLA, semPreparo, turmaSemPreparo))).toBe(
          "conteudo-nao-publicado",
        );
        const codigos = avisos.mock.calls.map(([primeiro]) =>
          typeof primeiro === "object" && primeiro !== null
            ? (primeiro as { codigo?: string }).codigo
            : undefined,
        );
        expect({ caso, avisou: codigos.includes("exp05ef1b-lote-invalido") }).toEqual({
          caso,
          avisou: true,
        });
      }
    } finally {
      avisos.mockRestore();
      await prisma.exp05ef1bConteudoTurma.update({
        where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: turmaSemPreparo } },
        data: {
          aprovadoPorProfessor: original.aprovadoPorProfessor,
          mensagensJson: original.mensagensJson as never,
        },
      });
      await prisma.$executeRawUnsafe(
        `ALTER TABLE exp05ef1b_conteudo_turma ADD CONSTRAINT exp05ef1b_conteudo_mensagens_check ${def}`,
      );
    }

    /* E a prova de que o CHECK voltou: é ele a primeira barreira, e um teste que
       o derruba sem repor deixaria todo o resto da suíte gravando lixo em
       silêncio. */
    await expect(
      prisma.exp05ef1bConteudoTurma.update({
        where: { escolaId_turmaId: { escolaId: ESCOLA, turmaId: turmaSemPreparo } },
        data: { mensagensJson: [] as never },
      }),
    ).rejects.toThrow();
  });

  test("as mutações recusam com espera, não com bloqueio", async () => {
    // "O grupo ainda está sendo organizado" — a criança não fez nada errado, e
    // não há banco curado de reserva aqui: o lote é do TEMA que a professora
    // escolheu, e mostrar outro faria ela ler sobre um fato que não existiu.
    for (const chamada of [
      () => service.entrar(ESCOLA, semPreparo, turmaSemPreparo),
      () => service.encaminhar(ESCOLA, semPreparo, turmaSemPreparo, "msg-2"),
      () => service.confirmar(ESCOLA, semPreparo, turmaSemPreparo),
    ]) {
      expect(await codigoDe(chamada())).toBe("conteudo-nao-publicado");
    }
  });

  test("mas a PROFESSORA vê o banco curado para editar e aprovar", async () => {
    // O rascunho existe e é dela; a queda para o curado é da tela do preparo, e
    // nunca da tela do estudante.
    const conteudo = await service.conteudoParaOProfessor(ESCOLA, turmaSemPreparo);
    expect(conteudo.aprovadoPorProfessor).toBe(false);
    expect(conteudo.mensagens).toHaveLength(8);
  });
});

describe("a curadoria — as duas portas do Mural", () => {
  test("com 2 mensagens o Mural não fecha, e a frase é a do piso", async () => {
    await curar(bia, [INFORMATIVAS[0], INFORMATIVAS[1]]);
    expect(await codigoDe(service.confirmar(ESCOLA, bia, turmaId))).toBe("piso-nao-atingido");
  });

  test("com 3, mas sem ter rolado até a 8ª, a frase é OUTRA", async () => {
    // As duas recusas são coisas diferentes na cabeça da criança: uma pede mais
    // escolha, a outra pede mais leitura — e é a leitura que faz ela chegar ao
    // recado do professor, a `msg-7`, que muda o grupo inteiro.
    await service.encaminhar(ESCOLA, bia, turmaId, INFORMATIVAS[2]);
    const estado = await service.sessao(ESCOLA, bia, turmaId);
    expect(estado.atingiuPiso).toBe(true);
    expect(estado.podeConfirmar).toBe(false);
    expect(await codigoDe(service.confirmar(ESCOLA, bia, turmaId))).toBe("leitura-incompleta");
  });

  test("encaminhar a mesma mensagem duas vezes não conta duas", async () => {
    const r = await service.encaminhar(ESCOLA, bia, turmaId, INFORMATIVAS[0]);
    expect(r.novo).toBe(false);
    expect(r.totalEncaminhadas).toBe(3);
    const linhas = await prisma.exp05ef1bEncaminhamento.count({
      where: { escolaId: ESCOLA, estudanteId: bia, mensagemId: INFORMATIVAS[0] },
    });
    expect(linhas).toBe(1);
  });

  test("dois toques simultâneos no mesmo balão gravam UMA linha", async () => {
    // O caminho normal numa sala com trinta tablets, não a exceção: o UNIQUE é
    // quem decide, e não uma leitura anterior.
    const [a, b] = await Promise.all([
      service.encaminhar(ESCOLA, bia, turmaId, "msg-8"),
      service.encaminhar(ESCOLA, bia, turmaId, "msg-8"),
    ]);
    expect([a.novo, b.novo].filter(Boolean)).toHaveLength(1);
    expect(
      await prisma.exp05ef1bEncaminhamento.count({
        where: { escolaId: ESCOLA, estudanteId: bia, mensagemId: "msg-8" },
      }),
    ).toBe(1);
  });

  test('"Apagar para todos" desfaz enquanto a curadoria está aberta', async () => {
    // A criança que repassou no impulso e voltou atrás fez exatamente o que a
    // missão ensina.
    const removido = await service.desencaminhar(ESCOLA, bia, turmaId, "msg-8");
    expect(removido.novo).toBe(true);
    expect(removido.totalEncaminhadas).toBe(3);
    // Apagar o que já não está lá é 200 com `novo: false`, nunca erro.
    const denovo = await service.desencaminhar(ESCOLA, bia, turmaId, "msg-8");
    expect(denovo.novo).toBe(false);
  });

  test("id fora do lote DA TURMA é recusado", async () => {
    // Contra o lote homologado, não contra o enum: um id fora dele é uma tela
    // velha falando com um lote novo.
    expect(await codigoDe(service.encaminhar(ESCOLA, bia, turmaId, "msg-99"))).toBe(
      "mensagem-desconhecida",
    );
  });

  test("a leitura integral é o que abre o botão — e não se desfaz", async () => {
    const lido = await service.leituraIntegral(ESCOLA, bia, turmaId);
    expect(lido.leuTudo).toBe(true);
    expect(lido.podeConfirmar).toBe(true);
    const denovo = await service.leituraIntegral(ESCOLA, bia, turmaId);
    expect(denovo.leuTudo).toBe(true);
  });
});

describe("o latch da confirmação", () => {
  test("dois toques simultâneos em Confirmar produzem UMA confirmação", async () => {
    // O lock por (escola, estudante) serializa: a segunda transação relê o
    // estado com a primeira aplicada.
    const [a, b] = await Promise.allSettled([
      service.confirmar(ESCOLA, bia, turmaId),
      service.confirmar(ESCOLA, bia, turmaId),
    ]);
    expect([a.status, b.status].filter((s) => s === "fulfilled")).toHaveLength(1);
    const linha = await prisma.exp05ef1bSessao.findUnique({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: bia } },
    });
    expect(linha?.confirmadoEm).toBeTruthy();
    expect(linha?.passo).toBe("espera");
  });

  test("a segunda confirmação recusa — e a frase não diz que o envio se perdeu", async () => {
    // A ordem das checagens importa: quem JÁ confirmou não pode ler "o Mural
    // fechou para todo mundo" e achar que perdeu o próprio envio.
    expect(await codigoDe(service.confirmar(ESCOLA, bia, turmaId))).toBe("curadoria-confirmada");
  });

  test("depois do latch o Mural não muda mais", async () => {
    expect(await codigoDe(service.encaminhar(ESCOLA, bia, turmaId, "msg-5"))).toBe(
      "curadoria-confirmada",
    );
    expect(await codigoDe(service.desencaminhar(ESCOLA, bia, turmaId, INFORMATIVAS[0]))).toBe(
      "curadoria-confirmada",
    );
  });

  test("quem confirmou espera — e a tela dele não tem uma letra do gabarito", async () => {
    const estado = await service.sessao(ESCOLA, bia, turmaId);
    expect(estado.passo).toBe("espera");
    expect(estado.confirmou).toBe(true);
    expect(estado.revelacao).toBeNull();
    /* O escaneamento é do LOTE, e não da resposta inteira, por uma razão que
       custou uma corrida vermelha: o roteiro do podcast fala em "notícias
       falsas" no texto corrido, e `toContain("falsa")` casa com ele. O lugar por
       onde o gabarito vazaria é o balão. */
    const lote = JSON.stringify(estado.lote);
    for (const rotulo of ["verdadeira", "falsa", "ambigua", "alarmista", "ponderado"]) {
      expect(lote).not.toContain(rotulo);
    }
    for (const m of estado.lote!.mensagens) {
      expect(Object.keys(m)).not.toContain("veracidade");
    }
    // E a explicação do selo não está em campo nenhum da resposta.
    expect(JSON.stringify(estado)).not.toContain(LOTE_DEFAULT[1]!.explicacao);
  });
});

describe("o telão da turma", () => {
  beforeAll(async () => {
    /* A Ana faz o percurso inteiro e confirma; o Caio entra, encaminha uma e
       NÃO confirma — é ele que a revelação empurra sem contar. */
    await curar(ana, EMOCIONAIS);
    await service.midia(ESCOLA, ana, turmaId, "msg-3");
    await service.midia(ESCOLA, ana, turmaId, "msg-5");
    await service.leituraIntegral(ESCOLA, ana, turmaId);
    await service.confirmar(ESCOLA, ana, turmaId);
    await curar(caio, ["msg-2"]);
  });

  test("a professora vê o histograma ANTES do telão; a criança, não", async () => {
    // É com ele que ela decide a hora de acender. A rota é professor-only, e a
    // tela do estudante só recebe a revelação depois do gate.
    const painel = await service.painel(ESCOLA, turmaId);
    expect(painel.turma.etapa).toBe("exploracao");
    expect(painel.resumo.confirmaram).toBe(2);
    expect(painel.resumo.histograma.find((b) => b.id === "msg-2")?.total).toBe(1);
    expect((await service.sessao(ESCOLA, ana, turmaId)).revelacao).toBeNull();
  });

  test('"Iniciar revelação coletiva" é idempotente', async () => {
    // Apertar duas vezes é exatamente o clique que se dá duas vezes.
    const um = await service.mudarGate(ESCOLA, turmaId, undefined, "iniciar-revelacao");
    const dois = await service.mudarGate(ESCOLA, turmaId, undefined, "iniciar-revelacao");
    expect([um.etapa, dois.etapa]).toEqual(["revelacao", "revelacao"]);
  });

  test("o Mural ganha os selos, com o quantos-de-quantos da sala", async () => {
    const estado = await service.sessao(ESCOLA, ana, turmaId);
    expect(estado.passo).toBe("revelado");
    expect(estado.revelacao?.totalConfirmados).toBe(2);
    const boato = estado.revelacao?.mensagens.find((m) => m.id === "msg-2");
    expect(boato?.veracidade).toBe("falsa");
    expect(boato?.explicacao).toBeTruthy();
    // A Ana encaminhou o boato; a Bia, não. O Caio TAMBÉM encaminhou — e não
    // conta, porque não confirmou.
    expect(boato?.total).toBe(1);
    expect(boato?.percentual).toBe(50);
    // E a síntese diz para que lado a sala pendeu (3 emocionais x 3 informativas).
    expect(estado.revelacao?.sintese.polaridade).toBe("empate");
  });

  test("quem não confirmou é EMPURRADO para o telão e não entra na conta", async () => {
    // A janela da curadoria impulsiva acabou. Deixá-lo continuar encaminhando
    // com o gabarito projetado na parede mediria outra coisa.
    const estado = await service.sessao(ESCOLA, caio, turmaId);
    expect(estado.passo).toBe("revelado");
    expect(estado.passoDoEstudante).toBe("curadoria");
    expect(estado.confirmou).toBe(false);
    expect(estado.aguardandoATurma).toBe(false);
    expect(estado.revelacao?.totalConfirmados).toBe(2);
  });

  test("com o telão aceso, encaminhar e confirmar recusam com a MESMA frase", async () => {
    expect(await codigoDe(service.encaminhar(ESCOLA, caio, turmaId, "msg-6"))).toBe(
      "revelacao-iniciada",
    );
    expect(await codigoDe(service.confirmar(ESCOLA, caio, turmaId))).toBe("revelacao-iniciada");
  });
});

describe("a reflexão — o dilema do tio", () => {
  test("sem a etapa liberada, o avanço é uma tarja de espera", async () => {
    expect(await codigoDe(service.avancarParaReflexao(ESCOLA, ana, turmaId))).toBe(
      "reflexao-nao-liberada",
    );
    expect(await codigoDe(service.reflexao(ESCOLA, ana, turmaId, RESPOSTA_DA_ANA))).toBe(
      "reflexao-nao-liberada",
    );
  });

  test("liberada a etapa, quem decide quando sair dos selos é o ESTUDANTE", async () => {
    // A etapa `reflexao` NÃO empurra ninguém até a pergunta: quem chega atrasado
    // vê o Mural revelado primeiro, e é dele que o botão sai.
    await service.mudarGate(ESCOLA, turmaId, undefined, "liberar-reflexao");
    expect((await service.sessao(ESCOLA, ana, turmaId)).passo).toBe("revelado");
    const avancou = await service.avancarParaReflexao(ESCOLA, ana, turmaId);
    expect(avancou.passo).toBe("reflexao");
  });

  test("a resposta encerra a missão e carimba os dois lados do latch", async () => {
    const r = await service.reflexao(ESCOLA, ana, turmaId, RESPOSTA_DA_ANA);
    expect(r.passo).toBe("fim");
    expect(r.entregouReflexao).toBe(true);
    expect(r.concluidoEm).toBeTruthy();
    const linha = await prisma.exp05ef1bReflexao.findUnique({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: ana } },
    });
    expect(linha?.charsCount).toBe(RESPOSTA_DA_ANA.length);
  });

  test("a segunda resposta recusa", async () => {
    expect(await codigoDe(service.reflexao(ESCOLA, ana, turmaId, "outra resposta"))).toBe(
      "reflexao-ja-enviada",
    );
  });

  test("quem não confirmou o Mural não entrega a reflexão — e a frase manda chamar", async () => {
    // O par (snapshot do Mural, reflexão) é o que a missão mede. A saída não é
    // código: é `voltar-exploracao` no painel, e é isso que o 409 manda pedir.
    expect(await codigoDe(service.reflexao(ESCOLA, caio, turmaId, "eu nem confirmei"))).toBe(
      "curadoria-nao-confirmada",
    );
  });

  test("a sessão devolve a reflexão do PRÓPRIO estudante, nunca a de outro", async () => {
    expect((await service.sessao(ESCOLA, ana, turmaId)).reflexao?.texto).toBe(RESPOSTA_DA_ANA);
    expect((await service.sessao(ESCOLA, bia, turmaId)).reflexao).toBeNull();
  });

  test('"Voltar para a exploração" reabre a sala — menos para quem já entregou', async () => {
    // Não é um "zerar": nada é apagado, os snapshots confirmados continuam
    // confirmados, e o latch da criança é dela, não da turma.
    const volta = await service.mudarGate(ESCOLA, turmaId, undefined, "voltar-exploracao");
    expect(volta.etapa).toBe("exploracao");
    expect((await service.sessao(ESCOLA, ana, turmaId)).passo).toBe("fim");
    expect((await service.sessao(ESCOLA, bia, turmaId)).passo).toBe("espera");
    expect((await service.sessao(ESCOLA, caio, turmaId)).passo).toBe("curadoria");
    // E com a exploração de volta, o Caio termina a curadoria que o telão
    // interrompeu — é para isso que o botão existe.
    await service.encaminhar(ESCOLA, caio, turmaId, "msg-1");
    await service.encaminhar(ESCOLA, caio, turmaId, "msg-6");
    await service.leituraIntegral(ESCOLA, caio, turmaId);
    const confirmado = await service.confirmar(ESCOLA, caio, turmaId);
    expect(confirmado.confirmou).toBe(true);
  });
});

describe("o painel do professor", () => {
  /** Todas as chaves da resposta, em qualquer profundidade. */
  function chavesDe(valor: unknown, nivel = 0): string[] {
    if (nivel > 8 || valor === null || typeof valor !== "object") return [];
    if (Array.isArray(valor)) return valor.flatMap((item) => chavesDe(item, nivel + 1));
    return Object.entries(valor as Record<string, unknown>).flatMap(([chave, v]) => [
      chave,
      ...chavesDe(v, nivel + 1),
    ]);
  }

  test("nenhuma chave ordena crianças (PED-11)", async () => {
    // Com o gabarito a um JOIN de distância, "quantas falsas cada um
    // encaminhou" é a coluna que se escreve sozinha — e ela é um ranking de
    // quem caiu no boato. O que existe é o histograma da SALA.
    const painel = await service.painel(ESCOLA, turmaId);
    const chaves = chavesDe(painel).map((c) => c.toLowerCase());
    for (const proibido of PROIBIDO_NO_PAINEL) {
      const colisao = [...new Set(chaves.filter((c) => c.includes(proibido.toLowerCase())))];
      expect({ proibido, colisao }).toEqual({ proibido, colisao: [] });
    }
  });

  test("mostra prontidão, conduta e o texto da reflexão", async () => {
    const painel = await service.painel(ESCOLA, turmaId, professora);
    expect(painel.resumo.total).toBe(4);
    expect(painel.resumo.iniciaram).toBe(4);
    // Ana, Bia e o Caio (que confirmou depois do `voltar-exploracao`).
    expect(painel.resumo.confirmaram).toBe(3);
    expect(painel.resumo.percentualConfirmados).toBe(75);
    expect(painel.resumo.entregaram).toBe(1);

    const linhaDaAna = painel.estudantes.find((e) => e.estudanteId === ana)!;
    expect(linhaDaAna.confirmou).toBe(true);
    expect(linhaDaAna.leuTudo).toBe(true);
    // O tipo vem do LOTE DA TURMA: a `msg-3` é o áudio e a `msg-5` é o link.
    expect(linhaDaAna.ouviuAudio).toBe(true);
    expect(linhaDaAna.abriuLink).toBe(true);
    expect(linhaDaAna.entregouReflexao).toBe(true);
    expect(linhaDaAna.reflexaoTexto).toBe(RESPOSTA_DA_ANA);
    // O indicativo de impulsividade: número, nunca `null`, para quem encaminhou.
    expect(linhaDaAna.segundosAteOPrimeiroEncaminhamento).toBeGreaterThanOrEqual(0);

    // E quem entrou no grupo e parou aparece como PROGRESSO, sem nenhuma
    // coluna dizendo o que ele acertou.
    const linhaDoDinho = painel.estudantes.find((e) => e.estudanteId === dinho)!;
    expect(linhaDoDinho.iniciou).toBe(true);
    expect(linhaDoDinho.confirmou).toBe(false);
    expect(linhaDoDinho.entregouReflexao).toBe(false);
    expect(linhaDoDinho.reflexaoTexto).toBeNull();
  });

  test("o texto da reflexão NÃO sai para quem não dá aula à turma", async () => {
    /* A rota inteira responde a gestor, diretor e admin — `professorDoToken`
       devolve `undefined` para todos eles, e `professorLeciona` diz `true` a
       `undefined` porque gestor enxerga a escola toda. O que não os alcança é o
       parágrafo que a criança escreveu: caixa livre de MENOR (LGPD art. 14).
       A linha continua inteira, e `entregouReflexao` continua dizendo que ela
       respondeu — acompanhar a turma não exige ler o que cada uma escreveu.

       Este teste é o que impede a regressão de voltar: `reflexaoTexto: texto`
       passa no `tsc`, passa no lint, e o sintoma não existe em tela nenhuma. */
    const doGestor = await service.painel(ESCOLA, turmaId);
    const daAnaParaOGestor = doGestor.estudantes.find((e) => e.estudanteId === ana)!;
    expect(daAnaParaOGestor.entregouReflexao).toBe(true);
    expect(daAnaParaOGestor.reflexaoTexto).toBeNull();

    const daProfessora = await service.painel(ESCOLA, turmaId, professora);
    expect(daProfessora.estudantes.find((e) => e.estudanteId === ana)!.reflexaoTexto).toBe(
      RESPOSTA_DA_ANA,
    );
  });

  test("o histograma do painel é o MESMO que o estudante vê", async () => {
    // Dois cálculos separados poderiam divergir, e a professora estaria narrando
    // um telão que a tela da criança não mostra.
    const painel = await service.painel(ESCOLA, turmaId);
    await service.mudarGate(ESCOLA, turmaId, undefined, "iniciar-revelacao");
    const daCrianca = await service.sessao(ESCOLA, bia, turmaId);
    for (const barra of painel.resumo.histograma) {
      const selo = daCrianca.revelacao?.mensagens.find((m) => m.id === barra.id);
      expect({ id: barra.id, total: selo?.total }).toEqual({ id: barra.id, total: barra.total });
    }
  });
});

describe("zerar a turma", () => {
  /**
   * A 5B, na MESMA escola, com aula andada. Ela existe para o teste abaixo
   * poder reprovar.
   *
   * Sem ela, as contagens finais são `count({ where: { escolaId } })` — a
   * ESCOLA inteira —, e um `zerarTurma` que perdesse o recorte por turma
   * apagaria tudo e passaria igual. O modo de falhar seria a professora da 5A
   * apertando "zerar" no intervalo e levando junto a aula da 5B, que está
   * acontecendo na sala ao lado, e nada em tela diria isso.
   */
  beforeAll(async () => {
    await prisma.exp05ef1bSessao.create({
      data: {
        escolaId: ESCOLA,
        estudanteId: semPreparo,
        turmaId: turmaSemPreparo,
        passo: "curadoria",
        entrouEm: new Date(),
        leuTudo: true,
      },
    });
    await prisma.exp05ef1bEncaminhamento.create({
      data: { escolaId: ESCOLA, estudanteId: semPreparo, mensagemId: "msg-4" },
    });
    const texto = "A aula da 5B ainda está no meio, e nada daqui pode sumir.";
    await prisma.exp05ef1bReflexao.create({
      data: { escolaId: ESCOLA, estudanteId: semPreparo, texto, charsCount: texto.length },
    });
  });

  test("apaga as respostas e devolve o gate à exploração", async () => {
    const r = await service.zerarTurma(ESCOLA, turmaId);
    expect(r.sucesso).toBe(true);
    expect(r.registrosApagados).toBe(4);

    /* Com a professora, e não com o painel do gestor: para o gestor o texto sai
       `null` de qualquer jeito, e a asserção abaixo não poderia reprovar. */
    const painel = await service.painel(ESCOLA, turmaId, professora);
    expect(painel.resumo.iniciaram).toBe(0);
    expect(painel.resumo.confirmaram).toBe(0);
    expect(painel.estudantes.every((e) => e.reflexaoTexto === null)).toBe(true);
    expect(painel.turma.etapa).toBe("exploracao");
    // Encaminhamentos e reflexões caem por CASCADE da FK com a sessão — e a
    // conta é POR TURMA, senão a asserção não distingue "zerou a 5A" de "zerou
    // a escola inteira".
    const daTurma = { escolaId: ESCOLA, sessao: { turmaId } };
    expect(await prisma.exp05ef1bEncaminhamento.count({ where: daTurma })).toBe(0);
    expect(await prisma.exp05ef1bReflexao.count({ where: daTurma })).toBe(0);

    /* E a 5B, que está no meio da aula dela, continua inteira. */
    const daVizinha = { escolaId: ESCOLA, sessao: { turmaId: turmaSemPreparo } };
    expect(await prisma.exp05ef1bSessao.count({ where: { escolaId: ESCOLA, turmaId: turmaSemPreparo } })).toBe(1);
    expect(await prisma.exp05ef1bEncaminhamento.count({ where: daVizinha })).toBe(1);
    expect(await prisma.exp05ef1bReflexao.count({ where: daVizinha })).toBe(1);
  });

  test("PRESERVA o lote homologado — o preparo custou tempo da professora", async () => {
    // Apagá-lo obrigaria a refazer a curadoria para reaplicar a missão na turma
    // seguinte no mesmo dia.
    const conteudo = await service.conteudoParaOProfessor(ESCOLA, turmaId);
    expect(conteudo.aprovadoPorProfessor).toBe(true);
    expect(conteudo.tema).toBe(TEMA_DEFAULT);
    expect(conteudo.mensagens).toHaveLength(8);

    const painel = await service.painel(ESCOLA, turmaId);
    expect(painel.turma.preparada).toBe(true);
    // E a missão pode ser refeita do começo.
    const denovo = await service.sessao(ESCOLA, ana, turmaId);
    expect(denovo.preparada).toBe(true);
    expect(denovo.passo).toBe("contexto");
    expect(denovo.revelacao).toBeNull();
  });
});
