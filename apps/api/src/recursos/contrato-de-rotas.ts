import { z } from "zod";
import { PERFIS_COM_QUOTA } from "../ai/quota.service";
import { PRODUTOS } from "./catalogo";
import { DetalheDeQuotaSchema } from "./auditoria";

/**
 * O que o hub precisa saber para montar os cards e trancar as rotas de produto.
 *
 * A tela do PAINEL (fase 2) tem contrato próprio: aqui é a leitura pública —
 * "o que está ligado para mim" —, e ela não devolve motivo nem quem desligou.
 * Motivo de desligamento é conversa entre a Unooria e a rede; num payload que
 * qualquer autenticado lê, ele viraria a explicação errada na tela errada.
 */

const EfetivoSchema = z.object({
  ligado: z.boolean(),
  /** Só em experiência: versão fixada neste escopo. `null` = a `versaoAtiva`. */
  versao: z.string().nullable(),
});

export const RecursosEfetivosSchema = z.object({
  /** Um por produto do vocabulário, sempre os quatro — nunca só os ligados. */
  produtos: z.record(z.enum(PRODUTOS), EfetivoSchema),
  /** Uma por experiência do catálogo desta instalação. */
  experiencias: z.record(z.string(), EfetivoSchema),
});

/* ==========================================================================
   O PAINEL — só `admin` (ADR-88)

   Contrato separado da leitura pública de propósito: o painel devolve `motivo`
   e quem decidiu, e esses dois não podem sair numa resposta que qualquer
   autenticado lê. Motivo de desligamento é conversa entre a Unooria e a rede.
   ========================================================================== */

/**
 * O que o INTERRUPTOR daquele escopo mostra e edita — três estados, não dois.
 *
 * Sem `herda`, "ligado nesta escola" fica idêntico a "herdado ligado" e
 * desfazer a exceção é impossível: um controle de dois estados não tem como
 * expressar "apague a minha linha e volte a seguir o escopo de cima".
 */
export const ESTADOS_DO_INTERRUPTOR = ["ligado", "desligado", "herda"] as const;

const EfetivoNoPainelSchema = z.object({
  ligado: z.boolean(),
  /** `padrao` = ninguém decidiu em escopo nenhum; o mundo nasce LIGADO. */
  origem: z.enum(["padrao", "contrato", "herdado", "aqui"]),
  /** Id do escopo que decidiu. `null` no contrato e no padrão. */
  decididoEm: z.string().nullable(),
  motivo: z.string().nullable(),
});

const ExperienciaNoPainelSchema = z.object({
  expId: z.string(),
  nome: z.string(),
  /** O que o interruptor desta linha mostra NESTE escopo. */
  estadoAqui: z.enum(ESTADOS_DO_INTERRUPTOR),
  efetivo: EfetivoNoPainelSchema,
  /** `true` quando quem desligou foi o TETO do produto, não esta linha. É o que
   *  desabilita o interruptor com o motivo ao lado, em vez de mentir. */
  tetoDoProduto: z.boolean(),
  /** A versão que o hub monta hoje (`experiencias.versao_ativa`). */
  versaoAtiva: z.string(),
  /** Versão fixada NESTE escopo; `null` = segue a ativa. */
  versaoFixa: z.string().nullable(),
});

const ProdutoNoPainelSchema = z.object({
  slug: z.enum(PRODUTOS),
  estadoAqui: z.enum(ESTADOS_DO_INTERRUPTOR),
  efetivo: EfetivoNoPainelSchema,
  experiencias: z.array(ExperienciaNoPainelSchema),
});

export const PainelSchema = z.object({
  /** O escopo que está sendo olhado. `escolaId` nulo = o contrato inteiro. */
  escopo: z.object({
    escolaId: z.string().nullable(),
    nome: z.string(),
    /** `escola` | `regional` — o `tipo` da linha de `escolas`. */
    tipo: z.string().nullable(),
  }),
  produtos: z.array(ProdutoNoPainelSchema),
});

/**
 * O escopo vem no CORPO, e `escolaId` ausente significa o CONTRATO.
 *
 * Não é `?escolaId=` opcional por um motivo prático: numa querystring, ausente e
 * vazio são indistinguíveis, e "desligar para a rede inteira" não pode acontecer
 * porque alguém montou a URL sem o parâmetro.
 */
export const DefinirDisponibilidadeSchema = z
  .object({
    /** `null` explícito = o contrato inteiro. */
    escolaId: z.string().min(1).nullable(),
    ligado: z.boolean(),
    motivo: z.string().trim().min(3).max(400).optional(),
  })
  .refine((d) => d.ligado || (d.motivo && d.motivo.length >= 3), {
    /* Espelha o CHECK `ck_disponibilidades_motivo_ao_desligar`. Aqui a recusa é
       de PRODUTO (a tela mostra o campo em erro); no banco é a garantia. Sem as
       duas, ou a tela não explica ou o painel não sabe explicar o que mostra. */
    message: "desligar exige motivo",
    path: ["motivo"],
  });

export const RecursoAlteradoSchema = z.object({
  recursoId: z.string(),
  escolaId: z.string().nullable(),
  ligado: z.boolean(),
  motivo: z.string().nullable(),
});

/** O que a remoção da exceção devolve — a linha deixou de existir. */
export const ExcecaoRemovidaSchema = z.object({
  recursoId: z.string(),
  escolaId: z.string().nullable(),
  removida: z.boolean(),
});

