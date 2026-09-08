/**
 * Cadastro unitário de pessoa — o balcão que a ADR-59 abriu.
 *
 * O que esta suíte precisa provar não é "criou": é que delegar ao importador
 * não perdeu nada no caminho (lotação, matrícula, senha provisória, turma
 * nascida junto) e que a semântica de CRIAR foi respeitada — quem já existe
 * recebe 409 e NADA é escrito, em vez de ser atualizado em silêncio, que é o
 * que a importação faria, corretamente, se fosse chamada direto.
 *
 * As asserções de "nada foi escrito" contam linhas antes e depois de propósito:
 * um 409 lançado DEPOIS da escrita passaria em todo teste que só olha o status.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { HttpException } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarTurmaDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-escola-criar";
const OUTRA_ESCOLA = "teste-escola-criar-vizinha";

/**
 * CPFs só desta suíte. O índice único de CPF é da REDE, não da escola: número
 * repetido entre suítes colide em paralelo, e a mensagem do Postgres não diz
 * qual das duas o tomou primeiro.
 */
const CPF_NOVO = "153.509.460-56";
const CPF_DA_VIZINHA = "624.075.180-47";
const CPF_DO_ADMIN = "298.717.750-08";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { usuarios } = servicosDeTeste(prisma);

/**
 * Status e corpo de uma recusa, numa chamada só.
 *
 * Chamar duas vezes para ler as duas coisas seria pior do que verboso: a
 * primeira chamada pode ter escrito, e a segunda passaria a testar o estado que
 * a primeira deixou.
 */
async function recusa(
  promessa: Promise<unknown>,
): Promise<{ status: number; corpo: Record<string, unknown> }> {
  try {
    await promessa;
    throw new Error("esperava uma recusa, e a chamada foi aceita");
  } catch (erro) {
    if (erro instanceof HttpException) {
      return { status: erro.getStatus(), corpo: erro.getResponse() as Record<string, unknown> };
    }
    throw erro;
  }
}

const camposDe = (corpo: Record<string, unknown>) =>
  (corpo.erros as { campo: string }[] | undefined)?.map((e) => e.campo) ?? [];

const contarPessoas = () => prisma.user.count({ where: { escolaId: ESCOLA } });

