import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { EfeitoAmplificadorProfessorController } from "./efeito-amplificador-professor.controller";
import { EfeitoAmplificadorTurmasController } from "./efeito-amplificador-turmas.controller";
import { EfeitoAmplificadorController } from "./efeito-amplificador.controller";
import { EfeitoAmplificadorService } from "./efeito-amplificador.service";
import { PodcastDaExp02em1b } from "./podcast-fonte";
import { PreparoDaExp02em1bService } from "./preparo.service";

/**
 * Lado server da exp02em1b — O Efeito Amplificador (ADR-181). Prisma e Auth são
 * globais; `PodcastService` também (ADR-150).
 *
 * **`EvidenciasModule`**: a missão tem ficha (E14) e marca as quatro
 * habilidades dentro das transações dos gestos. **`AiModule`** entra numa
 * superfície só, e nenhuma durante a aula: o rascunho do pacote no preparo do
 * professor (`preparo.service.ts`).
 */
@Module({
  imports: [AiModule, EvidenciasModule],
  controllers: [EfeitoAmplificadorController, EfeitoAmplificadorTurmasController, EfeitoAmplificadorProfessorController],
  providers: [EfeitoAmplificadorService, PreparoDaExp02em1bService, PodcastDaExp02em1b],
  exports: [EfeitoAmplificadorService],
})
export class EfeitoAmplificadorModule {}
