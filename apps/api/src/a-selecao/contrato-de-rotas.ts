import { z } from "zod";
import {
  COLEGAS_VIRTUAIS_IDS,
  ENQUADRAMENTOS,
  ID_DE_POST_RE,
  IDS_DE_POST,
  PERFIS,
  TIPOS_DE_GRAFICO,
  TOTAL_DE_POSTS,
} from "./catalogo";
import { BLOCOS_DO_PODCAST, FalasDoTemaSchema } from "./podcast";
import { problemasDoLote } from "./regras/lote";
import { ETAPAS, PASSOS, PASSOS_PEDIDOS } from "./regras/passos";
import {
  LEGENDA_MAX,
  LEGENDA_MIN,
  REFLEXAO_MAX,
  REFLEXAO_MIN,
  TAMANHO_DA_SELECAO,
  TEMPO_DE_FEED_MAX_S,
  dentroDe,
  normalizarLegenda,
  normalizarReflexao,
} from "./regras/sessao";

/**
 * O contrato HTTP da exp07ef1b — só schemas Zod, nenhum decorator. O OpenAPI é
 * derivado daqui (ADR-36).
 *
 * Os enums vêm do catálogo e das regras, nunca reescritos: uma segunda lista
 * de valores é a que ninguém atualiza junto.
 *
 * A saída do ESTUDANTE é allowlist explícita. O que não pode vazar é o gabarito
 * do post — enquadramento, fonte ouvida e ângulo — e a matriz que sai dele
 * (regra inviolável nº 3). `PostPublicoSchema` não tem campo para eles; o
 * único lugar em que eles cruzam a fronteira é `FichaDoPostSchema`, dentro do
 * Mural, e só com as fichas acesas.
 */

// -------------------------------------------------------------- entrada

export const IdDePostSchema = z.string().regex(ID_DE_POST_RE, "id de post: post_a_1 a post_c_4");

/**
 * O passo que a criança pede. `tempoFeedS` é o tempo de feed que a TELA mediu
 * — indicativo, nunca mérito, e só gravado antes do latch.
 */
export const PedirPassoSchema = z.object({
  para: z.enum(PASSOS_PEDIDOS),
  tempoFeedS: z.number().int().min(0).max(TEMPO_DE_FEED_MAX_S).optional(),
});

/**
 * A publicação nos Stories. A legenda é contada em CODE POINTS
 * (`regras/sessao.ts`), com a mesma régua do CHECK do banco. O teto de 2.000
 * antes da normalização é só contra corpo gigante: o que vale é o de 140 depois
 * dela.
 */
export const DecisaoSchema = z.object({
  selecao: z
    .array(IdDePostSchema)
    .length(TAMANHO_DA_SELECAO)
    .refine((s) => new Set(s).size === s.length, "três posts diferentes"),
  legenda: z
    .string()
    .max(2000)
    .transform(normalizarLegenda)
    .refine((s) => dentroDe(s, LEGENDA_MIN, LEGENDA_MAX), `de ${LEGENDA_MIN} a ${LEGENDA_MAX} caracteres`),
});

/** A reflexão da Etapa 6, de 100 a 500 code points. */
export const ReflexaoSchema = z.object({
  texto: z
    .string()
    .max(4000)
    .transform(normalizarReflexao)
    .refine((s) => dentroDe(s, REFLEXAO_MIN, REFLEXAO_MAX), `de ${REFLEXAO_MIN} a ${REFLEXAO_MAX} caracteres`),
});

/** O botão único do painel: a etapa de DESTINO. */
export const GateSchema = z.object({ para: z.enum(ETAPAS) });

/**
 * Os parâmetros do preparo (E0-PROF-01). Os tetos são a primeira barreira
 * contra injeção de instrução no gerador (os campos entram num prompt).
 */
export const ParametrosDoPreparoSchema = z.object({
  tema: z.string().trim().min(5).max(100),
  foco: z.string().trim().max(100).optional(),
});

export const GraficoSchema = z.object({
  tipo: z.enum(TIPOS_DE_GRAFICO),
  titulo: z.string().trim().min(1).max(60),
  unidade: z.string().trim().max(10),
  series: z
    .array(z.object({ rotulo: z.string().trim().min(1).max(40), valor: z.number().finite().min(0) }))
    .min(2)
    .max(6),
  destaque: z.string().trim().min(1).max(40).optional(),
});

/**
 * Um post COMPLETO — com o gabarito. Só entra e sai por rota de professor.
 *
 * Os tetos de caractere são mais folgados que os do lote da IA (240 de legenda,
 * 35 de tag, `regras/lote.ts`): o banco curado passa deles em alguns posts, e o
 * que manda na legenda é a régua de PALAVRAS do brief, que `problemasDoLote`
 * cobra.
 */
