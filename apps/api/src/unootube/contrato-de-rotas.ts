import { z } from "zod";
import { VIDEO_IDS } from "./catalogo";

const Uuid = z.string().uuid();
export const VideoIdSchema = z.enum(VIDEO_IDS);
export const SalvarSchema = z.object({ videoId: VideoIdSchema });

/**
 * Um vídeo como o ALUNO o recebe — **sem `factual`**.
 *
 * Não é omissão: o tipo do servidor é `Omit<Video, "factual">`, então o gabarito
 * é impossível de vazar aqui, não só ausente por descuido (regra 3).
 */
export const VideoPublicoSchema = z.object({
  id: z.string(),
  /** Só o nome do mp4: os vídeos moram no bucket de assets, fora do bundle. */
  arquivo: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  handle: z.string(),
  /** COSMÉTICAS. Nenhuma entra em conta nenhuma — o vídeo fake é o que tem os
   *  números grandes, e é esse contraste que o ranking depois desmonta. */
  inscritosRotulo: z.string(),
  visualizacoesRotulo: z.string(),
  curtidasRotulo: z.string(),
  avatar: z.string(),
  accent: z.string(),
});

export const EstadoPublicoSchema = z.object({
  salvos: z.array(z.string()),
  curtidos: z.array(z.string()),
  rankingDesbloqueado: z.boolean(),
  credibilidadeAdicionada: z.boolean(),
  concluidoEm: z.string().nullable(),
});

/** Derivados do que foi salvo — calculados no SERVIDOR contra o `factual`. */
export const DerivadosSchema = z.object({
  inscritos: z.number().int().nonnegative(),
  fontesConfiaveis: z.number().int().nonnegative(),
  salvos: z.number().int().nonnegative(),
  vagas: z.number().int().nonnegative(),
});

export const EstadoSchema = z.object({
  estado: EstadoPublicoSchema,
  derivados: DerivadosSchema,
  limiteSalvos: z.number().int().positive(),
});

/** Só `credibilidade` acrescenta `score` — e ele é `derivados.fontesConfiaveis`,
 *  ou seja, a correção server-side, nunca o que o cliente achou que acertou.
 *  É o valor que a experiência devolve ao hub no `exp:concluir`. */
export const EstadoComScoreSchema = EstadoSchema.extend({ score: z.number().int() });

/** Os colegas são FICTÍCIOS: ranquear colegas reais exporia pontuação de
 *  menores (regra 6). `voce` marca a linha do aluno. */
export const RankingSchema = z.object({
  linhas: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      avatar: z.string(),
      accent: z.string(),
      fontesConfiaveis: z.number().int().nonnegative(),
      inscritos: z.number().int().nonnegative(),
      voce: z.boolean(),
    }),
  ),
  posicao: z.object({
    porInscritos: z.number().int(),
    porFontes: z.number().int(),
  }),
});

export const SessaoSchema = EstadoSchema.extend({
  catalogo: z.object({ videos: z.array(VideoPublicoSchema) }),
  estudante: z.object({ nome: z.string(), avatar: z.string() }).optional(),
  aluno: z.object({ nome: z.string(), avatar: z.string() }).optional(),
  /** `null` até o ranking ser desbloqueado — é a virada da missão. */
  ranking: RankingSchema.nullable(),
});

export const TurmasDoUnootubeSchema = z.object({
  turmas: z.array(
    z.object({
      id: Uuid,
      nome: z.string(),
      serie: z.string(),
      estudantes: z.number().int().nonnegative().optional(),
      alunos: z.number().int().nonnegative().optional(),
    }),
  ),
});

export const EstudanteDoResultadoSchema = z.object({
  id: Uuid.optional(),
  estudanteId: Uuid.optional(),
  alunoId: Uuid.optional(),
  nome: z.string(),
  usuario: z.string(),
  iniciou: z.boolean(),
  salvos: z.number().int().nonnegative(),
  fontesConfiaveis: z.number().int().nonnegative(),
  inscritos: z.number().int().nonnegative(),
  rankingDesbloqueado: z.boolean(),
  credibilidadeAdicionada: z.boolean(),
  concluidoEm: z.string().nullable(),
});

export const ResultadosDaTurmaSchema = z.object({
  turma: z.object({ id: Uuid, nome: z.string(), serie: z.string() }),
  estudantes: z.array(EstudanteDoResultadoSchema).optional(),
  alunos: z.array(EstudanteDoResultadoSchema).optional(),
  resumo: z.object({
    total: z.number().int().nonnegative(),
    iniciaram: z.number().int().nonnegative(),
    desbloquearamRanking: z.number().int().nonnegative(),
    concluiram: z.number().int().nonnegative(),
    /** Só entre os que CONCLUÍRAM: quantos fecharam com 0, 1, 2 ou 3 fontes. */
    distribuicaoFontes: z.record(z.number().int().nonnegative()),
    mediaFontesConcluidos: z.number().nullable(),
  }),
});
