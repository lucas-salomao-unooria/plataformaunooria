import { z } from "zod";

/**
 * O contrato das rotas `/podcast/*` (ADR-150). O hub tem o espelho em
 * `apps/hub/lib/podcast-tipos.ts`.
 */

export const ParamsDoPodcastSchema = z.object({
  expId: z.string().min(1).max(40),
  turmaId: z.string().uuid(),
});

/**
 * O id da atividade: um uuid, ou `"turma"` — a "atividade" da missão sem
 * atividade (a Missão Tempestade, ADR-154 e ADR-156), a mesma das equipes e
 * da evidência.
 */
const AtividadeIdSchema = z.union([z.string().uuid(), z.literal("turma")]);

/** `?atividadeId=` diz a atividade (ADR-130); sem ele, a em andamento. `?escolaId=` é do gestor de contrato. */
export const QueryDoPodcastSchema = z.object({
  escolaId: z.string().optional(),
  atividadeId: AtividadeIdSchema.optional(),
});

const FalaSchema = z.object({ falante: z.string(), texto: z.string() });

/**
 * O podcast de uma atividade — o roteiro inteiro (é a transcrição, que fica na
 * tela junto do player) e o estado do áudio.
 */
export const PodcastSchema = z.object({
  atividadeId: AtividadeIdSchema,
  tema: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  roteiro: z.array(z.object({ bloco: z.string(), titulo: z.string(), falas: z.array(FalaSchema).min(1) })),
  trechos: z.object({ total: z.number().int().min(0), prontos: z.number().int().min(0) }),
  /** O episódio inteiro, quando todos os trechos existem e já foram emendados. */
  url: z.string().nullable(),
});

/** O progresso de UMA chamada de geração: um trecho por vez, e o episódio no fim. */
export const ProgressoDoPodcastSchema = PodcastSchema.extend({
  /** O bloco sintetizado NESTA chamada. */
  gerado: z.string().nullable(),
  /** O bloco que falhou NESTA chamada — a transcrição continua na tela. */
  falhou: z.string().nullable(),
  /** `true` quando o episódio existe: o cliente para de repetir. */
  completo: z.boolean(),
});

/** O corpo da escrita: o conteúdo da atividade como a tela de customização o tem. A forma é da missão. */
export const PedidoDasFalasSchema = z.object({ conteudo: z.unknown() });

/** As falas do tema escritas para a tela revisar — rascunho, não persiste. */
export const FalasEscritasSchema = z.object({
  vagas: z.array(z.object({ id: z.string(), falante: z.string(), sobre: z.string(), texto: z.string() })),
  /** `false` = as falas do banco padrão (o conteúdo é ele, ou a IA não respondeu). */
  usouIa: z.boolean(),
  /** Por que a IA não escreveu: a tela avisa que as falas contam o banco padrão. */
  motivo: z.enum(["sem-saldo-de-ia", "ia-indisponivel"]).nullable(),
});
