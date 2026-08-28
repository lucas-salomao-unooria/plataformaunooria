import type { Prisma } from "@prisma/client";
import type { AuthClaims } from "../auth/claims";

/**
 * "As turmas do professor" são as turmas em que ele tem MATRÍCULA.
 *
 * Antes de `matriculas` existir, não havia vínculo professor↔turma no modelo, e
 * os seletores de turma listavam a escola inteira: o professor do 8A abria os
 * resultados — inclusive bem-estar e Vila — de qualquer turma da escola. A
 * autorização era "mesma escola do token", que é a regra de TENANCY, não a de
 * quem dá aula ali.
 *
 * Gestor e admin-contrato continuam vendo a escola toda, de propósito: o papel
 * deles é da ESCOLA, não da turma — a mesma distinção que o OneRoster faz entre
 * `roles` (nível da organização) e `enrollments` (nível da turma).
 */
export function ondeAsTurmasSaoVisiveis(
  escolaId: string,
  professorId?: string,
): Prisma.TurmaWhereInput {
  if (!professorId) return { escolaId };
  return {
    escolaId,
    matriculas: {
      some: { escolaId, usuarioId: professorId, papel: "professor", fim: null },
    },
  };
}

/**
 * O professor leciona nesta turma? É o que vira 403 nas telas de uma turma só.
 * `undefined` (gestor/admin) passa direto — a checagem de escola já foi feita.
 */
export async function professorLeciona(
  tx: Prisma.TransactionClient,
  escolaId: string,
  turmaId: string,
  professorId?: string,
): Promise<boolean> {
  if (!professorId) return true;
  const matricula = await tx.matricula.findFirst({
    where: { escolaId, turmaId, usuarioId: professorId, papel: "professor", fim: null },
    select: { id: true },
  });
  return Boolean(matricula);
}

/**
 * O id do professor quando é ele quem está pedindo — `undefined` para gestor e
 * admin-contrato, que enxergam a escola inteira. É o que os controllers
 * repassam aos services.
 */
export function professorDoToken(auth: AuthClaims): string | undefined {
  return auth.perfil === "professor" ? auth.usuarioId : undefined;
}
