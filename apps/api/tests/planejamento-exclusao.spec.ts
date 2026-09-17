import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { PlanejamentoService } from "../src/planejamento/planejamento.service";
import { QuotaService } from "../src/ai/quota.service";
import type { AiProvider } from "../src/ai/provider";
import type { ObjectStorageService } from "../src/object-storage/object-storage.service";

/**
 * Apagar o planejamento — `DELETE /planejamento/configuracoes/:id`.
 *
 * A rota nasceu em 2026-09-07 porque não existia: o professor criava um
 * planejamento e não tinha como se livrar dele. Três coisas precisam continuar
 * verdadeiras, e nenhuma é óbvia lendo o service:
 *
 *  1. **a cascata do banco leva plano anual e semanas.** É `onDelete: Cascade`
 *     no schema, não código — se alguém trocar por `Restrict` num refactor, o
 *     delete passa a devolver P2003 e a tela mostra "não foi possível excluir"
 *     sem dizer por quê;
 *  2. **os prefixos do object storage são varridos ANTES do delete.** Depois
 *     dele não há mais como saber quais eram: o caminho é
 *     `planos-de-ensino/{escola}/{planoAnualId}/`, e o id vive na linha que
 *     acabou de ser apagada;
 *  3. **não se apaga o planejamento de outro professor.** A posse é conferida
 *     por `configuracaoDoProfessor`, e a resposta é 404 — não 403, que
 *     confirmaria a existência da regência alheia.
 */

const ADMIN_URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";

const ESCOLA = "teste-exp92-exclusao";
const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });

/**
 * O cliente nasce no MÓDULO, não dentro do `beforeAll`.
 *
 * Estava no fim do `beforeAll`, e o `afterAll` fazia `prisma.$disconnect()`:
 * qualquer falha do `beforeAll` ANTES daquela linha deixava `prisma` undefined,
 * e o teardown estourava com `TypeError: Cannot read properties of undefined
 * (reading '$disconnect')` — que o Jest reporta como "Test suite failed to
 * run" e que SUBSTITUI o erro real no relatório. A suíte falhava dizendo a
 * coisa errada, de forma intermitente, e a causa verdadeira nunca aparecia.
 *
 * `ADMIN_URL` é constante de módulo, então nunca houve motivo para o cliente
 * esperar o hook.
 */
const prisma = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
let servico: PlanejamentoService;
/** Os prefixos que o service pediu para apagar. */
let prefixosApagados: string[];
let idDoProfessor: string;
let idDeOutroProfessor: string;

/** Storage de mentira: só registra o que foi pedido. O que se testa aqui é
 *  QUAIS prefixos são varridos, não a implementação do bucket. */
const storage = {
  apagarPrefixo: async (prefixo: string) => {
    prefixosApagados.push(prefixo);
  },
} as unknown as ObjectStorageService;

const provider = {
  generate: async () => {
    throw new Error("nenhum teste daqui chama IA");
  },
} as unknown as AiProvider;

/** A quota não é exercitada aqui (nada gera), mas o service a exige. */

async function limpar() {
  // A cascata de `escolas` não cobre `exp_92_*` (o `escola_id` é texto, sem FK
  // para a escola), então a limpeza é explícita e de dentro para fora.
  await admin.planoDeEnsinoPeriodo.deleteMany({ where: { escolaId: ESCOLA } });
  await admin.planoDeEnsinoAnual.deleteMany({ where: { escolaId: ESCOLA } });
  await admin.planoDeEnsinoConfiguracao.deleteMany({ where: { escolaId: ESCOLA } });
  await admin.user.deleteMany({ where: { escolaId: ESCOLA } });
  await admin.escola.deleteMany({ where: { id: ESCOLA } });
}