export const PostDaCoberturaSchema = z.object({
  id: z.enum(IDS_DE_POST),
  perfil: z.enum(PERFIS),
  enquadramento: z.enum(ENQUADRAMENTOS),
  autoridadeCitada: z.string().trim().max(60).optional(),
  descricaoImagem: z.string().trim().min(5).max(200),
  legenda: z.string().trim().min(20).max(320),
  tagFonte: z.string().trim().min(2).max(60),
  tagAngulo: z.string().trim().min(2).max(60),
  curtidas: z.number().int().min(0).max(9999),
  comentarios: z.number().int().min(0).max(999),
  comentariosDestaque: z.tuple([z.string().trim().min(1).max(140), z.string().trim().min(1).max(140)]),
  grafico: GraficoSchema.optional(),
});

/**
 * A homologação: o clique em "Aprovar Cobertura e Abrir Turma".
 *
 * O corpo carrega os 12 posts INTEIROS porque curadoria é editar (ADR-66/67):
 * a professora pode reescrever qualquer legenda antes de aprovar. O
 * `superRefine` cobra o 4:4:4, o id amarrado ao veículo, as 20 a 45 palavras e
 * os termos proibidos — e, como `.refine()` some do OpenAPI, a nota do
 * `@Contrato` repete as regras em texto.
 */
