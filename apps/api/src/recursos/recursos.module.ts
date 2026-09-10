import { Module } from "@nestjs/common";
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
@Module({ controllers: [RecursosController] })
export class RecursosModule {}
