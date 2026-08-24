import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiController } from "./ai.controller";
import { AI_PROVIDER } from "./provider";
import { MockProvider } from "./mock.provider";
import { QuotaService } from "./quota.service";
import { VertexProvider } from "./vertex.provider";

/** Global: o MotorModule (reações ao vivo) e o GeracaoModule injetam o
 *  provider pelo token AI_PROVIDER — nenhum deles conhece o vendor. */
@Global()
@Module({
  controllers: [AiController],
  providers: [
    QuotaService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get("AI_PROVIDER") === "mock" ? new MockProvider() : new VertexProvider(),
    },
  ],
  exports: [AI_PROVIDER, QuotaService],
})
export class AiModule {}
