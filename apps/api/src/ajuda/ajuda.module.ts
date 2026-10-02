import { Module } from "@nestjs/common";
import { AjudaLlmController } from "./ajuda-llm.controller";
import { AjudaController } from "./ajuda.controller";
import { AjudaService } from "./ajuda.service";

/**
 * A Ajuda com avatar (ADR-132). Prisma, Auth e Ai (com as portas `AI_PROVIDER`
 * e `AVATAR_AO_VIVO`) são globais. O `AjudaLlmController` vem primeiro: as duas
 * classes moram sob `/ajuda`, e a de rota literal (`/ajuda/llm/*`) registrada
 * antes da de parâmetro é o hábito que evita a armadilha de `/planos/:id`.
 */
@Module({
  controllers: [AjudaLlmController, AjudaController],
  providers: [AjudaService],
})
export class AjudaModule {}
