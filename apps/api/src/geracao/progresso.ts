import type { ProgressoGeracao } from '../comum/insta/tipos';
import { PrismaService } from '../prisma/prisma.service';

import { workerAtivo } from './worker';

/**
 * Porte de `lib/geracao/progresso.ts`. Diferenças para o origem: o client
 * Prisma chega por parâmetro e tudo roda dentro de `comTenancy(fn, escolaId)`
 * (RLS + filtro explícito por `escola_id`). O `Promise.all` do origem virou
 * sequência: dentro de uma transação interativa do Prisma as queries dividem
 * uma conexão só.
 */

/** GET progress (doc 07) — o painel faz polling de 2s. */
export async function progressoDaAtividade(
  prisma: PrismaService,
  escolaId: string,
  activityId: string,
): Promise<ProgressoGeracao> {
  return prisma.comTenancy(async (tx) => {
    const jobs = await tx.generationJob.groupBy({
      by: ['tipo', 'status'],
      where: { escolaId, activityId },
      _count: { _all: true },
    });
    const posts = await tx.post.groupBy({
      by: ['imageStatus'],
      where: { escolaId, activityId },
      _count: { _all: true },
    });
    const atividade = await tx.activity.findFirstOrThrow({
      where: { id: activityId, escolaId },
      select: { status: true, qtdPostsTese: true },
    });

    const conta = (tipo: string, status?: string) =>
      jobs
        .filter((job) => job.tipo === tipo && (status ? job.status === status : true))
        .reduce((soma, job) => soma + job._count._all, 0);

    const imagens = (status: string) =>
      posts.filter((grupo) => grupo.imageStatus === status).reduce((soma, grupo) => soma + grupo._count._all, 0);

    const postsCriados = posts.reduce((soma, grupo) => soma + grupo._count._all, 0);

    const lotesTotal = conta('posts_lote');
    const lotesProntos = conta('posts_lote', 'ok') + conta('posts_lote', 'erro');
    const imagensTotal = conta('imagem');
    const imagensProntas = conta('imagem', 'ok') + conta('imagem', 'erro');

    const erros = await tx.generationJob.findMany({
      where: { escolaId, activityId, status: 'erro' },
      select: { tipo: true, erro: true },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    });

    let etapa: ProgressoGeracao['etapa'] = 'personas';
    let feitos = 0;
    let total = 1;

    if (atividade.status !== 'gerando') {
      etapa = 'concluido';
      feitos = 1;
      total = 1;
    } else if (conta('personas', 'ok') === 0 && conta('personas', 'erro') === 0) {
      etapa = 'personas';
      feitos = 0;
      total = 1;
    } else if (lotesProntos < lotesTotal) {
      etapa = 'posts';
      feitos = lotesProntos;
      total = lotesTotal;
    } else if (imagensProntas < imagensTotal) {
      etapa = 'imagens';
      feitos = imagensProntas;
      total = imagensTotal;
    } else {
      etapa = 'validacao';
      feitos = 1;
      total = 1;
    }

    return {
      etapa,
      feitos,
      total,
      erros: erros.map((erro) => `${erro.tipo}: ${erro.erro ?? 'erro'}`),
      status: atividade.status,
      postsCriados,
      imagensOk: imagens('ok'),
      imagensFallback: imagens('fallback'),
      imagensPendentes: imagens('pendente'),
    };
  }, escolaId);
}

/** Usado pelo endpoint para retomar uma fila que ficou órfã (restart). */
export function filaOrfa(activityId: string, status: string): boolean {
  return status === 'gerando' && !workerAtivo(activityId);
}
