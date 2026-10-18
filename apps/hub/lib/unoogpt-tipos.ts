/**
 * Formas de LEITURA da exp02em1b, do jeito que as telas do professor as
 * recebem (`apps/api/src/unoogpt/*.controller.ts`).
 *
 * Só tipos. A regra que eles carregam, e que a tela precisa respeitar: a
 * LISTAGEM da turma não tem número de resgatados. Listagem é ordenável, e uma
 * coluna de resgate viraria ranking de crianças — o número vive na tela
 * individual, uma por vez. É a mesma regra da app-70.
 */
import type { EquipeNoPainel } from "./equipe-no-painel";

export interface RetratoDoRelogio {
  modo: "cronometrado" | "livre";
  iniciadoEm: string | null;
  duracaoSeg: number;
  encerradoEm: string | null;
  pivoSeg: number;
  pivoMin: number;
  agora: string;
  /** O professor abriu o fechamento (o WhatsApp e a moradora, ADR-172). */
  fechamentoAberto: boolean;
  fase: "aguardando" | "correndo" | "encerrado";
  minutosGastos: number;
  segundosAteFechar: number | null;
  motivoDoFim: "tempo" | "professor" | null;
  incrementoSeg: number;
}

/**
 * Uma linha da folha da turma. Conduta, nunca placar. É UM COMPUTADOR (E13):
 * sem equipes, a criança; com equipes, a linha de quem entrou, com `equipe`.
 */
export interface LinhaDaTurma {
  estudanteId: string;
  nome: string;
  usuario: string;
  comecou: boolean;
  concluiu: boolean;
  fontesDistintas: number;
  leituras: number;
  /** Viu duas fontes discordando sobre o mesmo bairro. É a aula em uma linha. */
  viuConflito: boolean;
  /** Definiu destino sem ter cruzado dado nenhum. */
  decidiuNoEscuro: boolean;
  justificouPorIntuicao: boolean;
  tentativas: number;
  /**
   * `null` = sem equipe nesta missão. Com equipe, os campos acima são de quem
   * entrou, e "Abrir" leva à tela dele. Não são as equipes Alfa e Bravo da
   * cidade: é quem divide o computador.
   */
  equipe: EquipeNoPainel | null;
}

export interface FolhaDaTurma {
  turma: { id: string; nome: string; serie: string };
  relogio: RetratoDoRelogio;
  /** O fechamento (ADR-172): aberto, e quantas linhas que chegaram ao resultado já o enviaram. */
  fechamento: { aberto: boolean; enviaram: number; de: number };
  /** O que cada grupo perguntou sobre cada fonte, no registro da operação: contagens para o debate. */
  perguntasPorFonte: { fonte: string; bairro: string; pergunta: string; grupos: number }[];
  /** A frase fixa do alcance do alerta: é do debate, nunca vai ao grupo. */
  alcanceDoAlerta: string;
  retrato: {
    estudantes: number;
    comecaram: number;
    concluiram: number;
    viramConflito: number;
    decidiramNoEscuro: number;
    justificaramPorIntuicao: number;
    /** A turma tem equipes nesta missão: `estudantes` e os demais contam computadores. */
    porComputador: boolean;
  };
  linhas: LinhaDaTurma[];
}

/**
 * Uma linha do relatório individual, em GRAUS.
 *
 * `numero` só existe quando `grau === "scored"`; nas outras variantes é `null`
 * POR TIPO. E `zero` ("teve a chance e não foi") nunca se confunde com `none`
 * ("a oportunidade não chegou") — é a distinção mais importante do modelo.
 */
export interface LinhaDeLeitura {
  conduta: string;
  nome: string;
  grau: "scored" | "indicative" | "zero" | "none";
  numero: number | null;
  texto: string;
  comportamento: string;
  porQue: string[];
}

export type MotivoDoFim = "tempo" | "professor" | null;

