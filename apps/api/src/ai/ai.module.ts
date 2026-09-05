import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiController } from "./ai.controller";
import { AI_PROVIDER } from "./provider";
import { MockProvider } from "./mock.provider";
import { QuotaService } from "./quota.service";
import { VertexProvider } from "./vertex.provider";
import { Metricas } from "../observabilidade/metricas";
import { MedidorDeProvider } from "./medidor.provider";

/** Global: o MotorModule (reações ao vivo) e o GeracaoModule injetam o
 *  provider pelo token AI_PROVIDER — nenhum deles conhece o vendor. */
@Global()
@Module({
  controllers: [AiController],
  providers: [
    QuotaService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService, Metricas],
      // O provider real (Vertex ou mock) sai embrulhado no `MedidorDeProvider`:
      // é a ÚNICA porta de IA, então é o único lugar onde latência, tokens e
      // finishReason precisam ser medidos (cap. 17). Os consumidores não sabem.
      useFactory: (config: ConfigService, metricas: Metricas) =>
        new MedidorDeProvider(
          config.get("AI_PROVIDER") === "mock" ? new MockProvider() : new VertexProvider(),
          metricas,
          {
            padrao: config.get<string>("VERTEX_MODEL") ?? "gemini-3.6-flash",
            longo: config.get<string>("VERTEX_MODEL_LONGO") ?? "gemini-3.6-flash",
            imagem: config.get<string>("VERTEX_IMAGE_MODEL") ?? "gemini-3.1-flash-image",
            voz: config.get<string>("VERTEX_TTS_MODEL") ?? "gemini-2.5-flash-tts",
          },
        ),
    },
  ],
  exports: [AI_PROVIDER, QuotaService],
})
export class AiModule {}
