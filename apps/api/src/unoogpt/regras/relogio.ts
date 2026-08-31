/**
 * O Relogio (ADR-0005). A escassez que ensina "nao da para testar
 * indefinidamente" e a tempestade chegando, nao um numero de app.
 *
 * O tempo CORRE SOZINHO: cinco minutos de parede valem a hora do cenario.
 * Antes cada Pergunta custava 4 minutos, e parar para pensar era de graca -
 * o que premiava ler devagar e transformava a Missao num contador de
 * mensagens disfarcado. Agora a restricao e uma so, e ela e honesta: o tempo.
 *
 * PURO: sem Prisma. Recebe minutos gastos (ou o instante de inicio) e responde.
 */
export const RELOGIO = {
  /** Decisao as 17h00. */
  inicioHora: 17,
  /** A tempestade chega as 18h00. */
  minutosTotais: 60,
  /** A hora do cenario cabe em cinco minutos de relogio de parede. */
  duracaoRealEmSegundos: 300,
} as const;

/**
 * O relogio da TURMA (nao mais o de cada estudante).
 *
 * Antes o cronometro armava sozinho quando o estudante entrava na Investigacao, e
 * cada um comecava quando abria o link. Numa sala isso e uma corrida com
 * largadas diferentes: quem chegou primeiro terminava antes de o professor
 * acabar de explicar. Agora quem da a partida e o professor, e ela vale para
 * todo mundo ao mesmo tempo.
 *
 * `iniciadoEm` nulo = ainda nao comecou: o estudante ve o cronometro parado e nao
 * consegue falar com o Cientista.
 */
export type ModoDoRelogio = 'cronometrado' | 'livre';
export type FaseDoRelogio = 'aguardando' | 'correndo' | 'encerrado';

export interface RelogioDaTurma {
  modo: ModoDoRelogio;
  iniciadoEm: Date | null;
  duracaoSeg: number;
  encerradoEm: Date | null;
  /** Segundos de parede no instante da ultima extensao. Ver `minutoNarrativo`. */
  pivoSeg: number;
  /** Minuto da cidade naquele instante. */
  pivoMin: number;
}

export const RELOGIO_PADRAO: RelogioDaTurma = {
  modo: 'cronometrado',
  iniciadoEm: null,
  duracaoSeg: RELOGIO.duracaoRealEmSegundos,
  encerradoEm: null,
  pivoSeg: 0,
  pivoMin: 0,
};

export interface EstadoDoRelogio {
  fase: FaseDoRelogio;
  /** Minuto da cidade, 0..60. Sempre monotonico. */
  minutosGastos: number;
  /** Null so no modo livre correndo: nao ha contagem regressiva. */
  segundosAteFechar: number | null;
  /** O estudante pode falar com o Cientista? */
  aberta: boolean;
  motivoDoFim: 'tempo' | 'professor' | null;
}

/**
 * O minuto da cidade, esticado junto com a duracao.
 *
 * A chuva cai no fim do cronometro, seja ele de cinco ou de sete minutos: quem
 * ganha tempo do professor ganha uma hora da cidade mais lenta, nao uma
 * investigacao debaixo d'agua. Assim `saidaDasEquipes` continua devolvendo um
 * minuto real de decisao, e a licao de chegar a tempo fica intacta.
 *
 * O problema de esticar no MEIO da aula e o relogio voltar atras: aos 4:00 de
 * 5:00 o estudante esta no minuto 48, e recalcular com 7:00 daria 34. Por isso o
 * PIVO: quando o professor soma tempo, guardamos onde o relogio estava, e ele
 * continua dali, mais devagar, chegando as 18h00 no novo fim. Sem extensao a
 * formula degenera em `60 * decorridos / duracao`, que e o comportamento de
 * sempre.
 */
export function minutoNarrativo(
  decorridosSeg: number,
  duracaoSeg: number,
  pivo: { seg: number; min: number },
): number {
  if (decorridosSeg <= pivo.seg) return pivo.min;
  const restoNarrativo = RELOGIO.minutosTotais - pivo.min;
  const restoParede = duracaoSeg - pivo.seg;
  if (restoParede <= 0) return RELOGIO.minutosTotais;
  return Math.min(
    RELOGIO.minutosTotais,
    pivo.min + Math.floor((restoNarrativo * (decorridosSeg - pivo.seg)) / restoParede),
  );
}

/** Tudo o que a tela e o portao precisam saber, numa conta so. */
export function estadoDoRelogio(
  relogio: RelogioDaTurma = RELOGIO_PADRAO,
  agora: Date = new Date(),
): EstadoDoRelogio {
  const { iniciadoEm, duracaoSeg, encerradoEm, modo } = relogio;
  const pivo = { seg: relogio.pivoSeg, min: relogio.pivoMin };

  if (!iniciadoEm) {
    return {
      fase: 'aguardando',
      minutosGastos: 0,
      segundosAteFechar: modo === 'livre' ? null : duracaoSeg,
      aberta: false,
      motivoDoFim: null,
    };
  }

  const decorridos = Math.max(0, (agora.getTime() - iniciadoEm.getTime()) / 1000);

  if (encerradoEm) {
    const ate = Math.max(0, (encerradoEm.getTime() - iniciadoEm.getTime()) / 1000);
    return {
      fase: 'encerrado',
      minutosGastos: minutoNarrativo(Math.min(decorridos, ate), duracaoSeg, pivo),
      segundosAteFechar: 0,
      aberta: false,
      motivoDoFim: 'professor',
    };
  }

  if (modo === 'livre') {
    return {
      fase: 'correndo',
      minutosGastos: minutoNarrativo(decorridos, duracaoSeg, pivo),
      segundosAteFechar: null,
      aberta: true,
      motivoDoFim: null,
    };
  }

  const falta = duracaoSeg - decorridos;
  return {
    fase: falta > 0 ? 'correndo' : 'encerrado',
    minutosGastos: minutoNarrativo(decorridos, duracaoSeg, pivo),
    segundosAteFechar: Math.max(0, falta),
    aberta: falta > 0,
    motivoDoFim: falta > 0 ? null : 'tempo',
  };
}

