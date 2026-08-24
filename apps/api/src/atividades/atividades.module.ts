import { Module } from "@nestjs/common";
import { AtividadesController } from "./atividades.controller";

/** O fluxo do PROFESSOR sobre a atividade: criar, ativar, o relógio de etapa
 *  da turma, monitor ao vivo e as duas operações destrutivas. A geração de
 *  conteúdo (destilar/gerar/revisar) vive no GeracaoModule. */
@Module({ controllers: [AtividadesController] })
export class AtividadesModule {}
