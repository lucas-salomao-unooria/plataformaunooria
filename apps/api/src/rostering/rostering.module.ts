import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OneRosterService } from "./oneroster.service";
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
  providers: [RosteringService, OneRosterService],
  exports: [RosteringService, OneRosterService],
})
export class RosteringModule {}
