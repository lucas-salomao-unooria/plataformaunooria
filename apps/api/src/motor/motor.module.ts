import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { LeituraDaReflexaoService } from "./canal-a/leitura-da-reflexao.service";
import { TarefasDoUnoovista } from "./canal-a/tarefas.service";
import { PostsController } from "./posts.controller";
import { RunsController } from "./runs.controller";
import { TarefasController } from "./tarefas.controller";

/**
 * O plano OPERACIONAL do exercício: runs, eventos do motor (síncronos — dwell
 * NUNCA via Pub/Sub), feed curado, fases, dossiê. A telemetria analítica é
 * outro canal (TelemetryModule) de propósito.
 *
 * E o Canal A da evidência pedagógica (E14, ADR-167): as tarefas 6a, 6b e 6c
 * (`TarefasController`) e a leitura da reflexão pela IA, que marcam pela porta
 * `EvidenciasService.marcar`. O `AiModule` entra pela leitura da reflexão
 * (quota do perfil `estudante` antes e depois) e pelas reações das personas.
 */
@Module({
  imports: [AiModule, EvidenciasModule],
  controllers: [RunsController, TarefasController, PostsController],
  providers: [TarefasDoUnoovista, LeituraDaReflexaoService],
})
export class MotorModule {}
