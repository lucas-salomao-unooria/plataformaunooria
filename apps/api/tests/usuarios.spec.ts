import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../src/prisma/prisma.service";
import { parseCsv } from "../src/usuarios/csv";
import { UsuariosService } from "../src/usuarios/usuarios.service";

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-escola-csv";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const service = new UsuariosService(prisma);

async function limpar() {
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola CSV (teste)" } });
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

describe("importação CSV de usuários", () => {
  const CSV_OK = [
    "nome,usuario,senha,papel,turma,serie",
    "Maria Silva,maria.silva,senha1234,professor,,",
    '"Souza, João",joao.souza,senha1234,aluno,8A,8EF',
    "Ana Lima,ana.lima,senha1234,aluno,8A,8EF",
    "Beto Gestor,beto.gestor,senha1234,gestor,,",
  ].join("\n");

  test("lote misto: válidas entram, inválidas voltam no relatório por linha", async () => {
    const csv = [
      "nome,usuario,senha,papel,turma,serie",
      "Maria Silva,maria.silva,senha1234,professor,,",
      "Sem Senha,sem.senha,,aluno,8A,8EF", // nova sem senha → erro na escrita
      "Curta,curta.senha,abc,aluno,8A,8EF", // senha < 8 → erro de validação
      "Aluno Sem Turma,sem.turma,senha1234,aluno,,", // aluno sem turma/serie
      "Diretor,diretor,senha1234,admin-contrato,,", // papel proibido via CSV
      "Ana Lima,ana.lima,senha1234,aluno,8A,8EF",
    ].join("\n");

    const r = await service.importarCsv(ESCOLA, csv);
    expect(r.criados).toBe(2); // maria + ana
    expect(r.atualizados).toBe(0);
    const campos = r.erros.map((e) => `${e.linha}:${e.campo}`).sort();
    expect(campos).toEqual(["3:senha", "4:senha", "5:serie", "5:turma", "6:papel"]);

    const turma = await prisma.turma.findUnique({
      where: { escolaId_nome: { escolaId: ESCOLA, nome: "8A" } },
    });
    expect(turma?.serie).toBe("8EF");
  });

  test("reimportar o mesmo CSV é idempotente (vira atualização, não duplica)", async () => {
    const primeira = await service.importarCsv(ESCOLA, CSV_OK);
    expect(primeira.erros).toEqual([]);
    const segunda = await service.importarCsv(ESCOLA, CSV_OK);
    expect(segunda.criados).toBe(0);
    expect(segunda.atualizados).toBe(4);
    const total = await prisma.user.count({ where: { escolaId: ESCOLA } });
    expect(total).toBe(4); // maria, joao, ana, beto — upsert não duplica ninguém
  });

  test("senha vazia em atualização mantém a senha atual", async () => {
    const antes = await prisma.user.findUnique({
      where: { escolaId_username: { escolaId: ESCOLA, username: "ana.lima" } },
    });
    const csv = ["nome,usuario,senha,papel,turma,serie", "Ana L. Lima,ana.lima,,aluno,8A,8EF"].join("\n");
    const r = await service.importarCsv(ESCOLA, csv);
    expect(r.atualizados).toBe(1);
    const depois = await prisma.user.findUnique({
      where: { escolaId_username: { escolaId: ESCOLA, username: "ana.lima" } },
    });
    expect(depois?.displayName).toBe("Ana L. Lima");
    expect(depois?.passwordHash).toBe(antes?.passwordHash);
  });

  test("usuario repetido dentro do arquivo é rejeitado com referência à linha", async () => {
    const csv = [
      "nome,usuario,senha,papel,turma,serie",
      "Um,repetido.x,senha1234,professor,,",
      "Dois,repetido.x,senha1234,professor,,",
    ].join("\n");
    const r = await service.importarCsv(ESCOLA, csv);
    expect(r.criados).toBe(1);
    expect(r.erros).toEqual([
      { linha: 3, campo: "usuario", mensagem: "usuario repetido no arquivo (linha 2)" },
    ]);
  });

  test("header errado não escreve nada", async () => {
    const r = await service.importarCsv(ESCOLA, "usuario,senha\na,b");
    expect(r.criados + r.atualizados).toBe(0);
    expect(r.erros[0]?.campo).toBe("header");
  });

  test("reset de senha devolve temporária que autentica via bcrypt", async () => {
    const ana = await prisma.user.findUnique({
      where: { escolaId_username: { escolaId: ESCOLA, username: "ana.lima" } },
    });
    const resultado = await service.resetarSenha(ESCOLA, ana!.id);
    expect(resultado?.usuario).toBe("ana.lima");
    const depois = await prisma.user.findUnique({ where: { id: ana!.id } });
    expect(await bcrypt.compare(resultado!.senhaTemporaria, depois!.passwordHash)).toBe(true);
  });

  test("reset de senha não alcança usuário de outra escola", async () => {
    const outsider = await prisma.user.findFirst({ where: { escolaId: "escola-demo" } });
    if (!outsider) return; // seed não rodou neste banco — nada a validar
    expect(await service.resetarSenha(ESCOLA, outsider.id)).toBeNull();
  });
});
