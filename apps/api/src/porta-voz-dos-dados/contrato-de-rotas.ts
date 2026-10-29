import { z } from "zod";
import {
  ASSUNTOS,
  DISCIPLINAS,
  ETAPAS_DO_GATE,
  ITENS_DO_PACOTE,
  MARCOS,
  MENSAGEM_MAX_CARACTERES,
  MORADORES,
  MOTIVOS_DA_PERICIA,
  ORIGENS,
  SERIE_HISTORICA,
  TEMA,
} from "./conteudo";
import { problemasDoConteudo } from "./regras/pacote";
import { problemasDoParecer } from "./regras/pericia";
import { PASSOS } from "./regras/passos";

/**
 * O contrato HTTP da exp03em1b — só schemas Zod. O OpenAPI é derivado daqui
 * (ADR-36), e os vocabulários vêm do catálogo, nunca reescritos.
 *
 * As rotas são as do PRD §12 com o plano aprovado por cima: o `GET sessao`
 * traz o estado do gate (substitui o `GET turmas/:id/gate`, que aceitava
 * turma arbitrária), e TODA rota do estudante devolve a MESMA `SessaoSchema`.
 * A saída do estudante é allowlist: os cartões da perícia descem como peças,
 * sem o gabarito; o feed traz só o ramo da escala que ELE publicou.
 */

const DisciplinaSchema = z.enum(DISCIPLINAS);
const EtapaDoGateSchema = z.enum(ETAPAS_DO_GATE);
const PassoSchema = z.enum(PASSOS);
const MotivoSchema = z.enum(MOTIVOS_DA_PERICIA);
export const EscalaSchema = z.union([z.literal(0), z.literal(80)]);

// ─────────────────────────────────────────────────────────── entrada (estudante)

/** Um marco que a tela informa; o servidor carimba a hora (a primeira vez vale). */
export const MarcoSchema = z.object({ marco: z.enum(MARCOS) });

/** A 1ª publicação e a errata (o mesmo corpo): a escala e as três camadas. */
export const PublicarSchema = z.object({
  escala: EscalaSchema,
  explicacao: z.boolean(),
  fonte: z.boolean(),
  contexto: z.boolean(),
});

