import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { cpfEhValido, digitosDoCpf, formatarCpf } from "../src/comum/cpf";
import { periodoDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

/**
 * A REDE: uma pessoa, várias escolas — e o CPF como identidade imutável.
 *
 * As duas regras que este arquivo protege são assimétricas de propósito:
 * professor ACUMULA escolas, estudante é TRANSFERIDO. E as duas dependem de o CPF
 * ser reconhecido na rede inteira, não na escola.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA_A = "teste-rede-escola-a";
const ESCOLA_B = "teste-rede-escola-b";

const prisma = new PrismaService({ datasources: { db: { url: URL } } }) as PrismaService &
  PrismaClient;
const { rostering, escolas } = servicosDeTeste(prisma);

/**
 * CPFs válidos (dígitos verificadores conferem) usados SÓ aqui. O índice único é
 * da REDE inteira, não da escola: número repetido em outra suíte colide em
 * paralelo, com uma mensagem que não fala da suíte vizinha.
 */
const CPF_ESTUDANTE = "529.982.247-25";
const CPF_PROFESSORA = "045.833.259-32";

const csv = (...linhas: string[]) => linhas.join("\n");

async function limpar() {
  const escolasDoTeste = { in: [ESCOLA_A, ESCOLA_B] };
  await prisma.matricula.deleteMany({ where: { escolaId: escolasDoTeste } });
  await prisma.lotacao.deleteMany({ where: { escolaId: escolasDoTeste } });
  await prisma.user.deleteMany({ where: { escolaId: escolasDoTeste } });
  await prisma.turma.deleteMany({ where: { escolaId: escolasDoTeste } });
  await prisma.escola.deleteMany({ where: { id: escolasDoTeste } });
}

beforeAll(async () => {
  await limpar();
  await periodoDeTeste(prisma);
  await prisma.escola.create({
    data: { id: ESCOLA_A, nome: "EE Rede A", municipio: "São Paulo", uf: "SP", codigoInep: "35000001" },
  });
  await prisma.escola.create({
    data: { id: ESCOLA_B, nome: "EE Rede B", municipio: "Campinas", uf: "SP", codigoInep: "35000002" },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("CPF", () => {
  test("recusa dígito verificador errado — é isso que impede identidade fantasma", () => {
    expect(cpfEhValido(CPF_ESTUDANTE)).toBe(true);
    expect(cpfEhValido("529.982.247-26")).toBe(false);
    expect(cpfEhValido("111.111.111-11")).toBe(false); // passa no módulo 11 e não é CPF
    expect(cpfEhValido("123")).toBe(false);
  });

  test("guarda só os dígitos: a pontuação é da tela", () => {
    expect(digitosDoCpf(CPF_ESTUDANTE)).toBe("52998224725");
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });

  test("o banco guarda os 11 dígitos, sem pontuação", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA_A,
      csv(
        "cpf,matricula,nome,papel,turma,serie",
        `${CPF_ESTUDANTE},RA-A1,Helena Braga,estudante,6A,6EF`,
      ),
      { senhaPadrao: "SenhaDoLote1" },
    );
    expect(r.criados).toBe(1);

    const helena = await prisma.user.findFirstOrThrow({ where: { escolaId: ESCOLA_A, matriculaExterna: "RA-A1" } });
    expect(helena.cpf).toBe("52998224725");
    // A pontuação NÃO entra: "529.982.247-25" e "52998224725" coexistindo seriam
    // duas pessoas com o mesmo CPF, e o índice único não pegaria.
    expect(helena.cpf).not.toContain(".");
  });

  test("CPF inválido é erro de linha, e a linha não entra", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA_A,
      csv("cpf,nome,papel,turma,serie", "111.222.333-44,Ninguém,estudante,6A,6EF"),
      { senhaPadrao: "SenhaDoLote1" },
    );
    expect(r.criados).toBe(0);
    expect(r.erros[0]).toMatchObject({ campo: "cpf" });
  });

  test("o mesmo CPF duas vezes no arquivo é rejeitado com a linha de referência", async () => {
    const r = await rostering.importarPlanilha(
      ESCOLA_A,
      csv(
        "cpf,nome,papel,turma,serie",
        `${CPF_ESTUDANTE},Helena Braga,estudante,6A,6EF`,
        `${CPF_ESTUDANTE},Helena B. Outra,estudante,6A,6EF`,
      ),
      { senhaPadrao: "SenhaDoLote1" },
    );
    expect(r.erros.some((e) => e.campo === "cpf" && /repetido/.test(e.mensagem))).toBe(true);
  });
});

describe("professor ACUMULA escolas", () => {
  test("importado na escola A e depois na B, fica com as duas", async () => {
    const naA = await rostering.importarPlanilha(
      ESCOLA_A,
      csv("cpf,matricula,nome,usuario,papel,turma,serie", `${CPF_PROFESSORA},RA-P1,Marta Nunes,marta.rede,professor,6A,6EF`),
      { senhaPadrao: "SenhaDoLote1" },
    );
    expect(naA.criados).toBe(1);

    const naB = await rostering.importarPlanilha(
      ESCOLA_B,
      csv("cpf,matricula,nome,papel,turma,serie", `${CPF_PROFESSORA},RA-P1,Marta Nunes,professor,7B,7EF`),
      { senhaPadrao: "SenhaDoLote1" },
    );
    // Não nasceu ninguém: o CPF a reconheceu, e ela ganhou lotação a mais.
    expect(naB.criados).toBe(0);
    expect(naB.lotacoesNovas).toBe(1);
    expect(naB.transferidos).toBe(0);

    const marta = await prisma.user.findFirstOrThrow({ where: { cpf: digitosDoCpf(CPF_PROFESSORA) } });
    const escolasDela = await escolas.escolasDaPessoa(marta.id);
    expect(escolasDela.map((e) => e.id).sort()).toEqual([ESCOLA_A, ESCOLA_B]);
  });

  test("e continua com turma nas duas escolas", async () => {
    const marta = await prisma.user.findFirstOrThrow({ where: { cpf: digitosDoCpf(CPF_PROFESSORA) } });
    const naA = await rostering.turmasDoProfessor(ESCOLA_A, marta.id);
    const naB = await rostering.turmasDoProfessor(ESCOLA_B, marta.id);
    expect(naA.map((t) => t.nome)).toEqual(["6A"]);
    expect(naB.map((t) => t.nome)).toEqual(["7B"]);
  });

  test("só existe UMA pessoa na rede com aquele CPF", async () => {
    const quantas = await prisma.user.count({
      where: { cpf: digitosDoCpf(CPF_PROFESSORA) },
    });
    expect(quantas).toBe(1);
  });
});

describe("estudante é TRANSFERIDO, não duplicado", () => {
  test("importar na escola B o CPF que está na A transfere, sem criar ninguém", async () => {
    const antes = await prisma.user.findFirstOrThrow({ where: { cpf: digitosDoCpf(CPF_ESTUDANTE) } });
    expect(antes.escolaId).toBe(ESCOLA_A);

    const r = await rostering.importarPlanilha(
      ESCOLA_B,
      csv("cpf,matricula,nome,papel,turma,serie", `${CPF_ESTUDANTE},RA-A1,Helena Braga,estudante,7B,7EF`),
      { senhaPadrao: "SenhaDoLote1" },
    );
    expect(r.criados).toBe(0);
    expect(r.transferidos).toBe(1);

    const depois = await prisma.user.findUniqueOrThrow({ where: { id: antes.id } });
    expect(depois.id).toBe(antes.id); // a MESMA pessoa
    expect(depois.escolaId).toBe(ESCOLA_B);
    // A senha não foi trocada: transferência não é conta nova.
    expect(depois.passwordHash).toBe(antes.passwordHash);
  });

  test("uma lotação ativa só, e a anterior fica registrada com data de saída", async () => {
    const helena = await prisma.user.findFirstOrThrow({ where: { cpf: digitosDoCpf(CPF_ESTUDANTE) } });
    const lotacoes = await prisma.lotacao.findMany({
      where: { usuarioId: helena.id, papel: "estudante" },
      orderBy: { escolaId: "asc" },
    });
    expect(lotacoes).toHaveLength(2);
    expect(lotacoes.find((l) => l.escolaId === ESCOLA_A)?.fim).not.toBeNull();
    expect(lotacoes.find((l) => l.escolaId === ESCOLA_B)?.fim).toBeNull();
  });

  test("a matrícula na turma da escola de origem foi ENCERRADA", async () => {
    const helena = await prisma.user.findFirstOrThrow({ where: { cpf: digitosDoCpf(CPF_ESTUDANTE) } });
    const naOrigem = await prisma.matricula.findMany({
      where: { usuarioId: helena.id, escolaId: ESCOLA_A },
    });
    expect(naOrigem.length).toBeGreaterThan(0);
    expect(naOrigem.every((m) => m.fim !== null)).toBe(true);

    const noDestino = await prisma.matricula.findMany({
      where: { usuarioId: helena.id, escolaId: ESCOLA_B, fim: null },
      include: { turma: { select: { nome: true } } },
    });
    expect(noDestino.map((m) => m.turma.nome)).toEqual(["7B"]);
  });

  test("o professor da escola de ORIGEM deixa de ver a estudante", async () => {
    const turma6A = await prisma.turma.findFirstOrThrow({ where: { escolaId: ESCOLA_A, nome: "6A" } });
    const pessoas = await rostering.pessoasDaTurma(ESCOLA_A, turma6A.id);
    expect(pessoas?.estudantes.map((a) => a.nome)).not.toContain("Helena Braga");
  });

  test("o histórico ATRAVESSA as escolas — é a identidade que segue o estudante", async () => {
    const helena = await prisma.user.findFirstOrThrow({ where: { cpf: digitosDoCpf(CPF_ESTUDANTE) } });
    const historico = await escolas.historicoDoEstudante(helena.id);

    /* A ORDEM importa: a tela imprime esta lista como está, e a primeira linha é
       a que o adulto lê como "a escola dela". Aqui as duas lotações têm o MESMO
       `inicio` (a transferência é no mesmo dia, e `inicio` é DATE) — ordenar só
       por `inicio` deixava isso na mão do Postgres, passava na máquina e caía no
       CI. Quem garante a ordem é `fim` nulo primeiro. */
    expect(historico?.escolas.map((e) => e.id)).toEqual([ESCOLA_B, ESCOLA_A]);
    const entradas = historico?.escolas.map((e) => new Date(e.entrada).toISOString().slice(0, 10));
    expect(new Set(entradas).size).toBe(1); // empate real: é o que o teste protege
    expect(historico?.escolas.find((e) => e.id === ESCOLA_B)?.atual).toBe(true);
    expect(historico?.escolas.find((e) => e.id === ESCOLA_A)?.saida).not.toBeNull();
    // As turmas das duas escolas aparecem, com a escola ao lado.
    expect(historico?.turmas.map((t) => `${t.escola}/${t.turma}`).sort()).toEqual([
      "EE Rede A/6A",
      "EE Rede B/7B",
    ]);
    // O gestor VÊ o CPF, formatado como em qualquer documento: é como ele confere
    // que é a criança certa.
    expect(historico?.estudante.cpf).toBe(CPF_ESTUDANTE);
  });

  test("transferir para a escola onde já está é no-op, não uma segunda entrada", async () => {
    const helena = await prisma.user.findFirstOrThrow({ where: { cpf: digitosDoCpf(CPF_ESTUDANTE) } });
    const feito = await escolas.transferirEstudante({ estudanteId: helena.id, escolaDestinoId: ESCOLA_B });
    expect(feito).toMatchObject({ jaEstava: true });
    const ativas = await prisma.lotacao.count({
      where: { usuarioId: helena.id, papel: "estudante", fim: null },
    });
    expect(ativas).toBe(1);
  });
});

describe("escolas da rede", () => {
  test("a listagem conta gente e turma por escola", async () => {
    const lista = await escolas.listar("EE Rede");
    const a = lista.find((e) => e.id === ESCOLA_A);
    const b = lista.find((e) => e.id === ESCOLA_B);
    expect(a?.municipio).toBe("São Paulo");
    expect(a?.codigoInep).toBe("35000001");
    expect(a?.professores).toBe(1); // a Marta continua lotada na A
    expect(a?.estudantes).toBe(0); // a Helena saiu
    expect(b?.estudantes).toBe(1);
    expect(b?.professores).toBe(1);
  });

  test("encerrar a lotação do professor numa escola não mexe na outra", async () => {
    const marta = await prisma.user.findFirstOrThrow({ where: { cpf: digitosDoCpf(CPF_PROFESSORA) } });
    const naA = await prisma.lotacao.findFirstOrThrow({
      where: { usuarioId: marta.id, escolaId: ESCOLA_A, fim: null },
    });
    await escolas.encerrarLotacao(naA.id);

    const restantes = await escolas.escolasDaPessoa(marta.id);
    expect(restantes.map((e) => e.id)).toEqual([ESCOLA_B]);
    // E ela deixou de ver a turma da escola A.
    expect(await rostering.turmasDoProfessor(ESCOLA_A, marta.id)).toEqual([]);
    expect((await rostering.turmasDoProfessor(ESCOLA_B, marta.id)).map((t) => t.nome)).toEqual(["7B"]);
    // O cache `users.escola_id` seguiu para a escola que sobrou.
    const depois = await prisma.user.findUniqueOrThrow({ where: { id: marta.id } });
    expect(depois.escolaId).toBe(ESCOLA_B);
  });
});
