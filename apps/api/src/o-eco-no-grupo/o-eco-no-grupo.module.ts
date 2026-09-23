import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { IaDaExp07ef1bService } from "./ia.service";
import { MidiaDaExp07ef1bService } from "./midia.service";
import { OEcoNoGrupoProfessorController } from "./o-eco-no-grupo-professor.controller";
import { OEcoNoGrupoTurmasController } from "./o-eco-no-grupo-turmas.controller";
import { OEcoNoGrupoController } from "./o-eco-no-grupo.controller";
import { OEcoNoGrupoService } from "./o-eco-no-grupo.service";

/**
 * Lado server da exp07ef1b. Prisma, Auth e Ai são globais; o
 * `AssetsModule` entra porque a mídia gerada vai para o bucket público.
 *
 * Três serviços, e a separação é de responsabilidade: `OEcoNoGrupoService` é o
 * estado da missão (e não sabe falar com modelo nenhum), `IaDaExp07ef1bService` é
 * onde o modelo escreve falas, e `MidiaDaExp07ef1bService` é o preparo da voz e da
 * foto. Só o primeiro toca o banco da missão.
 */
@Module({
  imports: [AssetsModule],
  controllers: [OEcoNoGrupoController, OEcoNoGrupoTurmasController, OEcoNoGrupoProfessorController],
  providers: [OEcoNoGrupoService, IaDaExp07ef1bService, MidiaDaExp07ef1bService],
  exports: [OEcoNoGrupoService],
})
export class OEcoNoGrupoModule {}
