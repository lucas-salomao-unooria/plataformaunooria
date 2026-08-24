import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { PubSub } from "@google-cloud/pubsub";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";

const BatchSchema = z.object({
  eventos: z.array(z.object({
    eventId: z.string().uuid(),
    ts: z.string(),
    expId: z.string(),
    expVersion: z.string(),
    sessaoId: z.string(),
    verbo: z.string(),
    objeto: z.string(),
    resultado: z.record(z.unknown()).optional(),
    contexto: z.record(z.unknown()).optional(),
  })).max(50),
});

const pubsub = new PubSub();
const topic = process.env.TELEMETRIA_TOPIC ?? "";

@Controller("telemetry")
export class TelemetryController {
  @Post("batch")
  @UseGuards(OidcGuard)
  async batch(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const { eventos } = BatchSchema.parse(body);
    // identidade vem do TOKEN, nunca do payload do client (anti-spoof)
    const enriched = eventos.map((e) => ({ ...e, alunoId: req.auth.alunoId, escolaId: req.auth.escolaId }));
    if (topic) {
      await pubsub.topic(topic).publishMessage({ json: { eventos: enriched } });
    } else {
      console.log("[telemetria/dev]", enriched.length, "eventos"); // sem Pub/Sub em dev local
    }
    return { ok: true, recebidos: enriched.length };
  }
}
