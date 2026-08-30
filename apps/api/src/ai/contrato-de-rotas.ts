import { z } from "zod";

export const GerarSchema = z.object({
  expId: z.string(),
  atividade: z.string().max(200),
  mensagem: z.string().max(2000),
});

/** Só o texto. O prompt de sistema, o modelo e a contagem de tokens NÃO saem
 *  daqui: prompt é segredo que não vai a bundle client (regra 2), e o consumo
 *  é assunto da quota, não do estudante. */
export const GerarRespostaSchema = z.object({ texto: z.string() });
