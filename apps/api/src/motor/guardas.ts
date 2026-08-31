import { NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/**
 * Guardas das rotas do estudante/professor — adaptação NestJS do
 * `lib/api/guardas.ts` do origem. O OidcGuard já autenticou; aqui é POSSE:
 * run do próprio estudante, atividade do próprio professor — sempre com
 * `escola_id` explícito além da RLS (defesa em profundidade, regra 1).
 */

/**
 * Todo `[id]` de rota chega como string crua da URL. Sem esta checagem, um id
 * malformado (`undefined`, texto colado errado) faz o Postgres recusar o
 * parâmetro e a rota responder 500 — quando a resposta correta é 404, a mesma
 * de um id que não existe. Também evita gastar ida ao banco.
 */
export function ehUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

/** Mensagem neutra: esta rota também responde ao estudante (o disfarce vale). */
export function naoEncontrado(): never {
  throw new NotFoundException({ mensagem: "Não conseguimos abrir agora." });
}

/** Run do próprio estudante — ninguém lê a sessão de outro. */
export async function runDoEstudante(
  tx: Prisma.TransactionClient,
  runId: string,
  estudanteId: string,
  escolaId: string,
) {
  if (!ehUuid(runId)) return null;
  return tx.run.findFirst({
    where: { id: runId, estudanteId, escolaId },
    include: {
      activity: {
        select: {
          id: true,
          engineConfig: true,
          perguntaChave: true,
          status: true,
          /** Etapa da turma e chave da IA ao vivo: quase toda rota do estudante precisa. */
          etapa: true,
          iaAoVivo: true,
        },
      },
    },
  });
}


/** Atividade do professor logado — evita acesso cruzado entre professores. */
export async function atividadeDoProfessor(
  tx: Prisma.TransactionClient,
  activityId: string,
  professorId: string,
  escolaId: string,
) {
  if (!ehUuid(activityId)) return null;
  return tx.activity.findFirst({ where: { id: activityId, professorId, escolaId } });
}

/**
 * A atividade ATIVA que vale para um estudante — o `where` e a `orderBy` que
 * `POST /runs` e `GET /runs/boot` têm de compartilhar.
 *
 * Vive aqui, e não copiado nas duas rotas, pelo mesmo motivo de
 * `resolverLargada`: quando o `boot` tinha regra própria ele mostrava a pergunta
 * de uma atividade e a run nascia em outra, e o estudante lia na tela uma missão que
 * não era a dele.
 *
 * A atividade SEM turma (`turma_id IS NULL`) é a anterior à migration
 * `20260830090000_atividade_por_turma` e continua valendo para a escola inteira.
 * A ordem por `turmaId` com `nulls: "last"` é o que faz a atividade DA SALA
 * ganhar da geral quando as duas estão ativas ao mesmo tempo.
 */
export function ondeAAtividadeVale(
  escolaId: string,
  turmaId: string | null | undefined,
): Prisma.ActivityWhereInput {
  return {
    status: "ativa",
    escolaId,
    OR: [{ turmaId: null }, ...(turmaId ? [{ turmaId }] : [])],
  };
}

export const ORDEM_DA_ATIVIDADE_DO_ESTUDANTE = [
  { turmaId: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
] satisfies Prisma.ActivityOrderByWithRelationInput[];