/** Uma regência com plano anual e uma semana detalhada — o caso real. */
async function criarPlanejamentoCompleto(professorId: string, componente: string) {
  const regencia = await admin.planoDeEnsinoConfiguracao.create({
    data: {
      escolaId: ESCOLA,
      professorId,
      anoLetivo: 2026,
      serie: "6EF",
      componente,
      aulasSemanais: 2,
      minutosPorAula: 50,
      grade: [{ diaDaSemana: 2, horarios: ["07:00", "07:50"] }],
      inicioDoAnoLetivo: new Date("2026-02-02T12:00:00Z"),
    },
    select: { id: true },
  });
  const anual = await admin.planoDeEnsinoAnual.create({
    data: {
      escolaId: ESCOLA,
      professorId,
      configuracaoId: regencia.id,
      titulo: `Plano anual de ${componente}`,
      status: "pronto",
      distribuicao: { "1": ["EF69AR01"] },
    },
    select: { id: true },
  });
  const semana = await admin.planoDeEnsinoPeriodo.create({
    data: {
      escolaId: ESCOLA,
      professorId,
      planoAnualId: anual.id,
      ordem: 1,
      inicio: new Date("2026-02-02T12:00:00Z"),
      fim: new Date("2026-02-08T12:00:00Z"),
      periodoDeAvaliacao: 1,
      status: "pronto",
      aulas: [{ numero: 1, tema: "Aula de teste" }],
    },
    select: { id: true },
  });
  return { configuracaoId: regencia.id, anualId: anual.id, semanaId: semana.id };
}

beforeAll(async () => {
  await limpar();
  await admin.escola.create({ data: { id: ESCOLA, nome: "Escola do teste de exclusão" } });
  const dono = await admin.user.create({
    data: {
      role: "professor",
      escolaId: ESCOLA,
      username: `dono-${ESCOLA}`,
      displayName: "Professora dona do plano",
      passwordHash: "x",
    },
    select: { id: true },
  });
  const outro = await admin.user.create({
    data: {
      role: "professor",
      escolaId: ESCOLA,
      username: `outro-${ESCOLA}`,
      displayName: "Outro professor da mesma escola",
      passwordHash: "x",
    },
    select: { id: true },
  });
  idDoProfessor = dono.id;
  idDeOutroProfessor = outro.id;

  servico = new PlanejamentoService(prisma, storage, new QuotaService(prisma), provider);
});

beforeEach(() => {
  prefixosApagados = [];
});

afterAll(async () => {
  /* A limpeza NÃO pode derrubar o teardown: se ela falhar, o erro dela
     substituiria o do teste que realmente quebrou. Ela é best-effort; as
     conexões fecham de qualquer jeito, senão o Jest não sai. */
  await limpar().catch(() => undefined);
  await prisma.$disconnect();
  await admin.$disconnect();
});

