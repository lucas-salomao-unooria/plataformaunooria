import { Module } from "@nestjs/common";
import { AjudaLlmController } from "./ajuda-llm.controller";
import { AjudaController } from "./ajuda.controller";
import { AjudaService } from "./ajuda.service";
import { MascoteAoVivo } from "./mascote-ao-vivo";

/**
 * A Ajuda (ADR-132, ADR-158). Prisma, Auth e Ai (com as portas `AI_PROVIDER`,
 * `AVATAR_AO_VIVO` e `VOZ_AO_VIVO`) são globais. O `AjudaLlmController` vem primeiro: as duas
 * classes moram sob `/ajuda`, e a de rota literal (`/ajuda/llm/*`) registrada
 * antes da de parâmetro é o hábito que evita a armadilha de `/planos/:id`.
 */
@Module({
  controllers: [AjudaLlmController, AjudaController],
  // `MascoteAoVivo` pendura a conexão de voz do mascote (ADR-158) no servidor HTTP.
  providers: [AjudaService, MascoteAoVivo],
})
export class AjudaModule {}
