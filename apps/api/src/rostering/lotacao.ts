import type { Prisma } from "@prisma/client";

/**
 * Lotação: o vínculo de uma pessoa com uma ESCOLA.
 *
 * A regra que muda tudo está aqui, e ela é diferente por papel:
 *
 * - PROFESSOR e GESTOR **acumulam**. Lotação nova não encerra a anterior: quem
 *   dá aula em duas escolas da rede tem duas, e ao entrar escolhe em qual está
 *   trabalhando. Era o caso que `users.escola_id` sozinho não representava.
 * - ESTUDANTE tem **uma ativa**. Escola nova é TRANSFERÊNCIA, e o banco garante
 *   isso com índice único parcial — estudante em duas escolas ao mesmo tempo é
 *   indistinguível de uma transferência que ficou pela metade.
 *
 * `lotacoes` não tem RLS (é lida no login, antes de haver escola), então estas
 * funções servem tanto dentro quanto fora de contexto de tenancy.
 */

export type PapelDeLotacao = "estudante" | "professor" | "gestor_escola" | "estudante";

/**
 * Abre (ou reabre) a lotação, sem tocar nas outras. É o caminho de professor e
 * gestor — e do estudante **na escola de destino**, depois de a transferência ter
 * encerrado a de origem.
 */
/**
 * O que a escrita FEZ, por escola.
 *
 * Devolvido em vez de `void` porque a tela precisa distinguir os três casos: o
 * card pede "criar somente os novos vínculos e apresentar o resultado por
 * escola", e um contador único não separa "criei" de "já estava". A pessoa lia
 * "agora está em 3 escolas" tendo o sistema escrito três vínculos ou nenhum.
 */
export type EfeitoDaLotacao = "criada" | "reaberta" | "mantida";

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
): Promise<EfeitoDaLotacao> {
  const { escolaId, usuarioId, papel, inicio, principal = false, fonteId = null } = dados;
  /* Lido ANTES do upsert: depois dele `fim` já é null e as três situações ficam
     indistinguíveis. É uma consulta a mais por escola, e ela paga o que a tela
     precisa dizer. */
  const anterior = await tx.lotacao.findUnique({
    where: { escolaId_usuarioId_papel: { escolaId, usuarioId, papel } },
    select: { fim: true },
  });
  const efeito: EfeitoDaLotacao =
    anterior === null ? "criada" : anterior.fim === null ? "mantida" : "reaberta";
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
  return efeito;
}

/** A escola em que o estudante está agora, se houver. Lê sem tenancy, de propósito. */
export async function escolaAtualDoEstudante(
  tx: Prisma.TransactionClient,
  usuarioId: string,
): Promise<string | null> {
  const lotacao = await tx.lotacao.findFirst({
    where: { usuarioId, papel: "estudante", fim: null },
    select: { escolaId: true },
  });
  return lotacao?.escolaId ?? null;
}

