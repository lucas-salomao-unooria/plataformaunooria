import { z } from "zod";
import {
  GATILHOS,
  IDS_DE_MENSAGEM,
  ORIGENS_DO_LOTE,
  PISO_DA_REFLEXAO,
  TETO_DA_REFLEXAO,
  TIPOS_DE_MENSAGEM,
  TONS,
  TOTAL_DE_MENSAGENS,
  VERACIDADES,
} from "./catalogo";
import { validarParidade } from "./regras/curadoria";
import { ACOES_DO_GATE, ETAPAS, PASSOS } from "./regras/passos";

/**
 * O contrato HTTP da exp05ef1b — só schemas Zod, nenhum decorator.
 *
 * Os enums vêm do catálogo e das regras, nunca reescritos aqui: uma segunda
 * lista de valores é a que ninguém atualiza junto.
 *
 * A saída é ALLOWLIST explícita. O que não pode vazar é o gabarito — a
 * veracidade, o tom e a explicação de cada mensagem (regra inviolável nº 3).
 * `MensagemPublicaSchema` não tem campo para eles, então o vazamento pelo lote
 * não é "esquecido": é impossível. Os três só aparecem dentro de `revelacao`,
 * que o servidor preenche quando a etapa da turma passa da exploração.
 */

// -------------------------------------------------------------- entrada

export const MensagemIdSchema = z.enum(IDS_DE_MENSAGEM);

export const EncaminharSchema = z.object({ mensagemId: MensagemIdSchema });

/** Abriu a transcrição do áudio ou o card do link. Indicativo, nunca mérito. */
export const MidiaSchema = z.object({ mensagemId: MensagemIdSchema });

/**
 * A reflexão ao dilema do tio. 5 a 500 caracteres, o teto do campo na tela.
 *
 * `trim` antes do `min`: um campo com cinco espaços é uma resposta em branco,
 * e ela contaria como entregue no painel da professora.
 */
export const ReflexaoSchema = z.object({
  texto: z.string().trim().min(PISO_DA_REFLEXAO).max(TETO_DA_REFLEXAO),
});

export const GateSchema = z.object({ acao: z.enum(ACOES_DO_GATE) });

/**
 * Os parâmetros da preparação docente (E0-PROF-01).
 *
 * O tema tem teto de 60 porque alimenta um prompt: campo longo aqui é injeção
 * de instrução no gerador, e o teto é a primeira barreira (a segunda é o
 * `system` de `prompts.ts`, que fixa o formato da saída).
 */
export const ParametrosDoPreparoSchema = z.object({
  tema: z.string().trim().min(10).max(60),
  gatilho: z.enum(GATILHOS),
  contextoDaEscola: z.string().trim().max(100).optional(),
});

/** Uma mensagem COMPLETA — com o gabarito. Só entra e sai por rota de professor. */
export const MensagemDoLoteSchema = z.object({
  id: MensagemIdSchema,
  remetente: z.string().trim().min(2).max(30),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  tipo: z.enum(TIPOS_DE_MENSAGEM),
  corpo: z.string().trim().min(1).max(600),
  duracaoSeg: z.number().int().min(1).max(20).optional(),
  titulo: z.string().trim().min(1).max(120).optional(),
  fonte: z.string().trim().min(1).max(60).optional(),
  data: z.string().trim().min(1).max(40).optional(),
  veracidade: z.enum(VERACIDADES),
  tom: z.enum(TONS),
  explicacao: z.string().trim().min(5).max(160),
});

/**
 * A homologação do lote da turma.
 *
 * A professora pode editar QUALQUER texto antes de aprovar — é a exigência de
 * curadoria humana do PRD (RF-001), e é por isso que o corpo carrega o lote
 * inteiro em vez de um `{ aprovado: true }`. O `.refine` cobra a paridade; como
 * `.refine()` some do OpenAPI, a nota do `@Contrato` a repete em texto.
 */
export const HomologacaoSchema = z.object({
  tema: z.string().trim().min(10).max(100),
  gatilho: z.enum(GATILHOS),
  origem: z.enum(ORIGENS_DO_LOTE),
  mensagens: z
    .array(MensagemDoLoteSchema)
    .length(TOTAL_DE_MENSAGENS)
    .refine((m) => validarParidade(m).ok, "3 verdadeiras, 3 falsas e 2 ambíguas")
    .refine(
      (m) => new Set(m.map((x) => x.id)).size === m.length,
      "cada id de msg-1 a msg-8 aparece uma vez",
    ),
});

