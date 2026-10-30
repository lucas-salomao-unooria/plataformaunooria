/**
 * ESPELHO das respostas da api (`apps/api/src/unoogpt`). Só tipos — nenhuma
 * regra.
 *
 * Existe porque a experiência é um bundle estático e não pode importar da api.
 * O que este arquivo NÃO tem é tão importante quanto o que tem: nada de
 * `instrucao` (o viés de cada fonte), nada de `pSevero`/`expostosSevero` (os
 * parâmetros ocultos do mundo), nada dos números por bairro da ficha canônica.
 * Se um campo desses aparecer aqui, é porque vazou lá — e a missão inteira
 * existe para não entregá-los.
 *
 * Molde: `apps/experiencias/exp04ef1b/src/lib/tipos.ts`.
 */

export const EXP_ID = "exp02em1b-v0";
// Vai no handshake e em toda linha de telemetria. Divergiu do manifesto por
// tres publicacoes (1.0.0 aqui contra 1.1.1 la), e o efeito e caro de perceber:
// o dado de uso fica atribuido a uma versao que nao esta no ar, e a pergunta
// "esta regressao veio da versao X?" deixa de ter resposta. Sobe JUNTO com o
// `versao` do `public/experiencia.json`.
export const EXP_VERSION = "1.5.6";

/** Toda grandeza do modelo é FAIXA, nunca número seco. */
export interface Faixa {
  min: number;
  esperado: number;
  max: number;
}

export interface EstimativaDoBairro {
  bairro: string;
  cobertura: number;
  chanceDeEventoSevero: Faixa;
  pessoasEmRisco: Faixa;
  confianca: "alta" | "média" | "baixa";
  sustentadaPor: string[];
}

/**
 * Um bairro no mapa. `estimativa: null` é PONTO CEGO — nenhuma fonte carregada
 * o cobre. Não é zero, e a tela nunca pode escrever "0 pessoas em risco" aqui:
 * a verdade é "não sabemos". `tempos: null` = a malha viária não foi carregada.
 */
export interface BairroPublico {
  slug: string;
  nome: string;
  left: string;
  top: string;
  w: string;
  h: string;
  tempos: { alfa: number; bravo: number } | null;
  /**
   * Se cada equipe ALCANÇA este bairro antes da chuva. Vem do servidor: quem
   * responde é `chegaATempo`, que conhece o bloqueio de via e o prazo, e um
   * bundle capaz de calcular isso deixaria o estudante antecipar o desfecho.
   * `aperto` = chega, mas raspando. `null` sem a malha viária carregada.
   */
  alcance: {
    alfa: Alcance;
    bravo: Alcance;
  } | null;
  estimativa: EstimativaDoBairro | null;
}

export interface Alcance {
  passa: boolean;
  folga: number;
  aperto: boolean;
  motivo: string | null;
}

export interface SessaoPublica {
  passo: Passo;
  minutosGastos: number;
  conjuntos: string[];
  rodadas: number;
  perguntasGastas: number;
  tentativa: number;
  /** A rodada da TURMA em que a sessão nasceu: o "Zerar a turma" a sobe. */
  rodadaDaTurma: number;
  alocacao: { alfa: string | null; bravo: string | null };
  justificativas: { alfa: string | null; bravo: string | null };
  /** A ligação da Saúde já apareceu nesta tentativa (ADR-172). */
  ofertaSaude: boolean;
  /** O registro da operação está feito: só então o resultado aparece (ADR-172). */
  registroConcluido: boolean;
}

export const PASSOS = ["abertura", "orientacao", "investigacao", "resultado"] as const;
export type Passo = (typeof PASSOS)[number];

/**
 * O relógio da TURMA. `agora` é a hora do SERVIDOR: é dela que o cronômetro
 * parte, senão o relógio da máquina da escola (que atrasa) decide quanto tempo
 * a turma tem.
 */
