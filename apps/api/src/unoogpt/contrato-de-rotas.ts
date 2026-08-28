import { z } from "zod";
import { CONDUTAS } from "./leitura";
import { PASSOS } from "./regras/passos";
import { BAIRROS_VALIDOS, CONJUNTOS_VALIDOS, JUSTIFICATIVAS_VALIDAS } from "./unoogpt.service";

const EquipeSchema = z.enum(["alfa", "bravo"]);
const ConfiancaSchema = z.enum(["alta", "média", "baixa"]);

// ------------------------------------------------------------------ entrada

export const PerguntaSchema = z.object({
  /** 600 caracteres: o campo do chat, não um formulário. Acima disso não é fala
   *  de aluno — é colagem, e ela infla o prompt de todo turno seguinte. */
  texto: z.string().trim().min(1).max(600),
});

export const ConjuntosSchema = z.object({
  conjuntos: z.array(z.enum(CONJUNTOS_VALIDOS)).min(1).max(8),
});

export const AlocacaoSchema = z.object({
  equipe: EquipeSchema,
  /** `null` tira a equipe do destino. */
  bairro: z.enum(BAIRROS_VALIDOS).nullable(),
  /** Ausente e explicitamente nula são a MESMA coisa: "escolhi o bairro, ainda
   *  não disse por quê". O portão que exige o porquê é o de ENVIAR. */
  justificativa: z.enum(JUSTIFICATIVAS_VALIDAS).nullish(),
});

export const ContrafactualSchema = z.object({
  alfa: z.enum(BAIRROS_VALIDOS).nullable(),
  bravo: z.enum(BAIRROS_VALIDOS).nullable(),
});

export const PassoSchema = z.object({ para: z.enum(PASSOS) });

// ------------------------------------------------------------------- saída

const FaixaSchema = z.object({
  min: z.number(),
  esperado: z.number(),
  max: z.number(),
});

/** O que o modelo enxerga de um bairro. `null` no mapa = nenhum Conjunto
 *  carregado o cobre, e o cartão fica em branco — **branco é informação**. */
export const EstimativaSchema = z.object({
  bairro: z.string(),
  cobertura: z.number(),
  chanceDeEventoSevero: FaixaSchema,
  pessoasEmRisco: FaixaSchema,
  confianca: ConfiancaSchema,
  sustentadaPor: z.array(z.string()),
});

/**
 * ALLOWLIST explícita, nunca `delete obj.campo`. O que não pode vazar é o
 * `achado` das Perguntas ainda NÃO feitas: o mapa começa vazio, e só o que uma
 * Pergunta revelou chega ao navegador.
 */
export const BairroPublicoSchema = z.object({
  slug: z.string(),
  nome: z.string(),
  left: z.string(),
  top: z.string(),
  w: z.string(),
  h: z.string(),
  /** Só com o conjunto de malha viária carregado. */
  tempos: z.object({ alfa: z.number(), bravo: z.number() }).nullable(),
  /**
   * Se cada equipe ALCANÇA o bairro antes da chuva, e com quanta folga. Vem do
   * SERVIDOR: o app de origem calculava no cliente, o que punha a matemática de
   * chegada no bundle e deixava o aluno antecipar parte do desfecho.
   */
  alcance: z
    .object({
      alfa: z.object({
        passa: z.boolean(),
        folga: z.number(),
        aperto: z.boolean(),
        motivo: z.string().nullable(),
      }),
      bravo: z.object({
        passa: z.boolean(),
        folga: z.number(),
        aperto: z.boolean(),
        motivo: z.string().nullable(),
      }),
    })
    .nullable(),
  estimativa: EstimativaSchema.nullable(),
});

/** `tenantId` e id de turma NÃO entram. `agora` é o instante do SERVIDOR: é dele
 *  que o cronômetro parte, senão o relógio da máquina da escola (que atrasa)
 *  decide quanto tempo a turma tem. */
export const RelogioPublicoSchema = z.object({
  modo: z.enum(["cronometrado", "livre"]),
  iniciadoEm: z.string().nullable(),
  duracaoSeg: z.number(),
  encerradoEm: z.string().nullable(),
  pivoSeg: z.number(),
  pivoMin: z.number(),
  agora: z.string(),
});

export const EstadoDoRelogioSchema = z.object({
  fase: z.string(),
  aberta: z.boolean(),
  segundosAteFechar: z.number().nullable(),
  minutosGastos: z.number(),
  motivoDoFim: z.string().nullable(),
});

