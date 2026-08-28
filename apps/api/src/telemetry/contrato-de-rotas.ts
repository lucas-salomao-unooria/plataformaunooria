import { z } from "zod";

/**
 * O evento de telemetria — inspirado em xAPI, simplificado.
 *
 * O que o CLIENTE manda é o que ele FEZ. `alunoId` e `escolaId` NÃO estão aqui:
 * a identidade vem do token e é acrescentada no servidor. Aceitá-la do corpo
 * deixaria qualquer bundle gravar evento no nome de outra criança.
 */
export const EventoSchema = z.object({
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

/** Teto de 50 por lote: é o mesmo do flush da SDK (50 eventos ou 10s). */
export const BatchSchema = z.object({ eventos: z.array(EventoSchema).max(50) });

export const BeaconSchema = BatchSchema.extend({
  beacon: z.literal(true).optional(),
  token: z.string().min(1),
});

/** Envelope de push subscription do Pub/Sub — quem monta é o Google. */
export const PushSchema = z.object({
  message: z.object({ data: z.string().optional(), messageId: z.string().optional() }),
  subscription: z.string().optional(),
});

export const BatchRespostaSchema = z.object({
  ok: z.literal(true),
  /** Quantos entraram na publicação, não quantos foram gravados: o canal
   *  analítico é assíncrono, e a gravação acontece do outro lado do Pub/Sub. */
  recebidos: z.number().int().nonnegative(),
});

/** 204 sem corpo. */
export const SemCorpoSchema = z.void();
