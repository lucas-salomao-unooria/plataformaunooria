import { z } from "zod";
import {
  COMENTARIOS_POR_PACOTE,
  DISCIPLINAS,
  FASES,
  IDS_DOS_INDICADORES,
  MANCHETE_MAX_CARACTERES,
  MANCHETES,
  MAX_CARACTERES_DA_MENSAGEM,
  MODERACOES,
  NOS,
  ORIGENS,
  PARAGRAFOS,
  TEMA,
  TIPOS_DE_COMENTARIO,
} from "./conteudo";
import { problemasDoConteudo } from "./regras/pacote";
import { PASSOS } from "./regras/passos";

/**
 * O contrato HTTP da exp02em1b — só schemas Zod. O OpenAPI é derivado daqui
 * (ADR-36), e os vocabulários vêm do catálogo, nunca reescritos.
 *
 * A saída do ESTUDANTE é allowlist: o comentário desce sem `tipo` (a categoria
 * de saúde é o gabarito da EM13CO24), o indicador sem `comprova` e o parágrafo
 * sem o nó. Quem diz se um gesto mediu alguma coisa é o servidor.
 */

const DisciplinaSchema = z.enum(DISCIPLINAS);
const FaseSchema = z.enum(FASES);
const PassoSchema = z.enum(PASSOS);
const MancheteSchema = z.enum(MANCHETES);
const ParagrafoIdSchema = z.string().regex(/^p[1-6]$/, "id de parágrafo p1 a p6");
const ComentarioIdSchema = z.string().regex(/^c[1-9]$/, "id de comentário c1 a c9");

// ─────────────────────────────────────────────────────────── entrada (estudante)

/** Uma mensagem no chat do UnooriaAI. O texto é de menor: fica na sessão, nunca no painel nem na telemetria. */
export const MensagemSchema = z.object({ texto: z.string().trim().min(1).max(MAX_CARACTERES_DA_MENSAGEM) });

/** Tirar ou devolver um parágrafo na prévia. */
export const ParagrafoSchema = z.object({ paragrafoId: ParagrafoIdSchema, removido: z.boolean() });

/** O LATCH: a manchete escolhida no "Publicar no Unoovista". */
export const PublicarSchema = z.object({ manchete: MancheteSchema });

/** Uma ação no feed da madrugada (Etapa 4). */
export const AcaoNoFeedSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("inspecionar"), comentarioId: ComentarioIdSchema }),
  z.object({ acao: z.literal("metricas") }),
  z.object({ acao: z.literal("moderar"), moderacao: z.enum(MODERACOES) }),
  z.object({ acao: z.literal("privacidade") }),
  z.object({ acao: z.literal("denunciar"), comentarioId: ComentarioIdSchema }),
  z.object({ acao: z.literal("ajuda") }),
]);

/** Um indicador apontado no Explicar (Etapa 5). */
export const IndicadorSchema = z.object({ indicador: z.string().refine((i) => IDS_DOS_INDICADORES.includes(i), "indicador desconhecido") });

// ─────────────────────────────────────────────────────────── entrada (professor)

const texto = (max: number) => z.string().trim().min(1).max(max);

export const ParagrafoDoRascunhoSchema = z.object({
  id: ParagrafoIdSchema,
  no: z.enum(NOS).nullable(),
  texto: texto(600),
  corrigido: texto(600).optional(),
});

export const ComentarioDoFeedSchema = z.object({
  id: ComentarioIdSchema,
  autor: texto(30),
  handle: z.string().trim().regex(/^@[a-z0-9_.]{2,29}$/, "o perfil começa com @ e usa minúsculas, números, _ ou ."),
  horario: z.string().regex(/^\d{2}:\d{2}$/, "horário no formato 02:40"),
  tipo: z.enum(TIPOS_DE_COMENTARIO),
  texto: texto(300),
});

/** O conteúdo do pacote — a forma; a RÉGUA (`problemasDoConteudo`) entra no `superRefine`. */
export const ConteudoBaseSchema = z.object({
  rascunho: z.array(ParagrafoDoRascunhoSchema).min(PARAGRAFOS.min).max(PARAGRAFOS.max),
  fonteInventada: texto(60),
  colega: texto(60),
  veiculo: texto(80),
  recorte: texto(160),
  manchetes: z.object({
    neutra: texto(MANCHETE_MAX_CARACTERES),
    construtiva: texto(MANCHETE_MAX_CARACTERES),
    sensacionalista: texto(MANCHETE_MAX_CARACTERES),
  }),
  comentarios: z.array(ComentarioDoFeedSchema).length(COMENTARIOS_POR_PACOTE),
});

