import { z } from "zod";
import { ESTADOS_GRAVADOS } from "./regras";

/**
 * Os schemas das rotas de `/salas` (ADR-69). O OpenAPI é derivado daqui — não há
 * DTO de classe nesta api (ADR-36).
 */

export const EXP_ID_RE = /^exp-[a-z0-9-]+$/;
export const ExpId = z.string().regex(EXP_ID_RE, "expId no formato exp-<slug>");
export const Uuid = z.string().uuid();

/** `bloqueada` não é um estado do banco: é a ausência de linha em `liberacoes`. */
export const EstadoDaMissaoSchema = z.enum(["liberada", "encerrada", "bloqueada"]);
export const EstadoGravadoSchema = z.enum(ESTADOS_GRAVADOS);

const TurmaDaSalaSchema = z.object({
  id: Uuid,
  nome: z.string(),
  serie: z.string(),
  turno: z.string().nullable(),
  /// regular | componente — o mesmo estudante pode cursar as duas em paralelo.
  tipo: z.string(),
  periodo: z.string(),
});

const MissaoNaGradeSchema = z.object({
  expId: z.string(),
  nome: z.string(),
  estado: EstadoDaMissaoSchema,
  transversal: z.boolean(),
  deOutraSerie: z.boolean(),
});

export const SalasDoEstudanteSchema = z.object({
  salas: z.array(
    z.object({
      turma: TurmaDaSalaSchema,
      missoes: z.array(MissaoNaGradeSchema),
    }),
  ),
});

export const SalaDoProfessorSchema = z.object({
  turma: TurmaDaSalaSchema.extend({ estudantes: z.number().int().nonnegative() }),
  missoes: z.array(
    MissaoNaGradeSchema.extend({
      liberadaPor: z.string().nullable(),
      liberadaEm: z.string().datetime().nullable(),
      encerradaEm: z.string().datetime().nullable(),
    }),
  ),
});

export const DefinirEstadoSchema = z.object({ estado: EstadoGravadoSchema });

export const LiberacaoSchema = z.object({
  expId: z.string(),
  estado: z.string(),
  liberadaEm: z.string().datetime(),
  encerradaEm: z.string().datetime().nullable(),
});
