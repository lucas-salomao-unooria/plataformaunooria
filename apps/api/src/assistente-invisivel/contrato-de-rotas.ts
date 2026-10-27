import { z } from "zod";
import {
  APOSTAS,
  BLOCOS,
  CARTOES,
  COLUNAS,
  CONTEXTO_MAX,
  DISCIPLINAS,
  FASES,
  FUNCOES,
  ITENS_DO_PACOTE,
  LIMITES,
  OPCOES_DE_CRITERIO,
  OPCOES_DO_BLOCO,
  ORIGENS,
  PERFIS,
  TEMA,
  TOPICOS,
} from "./conteudo";
import { PASSOS } from "./regras/passos";

/**
 * O CONTRATO HTTP da exp01em1b — O Assistente Invisível (ADR-185), em Zod. O
 * OpenAPI é derivado daqui (ADR-36), e os vocabulários vêm do catálogo.
 *
 * **A experiência (`apps/experiencias/exp01em1b`) e o hub ESPELHAM estes
 * tipos** (`z.infer` de cada `…Schema`): mudar a forma aqui sem avisar quebra
 * os dois.
 *
 * Prefixo `/assistente-invisivel`. Rotas do ESTUDANTE (todas pelo funil da
 * porta da sala, ADR-69; com equipe, a sessão é do computador, E13):
 *
 *   GET  /assistente-invisivel/sessao               → SessaoSchema
 *   GET  /assistente-invisivel/gate                 → GateDoEstudanteSchema   (polling 3 s)
 *   POST /assistente-invisivel/iniciar              —                → EstadoSchema   (E1 "Abrir Módulo de Teste")
 *   POST /assistente-invisivel/navegar              NavegarSchema    → EstadoSchema   (E2 "Ir para Bateria de Testes")
 *   POST /assistente-invisivel/aposta               ApostaSchema     → EstadoSchema   (E3, LATCH 1)
 *   POST /assistente-invisivel/simulacao/concluir   —                → EstadoSchema   (E4-ALU-01)
 *   POST /assistente-invisivel/fichas/abrir         —                → EstadoSchema   (E4-ALU-02)
 *   POST /assistente-invisivel/inspecao/concluir    —                → EstadoSchema   (E4-ALU-03, a Trava 1 depois)
 *   POST /assistente-invisivel/cartoes              CartoesSchema    → EstadoSchema   (E5-ALU-01)
 *   POST /assistente-invisivel/algoritmo/abrir      —                → EstadoSchema   (E5-ALU-02, o PQ-04)
 *   POST /assistente-invisivel/algoritmo/marcar     AlgoritmoSchema  → EstadoSchema
 *   POST /assistente-invisivel/algoritmo/concluir   —                → EstadoSchema   ("Pular Etapa")
 *   POST /assistente-invisivel/criterios            CriteriosSchema  → RespostaDoRetesteSchema ("Executar Novo Teste de Homologação")
 *   POST /assistente-invisivel/reteste/revisar      —                → EstadoSchema   ("Revisar Critérios")
 *   POST /assistente-invisivel/reteste/avancar      —                → EstadoSchema   ("Avançar para …"; a Trava 2 depois)
 *   POST /assistente-invisivel/publicar             PublicarSchema   → EstadoSchema   (E6, LATCH 2, conclui)
 *
 * Os POSTs sem corpo próprio aceitam `DaTelaSchema` (a atividade da tela,
 * opcional): rodada ou pacote diferente do servidor = 409 `rodada-mudou`.
 *
 * Toda resposta de POST de estudante É um `Estado` (as que têm resultado
 * próprio o ESTENDEM): a tela troca o estado inteiro a cada resposta. Jogada
 * fora do passo = 409 `passo-invalido`; jogada com a turma ainda não liberada
 * = 409 `aguardando-professor`; repetir uma jogada já feita devolve o estado
 * atual (200) — o duplo toque e a fila de reenvio da tela são inofensivos. Os
 * dois latches com OUTRA escolha respondem 409 (`ja-apostou`, `ja-publicado`).
 *
 * **O gabarito NÃO desce** (regra 3): nem a coluna certa dos cartões, nem os
 * passos dispensáveis, nem os critérios equitativos, nem a opção certa dos
 * blocos, nem os acertos. Desce o que a MECÂNICA mostra: a tabela causal
 * (`cadeiaCausal`), o resultado do reteste e o que ele muda no chat. O
 * alinhamento do comunicado só vai ao painel do professor.
 */

