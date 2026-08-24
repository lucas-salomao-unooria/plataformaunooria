import { Module } from "@nestjs/common";
import { AnaliseDaTurmaController, AnaliseDeProdutoController } from "./analise.controller";

/**
 * Análise: o nível PEDAGÓGICO do professor (`/atividades/:id/analise*`) e o
 * nível de PRODUTO do admin-contrato (`/analise/*`). Duas rotas de leitura pura
 * — nada aqui é persistido, tudo é recalculado dos eventos (doc 11 §6).
 */
@Module({ controllers: [AnaliseDaTurmaController, AnaliseDeProdutoController] })
export class AnaliseModule {}
