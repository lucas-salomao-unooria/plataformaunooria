import "server-only";
import { apiDoServidor } from "./api-servidor";
import { caminhoDasEquipes, type EquipesDaMissao, type MinhaEquipe, type UltimasEquipes } from "./equipes";

/**
 * As leituras server-side das EQUIPES NA MISSÃO (E13). Os tipos e as regras
 * puras moram em `equipes.ts`, que o cliente também importa — ver lá por que
 * os dois não podem ser um arquivo só.
 *
 * Só GET passa por aqui. Sugerir, salvar e desfazer são ações do professor na
 * frente da sala e vão pelo BFF (`/api/plataforma/equipes/...`).
 */

/**
 * As equipes de UMA atividade (ADR-130). `null` é a api fora do ar (ou sem a
 * rota, ou a atividade que não é desta turma): a tela simplesmente não mostra
 * a seção.
 */
export async function equipesDaMissao(
  turmaId: string,
  expId: string,
  atividadeId: string,
): Promise<EquipesDaMissao | null> {
  return apiDoServidor<EquipesDaMissao>(caminhoDasEquipes(turmaId, expId, atividadeId));
}

/** As equipes da atividade anterior da turma, para "Usar as equipes da atividade anterior". */
export async function ultimasEquipes(
  turmaId: string,
  expId: string,
  atividadeId: string,
): Promise<UltimasEquipes | null> {
  return apiDoServidor<UltimasEquipes>(`${caminhoDasEquipes(turmaId, expId, atividadeId)}/ultima`);
}

/** A equipe do estudante logado nesta missão. A api responde 200 com `null` quando não há. */
export async function minhaEquipe(expId: string): Promise<MinhaEquipe["equipe"]> {
  const resposta = await apiDoServidor<MinhaEquipe>(`/equipes/minha?expId=${encodeURIComponent(expId)}`);
  return resposta?.equipe ?? null;
}
