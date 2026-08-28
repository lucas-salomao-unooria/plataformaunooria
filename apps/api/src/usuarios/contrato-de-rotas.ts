import { z } from "zod";
import { cpfEhValido } from "../comum/cpf";

export const ListarSchema = z.object({
  papel: z.enum(["aluno", "professor", "gestor"]).optional(),
  turmaId: z.string().uuid().optional(),
  situacao: z.enum(["ativos", "inativos", "sem-primeiro-acesso"]).optional(),
  /** Nome, login, matrícula — e CPF, com ou sem pontuação. */
  busca: z.string().trim().max(80).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  escolaId: z.string().min(1).optional(),
});

export const EditarSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  /** Corrigir CPF é caminho de balcão: a planilha veio com o dígito trocado e a
   *  família traz o documento. **Vazio APAGA o campo** — é o que se faz quando o
   *  número era de outra pessoa. */
  cpf: z
    .union([z.literal(""), z.string().refine(cpfEhValido, "CPF inválido — confira os dígitos")])
    .optional(),
  email: z.union([z.literal(""), z.string().email().max(180)]).optional(),
  papel: z.enum(["aluno", "professor", "gestor"]).optional(),
  ativo: z.boolean().optional(),
});

/** Uma turma em que a pessoa tem matrícula ativa. */
export const TurmaDaPessoaSchema = z.object({
  matriculaId: z.string().uuid(),
  nome: z.string(),
  serie: z.string(),
  papel: z.string(),
});

export const UsuarioEmListaSchema = z.object({
  id: z.string().uuid(),
  usuario: z.string(),
  nome: z.string(),
  papel: z.string(),
  /** O RA da rede — a chave da pessoa. Nulo em conta de assento. */
  matricula: z.string().nullable(),
  /** FORMATADO, e visível: o gestor confere identidade contra o sistema da rede
   *  e atende a família no balcão (ADR-33). */
  cpf: z.string().nullable(),
  email: z.string().nullable(),
  ativo: z.boolean(),
  /** Ainda não fez o primeiro acesso (senha veio da importação). */
  senhaProvisoria: z.boolean(),
  /** Da matrícula PRINCIPAL — a turma de referência. */
  turma: z.string().nullable(),
  serie: z.string().nullable(),
  /** Todas as ativas: aluno em eletiva tem mais de uma. */
  turmas: z.array(TurmaDaPessoaSchema),
  criadoEm: z.string().datetime(),
});

export const ListaDeUsuariosSchema = z.object({
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  porPagina: z.number().int().positive(),
  usuarios: z.array(UsuarioEmListaSchema),
});

export const UsuarioEditadoSchema = z.object({
  id: z.string().uuid(),
  usuario: z.string(),
  nome: z.string(),
  papel: z.string(),
  email: z.string().nullable(),
  cpf: z.string().nullable(),
  ativo: z.boolean(),
});

/** A senha sai UMA vez, para o gestor entregar. Não fica em coluna nem em log. */
export const SenhaResetadaSchema = z.object({
  usuario: z.string(),
  senhaTemporaria: z.string(),
});
