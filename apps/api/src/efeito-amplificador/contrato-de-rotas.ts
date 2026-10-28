import { z } from "zod";
import {
  CHAVES_DAS_REACOES,
  COMENTARIOS_POR_PACOTE,
  DESTINOS_DO_RELATO,
  DISCIPLINAS,
  FASES,
  IDS_DOS_INDICADORES,
  MANCHETE_MAX_CARACTERES,
  MANCHETES,
  MAX_CARACTERES_DA_MENSAGEM,
  MOTIVOS_DO_AVISO,
  NOS,
  ORIGENS,
  PARAGRAFOS,
  PAUTA,
  TEMA,
  TIPOS_DE_COMENTARIO,
} from "./conteudo";
import { HABILIDADES_DA_DEVOLUTIVA, ORIGENS_DA_DEVOLUTIVA } from "./regras/devolutiva";
import { problemasDoConteudo } from "./regras/pacote";
import { ETAPAS, PASSOS } from "./regras/passos";

/**
 * O contrato HTTP da exp02em1b — só schemas Zod. O OpenAPI é derivado daqui
 * (ADR-36), e os vocabulários vêm do catálogo, nunca reescritos.
 *
 * As rotas são as do PRD 2.1.0 §12 (ADR-191). A saída do ESTUDANTE é
 * allowlist: o comentário desce sem `tipo` (a categoria de saúde é o gabarito
 * da EM13CO24) e o parágrafo sem o nó. Quem diz se um gesto mediu alguma coisa
 * é o servidor.
 */

const DisciplinaSchema = z.enum(DISCIPLINAS);
const FaseSchema = z.enum(FASES);
const PassoSchema = z.enum(PASSOS);
const EtapaSchema = z.enum(ETAPAS);
const MancheteSchema = z.enum(MANCHETES);
const ParagrafoIdSchema = z.string().regex(/^p[1-6]$/, "id de parágrafo p1 a p6");
const ComentarioIdSchema = z.string().regex(/^c[1-9]$/, "id de comentário c1 a c9");

// ─────────────────────────────────────────────────────────── entrada (estudante)

/** Uma mensagem no chat do UnooriaAI (API-003). O texto é de menor: fica na sessão, nunca no painel nem na telemetria. */
export const MensagemSchema = z.object({ texto: z.string().trim().min(1).max(MAX_CARACTERES_DA_MENSAGEM) });

/** Os dois botões da gaveta da prévia: "Aprovar Prévia" e "Solicitar revisão". */
export const PreviaSchema = z.object({ acao: z.enum(["aprovar", "revisar"]) });

/** O LATCH 1 (API-004): a manchete escolhida no "Publicar no Unoovista". */
export const PublicarSchema = z.object({ manchete: MancheteSchema });

/** "Fixar aviso de cuidado" com o motivo (API-005, EM13CO24). */
export const AvisoDeCuidadoSchema = z.object({ motivo: z.enum(MOTIVOS_DO_AVISO) });

/** As ações de proteção (API-006, EM13CO08): as chaves da Configuração da Publicação e a Central de Apoio. */
export const SegurancaSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("conta_privada"), ligado: z.boolean() }),
  z.object({ acao: z.literal("restringir_comentarios"), ligado: z.boolean() }),
  z.object({ acao: z.literal("abrir_central") }),
  z.object({ acao: z.literal("denunciar_perfil") }),
  z.object({ acao: z.literal("encaminhar_apoio"), comentarioId: ComentarioIdSchema, destino: z.enum(DESTINOS_DO_RELATO) }),
]);

/** Um indicador apontado nos bastidores (Etapa 5, EVT-005). */
export const EvidenciaSchema = z.object({ elemento: z.string().refine((i) => IDS_DOS_INDICADORES.includes(i), "indicador desconhecido") });

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
  autor: z.string().trim().min(2).max(40),
  horario: z.string().regex(/^0[1-3]h[0-5]\d$/, "horário no formato 02h40, de madrugada"),
  tipo: z.enum(TIPOS_DE_COMENTARIO),
  /* 300 na FORMA (a 2.0.x aceitava 300 e o pacote antigo tem de continuar legível); a régua cobra os 280 do PRD. */
  texto: z.string().trim().min(5).max(300),
});

export const PautaSchema = z.object({
  titulo: texto(PAUTA.titulo),
  descricao: texto(PAUTA.descricao),
  orientacoes: z.array(texto(PAUTA.orientacao)).min(PAUTA.orientacoes.min).max(PAUTA.orientacoes.max),
});

