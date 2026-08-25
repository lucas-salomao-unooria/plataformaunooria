import { Injectable } from "@nestjs/common";
import type { Prisma, UnootubeSessao } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LIMITE_SALVOS, VIDEOS, semGabarito, type VideoPublico } from "./catalogo";
import { erroDeJogo } from "./erros";
import {
  ESTADO_INICIAL,
  aplicarCredibilidade,
  aplicarRemover,
  aplicarSalvar,
  alternarCurtida,
  derivados,
  montarRanking,
  posicaoDoAluno,
  resumirTurma,
  type Derivados,
  type EstadoSessao,
  type LinhaTurma,
  type RankingLinha,
  type ResultadoRegra,
  type ResumoTurma,
} from "./regras";

/**
 * Persistência do estado da missão. Assinaturas recebem `escolaId`/`alunoId`
 * explícitos (não o request) — os testes de integração chamam direto, e toda
 * query leva `escola_id` no `where` além da RLS que o `comTenancy` arma
 * (regra inviolável nº 1, defesa em profundidade).
 */

export interface EstadoPublico {
  salvos: string[];
  curtidos: string[];
  rankingDesbloqueado: boolean;
  credibilidadeAdicionada: boolean;
  concluidoEm: string | null;
}

export interface RespostaEstado {
  estado: EstadoPublico;
  derivados: Derivados;
  limiteSalvos: number;
}

export interface RespostaRanking {
  linhas: RankingLinha[];
  posicao: { porInscritos: number; porFontes: number };
}

/** O tipo usa `VideoPublico`: `factual` é impossível aqui, não só omitido. */
export interface RespostaSessao extends RespostaEstado {
  catalogo: { videos: VideoPublico[] };
  aluno: { nome: string; avatar: string };
  ranking: RespostaRanking | null;
}

export interface RespostaTurma {
  turma: { id: string; nome: string; serie: string };
  alunos: LinhaTurma[];
  resumo: ResumoTurma;
}

type Linha = Pick<
  UnootubeSessao,
  "salvos" | "curtidos" | "rankingDesbloqueado" | "credibilidadeAdicionada" | "concluidoEm"
>;

function paraEstado(linha: Linha | null | undefined): EstadoSessao {
  if (!linha) return { ...ESTADO_INICIAL, salvos: [], curtidos: [] };
  return {
    salvos: [...linha.salvos],
    curtidos: [...linha.curtidos],
    rankingDesbloqueado: linha.rankingDesbloqueado,
    credibilidadeAdicionada: linha.credibilidadeAdicionada,
    concluidoEm: linha.concluidoEm,
  };
}

function paraColunas(estado: EstadoSessao): Prisma.UnootubeSessaoUpdateInput {
  return {
    salvos: estado.salvos,
    curtidos: estado.curtidos,
    rankingDesbloqueado: estado.rankingDesbloqueado,
    credibilidadeAdicionada: estado.credibilidadeAdicionada,
    concluidoEm: estado.concluidoEm,
  };
}

function respostaDe(estado: EstadoSessao): RespostaEstado {
  return {
    estado: { ...estado, concluidoEm: estado.concluidoEm?.toISOString() ?? null },
    derivados: derivados(estado.salvos),
    limiteSalvos: LIMITE_SALVOS,
  };
}

function avatarDe(aluno: { displayName: string; avatar: string | null }): string {
  const inicial = aluno.displayName.trim().charAt(0);
  return (inicial || "?").toUpperCase();
}