export const HomologacaoSchema = z.object({
  tema: z.string().trim().min(5).max(100),
  foco: z.string().trim().max(100).optional(),
  origem: z.enum(["padrao", "ia"]),
  posts: z
    .array(PostDaCoberturaSchema)
    .length(TOTAL_DE_POSTS)
    .superRefine((posts, ctx) => {
      for (const problema of problemasDoLote(posts)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
    }),
  /**
   * As três falas do Bloco 2 do podcast — o que cada veículo mostrou —, que a
   * professora revisou junto com os posts. Sempre vem: no tema curado, com as
   * do sheet (ou editadas).
   */
  podcast: FalasDoTemaSchema,
});

// --------------------------------------------------------------- saída

/** As três falas do tema, como saem (a régua já valeu na entrada). */
const FalasDoTemaSaidaSchema = z.object({
  institucional: z.string(),
  comunitario: z.string(),
  estatistico: z.string(),
});

const PassoSchema = z.enum(PASSOS);
const EtapaSchema = z.enum(ETAPAS);
const MatrizSchema = z.object({
  institucional: z.number().int().min(0),
  comunitario: z.number().int().min(0),
  estatistico: z.number().int().min(0),
});

/**
 * Um post como o ESTUDANTE o recebe: o que está no feed, e nada do que só a
 * ficha técnica revela. `imagem.url` é `null` enquanto a professora não gerou
 * as imagens — a tela desenha o card com o `alt`, e a missão roda igual.
 */
export const PostPublicoSchema = z.object({
  id: z.enum(IDS_DE_POST),
  perfil: z.enum(PERFIS),
  legenda: z.string(),
  curtidas: z.number().int().min(0),
  comentarios: z.number().int().min(0),
  comentariosDestaque: z.array(z.string()).length(2),
  imagem: z.object({ url: z.string().nullable(), alt: z.string() }),
  /** Só nos posts de métricas do banco curado: a tela desenha o gráfico. */
  grafico: GraficoSchema.nullable(),
});

/** O estado da sessão, como toda rota de estudante o devolve. */
export const EstadoSchema = z.object({
  sessaoId: z.string().uuid(),
  /** A ATIVIDADE (a cobertura homologada). Muda quando a professora troca o tema. */
  coberturaId: z.string().uuid(),
  /** A rodada da atividade. Sobe quando a professora zera a turma. */
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  /** O passo que a tela mostra, já reconciliado com a etapa da turma. */
  passo: PassoSchema,
  /** O passo gravado — divergente do de cima = a turma o está conduzindo. */
  passoDoEstudante: PassoSchema,
  aguardandoOProfessor: z.boolean(),
  publicada: z.boolean(),
  publicadaEm: z.string().nullable(),
  /** A tríade do PRÓPRIO estudante, depois do latch. Nunca a de outro. */
  selecao: z.array(z.enum(IDS_DE_POST)).nullable(),
  legenda: z.string().nullable(),
  reflexaoEnviada: z.boolean(),
  concluidaEm: z.string().nullable(),
});

export const SessaoSchema = EstadoSchema.extend({
  cobertura: z.object({
    tema: z.string(),
    /** Os 12 posts na ORDEM DO FEED, sem gabarito. */
    posts: z.array(PostPublicoSchema).length(TOTAL_DE_POSTS),
  }),
  limites: z.object({
    selecao: z.number().int().positive(),
    legendaMin: z.number().int().positive(),
    legendaMax: z.number().int().positive(),
    reflexaoMin: z.number().int().positive(),
    reflexaoMax: z.number().int().positive(),
  }),
});

/** O polling de 5 s (ADR-93): magro, sem JOIN, sem posts. */
export const GatePublicoSchema = z.object({
  etapa: EtapaSchema,
  /** `null` só antes da primeira entrada da turma (o gate nasce no `GET sessao`). */
  rodada: z.number().int().positive().nullable(),
  coberturaId: z.string().uuid().nullable(),
  passoEfetivo: PassoSchema,
  aguardandoOProfessor: z.boolean(),
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: z.string(),
});

/** A ficha técnica de um post — a revelação. Só existe com `etapa ≥ fichas`. */
export const FichaDoPostSchema = z.object({
  postId: z.enum(IDS_DE_POST),
  fonte: z.string(),
  angulo: z.string(),
  enquadramento: z.enum(ENQUADRAMENTOS),
});

/**
 * Uma tríade no Mural. `fichas` e `equilibrio` são `null` até a professora
 * revelar as fichas: antes disso o Mural é só a imagem e a legenda (a Fase 1 do
 * PRD, "o espelho rachado", com a tela nua).
 */
const TriadeSchema = z.object({
  posts: z.array(PostPublicoSchema).length(TAMANHO_DA_SELECAO),
  legenda: z.string(),
  fichas: z.array(FichaDoPostSchema).length(TAMANHO_DA_SELECAO).nullable(),
  /** O "equilíbrio editorial da seleção" — percentuais inteiros que somam 100. */
  equilibrio: MatrizSchema.nullable(),
});

export const MuralSchema = z.object({
  etapa: EtapaSchema,
  fichasReveladas: z.boolean(),
  minha: TriadeSchema,
  par: TriadeSchema.extend({
    /** O primeiro nome, o nome da equipe, ou Tomás/Malu. Congelado no pareamento. */
    rotulo: z.string(),
    virtual: z.boolean(),
  }),
});

// ------------------------------------------------------ saída do professor

export const TurmasSchema = z.object({
  turmas: z.array(
    z.object({
      id: z.string().uuid(),
      nome: z.string(),
      serie: z.string().nullable(),
      estudantes: z.number().int().min(0),
    }),
  ),
});

const CoberturaResumoSchema = z.object({
  id: z.string().uuid(),
  tema: z.string(),
  foco: z.string().nullable(),
  origem: z.enum(["padrao", "ia"]),
});

/** Quantos posts pedem imagem e quantos já têm. Os de gráfico não contam. */
const MidiaResumoSchema = z.object({ total: z.number().int().min(0), prontas: z.number().int().min(0) });

/**
 * Uma linha do painel — um COMPUTADOR quando a turma montou equipes, uma
 * criança quando não.
 *
 * **Sem nível, sem nota, sem acerto** (`PROIBIDO_NO_PAINEL`, com o teste que
 * cobra a ausência). O nível da EF07CO11 mora no painel de habilidades
 * (`/evidencias`), com origem e ajuste do professor.
 *
 * `legenda` e `reflexaoTexto` são texto livre de menor: vêm PREENCHIDOS só para
 * quem leciona a turma (o recorte da ADR-108); gestor e admin recebem `null` e
 * leem `publicou`/`entregouReflexao`.
 */
const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  equipe: z.object({ id: z.string().uuid(), nome: z.string() }).nullable(),
  iniciou: z.boolean(),
  passo: PassoSchema,
  publicou: z.boolean(),
  publicadaEm: z.string().nullable(),
  selecao: z.array(z.enum(IDS_DE_POST)).nullable(),
  matriz: MatrizSchema.nullable(),
  legenda: z.string().nullable(),
  par: z.object({ rotulo: z.string(), virtual: z.boolean() }).nullable(),
  tempoFeedS: z.number().int().nullable(),
  entregouReflexao: z.boolean(),
  reflexaoTexto: z.string().nullable(),
  concluiu: z.boolean(),
});

export const PainelSchema = z.object({
  turma: z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string().nullable() }),
  cobertura: CoberturaResumoSchema.extend({ midia: MidiaResumoSchema }),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  /** O rótulo do botão único: a próxima etapa, ou `null` depois da explicação. */
  proximaEtapa: EtapaSchema.nullable(),
  linhas: z.array(LinhaDoPainelSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    iniciaram: z.number().int().min(0),
    publicaram: z.number().int().min(0),
    entregaram: z.number().int().min(0),
    concluiram: z.number().int().min(0),
    /** "X de Y computadores publicaram". Y sai da montagem das equipes quando há. */
    computadores: z.object({ publicaram: z.number().int().min(0), total: z.number().int().min(0) }),
    porComputador: z.boolean(),
    /** O perfil editorial médio da sala, em percentuais inteiros. */
    distribuicaoMedia: MatrizSchema,
  }),
});

