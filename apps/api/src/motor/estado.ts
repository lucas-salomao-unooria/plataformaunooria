import { PERFIS } from '../comum/insta/defaults';

import type { EngineState } from './tipos';

/** Semente default do lado que a afinidade indica (doc 04 §3.2). */
export const SEMENTE_INICIAL_PADRAO = 6;

/** Estado zerado de uma run nova. */
export function estadoInicial(): EngineState {
  return {
    scoreA: 0,
    scoreB: 0,
    neutroScores: {},
    followedAuthors: [],
    servedPostIds: [],
    intensityUnlocked: { A: 1, B: 1 },
    baselineDwellMs: null,
    blocksServed: 0,
    dwellsIniciais: [],
    sinaisPorNivel: { A: {}, B: {} },
    dwellsAltosPorNivel: { A: {}, B: {} },
    vistosPorPost: {},
    postsConsumidos: [],
    ultimoEventoProcessado: '0',
    ultimoBlocoSugestoes: 0,
    notificouSeguidor: false,
    dwellPorPost: {},
    blocosServidos: [],
    pendentesDeBaseline: [],
    feedIniciadoEm: null,
    versao: 0,
    perfilScores: Object.fromEntries(PERFIS.map((perfil) => [perfil, 0])),
    exposicaoPorPerfil: Object.fromEntries(PERFIS.map((perfil) => [perfil, 0])),
  };
}

/**
 * Semeia o estado com o lado que a afinidade do perfil indica (doc 04 §3.2).
 *
 * A semente é um **prior de score**, não um atalho de intensidade: ela inclina a
 * composição do bloco inicial, mas fica ABAIXO de `somaMinimaParaDominio`, então
 * sozinha não tira o domínio de 0.5. É isso que mantém a virada de lado possível
 * — e a reversibilidade é teste de aceite (doc 04 §10.3), não boa intenção.
 *
 * Não toca `intensityUnlocked`: servir int.3 no primeiro contato quebraria o
 * disfarce e transformaria o exercício em caricatura.
 */
export function semearEstado(
  estado: EngineState,
  ladoInicial: 'A' | 'B',
  semente: number = SEMENTE_INICIAL_PADRAO,
  perfilDominante: string | null = null,
): EngineState {
  const valor = Math.max(0, semente);
  return {
    ...estado,
    ladoInicial,
    /**
     * `misto` não pondera: um perfil sem decisão não deve enviesar a linguagem.
     * Guardar `null` aqui é o que faz a ponderação desligar sozinha no motor.
     */
    perfilDominante: perfilDominante && perfilDominante !== 'misto' ? perfilDominante : null,
    scoreA: ladoInicial === 'A' ? valor : 0,
    scoreB: ladoInicial === 'B' ? valor : 0,
  };
}

/** Normaliza um estado vindo do banco (migrações futuras entram aqui). */
export function normalizarEstado(bruto: unknown): EngineState {
  const base = estadoInicial();
  if (!bruto || typeof bruto !== 'object') return base;
  return { ...base, ...(bruto as Partial<EngineState>) };
}
