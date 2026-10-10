import { z } from "zod";
import { falasDoTemaSchema } from "../podcast/roteiro";
import { VAGAS_DO_PODCAST } from "./podcast";
import { problemasDoPacote } from "./invariantes";
import { ETAPAS, PASSOS, PASSOS_PEDIDOS } from "./regras/passos";
import { IDS_DE_ATITUDE, IDS_DE_MECANISMO, TOTAL_DE_BLOCOS } from "./conteudo";
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
 * - a ORDEM certa dos blocos e o cartão certo: os itens descem
 *   embaralhados, com ids opacos, e quem confere é o servidor (regra 3) — a
 *   ordem errada é 422 `ordem-incorreta`, e a tentativa conta;
 * - as alternativas certas das enquetes, que são da ficha de evidência e
 *   descem pelas rotas genéricas de `/evidencias`.
 */

// ------------------------------------------------------------------ comuns

export const AreaSchema = z.enum(AREAS);
export const PassoSchema = z.enum(PASSOS);
export const EtapaSchema = z.enum(ETAPAS);
export const IdDeProjetoSchema = z.string().regex(ID_DE_PROJETO_RE);
export const IdDePostSchema = z.string().regex(ID_DE_POST_RE);
/** Ids opacos dos blocos: sorteados por sessão, não dizem a posição. */
export const IdOpacoSchema = z.string().regex(/^bl-[a-z0-9]{3}$/);

// -------------------------------------------------------- entrada: estudante

export const PedirPassoSchema = z.object({ para: z.enum(PASSOS_PEDIDOS) });

/**
 * O que o cliente MEDIU desde a última chamada, e se quer o próximo post.
 * Curtida e salvo são estado (true/false), permanência é fato (uma por post).
 * Salvar é gravado e NÃO pesa no motor. O teto de 20 é folga: o feed inteiro
 * tem dez posts. O primeiro `proximo: true` é a 1ª ROLAGEM: liga o relógio de
 * 8 minutos do servidor.
 */
export const EventosDoFeedSchema = z.object({
  curtidas: z.array(z.object({ postId: IdDePostSchema, curtiu: z.boolean() })).max(20).default([]),
  salvamentos: z.array(z.object({ postId: IdDePostSchema, salvou: z.boolean() })).max(20).default([]),
  permanencias: z.array(IdDePostSchema).max(20).default([]),
  /** `true` quando a tela chegou ao último post servido: o servidor serve o próximo. */
  proximo: z.boolean().default(false),
});

/**
 * A cédula — quatro elementos (melhoria 6): o título, um projeto do feed, a
 * certeza ("Sim" = `examinei_bem`, "Com certeza" = `vi_tudo`) e o botão. Sem
 * justificativa, sem frase grifada. É o LATCH 1.
 */
export const VotoSchema = z.object({
  projetoId: IdDeProjetoSchema,
  conviccao: z.enum(CONVICCOES),
});

/**
 * O BATIMENTO da cédula aberta (melhoria 8): a cada 15 s, há quantos segundos
 * não há toque nela. `aberta: false` (fechou sem votar) apaga a marca na hora.
 */
export const BatimentoDaCedulaSchema = z.object({
  aberta: z.boolean(),
  segundosSemToque: z.number().int().min(0).max(3600).default(0),
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

/**
 * A revisão do voto depois da galeria — o LATCH 2, dois botões (melhoria 6):
 * "Manter meu voto inicial" (`manter`, só depois de abrir ao menos UM estande
 * oculto) ou "Confirmar Voto Revisado" (`trocar`, com o estande novo). Sem
 * justificativa.
 */
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
  /** O texto do FORMATO: a legenda, o bastidor, o protótipo ou o depoimento. */
  texto: z.string(),
  /** A legenda do ESTANDE, em qualquer formato (o "...mais" da apresentação). */
  legenda: z.string(),
  hashtags: z.array(z.string()),
  imagem: ImagemPublicaSchema,
});

