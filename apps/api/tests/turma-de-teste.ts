import type { PrismaClient } from "@prisma/client";

/**
 * Turma para teste de integração.
 *
 * Existe porque `turmas.periodo_letivo_id` é NOT NULL desde a migration do
 * enturmamento: turma sem período letivo é a coluna `users.turma_id` de novo,
 * com outro nome, e é justamente o que a virada do ano quebra.
 */
export const TITULO_PERIODO_DE_TESTE = "Ano letivo 2026";

export async function periodoDeTeste(prisma: PrismaClient) {
  return prisma.periodoLetivo.upsert({
    where: { tipo_titulo: { tipo: "ano_letivo", titulo: TITULO_PERIODO_DE_TESTE } },
    update: {},
    create: {
      tipo: "ano_letivo",
      titulo: TITULO_PERIODO_DE_TESTE,
      ano: 2026,
      inicio: new Date(Date.UTC(2026, 0, 1)),
      fim: new Date(Date.UTC(2026, 11, 31)),
    },
  });
}

export async function criarTurmaDeTeste(
  prisma: PrismaClient,
  escolaId: string,
  nome: string,
  serie: string,
) {
  const periodo = await periodoDeTeste(prisma);
  return prisma.turma.create({
    data: { escolaId, periodoLetivoId: periodo.id, nome, serie },
  });
}
