import type { Layout } from "../vocabulario";

/**
 * O MODELO AUTOMÁTICO da primeira página — a diagramação de reserva, e a
 * única em dev e na e2e (o mock da IA sempre falha). PDF §5: "se a diagramação
 * por IA falhar, um modelo automático pronto mantém a atividade funcionando".
 *
 * Determinístico e puro: a mesma página dá o mesmo layout em qualquer máquina,
 * então a tela e o painel nunca divergem, e nada disto vai ao cache (é de
 * graça). Decide só pela FORMA — a imagem da manchete e o tamanho dos títulos
 * —, nunca pelo gabarito: o layout não pode virar pista.
 */

/** Até quantas palavras uma manchete é "curta" para caber em coluna. */
export const PALAVRAS_DA_MANCHETE_CURTA = 7;

export interface VagaParaDiagramar {
  /** A manchete como a criança a lê. */
  manchete: string;
  /** A notícia tem imagem (`descricaoImagem` não nula). */
  temImagem: boolean;
}

function palavrasDe(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * - com imagem na MANCHETE PRINCIPAL (a primeira vaga) → `hero-image`;
 * - senão, com as três manchetes curtas → `columns`;
 * - senão → `classic`.
 */
export function layoutAutomatico(vagas: readonly VagaParaDiagramar[]): Layout {
  if (vagas[0]?.temImagem) return "hero-image";
  if (vagas.length > 0 && vagas.every((v) => palavrasDe(v.manchete) <= PALAVRAS_DA_MANCHETE_CURTA)) return "columns";
  return "classic";
}
