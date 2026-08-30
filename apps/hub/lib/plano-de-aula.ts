/**
 * **Gerador de Plano de Aula** — um dos dois produtos da Plataforma Unooria
 * (o outro é o Entre Redes, em `lib/entre-redes/catalogo.ts`).
 *
 * Deixou de ser um serviço externo aberto em nova guia: é a experiência
 * `exp-90-plano-de-aula` (Vite, estática, `publico: "professor"`), embedada
 * em `/professor/plano-de-aula` com a MESMA sessão e o MESMO token da
 * plataforma. O lado server é `apps/api/src/planos`.
 *
 * Só aparece em superfícies do professor. O aparelho do estudante nunca menciona
 * "aula" nem "plano de aula" (regra de ouro 1), e `/exp/exp-90-...` responde 404.
 */
export const EXP_PLANO_DE_AULA = "exp-90-plano-de-aula";
export const ROTA_PLANO_DE_AULA = "/professor/plano-de-aula";