export const SessaoPublicaSchema = z.object({
  passo: z.enum(PASSOS),
  minutosGastos: z.number(),
  /** Conjuntos carregados no modelo. Acumulam em camadas. */
  conjuntos: z.array(z.string()),
  rodadas: z.number(),
  perguntasGastas: z.number(),
  /** Qual partida do aluno. Recomeçar abre a seguinte. */
  tentativa: z.number(),
  alocacao: z.object({ alfa: z.string().nullable(), bravo: z.string().nullable() }),
  justificativas: z.object({ alfa: z.string().nullable(), bravo: z.string().nullable() }),
});

/**
 * A ficha do jeito que o navegador pode ver. O que fica FORA é o que mais
 * importa: os números por bairro da ficha canônica. Eles são a verdade do
 * mundo, e mandá-los daria ao aluno, de graça, a resposta que a missão existe
 * para ele não ter. `totais` entra porque é o enunciado.
 */
export const FichaPublicaSchema = z.object({
  titulo: z.string(),
  chamada: z.string(),
  contexto: z.string(),
  equipes: z.array(
    z.object({ id: z.string(), nome: z.string(), base: z.string(), descricao: z.string() }),
  ),
  totais: z.object({
    populacao: z.number(),
    expostos: z.number(),
    vulneraveis: z.number(),
    danosMi: z.number(),
  }),
});

/**
 * O que a decisão PROJETA — a partir do que o aluno enxerga, nunca da verdade
 * oculta. Usar aqui a média real da simulação daria um placar antes da decisão:
 * bastaria varrer as combinações, e a Missão passaria a ter resposta certa.
 */
export const ProjecaoSchema = z.object({
  rotas: z.array(
    z.object({
      equipe: EquipeSchema,
      bairro: z.string().nullable(),
      nome: z.string().nullable(),
      minutos: z.number().nullable(),
      passa: z.boolean(),
      aviso: z.string().nullable(),
    }),
  ),
  atendidas: z.number().nullable(),
  /** A MENOR confiança entre os bairros escolhidos, como RÓTULO. Era média de
   *  pesos exibida como "85%" — precisão inventada, o tipo de número falso que
   *  a Missão inteira combate. */
  confianca: ConfiancaSchema.nullable(),
  equipesOciosas: z.number(),
  avisos: z.array(z.string()),
});

export const OpcoesDeJustificativaSchema = z.array(
  z.object({ valor: z.string(), rotulo: z.string() }),
);

export const OrcamentoSchema = z.object({
  gastas: z.number().int().nonnegative(),
  teto: z.number().int().positive(),
});

/** A leitura do modelo numa rodada. O `nome` técnico dos conjuntos e o viés
 *  deles NÃO entram: são o instrumento, e material do debate do professor. */
export const RodadaDoModeloSchema = z.object({
  modelo: z.string(),
  conjuntos: z.array(z.string()),
  coberturaDaCidade: z.number(),
  estimativas: z.array(EstimativaSchema),
  pontosCegos: z.array(z.string()),
  conflitos: z.array(
    z.object({
      bairro: z.string(),
      infla: z.object({ fonte: z.string(), comoFalar: z.string(), pessoas: z.number() }),
      encolhe: z.object({ fonte: z.string(), comoFalar: z.string(), pessoas: z.number() }),
    }),
  ),
  /** Bairros que a margem não separa: a ordem da tabela **não é ranking**. */
  empates: z.array(z.array(z.string())),
  efeito: z
    .object({
      fonte: z.string(),
      mudou: z.array(z.object({ bairro: z.string(), de: z.number(), para: z.number() })),
    })
    .nullable(),
  /** Ordenação por gente em risco. NÃO é recomendação de alocação: o modelo não
   *  sabe onde a equipe chega, e nunca decide. */
  tendencia: z.array(z.string()),
  aviso: z.string(),
});

export const AnexoSchema = z.union([
  z.object({ tipo: z.literal("tendencia"), rodada: RodadaDoModeloSchema, hora: z.string() }),
  z.object({
    tipo: z.literal("alocacao"),
    alfa: z.string().nullable(),
    bravo: z.string().nullable(),
  }),
  z.object({
    tipo: z.literal("opcoes"),
    /** Só os slugs: o número que o botão mostra sai do MOTOR, nunca da LLM. */
    opcoes: z.array(z.object({ alfa: z.string(), bravo: z.string() })),
    rodada: RodadaDoModeloSchema,
    hora: z.string(),
  }),
]);

export const SessaoDoAlunoSchema = z.object({
  ficha: FichaPublicaSchema,
  projecao: ProjecaoSchema,
  sessao: SessaoPublicaSchema,
  relogio: RelogioPublicoSchema,
  estado: EstadoDoRelogioSchema,
  mapa: z.array(BairroPublicoSchema),
  conversa: z.array(
    z.object({
      papel: z.enum(["aluno", "agente"]),
      texto: z.string(),
      anexo: AnexoSchema.nullable(),
    }),
  ),
  orcamento: OrcamentoSchema,
  justificativas: OpcoesDeJustificativaSchema,
});

