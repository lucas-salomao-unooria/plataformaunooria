import { z } from "zod";

/**
 * Claims do token — CONTRATO CONGELADO (M0 do plano de migração).
 *
 * O emissor hoje é o hub (NextAuth Credentials + chave RS256 própria, JWKS em
 * `{hub}/.well-known/jwks.json`); amanhã pode ser o WSO2 — a api não sabe a
 * diferença, só valida issuer/audience/assinatura.
 *
 * Payload JWT: { sub, escola_id, turma_id?, perfil, aud: "plataforma-api" }.
 * `usuarioId` = `sub` (professor/gestor/admin passam pelo mesmo guard, daí não
 * se chamar mais estudanteId).
 */
export type Perfil = (typeof PERFIS)[number];

export interface AuthClaims {
  usuarioId: string;
  /** Vazio APENAS para admin-contrato (única exceção cross-escola, regra 1). */
  escolaId: string;
  turmaId?: string;
  perfil: Perfil;
}

export const PERFIS = ["estudante", "professor", "gestor", "admin-contrato"] as const;

/** Os mesmos quatro papéis para quem valida com Zod — schema de rota, sobretudo.
 *  Derivado de `PERFIS` (que agora é tupla) para não haver duas listas: uma
 *  terceira fonte de papéis é exatamente como "coordenacao" viraria papel novo
 *  sem ninguém decidir. */
export const PerfilSchema = z.enum(PERFIS);
