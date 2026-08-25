import { z } from "zod";

/**
 * Séries no formato canônico do manifesto/CSV (`1EF..9EF`, `1EM..3EM`) — a
 * mesma lista de `apps/hub/lib/series.ts`. Extraída do controller de
 * experiências porque o módulo de planos de aula também valida por ela.
 */
export const SERIES = [
  "1EF", "2EF", "3EF", "4EF", "5EF", "6EF", "7EF", "8EF", "9EF",
  "1EM", "2EM", "3EM",
] as const;

export type Serie = (typeof SERIES)[number];

export const SerieSchema = z.enum(SERIES);

/** Rótulo humano (o que o professor lê no `Selection` e no título do plano). */
export function rotuloDaSerie(serie: Serie): string {
  const numero = serie[0];
  return serie.endsWith("EM") ? `${numero}ª série EM` : `${numero}º ano`;
}
