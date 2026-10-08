import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ATIVIDADE_DA_TURMA } from "../equipes/regras";
import type { ContextoDaAtividade } from "../evidencias/evidencias.service";
import { EvidenciasService } from "../evidencias/evidencias.service";
import { EXP_ID } from "./regras/defaults";

/**
 * ONDE O ESTUDANTE ESTÁ na Missão Tempestade para a evidência pedagógica (E14,
 * ADR-154) — ou `null`, e a pergunta responde 409 `sem-atividade-em-andamento`.
 *
 * A missão não tem atividade: a da evidência é a SINTÉTICA `"turma"`, o mesmo id
 * que as equipes dela já usam (`equipes/regras.ts#ATIVIDADE_DA_TURMA`) — com
 * outro, a cópia do nível para os colegas de computador não acharia a equipe, e
 * ficaria muda, sem erro. A rodada é a da TURMA (`exp02em1b_gate_turma`), que só
 * o "Zerar a turma" sobe; o "Tentar de novo" não abre rodada.
 *
 * E `null` em três casos, os três de propósito:
 *   - fora do RESULTADO: as perguntas são da tela de resultado, depois do
 *     desfecho — a P3 pergunta pelo que o resultado mostrou;
 *   - estudante sem turma: a evidência é por turma;
 *   - a sessão é de uma rodada que acabou (o professor zerou com a tela aberta):
 *     a resposta atrasada cairia numa rodada encerrada.
 */
export async function contextoDaEvidencia(
  tx: Prisma.TransactionClient,
  escolaId: string,
  estudanteId: string,
): Promise<ContextoDaAtividade | null> {
  const sessao = await tx.unoogptSessao.findUnique({
    where: { escolaId_estudanteId: { escolaId, estudanteId } },
    select: { turmaId: true, passo: true, rodada: true },
  });
  if (!sessao?.turmaId || sessao.passo !== "resultado") return null;
  const gate = await tx.unoogptGateTurma.findUnique({
    where: { escolaId_turmaId: { escolaId, turmaId: sessao.turmaId } },
    select: { rodada: true },
  });
  if ((gate?.rodada ?? 1) !== sessao.rodada) return null;
  return { turmaId: sessao.turmaId, atividadeId: ATIVIDADE_DA_TURMA, rodada: sessao.rodada };
}

/**
 * O gancho na subida: a missão diz à evidência onde cada estudante está. A
 * dependência é nesta direção — `unoogpt` conhece `evidencias`, nunca o
 * contrário —, o mesmo desenho do Unoovista (`motor/contexto-da-evidencia.ts`).
 */
@Injectable()
export class ContextoDaEvidenciaDaTempestade implements OnModuleInit {
  constructor(private readonly evidencias: EvidenciasService) {}

  onModuleInit(): void {
    this.evidencias.registrarContexto(EXP_ID, contextoDaEvidencia);
  }
}