/** O parecer da perícia (E6): sinalizou ⇒ motivo; não sinalizou ⇒ sem motivo. */
export const ParecerSchema = z
  .object({
    sinalizouA: z.boolean(),
    motivoA: MotivoSchema.nullable().optional(),
    sinalizouB: z.boolean(),
    motivoB: MotivoSchema.nullable().optional(),
  })
  .transform((p) => ({ sinalizouA: p.sinalizouA, motivoA: p.motivoA ?? null, sinalizouB: p.sinalizouB, motivoB: p.motivoB ?? null }))
  .superRefine((p, ctx) => {
    for (const message of problemasDoParecer(p)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });

// ─────────────────────────────────────────────────────────── o pacote (a forma)

const texto = (max: number, min = 1) => z.string().trim().min(min).max(max);

const FalaDoGrupoSchema = z.object({
  autor: texto(40, 2),
  perfil: texto(60, 2),
  texto: texto(240, 2),
});

/** O conteúdo do pacote — a FORMA; a RÉGUA (`problemasDoConteudo`) entra na homologação e no preparo. */
export const ConteudoBaseSchema = z.object({
  grupo: texto(60, 3),
  servico: z.object({
    orgao: texto(80, 3),
    indicador: texto(100, 3),
    unidade: texto(100, 1),
    abrangencia: texto(140, 3),
    periodicidade: texto(80, 3),
    periodos: z.array(texto(24)).length(SERIE_HISTORICA.length),
    situacoes: z.array(texto(100)).length(SERIE_HISTORICA.length),
  }),
  notaTecnica: z.object({
    arquivo: z.string().trim().regex(/^[\p{L}\p{N}_.-]{3,56}\.pdf$/u, "nome de arquivo .pdf sem espaços"),
    titulo: texto(80, 3),
    orgao: texto(100, 3),
    resumo: texto(400, 20),
    secoes: z.array(z.object({ titulo: texto(80, 3), texto: texto(900, 20) })).min(2).max(5),
  }),
  camadas: z.object({
    explicacao: z.object({ zero: texto(140, 10), oitenta: texto(140, 10) }),
    fonte: texto(140, 10),
    contexto: texto(140, 10),
  }),
  reacoes: z.object({
    zero: z.array(FalaDoGrupoSchema).length(MORADORES),
    oitenta: z.array(FalaDoGrupoSchema).length(MORADORES),
  }),
  posAha: z.object({ conflito: FalaDoGrupoSchema, coordenador: FalaDoGrupoSchema }),
});

/** A forma E a régua: é o que a homologação aceita (e o que a IA tem de entregar). */
export const ConteudoDoPacoteSchema = ConteudoBaseSchema.superRefine((c, ctx) => {
  for (const message of problemasDoConteudo(c)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});

// ─────────────────────────────────────────────────────────── entrada (professor)

/**
 * O recorte da aula que o professor pede à IA (one-pager §9a; PRD API-002):
 * o componente, o tema, de 3 a 6 assuntos e o território opcional (o bairro).
 * Os assuntos somados passam por `problemasDoRecorte` (até 600 caracteres).
 */
export const RequisicaoGerarRecorteSchema = z.object({
  disciplina: DisciplinaSchema,
  tema: z.string().trim().min(TEMA.min).max(TEMA.max),
  assuntos: z.array(z.string().trim().min(2).max(ASSUNTOS.caracteres)).min(ASSUNTOS.min).max(ASSUNTOS.max),
  contexto: z.string().trim().max(120).optional().nullable(),
});

export function problemasDoRecorte(r: z.infer<typeof RequisicaoGerarRecorteSchema>): string[] {
  const total = r.assuntos.reduce((s, a) => s + a.length, 0);
  return total > ASSUNTOS.total ? [`Os assuntos somados passam de ${ASSUNTOS.total} caracteres.`] : [];
}

/** "Regenerar Item" (a curadoria): UM item do rascunho, de novo pela IA. */
export const RequisicaoRegenerarItemSchema = z.object({ item: z.enum(ITENS_DO_PACOTE) });

/**
 * "Homologar Pacote de Conteúdo" (API-004) — SÓ aprova: não põe no ar. O
 * `conteudo` é opcional: com ele, a edição inline do professor entra junto (a
 * régua inteira volta em `erros`); sem ele, aprova o rascunho como está.
 */
export const RequisicaoHomologarSchema = z.object({ conteudo: ConteudoBaseSchema.optional() });

/** "Liberar Atividade para a Turma" (API-004b): o pacote homologado que a turma usa. */
export const RequisicaoEmAndamentoSchema = z.object({ pacoteId: z.string().uuid("precisa ser um UUID") });

/** O gate da turma: só para a frente (`exploracao → pausa → liberada`). */
export const RequisicaoGateSchema = z.object({ etapa: z.enum(["pausa", "liberada"]) });

/** "Zerar Turma": a rodada que o professor VIU. */
export const RequisicaoZerarSchema = z.object({ rodada: z.number().int().min(1) });

export const ParamsDaTurmaSchema = z.object({ turmaId: z.string().uuid("precisa ser um UUID") });
export const ParamsDoPacoteSchema = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });
/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

// ─────────────────────────────────────────────────────────── saída (estudante)

const AtividadeSchema = z.object({ pacoteId: z.string(), rodada: z.number().int() });

export const PublicacaoSchema = PublicarSchema.extend({ publicadaEm: z.string() });

const FalaSchema = z.object({ autor: z.string(), perfil: z.string(), texto: z.string() });
const EixoSchema = z.object({ origem: z.number(), teto: z.number() });

