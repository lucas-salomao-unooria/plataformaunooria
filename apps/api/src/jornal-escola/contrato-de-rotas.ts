import { z } from "zod";
import { problemasDoPacote } from "./invariantes";
import { ETAPAS, PASSOS, PASSOS_PEDIDOS } from "./regras/passos";
import {
  IDS_DE_BLOCO,
  IDS_DE_NOTICIA,
  LAYOUTS,
  MEIOS,
  MOTIVOS,
  ORIGENS_DO_LAYOUT,
  ORIGENS_DO_PACOTE,
  TAMANHO_DA_CHAVE,
  TAMANHO_DA_EDICAO,
  TIPOS_DE_PISTA,
  TOTAL_DE_NOTICIAS,
} from "./vocabulario";

/**
 * O contrato HTTP da exp04ef1b — só schemas Zod, nenhum decorator. O OpenAPI é
 * derivado daqui (ADR-36). Os enums vêm do vocabulário e das regras, nunca
 * reescritos.
 *
 * A saída do ESTUDANTE é allowlist explícita (`NoticiaPublicaSchema`). O que
 * não pode vazar antes da hora é o GABARITO de cada notícia — se ela é
 * publicável, o pilar que falta, a explicação — e a consequência (regra
 * inviolável nº 3). Eles cruzam a fronteira em três momentos, cada um com o seu
 * portão:
 *
 * - a CONSEQUÊNCIA das notícias escolhidas, no `GET resultado`, com a etapa
 *   `resultado` liberada pelo professor (e só das escolhidas: PDF §7);
 * - o PILAR EM FALTA de cada vaga da 1ª edição, no `GET revisao`, depois de a
 *   Chave se formar;
 * - o comparativo das duas edições, depois da 2ª publicação.
 *
 * As PISTAS (fonte, data, autoria) não são gabarito — são a evidência, e "tudo
 * o que for decisivo precisa estar disponível antes da primeira publicação"
 * (PDF §2). Mas o texto delas desce pelo `POST pista`, e não na sessão: é o
 * registro de quem abriu o quê que mede a EF15CO04, e uma pista lida sem
 * registro seria uma evidência que a plataforma não vê.
 */

// -------------------------------------------------------------- entrada

export const IdDeNoticiaSchema = z.enum(IDS_DE_NOTICIA);

/** As três vagas da página, na ORDEM: a primeira é a manchete principal. */
export const SlotsSchema = z
  .array(IdDeNoticiaSchema)
  .length(TAMANHO_DA_EDICAO)
  .refine((s) => new Set(s).size === s.length, "três notícias diferentes");

export const PedirPassoSchema = z.object({ para: z.enum(PASSOS_PEDIDOS) });

/** Abrir uma pista. Idempotente por par (notícia, tipo). */
export const AbrirPistaSchema = z.object({
  noticiaId: IdDeNoticiaSchema,
  tipo: z.enum(TIPOS_DE_PISTA),
});

/** Pedir a diagramação da página com as três vagas que a tela tem agora. */
export const DiagramarSchema = z.object({ slots: SlotsSchema });

/**
 * Publicar uma edição (a 1ª ou a 2ª — rotas diferentes, o mesmo corpo). O
 * `layout` é o que a tela desenhou (o que `POST diagramar` devolveu): ele é
 * cosmético, não vale nada na correção, e por isso o cliente o informa.
 */
export const PublicarSchema = z.object({
  slots: SlotsSchema,
  layout: z.enum(LAYOUTS),
  origemDoLayout: z.enum(ORIGENS_DO_LAYOUT),
});

/** A pergunta de motivo, depois do latch da 1ª. Uma vez só. */
export const MotivoSchema = z.object({ motivo: z.enum(MOTIVOS) });

/**
 * Uma tentativa da Chave do Editor: três blocos, em qualquer ordem.
 *
 * `tentativa` é o número que a TELA acha que está enviando (1, 2, 3…). Com ele o
 * servidor descarta a repetição da rede: um envio com número já contado devolve
 * o resultado gravado, sem somar. Sem ele, a resposta perdida e reenviada
 * contaria duas vezes — e a EF15CO02 sai do número de tentativas.
 */
export const ChaveSchema = z.object({
  blocos: z
    .array(z.enum(IDS_DE_BLOCO))
    .length(TAMANHO_DA_CHAVE)
    .refine((b) => new Set(b).size === b.length, "três blocos diferentes"),
  tentativa: z.number().int().min(1).max(100).optional(),
});

