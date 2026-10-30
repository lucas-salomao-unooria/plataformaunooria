import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { DossieInvisivelController, DossieInvisivelProfessorController, DossieInvisivelTurmasController } from "./dossie-invisivel.controller";
import { DossieInvisivelService } from "./dossie-invisivel.service";
import { IaDaAulaDaExp09ef1bService, PreparoDaExp09ef1bService } from "./ia.service";
import { PodcastDaExp09ef1b } from "./podcast";

/**
 * Lado server da exp09ef1b — O Dossiê Invisível (ADR-202). Prisma e Auth são
 * globais; `PodcastService` também (ADR-150).
 *
 * **`EvidenciasModule`**: a ficha (E14) e as marcas da EF09CO07 e da
 * EF09CO08 dentro das transações dos gestos. **`AiModule`** em duas
 * superfícies: o preparo do professor (quota do professor) e o classificador
 * do chat da aula (quota do estudante; a fala é sempre do catálogo). Missão
 * INDIVIDUAL: sem equipe (E13).
 */
@Module({
  imports: [AiModule, EvidenciasModule],
  controllers: [DossieInvisivelController, DossieInvisivelTurmasController, DossieInvisivelProfessorController],
  providers: [DossieInvisivelService, PreparoDaExp09ef1bService, IaDaAulaDaExp09ef1bService, PodcastDaExp09ef1b],
  exports: [DossieInvisivelService],
})
export class DossieInvisivelModule {}
