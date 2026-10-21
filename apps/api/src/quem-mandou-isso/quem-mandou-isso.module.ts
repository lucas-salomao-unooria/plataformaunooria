import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { PodcastDaExp05ef1b } from "./podcast-fonte";
import { PreparoDaExp05ef1bService } from "./preparo.service";
import { QuemMandouIssoProfessorController } from "./quem-mandou-isso-professor.controller";
import { QuemMandouIssoTurmasController } from "./quem-mandou-isso-turmas.controller";
import { QuemMandouIssoController } from "./quem-mandou-isso.controller";
import { QuemMandouIssoService } from "./quem-mandou-isso.service";

/**
 * Lado server da exp05ef1b v2.2 — Quem Mandou Isso? Prisma e Auth são globais.
 *
 * `AiModule` entra, e a fronteira dele é estreita: a IA existe numa superfície
 * só (o preparo pré-aula, `PreparoDaExp05ef1bService`), e a aula é 100%
 * determinística.
 *
 * `EvidenciasModule` entra porque esta é uma missão COM ficha (E14): o serviço
 * marca a EF05CO08 na transação do Mural e registra o contexto das perguntas
 * no `onModuleInit`. As equipes (E13) não precisam de módulo: `equipes/
 * consulta.ts` são funções livres com `tx`.
 *
 * `PodcastService` (global) é o podcast de recapitulação da plataforma (ADR-150): a
 * missão registra a fonte (`podcast-fonte.ts`) e a aprovação grava as falas
 * do tema que o professor revisou.
 */
@Module({
  imports: [AiModule, EvidenciasModule],
  controllers: [QuemMandouIssoController, QuemMandouIssoTurmasController, QuemMandouIssoProfessorController],
  providers: [QuemMandouIssoService, PreparoDaExp05ef1bService, PodcastDaExp05ef1b],
})
export class QuemMandouIssoModule {}
