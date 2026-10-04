import { Module } from "@nestjs/common";
import { EquipesModule } from "../equipes/equipes.module";
import { RosteringModule } from "../rostering/rostering.module";
import { EvidenciasConsolidadoController } from "./evidencias-consolidado.controller";
import { EvidenciasConsolidadoService } from "./evidencias-consolidado.service";
import { EvidenciasEstudanteController } from "./evidencias-estudante.controller";
import { EvidenciasProfessorController } from "./evidencias-professor.controller";
import { EvidenciasService } from "./evidencias.service";

/**
 * A evidência pedagógica (E14): que habilidades da BNCC cada estudante
 * demonstrou numa atividade de uma missão. Prisma e Auth são módulos globais.
 *
 * Importa o `EquipesModule` para registrar o recálculo no gancho
 * `aoMudarEquipes` — a dependência vai SÓ nesse sentido: equipes não sabe que
 * evidência existe.
 *
 * Exporta o `EvidenciasService` porque é a porta das MISSÕES: o módulo de uma
 * missão com ficha o injeta para chamar `marcar` (da transação dele) e
 * `registrarContexto` (na subida).
 *
 * Importa o `RosteringModule` pelo `EscolasService`: o painel de habilidades
 * (F14.7) pergunta a ele se a escola é da regional de quem consulta
 * (`temLotacao`) e qual é essa regional (`regionalDoRelatorio`).
 */
@Module({
  imports: [EquipesModule, RosteringModule],
  controllers: [EvidenciasEstudanteController, EvidenciasProfessorController, EvidenciasConsolidadoController],
  providers: [EvidenciasService, EvidenciasConsolidadoService],
  exports: [EvidenciasService],
})
export class EvidenciasModule {}
