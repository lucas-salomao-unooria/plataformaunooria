import { Module } from "@nestjs/common";
import { AtividadesController } from "./atividades.controller";
import { PodcastDaExp08ef1b } from "./podcast-fonte";

/** O fluxo do PROFESSOR sobre a atividade: criar, ativar, o relógio de etapa
 *  da turma, monitor ao vivo e as duas operações destrutivas. A geração de
 *  conteúdo (destilar/gerar/revisar) vive no GeracaoModule. O podcast de
 *  recapitulação (ADR-156) registra a fonte aqui: as falas são gravadas no
 *  ativar, que é deste módulo. */
@Module({ controllers: [AtividadesController], providers: [PodcastDaExp08ef1b] })
export class AtividadesModule {}
