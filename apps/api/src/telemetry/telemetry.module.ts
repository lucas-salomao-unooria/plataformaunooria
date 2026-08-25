import { Module } from "@nestjs/common";
import { TelemetryController } from "./telemetry.controller";
import { PubSubPushGuard } from "./pubsub-push.guard";

@Module({ controllers: [TelemetryController], providers: [PubSubPushGuard] })
export class TelemetryModule {}
