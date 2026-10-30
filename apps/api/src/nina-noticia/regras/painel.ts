import {
  ETAPA_VISIVEL_DO_PASSO,
  PASSOS,
  SUPORTES,
  TENTATIVAS_PARA_ALERTA_DA_ROTINA,
  type Passo,
  type Suporte,
} from "../vocabulario";
import { uniforme, type CarimbosDaEtapa } from "./carimbos";

/**
 * O PAINEL da professora (E4-PROF-01, "Painel da Sala em Tempo Real") — o que
 * ele conta, puro.
 *
 * A linha de cada computador diz só PROGRESSO e ALERTA — NUNCA acerto (nível
 * vai ao painel de habilidades). O que a turma escolheu vive no resumo
 * ANÔNIMO: a distribuição das escolhas da E2 e qual notícia ficou de fora.
 */

/**
 * As chaves que a linha do painel NÃO pode ter — o teste cobra por SUBCADEIA,
 * em minúsculas: nem o acerto (do filtro, dos carimbos, do reparo, da rotina),
 * nem a escolha, nem nível.
 */
export const PROIBIDO_NA_LINHA_DO_PAINEL = [
  "acert",
  "valid",
  "desfecho",
  "gabarito",
  "nivel",
  "nota",
  "score",
  "ranking",
  "previsao",
  "escolh",
  "itens",
  "carimbo",
  "reparo",
  "tentativa",
] as const;

/** Quantos computadores em cada passo, na ordem dos passos. */
export function contagemPorPasso(passos: readonly Passo[]): Record<Passo, number> {
  const total = Object.fromEntries(PASSOS.map((p) => [p, 0])) as Record<Passo, number>;
  for (const p of passos) total[p] += 1;
  return total;
}

/** "Equipes na etapa N": a contagem pela etapa VISÍVEL (E1–E6). */
export function contagemPorEtapaVisivel(passos: readonly Passo[]): Record<1 | 2 | 3 | 4 | 5 | 6, number> {
  const total = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const p of passos) total[ETAPA_VISIVEL_DO_PASSO[p]] += 1;
  return total;
}

export type DistribuicaoDasEscolhas = {
  /** Quantos computadores travaram a escolha. */
  travadas: number;
  /** Quantos escolheram 1, 2 e 3 notícias. */
  uma: number;
  duas: number;
  tres: number;
  /** Entre quem escolheu menos de três, quantas vezes cada notícia ficou de FORA. */
  deFora: Record<Suporte, number>;
};

/** O card "Escolhas da Etapa 2" (spec §7.1): só agregado, ninguém nomeado. */
export function distribuicaoDasEscolhas(previsoes: readonly (readonly Suporte[])[]): DistribuicaoDasEscolhas {
  const d: DistribuicaoDasEscolhas = {
    travadas: 0,
    uma: 0,
    duas: 0,
    tres: 0,
    deFora: Object.fromEntries(SUPORTES.map((s) => [s, 0])) as Record<Suporte, number>,
  };
  for (const itens of previsoes) {
    const distintos = SUPORTES.filter((s) => itens.includes(s));
    if (distintos.length === 0) continue;
    d.travadas += 1;
    if (distintos.length === 1) d.uma += 1;
    else if (distintos.length === 2) d.duas += 1;
    else d.tres += 1;
    for (const s of SUPORTES) if (!distintos.includes(s)) d.deFora[s] += 1;
  }
  return d;
}

export type AlertasDaLinha = {
  /** "Alerta: rotina em repetição sem parada." — mais de 3 testes da rotina sem a válida. */
  semParada: boolean;
  /** "Alerta: carimbos todos iguais." — os três de uma etapa iguais, na E4 ou na E6. */
  uniformes: boolean;
};

export function alertasDaLinha(s: {
  rotinaTentativas: number;
  rotinaValida: boolean;
  carimbosE4: CarimbosDaEtapa | null;
  carimbosE6: CarimbosDaEtapa | null;
}): AlertasDaLinha {
  return {
    semParada: !s.rotinaValida && s.rotinaTentativas > TENTATIVAS_PARA_ALERTA_DA_ROTINA,
    uniformes: (s.carimbosE4 !== null && uniforme("e4", s.carimbosE4)) || (s.carimbosE6 !== null && uniforme("e6", s.carimbosE6)),
  };
}
