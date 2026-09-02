import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import type { AuthClaims } from "../auth/claims";
import { comEscolaNoContexto, definirTenancyNoContexto } from "./tenancy-context";

/**
 * Propaga a escola (e o perfil) do token para o AsyncLocalStorage da requisição.
 * Interceptors rodam DEPOIS dos guards, então `req.auth` já existe quando a
 * rota usa OidcGuard; rota sem guard (health, beacon) simplesmente não tem
 * escola — e `comTenancy` sem escola explícita falha alto, de propósito.
 *
 * O store em si foi aberto pelo `contextoMiddleware` (`main.ts`); aqui ele é
 * MUTADO, não substituído — o ExceptionFilter roda fora desta cadeia e precisa
 * ler a escola do mesmo objeto. Sem store (teste que instancia o interceptor
 * sozinho), cai no `comEscolaNoContexto` de sempre.
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ auth?: AuthClaims }>();
    const escolaId = req.auth?.escolaId;
    if (!escolaId) return next.handle();
    if (definirTenancyNoContexto({ escolaId, perfil: req.auth?.perfil })) return next.handle();
    return comEscolaNoContexto(escolaId, () => next.handle());
  }
}