@Injectable()
export class UnootubeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Boot da experiência — READ-ONLY: sem linha devolve o estado inicial. */
  async sessao(escolaId: string, alunoId: string): Promise<RespostaSessao> {
    return this.prisma.comTenancy(async (tx) => {
      const aluno = await this.alunoDaEscola(tx, escolaId, alunoId);
      const linha = await tx.unootubeSessao.findUnique({
        where: { escolaId_alunoId: { escolaId, alunoId } },
      });
      const estado = paraEstado(linha);
      return {
        ...respostaDe(estado),
        catalogo: { videos: VIDEOS.map(semGabarito) },
        aluno: { nome: aluno.displayName, avatar: avatarDe(aluno) },
        ranking: estado.rankingDesbloqueado ? this.rankingDe(aluno, estado) : null,
      };
    }, escolaId);
  }

  salvar(escolaId: string, alunoId: string, videoId: string) {
    return this.mutar(escolaId, alunoId, (estado) => aplicarSalvar(estado, videoId));
  }

  remover(escolaId: string, alunoId: string, videoId: string) {
    return this.mutar(escolaId, alunoId, (estado) => aplicarRemover(estado, videoId));
  }

  curtir(escolaId: string, alunoId: string, videoId: string) {
    return this.mutar(escolaId, alunoId, (estado) => alternarCurtida(estado, videoId));
  }

  async ranking(escolaId: string, alunoId: string): Promise<RespostaRanking> {
    return this.prisma.comTenancy(async (tx) => {
      const aluno = await this.alunoDaEscola(tx, escolaId, alunoId);
      const linha = await tx.unootubeSessao.findUnique({
        where: { escolaId_alunoId: { escolaId, alunoId } },
      });
      const estado = paraEstado(linha);
      if (!estado.rankingDesbloqueado) erroDeJogo("RANKING_BLOQUEADO");
      return this.rankingDe(aluno, estado);
    }, escolaId);
  }

  async credibilidade(
    escolaId: string,
    alunoId: string,
  ): Promise<RespostaEstado & { score: number }> {
    const resposta = await this.mutar(escolaId, alunoId, (estado, agora) =>
      aplicarCredibilidade(estado, agora),
    );
    return { ...resposta, score: resposta.derivados.fontesConfiaveis };
  }

  reiniciar(escolaId: string, alunoId: string) {
    return this.mutar(
      escolaId,
      alunoId,
      () => ({ ok: true, estado: { ...ESTADO_INICIAL, salvos: [], curtidos: [] }, mudou: true }),
      { reinicios: { increment: 1 } },
    );
  }

  async turmas(escolaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: { escolaId },
        select: { id: true, nome: true, serie: true, _count: { select: { alunos: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return {
        turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, serie: t.serie, alunos: t._count.alunos })),
      };
    }, escolaId);
  }

  /**
   * Visão do professor. Parte de `users` (quem não iniciou também aparece);
   * `users`/`turmas` estão fora da RLS, por isso o `escolaId` no `where`.
   * Autorização = turma da mesma escola do token: não existe vínculo
   * professor↔turma no modelo; se um dia existir (`professores_turmas`), é aqui
   * que ele entra.
   */
  async resultadosDaTurma(escolaId: string, turmaId: string): Promise<RespostaTurma> {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({
        where: { id: turmaId, escolaId },
        select: { id: true, nome: true, serie: true },
      });
      if (!turma) erroDeJogo("TURMA_NAO_ENCONTRADA");

      const alunos = await tx.user.findMany({
        where: { escolaId, turmaId, role: "aluno" },
        select: {
          id: true,
          displayName: true,
          username: true,
          unootube: { where: { escolaId }, take: 1 },
        },
        orderBy: { displayName: "asc" },
      });

      const linhas: LinhaTurma[] = alunos.map((a) => {
        const sessao = a.unootube[0];
        const estado = paraEstado(sessao);
        const d = derivados(estado.salvos);
        return {
          alunoId: a.id,
          nome: a.displayName,
          usuario: a.username,
          iniciou: Boolean(sessao),
          salvos: d.salvos,
          fontesConfiaveis: d.fontesConfiaveis,
          inscritos: d.inscritos,
          rankingDesbloqueado: estado.rankingDesbloqueado,
          credibilidadeAdicionada: estado.credibilidadeAdicionada,
          concluidoEm: estado.concluidoEm?.toISOString() ?? null,
        };
      });

      return { turma, alunos: linhas, resumo: resumirTurma(linhas) };
    }, escolaId);
  }

  // -------------------------------------------------------------------------

  private rankingDe(
    aluno: { displayName: string; avatar: string | null },
    estado: EstadoSessao,
  ): RespostaRanking {
    const linhas = montarRanking({ nome: aluno.displayName, avatar: avatarDe(aluno) }, estado.salvos);
    return { linhas, posicao: posicaoDoAluno(linhas) };
  }

  /** `users` está fora da RLS — a escola do token precisa bater com a do usuário. */
  private async alunoDaEscola(tx: Prisma.TransactionClient, escolaId: string, alunoId: string) {
    const aluno = await tx.user.findUnique({
      where: { id: alunoId },
      select: { displayName: true, avatar: true, escolaId: true },
    });
    if (!aluno || aluno.escolaId !== escolaId) erroDeJogo("TURMA_NAO_ENCONTRADA");
    return aluno;
  }

  /**
   * Núcleo de toda mutação: garante a linha, tranca-a (`FOR UPDATE`) e aplica
   * a regra sobre o estado lido já serializado — dois cliques rápidos em
   * "salvar" viram duas transações em fila, e a segunda relê o estado com o
   * primeiro salvo aplicado. O CHECK de cardinalidade no banco é a rede final.
   */
  private mutar(
    escolaId: string,
    alunoId: string,
    regra: (estado: EstadoSessao, agora: Date) => ResultadoRegra,
    extra: Prisma.UnootubeSessaoUpdateInput = {},
  ): Promise<RespostaEstado> {
    return this.prisma.comTenancy(async (tx) => {
      // Antes de criar linha: o aluno precisa ser desta escola (users está fora da RLS).
      await this.alunoDaEscola(tx, escolaId, alunoId);
      await tx.$executeRaw`
        INSERT INTO unootube_sessoes (escola_id, aluno_id)
        VALUES (${escolaId}, ${alunoId}::uuid)
        ON CONFLICT DO NOTHING`;
      await tx.$executeRaw`
        SELECT 1 FROM unootube_sessoes
        WHERE escola_id = ${escolaId} AND aluno_id = ${alunoId}::uuid
        FOR UPDATE`;
      const atual = await tx.unootubeSessao.findUniqueOrThrow({
        where: { escolaId_alunoId: { escolaId, alunoId } },
      });
      const resultado = regra(paraEstado(atual), new Date());
      if (!resultado.ok) erroDeJogo(resultado.codigo);
      if (resultado.mudou) {
        await tx.unootubeSessao.update({
          where: { escolaId_alunoId: { escolaId, alunoId } },
          data: { ...paraColunas(resultado.estado), ...extra },
        });
      }
      return respostaDe(resultado.estado);
    }, escolaId);
  }
}
