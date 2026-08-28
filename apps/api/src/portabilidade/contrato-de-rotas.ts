import { z } from "zod";
import { VERIFICACOES } from "./catalogo";
import { PerfilPortatilSchema } from "./regras";

const Uuid = z.string().uuid();

/**
 * O documento SEM `emissor` e sem `emitidoEm` — quem preenche os dois é o HUB,
 * ao assinar. A api monta; assinar exige a chave privada, que só o hub tem.
 */
export const PerfilParaAssinarSchema = PerfilPortatilSchema.omit({
  emissor: true,
  emitidoEm: true,
});

/** O resumo de um documento recebido: CONTAGENS, para a tela dizer o que veio
 *  sem despejar o documento inteiro. */
export const PerfilRecebidoSchema = z.object({
  id: Uuid,
  emissor: z.string(),
  emissorNome: z.string().nullable(),
  emissorHub: z.string(),
  emitidoEm: z.string().datetime(),
  /** `nao-verificada` NÃO é recusa: é o rótulo de "não deu para conferir".
   *  Assinatura que não bate é **400**, e o documento não entra. */
  verificacao: z.enum(VERIFICACOES),
  importadoEm: z.string().datetime(),
  escolas: z.number().int().nonnegative(),
  turmas: z.number().int().nonnegative(),
  participacoes: z.number().int().nonnegative(),
  resultados: z.number().int().nonnegative(),
});

export const PerfisRecebidosSchema = z.array(PerfilRecebidoSchema);

/** O documento inteiro, como veio — para o gestor conferir e para reemitir. */
export const DocumentoRecebidoSchema = z.object({
  id: Uuid,
  emissor: z.object({
    contrato: z.string(),
    hub: z.string(),
    nome: z.string().nullable(),
  }),
  emitidoEm: z.string().datetime(),
  verificacao: z.enum(VERIFICACOES),
  /** Guardado *verbatim*: alterar qualquer byte destruiria a assinatura. É a
   *  ÚNICA exceção à contenção do CPF em `users.cpf` (ADR-33). */
  documento: z.unknown(),
});

export const OkSchema = z.object({ ok: z.literal(true) });
