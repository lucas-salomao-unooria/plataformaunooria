import type { Prisma } from "@prisma/client";

/**
 * "ZERAR A TURMA" APAGA A EVIDÊNCIA DA ATIVIDADE (ADR-155).
 *
 * As marcas (o dado bruto) e as evidências (o que o painel lê) da atividade
 * inteira — todas as rodadas — saem, para a turma começar do zero: sem isso, a
 * rodada passada continuava no painel e, como o resultado é a MELHOR rodada,
 * a aplicação nova nunca derrubava o nível antigo. Antes desta ADR o zerar
 * guardava tudo de propósito (ADR-112/145); o professor pediu o contrário.
 *
 * Roda no `tx` de quem zera — a mesma transação que sobe a rodada da missão —
 * para as duas coisas caírem juntas. A rodada da missão continua subindo: é
 * ela que recusa a resposta atrasada de quem estava com a tela aberta.
 *
 * O HISTÓRICO (`evidencias_eventos`) FICA. Ele é append-only por desenho: a
 * role de runtime só tem `SELECT, INSERT` ali, e um `DELETE` seria recusado
 * pelo banco. Nenhuma tela lê o histórico como evidência — ele é a trilha de
 * auditoria de quem ajustou o quê.
 */
export async function apagarEvidenciaDaAtividade(
  tx: Prisma.TransactionClient,
  alvo: { escolaId: string; turmaId: string; expId: string; atividadeId: string },
): Promise<{ marcas: number; evidencias: number }> {
  const where = {
    escolaId: alvo.escolaId,
    turmaId: alvo.turmaId,
    expId: alvo.expId,
    atividadeId: alvo.atividadeId,
  };
  const evidencias = await tx.evidencia.deleteMany({ where });
  const marcas = await tx.evidenciaMarca.deleteMany({ where });
  return { marcas: marcas.count, evidencias: evidencias.count };
}
