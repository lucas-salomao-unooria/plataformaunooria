import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthClaims {
  alunoId: string; escolaId: string; turmaId?: string;
  perfil: "aluno" | "professor" | "gestor" | "admin-contrato";
}

const jwks = createRemoteJWKSet(new URL(process.env.OIDC_JWKS_URI ?? "http://localhost/jwks"));

/** Valida JWT do WSO2 (ou qualquer IdP OIDC) via JWKS e injeta claims tipadas.
 *  REGRA: toda rota de dados usa req.auth.escolaId para escopar queries. */
@Injectable()
export class OidcGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!token) throw new UnauthorizedException("Token ausente");
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: process.env.OIDC_ISSUER,
        audience: process.env.OIDC_AUDIENCE,
      });
      req.auth = {
        alunoId: String(payload.sub),
        escolaId: String(payload["escola_id"] ?? ""),
        turmaId: payload["turma_id"] ? String(payload["turma_id"]) : undefined,
        perfil: (payload["perfil"] as AuthClaims["perfil"]) ?? "aluno",
      } satisfies AuthClaims;
      if (!req.auth.escolaId) throw new Error("claim escola_id ausente");
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido");
    }
  }
}
