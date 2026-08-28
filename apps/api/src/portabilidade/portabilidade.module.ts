import { Module } from "@nestjs/common";
import { RosteringModule } from "../rostering/rostering.module";
import { PortabilidadeController } from "./portabilidade.controller";
import { PortabilidadeService } from "./portabilidade.service";

/**
 * Perfil portátil — a saída da criança da REDE (ver `catalogo.ts`).
 *
 * Depende do `RosteringModule` por uma coisa só: saber em que escola o aluno
 * está HOJE, que é a tranca da emissão.
 */
@Module({
  imports: [RosteringModule],
  controllers: [PortabilidadeController],
  providers: [PortabilidadeService],
  exports: [PortabilidadeService],
})
export class PortabilidadeModule {}
