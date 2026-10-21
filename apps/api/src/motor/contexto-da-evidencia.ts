import type { ContextoDaAtividade } from "../evidencias/evidencias.service";

/**
 * A rodada do Unoovista é SEMPRE 1. O motor não tem rodada: o reset de um
 * estudante reaproveita a mesma run, e "rodar de novo" no modelo do Instanooria
 * é criar uma ATIVIDADE nova (ADR-130). Quem foi resetado não refaz o nível:
 * vale o PRIMEIRO envio de cada tarefa, e o professor corrige pelo ajuste.
 */
export const RODADA_DO_UNOOVISTA = 1;

/**
 * ONDE A RUN CAI na evidência pedagógica (E14, ADR-167): a turma, a atividade
 * e a rodada — ou `null` quando a atividade não é de uma turma (as legadas
 * valem para a escola inteira): a evidência é por turma, e o painel não existe
 * sem ela.
 *
 * Desde o Canal A as marcas vêm das TAREFAS e da leitura da reflexão, todas
 * da run do próprio estudante: quem chama já tem a run, e não há resolvedor
 * registrado — as perguntas de múltipla escolha (que precisavam dele) saíram
 * da ficha.
 */
export function contextoDaRun(atividade: { id: string; turmaId: string | null }): ContextoDaAtividade | null {
  if (!atividade.turmaId) return null;
  return { turmaId: atividade.turmaId, atividadeId: atividade.id, rodada: RODADA_DO_UNOOVISTA };
}
