import type { Prisma } from "@prisma/client";

/**
 * Lotação: o vínculo de uma pessoa com uma ESCOLA.
 *
 * A regra que muda tudo está aqui, e ela é diferente por papel:
 *
 * - PROFESSOR e GESTOR **acumulam**. Lotação nova não encerra a anterior: quem
 *   dá aula em duas escolas da rede tem duas, e ao entrar escolhe em qual está
 *   trabalhando. Era o caso que `users.escola_id` sozinho não representava.
 * - ALUNO tem **uma ativa**. Escola nova é TRANSFERÊNCIA, e o banco garante
 *   isso com índice único parcial — aluno em duas escolas ao mesmo tempo é
 *   indistinguível de uma transferência que ficou pela metade.
 *
 * `lotacoes` não tem RLS (é lida no login, antes de haver escola), então estas
 * funções servem tanto dentro quanto fora de contexto de tenancy.
 */

export type PapelDeLotacao = "aluno" | "professor" | "gestor";

/**
 * Abre (ou reabre) a lotação, sem tocar nas outras. É o caminho de professor e
 * gestor — e do aluno **na escola de destino**, depois de a transferência ter
 * encerrado a de origem.
 */
export async function garantirLotacao(
  tx: Prisma.TransactionClient,
  dados: {
    escolaId: string;
    usuarioId: string;
    papel: PapelDeLotacao;
    inicio: Date;
    principal?: boolean;
    fonteId?: string | null;
  },
): Promise<void> {
  const { escolaId, usuarioId, papel, inicio, principal = false, fonteId = null } = dados;
  await tx.lotacao.upsert({
    where: { escolaId_usuarioId_papel: { escolaId, usuarioId, papel } },
    update: { fim: null, ...(principal ? { principal: true } : {}), ...(fonteId ? { fonteId } : {}) },
    create: { escolaId, usuarioId, papel, principal, inicio, fonteId },
  });
  if (principal) {
    await tx.lotacao.updateMany({
      where: { usuarioId, papel, escolaId: { not: escolaId } },
      data: { principal: false },
    });
    await tx.user.update({ where: { id: usuarioId }, data: { escolaId } });
  }
}

/** A escola em que o aluno está agora, se houver. Lê sem tenancy, de propósito. */
export async function escolaAtualDoAluno(
  tx: Prisma.TransactionClient,
  usuarioId: string,
): Promise<string | null> {
  const lotacao = await tx.lotacao.findFirst({
    where: { usuarioId, papel: "aluno", fim: null },
    select: { escolaId: true },
  });
  return lotacao?.escolaId ?? null;
}
