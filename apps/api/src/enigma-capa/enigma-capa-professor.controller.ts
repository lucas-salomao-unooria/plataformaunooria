import { Controller, Get, UseGuards } from "@nestjs/common";
import { GESTORES } from "../auth/claims";
import { OidcGuard } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { MaterialSchema } from "./contrato-de-rotas";
import { EnigmaCapaService } from "./enigma-capa.service";

/** O material do guia da aula — catálogo da missão, igual para todo contrato. */
@Controller("enigma-capa/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", ...GESTORES)
export class EnigmaCapaProfessorController {
  constructor(private readonly missao: EnigmaCapaService) {}

  @Get("material")
  @Contrato({
    resumo: "Os pacotes prontos COM o gabarito, os componentes curriculares do recorte, o roteiro da conversa, as cartas da E5 e as réguas.",
    resposta: MaterialSchema,
  })
  material() {
    return this.missao.material();
  }
}
