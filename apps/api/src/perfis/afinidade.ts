import { PERFIS, type Perfil } from '../comum/insta/defaults';
import { FICHAS } from '../comum/insta/perfis';
import { ladoPorPerfil, type Afinidade } from '../comum/insta/tipos';

export type LadoTese = 'A' | 'B';

/** Escores normalizados 0–1 dos 4 perfis (doc 10 §4). */
export type Escores = Record<Perfil, number>;

export interface PerfilDeValores {
  escores: Escores;
  dominante: Perfil | 'misto';
  /** Distância entre o 1º e o 2º escore — a "força" da afinidade. */
  margem: number;
}

/** Empate técnico: abaixo disso o perfil não decide nada (doc 10 §4). */
export const MARGEM_DE_EMPATE = 0.05;

/**
 * Normaliza escores brutos e deriva o dominante **no servidor**.
 *
 * Por que não confiar no que o jogo mandou: o jogo é externo e pode evoluir sem
 * a plataforma saber. Reescalar aqui garante que `escores` sempre soma 1 e que
 * `dominante` segue a mesma regra de empate em toda a base.
 */
export function normalizarPerfil(bruto: Partial<Escores>): PerfilDeValores {
  const valores = PERFIS.map((perfil) => Math.max(0, Number(bruto[perfil] ?? 0)));
  const soma = valores.reduce((total, valor) => total + valor, 0);

  // `!`: índices sempre dentro do array — `valores` tem o tamanho de PERFIS e
  // PERFIS tem 4 itens (guardas exigidas pelo noUncheckedIndexedAccess).
  const escores = Object.fromEntries(
    PERFIS.map((perfil, indice) => [perfil, soma > 0 ? valores[indice]! / soma : 1 / PERFIS.length]),
  ) as Escores;

  const ordenados = [...PERFIS].sort((a, b) => escores[b] - escores[a]);
  const margem = escores[ordenados[0]!] - escores[ordenados[1]!];

  return {
    escores,
    dominante: margem < MARGEM_DE_EMPATE ? 'misto' : ordenados[0]!,
    margem,
  };
}

/**
 * O lado que a afinidade dá a este perfil. `misto` devolve `null`: quem não tem
 * perfil decidido cai no sorteio balanceado (doc 04 §3.1).
 */
export function ladoDoPerfil(
  dominante: Perfil | 'misto',
  afinidade: Afinidade,
): LadoTese | null {
  if (dominante === 'misto') return null;
  return ladoPorPerfil(afinidade)[dominante];
}

/** Rótulo legível do perfil, para o painel do professor e o relatório. */
export function rotuloDoPerfil(dominante: Perfil | 'misto'): string {
  return dominante === 'misto' ? 'Sem perfil definido' : FICHAS[dominante].rotulo;
}

/**
 * Ordem de redistribuição: **afinidade mais fraca primeiro** (doc 04 §3.1).
 *
 * Move quem tem o perfil menos decidido — `misto` antes de todos, depois por
 * margem crescente. Preserva a pedagogia onde o sinal do perfil é forte e
 * sacrifica onde ele já era ambíguo; o contrário seria mover um estudante de perfil
 * claríssimo e depois ter que explicar isso a ele no relatório.
 */
export function ordemDeRedistribuicao<T extends { dominante: Perfil | 'misto'; margem: number }>(
  estudantes: T[],
): T[] {
  return [...estudantes].sort((a, b) => {
    const mistoA = a.dominante === 'misto' ? 0 : 1;
    const mistoB = b.dominante === 'misto' ? 0 : 1;
    if (mistoA !== mistoB) return mistoA - mistoB;
    return a.margem - b.margem;
  });
}

/**
 * Quantos estudantes precisam trocar de lado para o desequilíbrio entrar na
 * tolerância. Devolve o lado que está sobrando e quantos mover.
 */
export function quantosMover(
  contagem: Record<LadoTese, number>,
  toleranciaFracao = 0.15,
): { de: LadoTese; quantos: number } | null {
  const total = contagem.A + contagem.B;
  if (total === 0) return null;

  const excedente: LadoTese = contagem.A >= contagem.B ? 'A' : 'B';
  const escasso: LadoTese = excedente === 'A' ? 'B' : 'A';
  const desvio = Math.abs(contagem[excedente] / total - 0.5);
  if (desvio <= toleranciaFracao) return null;

  // Mover k iguala em (excedente − k) e (escasso + k): k = diferença / 2.
  const quantos = Math.ceil((contagem[excedente] - contagem[escasso]) / 2);
  return quantos > 0 ? { de: excedente, quantos } : null;
}