/** O botão único do painel: a etapa de DESTINO. */
export const GateSchema = z.object({ para: z.enum(ETAPAS) });

/**
 * Os parâmetros do preparo personalizado (E0-PROF-02). Os tetos são a primeira
 * barreira contra injeção de instrução no gerador — os campos entram num prompt,
 * delimitados como dado.
 */
export const ParametrosDoPreparoSchema = z.object({
  disciplina: z.string().trim().min(2).max(60),
  tema: z.string().trim().min(5).max(60),
  topicos: z.string().trim().max(600).optional(),
});

const Texto = (min: number, max: number) => z.string().trim().min(min).max(max);

/**
 * Uma notícia COMPLETA — com o gabarito e a consequência. Só entra e sai por
 * rota de professor. Os tetos aqui são de CARACTERE (contra corpo gigante); a
 * régua que manda é a de PALAVRAS, em `invariantes.ts`, cobrada pelo
 * `superRefine` da homologação.
 */
export const NoticiaDoPacoteSchema = z.object({
  id: IdDeNoticiaSchema,
  meio: z.enum(MEIOS),
  /** O nome do veículo como a criança o lê: "Gazeta do Bairro", "@fofocas_da_vila". */
  veiculo: Texto(2, 60),
  /** O locutor do rádio ou da TV; quem mandou a mensagem; `null` quando não há. */
  falante: Texto(2, 60).nullable(),
  manchete: Texto(5, 120),
  resumo: Texto(20, 320),
  /** A matéria no formato original: o recorte, a fala transcrita, o post, a mensagem. */
  corpo: Texto(20, 700),
  /** A legenda da foto ou do quadro de TV; `null` sem imagem. */
  legenda: Texto(2, 160).nullable(),
  /** O que a imagem mostra — é o prompt da geração E o texto alternativo. `null` = sem imagem. */
  descricaoImagem: Texto(5, 240).nullable(),
  pistas: z.object({ fonte: Texto(2, 200), data: Texto(2, 200), autoria: Texto(2, 200) }),
  gabarito: z.object({
    publicavel: z.boolean(),
    pilarEmFalta: z.enum(TIPOS_DE_PISTA).nullable(),
    /** Para o PROFESSOR: por que esta notícia vai ou não vai para a capa. */
    explicacao: Texto(5, 280),
  }),
  /** A reação do leitor quando a notícia circula (PDF §7) — uma por notícia, 1:1. */
  consequencia: z.object({ leitor: Texto(2, 60), fala: Texto(5, 220) }),
});
export type NoticiaDoPacote = z.infer<typeof NoticiaDoPacoteSchema>;

/**
 * A homologação: o clique em "Aprovar pacote". O corpo leva as oito notícias
 * INTEIRAS porque curadoria é editar — e editar uma notícia edita também o
 * gabarito e a consequência dela (PDF §10), então as três partes viajam juntas.
 * Como `.refine()` some do OpenAPI, a nota do `@Contrato` repete as regras.
 */
export const HomologacaoSchema = z.object({
  disciplina: z.string().trim().min(2).max(60),
  tema: z.string().trim().min(5).max(60),
  topicos: z.string().trim().max(600).optional(),
  origem: z.enum(ORIGENS_DO_PACOTE),
  noticias: z
    .array(NoticiaDoPacoteSchema)
    .length(TOTAL_DE_NOTICIAS)
    .superRefine((noticias, ctx) => {
      for (const problema of problemasDoPacote(noticias)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problema });
    }),
});

/**
 * O que a regeneração precisa saber das OUTRAS notícias: o meio, o papel no
 * gabarito e a manchete (para não repetir). Só isso, e sem régua de tamanho: o
 * professor pode estar no meio da edição de outra notícia, com um campo vazio,
 * e isso não pode travar "Regenerar notícia" nesta. Campo a mais que a tela
 * mande (a notícia inteira) o Zod descarta.
 */
export const NoticiaDeContextoSchema = z.object({
  id: IdDeNoticiaSchema,
  meio: z.enum(MEIOS),
  manchete: z.string().max(120),
  gabarito: z.object({
    publicavel: z.boolean(),
    pilarEmFalta: z.enum(TIPOS_DE_PISTA).nullable(),
  }),
});

