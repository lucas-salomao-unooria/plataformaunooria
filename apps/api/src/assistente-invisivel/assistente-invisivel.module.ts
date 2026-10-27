import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { SalasModule } from "../salas/salas.module";
import { AssistenteInvisivelProfessorController } from "./assistente-invisivel-professor.controller";
import { AssistenteInvisivelTurmasController } from "./assistente-invisivel-turmas.controller";
import { AssistenteInvisivelController } from "./assistente-invisivel.controller";
import { AssistenteInvisivelService } from "./assistente-invisivel.service";
import { PodcastDaExp01em1b } from "./podcast-fonte";
import { PreparoDaExp01em1bService } from "./preparo.service";

/**
 * Lado server da exp01em1b — O Assistente Invisível (ADR-185). Prisma e Auth
 * são globais; `PodcastService` também (ADR-150).
 *
 * **`EvidenciasModule`**: a missão tem ficha (E14) e marca as quatro
 * habilidades na transação do Publicar (e no Encerrar). Sem
 * `registrarContexto`: a ficha não tem pergunta (100% Canal A).
 * **`AiModule`**: o preparo do professor (o pacote e o "Regenerar Este
 * Item"). Não há IA na aula.
 * **`SalasModule`**: o "Encerrar" da missão na Sala de Aula marca quem apostou
 * e não publicou (`SalasService.aoEncerrarMissao`, ADR-154).
 */
@Module({
  imports: [AiModule, EvidenciasModule, SalasModule],
  controllers: [AssistenteInvisivelController, AssistenteInvisivelTurmasController, AssistenteInvisivelProfessorController],
  providers: [AssistenteInvisivelService, PreparoDaExp01em1bService, PodcastDaExp01em1b],
  exports: [AssistenteInvisivelService],
})
export class AssistenteInvisivelModule {}
