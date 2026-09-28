import "server-only";
import { apiDoServidor } from "./api-servidor";
import type { PainelDeHabilidades, PerfilDoEstudante } from "./evidencias";

/**
 * As leituras server-side da EVIDÊNCIA PEDAGÓGICA (E14). Os tipos e as regras
 * puras moram em `evidencias.ts`, que o cliente também importa — ver lá por que
 * os dois não podem ser um arquivo só.
 *
 * Só GET passa por aqui. Confirmar a aula projetada e ajustar são ações do
 * professor e vão pelo BFF (`/api/plataforma/evidencias/...`).
 */

/**
 * O painel de uma atividade na turma. `null` é a api fora do ar, a rota ausente
 * ou a turma que o professor não leciona (404): em todos, a tela simplesmente
 * não mostra o bloco — o mesmo tratamento de `temFicha: false`.
 */
export async function painelDeHabilidades(
  turmaId: string,
  expId: string,
  atividadeId: string,
): Promise<PainelDeHabilidades | null> {
  return apiDoServidor<PainelDeHabilidades>(
    `/evidencias/turma/${encodeURIComponent(turmaId)}/missao/${encodeURIComponent(expId)}/atividade/${encodeURIComponent(atividadeId)}`,
  );
}

/** O perfil de um estudante. `null` = 404 (quem não ensina a criança) ou api fora do ar. */
export async function perfilDoEstudante(estudanteId: string): Promise<PerfilDoEstudante | null> {
  return apiDoServidor<PerfilDoEstudante>(`/evidencias/estudante/${encodeURIComponent(estudanteId)}`);
}