export const RelogioDoAlunoSchema = z.object({
  relogio: RelogioPublicoSchema,
  estado: EstadoDoRelogioSchema,
});

export const TurnoDoCientistaSchema = z.object({
  texto: z.string(),
  anexo: AnexoSchema.nullable(),
  sessao: SessaoPublicaSchema,
  relogio: RelogioPublicoSchema,
  mapa: z.array(BairroPublicoSchema),
  orcamento: OrcamentoSchema,
  justificativas: OpcoesDeJustificativaSchema,
});

/** O retorno de `PUT /conjuntos`: carregar fonte muda o MAPA (as estimativas
 *  passam a cobrir bairros) e as justificativas disponíveis. */
export const EstadoDoJogoSchema = z.object({
  sessao: SessaoPublicaSchema,
  mapa: z.array(BairroPublicoSchema),
  justificativas: OpcoesDeJustificativaSchema,
});

/**
 * O retorno de `POST /alocacao`. Traz a PROJEÇÃO e não o mapa: mudar o destino
 * não muda o que o modelo enxerga — muda o que a decisão projeta.
 *
 * "Chega com N de sobra" vem do servidor: sem isso o Cientista registraria um
 * destino inalcançável sem uma palavra, e o aluno só descobriria no desfecho,
 * quando já não dá para escolher diferente.
 */
export const AlocacaoFeitaSchema = z.object({
  sessao: SessaoPublicaSchema,
  projecao: ProjecaoSchema,
});

const DesfechoSchema = z.object({
  v: z.literal(1),
  porBairro: z.array(
    z.object({
      bairro: z.string(),
      nome: z.string(),
      severo: z.boolean(),
      emRisco: z.number(),
      equipe: EquipeSchema.nullable(),
      chegou: z.boolean(),
      /** Por que não chegou, quando não chegou. É a lição sobre logística. */
      motivo: z.string().nullable(),
      salvas: z.number(),
      vitimas: z.number(),
    }),
  ),
  totais: z.object({
    emRisco: z.number(),
    salvas: z.number(),
    semSocorro: z.number(),
    vitimas: z.number(),
  }),
});

/** A FAIXA é a manchete: corridas da MESMA decisão, para "não repete igual"
 *  sair do texto e virar gráfico. */
const EsperadoSchema = z.object({
  media: z.number(),
  faixa: z.tuple([z.number(), z.number()]),
  vitimasMedia: z.number(),
  vitimasFaixa: z.tuple([z.number(), z.number()]),
  /** Corridas de verdade do mesmo modelo, não ruído decorativo. */
  amostras: z.array(z.number()),
});

export const ResultadoSchema = z.object({
  desfecho: DesfechoSchema,
  esperado: EsperadoSchema,
  minutoDaSaida: z.number(),
  /** Um FATO com nome de bairro e número de pessoas — **não um veredito**.
   *  Quem transforma fato em lição é o professor, no debate. */
  sobrou: z
    .object({ nome: z.string(), pessoas: z.number(), fonte: z.string().nullable() })
    .nullable(),
  /** A lista do que ele NUNCA consultou — a peça mais forte do fechamento. O
   *  `nome` técnico, o viés e a cobertura ficam de fora: são o instrumento. */
  naoConsultados: z.array(
    z.object({
      slug: z.string(),
      comoFalar: z.string(),
      rotuloCurto: z.string(),
      serve: z.string(),
    }),
  ),
  tentativas: z.array(
    z.object({
      ordem: z.number(),
      alocacao: z.object({ alfa: z.string().nullable(), bravo: z.string().nullable() }),
      minutoDaSaida: z.number(),
      emRisco: z.number(),
      salvas: z.number(),
      vitimas: z.number(),
      desfecho: DesfechoSchema,
      esperado: EsperadoSchema,
    }),
  ),
  trilha: z.array(z.unknown()),
  justificativas: z.object({ alfa: z.string().nullable(), bravo: z.string().nullable() }),
});

/** "E se eu tivesse mandado para…". **Não grava e não debita.** */
export const ContrafactualRespostaSchema = z.object({
  alocacao: z.object({ alfa: z.string().nullable(), bravo: z.string().nullable() }),
  media: z.number(),
  faixa: z.tuple([z.number(), z.number()]),
});

/** `passo` e `reiniciar` devolvem só a sessão — a tela recarrega o resto. */
export const SoASessaoSchema = z.object({ sessao: SessaoPublicaSchema });

// ==================================== professor e gestor ====================

const Uuid = z.string().uuid();

