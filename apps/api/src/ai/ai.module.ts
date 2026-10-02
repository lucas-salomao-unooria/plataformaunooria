import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiController } from "./ai.controller";
import { AI_PROVIDER } from "./provider";
import { MockProvider } from "./mock.provider";
import { QuotaService } from "./quota.service";
import { VertexProvider } from "./vertex.provider";
import { Metricas } from "../observabilidade/metricas";
import { MedidorDeProvider } from "./medidor.provider";
import { AGENTE_PROFESSOR, type ModoDoAgente } from "./agente-professor.port";
import { criarAgenteProfessor } from "./agent-engine.client";
import { AVATAR_AO_VIVO } from "./avatar-ao-vivo.port";
import { criarAvatarAoVivo } from "./liveavatar.client";

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
    {
      /* O agente de IA do professor (Agent Engine). Porta separada do
         `AI_PROVIDER`: aqui o modelo e as ferramentas moram no agente, e a api
         só conduz a sessão. As envs já passaram pelo Zod do boot. */
      provide: AGENTE_PROFESSOR,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        criarAgenteProfessor({
          modo: config.get<ModoDoAgente>("AGENTE_PROFESSOR_MODO") ?? "desligado",
          engine: config.get<string>("AGENTE_PROFESSOR_ENGINE"),
          urlLocal: config.get<string>("AGENTE_PROFESSOR_URL_LOCAL"),
        }),
    },
    {
      /* O avatar da Ajuda (ADR-132). Sem o conjunto completo de envs a porta
         nasce DESLIGADA e a Ajuda responde 503 — nunca derruba a subida. */
      provide: AVATAR_AO_VIVO,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        criarAvatarAoVivo({
          apiKey: config.get<string>("LIVEAVATAR_API_KEY"),
          apiUrl: config.get<string>("LIVEAVATAR_API_URL") ?? "https://api.liveavatar.com",
          avatarId: config.get<string>("LIVEAVATAR_AVATAR_ID") ?? "dc2935cf-5863-4f08-943b-c7478aea59fb",
          voiceId: config.get<string>("LIVEAVATAR_VOICE_ID"),
          contextId: config.get<string>("LIVEAVATAR_CONTEXT_ID"),
          llmConfigId: config.get<string>("LIVEAVATAR_LLM_CONFIG_ID"),
          sandbox: config.get<string>("LIVEAVATAR_SANDBOX") === "1",
        }),
    },
  ],
  exports: [AI_PROVIDER, QuotaService, AGENTE_PROFESSOR, AVATAR_AO_VIVO],
})
export class AiModule {}
