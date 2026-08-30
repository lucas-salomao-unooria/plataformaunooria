/**
 * A ORDEM do histórico do aluno — que a tela imprime como está, e cuja primeira
 * linha o adulto lê como "a escola dela".
 *
 * Este arquivo existe por causa de uma falha de CI: `historicoDoAluno` ordenava
 * só por `inicio: desc`, e `inicio` é DATE. Numa transferência no MESMO DIA as
 * duas lotações empatam, e a ordem passava a ser a que o Postgres devolvesse —
 * verde na máquina do desenvolvedor por meses, vermelho no primeiro CI. O
 * sintoma na tela seria pior que um teste vermelho: a escola ANTERIOR aparecendo
 * como a primeira da lista.
 *
 * O teste mexe na ordem FÍSICA das linhas de propósito. Sem isso ele voltaria a
 * medir sorte, que é exatamente o defeito que ele protege.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { periodoDeTeste } from "./turma-de-teste";
import { servicosDeTeste } from "./servicos-de-teste";

const prisma = new PrismaService({
  datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria" } },
}) as PrismaService & PrismaClient;
const { escolas } = servicosDeTeste(prisma);

const A = "teste-ordem-a";
const B = "teste-ordem-b";
let alunoId = "";

async function limpar() {
  const alvo = { in: [A, B] };
  await prisma.matricula.deleteMany({ where: { escolaId: alvo } });
  await prisma.lotacao.deleteMany({ where: { escolaId: alvo } });
  await prisma.user.deleteMany({ where: { escolaId: alvo } });
  await prisma.escola.deleteMany({ where: { id: { in: [A, B] } } });
}

beforeAll(async () => {
  await limpar();
  const periodo = await periodoDeTeste(prisma);
  await prisma.escola.create({ data: { id: A, nome: "EE Ordem A", tipo: "escola" } });
  await prisma.escola.create({ data: { id: B, nome: "EE Ordem B", tipo: "escola" } });
  const aluno = await prisma.user.create({
    data: { escolaId: B, username: "ordem.aluno", displayName: "Ordem Teste",
            passwordHash: "x", role: "estudante", cpf: "70010020462" },
  });
  alunoId = aluno.id;
  // As DUAS com o mesmo `inicio` — é a transferência no mesmo dia, e `inicio` é DATE.
  await prisma.lotacao.create({
    data: { escolaId: A, usuarioId: aluno.id, papel: "estudante", inicio: periodo.inicio, fim: periodo.inicio },
  });
  await prisma.lotacao.create({
    data: { escolaId: B, usuarioId: aluno.id, papel: "estudante", principal: true, inicio: periodo.inicio },
  });
});

afterAll(async () => { await limpar(); await prisma.$disconnect(); });

test("a escola de HOJE vem primeiro, e isso não depende da ordem física das linhas", async () => {
  const antes = (await escolas.historicoDoAluno(alunoId))?.escolas.map((e) => e.id);

  // UPDATE reescreve a tupla no fim do heap: a lotação ATIVA passa a ser a
  // última fisicamente. Sem ORDER BY determinístico, a lista viraria aqui.
  await prisma.$executeRawUnsafe(
    `UPDATE lotacoes SET atualizado_em = now() WHERE usuario_id = $1::uuid AND fim IS NULL`,
    alunoId,
  );
  const depois = (await escolas.historicoDoAluno(alunoId))?.escolas.map((e) => e.id);

  console.log("antes:", antes, "| depois de mover a linha ativa no heap:", depois);
  expect(antes).toEqual([B, A]);
  expect(depois).toEqual([B, A]);
});