// --------------------------------------------------------------- saída

const PassoSchema = z.enum(PASSOS);
const EtapaSchema = z.enum(ETAPAS);
const VeracidadeSchema = z.enum(VERACIDADES);

/** Uma mensagem como o ESTUDANTE a recebe — sem `veracidade`, `tom` e `explicacao`. */
export const MensagemPublicaSchema = z.object({
  id: MensagemIdSchema,
  remetente: z.string(),
  hora: z.string(),
  tipo: z.enum(TIPOS_DE_MENSAGEM),
  corpo: z.string(),
  duracaoSeg: z.number().int().optional(),
  titulo: z.string().optional(),
  fonte: z.string().optional(),
  data: z.string().optional(),
});

/** Uma barra do telão e o selo do balão. Só existe DEPOIS da revelação. */
const MensagemReveladaSchema = z.object({
  id: MensagemIdSchema,
  veracidade: VeracidadeSchema,
  explicacao: z.string(),
  /** Quantos estudantes CONFIRMADOS encaminharam. É a métrica social do balão. */
  total: z.number().int().min(0),
  percentual: z.number().int().min(0).max(100),
});

const SinteseSchema = z.object({
  emocionais: z.number().int().min(0),
  informativas: z.number().int().min(0),
  polaridade: z.enum(["urgencia-venceu", "informativas-venceram", "empate"]),
});

/**
 * O que a revelação entrega ao estudante. `null` até a professora acender o
 * telão — e é o ÚNICO lugar em que a veracidade cruza a fronteira do cliente.
 */
export const RevelacaoSchema = z.object({
  totalConfirmados: z.number().int().min(0),
  mensagens: z.array(MensagemReveladaSchema),
  sintese: SinteseSchema,
});

export const EstadoSchema = z.object({
  /** O passo do estudante, já reconciliado com a etapa da turma. */
  passo: PassoSchema,
  /** O passo cru dele. Divergente do de cima = a turma o está segurando ou empurrando. */
  passoDoEstudante: PassoSchema,
  aguardandoATurma: z.boolean(),
  /** A professora já homologou um lote para esta turma? Sem isso, a tela é de espera. */
  preparada: z.boolean(),
  encaminhadas: z.array(MensagemIdSchema),
  totalEncaminhadas: z.number().int().min(0),
  atingiuPiso: z.boolean(),
  faltam: z.number().int().min(0),
  leuTudo: z.boolean(),
  podeConfirmar: z.boolean(),
  encaminhouTudo: z.boolean(),
  confirmou: z.boolean(),
  confirmadoEm: z.string().nullable(),
  midiasAbertas: z.array(MensagemIdSchema),
  entregouReflexao: z.boolean(),
  concluidoEm: z.string().nullable(),
  turma: z.object({ etapa: EtapaSchema }),
  revelacao: RevelacaoSchema.nullable(),
});

const PodcastSchema = z.object({
  titulo: z.string(),
  blocos: z.array(z.object({ rotulo: z.string(), falas: z.array(z.string()) })),
});

/** O lote como o estudante o vê. `null` enquanto a professora não homologou. */
export const LotePublicoSchema = z.object({
  tema: z.string(),
  grupo: z.object({ nome: z.string(), subtitulo: z.string() }),
  mural: z.object({ nome: z.string() }),
  mensagens: z.array(MensagemPublicaSchema).length(TOTAL_DE_MENSAGENS),
});

export const SessaoSchema = EstadoSchema.extend({
  lote: LotePublicoSchema.nullable(),
  constantes: z.object({
    pisoDeEncaminhamentos: z.number().int().positive(),
    totalDeMensagens: z.number().int().positive(),
    perguntaDaReflexao: z.string(),
    pisoDaReflexao: z.number().int().positive(),
    tetoDaReflexao: z.number().int().positive(),
    podcast: PodcastSchema,
  }),
  /** A reflexão do PRÓPRIO estudante. Nunca a de outro. */
  reflexao: z.object({ texto: z.string() }).nullable(),
  estudante: z.object({ nome: z.string() }),
});

export const EncaminhamentoRespostaSchema = EstadoSchema.extend({
  /** `false` = a mensagem já estava no Mural. Não é erro, e não conta de novo. */
  novo: z.boolean(),
});