export const ConteudoDoPacoteSchema = ConteudoBaseSchema.superRefine((c, ctx) => {
  for (const message of problemasDoConteudo(c)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});

/** O recorte da aula que o professor pede à IA (one-pager §9a). */
export const RecorteSchema = z.object({
  disciplina: DisciplinaSchema,
  tema: z.string().trim().min(TEMA.min).max(TEMA.max),
  assuntos: z.array(z.string().trim().min(2).max(120)).min(3).max(6),
  contexto: z.string().trim().max(120).optional().nullable(),
});

export const GerarSchema = RecorteSchema.superRefine((r, ctx) => {
  const total = r.assuntos.reduce((s, a) => s + a.length, 0);
  if (total > 600) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Os tópicos somados passam de 600 caracteres." });
});

/** "Homologar Pacote": o pacote INTEIRO como o professor o deixou, mais o recorte. */
export const HomologarSchema = RecorteSchema.extend({
  origem: z.enum(ORIGENS),
  conteudo: ConteudoDoPacoteSchema,
});

export const GateSchema = z.object({ acao: z.enum(["pausar", "liberar_explicar"]) });
export const NovaRodadaSchema = z.object({ rodada: z.number().int().min(1) });
export const ParamsDaTurmaSchema = z.object({ turmaId: z.string().uuid("precisa ser um UUID") });
export const ParamsDoPacoteSchema = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });
/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

// ─────────────────────────────────────────────────────────── saída (estudante)

const AtividadeSchema = z.object({ pacoteId: z.string(), rodada: z.number().int() });

export const EstadoSchema = z.object({
  passo: PassoSchema,
  fase: FaseSchema.nullable(),
  /** O professor congelou as telas para o debate: a tela mostra a espera e as jogadas respondem 409. */
  pausada: z.boolean(),
  preparada: z.boolean(),
  atividade: AtividadeSchema.nullable(),
  conversa: z.object({
    mensagens: z.array(z.object({ papel: z.enum(["estudante", "assistente"]), texto: z.string() })),
    restantes: z.number().int(),
  }),
  previa: z
    .object({
      gerada: z.boolean(),
      paragrafos: z.array(z.object({ id: z.string(), texto: z.string(), corrigido: z.boolean(), removido: z.boolean() })),
    })
    .nullable(),
  /** Só depois da prévia gerada. */
  manchetes: z.array(z.object({ id: MancheteSchema, texto: z.string() })).nullable(),
  publicacao: z
    .object({
      manchete: z.object({ id: MancheteSchema, texto: z.string() }),
      texto: z.string(),
      /** A frase que o algoritmo pinçou para o banner — a virada. */
      trechoPincado: z.string(),
      publicadaEm: z.string(),
    })
    .nullable(),
  feed: z
    .object({
      /** SEM o `tipo`: a categoria de saúde é o gabarito da EM13CO24. */
      comentarios: z.array(z.object({ id: z.string(), autor: z.string(), handle: z.string(), horario: z.string(), texto: z.string() })),
      inspecionados: z.array(z.string()),
      metricas: z.boolean(),
      moderacoes: z.array(z.enum(MODERACOES)),
      privacidade: z.boolean(),
      denuncias: z.array(z.string()),
      ajuda: z.boolean(),
      entrega: z.array(z.object({ faixa: z.string(), percentual: z.number() })),
    })
    .nullable(),
  explicar: z
    .object({
      indicadores: z.array(z.object({ id: z.string(), rotulo: z.string(), confirmado: z.boolean() })),
      /** O último clique NÃO comprovava: a tela mostra a dica (`textos.naoComprova`). */
      ultimoNaoComprova: z.boolean(),
      completo: z.boolean(),
    })
    .nullable(),
  concluido: z.boolean(),
});

export const SessaoSchema = EstadoSchema.extend({
  tema: z.string().nullable(),
  textos: z.object({
    abertura: z.string().nullable(),
    pilulas: z.array(z.string()),
    explicar: z.object({
      titulo: z.string(),
      instrucao: z.string(),
      naoComprova: z.string(),
      citacao: z.string(),
      conceitos: z.array(z.object({ id: z.string(), texto: z.string() })),
      esperaAtiva: z.string(),
    }),
  }),
});