export const GateDaTurmaSchema = z.object({
  turma: z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string().nullable() }),
  coberturaId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  proximaEtapa: EtapaSchema.nullable(),
  /** Quantas tríades receberam par NESTA chamada (só na abertura do Mural). */
  pareadas: z.number().int().min(0),
  atualizadoEm: z.string(),
});

export const ZerarTurmaSchema = z.object({
  coberturaId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
});

export const CoberturasSchema = z.object({
  /** A atividade em andamento, COM o gabarito (é a tela do preparo). */
  ativa: CoberturaResumoSchema.extend({
    rodada: z.number().int().positive(),
    etapa: EtapaSchema,
    posts: z.array(PostDaCoberturaSchema),
    midia: MidiaResumoSchema,
    /** As três falas do podcast desta cobertura (as do sheet, se ela não tem as suas). */
    podcast: FalasDoTemaSaidaSchema,
  }),
  /** Todas as coberturas da turma, a ativa inclusa — é o `?cobertura=` do painel de habilidades. */
  historico: z.array(
    CoberturaResumoSchema.extend({
      ativa: z.boolean(),
      criadaEm: z.string(),
      /** A maior rodada com sessão; 0 = nunca rodou. */
      rodadas: z.number().int().min(0),
    }),
  ),
});

/** O rascunho do preparo — não persiste. `usouIa: false` = é o banco curado. */
export const RascunhoSchema = z.object({
  tema: z.string(),
  foco: z.string().nullable(),
  origem: z.enum(["padrao", "ia"]),
  usouIa: z.boolean(),
  posts: z.array(PostDaCoberturaSchema).length(TOTAL_DE_POSTS),
  podcast: FalasDoTemaSaidaSchema,
});

export const CoberturaHomologadaSchema = CoberturaResumoSchema.extend({
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  posts: z.array(PostDaCoberturaSchema).length(TOTAL_DE_POSTS),
  podcast: FalasDoTemaSaidaSchema,
});

const FalaDoPodcastSchema = z.object({ falante: z.enum(["Lucas", "Clara"]), texto: z.string() });

/**
 * O podcast de recapitulação da cobertura em andamento — o roteiro inteiro (é
 * a transcrição, que fica na tela junto do player) e o estado do áudio.
 */
export const PodcastSchema = z.object({
  coberturaId: z.string().uuid(),
  tema: z.string(),
  roteiro: z.array(
    z.object({ bloco: z.enum(BLOCOS_DO_PODCAST), titulo: z.string(), falas: z.array(FalaDoPodcastSchema).min(1) }),
  ),
  trechos: z.object({ total: z.number().int().min(0), prontos: z.number().int().min(0) }),
  /** O episódio inteiro, quando os cinco trechos existem e já foram emendados. */
  url: z.string().nullable(),
});

/** O progresso de UMA chamada de geração: um trecho por vez, e o episódio no fim. */
export const ProgressoDoPodcastSchema = PodcastSchema.extend({
  /** O bloco sintetizado NESTA chamada. */
  gerado: z.enum(BLOCOS_DO_PODCAST).nullable(),
  /** O bloco que falhou NESTA chamada — a transcrição continua na tela. */
  falhou: z.enum(BLOCOS_DO_PODCAST).nullable(),
  /** `true` quando o episódio existe: o cliente para de repetir. */
  completo: z.boolean(),
});

export const ProgressoDaMidiaSchema = z.object({
  coberturaId: z.string().uuid(),
  total: z.number().int().min(0),
  prontas: z.number().int().min(0),
  faltam: z.number().int().min(0),
  /** Os posts cuja imagem saiu NESTA chamada. */
  geradas: z.array(z.enum(IDS_DE_POST)),
  /** Os que falharam NESTA chamada — seguem com o card da descrição. */
  falharam: z.array(z.enum(IDS_DE_POST)),
  /** `true` quando não falta nada: o cliente para de repetir. */
  completo: z.boolean(),
  midia: z.record(z.string()),
});

export const MaterialDoProfessorSchema = z.object({
  tema: z.string(),
  posts: z.array(PostDaCoberturaSchema).length(TOTAL_DE_POSTS),
  roteiroDaEtapa4: z.object({ aviso: z.string(), perguntas: z.array(z.string()).length(3) }),
  gatilhos: z.object({ mural: z.string(), fichas: z.string(), explicacao: z.string() }),
  colegasVirtuais: z.array(
    z.object({
      id: z.enum(COLEGAS_VIRTUAIS_IDS),
      nome: z.string(),
      selecao: z.array(z.enum(IDS_DE_POST)).length(TAMANHO_DA_SELECAO),
      legenda: z.string(),
    }),
  ),
});
