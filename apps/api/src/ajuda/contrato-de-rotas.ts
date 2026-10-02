import { HttpException } from "@nestjs/common";
import { z } from "zod";

/**
 * O contrato HTTP da Ajuda com avatar (ADR-132). Dois lados:
 *   - o do HUB (`/ajuda/sessoes`), com o token da plataforma;
 *   - o do VENDOR (`/ajuda/llm/*`), no formato OpenAI que ele fala.
 */

export const SessaoIdSchema = z.string().uuid();

/** O que o hub recebe ao abrir a Ajuda: só o necessário para entrar na sala de vídeo. */
export const SessaoAbertaSchema = z.object({
  /** A NOSSA sessão (linha de `ajuda_sessoes`) — é ela que o hub encerra. */
  id: z.string().uuid(),
  /** O token que o SDK do vendor usa no navegador. Vale só para esta sessão. */
  tokenDaSessao: z.string().min(1),
  /** O teto desta sessão, em segundos — o vendor fecha a sala ao atingi-lo. */
  duracaoMaximaS: z.number().int().positive(),
  /** Quanto sobra no dia DEPOIS desta sessão inteira, em segundos. */
  segundosRestantesHoje: z.number().int().min(0),
});

/** `encerrar` responde 204. */
export const EncerradaSchema = z.void();

export const CODIGOS_DE_ERRO = ["AJUDA_INDISPONIVEL", "SEM_MINUTOS", "RATE_LIMIT", "AVATAR_FALHOU"] as const;
export type CodigoDeErro = (typeof CODIGOS_DE_ERRO)[number];

/** As mensagens são de TELA — o hub as mostra como vieram. Sem jargão (ADR-91). */
const MENSAGENS: Record<CodigoDeErro, string> = {
  AJUDA_INDISPONIVEL: "A Ajuda com atendente não está disponível agora.",
  SEM_MINUTOS: "Você já usou todos os minutos de Ajuda de hoje. Amanhã eles voltam.",
  RATE_LIMIT: "Muitas tentativas seguidas. Espere um pouco e tente de novo.",
  AVATAR_FALHOU: "Não conseguimos chamar o atendente agora. Tente de novo em instantes.",
};

export function erroDaAjuda(codigo: CodigoDeErro, status: number, extra?: Record<string, unknown>): HttpException {
  return new HttpException({ codigo, mensagem: MENSAGENS[codigo], ...extra }, status);
}

/* ------------------------------------------------------------ lado do vendor */

/**
 * O corpo que o vendor manda ao `/chat/completions` (MEDIDO no spike):
 * `{ messages, model, stream: true, stream_options: { include_usage: true },
 * temperature: 0.5 }`. Só `messages` é lido de verdade; o resto é tolerado
 * (`passthrough`), porque o vendor pode acrescentar campos e uma recusa aqui
 * deixaria o avatar MUDO, sem erro nenhum na tela.
 */
export const MensagemOpenAiSchema = z
  .object({
    role: z.string().min(1).max(20),
    content: z.unknown().optional(),
  })
  .passthrough();

export const CorpoDoChatSchema = z
  .object({
    messages: z.array(MensagemOpenAiSchema).min(1).max(200),
    model: z.string().max(100).optional(),
    stream: z.boolean().optional(),
    stream_options: z.object({ include_usage: z.boolean().optional() }).passthrough().optional(),
  })
  .passthrough();

/** Não é JSON quando `stream: true` (o caso do vendor): a rota responde `text/event-stream`. */
export const RespostaDoChatSchema = z.string();

export const ListaDeModelosSchema = z.object({
  object: z.literal("list"),
  data: z.array(z.object({ id: z.string(), object: z.literal("model"), owned_by: z.string() })),
});

/** O nome com que o modelo é anunciado ao vendor. O vendor o repete em `model`; nada decide por ele. */
export const MODELO_ANUNCIADO = "unooria-ajuda";
