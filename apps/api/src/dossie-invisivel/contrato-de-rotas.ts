import { z } from "zod";
import {
  ANCORAS,
  ASSUNTOS,
  BLOCOS,
  CAMINHOS,
  CHAT,
  CRITERIOS,
  DISCIPLINAS,
  ETAPAS_DO_GATE,
  ITENS_DO_PACOTE,
  ORIGENS,
  PILULAS,
  PROJETOS,
  SLOTS_DO_PROTOCOLO,
  TEMA,
} from "./conteudo";
import { problemasDoProtocolo } from "./regras/evidencia";
import { problemasDoConteudo } from "./regras/pacote";
import { PASSOS } from "./regras/passos";

/**
 * O contrato HTTP da exp09ef1b — só schemas Zod. O OpenAPI é derivado daqui
 * (ADR-36), e os vocabulários vêm do catálogo, nunca reescritos.
 *
 * As rotas seguem o molde da plataforma (correção do PO de 29/10: "no
 * singular, como a plataforma"): `GET sessao` é o estado e o polling, e TODA
 * rota do estudante devolve a MESMA `SessaoSchema`. A saída do estudante é
 * allowlist: os cadernos só descem depois de digitalizados, o protocolo desce
 * sem o gabarito e a fala de Amara já vem montada.
 */

const DisciplinaSchema = z.enum(DISCIPLINAS);
const EtapaDoGateSchema = z.enum(ETAPAS_DO_GATE);
const PassoSchema = z.enum(PASSOS);
const ProjetoIdSchema = z.enum(PROJETOS);
const CriterioSchema = z.enum(CRITERIOS);
const BlocoSchema = z.enum(BLOCOS);
const PilulaSchema = z.enum(PILULAS);
const AncoraSchema = z.enum(ANCORAS);
const CaminhoSchema = z.enum(CAMINHOS);

/** Os três critérios, cada um uma vez, na ordem de prioridade do estudante. */
export const RankingSchema = z
  .array(CriterioSchema)
  .length(CRITERIOS.length)
  .refine((r) => new Set(r).size === r.length, "cada critério entra uma vez");

// ─────────────────────────────────────────────────────────── entrada (estudante)

export const MensagemSchema = z.object({ texto: z.string().trim().min(1).max(CHAT.caracteres) });

/** "Registrar Decisão" (latch 1) e "Confirmar Decisão Final" (latch 2): o projeto e o ranking. */
export const DecisaoSchema = z.object({ projeto: ProjetoIdSchema, ranking: RankingSchema });

export const PilulaEntradaSchema = z.object({ pilula: PilulaSchema });

/** As âncoras marcadas na E5 (de zero a três, sem repetir). Não é evidência. */
export const AncorasSchema = z.object({ ancoras: z.array(AncoraSchema).max(ANCORAS.length).refine((a) => new Set(a).size === a.length, "sem repetir") });

/** "Enviar Proposta": as três verificações (vazias = `null`) e o descarte. Sem trava no cliente; a régua é do servidor. */
export const ProtocoloSchema = z
  .object({
    slots: z.array(BlocoSchema.nullable()).length(SLOTS_DO_PROTOCOLO),
    descarte: z.array(BlocoSchema).max(BLOCOS.length),
  })
  .superRefine((p, ctx) => {
    for (const message of problemasDoProtocolo(p)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  });

// ─────────────────────────────────────────────────────────── o pacote (a forma)

const texto = (max: number, min = 1) => z.string().trim().min(min).max(max);

const DocumentoSchema = z.object({
  arquivo: z.string().trim().regex(/^[\p{L}\p{N}_.-]{3,60}\.(pdf|dat)$/u, "nome de arquivo .pdf sem espaços"),
  resumo: texto(180, 10),
});

const ProjetoSchema = z.object({
  nome: texto(40, 3),
  coordenador: texto(30, 2),
  idade: z.number().int().min(13).max(16),
  vagas: z.number().int().min(10).max(50),
  custoPorVaga: z.number().int().min(100).max(2_000),
  card: texto(120, 10),
  area: texto(80, 3),
  impacto: texto(140, 5),
  documentos: z.array(DocumentoSchema).min(1).max(12),
});

/** O conteúdo do pacote — a FORMA; a RÉGUA (`problemasDoConteudo`) entra na homologação e no preparo. */
export const ConteudoBaseSchema = z.object({
  projetos: z.object({ papel: ProjetoSchema, parcial: ProjetoSchema, nuvem: ProjetoSchema }),
  cadernos: z.object({
    arquivo: z.string().trim().regex(/^[\p{L}\p{N}_.-]{3,60}\.dat$/u, "nome de arquivo .dat sem espaços"),
    amostras: z.array(texto(200, 10)).min(1).max(3),
    resumo: texto(240, 10),
  }),
});

/** A forma E a régua: é o que a homologação aceita (e o que a IA tem de entregar). */
export const ConteudoDoPacoteSchema = ConteudoBaseSchema.superRefine((c, ctx) => {
  for (const message of problemasDoConteudo(c)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});

// ─────────────────────────────────────────────────────────── entrada (professor)

/** O recorte da aula que o professor pede à IA (one-pager §9a): o componente, o tema, de 3 a 6 assuntos e o contexto opcional. */
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

export const RequisicaoRegenerarItemSchema = z.object({ item: z.enum(ITENS_DO_PACOTE) });
export const RequisicaoHomologarSchema = z.object({ conteudo: ConteudoBaseSchema.optional() });
export const RequisicaoEmAndamentoSchema = z.object({ pacoteId: z.string().uuid("precisa ser um UUID") });
/** As três travas, só para a frente: `revelacao`, `revoto` (depois do debate) e `explicar`. */
export const RequisicaoGateSchema = z.object({ etapa: z.enum(["revelacao", "revoto", "explicar"]) });
export const RequisicaoZerarSchema = z.object({ rodada: z.number().int().min(1) });

export const ParamsDaTurmaSchema = z.object({ turmaId: z.string().uuid("precisa ser um UUID") });
export const ParamsDoPacoteSchema = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });
/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

