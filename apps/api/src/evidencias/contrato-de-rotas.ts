import { z } from "zod";
import { EXP_ID_RE, FORMATO_DO_EXP_ID } from "../comum/codigo-da-experiencia";
import {
  AJUSTES_MAX,
  ATIVIDADE_ID_RE,
  FORMATO_DO_ATIVIDADE_ID,
  ID_DA_FICHA_RE,
  ORIGENS,
  SITUACOES,
  STATUS,
  STATUS_DE_MARCA,
} from "./regras";

/**
 * Os schemas das rotas de `/evidencias` (E14). O OpenAPI é derivado daqui —
 * não há DTO de classe nesta api (ADR-36).
 */

export const ExpId = z.string().regex(EXP_ID_RE, FORMATO_DO_EXP_ID);
export const Uuid = z.string().uuid("precisa ser um UUID");
export const AtividadeId = z.string().regex(ATIVIDADE_ID_RE, FORMATO_DO_ATIVIDADE_ID);
export const IdDaFicha = z
  .string()
  .regex(ID_DA_FICHA_RE, "id: 1 a 100 caracteres entre letras, dígitos e _ . : -");
/** Vem do caminho como texto: `coerce`, e inteiro a partir de 1. */
export const Rodada = z.coerce.number().int("rodada: inteiro").min(1, "rodada: a partir de 1");

export const StatusSchema = z.enum(STATUS);
export const NivelSchema = z.enum(STATUS_DE_MARCA);
export const OrigemSchema = z.enum(ORIGENS);
export const SituacaoSchema = z.enum(SITUACOES);

/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

/** O endereço do painel: a turma, a missão e a atividade. */
export const ParamsDaAtividadeSchema = z.object({ turmaId: Uuid, expId: ExpId, atividadeId: AtividadeId });
/** O endereço de uma rodada do painel. */
export const ParamsDaRodadaSchema = ParamsDaAtividadeSchema.extend({ rodada: Rodada });
export const ParamsDoEstudanteSchema = z.object({ estudanteId: Uuid });
export const ParamsDaPerguntaSchema = z.object({ expId: ExpId, perguntaId: IdDaFicha });

/** Uma célula do painel: o nível, de onde veio, e se já vale. */
const CelulaSchema = z.object({ status: StatusSchema, origem: OrigemSchema, situacao: SituacaoSchema });

/**
 * O PAINEL da atividade — o `GET`, e a resposta do `POST confirmar` e do
 * `PATCH ajustes`, para a tela não precisar reler.
 *
 * As chaves de `porRodada` e `pendentes` são o NÚMERO da rodada (em texto,
 * porque é JSON); as de dentro de `porRodada[r]` e de `resultado`, o código da
 * habilidade. Habilidade ausente = N/A ("Não avaliado").
 */
export const PainelDaAtividadeSchema = z.object({
  /** A missão tem ficha? `false` = a tela nem desenha o bloco de evidência. */
  temFicha: z.boolean(),
  /** As habilidades da ficha, na ordem dela, com o texto da BNCC. */
  habilidades: z.array(z.object({ codigo: z.string(), descricao: z.string() })),
  /** As rodadas que têm alguma evidência, em ordem crescente. */
  rodadas: z.array(z.number().int().positive()),
  estudantes: z.array(
    z.object({
      id: Uuid,
      nome: z.string(),
      /** O computador em que a criança está nesta missão, ou `null`. */
      equipe: z.object({ id: Uuid, nome: z.string() }).nullable(),
      porRodada: z.record(z.record(CelulaSchema)),
      /** A MELHOR rodada por habilidade, só com o que vale — sem `a_revisar`, sem `nao_participou`. */
      resultado: z.record(NivelSchema),
    }),
  ),
  /** Quantas cópias da projeção esperam o professor confirmar, por rodada. */
  pendentes: z.record(z.number().int().nonnegative()),
});

/**
 * O corpo do `PATCH`. O Zod confere a FORMA; que o estudante é desta turma e a
 * habilidade é da ficha é do serviço, que devolve a lista inteira de problemas
 * em frases (`ajuste-invalido`).
 */
export const AjustesSchema = z.object({
  ajustes: z
    .array(
      z.object({
        estudanteId: Uuid,
        habilidade: z.string().min(1).max(20),
        status: StatusSchema,
      }),
    )
    .min(1)
    .max(AJUSTES_MAX),
});
export type Ajustes = z.infer<typeof AjustesSchema>;

/** O PERFIL de um estudante: o resultado de cada atividade de cada missão. */
export const PerfilDoEstudanteSchema = z.object({
  estudante: z.object({ id: Uuid, nome: z.string() }),
  missoes: z.array(
    z.object({
      expId: z.string(),
      /** O nome do catálogo; o próprio `expId` quando a missão não está nele. */
      nome: z.string(),
      atividades: z.array(
        z.object({
          atividadeId: z.string(),
          habilidades: z.array(z.object({ codigo: z.string(), descricao: z.string(), status: NivelSchema })),
        }),
      ),
    }),
  ),
});

/** A pergunta como o ESTUDANTE a vê: sem o nível de cada alternativa (regra 3). */
export const PerguntaSchema = z.object({
  enunciado: z.string(),
  alternativas: z.array(z.object({ id: z.string(), texto: z.string() })),
});

export const RespostaSchema = z.object({ alternativaId: IdDaFicha });

/** Só isto: a criança nunca sabe, pela resposta, se acertou. */
export const RespostaEnviadaSchema = z.object({ enviada: z.literal(true) });
