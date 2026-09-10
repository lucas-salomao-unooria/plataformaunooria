import { z } from "zod";
import { PRODUTOS } from "./catalogo";

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
