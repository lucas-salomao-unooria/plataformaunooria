import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { AuthClaims } from "../auth/claims";

/**
 * Qual escola esta requisição administra.
 *
 * Para gestor e professor a escola vem do TOKEN — parâmetro divergente é 403,
 * nunca "o que veio na query". `admin-contrato` é a única exceção cross-escola
 * (regra inviolável nº 1) e por isso é o único que precisa dizer `?escolaId=`:
 * o token dele não tem escola, e o TenancyInterceptor não abre contexto.
 */
export function escolaAlvo(auth: AuthClaims, escolaIdPedida?: string): string {
  if (auth.perfil === "admin-contrato") {
    if (!escolaIdPedida) throw new BadRequestException("admin-contrato: informe ?escolaId=");
    return escolaIdPedida;
  }
  if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
    throw new ForbiddenException("acesso restrito à própria escola");
  }
  return auth.escolaId;
}
