import type { Prisma } from '@prisma/client';

import { antagonismoSchema, type Afinidade } from '../comum/insta/tipos';
import {
  ladoDoPerfil,
  normalizarPerfil,
  rotuloDoPerfil,
  type LadoTese,
} from './afinidade';
import type { PrismaService } from '../prisma/prisma.service';

export interface AlunoNaDistribuicao {
  username: string;
  displayName: string;
  dominante: string;
  rotulo: string;
  /** Distância entre o 1º e o 2º escore — ordena a redistribuição. */
  margem: number;
  origemDoPerfil: 'jogo' | 'professor' | 'ausente';
  /** Lado projetado (ainda sem run) ou o lado real (run já criada). */
  lado: LadoTese | null;
  ladoOrigem: 'perfil' | 'sorteio' | 'redistribuido' | 'projetado';
  /** A run já existe? Redistribuir só age em quem ainda não começou. */
  jaComecou: boolean;
}

/** Lê a afinidade aprovada da atividade. Null quando ainda não há antagonismo. */
export function afinidadeDaAtividade(antagonismo: unknown): Afinidade | null {
  const parsed = antagonismoSchema.safeParse(antagonismo);
  return parsed.success ? parsed.data.afinidade : null;
}

/**
 * A distribuição da turma: onde cada aluno vai cair (ou já caiu).
 *
 * Existe para o professor VER antes de começar. A distribuição de perfis varia
 * por sala — uma turma pode ter muita Autotranscendência e pouca Conservação —, e
 * aí os lados nascem desequilibrados. Não é defeito do sistema, é a turma; mas o
 * professor precisa saber antes, não descobrir no meio da aula.
 */
export async function distribuicaoDaTurma(
  prisma: Prisma.TransactionClient | PrismaService,
  activityId: string,
  antagonismo: unknown,
) {
  const afinidade = afinidadeDaAtividade(antagonismo);

  const [perfis, runs, alunos] = await Promise.all([
    prisma.perfilImportado.findMany({ where: { activityId } }),
    prisma.run.findMany({
      where: { activityId },
      select: { alunoId: true, ladoInicial: true, ladoOrigem: true, fase: true },
    }),
    prisma.user.findMany({
      where: { role: 'aluno' },
      select: { id: true, username: true, displayName: true },
      orderBy: { username: 'asc' },
    }),
  ]);

  const perfilPorAluno = new Map(perfis.map((perfil) => [perfil.alunoId, perfil]));
  const runPorAluno = new Map(runs.map((run) => [run.alunoId, run]));

  const linhas: AlunoNaDistribuicao[] = alunos.map((aluno) => {
    const perfil = perfilPorAluno.get(aluno.id);
    const run = runPorAluno.get(aluno.id);

    const normalizado = perfil
      ? normalizarPerfil(perfil.escores as never)
      : { dominante: 'misto' as const, margem: 0, escores: null as never };

    /**
     * O lado forçado pelo professor tem precedência sobre a afinidade — é ele que
     * vai valer quando a run nascer.
     */
    const forcado = (perfil?.ladoForcado as LadoTese | null) ?? null;
    const projetado = forcado ?? (afinidade ? ladoDoPerfil(normalizado.dominante, afinidade) : null);

    return {
      username: aluno.username,
      displayName: aluno.displayName,
      dominante: normalizado.dominante,
      rotulo: rotuloDoPerfil(normalizado.dominante),
      margem: normalizado.margem,
      origemDoPerfil: (perfil?.origem as 'jogo' | 'professor') ?? 'ausente',
      lado: run ? (run.ladoInicial as LadoTese) : projetado,
      ladoOrigem: run
        ? (run.ladoOrigem as 'perfil' | 'sorteio' | 'redistribuido')
        : forcado
          ? 'redistribuido'
          : 'projetado',
      jaComecou: Boolean(run) && run!.fase !== 'onboarding',
    };
  });

  const contagem = { A: 0, B: 0 };
  let semLado = 0;
  for (const linha of linhas) {
    if (linha.lado) contagem[linha.lado] += 1;
    else semLado += 1;
  }

  const total = contagem.A + contagem.B;
  return {
    temAfinidade: Boolean(afinidade),
    afinidade,
    alunos: linhas,
    contagem,
    /**
     * `semLado` são os que caem no sorteio: perfil ausente ou `misto`. Eles não
     * entram na projeção porque o lado só é decidido quando a run nasce.
     */
    semLado,
    desequilibrio: total > 0 ? Math.abs(contagem.A / total - 0.5) : 0,
  };
}
