import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import {
  AlunosController,
  EscolasController,
  LotacoesController,
} from "./escolas.controller";
import { EscolasService } from "./escolas.service";
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
    EscolasController,
    LotacoesController,
    AlunosController,
    RosteringController,
    TurmasController,
    MatriculasController,
    PeriodosLetivosController,
  ],
  providers: [RosteringService, OneRosterService, EscolasService],
  exports: [RosteringService, OneRosterService, EscolasService],
})
export class RosteringModule {}
