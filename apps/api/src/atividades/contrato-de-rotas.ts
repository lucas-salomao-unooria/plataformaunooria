import { z } from "zod";
import { DIVISOR_TESE, ESTILOS_VISUAIS, MODOS_NEUTROS } from "../comum/insta/defaults";
import { ETAPAS_DA_TURMA } from "../comum/insta/etapas";

const Uuid = z.string().uuid();
const LadoSchema = z.enum(["A", "B"]);

// ------------------------------------------------------------------ entrada

export const CriarSchema = z.object({
  titulo: z.string().trim().min(3).max(120),
  disciplina: z.string().trim().min(2).max(60),
  recorte: z.string().trim().min(2).max(120),
  temaGeral: z.string().trim().min(2).max(120).optional(),
  contextoAula: z.string().trim().max(2000).optional().nullable(),
  /** Posts de TESE. Divisível por 8 (2 lados × 4 perfis) para a matriz fechar
   *  sem célula quebrada. Recusar é melhor que arredondar em silêncio. */
  qtdPostsTese: z
    .number()
    .int()
    .min(DIVISOR_TESE)
    .max(900)
    .default(400)
    .refine((valor) => valor % DIVISOR_TESE === 0, {
      message: `A quantidade de posts de tese precisa ser múltiplo de ${DIVISOR_TESE} (2 lados × 4 perfis).`,
    }),
  neutros: z
    .object({
      ativo: z.boolean().default(true),
      modo: z.enum(MODOS_NEUTROS).default("ambos"),
      proporcao: z.number().min(0).max(1).default(0.4),
    })
    .default({ ativo: true, modo: "ambos", proporcao: 0.4 }),
  estiloVisual: z.enum(ESTILOS_VISUAIS),
  /** A turma desta atividade. Opcional porque o campo nasceu depois das
   *  atividades que já existiam: sem ela a atividade vale para a escola
   *  inteira, que era o comportamento único até
   *  `20260830090000_atividade_por_turma`. Com ela, o painel de perfis, a
   *  importação da Vila e a entrada do estudante falam todos da MESMA sala. */
  turmaId: z.string().uuid().optional(),
});

export const EtapaSchema = z.object({ etapa: z.enum(ETAPAS_DA_TURMA) });
export const IaSchema = z.object({ ativo: z.boolean() });
export const AtivarSchema = z
  .object({ forcar: z.boolean().default(false) })
  .default({ forcar: false });

// -------------------------------------------------------------------- saída

export const AtividadeEmListaSchema = z.object({
  id: Uuid,
  titulo: z.string(),
  disciplina: z.string(),
  recorte: z.string(),
  perguntaChave: z.string(),
  status: z.string(),
  etapa: z.string(),
  criadoEm: z.string().datetime(),
  estudantes: z.number().int().nonnegative().optional(),
  alunos: z.number().int().nonnegative(),
  /** Sinônimo de `estudantes`/`alunos` (1 run = 1 estudante). As telas portadas usam os dois
   *  nomes; manter ambos evita drift no porte. */
  sessoes: z.number().int().nonnegative(),
  posts: z.number().int().nonnegative(),
});

export const ListaDeAtividadesSchema = z.object({
  atividades: z.array(AtividadeEmListaSchema),
});

/** A linha crua de `exp_01_activities` mais os agregados. `_count` espelha o
 *  select do Prisma da página de origem — o porte dos painéis consome esse
 *  shape, e os agregados nomeados ficam junto. */
