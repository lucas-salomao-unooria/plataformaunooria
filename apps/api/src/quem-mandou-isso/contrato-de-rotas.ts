import { z } from "zod";
import { falasDoTemaSchema } from "../podcast/roteiro";
import { VAGAS_DO_PODCAST } from "./podcast";
import {
  ASSUNTOS_MAX,
  CONTEXTO_MAX_CARACTERES,
  DISCIPLINAS,
  IDS_DE_MENSAGEM,
  LEGENDA_MAX_CARACTERES,
  MOTIVOS,
  ORIGENS,
  REMETENTE_MAX_CARACTERES,
  TEXTO_MAX_CARACTERES,
  TIPOS_DE_MENSAGEM,
  TONS,
  TOTAL_DE_MENSAGENS,
  VERACIDADES,
} from "./catalogo";
import { OPERADORES, RESPOSTAS, TOTAL_DE_FRASES } from "./regras/operacoes";
import { validarAssuntos, validarContexto, validarPacote, validarTema } from "./regras/pacote";
import { ACOES_DO_GATE, FASES, PASSOS } from "./regras/passos";
import { ACOES, CONDICOES, SITUACOES } from "./regras/regra";

/**
 * O contrato HTTP da exp05ef1b v2.2 — só schemas Zod. O OpenAPI é derivado
 * daqui (ADR-36), e os vocabulários vêm do catálogo e das regras, nunca
 * reescritos: uma segunda lista é a que ninguém atualiza junto.
 *
 * A saída é ALLOWLIST. `MensagemPublicaSchema` não tem campo para
 * `veracidade`/`tom`: o gabarito só cruza a fronteira dentro de `revelacao`,
 * que o servidor preenche depois do voto e da revelação aberta pela turma.
 */

export const MensagemIdSchema = z.enum(IDS_DE_MENSAGEM);
const DisciplinaSchema = z.enum(DISCIPLINAS);
const FaseSchema = z.enum(FASES);
const PassoSchema = z.enum(PASSOS);
const MotivoSchema = z.enum(MOTIVOS);

// ─────────────────────────────────────────────────────────── entrada

/** O rascunho da triagem: 0 a 3 ids. A régua (repetida, acima do limite, fora do pacote) é do serviço. */
export const SelecaoSchema = z.object({
  selecao: z.array(MensagemIdSchema).max(TOTAL_DE_MENSAGENS),
});

/**
 * O LATCH 1. O corpo leva a seleção que o estudante está VENDO no Mural — e é
 * ela que fecha, não a última que o `PUT` gravou: um `PUT` perdido na rede não
 * pode fazer o Mural confirmar outra coisa.
 */
export const MuralSchema = SelecaoSchema;

export const EnqueteSchema = z.object({ motivo: MotivoSchema });

const FraseIdSchema = z.enum(["f1", "f2", "f3", "f4", "f5", "f6"]);

/**
 * O CARTÃO DE FRASES (EF05CO03): as seis respostas, todas de uma vez — sem
 * resultado parcial. Os ids precisam ser os seis, sem repetir (o serviço
 * confere); a resposta esperada nunca veio ao cliente.
 */
export const OperacoesSchema = z.object({
  respostas: z
    .array(z.object({ fraseId: FraseIdSchema, resposta: z.enum(RESPOSTAS) }))
    .length(TOTAL_DE_FRASES)
    .refine((r) => new Set(r.map((x) => x.fraseId)).size === TOTAL_DE_FRASES, "cada frase uma vez"),
});

/** A regra montada com peças: a condição e uma ou duas ações, em ordem. */
export const RegraSchema = z.object({
  condicao: z.enum(CONDICOES),
  acoes: z.array(z.enum(ACOES)).min(1).max(2),
});

/** O teste no áudio do tio: a regra e a PREVISÃO, que vem antes do resultado. */
export const TesteDaRegraSchema = RegraSchema.extend({ previsao: z.enum(SITUACOES) });

/**
 * O recorte da aula (E0-PROF-02). Os tetos chegam por `superRefine` das MESMAS
 * funções puras que a aprovação usa — tema ≤ 60 caracteres e ≤ 8 palavras
 * (a fala da Nina), 3 a 6 fatos. Os `max` do Zod são só defesa de tamanho: o
 * tema alimenta um prompt, e campo longo é injeção de instrução.
 */
