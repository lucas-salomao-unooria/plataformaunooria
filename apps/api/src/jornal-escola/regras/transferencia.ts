import { z } from "zod";
import { DECISOES_DA_TRANSFERENCIA, TIPOS_DE_PISTA, type DecisaoDaTransferencia, type TipoDePista } from "../vocabulario";

/**
 * A TRANSFERÊNCIA (3.0.0, ADR-168) — o boato do Desafio Final, agora por AÇÃO:
 * a mensagem chega com "Repassar para o grupo" e "Não repassar" à mão desde o
 * início, e as três pistas para abrir. Tela NEUTRA (sem fala do Bento, sem
 * destaque nas pistas): nada pede para verificar. Puro.
 *
 * O texto das pistas do boato é FIXO (`catalogo.ts#BOATO_DA_TRANSFERENCIA`) —
 * o boato é o de "todas as escolas do bairro", diferente do da mesa: aqui é
 * transferência, e não memória.
 */

export interface Transferencia {
  /** As pistas abertas ANTES da decisão, na ordem. */
  pistas: TipoDePista[];
  decisao: DecisaoDaTransferencia;
}

export const TransferenciaSchema = z.object({
  pistas: z
    .array(z.enum(TIPOS_DE_PISTA))
    .max(TIPOS_DE_PISTA.length)
    .refine((ps) => new Set(ps).size === ps.length, { message: "Cada pista uma vez." }),
  decisao: z.enum(DECISOES_DA_TRANSFERENCIA),
});

export function transferenciaDaLinha(bruto: unknown): Transferencia | null {
  const lido = TransferenciaSchema.safeParse(bruto);
  return lido.success ? lido.data : null;
}
