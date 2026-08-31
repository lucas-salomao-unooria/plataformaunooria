import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { digitosDoCpf, formatarCpf } from "../comum/cpf";
import { gerarSenha } from "../rostering/regras";

/**
 * Gestão das contas que já existem: listar, editar, desativar e resetar senha.
 *
 * A ENTRADA de pessoas não está mais aqui — foi para `src/rostering`, que é a
 * fronteira de importação (planilha simples e OneRoster caem no mesmo núcleo).
 * Dois importadores lado a lado divergiriam na primeira regra nova; a
 * `POST /usuarios/importar-csv` continua existindo e delega para lá.
 */

export interface FiltroDeUsuarios {
  papel?: string;
  turmaId?: string;
  /** `ativos` | `inativos` | `sem-primeiro-acesso` */
  situacao?: string;
  busca?: string;
  pagina: number;
  porPagina: number;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(escolaId: string, filtro: FiltroDeUsuarios) {
    const busca = filtro.busca?.trim();
    const where = {
      escolaId,
      ...(filtro.papel
        ? { role: filtro.papel === "aluno" || filtro.papel === "estudante" ? { in: ["estudante", "aluno"] } : filtro.papel }
        : {}),
      ...(filtro.situacao === "ativos" ? { ativo: true } : {}),
      ...(filtro.situacao === "inativos" ? { ativo: false } : {}),
      ...(filtro.situacao === "sem-primeiro-acesso" ? { senhaProvisoria: true } : {}),
      ...(filtro.turmaId
        ? { matriculas: { some: { escolaId, turmaId: filtro.turmaId, fim: null } } }
        : {}),
      ...(busca
        ? {
            OR: [
              { displayName: { contains: busca, mode: "insensitive" as const } },
              { username: { contains: busca, mode: "insensitive" as const } },
              { matriculaExterna: { contains: busca, mode: "insensitive" as const } },
              /* Buscar por CPF é o caso mais comum do balcão: a família chega com
                 o documento. Compara pelos DÍGITOS — quem digita "529.982" e quem
                 digita "529982" procura a mesma pessoa. */
              ...(digitosDoCpf(busca) ? [{ cpf: { contains: digitosDoCpf(busca) } }] : []),
            ],
          }
        : {}),
    };

    // Dentro de `comTenancy` porque a listagem inclui MATRÍCULAS, e `matriculas`
    // tem RLS: fora do contexto a lista voltaria com todo mundo "sem turma", em
    // silêncio e sem erro nenhum.
    return this.prisma.comTenancy(async (tx) => {
      const [total, usuarios] = await Promise.all([
        tx.user.count({ where }),
        tx.user.findMany({
          where,
          include: {
            matriculas: {
              where: { fim: null },
              include: { turma: { select: { nome: true, serie: true } } },
            },
          },
          orderBy: [{ role: "asc" }, { username: "asc" }],
          skip: (filtro.pagina - 1) * filtro.porPagina,
          take: filtro.porPagina,
        }),
      ]);
      return {
        total,
        pagina: filtro.pagina,
        porPagina: filtro.porPagina,
        usuarios: usuarios.map((u) => {
          const principal = u.matriculas.find((m) => m.principal) ?? u.matriculas[0];
          return {
            id: u.id,
            usuario: u.username,
            nome: u.displayName,
            papel: u.role,
            matricula: u.matriculaExterna,
            /* Formatado como em qualquer documento brasileiro. Só gestor e
               admin-contrato chegam nesta rota. */
            cpf: u.cpf ? formatarCpf(u.cpf) : null,
            email: u.email,
            ativo: u.ativo,
            /** Ainda não fez o primeiro acesso (senha veio da importação). */
            senhaProvisoria: u.senhaProvisoria,
            turma: principal?.turma.nome ?? null,
            serie: principal?.turma.serie ?? null,
            /** Todas as turmas ativas — estudante em eletiva tem mais de uma. */
            turmas: u.matriculas.map((m) => ({
              matriculaId: m.id,
              nome: m.turma.nome,
              serie: m.turma.serie,
              papel: m.papel,
            })),
            criadoEm: u.createdAt,
          };
        }),
      };
    }, escolaId);
  }

  async atualizar(
    escolaId: string,
    usuarioId: string,
    dados: {
      nome?: string;
      email?: string | null;
      papel?: string;
      ativo?: boolean;
      cpf?: string | null;
    },
  ) {
    const usuario = await this.prisma.user.findFirst({
      where: { id: usuarioId, escolaId, NOT: { role: "admin-contrato" } },
    });
    if (!usuario) return null;
    const atualizado = await this.prisma.user.update({
      where: { id: usuario.id },
      data: {
        ...(dados.nome !== undefined ? { displayName: dados.nome } : {}),
        ...(dados.email !== undefined ? { email: dados.email } : {}),
        /* `estudante` ainda entra pelo schema (tolerância do vocabulário antigo),
           mas `users.role` tem CHECK e só admite `estudante` — sem esta
           normalização o valor cru virava 500 em vez de gravar. */
        ...(dados.papel !== undefined
          ? { role: dados.papel === "aluno" ? "estudante" : dados.papel }
          : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
        ...(dados.cpf !== undefined ? { cpf: dados.cpf } : {}),
      },
    });
    return {
      id: atualizado.id,
      usuario: atualizado.username,
      nome: atualizado.displayName,
      papel: atualizado.role,
      email: atualizado.email,
      cpf: atualizado.cpf ? formatarCpf(atualizado.cpf) : null,
      ativo: atualizado.ativo,
    };
  }

  /**
   * Gera senha temporária e devolve UMA vez — não fica em log nem em coluna.
   * Marca a conta como provisória: quem entrar com ela é obrigado a trocar.
   */
  async resetarSenha(escolaId: string, usuarioId: string) {
    const usuario = await this.prisma.user.findFirst({
      where: { id: usuarioId, escolaId, NOT: { role: "admin-contrato" } },
    });
    if (!usuario) return null;
    const senhaTemporaria = gerarSenha();
    await this.prisma.user.update({
      where: { id: usuario.id },
      data: {
        passwordHash: await bcrypt.hash(senhaTemporaria, 10),
        senhaProvisoria: true,
        senhaDefinidaEm: null,
      },
    });
    return { usuario: usuario.username, senhaTemporaria };
  }
}
