import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { EXP_ID } from "../comum/insta/defaults";
import type { ContextoDaAtividade } from "../evidencias/evidencias.service";
import { EvidenciasService } from "../evidencias/evidencias.service";

/**
 * A rodada do Unoovista é SEMPRE 1. O motor não tem rodada: o reset de um
 * estudante reaproveita a mesma run, e "rodar de novo" no modelo do Instanooria
 * é criar uma ATIVIDADE nova (ADR-130). A resposta de quem foi resetado não
 * reabre — vale a primeira —, e o professor corrige pelo ajuste do painel.
 */
export const RODADA_DO_UNOOVISTA = 1;

/**
 * ONDE O ESTUDANTE ESTÁ na exp08ef1b para a evidência pedagógica (E14) — ou
 * `null`, e a pergunta responde 409 `sem-atividade-em-andamento`.
 *
 * A run é a do `boot`: a mais recente do estudante numa atividade `ativa`. E
 * `null` em dois casos, os dois de propósito:
 *   - a atividade não é de uma turma (as legadas valem para a escola inteira):
 *     a evidência é por turma, e o painel não existe sem ela;
 *   - a reflexão escrita ainda não foi salva: as perguntas vêm DEPOIS dela (a
 *     ordem combinada em 2026-10-02 — perguntar antes sugeriria a resposta que
 *     a reflexão pede), e uma resposta mandada por fora da tela não fura a fila.
 *     Salvar a reflexão já exige a fase `reflexao` ou `fim`, então a linha
 *     basta para dizer onde a criança está.
 */
export async function contextoDaEvidencia(
  tx: Prisma.TransactionClient,
  escolaId: string,
  estudanteId: string,
): Promise<ContextoDaAtividade | null> {
  const run = await tx.run.findFirst({
    where: { estudanteId, escolaId, activity: { status: "ativa" } },
    orderBy: { startedAt: "desc" },
    select: { activity: { select: { id: true, turmaId: true } }, reflexao: { select: { runId: true } } },
  });
  if (!run?.activity.turmaId || !run.reflexao) return null;
  return { turmaId: run.activity.turmaId, atividadeId: run.activity.id, rodada: RODADA_DO_UNOOVISTA };
}

/**
 * O gancho na subida: o motor diz à evidência onde cada estudante está. A
 * dependência é nesta direção — `motor` conhece `evidencias`, nunca o
 * contrário —, no molde de `perfis/fonte-de-lado.ts`.
 */
@Injectable()
export class ContextoDaEvidenciaDoUnoovista implements OnModuleInit {
  constructor(private readonly evidencias: EvidenciasService) {}

  onModuleInit(): void {
    this.evidencias.registrarContexto(EXP_ID, contextoDaEvidencia);
  }
}