/** O conteúdo do pacote — a forma; a RÉGUA (`problemasDoConteudo`) entra no `superRefine`. */
export const ConteudoBaseSchema = z.object({
  pauta: PautaSchema,
  rascunho: z.array(ParagrafoDoRascunhoSchema).min(PARAGRAFOS.min).max(PARAGRAFOS.max),
  fonteInventada: texto(60),
  colega: texto(80),
  fonteOriginal: texto(100),
  recorte: texto(160),
  manchetes: z.object({
    neutra: texto(MANCHETE_MAX_CARACTERES),
    construtiva: texto(MANCHETE_MAX_CARACTERES),
    sensacionalista: texto(MANCHETE_MAX_CARACTERES),
  }),
  comentarios: z.array(ComentarioDoFeedSchema).length(COMENTARIOS_POR_PACOTE),
  /** As reações ao post do estudante, por variante e por comentário (ADR-192). A régua está em `regras/reacoes.ts`. */
  reacoes: z
    .record(z.enum(CHAVES_DAS_REACOES as [string, ...string[]]), z.record(ComentarioIdSchema, z.string().trim().min(5).max(300)))
    .optional(),
});

export const ConteudoDoPacoteSchema = ConteudoBaseSchema.superRefine((c, ctx) => {
  for (const message of problemasDoConteudo(c)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});

/** O recorte da aula que o professor pede à IA (one-pager §9a; PRD API-015). */
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

/** "Homologar Conteúdo" (API-016): o pacote INTEIRO como o professor o deixou, mais o recorte. */
export const HomologarSchema = RecorteSchema.extend({
  origem: z.enum(ORIGENS),
  conteudo: ConteudoDoPacoteSchema,
});

/** O gate da turma (API-010): só para a frente. */
export const GateSchema = z.object({ etapa: z.enum(["pausa", "explicar"]) });
export const NovaRodadaSchema = z.object({ rodada: z.number().int().min(1) });
export const ParamsDaTurmaSchema = z.object({ turmaId: z.string().uuid("precisa ser um UUID") });
export const ParamsDoPacoteSchema = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });
/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

// ─────────────────────────────────────────────────────────── saída (estudante)

const AtividadeSchema = z.object({ pacoteId: z.string(), rodada: z.number().int() });

export const EstadoSchema = z.object({
  passo: PassoSchema,
  /** O nome do estado no contrato do PRD (§6). */
  etapa: EtapaSchema,
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
      aprovada: z.boolean(),
      paragrafos: z.array(z.object({ id: z.string(), texto: z.string(), corrigido: z.boolean() })),
      /** Os avisos da gaveta (copy `e2.feedback.aviso_*`): cada nó ainda não corrigido. */
      pendencias: z.object({ fonte: z.boolean(), autoria: z.boolean(), privacidade: z.boolean() }),
    })
    .nullable(),
  /** Só depois da prévia gerada. */
  manchetes: z.array(z.object({ id: MancheteSchema, texto: z.string() })).nullable(),
  publicacao: z
    .object({
      manchete: z.object({ id: MancheteSchema, texto: z.string() }),
      texto: z.string(),
      /** A frase que o algoritmo pinçou para o feed — a virada. */
      trechoPincado: z.string(),
      publicadaEm: z.string(),
    })
    .nullable(),
  feed: z
    .object({
      /** SEM o `tipo`: a categoria de saúde é o gabarito da EM13CO24. */
      comentarios: z.array(z.object({ id: z.string(), autor: z.string(), horario: z.string(), texto: z.string() })),
      /** O perfil que "Denunciar perfil" denuncia (só o nome e o comentário dele). */
      perfilSuspeito: z.object({ comentarioId: z.string(), autor: z.string(), horario: z.string() }).nullable(),
      aviso: z.enum(MOTIVOS_DO_AVISO).nullable(),
      contaPrivada: z.boolean(),
      restringirComentarios: z.boolean(),
      denunciou: z.boolean(),
      relatos: z.array(z.object({ comentarioId: z.string(), destino: z.enum(DESTINOS_DO_RELATO) })),
      metrica: z.string(),
      /** O TC-10, com o tema do professor no `destaque` — desenhado pelo hub, FORA do aparelho. */
      instrucao: z.object({ antes: z.string(), destaque: z.string(), depois: z.string() }),
    })
    .nullable(),
  explicar: z
    .object({
      indicadores: z.array(z.object({ id: z.string(), rotulo: z.string(), texto: z.string(), apontado: z.boolean() })),
      entrega: z.array(z.object({ faixa: z.string(), impressoes: z.number(), minutos: z.number() })),
    })
    .nullable(),
  concluido: z.boolean(),
});

export const SessaoSchema = EstadoSchema.extend({
  tema: z.string().nullable(),
  textos: z.object({
    pauta: z.object({ titulo: z.string(), descricao: z.string(), orientacoes: z.array(z.string()) }).nullable(),
    boasVindas: z.string(),
    sugestoes: z.array(z.string()),
    explicar: z.object({
      titulo: z.string(),
      instrucao: z.string(),
      citacao: z.string(),
      conceitos: z.array(z.object({ id: z.string(), titulo: z.string(), texto: z.string() })),
      esperaAtiva: z.string(),
    }),
    /* Sem a transcrição do podcast desde a 2.3.1: o episódio é tocado em aula, e a transcrição é só do professor. */
  }),
});

