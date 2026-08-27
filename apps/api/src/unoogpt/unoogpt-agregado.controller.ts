import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { erroDeJogo } from "./erros";
import { UnoogptService } from "./unoogpt.service";

/**
 * Visão do GESTOR: SÓ números por turma.
 *
 * Controller separado do professor de propósito. A alternativa — um `@Roles`
 * incluindo gestor com uma exceção dentro do método da criança — é a forma que
 * vaza: basta um método novo esquecer a exceção. Aqui o gestor não tem sequer
 * uma rota que aceite `alunoId`, então nenhum descuido futuro o leva à
 * Transcrição de uma criança.
 */
type Autenticado = { auth: AuthClaims };

@Controller("unoogpt/agregado")
@UseGuards(OidcGuard, RolesGuard)
@Roles("gestor", "admin-contrato")
export class UnoogptAgregadoController {
  constructor(private readonly service: UnoogptService) {}

  @Get("escola")
  escola(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    const auth = req.auth;
    if (auth.perfil === "admin-contrato") {
      if (!escolaIdPedida) throw erroDeJogo("payload-invalido");
      return this.service.agregadoDaEscola(escolaIdPedida);
    }
    if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
      throw new ForbiddenException("gestor só vê a própria escola");
    }
    return this.service.agregadoDaEscola(auth.escolaId);
  }
}