export interface RelogioPublico {
  modo: "cronometrado" | "livre";
  iniciadoEm: string | null;
  duracaoSeg: number;
  encerradoEm: string | null;
  pivoSeg: number;
  pivoMin: number;
  agora: string;
  /** O professor abriu o fechamento (o WhatsApp e a moradora, ADR-172). */
  fechamentoAberto: boolean;
}

/**
 * O estado derivado do relógio, calculado PELA API.
 *
 * A experiência não recalcula o minuto da cidade: ela mostra o que veio e
 * ressincroniza no polling. O projeto de origem tinha a matemática do pivô no
 * cliente também, e duas cópias de uma conta que já é sutil (esticar a aula sem
 * rebobinar a chuva) são duas chances de divergir. O único cálculo local é a
 * contagem regressiva em segundos — que é desenho, não medida.
 */
export interface EstadoDoRelogio {
  fase: "aguardando" | "correndo" | "encerrado";
  aberta: boolean;
  segundosAteFechar: number | null;
  minutosGastos: number;
  motivoDoFim: "tempo" | "professor" | null;
}

/** A ficha da missão. SEM os números por bairro — ver `sanitizarFicha`. */
export interface FichaPublica {
  titulo: string;
  chamada: string;
  contexto: string;
  equipes: { id: string; nome: string; base: string; descricao: string }[];
  totais: { populacao: number; expostos: number; vulneraveis: number; danosMi: number };
}

/**
 * A rodada do modelo, como ela chega no cartão. Três invariantes que são o
 * produto: nunca número seco (tudo é faixa), nunca recomendação (há
 * `tendencia`, que é ordenação, não "aloque aqui"), e ponto cego é resposta.
 */
/**
 * Onde as fontes carregadas BRIGAM sobre o mesmo bairro.
 *
 * O momento em que o cadastro diz 790 e o satélite diz 2.740 sobre a mesma rua
 * é a aula inteira em uma linha. `comoFalar` é o jeito de a fonte ser nomeada em
 * voz alta ("o cadastro de moradores"); `pessoas` é quanto ELA SOZINHA diria.
 */
export interface Conflito {
  bairro: string;
  infla: { fonte: string; comoFalar: string; pessoas: number };
  encolhe: { fonte: string; comoFalar: string; pessoas: number };
}

export interface RodadaDoModelo {
  modelo: string;
  conjuntos: string[];
  coberturaDaCidade: number;
  estimativas: EstimativaDoBairro[];
  pontosCegos: string[];
  conflitos: Conflito[];
  empates: string[][];
  /** O que a última fonte mudou, por SUBTRAÇÃO — não por narrativa. */
  efeito: { fonte: string; mudou: { bairro: string; de: number; para: number }[] } | null;
  /** Ordenação por gente em risco. NÃO é recomendação de alocação. */
  tendencia: string[];
  aviso: string;
}

/** O que `agruparEmpatados` aceita: qualquer coisa com faixa e uma chave. */
export interface Empatavel {
  chave: string;
  esperado: number;
  min: number;
  max: number;
}

export interface DesfechoDoBairro {
  bairro: string;
  nome: string;
  severo: boolean;
  emRisco: number;
  equipe: "alfa" | "bravo" | null;
  chegou: boolean;
  motivo: string | null;
  salvas: number;
  vitimas: number;
}

export interface Desfecho {
  v: 1;
  porBairro: DesfechoDoBairro[];
  totais: { emRisco: number; salvas: number; semSocorro: number; vitimas: number };
}

/**
 * A projeção da alocação atual, calculada NO SERVIDOR.
 *
 * Ela usa `chegaATempo` e a capacidade da equipe — matemática do modelo. Um
 * bundle capaz de computar isso deixaria o estudante prever o desfecho antes de
 * enviar, e a missão perderia o ponto.
 */
export interface Rota {
  equipe: "alfa" | "bravo";
  bairro: string | null;
  nome: string | null;
  minutos: number | null;
  passa: boolean;
  aviso: string | null;
}

