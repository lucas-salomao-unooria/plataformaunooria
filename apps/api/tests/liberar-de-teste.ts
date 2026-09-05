import type { PrismaClient } from "@prisma/client";

/**
 * Libera uma missão numa turma, para as fixtures de integração (ADR-69).
 *
 * Existe porque a porta da sala é PRÉ-CONDIÇÃO de toda entrada de estudante em
 * experiência: sem uma linha em `liberacoes`, `POST /runs`, a sessão do
 * UnooTube, a do unooGPT, a partida da Vila e a do Eco recusam com 403
 * `missao-nao-liberada` — que foi exatamente o que quebrou quatro suítes quando
 * a guarda entrou. Quem quebrar de novo com esse código não tem bug: tem
 * fixture faltando.
 *
 * `liberadaPor` aceita qualquer usuário porque a coluna é para a tela dizer quem
 * abriu a missão; nenhuma regra a lê.
 */
export async function liberarParaTeste(
  prisma: PrismaClient,
  escolaId: string,
  turmaId: string,
  expId: string,
  liberadaPor: string,
): Promise<void> {
  await prisma.liberacao.upsert({
    where: { escolaId_turmaId_expId: { escolaId, turmaId, expId } },
    update: { estado: "liberada", encerradaEm: null },
    create: { escolaId, turmaId, expId, estado: "liberada", liberadaPor },
  });
}
