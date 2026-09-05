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
 * Este estudante é de alguma turma em que o professor leciona? É o que vira 404
 * nas telas de UMA criança — o relatório individual da Vila e do unooGPT, que
 * carregam leitura de perfil e transcrição de texto livre de menor de idade.
 *
 * Existe separado de `professorLeciona` porque a tela individual não recebe
 * turma: ela recebe o id da criança, e a pergunta "posso ver ESTA criança?" não
 * se responde com o `escola_id` do token — era só isso que essas rotas exigiam,
 * e qualquer professor da escola abria o relatório de qualquer estudante dela.
 *
 * **As duas fontes, e por que as duas.** A VERDADE do enturmamento é
 * `matriculas`; o CACHE é `users.turma_id`. As listagens destes módulos (a folha
 * da turma, o painel) partem do cache, e o nome que o professor CLICA veio de
 * lá. Se a guarda olhasse só a matrícula, um cache adiantado em relação a ela
 * produziria o pior sintoma possível: o nome aparece na lista e a tela dele
 * responde "não encontrado". Aceitar as duas fecha essa fresta sem abrir outra —
 * os dois caminhos exigem `escola_id` e uma turma DO PROFESSOR, e nenhum deles
 * atravessa escola.
 *
 * ARMADILHA: `matriculas` tem RLS. Fora de `comTenancy` esta função responde
 * "não é seu estudante" para todo mundo, em silêncio.
 */
export async function professorEnsinaOEstudante(
  tx: Prisma.TransactionClient,
  escolaId: string,
  estudanteId: string,
  professorId?: string,
): Promise<boolean> {
  if (!professorId) return true;

  const daTurmaDoProfessor = {
    matriculas: { some: { escolaId, usuarioId: professorId, papel: "professor", fim: null } },
  } satisfies Prisma.TurmaWhereInput;

  const porMatricula = await tx.matricula.findFirst({
    where: {
      escolaId,
      usuarioId: estudanteId,
      papel: "estudante",
      fim: null,
      turma: daTurmaDoProfessor,
    },
    select: { id: true },
  });
  if (porMatricula) return true;

  /* O cache. `users` está FORA da RLS: o `escola_id` no `where` é a única
     tranca aqui, não defesa em profundidade (ADR-49). */
  const porCache = await tx.user.findFirst({
    where: { id: estudanteId, escolaId, role: "estudante", turma: daTurmaDoProfessor },
    select: { id: true },
  });
  return Boolean(porCache);
}

/**
 * O id do professor quando é ele quem está pedindo — `undefined` para gestor e
 * admin-contrato, que enxergam a escola inteira. É o que os controllers
 * repassam aos services.
 */
export function professorDoToken(auth: AuthClaims): string | undefined {
  return auth.perfil === "professor" ? auth.usuarioId : undefined;
}
