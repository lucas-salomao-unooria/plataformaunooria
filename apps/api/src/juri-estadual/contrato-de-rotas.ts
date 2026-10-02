import { z } from "zod";
import { problemasDoPacote } from "./invariantes";
import { ETAPAS, PASSOS, PASSOS_PEDIDOS } from "./regras/passos";
import { IDS_DE_ATITUDE, IDS_DE_MECANISMO, TOTAL_DE_BLOCOS, TOTAL_DE_PACOTES } from "./conteudo";
import {
  ACOES_DA_REVISAO,
  AREAS,
  CONVICCOES,
  DISCIPLINAS,
  ID_DE_POST_RE,
  ID_DE_PROJETO_RE,
  ORIGENS_DO_PACOTE,
  POSTS_NO_FEED,
  TIPOS_DE_BUSCA,
  TIPOS_DE_POST,
  TOTAL_DE_PROJETOS,
} from "./vocabulario";

/**
 * O contrato HTTP da exp06ef1b — só schemas Zod, nenhum decorator. O OpenAPI é
 * derivado daqui (ADR-36). Os enums vêm do vocabulário, das regras e do
 * conteúdo, nunca reescritos.
 *
 * A saída do ESTUDANTE é allowlist explícita (`PostPublicoSchema`,
 * `ProjetoDaGaleriaSchema`). O que não pode vazar antes da hora:
 *
 * - o ACERVO: antes da galeria, o estudante só recebe os posts que o feed
 *   serviu — os outros projetos existem só no servidor. A galeria (com todos os
 *   dezesseis e a taxa real) desce no `GET galeria`, com a etapa `galeria`
 *   liberada pelo professor;
 * - a REGRA do motor: nenhum peso, nenhuma área líder;
 * - a ORDEM certa dos pacotes e dos blocos e o cartão certo: os itens descem
 *   embaralhados, com ids opacos, e quem confere é o servidor (regra 3);
 * - as alternativas certas das enquetes, que são da ficha de evidência e
 *   descem pelas rotas genéricas de `/evidencias`.
 */

// ------------------------------------------------------------------ comuns

export const AreaSchema = z.enum(AREAS);
export const PassoSchema = z.enum(PASSOS);
export const EtapaSchema = z.enum(ETAPAS);
export const IdDeProjetoSchema = z.string().regex(ID_DE_PROJETO_RE);
export const IdDePostSchema = z.string().regex(ID_DE_POST_RE);
/** Ids opacos dos pacotes e dos blocos: sorteados por sessão, não dizem a posição. */
export const IdOpacoSchema = z.string().regex(/^[a-z]{2}-[a-z0-9]{3}$/);

// -------------------------------------------------------- entrada: estudante

export const PedirPassoSchema = z.object({ para: z.enum(PASSOS_PEDIDOS) });

/**
 * O que o cliente MEDIU desde a última chamada, e se quer o próximo post.
 * Curtida é estado (curtiu: true/false), permanência é fato (uma por post).
 * O teto de 20 é folga: o feed inteiro tem dez posts.
 */
export const EventosDoFeedSchema = z.object({
  curtidas: z.array(z.object({ postId: IdDePostSchema, curtiu: z.boolean() })).max(20).default([]),
  permanencias: z.array(IdDePostSchema).max(20).default([]),
  /** `true` quando a tela chegou ao último post servido: o servidor serve o próximo. */
  proximo: z.boolean().default(false),
});

/** A cédula: um projeto do feed e a convicção. É o LATCH 1. */
export const VotoSchema = z.object({
  projetoId: IdDeProjetoSchema,
  conviccao: z.enum(CONVICCOES),
});

/**
 * O que o estudante faz na galeria — abrir a ficha de um estande ou buscar.
 * Da busca, só o TIPO e a área que casou: o texto digitado nunca sai do
 * aparelho (texto livre de menor).
 */
export const AcaoDaGaleriaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("abrir"), projetoId: IdDeProjetoSchema }),
  z.object({ tipo: z.literal("buscar"), busca: z.enum(TIPOS_DE_BUSCA), area: AreaSchema.nullable() }),
]);

/** A revisão do voto depois da galeria. É o LATCH 2. */
export const RevisaoDoVotoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal(ACOES_DA_REVISAO[0]) }),
  z.object({ acao: z.literal(ACOES_DA_REVISAO[1]), projetoId: IdDeProjetoSchema }),
]);

/** A ordem que a criança montou: os ids opacos, da vaga 1 à última. */
const ordemDe = (tamanho: number) =>
  z.object({
    ordem: z
      .array(IdOpacoSchema)
      .length(tamanho)
      .refine((o) => new Set(o).size === o.length, "itens diferentes"),
  });
