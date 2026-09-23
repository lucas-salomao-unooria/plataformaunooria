import { Module } from "@nestjs/common";
import { RastroBoatoProfessorController } from "./rastro-boato-professor.controller";
import { RastroBoatoTurmasController } from "./rastro-boato-turmas.controller";
import { RastroBoatoController } from "./rastro-boato.controller";
import { RastroBoatoService } from "./rastro-boato.service";

/**
 * Lado server da exp06ef2b. Prisma e Auth são globais.
 *
 * **Sem `AiModule` e sem `AssetsModule`, e a ausência é o desenho.** A missão é
 * 100% determinística (RNF-CUST-001: zero tokens): reações, topologia e
 * validação do ciclo saem do catálogo e das regras puras. Um `IaService` aqui
 * seria custo e um ponto de falha estocástico dentro de uma aula de 35 minutos.
 */
@Module({
  controllers: [RastroBoatoController, RastroBoatoTurmasController, RastroBoatoProfessorController],
  providers: [RastroBoatoService],
  exports: [RastroBoatoService],
})
export class RastroBoatoModule {}
