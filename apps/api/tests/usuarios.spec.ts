import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../src/prisma/prisma.service";
import { parseCsv } from "../src/usuarios/csv";
import { UsuariosService } from "../src/usuarios/usuarios.service";
import { criarTurmaDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-escola-usuarios";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const usuarios = new UsuariosService(prisma);
const { rostering } = servicosDeTeste(prisma);

async function limpar() {
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
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
        "matricula,nome,usuario,papel,turma,serie",
        "2026001,Ana Lima,ana.lima,aluno,8A,8EF",
        "1099,Marta Nunes,marta.nunes,professor,8A,8EF",
      ].join("\n"),
      { senhaPadrao: "senha1234" },
    );
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
