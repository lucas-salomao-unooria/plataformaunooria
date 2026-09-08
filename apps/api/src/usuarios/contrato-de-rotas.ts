import { z } from "zod";
import { cpfEhValido } from "../comum/cpf";

export const ListarSchema = z.object({
  papel: z.enum(["estudante", "professor", "gestor_escola"]).optional(),
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
  papel: z.enum(["estudante", "professor", "gestor_escola"]).optional(),
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
  /** A unidade da lotação principal. Nulo só no `gestor_contrato`, que não tem. */
  escola: z.string().nullable(),
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
  /** Todas as ativas: estudante em eletiva tem mais de uma. */
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

/* ------------------------------------------------------- cadastro unitário */

/**
 * O balcão: uma pessoa por vez, digitada no formulário.
 *
 * A validação aqui é ESTRUTURAL de propósito — tipos, tamanhos e `.strict()`.
 * Quem valida domínio (CPF com dígito verificador, série, turno, formato do
 * login, "estudante precisa de turma") é o leitor da planilha, porque este
 * corpo vira uma linha de CSV e passa pelo MESMO importador (ADR-59). Repetir
 * a regra em Zod criaria a segunda fonte de verdade que a ADR-54 recusou: uma
 * das duas aprenderia a próxima regra e a outra não, em silêncio.
 *
 * `serie` é string livre pelo mesmo motivo: `normalizarSerie` aceita `8`, `08`,
 * `8EF` e `ext:8EF`, e prender em `SerieSchema` recusaria aqui o que a
 * importação aceita ali — a divergência ao contrário.
 */
export const CriarUsuarioSchema = z
  .object({
    /** `gestor_contrato` tem rota própria: não tem escola, turma nem lotação. */
    papel: z.enum(["estudante", "professor", "gestor_escola"]),
    nome: z.string().trim().min(1).max(120),
    cpf: z.string().trim().max(14).optional(),
    /** A matrícula da REDE (o RA) — a chave que reconhece a pessoa depois. */
    matricula: z.string().trim().max(64).optional(),
    /** Em branco: gerado a partir do nome (`primeiro.ultimo`). */
    usuario: z.string().trim().max(64).optional(),
    email: z.string().trim().max(180).optional(),
    turma: z.string().trim().max(40).optional(),
    serie: z.string().trim().max(12).optional(),
    turno: z.string().trim().max(12).optional(),
    /** Em branco: sorteada e devolvida uma vez. Sempre provisória. */
    senha: z.string().min(8).max(200).optional(),
  })
  .strict();

/** O que o formulário mostra depois de criar — e a senha, UMA vez. */
export const UsuarioCriadoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  /** Pode diferir do digitado: o leitor normaliza (sem acento, minúsculas). */
  usuario: z.string(),
  papel: z.string(),
  turma: z.string().nullable(),
  /** A turma não existia e nasceu junto — `8A ` com espaço vira turma nova. */
  turmaCriada: z.boolean(),
  senha: z.string(),
  /** O que foi aceito mas ignorado (turma de gestor, por exemplo). */
  avisos: z.array(z.object({ campo: z.string(), mensagem: z.string() })),
});

/**
 * `gestor_contrato` é operação do PRODUTO, não da escola: sem `escola_id`, sem
 * lotação, sem turma. Por isso o corpo é outro, e a rota também — a matriz
 * papel x rota fica legível sem nota de rodapé.
 *
 * Aqui o CPF é validado no Zod porque não há importador atrás para validá-lo.
 */
export const CriarAdminContratoSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    cpf: z.string().refine(cpfEhValido, "CPF inválido — confira os dígitos").optional(),
    email: z.string().email().max(180).optional(),
    usuario: z
      .string()
      .trim()
      .regex(/^[a-z0-9._-]{3,64}$/, "Login: 3 a 64 caracteres, minúsculas, números, . _ -")
      .optional(),
    senha: z.string().min(8).max(200).optional(),
  })
  .strict();

export const AdminContratoCriadoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  papel: z.literal("gestor_contrato"),
  senha: z.string(),
});