// ─────────────────────────────────────────────────────────── peças

export const FaseSchema = z.enum(FASES);
export const PassoSchema = z.enum(PASSOS);
export const ApostaIdSchema = z.enum(APOSTAS);
export const FuncaoSchema = z.enum(FUNCOES);
export const OpcaoDeCriterioSchema = z.enum(OPCOES_DE_CRITERIO);
export const CartaoSchema = z.enum(CARTOES);
export const ColunaSchema = z.enum(COLUNAS);
export const BlocoSchema = z.enum(BLOCOS);
export const PerfilSchema = z.enum(PERFIS);
export const DisciplinaSchema = z.enum(DISCIPLINAS);
export const OrigemSchema = z.enum(ORIGENS);
export const ItemDoPacoteSchema = z.enum(ITENS_DO_PACOTE);
/** Os passos do algoritmo, 1 a 5. */
export const PassoDoAlgoritmoSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const CriteriosValorSchema = z.object({ exercicios: OpcaoDeCriterioSchema, duvidas: OpcaoDeCriterioSchema, sugestoes: OpcaoDeCriterioSchema });

/** Cada bloco aceita só as duas opções dele — e pode ficar em branco (o PO publica mesmo assim). */
export const ComunicadoValorSchema = z.object({
  problema: z.enum(OPCOES_DO_BLOCO.problema).optional(),
  inferencia: z.enum(OPCOES_DO_BLOCO.inferencia).optional(),
  regra: z.enum(OPCOES_DO_BLOCO.regra).optional(),
  salvaguarda: z.enum(OPCOES_DO_BLOCO.salvaguarda).optional(),
});

/** A alocação dos cartões: cada um em uma coluna, ou ausente (ainda não alocado). */
export const ClassificacaoValorSchema = z.object({
  "trilha-avancada": ColunaSchema.optional(),
  "nome-turma": ColunaSchema.optional(),
  horario: ColunaSchema.optional(),
  "sinal-de-rede": ColunaSchema.optional(),
  "endereco-ip": ColunaSchema.optional(),
  "modelo-aparelho": ColunaSchema.optional(),
});

const texto = (max: number) => z.string().trim().min(1).max(max);

/** O pacote didático (o que a IA gera e o professor cura). Não é gabarito: desce inteiro ao estudante. */
export const ConteudoDoPacoteSchema = z.object({
  versao: z.literal(1),
  trilhaAvancada: z.object({ titulo: texto(LIMITES.titulo), enunciado: texto(LIMITES.enunciado) }),
  reforcoBasico: z.object({ titulo: texto(LIMITES.titulo), enunciado: texto(LIMITES.enunciado) }),
  duvidas: z.object({
    lucas: texto(LIMITES.duvida),
    beatriz: texto(LIMITES.duvida),
    thiago1: texto(LIMITES.duvida),
    thiago2: texto(LIMITES.duvida),
    thiago3: texto(LIMITES.duvida),
  }),
  respostas: z.object({
    lucas: texto(LIMITES.resposta),
    beatriz: texto(LIMITES.resposta),
    thiago1: texto(LIMITES.resposta),
    thiago2: texto(LIMITES.resposta),
    thiago3: texto(LIMITES.resposta),
  }),
  leitura: z.object({ titulo: texto(LIMITES.titulo), resumo: texto(LIMITES.resumo) }),
});

/** O medidor da turma (TC-12) — percentuais agregados, `null` abaixo de 3 apostas. */
export const MedidorSchema = z.object({ a: z.number().int(), b: z.number().int(), c: z.number().int(), total: z.number().int() }).nullable();

// ─────────────────────────────────────────────────────────── entrada (estudante)

/**
 * OPCIONAL em todo POST de estudante: a atividade que a TELA está jogando.
 * Diferente da do servidor (o professor zerou ou trocou o pacote) = 409
 * `rodada-mudou` — a fila de reenvio não aplica uma jogada velha na rodada
 * nova. Ausente, o servidor não confere (compatível com quem não manda).
 */
