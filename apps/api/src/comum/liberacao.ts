import { ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

/**
 * A PORTA DA SALA: a missão só abre para o estudante da turma em que ela foi
 * liberada (ADR-69).
 *
 * Toda entrada de estudante em experiência passa por aqui — `POST /runs`,
 * `GET /runs/boot`, a sessão do UnooTube, a do unooGPT, a partida da Vila e a
 * sessão do Eco. Filtrar o card no hub é UX; a regra que vale é esta, do lado do
 * servidor, pela mesma razão da regra 3 (correção server-side): o `/exp/:expId`
 * é um endereço adivinhável, e antes disto qualquer estudante logado abria
 * qualquer missão digitando a URL.
 *
 * NÃO confunda com o relógio da exp-03 nem com os gates da exp-07. Aqueles
 * dizem "a aula começou" e continuam morando na experiência (ADR-25). Este diz
 * "esta missão está nesta sala", e é PRÉ-CONDIÇÃO deles: sem liberação a
 * pergunta do relógio nem chega a ser feita.
 */

/** O código que o cliente vê. Estável: é por ele que a tela decide o que dizer. */
export const MISSAO_NAO_LIBERADA = "missao-nao-liberada";

/**
 * As turmas ATIVAS do estudante — a matrícula, e o cache como rede.
 *
 * As duas fontes pelo mesmo motivo de `professorEnsinaOEstudante`: a verdade é
 * `matriculas`, mas `users.turma_id` é o que o resto do runtime lê (o claim do
 * token, `ondeAAtividadeVale`, o painel de toda experiência). Uma criança cuja
 * matrícula ainda não existe — importação pela metade, seed antigo — tem sala na
 * prática, e trancá-la fora dela produziria "a missão sumiu" sem nada na tela
 * explicando o que faltou.
 *
 * Um estudante pode ter mais de uma turma: `matriculas` admite a turma de
 * componente (`turmas.tipo = 'componente'`) em paralelo à regular.
 *
 * ARMADILHA: `matriculas` tem RLS. Fora de `comTenancy` isto volta VAZIO, em
 * silêncio, e toda missão vira "não liberada".
 */
export async function turmasDoEstudante(
  tx: Prisma.TransactionClient,
  escolaId: string,
  estudanteId: string,
): Promise<string[]> {
  const [matriculas, cache] = await Promise.all([
    tx.matricula.findMany({
      where: { escolaId, usuarioId: estudanteId, papel: "estudante", fim: null },
      select: { turmaId: true },
    }),
    tx.user.findFirst({
      where: { id: estudanteId, escolaId },
      select: { turmaId: true },
    }),
  ]);

  const ids = new Set(matriculas.map((m) => m.turmaId));
  if (cache?.turmaId) ids.add(cache.turmaId);
  return [...ids];
}

/**
 * As missões liberadas para este estudante, por turma.
 *
 * Só `estado = 'liberada'` entra. `encerrada` some daqui de propósito: a missão
 * continua listada para ele no hub (com o rótulo de encerrada, para o que ele
 * fez não evaporar da tela), mas a porta está fechada.
 */
export async function missoesLiberadasPara(
  tx: Prisma.TransactionClient,
  escolaId: string,
  estudanteId: string,
): Promise<Set<string>> {
  const turmaIds = await turmasDoEstudante(tx, escolaId, estudanteId);
  if (turmaIds.length === 0) return new Set();

  const liberadas = await tx.liberacao.findMany({
    where: { escolaId, turmaId: { in: turmaIds }, estado: "liberada" },
    select: { expId: true },
  });
  return new Set(liberadas.map((l) => l.expId));
}

/**
 * Recusa a entrada quando a missão não está liberada na turma do estudante.
 *
 * 403 com `codigo` estável, e a mensagem é de PRODUTO, não de sistema: quem lê
 * é uma criança dentro de um app disfarçado, onde as palavras "atividade",
 * "professor" e "turma" quebram a ficção (é a mesma razão do 409 do
 * `POST /runs`, "Nada rolando por aqui agora").
 *
 * Estudante sem turma nenhuma cai aqui também. É o certo: sem sala não há
 * missão — e é a tela do hub que explica que falta enturmar, porque um erro
 * dentro do aparelho não teria como dizer isso sem sair do disfarce.
 */
export async function exigirMissaoLiberada(
  tx: Prisma.TransactionClient,
  escolaId: string,
  estudanteId: string,
  expId: string,
): Promise<void> {
  const liberadas = await missoesLiberadasPara(tx, escolaId, estudanteId);
  if (liberadas.has(expId)) return;

  throw new ForbiddenException({
    codigo: MISSAO_NAO_LIBERADA,
    mensagem: "Esta missão não está aberta agora.",
  });
}
