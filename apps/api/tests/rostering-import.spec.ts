import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaService } from "../src/prisma/prisma.service";
import { periodoDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-escola-rostering";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { rostering } = servicosDeTeste(prisma);

const csv = (...linhas: string[]) => linhas.join("\n");

async function limpar() {
  await prisma.matricula.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.user.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.turma.deleteMany({ where: { escolaId: ESCOLA } });
  await prisma.escola.deleteMany({ where: { id: ESCOLA } });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Rostering (teste)" } });
  await periodoDeTeste(prisma);
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("importação da planilha de pessoas", () => {
  test("lote misto: as válidas entram, as inválidas voltam por linha", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA,
      csv(
        "matricula,nome,usuario,papel,turma,serie,turno",
        "2026001,Ana Lima,ana.lima,aluno,8A,8EF,manha",
        "2026002,Bruno Reis,,aluno,8A,8EF,manha",
        "1099,Marta Nunes,marta.nunes,professor,8A,,",
        "2026003,Sem Turma,,aluno,,,", // aluno sem turma/série
        "9999,Papel Estranho,,responsavel,,,", // papel fora do vocabulário
      ),
      { senhaPadrao: "senha1234" },
    );

    expect(r.criados).toBe(3);
    expect(r.erros.map((e) => `${e.linha}:${e.campo}`).sort()).toEqual([
      "5:serie",
      "5:turma",
      "6:papel",
    ]);
    expect(r.turmasCriadas).toEqual(["8A"]);
    expect(r.matriculados).toBe(3); // 2 alunos + 1 professor
  });

  test("o login pode ser gerado, e volta no relatório para o gestor entregar", async () => {
    const bruno = await prisma.user.findFirst({ where: { escolaId: ESCOLA, matriculaExterna: "2026002" } });
    expect(bruno?.username).toBe("bruno.reis");
    expect(bruno?.senhaProvisoria).toBe(true);
  });

  test("o professor é matriculado na turma — o vínculo que não existia", async () => {
    const marta = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, username: "marta.nunes" },
    });
    const matricula = await prisma.matricula.findFirst({
      where: { escolaId: ESCOLA, usuarioId: marta.id, papel: "professor", fim: null },
      include: { turma: true },
    });
    expect(matricula?.turma.nome).toBe("8A");
    // Professor não recebe turma no cache: o cache é da matrícula PRINCIPAL do aluno.
    expect(marta.turmaId).toBeNull();
  });

  test("reimportar com o login corrigido continua sendo a MESMA pessoa (chave = matrícula)", async () => {
    const antes = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, matriculaExterna: "2026001" },
    });

    const r = await rostering.importarPlanilha(
      ESCOLA,
      csv(
        "matricula,nome,usuario,papel,turma,serie",
        "2026001,Ana Lima da Silva,ana.silva,aluno,8A,8EF",
      ),
      { senhaPadrao: "senha1234" },
    );

    expect(r.criados).toBe(0);
    expect(r.atualizados).toBe(1);
    const depois = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, matriculaExterna: "2026001" },
    });
    expect(depois.id).toBe(antes.id); // não nasceu um segundo aluno
    expect(depois.username).toBe("ana.silva");
    expect(depois.displayName).toBe("Ana Lima da Silva");
    // Reimportar NÃO reseta a senha de quem já entrou.
    expect(depois.passwordHash).toBe(antes.passwordHash);
  });

  test("mudar o aluno de turma ENCERRA a matrícula anterior em vez de apagá-la", async () => {
    await rostering.importarPlanilha(
      ESCOLA,
      csv("matricula,nome,papel,turma,serie", "2026001,Ana Lima da Silva,aluno,8B,8EF"),
      { senhaPadrao: "senha1234" },
    );

    const ana = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, matriculaExterna: "2026001" },
      include: { turma: true },
    });
    const matriculas = await prisma.matricula.findMany({
      where: { escolaId: ESCOLA, usuarioId: ana.id, papel: "aluno" },
      include: { turma: true },
      orderBy: { turma: { nome: "asc" } },
    });

    expect(matriculas).toHaveLength(2);
    expect(matriculas.find((m) => m.turma.nome === "8A")?.fim).not.toBeNull();
    expect(matriculas.find((m) => m.turma.nome === "8B")?.fim).toBeNull();
    expect(ana.turma?.nome).toBe("8B"); // o cache acompanhou
  });

  test("login pedido no arquivo que já é de outra pessoa é erro, não sobrescrita", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA,
      csv("matricula,nome,usuario,papel", "7777,Outra Pessoa,marta.nunes,professor"),
      { senhaPadrao: "senha1234" },
    );
    expect(r.criados).toBe(0);
    expect(r.erros[0]).toMatchObject({ campo: "usuario" });
  });

  test("sem senha do lote e sem coluna senha, ninguém nasce sem credencial", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA,
      csv("matricula,nome,papel", "8888,Zeca Novo,professor"),
    );
    expect(r.criados).toBe(0);
    expect(r.erros[0]).toMatchObject({ campo: "senha" });
  });

  test("uma senha por pessoa: cada credencial devolvida autentica de fato", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA,
      csv("matricula,nome,papel,turma,serie", "2026010,Caio Prado,aluno,8B,8EF"),
      { gerarSenhas: true },
    );
    expect(r.credenciais).toHaveLength(1);
    const credencial = r.credenciais[0]!;
    const caio = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, username: credencial.usuario },
    });
    expect(await bcrypt.compare(credencial.senha, caio.passwordHash)).toBe(true);
  });

  test("coordenação entra como gestor e SEM matrícula de turma", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA,
      csv("matricula,nome,papel,turma,serie", "1001,Carlos Dias,coordenacao,8A,8EF"),
      { senhaPadrao: "senha1234" },
    );
    expect(r.criados).toBe(1);
    expect(r.avisos[0]).toMatchObject({ campo: "turma" });

    const carlos = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, matriculaExterna: "1001" },
    });
    expect(carlos.role).toBe("gestor");
    expect(await prisma.matricula.count({ where: { usuarioId: carlos.id } })).toBe(0);
  });

  test("o formato antigo continua importando, com a senha da própria linha", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA,
      csv("nome,usuario,senha,papel,turma,serie", "Rita Antiga,rita.antiga,senha1234,aluno,8A,8EF"),
    );
    expect(r.criados).toBe(1);
    const rita = await prisma.user.findFirstOrThrow({
      where: { escolaId: ESCOLA, username: "rita.antiga" },
    });
    expect(await bcrypt.compare("senha1234", rita.passwordHash)).toBe(true);
  });
});
