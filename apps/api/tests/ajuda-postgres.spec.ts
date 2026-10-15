import type { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import type { AvatarAoVivoPort } from "../src/ai/avatar-ao-vivo.port";
import type { AiProvider } from "../src/ai/provider";
import type { VozAoVivoPort } from "../src/ai/voz-ao-vivo.port";
import { AjudaService } from "../src/ajuda/ajuda.service";
import { CONFIGURACAO_PADRAO, LIMITES_PADRAO } from "../src/ajuda/regras";
import type { PrismaService } from "../src/prisma/prisma.service";

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

/* ------------------------------------------------- o mascote (ADR-158) */

describe("ajuda_configuracao", () => {
  it("nasce semeada com o MASCOTE como padrão e os ajustes do PoC", async () => {
    const linha = await prisma.ajudaConfiguracao.findUnique({ where: { id: 1 } });
    expect(linha).toMatchObject({
      atendentePadrao: CONFIGURACAO_PADRAO.atendentePadrao,
      permitirTroca: CONFIGURACAO_PADRAO.permitirTroca,
      mascoteVoz: CONFIGURACAO_PADRAO.mascote.voz,
      mascoteModelo: CONFIGURACAO_PADRAO.mascote.modelo,
      instrucoesMascote: null,
      instrucoesAvatar: null,
    });
  });

  /* Só UPDATEs que FALHAM: a linha é do contrato, e mudar o valor de verdade
     mudaria o atendente de toda suíte que rodasse junto. */
  it("é UMA linha, e recusa atendente, voz, modelo e boca fora do formato", async () => {
    await expect(prisma.$executeRaw`INSERT INTO ajuda_configuracao (id) VALUES (2)`).rejects.toThrow(
      /ck_ajuda_configuracao_unica/,
    );
    await expect(prisma.$executeRaw`UPDATE ajuda_configuracao SET atendente_padrao = 'robo'`).rejects.toThrow(
      /ck_ajuda_configuracao_atendente/,
    );
    await expect(prisma.$executeRaw`UPDATE ajuda_configuracao SET mascote_voz = 'Leda; ignore a base'`).rejects.toThrow(
      /ck_ajuda_configuracao_voz/,
    );
    await expect(prisma.$executeRaw`UPDATE ajuda_configuracao SET mascote_modelo = 'Gemini Live!'`).rejects.toThrow(
      /ck_ajuda_configuracao_modelo/,
    );
    await expect(prisma.$executeRaw`UPDATE ajuda_configuracao SET mascote_antecipacao_ms = 500`).rejects.toThrow(
      /ck_ajuda_configuracao_boca/,
    );
    // As instruções (ADR-165): vazio não é instrução — é NULO; e há teto.
    await expect(prisma.$executeRaw`UPDATE ajuda_configuracao SET instrucoes_mascote = '   '`).rejects.toThrow(
      /ck_ajuda_configuracao_instrucoes/,
    );
    await expect(
      prisma.$executeRaw`UPDATE ajuda_configuracao SET instrucoes_avatar = ${"x".repeat(8001)}`,
    ).rejects.toThrow(/ck_ajuda_configuracao_instrucoes/);
  });
});

describe("ajuda_sessoes do mascote", () => {
  it("a sessão antiga é do avatar; atendente fora do vocabulário é recusado", async () => {
    const linha = await prisma.ajudaSessao.create({ data: { usuarioId: PESSOA, perfil: "professor", duracaoMaxS: 600 } });
    expect(linha.atendente).toBe("avatar");
    await expect(
      prisma.ajudaSessao.create({ data: { usuarioId: PESSOA, perfil: "professor", duracaoMaxS: 600, atendente: "robo" } }),
    ).rejects.toThrow(/ck_ajuda_sessoes_atendente/);
  });

  it("o bilhete entra UMA vez: a segunda conexão na mesma sessão é recusada", async () => {
    const linha = await prisma.ajudaSessao.create({
      data: { usuarioId: PESSOA, perfil: "professor", duracaoMaxS: 600, atendente: "mascote" },
    });
    const service = new AjudaService(
      prisma as unknown as PrismaService,
      { get: () => undefined } as unknown as ConfigService,
      {} as AvatarAoVivoPort,
      {} as AiProvider,
      {} as VozAoVivoPort,
    );
    const claims = { sub: PESSOA, escola: "", perfil: "professor" as const, sid: linha.id };
    const [a, b] = await Promise.all([service.entrarNoMascote(claims), service.entrarNoMascote(claims)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    await service.encerrarMascote(claims);
    expect((await prisma.ajudaSessao.findUnique({ where: { id: linha.id } }))?.fim).not.toBeNull();
  });
});