// ─────────────────────────────────────────────────────────── saída (estudante)

const AtividadeSchema = z.object({ pacoteId: z.string(), rodada: z.number().int() });

const MensagemDaThreadSchema = z.object({
  id: z.string(),
  autor: z.enum(["estudante", "assistente", "sistema"]),
  texto: z.string(),
  /** A mensagem que pode ser marcada na E5. */
  ancora: AncoraSchema.nullable(),
  /** Os arquivos citados (o chip abre os metadados do documento). */
  anexos: z.array(z.string()),
});

const DecisaoGravadaSchema = z.object({ projeto: ProjetoIdSchema, ranking: z.array(CriterioSchema), em: z.string() });

const LinhaDaTabelaSchema = z.object({
  projeto: ProjetoIdSchema,
  nome: z.string(),
  rotulo: z.string(),
  documentos: z.string(),
  vagas: z.string(),
  custo: z.string(),
});

export const SessaoSchema = z.object({
  preparada: z.boolean(),
  atividade: AtividadeSchema.nullable(),
  etapaDaTurma: EtapaDoGateSchema.nullable(),
  passo: PassoSchema,
  /** A trava do debate abriu: os botões "Manter Decisão Original" / "Revisar Decisão" aparecem. */
  revotoAberto: z.boolean(),
  chat: z.object({
    mensagens: z.array(MensagemDaThreadSchema),
    /** As consultas que contaram (fora do tema não conta). */
    consultas: z.number().int(),
    /** A 3ª consulta ou o "Ver Projetos": "Escolher Projeto" habilitado. */
    podeEscolher: z.boolean(),
    /** A 5ª mensagem: o composer trava. */
    limiteAtingido: z.boolean(),
    /** As sugestões somem na primeira mensagem (ou no "Começar Análise" seguido de envio). */
    sugestoesVisiveis: z.boolean(),
    cadernosOferecidos: z.boolean(),
    cadernosDigitalizados: z.boolean(),
  }),
  /** A ordem inicial dos critérios (embaralhada por sessão) — a E3 nasce nela. */
  ordemDosCriterios: z.array(CriterioSchema),
  decisao: DecisaoGravadaSchema.nullable(),
  /** O caminho da investigação, depois de registrada a escolha. */
  caminho: CaminhoSchema.nullable(),
  /** A E4: a tabela de confronto e as pílulas, depois dos cadernos digitalizados e da revelação liberada. */
  revelacao: z
    .object({
      comparado: ProjetoIdSchema,
      /** A simulação contrafactual do caminho A1 (os cadernos já entraram antes da escolha). */
      contrafactual: z.string().nullable(),
      /** Vazia até os cadernos serem digitalizados (B e A2 digitalizam na E4). */
      tabela: z.array(LinhaDaTabelaSchema),
      constatacao: z.string(),
      pilulas: z.array(PilulaSchema),
    })
    .nullable(),
  revoto: DecisaoGravadaSchema.extend({ manteve: z.boolean() }).nullable(),
  /** A E5: a fala de Amara (montada com o voto) e as âncoras marcadas. */
  explicar: z.object({ falaDeAmara: z.string(), ancoras: z.array(AncoraSchema) }).nullable(),
  protocolo: z
    .object({
      /** A ordem do banco de blocos (embaralhada por sessão). */
      banco: z.array(BlocoSchema),
      enviado: z.object({ slots: z.array(BlocoSchema.nullable()), descarte: z.array(BlocoSchema), em: z.string() }).nullable(),
    })
    .nullable(),
  concluido: z.boolean(),
  conteudo: z
    .object({
      projetos: z.array(
        z.object({
          id: ProjetoIdSchema,
          nome: z.string(),
          coordenador: z.string(),
          idade: z.number(),
          vagas: z.number(),
          custoPorVaga: z.number(),
          card: z.string(),
          area: z.string(),
          documentos: z.array(z.object({ arquivo: z.string(), resumo: z.string() })),
        }),
      ),
      /** Os cadernos só descem depois de digitalizados. */
      cadernos: z.object({ arquivo: z.string(), amostras: z.array(z.string()), resumo: z.string() }).nullable(),
    })
    .nullable(),
  textos: z.object({
    tela: z.record(z.string(), z.string()),
    amara: z.string(),
    conceitos: z.array(z.object({ termo: z.string(), definicao: z.string() })),
    conceitosResumo: z.string(),
    sugestoes: z.array(z.string()),
    criterios: z.record(CriterioSchema, z.string()),
    blocos: z.record(BlocoSchema, z.string()),
    pilulas: z.record(PilulaSchema, z.string()),
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
  aprovadoEm: z.string().nullable(),
  ativo: z.boolean(),
  rodadaAtual: z.number().int(),
  criadoEm: z.string(),
});

const PadraoSchema = z.object({ nome: z.string(), disciplina: DisciplinaSchema, tema: z.string(), assuntos: z.array(z.string()), conteudo: ConteudoBaseSchema });

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

export const RespostaGerarConteudoSchema = z.object({
  pacote: PacoteDoProfessorSchema,
  usouIa: z.boolean(),
  motivo: z.enum(["sem-saldo", "indisponivel"]).nullable(),
});

export const RespostaHomologarPacoteSchema = z.object({ pacoteId: z.string(), homologadoEm: z.string(), pacote: PacoteDoProfessorSchema });
export const RespostaEmAndamentoSchema = z.object({ atividade: AtividadeSchema, etapa: EtapaDoGateSchema, mudou: z.boolean() });
export const RespostaGateSchema = z.object({ etapa: EtapaDoGateSchema, atividade: AtividadeSchema, atualizadoEm: z.string() });
export const RespostaZerarSchema = z.object({ atividade: AtividadeSchema, etapa: EtapaDoGateSchema });

const ContagemSchema = z.number().int().min(0);
const PorProjetoSchema = z.object({ papel: ContagemSchema, parcial: ContagemSchema, nuvem: ContagemSchema });

export const RespostaPainelSchema = z.object({
  turma: z.object({ id: z.string(), nome: z.string(), serie: z.string().nullable() }),
  atividade: z.object({ pacoteId: z.string(), rodada: z.number().int(), tema: z.string(), projetos: z.record(ProjetoIdSchema, z.string()) }).nullable(),
  etapa: EtapaDoGateSchema.nullable(),
  /** A lousa: só CONTAGENS — sem ranking, sem nível, sem nota individual. */
  resumo: z.object({
    estudantes: ContagemSchema,
    entraram: ContagemSchema,
    porPasso: z.record(PassoSchema, ContagemSchema),
    caminhos: z.object({ A1: ContagemSchema, A2: ContagemSchema, B: ContagemSchema }),
    escolhaInicial: PorProjetoSchema,
    escolhaFinal: PorProjetoSchema,
    /** Do 1º para o 2º voto: quantos mantiveram, quantos trocaram, e PARA ONDE foi quem trocou (protótipo E5-PROF-01). */
    migracao: z.object({ mantiveram: ContagemSchema, trocaram: ContagemSchema, para: PorProjetoSchema }),
    protocolosEnviados: ContagemSchema,
  }),
  /** O ritmo, nominal: só o passo e o tempo parado — nunca o voto nem o caminho de alguém. */
  linhas: z.array(z.object({ estudanteId: z.string(), nome: z.string(), passo: PassoSchema, segundosInativo: z.number().int().nullable() })),
  roteiro: z.object({ perguntas: z.array(z.string()), botoes: z.object({ revelacao: z.string(), revoto: z.string(), explicar: z.string() }) }),
});

export const RespostaMaterialProfessorSchema = z.object({
  missaoId: z.literal("exp09ef1b"),
  titulo: z.string(),
  padrao: PadraoSchema,
  roteiro: RespostaPainelSchema.shape.roteiro,
  virada: z.object({
    antes: z.array(z.object({ projeto: ProjetoIdSchema, indice: z.number() })),
    depois: z.array(z.object({ projeto: ProjetoIdSchema, indice: z.number() })),
  }),
  protocolo: z.object({ gabarito: z.array(BlocoSchema), danoso: BlocoSchema, rotulos: z.record(BlocoSchema, z.string()) }),
  habilidades: z.array(
    z.object({
      codigo: z.string(),
      rotulo: z.string(),
      criterios: z.object({ atingiu: z.string(), em_processo: z.string(), nao_atingiu: z.string() }),
    }),
  ),
});