export const DetalheDaAtividadeSchema = z.object({
  atividade: z
    .object({
      id: Uuid,
      escolaId: z.string(),
      professorId: Uuid,
      titulo: z.string(),
      disciplina: z.string(),
      temaGeral: z.string(),
      recorte: z.string(),
      contextoAula: z.string().nullable(),
      perguntaChave: z.string(),
      perguntaOrigem: z.string(),
      etapa: z.string(),
      iaAoVivo: z.boolean(),
      antagonismo: z.unknown().nullable(),
      categoriasNeutras: z.array(z.string()),
      neutrosNoTema: z.array(z.string()),
      estiloVisual: z.string(),
      qtdPostsTese: z.number().int(),
      proporcoes: z.unknown(),
      engineConfig: z.unknown(),
      status: z.string(),
      createdAt: z.string().datetime(),
      /** `null` = atividade anterior a `20260830090000_atividade_por_turma`:
       *  ela segue valendo para a escola inteira. */
      turmaId: Uuid.nullable(),
      /** A turma resolvida, para a tela poder DIZER de que sala ela fala.
       *  `null` acompanha `turmaId`. */
      turma: z
        .object({ id: Uuid, nome: z.string(), serie: z.string() })
        .nullable(),
      _count: z.object({ runs: z.number().int().nonnegative() }),
      estudantes: z.number().int().nonnegative().optional(),
      alunos: z.number().int().nonnegative(),
      postsAprovados: z.number().int().nonnegative(),
    })
    .passthrough(),
});

export const AtividadeCriadaSchema = z.object({ id: Uuid });

export const ExcluidaSchema = z.object({
  ok: z.literal(true),
  titulo: z.string(),
  sessoes: z.number().int().nonnegative(),
});

export const LimpaSchema = z.object({
  ok: z.literal(true),
  sessoes: z.number().int().nonnegative(),
});

export const IaAlternadaSchema = z.object({ ok: z.literal(true), ativo: z.boolean() });

/** A matriz é 2 lados × 4 perfis: é ela que diz se a geração fechou. */
export const AtivadaSchema = z.object({
  ok: z.literal(true),
  aprovados: z.number().int().nonnegative(),
  ladoA: z.number().int().nonnegative(),
  ladoB: z.number().int().nonnegative(),
  matriz: z.array(
    z.object({
      lado: z.string(),
      perfil: z.string(),
      aprovados: z.number().int().nonnegative(),
    }),
  ),
  /** `true` quando o professor ativou com a matriz incompleta, de propósito. */
  forcado: z.boolean(),
});

export const EtapaMovidaSchema = z.object({
  ok: z.literal(true),
  etapa: z.enum(ETAPAS_DA_TURMA),
  movidos: z.number().int().nonnegative(),
  /** `true` quando a turma VOLTOU de etapa. */
  voltou: z.boolean(),
  total: z.number().int().nonnegative(),
  /** Quem ficou no onboarding: não entrou no aparelho e não pode ser movido. */
  foraDoAparelho: z.number().int().nonnegative(),
});

export const EtapaAtualSchema = z.object({
  etapa: z.enum(ETAPAS_DA_TURMA),
  iaAoVivo: z.boolean(),
  porFase: z.record(z.number().int().nonnegative()),
  total: z.number().int().nonnegative(),
});

const ComponenteDeImersaoSchema = z.object({
  chave: z.string(),
  rotulo: z.string(),
  pontos: z.number(),
  detalhe: z.string(),
});

/** Uma linha do painel ao vivo. **`ociosoHaMs` é o único campo que pede AÇÃO** —
 *  é o número que faz o professor levantar da cadeira. */
export const LinhaDoMonitorSchema = z.object({
  runId: Uuid,
  estudante: z
    .object({
      username: z.string(),
      displayName: z.string(),
      avatar: z.string().nullable(),
    })
    .optional(),
  aluno: z.object({
    username: z.string(),
    displayName: z.string(),
    avatar: z.string().nullable(),
  }),
  fase: z.string(),
  postsConsumidos: z.number(),
  blocos: z.number(),
  dominio: z.number(),
  /** `indefinido` vira `neutro` aqui: é rótulo de tela, e o painel não tem
   *  coluna para "ainda não dá para dizer". */
  ladoDominante: z.string(),
  escada: z.object({ A: z.number(), B: z.number() }),
  ladoInicial: LadoSchema,
  ladoOrigem: z.string(),
  inverteu: z.boolean(),
  perfilOrigem: z.string(),
  perfilJogo: z.string().nullable(),
  concluiu: z.boolean(),
  colecao: z.object({
    total: z.number(),
    doLadoSemeado: z.number(),
    doOutroLado: z.number(),
    neutros: z.number(),
    comentados: z.number(),
  }),
  imersaoParcial: z.number(),
  imersaoComponentes: z.array(ComponenteDeImersaoSchema),
  minutos: z.number(),
  minutosDeFeed: z.number(),
  ociosoHaMs: z.number().nullable(),
  alertaDeOcioso: z.boolean(),
  temDossie: z.boolean(),
  /** Tamanho da reflexão escrita — nunca o texto, que é de criança. */
  caracteresDaReflexao: z.number().int().nonnegative(),
  publicou: z.boolean(),
});

