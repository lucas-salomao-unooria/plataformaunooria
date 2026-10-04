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

/**
 * O PERFIL de um estudante: em cada missão, o nível de cada habilidade (o
 * melhor entre as atividades) e, embaixo, o resultado de cada atividade.
 * Missões da mais recente para a mais antiga.
 */
export const PerfilDoEstudanteSchema = z.object({
  estudante: z.object({ id: Uuid, nome: z.string() }),
  missoes: z.array(
    z.object({
      expId: z.string(),
      /** O nome do catálogo; o próprio `expId` quando a missão não está nele. */
      nome: z.string(),
      /** A unidade do ano (1 a 4), do manifesto; `null` na transversal ou fora do catálogo. */
      unidade: z.number().int().nullable(),
      /** Quando a evidência desta missão mudou pela última vez (ISO 8601) — é o que ordena. */
      ultimaEm: z.string(),
      /**
       * A MISSÃO: cada habilidade da ficha com o MELHOR nível entre todas as
       * atividades. `null` = "Não avaliado" — a criança não tem evidência que
       * conte nesta habilidade, e isso nunca vira "não atingiu".
       */
      habilidades: z.array(z.object({ codigo: z.string(), descricao: z.string(), status: NivelSchema.nullable() })),
      atividades: z.array(
        z.object({
          atividadeId: z.string(),
          habilidades: z.array(z.object({ codigo: z.string(), descricao: z.string(), status: NivelSchema })),
        }),
      ),
    }),
  ),
});

// ── o painel de habilidades (F14.7): turma, escola e rede ─────────────────

/**
 * Quantas crianças em cada nível. `naoAvaliado` é a criança da turma sem
 * evidência que conte — nunca "não atingiu". `total` é a soma das quatro.
 */
export const DistribuicaoSchema = z.object({
  atingiu: z.number().int().nonnegative(),
  emProcesso: z.number().int().nonnegative(),
  naoAtingiu: z.number().int().nonnegative(),
  naoAvaliado: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

const HabilidadeSchema = z.object({ codigo: z.string(), descricao: z.string() });

/** Uma missão com ficha, como o catálogo a descreve: o nome, a UNIDADE e as habilidades. */
export const MissaoDoPainelSchema = z.object({
  expId: z.string(),
  nome: z.string(),
  /** A coluna do painel: a unidade do ano (1 a 4). `null` = transversal. */
  unidade: z.number().int().nullable(),
  series: z.array(z.string()),
  habilidades: z.array(HabilidadeSchema),
});

export const ParamsDaTurmaSchema = z.object({ turmaId: Uuid });

/**
 * O PAINEL DA TURMA: cada missão com ficha da série da turma (ou que a turma
 * já fez), cada habilidade, e quantas crianças em cada nível. Contagem, não
 * porcentagem: o professor quer saber QUANTOS.
 */
export const TurmaConsolidadaSchema = z.object({
  turma: z.object({ id: Uuid, nome: z.string(), serie: z.string() }),
  /** Em ordem ALFABÉTICA — é a lista do drill-down, e nunca um ranking. */
  estudantes: z.array(z.object({ id: Uuid, nome: z.string() })),
  missoes: z.array(
    MissaoDoPainelSchema.omit({ series: true, habilidades: true }).extend({
      /** A turma tem alguma evidência desta missão (mesmo a projeção a confirmar)? */
      aplicada: z.boolean(),
      habilidades: z.array(HabilidadeSchema.extend({ distribuicao: DistribuicaoSchema })),
    }),
  ),
});

const MissaoDaLinhaSchema = z.object({
  expId: z.string(),
  habilidades: z.array(z.object({ codigo: z.string(), distribuicao: DistribuicaoSchema })),
});

/**
 * O PAINEL DA ESCOLA: as turmas do ano letivo vigente, e em cada uma a
 * distribuição por habilidade de cada missão. As missões (nome, unidade,
 * texto da BNCC) vêm uma vez só, em `missoes`; as turmas trazem só os números.
 */
export const EscolaConsolidadaSchema = z.object({
  escola: z.object({ id: z.string(), nome: z.string() }),
  /** O ano letivo de onde as turmas saíram; `null` sem nenhum cadastrado. */
  periodo: z.object({ id: Uuid, titulo: z.string() }).nullable(),
  missoes: z.array(MissaoDoPainelSchema),
  /** Por série (na ordem da trilha) e, dentro dela, por nome. */
  turmas: z.array(
    z.object({
      id: Uuid,
      nome: z.string(),
      serie: z.string(),
      estudantes: z.number().int().nonnegative(),
      missoes: z.array(MissaoDaLinhaSchema.extend({ aplicada: z.boolean() })),
    }),
  ),
});

export const RedeConsolidadaQuerySchema = z.object({ regionalId: z.string().min(1).optional() });

/**
 * O PAINEL DA REDE: cada escola, cada série, a soma das turmas. Escolas em
 * ordem alfabética, sem ranking. Contagem — a tela faz a porcentagem, porque
 * escolas de tamanhos diferentes só se leem lado a lado assim.
 */
export const RedeConsolidadaSchema = z.object({
  /** A regional lida; `null` quando o perfil de contrato pediu a rede inteira. */
  regional: z.object({ id: z.string(), nome: z.string() }).nullable(),
  periodo: z.object({ id: Uuid, titulo: z.string() }).nullable(),
  missoes: z.array(MissaoDoPainelSchema),
  escolas: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      /** Só as séries que têm turma no ano letivo vigente. */
      series: z.array(
        z.object({
          serie: z.string(),
          turmas: z.number().int().nonnegative(),
          estudantes: z.number().int().nonnegative(),
          missoes: z.array(MissaoDaLinhaSchema.extend({ turmasAplicadas: z.number().int().nonnegative() })),
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
