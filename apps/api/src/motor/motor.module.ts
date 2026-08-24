import { Module } from "@nestjs/common";
import { PostsController } from "./posts.controller";
import { RunsController } from "./runs.controller";

/**
 * O plano OPERACIONAL do exercício: runs, eventos do motor (síncronos — dwell
 * NUNCA via Pub/Sub), feed curado, fases, dossiê. A telemetria analítica é
 * outro canal (TelemetryModule) de propósito.
 */
@Module({ controllers: [RunsController, PostsController] })
export class MotorModule {}
