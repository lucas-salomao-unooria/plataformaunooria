import { z } from "zod";
import { PERFIS } from "../comum/insta/defaults";
import { antagonismoSchema } from "../comum/insta/tipos";

const Uuid = z.string().uuid();
const LadoOuNeutro = z.enum(["A", "B", "neutro"]);

// ------------------------------------------------------------------ entrada

export const DestilarSchema = z
  .object({ perguntaChave: z.string().trim().min(10).max(280).optional() })
  .default({});

export const AntagonismoDoProfessorSchema = z.object({
  antagonismo: antagonismoSchema,
  /** Neutros FORA do tema. Pode vir vazio quando o modo é `no_tema`. */
  categoriasNeutras: z.array(z.string().trim().min(2).max(40)).max(10).default([]),
  /** Neutros DENTRO do tema: fato sem lado. */
  neutrosNoTema: z.array(z.string().trim().min(2).max(60)).max(8).default([]),
  /** Override explícito quando o medidor de equilíbrio reprova. */
  forcar: z.boolean().default(false),
});

export const FiltrosSchema = z.object({
  lado: LadoOuNeutro.optional(),
  perfil: z.enum(PERFIS).optional(),
  intensidade: z.coerce.number().int().min(1).max(3).optional(),
  categoria: z.string().trim().min(1).max(60).optional(),
  imagem: z.enum(["pendente", "ok", "fallback"]).optional(),
  aprovado: z.enum(["sim", "nao"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const EditarPostSchema = z.object({
  caption: z.string().trim().min(10).max(400).optional(),
  hashtags: z.array(z.string().trim().min(2).max(40)).min(1).max(5).optional(),
  aprovado: z.boolean().optional(),
  comentarios: z
    .array(z.object({ id: Uuid, texto: z.string().trim().min(2).max(220) }))
    .max(6)
    .optional(),
});

export const RegenerarSchema = z.object({ alvo: z.enum(["texto", "imagem"]) });

// -------------------------------------------------------------------- saída

export const OkSchema = z.object({ ok: z.literal(true) });

/**
 * `POST /atividades/:id/gerar` tem DUAS respostas, e a diferença importa para a
 * tela: `retomado` quando havia uma geração parada no meio (nada novo foi
 * enfileirado), e `lotes` quando ela começou agora. Um schema com `lotes`
 * opcional esconderia que são dois caminhos.
 */
export const GeracaoDisparadaSchema = z.union([
  z.object({ ok: z.literal(true), retomado: z.literal(true) }),
  z.object({ ok: z.literal(true), lotes: z.number().int().nonnegative() }),
]);

/** O antagonismo destilado pela IA, para o professor aprovar ou reescrever. */
export const DestiladoSchema = z.object({
  antagonismo: antagonismoSchema,
  perguntaChave: z.string(),
  /** `professor` quando ele escreveu a pergunta; `ia` quando ela foi destilada. */
  perguntaOrigem: z.enum(["professor", "ia"]),
});

export const ProgressoDaGeracaoSchema = z.object({
  etapa: z.enum(["personas", "posts", "imagens", "validacao", "concluido"]),
  feitos: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  erros: z.array(z.string()),
  status: z.string(),
  postsCriados: z.number().int().nonnegative(),
  imagensOk: z.number().int().nonnegative(),
  imagensFallback: z.number().int().nonnegative(),
  imagensPendentes: z.number().int().nonnegative(),
});

export const PostDaGradeSchema = z.object({
  id: Uuid,
  lado: z.string(),
  perfil: z.string().nullable(),
  intensidade: z.number().int().nullable(),
  categoria: z.string().nullable(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  emotionalHook: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageStatus: z.string(),
  imageBrief: z.string().nullable(),
  likesCount: z.number().int(),
  timestampLabel: z.string(),
  aprovado: z.boolean(),
  author: z.object({
    handle: z.string(),
    displayName: z.string(),
    verificado: z.boolean(),
  }),
  comments: z.array(
    z.object({
      id: Uuid,
      handle: z.string(),
      texto: z.string(),
      likesCount: z.number().int(),
      ordem: z.number().int(),
    }),
  ),
});

/**
 * A grade de revisão do professor.
 *
 * A ordenação é `(created_at, id)` e o `id` **não é enfeite**: os posts entram
 * por `createMany` numa transação, então o lote inteiro compartilha o mesmo
 * `created_at`. Com a chave empatada, `LIMIT/OFFSET` não tem ordem definida — a
 * mesma linha vem em duas páginas e outra nunca vem (medido: 207 de 208
 * visíveis, reprodutível).
 */
export const GradeDePostsSchema = z.object({
  posts: z.array(PostDaGradeSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  paginas: z.number().int().positive(),
  categorias: z.array(z.string().nullable()),
  aprovadosPorLado: z.record(z.number().int().nonnegative()),
  /** Matriz 2×4 — os lados podem estar 50/50 e um perfil inteiro estar vazio. */
  matriz: z.array(
    z.object({
      lado: z.string(),
      perfil: z.string().nullable(),
      aprovados: z.number().int().nonnegative(),
    }),
  ),
  esperadoPorCelula: z.number().int().nonnegative(),
  fracaoMinimaPorCelula: z.number().positive(),
});

/**
 * Os comentários de um post, na ordem de uma CONVERSA: o do aluno no topo (como
 * o Instagram faz com o seu), as reações logo depois, e os do roteiro por
 * último.
 */
export const ComentariosDoPostSchema = z.object({
  comments: z.array(
    z.object({
      id: Uuid,
      handle: z.string(),
      texto: z.string(),
      likesCount: z.number().int(),
      timestampLabel: z.string(),
      doAluno: z.boolean(),
    }),
  ),
  total: z.number().int().nonnegative(),
});
