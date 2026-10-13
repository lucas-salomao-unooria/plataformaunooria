import { Module } from "@nestjs/common";
import { RecursosAdminController } from "./recursos-admin.controller";
import { RecursosAuditoriaController } from "./recursos-auditoria.controller";
import { QuotasDeIaController } from "./quotas-de-ia.controller";
import { ConfiguracaoDaAjudaController } from "./configuracao-da-ajuda.controller";
import { LimitesDaAjudaController } from "./limites-da-ajuda.controller";
import { RecursosController } from "./recursos.controller";

/**
 * O eixo da DISPONIBILIDADE (ADR-87). Prisma e Auth são módulos globais.
 *
 * Só a leitura por enquanto: a escrita é o painel da Unooria (`admin`, ADR-88),
 * e ela entra com a área `/unooria`. O resolvedor puro (`regras.ts`) e a guarda
 * (`comum/disponibilidade.ts`) não pertencem a este módulo — são usados de
 * dentro de transações de outros, e um serviço injetado obrigaria a passar o
 * `tx` por construtor.
 */
/* Ordem: o de ADMIN primeiro. Ele tem `@Get("painel")` e `@Put(":recursoId")`,
   e o outro tem `@Get("efetivos")` — os três caminhos são distintos, mas
   registrar o de rota literal antes do de parâmetro é o hábito que evita a
   armadilha de `/planos/referencias` contra `/planos/:id`. */
@Module({
  /* `QuotasDeIaController` (ADR-105) vive em `recursos/quotas-de-ia/*` e o
     `LimitesDaAjudaController` (ADR-132) em `recursos/limites-da-ajuda/*`: dois
     segmentos, então não colidem com o `:recursoId` de um segmento do painel. */
  controllers: [QuotasDeIaController, LimitesDaAjudaController, ConfiguracaoDaAjudaController, RecursosAuditoriaController, RecursosAdminController, RecursosController],
})
export class RecursosModule {}
