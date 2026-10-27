import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { AssistenteInvisivelService } from "./assistente-invisivel.service";
import { MaterialSchema } from "./contrato-de-rotas";

/** O material do guia da aula — catálogo da missão, igual para todo contrato. */
@Controller("assistente-invisivel/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class AssistenteInvisivelProfessorController {
  constructor(private readonly missao: AssistenteInvisivelService) {}

  @Get("material")
  @Contrato({
    resumo: "O roteiro de debate (as quatro perguntas e o card de transferência) e as réguas das quatro habilidades.",
    resposta: MaterialSchema,
  })
  material() {
    return this.missao.material();
  }
}
