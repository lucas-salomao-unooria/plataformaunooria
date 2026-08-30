import type { Prisma } from '@prisma/client';

import { ladoDoPerfil, type LadoTese } from './afinidade';
import { afinidadeDaAtividade } from './distribuicao';
import type { PrismaService } from '../prisma/prisma.service';

export type OrigemDoLado = 'perfil' | 'sorteio' | 'redistribuido';

export interface Largada {
  ladoInicial: LadoTese;
  ladoOrigem: OrigemDoLado;
  /** Perfil dominante do Ato 1, ou null quando ausente/`misto`. */
  perfilDominante: string | null;
  perfilJogo: { escores: unknown; dominante: string } | null;
  perfilOrigem: string;
}

/**
 * Resolve em que lado o feed de um estudante nasce (doc 04 §3.1, doc 10 §5.2).
 *
 * Precedência, e cada nível existe por um motivo:
 *
 * 1. **`lado_forcado`** — o professor redistribuiu antes da aula. Essa decisão
 *    não pode ser desfeita por um recálculo de afinidade no login.
 * 2. **Afinidade do perfil** — o mecanismo do Ato 2. É o caminho normal.
 * 3. **Sorteio balanceado** — sem perfil ou com perfil `misto`. Escolhe o lado
 *    com menos runs para a turma ainda sair perto de 50/50.
 *
 * Existe como módulo próprio porque duas rotas precisam da MESMA regra: o
 * primeiro início (`POST /api/runs`) e o reset da sessão. Quando o reset tinha
 * regra própria, ele mantinha o lado antigo — e reaproveitar o aparelho repetia a
 * semente sem ninguém perceber (doc 08 M9).
 */
export async function resolverLargada(
  prisma: Prisma.TransactionClient | PrismaService,
  activityId: string,
  estudanteId: string,
  antagonismo: unknown,
  opcoes: { ignorarRunAtual?: string } = {},
): Promise<Largada> {
  const perfil = await prisma.perfilImportado.findUnique({
    where: { activityId_estudanteId: { activityId, estudanteId } },
  });

  const afinidade = afinidadeDaAtividade(antagonismo);
  const doPerfil = perfil && afinidade ? ladoDoPerfil(perfil.dominante as never, afinidade) : null;

  const base = {
    perfilDominante: perfil && perfil.dominante !== 'misto' ? perfil.dominante : null,
    perfilJogo: perfil ? { escores: perfil.escores, dominante: perfil.dominante } : null,
    perfilOrigem: perfil ? (perfil.origem as string) : 'ausente',
  };

  if (perfil?.ladoForcado === 'A' || perfil?.ladoForcado === 'B') {
    return { ...base, ladoInicial: perfil.ladoForcado, ladoOrigem: 'redistribuido' };
  }

  if (doPerfil) {
    return { ...base, ladoInicial: doPerfil, ladoOrigem: 'perfil' };
  }

  /**
   * Sorteio balanceado. A run que está sendo resetada é excluída da contagem —
   * senão ela votaria pelo próprio lado antigo e o sorteio ficaria preso nele.
   */
  const porLado = await prisma.run.groupBy({
    by: ['ladoInicial'],
    where: {
      activityId,
      ...(opcoes.ignorarRunAtual ? { id: { not: opcoes.ignorarRunAtual } } : {}),
    },
    _count: { _all: true },
  });

  const conta = (lado: LadoTese) => porLado.find((linha) => linha.ladoInicial === lado)?._count._all ?? 0;
  const a = conta('A');
  const b = conta('B');

  return {
    ...base,
    ladoInicial: a === b ? (Math.random() < 0.5 ? 'A' : 'B') : a < b ? 'A' : 'B',
    ladoOrigem: 'sorteio',
  };
}
