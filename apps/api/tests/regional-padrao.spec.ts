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
  /* `liberacoes` e `progresso` estão sob RLS: apagadas SEM contexto de escola,
     a política as esconde e o `deleteMany` remove ZERO linhas em silêncio — e a
     próxima corrida quebra no `user.deleteMany`, com a FK `liberada_por`
     apontando para um professor de teste que não sai. É a armadilha que o
     `AGENTS.md` da api registra, e ela custou uma corrida vermelha aqui. */
  for (const escolaId of unidades) {
    await prisma.comTenancy(async (tx) => {
      await tx.liberacao.deleteMany({ where: { escolaId } });
      await tx.progresso.deleteMany({ where: { escolaId } });
    }, escolaId);
  }
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

/**
 * O PANORAMA DA DIRETORIA (ADR-81).
 *
 * O `gestor_regional` não tem lotação, e o panorama lia `lotacoes` direto — o
 * dele voltava VAZIO, com o item de menu aparecendo (o menu conta as escolas da
 * sessão, que vêm da regional). Tela em branco sem erro nenhum: o sintoma que
 * ninguém sabe diagnosticar.
 */
describe("panorama da regional", () => {
  const SUPERVISOR = "teste-pad-supervisor";

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: SUPERVISOR } });
  });

  test("o gestor_regional vê as escolas da regional, sem lotação em nenhuma", async () => {
    /* A regional DESTA suíte (`DESTINO`), nunca "a primeira que aparecer".
       Escrito com `findFirst({ tipo: 'regional' })`, este teste passava aqui e
       FALHAVA no CI: em banco de desenvolvimento a primeira era a `de-demo` do
       seed, com duas escolas; num banco recém-migrado é a regional PADRÃO, que
       não tem nenhuma — e o teste seguinte procurava uma escola que não existe.
       É a mesma armadilha de estado global que a ADR-79 já registrou noutro
       arquivo, e ela reapareceu aqui. `DESTINO` porque o bloco de exclusão roda
       ANTES neste arquivo e move as escolas para cá. */
    const regional = await prisma.escola.findUniqueOrThrow({ where: { id: DESTINO } });
    const escolasDaRegional = await prisma.escola.findMany({
      where: { tipo: "escola", paiId: regional.id },
      select: { id: true },
    });
    expect(escolasDaRegional.length).toBeGreaterThan(0);

    const supervisor = await prisma.user.create({
      data: {
        username: SUPERVISOR,
        displayName: "Supervisor da Diretoria",
        role: "gestor_regional",
        regionalId: regional.id,
        passwordHash: "x",
      },
    });

    // Nenhuma lotação — é o ponto.
    expect(await prisma.lotacao.count({ where: { usuarioId: supervisor.id } })).toBe(0);

    const alcance = await escolas.escolasDaPessoa(supervisor.id);
    expect(alcance.map((e) => e.id).sort()).toEqual(escolasDaRegional.map((e) => e.id).sort());
    expect(alcance.every((e) => e.papel === "gestor_regional")).toBe(true);

    const panorama = await escolas.resumoDasEscolasDaPessoa(supervisor.id);
    expect(panorama.map((e) => e.id).sort()).toEqual(escolasDaRegional.map((e) => e.id).sort());
    // E cada linha diz a diretoria, que é como a tela se intitula.
    expect(panorama.every((e) => e.regional === regional.nome)).toBe(true);
  });

  test("e alcança o histórico do estudante das escolas dela", async () => {
    const supervisor = await prisma.user.findFirstOrThrow({ where: { username: SUPERVISOR } });
    const daRegional = await prisma.escola.findFirstOrThrow({
      where: { tipo: "escola", paiId: supervisor.regionalId! },
      orderBy: { id: "asc" },
    });
    /* Sem este ramo em `temLotacao`, o histórico do estudante transferido —
       a única leitura que atravessa escolas fora dos perfis de contrato —
       responderia 403 justamente ao supervisor da diretoria onde a criança
       está. */
    expect(await escolas.temLotacao(supervisor.id, daRegional.id)).toBe(true);
    expect(await escolas.temLotacao(supervisor.id, "teste-pad-nao-existe")).toBe(false);
  });
});

/**
 * O RELATÓRIO DA DIRETORIA (ADR-82) — consolidado e por escola.
 *
 * Duas coisas para proteger, e a segunda é a que importa: que as DUAS medidas
 * não se confundam (criança com registro ≠ turma encerrada), e que o supervisor
 * não alcance a diretoria do vizinho por querystring.
 */
