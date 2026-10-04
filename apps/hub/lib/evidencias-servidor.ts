import "server-only";
import { apiDoServidor } from "./api-servidor";
import type { PainelDeHabilidades, PerfilDoEstudante } from "./evidencias";
import type { EscolaConsolidada, RedeConsolidada, TurmaConsolidada } from "./painel-de-habilidades";

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

/** `?escolaId=` quando a tela diz de qual escola é — a coordenação regional e o contrato. */
function daEscola(escolaId?: string): string {
  return escolaId ? `?escolaId=${encodeURIComponent(escolaId)}` : "";
}

/**
 * O perfil de um estudante. `null` = 404 (quem não ensina a criança) ou api
 * fora do ar. `escolaId` só no drill-down da coordenação regional e do
 * contrato; o professor e a coordenação da escola leem a escola do token.
 */
export async function perfilDoEstudante(estudanteId: string, escolaId?: string): Promise<PerfilDoEstudante | null> {
  return apiDoServidor<PerfilDoEstudante>(
    `/evidencias/estudante/${encodeURIComponent(estudanteId)}${daEscola(escolaId)}`,
  );
}

// ── o painel de habilidades (F14.7) ─────────────────────────────────────

/** O painel da turma. `null` = turma que o professor não leciona (404), fora do alcance, ou api fora do ar. */
export async function turmaConsolidada(turmaId: string, escolaId?: string): Promise<TurmaConsolidada | null> {
  return apiDoServidor<TurmaConsolidada>(
    `/evidencias/turma/${encodeURIComponent(turmaId)}/consolidado${daEscola(escolaId)}`,
  );
}

/** O painel da escola — a do token, ou a pedida (regional e contrato). */
export async function escolaConsolidada(escolaId?: string): Promise<EscolaConsolidada | null> {
  return apiDoServidor<EscolaConsolidada>(`/evidencias/escola/consolidado${daEscola(escolaId)}`);
}

/** O painel da rede. A regional lê a dela; o contrato escolhe (`regionalId`) ou lê a rede inteira. */
export async function redeConsolidada(regionalId?: string): Promise<RedeConsolidada | null> {
  const query = regionalId ? `?regionalId=${encodeURIComponent(regionalId)}` : "";
  return apiDoServidor<RedeConsolidada>(`/evidencias/rede/consolidado${query}`);
}
