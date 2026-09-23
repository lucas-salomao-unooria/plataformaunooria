import { Injectable } from "@nestjs/common";
import type { Prisma, UnootubeSessao } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { EXP_ID, LIMITE_SALVOS, VIDEOS, semGabarito, type VideoPublico } from "./catalogo";
import { erroDeJogo } from "./erros";
import {
  ESTADO_INICIAL,
  aplicarCredibilidade,
  aplicarRemover,
  aplicarSalvar,
  alternarCurtida,
  derivados,
  montarRanking,
  posicaoDoEstudante,
  resumirTurma,
  type Derivados,
  type EstadoSessao,
  type LinhaTurma,
  type RankingLinha,
  type ResultadoRegra,
  type ResumoTurma,
} from "./regras";

/**
 * Persistência do estado da missão. Assinaturas recebem `escolaId`/`estudanteId`
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
  estudante: { nome: string; avatar: string };
  ranking: RespostaRanking | null;
}

export interface RespostaTurma {
  turma: { id: string; nome: string; serie: string };
  estudantes: LinhaTurma[];
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

function avatarDe(estudante: { displayName: string; avatar: string | null }): string {
  const inicial = estudante.displayName.trim().charAt(0);
  return (inicial || "?").toUpperCase();
}

@Injectable()
export class UnootubeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Boot da experiência — READ-ONLY: sem linha devolve o estado inicial. */
  async sessao(escolaId: string, estudanteId: string): Promise<RespostaSessao> {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const linha = await tx.unootubeSessao.findUnique({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      const estado = paraEstado(linha);
      return {
        ...respostaDe(estado),
        catalogo: { videos: VIDEOS.map(semGabarito) },
        estudante: { nome: estudante.displayName, avatar: avatarDe(estudante) },
        ranking: estado.rankingDesbloqueado ? this.rankingDe(estudante, estado) : null,
      };
    }, escolaId);
  }

  salvar(escolaId: string, estudanteId: string, videoId: string) {
    return this.mutar(escolaId, estudanteId, (estado) => aplicarSalvar(estado, videoId));
  }

  remover(escolaId: string, estudanteId: string, videoId: string) {
    return this.mutar(escolaId, estudanteId, (estado) => aplicarRemover(estado, videoId));
  }

  curtir(escolaId: string, estudanteId: string, videoId: string) {
    return this.mutar(escolaId, estudanteId, (estado) => alternarCurtida(estado, videoId));
  }

  async ranking(escolaId: string, estudanteId: string): Promise<RespostaRanking> {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const linha = await tx.unootubeSessao.findUnique({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      const estado = paraEstado(linha);
      if (!estado.rankingDesbloqueado) erroDeJogo("RANKING_BLOQUEADO");
      return this.rankingDe(estudante, estado);
    }, escolaId);
  }

  async credibilidade(
    escolaId: string,
    estudanteId: string,
  ): Promise<RespostaEstado & { score: number }> {
    const resposta = await this.mutar(escolaId, estudanteId, (estado, agora) =>
      aplicarCredibilidade(estado, agora),
    );
    return { ...resposta, score: resposta.derivados.fontesConfiaveis };
  }

  reiniciar(escolaId: string, estudanteId: string) {
    return this.mutar(
      escolaId,
      estudanteId,
      () => ({ ok: true, estado: { ...ESTADO_INICIAL, salvos: [], curtidos: [] }, mudou: true }),
      { reinicios: { increment: 1 } },
    );
  }

  /** `professorId` presente = só as turmas dele (ver `ondeAsTurmasSaoVisiveis`). */
  async turmas(escolaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return {
        turmas: turmas.map((t) => ({
          id: t.id,
          nome: t.nome,
          serie: t.serie,
          estudantes: t._count.estudantes,
        })),
      };
    }, escolaId);
  }

  /**
   * Visão do professor. Parte de `users` (quem não iniciou também aparece);
   * `users`/`turmas` estão fora da RLS, por isso o `escolaId` no `where`.
   *
   * Autorização: escola do token E matrícula na turma quando quem pede é
   * professor. Antes de `matriculas` existir, a única prova era "mesma escola",
   * que é a regra de tenancy — não a de quem dá aula naquela sala.
   */
  async resultadosDaTurma(
    escolaId: string,
    turmaId: string,
    professorId?: string,
  ): Promise<RespostaTurma> {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({
        where: { id: turmaId, escolaId },
        select: { id: true, nome: true, serie: true },
      });
      if (!turma) erroDeJogo("TURMA_NAO_ENCONTRADA");
      if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) {
        erroDeJogo("TURMA_NAO_ENCONTRADA");
      }

      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        select: {
          id: true,
          displayName: true,
          username: true,
          unootube: { where: { escolaId }, take: 1 },
        },
        orderBy: { displayName: "asc" },
      });

      const linhas: LinhaTurma[] = estudantes.map((a) => {
        const sessao = a.unootube[0];
        const estado = paraEstado(sessao);
        const d = derivados(estado.salvos);
        return {
          id: a.id,
          estudanteId: a.id,
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

      return { turma, estudantes: linhas, resumo: resumirTurma(linhas) };
    }, escolaId);
  }

  // -------------------------------------------------------------------------

  private rankingDe(
    estudante: { displayName: string; avatar: string | null },
    estado: EstadoSessao,
  ): RespostaRanking {
    const linhas = montarRanking({ nome: estudante.displayName, avatar: avatarDe(estudante) }, estado.salvos);
    return { linhas, posicao: posicaoDoEstudante(linhas) };
  }

  /**
   * `users` está fora da RLS — a escola do token precisa bater com a do usuário.
   *
   * É também O FUNIL desta experiência: `sessao` e `mutar` passam os dois por
   * aqui, então é o lugar certo para a porta da sala (ADR-69). Pô-la só na
   * entrada de leitura deixaria `POST /salvos` aberto a quem chamasse a rota
   * direto, sem nunca abrir a missão.
   */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({
      where: { id: estudanteId },
      select: { displayName: true, avatar: true, escolaId: true },
    });
    if (!estudante || estudante.escolaId !== escolaId) erroDeJogo("TURMA_NAO_ENCONTRADA");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return estudante;
  }

  /**
   * Núcleo de toda mutação: garante a linha, tranca-a (`FOR UPDATE`) e aplica
   * a regra sobre o estado lido já serializado — dois cliques rápidos em
   * "salvar" viram duas transações em fila, e a segunda relê o estado com o
   * primeiro salvo aplicado. O CHECK de cardinalidade no banco é a rede final.
   */
  private mutar(
    escolaId: string,
    estudanteId: string,
    regra: (estado: EstadoSessao, agora: Date) => ResultadoRegra,
    extra: Prisma.UnootubeSessaoUpdateInput = {},
  ): Promise<RespostaEstado> {
    return this.prisma.comTenancy(async (tx) => {
      // Antes de criar linha: o estudante precisa ser desta escola (users está fora da RLS).
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`
        INSERT INTO exp04ef1b_sessoes (escola_id, estudante_id)
        VALUES (${escolaId}, ${estudanteId}::uuid)
        ON CONFLICT DO NOTHING`;
      await tx.$executeRaw`
        SELECT 1 FROM exp04ef1b_sessoes
        WHERE escola_id = ${escolaId} AND estudante_id = ${estudanteId}::uuid
        FOR UPDATE`;
      const atual = await tx.unootubeSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      const resultado = regra(paraEstado(atual), new Date());
      if (!resultado.ok) erroDeJogo(resultado.codigo);
      if (resultado.mudou) {
        await tx.unootubeSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
          data: { ...paraColunas(resultado.estado), ...extra },
        });
      }
      return respostaDe(resultado.estado);
    }, escolaId);
  }
}