export interface Projecao {
  rotas: Rota[];
  atendidas: number | null;
  confianca: "alta" | "média" | "baixa" | null;
  equipesOciosas: number;
  avisos: string[];
}

/** O cartão que acompanha uma fala do Cientista na Transcrição. */
export type Anexo =
  | { tipo: "tendencia"; rodada: RodadaDoModelo; hora: string }
  | { tipo: "alocacao"; alfa: string | null; bravo: string | null }
  | { tipo: "opcoes"; opcoes: { alfa: string; bravo: string }[]; rodada: RodadaDoModelo; hora: string }
  /**
   * O desfecho, quando a tempestade foi enfrentada NESTE turno. Tipado por
   * inteiro de propósito: com um índice `[extra: string]: unknown` o
   * `anexo.desfecho` chegava como `unknown` ao cartão, e o componente passava a
   * confiar num cast em vez do contrato.
   */
  | {
      tipo: "desfecho";
      desfecho: Desfecho;
      esperado: { media: number; faixa: readonly [number, number] };
      naoConsultados: { comoFalar: string; rotuloCurto: string; serve: string }[];
    };

export interface Fala {
  papel: "estudante" | "agente";
  texto: string;
  anexo: Anexo | null;
}

export interface OpcaoDeJustificativa {
  valor: string;
  rotulo: string;
}

/** `GET /unoogpt/sessao` — o bootstrap da tela. */
export interface RespostaSessao {
  ficha: FichaPublica;
  projecao: Projecao;
  sessao: SessaoPublica;
  relogio: RelogioPublico;
  estado: EstadoDoRelogio;
  mapa: BairroPublico[];
  conversa: Fala[];
  orcamento: { gastas: number; teto: number };
  justificativas: OpcaoDeJustificativa[];
}

/** `GET /unoogpt/relogio` — o polling, leve de propósito. */
export interface RespostaRelogio {
  relogio: RelogioPublico;
  estado: EstadoDoRelogio;
}

/** `POST /unoogpt/pergunta` — um turno do Cientista. */
export interface RespostaTurno {
  texto: string;
  anexo: Anexo | null;
  /** Ele confirmou na conversa: abrir a decisão com "Enviar equipes" (ADR-172). */
  abrirEnvio: boolean;
  sessao: SessaoPublica;
  relogio: RelogioPublico;
  mapa: BairroPublico[];
  orcamento: { gastas: number; teto: number };
  justificativas: OpcaoDeJustificativa[];
}

/** `PUT /unoogpt/conjuntos` e `POST /unoogpt/alocacao`. */
export interface RespostaEstado {
  sessao: SessaoPublica;
  mapa?: BairroPublico[];
  projecao?: Projecao;
  justificativas?: OpcaoDeJustificativa[];
}

export interface MarcoDaTrilha {
  tentativa: number;
  ordem: number;
  tipo: "fontes" | "leitura" | "alocacao" | "envio";
  minuto: number;
  /** Payload POR TIPO (ver `regras/trilha.ts` da api). Só dado público. */
  dados: Record<string, unknown>;
}

/** O par de destinos de uma partida. */
export interface Alocacao {
  alfa: string | null;
  bravo: string | null;
}

/**
 * Uma tentativa enfrentada, com o desfecho e a faixa DELA.
 *
 * Comparar duas é a lição sobre variância: a mesma cidade dá números
 * diferentes, e recomeçar abre tentativa nova em vez de apagar a anterior
 * justamente para essa comparação existir.
 */
export interface Tentativa {
  ordem: number;
  alocacao: Alocacao;
  minutoDaSaida: number;
  emRisco: number;
  salvas: number;
  vitimas: number;
  desfecho: Desfecho;
  esperado: {
    media: number;
    faixa: readonly [number, number];
    vitimasMedia: number;
    vitimasFaixa: readonly [number, number];
    amostras: number[];
  };
}

