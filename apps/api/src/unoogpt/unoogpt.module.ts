import { Module } from "@nestjs/common";
import { UnoogptAgregadoController } from "./unoogpt-agregado.controller";
import { UnoogptTurmasController } from "./unoogpt-turmas.controller";
import { UnoogptController } from "./unoogpt.controller";
import { UnoogptService } from "./unoogpt.service";

/**
 * exp-03-unoogpt — a Missão Tempestade.
 *
 * `PrismaModule`, `AuthModule` e `AiModule` são `@Global`: não se importam aqui
 * (ver o comentário em `bemestar.module.ts`).
 *
 * Três controllers, um por PAPEL, e a separação é de segurança, não de estilo:
 * o gestor não tem rota que aceite `estudanteId`, então nenhum método novo o leva à
 * Transcrição de uma criança por descuido.
 */
@Module({
  controllers: [UnoogptController, UnoogptTurmasController, UnoogptAgregadoController],
  providers: [UnoogptService],
})
export class UnoogptModule {}
