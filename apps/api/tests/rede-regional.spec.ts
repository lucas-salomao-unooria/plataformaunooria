import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { periodoDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

/**
 * O NÍVEL REGIONAL — Diretoria de Ensino, polo, secretaria municipal.
 *
 * Uma rede estadual tem ~5.000 escolas em ~90 diretorias, e entre `gestor_escola` (uma
 * escola) e `gestor_contrato` (todas) não havia nada. A decisão foi resolver isso
 * SEM papel novo: o supervisor de uma diretoria é um `gestor_escola` LOTADO nas escolas
 * dela. O que este arquivo protege é que a hierarquia sirva para AGRUPAR (montar
 * a lista da diretoria) e nunca para AUTORIZAR — quem autoriza é a lotação.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const REGIONAL = "teste-reg-diretoria";
const OUTRA_REGIONAL = "teste-reg-outra";
const ESCOLAS = ["teste-reg-e1", "teste-reg-e2", "teste-reg-e3"];
const ESCOLA_DE_FORA = "teste-reg-fora";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { escolas, rostering } = servicosDeTeste(prisma);

const todas = [REGIONAL, OUTRA_REGIONAL, ...ESCOLAS, ESCOLA_DE_FORA];

async function limpar() {
  const alvo = { in: todas };
  await prisma.matricula.deleteMany({ where: { escolaId: alvo } });
  await prisma.lotacao.deleteMany({ where: { escolaId: alvo } });
  await prisma.user.deleteMany({ where: { escolaId: alvo } });
  await prisma.turma.deleteMany({ where: { escolaId: alvo } });
  // A regional é pai: as unidades saem antes dela.
  await prisma.escola.deleteMany({ where: { id: { in: [...ESCOLAS, ESCOLA_DE_FORA] } } });
  await prisma.escola.deleteMany({ where: { id: { in: [REGIONAL, OUTRA_REGIONAL] } } });
}

let supervisorId = "";

beforeAll(async () => {
  await limpar();
  const periodo = await periodoDeTeste(prisma);

  await prisma.escola.create({
    data: { id: REGIONAL, nome: "DE Teste Norte", tipo: "regional", uf: "SP" },
  });
  await prisma.escola.create({
    data: { id: OUTRA_REGIONAL, nome: "DE Teste Sul", tipo: "regional", uf: "SP" },
  });
  for (const [i, id] of ESCOLAS.entries()) {
    await prisma.escola.create({
      data: {
        id,
        nome: `EE Unidade ${i + 1}`,
        tipo: "escola",
        paiId: REGIONAL,
        municipio: i === 2 ? "Santos" : "São Paulo",
        uf: "SP",
      },
    });
    await prisma.turma.create({
      data: { escolaId: id, periodoLetivoId: periodo.id, nome: "6A", serie: "6EF" },
    });
  }
  await prisma.escola.create({
    data: { id: ESCOLA_DE_FORA, nome: "EE Fora da DE", tipo: "escola", paiId: OUTRA_REGIONAL },
  });

  const supervisor = await prisma.user.create({
    data: {
      escolaId: ESCOLAS[0]!,
      username: "sup-teste-regional",
      displayName: "Supervisora de Teste",
      role: "gestor_escola",
      passwordHash: "x",
    },
  });
  supervisorId = supervisor.id;
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("hierarquia: agrupa, não autoriza", () => {
  test("as unidades de uma diretoria saem por filtro de pai", async () => {
    const daDiretoria = await escolas.listar({ paiId: REGIONAL });
    expect(daDiretoria.map((e) => e.id).sort()).toEqual([...ESCOLAS].sort());
    // E cada linha diz a qual regional pertence, por nome.
    expect(daDiretoria[0]?.pai).toBe("DE Teste Norte");
  });

  test("filtrar por tipo separa as unidades das regionais", async () => {
    const regionais = await escolas.listar({ tipo: "regional", busca: "DE Teste" });
    expect(regionais.map((e) => e.id).sort()).toEqual([OUTRA_REGIONAL, REGIONAL].sort());
    expect(regionais.every((e) => e.turmas === 0 && e.estudantes === 0)).toBe(true);
  });

  test("a regional conta as escolas que agrupa, mesmo filtrando só regionais", async () => {
    /* `unidades` é o número da tela de Regionais, e ele NÃO pode sair da lista
       da consulta: com `tipo=regional` as filhas não estão no resultado, e
       contá-las ali daria zero em toda linha. */
    const regionais = await escolas.listar({ tipo: "regional", busca: "DE Teste" });
    expect(regionais.find((e) => e.id === REGIONAL)?.unidades).toBe(ESCOLAS.length);
    expect(regionais.find((e) => e.id === OUTRA_REGIONAL)?.unidades).toBe(1);
    // Escola nenhuma agrupa nada: unidade dentro de unidade não existe na rede.
    const unidades = await escolas.listar({ paiId: REGIONAL });
    expect(unidades.every((e) => e.unidades === 0)).toBe(true);
  });

  test("filtrar por município é o outro caminho de montar o lote", async () => {
    const emSantos = await escolas.listar({ municipio: "santos" });
    expect(emSantos.map((e) => e.id)).toEqual([ESCOLAS[2]]);
  });

  test("ESCOLA não pode ser pai de escola — o banco recusa", async () => {
    await expect(
      prisma.escola.update({ where: { id: ESCOLAS[1]! }, data: { paiId: ESCOLAS[0]! } }),
    ).rejects.toThrow(/tem de ser regional/);
  });

  test("e ESCOLA NENHUMA fica sem regional — nem por SQL", async () => {
    /* Três camadas sustentam o vínculo obrigatório (ADR-79): o Zod reprova o
       formulário, o service reprova a chamada, e o banco não deixa a linha
       existir órfã. A camada do banco ADOTA em vez de recusar — quem escreve
       SQL direto (as suítes que criam escola de mentira para testar outra
       coisa) não declarou preferência de regional, e a padrão é a linha que
       existe justamente para esse caso. Sem padrão na rede, o CHECK recusa. */
    const padrao = await prisma.escola.findFirst({ where: { regionalPadrao: true } });
    const tentativa = prisma.escola.update({
      where: { id: ESCOLAS[0]! },
      data: { paiId: null },
    });
    if (padrao) {
      expect(await tentativa).toMatchObject({ paiId: padrao.id });
      // e volta para a diretoria dela, que é o estado que o resto da suíte lê
      await prisma.escola.update({ where: { id: ESCOLAS[0]! }, data: { paiId: REGIONAL } });
    } else {
      await expect(tentativa).rejects.toThrow(/escola_tem_regional/);
    }
  });

  test("nem pai de si mesma", async () => {
    await expect(
      prisma.escola.update({ where: { id: REGIONAL }, data: { paiId: REGIONAL } }),
    ).rejects.toThrow(/si mesma/);
  });

  test("estar na diretoria NÃO dá acesso: quem dá é a lotação", async () => {
    // A supervisora ainda não foi lotada em nada, mesmo com as três escolas
    // penduradas na diretoria dela.
    expect(await escolas.escolasDaPessoa(supervisorId)).toEqual([]);
    expect(await escolas.temLotacao(supervisorId, ESCOLAS[0]!)).toBe(false);
  });
});

