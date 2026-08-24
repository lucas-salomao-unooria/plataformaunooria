import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import type { AuthClaims } from "../auth/claims";
import { comEscolaNoContexto } from "./tenancy-context";

/**
 * Propaga a escola do token para o AsyncLocalStorage da requisição.
 * Interceptors rodam DEPOIS dos guards, então `req.auth` já existe quando a
 * rota usa OidcGuard; rota sem guard (health, beacon) simplesmente não abre
 * contexto — e `comTenancy` sem escola explícita falha alto, de propósito.
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ auth?: AuthClaims }>();
    const escolaId = req.auth?.escolaId;
    if (!escolaId) return next.handle();
    return comEscolaNoContexto(escolaId, () => next.handle());
  }
}