export const SessaoSchema = z.object({
  /** Há pacote no ar na turma? Sem ele, a tela é de espera. */
  preparada: z.boolean(),
  atividade: AtividadeSchema.nullable(),
  /** O gate da turma (`exploracao | pausa | liberada`); `null` sem pacote no ar. */
  etapaDaTurma: EtapaDoGateSchema.nullable(),
  passo: PassoSchema,
  /** O professor congelou as telas para o debate: as jogadas respondem 409 `telas-pausadas`. */
  pausada: z.boolean(),
  /** A cota: 3 → 2 (1ª publicação) → 1 (errata). Não há 3ª publicação no V1. */
  slotsRestantes: z.number().int().min(1).max(3),
  marcos: z.object({
    chatAberto: z.boolean(),
    anexoAberto: z.boolean(),
    nudgeE2: z.boolean(),
    compositorAberto: z.boolean(),
    periciaAberta: z.boolean(),
  }),
  publicacoes: z.object({
    inicial: PublicacaoSchema.nullable(),
    errata: PublicacaoSchema.nullable(),
    errataPulada: z.boolean(),
  }),
  /** Publicou, a turma está `liberada` e a errata não foi decidida: a oferta do 2º slot (TC-18). */
  errataLiberada: z.boolean(),
  /** O grupo depois da 1ª publicação: as reações do ramo da escala PUBLICADA, o post espelho e o Aha. */
  feed: z
    .object({
      reacoes: z.array(FalaSchema),
      rival: z.object({ escola: z.string(), escala: EscalaSchema, chip: z.string() }),
      conflito: FalaSchema,
      coordenador: FalaSchema,
    })
    .nullable(),
  /** O parecer, depois de decidido. Sem gabarito: o servidor não diz se acertou. */
  pericia: z
    .object({
      pulou: z.boolean(),
      sinalizouA: z.boolean(),
      motivoA: MotivoSchema.nullable(),
      sinalizouB: z.boolean(),
      motivoB: MotivoSchema.nullable(),
      decididaEm: z.string(),
    })
    .nullable(),
  concluido: z.boolean(),
  /** A roupagem do pacote com os números FIXOS do servidor. `null` sem pacote no ar. */
  conteudo: z
    .object({
      grupo: z.object({ nome: z.string(), recorte: z.string() }),
      servico: z.object({
        orgao: z.string(),
        indicador: z.string(),
        unidade: z.string(),
        abrangencia: z.string(),
        periodicidade: z.string(),
        serie: z.array(
          z.object({ periodo: z.string(), valor: z.number(), coletadas: z.number(), conformes: z.number(), inconformes: z.number(), situacao: z.string() }),
        ),
      }),
      notaTecnica: z.object({
        arquivo: z.string(),
        titulo: z.string(),
        orgao: z.string(),
        resumo: z.string(),
        secoes: z.array(z.object({ titulo: z.string(), texto: z.string() })),
      }),
      camadas: z.object({ explicacao: z.object({ zero: z.string(), oitenta: z.string() }), fonte: z.string(), contexto: z.string() }),
    })
    .nullable(),
  /** Os textos FIXOS da missão: o bot, o laudo, a perícia (sem gabarito), a conclusão. */
  textos: z.object({
    chat: z.object({
      bot: z.string(),
      previaDoBot: z.string(),
      statusDoGrupo: z.string(),
      posse: z.string(),
      iniciar: z.string(),
      nudgeE1: z.string(),
      introDaTabela: z.string(),
      perguntaDaPrevia: z.string(),
      nudgeE2: z.string(),
      escalas: z.object({ zero: z.string(), oitenta: z.string() }),
      errata: z.string(),
      publicarErrata: z.string(),
      pularErrata: z.string(),
      cotaEsgotada: z.string(),
      foraDoTema: z.string(),
      pausa: z.string(),
    }),
    laudo: z.object({
      titulo: z.string(),
      desmontagem: z.string(),
      fatorDeMentira: z.string(),
      fator: z.string(),
      variacaoVisual: z.string(),
      variacaoReal: z.string(),
      quedaEmPontos: z.number(),
      alturas: z.object({
        origem0: z.object({ primeiro: z.number(), ultimo: z.number() }),
        origem80: z.object({ primeiro: z.number(), ultimo: z.number() }),
      }),
      regua: z.object({ instrucao: z.string(), minimo: z.string(), maximo: z.string() }),
      acao: z.string(),
    }),
    pericia: z.object({
      canal: z.string(),
      chamado: z.string(),
      dados: z.object({
        titulo: z.string(),
        origem: z.string(),
        indicador: z.string(),
        periodos: z.array(z.object({ rotulo: z.string(), ocorrencias: z.number(), populacao: z.string(), taxa: z.number() })),
      }),
      cartoes: z.array(
        z.object({ id: z.enum(["A", "B"]), titulo: z.string(), partido: z.string(), tituloDoGrafico: z.string(), eixo: EixoSchema, fonte: z.string() }),
      ),
      sinalizar: z.string(),
      motivoTitulo: z.string(),
      motivos: z.object({ escala: z.string(), fonte: z.string(), titulo: z.string() }),
      emitir: z.string(),
      pular: z.string(),
    }),
    conclusao: z.object({ selo: z.string(), somenteLeitura: z.string() }),
  }),
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
  /** `null` = rascunho (ainda na curadoria). */
  aprovadoEm: z.string().nullable(),
  ativo: z.boolean(),
  rodadaAtual: z.number().int(),
  criadoEm: z.string(),
});

const PadraoSchema = z.object({ nome: z.string(), disciplina: DisciplinaSchema, tema: z.string(), assuntos: z.array(z.string()), conteudo: ConteudoBaseSchema });

