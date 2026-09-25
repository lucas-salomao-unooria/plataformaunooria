import { z } from "zod";
import { EXP_ID_RE, FORMATO_DO_EXP_ID } from "../comum/codigo-da-experiencia";
import { COMPUTADORES_MAX, MODOS } from "./regras";

/**
 * Os schemas das rotas de `/equipes` (E13, ADR-111). O OpenAPI é derivado daqui
 * — não há DTO de classe nesta api (ADR-36).
 */

export const ExpId = z.string().regex(EXP_ID_RE, FORMATO_DO_EXP_ID);
export const Uuid = z.string().uuid();

export const ModoSchema = z.enum(MODOS);
export const LadoSchema = z.enum(["A", "B"]);

/** O endereço de toda rota do professor: a turma e a missão. */
export const ParamsDaMissaoSchema = z.object({ turmaId: Uuid, expId: ExpId });
/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

/** Uma criança como as telas do professor a mostram. `nome` é o `displayName`. */
const MembroSchema = z.object({ id: Uuid, nome: z.string() });

const ComputadoresSchema = z.number().int().min(1).max(COMPUTADORES_MAX);

export const MontagemSchema = z.object({
  modo: ModoSchema,
  computadores: z.number().int().positive(),
  ausentes: z.array(Uuid),
  versao: z.number().int().positive(),
  atualizadoEm: z.string().datetime(),
});

/** O que `GET` devolve — e o `PUT` também, para a tela não precisar reler. */
export const EquipesDaMissaoSchema = z.object({
  /** A missão aceita equipe? `false` = a tela nem mostra o bloco de equipes. */
  permitida: z.boolean(),
  montagem: MontagemSchema.nullable(),
  equipes: z.array(
    z.object({
      id: Uuid,
      nome: z.string(),
      ordem: z.number().int().nonnegative(),
      membros: z.array(MembroSchema),
    }),
  ),
  /** Estudantes da turma fora de qualquer equipe — os ausentes inclusive. */
  semEquipe: z.array(MembroSchema),
  /** Quantos estudantes a turma tem. */
  estudantes: z.number().int().nonnegative(),
});

export const PedidoDeSugestaoSchema = z.object({
  modo: ModoSchema,
  computadores: ComputadoresSchema,
  ausentes: z.array(Uuid).default([]),
});

export const AgrupamentoSchema = z.object({
  /** De onde veio o lado de cada criança, em palavras para o professor. */
  fonte: z.string(),
  comGrupo: z.number().int().nonnegative(),
  neutros: z.number().int().nonnegative(),
  equipesMistas: z.number().int().nonnegative(),
  aviso: z.string().nullable(),
});

export const SugestaoSchema = z.object({
  modo: ModoSchema,
  computadores: z.number().int().positive(),
  equipes: z.array(
    z.object({
      nome: z.string(),
      membros: z.array(MembroSchema),
      grupo: LadoSchema.nullable(),
      mista: z.boolean(),
    }),
  ),
  semEquipe: z.array(MembroSchema),
  agrupamento: AgrupamentoSchema.nullable(),
});

export const UltimaMontagemSchema = z.object({
  origem: z
    .object({ expId: z.string(), atualizadoEm: z.string().datetime() })
    .nullable(),
  equipes: z.array(z.object({ nome: z.string(), membros: z.array(MembroSchema) })),
  semEquipe: z.array(MembroSchema),
  /** Quantos membros da montagem de origem já não são desta turma. */
  saidas: z.number().int().nonnegative(),
});

/**
 * O corpo do `PUT`. O nome NÃO é checado aqui além de ser texto: tamanho, vazio
 * e repetição são de `regras.ts#validarMontagem`, que devolve a lista inteira
 * em frases para o professor — um `ZodError` diria só `corpo-invalido`.
 */
export const SalvarMontagemSchema = z.object({
  /** A versão em que a tela se baseou. `0` quando não havia montagem. */
  versao: z.number().int().min(0),
  modo: ModoSchema,
  computadores: ComputadoresSchema,
  ausentes: z.array(Uuid).default([]),
  equipes: z
    .array(z.object({ nome: z.string(), membros: z.array(Uuid) }))
    .max(COMPUTADORES_MAX),
});
export type SalvarMontagem = z.infer<typeof SalvarMontagemSchema>;

export const RemovidaSchema = z.object({ ok: z.literal(true) });

export const QueryDaMinhaEquipeSchema = z.object({ expId: ExpId });

export const MinhaEquipeSchema = z.object({
  equipe: z
    .object({
      nome: z.string(),
      /** O PRIMEIRO nome dos outros membros — nunca o nome completo (regra 6). */
      colegas: z.array(z.string()),
    })
    .nullable(),
});
