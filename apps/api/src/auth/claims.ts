/**
 * Claims do token — CONTRATO CONGELADO (M0 do plano de migração).
 *
 * O emissor hoje é o hub (NextAuth Credentials + chave RS256 própria, JWKS em
 * `{hub}/.well-known/jwks.json`); amanhã pode ser o WSO2 — a api não sabe a
 * diferença, só valida issuer/audience/assinatura.
 *
 * Payload JWT: { sub, escola_id, turma_id?, perfil, aud: "plataforma-api" }.
 * `usuarioId` = `sub` (professor/gestor/admin passam pelo mesmo guard, daí não
 * se chamar mais alunoId).
 */
export type Perfil = "aluno" | "professor" | "gestor" | "admin-contrato";

export interface AuthClaims {
  usuarioId: string;
  /** Vazio APENAS para admin-contrato (única exceção cross-escola, regra 1). */
  escolaId: string;
  turmaId?: string;
  perfil: Perfil;
}

export const PERFIS: readonly Perfil[] = ["aluno", "professor", "gestor", "admin-contrato"];
