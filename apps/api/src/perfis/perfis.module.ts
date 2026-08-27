import { Module } from "@nestjs/common";
import { VilaModule } from "../vila/vila.module";
import { PerfisController, PerfisImportacaoController } from "./perfis.controller";

/**
 * Ato 1 (PERFIS): a conferência/distribuição da turma pelo professor e a ponte
 * do jogo externo. Dois controllers porque a autenticação é diferente — o do
 * professor passa por OidcGuard, o do jogo é por chave de serviço no header e
 * fica FORA de guards (ver `perfis.controller.ts`).
 */
/* `VilaModule` entra porque o Ato 1 deixou de ser externo: `POST
   :id/perfis/da-vila` lê o perfil da exp-70 pelo `VilaService`. A dependência é
   nesta direção e não na contrária — `perfis` é dono de `exp_01_exp_70_perfis_importados`, e
   `vila` não sabe que o Instanooria existe. */
@Module({
  imports: [VilaModule],
  controllers: [PerfisController, PerfisImportacaoController],
})
export class PerfisModule {}