export const FeedSchema = z.object({
  posts: z.array(PostPublicoSchema).max(POSTS_NO_FEED),
  curtidos: z.array(IdDePostSchema),
  salvos: z.array(IdDePostSchema),
  /** Os dez chegaram. */
  completo: z.boolean(),
  /** Os 8 minutos do servidor, desde a 1ª rolagem, acabaram: o feed não serve mais. */
  tempoEsgotado: z.boolean(),
  /** Quando o feed encerra por tempo (ISO), ou `null` antes da 1ª rolagem. */
  encerraEm: z.string().nullable(),
  /** A cédula pode abrir: `completo` OU `tempoEsgotado`. */
  cedulaLiberada: z.boolean(),
});

/** Um estande na galeria: a apresentação e se ele chegou ao feed DESTE estudante. */
export const ProjetoDaGaleriaSchema = z.object({
  id: IdDeProjetoSchema,
  area: AreaSchema,
  titulo: z.string(),
  escola: z.string(),
  perfil: z.string(),
  legenda: z.string(),
  /** O resumo técnico da ficha de inspeção (E4-ALU-02). */
  resumo: z.string(),
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
  /** O número REAL do badge ("{percentual}% dos projetos da feira ficaram fora do seu feed") e da grade. */
  invisibilidade: InvisibilidadeSchema,
  /** Os dezesseis, os que NÃO chegaram primeiro (é a grade da Galeria Oculta). */
  projetos: z.array(ProjetoDaGaleriaSchema).length(TOTAL_DE_PROJETOS),
  /** Quantos estandes ocultos a criança já abriu. */
  ocultosAbertos: z.number().int().min(0),
  /** "Manter meu voto inicial" está liberado (abriu ao menos um oculto). */
  podeManter: z.boolean(),
});

export const BlocoDaCadeiaSchema = z.object({ id: IdOpacoSchema, rotulo: z.string() });

const CartaoSchema = z.object({ id: z.string(), texto: z.string() });

const HistoricoSchema = z.object({
  areaPrincipal: AreaSchema.nullable(),
  porArea: z
    .array(z.object({ area: AreaSchema, posts: z.number().int().min(0), curtidas: z.number().int().min(0) }))
    .length(AREAS.length),
});

/**
 * O PAR SIMULADO da Etapa 5 (melhoria 7): o histórico desta criança ao lado do
 * de "outro jurado que curtiu temas diferentes" — GERADO pelo servidor como o
 * espelho das áreas reais deste feed, nunca dado de colega.
 */
export const ParSimuladoSchema = z.object({ voce: HistoricoSchema, outroJurado: HistoricoSchema });

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
    .object({
      /** `complementar` só nas sessões da 0.3.0. */
      acao: z.enum(["manter", "trocar", "complementar"]),
      /** O estande da troca; `null` ao manter. */
      projetoId: IdDeProjetoSchema.nullable(),
    })
    .nullable(),
  /** Embaralhados pela sessão, e o par simulado. Do passo `cadeia` em diante. */
  cadeia: z
    .object({
      blocos: z.array(BlocoDaCadeiaSchema).length(TOTAL_DE_BLOCOS),
      tentativas: z.number().int().min(0),
      montada: z.boolean(),
      parSimulado: ParSimuladoSchema,
    })
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

/**
 * A resposta da cadeia CERTA (200). A errada é **422** `ordem-incorreta`, com
 * `tentativas` no corpo — nunca qual vaga errou.
 */
