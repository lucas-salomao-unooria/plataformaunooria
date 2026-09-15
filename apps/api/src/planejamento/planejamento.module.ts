import { Module } from "@nestjs/common";
import { CurriculoController } from "./curriculo.controller";
import { PlanejamentoController } from "./planejamento.controller";
import { PlanejamentoService } from "./planejamento.service";

/**
 * Lado server da exp-92-plano-de-ensino. Prisma, Auth, Ai e Storage são módulos
 * globais.
 *
 * O catálogo curricular tem controller próprio e SEM serviço: é leitura pura do
 * dado extraído dos PDFs oficiais — sem banco e sem tenancy, porque a BNCC é a
 * mesma em toda escola do país. Manter a fronteira visível evita que uma rota
 * nova de escrita nasça do lado que não tem `comTenancy`.
 *
 * Ordem dos controllers importa: `planejamento/curriculo/*` antes do resto,
 * mesmo motivo do `planos.module.ts` — o Express casa a primeira rota que serve.
 */
@Module({
  controllers: [CurriculoController, PlanejamentoController],
  providers: [PlanejamentoService],
  exports: [PlanejamentoService],
})
export class PlanejamentoModule {}
