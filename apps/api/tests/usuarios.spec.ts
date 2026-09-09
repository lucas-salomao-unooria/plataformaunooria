import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../src/prisma/prisma.service";
import { parseCsv } from "../src/usuarios/csv";
import { criarTurmaDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-escola-usuarios";

/**
 * CPF só desta suíte. O índice único de CPF é da REDE inteira (não da escola),
 * então duas suítes que usem o mesmo número colidem em paralelo — e a mensagem
 * ("Unique constraint failed on `cpf`") não diz nada sobre a suíte vizinha.
 */
const CPF_DA_ANA = "111.444.770-69";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { rostering, usuarios, escolas } = servicosDeTeste(prisma);

async function limpar() {
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.lotacao.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Usuários (teste)" } });
  await criarTurmaDeTeste(prisma, ESCOLA, "8A", "8EF");
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("parseCsv", () => {
  test("campos com vírgula e aspas escapadas", () => {
    expect(parseCsv('a,"b, c","d ""e"""\n1,2,3')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });
  test("BOM e CRLF", () => {
    expect(parseCsv("﻿x,y\r\n1,2\r\n")).toEqual([
      ["x", "y"],
      ["1", "2"],
    ]);
  });
});

describe("listagem, edição e senha", () => {
  beforeAll(async () => {
    await rostering.importarPlanilha(
      ESCOLA,
      [
        "cpf,matricula,nome,usuario,papel,turma,serie",
        `${CPF_DA_ANA},2026001,Ana Lima,ana.lima,estudante,8A,8EF`,
        ",1099,Marta Nunes,marta.nunes,professor,8A,8EF",
      ].join("\n"),
      { senhaPadrao: "senha1234" },
    );
  });

  test("o gestor VÊ o CPF completo na lista, formatado", async () => {
    const pagina = await usuarios.listar(ESCOLA, { pagina: 1, porPagina: 25 });
    const ana = pagina.usuarios.find((u) => u.usuario === "ana.lima");
    // É o ponto da decisão: o gestor confere identidade contra o sistema da rede
    // e atende a família no balcão. Hash não serviria — é de mão única.
    expect(ana?.cpf).toBe(CPF_DA_ANA);
  });

  test("e acha a pessoa pelo CPF, com ou sem pontuação", async () => {
    const comPontos = await usuarios.listar(ESCOLA, { pagina: 1, porPagina: 25, busca: CPF_DA_ANA.slice(0, 7) });
    expect(comPontos.usuarios.map((u) => u.usuario)).toEqual(["ana.lima"]);
    const semPontos = await usuarios.listar(ESCOLA, { pagina: 1, porPagina: 25, busca: CPF_DA_ANA.replace(/\D/g, "") });
    expect(semPontos.usuarios.map((u) => u.usuario)).toEqual(["ana.lima"]);
  });

  test("corrigir o CPF é caminho de balcão; dígito errado é recusado antes do banco", async () => {
    const ana = await prisma.user.findUniqueOrThrow({
      where: { escolaId_username: { escolaId: ESCOLA, username: "ana.lima" } },
    });
    const corrigido = await usuarios.atualizar(ESCOLA, ana.id, { cpf: "22255588099" });
    expect(corrigido?.cpf).toBe("222.555.880-99");
    // Vazio APAGA: é o que se faz quando o número era de outra pessoa.
    expect((await usuarios.atualizar(ESCOLA, ana.id, { cpf: null }))?.cpf).toBeNull();
    await usuarios.atualizar(ESCOLA, ana.id, { cpf: CPF_DA_ANA.replace(/\D/g, "") });
  });

  test("listagem traz a turma da matrícula (e não some por causa da RLS)", async () => {
    const pagina = await usuarios.listar(ESCOLA, { pagina: 1, porPagina: 25 });
    const ana = pagina.usuarios.find((u) => u.usuario === "ana.lima");
    expect(ana?.turma).toBe("8A");
    expect(ana?.serie).toBe("8EF");
    expect(ana?.matricula).toBe("2026001");
    // Nasceu de importação: ainda não fez o primeiro acesso.
    expect(ana?.senhaProvisoria).toBe(true);
  });

  test("busca por nome, login ou matrícula da rede", async () => {
    const porMatricula = await usuarios.listar(ESCOLA, { pagina: 1, porPagina: 25, busca: "2026001" });
    expect(porMatricula.usuarios.map((u) => u.usuario)).toEqual(["ana.lima"]);
    const porNome = await usuarios.listar(ESCOLA, { pagina: 1, porPagina: 25, busca: "marta" });
    expect(porNome.usuarios.map((u) => u.usuario)).toEqual(["marta.nunes"]);
  });

  test("desativar não apaga a pessoa", async () => {
    const alvo = await prisma.user.findUniqueOrThrow({
      where: { escolaId_username: { escolaId: ESCOLA, username: "marta.nunes" } },
    });
    const atualizado = await usuarios.atualizar(ESCOLA, alvo.id, { ativo: false });
    expect(atualizado?.ativo).toBe(false);
    expect(await prisma.user.count({ where: { id: alvo.id } })).toBe(1);
    await usuarios.atualizar(ESCOLA, alvo.id, { ativo: true });
  });

  test("reset de senha devolve temporária que autentica via bcrypt e volta a exigir troca", async () => {
    const ana = await prisma.user.findUniqueOrThrow({
      where: { escolaId_username: { escolaId: ESCOLA, username: "ana.lima" } },
    });
    await prisma.user.update({ where: { id: ana.id }, data: { senhaProvisoria: false } });

    const resultado = await usuarios.resetarSenha(ESCOLA, ana.id);
    expect(resultado?.usuario).toBe("ana.lima");
    const depois = await prisma.user.findUniqueOrThrow({ where: { id: ana.id } });
    expect(await bcrypt.compare(resultado!.senhaTemporaria, depois.passwordHash)).toBe(true);
    expect(depois.senhaProvisoria).toBe(true);
  });

  test("reset de senha não alcança usuário de outra escola", async () => {
    const outsider = await prisma.user.findFirst({ where: { escolaId: "escola-demo" } });
    if (!outsider) return; // seed não rodou neste banco — nada a validar
    expect(await usuarios.resetarSenha(ESCOLA, outsider.id)).toBeNull();
  });
});

/**
 * A CONTAGEM DA ESCOLA BATE COM A LISTA DELA.
 *
 * O bug: a coluna "Professores" da tela de Escolas conta LOTAÇÕES naquela
 * escola, e a lista de pessoas filtrava `users.escola_id` — o CACHE da lotação
 * PRINCIPAL. O professor lotado em duas escolas era contado nas duas e listado
 * só na principal: a secundária mostrava "1 professor" e uma lista vazia, com
 * "Ninguém por aqui ainda — cadastre uma pessoa ou importe a planilha".
 *
 * O que este bloco protege é a IGUALDADE, não a query: qualquer refactor que
 * faça um lado perguntar uma coisa e o outro outra reabre o defeito, e o
 * sintoma é uma tela que se contradiz sem erro nenhum.
 */
describe("a contagem da escola bate com a lista", () => {
  const REG = "teste-us-reg";
  const A = "teste-us-a";
  const B = "teste-us-b";
  let dasDuas = "";

  beforeAll(async () => {
    await prisma.lotacao.deleteMany({ where: { escolaId: { in: [A, B] } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: "teste-us-" } } });
    await prisma.escola.deleteMany({ where: { id: { in: [A, B] } } });
    await prisma.escola.deleteMany({ where: { id: REG } });

    await prisma.escola.create({ data: { id: REG, nome: "DE Contagem", tipo: "regional" } });
    /* Tupla tipada, não `[string, string][]` inferido: com
       `noUncheckedIndexedAccess` a desestruturação de um array de arrays dá
       `string | undefined`, e o `create` recusa. */
    const unidades: Array<{ id: string; nome: string }> = [
      { id: A, nome: "EE Contagem A" },
      { id: B, nome: "EE Contagem B" },
    ];
    for (const { id, nome } of unidades) {
      await prisma.escola.create({ data: { id, nome, tipo: "escola", paiId: REG } });
    }

    /* O professor das DUAS escolas, com a PRINCIPAL em A — é exatamente a
       pessoa que produzia a divergência: contada em B, listada só em A. */
    const prof = await prisma.user.create({
      data: {
        escolaId: A,
        username: "teste-us-prof-das-duas",
        displayName: "Professora das Duas",
        role: "professor",
        passwordHash: "x",
      },
    });
    dasDuas = prof.id;
    const hoje = new Date();
    await prisma.lotacao.create({
      data: { escolaId: A, usuarioId: prof.id, papel: "professor", principal: true, inicio: hoje },
    });
    await prisma.lotacao.create({
      data: { escolaId: B, usuarioId: prof.id, papel: "professor", principal: false, inicio: hoje },
    });

    /* Uma coordenação SÓ em B: ela não pode aparecer na contagem de
       professores, e é o caso que o card pede para tratar explicitamente. */
    const gestora = await prisma.user.create({
      data: {
        escolaId: B,
        username: "teste-us-gestora-b",
        displayName: "Coordenadora de B",
        role: "gestor_escola",
        passwordHash: "x",
      },
    });
    await prisma.lotacao.create({
      data: {
        escolaId: B,
        usuarioId: gestora.id,
        papel: "gestor_escola",
        principal: true,
        inicio: hoje,
      },
    });
  });

  afterAll(async () => {
    await prisma.lotacao.deleteMany({ where: { escolaId: { in: [A, B] } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: "teste-us-" } } });
    await prisma.escola.deleteMany({ where: { id: { in: [A, B] } } });
    await prisma.escola.deleteMany({ where: { id: REG } });
  });

  const contarProfessores = async (escolaId: string) =>
    (await escolas.listar({ paiId: REG })).find((e) => e.id === escolaId)?.professores ?? -1;

  test("a escola SECUNDÁRIA conta e lista o mesmo professor — era 1 contra 0", async () => {
    const contagem = await contarProfessores(B);
    const lista = await usuarios.listar(B, { papel: "professor", pagina: 1, porPagina: 25 });
    expect(contagem).toBe(1);
    expect(lista.total).toBe(contagem);
    expect(lista.usuarios.map((u) => u.id)).toEqual([dasDuas]);
  });

  test("e a escola PRINCIPAL continua contando e listando ele também", async () => {
    const contagem = await contarProfessores(A);
    const lista = await usuarios.listar(A, { papel: "professor", pagina: 1, porPagina: 25 });
    expect(contagem).toBe(1);
    expect(lista.total).toBe(contagem);
    expect(lista.usuarios.map((u) => u.id)).toEqual([dasDuas]);
  });

  test("a linha diz a escola QUE ESTÁ SENDO LISTADA, não a principal da pessoa", async () => {
    /* Sem isto, a listagem de B mostraria "EE Contagem A" na coluna Escola —
       a escola errada, justamente na linha que o bug escondia. */
    const lista = await usuarios.listar(B, { papel: "professor", pagina: 1, porPagina: 25 });
    expect(lista.usuarios[0]?.escola).toBe("EE Contagem B");
  });

  test("coordenação NÃO entra na contagem nem na lista de professores", async () => {
    expect(await contarProfessores(B)).toBe(1);
    const professores = await usuarios.listar(B, { papel: "professor", pagina: 1, porPagina: 25 });
    expect(professores.usuarios.every((u) => u.papel === "professor")).toBe(true);
    const coordenacao = await usuarios.listar(B, {
      papel: "gestor_escola",
      pagina: 1,
      porPagina: 25,
    });
    expect(coordenacao.total).toBe(1);
  });

  test("escola SEM professor conta zero e lista vazio — os dois lados de acordo", async () => {
    const vazia = "teste-us-vazia";
    await prisma.escola.create({
      data: { id: vazia, nome: "EE Sem Professor", tipo: "escola", paiId: REG },
    });
    const contagem = (await escolas.listar({ paiId: REG })).find((e) => e.id === vazia)?.professores;
    const lista = await usuarios.listar(vazia, { papel: "professor", pagina: 1, porPagina: 25 });
    expect(contagem).toBe(0);
    expect(lista.total).toBe(0);
    await prisma.escola.delete({ where: { id: vazia } });
  });

  test("encerrar a lotação tira a pessoa dos DOIS lados juntos", async () => {
    await prisma.lotacao.updateMany({
      where: { escolaId: B, usuarioId: dasDuas, fim: null },
      data: { fim: new Date() },
    });
    expect(await contarProfessores(B)).toBe(0);
    const lista = await usuarios.listar(B, { papel: "professor", pagina: 1, porPagina: 25 });
    expect(lista.total).toBe(0);
    // e a principal segue intacta
    expect(await contarProfessores(A)).toBe(1);
  });
});
