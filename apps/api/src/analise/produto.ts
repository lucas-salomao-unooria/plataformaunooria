import type { Prisma } from '@prisma/client';

import { PERFIS, type Perfil } from '../comum/insta/defaults';
import { FICHAS } from '../comum/insta/perfis';

import { metricasDaAtividade, type MetricasDaRun } from './metricas';

/**
 * Nível de PRODUTO (doc 11 §5) — o que a Unooria olha para saber se a atividade
 * funciona, não se a turma aprendeu.
 */
export interface ResumoDeAtividade {
  id: string;
  titulo: string;
  status: string;
  criadaEm: Date;
  runs: number;
  concluidas: number;

  imersao: { media: number | null; porComponente: Record<string, number> };
  tempoMedioDeFeedMs: number | null;
  taxaDeInversao: number | null;
  /** P(conclusão = lado semeado): o poder do viés que a plataforma plantou. */
  poderDoViesSemeado: number | null;
  descobertaDaBusca: number | null;
  /** Posts aprovados que nunca foram servidos a ninguém. */
  conteudoMorto: { posts: number; total: number; fracao: number | null };
  taxaDeImagensOk: number | null;
}

/**
 * A métrica que valida — ou refuta — a premissa do projeto (doc 11 §5.2).
 *
 * `delta` = dwell médio dos posts do perfil P entre estudantes de perfil P
 *           menos o dwell médio dos MESMOS posts entre estudantes de outro perfil.
 *
 * Sempre com a exposição no denominador (doc 04 §7): sem isso, mediria o próprio
 * viés do feed — que serve mais posts do perfil do estudante — e "confirmaria" a
 * premissa por construção.
 *
 * Se o delta for consistentemente positivo, as fichas de linguagem do doc 10 §3
 * funcionam. **Se for zero, elas não funcionam** — e a gente descobre com número
 * em vez de achismo. Nenhuma outra métrica do sistema é capaz disso.
 */
export interface EficaciaDaEscrita {
  perfil: string;
  rotulo: string;
  /** Segundos por post, entre estudantes DESTE perfil. */
  dwellDosDoPerfil: number | null;
  /** Segundos por post, entre estudantes de OUTROS perfis. */
  dwellDosOutros: number | null;
  delta: number | null;
  amostra: {
    estudantesDoPerfil?: number;
    alunosDoPerfil: number;
    estudantesDeOutros?: number;
    alunosDeOutros: number;
  };
}

export interface AnaliseDeProduto {
  atividade: { id: string; titulo: string; status: string };
  resumo: ResumoDeAtividade;
  eficaciaDaEscrita: EficaciaDaEscrita[];
  /** Média dos deltas com amostra suficiente — o veredito em um número. */
  eficaciaMedia: number | null;
}

const media = (valores: number[]): number | null =>
  valores.length > 0 ? valores.reduce((soma, valor) => soma + valor, 0) / valores.length : null;

const arredondar = (valor: number | null, casas = 2): number | null =>
  valor === null ? null : Math.round(valor * 10 ** casas) / 10 ** casas;

/** Amostra mínima por lado da comparação. Abaixo disso o delta é ruído. */
const AMOSTRA_MINIMA = 2;

async function resumoDe(
  prisma: Prisma.TransactionClient,
  atividade: { id: string; titulo: string; status: string; createdAt: Date },
  alunos: MetricasDaRun[],
): Promise<ResumoDeAtividade> {
  const [posts, servidos] = await Promise.all([
    prisma.post.findMany({
      where: { activityId: atividade.id, aprovado: true },
      select: { id: true, imageStatus: true },
    }),
    prisma.run.findMany({
      where: { activityId: atividade.id },
      select: { engineState: true },
    }),
  ]);

  const jaServidos = new Set<string>();
  for (const run of servidos) {
    const estado = run.engineState as { servedPostIds?: unknown };
    if (Array.isArray(estado.servedPostIds)) {
      for (const id of estado.servedPostIds) if (typeof id === 'string') jaServidos.add(id);
    }
  }

  const mortos = posts.filter((post) => !jaServidos.has(post.id)).length;
  const comImagem = posts.filter((post) => post.imageStatus === 'ok').length;

  const paraImersao = alunos.filter((aluno) => aluno.postsConsumidos >= 8);
  const concluidas = alunos.filter((aluno) => aluno.conclusao !== null);
  const comLado = concluidas.filter((aluno) => aluno.conclusao?.inclinacao !== 'duvida');
  const seguiram = comLado.filter((aluno) => aluno.conclusao?.inclinacao === aluno.bolha.ladoInicial);

  const porComponente: Record<string, number> = {};
  for (const chave of paraImersao[0]?.imersao.componentes.map((c) => c.chave) ?? []) {
    porComponente[chave] =
      arredondar(
        media(paraImersao.map((aluno) => aluno.imersao.componentes.find((c) => c.chave === chave)?.pontos ?? 0)),
        1,
      ) ?? 0;
  }

  return {
    id: atividade.id,
    titulo: atividade.titulo,
    status: atividade.status,
    criadaEm: atividade.createdAt,
    runs: alunos.length,
    concluidas: concluidas.length,
    imersao: { media: arredondar(media(paraImersao.map((a) => a.imersao.total)), 1), porComponente },
    tempoMedioDeFeedMs: arredondar(media(paraImersao.map((a) => a.tempo.feedMs)), 0),
    taxaDeInversao:
      paraImersao.length > 0
        ? arredondar(paraImersao.filter((a) => a.bolha.inverteu).length / paraImersao.length)
        : null,
    poderDoViesSemeado: comLado.length > 0 ? arredondar(seguiram.length / comLado.length) : null,
    descobertaDaBusca:
      paraImersao.length > 0
        ? arredondar(paraImersao.filter((a) => a.investigacao.usosDaBusca > 0).length / paraImersao.length)
        : null,
    conteudoMorto: {
      posts: mortos,
      total: posts.length,
      fracao: posts.length > 0 ? arredondar(mortos / posts.length) : null,
    },
    taxaDeImagensOk: posts.length > 0 ? arredondar(comImagem / posts.length) : null,
  };
}

