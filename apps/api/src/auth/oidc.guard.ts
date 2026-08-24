import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { TokenService } from "./token.service";

export type { AuthClaims } from "./claims";

/** Valida o JWT do emissor configurado (hub hoje, WSO2 amanhã — mesmo guard)
 *  via JWKS e injeta claims tipadas em `req.auth`.
 *  REGRA: toda rota de dados usa req.auth.escolaId para escopar queries. */
@Injectable()
export class OidcGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!token) throw new UnauthorizedException("Token ausente");
    req.auth = await this.tokens.verificar(token);
    return true;
  }
}