/**
 * "Regenerar notícia" (E0-PROF-04): o pacote de agora e a notícia que sai. A
 * nova mantém o id, o MEIO e o papel no gabarito (publicável, antiga ou sem
 * confirmação) — senão a regeneração de uma desmontaria a composição das oito.
 * `usouIa: false` na resposta = a IA falhou e a notícia volta COMO ESTAVA.
 */
export const RegenerarNoticiaSchema = ParametrosDoPreparoSchema.extend({
  noticiaId: IdDeNoticiaSchema,
  noticias: z.array(NoticiaDeContextoSchema).length(TOTAL_DE_NOTICIAS),
});

// --------------------------------------------------------------- saída

const PassoSchema = z.enum(PASSOS);
const EtapaSchema = z.enum(ETAPAS);
const LayoutSchema = z.enum(LAYOUTS);
const OrigemDoLayoutSchema = z.enum(ORIGENS_DO_LAYOUT);
const PilarOuNuloSchema = z.enum(TIPOS_DE_PISTA).nullable();

/**
 * Uma notícia como o ESTUDANTE a recebe na mesa: o que está no cartão e na
 * matéria original, e nada do gabarito. `imagem` é `null` quando a notícia não
 * tem imagem; `imagem.url` é `null` enquanto o professor não a gerou — a tela
 * desenha o cartão pelo meio (com o `alt`), e a missão roda igual.
 */
export const NoticiaPublicaSchema = z.object({
  id: IdDeNoticiaSchema,
  meio: z.enum(MEIOS),
  veiculo: z.string(),
  falante: z.string().nullable(),
  manchete: z.string(),
  resumo: z.string(),
  corpo: z.string(),
  legenda: z.string().nullable(),
  imagem: z.object({ url: z.string().nullable(), alt: z.string() }).nullable(),
});

/**
 * Uma pista já aberta — o F5 devolve todas, para a gaveta reabrir como estava.
 * `fase` 1 = aberta na mesa, antes da 1ª publicação; 2 = na revisão. O mesmo par
 * pode aparecer nas duas: a revisão registra de novo. A EF15CO04 conta só a
 * fase 1 (antes de publicar); a EF04CO08 conta os pares distintos das DUAS.
 */
export const PistaAbertaSchema = z.object({
  noticiaId: IdDeNoticiaSchema,
  tipo: z.enum(TIPOS_DE_PISTA),
  fase: z.union([z.literal(1), z.literal(2)]),
  texto: z.string(),
});

/** Um bloco da Chave, como a bandeja o mostra. NÃO diz se é pilar ou isca. */
export const BlocoSchema = z.object({
  id: z.enum(IDS_DE_BLOCO),
  rotulo: z.string(),
  legenda: z.string(),
});

const EdicaoDoEstudanteSchema = z.object({
  slots: z.array(IdDeNoticiaSchema).length(TAMANHO_DA_EDICAO),
  layout: LayoutSchema,
  origemDoLayout: OrigemDoLayoutSchema,
  publicadaEm: z.string(),
});

/** O estado da sessão, como toda rota de estudante o devolve. */
export const EstadoSchema = z.object({
  sessaoId: z.string().uuid(),
  /** A ATIVIDADE (o pacote homologado). Muda quando o professor aprova outro. */
  pacoteId: z.string().uuid(),
  /** A rodada da atividade. Sobe quando o professor zera a turma. */
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  /** O passo que a tela mostra, já reconciliado com a etapa da turma. */
  passo: PassoSchema,
  /** O passo gravado — divergente do de cima = a turma o está conduzindo. */
  passoDoEstudante: PassoSchema,
  aguardandoOProfessor: z.boolean(),
  edicao1: EdicaoDoEstudanteSchema.nullable(),
  motivoRespondido: z.boolean(),
  chaveFormada: z.boolean(),
  /** Quantos envios da Chave já contaram — a base do `tentativa` do próximo `POST chave`. */
  chaveTentativas: z.number().int().min(0),
  edicao2: EdicaoDoEstudanteSchema.nullable(),
  pistasAbertas: z.array(PistaAbertaSchema),
  /** Quando a sessão nasceu (o `criado_em`): base do tempo total da telemetria, indicativo. */
  iniciadaEm: z.string(),
  concluidaEm: z.string().nullable(),
});