export const MonitorSchema = z.object({
  runs: z.array(LinhaDoMonitorSchema),
  resumo: z.object({
    total: z.number().int().nonnegative(),
    emFeed: z.number().int().nonnegative(),
    concluidas: z.number().int().nonnegative(),
    ladoA: z.number().int().nonnegative(),
    ladoB: z.number().int().nonnegative(),
    semLado: z.number().int().nonnegative(),
    porLadoInicial: z.object({ A: z.number().int(), B: z.number().int() }),
    porPerfil: z.record(z.number().int().nonnegative()),
    inverteram: z.number().int().nonnegative(),
    concluiram: z.number().int().nonnegative(),
    ociosos: z.number().int().nonnegative(),
    salvosNaTurma: z.number().int().nonnegative(),
    salvosDoOutroLado: z.number().int().nonnegative(),
  }),
  limiteDeOciosidadeMs: z.number().int().positive(),
});

/** Tudo o que UM estudante fez, para o professor ler DURANTE a atividade. */
export const EstudanteDaAtividadeSchema = z.object({
  estudante: z
    .object({
      username: z.string(),
      displayName: z.string(),
      /** APELIDO dentro da ficção do Instanooria, nunca identidade em tela de
       *  professor ou relatório. */
      nomeNoApp: z.string().nullable(),
      avatar: z.string().nullable(),
    })
    .optional(),
  aluno: z.object({
    username: z.string(),
    displayName: z.string(),
    /** APELIDO dentro da ficção do Instanooria, nunca identidade em tela de
     *  professor ou relatório. */
    nomeNoApp: z.string().nullable(),
    avatar: z.string().nullable(),
  }),
  sessao: z.object({
    fase: z.string(),
    ladoInicial: z.string(),
    ladoInicialRotulo: z.string(),
    ladoOrigem: z.string(),
    perfilJogo: z.string().nullable(),
    perfilOrigem: z.string(),
    respondeu: z.string().nullable(),
    respondeuRotulo: z.string().nullable(),
    reflexao: z.string().nullable(),
    postouNoApp: z.string().nullable(),
  }),
  resumo: z.object({
    salvos: z.number().int().nonnegative(),
    salvosDoLadoSemeado: z.number().int().nonnegative(),
    salvosDoOutroLado: z.number().int().nonnegative(),
    salvosNeutros: z.number().int().nonnegative(),
    curtidos: z.number().int().nonnegative(),
    comentados: z.number().int().nonnegative(),
  }),
  /** Ordenada com os SALVOS primeiro: é a coleção que o estudante vai defender no
   *  debate. */
  interacoes: z.array(
    z.object({
      id: Uuid,
      handle: z.string(),
      caption: z.string(),
      imageUrl: z.string().nullable(),
      /** Arte procedural quando a imagem não ficou pronta — o feed nunca fica
       *  com buraco. */
      fallbackArt: z.unknown().nullable(),
      lado: z.string(),
      ladoRotulo: z.string(),
      perfil: z.string().nullable(),
      intensidade: z.number().nullable(),
      /** É do lado em que o feed dele nasceu? **A definição de coerência.** */
      doLadoSemeado: z.boolean(),
      neutro: z.boolean(),
      salvou: z.boolean(),
      curtiu: z.boolean(),
      comentarios: z.array(z.unknown()),
      segundos: z.number(),
    }),
  ),
});

export const AlunoDaAtividadeSchema = EstudanteDaAtividadeSchema;