export const AcaoDoRelogioSchema = z.object({
  acao: z.enum([
    "largada",
    "mais-tempo",
    "encerrar",
    "modo-livre",
    "modo-cronometrado",
    "redefinir",
  ]),
});

export const TurmasDoUnoogptSchema = z.object({
  turmas: z.array(
    z.object({
      id: Uuid,
      nome: z.string(),
      serie: z.string(),
      alunos: z.number().int().nonnegative(),
    }),
  ),
});

export const RelogioDoProfessorSchema = RelogioPublicoSchema.extend({
  fase: z.string(),
  minutosGastos: z.number(),
  segundosAteFechar: z.number().nullable(),
  motivoDoFim: z.string().nullable(),
  incrementoSeg: z.number(),
});

/**
 * A folha da turma. O RETRATO fala de **conduta, não de nota** — e é por isso
 * que ele conta "decidiram no escuro" e "justificaram por intuição" em vez de
 * somar acertos: a Missão não tem resposta certa.
 */
export const TurmaDoProfessorSchema = z.object({
  turma: z.object({ id: Uuid, nome: z.string(), serie: z.string() }),
  relogio: RelogioDoProfessorSchema,
  retrato: z.object({
    alunos: z.number().int().nonnegative(),
    comecaram: z.number().int().nonnegative(),
    concluiram: z.number().int().nonnegative(),
    viramConflito: z.number().int().nonnegative(),
    decidiramNoEscuro: z.number().int().nonnegative(),
    justificaramPorIntuicao: z.number().int().nonnegative(),
  }),
  linhas: z.array(
    z.object({
      alunoId: Uuid,
      nome: z.string(),
      usuario: z.string(),
      comecou: z.boolean(),
      concluiu: z.boolean(),
      fontesDistintas: z.number().int().nonnegative(),
      leituras: z.number().int().nonnegative(),
      viuConflito: z.boolean(),
      decidiuNoEscuro: z.boolean(),
      justificouPorIntuicao: z.boolean(),
      tentativas: z.number().int().nonnegative(),
    }),
  ),
});

/**
 * O mesmo invariante da Vila, aqui também: **número só com `grau: "scored"`**.
 * `zero` ("teve a chance e não foi") nunca se confunde com `none` ("a
 * oportunidade não chegou") — é a distinção mais importante do modelo, e ela
 * está no TIPO, não numa regra de tela.
 */
export const LinhaDeLeituraDoUnoogptSchema = z.union([
  z.object({
    conduta: z.enum(CONDUTAS),
    nome: z.string(),
    grau: z.literal("scored"),
    numero: z.number(),
    texto: z.string(),
    comportamento: z.string(),
    /** O que sustentou a linha — o painel responde "por quê". */
    porQue: z.array(z.string()),
  }),
  z.object({
    conduta: z.enum(CONDUTAS),
    nome: z.string(),
    grau: z.enum(["indicative", "zero", "none"]),
    numero: z.null(),
    texto: z.string(),
    comportamento: z.string(),
    porQue: z.array(z.string()),
  }),
]);

export const AlunoDoProfessorSchema = z.object({
  aluno: z.object({ id: Uuid, nome: z.string() }),
  versaoLeitura: z.number().int(),
  linhas: z.array(LinhaDeLeituraDoUnoogptSchema),
  porGrau: z.object({
    comNumero: z.number().int().nonnegative(),
    indicio: z.number().int().nonnegative(),
    zero: z.number().int().nonnegative(),
    naoObservado: z.number().int().nonnegative(),
  }),
  /** Frase única para o topo. **Nunca afirma o que o aluno É** — e partida
   *  curta some com o resto: dois minutos de jogo não sustentam frase. */
  resumo: z.string(),
  justificativas: z
    .object({ alfa: z.string(), bravo: z.string() })
    .nullable(),
  tentativas: z.array(z.unknown()),
  trilha: z.array(z.unknown()),
  /** A TRANSCRIÇÃO — o que a criança escreveu ao Cientista. Só o professor. */
  conversa: z.array(z.unknown()),
});

export const TurmaZeradaDoUnoogptSchema = z.object({
  partidasApagadas: z.number().int().nonnegative(),
  /** O relógio vai junto: rodar de novo com a aula "já começada" faria a
   *  segunda rodada nascer no meio da tempestade. */
  relogioRedefinido: z.literal(true),
});

/** O agregado do gestor: uma linha por turma, e **nada que identifique uma
 *  criança**. É a mesma separação da Vila, em controller próprio. */
export const AgregadoDaEscolaSchema = z.object({
  versaoLeitura: z.number().int(),
  turmas: z.array(
    z.object({
      turma: z.string(),
      serie: z.string(),
      partidas: z.number().int().nonnegative(),
      concluidas: z.number().int().nonnegative(),
    }),
  ),
});