export const SessaoSchema = EstadoSchema.extend({
  pacote: z.object({
    tema: z.string(),
    /** As oito notícias na ORDEM DA MESA (a mesma que o professor projeta), sem gabarito. */
    noticias: z.array(NoticiaPublicaSchema).length(TOTAL_DE_NOTICIAS),
  }),
  /** Os seis blocos na ordem da bandeja DESTA sessão; `null` antes de a revisão abrir. */
  blocos: z.array(BlocoSchema).nullable(),
  limites: z.object({ edicao: z.number().int().positive(), chave: z.number().int().positive() }),
});

/** O polling de 5 s (ADR-93): magro, sem JOIN, sem notícias. */
export const GatePublicoSchema = z.object({
  etapa: EtapaSchema,
  /** `null` só antes da primeira entrada da turma (o gate nasce no `GET sessao`). */
  rodada: z.number().int().positive().nullable(),
  pacoteId: z.string().uuid().nullable(),
  passoEfetivo: PassoSchema,
  aguardandoOProfessor: z.boolean(),
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: z.string(),
});

export const DiagramacaoSchema = z.object({
  layout: LayoutSchema,
  /** `modelo` quando a IA não respondeu (sem saldo, atraso, saída inválida, mock). */
  origem: OrigemDoLayoutSchema,
});

export const PistaReveladaSchema = PistaAbertaSchema.extend({
  /** Quantos pares (notícia, tipo) esta sessão já abriu. */
  abertas: z.number().int().min(0),
});

/** A reação de um leitor da escola a uma notícia que circulou. */
export const ReacaoSchema = z.object({
  noticiaId: IdDeNoticiaSchema,
  leitor: z.string(),
  fala: z.string(),
  /** O humor do balão (`SpeechBubble.mood`): derivado de a notícia ser publicável. */
  humor: z.enum(["happy", "upset"]),
});

/** Uma edição com o que ela causou — o `GET resultado` e as duas metades do comparativo. */
export const EdicaoComResultadoSchema = z.object({
  slots: z.array(IdDeNoticiaSchema).length(TAMANHO_DA_EDICAO),
  layout: LayoutSchema,
  /** 0 a 3 (PDF §6: três notícias de peso igual). */
  verificadas: z.number().int().min(0).max(TAMANHO_DA_EDICAO),
  /** 0, 33, 67 ou 100 — descreve a SELEÇÃO, não a criança. */
  percentual: z.number().int().min(0).max(100),
  /** Uma por vaga, na ordem das vagas. */
  reacoes: z.array(ReacaoSchema).length(TAMANHO_DA_EDICAO),
});

export const ResultadoSchema = z.object({ edicao1: EdicaoComResultadoSchema });

/** Uma tentativa da Chave. `devolvidos` são as iscas, que voltam à bandeja. */
export const TentativaDaChaveSchema = z.object({
  sucesso: z.boolean(),
  tentativas: z.number().int().min(1),
  devolvidos: z.array(z.enum(IDS_DE_BLOCO)),
  estado: EstadoSchema,
});

const VagaMarcadaSchema = z.object({ noticiaId: IdDeNoticiaSchema, pilarEmFalta: PilarOuNuloSchema });

/**
 * A mesa de revisão: as vagas da 1ª edição com o marcador que a Chave pôs.
 * `pilarEmFalta` nulo = a notícia daquela vaga está verificada.
 */
export const RevisaoSchema = z.object({ vagas: z.array(VagaMarcadaSchema).length(TAMANHO_DA_EDICAO) });

/**
 * O antes e o depois (PDF §9). `vagas` diz, para as notícias das DUAS edições,
 * o pilar que faltava — "a devolutiva final explica quais evidências
 * sustentaram o resultado". A essa altura a descoberta já aconteceu.
 */
export const ComparativoSchema = z.object({
  edicao1: EdicaoComResultadoSchema,
  edicao2: EdicaoComResultadoSchema,
  vagas: z.array(VagaMarcadaSchema),
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

const PacoteResumoSchema = z.object({
  id: z.string().uuid(),
  disciplina: z.string(),
  tema: z.string(),
  origem: z.enum(ORIGENS_DO_PACOTE),
});

/**
 * Quantas notícias pedem imagem, quantas já têm e quantas o professor aprovou
 * (ADR-147). A atividade só vai ao ar com `aprovadas === total`.
 */
const MidiaResumoSchema = z.object({
  total: z.number().int().min(0),
  prontas: z.number().int().min(0),
  aprovadas: z.number().int().min(0),
});

/**
 * Uma linha do painel — um COMPUTADOR quando a turma montou equipes, uma
 * criança quando não. **Só progresso**: nenhum campo de
 * `PROIBIDO_NA_LINHA_DO_PAINEL` (com o teste que cobra a ausência). Quantas
 * verificadas cada um teve NÃO está aqui — está só no histograma anônimo.
 */
const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  equipe: z.object({ id: z.string().uuid(), nome: z.string() }).nullable(),
  /** Abriu a missão (tem sessão nesta rodada). Diferente de `iniciou`. */
  entrou: z.boolean(),
  /** Publicou a 1ª edição — é o `iniciou` do colapso por computador. */
  iniciou: z.boolean(),
  passo: PassoSchema,
  pistasAbertas: z.number().int().min(0),
  publicouAPrimeira: z.boolean(),
  chaveFormada: z.boolean(),
  publicouASegunda: z.boolean(),
  concluiu: z.boolean(),
});

