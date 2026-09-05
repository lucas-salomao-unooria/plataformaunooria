import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { turmasDoEstudante } from "../comum/liberacao";
import { professorLeciona } from "../comum/turmas-do-professor";
import { PrismaService } from "../prisma/prisma.service";
import {
  camposDaTransicao,
  gradeDaTurma,
  type EstadoGravado,
  type ExperienciaDoCatalogo,
  type MissaoNaGrade,
} from "./regras";

/**
 * A SALA DE AULA (ADR-69): a turma como contexto do que existe para fazer.
 *
 * Este módulo é de PLATAFORMA, não de experiência — por isso não tem prefixo
 * `exp_NN_` e por isso ele não conhece nenhuma missão pelo nome. O que ele sabe
 * é turma, série e catálogo; o que cada missão faz por dentro continua sendo
 * assunto do módulo dela.
 */
@Injectable()
export class SalasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * O catálogo de experiências.
   *
   * Vem da tabela `experiencias`, que o CI escreve ao publicar o bundle. Numa
   * stack sem publish (dev, ambiente novo) ela está VAZIA, e a grade sai vazia
   * junto — é o que o `pnpm --filter @edu/api seed` resolve, semeando o catálogo
   * a partir dos `public/experiencia.json`. Um catálogo embutido aqui seria a
   * segunda fonte de verdade sobre o que existe, divergindo no primeiro publish.
   */
  private async catalogo(tx: Prisma.TransactionClient): Promise<ExperienciaDoCatalogo[]> {
    return tx.experiencia.findMany({
      select: { expId: true, nome: true, series: true, unidade: true, publico: true },
      orderBy: { expId: "asc" },
    });
  }

  private async estadosDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
  ): Promise<Map<string, EstadoGravado>> {
    const linhas = await tx.liberacao.findMany({
      where: { escolaId, turmaId },
      select: { expId: true, estado: true },
    });
    return new Map(linhas.map((l) => [l.expId, l.estado as EstadoGravado]));
  }

  /**
   * AS SALAS DO ESTUDANTE: as turmas dele e, em cada uma, a grade do ano.
   *
   * Devolve a grade INTEIRA, não só o liberado — a missão bloqueada aparece com
   * cadeado (ver `EstadoDaMissao`). Quem decide o que abre é o `estado`, e a
   * porta de verdade é `exigirMissaoLiberada`, no servidor: esconder o card é UX.
   *
   * Sem turma, `salas` volta VAZIO — e é a tela que explica que falta enturmar.
   * Um estudante fora de turma não tem sala, e inventar uma "turma geral" para
   * ele seria recriar a atividade sem turma que a ADR-49 acabou de fechar.
   */
  async minhas(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmaIds = await turmasDoEstudante(tx, escolaId, estudanteId);
      if (turmaIds.length === 0) return { salas: [] };

      const [turmas, catalogo] = await Promise.all([
        tx.turma.findMany({
          where: { id: { in: turmaIds }, escolaId },
          select: {
            id: true,
            nome: true,
            serie: true,
            turno: true,
            tipo: true,
            periodoLetivo: { select: { titulo: true } },
          },
          orderBy: [{ tipo: "asc" }, { nome: "asc" }],
        }),
        this.catalogo(tx),
      ]);

      const salas = await Promise.all(
        turmas.map(async (turma) => ({
          turma: {
            id: turma.id,
            nome: turma.nome,
            serie: turma.serie,
            turno: turma.turno,
            tipo: turma.tipo,
            periodo: turma.periodoLetivo.titulo,
          },
          missoes: gradeDaTurma(
            turma.serie,
            catalogo,
            await this.estadosDaTurma(tx, escolaId, turma.id),
          ),
        })),
      );

      return { salas };
    }, escolaId);
  }

  /**
   * A SALA DO PROFESSOR: a turma, a grade e quem liberou cada missão.
   *
   * `professorId` presente = só a turma em que ele tem matrícula
   * (`professorLeciona`); gestor e admin-contrato leem a escola inteira.
   */
  async daTurma(
    escolaId: string,
    turmaId: string,
    professorId?: string,
    incluirOutrasSeries = false,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({
        where: { id: turmaId, escolaId },
        select: {
          id: true,
          nome: true,
          serie: true,
          turno: true,
          tipo: true,
          periodoLetivo: { select: { titulo: true } },
          _count: { select: { estudantes: true } },
        },
      });
      /* 404 e não 403: uma tela que dissesse "sem permissão" já contaria que a
         turma existe. É o mesmo desenho de `GET /turmas/:id`. */
      if (!turma) throw new NotFoundException({ mensagem: "Turma não encontrada." });
      if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) {
        throw new NotFoundException({ mensagem: "Turma não encontrada." });
      }

      const [catalogo, estados, liberacoes] = await Promise.all([
        this.catalogo(tx),
        this.estadosDaTurma(tx, escolaId, turmaId),
        tx.liberacao.findMany({
          where: { escolaId, turmaId },
          select: {
            expId: true,
            liberadaEm: true,
            encerradaEm: true,
            professor: { select: { displayName: true } },
          },
        }),
      ]);

      const porExp = new Map(liberacoes.map((l) => [l.expId, l]));
      const missoes = gradeDaTurma(turma.serie, catalogo, estados, incluirOutrasSeries).map(
        (missao: MissaoNaGrade) => {
          const linha = porExp.get(missao.expId);
          return {
            ...missao,
            /* Quem liberou e quando: é a pergunta que a sala faz quando a missão
               aparece sem ninguém saber por quê — a turma tem mais de um
               professor com frequência. */
            liberadaPor: linha?.professor.displayName ?? null,
            liberadaEm: linha?.liberadaEm.toISOString() ?? null,
            encerradaEm: linha?.encerradaEm?.toISOString() ?? null,
          };
        },
      );

      return {
        turma: {
          id: turma.id,
          nome: turma.nome,
          serie: turma.serie,
          turno: turma.turno,
          tipo: turma.tipo,
          periodo: turma.periodoLetivo.titulo,
          estudantes: turma._count.estudantes,
        },
        missoes,
      };
    }, escolaId);
  }

  /**
   * LIBERAR ou ENCERRAR uma missão nesta turma. Idempotente: apertar duas vezes
   * não muda nada além do carimbo, e é exatamente o clique que um professor
   * nervoso dá duas vezes (a mesma razão da largada da exp-03).
   *
   * Só QUEM LECIONA libera. Gestor não: ele vê a sala e não decide a aula — a
   * opção nem aparece na tela dele, e aqui a rota recusa. Se uma rede pedir
   * liberação em lote pela coordenação, é uma linha a mais no `@Roles` e uma
   * frase na matriz do capítulo 7.
   */
  async definirEstado(
    escolaId: string,
    turmaId: string,
    expId: string,
    estado: EstadoGravado,
    professorId: string,
  ) {
    const agora = new Date();
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({
        where: { id: turmaId, escolaId },
        select: { id: true, serie: true },
      });
      if (!turma) throw new NotFoundException({ mensagem: "Turma não encontrada." });
      if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) {
        throw new NotFoundException({ mensagem: "Turma não encontrada." });
      }

      /* A experiência precisa existir no catálogo E ser de estudante. Sem esta
         checagem dava para liberar `exp-90-plano-de-aula` numa turma: um botão
         que não abre nada, porque `/exp/*` responde 404 para ferramenta de
         professor. Catálogo vazio (dev sem seed) cai aqui com a causa dita. */
      const experiencia = await tx.experiencia.findUnique({
        where: { expId },
        select: { expId: true, publico: true },
      });
      if (!experiencia) {
        throw new NotFoundException({
          mensagem:
            "Experiência não está no catálogo desta instalação. " +
            "Em desenvolvimento, rode o seed; em produção, ela entra no catálogo ao ser publicada.",
        });
      }
      if (experiencia.publico !== "estudante") {
        throw new ForbiddenException({
          mensagem: "Esta é uma ferramenta do professor, não uma missão de turma.",
        });
      }

      const campos = camposDaTransicao(estado, agora);
      const liberacao = await tx.liberacao.upsert({
        where: { escolaId_turmaId_expId: { escolaId, turmaId, expId } },
        update: campos,
        create: {
          escolaId,
          turmaId,
          expId,
          liberadaPor: professorId,
          liberadaEm: agora,
          ...campos,
        },
        select: { expId: true, estado: true, liberadaEm: true, encerradaEm: true },
      });

      return {
        expId: liberacao.expId,
        estado: liberacao.estado,
        liberadaEm: liberacao.liberadaEm.toISOString(),
        encerradaEm: liberacao.encerradaEm?.toISOString() ?? null,
      };
    }, escolaId);
  }
}
