import { Module } from "@nestjs/common";
import { VilaAgregadoController, VilaProfessorController } from "./vila-professor.controller";
import { VilaController } from "./vila.controller";
import { VilaService } from "./vila.service";

/** Lado server da app-70-vila-do-lume. Prisma, Config e Auth são globais. */
@Module({
  controllers: [VilaController, VilaAgregadoController, VilaProfessorController],
  providers: [VilaService],
  exports: [VilaService],
})
export class VilaModule {}
