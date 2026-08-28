import { Module } from "@nestjs/common";
import { RosteringModule } from "../rostering/rostering.module";
import { UsuariosController } from "./usuarios.controller";
import { UsuariosService } from "./usuarios.service";

/** `RosteringModule` porque a importação por CSV mora lá — aqui só delega. */
@Module({
  imports: [RosteringModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
