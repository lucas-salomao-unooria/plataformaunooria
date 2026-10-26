import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AssetsModule } from "../assets/assets.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { EnigmaCapaProfessorController } from "./enigma-capa-professor.controller";
import { EnigmaCapaTurmasController } from "./enigma-capa-turmas.controller";
import { EnigmaCapaController } from "./enigma-capa.controller";
import { EnigmaCapaService } from "./enigma-capa.service";
import { PodcastDaExp02ef1b } from "./podcast-fonte";
import { PreparoDaExp02ef1bService } from "./preparo.service";

/**
 * Lado server da exp02ef1b — O Enigma da Capa da Rádio (ADR-184). Prisma e
 * Auth são globais; `PodcastService` também (ADR-150).
 *
 * **`EvidenciasModule`**: a missão tem ficha (E14) e marca as duas habilidades
 * dentro das transações dos gestos. Sem `registrarContexto`: a ficha não tem
 * pergunta (100% Canal A), e o resolvedor só serve às perguntas.
 * **`AiModule`** e **`AssetsModule`**: o preparo do professor (o texto e a
 * panorâmica da cena gerada, salva no bucket de mídia). Não há IA na aula.
 */
@Module({
  imports: [AiModule, AssetsModule, EvidenciasModule],
  controllers: [EnigmaCapaController, EnigmaCapaTurmasController, EnigmaCapaProfessorController],
  providers: [EnigmaCapaService, PreparoDaExp02ef1bService, PodcastDaExp02ef1b],
  exports: [EnigmaCapaService],
})
export class EnigmaCapaModule {}
