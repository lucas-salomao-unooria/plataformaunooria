import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { OidcGuard } from "./oidc.guard";
import { RolesGuard } from "./roles";
import { TokenService } from "./token.service";

/** Global: todo módulo usa @UseGuards(OidcGuard[, RolesGuard]) sem reimportar. */
@Global()
@Module({
  controllers: [AuthController],
  providers: [TokenService, OidcGuard, RolesGuard],
  exports: [TokenService, OidcGuard, RolesGuard],
})
export class AuthModule {}