/** API-001: os pacotes da turma — o rascunho (no máximo um) e os homologados —, o banco padrão e os componentes. */
export const RespostaListarPacotesSchema = z.object({
  turma: z.object({ id: z.string(), nome: z.string(), serie: z.string().nullable() }),
  emAndamento: AtividadeSchema.nullable(),
  pacotes: z.array(
    z.object({
      id: z.string(),
      turmaId: z.string(),
      origem: z.enum(ORIGENS),
      disciplina: DisciplinaSchema,
      tema: z.string(),
      ativo: z.boolean(),
      aprovadoEm: z.string().nullable(),
      criadoEm: z.string(),
      rodadas: z.number().int(),
    }),
  ),
  padrao: PadraoSchema,
  disciplinas: z.array(z.object({ slug: DisciplinaSchema, rotulo: z.string() })),
});

export const RespostaPacoteSchema = PacoteDoProfessorSchema.extend({ rodadas: z.number().int() });

/** API-002 e o "Regenerar Item": o rascunho gravado, e se a IA escreveu (sem ela, o banco curado). */
export const RespostaGerarConteudoSchema = z.object({
  pacote: PacoteDoProfessorSchema,
  usouIa: z.boolean(),
  motivo: z.enum(["sem-saldo", "indisponivel"]).nullable(),
});

/** API-004: o pacote homologado (não está no ar: isso é o `em-andamento`). */
export const RespostaHomologarPacoteSchema = z.object({
  pacoteId: z.string(),
  homologadoEm: z.string(),
  pacote: PacoteDoProfessorSchema,
});

export const RespostaEmAndamentoSchema = z.object({ atividade: AtividadeSchema, etapa: EtapaDoGateSchema, mudou: z.boolean() });
export const RespostaGateSchema = z.object({ etapa: EtapaDoGateSchema, atividade: AtividadeSchema, atualizadoEm: z.string() });
export const RespostaZerarSchema = z.object({ atividade: AtividadeSchema, etapa: EtapaDoGateSchema });

const ContagemSchema = z.number().int().min(0);

export const RespostaPainelSchema = z.object({
  turma: z.object({ id: z.string(), nome: z.string(), serie: z.string().nullable() }),
  atividade: z.object({ pacoteId: z.string(), rodada: z.number().int(), tema: z.string(), grupo: z.string() }).nullable(),
  etapa: EtapaDoGateSchema.nullable(),
  /** A lousa: só CONTAGENS — sem ranking, sem nível, sem nota individual. */
  resumo: z.object({
    estudantes: ContagemSchema,
    entraram: ContagemSchema,
    porPasso: z.record(PassoSchema, ContagemSchema),
    /** Quem está com a tela congelada agora (gate em `pausa`, sessão aberta e não concluída). */
    pausados: ContagemSchema,
    /** A escala da 1ª publicação. */
    primeiraPublicacao: z.object({ escala0: ContagemSchema, escala80: ContagemSchema }),
    abriramAnexo: ContagemSchema,
    errata: z.object({ publicaram: ContagemSchema, pularam: ContagemSchema }),
    pericia: z.object({ emitiram: ContagemSchema, pularam: ContagemSchema }),
  }),
  /** O ritmo, nominal: só o passo e o tempo parado — nunca a escala, a camada nem o parecer de alguém. */
  linhas: z.array(z.object({ estudanteId: z.string(), nome: z.string(), passo: PassoSchema, segundosInativo: z.number().int().nullable() })),
  roteiro: z.object({ perguntas: z.array(z.string()), instrucoes: z.object({ pausar: z.string(), liberar: z.string() }) }),
});

/** API-005: o material do guia — o banco padrão, o roteiro, a perícia COM o gabarito e as réguas. */
export const RespostaMaterialProfessorSchema = z.object({
  missaoId: z.literal("exp03em1b"),
  titulo: z.string(),
  padrao: PadraoSchema,
  roteiro: RespostaPainelSchema.shape.roteiro,
  serie: z.array(z.object({ valor: z.number(), coletadas: z.number(), conformes: z.number(), inconformes: z.number() })),
  laudo: z.object({ fator: z.string(), variacaoVisual: z.string(), variacaoReal: z.string(), desmontagem: z.string(), fatorDeMentira: z.string() }),
  pericia: z.object({ cartaoDistorcido: z.enum(["A", "B"]), motivo: MotivoSchema, cartoes: SessaoSchema.shape.textos.shape.pericia.shape.cartoes }),
  habilidades: z.array(
    z.object({
      codigo: z.string(),
      rotulo: z.string(),
      criterios: z.object({ atingiu: z.string(), em_processo: z.string(), nao_atingiu: z.string() }),
    }),
  ),
});

/** O teto de cada mensagem simulada, exportado para o hub mostrar o contador. */
export const LIMITES_DO_PACOTE = { mensagem: MENSAGEM_MAX_CARACTERES } as const;