/** [quantos com 0, com 1, com 2, com 3 verificadas] — por computador. */
const HistogramaSchema = z.array(z.number().int().min(0)).length(TAMANHO_DA_EDICAO + 1);

export const PainelSchema = z.object({
  turma: z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string().nullable() }),
  pacote: PacoteResumoSchema.extend({ midia: MidiaResumoSchema }),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  /** O rótulo do botão único: a próxima etapa, ou `null` depois da revisão. */
  proximaEtapa: EtapaSchema.nullable(),
  linhas: z.array(LinhaDoPainelSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    iniciaram: z.number().int().min(0),
    publicaramAPrimeira: z.number().int().min(0),
    formaramAChave: z.number().int().min(0),
    publicaramASegunda: z.number().int().min(0),
    concluiram: z.number().int().min(0),
    /** "X de Y computadores publicaram". Y sai da montagem das equipes quando há. */
    computadores: z.object({ publicaram: z.number().int().min(0), total: z.number().int().min(0) }),
    porComputador: z.boolean(),
    histograma: z.object({ edicao1: HistogramaSchema, edicao2: HistogramaSchema }),
    /** O motivo agregado da 1ª edição (a pergunta depois do latch). */
    motivos: z.object({ visual: z.number().int().min(0), checagem: z.number().int().min(0) }),
    /**
     * O radar CALCULADO (os 68 % do PRD eram ilustração): por notícia, quantos
     * computadores a puseram na 1ª e na 2ª edição. É do OBJETO editorial — "a
     * notícia da gincana de 2018 foi para 7 capas" —, não de quem a escolheu.
     */
    radar: z.array(
      z.object({
        noticiaId: IdDeNoticiaSchema,
        manchete: z.string(),
        meio: z.enum(MEIOS),
        publicavel: z.boolean(),
        pilarEmFalta: PilarOuNuloSchema,
        naEdicao1: z.number().int().min(0),
        naEdicao2: z.number().int().min(0),
      }),
    ),
  }),
});

export const GateDaTurmaSchema = z.object({
  turma: z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string().nullable() }),
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

/** O pacote como as telas do professor o mostram, com o gabarito. */
const PacoteNaTelaSchema = PacoteResumoSchema.extend({
  topicos: z.string().nullable(),
  noticias: z.array(NoticiaDoPacoteSchema),
  midia: MidiaResumoSchema,
  /** As URLs já geradas, por id de notícia. */
  imagens: z.record(z.string()),
  /** As notícias cuja imagem ATUAL o professor aprovou (ADR-147). Só estas chegam à turma. */
  aprovadas: z.array(IdDeNoticiaSchema),
});

export const PacotesSchema = z.object({
  /**
   * A atividade EM ANDAMENTO, COM o gabarito — ou `null` quando o professor
   * ainda não pôs nenhuma no ar: a plataforma não cria atividade (ADR-130).
   */
  ativo: PacoteNaTelaSchema.extend({
    rodada: z.number().int().positive(),
    etapa: EtapaSchema,
  }).nullable(),
  /** Todos os pacotes da turma, o ativo incluso — é o `?pacote=` do painel de habilidades. */
  historico: z.array(
    PacoteResumoSchema.extend({
      ativo: z.boolean(),
      criadoEm: z.string(),
      /** A maior rodada com sessão; 0 = nunca rodou. */
      rodadas: z.number().int().min(0),
      /** Todas as imagens geradas e aprovadas (ADR-147)? Sem isso, a atividade não vai ao ar. */
      imagensAprovadas: z.boolean(),
    }),
  ),
});

