import type { Prisma } from "@prisma/client";
import type { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * As duas operações destrutivas do professor sobre uma atividade — porte de
 * `lib/atividades/manutencao.ts` do origem.
 *
 * Ficam aqui, e não dentro dos controllers, porque são irreversíveis e
 * precisam de teste que exercite o código real — não uma cópia da sequência de
 * deletes escrita de novo no arquivo de teste.
 */

/**
 * Apaga os dados que a turma produziu, preservando a atividade.
 *
 * Apagar as `runs` cascateia `events` (o dwell), `student_posts`, `conclusoes`
 * e `dossiers`. Sobrevivem de propósito o conteúdo gerado, os
 * `perfis_importados` (insumo do Ato 1, valem para a próxima turma) e o
 * `status` da atividade.
 */
export async function limparDadosDosAlunos(
  tx: Prisma.TransactionClient,
  activityId: string,
): Promise<{ sessoes: number }> {
  const { count } = await tx.run.deleteMany({ where: { activityId } });
  return { sessoes: count };
}

/**
 * Apaga a atividade inteira e tudo que pende dela.
 *
 * As `runs` saem **explicitamente** porque `runs.activity_id` é
 * `ON DELETE RESTRICT` (de propósito — sessão de aluno não evapora por clique
 * errado). O resto — `posts`, `authors`, `post_comments`, `generation_jobs`,
 * `perfis_importados` — cai por CASCADE.
 *
 * As imagens saem **depois** do commit: se o banco recusar a exclusão, os
 * arquivos ainda pertencem a uma atividade viva. O caminho inverso (commit ok,
 * assets falham) deixa órfãos — ruim, mas recuperável, e o AssetsService já
 * registra a falha sem derrubar a operação.
 */
export async function excluirAtividade(
  prisma: PrismaService,
  assets: AssetsService,
  escolaId: string,
  activityId: string,
): Promise<{ sessoes: number }> {
  const removidas = await prisma.comTenancy(async (tx) => {
    const { count } = await tx.run.deleteMany({ where: { activityId } });
    await tx.activity.delete({ where: { id: activityId } });
    return count;
  }, escolaId);

  await assets.removerAtividade(escolaId, activityId);

  return { sessoes: removidas };
}
