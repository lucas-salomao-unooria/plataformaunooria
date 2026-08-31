/**
 * Como a partida de um estudante deve ser LIDA pelo professor. PURO: sem Prisma,
 * sem React.
 *
 * Copiado de vila-coleta/lib/perfil/{mapeamento,leitura}.ts, com o mesmo
 * princípio e outro objeto de leitura: lá são valores de Schwartz a partir de
 * telemetria de jogo; aqui são condutas de investigação a partir da trilha da
 * decisão.
 *
 * O que foi copiado sem mudança, porque é o que protege o aluno:
 *
 *  - O SERVIDOR RECALCULA. Nada do que o navegador mandou vira leitura; tudo
 *    sai dos Marcos gravados.
 *  - VERSAO_LEITURA versiona a hipótese. Quando ela mudar, sobe a versão e o
 *    passado é reprocessado do bruto — guardar só o resultado tornaria toda
 *    partida anterior incomparável.
 *  - FONTES DISTINTAS, não linhas. Somar a mesma fonte duas vezes é um sinal,
 *    não dois.
 *  - zero ≠ none. "Teve a chance e não usou" e "a chance nunca chegou" viram
 *    frases diferentes, e essa é a distinção mais importante deste arquivo: um
 *    estudante cuja tempestade chegou antes de ele conseguir investigar não pode
 *    aparecer como alguém que se recusou a investigar.
 *
 * ISTO NÃO É AVALIAÇÃO. É o que a partida mostrou, para o professor conduzir o
 * debate — e a Missão inteira nega que exista resposta certa.
 */

/** Suba a cada mudança de conduta, portão ou frase. Nunca reescreva publicada. */
export const VERSAO_LEITURA = 1;

export const CONDUTAS = [
  'investigou',
  'cruzou',
  'percebeuConflito',
  'decidiuComBase',
  'iterou',
] as const;
export type Conduta = (typeof CONDUTAS)[number];

/**
 *  scored     ≥2 sinais independentes → o número vale e é publicado
 *  indicative  1 sinal → descrito em texto, SEM número
 *  zero        teve a oportunidade e não foi → zero de verdade
 *  none        a oportunidade não chegou → sai das médias, não é zero
 */
export type Grau = 'scored' | 'indicative' | 'zero' | 'none';

export const NOME_DA_CONDUTA: Record<Conduta, string> = {
  investigou: 'Buscou informação',
  cruzou: 'Cruzou os dados',
  percebeuConflito: 'Encarou fontes que discordam',
  decidiuComBase: 'Decidiu depois de olhar',
  iterou: 'Tentou de novo e comparou',
};

/** O que aconteceu na partida, em português de professor. */
export const EM_COMPORTAMENTO: Record<Conduta, string> = {
  investigou: 'pediu fontes diferentes antes de decidir',
  cruzou: 'mandou o modelo cruzar o que tinha carregado',
  percebeuConflito: 'seguiu com duas fontes que se contradiziam sobre o mesmo bairro',
  decidiuComBase: 'escolheu os bairros depois de ler alguma coisa, não antes',
  iterou: 'enfrentou a tempestade mais de uma vez e mudou a decisão',
};

/** O bruto de uma partida, extraído dos Marcos. Nada aqui vem do navegador. */
export interface SinaisDaPartida {
  /** Fontes DISTINTAS carregadas. Duas somas da mesma fonte contam uma vez. */
  fontesDistintas: number;
  /** Quantas vezes o modelo cruzou os dados. */
  leituras: number;
  /** Leituras em que havia fontes discordando de um mesmo bairro. */
  leiturasComConflito: number;
  /** Decidiu destino depois de pelo menos uma leitura? */
  decidiuDepoisDeLer: boolean;
  /** Chegou a definir destino? */
  decidiu: boolean;
  /** Tentativas enfrentadas até o fim. */
  tentativas: number;
  /** Resultados de cada tentativa, em ordem: usados para ver se comparou. */
  resgatadasPorTentativa: number[];
  /** A Missão chegou a começar? Sem isso, tudo é `none`, nunca `zero`. */
  comecou: boolean;
  /** Enfrentou a tempestade ao menos uma vez. */
  concluiu: boolean;
}

export interface LinhaDeLeitura {
  conduta: Conduta;
  nome: string;
  grau: Grau;
  /** número só quando `grau === 'scored'`; nos outros é deliberadamente null */
  numero: number | null;
  /** o que escrever quando não há número */
  texto: string;
  comportamento: string;
  /** o que sustentou a linha, para o painel responder "por quê" */
  porQue: string[];
}

function linha(
  conduta: Conduta,
  grau: Grau,
  numero: number | null,
  texto: string,
  porQue: string[],
): LinhaDeLeitura {
  return {
    conduta,
    nome: NOME_DA_CONDUTA[conduta],
    grau,
    numero: grau === 'scored' ? numero : null,
    texto,
    comportamento: EM_COMPORTAMENTO[conduta],
    porQue,
  };
}