export const GatePublicoSchema = z.object({
  etapa: EtapaSchema,
  passoEfetivo: PassoSchema,
  aguardandoATurma: z.boolean(),
  preparada: z.boolean(),
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: z.string(),
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

/**
 * Uma linha do painel.
 *
 * **Sem `score`, sem `nivel` e sem "quantas falsas encaminhou"** —
 * `PROIBIDO_NO_PAINEL` em `invariantes.ts` tem o teste que cobra a ausência.
 * O que há é progresso e conduta: leu tudo, ouviu o áudio, confirmou, quando.
 * A leitura do gabarito é da SALA, no histograma, nunca por criança.
 *
 * `reflexaoTexto` está AQUI e só aqui: é caixa livre de menor. E ele vem
 * PREENCHIDO só para quem dá aula à turma — para gestor, diretor e admin o
 * campo é `null`, ainda que a rota inteira lhes responda. O que eles precisam
 * é `entregouReflexao`, que é acompanhamento de progresso; ler o parágrafo é
 * outra coisa. O porquê inteiro está no service, sobre o campo.
 */
const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  usuario: z.string(),
  iniciou: z.boolean(),
  passo: PassoSchema,
  totalEncaminhadas: z.number().int().min(0),
  leuTudo: z.boolean(),
  ouviuAudio: z.boolean(),
  abriuLink: z.boolean(),
  /** Segundos entre entrar no grupo e o primeiro encaminhamento. Indicativo de impulsividade. */
  segundosAteOPrimeiroEncaminhamento: z.number().int().nullable(),
  confirmou: z.boolean(),
  entregouReflexao: z.boolean(),
  reflexaoTexto: z.string().nullable(),
  ociosoMin: z.number().int().nullable(),
});

const BarraSchema = z.object({
  id: MensagemIdSchema,
  remetente: z.string(),
  tipo: z.enum(TIPOS_DE_MENSAGEM),
  resumo: z.string(),
  veracidade: VeracidadeSchema,
  explicacao: z.string(),
  total: z.number().int().min(0),
  percentual: z.number().int().min(0).max(100),
});

export const PainelSchema = z.object({
  turma: z.object({
    id: z.string().uuid(),
    nome: z.string(),
    serie: z.string().nullable(),
    etapa: EtapaSchema,
    preparada: z.boolean(),
  }),
  estudantes: z.array(LinhaDoPainelSchema),
  resumo: z.object({
    total: z.number().int().min(0),
    iniciaram: z.number().int().min(0),
    confirmaram: z.number().int().min(0),
    /** `confirmaram` sobre `total`, inteiro. É a barra de prontidão do PRD. */
    percentualConfirmados: z.number().int().min(0).max(100),
    entregaram: z.number().int().min(0),
    ociosos: z.number().int().min(0),
    /** O telão: uma barra por mensagem, anonimizada. Só confirmados contam. */
    histograma: z.array(BarraSchema),
    sintese: SinteseSchema,
  }),
});

/** O lote da turma, COM o gabarito. Professor-only. */
export const ConteudoDaTurmaSchema = z.object({
  tema: z.string(),
  gatilho: z.enum(GATILHOS),
  origem: z.enum(ORIGENS_DO_LOTE),
  mensagens: z.array(MensagemDoLoteSchema),
  aprovadoPorProfessor: z.boolean(),
  atualizadoEm: z.string().nullable(),
});

export const GateDaTurmaSchema = z.object({
  turma: z.object({
    id: z.string().uuid(),
    nome: z.string(),
    serie: z.string().nullable(),
  }),
  etapa: EtapaSchema,
  atualizadoEm: z.string(),
});

export const ZerarTurmaSchema = z.object({
  sucesso: z.literal(true),
  registrosApagados: z.number().int().min(0),
});

/**
 * O material do guia da aula: o banco curado COM gabarito e o roteiro do
 * episódio. Professor-only, sem tenancy — é o catálogo da missão, igual para
 * todo contrato. Se a professora gerou outro lote, ele está no painel da turma.
 */
export const MaterialDoProfessorSchema = z.object({
  tema: z.string(),
  mensagens: z.array(MensagemDoLoteSchema),
  paridade: z.object({
    verdadeira: z.number().int(),
    falsa: z.number().int(),
    ambigua: z.number().int(),
  }),
  pisoDeEncaminhamentos: z.number().int().positive(),
  podcast: PodcastSchema,
});
