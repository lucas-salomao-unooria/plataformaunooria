import type { Prisma } from "@prisma/client";

/**
 * Matricula (ou reabre a matrícula de) alguém numa turma, dentro de uma
 * transação já com a tenancy armada.
 *
 * Vive fora do `service` porque os dois caminhos de entrada usam o mesmo passo:
 * a planilha simples e o binding CSV do OneRoster. Duas cópias divergiriam na
 * primeira regra nova, e a regra aqui é justamente a que ninguém lembra:
 *
 * a matrícula PRINCIPAL de um estudante é uma só, e abrir uma nova ENCERRA a
 * anterior (`fim`) — nunca a apaga: o que ele fez no UnooTube, na Vila e no
 * unooGPT continua pendurado nela, e apagar deixaria esse histórico órfão de
 * turma. O `users.turma_id` acompanha como cache.
 *
 * `principal` é PARÂMETRO, não dedução. A primeira versão encerrava toda
 * matrícula de estudante em outra turma, e com isso matricular alguém na eletiva
 * tirava a criança da turma regular — matando justamente o multi-turma que esta
 * tabela existe para permitir. Quem decide é a fonte: o `primary` do OneRoster
 * ou, na planilha simples, a única turma da linha.
 */
export async function matricularEm(
  tx: Prisma.TransactionClient,
  dados: {
    escolaId: string;
    turmaId: string;
    usuarioId: string;
    papel: "estudante" | "professor" | "aluno";
    /** Turma de referência da pessoa. Professor nunca é principal. */
    principal: boolean;
    inicio: Date;
    fim?: Date | null;
    fonteId?: string | null;
  },
): Promise<void> {
  const { escolaId, turmaId, usuarioId, papel: papelBruto, inicio, fim = null, fonteId = null } = dados;
  const papel = papelBruto === "aluno" ? "estudante" : papelBruto;
  const principal = (papelBruto === "estudante" || papelBruto === "aluno") && dados.principal && !fim;

  if (principal) {
    await tx.matricula.updateMany({
      where: {
        escolaId,
        usuarioId,
        papel: { in: ["estudante", "aluno"] },
        principal: true,
        turmaId: { not: turmaId },
        fim: null,
      },
      data: { fim: new Date(), principal: false },
    });
    await tx.user.update({ where: { id: usuarioId }, data: { turmaId } });
  }

  await tx.matricula.upsert({
    where: {
      escolaId_turmaId_usuarioId_papel: { escolaId, turmaId, usuarioId, papel },
    },
    update: { fim, principal, ...(fonteId ? { fonteId } : {}) },
    create: { escolaId, turmaId, usuarioId, papel, principal, inicio, fim, fonteId },
  });
}
