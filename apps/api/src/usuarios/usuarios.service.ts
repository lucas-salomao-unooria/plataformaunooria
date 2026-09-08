import { HttpException, Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";
import { digitosDoCpf, formatarCpf } from "../comum/cpf";
import { gerarSenha, gerarUsuario } from "../rostering/regras";
import { planilhaDeUmaPessoa } from "../rostering/planilha";
import { RosteringService } from "../rostering/rostering.service";
import type { CriarSemEscolaSchema, CriarUsuarioSchema } from "./contrato-de-rotas";

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

/** O 409 do cadastro unitário: quem já existe, e por qual chave. */
export interface ConflitoDeIdentidade {
  codigo: "CPF_JA_EXISTE" | "CPF_EM_OUTRA_ESCOLA" | "MATRICULA_JA_EXISTE" | "LOGIN_JA_EXISTE";
  campo: string;
  mensagem: string;
  /** Só quando a pessoa é DESTA escola — o hub abre a edição dela. */
  usuarioId?: string;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rostering: RosteringService,
  ) {}

  async listar(escolaId: string, filtro: FiltroDeUsuarios) {
    const busca = filtro.busca?.trim();
    const where = {
      escolaId,
      ...(filtro.papel
        ? { role: filtro.papel === "estudante" ? { in: ["estudante"] } : filtro.papel }
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
            /* O gestor de mais de uma unidade e o `gestor_contrato` precisam ver
               DE QUE escola é a linha — sem isso a lista mistura unidades sem
               dizer. `escola_id` é sempre o da lotação principal. */
            escola: { select: { nome: true } },
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
            escola: u.escola?.nome ?? null,
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
      where: { id: usuarioId, escolaId, NOT: { role: "gestor_contrato" } },
    });
    if (!usuario) return null;
    const atualizado = await this.prisma.user.update({
      where: { id: usuario.id },
      data: {
        ...(dados.nome !== undefined ? { displayName: dados.nome } : {}),
        ...(dados.email !== undefined ? { email: dados.email } : {}),
        /* `estudante` ainda entra pelo schema (tolerância do vocabulário antigo,
           ADR-51), mas `users.role` tem CHECK e só admite `estudante` — sem esta
           normalização o valor cru virava 500 em vez de um 400 (ADR-53). */
        ...(dados.papel !== undefined
          ? { role: dados.papel }
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
      where: { id: usuarioId, escolaId, NOT: { role: "gestor_contrato" } },
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

  /* ----------------------------------------------------- cadastro unitário */

  /**
   * Quem já existe com esta identidade — a pergunta que separa "criar" de
   * "atualizar sem avisar".
   *
   * O importador é IDEMPOTENTE de propósito: reimportar a planilha do ano
   * inteiro não pode duplicar ninguém. Num formulário chamado "Novo usuário",
   * a mesma virtude vira armadilha — o gestor digita a Ana de novo, a
   * importação atualiza a Ana antiga e a tela diz "criado". Por isso o cadastro
   * unitário PERGUNTA antes, e recusa com 409 em vez de escrever.
   *
   * `users` está FORA da RLS (é lida no login, antes de haver escola): o
   * `escolaId` no `where` é a única tranca, e sua ausência já vazou lista de
   * pessoas uma vez (ADR-49). A exceção deliberada é o CPF, procurado na rede
   * inteira — é o índice único do contrato, e é assim que a plataforma sabe que
   * a criança transferida é a mesma pessoa.
   */
  async conflitoDeIdentidade(
    escolaId: string,
    dados: { cpf?: string; matricula?: string; usuario?: string },
  ): Promise<ConflitoDeIdentidade | null> {
    const cpf = dados.cpf ? digitosDoCpf(dados.cpf) : "";
    if (cpf) {
      const dono = await this.prisma.user.findFirst({
        where: { cpf },
        select: { id: true, escolaId: true },
      });
      if (dono && dono.escolaId === escolaId) {
        return {
          codigo: "CPF_JA_EXISTE",
          campo: "cpf",
          mensagem: "Já existe uma pessoa com este CPF nesta escola. Abra o cadastro dela para editar.",
          usuarioId: dono.id,
        };
      }
      /* Achado em OUTRA escola: a resposta não carrega id, nome nem qual escola.
         Quem pergunta é o gestor de uma unidade, e a existência da pessoa lá é
         dado de outro tenant — o caminho legítimo (transferência) é a
         importação, que reconhece o CPF e move a matrícula junto. */
      if (dono) {
        return {
          codigo: "CPF_EM_OUTRA_ESCOLA",
          campo: "cpf",
          mensagem:
            "Este CPF já pertence a alguém em outra escola da rede. Transferir é pela importação, que move a matrícula junto.",
        };
      }
    }

    if (dados.matricula) {
      const jaTem = await this.prisma.user.findFirst({
        where: { escolaId, matriculaExterna: dados.matricula },
        select: { id: true },
      });
      if (jaTem) {
        return {
          codigo: "MATRICULA_JA_EXISTE",
          campo: "matricula",
          mensagem: "Já existe uma pessoa com esta matrícula nesta escola.",
          usuarioId: jaTem.id,
        };
      }
    }

    if (dados.usuario) {
      const naEscola = await this.prisma.user.findFirst({
        where: { escolaId, username: dados.usuario },
        select: { id: true },
      });
      if (naEscola) {
        return {
          codigo: "LOGIN_JA_EXISTE",
          campo: "usuario",
          mensagem: "Este login já está em uso nesta escola. Deixe em branco para gerar um.",
          usuarioId: naEscola.id,
        };
      }
      /* Login de `gestor_contrato` é reservado em toda a rede: o login procura o
         username na rede inteira e recusa quando duas contas respondem. */
      const reservado = await this.prisma.user.findFirst({
        where: { username: dados.usuario, role: "gestor_contrato" },
        select: { id: true },
      });
      if (reservado) {
        return {
          codigo: "LOGIN_JA_EXISTE",
          campo: "usuario",
          mensagem: "Este login é reservado na rede. Escolha outro ou deixe em branco.",
        };
      }
    }

    return null;
  }

  /**
   * Cadastro unitário de pessoa da escola.
   *
   * Não escreve em `users`: monta a MESMA linha de planilha que a escola
   * escreveria e chama o MESMO importador (ADR-59, cumprindo o gatilho da
   * ADR-54). É de graça que vêm, com isso, a validação de CPF com dígito
   * verificador, a normalização de série e turno, o login gerado a partir do
   * nome, a turma criada quando não existe, a lotação e a matrícula — tudo na
   * mesma transação, e sem um segundo caminho de escrita para divergir.
   */
  async criarPessoa(escolaId: string, dados: z.infer<typeof CriarUsuarioSchema>) {
    const conflito = await this.conflitoDeIdentidade(escolaId, dados);
    if (conflito) throw new HttpException(conflito, 409);

    const csv = planilhaDeUmaPessoa({
      cpf: dados.cpf,
      matricula: dados.matricula,
      nome: dados.nome,
      usuario: dados.usuario,
      email: dados.email,
      papel: dados.papel,
      turma: dados.turma,
      serie: dados.serie,
      turno: dados.turno,
    });

    const relatorio = await this.rostering.importarPlanilha(
      escolaId,
      csv,
      dados.senha ? { senhaPadrao: dados.senha } : { gerarSenhas: true },
    );

    if (relatorio.erros.length > 0) {
      throw new HttpException(
        {
          mensagem: "Confira os campos destacados.",
          /* O `campo` do leitor vira o nome do campo do formulário. `arquivo` é
             o que o importador usa para o que não é de nenhuma linha — hoje só
             a falta de ano letivo aberto, que na tela é outro botão. */
          erros: relatorio.erros.map((erro) => ({
            campo: erro.campo === "arquivo" ? "periodoLetivo" : erro.campo,
            mensagem: erro.mensagem,
          })),
        },
        400,
      );
    }

    const credencial = relatorio.credenciais[0];
    if (relatorio.criados !== 1 || !credencial) {
      /* Alguém criou a mesma pessoa entre a pergunta e a escrita. A janela é de
         milissegundos e o importador fez a coisa certa (atualizou em vez de
         duplicar) — o que não pode é a tela dizer "criado". */
      if (relatorio.atualizados + relatorio.transferidos + relatorio.lotacoesNovas > 0) {
        throw new HttpException(
          {
            codigo: "JA_EXISTIA",
            mensagem:
              "Esta pessoa já existia e o cadastro foi atualizado. Confira na lista de usuários.",
          },
          409,
        );
      }
      throw new HttpException({ mensagem: "Não foi possível criar a pessoa." }, 500);
    }

    return {
      id: credencial.id,
      nome: credencial.nome,
      usuario: credencial.usuario,
      papel: dados.papel,
      turma: credencial.turma,
      turmaCriada: relatorio.turmasCriadas.length > 0,
      senha: credencial.senha,
      avisos: relatorio.avisos.map((aviso) => ({ campo: aviso.campo, mensagem: aviso.mensagem })),
    };
  }

  /**
   * Cadastro de `gestor_contrato` — o único papel que NÃO passa pelo importador.
   *
   * Ele não pertence a escola nenhuma (`escola_id` nulo, sem lotação e sem
   * matrícula), e a planilha é um documento DA escola: não há coluna onde ele
   * caiba. `PAPEIS_IMPORTAVEIS` o exclui desde sempre.
   *
   * O login é único na REDE, não na escola: o índice `(escola_id, username)`
   * não cobre linha com `escola_id` nulo, e a autenticação procura o username
   * na rede inteira — dois donos do mesmo login viram recusa no login de
   * ambos, que é o pior lugar para descobrir a colisão.
   */
  async criarSemEscola(dados: z.infer<typeof CriarSemEscolaSchema>) {
    const cpf = dados.cpf ? digitosDoCpf(dados.cpf) : null;
    if (cpf) {
      const dono = await this.prisma.user.findFirst({ where: { cpf }, select: { id: true } });
      if (dono) {
        throw new HttpException(
          {
            codigo: "CPF_JA_EXISTE",
            campo: "cpf",
            mensagem: "Este CPF já pertence a alguém na rede.",
          },
          409,
        );
      }
    }

    let usuario = dados.usuario;
    if (usuario) {
      const jaExiste = await this.prisma.user.findFirst({
        where: { username: usuario },
        select: { id: true },
      });
      if (jaExiste) {
        throw new HttpException(
          {
            codigo: "LOGIN_JA_EXISTE",
            campo: "usuario",
            mensagem: "Este login já está em uso na rede. Escolha outro ou deixe em branco.",
          },
          409,
        );
      }
    } else {
      const todos = await this.prisma.user.findMany({ select: { username: true } });
      usuario = gerarUsuario(dados.nome, new Set(todos.map((u) => u.username)));
    }

    const senha = dados.senha ?? gerarSenha();
    const criado = await this.prisma.user.create({
      data: {
        role: dados.papel,
        escolaId: null,
        /* A regional é o ESCOPO do `gestor_regional` — sem ela o CHECK
           bicondicional do banco recusa a linha, e o Zod já reprovou antes. */
        regionalId: dados.regionalId ?? null,
        username: usuario,
        displayName: dados.nome,
        passwordHash: await bcrypt.hash(senha, 10),
        senhaProvisoria: true,
        ativo: true,
        ...(cpf ? { cpf } : {}),
        ...(dados.email ? { email: dados.email } : {}),
      },
    });

    return {
      id: criado.id,
      nome: criado.displayName,
      usuario: criado.username,
      papel: dados.papel,
      senha,
    };
  }
}
