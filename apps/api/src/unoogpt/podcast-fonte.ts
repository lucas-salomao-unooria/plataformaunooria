import { Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { professorLeciona } from "../comum/turmas-do-professor";
import { ATIVIDADE_DA_TURMA } from "../equipes/regras";
import type { FonteDoPodcast } from "../podcast/fonte";
import { PodcastService } from "../podcast/podcast.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  FALANTES_DO_PODCAST,
  FALAS_DO_TEMA_PADRAO,
  VAGAS_DO_PODCAST,
  VOZ_DO_PODCAST,
  roteiroDoPodcast,
} from "./podcast";
import { MISSAO_TEMPESTADE } from "./cenario";
import { EXP_ID } from "./regras/defaults";

/**
 * A Missão Tempestade no podcast da plataforma (ADR-150, ADR-156): o primeiro
 * podcast FIXO. A missão não tem atividade — a "atividade" é a turma, o mesmo
 * `"turma"` das equipes e da evidência (ADR-154) —, o roteiro não tem vaga e
 * `padrao` é sempre verdade: o motor nunca procura falas na tabela nem
 * responde 409, e o roteiro sai inteiro de `podcast.ts`.
 *
 * Sem `escrita`: `POST …/falas-do-tema` responde 404 `experiencia-sem-podcast`
 * para esta missão, de propósito — não há o que a IA escrever nem o que o
 * professor revisar.
 */
export function fonteDoPodcastDaExp02em1b(prisma: PrismaService): FonteDoPodcast {
  return {
    expId: EXP_ID,
    titulo: "Missão Tempestade — a cidade que ninguém viu inteira",
    descricao: "Lia e Caio · cerca de 3 min 30 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: roteiroDoPodcast,
    async atividade(escolaId, turmaId, professorId) {
      await prisma.comTenancy(async (tx) => {
        const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true } });
        if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) {
          throw new NotFoundException({ codigo: "turma-nao-encontrada", mensagem: "Turma não encontrada nesta escola." });
        }
      }, escolaId);
      return { id: ATIVIDADE_DA_TURMA, tema: MISSAO_TEMPESTADE.chamada, padrao: true };
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp02em1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp02em1b(this.prisma));
  }
}