describe("relatório da diretoria", () => {
  const SUP = "teste-pad-relatorio";
  let supervisorId = "";

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { username: SUP } });
    const sup = await prisma.user.create({
      data: {
        username: SUP,
        displayName: "Supervisora do Relatório",
        role: "gestor_regional",
        regionalId: DESTINO,
        passwordHash: "x",
      },
    });
    supervisorId = sup.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: SUP } });
  });

  test("o gestor_regional lê a PRÓPRIA regional, e o parâmetro é ignorado", async () => {
    const auth = { usuarioId: supervisorId, perfil: "gestor_regional" };
    expect(await escolas.regionalDoRelatorio(auth)).toBe(DESTINO);
    /* Pedindo a do vizinho: a resposta continua sendo a dele. Não é validação
       que compara e recusa — é o parâmetro não ter efeito, que é a única forma
       de esquecer a comparação não virar um buraco. */
    expect(await escolas.regionalDoRelatorio(auth, REGIONAL)).toBe(DESTINO);
  });

  test("o perfil de contrato PRECISA informar a regional", async () => {
    const auth = { usuarioId: supervisorId, perfil: "gestor_contrato" };
    expect(await escolas.regionalDoRelatorio(auth)).toBeNull();
    expect(await escolas.regionalDoRelatorio(auth, REGIONAL)).toBe(REGIONAL);
  });

  test("uma escola não é regional: o relatório recusa", async () => {
    expect(await escolas.relatorioDaRegional(ESCOLAS[0]!)).toBeNull();
  });

  test("consolidado e por escola, com as duas medidas separadas", async () => {
    /* Uma liberação ENCERRADA e uma criança com registro, em escolas
       diferentes da mesma regional: se as duas medidas fossem a mesma coluna,
       este cenário sairia como um número só e ninguém veria a diferença. */
    const periodo = await prisma.periodoLetivo.findFirstOrThrow({ orderBy: { inicio: "desc" } });
    const turma = await prisma.turma.create({
      data: { escolaId: ESCOLAS[0]!, periodoLetivoId: periodo.id, nome: "9R", serie: "9EF" },
    });
    const professor = await prisma.user.create({
      data: {
        escolaId: ESCOLAS[0]!,
        username: "teste-pad-prof-rel",
        displayName: "Professor do Relatório",
        role: "professor",
        passwordHash: "x",
      },
    });
    const estudante = await prisma.user.create({
      data: {
        escolaId: ESCOLAS[1]!,
        username: "teste-pad-est-rel",
        displayName: "Estudante do Relatório",
        role: "estudante",
        passwordHash: "x",
      },
    });
    await prisma.comTenancy(
      (tx) =>
        tx.liberacao.create({
          data: {
            escolaId: ESCOLAS[0]!,
            turmaId: turma.id,
            expId: "app-70-vila-do-lume",
            estado: "encerrada",
            /* O banco exige a data junto do estado (CHECK
               `liberacoes_encerrada_em_check`): "encerrada" sem quando é um
               estado que não diz nada ao painel do professor. */
            encerradaEm: new Date(),
            liberadaPor: professor.id,
          },
        }),
      ESCOLAS[0]!,
    );
    await prisma.comTenancy(
      (tx) =>
        tx.progresso.create({
          data: { escolaId: ESCOLAS[1]!, estudanteId: estudante.id, expId: "app-70-vila-do-lume" },
        }),
      ESCOLAS[1]!,
    );

    /* DESTINO, e não REGIONAL: o bloco de exclusão acima roda ANTES neste
       arquivo e move as duas escolas para cá antes de apagar a origem. Olhar a
       regional errada aqui daria `null` — e a mensagem seria "regional.id é
       undefined", que não aponta para a ordem dos blocos. */
    const relatorio = await escolas.relatorioDaRegional(DESTINO);
    expect(relatorio?.regional.id).toBe(DESTINO);
    // A quebra por escola tem as duas unidades da regional, ordenada por nome.
    expect(relatorio?.escolas.map((e) => e.nome)).toEqual(
      [...(relatorio?.escolas ?? [])].map((e) => e.nome).sort((a, b) => a.localeCompare(b, "pt-BR")),
    );
    const vila = relatorio?.experiencias.find((e) => e.expId === "app-70-vila-do-lume");
    expect(vila).toMatchObject({ turmasEncerradas: 1, turmasLiberadas: 0, estudantes: 1 });
    // O nome do catálogo, que a diretoria reconhece; o código só fora dele (H07.2.1).
    const doCatalogo = await prisma.experiencia.findUnique({ where: { expId: "app-70-vila-do-lume" } });
    expect(vila?.nome).toBe(doCatalogo?.nome ?? "app-70-vila-do-lume");
    if (!doCatalogo) {
      // Banco de teste sem o catálogo publicado: prova o caminho do nome também.
      await prisma.experiencia.create({
        data: { expId: "app-70-vila-do-lume", nome: "Vila do Lume", versaoAtiva: "0.0.0" },
      });
      const comNome = await escolas.relatorioDaRegional(DESTINO);
      expect(comNome?.experiencias.find((e) => e.expId === "app-70-vila-do-lume")?.nome).toBe("Vila do Lume");
      await prisma.experiencia.delete({ where: { expId: "app-70-vila-do-lume" } });
    }
    // E cada medida aparece na ESCOLA onde aconteceu, não somada na primeira.
    const daTurma = relatorio?.escolas.find((e) => e.id === ESCOLAS[0]);
    const daCrianca = relatorio?.escolas.find((e) => e.id === ESCOLAS[1]);
    expect(daTurma).toMatchObject({ turmasComMissaoEncerrada: 1, estudantesComRegistro: 0 });
    expect(daCrianca).toMatchObject({ turmasComMissaoEncerrada: 0, estudantesComRegistro: 1 });

    await prisma.progresso.deleteMany({ where: { estudanteId: estudante.id } });
    await prisma.liberacao.deleteMany({ where: { turmaId: turma.id } });
    await prisma.user.deleteMany({ where: { id: { in: [professor.id, estudante.id] } } });
    await prisma.turma.delete({ where: { id: turma.id } });
  });

  test("regional sem escola devolve estrutura vazia, não erro", async () => {
    await prisma.escola.create({ data: { id: VAZIA, nome: "DE Vazia", tipo: "regional" } });
    const r = await escolas.relatorioDaRegional(VAZIA);
    expect(r).toMatchObject({ escolas: [], experiencias: [] });
    await prisma.escola.delete({ where: { id: VAZIA } });
  });
});
