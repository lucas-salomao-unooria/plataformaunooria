import { Module } from "@nestjs/common";
import { ProspeccaoPublicoController } from "./prospeccao-publico.controller";
import { ProspeccaoController } from "./prospeccao.controller";

/**
 * O cadastro de interesse do site público (ADR-107). Prisma e Auth são globais.
 *
 * DOIS controllers, e a separação é a decisão: `prospeccao/publico/*` não tem
 * guard nenhum e `prospeccao/cadastros/*` é `@Roles("admin")`. Prefixos
 * diferentes para que nenhuma rota nova nasça do lado errado por descuido de
 * caminho — e para que o BFF do hub possa liberar um sem liberar o outro.
 */
@Module({
  controllers: [ProspeccaoPublicoController, ProspeccaoController],
})
export class ProspeccaoModule {}