const RecorteBaseSchema = z.object({
  disciplina: DisciplinaSchema,
  tema: z.string().max(200),
  assuntos: z.array(z.string().max(400)).max(ASSUNTOS_MAX * 2),
  contexto: z.string().max(CONTEXTO_MAX_CARACTERES * 2).nullish(),
});

export const GerarSchema = RecorteBaseSchema.superRefine((r, ctx) => {
  for (const mensagem of [...validarTema(r.tema), ...validarAssuntos(r.assuntos), ...validarContexto(r.contexto)]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: mensagem });
  }
});

/** Uma mensagem COMPLETA — com o gabarito. Só entra e sai por rota de professor. */
export const MensagemDoPacoteSchema = z.object({
  id: MensagemIdSchema,
  remetente: z.string().max(REMETENTE_MAX_CARACTERES * 2),
  tipo: z.enum(TIPOS_DE_MENSAGEM),
  texto: z.string().max(TEXTO_MAX_CARACTERES * 2),
  /** Só na imagem (o texto do comunicado desenhado) e no link (a manchete da prévia). */
  legenda: z.string().max(LEGENDA_MAX_CARACTERES * 2).optional(),
  veracidade: z.enum(VERACIDADES),
  tom: z.enum(TONS),
});

/**
 * "Aprovar Pacote" — a curadoria humana (RF-003). O corpo carrega o pacote
 * INTEIRO: o professor pode reescrever qualquer texto antes de aprovar. A
 * régua inteira (2 por quadrante, 4/2/2, imagem e link com uma verdadeira e
 * uma falsa, tetos de palavras, termos proibidos) vem de `validarPacote` —
 * e, como `.superRefine()` some do OpenAPI, a nota do `@Contrato` a repete.
 */
export const AprovarSchema = RecorteBaseSchema.extend({
  origem: z.enum(ORIGENS),
  mensagens: z.array(MensagemDoPacoteSchema).max(TOTAL_DE_MENSAGENS * 2),
  /**
   * As três falas do podcast de recapitulação que o professor revisou na
   * customização (ADR-150). No banco padrão, as do sheet.
   */
  podcast: falasDoTemaSchema(VAGAS_DO_PODCAST),
}).superRefine((p, ctx) => {
  for (const mensagem of validarPacote(p)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: mensagem });
});
export type CorpoDaAprovacao = z.infer<typeof AprovarSchema>;

export const GateSchema = z.object({ acao: z.enum(ACOES_DO_GATE) });

/** A rodada que o professor VIU no painel — é o que torna o duplo clique em "Zerar a turma" idempotente. */
export const NovaRodadaSchema = z.object({ rodada: z.number().int().min(1) });

export const ParamsDaTurmaSchema = z.object({ turmaId: z.string().uuid("precisa ser um UUID") });
/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

// ─────────────────────────────────────────────────────── saída (estudante)

/** Uma mensagem como o ESTUDANTE a recebe — sem `veracidade` e `tom`. */
export const MensagemPublicaSchema = z.object({
  id: MensagemIdSchema,
  remetente: z.string(),
  tipo: z.enum(TIPOS_DE_MENSAGEM),
  texto: z.string(),
  legenda: z.string().optional(),
});

const AtividadeSchema = z.object({
  /** O id do PACOTE aprovado — é a atividade da evidência (E14). */
  pacoteId: z.string().uuid(),
  rodada: z.number().int().positive(),
});

/**
 * A revelação do estudante. `null` até ele VOTAR e a turma abrir a revelação
 * — e é o ÚNICO lugar em que o gabarito cruza a fronteira, e só o das TRÊS que
 * ele encaminhou.
 */
export const RevelacaoSchema = z.object({
  mensagens: z.array(z.object({ id: MensagemIdSchema, veracidade: z.enum(VERACIDADES), tom: z.enum(TONS) })),
  motivo: MotivoSchema,
  /** O callback do bimestre para o motivo declarado (`e4.feedback.callback_*`). */
  callback: z.string(),
  /** As duas barras da turma, para a sala sem projetor. Por computador quando há equipe; sem nome nenhum. */
  turma: z.object({
    unidades: z.number().int().nonnegative(),
    falsaNeutra: z.number().int().min(0).max(100),
    verdadeiraEmocionalDescartada: z.number().int().min(0).max(100),
  }),
});

