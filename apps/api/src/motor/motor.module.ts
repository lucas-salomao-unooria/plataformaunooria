import { Module } from "@nestjs/common";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { ContextoDaEvidenciaDoUnoovista } from "./contexto-da-evidencia";
import { PostsController } from "./posts.controller";
import { RunsController } from "./runs.controller";

/**
 * O plano OPERACIONAL do exercício: runs, eventos do motor (síncronos — dwell
 * NUNCA via Pub/Sub), feed curado, fases, dossiê. A telemetria analítica é
 * outro canal (TelemetryModule) de propósito.
 *
 * E o contexto da evidência pedagógica (E14): as perguntas da tela final
 * caem na atividade da run, depois da reflexão salva.
 */
@Module({
  imports: [EvidenciasModule],
  controllers: [RunsController, PostsController],
  providers: [ContextoDaEvidenciaDoUnoovista],
})
export class MotorModule {}