export const OrdemDosPacotesSchema = ordemDe(TOTAL_DE_PACOTES);
export const OrdemDaCadeiaSchema = ordemDe(TOTAL_DE_BLOCOS);

export const CartoesSchema = z.object({
  mecanismo: z.enum(IDS_DE_MECANISMO as [string, ...string[]]),
  atitude: z.enum(IDS_DE_ATITUDE as [string, ...string[]]),
});

// --------------------------------------------------------- saída: estudante

export const CategoriaSchema = z.object({
  area: AreaSchema,
  nome: z.string(),
  hashtag: z.string(),
});

const ImagemPublicaSchema = z.object({
  /** `null` enquanto o professor não gerou (ou a geração falhou): a tela desenha a arte procedural. */
  url: z.string().nullable(),
  alt: z.string(),
});

/** Um post do feed — ALLOWLIST. A área é pública (a hashtag está no post). */
export const PostPublicoSchema = z.object({
  id: IdDePostSchema,
  projetoId: IdDeProjetoSchema,
  tipo: z.enum(TIPOS_DE_POST),
  area: AreaSchema,
  titulo: z.string(),
  escola: z.string(),
  perfil: z.string(),
  /** A legenda da apresentação, ou o texto do bastidor. */
  texto: z.string(),
  hashtags: z.array(z.string()),
  imagem: ImagemPublicaSchema,
});

export const FeedSchema = z.object({
  posts: z.array(PostPublicoSchema).max(POSTS_NO_FEED),
  curtidos: z.array(IdDePostSchema),
  /** Os dez chegaram: a cédula pode abrir. */
  completo: z.boolean(),
});

/** Um estande na galeria: a apresentação e se ele chegou ao feed DESTE estudante. */
export const ProjetoDaGaleriaSchema = z.object({
  id: IdDeProjetoSchema,
  area: AreaSchema,
  titulo: z.string(),
  escola: z.string(),
  perfil: z.string(),
  legenda: z.string(),
  hashtags: z.array(z.string()),
  imagem: ImagemPublicaSchema,
  exibidoNoSeuFeed: z.boolean(),
});

export const InvisibilidadeSchema = z.object({
  vistos: z.number().int().min(0),
  ocultos: z.number().int().min(0),
  total: z.literal(TOTAL_DE_PROJETOS),
  /** A taxa REAL desta sessão, 0–100. */
  percentual: z.number().int().min(0).max(100),
});

export const GaleriaSchema = z.object({
  invisibilidade: InvisibilidadeSchema,
  /** Os dezesseis, os que NÃO chegaram primeiro (é a grade da Galeria Oculta). */
  projetos: z.array(ProjetoDaGaleriaSchema).length(TOTAL_DE_PROJETOS),
});

export const PacoteDaCurtidaSchema = z.object({
  id: IdOpacoSchema,
  /** O número do pacote ("pacote 3 de 4") — é como o destino remonta a mensagem. */
  numero: z.number().int().min(1).max(TOTAL_DE_PACOTES),
  trecho: z.string(),
  rota: z.array(z.string()).min(2),
});

export const BlocoDaCadeiaSchema = z.object({ id: IdOpacoSchema, rotulo: z.string() });

const CartaoSchema = z.object({ id: z.string(), texto: z.string() });

/** O estado do estudante. Cada bloco só aparece do passo dele em diante. */
export const SessaoSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  /** Já reconciliado com a etapa da turma (`passoEfetivo`). */
  passo: PassoSchema,
  /** O gravado. */
  passoDoEstudante: PassoSchema,
  etapa: EtapaSchema,
  aguardandoOProfessor: z.boolean(),
  tema: z.string(),
  categorias: z.array(CategoriaSchema).length(AREAS.length),
  feed: FeedSchema,
  voto: z.object({ projetoId: IdDeProjetoSchema, conviccao: z.enum(CONVICCOES) }).nullable(),
  revisao: z
    .object({ acao: z.enum(ACOES_DA_REVISAO), projetoId: IdDeProjetoSchema.nullable() })
    .nullable(),
  /** Na ORDEM DE CHEGADA (embaralhada pela sessão, estável num F5). Do passo `pacotes` em diante. */
  pacotes: z
    .object({ itens: z.array(PacoteDaCurtidaSchema).length(TOTAL_DE_PACOTES), tentativas: z.number().int().min(0), remontados: z.boolean() })
    .nullable(),
  /** Embaralhados pela sessão. Do passo `cadeia` em diante. */
  cadeia: z
    .object({ blocos: z.array(BlocoDaCadeiaSchema).length(TOTAL_DE_BLOCOS), tentativas: z.number().int().min(0), montada: z.boolean() })
    .nullable(),
  /** Do passo `mariana` em diante. `escolha` volta num F5. */
  mariana: z
    .object({
      caso: z.string(),
      mecanismos: z.array(CartaoSchema),
      atitudes: z.array(CartaoSchema),
      escolha: z.object({ mecanismo: z.string(), atitude: z.string() }).nullable(),
    })
    .nullable(),
  concluida: z.boolean(),
});

