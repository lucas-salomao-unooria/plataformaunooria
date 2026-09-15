import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { ARQUIVOS_ONEROSTER, type ArquivoOneRoster } from "../src/rostering/catalogo";
import {
  COLUNAS_MODELO_ONEROSTER,
  exemploOneRoster,
  modeloOneRoster,
  type ContextoDoExemplo,
} from "../src/rostering/modelos-oneroster";
import { COLUNAS_POR_ARQUIVO, lerArquivoOneRoster } from "../src/rostering/oneroster";
import { servicosDeTeste } from "./servicos-de-teste";

/**
 * Os modelos e exemplos que a tela de importação oferece para download.
 *
 * O que estes testes protegem é a promessa do arquivo: o gestor baixa, preenche
 * e envia. Um modelo que divirja do parser transforma isso em "baixei o modelo
 * de vocês e deu erro de cabeçalho" — e a divergência não aparece em typecheck
 * nenhum, porque as duas listas são só strings.
 *
 * A prova forte é a última: o lote de exemplo inteiro, na ordem da tela,
 * aplicado contra o banco.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-escola-or-modelos";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { oneroster } = servicosDeTeste(prisma);

const ctx: ContextoDoExemplo = {
  escolaId: ESCOLA,
  escolaNome: "EE Exemplo, Unidade I",
  codigoInep: "35000042",
  ano: 2029,
};

describe("modelo em branco de cada arquivo", () => {
  test.each(ARQUIVOS_ONEROSTER)("%s: só o cabeçalho, e o parser o aceita", (arquivo) => {
    const csv = modeloOneRoster(arquivo);
    expect(csv.trim().split("\n")).toHaveLength(1);

    const { linhas, erros } = lerArquivoOneRoster(arquivo, csv);
    expect(erros).toEqual([]);
    expect(linhas).toEqual([]);
  });

  test.each(ARQUIVOS_ONEROSTER)("%s: toda coluna obrigatória está no modelo", (arquivo) => {
    const noModelo = COLUNAS_MODELO_ONEROSTER[arquivo].map((c) => c.toLowerCase());
    for (const obrigatoria of COLUNAS_POR_ARQUIVO[arquivo].obrigatorias) {
      expect(noModelo).toContain(obrigatoria);
    }
  });

  /* A outra direção: coluna no modelo que o leitor não conhece é uma promessa
     que o arquivo faz e o parser não cumpre — o dado entraria e sumiria. */
  test.each(ARQUIVOS_ONEROSTER)("%s: nenhuma coluna do modelo é desconhecida", (arquivo) => {
    const conhecidas = COLUNAS_POR_ARQUIVO[arquivo].conhecidas;
    for (const coluna of COLUNAS_MODELO_ONEROSTER[arquivo]) {
      expect(conhecidas).toContain(coluna.toLowerCase());
    }
  });
});

describe("exemplo preenchido", () => {
  test.each(ARQUIVOS_ONEROSTER)("%s: usa o cabeçalho do modelo e nenhuma linha é recusada", (arquivo) => {
    const csv = exemploOneRoster(arquivo, ctx);
    expect(csv.split("\n")[0]).toBe(COLUNAS_MODELO_ONEROSTER[arquivo].join(","));

    const { linhas, erros } = lerArquivoOneRoster(arquivo, csv);
    expect(erros).toEqual([]);
    expect(linhas.length).toBeGreaterThan(0);
  });

  test("o exemplo leva a escola de VERDADE, não um tenant fictício", () => {
    expect(exemploOneRoster("orgs", ctx)).toContain(`${ESCOLA},active`);
    // O nome tem vírgula: sem aspas, ele viraria duas colunas e o `type`
    // deixaria de ser "school" — a linha voltaria como organização ignorada.
    expect(exemploOneRoster("orgs", ctx)).toContain('"EE Exemplo, Unidade I"');
    for (const arquivo of ["classes", "enrollments", "users", "roles"] as ArquivoOneRoster[]) {
      expect(exemploOneRoster(arquivo, ctx)).toContain(ESCOLA);
    }
  });

  /* Referência quebrada dentro do próprio exemplo é o pior caso: o gestor
     manda o lote para conferir o caminho e recebe "sourcedId desconhecido". */
  test("as referências entre os arquivos fecham", () => {
    const ids = (arquivo: ArquivoOneRoster) =>
      new Set(
        lerArquivoOneRoster(arquivo, exemploOneRoster(arquivo, ctx)).linhas.map((l) =>
          l.campo("sourcedId"),
        ),
      );
    const turmas = ids("classes");
    const pessoas = ids("users");

    for (const linha of lerArquivoOneRoster("enrollments", exemploOneRoster("enrollments", ctx)).linhas) {
      expect([...turmas]).toContain(linha.campo("classSourcedId"));
      expect([...pessoas]).toContain(linha.campo("userSourcedId"));
    }
    for (const linha of lerArquivoOneRoster("roles", exemploOneRoster("roles", ctx)).linhas) {
      expect([...pessoas]).toContain(linha.campo("userSourcedId"));
    }
  });

  test("o ano do calendário é o do contexto — o arquivo não envelhece no bucket", () => {
    expect(exemploOneRoster("academicSessions", ctx)).toContain("Ano Letivo 2029");
    expect(exemploOneRoster("academicSessions", ctx)).toContain("2029-02-01");
  });

  /* A coluna `password` é ignorada na leitura (ADR-29); um modelo que a
     trouxesse convidaria a escola a mandar senha em texto claro. */
  test("nenhum arquivo oferece coluna de senha", () => {
    for (const arquivo of ARQUIVOS_ONEROSTER) {
      expect(COLUNAS_MODELO_ONEROSTER[arquivo]).not.toContain("password");
    }
  });
});

