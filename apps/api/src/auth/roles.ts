import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthClaims, Perfil } from "./claims";

export const ROLES_KEY = "perfis";

/** Restringe a rota aos perfis listados. Usar SEMPRE junto do OidcGuard, e
 *  DEPOIS dele na lista (`@UseGuards(OidcGuard, RolesGuard)`) — o RolesGuard
 *  lê o `req.auth` que o OidcGuard injeta. */
export const Roles = (...perfis: Perfil[]) => SetMetadata(ROLES_KEY, perfis);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!perfis || perfis.length === 0) return true;
    const auth = ctx.switchToHttp().getRequest<{ auth?: AuthClaims }>().auth;
    if (!auth) throw new ForbiddenException("Rota com RolesGuard sem OidcGuard antes");
    if (!perfis.includes(auth.perfil)) throw new ForbiddenException("Perfil sem acesso a esta rota");
    return true;
  }
}
