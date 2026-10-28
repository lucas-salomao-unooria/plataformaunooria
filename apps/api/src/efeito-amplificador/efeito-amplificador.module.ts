import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { EfeitoAmplificadorProfessorController } from "./efeito-amplificador-professor.controller";
import { EfeitoAmplificadorTurmasController } from "./efeito-amplificador-turmas.controller";
import { EfeitoAmplificadorController } from "./efeito-amplificador.controller";
import { EfeitoAmplificadorService } from "./efeito-amplificador.service";
import { IaDaAulaDaExp02em1bService } from "./ia-da-aula.service";
import { PodcastDaExp02em1b } from "./podcast-fonte";
import { PreparoDaExp02em1bService } from "./preparo.service";

/**
 * Lado server da exp02em1b — O Efeito Amplificador 2.2.0 (ADR-191, ADR-192).
 * Prisma e Auth são globais; `PodcastService` também (ADR-150).
 *
 * **`EvidenciasModule`**: a missão tem ficha (E14) e marca as quatro
 * habilidades dentro das transações dos gestos. **`AiModule`** entra em duas
 * superfícies: o preparo do professor (`preparo.service.ts`: o pacote e as
 * reações do feed, quota do professor) e a IA da aula
 * (`ia-da-aula.service.ts`: o classificador do chat e a devolutiva, quota do
 * estudante). Nenhuma decide o que a régua lê.
 */
@Module({
  imports: [AiModule, EvidenciasModule],
  controllers: [EfeitoAmplificadorController, EfeitoAmplificadorTurmasController, EfeitoAmplificadorProfessorController],
  providers: [EfeitoAmplificadorService, PreparoDaExp02em1bService, IaDaAulaDaExp02em1bService, PodcastDaExp02em1b],
  exports: [EfeitoAmplificadorService],
})
export class EfeitoAmplificadorModule {}
