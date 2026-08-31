import { z } from "zod";

import { MINIMO_DA_REFLEXAO } from "../comum/insta/defaults";
import { eventoSchema } from "./tipos";

const Uuid = z.string().uuid();
const LadoSchema = z.enum(["A", "B"]);

// ------------------------------------------------------------------ entrada

export const CriarRunSchema = z
  .object({ avatar: z.string().trim().max(40).optional() })
  .default({});

export const EntrarSchema = z.object({
  /** O nome que aparece no aparelho. Pode ser apelido; é ele que o estudante lê —
   *  não tem relação com o nome real do estudante. */
  nome: z.string().trim().min(1).max(30),
  avatar: z.string().trim().min(1).max(30),
});

export const EventosSchema = z.object({ events: z.array(eventoSchema).min(1).max(200) });

export const ConclusaoSchema = z.object({ inclinacao: z.enum(["A", "B", "duvida"]) });

export const ReflexaoSchema = z.object({
  texto: z.string().trim().min(MINIMO_DA_REFLEXAO),
});

export const StudentPostSchema = z.object({
  texto: z.string().trim().min(1).max(280),
  template: z.string().trim().min(1).max(40),
});

export const ReacoesSchema = z.union([
  z.object({
    tipo: z.enum(["post_do_estudante", "post_do_aluno"]),
    studentPostId: Uuid,
    texto: z.string().trim().min(1).max(600),
  }),
  z.object({
    tipo: z.literal("comentario"),
    postId: Uuid,
    texto: z.string().trim().min(1).max(600),
  }),
]);

// -------------------------------------------------------------------- saída

/**
 * Um post como o ESTUDANTE o recebe. **Sem `lado`, sem `perfil`, sem
 * `intensidade`** — o disfarce depende disso: um bundle que soubesse o lado de
 * cada post entregaria o experimento inteiro antes da revelação.
 */
