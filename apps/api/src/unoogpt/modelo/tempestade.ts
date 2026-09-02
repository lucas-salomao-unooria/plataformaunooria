import { MISSAO_TEMPESTADE } from '../cenario';
import {
  CAPACIDADE_DA_EQUIPE,
  EFICIENCIA_MINIMA,
  JANELA_CONFORTAVEL,
  PARAMETROS,
  PRAZO_MINUTOS,
} from './parametros';
import { aleatorio, sementeDe } from './aleatorio';

/**
 * A tempestade acontece UMA vez (ADR-0006). PURO.
 *
 * Não existe desfecho certo: cada bairro sorteia se o evento severo acontece,
 * com a chance real que ninguém nunca viu. A mesma alocação pode salvar muito
 * ou pouco — e é isso que "são apenas probabilidades" significa quando sai do
 * discurso e vira número na tela.
 */
export interface Alocacao {
  alfa: string | null;
  bravo: string | null;
}

export interface DesfechoDoBairro {
  bairro: string;
  nome: string;
  severo: boolean;
  emRisco: number;
  equipe: 'alfa' | 'bravo' | null;
  chegou: boolean;
  /** Por que não chegou, quando não chegou. É a lição sobre logística. */
  motivo: string | null;
  /** Tiradas de risco pela equipe. */
  salvas: number;
  /** Ficaram sem socorro e não sobreviveram. */
  vitimas: number;
}

export interface Desfecho {
  v: 1;
  porBairro: DesfechoDoBairro[];
  totais: { emRisco: number; salvas: number; semSocorro: number; vitimas: number };
}

/**
 * Quem fica sem socorro não morre todo. A fração depende da força do evento e
 * de quantos ali não conseguiam sair sozinhos — é para isso que a
 * vulnerabilidade existe na ficha, e é o que faz "quem não sai sozinho" ser uma
 * pergunta que muda a decisão, não curiosidade.
 */
function taxaDeVitimas(severo: boolean, fracaoVulneravel: number): number {
  const base = severo ? 0.05 : 0.008;
  return base * (0.5 + fracaoVulneravel);
}

/** Minutos até a via daquele bairro fechar. Null = não fecha. */
function bloqueioDe(slug: string): number | null {
  const via = MISSAO_TEMPESTADE.bairros.find((b) => b.slug === slug)?.via ?? '';
  const achado = via.match(/(\d{2})h(\d{2})/);
  if (!achado) return null;
  return (Number(achado[1]) - 17) * 60 + Number(achado[2]);
}

function minutosAte(slug: string, equipe: 'alfa' | 'bravo'): number {
  const b = MISSAO_TEMPESTADE.bairros.find((x) => x.slug === slug)!;
  return equipe === 'alfa' ? b.tA : b.tB;
}

/**
 * Tempo RELATIVO, nunca hora de relógio.
 *
 * O estudante só vê o cronômetro; falar "chega às 17h48" obriga a converter escala
 * no meio de uma emergência, e ele nem tem o relógio da cidade na tela.
 */
const emMinutos = (minutos: number) => `${minutos} min`;

/**
 * Quando a equipe chega, e com quanta folga.
 *
 * NADA é impossível e NADA é castigo. A hora de chegada é uma variável do
 * cálculo — ela desloca a distribuição, não corta a operação — e o que o estudante
 * recebe é a informação: chegou às 17h41, a chuva começou às 18h00.
 *
 * Duas versões anteriores erraram aqui. A primeira barrava a equipe ("não
 * chega"), e metade da cidade virava "via fechada": o estudante passava a caçar um
 * par de bairros que a mecânica aceitasse, em vez de pensar nos dados. A
 * segunda somava 15 minutos de desvio, que é a mesma punição com outro nome.
 */
export function chegaATempo(
  slug: string,
  equipe: 'alfa' | 'bravo',
  saidaEmMinutos = 0,
): { chegou: boolean; motivo: string | null; folga: number } {
  const chegada = saidaEmMinutos + minutosAte(slug, equipe);
  const folga = PRAZO_MINUTOS - chegada;
  const bloqueio = bloqueioDe(slug);
  const viaFechada = bloqueio !== null && chegada > bloqueio;

  const nota = [
    folga > 0
      ? `chega com ${emMinutos(folga)} de sobra antes da chuva`
      : `chega ${emMinutos(-folga)} depois de a chuva começar`,
    viaFechada ? 'a via principal já terá fechado' : null,
  ]
    .filter(Boolean)
    .join('; ');

  return {
    chegou: true,
    motivo: viaFechada || folga <= 0 ? nota : null,
    folga,
  };
}

/**
 * O peso do horário de chegada no que a equipe consegue fazer.
 *
 * É INCLINAÇÃO, não punição: sair cedo dá mais margem, chegar em cima da hora
 * dá menos, e a diferença é pequena o bastante para nunca ser o assunto da
 * Missão. O que decide o desfecho é onde estão as pessoas — que é o que os
 * dados tentam dizer, com o viés deles.
 */
export function eficienciaDoTempo(folga: number): number {
  if (folga >= JANELA_CONFORTAVEL) return 1;
  if (folga <= 0) return EFICIENCIA_MINIMA;
  return EFICIENCIA_MINIMA + (1 - EFICIENCIA_MINIMA) * (folga / JANELA_CONFORTAVEL);
}

/** Bairros que ainda dá para alcançar se as equipes saírem agora. */
export function alcancaveisAgora(saidaEmMinutos: number) {
  return MISSAO_TEMPESTADE.bairros
    .map((b) => ({
      slug: b.slug,
      alfa: chegaATempo(b.slug, 'alfa', saidaEmMinutos).chegou,
      bravo: chegaATempo(b.slug, 'bravo', saidaEmMinutos).chegou,
    }))
    .filter((b) => b.alfa || b.bravo);
}