/**
 * `GET /unoogpt/resultado` — a faixa é a manchete.
 *
 * `naoConsultados` NÃO traz o `nome` técnico da fonte: o catálogo da api é
 * explícito de que ele "aparece no painel do professor, nunca para o estudante".
 * E não traz `instrucao`, `vies` nem `cobertura` — esses são o instrumento.
 */
export interface RespostaResultado {
  desfecho: Desfecho;
  esperado: {
    media: number;
    faixa: readonly [number, number];
    vitimasMedia: number;
    vitimasFaixa: readonly [number, number];
    /** Corridas da MESMA decisão. É a variância vista, não afirmada. */
    amostras: number[];
  };
  minutoDaSaida: number;
  /** Um FATO com nome de bairro e número de pessoas — não um veredito. */
  sobrou: { nome: string; pessoas: number; fonte: string | null } | null;
  naoConsultados: { slug: string; comoFalar: string; rotuloCurto: string; serve: string }[];
  tentativas: Tentativa[];
  trilha: MarcoDaTrilha[];
  justificativas: { alfa: string | null; bravo: string | null };
}

/** Os códigos de erro de jogo da api (`src/unoogpt/erros.ts`). */
export type CodigoErro =
  | "sessao-encerrada"
  | "relogio-nao-comecou"
  | "relogio-encerrado"
  | "sem-perguntas"
  | "falta-justificar"
  | "bairro-desconhecido"
  | "ja-simulou"
  | "passo-invalido"
  | "teto-da-sessao"
  | "cientista-indisponivel"
  | "payload-invalido"
  | "sem-destino"
  | "registro-pendente"
  | "fechamento-fechado"
  | "fechamento-aberto";

// ── o Canal A (ADR-172): o que a api devolve, sem gabarito e sem nível ─────

/** Uma opção de escolha fechada: o `id` é o que volta para a api. */
export interface Opcao {
  id: string;
  texto: string;
}

/** `GET|POST /unoogpt/saude` — a ligação da Secretaria de Saúde. */
export interface RespostaSaude {
  ofertada: boolean;
  respondida: boolean;
  texto: string;
  opcoes: Opcao[];
  entrega: { contagem: { bairro: string; pessoas: number }[] | null; aviso: string | null } | null;
}

/** `GET /unoogpt/registro` e `POST /unoogpt/mandar` — o registro da operação. */
export interface RespostaRegistro {
  concluido: boolean;
  leitura: {
    enviada: boolean;
    tabela: { bairro: string; nome: string; min: number; esperado: number; max: number }[];
    pares: { id: string; pergunta: string; opcoes: Opcao[] }[];
  } | null;
  fontes: { enviada: boolean; cartoes: { id: string; texto: string }[]; perguntas: Opcao[] } | null;
  alerta: { enviada: boolean; enunciado: string; partes: { id: string; titulo: string; opcoes: Opcao[] }[] } | null;
}

/** Quem resgatou mais naquela tempestade. */
export type Quadradinho = "referencia" | "outra" | "empate";

/** `GET|POST /unoogpt/e-se` — duas comparações nas mesmas 20 tempestades. */
export interface RespostaESe {
  enviada: boolean;
  opcoes?: Opcao[];
  comparacoes:
    | {
        id: string;
        pergunta: string;
        referencia: { alfa: string; bravo: string; sua: boolean };
        outra: { alfa: string; bravo: string };
        quadradinhos: Quadradinho[];
      }[]
    | null;
}

/** `GET|POST /unoogpt/fechamento` — o WhatsApp e a moradora. */
export interface RespostaFechamento {
  whatsapp: {
    enviada: boolean;
    mensagem: string;
    perguntaDaResposta: string;
    respostas: Opcao[];
    perguntaDoAviso: string;
    avisos: Opcao[];
  };
  moradora: { enviada: boolean; enunciado: string; partes: { id: string; titulo: string; opcoes: Opcao[] }[] };
}
