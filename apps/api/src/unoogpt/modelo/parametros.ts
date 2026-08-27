import { MISSAO_TEMPESTADE } from '../cenario';

/**
 * Os parâmetros ocultos do mundo (ADR-0006).
 *
 * NÃO existe "o que vai acontecer": existe uma DISTRIBUIÇÃO. A tempestade é
 * sorteada a cada rodada. Estes números são as chances reais — o aluno nunca os
 * vê, e nenhum Dataset os entrega inteiros. Cada conjunto mostra um pedaço,
 * distorcido pelo viés dele.
 *
 * Se algum dia alguém expuser isto ao cliente, a Missão passa a ter resposta
 * certa e a moral morre. É por isso que este módulo é `server-only` na prática:
 * nada em lib/missao/sanitizador.ts o inclui.
 */
export interface ParametroDoBairro {
  slug: string;
  /** Probabilidade real de evento severo nesta tempestade. */
  pSevero: number;
  /** Pessoas em risco se o evento severo acontecer. */
  expostosSevero: number;
  /** Pessoas em risco no cenário brando. */
  expostosBrando: number;
  /** Fração que não consegue sair sozinha — pesa no que uma equipe alcança. */
  fracaoVulneravel: number;
}

/** Quantas pessoas uma equipe consegue tirar de risco em uma hora. */
export const CAPACIDADE_DA_EQUIPE = 1400;

/**
 * Equipe que chega com esta folga antes da chuva opera com força total. Menos
 * folga rende menos gente tirada de casa — é RAMPA, não precipício.
 */
export const JANELA_CONFORTAVEL = 20;

/** A chuva começa às 18h00. */
export const PRAZO_MINUTOS = 60;

/**
 * O quanto a equipe ainda rende quando chega com a chuva caindo.
 *
 * Alto de propósito: a hora de chegada entra na conta, mas não é o que decide a
 * Missão. Com 0,15 aqui, sair tarde virava o assunto e o aluno passava a
 * otimizar relógio em vez de ler dados.
 */
export const EFICIENCIA_MINIMA = 0.7;

export const PARAMETROS: ParametroDoBairro[] = MISSAO_TEMPESTADE.bairros.map((b) => {
  const peso = b.granizo === 'Severo' ? 1.25 : b.granizo === 'Alto' ? 1.1 : 1;
  return {
    slug: b.slug,
    // A chance de alagar da ficha, temperada pelo granizo: um bairro de granizo
    // severo vira desastre mesmo sem o rio subir.
    pSevero: Math.min(0.95, (b.alag / 100) * peso),
    expostosSevero: Math.round(b.exp * peso),
    expostosBrando: Math.round(b.exp * 0.3),
    fracaoVulneravel: b.vexp / b.exp,
  };
});

export const PARAMETRO_POR_SLUG = new Map(PARAMETROS.map((p) => [p.slug, p]));
