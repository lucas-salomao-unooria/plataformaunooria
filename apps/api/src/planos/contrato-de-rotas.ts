import { z } from "zod";
import { SERIES } from "../comum/series";
import { STATUS_PLANO } from "./planos.service";

const Uuid = z.string().uuid();

/** Disciplinas e séries que têm material importado — alimenta os seletores. */
export const DisponiveisSchema = z.array(
  z.object({
    disciplina: z.string(),
    rotulo: z.string(),
    series: z.array(z.enum(SERIES)),
  }),
);

/**
 * Um plano na lista. Os `*Rotulo` vêm prontos do servidor: a tela imprime o que
 * o servidor mandou em vez de manter um segundo dicionário de rótulos que
 * divergiria no dia em que uma disciplina nova entrasse.
 */
export const PlanoSchema = z.object({
  id: Uuid,
  serie: z.string(),
  serieRotulo: z.string(),
  disciplina: z.string(),
  disciplinaRotulo: z.string(),
  titulo: z.string(),
  status: z.enum(STATUS_PLANO),
  /** Preenchido só com `status: "erro"`. */
  erro: z.string().nullable(),
  tokensUsados: z.number().int().nonnegative(),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});

export const ListaDePlanosSchema = z.object({ planos: z.array(PlanoSchema) });

/** O 202 de `POST /planos`: a geração corre em background. */
export const PlanoCriadoSchema = z.object({ id: Uuid });

/**
 * O plano com o conteúdo. `html` é `null` enquanto o status não for `pronto` —
 * é assim que o cliente sabe que ainda deve continuar o polling.
 */
export const PlanoComConteudoSchema = z.object({
  plano: PlanoSchema,
  html: z.string().nullable(),
});

export const ConteudoSalvoSchema = z.object({
  ok: z.literal(true),
  salvoEm: z.string().datetime(),
  bytes: z.number().int().nonnegative(),
});

/** Restaurar devolve o HTML do `gerado.md` convertido — o original imutável. */
export const RestauradoSchema = z.object({ ok: z.literal(true), html: z.string() });

export const OkSchema = z.object({ ok: z.literal(true) });

// ------------------------------------------------- referências curriculares

export const ReferenciaSchema = z.object({
  id: Uuid,
  disciplina: z.string(),
  /** `null` = vale para todas as séries daquela disciplina. */
  serie: z.string().nullable(),
  nome: z.string(),
  ordem: z.number().int(),
  atualizadoEm: z.string().datetime(),
});

/** Sem o TEXTO: o inventário existe para o script ser idempotente e para
 *  auditoria, e o texto de um currículo inteiro não cabe numa listagem. */
export const InventarioDeReferenciasSchema = z.object({
  referencias: z.array(ReferenciaSchema),
});

export const ReferenciaImportadaSchema = z.object({
  referencia: ReferenciaSchema.omit({ atualizadoEm: true }),
  /** `false` = criada agora; `true` = já existia e foi sobrescrita. */
  atualizada: z.boolean(),
  caracteres: z.number().int().nonnegative(),
});
