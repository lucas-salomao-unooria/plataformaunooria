import { Module } from "@nestjs/common";
import { AgenteProfessorController } from "./agente-professor.controller";
import { AgenteProfessorService } from "./agente-professor.service";

/** O agente de IA do professor. Prisma, Auth e Ai (com a porta `AGENTE_PROFESSOR`) são globais. */
@Module({
  controllers: [AgenteProfessorController],
  providers: [AgenteProfessorService],
})
export class AgenteProfessorModule {}
