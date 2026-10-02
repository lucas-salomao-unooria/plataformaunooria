import { PrismaClient } from "@prisma/client";
import { LIMITES_PADRAO } from "../src/ajuda/regras";

/**
 * A AJUDA COM AVATAR no Postgres de verdade (ADR-132): a semente dos limites e
 * as travas da migration — o que o Zod da rota também cobra, mas que precisa
 * valer para quem escrever na tabela por outro caminho.
 *
 * Só LÊ `ajuda_limites` (tabela de contrato, sem `escola_id`: escrever nela
 * mudaria o limite de toda suíte que rodasse junto). As linhas de
 * `ajuda_sessoes` que ela cria levam um `usuario_id` próprio e saem no fim.
 */

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5432/unooria";
const prisma = new PrismaClient({ datasources: { db: { url: URL } } });
const PESSOA = "00000000-0000-4000-8000-0000000a1da0";

afterAll(async () => {
  await prisma.ajudaSessao.deleteMany({ where: { usuarioId: PESSOA } }).catch(() => undefined);
  await prisma.$disconnect();
});

describe("ajuda_limites", () => {
  it("nasce semeada com os valores do código", async () => {
    const linhas = await prisma.ajudaLimite.findMany();
    const valores = Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
    expect(valores).toEqual(LIMITES_PADRAO);
  });

  it("recusa chave fora do vocabulário, zero e sessão acima de 60 minutos", async () => {
    await expect(prisma.$executeRaw`INSERT INTO ajuda_limites (chave, valor) VALUES ('minutos-por-semana', 10)`).rejects.toThrow(
      /ck_ajuda_limites_chave/,
    );
    await expect(prisma.$executeRaw`UPDATE ajuda_limites SET valor = 0 WHERE chave = 'minutos-por-dia'`).rejects.toThrow(
      /ck_ajuda_limites_valor/,
    );
    await expect(prisma.$executeRaw`UPDATE ajuda_limites SET valor = 61 WHERE chave = 'minutos-por-sessao'`).rejects.toThrow(
      /ck_ajuda_limites_valor/,
    );
  });
});

describe("ajuda_sessoes", () => {
  it("aceita papel de contrato SEM escola (a razão de não ter RLS)", async () => {
    const linha = await prisma.ajudaSessao.create({
      data: { usuarioId: PESSOA, escolaId: null, perfil: "gestor_contrato", duracaoMaxS: 600 },
    });
    expect(linha.escolaId).toBeNull();
  });

  it("recusa estudante — a segunda tranca depois do @Roles", async () => {
    await expect(
      prisma.ajudaSessao.create({ data: { usuarioId: PESSOA, perfil: "estudante", duracaoMaxS: 600 } }),
    ).rejects.toThrow(/ck_ajuda_sessoes_perfil/);
  });

  it("recusa teto fora de 30 s a 1 h e fim antes do início", async () => {
    await expect(
      prisma.ajudaSessao.create({ data: { usuarioId: PESSOA, perfil: "professor", duracaoMaxS: 7200 } }),
    ).rejects.toThrow(/ck_ajuda_sessoes_duracao/);
    const inicio = new Date();
    await expect(
      prisma.ajudaSessao.create({
        data: { usuarioId: PESSOA, perfil: "professor", duracaoMaxS: 600, inicio, fim: new Date(inicio.getTime() - 1000) },
      }),
    ).rejects.toThrow(/ck_ajuda_sessoes_fim/);
  });
});
