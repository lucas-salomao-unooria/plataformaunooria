import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { servicosDeTeste } from "./servicos-de-teste";

/**
 * TODA ESCOLA TEM REGIONAL, e a rede nunca fica sem nenhuma (ADR-79).
 *
 * O que este arquivo protege é o par de invariantes que a tela nova assume: não
 * existe escola órfã — nem por formulário, nem por importação, nem por SQL — e
 * não existe rede sem regional. A regional padrão é o que torna o primeiro
 * possível sem obrigar a rede pequena a inventar uma diretoria.
 *
 * A exclusão de regional entrou junto, por decisão de produto: a rede que se
 * reorganiza precisa apagar as diretorias antigas. ESCOLA continua sem exclusão
 * em lugar nenhum — ela é tenant, com turma, dado de menor e histórico atrás.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const REGIONAL = "teste-pad-origem";
const DESTINO = "teste-pad-destino";
const ESCOLAS = ["teste-pad-e1", "teste-pad-e2"];
const VAZIA = "teste-pad-vazia";
const DO_CSV = "teste-pad-csv";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { escolas, oneroster } = servicosDeTeste(prisma);

async function limpar() {
  const unidades = [...ESCOLAS, DO_CSV, "teste-pad-orfa", "teste-pad-neta"];
  const agrupadores = [REGIONAL, DESTINO, VAZIA];
  const alvo = { in: [...unidades, ...agrupadores] };
  await prisma.lotacao.deleteMany({ where: { escolaId: alvo } });
  await prisma.user.deleteMany({ where: { escolaId: alvo } });
  await prisma.turma.deleteMany({ where: { escolaId: alvo } });
  // As unidades saem antes das regionais: elas são as filhas.
  await prisma.escola.deleteMany({ where: { id: { in: unidades } } });
  await prisma.escola.deleteMany({ where: { id: { in: agrupadores } } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({
    data: { id: REGIONAL, nome: "DE Padrão Origem", tipo: "regional", uf: "SP" },
  });
  await prisma.escola.create({
    data: { id: DESTINO, nome: "DE Padrão Destino", tipo: "regional", uf: "SP" },
  });
  for (const [i, id] of ESCOLAS.entries()) {
    await prisma.escola.create({
      data: { id, nome: `EE Padrão ${i + 1}`, tipo: "escola", paiId: REGIONAL, uf: "SP" },
    });
  }
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("a regional padrão", () => {
  test("a rede tem regional, e no máximo uma padrão", async () => {
    /* A migração cria a padrão quando a rede não tem regional nenhuma (contrato
       recém-provisionado) ou quando há escola órfã para adotar. Numa rede já
       organizada em diretorias, sem órfãs, ela NÃO nasce — e o invariante "ao
       menos uma regional" vale ali por outro caminho. */
    expect(await prisma.escola.count({ where: { regionalPadrao: true } })).toBeLessThanOrEqual(1);
    expect(await prisma.escola.count({ where: { tipo: "regional" } })).toBeGreaterThan(0);
  });

  test("não dá para ter uma segunda — o índice único parcial recusa", async () => {
    const padrao = await prisma.escola.findFirst({ where: { regionalPadrao: true } });
    if (!padrao) return; // rede já organizada: não há padrão para duplicar
    /* A mensagem é a do Prisma, não o nome do índice: ele traduz o erro do
       Postgres para "Unique constraint failed on the fields" e o
       `escolas_regional_padrao_unica` não aparece. */
    await expect(
      prisma.escola.update({ where: { id: DESTINO }, data: { regionalPadrao: true } }),
    ).rejects.toThrow(/Unique constraint failed.*regional_padrao/s);
  });

  test("o nome dela é editável — é assim que ela recebe o nome da rede", async () => {
    /* Ela nasce 'Rede' porque o nome real do contrato não existe no banco: o
       contrato é a stack, não uma linha. Quem sabe o nome é quem administra. */
    const padrao = await prisma.escola.findFirst({ where: { regionalPadrao: true } });
    if (!padrao) return;
    const renomeada = await escolas.atualizar(padrao.id, { nome: "Rede Estadual de Teste" });
    expect(renomeada).toMatchObject({ nome: "Rede Estadual de Teste", regionalPadrao: true });
    await escolas.atualizar(padrao.id, { nome: padrao.nome });
  });
});

