import { z } from "zod";
import { SERIES } from "../comum/series";
import { ProdutoSchema } from "../recursos/catalogo";

export const CAPABILITIES = [
  "telemetria",
  "progresso",
  "ia",
  "avaliacao",
  "tempo-real",
] as const;

/** Lista FECHADA e curta do que o `ExpFrame` traduz em token de sandbox.
 *  `fullscreen` não entra: o `allow` do frame já o delega a todas.
 *  Mexeu aqui? Migration do CHECK também — `tests/permissoes-de-iframe.spec.ts`
 *  cobra as duas, porque a divergência só aparece como 500 no CI. */
export const PERMISSOES_DE_IFRAME = ["pointer-lock", "forms", "downloads"] as const;

export const ViewportSchema = z.object({
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
});

export const UpsertSchema = z.object({
  nome: z.string().min(1).max(120),
  versaoAtiva: z.string().regex(/^\d+\.\d+\.\d+$/, "versão semver x.y.z"),
  series: z.array(z.enum(SERIES)).default([]),
  /** A unidade do ano (1 a 4). Ausente na transversal e na ferramenta de
   *  professor — elas não moram numa unidade. Ordena a grade da sala. */
  unidade: z.number().int().min(1).max(4).nullish(),
  /**
   * A QUE PRODUTO a experiência pertence — o que a põe no painel da Unooria
   * (ADR-87) e o que dá a ela o TETO do produto.
   *
   * `nullish` e não obrigatório, DE PROPÓSITO. Obrigatório aqui faria um
   * manifesto sem o campo virar 400 no job `ativar-exps` do deploy — ou seja,
   * DEPOIS de os bundles já terem subido, com a `versaoAtiva` ainda apontando
   * para a versão antiga. É a mesma falha que o comentário do `ativar-exps`
   * descreve para o `pnpm install` faltando.
   *
   * Quem cobra o campo é `tests/manifestos-declaram-produto.spec.ts`, que roda
   * no CI ANTES do deploy — o portão certo é o que falha cedo.
   */
  produto: ProdutoSchema.nullish(),
  capabilities: z.array(z.enum(CAPABILITIES)).default([]),
  viewport: ViewportSchema.nullish(),
  publico: z
    .enum(["estudante", "professor"])
    .default("estudante")
    .transform((v) => (v)),
  permissoes: z.array(z.enum(PERMISSOES_DE_IFRAME)).default([]),
});

/**
 * A linha do manifesto como ela sai do banco.
 *
 * `series: []` significa **todas as séries**, não nenhuma — é assim que uma
 * experiência transversal se declara (app-70). E `viewport` ausente não é falta
 * de dado: é a experiência dizendo que foi desenhada para a janela, não para
 * uma casca de aparelho (a exp04ef1b é assim).
 *
 * `series`, `capabilities` e `permissoes` saem como `z.string()` e não como os
 * enums acima de propósito: são colunas `String[]` sem CHECK no banco, e uma
 * linha antiga com valor fora do vocabulário é dado real, não erro de contrato.
 * O enum vale na ENTRADA, que é onde se pode recusar.
 */
export const ExperienciaSchema = z.object({
  expId: z.string(),
  nome: z.string(),
  versaoAtiva: z.string(),
  series: z.array(z.string()),
  unidade: z.number().int().nullable(),
  /** `z.string()` e não o enum, pelo mesmo motivo dos três campos abaixo: linha
   *  anterior à coluna tem `null` aqui, e é dado real. */
  produto: z.string().nullable(),
  capabilities: z.array(z.string()),
  viewport: ViewportSchema.nullable(),
  publico: z.string(),
  permissoes: z.array(z.string()),
  atualizadoEm: z.string().datetime(),
});

export const CatalogoSchema = z.object({ experiencias: z.array(ExperienciaSchema) });

/** `null` quando o `expId` não tem linha — o hub cai no `experiencia.json`
 *  servido ao lado do bundle, que é o caso de dev e de stack recém-criada. */
export const UmaExperienciaSchema = z.object({ experiencia: ExperienciaSchema.nullable() });