/**
 * A prova de que o exemplo é EXEMPLO: enviado na ordem da tela, o lote inteiro
 * entra. É o roteiro que o gestor segue para conferir o caminho antes de mandar
 * a rede.
 */
describe("o lote de exemplo aplicado, na ordem da tela", () => {
  const ANO = 2029;
  const doAmbiente: ContextoDoExemplo = { ...ctx, ano: ANO, escolaNome: "Escola OneRoster (modelos)" };

  /**
   * OS PREDICADOS TÊM DE COINCIDIR, e é aí que estava o defeito.
   *
   * A limpeza apagava turmas por ESCOLA e o período por FONTE_ID — dois
   * conjuntos que não precisam ser o mesmo. Qualquer turma apontando para o
   * período do exemplo e vivendo fora de `ESCOLA` sobrevive ao terceiro
   * `deleteMany` e faz o quinto morrer em
   * `Foreign key constraint violated: turmas_periodo_letivo_id_fkey` — na
   * PRÓPRIA limpeza, que é o pior lugar para falhar: o Jest reporta o erro do
   * teardown no lugar do erro do teste.
   *
   * MEDIDO em 2026-09-10: ~1 falha a cada 10 corridas completas da suíte, e
   * ZERO em 30 corridas com quatro suítes removidas — ou seja, é janela de
   * corrida que só abre com o banco mais movimentado. Apagar as turmas DO
   * PERÍODO (e não da escola) fecha a janela sem depender de descobrir quem a
   * abre: `periodos_letivos` é catálogo do contrato, compartilhado por todas
   * as escolas, e é isso que torna o predicado por escola insuficiente aqui.
   */
  async function limpar() {
    const doExemplo = { periodoLetivo: { fonteId: `exemplo.ano-${ANO}` } };
    await prisma.matricula.deleteMany({ where: { OR: [{ escolaId: ESCOLA }, { turma: doExemplo }] } });
    await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
    await prisma.turma.deleteMany({ where: { OR: [{ escolaId: ESCOLA }, doExemplo] } });
    await prisma.escola.deleteMany({ where: { id: ESCOLA } });
    /* O PERÍODO LETIVO NÃO É APAGADO, e isto é a correção.
       `periodos_letivos` é catálogo do CONTRATO — uma linha compartilhada por
       todas as escolas —, e apagá-la de dentro de uma suíte abria uma janela em
       que outra turma, criada entre o `deleteMany` das turmas e o do período,
       fazia o segundo morrer em `turmas_periodo_letivo_id_fkey`. Na PRÓPRIA
       limpeza, que é o pior lugar: o Jest reporta o erro do teardown no lugar do
       erro do teste. Apagar as turmas do período também não bastou (medido) —
       o escritor concorrente age dentro da janela.
       Deixar a linha é inofensivo: o importador do exemplo a reconhece pelo
       `fonte_id` e a reutiliza, nenhum teste afirma nada sobre ela, e um
       período letivo a mais num banco de teste não muda resposta nenhuma. */
  }

  beforeAll(async () => {
    await limpar();
    await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola OneRoster (modelos)" } });
  });

  afterAll(async () => {
    await limpar();
    await prisma.$disconnect();
  });

  test("os sete arquivos passam sem erro, e a turma sai enturmada", async () => {
    for (const arquivo of ARQUIVOS_ONEROSTER) {
      const relatorio = await oneroster.importar(
        ESCOLA,
        arquivo,
        exemploOneRoster(arquivo, doAmbiente),
        { modo: "delta", senhaPadrao: "exemplo-1234" },
      );
      expect({ arquivo, erros: relatorio.erros }).toEqual({ arquivo, erros: [] });
    }

    const turma = await prisma.turma.findFirst({
      where: { escolaId: ESCOLA, fonteId: "exemplo.turma-8a" },
    });
    expect(turma?.serie).toBe("8EF");

    const pessoas = await prisma.user.findMany({
      where: { escolaId: ESCOLA },
      orderBy: { username: "asc" },
    });
    expect(pessoas.map((p) => `${p.username}:${p.role}`)).toEqual([
      "ana.ribeiro:estudante",
      "carlos.dias:gestor_escola",
      "joao.souza:estudante",
      "marta.alves:professor",
    ]);

    const matriculas = await prisma.matricula.count({ where: { escolaId: ESCOLA, fim: null } });
    expect(matriculas).toBe(3);
  });
});