export const GateDoEstudanteSchema = z.object({
  fase: FaseSchema.nullable(),
  passo: PassoSchema,
  pausada: z.boolean(),
  preparada: z.boolean(),
  atividade: AtividadeSchema.nullable(),
  agora: z.string(),
});

// ─────────────────────────────────────────────────────────── saída (professor)

export const PacoteDoProfessorSchema = z.object({
  id: z.string(),
  disciplina: DisciplinaSchema,
  tema: z.string(),
  assuntos: z.array(z.string()),
  contexto: z.string().nullable(),
  origem: z.enum(ORIGENS),
  conteudo: ConteudoBaseSchema,
  aprovadoEm: z.string().nullable(),
  ativo: z.boolean(),
  rodadaAtual: z.number().int(),
});

export const PacoteDaTurmaSchema = z.object({
  turma: z.object({ id: z.string(), nome: z.string(), serie: z.string().nullable() }),
  ativo: PacoteDoProfessorSchema.nullable(),
  rascunho: PacoteDoProfessorSchema.nullable(),
  padrao: z.object({ nome: z.string(), disciplina: DisciplinaSchema, tema: z.string(), assuntos: z.array(z.string()), conteudo: ConteudoBaseSchema }),
  disciplinas: z.array(z.object({ slug: DisciplinaSchema, rotulo: z.string() })),
});

export const GerarRespostaSchema = z.object({
  rascunho: PacoteDoProfessorSchema,
  usouIa: z.boolean(),
  motivo: z.enum(["sem-saldo", "indisponivel"]).nullable(),
});

export const GateDaTurmaSchema = z.object({ fase: FaseSchema, atividade: AtividadeSchema, atualizadoEm: z.string() });
export const NovaRodadaRespostaSchema = z.object({ atividade: AtividadeSchema, fase: FaseSchema });
export const EmAndamentoSchema = z.object({ atividade: AtividadeSchema, fase: FaseSchema, mudou: z.boolean() });

export const PacotesDaTurmaSchema = z.object({
  emAndamento: AtividadeSchema.nullable(),
  historico: z.array(
    z.object({
      id: z.string(),
      disciplina: DisciplinaSchema,
      tema: z.string(),
      origem: z.enum(ORIGENS),
      ativo: z.boolean(),
      aprovadoEm: z.string(),
      rodadas: z.number().int(),
    }),
  ),
});

export const PacoteDetalheSchema = PacoteDoProfessorSchema.extend({ rodadas: z.number().int() });

export const PainelSchema = z.object({
  turma: z.object({ id: z.string(), nome: z.string(), serie: z.string().nullable() }),
  atividade: z.object({ pacoteId: z.string(), rodada: z.number().int(), tema: z.string() }).nullable(),
  fase: FaseSchema.nullable(),
  porComputador: z.boolean(),
  /** A lousa: só AGREGADOS, nenhum nome (one-pager §9). */
  resumo: z.object({
    unidades: z.number().int(),
    publicaram: z.number().int(),
    /** Das publicações, quantas tiveram o pico de entrega entre 01h00 e 03h30: TODAS, por construção. */
    picoNaMadrugada: z.number().int(),
    manchetes: z.object({ neutra: z.number().int(), construtiva: z.number().int(), sensacionalista: z.number().int() }),
    entrega: z.array(z.object({ faixa: z.string(), percentual: z.number() })),
  }),
  linhas: z.array(
    z.object({
      estudanteId: z.string(),
      nome: z.string(),
      equipe: z.object({ id: z.string(), nome: z.string(), membros: z.array(z.object({ id: z.string(), nome: z.string() })) }).nullable(),
      passo: PassoSchema,
      /** A manchete que escolheu: é por ela que o professor chama "chamadas opostas" para ler os comentários. */
      manchete: MancheteSchema.nullable(),
    }),
  ),
  roteiro: z.object({ perguntas: z.array(z.string()), instrucoes: z.object({ pausar: z.string(), liberar: z.string() }) }),
});

export const MaterialSchema = z.object({
  padrao: PacoteDaTurmaSchema.shape.padrao,
  roteiro: PainelSchema.shape.roteiro,
  indicadores: z.array(z.object({ id: z.string(), rotulo: z.string(), comprova: z.boolean() })),
  habilidades: z.array(
    z.object({
      codigo: z.string(),
      rotulo: z.string(),
      criterios: z.object({ atingiu: z.string(), em_processo: z.string(), nao_atingiu: z.string() }),
    }),
  ),
});