describe("lotação em lote", () => {
  test("lota a supervisora nas três unidades de uma vez", async () => {
    const feito = await escolas.lotarEmLote(ESCOLAS, supervisorId, "gestor_escola");
    // O lote diz o que FEZ, por escola: três vínculos nasceram agora.
    expect(feito?.criadas.sort()).toEqual([...ESCOLAS].sort());
    expect(feito).toMatchObject({ reabertas: [], jaVinculadas: [], ignoradas: [] });

    const dela = await escolas.escolasDaPessoa(supervisorId);
    expect(dela.map((e) => e.id).sort()).toEqual([...ESCOLAS].sort());
    // A primeira vira a principal — é a que o token carrega quando ela entra
    // sem escolher.
    expect(dela.filter((e) => e.principal)).toHaveLength(1);
  });

  test("e continua sem alcançar a escola da OUTRA diretoria", async () => {
    expect(await escolas.temLotacao(supervisorId, ESCOLA_DE_FORA)).toBe(false);
  });

  test("reaplicar é no-op: não duplica nem troca a principal", async () => {
    const antes = await escolas.escolasDaPessoa(supervisorId);
    const feito = await escolas.lotarEmLote(ESCOLAS, supervisorId, "gestor_escola");
    /* Reaplicar não escreve NADA: as três voltam em `jaVinculadas`. Antes o
       retorno dizia `lotadas: 3` nas duas vezes, e a tela anunciava três
       vínculos novos tendo criado zero. */
    expect(feito?.criadas).toEqual([]);
    expect(feito?.jaVinculadas.sort()).toEqual([...ESCOLAS].sort());
    const depois = await escolas.escolasDaPessoa(supervisorId);
    expect(depois).toHaveLength(antes.length);
    expect(depois.find((e) => e.principal)?.id).toBe(antes.find((e) => e.principal)?.id);
  });

  test("lotar numa REGIONAL é ignorado — ela não tem turma nem estudante", async () => {
    const feito = await escolas.lotarEmLote([REGIONAL, ESCOLAS[0]!], supervisorId, "gestor_escola");
    // Sem isso, a regional apareceria no seletor do cabeçalho como uma escola
    // fantasma, sem nada dentro.
    expect(feito?.ignoradas).toEqual([REGIONAL]);
    expect(feito?.jaVinculadas).toEqual([ESCOLAS[0]]);
  });

  test("e a rota INDIVIDUAL recusa a regional pelo mesmo motivo", async () => {
    /* O lote filtrava por tipo desde o início; `lotar` não filtrava nada, e por
       `POST /escolas/:id/lotacoes` dava para produzir a escola fantasma que o
       lote existe para evitar. */
    expect(await escolas.lotar(REGIONAL, supervisorId, "gestor_escola")).toBeNull();
    expect(await escolas.temLotacao(supervisorId, REGIONAL)).toBe(false);
  });

  test("admin-contrato não pode ser lotado", async () => {
    const admin = await prisma.user.findFirst({ where: { role: "gestor_contrato" } });
    if (!admin) return; // seed não rodou neste banco
    expect(await escolas.lotarEmLote(ESCOLAS, admin.id, "gestor_escola")).toBeNull();
  });
});

