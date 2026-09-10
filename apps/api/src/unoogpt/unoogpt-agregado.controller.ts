import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { erroDeJogo } from "./erros";
import { UnoogptService } from "./unoogpt.service";
import { z } from "zod";
import { Contrato } from "../openapi/contrato";
import { AgregadoDaEscolaSchema } from "./contrato-de-rotas";
import { GESTORES, ehDoContrato} from "../auth/claims";

/**
 * Visão do GESTOR: SÓ números por turma.
 *
 * Controller separado do professor de propósito. A alternativa — um `@Roles`
 * incluindo gestor com uma exceção dentro do método da criança — é a forma que
 * vaza: basta um método novo esquecer a exceção. Aqui o gestor não tem sequer
 * uma rota que aceite `estudanteId`, então nenhum descuido futuro o leva à
 * Transcrição de uma criança.
 */
type Autenticado = { auth: AuthClaims };

@Controller("unoogpt/agregado")
@UseGuards(OidcGuard, RolesGuard)
@Roles(...GESTORES)
export class UnoogptAgregadoController {
  constructor(private readonly service: UnoogptService) {}

  @Get("escola")
  @Contrato({
    resumo: "O agregado da escola — uma linha por turma.",
    descricao:
      "Controller separado do professor de propósito. A alternativa — um `@Roles` misto com exceção por método — é como uma rota individual acaba aberta para gestor sem ninguém notar.\n\n**Nada aqui identifica uma criança.**",
    query: z.object({ escolaId: z.string().optional() }),
    resposta: AgregadoDaEscolaSchema,
    notas: ["`gestor_contrato` precisa dizer `?escolaId=`; gestor só vê a própria escola (403)."],
  })
  escola(@Query("escolaId") escolaIdPedida: string | undefined, @Req() req: Autenticado) {
    const auth = req.auth;
    if (ehDoContrato(auth.perfil)) {
      if (!escolaIdPedida) throw erroDeJogo("payload-invalido");
      return this.service.agregadoDaEscola(escolaIdPedida);
    }
    if (escolaIdPedida && escolaIdPedida !== auth.escolaId) {
      throw new ForbiddenException("gestor só vê a própria escola");
    }
    return this.service.agregadoDaEscola(auth.escolaId);
  }
}
