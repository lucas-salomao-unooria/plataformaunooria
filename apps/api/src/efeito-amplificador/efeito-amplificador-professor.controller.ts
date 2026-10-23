import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { MaterialSchema } from "./contrato-de-rotas";
import { EfeitoAmplificadorService } from "./efeito-amplificador.service";

/** O material do guia da aula — catálogo da missão, igual para todo contrato. */
@Controller("efeito-amplificador/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class EfeitoAmplificadorProfessorController {
  constructor(private readonly missao: EfeitoAmplificadorService) {}

  @Get("material")
  @Contrato({
    resumo: "O banco curado COM o gabarito, o roteiro do debate, os indicadores e as réguas.",
    resposta: MaterialSchema,
  })
  material() {
    return this.missao.material();
  }
}
