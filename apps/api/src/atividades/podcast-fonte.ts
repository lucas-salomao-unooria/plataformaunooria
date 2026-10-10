import { ForbiddenException, Injectable, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { z } from "zod";
import { professorLeciona } from "../comum/turmas-do-professor";
import { ehUuid } from "../motor/guardas";
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

export const EXP_ID = "exp08ef1b";

/**
 * O Unoovista do 8º ano no podcast da plataforma (ADR-150, ADR-156): a
 * atividade é a `exp08ef1b_activities` da turma, e a escrita das falas lê a
 * pergunta-chave, os dois lados validados e uma amostra dos posts aprovados —
 * o que a tela de revisão já tem na mão.
 *
 * **Sem banco padrão** (o tema é sempre do professor): `padrao` é sempre
 * `false`. A atividade ativada sem falas — a anterior ao podcast, ou a que foi
 * posta no ar de novo pela sala de aula sem passar pela revisão — responde 409
 * `roteiro-indisponivel`, e o cartão da aula diz isso.
 */

const LadoDoMaterialSchema = z.object({
  rotulo: z.string().trim().min(2).max(60),
  tese: z.string().trim().max(600).default(""),
  argumentos: z.array(z.string().trim().max(200)).max(8).default([]),
  posts: z.array(z.string().trim().max(500)).max(6).default([]),
});

/** O que a tela de revisão manda: o tema, a pergunta e os dois lados, com até seis posts de cada. */
export const ConteudoDoPodcastSchema = z.object({
  tema: z.string().trim().min(2).max(200),
  pergunta: z.string().trim().min(5).max(300),
  ladoA: LadoDoMaterialSchema,
  ladoB: LadoDoMaterialSchema,
});
type ConteudoDoPodcast = z.infer<typeof ConteudoDoPodcastSchema>;

/** O que a IA lê: a pergunta e os dois lados, na ordem das vagas (o primeiro é o do Téo). */
export function materialDoPodcast(conteudo: ConteudoDoPodcast): string {
  const lado = (nome: string, l: ConteudoDoPodcast["ladoA"]) =>
    [
      `${nome}: "${l.rotulo}"`,
      l.tese ? `  Tese: ${l.tese}` : null,
      ...l.argumentos.map((a) => `  - Argumento: ${a}`),
      ...l.posts.map((p) => `  - Post: ${p}`),
    ]
      .filter(Boolean)
      .join("\n");
  return [
    `Tema: ${conteudo.tema}`,
    `Pergunta-chave da investigação: ${conteudo.pergunta}`,
    "",
    lado("Primeiro lado", conteudo.ladoA),
    "",
    lado("Segundo lado", conteudo.ladoB),
  ].join("\n");
}

const turmaNaoEncontrada = () =>
  new NotFoundException({ codigo: "turma-nao-encontrada", mensagem: "Turma não encontrada nesta escola." });

/** A fonte do 8º ano no podcast da plataforma. */
export function fonteDoPodcastDaExp08ef1b(prisma: PrismaService): FonteDoPodcast {
  const exigirTurma = (escolaId: string, turmaId: string, professorId: string | undefined) =>
    prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true } });
      if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) throw turmaNaoEncontrada();
    }, escolaId);

  return {
    expId: EXP_ID,
    titulo: "O Conteúdo que não chegou — o feed que cada um viu",
    descricao: "Duda e Téo · cerca de 3 min 30 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: roteiroDoPodcast,
    async atividade(escolaId, turmaId, professorId, atividadeId) {
      await exigirTurma(escolaId, turmaId, professorId);
      /* A rota aceita `"turma"` (a missão sem atividade); aqui a coluna é uuid. */
      if (atividadeId && !ehUuid(atividadeId)) {
        throw new NotFoundException({ codigo: "atividade-nao-encontrada", mensagem: "Atividade não encontrada nesta turma." });
      }
      const atividade = await prisma.comTenancy(
        (tx) =>
          tx.activity.findFirst({
            where: atividadeId ? { id: atividadeId, escolaId, turmaId } : { escolaId, turmaId, status: "ativa" },
            orderBy: { createdAt: "desc" },
            select: { id: true, recorte: true, temaGeral: true },
          }),
        escolaId,
      );
      if (!atividade) {
        if (atividadeId) {
          throw new NotFoundException({ codigo: "atividade-nao-encontrada", mensagem: "Atividade não encontrada nesta turma." });
        }
        throw new ForbiddenException({ codigo: "sem-atividade", mensagem: "Esta turma não tem atividade em andamento." });
      }
      return { id: atividade.id, tema: atividade.recorte || atividade.temaGeral, padrao: false };
    },
    escrita: {
      conteudo: ConteudoDoPodcastSchema,
      exigirTurma,
      ehPadrao: () => false,
      material: (conteudo) => materialDoPodcast(conteudo as ConteudoDoPodcast),
      publico: "adolescentes de 13 e 14 anos do 8º ano do Ensino Fundamental",
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp08ef1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp08ef1b(this.prisma));
  }
}