const DA_TELA = { atividade: z.object({ pacoteId: z.string().uuid(), rodada: z.number().int().min(1) }).optional() };
export const DaTelaSchema = z.object(DA_TELA);

/** E2: as funções que o estudante expandiu (o botão só acende com uma). */
export const NavegarSchema = z.object({ abertas: z.array(FuncaoSchema).min(1).max(FUNCOES.length), ...DA_TELA });

/** E3: a aposta. LATCH 1 — "Previsão arquivada". */
export const ApostaSchema = z.object({ aposta: ApostaIdSchema, ...DA_TELA });

/** E5-ALU-01: a alocação dos 6 cartões. Incompleta vale (o aviso do PO; os critérios seguem). */
export const CartoesSchema = z.object({ classificacao: ClassificacaoValorSchema, ...DA_TELA });

/** E5-ALU-02: os passos marcados como "dispensáveis". Repetível até "Pular Etapa". */
export const AlgoritmoSchema = z.object({ marcados: z.array(PassoDoAlgoritmoSchema).max(5), ...DA_TELA });

/** E5-ALU-03: a configuração escolhida — roda o reteste. */
export const CriteriosSchema = z.object({ criterios: CriteriosValorSchema, ...DA_TELA });

/** E6-ALU-01: a página (o `Toggle`) e os blocos. LATCH 2 — conclui. */
export const PublicarSchema = z.object({ paginaAtiva: z.boolean(), comunicado: ComunicadoValorSchema, ...DA_TELA });

// ─────────────────────────────────────────────────────────── saída (estudante)

const AtividadeSchema = z.object({ pacoteId: z.string(), rodada: z.number().int() });

export const RetesteSchema = z.object({
  /** "total" = "Homologação Aprovada"; "parcial"/"nenhuma" = "Alerta de Viés Mantido". */
  equidade: z.enum(["total", "parcial", "nenhuma"]),
  /** O efeito no chat simulado do reteste. */
  beatrizAvancada: z.boolean(),
  thiagoLivre: z.boolean(),
});

/** O estado da missão — a resposta de TODO POST de estudante. Allowlist: nada do gabarito. */
export const EstadoSchema = z.object({
  passo: PassoSchema,
  /** A fase da TURMA; `null` sem pacote no ar. */
  fase: FaseSchema.nullable(),
  /** Há pacote no ar? Sem ele a tela é de espera (a missão nasce vazia). */
  preparada: z.boolean(),
  /** A camada de espera por cima do passo (as travas e as pausas do professor). */
  aguardandoProfessor: z.boolean(),
  atividade: AtividadeSchema.nullable(),
  /** O computador compartilhado (E13): o cabeçalho vira "Unooria · Bancada" + a tag da estação. */
  equipe: z.object({ nome: z.string() }).nullable(),
  funcoesAbertas: z.array(FuncaoSchema),
  aposta: ApostaIdSchema.nullable(),
  /** "Previsão arquivada" — o carimbo do LATCH 1 (ISO). */
  apostadaEm: z.string().nullable(),
  /** Os cartões como o estudante os deixou, e se a tabela causal aparece. Sem acertos. */
  classificacao: z.object({ cartoes: ClassificacaoValorSchema, completa: z.boolean(), cadeiaCausal: z.boolean() }).nullable(),
  algoritmo: z.object({
    aberto: z.boolean(),
    marcados: z.array(PassoDoAlgoritmoSchema),
    /** Dos MARCADOS, os que a tela rotula "(Ação enviesada)" (Figma E5-ALU-02). Só desce o que o estudante já marcou. */
    enviesados: z.array(PassoDoAlgoritmoSchema),
    concluido: z.boolean(),
  }),
  /** A configuração no ar: B-B-A até o primeiro reteste. */
  criterios: CriteriosValorSchema,
  retestes: z.number().int(),
  ultimoReteste: RetesteSchema.nullable(),
  publicacao: z.object({ paginaAtiva: z.boolean(), comunicado: ComunicadoValorSchema, publicadaEm: z.string() }).nullable(),
  concluido: z.boolean(),
});