/**
 * O CARTÃO DE FRASES do estudante — `null` até a revelação dele (depende do
 * gabarito das três mensagens). As frases saem SEM a resposta esperada.
 */
export const CartaoSchema = z.object({
  frases: z.array(z.object({ id: FraseIdSchema, operador: z.enum(OPERADORES), texto: z.string() })).length(TOTAL_DE_FRASES),
  /** Já enviou? Depois do envio o cartão trava (o latch). */
  enviado: z.boolean(),
});

const RegraMontadaSchema = RegraSchema.extend({
  /** A regra em palavras ("Se a mensagem for…, então eu…"). */
  emPalavras: z.string(),
});

/** A regra do tio do estudante: os testes feitos e a regra enviada. */
export const RegraDoEstudanteSchema = z.object({
  testes: z.array(
    RegraMontadaSchema.extend({
      previsao: z.enum(SITUACOES),
      /** O que a regra fez com o áudio — e a frase que a tela mostra. */
      situacao: z.enum(SITUACOES),
      resultado: z.string(),
    }),
  ),
  /** Ainda pode testar? (limite técnico de testes) */
  podeTestar: z.boolean(),
  enviada: RegraMontadaSchema.nullable(),
});

export const EstadoSchema = z.object({
  /** O passo DERIVADO no servidor: `f(latches da sessão, fase da turma)`. */
  passo: PassoSchema,
  /** A fase da turma; `null` sem pacote aprovado. */
  fase: FaseSchema.nullable(),
  /** O professor já aprovou um pacote para esta turma? Sem isso, a tela é de espera. */
  preparada: z.boolean(),
  atividade: AtividadeSchema.nullable(),
  /** A seleção guardada (0 a 3). É o que um F5 restaura. */
  selecao: z.array(MensagemIdSchema),
  confirmado: z.boolean(),
  motivo: MotivoSchema.nullable(),
  concluido: z.boolean(),
  revelacao: RevelacaoSchema.nullable(),
  /** O cartão de frases (EF05CO03) — `null` antes da revelação do estudante. */
  cartao: CartaoSchema.nullable(),
  /** A regra do tio (EF05CO04) — `null` antes do passo `regra`. */
  regra: RegraDoEstudanteSchema.nullable(),
});

const OpcaoSchema = z.object({ id: z.string(), rotulo: z.string() });

export const SessaoSchema = EstadoSchema.extend({
  /** O grupo da turma — `null` enquanto o professor não aprovou. As mensagens saem SEM o gabarito. */
  pacote: z
    .object({
      tema: z.string(),
      grupo: z.object({ nome: z.string(), participantes: z.number().int().nonnegative() }),
      mural: z.object({ nome: z.string() }),
      mensagens: z.array(MensagemPublicaSchema).length(TOTAL_DE_MENSAGENS),
    })
    .nullable(),
  /**
   * As falas da experiência que dependem do servidor (a da Nina leva o tema)
   * ou que são da missão: a que abre o cartão de frases e o desafio do tio.
   */
  textos: z.object({
    nina: z.object({ convite: z.string().nullable(), encerramento: z.string(), cartao: z.string(), tio: z.string() }),
  }),
  /**
   * Os rótulos das peças. O tipo de cada ação e quais condições pegam o áudio
   * ficam no servidor: a tela recebe só id e rótulo.
   */
  opcoes: z.object({
    motivos: z.array(OpcaoSchema),
    condicoes: z.array(OpcaoSchema),
    acoes: z.array(OpcaoSchema),
    previsoes: z.array(OpcaoSchema),
  }),
  limites: z.object({ encaminhamentos: z.number().int().positive(), testes: z.number().int().positive() }),
});

export const GateDoEstudanteSchema = z.object({
  fase: FaseSchema.nullable(),
  passo: PassoSchema,
  preparada: z.boolean(),
  atividade: AtividadeSchema.nullable(),
  /** O instante do SERVIDOR: o relógio da máquina da escola atrasa. */
  agora: z.string(),
});

