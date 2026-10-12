import { HttpException } from "@nestjs/common";
import { z } from "zod";
import { ATENDENTES, MAXIMO_DO_AUDIO_DO_MASCOTE, MAXIMO_DO_TEXTO_DO_MASCOTE } from "./regras";

/**
 * O contrato HTTP da Ajuda com avatar (ADR-132). Dois lados:
 *   - o do HUB (`/ajuda/sessoes`), com o token da plataforma;
 *   - o do VENDOR (`/ajuda/llm/*`), no formato OpenAI que ele fala.
 */

export const SessaoIdSchema = z.string().uuid();

export const AtendenteSchema = z.enum(ATENDENTES);

/** Os ajustes da boca do mascote — o hub os aplica no lip sync, nada aqui é segredo. */
export const AjustesDoMascoteSchema = z.object({
  voz: z.string(),
  modelo: z.string(),
  sensibilidade: z.number().min(0).max(1),
  suavizacao: z.number().min(0).max(1),
  antecipacaoMs: z.number().int().min(0).max(200),
  bocaRepouso: z.number().min(0).max(1),
});

const SessaoComumSchema = z.object({
  /** A NOSSA sessão (linha de `ajuda_sessoes`) — é ela que o hub encerra. */
  id: z.string().uuid(),
  /** O teto desta sessão, em segundos — ao atingi-lo, a sala (ou a conexão de voz) fecha. */
  duracaoMaximaS: z.number().int().positive(),
  /** Quanto sobra no dia DEPOIS desta sessão inteira, em segundos. */
  segundosRestantesHoje: z.number().int().min(0),
});

/** O que o hub recebe ao abrir a Ajuda: só o necessário para o atendente que vai atender. */
export const SessaoAbertaSchema = z.discriminatedUnion("atendente", [
  SessaoComumSchema.extend({
    atendente: z.literal("avatar"),
    /** O token que o SDK do vendor usa no navegador. Vale só para esta sessão. */
    tokenDaSessao: z.string().min(1),
  }),
  SessaoComumSchema.extend({
    atendente: z.literal("mascote"),
    /** O bilhete da conexão de voz (`/ajuda/mascote/ao-vivo`): 2 min para entrar, uma entrada. */
    bilhete: z.string().min(1),
    ajustes: AjustesDoMascoteSchema,
  }),
]);

/** O corpo de `POST /ajuda/sessoes`: o atendente que a pessoa escolheu (vale se a troca é permitida). */
export const AbrirSessaoSchema = z.object({ atendente: AtendenteSchema.optional() }).strict();

/** O que a janela da Ajuda precisa saber antes de abrir: quem atende e se dá para trocar. */
export const ConfiguracaoDaJanelaSchema = z.object({
  /** O atendente que abre: o padrão da rede, ou o outro se o padrão não está montado. `null` = nenhum. */
  atendente: AtendenteSchema.nullable(),
  /** Dá para trocar para o outro (a troca é permitida E o outro está montado). */
  podeTrocar: z.boolean(),
  /**
   * O modelo 3D do mascote (GLB, ~3,4 MB), no bucket de assets atrás da CDN —
   * nunca no repositório (binário > 2 MB). Em dev, servido pela api em `/assets`.
   */
  modeloDoMascote: z.string().url(),
});

/* ---------------------------------------- o protocolo do mascote ao vivo */

/** O que o navegador manda na conexão de voz. A primeira mensagem é SEMPRE `entrar`. */
export const MensagemDoNavegadorSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("entrar"), bilhete: z.string().min(20).max(2000) }).strict(),
  z.object({ tipo: z.literal("texto"), texto: z.string().trim().min(1).max(MAXIMO_DO_TEXTO_DO_MASCOTE) }).strict(),
  z
    .object({
      tipo: z.literal("audio"),
      base64: z.string().min(1).max(MAXIMO_DO_AUDIO_DO_MASCOTE).regex(/^[A-Za-z0-9+/]+={0,2}$/),
    })
    .strict(),
  z.object({ tipo: z.literal("fim-do-audio") }).strict(),
]);
export type MensagemDoNavegador = z.infer<typeof MensagemDoNavegadorSchema>;

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