/** O que a tela mostra de cada perfil (as fichas de auditoria são reveladas na E4 — não são gabarito). */
export const FichaSchema = z.object({
  perfil: PerfilSchema,
  nome: z.string(),
  idade: z.number().int(),
  formulario: z.string(),
  horario: z.string(),
  conexao: z.string(),
  inferencia: z.string().nullable(),
  acao: z.string(),
});

/** O material FIXO da missão (igual em todo pacote): rótulos e textos que não são gabarito. */
export const MaterialFixoSchema = z.object({
  apostas: z.array(z.object({ id: ApostaIdSchema, texto: z.string() })),
  fichas: z.array(FichaSchema),
  avisos: z.object({ beatriz: z.string(), thiago: z.string() }),
  cartoes: z.array(z.object({ id: CartaoSchema, rotulo: z.string() })),
  passosDoAlgoritmo: z.array(z.object({ id: PassoDoAlgoritmoSchema, rotulo: z.string() })),
  /** Os 9 critérios, por função. A configuração inicial (B-B-A, "[Ativo]") vem em `criteriosIniciais`. */
  criterios: z.array(z.object({ funcao: FuncaoSchema, opcoes: z.array(z.object({ id: OpcaoDeCriterioSchema, rotulo: z.string() })) })),
  criteriosIniciais: CriteriosValorSchema,
  /** Os 4 blocos, com as duas opções em ordem FIXA (a certa não é marcada). */
  blocos: z.array(z.object({ id: BlocoSchema, titulo: z.string(), inicio: z.string(), opcoes: z.array(z.object({ id: z.string(), texto: z.string() })) })),
});

/** `GET /sessao`: o estado, o pacote no ar, o material fixo e o medidor. */
export const SessaoSchema = EstadoSchema.extend({
  /** `null` sem pacote no ar. */
  pacote: z
    .object({
      disciplina: z.string(),
      tema: z.string(),
      conteudo: ConteudoDoPacoteSchema,
      /** O pacote veio da reserva depois de a IA falhar: a faixa "Carregando versão de contingência da rede escolar" (E3-SIS-01). */
      contingencia: z.boolean(),
    })
    .nullable(),
  material: MaterialFixoSchema,
  medidor: MedidorSchema,
  tempos: z.object({ pollingMs: z.number().int() }),
});

/** O polling de 3 s: leve. `rodada` muda quando o professor zera; `fase` quando libera. */
export const GateDoEstudanteSchema = z.object({
  preparada: z.boolean(),
  fase: FaseSchema.nullable(),
  rodada: z.number().int().nullable(),
  atividade: AtividadeSchema.nullable(),
  passo: PassoSchema,
  aguardandoProfessor: z.boolean(),
  medidor: MedidorSchema,
  /** O instante do SERVIDOR (ISO). */
  agora: z.string(),
});

export const RespostaDoRetesteSchema = EstadoSchema.extend({ reteste: RetesteSchema });

// ─────────────────────────────────────────────────────────── entrada (professor)

/** O recorte da aula (E0-PROF-02). */
export const GerarSchema = z.object({
  disciplina: DisciplinaSchema,
  tema: z.string().trim().min(TEMA.min).max(TEMA.max),
  topicos: z.array(z.string().trim().min(2).max(TOPICOS.maxCaracteres)).min(TOPICOS.min).max(TOPICOS.max),
  contexto: z.string().trim().max(CONTEXTO_MAX).optional().nullable(),
});

/** "Regenerar Este Item" (E0-PROF-04): a IA reescreve só aquele item do rascunho. */
export const RegenerarItemSchema = z.object({ rascunhoId: z.string().uuid(), item: ItemDoPacoteSchema });

/** "Editar Texto": o professor reescreve o item. `titulo` só nos itens que têm título. */
export const EditarItemSchema = z.object({
  rascunhoId: z.string().uuid(),
  item: ItemDoPacoteSchema,
  titulo: z.string().trim().min(1).max(LIMITES.titulo).optional(),
  texto: z.string().trim().min(1).max(LIMITES.resposta),
});

