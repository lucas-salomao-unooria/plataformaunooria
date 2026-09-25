import "server-only";
import { apiDoServidor } from "./api-servidor";
import type { EquipesDaMissao, MinhaEquipe, UltimasEquipes } from "./equipes";

/**
 * As leituras server-side das EQUIPES NA MISSÃO (E13). Os tipos e as regras
 * puras moram em `equipes.ts`, que o cliente também importa — ver lá por que
 * os dois não podem ser um arquivo só.
 *
 * Só GET passa por aqui. Sugerir, salvar e desfazer são ações do professor na
 * frente da sala e vão pelo BFF (`/api/plataforma/equipes/...`).
 */

const caminho = (turmaId: string, expId: string) =>
  `/equipes/turma/${encodeURIComponent(turmaId)}/missao/${encodeURIComponent(expId)}`;

/** `null` é a api fora do ar (ou sem a rota): a ficha simplesmente não mostra a seção. */
export async function equipesDaMissao(turmaId: string, expId: string): Promise<EquipesDaMissao | null> {
  return apiDoServidor<EquipesDaMissao>(caminho(turmaId, expId));
}

/** As equipes da última missão da turma, para "Manter as equipes da última missão". */
export async function ultimasEquipes(turmaId: string, expId: string): Promise<UltimasEquipes | null> {
  return apiDoServidor<UltimasEquipes>(`${caminho(turmaId, expId)}/ultima`);
}

/** A equipe do estudante logado nesta missão. A api responde 200 com `null` quando não há. */
export async function minhaEquipe(expId: string): Promise<MinhaEquipe["equipe"]> {
  const resposta = await apiDoServidor<MinhaEquipe>(`/equipes/minha?expId=${encodeURIComponent(expId)}`);
  return resposta?.equipe ?? null;
}
