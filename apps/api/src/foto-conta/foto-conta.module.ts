import { Module } from "@nestjs/common";
import { FotoContaTurmasController } from "./foto-conta-turmas.controller";
import { FotoContaController } from "./foto-conta.controller";
import { FotoContaService } from "./foto-conta.service";
import { IaDaFotoContaService } from "./ia.service";

/**
 * Lado server da exp-04-o-que-a-foto-conta. Prisma, Auth e Ai são globais.
 *
 * Dois serviços, e a separação é de responsabilidade (molde do
 * o-eco-no-grupo): `FotoContaService` é o estado da missão e não sabe falar
 * com modelo nenhum; `IaDaFotoContaService` é a preparação docente — a única
 * superfície de IA, que falha para o banco curado padrão.
 */
@Module({
  controllers: [FotoContaController, FotoContaTurmasController],
  providers: [FotoContaService, IaDaFotoContaService],
  exports: [FotoContaService],
})
export class FotoContaModule {}
