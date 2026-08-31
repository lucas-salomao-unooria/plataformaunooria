import { z } from "zod";
import { SERIES } from "../comum/series";

export const CAPABILITIES = [
  "telemetria",
  "progresso",
  "ia",
  "avaliacao",
  "tempo-real",
] as const;

/** Lista FECHADA e curta do que o `ExpFrame` traduz em token de sandbox.
 *  `fullscreen` não entra: o `allow` do frame já o delega a todas. */
export const PERMISSOES_DE_IFRAME = ["pointer-lock", "forms"] as const;

export const ViewportSchema = z.object({
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
});

export const UpsertSchema = z.object({
  nome: z.string().min(1).max(120),
  versaoAtiva: z.string().regex(/^\d+\.\d+\.\d+$/, "versão semver x.y.z"),
  series: z.array(z.enum(SERIES)).default([]),
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
 * experiência transversal se declara (exp-70). E `viewport` ausente não é falta
 * de dado: é a experiência dizendo que foi desenhada para a janela, não para
 * uma casca de aparelho (a exp-02 é assim).
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
