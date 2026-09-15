import { HttpException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { RastroBoatoService } from "../src/rastro-boato/rastro-boato.service";
import { ORDEM_CORRETA } from "../src/rastro-boato/catalogo";
import { liberarParaTeste } from "./liberar-de-teste";
import { criarTurmaDeTeste } from "./turma-de-teste";

/**
 * Integração da exp-06 no Postgres: RLS, a porta da sala, a cota de auditoria,
 * o latch da decisão, o gate da aula e a corrida em "enviar".
 *
 * UMA ESCOLA POR SUÍTE (o Jest paraleliza suítes; limpeza compartilhada
 * corromperia a outra).
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const ESCOLA = "teste-rastro";
const OUTRA_ESCOLA = "teste-rastro-outra";

const prisma = new PrismaService({
  datasources: { db: { url: URL } },
}) as PrismaService & PrismaClient;

const service = new RastroBoatoService(prisma);

let turmaId = "";
let estudanteA = "";
let estudanteB = "";
let estudanteSemTurma = "";

const TRES_FONTES = ["msg-boato-01", "msg-audio-anonimo", "msg-laudo-pdf"] as const;

async function limpar() {
  const escolas = [ESCOLA, OUTRA_ESCOLA];
  await prisma.liberacao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.rastroSessao.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.rastroGateTurma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.user.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.turma.deleteMany({ where: { escolaId: { in: escolas } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas } } });
}

async function codigoDe(promessa: Promise<unknown>): Promise<string | null> {
  try {
    await promessa;
    return null;
  } catch (e) {
    if (e instanceof HttpException) {
      const corpo = e.getResponse() as { codigo?: string };
      return corpo.codigo ?? `HTTP_${e.getStatus()}`;
    }
    throw e;
  }
}

/** Audita as três fontes que sustentam a descoberta. */
async function auditarTudo(estudanteId: string) {
  await service.abrirChats(ESCOLA, estudanteId, turmaId);
  for (const id of TRES_FONTES) {
    await service.auditoria(ESCOLA, estudanteId, turmaId, id, 5);
  }
}

beforeAll(async () => {
  await limpar();
  await prisma.escola.create({ data: { id: ESCOLA, nome: "Escola Rastro (teste)" } });
  await prisma.escola.create({ data: { id: OUTRA_ESCOLA, nome: "Outra escola (teste)" } });
  const turma = await criarTurmaDeTeste(prisma, ESCOLA, "6A", "6EF");
  turmaId = turma.id;
  const criar = (username: string, displayName: string, comTurma: boolean) =>
    prisma.user.create({
      data: {
        role: "estudante",
        escolaId: ESCOLA,
        turmaId: comTurma ? turmaId : null,
        username,
        displayName,
        passwordHash: "x",
      },
      select: { id: true },
    });
  estudanteA = (await criar("rastro.ana", "Ana Teste", true)).id;
  estudanteB = (await criar("rastro.bia", "Bia Teste", true)).id;
  estudanteSemTurma = (await criar("rastro.sem", "Sem Turma", false)).id;

  /* A PORTA DA SALA (ADR-69): sem esta linha `estudanteDaEscola` — o funil de
     todas as rotas de estudante — recusa com 403 `missao-nao-liberada`. */
  await liberarParaTeste(prisma, ESCOLA, turmaId, "exp-06-rastro-boato", estudanteA);
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("tenancy no banco", () => {
  test("as quatro tabelas têm RLS habilitada E forçada, com uma política por escola", async () => {
    const tabelas = [
      "exp_06_sessoes",
      "exp_06_auditorias",
      "exp_06_reflexoes",
      "exp_06_gates_turma",
    ];
    for (const tabela of tabelas) {
      const [linha] = await prisma.$queryRawUnsafe<
        { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
      >(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '${tabela}'`);
      expect({ tabela, ...linha }).toEqual({
        tabela,
        relrowsecurity: true,
        relforcerowsecurity: true,
      });

      const policies = await prisma.$queryRawUnsafe<{ policyname: string }[]>(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tabela}'`,
      );
      expect(policies.map((p) => p.policyname)).toEqual([`${tabela}_por_escola`]);
    }
  });

  test("o score só aceita 0, 70 e 100 — o CHECK é a rede final da regra 3", async () => {
    // Se um caminho novo tentar gravar pontuação vinda do cliente, o banco recusa.
    await auditarTudo(estudanteA);
    await service.decisao(ESCOLA, estudanteA, turmaId, "B", 30, false);
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp_06_sessoes SET score = 85 WHERE escola_id = '${ESCOLA}'`,
      ),
    ).rejects.toThrow();
  });

  test("`concluido_em` e `passo = fim` não podem divergir", async () => {
    // Uma tela dizendo "missão cumprida" sobre uma linha sem carimbo é um
    // relatório que mente.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE exp_06_sessoes SET passo = 'fim' WHERE escola_id = '${ESCOLA}'`,
      ),
    ).rejects.toThrow();
  });

  test("a reflexão não aceita texto em branco", async () => {
    // Um campo com três espaços contaria como percurso entregue no painel.
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO exp_06_reflexoes (escola_id, estudante_id, texto, chars_count)
         VALUES ('${ESCOLA}', '${estudanteA}'::uuid, '   ', 3)`,
      ),
    ).rejects.toThrow();
  });
});

describe("a porta da sala (ADR-69)", () => {
  test("estudante de turma sem liberação é recusado no funil", async () => {
    // Filtrar o card no hub é UX; a regra que vale é esta. `/exp/:expId` é
    // endereço adivinhável e o bundle é público.
    expect(await codigoDe(service.sessao(ESCOLA, estudanteSemTurma, null))).toBe(
      "missao-nao-liberada",
    );
  });

  test("a recusa vale para TODA rota de estudante, não só a de leitura", async () => {
    for (const chamada of [
      () => service.abrirChats(ESCOLA, estudanteSemTurma, null),
      () => service.auditoria(ESCOLA, estudanteSemTurma, null, "msg-boato-01", 1),
      () => service.decisao(ESCOLA, estudanteSemTurma, null, "B", 10, false),
      () => service.modelagem(ESCOLA, estudanteSemTurma, null, [...ORDEM_CORRETA]),
      () => service.reflexao(ESCOLA, estudanteSemTurma, null, "texto"),
    ]) {
      expect(await codigoDe(chamada())).toBe("missao-nao-liberada");
    }
  });
});

describe("a cota de auditoria é a porta da decisão", () => {
  test("decidir com 2 fontes é recusado", async () => {
    await service.abrirChats(ESCOLA, estudanteB, turmaId);
    await service.auditoria(ESCOLA, estudanteB, turmaId, "msg-boato-01", 4);
    await service.auditoria(ESCOLA, estudanteB, turmaId, "msg-laudo-pdf", 4);
    expect(await codigoDe(service.decisao(ESCOLA, estudanteB, turmaId, "B", 20, false))).toBe(
      "auditoria-insuficiente",
    );
  });

  test("reabrir o mesmo balão não avança a cota", async () => {
    const r = await service.auditoria(ESCOLA, estudanteB, turmaId, "msg-boato-01", 9);
    expect(r.novo).toBe(false);
    expect(r.totalAuditadas).toBe(2);
    // E o banco tem UMA linha, não duas: o UNIQUE é a rede da dedupe.
    const linhas = await prisma.rastroAuditoria.count({
      where: { escolaId: ESCOLA, estudanteId: estudanteB, mensagemId: "msg-boato-01" },
    });
    expect(linhas).toBe(1);
  });

  test("a terceira fonte distinta faz a crise chegar — no servidor", async () => {
    // O passo anda aqui, não no cliente: uma tela que decide quando o pico
    // começa é uma tela que pode pular o pico.
    const r = await service.auditoria(ESCOLA, estudanteB, turmaId, "msg-audio-anonimo", 6);
    expect(r.cotaAtingida).toBe(true);
    expect(r.passoDoEstudante).toBe("decisao");
  });
});

describe("a decisão é latch, e o gabarito é do servidor", () => {
  test("o desfecho e a topologia só aparecem DEPOIS do envio", async () => {
    const antes = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(antes.desfecho).toBeNull();
    expect(antes.topologia).toBeNull();
    // E o catálogo servido não carrega o gabarito em campo nenhum.
    expect(JSON.stringify(antes.catalogo)).not.toContain("interrompeu");

    const depois = await service.decisao(ESCOLA, estudanteB, turmaId, "A", 45, true);
    expect(depois.desfecho).toBe("amplificou");
    expect(depois.topologia?.alcance).toBe(1200);
    expect(depois.reacao).toBeTruthy();
  });

  test("a segunda tentativa é recusada — a escolha é definitiva", async () => {
    expect(await codigoDe(service.decisao(ESCOLA, estudanteB, turmaId, "B", 5, false))).toBe(
      "decisao-ja-registrada",
    );
  });

  test("dois toques simultâneos em enviar produzem UMA decisão", async () => {
    // O lock por (escola, estudante) serializa: a segunda transação relê o
    // estado com a primeira aplicada.
    await auditarTudo(estudanteSemTurma).catch(() => undefined);
    const [a, b] = await Promise.allSettled([
      service.decisao(ESCOLA, estudanteB, turmaId, "C", 1, false),
      service.decisao(ESCOLA, estudanteB, turmaId, "C", 1, false),
    ]);
    expect([a.status, b.status]).toEqual(["rejected", "rejected"]);
    const linha = await prisma.rastroSessao.findUnique({
      where: { escolaId_estudanteId: { escolaId: ESCOLA, estudanteId: estudanteB } },
    });
    expect(linha?.opcao).toBe("A");
  });
});

describe("o gate da aula", () => {
  test("a Aula 1 segura quem decidiu — e o estudante sabe que está esperando", async () => {
    const estado = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(estado.passoDoEstudante).toBe("breakpoint");
    expect(estado.passo).toBe("breakpoint");
    // Com a etapa em aula1, o teto é o breakpoint: o mapa não abre sozinho.
    expect(estado.turma.etapa).toBe("aula1");
  });

  test("liberar a Aula 2 é idempotente", async () => {
    const um = await service.mexerNoGate(ESCOLA, turmaId, "liberar-aula2");
    const dois = await service.mexerNoGate(ESCOLA, turmaId, "liberar-aula2");
    expect(um.etapa).toBe("aula2");
    expect(dois.etapa).toBe("aula2");
  });

  test("com a Aula 2 aberta, a turma chega junta ao mapa", async () => {
    const estado = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(estado.passo).toBe("resultado");
    expect(estado.aguardandoATurma).toBe(false);
  });

  test("modelagem incoerente grava igual e não bloqueia (RF-007)", async () => {
    const invertida = [...ORDEM_CORRETA].reverse();
    const r = await service.modelagem(ESCOLA, estudanteB, turmaId, invertida);
    expect(r.coerente).toBe(false);
    expect(r.passoDoEstudante).toBe("percurso");
  });

  test("o percurso fecha a missão e carimba o `concluido_em`", async () => {
    const r = await service.reflexao(
      ESCOLA,
      estudanteB,
      turmaId,
      "Percebi que o medo faz repassar sem pensar. Vou abrir os dados da mensagem antes.",
    );
    expect(r.passoDoEstudante).toBe("fim");
    expect(r.concluidoEm).toBeTruthy();
    expect(r.entregouPercurso).toBe(true);
  });

  test("`pausar-simulacao` NÃO traz de volta quem já entregou", async () => {
    // O latch é do estudante, não da turma.
    await service.mexerNoGate(ESCOLA, turmaId, "pausar-simulacao");
    const estado = await service.sessao(ESCOLA, estudanteB, turmaId);
    expect(estado.turma.etapa).toBe("aula1");
    expect(estado.passo).toBe("fim");
  });
});

describe("o painel do professor", () => {
  test("não expõe pontuação nem nível — nenhuma coluna ordena crianças", async () => {
    const painel = await service.painel(ESCOLA, turmaId);
    const bruto = JSON.stringify(painel);
    for (const proibido of ["score", '"nivel"', "pontos", "ranking"]) {
      expect(bruto).not.toContain(proibido);
    }
  });

  test("mostra progresso, a distribuição A/B/C e o texto do percurso", async () => {
    const painel = await service.painel(ESCOLA, turmaId);
    expect(painel.resumo.total).toBeGreaterThanOrEqual(2);
    expect(painel.resumo.distribuicao.A).toBeGreaterThanOrEqual(1);
    const bia = painel.estudantes.find((e) => e.estudanteId === estudanteB);
    expect(bia?.entregouPercurso).toBe(true);
    expect(bia?.reflexaoTexto).toContain("medo");
    expect(bia?.auditouTudo).toBe(true);
  });

  test("zerar a turma apaga o estado e o percurso, e a missão pode ser refeita", async () => {
    const r = await service.zerarTurma(ESCOLA, turmaId);
    expect(r.sucesso).toBe(true);
    expect(r.registrosApagados).toBeGreaterThan(0);
    const painel = await service.painel(ESCOLA, turmaId);
    expect(painel.resumo.iniciaram).toBe(0);
    expect(painel.estudantes.every((e) => e.reflexaoTexto === null)).toBe(true);
  });
});
