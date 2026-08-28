import { z } from "zod";

/** As duas rotas de sanidade respondem a mesma coisa: um `ok` e nada mais.
 *  O que distingue liveness de readiness é o que elas CHECAM antes, não o
 *  formato — e o sinal de "não pronto" é o 503, não um `ok: false`. */
export const SanidadeSchema = z.object({ ok: z.literal(true) });