describe("nenhuma escola nasce sem regional", () => {
  test("criar escola sem regional é recusado, com o texto do produto", async () => {
    expect(await escolas.criar({ id: "teste-pad-orfa", nome: "EE Órfã" })).toEqual({
      erro: "sem-regional",
    });
    expect(await prisma.escola.findUnique({ where: { id: "teste-pad-orfa" } })).toBeNull();
  });

  test("e com um pai que não é regional, também", async () => {
    /* Pendurar escola em escola: o trigger recusaria, mas o service recusa
       antes — a tela precisa de texto, não da exceção crua do Postgres. */
    expect(
      await escolas.criar({ id: "teste-pad-neta", nome: "EE Neta", paiId: ESCOLAS[0]! }),
    ).toEqual({ erro: "regional-invalida" });
    expect(await prisma.escola.findUnique({ where: { id: "teste-pad-neta" } })).toBeNull();
  });

  test("editar não consegue esvaziar a regional de uma escola", async () => {
    expect(await escolas.atualizar(ESCOLAS[0]!, { paiId: null })).toEqual({
      erro: "sem-regional",
    });
    const intacta = await prisma.escola.findUnique({ where: { id: ESCOLAS[0]! } });
    expect(intacta?.paiId).toBe(REGIONAL);
  });

  test("mas TROCAR de regional é permitido: é a unidade mudando de diretoria", async () => {
    expect(await escolas.atualizar(ESCOLAS[1]!, { paiId: DESTINO })).toMatchObject({
      paiId: DESTINO,
    });
    await escolas.atualizar(ESCOLAS[1]!, { paiId: REGIONAL });
  });

  test("a importação com VÁRIAS regionais exige a coluna, e a linha vira ERRO", async () => {
    /* Este banco tem mais de uma regional, então a linha sem `parentSourcedId`
       não tem destino óbvio. Antes ela entrava com `pai_id` nulo e só um aviso
       — "melhor unidade sem regional que unidade pendurada em nada". Deixou de
       ser opção: a escola órfã é o estado que a ADR-79 elimina. */
    const csv = ["sourcedId,name,type", `${DO_CSV},EE Vinda do CSV,school`].join("\n");
    const relatorio = await oneroster.importar(REGIONAL, "orgs", csv, {
      podeCriarEscola: true,
    });
    expect(relatorio.erros.map((e) => e.campo)).toContain("parentSourcedId");
    expect(relatorio.criados).toBe(0);
    expect(await prisma.escola.findUnique({ where: { id: DO_CSV } })).toBeNull();
  });

  test("com parentSourcedId conhecido, entra vinculada", async () => {
    const csv = ["sourcedId,name,type,parentSourcedId", `${DO_CSV},EE Vinda do CSV,school,${DESTINO}`].join(
      "\n",
    );
    const relatorio = await oneroster.importar(REGIONAL, "orgs", csv, {
      podeCriarEscola: true,
    });
    expect(relatorio.erros).toEqual([]);
    expect(await prisma.escola.findUnique({ where: { id: DO_CSV } })).toMatchObject({
      paiId: DESTINO,
    });
  });
});

describe("exclusão de regional", () => {
  test("escola não se exclui por esta porta", async () => {
    expect(await escolas.excluirRegional(ESCOLAS[0]!)).toEqual({ erro: "nao-e-regional" });
    expect(await prisma.escola.findUnique({ where: { id: ESCOLAS[0]! } })).not.toBeNull();
  });

  test("regional inexistente é ausência, não erro de regra", async () => {
    expect(await escolas.excluirRegional("teste-pad-nao-existe")).toEqual({
      erro: "nao-encontrada",
    });
  });

  test("com escolas e sem destino, a recusa já traz o que a tela precisa", async () => {
    const feito = await escolas.excluirRegional(REGIONAL);
    /* `escolas` alimenta a frase do diálogo; `destinos` é o que decide entre
       oferecer a transferência e explicar que não há para onde transferir. */
    expect(feito).toMatchObject({ erro: "tem-escolas", escolas: ESCOLAS.length });
    expect("destinos" in feito ? feito.destinos : 0).toBeGreaterThan(0);
    expect(await prisma.escola.findUnique({ where: { id: REGIONAL } })).not.toBeNull();
  });

  test("destino que não é regional é recusado antes de mover nada", async () => {
    expect(await escolas.excluirRegional(REGIONAL, ESCOLAS[0]!)).toEqual({
      erro: "destino-invalido",
    });
    expect(await prisma.escola.count({ where: { paiId: REGIONAL } })).toBe(ESCOLAS.length);
  });

  test("com destino, transfere as escolas e exclui na MESMA transação", async () => {
    expect(await escolas.excluirRegional(REGIONAL, DESTINO)).toEqual({
      ok: true,
      transferidas: ESCOLAS.length,
    });
    expect(await prisma.escola.findUnique({ where: { id: REGIONAL } })).toBeNull();
    const noDestino = await prisma.escola.findMany({
      where: { paiId: DESTINO, id: { in: ESCOLAS } },
    });
    expect(noDestino.map((e) => e.id).sort()).toEqual([...ESCOLAS].sort());
  });

  test("regional vazia sai direto", async () => {
    await prisma.escola.create({ data: { id: VAZIA, nome: "DE Vazia", tipo: "regional" } });
    expect(await escolas.excluirRegional(VAZIA)).toEqual({ ok: true, transferidas: 0 });
    expect(await prisma.escola.findUnique({ where: { id: VAZIA } })).toBeNull();
  });

  test("a rede nunca fica sem regional", async () => {
    /* É o único caso desta suíte que depende do estado do banco, e depende por
       definição: o invariante é do CONTRATO inteiro, não das linhas da suíte.
       Em CI (`migrate:deploy` sem seed) sobra só a regional padrão, e o ramo da
       recusa é exercitado de verdade; em banco de desenvolvimento com seed há
       outras, e o que se prova é o complemento — a regra não dispara enquanto
       houver mais de uma. Os dois ramos afirmam; o que muda é qual. */
    const restantes = await prisma.escola.findMany({
      where: { tipo: "regional" },
      select: { id: true },
    });
    if (restantes.length === 1) {
      expect(await escolas.excluirRegional(restantes[0]!.id)).toEqual({ erro: "ultima-regional" });
      expect(await prisma.escola.count({ where: { tipo: "regional" } })).toBe(1);
    } else {
      // O DESTINO ficou com as escolas transferidas: a recusa é por escolas, e
      // não por ser a última — que é exatamente o que este ramo prova.
      expect(await escolas.excluirRegional(DESTINO)).toMatchObject({ erro: "tem-escolas" });
    }
  });
});