/** "Aprovar Pacote Homologado": o rascunho vira atividade PRONTA. `rascunhoId` é o que o professor VIU. */
export const HomologarSchema = z.object({ rascunhoId: z.string().uuid() });

/** As liberações e as pausas — só para a frente (`regras/passos.ts#PROXIMAS_FASES`). */
export const GateSchema = z.object({ para: FaseSchema.exclude(["aguardando-inicio"]) });
export const NovaRodadaSchema = z.object({ rodada: z.number().int().min(1) });
export const ParamsDaTurmaSchema = z.object({ turmaId: z.string().uuid("precisa ser um UUID") });
export const ParamsDoPacoteSchema = z.object({ turmaId: z.string().uuid(), pacoteId: z.string().uuid() });
/** `gestor_contrato` tem escola vazia no token (regra 1) e precisa dizer `?escolaId=`. */
export const QueryDaEscolaSchema = z.object({ escolaId: z.string().optional() });

// ─────────────────────────────────────────────────────────── saída (professor)

const TurmaSchema = z.object({ id: z.string(), nome: z.string(), serie: z.string().nullable() });

export const TurmasSchema = z.object({ turmas: z.array(TurmaSchema.extend({ estudantes: z.number().int() })) });

export const PacoteDoProfessorSchema = z.object({
  id: z.string(),
  disciplina: DisciplinaSchema,
  tema: z.string(),
  topicos: z.array(z.string()),
  contexto: z.string().nullable(),
  origem: OrigemSchema,
  conteudo: ConteudoDoPacoteSchema,
  /** Os itens que o professor editou ("Editado pelo professor"). */
  editados: z.array(ItemDoPacoteSchema),
  contingencia: z.boolean(),
  aprovadoEm: z.string().nullable(),
  ativo: z.boolean(),
  rodadaAtual: z.number().int(),
});

export const PacoteDaTurmaSchema = z.object({
  turma: TurmaSchema,
  ativo: PacoteDoProfessorSchema.nullable(),
  rascunho: PacoteDoProfessorSchema.nullable(),
  disciplinas: z.array(z.object({ slug: DisciplinaSchema, rotulo: z.string() })),
});

export const RascunhoSchema = z.object({ rascunho: PacoteDoProfessorSchema });

/** `GET turmas/:turmaId/pacotes/:pacoteId`: UMA atividade inteira (a aba Conteúdo da atividade fora do ar). */
export const PacoteDetalheSchema = PacoteDoProfessorSchema.extend({ rodadas: z.number().int() });

export const GerarRespostaSchema = z.object({
  rascunho: PacoteDoProfessorSchema,
  usouIa: z.boolean(),
  /** `sem-saldo` = E0-PROF-03 "sem saldo de IA" (429); `indisponivel` = E0-PROF-03 "503". O rascunho é o banco padrão nos dois. */
  motivo: z.enum(["sem-saldo", "indisponivel"]).nullable(),
});

export const GateDaTurmaSchema = z.object({ fase: FaseSchema, atividade: AtividadeSchema, atualizadoEm: z.string() });
export const NovaRodadaRespostaSchema = z.object({ atividade: AtividadeSchema, fase: FaseSchema });
export const EmAndamentoSchema = z.object({ atividade: AtividadeSchema, fase: FaseSchema, mudou: z.boolean() });
export const EncerrarRespostaSchema = z.object({ marcadas: z.number().int() });

export const PacotesDaTurmaSchema = z.object({
  emAndamento: AtividadeSchema.nullable(),
  historico: z.array(
    z.object({
      id: z.string(),
      disciplina: DisciplinaSchema,
      tema: z.string(),
      origem: OrigemSchema,
      ativo: z.boolean(),
      aprovadoEm: z.string(),
      rodadas: z.number().int(),
    }),
  ),
});

const NivelSchema = z.enum(["atingiu", "em_processo", "nao_atingiu"]);

