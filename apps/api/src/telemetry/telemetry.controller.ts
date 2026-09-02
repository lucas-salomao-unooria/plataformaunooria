import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PubSub } from "@google-cloud/pubsub";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Contrato } from "../openapi/contrato";
import { PubSubPushGuard } from "./pubsub-push.guard";
import { TokenService } from "../auth/token.service";
import { PrismaService } from "../prisma/prisma.service";
import { logger } from "../observabilidade/logger";
import {
  BatchRespostaSchema,
  BatchSchema,
  BeaconSchema,
  EventoSchema,
  PushSchema,
  SemCorpoSchema,
} from "./contrato-de-rotas";

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
      logger.debug({ codigo: "telemetria.sem-topico", eventos: eventos.length }, "sem Pub/Sub: lote não publicado"); // dev local
    }
    return eventos.length;
  }

  @Post("batch")
  @UseGuards(OidcGuard)
  @Contrato({
    resumo: "Recebe um lote do canal ANALÍTICO da SDK.",
    descricao:
      "Publica no Pub/Sub, que entrega em `POST /telemetry/ingest`. É o canal analítico — **não** o operacional: `dwell` e o feed adaptativo do motor passam por `/runs/:id/eventos`, que é síncrono e ordenado.",
    corpo: BatchSchema,
    resposta: BatchRespostaSchema,
    notas: [
      "`estudanteId` e `escolaId` NÃO vêm do corpo: são acrescentados a partir do token. Aceitá-los do cliente deixaria um bundle gravar evento no nome de outra criança.",
      "`recebidos` conta o que foi PUBLICADO, não o que foi gravado — a gravação acontece do outro lado do Pub/Sub.",
    ],
  })
  async batch(@Body() body: unknown, @Req() req: { auth: AuthClaims }) {
    const { eventos } = BatchSchema.parse(body);
    // identidade vem do TOKEN, nunca do payload do client (anti-spoof)
    const enriched = eventos.map((e) => ({
      ...e,
      estudanteId: req.auth.usuarioId,
      escolaId: req.auth.escolaId,
    }));
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
  @Contrato({
    resumo: "Último lote de uma sessão que está fechando.",
    descricao:
      "Chamada no `pagehide` com `navigator.sendBeacon`. **Responde 204 SEMPRE**: a página já foi descartada e ninguém lê o corpo — erro aqui só poluiria o log do cliente. Corpo inválido ou token que não confere viram descarte silencioso, com aviso no servidor.",
    corpo: BeaconSchema,
    resposta: SemCorpoSchema,
    acesso: "token-no-corpo",
  })
  async beacon(@Body() body: unknown) {
    const parsed = BeaconSchema.safeParse(body);
    if (!parsed.success) {
      logger.debug({ codigo: "telemetria.descartado", motivo: "corpo-invalido" }, "lote de telemetria descartado");
      return;
    }
    try {
      const auth = await this.tokens.verificar(parsed.data.token);
      const enriched = parsed.data.eventos.map((e) => ({
        ...e,
        estudanteId: auth.usuarioId,
        escolaId: auth.escolaId,
      }));
      await this.publicar(enriched);
    } catch {
      logger.debug({ codigo: "telemetria.descartado", motivo: "token-invalido" }, "lote de telemetria descartado");
    }
  }

  /**
   * Consumo da PUSH SUBSCRIPTION do Pub/Sub: grava em `telemetria_eventos`.
   *
   * Push (e não um worker próprio) porque é uma peça a menos para operar — o
   * `{contrato}-telemetry-worker` do docs/INFRA.md fica adiado.
   *
   * `PubSubPushGuard` verifica o ID token que o Pub/Sub assina (emissor Google
   * + audience + SA de push). Sem ele a rota seria um endpoint público que
   * escreve dado de estudante com o `escolaId` vindo do corpo. Em dev, sem
   * `TELEMETRIA_TOPIC`, nada chega aqui.
   *
   * `ON CONFLICT DO NOTHING` no `event_id`: o Pub/Sub garante *at least once*,
   * então reentrega é rotina, não exceção.
   */
  @Post("ingest")
  @UseGuards(PubSubPushGuard)
  @HttpCode(204)
  @Contrato({
    resumo: "Consome a push subscription do Pub/Sub e grava os eventos.",
    descricao:
      "Push, e não um worker próprio, é uma peça a menos para operar. Grava em `telemetria_eventos` (particionada por mês, schema `particoes`).",
    corpo: PushSchema,
    resposta: SemCorpoSchema,
    acesso: "push",
    notas: [
      "`ON CONFLICT (event_id, ts) DO NOTHING`: o Pub/Sub entrega *at least once*, então reentrega é rotina, não exceção.",
      "UM INSERT multi-linha por escola, não um por evento — no pico da manhã o laço custava ~800 INSERTs/s.",
      "Sem `TELEMETRIA_PUSH_SA`/`TELEMETRIA_PUSH_AUDIENCE` a rota responde 401, nunca aberta: ela escreve dado de estudante.",
    ],
  })
  async ingest(@Body() body: unknown) {
    const envelope = PushSchema.safeParse(body);
    if (!envelope.success || !envelope.data.message.data) {
      logger.debug({ codigo: "telemetria.descartado", motivo: "envelope-invalido" }, "lote de telemetria descartado");
      return;
    }

    let eventos: unknown;
    try {
      const cru = Buffer.from(envelope.data.message.data, "base64").toString("utf8");
      eventos = (JSON.parse(cru) as { eventos?: unknown }).eventos;
    } catch {
      logger.debug({ codigo: "telemetria.descartado", motivo: "payload-ilegivel" }, "lote de telemetria descartado");
      return;
    }

    const lote = z
      .array(EventoSchema.extend({ estudanteId: z.string().optional(), escolaId: z.string() }))
      .safeParse(eventos);
    if (!lote.success) {
      logger.debug({ codigo: "telemetria.descartado", motivo: "lote-invalido" }, "lote de telemetria descartado");
      return;
    }

    // Agrupa por escola: cada grupo grava na sua própria tenancy (RLS).
    const porEscola = new Map<string, typeof lote.data>();
    for (const evento of lote.data) {
      porEscola.set(evento.escolaId, [...(porEscola.get(evento.escolaId) ?? []), evento]);
    }

    for (const [escolaId, doGrupo] of porEscola) {
      await this.prisma.comTenancy(async (tx) => {
        // UM INSERT multi-linha, não um por evento. É o gargalo real deste
        // caminho: um lote de 50 eventos custava 50 round-trips ao banco, e no
        // pico da manhã (~4k estudantes simultâneos) isso é ~800 INSERTs/s numa
        // instância pequena. Em lote vira ~16/s, que é trivial.
        //
        // Não é caso para Redis: quem amortece o pico já é o Pub/Sub, que ainda
        // por cima é durável — um buffer em memória perderia eventos no
        // processo que morre antes do flush.
        const linhas = doGrupo.map(
          (e) => {
            const estudanteId = e.estudanteId ?? "";
            return Prisma.sql`(
            ${e.eventId}::uuid, ${new Date(e.ts)}, ${e.escolaId}, ${estudanteId}, ${e.expId},
            ${e.expVersion}, ${e.sessaoId}::uuid, ${e.verbo}, ${e.objeto},
            ${JSON.stringify(e.resultado ?? null)}::jsonb, ${JSON.stringify(e.contexto ?? null)}::jsonb)`;
          },
        );
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO telemetria_eventos
            (event_id, ts, escola_id, estudante_id, exp_id, exp_version, sessao_id, verbo, objeto, resultado, contexto)
          VALUES ${Prisma.join(linhas)}
          ON CONFLICT (event_id, ts) DO NOTHING`);
      }, escolaId);
    }
  }
}