/**
 * Uma cidade, uma tempestade.
 *
 * A força do evento em cada bairro é sorteada com a semente da TURMA, não do
 * estudante: todos enfrentam a mesma tempestade. Assim dois estudantes que mandarem
 * para os mesmos lugares, na mesma hora, terminam com números próximos — e a
 * diferença entre eles vem da decisão, não de dado do sistema.
 *
 * O que continua variando por estudante é a operação: nem toda equipe tira todo
 * mundo, e nem todo bairro sem socorro perde a mesma fração.
 */
export function simular(
  alocacao: Alocacao,
  semente: number,
  opcoes: { sementeDaTempestade?: number; saidaEmMinutos?: number } = {},
): Desfecho {
  const sorteio = aleatorio(semente);
  const tempestade = aleatorio(opcoes.sementeDaTempestade ?? semente);
  const saida = opcoes.saidaEmMinutos ?? 0;

  const porBairro = PARAMETROS.map((p) => {
    const nome = MISSAO_TEMPESTADE.bairros.find((b) => b.slug === p.slug)!.nome;
    const severo = tempestade() < p.pSevero;
    // Faixa estreita: a tempestade é a mesma para a turma, e a variação que
    // sobra não pode virar a decisão de cabeça para baixo.
    const intensidade = 0.92 + tempestade() * 0.16;
    const emRisco = Math.round((severo ? p.expostosSevero : p.expostosBrando) * intensidade);

    const equipe: 'alfa' | 'bravo' | null =
      alocacao.alfa === p.slug ? 'alfa' : alocacao.bravo === p.slug ? 'bravo' : null;

    const { chegou, motivo, folga } = equipe
      ? chegaATempo(p.slug, equipe, saida)
      : { chegou: false, motivo: null, folga: 0 };

    // Eficiência da operação: nem a equipe que chega tira todo mundo — e quem
    // chega em cima da hora tira menos ainda.
    const eficiencia = (0.86 + sorteio() * 0.14) * eficienciaDoTempo(folga);
    const salvas =
      equipe && chegou ? Math.round(Math.min(emRisco, CAPACIDADE_DA_EQUIPE) * eficiencia) : 0;

    // Quem fica sem socorro não morre todo: a fração depende da força do evento
    // e de quantos ali não conseguiam sair sozinhos.
    const semSocorroNoBairro = emRisco - salvas;
    const azar = 0.88 + sorteio() * 0.24;
    const vitimas = Math.round(
      semSocorroNoBairro * taxaDeVitimas(severo, p.fracaoVulneravel) * azar,
    );

    return {
      bairro: p.slug,
      nome,
      severo,
      emRisco,
      equipe,
      chegou,
      motivo,
      salvas,
      vitimas,
    };
  });

  const emRisco = porBairro.reduce((a, b) => a + b.emRisco, 0);
  const salvas = porBairro.reduce((a, b) => a + b.salvas, 0);
  const vitimas = porBairro.reduce((a, b) => a + b.vitimas, 0);

  return {
    v: 1,
    porBairro,
    totais: { emRisco, salvas, semSocorro: emRisco - salvas, vitimas },
  };
}

/**
 * O que ESTA alocação rende em média, e em que faixa.
 *
 * É o campo que carrega a moral inteira: sem ele o estudante lê "2.100 atendidas" e
 * conclui que foi mal. Com ele, lê que a alocação rende 2.450 em média e que
 * nesta rodada deu 2.100 — e entende que jogou uma moeda, não resolveu uma
 * conta. A diferença entre errar e ter azar.
 */
export function esperadoDe(
  alocacao: Alocacao,
  opcoes: { sementeDaTempestade?: number; saidaEmMinutos?: number } = {},
  rodadas = 400,
) {
  const corridas = Array.from({ length: rodadas }, (_, i) =>
    simular(alocacao, sementeDe(`esperado:${alocacao.alfa}:${alocacao.bravo}:${i}`), opcoes),
  ).map((d) => d.totais);

  const ordenar = (v: number[]) => [...v].sort((a, b) => a - b);
  const media = (v: number[]) => Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  const brutas = corridas.map((t) => t.salvas);
  const salvas = ordenar(brutas);
  const vitimas = ordenar(corridas.map((t) => t.vitimas));
  const p10 = Math.floor(rodadas * 0.1);
  const p90 = Math.floor(rodadas * 0.9);
  /** Percentil de lista não-vazia: `rodadas` tem default e nunca é zero. */
  const par = (v: number[]): readonly [number, number] => [v[p10] ?? 0, v[p90] ?? 0];

  return {
    media: media(salvas),
    faixa: par(salvas),
    vitimasMedia: media(vitimas),
    vitimasFaixa: par(vitimas),
    /**
     * AMOSTRAS DA MESMA DECISÃO — o que faz "não repete igual" sair do texto.
     *
     * Uma rodada é anedota: o estudante lê 1.345 e conclui que tirou uma nota. Ver
     * a mesma decisão render outros vinte números, com o dele no meio deles,
     * é a diferença entre ouvir que existe variação e enxergar a variação.
     * São corridas de verdade do mesmo modelo, não ruído decorativo.
     */
    amostras: brutas.slice(0, AMOSTRAS_NA_TELA),
    /**
     * TODAS as corridas, ordenadas. Não vai à tela: é de onde o servidor tira
     * o percentil do resgate real na hora de gravar a simulação (ADR-64).
     */
    todas: salvas,
  };
}

/** Quantas corridas da mesma decisão o Resultado plota. */
export const AMOSTRAS_NA_TELA = 20;