/** Uma linha do painel: UM estudante (ou um computador, com equipe). O professor vê o gabarito aplicado. */
export const LinhaDoPainelSchema = z.object({
  unidadeId: z.string(),
  nome: z.string(),
  equipe: z.object({ id: z.string(), nome: z.string(), membros: z.array(z.object({ id: z.string(), nome: z.string() })) }).nullable(),
  passo: PassoSchema,
  aguardandoProfessor: z.boolean(),
  aposta: ApostaIdSchema.nullable(),
  simulacaoConcluida: z.boolean(),
  cartoes: z.object({ acertos: z.number().int(), completa: z.boolean() }).nullable(),
  algoritmo: z.object({ aberto: z.boolean(), marcados: z.array(PassoDoAlgoritmoSchema), correto: z.boolean() }),
  criterios: CriteriosValorSchema.nullable(),
  retestes: z.number().int(),
  equidade: z.enum(["total", "parcial", "nenhuma"]).nullable(),
  /** Avançou para a publicação mantendo 1B ou 2B — o "Aviso Discreto" (E5-PROF-01). */
  avancouComVies: z.boolean(),
  publicacao: z
    .object({
      paginaAtiva: z.boolean(),
      comunicado: ComunicadoValorSchema,
      /** O comunicado montado em texto corrido ("Comunicados Aprovados pelos Estudantes", E6-PROF-01). */
      texto: z.string(),
      alinhamento: z.enum(["pleno", "incompleto", "descaracterizado"]),
    })
    .nullable(),
  niveis: z.object({ co20: NivelSchema, co01: NivelSchema, co18: NivelSchema, co03: NivelSchema }).nullable(),
});

export const PainelSchema = z.object({
  turma: TurmaSchema,
  atividade: z.object({ pacoteId: z.string(), rodada: z.number().int(), tema: z.string(), disciplina: z.string() }).nullable(),
  fase: FaseSchema.nullable(),
  porComputador: z.boolean(),
  resumo: z.object({
    /** As unidades (estudantes ou computadores) com sessão aberta na rodada. */
    sessoes: z.number().int(),
    apostas: z.object({ a: z.number().int(), b: z.number().int(), c: z.number().int() }),
    /** E3-PROF-01: "Liberar Início da Simulação" só acende com 100% das sessões abertas. */
    todosApostaram: z.boolean(),
    /** Quem ainda não apostou — para o professor achar quem segura o botão. */
    faltamApostar: z.array(z.string()),
    simulacoesConcluidas: z.number().int(),
    naBancada: z.number().int(),
    /** E5-PROF-01: "Critérios Escolhidos pela Sala: 1A × 1C" (no último reteste de cada unidade). */
    criterioExercicios: z.object({ a: z.number().int(), b: z.number().int(), c: z.number().int() }),
    avancaramComVies: z.array(z.string()),
    publicaram: z.number().int(),
    paginasAtivas: z.number().int(),
    /** E6-PROF-01: "Matriz de Habilidades BNCC Aferidas" — % Atingiu (CO03: % que abriu o painel, "Participou"). */
    habilidades: z.object({ co20: z.number().int(), co01: z.number().int(), co18: z.number().int(), co03Participou: z.number().int() }),
  }),
  linhas: z.array(LinhaDoPainelSchema),
  roteiro: z.object({ perguntas: z.array(z.string()).length(4) }),
});

export const MaterialSchema = z.object({
  roteiro: PainelSchema.shape.roteiro,
  habilidades: z.array(
    z.object({
      codigo: z.string(),
      rotulo: z.string(),
      criterios: z.object({ atingiu: z.string(), em_processo: z.string(), nao_atingiu: z.string() }),
    }),
  ),
});

// ─────────────────────────────────────────────────────────── os tipos que a tela e o hub importam

export type Estado = z.infer<typeof EstadoSchema>;
export type Sessao = z.infer<typeof SessaoSchema>;
export type GateDoEstudante = z.infer<typeof GateDoEstudanteSchema>;
export type RespostaDoReteste = z.infer<typeof RespostaDoRetesteSchema>;
export type MaterialFixo = z.infer<typeof MaterialFixoSchema>;
export type Painel = z.infer<typeof PainelSchema>;
export type LinhaDoPainel = z.infer<typeof LinhaDoPainelSchema>;
export type PacoteDoProfessor = z.infer<typeof PacoteDoProfessorSchema>;
export type PacoteDaTurma = z.infer<typeof PacoteDaTurmaSchema>;
export type GerarResposta = z.infer<typeof GerarRespostaSchema>;