export const TentativaSchema = z.object({
  correta: z.literal(true),
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
  /** Os formatos da saturação. Opcionais: o banco padrão não os tem (o post cai no bastidor e na legenda). */
  prototipo: z.string().trim().min(10).max(280).optional(),
  depoimento: z.string().trim().min(10).max(280).optional(),
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
  /**
   * Quando o professor ABRIU o preparo (EVT-P01): a tela de criação guarda o
   * instante e manda aqui. Opcional; o servidor aceita só as últimas 24 h, e
   * sem ele vale o instante da homologação.
   */
  preparoIniciadoEm: z.string().datetime().optional(),
  /**
   * As três falas do podcast de recapitulação que o professor revisou na
   * criação (ADR-150, ADR-151): os dois estandes de áreas diferentes, o que o
   * feed do Rafa mostrou e o que o da mesa ao lado mostrou.
   */
  podcast: falasDoTemaSchema(VAGAS_DO_PODCAST),
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

/**
 * O rascunho do preparo — não persiste; só `homologar` grava. `usouIa: false`
 * é o FALLBACK (RF-007, §12.2): sem cota ou com a IA fora do ar, o conteúdo é
 * o BANCO PADRÃO, e `motivo` diz por quê.
 */
export const RascunhoSchema = z.object({
  parametros: ParametrosDoPreparoSchema,
  conteudo: ConteudoDoPacoteSchema,
  usouIa: z.boolean(),
  origem: z.enum(ORIGENS_DO_PACOTE),
  motivo: z.enum(["sem-saldo-de-ia", "ia-indisponivel"]).nullable(),
});

/**
 * "Usar Banco Padrão Oficial" (E0-PROF-02): o caminho curto, sem IA. `porNoAr`
 * faz o "Usar Banco Padrão e Pôr no ar" de um toque (a contagem do Anexo §9a).
 */
export const BancoPadraoSchema = z.object({ porNoAr: z.boolean().default(false) });

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
      /** A segunda fase da aprovação passou? Sem ela, a atividade não vai ao ar. */
      imagensAprovadas: z.boolean(),
    }),
  ),
});

export const PacoteDetalheSchema = PacoteNaTelaSchema.extend({
  ativo: z.boolean(),
  rodada: z.number().int().positive().nullable(),
  etapa: EtapaSchema.nullable(),
  criadoEm: z.string(),
  rodadas: z.number().int().min(0),
  /** Quando o professor aprovou as imagens; `null` = a segunda fase não passou, e a atividade não vai ao ar. */
  imagensAprovadasEm: z.string().nullable(),
});

/** `POST :turmaId/pacotes/:pacoteId/aprovar-imagens`. */
export const ImagensAprovadasSchema = z.object({
  pacoteId: z.string().uuid(),
  imagensAprovadasEm: z.string(),
});

/** `POST :turmaId/pacotes/:pacoteId/imagens/:projetoId/refazer` — a imagem nova de UM estande. */
export const ImagemRefeitaSchema = z.object({
  pacoteId: z.string().uuid(),
  projetoId: IdDeProjetoSchema,
  url: z.string(),
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
  /** O SINALIZADOR DE OCIOSOS: cédula aberta e mais de 60 s sem toque (o ícone ao lado do nome). */
  ocioso: z.boolean(),
  abriuAGaleria: z.boolean(),
  buscou: z.boolean(),
  /** As categorias que a criança buscou pela hashtag na galeria (a leitura da EF06CO01, melhoria 3). */
  categoriasBuscadas: z.array(AreaSchema),
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
    /** Quantos estão ociosos na cédula agora. */
    ociosos: z.number().int().min(0),
    /** "X de Y computadores votaram". Y sai da montagem das equipes quando há. */
    computadores: z.object({ votaram: z.number().int().min(0), total: z.number().int().min(0) }),
    porComputador: z.boolean(),
    /** A lousa do PICO: os votos da turma por área (o voto inicial, lacrado). */
    votosPorArea: z.array(CategoriaSchema.extend({ votos: z.number().int().min(0) })).length(AREAS.length),
    /** A média da taxa real de quem votou, 0–100, ou `null` sem voto. */
    invisibilidadeMedia: z.number().int().min(0).max(100).nullable(),
    /** Depois da galeria: quantos mantiveram ou trocaram o voto. */
    revisao: z.object({
      mantiveram: z.number().int().min(0),
      trocaram: z.number().int().min(0),
    }),
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
 * ordem dos blocos, os cartões certos — e a plenária.
 */
export const MaterialSchema = z.object({
  blocos: z.array(z.object({ posicao: z.number().int(), rotulo: z.string() })),
  mariana: z.object({
    caso: z.string(),
    mecanismos: z.array(CartaoSchema.extend({ certo: z.boolean() })),
    atitudes: z.array(CartaoSchema.extend({ certo: z.boolean() })),
  }),
  plenaria: z.array(z.string()),
  feedbackDaCadeia: z.object({ correta: z.string(), incorreta: z.string() }),
  regra: z.object({
    pesoDaCurtida: z.number().int(),
    pesoDaPermanencia: z.number().int(),
    limiar: z.number().int(),
    postsNoFeed: z.number().int(),
    minutosNoFeed: z.number().int(),
  }),
});