/**
 * Traduz os sinais em linhas prontas de tela, com a decisão de mostrar número
 * já tomada AQUI. Se ficasse no componente, a primeira tela nova esqueceria —
 * e o esquecimento é silencioso: aparece um número onde não devia haver nenhum.
 */
export function linhasDeLeitura(s: SinaisDaPartida): LinhaDeLeitura[] {
  const semChance = (c: Conduta, motivo: string) => linha(c, 'none', null, motivo, []);

  if (!s.comecou) {
    return CONDUTAS.map((c) => semChance(c, 'não chegou a começar a Missão'));
  }

  return [
    s.fontesDistintas >= 2
      ? linha('investigou', 'scored', s.fontesDistintas, String(s.fontesDistintas), [
          `${s.fontesDistintas} fontes distintas carregadas`,
        ])
      : s.fontesDistintas === 1
        ? linha('investigou', 'indicative', null, 'uma fonte só — não dá para pôr número', [
            '1 fonte carregada',
          ])
        : linha('investigou', 'zero', null, 'teve a chance e não pediu nenhuma fonte', []),

    s.leituras >= 2
      ? linha('cruzou', 'scored', s.leituras, String(s.leituras), [`${s.leituras} cruzamentos`])
      : s.leituras === 1
        ? linha('cruzou', 'indicative', null, 'cruzou uma vez só', ['1 cruzamento'])
        : s.fontesDistintas > 0
          ? linha('cruzou', 'zero', null, 'carregou dado e não chegou a cruzar', [])
          : semChance('cruzou', 'sem fonte carregada, não havia o que cruzar'),

    // Conflito é a aula da Missão — mas ele só existe se as fontes escolhidas
    // discordarem. Quem nunca teve conflito na tela não recusou nada.
    s.leiturasComConflito >= 2
      ? linha('percebeuConflito', 'scored', s.leiturasComConflito, String(s.leiturasComConflito), [
          `${s.leiturasComConflito} leituras com fontes discordando`,
        ])
      : s.leiturasComConflito === 1
        ? linha('percebeuConflito', 'indicative', null, 'viu um conflito', [
            '1 leitura com conflito',
          ])
        : s.leituras > 0
          ? semChance('percebeuConflito', 'as fontes que ele escolheu não se contradisseram')
          : semChance('percebeuConflito', 'não chegou a cruzar dados'),

    s.decidiuDepoisDeLer
      ? linha('decidiuComBase', 'scored', 1, 'sim', ['destino definido depois de uma leitura'])
      : s.decidiu
        ? linha('decidiuComBase', 'zero', null, 'escolheu os bairros sem ter lido nada', [])
        : semChance('decidiuComBase', 'não chegou a escolher destino'),

    s.tentativas >= 2
      ? linha('iterou', 'scored', s.tentativas, String(s.tentativas), [
          `${s.tentativas} tentativas`,
          `resultados: ${s.resgatadasPorTentativa.join(' → ')}`,
        ])
      : s.tentativas === 1
        ? linha('iterou', 'zero', null, 'enfrentou uma vez e não tentou de novo', [])
        : semChance('iterou', 'não chegou a enfrentar a tempestade'),
  ];
}

export function contarPorGrau(linhas: LinhaDeLeitura[]) {
  return {
    comNumero: linhas.filter((l) => l.grau === 'scored').length,
    indicio: linhas.filter((l) => l.grau === 'indicative').length,
    zero: linhas.filter((l) => l.grau === 'zero').length,
    naoObservado: linhas.filter((l) => l.grau === 'none').length,
  };
}

/**
 * Frase única para o topo do relatório. Nunca afirma o que o estudante É.
 *
 * Partida curta some com o resto: dois minutos de jogo não sustentam frase
 * nenhuma, e é a frase do topo que o professor vai lembrar depois de fechar a
 * tela.
 */
export function resumoHonesto(s: SinaisDaPartida, linhas: LinhaDeLeitura[]): string {
  if (!s.comecou) return 'Este estudante ainda não começou a Missão.';
  if (!s.concluiu && s.leituras === 0 && !s.decidiu) {
    return 'A Missão começou e não chegou a virar decisão. Vale como tentativa, não como leitura.';
  }
  if (!s.concluiu) {
    return 'A Missão começou, mas ele não chegou a enfrentar a tempestade.';
  }
  const observadas = linhas.filter((l) => l.grau === 'scored' || l.grau === 'indicative');
  if (observadas.length === 0) {
    return 'A partida aconteceu, mas nada nela sustenta uma leitura.';
  }
  const zeros = linhas.filter((l) => l.grau === 'zero');
  if (zeros.length > 0) {
    return `O que mais apareceu: ${observadas[0]!.comportamento}. O que não apareceu, tendo chance: ${zeros[0]!.comportamento}.`;
  }
  return `O que mais apareceu nesta partida: ${observadas[0]!.comportamento}.`;
}
