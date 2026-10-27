import { BLOCOS, TEXTO_DO_BLOCO, type Bloco } from "../conteudo";
import type { Comunicado } from "./bancada";

/**
 * O comunicado montado em TEXTO CORRIDO — o que o professor lê em
 * "Comunicados Aprovados pelos Estudantes" (E6-PROF-01). Puro.
 *
 * Cada bloco é o começo da tela (sem as reticências de encaixe) + a opção
 * escolhida; o bloco em branco vira "[em branco]" — o professor precisa ver a
 * lacuna, não um texto que parece completo.
 */
export const EM_BRANCO = "[em branco]";

const semReticencias = (t: string) => t.replace(/^\.{3}/, "").replace(/\.{3}$/, "").trim();

function trecho(b: Bloco, c: Comunicado): string {
  const t = TEXTO_DO_BLOCO[b];
  const escolha = c[b];
  const opcao = escolha !== undefined ? t.opcoes[escolha] : undefined;
  return `${semReticencias(t.inicio)} ${opcao ?? EM_BRANCO}`;
}

export function textoDoComunicado(c: Comunicado): string {
  const [problema, inferencia, regra, salvaguarda] = BLOCOS.map((b) => trecho(b, c));
  return `${problema}, ${inferencia}. ${regra}. ${salvaguarda}.`;
}