export const GatePublicoSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
});

/** A resposta de pacotes e cadeia: certa ou não, nunca qual vaga errou. */
export const TentativaSchema = z.object({
  correta: z.boolean(),
  tentativas: z.number().int().min(1),
  passo: PassoSchema,
});

/** A resposta das rotas que só mudam o passo (voto, revisão, cartões, concluir). */
export const EstadoSchema = z.object({ passo: PassoSchema, etapa: EtapaSchema });

// ----------------------------------------------------- entrada: professor

export const ParametrosDoPreparoSchema = z.object({
  disciplina: z.enum(DISCIPLINAS),
  tema: z.string().trim().min(3).max(60),
  assuntos: z.string().trim().min(10).max(600),
  contexto: z.string().trim().max(120).optional(),
});

export const ProjetoDoPacoteSchema = z.object({
  id: IdDeProjetoSchema,
  area: AreaSchema,
  titulo: z.string().trim().min(3).max(60),
  escola: z.string().trim().min(3).max(60),
  perfil: z.string().trim(),
  legenda: z.string().trim().min(10).max(420),
  bastidor: z.string().trim().min(10).max(280),
  hashtags: z.array(z.string()).min(2).max(4),
  imagem: z.object({ descricao: z.string().trim().min(10).max(240), alt: z.string().trim().min(3).max(140) }),
});

export const ConteudoDoPacoteSchema = z
  .object({
    tema: z.string().trim().min(3).max(60),
    categorias: z
      .array(z.object({ area: AreaSchema, nome: z.string().trim().min(2).max(30), hashtag: z.string().trim() }))
      .length(AREAS.length),
    projetos: z.array(ProjetoDoPacoteSchema).length(TOTAL_DE_PROJETOS),
  })
  .superRefine((conteudo, ctx) => {
    for (const problema of problemasDoPacote(conteudo)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
  });

export const HomologacaoSchema = z.object({
  parametros: ParametrosDoPreparoSchema,
  conteudo: ConteudoDoPacoteSchema,
});

export const RegenerarProjetoSchema = ParametrosDoPreparoSchema.extend({
  /** O rascunho como está na tela — a IA escreve um projeto que caiba nele. */
  conteudo: ConteudoDoPacoteSchema,
  projetoId: IdDeProjetoSchema,
});

export const GateSchema = z.object({ para: EtapaSchema });

/** `?pacoteId=` da rota de imagens: a atividade PRONTA sendo preparada. */
export const QueryDoPacoteSchema = z.object({
  escolaId: z.string().optional(),
  pacoteId: z.string().uuid().optional(),
});

// ------------------------------------------------------ saída: professor

const TurmaResumoSchema = z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string().nullable() });

export const TurmasSchema = z.object({
  turmas: z.array(TurmaResumoSchema.extend({ estudantes: z.number().int().min(0) })),
});

const PacoteResumoSchema = z.object({
  id: z.string().uuid(),
  disciplina: z.enum(DISCIPLINAS),
  tema: z.string(),
  origem: z.enum(ORIGENS_DO_PACOTE),
});

const MidiaResumoSchema = z.object({ total: z.number().int().min(0), prontas: z.number().int().min(0) });

/** O rascunho do preparo — não persiste; só `homologar` grava. */
export const RascunhoSchema = z.object({
  parametros: ParametrosDoPreparoSchema,
  conteudo: ConteudoDoPacoteSchema,
});

export const ProjetoRegeneradoSchema = z.object({ projeto: ProjetoDoPacoteSchema, usouIa: z.boolean() });

/** O pacote como as telas do professor o mostram. */
const PacoteNaTelaSchema = PacoteResumoSchema.extend({
  assuntos: z.string(),
  conteudo: ConteudoDoPacoteSchema,
  midia: MidiaResumoSchema,
  /** As URLs já geradas, por id de projeto. */
  imagens: z.record(z.string()),
});

/** A atividade criada: nasce PRONTA (ADR-130). */
export const PacoteHomologadoSchema = PacoteResumoSchema.extend({ ativo: z.boolean() });

