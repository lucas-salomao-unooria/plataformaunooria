import { z } from "zod";

/**
 * O contrato HTTP do agente de IA do professor. A forma do STREAM (os eventos
 * `delta`/`fontes`/`titulo`/`aviso`/`fim`/`erro`) é contrato das quatro pontas
 * e vive em `docs/regras/agente-professor.md`; aqui ficam os schemas de
 * entrada e das respostas JSON, e os dos `data:` de cada evento — é deles que o
 * teste confere o que o SSE escreveu.
 */

/** O id da conversa (a linha do Postgres, nunca o `sessao_id` do engine). */
export const ConversaIdSchema = z.string().uuid();

export const TAMANHO_MAXIMO_DA_MENSAGEM = 4_000;

export const EnviarMensagemSchema = z
  .object({
    texto: z
      .string()
      .trim()
      .min(1, "escreva a mensagem")
      .max(TAMANHO_MAXIMO_DA_MENSAGEM, `a mensagem tem até ${TAMANHO_MAXIMO_DA_MENSAGEM} caracteres`),
  })
  .strict();

export const ConversaResumoSchema = z.object({
  id: z.string().uuid(),
  /** `null` até o fim do 1º turno: quem escreve o título é o agente. */
  titulo: z.string().nullable(),
  criadaEm: z.string().datetime(),
  atualizadaEm: z.string().datetime(),
});

export const ListaDeConversasSchema = z.array(ConversaResumoSchema);

export const ConversaCriadaSchema = z.object({ id: z.string().uuid() });

export const FonteSchema = z.object({
  titulo: z.string(),
  paginaInicio: z.number().int().nullable(),
  paginaFim: z.number().int().nullable(),
});

export const MensagemSchema = z.object({
  autor: z.enum(["professor", "agente"]),
  texto: z.string(),
  fontes: z.array(FonteSchema).optional(),
});

export const ConversaSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().nullable(),
  mensagens: z.array(MensagemSchema),
});

/** A rota de apagar responde 204; o schema é o do corpo vazio. */
export const ApagadaSchema = z.void();

/** Não é JSON: a rota responde `text/event-stream`. Documenta a forma do fluxo. */
export const StreamDeMensagemSchema = z.string();

/* ---------------------------------------------------------------- o stream */

export const CODIGOS_DE_ERRO = ["QUOTA", "RATE_LIMIT", "AGENTE_INDISPONIVEL", "TEMPO_ESGOTADO"] as const;
export type CodigoDeErro = (typeof CODIGOS_DE_ERRO)[number];

export const EventoDeltaSchema = z.object({ texto: z.string() });
export const EventoFontesSchema = z.object({ fontes: z.array(FonteSchema) });
export const EventoTituloSchema = z.object({ titulo: z.string() });
export const EventoAvisoSchema = z.object({ codigo: z.literal("habilidade-inexistente"), mensagem: z.string() });
export const EventoFimSchema = z.object({}).strict();
export const EventoErroSchema = z.object({ codigo: z.enum(CODIGOS_DE_ERRO), mensagem: z.string() });

/** O `data:` de cada `event:` — o teste do SSE confere cada linha contra isto. */
export const DADOS_POR_EVENTO = {
  delta: EventoDeltaSchema,
  fontes: EventoFontesSchema,
  titulo: EventoTituloSchema,
  aviso: EventoAvisoSchema,
  fim: EventoFimSchema,
  erro: EventoErroSchema,
} as const;

export type NomeDoEvento = keyof typeof DADOS_POR_EVENTO;
