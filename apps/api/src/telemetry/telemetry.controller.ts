import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { PubSub } from "@google-cloud/pubsub";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { TokenService } from "../auth/token.service";
import { PrismaService } from "../prisma/prisma.service";

const EventoSchema = z.object({
  eventId: z.string().uuid(),
  ts: z.string(),
  expId: z.string(),
  expVersion: z.string(),
  sessaoId: z.string(),
  verbo: z.string(),
  objeto: z.string(),
  resultado: z.record(z.unknown()).optional(),
  contexto: z.record(z.unknown()).optional(),
});

const BatchSchema = z.object({ eventos: z.array(EventoSchema).max(50) });

/**
 * Beacon: o `navigator.sendBeacon` do `pagehide` NÃO envia headers, então o
 * token vem no CORPO. Sem guard — a verificação é feita à mão pelo
 * TokenService, com o mesmo rigor.
 */
const BeaconSchema = BatchSchema.extend({
  beacon: z.literal(true).optional(),
  token: z.string().min(1),
});

/** Envelope de push subscription do Pub/Sub. */
const PushSchema = z.object({
  message: z.object({ data: z.string().optional(), messageId: z.string().optional() }),
  subscription: z.string().optional(),
});

const pubsub = new PubSub();
const topic = process.env.TELEMETRIA_TOPIC ?? "";

@Controller("telemetry")
export class TelemetryController {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  private async publicar(eventos: unknown[]): Promise<number> {
    if (topic) {
      await pubsub.topic(topic).publishMessage({ json: { eventos } });
    } else {
      console.info("[telemetria/dev]", eventos.length, "eventos"); // sem Pub/Sub em dev local
    }
    return eventos.length;
  }

  @Post("batch")
  @UseGuards(OidcGuard)
  async batch(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const { eventos } = BatchSchema.parse(body);
    // identidade vem do TOKEN, nunca do payload do client (anti-spoof)
    const enriched = eventos.map((e) => ({ ...e, alunoId: req.auth.usuarioId, escolaId: req.auth.escolaId }));
    return { ok: true, recebidos: await this.publicar(enriched) };
  }

  /**
   * Último lote de uma sessão que está fechando. Responde 204 SEMPRE: o
   * browser já descartou a página e ninguém lê o corpo — erro aqui só serviria
   * para poluir log do cliente. Falha de verificação vira descarte silencioso
   * (com aviso no servidor).
   */
  @Post("beacon")
  @HttpCode(204)
  async beacon(@Body() body: unknown) {
    const parsed = BeaconSchema.safeParse(body);
    if (!parsed.success) {
      console.warn("[telemetria/beacon] corpo inválido — descartado");
      return;
    }
    try {
      const auth = await this.tokens.verificar(parsed.data.token);
      const enriched = parsed.data.eventos.map((e) => ({
        ...e,
        alunoId: auth.usuarioId,
        escolaId: auth.escolaId,
      }));
      await this.publicar(enriched);
    } catch {
      console.warn("[telemetria/beacon] token inválido — descartado");
    }
  }

  /**
   * Consumo da PUSH SUBSCRIPTION do Pub/Sub: grava em `telemetria_eventos`.
   *
   * Push (e não um worker próprio) porque é uma peça a menos para operar — o
   * `{contrato}-telemetry-worker` do docs/INFRA.md fica adiado. O endpoint é
   * protegido pelo OIDC token que o Pub/Sub envia no Authorization; em dev,
   * sem `TELEMETRIA_TOPIC`, nada chega aqui.
   *
   * `ON CONFLICT DO NOTHING` no `event_id`: o Pub/Sub garante *at least once*,
   * então reentrega é rotina, não exceção.
   */
  @Post("ingest")
  @HttpCode(204)
  async ingest(@Body() body: unknown) {
    const envelope = PushSchema.safeParse(body);
    if (!envelope.success || !envelope.data.message.data) {
      console.warn("[telemetria/ingest] envelope inválido — descartado");
      return;
    }

    let eventos: unknown;
    try {
      const cru = Buffer.from(envelope.data.message.data, "base64").toString("utf8");
      eventos = (JSON.parse(cru) as { eventos?: unknown }).eventos;
    } catch {
      console.warn("[telemetria/ingest] payload ilegível — descartado");
      return;
    }

    const lote = z
      .array(EventoSchema.extend({ alunoId: z.string(), escolaId: z.string() }))
      .safeParse(eventos);
    if (!lote.success) {
      console.warn("[telemetria/ingest] lote inválido — descartado");
      return;
    }

    // Agrupa por escola: cada grupo grava na sua própria tenancy (RLS).
    const porEscola = new Map<string, typeof lote.data>();
    for (const evento of lote.data) {
      porEscola.set(evento.escolaId, [...(porEscola.get(evento.escolaId) ?? []), evento]);
    }

    for (const [escolaId, doGrupo] of porEscola) {
      await this.prisma.comTenancy(async (tx) => {
        for (const e of doGrupo) {
          await tx.$executeRaw`
            INSERT INTO telemetria_eventos
              (event_id, ts, escola_id, aluno_id, exp_id, exp_version, sessao_id, verbo, objeto, resultado, contexto)
            VALUES (${e.eventId}::uuid, ${new Date(e.ts)}, ${e.escolaId}, ${e.alunoId}, ${e.expId},
                    ${e.expVersion}, ${e.sessaoId}::uuid, ${e.verbo}, ${e.objeto},
                    ${JSON.stringify(e.resultado ?? null)}::jsonb, ${JSON.stringify(e.contexto ?? null)}::jsonb)
            ON CONFLICT (event_id) DO NOTHING`;
        }
      }, escolaId);
    }
  }
}
