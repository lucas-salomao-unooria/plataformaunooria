import { Module } from '@nestjs/common';

import { GeracaoController } from './geracao.controller';
import { GeracaoService } from './geracao.service';

/**
 * Pipeline de GERAÇÃO de conteúdo: destilação do antagonismo, personas, lotes
 * de posts, imagens e validação final. PrismaModule, AiModule e AssetsModule
 * são @Global — nada a importar aqui.
 *
 * O controller cobre o fluxo do professor sobre o CONTEÚDO (destilar, aprovar
 * o antagonismo, gerar, progresso, grade de revisão e ações de post); o
 * AtividadesModule cobre o ciclo de vida da atividade e o relógio da turma.
 */
@Module({
  controllers: [GeracaoController],
  providers: [GeracaoService],
  exports: [GeracaoService],
})
export class GeracaoModule {}