export const GateDoEstudanteSchema = z.object({
  fase: FaseSchema.nullable(),
  passo: PassoSchema,
  etapa: EtapaSchema,
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

export const GateDaTurmaSchema = z.object({ etapa: FaseSchema, atividade: AtividadeSchema, atualizadoEm: z.string() });
export const NovaRodadaRespostaSchema = z.object({ atividade: AtividadeSchema, etapa: FaseSchema });
export const EmAndamentoSchema = z.object({ atividade: AtividadeSchema, etapa: FaseSchema, mudou: z.boolean() });

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

const ContagemDeNiveisSchema = z.object({ atingiu: z.number().int(), em_processo: z.number().int(), nao_atingiu: z.number().int() });

export const PainelSchema = z.object({
  turma: z.object({ id: z.string(), nome: z.string(), serie: z.string().nullable() }),
  atividade: z.object({ pacoteId: z.string(), rodada: z.number().int(), tema: z.string() }).nullable(),
  etapa: FaseSchema.nullable(),
  porComputador: z.boolean(),
  /** A lousa: só AGREGADOS, nenhum nome (one-pager §9). Os quatro cartões do E4-PROF-01. */
  resumo: z.object({
    unidades: z.number().int(),
    publicaram: z.number().int(),
    /** Balanço Editorial da Turma. */
    manchetes: z.object({ neutra: z.number().int(), construtiva: z.number().int(), sensacionalista: z.number().int() }),
    /** Distribuição Horária Coletiva: a MESMA curva para todo post, e o percentual noturno das publicações (100%). */
    entrega: z.array(z.object({ faixa: z.string(), impressoes: z.number() })),
    percentualNoturno: z.number().int(),
    /** Matriz Consolidada de Evidências: quantos em cada nível, por habilidade. */
    matriz: z.object({ EM13CO24: ContagemDeNiveisSchema, EM13CO14: ContagemDeNiveisSchema, EM13CO26: ContagemDeNiveisSchema, EM13CO08: ContagemDeNiveisSchema }),
  }),
  /** Monitor de Ritmo e Inatividade (nominal, só o passo — nunca o nível nem o chat). */
  linhas: z.array(
    z.object({
      estudanteId: z.string(),
      nome: z.string(),
      equipe: z.object({ id: z.string(), nome: z.string(), membros: z.array(z.object({ id: z.string(), nome: z.string() })) }).nullable(),
      passo: PassoSchema,
      /** A manchete que escolheu: é por ela que o professor chama "chamadas opostas" para ler os comentários. */
      manchete: MancheteSchema.nullable(),
      /** Segundos desde a última jogada (`null` antes de entrar). */
      segundosInativo: z.number().int().nullable(),
    }),
  ),
  roteiro: z.object({ perguntas: z.array(z.string()), instrucoes: z.object({ pausar: z.string(), liberar: z.string() }) }),
});

export const MaterialSchema = z.object({
  padrao: PacoteDaTurmaSchema.shape.padrao,
  roteiro: PainelSchema.shape.roteiro,
  indicadores: z.array(z.object({ id: z.string(), rotulo: z.string(), texto: z.string() })),
  habilidades: z.array(
    z.object({
      codigo: z.string(),
      rotulo: z.string(),
      criterios: z.object({ atingiu: z.string(), em_processo: z.string(), nao_atingiu: z.string() }),
    }),
  ),
});

// ─────────────────────────────────────────────────────────── a devolutiva (ADR-192)

const HabilidadeDaDevolutivaSchema = z.enum(HABILIDADES_DA_DEVOLUTIVA);
const TextosDaDevolutivaSchema = z.record(HabilidadeDaDevolutivaSchema, z.string());

/** A devolutiva da conclusão, para o estudante: um parágrafo por habilidade, sem nível. */
export const DevolutivaSchema = z.object({
  devolutiva: z.object({
    origem: z.enum(ORIGENS_DA_DEVOLUTIVA),
    habilidades: TextosDaDevolutivaSchema,
    geradaEm: z.string(),
  }),
  titulos: TextosDaDevolutivaSchema,
});

/** As devolutivas de uma atividade, para a aba Habilidades do professor. */
export const DevolutivasDaAtividadeSchema = z.object({
  habilidades: z.array(HabilidadeDaDevolutivaSchema),
  titulos: TextosDaDevolutivaSchema,
  devolutivas: z.array(
    z.object({
      estudanteId: z.string(),
      nome: z.string(),
      equipe: z.string().nullable(),
      rodada: z.number().int(),
      concluidoEm: z.string().nullable(),
      origem: z.enum(ORIGENS_DA_DEVOLUTIVA),
      habilidades: TextosDaDevolutivaSchema,
    }),
  ),
});