describe("apagar a regência inteira", () => {
  test("leva o plano anual e as semanas junto, pela cascata do banco", async () => {
    const { configuracaoId, anualId, semanaId } = await criarPlanejamentoCompleto(
      idDoProfessor,
      "arte",
    );

    await expect(
      servico.apagarConfiguracao(ESCOLA, idDoProfessor, configuracaoId),
    ).resolves.toEqual({ ok: true });

    expect(
      await admin.planoDeEnsinoConfiguracao.findUnique({ where: { id: configuracaoId } }),
    ).toBeNull();
    expect(await admin.planoDeEnsinoAnual.findUnique({ where: { id: anualId } })).toBeNull();
    // A semana é o teste da cascata de DOIS níveis: ela pende do plano anual,
    // que pende da configuração.
    expect(await admin.planoDeEnsinoPeriodo.findUnique({ where: { id: semanaId } })).toBeNull();
  });

  test("varre o prefixo de CADA plano anual no object storage", async () => {
    const um = await criarPlanejamentoCompleto(idDoProfessor, "arte");
    // Um segundo plano anual na MESMA regência. O conteúdo dos dois está no
    // bucket, e varrer só o primeiro deixaria armazenamento órfão pago.
    const dois = await admin.planoDeEnsinoAnual.create({
      data: {
        escolaId: ESCOLA,
        professorId: idDoProfessor,
        configuracaoId: um.configuracaoId,
        titulo: "Segundo plano anual",
        status: "pronto",
      },
      select: { id: true },
    });

    await servico.apagarConfiguracao(ESCOLA, idDoProfessor, um.configuracaoId);

    expect(prefixosApagados.sort()).toEqual(
      [
        `planos-de-ensino/${ESCOLA}/${um.anualId}/`,
        `planos-de-ensino/${ESCOLA}/${dois.id}/`,
      ].sort(),
    );
  });

  test("falha no bucket não impede o professor de apagar o próprio planejamento", async () => {
    const { configuracaoId } = await criarPlanejamentoCompleto(idDoProfessor, "arte");
    const comStorageQuebrado = new PlanejamentoService(
      prisma,
      {
        apagarPrefixo: async () => Promise.reject(new Error("bucket fora do ar")),
      } as unknown as ObjectStorageService,
      new QuotaService(prisma),
      provider,
    );

    // Arquivo órfão no bucket é lixo, e lixo não pode virar tranca. O oposto —
    // apagar o conteúdo e deixar a linha — seria pior: a tela mostraria um
    // planejamento cujo documento não abre mais.
    await expect(
      comStorageQuebrado.apagarConfiguracao(ESCOLA, idDoProfessor, configuracaoId),
    ).resolves.toEqual({ ok: true });
    expect(
      await admin.planoDeEnsinoConfiguracao.findUnique({ where: { id: configuracaoId } }),
    ).toBeNull();
  });

  test("não apaga o planejamento de outro professor, e responde 404", async () => {
    const alheio = await criarPlanejamentoCompleto(idDeOutroProfessor, "musica");

    await expect(
      servico.apagarConfiguracao(ESCOLA, idDoProfessor, alheio.configuracaoId),
      // 404 e não 403: um 403 confirmaria que aquela regência existe.
    ).rejects.toMatchObject({ status: 404 });

    expect(
      await admin.planoDeEnsinoConfiguracao.findUnique({ where: { id: alheio.configuracaoId } }),
    ).not.toBeNull();
    expect(prefixosApagados).toEqual([]);
    await admin.planoDeEnsinoConfiguracao.delete({ where: { id: alheio.configuracaoId } });
  });
});

describe("as semanas prontas, para exportar várias juntas", () => {
  test("lista só as `pronto`, em ordem, e filtra pelo período de avaliação", async () => {
    const { configuracaoId, anualId } = await criarPlanejamentoCompleto(idDoProfessor, "arte");
    // A semana 1 já está pronta no 1º período. Acrescenta uma que FALHOU e uma
    // de outro período.
    await admin.planoDeEnsinoPeriodo.createMany({
      data: [
        {
          escolaId: ESCOLA,
          professorId: idDoProfessor,
          planoAnualId: anualId,
          ordem: 2,
          inicio: new Date("2026-02-09T12:00:00Z"),
          fim: new Date("2026-02-15T12:00:00Z"),
          periodoDeAvaliacao: 1,
          status: "erro",
          erro: "a geração falhou",
        },
        {
          escolaId: ESCOLA,
          professorId: idDoProfessor,
          planoAnualId: anualId,
          ordem: 11,
          inicio: new Date("2026-04-13T12:00:00Z"),
          fim: new Date("2026-04-19T12:00:00Z"),
          periodoDeAvaliacao: 2,
          status: "pronto",
          aulas: [{ numero: 1, tema: "Aula do 2º bimestre" }],
        },
      ],
    });

    const doAno = await servico.listarPlanosDePeriodo(ESCOLA, idDoProfessor, anualId);
    // A semana 2 falhou e fica FORA: um documento entregue à coordenação não
    // leva semana que não foi planejada.
    expect(doAno.map((p) => p.ordem)).toEqual([1, 11]);

    const doPrimeiroBimestre = await servico.listarPlanosDePeriodo(
      ESCOLA,
      idDoProfessor,
      anualId,
      1,
    );
    expect(doPrimeiroBimestre.map((p) => p.ordem)).toEqual([1]);

    await servico.apagarConfiguracao(ESCOLA, idDoProfessor, configuracaoId);
  });

  test("não lê as semanas de um plano anual de outro professor", async () => {
    const alheio = await criarPlanejamentoCompleto(idDeOutroProfessor, "musica");

    await expect(
      servico.listarPlanosDePeriodo(ESCOLA, idDoProfessor, alheio.anualId),
    ).rejects.toMatchObject({ status: 404 });

    await admin.planoDeEnsinoConfiguracao.delete({ where: { id: alheio.configuracaoId } });
  });
});
