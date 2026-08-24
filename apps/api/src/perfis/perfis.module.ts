import { Module } from "@nestjs/common";
import { PerfisController, PerfisImportacaoController } from "./perfis.controller";

/**
 * Ato 1 (PERFIS): a conferência/distribuição da turma pelo professor e a ponte
 * do jogo externo. Dois controllers porque a autenticação é diferente — o do
 * professor passa por OidcGuard, o do jogo é por chave de serviço no header e
 * fica FORA de guards (ver `perfis.controller.ts`).
 */
@Module({ controllers: [PerfisController, PerfisImportacaoController] })
export class PerfisModule {}
