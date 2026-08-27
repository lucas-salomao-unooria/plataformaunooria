import type { RodadaDoModelo } from '../ferramentas';

/**
 * Quais cartões de leitura ficam abertos, e o que neles ainda é novidade.
 * PURO — sem React, sem Prisma.
 *
 * No playtest o aluno recebeu a mesma tabela de seis bairros a cada turno, com
 * os mesmos dois avisos de empate repetidos palavra por palavra, e o mesmo
 * disclaimer. Nada disso era falso; tudo isso era ruído. Ele leu o primeiro,
 * folheou o segundo e parou no terceiro.
 *
 * A regra: a leitura ATUAL fica aberta, as anteriores viram uma linha que ele
 * pode abrir, e o que não mudou desde a leitura anterior é dito em uma frase em
 * vez de um bloco.
 */

/** Índice da última fala com cartão de leitura. -1 quando não há nenhuma. */
export function indiceDoUltimoCartao(
  falas: readonly { anexo?: { tipo?: string } | null }[],
): number {
  for (let i = falas.length - 1; i >= 0; i -= 1) {
    const tipo = falas[i]?.anexo?.tipo;
    if (tipo === 'tendencia' || tipo === 'opcoes') return i;
  }
  return -1;
}

/** A linha que substitui o cartão fechado. Texto fixo. */
export function rotuloColapsado(hora: string | undefined): string {
  return hora ? `Leitura com ${hora} no relógio` : 'Leitura anterior';
}

const mesmoConjuntoDeGrupos = (a: readonly string[][], b: readonly string[][]) => {
  const chave = (g: readonly string[][]) =>
    g
      .map((x) => [...x].sort().join('+'))
      .sort()
      .join('|');
  return chave(a) === chave(b);
};

/**
 * O que esta leitura tem de diferente da anterior.
 *
 * Empate e conflito são a aula da Missão — mas repetidos idênticos três vezes
 * seguidas eles deixam de ser lidos. Quando não mudaram, o cartão diz que
 * continuam, em uma linha, e devolve o espaço.
 */
export function oQueMudou(
  anterior: RodadaDoModelo | null | undefined,
  atual: RodadaDoModelo,
): { empates: boolean; conflitos: boolean } {
  if (!anterior) return { empates: true, conflitos: true };
  return {
    empates: !mesmoConjuntoDeGrupos(anterior.empates, atual.empates),
    conflitos: !mesmoConjuntoDeGrupos(
      anterior.conflitos.map((c) => [c.bairro]),
      atual.conflitos.map((c) => [c.bairro]),
    ),
  };
}