export const FeedPostSchema = z.object({
  id: Uuid,
  author: z.object({
    handle: z.string(),
    displayName: z.string(),
    verificado: z.boolean(),
    avatarSeed: z.string(),
  }),
  imageUrl: z.string().nullable(),
  /** Arte procedural quando a imagem não ficou pronta: o feed nunca fica com
   *  buraco, e `fallback` não é erro. */
  fallbackArt: z.object({ corFundo: z.string(), emojis: z.string() }).optional(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  likesCount: z.number().int(),
  timestampLabel: z.string(),
  sugerido: z.boolean(),
  commentsPreview: z.array(z.object({ handle: z.string(), texto: z.string() })),
  commentsTotal: z.number().int(),
});

const PerfilSugeridoSchema = z.object({
  handle: z.string(),
  displayName: z.string(),
  avatarSeed: z.string(),
  verificado: z.boolean(),
  authorId: Uuid,
});

export const ModuloFeedSchema = z.union([
  z.object({ tipo: z.literal("sugestoes"), perfis: z.array(PerfilSugeridoSchema) }),
  z.object({ tipo: z.literal("notificacao_seguidor"), perfil: PerfilSugeridoSchema }),
  z.object({ tipo: z.literal("fim_sessao") }),
]);

/** O `diagnostico` do motor (domínio, lado dominante, bloco) **não sai daqui**:
 *  fica no servidor. Nada de domínio ou lado no bundle do estudante. */
export const BlocoDoFeedSchema = z.object({
  posts: z.array(FeedPostSchema),
  modulos: z.array(ModuloFeedSchema),
});

export const RunCriadaSchema = z.object({ runId: Uuid, fase: z.string() });

/**
 * O bootstrap da experiência. Só os RÓTULOS dos lados — os únicos campos do
 * antagonismo que o cliente pode ver antes da revelação.
 */
export const BootSchema = z.object({
  runId: Uuid.nullable(),
  fase: z.string(),
  missao: z.object({
    perguntaChave: z.string(),
    ladoALabel: z.string(),
    ladoBLabel: z.string(),
  }),
  estudante: z
    .object({
      displayName: z.string(),
      handle: z.string(),
      avatar: z.string(),
    })
    .optional(),
  aluno: z
    .object({
      displayName: z.string(),
      handle: z.string(),
      avatar: z.string(),
    })
    .optional(),
});

export const FaseSchema = z.object({ ok: z.literal(true), fase: z.string() });

/** A tela que o estudante deve estar vendo AGORA, já reconciliada com a etapa da
 *  turma: os momentos coletivos são do PROFESSOR. */
export const FaseAtualSchema = z.object({ fase: z.string(), etapa: z.string() });

export const RunResetadaSchema = z.object({
  ok: z.literal(true),
  ladoInicial: LadoSchema,
  ladoOrigem: z.string(),
  rotuloDoLadoInicial: z.string().optional(),
});

/** `descartados` são os eventos que a idempotência por `(client_ts, tipo,
 *  postId)` já tinha: reenvio é rotina no cliente, não erro. */
export const EventosGravadosSchema = z.object({
  ok: z.literal(true),
  gravados: z.number().int().nonnegative(),
  descartados: z.number().int().nonnegative(),
  comentarios: z.number().int().nonnegative(),
});

export const BuscaSchema = z.object({
  posts: z.array(FeedPostSchema),
  termo: z.string().nullable(),
});

export const SalvosSchema = z.object({
  posts: z.array(FeedPostSchema),
  comentarios: z.record(z.unknown()),
});

const PostPerdidoSchema = z.object({
  id: Uuid,
  author: z.object({ handle: z.string(), displayName: z.string(), verificado: z.boolean() }),
  imageUrl: z.string().nullable(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  likesCount: z.number().int(),
  timestampLabel: z.string(),
});

/**
 * O que o estudante PERDEU: posts do lado oposto que nunca foram servidos.
 *
 * Só das etapas `perdidos` em diante — antes disso derrubaria o disfarce, que é
 * o que a atividade inteira depende de manter até a revelação.
 */
export const PerdidosSchema = z.object({
  /**
   * `null` quando a sessão não chegou a servir post de tese nenhum: aí não há
   * lado a nomear, e a tela diz isso em vez de contar zero (ADR-42).
   */
  ladoPerdido: z.string().nullable(),
  rotuloDoLadoPerdido: z.string().nullable(),
  rotuloDoLadoDele: z.string().nullable(),
  contagem: z.object({
    totalNoAcervo: z.number().int().nonnegative(),
    vistos: z.number().int().nonnegative(),
    perdidos: z.number().int().nonnegative(),
  }),
  posts: z.array(PostPerdidoSchema.passthrough()),
});

export const ConclusaoGravadaSchema = z.object({
  ok: z.literal(true),
  fase: z.literal("conclusao"),
});

/** `texto: ""` quando ainda não escreveu — o campo abre vazio, não com erro. */
export const ReflexaoSalvaSchema = z.object({
  texto: z.string(),
  /** O piso, dito pela api: o campo do estudante não tem mais um 60 próprio. */
  minimo: z.number().int().positive(),
});

export const ReflexaoGravadaSchema = z.object({
  ok: z.literal(true),
  caracteres: z.number().int().nonnegative(),
});

/**
 * O post do estudante publicado no app, com as reações das personas.
 *
 * **Falha fechada**: IA desligada, erro de rede ou reação recusada ⇒ lista
 * vazia, e o post é publicado do mesmo jeito — como num app real quando ninguém
 * responde.
 */
export const PostDoEstudanteSchema = z.object({
  post: z.unknown(),
  comentariosDeApoio: z.array(z.unknown()),
});

export const ReacoesGeradasSchema = z.object({
  reacoes: z.array(z.unknown()),
  /** `true` quando o professor desligou a IA ao vivo. */
  desligada: z.literal(true).optional(),
  /** `true` no teto de 12 reações por sessão: estudante comentando sem parar não
   *  queima a cota da turma. */
  limite: z.literal(true).optional(),
});

const ComponenteDeImersaoSchema = z.object({
  chave: z.string(),
  rotulo: z.string(),
  pontos: z.number(),
  detalhe: z.string(),
});

const PostDoDossieSchema = z.object({
  id: Uuid,
  /** Aqui o disfarce JÁ CAIU — por isso `lado` pode aparecer. */
  lado: z.string(),
  intensidade: z.number(),
  caption: z.string(),
  imageUrl: z.string().nullable(),
  imageStatus: z.string(),
  categoria: z.string(),
  handle: z.string(),
  fallbackArt: z.object({ corFundo: z.string(), emojis: z.string() }),
});

export const DossieSchema = z.object({
  dossie: z
    .object({
      /** Ausente nos dossiês congelados antes do M8. */
      versaoDoRelatorio: z.number().int().optional(),
      aluno: z.object({ displayName: z.string(), avatar: z.string() }),
      atividade: z.object({
        titulo: z.string(),
        perguntaChave: z.string(),
        ladoALabel: z.string(),
        ladoBLabel: z.string(),
      }),
      proporcaoFinal: z.object({ A: z.number(), B: z.number(), neutro: z.number() }),
      ladoDominante: z.enum(["A", "B", "indefinido"]),
      dominio: z.number(),
      porBloco: z.array(
        z.object({
          bloco: z.number(),
          A: z.number(),
          B: z.number(),
          neutro: z.number(),
          intensidadeMediaDominante: z.number(),
        }),
      ),
      topDwell: z.array(z.object({ postId: Uuid, dwellMs: z.number() })),
      postsOcultados: z.object({
        ladoOposto: z.array(z.string()),
        total: z.number().int(),
        ladoNaoObservado: z.boolean(),
      }),
      interacoes: z.object({
        curtidas: z.number(),
        comentarios: z.number(),
        salvos: z.number(),
        compartilhados: z.number(),
        seguidos: z.number(),
        naoInteressa: z.number(),
      }),
      sinais: z.array(
        z.object({
          sinal: z.string(),
          valorSessao: z.string(),
          contribuicao: z.number(),
        }),
      ),
      studentPost: z.object({ texto: z.string(), ladoInferido: z.string() }).optional(),
      /** Anexada na LEITURA, não no congelamento: o dossiê é computado no
       *  `finish`, antes de o estudante escrever. `undefined` quando a sessão foi
       *  interrompida — e o relatório precisa funcionar assim. */
      conclusao: z
        .object({
          inclinacao: z.enum(["A", "B", "duvida"]),
          texto: z.string().nullable(),
          escritaEm: z.string(),
        })
        .optional(),
      bolha: z.object({
        ladoInicial: LadoSchema,
        ladoOrigem: z.string(),
        inverteu: z.boolean(),
        blocoDaInversao: z.number().nullable(),
      }),
      /** **A seção nova mais importante**: por que o feed começou desse lado. */
      explicacaoDoLado: z
        .object({
          perfilRotulo: z.string().nullable(),
          ladoRotulo: z.string(),
          porQue: z.string().nullable(),
          origem: z.string(),
        })
        .passthrough(),
      perfilJogo: z
        .object({
          escores: z.record(z.number()),
          dominante: z.string(),
          origem: z.string(),
        })
        .nullable(),
      perfilObservado: z.object({
        normalizado: z.record(z.number()),
        dominante: z.string().nullable(),
        margem: z.number(),
        veredito: z.enum(["reforcou", "divergiu", "sem_referencia"]),
      }),
      /** Rótulos prontos no payload em vez de o cliente importar as FICHAS:
       *  elas carregam o vocabulário dos prompts, que não tem por que viajar
       *  até o navegador. */
      rotulosDePerfil: z.array(
        z.object({ chave: z.string(), rotulo: z.string(), prende: z.string() }),
      ),
      tempo: z.object({
        sessaoMs: z.number(),
        feedMs: z.number(),
        ativoMs: z.number(),
        ociosoMs: z.number(),
        vaosOciosos: z.number(),
        porLadoMs: z.object({ A: z.number(), B: z.number(), neutro: z.number() }),
        porPerfilMs: z.record(z.number()),
      }),
      ritmo: z.object({ postsPorMinuto: z.number(), variacaoDoRitmo: z.number() }),
      investigacao: z
        .object({
          usosDaBusca: z.number(),
          termosBuscados: z.array(z.string()),
          postsPelaBusca: z.number(),
          comentariosLidos: z.number(),
          revisitas: z.number(),
          perdasDeFoco: z.number(),
          coberturaDosLados: z.object({
            A: z.object({ posts: z.number(), segundos: z.number() }),
            B: z.object({ posts: z.number(), segundos: z.number() }),
          }),
          consideracaoDoOposto: z.number(),
        })
        .passthrough(),
      /** O total NUNCA aparece sem os componentes. */
      imersao: z.object({
        total: z.number(),
        componentes: z.array(ComponenteDeImersaoSchema),
      }),
    })
    .passthrough(),
  posts: z.object({
    topDwell: z.array(
      PostDoDossieSchema.extend({ dwellMs: z.number(), segundos: z.number() }),
    ),
    ocultados: z.array(PostDoDossieSchema),
  }),
});