/** O rascunho do preparo — não persiste. `usouIa: false` = é o banco padrão. */
export const RascunhoSchema = z.object({
  disciplina: z.string(),
  tema: z.string(),
  topicos: z.string().nullable(),
  origem: z.enum(ORIGENS_DO_PACOTE),
  usouIa: z.boolean(),
  noticias: z.array(NoticiaDoPacoteSchema).length(TOTAL_DE_NOTICIAS),
});

export const NoticiaRegeneradaSchema = z.object({ noticia: NoticiaDoPacoteSchema, usouIa: z.boolean() });

/**
 * A atividade criada: nasce PRONTA (ADR-130). `ativo` só é `true` no segundo
 * clique em "Criar atividade" sobre um pacote que já estava no ar.
 */
export const PacoteHomologadoSchema = PacoteResumoSchema.extend({
  ativo: z.boolean(),
  noticias: z.array(NoticiaDoPacoteSchema).length(TOTAL_DE_NOTICIAS),
});

/** UM pacote, em andamento ou não — a página da atividade. */
export const PacoteDetalheSchema = PacoteNaTelaSchema.extend({
  ativo: z.boolean(),
  /** A rodada e a etapa do gate, só quando em andamento. */
  rodada: z.number().int().positive().nullable(),
  etapa: EtapaSchema.nullable(),
  criadoEm: z.string(),
  /** A maior rodada com sessão; 0 = nunca rodou. */
  rodadas: z.number().int().min(0),
});

export const EmAndamentoSchema = z.object({
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
  etapa: EtapaSchema,
  /** `false` = ele já estava em andamento (o segundo clique). */
  mudou: z.boolean(),
});

/** `?pacoteId=` da rota de imagens: a atividade PRONTA sendo preparada. */
export const QueryDoPacoteSchema = z.object({
  escolaId: z.string().optional(),
  pacoteId: z.string().uuid().optional(),
});

export const ProgressoDaMidiaSchema = z.object({
  pacoteId: z.string().uuid(),
  total: z.number().int().min(0),
  prontas: z.number().int().min(0),
  faltam: z.number().int().min(0),
  /** As notícias cuja imagem saiu NESTA chamada. */
  geradas: z.array(IdDeNoticiaSchema),
  /** As que falharam NESTA chamada — seguem com o cartão desenhado pelo meio. */
  falharam: z.array(IdDeNoticiaSchema),
  /** `true` quando não falta nada: o cliente para de repetir. */
  completo: z.boolean(),
  imagens: z.record(z.string()),
});

/**
 * `POST :turmaId/pacotes/:pacoteId/aprovar-imagens` (ADR-147): as URLs que
 * estavam NA TELA do professor, por notícia. Só essas se aprovam.
 */
export const AprovarImagensSchema = z
  .object({ imagens: z.record(IdDeNoticiaSchema, z.string().url().max(2_000)) })
  .strict();

export const ImagensAprovadasSchema = z.object({
  pacoteId: z.string().uuid(),
  /** As notícias com a imagem atual aprovada, depois desta chamada. */
  aprovadas: z.array(IdDeNoticiaSchema),
  /** As que o corpo trazia com URL que JÁ NÃO é a do pacote (outra aba gerou outra): não entraram. */
  desatualizadas: z.array(IdDeNoticiaSchema),
  midia: MidiaResumoSchema,
  /** Todas as notícias que pedem imagem estão com imagem aprovada: pode ir ao ar. */
  prontaParaAula: z.boolean(),
});

/** `POST :turmaId/pacotes/:pacoteId/imagens/:noticiaId/regerar` — o "Gerar outra" (ADR-147). */
export const ImagemRegeradaSchema = z.object({
  pacoteId: z.string().uuid(),
  noticiaId: IdDeNoticiaSchema,
  url: z.string(),
});

/**
 * O material do professor para a aula: o pacote com gabarito (é o que ele
 * projeta quando a sala tem um computador só, PDF §11), a Chave com os pilares
 * marcados e o roteiro da mediação (copy revisada, §4b).
 */
export const ConteudoDaAulaSchema = z.object({
  disciplina: z.string(),
  tema: z.string(),
  noticias: z.array(NoticiaDoPacoteSchema).length(TOTAL_DE_NOTICIAS),
  blocos: z.array(BlocoSchema.extend({ pilar: z.boolean() })),
  roteiro: z.object({
    gatilhoDoResultado: z.string(),
    perguntas: z.array(z.string()).length(3),
    gatilhoDaRevisao: z.string(),
  }),
});
