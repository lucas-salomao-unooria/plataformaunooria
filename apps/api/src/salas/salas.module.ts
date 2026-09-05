import { Module } from "@nestjs/common";
import { SalasEstudanteController } from "./salas-estudante.controller";
import { SalasProfessorController } from "./salas-professor.controller";
import { SalasService } from "./salas.service";

/**
 * A sala de aula (ADR-69): a turma como contexto do que existe para fazer.
 * Prisma e Auth são módulos globais.
 *
 * Módulo de PLATAFORMA, não de experiência — ele não conhece missão nenhuma pelo
 * nome. A guarda que as experiências chamam mora em `comum/liberacao.ts`, não
 * aqui: fosse um provider deste módulo, cada módulo de experiência teria de
 * importá-lo, e uma dependência esquecida viraria uma porta aberta em silêncio.
 */
@Module({
  controllers: [SalasEstudanteController, SalasProfessorController],
  providers: [SalasService],
  exports: [SalasService],
})
export class SalasModule {}
