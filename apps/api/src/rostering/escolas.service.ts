import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { escolaAtualDoAluno, garantirLotacao, type PapelDeLotacao } from "./lotacao";
import { periodoVigente } from "./regras";

export interface EscolaDaRede {
  id: string;
  nome: string;
  tipo: string;
  codigoInep: string | null;
  municipio: string | null;
  uf: string | null;
  paiId: string | null;
  alunos: number;
  professores: number;
  turmas: number;
}

/**
 * A REDE: escolas identificáveis, pessoas lotadas em mais de uma, e a
 * transferência de aluno entre elas.
 *
 * `escolas` e `lotacoes` ficam FORA da RLS (são identidade, lidas antes de haver
 * escola no contexto), então este service filtra por escola explicitamente,
 * como manda a regra 1 — a RLS aqui não é a rede de segurança de sempre.
 */
@Injectable()
export class EscolasService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ escolas

  /** Todas as escolas do contrato, com contagem. Só `admin-contrato` chega aqui. */
  async listar(busca?: string): Promise<EscolaDaRede[]> {
    const termo = busca?.trim();
    const escolas = await this.prisma.escola.findMany({
      where: termo
        ? {
            OR: [
              { nome: { contains: termo, mode: "insensitive" } },
              { id: { contains: termo, mode: "insensitive" } },
              { codigoInep: { contains: termo } },
              { municipio: { contains: termo, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: [{ nome: "asc" }],
      take: 500,
    });
    if (escolas.length === 0) return [];

    const ids = escolas.map((e) => e.id);
    const [lotacoes, turmas] = await Promise.all([
      this.prisma.lotacao.groupBy({
        by: ["escolaId", "papel"],
        where: { escolaId: { in: ids }, fim: null },
        _count: { _all: true },
      }),
      this.prisma.turma.groupBy({ by: ["escolaId"], where: { escolaId: { in: ids } }, _count: { _all: true } }),
    ]);
    const conta = (escolaId: string, papel: string) =>
      lotacoes.find((l) => l.escolaId === escolaId && l.papel === papel)?._count._all ?? 0;

    return escolas.map((e) => ({
      id: e.id,
      nome: e.nome,
      tipo: e.tipo,
      codigoInep: e.codigoInep,
      municipio: e.municipio,
      uf: e.uf,
      paiId: e.paiId,
      alunos: conta(e.id, "aluno"),
      professores: conta(e.id, "professor"),
      turmas: turmas.find((t) => t.escolaId === e.id)?._count._all ?? 0,
    }));
  }

  async criar(dados: {
    id: string;
    nome: string;
    tipo?: string;
    codigoInep?: string | null;
    municipio?: string | null;
    uf?: string | null;
    paiId?: string | null;
  }) {
    return this.prisma.escola.create({
      data: {
        id: dados.id,
        nome: dados.nome,
        tipo: dados.tipo ?? "escola",
        codigoInep: dados.codigoInep ?? null,
        municipio: dados.municipio ?? null,
        uf: dados.uf ?? null,
        paiId: dados.paiId ?? null,
      },
    });
  }

  async atualizar(
    id: string,
    dados: {
      nome?: string;
      codigoInep?: string | null;
      municipio?: string | null;
      uf?: string | null;
      paiId?: string | null;
    },
  ) {
    const escola = await this.prisma.escola.findUnique({ where: { id } });
    if (!escola) return null;
    return this.prisma.escola.update({ where: { id }, data: dados });
  }

  // ----------------------------------------------------------------- lotações

  /**
   * As escolas de uma PESSOA — a resposta que o login precisa antes de saber a
   * escola, e a que o hub consulta para validar a troca de escola ativa.
   *
   * Sem tenancy de propósito: é justamente a pergunta que atravessa escolas.
   */
  async escolasDaPessoa(usuarioId: string) {
    const lotacoes = await this.prisma.lotacao.findMany({
      where: { usuarioId, fim: null },
      include: { escola: { select: { id: true, nome: true, municipio: true, uf: true } } },
      orderBy: [{ principal: "desc" }, { escola: { nome: "asc" } }],
    });
    return lotacoes.map((l) => ({
      id: l.escola.id,
      nome: l.escola.nome,
      municipio: l.escola.municipio,
      uf: l.escola.uf,
      papel: l.papel,
      principal: l.principal,
    }));
  }

  /** `true` quando a pessoa tem lotação ativa nesta escola. */
  async temLotacao(usuarioId: string, escolaId: string) {
    const lotacao = await this.prisma.lotacao.findFirst({
      where: { usuarioId, escolaId, fim: null },
      select: { id: true },
    });
    return Boolean(lotacao);
  }

  /** Quem está lotado nesta escola, por papel. */
  async pessoasDaEscola(escolaId: string, papel: PapelDeLotacao) {
    const lotacoes = await this.prisma.lotacao.findMany({
      where: { escolaId, papel, fim: null },
      include: {
        usuario: {
          select: { id: true, username: true, displayName: true, ativo: true, cpfFinal: true },
        },
      },
      orderBy: [{ usuario: { displayName: "asc" } }],
    });
    return lotacoes.map((l) => ({
      lotacaoId: l.id,
      id: l.usuario.id,
      nome: l.usuario.displayName,
      usuario: l.usuario.username,
      ativo: l.usuario.ativo,
      cpfFinal: l.usuario.cpfFinal,
      principal: l.principal,
      desde: l.inicio,
    }));
  }

  /**
   * Lota uma pessoa numa escola. Para professor e gestor, ACRESCENTA — não
   * encerra a lotação que ela já tem em outra escola da rede.
   */
  async lotar(escolaId: string, usuarioId: string, papel: "professor" | "gestor") {
    const periodo = await this.periodoDeHoje();
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.user.findUnique({ where: { id: usuarioId } });
      if (!usuario || usuario.role === "admin-contrato") return null;
      const escola = await tx.escola.findUnique({ where: { id: escolaId } });
      if (!escola) return null;
      const primeira = (await tx.lotacao.count({ where: { usuarioId, fim: null } })) === 0;
      await garantirLotacao(tx, {
        escolaId,
        usuarioId,
        papel,
        inicio: periodo?.inicio ?? new Date(),
        principal: primeira,
      });
      return { ok: true as const };
    });
  }

  /** Encerra a lotação. Não apaga: é ela que diz que a pessoa esteve ali. */
  async encerrarLotacao(lotacaoId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lotacao = await tx.lotacao.findUnique({ where: { id: lotacaoId } });
      if (!lotacao || lotacao.fim) return null;
      await tx.lotacao.update({
        where: { id: lotacao.id },
        data: { fim: new Date(), principal: false },
      });
      // Fecha as matrículas de turma daquela escola: sem escola, não há turma.
      await this.comEscolaNaTransacao(tx, lotacao.escolaId, async () => {
        await tx.matricula.updateMany({
          where: { escolaId: lotacao.escolaId, usuarioId: lotacao.usuarioId, fim: null },
          data: { fim: new Date(), principal: false },
        });
      });
      // Se era a principal, a próxima lotação ativa assume — senão a pessoa
      // ficaria com `users.escola_id` apontando para onde não está mais.
      const outra = await tx.lotacao.findFirst({
        where: { usuarioId: lotacao.usuarioId, fim: null },
        orderBy: [{ inicio: "desc" }],
      });
      if (outra) {
        await tx.lotacao.update({ where: { id: outra.id }, data: { principal: true } });
        await tx.user.update({ where: { id: lotacao.usuarioId }, data: { escolaId: outra.escolaId } });
      }
      return { ok: true as const, escolaId: lotacao.escolaId };
    });
  }

  // ------------------------------------------------------------ transferência

  /**
   * Transfere o ALUNO para outra escola da rede.
   *
   * A transferência é a única operação da plataforma que, por definição,
   * atravessa duas escolas — e é o que o CPF existe para tornar possível: sem
   * uma identidade imutável, a criança que muda de escola nasce de novo e o
   * histórico dela fica partido em duas pessoas.
   *
   * O QUE SEGUE O ALUNO É A IDENTIDADE, NÃO O DADO. Tudo o que ele produziu
   * continua com o `escola_id` da escola onde produziu — é verdade histórica, e
   * mexer nisso apagaria de onde o fato veio. O que a plataforma passa a
   * conseguir é LER esse histórico atravessado (`historicoDoAluno`), por uma
   * porta só e estreita.
   */
  async transferirAluno(dados: {
    alunoId: string;
    escolaDestinoId: string;
    turmaDestinoId?: string | null;
  }) {
    const periodo = await this.periodoDeHoje();
    const inicio = periodo?.inicio ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const aluno = await tx.user.findUnique({ where: { id: dados.alunoId } });
      if (!aluno || aluno.role !== "aluno") return null;
      const destino = await tx.escola.findUnique({ where: { id: dados.escolaDestinoId } });
      if (!destino) return null;

      const origemId = await escolaAtualDoAluno(tx, aluno.id);
      if (origemId === destino.id) return { ok: true as const, origem: origemId, jaEstava: true };

      // --- sai da origem -------------------------------------------------
      if (origemId) {
        await tx.lotacao.updateMany({
          where: { usuarioId: aluno.id, escolaId: origemId, papel: "aluno", fim: null },
          data: { fim: new Date(), principal: false },
        });
        await this.comEscolaNaTransacao(tx, origemId, async () => {
          await tx.matricula.updateMany({
            where: { escolaId: origemId, usuarioId: aluno.id, fim: null },
            data: { fim: new Date(), principal: false },
          });
        });
      }

      // --- entra no destino ----------------------------------------------
      await garantirLotacao(tx, {
        escolaId: destino.id,
        usuarioId: aluno.id,
        papel: "aluno",
        inicio,
        principal: true,
      });

      if (dados.turmaDestinoId) {
        await this.comEscolaNaTransacao(tx, destino.id, async () => {
          const turma = await tx.turma.findFirst({
            where: { id: dados.turmaDestinoId!, escolaId: destino.id },
          });
          if (turma) {
            await tx.matricula.upsert({
              where: {
                escolaId_turmaId_usuarioId_papel: {
                  escolaId: destino.id,
                  turmaId: turma.id,
                  usuarioId: aluno.id,
                  papel: "aluno",
                },
              },
              update: { fim: null, principal: true },
              create: {
                escolaId: destino.id,
                turmaId: turma.id,
                usuarioId: aluno.id,
                papel: "aluno",
                principal: true,
                inicio,
              },
            });
            await tx.user.update({ where: { id: aluno.id }, data: { turmaId: turma.id } });
          }
        });
      } else {
        // Sem turma no destino o aluno fica lotado e SEM turma — é estado
        // legítimo (chegou no meio do ano, a turma ainda não foi decidida) e
        // aparece na lista de usuários como "sem turma".
        await tx.user.update({ where: { id: aluno.id }, data: { turmaId: null } });
      }

      return { ok: true as const, origem: origemId, jaEstava: false };
    });
  }

  /**
   * O histórico do aluno ATRAVESSANDO escolas — a única leitura da plataforma
   * que faz isso fora de `admin-contrato`.
   *
   * Devolve PARTICIPAÇÕES, não o conteúdo dos instrumentos: em que experiência
   * ele esteve, em que turma, em que escola, quando. O detalhe de cada
   * instrumento (o retrato de valores da Vila, a transcrição do unooGPT) continua
   * atrás das telas de quem tem a posse pedagógica na escola onde aquilo
   * aconteceu — atravessar a fronteira com o dado sensível junto seria abrir, por
   * uma tela de secretaria, o que quatro ADRs fecharam.
   */
  async historicoDoAluno(alunoId: string) {
    const aluno = await this.prisma.user.findUnique({
      where: { id: alunoId },
      select: { id: true, displayName: true, username: true, cpfFinal: true, role: true },
    });
    if (!aluno || aluno.role !== "aluno") return null;

    const [lotacoes, matriculas, progresso] = await Promise.all([
      this.prisma.lotacao.findMany({
        where: { usuarioId: alunoId, papel: "aluno" },
        include: { escola: { select: { id: true, nome: true, municipio: true, uf: true } } },
        orderBy: [{ inicio: "desc" }],
      }),
      this.prisma.matricula.findMany({
        where: { usuarioId: alunoId, papel: "aluno" },
        include: {
          turma: { select: { nome: true, serie: true, periodoLetivo: { select: { titulo: true } } } },
        },
        orderBy: [{ inicio: "desc" }],
      }),
      this.prisma.progresso.findMany({
        where: { alunoId },
        select: { escolaId: true, expId: true, atualizadoEm: true },
        orderBy: [{ atualizadoEm: "desc" }],
      }),
    ]);

    const nomeDaEscola = new Map(lotacoes.map((l) => [l.escola.id, l.escola.nome]));

    return {
      aluno: {
        id: aluno.id,
        nome: aluno.displayName,
        usuario: aluno.username,
        cpfFinal: aluno.cpfFinal,
      },
      escolas: lotacoes.map((l) => ({
        id: l.escola.id,
        nome: l.escola.nome,
        municipio: l.escola.municipio,
        uf: l.escola.uf,
        entrada: l.inicio,
        saida: l.fim,
        atual: l.fim === null,
      })),
      turmas: matriculas.map((m) => ({
        escola: nomeDaEscola.get(m.escolaId) ?? m.escolaId,
        turma: m.turma.nome,
        serie: m.turma.serie,
        periodo: m.turma.periodoLetivo.titulo,
        entrada: m.inicio,
        saida: m.fim,
      })),
      participacoes: progresso.map((p) => ({
        escola: nomeDaEscola.get(p.escolaId) ?? p.escolaId,
        expId: p.expId,
        em: p.atualizadoEm,
      })),
    };
  }

  // ------------------------------------------------------------------ comuns

  private async periodoDeHoje() {
    const periodos = await this.prisma.periodoLetivo.findMany({ orderBy: [{ inicio: "desc" }] });
    return periodoVigente(periodos, new Date());
  }

  /**
   * Arma a RLS para OUTRA escola no meio da transação em curso.
   *
   * A transferência é a única operação que precisa disso, e precisa por
   * definição: ela encerra o vínculo na escola de origem e abre na de destino,
   * numa transação só. Sem trocar o `app.escola_id`, o `updateMany` na origem
   * não veria linha nenhuma — a RLS o esconderia, sem erro, e a criança ficaria
   * matriculada nas duas escolas.
   *
   * `set_config(..., true)` é LOCAL à transação, então o valor volta ao anterior
   * no commit e a conexão nunca vaza escola para a próxima requisição.
   */
  private async comEscolaNaTransacao<T>(
    tx: Prisma.TransactionClient,
    escolaId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await tx.$executeRaw`SELECT set_config('app.escola_id', ${escolaId}, true)`;
    return fn();
  }
}
