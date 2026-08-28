import { Global, Module } from "@nestjs/common";
import { RosteringModule } from "../rostering/rostering.module";
import { AuthController } from "./auth.controller";
import { OidcGuard } from "./oidc.guard";
import { RolesGuard } from "./roles";
import { TokenService } from "./token.service";

/** Global: todo módulo usa @UseGuards(OidcGuard[, RolesGuard]) sem reimportar. */
@Global()
@Module({
  /* `RosteringModule` porque o login devolve as ESCOLAS da pessoa: professor de
     rede estadual tem mais de uma, e o hub precisa da lista para o seletor. */
  imports: [RosteringModule],
  controllers: [AuthController],
  providers: [TokenService, OidcGuard, RolesGuard],
  exports: [TokenService, OidcGuard, RolesGuard],
})
export class AuthModule {}
