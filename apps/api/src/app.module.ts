import { Module } from "@nestjs/common";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { ProgressoModule } from "./progress/progresso.module";
import { AiModule } from "./ai/ai.module";

@Module({ imports: [TelemetryModule, ProgressoModule, AiModule] })
export class AppModule {}