/**
 * Eficácia da escrita por perfil, numa atividade.
 *
 * O denominador é a **exposição**: para cada estudante, `tempoPorPerfil[P]` dividido
 * por quantos posts de P ele recebeu. Isso dá "segundos por post daquele jeito de
 * escrever", que é comparável entre estudantes que receberam quantidades diferentes.
 */
export async function eficaciaDaEscrita(
  prisma: Prisma.TransactionClient,
  activityId: string,
): Promise<EficaciaDaEscrita[]> {
  const alunos = await metricasDaAtividade(prisma, activityId);
  const comPerfil = alunos.filter(
    (aluno) =>
      aluno.perfilJogo !== null &&
      aluno.perfilJogo.dominante !== 'misto' &&
      aluno.postsConsumidos >= 8,
  );

  const runs = await prisma.run.findMany({
    where: { activityId },
    select: { id: true, engineState: true },
  });
  const exposicaoPorRun = new Map<string, Record<string, number>>(
    runs.map((run) => [
      run.id,
      ((run.engineState as { exposicaoPorPerfil?: Record<string, number> }).exposicaoPorPerfil ?? {}),
    ]),
  );

  /** Segundos por post do perfil `alvo`, para um estudante. `null` sem exposição. */
  const segundosPorPost = (aluno: MetricasDaRun, alvo: Perfil): number | null => {
    const servidos = exposicaoPorRun.get(aluno.runId)?.[alvo] ?? 0;
    if (servidos === 0) return null;
    // `?? 0`: `porPerfilMs` é Record<string, number> e o perfil pode não ter
    // entrada (noUncheckedIndexedAccess). Sem tempo registrado, o dwell é zero.
    return (aluno.tempo.porPerfilMs[alvo] ?? 0) / servidos / 1000;
  };

  return PERFIS.map((perfil) => {
    const doPerfil = comPerfil
      .filter((aluno) => aluno.perfilJogo?.dominante === perfil)
      .map((aluno) => segundosPorPost(aluno, perfil))
      .filter((valor): valor is number => valor !== null);

    const dosOutros = comPerfil
      .filter((aluno) => aluno.perfilJogo?.dominante !== perfil)
      .map((aluno) => segundosPorPost(aluno, perfil))
      .filter((valor): valor is number => valor !== null);

    const mediaDoPerfil = doPerfil.length >= AMOSTRA_MINIMA ? media(doPerfil) : null;
    const mediaDosOutros = dosOutros.length >= AMOSTRA_MINIMA ? media(dosOutros) : null;

    return {
      perfil,
      rotulo: FICHAS[perfil].rotulo,
      dwellDosDoPerfil: arredondar(mediaDoPerfil),
      dwellDosOutros: arredondar(mediaDosOutros),
      delta:
        mediaDoPerfil !== null && mediaDosOutros !== null
          ? arredondar(mediaDoPerfil - mediaDosOutros)
          : null,
      amostra: {
        estudantesDoPerfil: doPerfil.length,
        alunosDoPerfil: doPerfil.length,
        estudantesDeOutros: dosOutros.length,
        alunosDeOutros: dosOutros.length,
      },
    };
  });
}

/** Uma linha por atividade, para a comparação entre turmas (doc 11 §5.3). */
export async function resumoDeTodasAsAtividades(
  prisma: Prisma.TransactionClient,
): Promise<ResumoDeAtividade[]> {
  const atividades = await prisma.activity.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, titulo: true, status: true, createdAt: true },
  });

  return Promise.all(
    atividades.map(async (atividade) =>
      resumoDe(prisma, atividade, await metricasDaAtividade(prisma, atividade.id)),
    ),
  );
}

export async function analiseDeProduto(
  prisma: Prisma.TransactionClient,
  activityId: string,
): Promise<AnaliseDeProduto> {
  const [atividade, alunos, eficacia] = await Promise.all([
    prisma.activity.findUniqueOrThrow({
      where: { id: activityId },
      select: { id: true, titulo: true, status: true, createdAt: true },
    }),
    metricasDaAtividade(prisma, activityId),
    eficaciaDaEscrita(prisma, activityId),
  ]);

  const comDelta = eficacia.map((linha) => linha.delta).filter((valor): valor is number => valor !== null);

  return {
    atividade: { id: atividade.id, titulo: atividade.titulo, status: atividade.status },
    resumo: await resumoDe(prisma, atividade, alunos),
    eficaciaDaEscrita: eficacia,
    eficaciaMedia: arredondar(media(comDelta)),
  };
}
