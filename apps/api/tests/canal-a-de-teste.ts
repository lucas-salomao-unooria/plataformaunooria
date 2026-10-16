import type { PrismaClient } from "@prisma/client";
import { EquipesService } from "../src/equipes/equipes.service";
import { EvidenciasService } from "../src/evidencias/evidencias.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { SalasService } from "../src/salas/salas.service";
import { CanalADaTempestade } from "../src/unoogpt/canal-a.service";

/**
 * O Canal A da Missão Tempestade (ADR-172) para as suítes que montam o
 * `UnoogptService` à mão: ele marca a evidência pela porta `marcar`, então
 * precisa de um `EvidenciasService` de verdade (com equipes e salas).
 */
export function canalADeTeste(prisma: PrismaService & PrismaClient): CanalADaTempestade {
  const salas = new SalasService(prisma);
  const evidencias = new EvidenciasService(prisma, new EquipesService(prisma), salas);
  evidencias.onModuleInit();
  return new CanalADaTempestade(prisma, evidencias);
}
