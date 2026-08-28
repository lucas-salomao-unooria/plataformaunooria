import { z } from "zod";

/**
 * O progresso é OPACO para a plataforma de propósito.
 *
 * A forma de `dados` é assunto da experiência que o escreveu — descrevê-la aqui
 * obrigaria a api a saber o estado interno de 48 experiências, e a mudar junto
 * a cada uma delas. O que o contrato afirma é o envelope: um objeto JSON, ou
 * `null` quando a criança ainda não começou.
 */
export const DadosDeProgressoSchema = z.record(z.unknown());

export const ProgressoSalvoSchema = z.object({
  dados: DadosDeProgressoSchema.nullable(),
});

export const SalvarSchema = z.object({ dados: DadosDeProgressoSchema });

/** `exp:concluir` do protocolo da bridge. `score` aqui é sinal de progresso —
 *  **não** é nota: pontuação que vale nota é recalculada server-side (regra 3). */
export const ConcluirSchema = z.object({
  score: z.number().optional(),
  dados: DadosDeProgressoSchema.optional(),
});

export const OkSchema = z.object({ ok: z.literal(true) });
