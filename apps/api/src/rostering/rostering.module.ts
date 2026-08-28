import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RosteringController } from "./rostering.controller";
import { RosteringService } from "./rostering.service";
import {
  MatriculasController,
  PeriodosLetivosController,
  TurmasController,
} from "./turmas.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    RosteringController,
    TurmasController,
    MatriculasController,
    PeriodosLetivosController,
  ],
  providers: [RosteringService],
  exports: [RosteringService],
})
export class RosteringModule {}
