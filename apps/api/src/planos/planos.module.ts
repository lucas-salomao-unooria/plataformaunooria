import { Module } from "@nestjs/common";
import { PlanosController } from "./planos.controller";
import { PlanosService } from "./planos.service";
import { ReferenciasController } from "./referencias.controller";

/**
 * Lado server da exp-90-plano-de-aula. Prisma, Auth, Ai e Storage são
 * módulos globais. Ordem dos controllers importa: `planos/referencias/*` antes
 * de `planos/:id` para o Express não casar "referencias" como id.
 */
@Module({
  controllers: [ReferenciasController, PlanosController],
  providers: [PlanosService],
  exports: [PlanosService],
})
export class PlanosModule {}
