import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { RespostaMaterialProfessorSchema } from "./contrato-de-rotas";
import { PortaVozDosDadosService } from "./porta-voz-dos-dados.service";

/** O material do guia da aula — catálogo da missão, igual para todo contrato. */
@Controller("porta-voz-dos-dados/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class PortaVozDosDadosProfessorController {
  constructor(private readonly missao: PortaVozDosDadosService) {}

  @Get("material")
  @Contrato({
    resumo: "O material do guia (API-005): o banco padrão, o roteiro do debate, a série, o laudo, a perícia COM o gabarito e as réguas.",
    resposta: RespostaMaterialProfessorSchema,
  })
  material() {
    return this.missao.material();
  }
}