/** Um marco da trilha, com o relógio do INSTANTE em que foi gravado. */
export interface MarcoDaTrilha {
  tentativa: number;
  ordem: number;
  tipo: "fontes" | "leitura" | "alocacao" | "envio" | "inicio" | "recomeco";
  minuto: number;
  /** O cronômetro que o estudante via. Null = modo livre ou marco anterior à coluna. */
  segundosRestantes: number | null;
  motivoDoFim: MotivoDoFim;
  criadoEm: string;
  dados: unknown;
}

/**
 * Como a criança usou o TEMPO de uma tentativa — enfrentada ou não. Quem
 * recomeçou no meio não tem simulação, mas tem conversa e marcos, e aparece.
 */
export interface RodadaDoEstudante {
  tentativa: number;
  inicioEm: string | null;
  primeiraFalaEm: string | null;
  /** Dois relógios: antes da largada o campo está bloqueado, então "desde o
   *  Começar" mede o professor, não o estudante. */
  ateAPrimeiraFala: { desdeOComecar: number | null; desdeALargada: number | null } | null;
  /** Pares (alfa, bravo) consecutivos DISTINTOS antes do envio — não linhas. */
  mudancasDeDestino: number;
  enfrentou: boolean;
  envio: {
    em: string;
    minuto: number;
    segundosRestantes: number | null;
    motivoDoFim: MotivoDoFim;
    estourou: boolean;
  } | null;
  recomeco: {
    em: string;
    origem: "investigacao" | "resultado" | null;
    fase: "aguardando" | "correndo" | "encerrado" | null;
    modo: "cronometrado" | "livre" | null;
    segundosRestantes: number | null;
    motivoDoFim: MotivoDoFim;
  } | null;
}

/** O desfecho de uma tentativa, como o professor lê. Só na tela individual. */
export interface TentativaDoEstudante {
  ordem: number;
  alocacao: { alfa: string | null; bravo: string | null };
  minutoDaSaida: number;
  criadoEm: string;
  emRisco: number;
  salvas: number;
  vitimas: number;
  semSocorro: number;
  /** % do risco da cidade que os bairros escolhidos cobriam. Medida da decisão. */
  coberturaDoRisco: number | null;
  esperado: {
    media: number;
    faixa: [number, number];
    vitimasMedia: number;
    vitimasFaixa: [number, number];
    amostras: number[];
  };
  posicao: { percentil: number; dentroDaFaixa: boolean; acimaDaMedia: boolean };
  justificativas: { alfa: string; bravo: string } | null;
}

export interface RelatorioDoEstudante {
  estudante: { id: string; nome: string };
  versaoLeitura: number;
  linhas: LinhaDeLeitura[];
  porGrau: Record<string, number>;
  resumo: string;
  /** As da tentativa CORRENTE. Por tentativa, `tentativas[].justificativas`. */
  justificativas: { alfa: string; bravo: string } | null;
  tentativas: TentativaDoEstudante[];
  rodadas: RodadaDoEstudante[];
  /** As escolhas do Canal A, por tentativa (ADR-172): escolha fechada em texto, nunca o nível. */
  canalA: { tentativa: number; tarefa: string; escolhas: string[] }[];
  trilha: MarcoDaTrilha[];
  /**
   * A TRANSCRIÇÃO. Caixa livre escrita por menor de idade: só o professor da
   * escola chega aqui (não há rota de gestor), e ela nunca vai a log nem à
   * telemetria.
   */
  conversa: {
    papel: "estudante" | "agente";
    texto: string;
    tentativa: number;
    debitou: boolean;
    /** A hora em que o estudante APERTOU enviar, não o fim do turno. */
    criadoEm: string;
    /** "Aos 0:42 da aula". Null sem largada. */
    segundosDesdeALargada: number | null;
  }[];
}


/** Uma turma no seletor: o tipo é do `SeletorDeTurma`, compartilhado entre as missões. */
export type { TurmaResumo } from "./turmas-tipos";