/* ==========================================================================
   VERSÃO: o histórico, a ativação e a fixação por escopo
   ========================================================================== */

/** Uma linha de `experiencias_versoes`. `manifesto` fica FORA da resposta: ele
 *  é insumo da ativação, não informação de tela — e carrega dez campos que a
 *  lista não usa. */
export const VersaoPublicadaSchema = z.object({
  versao: z.string(),
  publicadaEm: z.string().datetime(),
  publicadaPor: z.string(),
  /** `true` na que o hub monta hoje (`experiencias.versao_ativa`). */
  ativa: z.boolean(),
});

export const VersoesDaExperienciaSchema = z.object({
  expId: z.string(),
  versaoAtiva: z.string(),
  /**
   * `true` quando a ativa NÃO é a última publicada — a experiência está em
   * rollback. É o estado que a tela precisa dizer com todas as letras: sem
   * isso, um deploy futuro "conserta" o rollback sem ninguém perceber.
   */
  emRollback: z.boolean(),
  versoes: z.array(VersaoPublicadaSchema),
});

export const AtivarVersaoSchema = z.object({
  versao: z.string().regex(/^\d+\.\d+\.\d+$/, "versão semver x.y.z"),
  motivo: z.string().trim().min(3).max(400).optional(),
});

export const VersaoAtivadaSchema = z.object({
  expId: z.string(),
  versaoAtiva: z.string(),
  /**
   * A conferência no CDN aconteceu? `false` = `CDN_EXP_URL` ausente (dev), e a
   * tela precisa dizer isso: "ativei sem conferir" e "ativei e conferi" são
   * garantias diferentes.
   */
  conferida: z.boolean(),
  /** O manifesto daquela versão foi restaurado junto (viewport, permissões…). */
  manifestoRestaurado: z.boolean(),
});

/** `versao: null` solta a fixação e volta a seguir a `versao_ativa`. */
export const FixarVersaoSchema = z.object({
  escolaId: z.string().min(1).nullable(),
  versao: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "versão semver x.y.z")
    .nullable(),
});

export const VersaoFixadaSchema = z.object({
  expId: z.string(),
  escolaId: z.string().nullable(),
  versaoFixa: z.string().nullable(),
  conferida: z.boolean(),
});

/* ==========================================================================
   HISTÓRICO (ADR-89) — lido pelo painel da Unooria e pelo da rede
   ========================================================================== */

export const LinhaDoHistoricoSchema = z.object({
  id: z.string(),
  recursoId: z.string(),
  /** `null` = a mudança foi no escopo do CONTRATO. */
  escolaId: z.string().nullable(),
  acao: z.string(),
  /** Só nas ações de versão (CHECK bicondicional no banco). */
  versao: z.string().nullable(),
  motivo: z.string().nullable(),
  /** Só em `quota-alterada` (ADR-105): o teto que valia e o que passou a valer. */
  detalhe: DetalheDeQuotaSchema.nullable(),
  /** CONGELADO na linha — nunca um JOIN. Ver a nota da rota. */
  autorNome: z.string(),
  quando: z.string().datetime(),
});

export const HistoricoDeRecursosSchema = z.object({
  /** `true` quando bateu no teto de 200 — a tela precisa dizer que há mais. */
  truncado: z.boolean(),
  linhas: z.array(LinhaDoHistoricoSchema),
});

/* ==========================================================================
   A QUOTA DE IA (ADR-105) — só `admin`, como o painel

   Uma linha por perfil, escopo do contrato inteiro. O contador do dia
   (`ia_uso_diario`) NÃO sai aqui: é dado por pessoa, e esta tela é da rede.
   ========================================================================== */

export const PerfilDaQuotaSchema = z.enum(PERFIS_COM_QUOTA);

/**
 * Teto de SANIDADE, não de negócio: 100 milhões de tokens por dia é mais do que
 * qualquer rede gastaria num mês, e existe para um zero a mais no campo não
 * virar "quota infinita" sem ninguém notar. Zero e negativo o banco também
 * recusa (CHECK): desligar a IA de um produto é o interruptor da ADR-87, não a
 * quota.
 */
export const TETO_DE_SANIDADE_DA_QUOTA = 100_000_000;

export const QuotaDeIaSchema = z.object({
  perfil: PerfilDaQuotaSchema,
  tokensPorDia: z.number().int().positive(),
  motivo: z.string().nullable(),
  /** `null` = veio da migration; ninguém decidiu ainda. */
  definidoPorNome: z.string().nullable(),
  definidoEm: z.string().datetime(),
});

export const QuotasDeIaSchema = z.object({
  /** Sempre uma por perfil de `PERFIS_COM_QUOTA`, na ordem da tupla. */
  quotas: z.array(QuotaDeIaSchema),
});

export const DefinirQuotaDeIaSchema = z.object({
  tokensPorDia: z
    .number()
    .int("a quota é um inteiro de tokens")
    .positive("a quota tem de ser maior que zero — para fechar a IA, desligue o produto")
    .max(TETO_DE_SANIDADE_DA_QUOTA, "acima do teto de sanidade (100 milhões de tokens por dia)"),
  /** Obrigatório SEMPRE: aqui toda mudança é exceção ao padrão da plataforma. */
  motivo: z.string().trim().min(3, "diga por quê — o motivo fica no histórico").max(500),
});

export const QuotaAlteradaSchema = QuotaDeIaSchema.extend({
  /** `false` quando o valor pedido já era o que valia: nada foi gravado nem historiado. */
  alterada: z.boolean(),
});
