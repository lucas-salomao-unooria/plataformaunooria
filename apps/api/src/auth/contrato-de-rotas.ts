import { z } from "zod";
import { PerfilSchema } from "./claims";
import { SerieSchema } from "../comum/series";
import { TAMANHO_MINIMO_DE_SENHA } from "../rostering/regras";

export const LoginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const TrocaSchema = z.object({
  username: z.string().trim().min(1).max(64),
  senhaAtual: z.string().min(1).max(200),
  senhaNova: z
    .string()
    .min(TAMANHO_MINIMO_DE_SENHA, `mínimo ${TAMANHO_MINIMO_DE_SENHA} caracteres`)
    .max(200),
});

/** Uma escola em que a pessoa tem lotação ativa. O hub monta o seletor do
 *  cabeçalho com esta lista — e a reconsulta para VALIDAR a troca de escola
 *  ativa, nunca confiando na lista que o cookie carrega. */
export const EscolaDoLoginSchema = z.object({
  /** NÃO é uuid: `Escola.id` é `String @id` sem default no schema — o id da
   *  escola vem da rede (a seed usa `escola-demo`). Só `Turma.id` é gerado. */
  id: z.string(),
  nome: z.string(),
  papel: z.string(),
});

export const LoginRespostaSchema = z.object({
  escolas: z.array(EscolaDoLoginSchema),
  usuarioId: z.string().uuid(),
  /** O login em si — a troca de senha precisa dele. */
  usuario: z.string(),
  nome: z.string(),
  papel: PerfilSchema,
  /** Nulo apenas para `admin-contrato`, a única exceção cross-escola. */
  escolaId: z.string().nullable(),
  turmaId: z.string().uuid().nullable(),
  serie: SerieSchema.nullable(),
  /** Enquanto for `true`, o hub prende a pessoa em `/trocar-senha` — e recusa
   *  emitir token de experiência, senão bastaria digitar `/exp/...` para pular. */
  precisaTrocarSenha: z.boolean(),
});

export const TrocaRespostaSchema = z.object({ ok: z.literal(true) });
