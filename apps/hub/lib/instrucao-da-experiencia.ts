import { z } from "zod";

/**
 * A INSTRUÇÃO FORA DO APARELHO — o "chrome" que a experiência pede ao hub por
 * `exp:estado`, para um texto que não cabe (ou não deve morar) dentro dos
 * 375px do clone. Nasceu para o TC-10 da exp02em1b (O Efeito Amplificador
 * 2.1.0, ADR-191): a ordem do moderador do grêmio, com o TEMA do professor em
 * destaque, ao lado do feed da madrugada.
 *
 * O hub não interpreta domínio: desenha `antes` + `destaque` (em realce) +
 * `depois`, e nada mais. O que vem do iframe é input externo — passa pelo Zod,
 * e qualquer outra forma é IGNORADA (sem instrução na tela), nunca um erro.
 *
 * Contrato: `{ type: "exp:estado", estado: { instrucao: { antes, destaque, depois } } }`.
 * Como todo `exp:estado`, o estado é SUBSTITUÍDO inteiro a cada mensagem: a
 * instrução some quando a experiência publica um estado sem ela.
 */
export const InstrucaoSchema = z
  .object({
    antes: z.string().max(1000),
    destaque: z.string().max(200),
    depois: z.string().max(1000),
  })
  .refine((i) => `${i.antes}${i.destaque}${i.depois}`.trim().length > 0, "instrução vazia");

export type InstrucaoDaExperiencia = z.infer<typeof InstrucaoSchema>;

/** A instrução do estado publicado, ou `null` (ausente ou fora da forma). */
export function instrucaoDoEstado(estado: Record<string, unknown>): InstrucaoDaExperiencia | null {
  if (!("instrucao" in estado)) return null;
  const r = InstrucaoSchema.safeParse(estado.instrucao);
  return r.success ? r.data : null;
}