/**
 * O pivo a gravar quando o professor soma tempo. Guarda ONDE o relogio estava
 * antes de a duracao mudar — sem isto o minuto da cidade volta atras.
 */
export function pivoParaEstender(
  relogio: RelogioDaTurma,
  agora: Date = new Date(),
): { pivoSeg: number; pivoMin: number } {
  if (!relogio.iniciadoEm) return { pivoSeg: 0, pivoMin: 0 };
  const decorridos = Math.max(0, (agora.getTime() - relogio.iniciadoEm.getTime()) / 1000);
  return {
    pivoSeg: Math.floor(decorridos),
    pivoMin: minutoNarrativo(decorridos, relogio.duracaoSeg, {
      seg: relogio.pivoSeg,
      min: relogio.pivoMin,
    }),
  };
}

/**
 * A investigacao vai ate a chuva. Cinco minutos, e pronto.
 *
 * Houve uma versao que guardava 20 minutos de "reserva de deslocamento" e
 * fechava a investigacao as 17h40. Era uma segunda regra para o estudante decorar,
 * e o cronometro dizia 3:20 enquanto a tela dizia 5 minutos. O deslocamento
 * agora e absorvido pela operacao: sair tarde nao tira tempo de ninguem, so
 * faz a equipe render menos quando chega (lib/modelo/tempestade.ts).
 */
export const LIMITE_DE_INVESTIGACAO = RELOGIO.minutosTotais;

export function minutosRestantes(gastos: number): number {
  return Math.max(0, RELOGIO.minutosTotais - gastos);
}

export function podePerguntar(estado: EstadoDoRelogio): boolean {
  return estado.aberta;
}

/** A que horas as equipes saem: a hora em que o estudante confirmou, nunca depois da chuva. */
export function saidaDasEquipes(gastos: number): number {
  return Math.min(gastos, RELOGIO.minutosTotais);
}

/**
 * Quanto falta para a tempestade, em texto: "1 h", "32 min", "agora".
 *
 * A tela mostra CONTAGEM REGRESSIVA, não a hora corrente: "Tempestade em 17h28"
 * lê como se a tempestade fosse às 17h28, quando 17h28 é o relógio andando. O
 * que aperta o estudante é o quanto falta.
 */
export function faltaTexto(gastos: number): string {
  const faltam = minutosRestantes(gastos);
  if (faltam <= 0) return 'agora';
  if (faltam >= 60) return '1 h';
  return `${faltam} min`;
}

/**
 * O cronometro no instante: "3:40". Recebe SEGUNDOS que faltam, nao minutos da
 * cidade — com a duracao decidida pelo professor, a escala entre uma coisa e
 * outra deixou de ser constante.
 */
export function cronometroDe(segundosQueFaltam: number): string {
  // Arredonda ANTES de dividir. Arredondar o resto separadamente produzia
  // "3:60" quando faltavam 239,7 segundos: o minuto vinha do piso e o segundo
  // do arredondamento, e os dois discordavam.
  const faltam = Math.max(0, Math.ceil(segundosQueFaltam));
  return `${Math.floor(faltam / 60)}:${String(faltam % 60).padStart(2, '0')}`;
}

/**
 * Com que relogio datar uma leitura da conversa.
 *
 * Normalmente e a contagem regressiva, que e o unico relogio que o estudante ve.
 * Sem cronometro (o professor deixou a aula sem tempo marcado) nao ha contagem
 * para mostrar, e ai vale a hora da cidade — o motivo do ADR-0005 para evitá-la
 * era obrigar o estudante a converter DUAS escalas ao mesmo tempo, e nesse modo so
 * existe uma.
 */
export function horaDoCartao(estado: EstadoDoRelogio): string {
  return estado.segundosAteFechar === null
    ? horaDaTela(estado.minutosGastos)
    : cronometroDe(estado.segundosAteFechar);
}

/** Hora corrente da cidade. Só o painel do professor usa: "17h24". */
export function horaDaTela(gastos: number): string {
  const total = RELOGIO.inicioHora * 60 + Math.min(gastos, RELOGIO.minutosTotais);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

/**
 * Motivo escrito ao lado do campo desabilitado - nunca sumir o campo. O estudante
 * precisa entender POR QUE nao da para falar: se acabou o tempo, se a aula
 * ainda nao comecou ou se o professor encerrou. As tres frases sao autoradas.
 */
export function motivoDeBloqueio(estado: EstadoDoRelogio): string | null {
  if (estado.aberta) return null;
  if (estado.fase === 'aguardando') {
    return 'A missão ainda não começou. Espere o professor liberar.';
  }
  if (estado.motivoDoFim === 'professor') {
    return 'O professor encerrou a investigação. Mande as equipes.';
  }
  return 'São 18h00. A chuva chegou e não dá mais para investigar.';
}
