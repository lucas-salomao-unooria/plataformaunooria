import { Module } from "@nestjs/common";
import { EquipesEstudanteController } from "./equipes-estudante.controller";
import { EquipesProfessorController } from "./equipes-professor.controller";
import { EquipesService } from "./equipes.service";

/**
 * As equipes na missão (E13, ADR-111): quem divide um computador. Prisma e
 * Auth são módulos globais.
 *
 * Exporta o `EquipesService` por UMA razão: o módulo de uma missão com lados
 * (o Instanooria) o injeta para chamar `registrarFonteDeGrupo` na subida. As
 * LEITURAS que os painéis fazem não passam por aqui — são as funções livres de
 * `consulta.ts`, que não pedem import de módulo nenhum.
 */
@Module({
  controllers: [EquipesEstudanteController, EquipesProfessorController],
  providers: [EquipesService],
  exports: [EquipesService],
})
export class EquipesModule {}
