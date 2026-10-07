import "server-only";
import { apiDoServidorBruto } from "./api-servidor";
import type { PodcastDaAtividade } from "./podcast-tipos";

/**
 * A leitura server-side do PODCAST de uma atividade (ADR-150). Os tipos e as
 * regras puras moram em `podcast-tipos.ts`, que o cliente também importa.
 *
 * Três respostas, e a tela trata cada uma:
 * - `{ podcast }` — o roteiro e o estado do áudio;
 * - `{ indisponivel }` — 409: a atividade com tema próprio foi criada antes do
 *   podcast, e não tem falas revisadas. A tela diz isso, em vez de esconder o
 *   cartão e deixar o professor procurando;
 * - `null` — a api fora do ar, ou a missão sem podcast: a tela não mostra a seção.
 */
export type PodcastNaAula = { podcast: PodcastDaAtividade } | { indisponivel: string } | null;

export async function podcastDaAtividade(expId: string, turmaId: string, atividadeId: string): Promise<PodcastNaAula> {
  const r = await apiDoServidorBruto<PodcastDaAtividade | { mensagem?: string }>(
    `/podcast/${encodeURIComponent(expId)}/turmas/${encodeURIComponent(turmaId)}?atividadeId=${encodeURIComponent(atividadeId)}`,
  );
  if (r.ok && r.dados) return { podcast: r.dados as PodcastDaAtividade };
  if (r.status === 409) {
    const mensagem = (r.dados as { mensagem?: string } | null)?.mensagem;
    return { indisponivel: mensagem ?? "Esta atividade foi criada antes do podcast de recapitulação." };
  }
  return null;
}
