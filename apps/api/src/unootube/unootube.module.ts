import { Module } from "@nestjs/common";
import { UnootubeProfessorController } from "./unootube-professor.controller";
import { UnootubeTurmasController } from "./unootube-turmas.controller";
import { UnootubeController } from "./unootube.controller";
import { UnootubeService } from "./unootube.service";

/** Lado server da exp-02-unootube. Prisma e Auth são módulos globais. */
@Module({
  controllers: [UnootubeController, UnootubeTurmasController, UnootubeProfessorController],
  providers: [UnootubeService],
  exports: [UnootubeService],
})
export class UnootubeModule {}
