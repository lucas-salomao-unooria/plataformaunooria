import { Module } from "@nestjs/common";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { CanalADaTempestade } from "./canal-a.service";
import { UnoogptAgregadoController } from "./unoogpt-agregado.controller";
import { UnoogptTurmasController } from "./unoogpt-turmas.controller";
import { UnoogptController } from "./unoogpt.controller";
import { UnoogptService } from "./unoogpt.service";
import { PodcastDaExp02em1b } from "./podcast-fonte";

/**
 * exp02em1b — a Missão Tempestade.
 *
 * `PrismaModule`, `AuthModule` e `AiModule` são `@Global`: não se importam aqui
 * (ver o comentário em `bemestar.module.ts`).
 *
 * Três controllers, um por PAPEL, e a separação é de segurança, não de estilo:
 * o gestor não tem rota que aceite `estudanteId`, então nenhum método novo o leva à
 * Transcrição de uma criança por descuido.
 */
@Module({
  imports: [EvidenciasModule],
  controllers: [UnoogptController, UnoogptTurmasController, UnoogptAgregadoController],
  providers: [UnoogptService, CanalADaTempestade, PodcastDaExp02em1b],
})
export class UnoogptModule {}