async function limpar() {
  for (const escolaId of [ESCOLA, OUTRA_ESCOLA]) {
    await prisma.matricula.deleteMany({ where: { escolaId } });
    await prisma.lotacao.deleteMany({ where: { escolaId } });
    await prisma.user.deleteMany({ where: { escolaId } });
    await prisma.turma.deleteMany({ where: { escolaId } });
    await prisma.escola.deleteMany({ where: { id: escolaId } });
  }
  /* `gestor_contrato` não tem `escola_id`: o laço acima não o alcança, e deixá-lo
     para trás faria a segunda corrida colidir no login. */
  await prisma.user.deleteMany({
    where: { role: "gestor_contrato", username: { in: ["e2e.admin.teste", "outro.admin.teste"] } },
  });
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Cadastro (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Escola Vizinha (teste)" } });
  await criarTurmaDeTeste(prisma, ESCOLA, "7A", "7EF");
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("criar pessoa da escola", () => {
  it("estudante nasce com lotação, matrícula na turma e senha provisória", async () => {
    const criado = await usuarios.criarPessoa(ESCOLA, {
      papel: "estudante",
      nome: "Ana Paula Ribeiro",
      cpf: CPF_NOVO,
      matricula: "CRIAR-A1",
      turma: "7A",
      serie: "7EF",
    });

    expect(criado.usuario).toBe("ana.ribeiro");
    expect(criado.turma).toBe("7A");
    expect(criado.turmaCriada).toBe(false);
    expect(criado.senha).toHaveLength(10);

    const pessoa = await prisma.user.findUniqueOrThrow({ where: { id: criado.id } });
    expect(pessoa.role).toBe("estudante");
    expect(pessoa.escolaId).toBe(ESCOLA);
    expect(pessoa.cpf).toBe("15350946056");
    expect(pessoa.senhaProvisoria).toBe(true);
    // A senha devolvida é a que entra — se o hash não bater, a tela entrega um
    // papel com uma senha que não abre nada.
    expect(await bcrypt.compare(criado.senha, pessoa.passwordHash)).toBe(true);

    const matricula = await prisma.matricula.findFirst({
      where: { escolaId: ESCOLA, usuarioId: criado.id, fim: null },
    });
    expect(matricula?.papel).toBe("estudante");
    expect(matricula?.principal).toBe(true);
    // O cache da matrícula principal, que o login lê antes de haver escola.
    expect(pessoa.turmaId).toBe(matricula?.turmaId);

    const lotacao = await prisma.lotacao.findFirst({
      where: { escolaId: ESCOLA, usuarioId: criado.id, fim: null },
    });
    expect(lotacao?.papel).toBe("estudante");
  });

  it("turma que não existe nasce junto, e a resposta AVISA", async () => {
    const criado = await usuarios.criarPessoa(ESCOLA, {
      papel: "estudante",
      nome: "Bruno Souza Lima",
      matricula: "CRIAR-A2",
      turma: "7Z",
      serie: "7EF",
    });
    expect(criado.turmaCriada).toBe(true);
    expect(await prisma.turma.findFirst({ where: { escolaId: ESCOLA, nome: "7Z" } })).not.toBeNull();
  });

  it("professor é matriculado na turma, mas não ganha o cache de turma principal", async () => {
    const criado = await usuarios.criarPessoa(ESCOLA, {
      papel: "professor",
      nome: "Marta Nunes Alves",
      matricula: "CRIAR-P1",
      turma: "7A",
      serie: "7EF",
    });
    const pessoa = await prisma.user.findUniqueOrThrow({ where: { id: criado.id } });
    expect(pessoa.role).toBe("professor");
    expect(pessoa.turmaId).toBeNull();
    const matricula = await prisma.matricula.findFirst({
      where: { escolaId: ESCOLA, usuarioId: criado.id, papel: "professor", fim: null },
    });
    expect(matricula).not.toBeNull();
  });

  it("gestor com turma: aceita, avisa e NÃO matricula — gestor é papel da escola", async () => {
    const criado = await usuarios.criarPessoa(ESCOLA, {
      papel: "gestor_escola",
      nome: "Carlos Eduardo Dias",
      matricula: "CRIAR-G1",
      turma: "7A",
      serie: "7EF",
    });
    expect(criado.avisos.map((a) => a.campo)).toContain("turma");
    const matriculas = await prisma.matricula.count({
      where: { escolaId: ESCOLA, usuarioId: criado.id },
    });
    expect(matriculas).toBe(0);
    const lotacao = await prisma.lotacao.findFirst({
      where: { escolaId: ESCOLA, usuarioId: criado.id, fim: null },
    });
    expect(lotacao?.papel).toBe("gestor_escola");
  });

  it("senha escolhida na tela é a que vale", async () => {
    const criado = await usuarios.criarPessoa(ESCOLA, {
      papel: "professor",
      nome: "Helena Prado Martins",
      matricula: "CRIAR-P2",
      senha: "SenhaDoBalcao1",
    });
    expect(criado.senha).toBe("SenhaDoBalcao1");
    const pessoa = await prisma.user.findUniqueOrThrow({ where: { id: criado.id } });
    expect(await bcrypt.compare("SenhaDoBalcao1", pessoa.passwordHash)).toBe(true);
  });

  it("login escolhido é respeitado; em branco, é gerado do nome", async () => {
    const comLogin = await usuarios.criarPessoa(ESCOLA, {
      papel: "professor",
      nome: "Rafael Moreira Pinto",
      matricula: "CRIAR-P3",
      usuario: "rafa.pinto",
    });
    expect(comLogin.usuario).toBe("rafa.pinto");
  });
});

describe("o que o formulário precisa recusar", () => {
  it("CPF com dígito trocado é 400 NO CAMPO, e nada é escrito", async () => {
    const antes = await contarPessoas();
    const { status, corpo } = await recusa(
      usuarios.criarPessoa(ESCOLA, { papel: "gestor_escola", nome: "Dígito Errado", cpf: "111.111.111-11" }),
    );
    expect(status).toBe(400);
    expect(camposDe(corpo)).toContain("cpf");
    expect(await contarPessoas()).toBe(antes);
  });

  it("estudante sem turma é 400 — enturmar depois é o estudante que some da tela do professor", async () => {
    const antes = await contarPessoas();
    const { status, corpo } = await recusa(
      usuarios.criarPessoa(ESCOLA, { papel: "estudante", nome: "Sem Turma Silva" }),
    );
    expect(status).toBe(400);
    expect(camposDe(corpo)).toContain("turma");
    expect(await contarPessoas()).toBe(antes);
  });

  it("CPF que já existe NESTA escola é 409, com o id para abrir a edição", async () => {
    const antes = await contarPessoas();
    const { status, corpo } = await recusa(
      usuarios.criarPessoa(ESCOLA, {
        papel: "professor",
        nome: "Ana Paula Ribeiro (de novo)",
        cpf: CPF_NOVO,
        matricula: "CRIAR-DUPLA",
      }),
    );
    expect(status).toBe(409);
    expect(corpo.codigo).toBe("CPF_JA_EXISTE");
    expect(corpo.usuarioId).toBeDefined();
    expect(await contarPessoas()).toBe(antes);
  });

  it("CPF de OUTRA escola é 409 sem id, sem nome e sem dizer qual escola", async () => {
    await usuarios.criarPessoa(OUTRA_ESCOLA, {
      papel: "professor",
      nome: "Vizinha Almeida Costa",
      cpf: CPF_DA_VIZINHA,
      matricula: "CRIAR-VZ1",
    });

    const { corpo } = await recusa(
      usuarios.criarPessoa(ESCOLA, {
        papel: "professor",
        nome: "Vizinha Almeida Costa",
        cpf: CPF_DA_VIZINHA,
        matricula: "CRIAR-VZ2",
      }),
    );
    expect(corpo.codigo).toBe("CPF_EM_OUTRA_ESCOLA");
    // Dado de outro tenant: nem o id, nem o nome, nem a escola atravessam.
    expect(corpo.usuarioId).toBeUndefined();
    expect(JSON.stringify(corpo)).not.toContain(OUTRA_ESCOLA);
    // E o CPF não é ecoado de volta na mensagem (contenção, ADR-33).
    expect(JSON.stringify(corpo)).not.toContain("62407518047");
  });

  it("matrícula repetida na escola é 409, e nada é escrito", async () => {
    const antes = await contarPessoas();
    const { corpo } = await recusa(
      usuarios.criarPessoa(ESCOLA, { papel: "professor", nome: "Outro Alguém", matricula: "CRIAR-P1" }),
    );
    expect(corpo.codigo).toBe("MATRICULA_JA_EXISTE");
    expect(await contarPessoas()).toBe(antes);
  });

  it("login repetido na escola é 409", async () => {
    const { corpo } = await recusa(
      usuarios.criarPessoa(ESCOLA, {
        papel: "professor",
        nome: "Colisão de Login",
        matricula: "CRIAR-P9",
        usuario: "rafa.pinto",
      }),
    );
    expect(corpo.codigo).toBe("LOGIN_JA_EXISTE");
  });

  it("a mesma matrícula em OUTRA escola não conflita — o escopo é a unidade", async () => {
    const criado = await usuarios.criarPessoa(OUTRA_ESCOLA, {
      papel: "professor",
      nome: "Mesma Matrícula Outra Escola",
      matricula: "CRIAR-P1",
    });
    expect(criado.id).toBeDefined();
  });
});

describe("criar admin do contrato", () => {
  it("nasce sem escola e sem lotação — não é pessoa de unidade nenhuma", async () => {
    const criado = await usuarios.criarSemEscola({
      papel: "gestor_contrato",
      nome: "Helena Teixeira Barros",
      cpf: CPF_DO_ADMIN,
      usuario: "e2e.admin.teste",
    });
    expect(criado.papel).toBe("gestor_contrato");

    const pessoa = await prisma.user.findUniqueOrThrow({ where: { id: criado.id } });
    expect(pessoa.escolaId).toBeNull();
    expect(pessoa.turmaId).toBeNull();
    expect(pessoa.senhaProvisoria).toBe(true);
    expect(await bcrypt.compare(criado.senha, pessoa.passwordHash)).toBe(true);
    expect(await prisma.lotacao.count({ where: { usuarioId: criado.id } })).toBe(0);
  });

  it("login que já pertence a alguém de uma escola é 409 — o login procura na REDE", async () => {
    const { corpo } = await recusa(
      usuarios.criarSemEscola({ papel: "gestor_contrato", nome: "Colide Com Professor", usuario: "rafa.pinto" }),
    );
    expect(corpo.codigo).toBe("LOGIN_JA_EXISTE");
  });

  it("CPF que já existe na rede é 409", async () => {
    const { corpo } = await recusa(
      usuarios.criarSemEscola({ papel: "gestor_contrato", nome: "Mesmo CPF", cpf: CPF_NOVO, usuario: "outro.admin.teste" }),
    );
    expect(corpo.codigo).toBe("CPF_JA_EXISTE");
  });
});
