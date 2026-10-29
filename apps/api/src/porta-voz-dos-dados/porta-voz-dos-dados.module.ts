import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { PodcastDaExp03em1b } from "./podcast-fonte";
import { PortaVozDosDadosProfessorController } from "./porta-voz-dos-dados-professor.controller";
import { PortaVozDosDadosTurmasController } from "./porta-voz-dos-dados-turmas.controller";
import { PortaVozDosDadosController } from "./porta-voz-dos-dados.controller";
import { PortaVozDosDadosService } from "./porta-voz-dos-dados.service";
import { PreparoDaExp03em1bService } from "./preparo.service";

/**
 * Lado server da exp03em1b — O Porta-Voz dos Dados (ADR-198). Prisma e Auth
 * são globais; `PodcastService` também (ADR-150).
 *
 * **`EvidenciasModule`**: a missão tem ficha (E14) e marca as seis
 * habilidades dentro das transações dos gestos. **`AiModule`** só no PREPARO
 * do professor (o pacote e o "Regenerar Item", quota do professor): a aula
 * não chama IA. Missão INDIVIDUAL: sem equipe (E13).
 */
@Module({
  imports: [AiModule, EvidenciasModule],
  controllers: [PortaVozDosDadosController, PortaVozDosDadosTurmasController, PortaVozDosDadosProfessorController],
  providers: [PortaVozDosDadosService, PreparoDaExp03em1bService, PodcastDaExp03em1b],
  exports: [PortaVozDosDadosService],
})
export class PortaVozDosDadosModule {}
