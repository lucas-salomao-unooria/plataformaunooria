/**
 * Formas de LEITURA da exp-03-unoogpt, do jeito que as telas do professor as
 * recebem (`apps/api/src/unoogpt/*.controller.ts`).
 *
 * Só tipos. A regra que eles carregam, e que a tela precisa respeitar: a
 * LISTAGEM da turma não tem número de resgatados. Listagem é ordenável, e uma
 * coluna de resgate viraria ranking de crianças — o número vive na tela
 * individual, uma por vez. É a mesma regra da exp-70.
 */

export interface RetratoDoRelogio {
  modo: "cronometrado" | "livre";
  iniciadoEm: string | null;
  duracaoSeg: number;
  encerradoEm: string | null;
  pivoSeg: number;
  pivoMin: number;
  agora: string;
  fase: "aguardando" | "correndo" | "encerrado";
  minutosGastos: number;
  segundosAteFechar: number | null;
  motivoDoFim: "tempo" | "professor" | null;
  incrementoSeg: number;
}

/** Uma criança na folha da turma. Conduta, nunca placar. */
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
}

export interface FolhaDaTurma {
  turma: { id: string; nome: string; serie: string };
  relogio: RetratoDoRelogio;
  retrato: {
    estudantes?: number;
    alunos: number;
    comecaram: number;
    concluiram: number;
    viramConflito: number;
    decidiramNoEscuro: number;
    justificaramPorIntuicao: number;
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

export interface RelatorioDoEstudante {
  estudante?: { id: string; nome: string };
  aluno: { id: string; nome: string };
  versaoLeitura: number;
  linhas: LinhaDeLeitura[];
  porGrau: Record<string, number>;
  resumo: string;
  justificativas: { alfa: string; bravo: string } | null;
  tentativas: {
    ordem: number;
    alocacao: unknown;
    desfecho: unknown;
    minutoDaSaida: number;
    criadoEm: string;
  }[];
  trilha: {
    tentativa: number;
    ordem: number;
    tipo: string;
    minuto: number;
    dados: unknown;
  }[];
  /**
   * A TRANSCRIÇÃO. Caixa livre escrita por menor de idade: só o professor da
   * escola chega aqui (não há rota de gestor), e ela nunca vai a log nem à
   * telemetria.
   */
  conversa: {
    papel: string;
    texto: string;
    tentativa: number;
    debitou: boolean;
    criadoEm: string;
  }[];
}


/**
 * Uma turma no seletor. A forma tem de casar com a que `SeletorDeTurma` espera
 * (hoje declarada em `unootube-tipos.ts`) — o componente é compartilhado entre
 * as missões, e é ele que define o contrato.
 */
export interface TurmaResumo {
  id: string;
  nome: string;
  serie: string;
  estudantes?: number;
  alunos: number;
}
