import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { ehUuid } from "../motor/guardas";
import { erroDeJogo } from "./erros";
import { UnootubeService } from "./unootube.service";
import { professorDoToken } from "../comum/turmas-do-professor";

/**
 * Visão do PROFESSOR (e gestor) sobre a missão do UnooTube — classe separada
 * para o `@Roles` ficar limpo, como em `analise.controller.ts`.
 *
 * `admin-contrato` é a única exceção cross-escola (regra 1): o token dele tem
 * escola vazia, então precisa dizer `?escolaId=` — e o valor vai EXPLÍCITO ao
 * `comTenancy` (o TenancyInterceptor não abre contexto para ele).
 */

type Autenticado = { auth: AuthClaims };

function escolaAlvo(auth: AuthClaims, escolaIdPedida?: string): string {
  if (auth.perfil === "admin-contrato") {
    if (!escolaIdPedida) erroDeJogo("ESCOLA_OBRIGATORIA");
    return escolaIdPedida;
  }
  if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
    throw new ForbiddenException("professor e gestor só veem a própria escola");
  }
  return auth.escolaId;
}

@Controller("unootube/turmas")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", "gestor", "admin-contrato")
export class UnootubeTurmasController {
  constructor(private readonly unootube: UnootubeService) {}

  /** Turmas da escola — alimenta o seletor da página de resultados do hub. */
  @Get()
  turmas(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    return this.unootube.turmas(escolaAlvo(req.auth, escolaIdPedida), professorDoToken(req.auth));
  }

  @Get(":turmaId/resultados")
  resultados(
    @Param("turmaId") turmaId: string,
    @Query("escolaId") escolaIdPedida: string | undefined,
    @Req() req: Autenticado,
  ) {
    const escolaId = escolaAlvo(req.auth, escolaIdPedida);
    if (!ehUuid(turmaId)) {
      throw new BadRequestException({ codigo: "TURMA_NAO_ENCONTRADA", mensagem: "Turma inválida." });
    }
    return this.unootube.resultadosDaTurma(escolaId, turmaId, professorDoToken(req.auth));
  }
}