describe("panorama de quem tem muitas escolas", () => {
  test("uma linha por unidade, com o que há dentro dela", async () => {
    const resumo = await escolas.resumoDasEscolasDaPessoa(supervisorId);
    expect(resumo).toHaveLength(3);
    expect(resumo[0]).toMatchObject({ regional: "DE Teste Norte", turmas: 1, papel: "gestor_escola" });
    // Ordenado por nome, para a lista de cinquenta escolas ser navegável.
    expect(resumo.map((e) => e.nome)).toEqual([...resumo.map((e) => e.nome)].sort());
  });

  test("conta quem ainda não fez o primeiro acesso — é o que falta fazer ali", async () => {
    await rostering.importarPlanilha(
      ESCOLAS[0]!,
      ["nome,papel,turma,serie", "Estudante Novo da Unidade,estudante,6A,6EF"].join("\n"),
      { senhaPadrao: "SenhaDoLote1" },
    );
    const resumo = await escolas.resumoDasEscolasDaPessoa(supervisorId);
    const unidade = resumo.find((e) => e.id === ESCOLAS[0]);
    expect(unidade?.estudantes).toBe(1);
    expect(unidade?.semPrimeiroAcesso).toBe(1);
  });

  test("a supervisora vê o dado de CADA escola dela, uma por vez", async () => {
    // É o que o seletor de escola do cabeçalho faz: troca a escola ativa, e o
    // token passa a carregar a nova. A RLS não muda.
    const naPrimeira = await rostering.turmasDaEscola(ESCOLAS[0]!);
    const naSegunda = await rostering.turmasDaEscola(ESCOLAS[1]!);
    expect(naPrimeira.map((t) => t.nome)).toEqual(["6A"]);
    expect(naSegunda.map((t) => t.nome)).toEqual(["6A"]);
    expect(naPrimeira[0]?.estudantes).toBe(1);
    expect(naSegunda[0]?.estudantes).toBe(0);
  });

  test("encerrar uma lotação tira só aquela escola do panorama", async () => {
    const dela = await prisma.lotacao.findFirstOrThrow({
      where: { usuarioId: supervisorId, escolaId: ESCOLAS[2]!, fim: null },
    });
    await escolas.encerrarLotacao(dela.id);
    const resumo = await escolas.resumoDasEscolasDaPessoa(supervisorId);
    expect(resumo.map((e) => e.id).sort()).toEqual([ESCOLAS[0], ESCOLAS[1]].sort());
  });
});
