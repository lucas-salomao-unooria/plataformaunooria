import { z } from "zod";
import { PERFIS } from "../comum/insta/defaults";
import { afinidadeSchema } from "../comum/insta/tipos";

const Uuid = z.string().uuid();
const PerfilSchema = z.enum(PERFIS);
const LadoSchema = z.enum(["A", "B"]);
const EscoresSchema = z.record(PerfilSchema, z.number());

/**
 * Fallback do professor quando o Ato 1 não integra.
 *
 * Aceita DUAS formas: escores completos (colados de planilha) ou só o
 * `dominante` (seleção manual na lista). A segunda existe porque, na prática, o
 * professor às vezes tem só o resultado final do jogo impresso.
 */
export const PerfisManuaisSchema = z.object({
  perfis: z
    .array(
      z.union([
        z.object({
          username: z.string().trim().min(1).max(64),
          escores: EscoresSchema,
        }),
        z.object({
          username: z.string().trim().min(1).max(64),
          dominante: PerfilSchema,
        }),
      ]),
    )
    .min(1)
    .max(200),
});

export const DaVilaSchema = z.object({ turmaId: Uuid.optional() });

export const ImportadosSchema = z.object({
  importados: z.number().int().nonnegative(),
  ignorados: z.number().int().nonnegative(),
  /** Os `username` que não existem nesta escola — dito, nunca engolido. */
  desconhecidos: z.array(z.string()),
});

export const ImportadosDaVilaSchema = z.object({
  importados: z.number().int().nonnegative(),
  /** Crianças da turma que ainda não jogaram a Vila. */
  semPartida: z.number().int().nonnegative(),
  /** Perfis que a Vila mediu e o colapso INVALIDOU. Custa alunos de propósito:
   *  quadrante sem nenhum membro observado invalida o perfil inteiro, e sem
   *  perfil o Instanooria cai no sorteio balanceado — que é honesto sobre não
   *  saber. */
  descartados: z.array(z.object({ nome: z.string(), motivo: z.string() })),
});

export const ListaDePerfisSchema = z.object({
  alunos: z.array(
    z.object({
      username: z.string(),
      displayName: z.string(),
      /** `jogo` (Vila), `professor` (manual) ou `ausente`. */
      origem: z.string(),
      dominante: z.string().nullable(),
      rotulo: z.string().nullable(),
      escores: z.unknown().nullable(),
      medidoEm: z.string().datetime().nullable(),
    }),
  ),
  resumo: z.object({
    comPerfil: z.number().int().nonnegative(),
    semPerfil: z.number().int().nonnegative(),
    doJogo: z.number().int().nonnegative(),
    doProfessor: z.number().int().nonnegative(),
  }),
});

export const DistribuicaoSchema = z.object({
  temAfinidade: z.boolean(),
  afinidade: afinidadeSchema.nullable(),
  alunos: z.array(
    z.object({
      username: z.string(),
      displayName: z.string(),
      dominante: z.string(),
      rotulo: z.string(),
      margem: z.number(),
      origemDoPerfil: z.enum(["jogo", "professor", "ausente"]),
      lado: LadoSchema.nullable(),
      ladoOrigem: z.enum(["perfil", "sorteio", "redistribuido", "projetado"]),
      jaComecou: z.boolean(),
    }),
  ),
  contagem: z.object({ A: z.number().int(), B: z.number().int() }),
  /** Perfil ausente ou `misto`: caem no SORTEIO, e por isso não entram na
   *  projeção — o lado só é decidido quando a run nasce. */
  semLado: z.number().int().nonnegative(),
  desequilibrio: z.number(),
  tolerancia: z.number(),
  precisaRedistribuir: z.boolean(),
});

/** Duas formas de resposta: "já estava equilibrada" e "movi estes". */
export const RedistribuicaoSchema = z.union([
  z.object({
    ok: z.literal(true),
    movidos: z.array(z.never()),
    mensagem: z.string(),
    contagem: z.object({ A: z.number().int(), B: z.number().int() }),
  }),
  z.object({
    ok: z.literal(true),
    de: LadoSchema,
    para: LadoSchema,
    movidos: z.array(
      z.object({
        username: z.string(),
        displayName: z.string(),
        perfil: z.string(),
        margem: z.number(),
      }),
    ),
    /** Quem já estava rolando o feed e por isso NÃO foi movido — trocar o lado
     *  ali invalidaria a sessão. Aparece na resposta para o professor saber que
     *  o rebalanceamento pode não ter chegado ao alvo. */
    bloqueados: z.number().int().nonnegative(),
  }),
]);

/** A ponte externa do Ato 1. `escolaId` vem no CORPO porque esta rota não tem
 *  token: sem ele não há escola no contexto, e `comTenancy` falha alto. */
export const ImportarPerfisSchema = z.object({
  escolaId: z.string().trim().min(1).max(64),
  activityId: Uuid,
  alunos: z
    .array(
      z.object({
        username: z.string().trim().min(1).max(64),
        escores: EscoresSchema,
        medidoEm: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(200),
});
