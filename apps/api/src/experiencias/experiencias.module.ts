import { Module } from "@nestjs/common";
import { ExperienciasController } from "./experiencias.controller";

@Module({ controllers: [ExperienciasController] })
export class ExperienciasModule {}
