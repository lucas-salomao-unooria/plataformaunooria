import { Module } from "@nestjs/common";
import { ProgressoController } from "./progresso.controller";
@Module({ controllers: [ProgressoController] })
export class ProgressoModule {}
