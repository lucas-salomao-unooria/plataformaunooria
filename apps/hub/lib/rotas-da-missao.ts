import { buscarGuia } from "./entre-redes/guias";
import {
  MISSOES_DISPONIVEIS,
  rotaDaMissao,
  rotaDaTransversal,
  type Missao,
  type MissaoTransversal,
} from "./entre-redes/catalogo";

/**
 * Onde o PROFESSOR conduz cada missão, a partir do `expId`.
 *
 * A sala (`/professor/turmas/:id`) fala em `expId` — é o que a api devolve na
 * grade. As telas de condução vivem na trilha do Entre Redes, endereçadas por
 * ano/unidade (ou pelo slug, nas transversais). Este arquivo é a tradução entre
 * os dois, e ela precisa existir num lugar só: espalhada, cada tela inventaria
 * a própria e a primeira renomeação de unidade deixaria links mortos.
 *
 * Missão publicada sem `expId` (unidade "em breve") não entra: não há o que
 * conduzir.
 */

export interface RotasDaMissao {
  /** A ficha: o que a missão é, os atos, o preparo. */
  ficha: string;
  /** A tela de condução com a turma já escolhida — `null` quando não existe. */
  resultados: string | null;
  /**
   * O guia da aula — `null` quando a missão ainda não tem um.
   *
   * Sai daqui, e não de uma concatenação em cada tela, porque quem pergunta
   * "essa missão tem guia?" é a SALA DE AULA, que só conhece `expId`. Montar
   * `${ficha}/guia` na mão produziria link para 404 na primeira missão
   * publicada sem guia — e a sala mostraria o link assim mesmo.
   */
  guia: string | null;
}

function ehTransversal(missao: Missao | MissaoTransversal): missao is MissaoTransversal {
  return !("anoSlug" in missao);
}

const POR_EXP: ReadonlyMap<string, RotasDaMissao> = new Map(
  MISSOES_DISPONIVEIS.filter((missao) => Boolean(missao.expId)).map((missao) => {
    const ficha = ehTransversal(missao) ? rotaDaTransversal(missao) : rotaDaMissao(missao);
    const temGuia = Boolean(buscarGuia(missao.expId!));
    return [
      missao.expId!,
      { ficha, resultados: `${ficha}/resultados`, guia: temGuia ? `${ficha}/guia` : null },
    ] as const;
  }),
);

/**
 * `null` quando o hub não conhece a missão. Acontece de verdade: a api pode
 * liberar uma experiência publicada antes de a ficha do professor existir, e a
 * sala precisa mostrar a linha dela sem link em vez de quebrar.
 */
export function rotasDaMissao(expId: string): RotasDaMissao | null {
  return POR_EXP.get(expId) ?? null;
}

/** A rota de condução com a turma já preenchida — é assim que se entra pela sala. */
export function rotaDeConducao(expId: string, turmaId: string): string | null {
  const rotas = rotasDaMissao(expId);
  if (!rotas?.resultados) return null;
  return `${rotas.resultados}?turmaId=${encodeURIComponent(turmaId)}`;
}

/** O guia da aula da missão, ou `null` se ela ainda não tem um. */
export function rotaDoGuiaDaMissao(expId: string): string | null {
  return rotasDaMissao(expId)?.guia ?? null;
}