export const PacotesSchema = z.object({
  /** A atividade EM ANDAMENTO, ou `null`: a plataforma não cria atividade (ADR-130). */
  ativo: PacoteNaTelaSchema.extend({ rodada: z.number().int().positive(), etapa: EtapaSchema }).nullable(),
  historico: z.array(
    PacoteResumoSchema.extend({
      ativo: z.boolean(),
      criadoEm: z.string(),
      /** A maior rodada com sessão; 0 = nunca rodou. */
      rodadas: z.number().int().min(0),
    }),
  ),
});

export const PacoteDetalheSchema = PacoteNaTelaSchema.extend({
  ativo: z.boolean(),
  rodada: z.number().int().positive().nullable(),
  etapa: EtapaSchema.nullable(),
  criadoEm: z.string(),
  rodadas: z.number().int().min(0),
});

export const EmAndamentoSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  mudou: z.boolean(),
});

export const ProgressoDaMidiaSchema = z.object({
  pacoteId: z.string().uuid(),
  total: z.number().int().min(0),
  prontas: z.number().int().min(0),
  faltam: z.number().int().min(0),
  geradas: z.array(IdDeProjetoSchema),
  /** As que falharam NESTA chamada — seguem com a arte procedural. */
  falharam: z.array(IdDeProjetoSchema),
  completo: z.boolean(),
  imagens: z.record(z.string()),
});

/**
 * Uma linha do painel — um COMPUTADOR quando a turma montou equipes, uma
 * criança quando não. **Só progresso**: nem o voto, nem a taxa, nem nível
 * (`PROIBIDO_NA_LINHA_DO_PAINEL`, com teste). O painel é PROJETADO na lousa no
 * pico (PED-07: sem nome ligado a escolha). O nível de cada habilidade mora no
 * painel de habilidades (E14).
 */
export const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  equipe: z.object({ id: z.string().uuid(), nome: z.string() }).nullable(),
  entrou: z.boolean(),
  passo: PassoSchema,
  votou: z.boolean(),
  abriuAGaleria: z.boolean(),
  buscou: z.boolean(),
  revisou: z.boolean(),
  concluiu: z.boolean(),
});

export const PainelSchema = z.object({
  turma: TurmaResumoSchema,
  pacote: PacoteResumoSchema.extend({ midia: MidiaResumoSchema }),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  proximaEtapa: EtapaSchema.nullable(),
  /** Ordem alfabética, sem ordenação por desempenho. */
  linhas: z.array(LinhaDoPainelSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    entraram: z.number().int().min(0),
    votaram: z.number().int().min(0),
    revisaram: z.number().int().min(0),
    concluiram: z.number().int().min(0),
    /** "X de Y computadores votaram". Y sai da montagem das equipes quando há. */
    computadores: z.object({ votaram: z.number().int().min(0), total: z.number().int().min(0) }),
    porComputador: z.boolean(),
    /** A lousa do PICO: os votos da turma por área (o voto inicial, lacrado). */
    votosPorArea: z.array(CategoriaSchema.extend({ votos: z.number().int().min(0) })).length(AREAS.length),
    /** A média da taxa real de quem votou, 0–100, ou `null` sem voto. */
    invisibilidadeMedia: z.number().int().min(0).max(100).nullable(),
    /** Depois da galeria: quantos mantiveram e quantos trocaram o voto. */
    revisao: z.object({ mantiveram: z.number().int().min(0), trocaram: z.number().int().min(0) }),
    /** Os votos REVISADOS por área — a lousa depois da galeria. */
    votosRevisadosPorArea: z.array(CategoriaSchema.extend({ votos: z.number().int().min(0) })).length(AREAS.length),
  }),
});

export const GateDaTurmaSchema = z.object({
  turma: TurmaResumoSchema,
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  proximaEtapa: EtapaSchema.nullable(),
  atualizadoEm: z.string(),
});

export const ZerarTurmaSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
});

/**
 * O material do professor (guia da aula): o esqueleto fixo COM gabarito — a
 * ordem dos pacotes e dos blocos, os cartões certos — e a plenária.
 */
export const MaterialSchema = z.object({
  pacotes: z.array(z.object({ numero: z.number().int(), trecho: z.string(), rota: z.array(z.string()) })),
  blocos: z.array(z.object({ posicao: z.number().int(), rotulo: z.string() })),
  mariana: z.object({
    caso: z.string(),
    mecanismos: z.array(CartaoSchema.extend({ certo: z.boolean() })),
    atitudes: z.array(CartaoSchema.extend({ certo: z.boolean() })),
  }),
  plenaria: z.array(z.string()),
  regra: z.object({
    pesoDaCurtida: z.number().int(),
    pesoDaPermanencia: z.number().int(),
    limiar: z.number().int(),
    postsNoFeed: z.number().int(),
  }),
});