// ─────────────────────────────────────────────────────── saída (professor)

const TurmaSchema = z.object({ id: z.string().uuid(), nome: z.string(), serie: z.string().nullable() });

/** O pacote como o professor o vê — COM o gabarito. */
export const PacoteDoProfessorSchema = z.object({
  id: z.string().uuid(),
  disciplina: DisciplinaSchema,
  tema: z.string(),
  assuntos: z.array(z.string()),
  contexto: z.string().nullable(),
  origem: z.enum(ORIGENS),
  mensagens: z.array(MensagemDoPacoteSchema),
  /** `null` = rascunho. */
  aprovadoEm: z.string().nullable(),
  ativo: z.boolean(),
  rodadaAtual: z.number().int().positive(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

/** O banco curado, sempre à mão ("Usar Preset Curado Padrão"). */
const PadraoSchema = z.object({
  nome: z.string(),
  tema: z.string(),
  assuntos: z.array(z.string()),
  mensagens: z.array(MensagemDoPacoteSchema),
});

export const PacoteDaTurmaSchema = z.object({
  turma: TurmaSchema,
  /** O pacote aprovado que a turma está usando. */
  ativo: PacoteDoProfessorSchema.nullable(),
  /** O último rascunho (gerado e ainda não aprovado). */
  rascunho: PacoteDoProfessorSchema.nullable(),
  padrao: PadraoSchema,
  disciplinas: z.array(z.object({ slug: DisciplinaSchema, rotulo: z.string() })),
});

export const GerarRespostaSchema = z.object({
  rascunho: PacoteDoProfessorSchema,
  /** `false` = o rascunho é o banco curado. */
  usouIa: z.boolean(),
  /** Por que não houve IA: `sem-saldo` (a frase do 429) ou `indisponivel` (a do 503). */
  motivo: z.enum(["sem-saldo", "indisponivel"]).nullable(),
});

export const GateDaTurmaSchema = z.object({
  turma: TurmaSchema,
  fase: FaseSchema,
  atividade: AtividadeSchema,
  atualizadoEm: z.string(),
});

export const NovaRodadaRespostaSchema = z.object({ atividade: AtividadeSchema, fase: FaseSchema });

/** O endereço de UMA atividade: a turma e o pacote. */
export const ParamsDoPacoteSchema = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });

/**
 * As ATIVIDADES da turma (ADR-130): os pacotes APROVADOS, do mais recente ao
 * mais antigo. O rascunho não entra — ainda não é atividade.
 */
export const PacotesDaTurmaSchema = z.object({
  /** O em andamento, ou `null` quando o professor ainda não pôs nenhum no ar. */
  emAndamento: AtividadeSchema.nullable(),
  historico: z.array(
    z.object({
      id: z.string().uuid(),
      disciplina: DisciplinaSchema,
      tema: z.string(),
      origem: z.enum(ORIGENS),
      /** Em andamento na turma? */
      ativo: z.boolean(),
      aprovadoEm: z.string(),
      /** A maior rodada com sessão; 0 = nunca rodou. */
      rodadas: z.number().int().min(0),
    }),
  ),
});

/** UMA atividade, em andamento ou não — a página dela. */
export const PacoteDetalheSchema = PacoteDoProfessorSchema.extend({
  /** A maior rodada com sessão; 0 = nunca rodou. */
  rodadas: z.number().int().min(0),
});

export const EmAndamentoSchema = z.object({
  atividade: AtividadeSchema,
  fase: FaseSchema,
  /** `false` = ele já estava em andamento (o segundo clique). */
  mudou: z.boolean(),
});

const ProgressoSchema = z.object({
  unidades: z.number().int().nonnegative(),
  entraram: z.number().int().nonnegative(),
  confirmaram: z.number().int().nonnegative(),
  votaram: z.number().int().nonnegative(),
  /** Enviaram o cartão de frases (EF05CO03). */
  responderamCartao: z.number().int().nonnegative(),
  /** Enviaram a regra do tio (EF05CO04). */
  enviaramRegra: z.number().int().nonnegative(),
  concluiram: z.number().int().nonnegative(),
});

const TermometroSchema = z.object({
  unidades: z.number().int().nonnegative(),
  falsaNeutra: z.object({ unidades: z.number().int().nonnegative(), percentual: z.number().int().min(0).max(100) }),
  verdadeiraEmocionalDescartada: z.object({
    descartadas: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    percentual: z.number().int().min(0).max(100),
  }),
  motivos: z.array(
    z.object({ motivo: MotivoSchema, unidades: z.number().int().nonnegative(), comFalsaNeutra: z.number().int().nonnegative() }),
  ),
});

/**
 * Uma linha da FOLHA NOMINAL — uma por computador quando há equipe (a linha de
 * quem jogou, com a equipe junto). Sem coluna de acerto por criança: o nível
 * de cada habilidade é da evidência (E14, `PainelDeHabilidades`), onde o
 * professor também o ajusta.
 */
const LinhaDoPainelSchema = z.object({
  estudanteId: z.string().uuid(),
  nome: z.string(),
  equipe: z
    .object({ id: z.string().uuid(), nome: z.string(), membros: z.array(z.object({ id: z.string().uuid(), nome: z.string() })) })
    .nullable(),
  passo: PassoSchema,
  /** As três do Mural — SÓ depois do latch 1. */
  selecao: z.array(MensagemIdSchema).nullable(),
  motivo: MotivoSchema.nullable(),
  tempoFeedSegundos: z.number().int().nonnegative().nullable(),
  /** O cartão de frases enviado: acertos (0–6) e por operador. O nível é da evidência. */
  cartao: z
    .object({
      acertos: z.number().int().min(0).max(TOTAL_DE_FRASES),
      porOperador: z.object({ E: z.number().int(), OU: z.number().int(), NAO: z.number().int() }),
    })
    .nullable(),
  /** A regra enviada, em palavras, e quantos testes ela levou. */
  regra: z.object({ emPalavras: z.string(), testes: z.number().int().nonnegative() }).nullable(),
});

export const PainelSchema = z.object({
  turma: TurmaSchema,
  /** `null` sem pacote aprovado. É a atividade que o `PainelDeHabilidades` (E14) recebe. */
  atividade: AtividadeSchema.extend({ tema: z.string() }).nullable(),
  fase: FaseSchema.nullable(),
  /** `true` = há equipes nesta missão e os números contam COMPUTADORES. */
  porComputador: z.boolean(),
  progresso: ProgressoSchema,
  /** O Termômetro — `null` antes da revelação (só progresso). */
  termometro: TermometroSchema.nullable(),
  linhas: z.array(LinhaDoPainelSchema),
  roteiro: z.object({ perguntas: z.array(z.string()), instrucoes: z.object({ revelacao: z.string(), reflexao: z.string() }) }),
});

/**
 * O guia da aula: o banco curado COM gabarito, o roteiro, e as duas AÇÕES de
 * evidência que o professor precisa conhecer (o cartão de frases e a regra do
 * tio) — com um exemplo do cartão já respondido e o que cada peça é.
 */
export const MaterialSchema = z.object({
  padrao: PadraoSchema.extend({ convite: z.string() }),
  roteiro: z.object({ perguntas: z.array(z.string()), instrucoes: z.object({ revelacao: z.string(), reflexao: z.string() }) }),
  textos: z.object({ encerramento: z.string(), cartao: z.string(), tio: z.string() }),
  cartao: z.object({
    /** Um cartão do banco curado, COM a resposta esperada — é o roteiro do professor. */
    exemplo: z.array(z.object({ operador: z.enum(OPERADORES), texto: z.string(), esperado: z.enum(RESPOSTAS) })),
  }),
  regra: z.object({
    condicoes: z.array(OpcaoSchema.extend({ pegaOAudio: z.boolean() })),
    acoes: z.array(OpcaoSchema.extend({ tipo: z.enum(["checagem", "espera", "condicional", "repasse"]) })),
    previsoes: z.array(OpcaoSchema),
  }),
  /** O nível de cada ação, contado em palavras (a ficha). */
  habilidades: z.array(
    z.object({
      codigo: z.string(),
      rotulo: z.string(),
      criterios: z.object({ atingiu: z.string(), em_processo: z.string(), nao_atingiu: z.string() }),
    }),
  ),
  opcoes: z.object({ motivos: z.array(OpcaoSchema) }),
});
