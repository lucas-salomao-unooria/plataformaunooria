import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { matricularEm } from "./matricula";
import { lerPlanilha, type ErroDeLinha, type PessoaDaPlanilha } from "./planilha";
import { gerarSenha, gerarUsuario, periodoVigente, senhaAceitavel } from "./regras";

export const MAX_LINHAS = 50_000;
const CHUNK = 100;
const TIMEOUT_DA_ESCRITA = 30_000;
const TETO_DE_ASSENTOS = 200;

export interface Credencial {
  nome: string;
  usuario: string;
  senha: string;
  turma: string | null;
}

export interface RelatorioImportacao {
  criados: number;
  atualizados: number;
  matriculados: number;
  /** `status = tobedeleted`: desativado, nunca apagado. */
  desativados: number;
  /**
   * Em `bulk`, quem existe aqui e NÃO veio no arquivo. Ausência de linha num
   * lote completo não é ordem de exclusão — mas também não pode passar em
   * silêncio, senão a rede some da plataforma por omissão.
   */
  candidatosAInativacao: number;
  turmasCriadas: string[];
  erros: ErroDeLinha[];
  avisos: ErroDeLinha[];
  /** Devolvidas UMA vez, para o gestor imprimir. Não ficam em coluna nem em log. */
  credenciais: Credencial[];
}

export interface OpcoesDeImportacao {
  /** Senha única do lote. Vale só para quem está NASCENDO nesta importação. */
  senhaPadrao?: string;
  /** Uma senha diferente por pessoa (recomendado para alunos). */
  gerarSenhas?: boolean;
}

export const relatorioVazio = (): RelatorioImportacao => ({
  criados: 0,
  atualizados: 0,
  matriculados: 0,
  desativados: 0,
  candidatosAInativacao: 0,
  turmasCriadas: [],
  erros: [],
  avisos: [],
  credenciais: [],
});

@Injectable()
export class RosteringService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ períodos

  /**
   * `periodos_letivos` é catálogo do contrato: sem escola_id e sem RLS, então
   * é lido fora de `comTenancy`.
   */
  async periodos() {
    return this.prisma.periodoLetivo.findMany({ orderBy: [{ inicio: "desc" }] });
  }

  async periodoDeHoje() {
    return periodoVigente(await this.periodos(), new Date());
  }

  async criarPeriodo(dados: { tipo: string; titulo: string; ano: number; inicio: Date; fim: Date }) {
    return this.prisma.periodoLetivo.create({ data: dados });
  }

  // --------------------------------------------------------------- importação

  /**
   * Importa a planilha de pessoas. Idempotente: a chave é a MATRÍCULA da pessoa
   * na rede e, na falta dela, o login. Reimportar o mesmo arquivo atualiza; não
   * duplica ninguém.
   *
   * Senha: só quem nasce nesta importação recebe senha. Reimportar NÃO reseta a
   * senha de quem já entrou — seria trancar a escola inteira para fora no dia
   * em que o gestor corrige um nome no arquivo.
   */
  async importarPlanilha(
    escolaId: string,
    csv: string,
    opcoes: OpcoesDeImportacao = {},
  ): Promise<RelatorioImportacao> {
    const leitura = lerPlanilha(csv);
    const relatorio = relatorioVazio();
    relatorio.erros = [...leitura.erros];
    relatorio.avisos = [...leitura.avisos];

    if (leitura.pessoas.length === 0) return relatorio;
    if (leitura.pessoas.length > MAX_LINHAS) {
      relatorio.erros.push({
        linha: 1,
        campo: "arquivo",
        mensagem: `máximo de ${MAX_LINHAS} linhas por importação — divida o arquivo`,
      });
      return relatorio;
    }
    if (opcoes.senhaPadrao && !senhaAceitavel(opcoes.senhaPadrao)) {
      relatorio.erros.push({
        linha: 1,
        campo: "senha",
        mensagem: "senha padrão: mínimo 8 caracteres",
      });
      return relatorio;
    }

    const periodo = await this.periodoDeHoje();
    if (!periodo) {
      relatorio.erros.push({
        linha: 1,
        campo: "arquivo",
        mensagem: "nenhum período letivo cadastrado — crie o ano letivo antes de importar",
      });
      return relatorio;
    }

    const existentes = await this.prisma.user.findMany({
      where: { escolaId },
      select: { id: true, username: true, matriculaExterna: true, role: true, turmaId: true },
    });
    const porMatricula = new Map(
      existentes.filter((u) => u.matriculaExterna).map((u) => [u.matriculaExterna!, u]),
    );
    const porUsuario = new Map(existentes.map((u) => [u.username, u]));
    const loginsUsados = new Set(existentes.map((u) => u.username));

    // 1) Decide, para cada linha, quem é a pessoa e qual senha ela recebe —
    //    tudo antes de escrever, e o bcrypt fora da transação (é ~80ms cada).
    type Preparada = {
      pessoa: PessoaDaPlanilha;
      existenteId: string | null;
      usuario: string;
      senha: string | null;
    };
    const preparadas: Preparada[] = [];

    for (const pessoa of leitura.pessoas) {
      /**
       * Quem é esta pessoa? A matrícula da rede manda. O login só serve de
       * chave quando não contradiz uma matrícula já registrada — senão uma
       * linha nova que reusa um login existente viraria a RENOMEAÇÃO silenciosa
       * de outra pessoa, com o histórico dela junto.
       *
       * O caso em que o login adota mesmo assim é o que importa na virada:
       * conta antiga SEM matrícula (a conta de assento) recebendo agora o RA de
       * uma criança de verdade.
       */
      let existente = pessoa.matricula ? (porMatricula.get(pessoa.matricula) ?? null) : null;
      if (!existente && pessoa.usuario) {
        const candidato = porUsuario.get(pessoa.usuario) ?? null;
        const compativel =
          candidato &&
          (!pessoa.matricula ||
            !candidato.matriculaExterna ||
            candidato.matriculaExterna === pessoa.matricula);
        if (compativel) existente = candidato;
      }

      if (existente?.role === "admin-contrato") {
        relatorio.erros.push({ linha: pessoa.linha, campo: "usuario", mensagem: "usuario reservado" });
        continue;
      }

      let usuario = pessoa.usuario || existente?.username || "";
      if (!usuario) {
        usuario = gerarUsuario(pessoa.nome, loginsUsados);
      }
      // Login pedido no arquivo que já pertence a OUTRA pessoa da escola.
      const dono = porUsuario.get(usuario);
      if (dono && dono.id !== existente?.id) {
        relatorio.erros.push({
          linha: pessoa.linha,
          campo: "usuario",
          mensagem: `o login "${usuario}" já é de outra pessoa nesta escola`,
        });
        continue;
      }
      loginsUsados.add(usuario);

      let senha: string | null = null;
      if (pessoa.senha) senha = pessoa.senha;
      else if (!existente) senha = opcoes.gerarSenhas ? gerarSenha() : (opcoes.senhaPadrao ?? null);

      if (!existente && !senha) {
        relatorio.erros.push({
          linha: pessoa.linha,
          campo: "senha",
          mensagem: "senha: obrigatória para usuário novo — escolha a senha do lote na tela de importação",
        });
        continue;
      }

      preparadas.push({ pessoa, existenteId: existente?.id ?? null, usuario, senha });
    }

    if (preparadas.length === 0) return relatorio;

    // 2) Turmas do lote, resolvidas de uma vez.
    const turmasDoArquivo = new Map<string, { serie: string; turno: string | null }>();
    for (const { pessoa } of preparadas) {
      if (!pessoa.turma) continue;
      const atual = turmasDoArquivo.get(pessoa.turma);
      turmasDoArquivo.set(pessoa.turma, {
        serie: pessoa.serie || atual?.serie || "",
        turno: pessoa.turno ?? atual?.turno ?? null,
      });
    }

    const idPorTurma = new Map<string, string>();
    await this.prisma.comTenancy(async (tx) => {
      for (const [nome, dados] of turmasDoArquivo) {
        const existente = await tx.turma.findUnique({
          where: {
            escolaId_periodoLetivoId_nome: { escolaId, periodoLetivoId: periodo.id, nome },
          },
        });
        if (existente) {
          if ((dados.serie && dados.serie !== existente.serie) || (dados.turno && dados.turno !== existente.turno)) {
            await tx.turma.update({
              where: { id: existente.id },
              data: { serie: dados.serie || existente.serie, turno: dados.turno ?? existente.turno },
            });
          }
          idPorTurma.set(nome, existente.id);
          continue;
        }
        const criada = await tx.turma.create({
          data: {
            escolaId,
            periodoLetivoId: periodo.id,
            nome,
            // Turma criada por linha de professor pode não trazer série; a do
            // aluno traz (é obrigatória para ele) e corrige na mesma passada.
            serie: dados.serie || "9EF",
            turno: dados.turno,
          },
        });
        idPorTurma.set(nome, criada.id);
        relatorio.turmasCriadas.push(nome);
      }
    }, escolaId);

    // 3) Hash fora da transação, e escrita em lotes curtos.
    for (let i = 0; i < preparadas.length; i += CHUNK) {
      const lote = preparadas.slice(i, i + CHUNK);
      const hashes = await Promise.all(
        lote.map((p) => (p.senha ? bcrypt.hash(p.senha, 10) : Promise.resolve(null))),
      );

      await this.prisma.comTenancy(
        async (tx) => {
          for (let j = 0; j < lote.length; j += 1) {
            const { pessoa, existenteId, usuario, senha } = lote[j]!;
            const hash = hashes[j];
            const turmaId = pessoa.turma ? (idPorTurma.get(pessoa.turma) ?? null) : null;

            const comum = {
              displayName: pessoa.nome,
              role: pessoa.papel,
              ...(pessoa.matricula ? { matriculaExterna: pessoa.matricula } : {}),
              ...(pessoa.email ? { email: pessoa.email } : {}),
              ativo: true,
            };

            let usuarioId: string;
            if (existenteId) {
              await tx.user.update({
                where: { id: existenteId },
                data: {
                  ...comum,
                  username: usuario,
                  ...(hash ? { passwordHash: hash, senhaProvisoria: true } : {}),
                  ...(pessoa.papel === "aluno" && turmaId ? { turmaId } : {}),
                },
              });
              usuarioId = existenteId;
              relatorio.atualizados += 1;
            } else {
              const criado = await tx.user.create({
                data: {
                  ...comum,
                  escolaId,
                  username: usuario,
                  passwordHash: hash!,
                  senhaProvisoria: true,
                  ...(pessoa.papel === "aluno" && turmaId ? { turmaId } : {}),
                },
              });
              usuarioId = criado.id;
              relatorio.criados += 1;
            }

            if (senha) {
              relatorio.credenciais.push({
                nome: pessoa.nome,
                usuario,
                senha,
                turma: pessoa.turma || null,
              });
            }

            if (turmaId && (pessoa.papel === "aluno" || pessoa.papel === "professor")) {
              await matricularEm(tx, {
                escolaId,
                turmaId,
                usuarioId,
                papel: pessoa.papel,
                /* A planilha simples tem UMA turma por pessoa (linha repetida é
                   erro de arquivo), então essa turma é a de referência. */
                principal: pessoa.papel === "aluno",
                inicio: periodo.inicio,
              });
              relatorio.matriculados += 1;
            }
          }
        },
        escolaId,
        { timeout: TIMEOUT_DA_ESCRITA },
      );
    }

    return relatorio;
  }

  // --------------------------------------------------------------- matrículas

  async matricular(escolaId: string, turmaId: string, usuarioId: string, papel: "aluno" | "professor") {
    const periodo = await this.periodoDeHoje();
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId } });
      if (!turma) return null;
      const usuario = await tx.user.findFirst({ where: { id: usuarioId, escolaId } });
      if (!usuario) return null;
      await matricularEm(tx, {
        escolaId,
        turmaId,
        usuarioId,
        papel,
        /* Matrícula pela tela do gestor: turma regular é a de referência;
           componente (eletiva, reforço) entra ao lado dela. */
        principal: papel === "aluno" && turma.tipo === "regular",
        inicio: periodo?.inicio ?? new Date(),
      });
      return { ok: true as const };
    }, escolaId);
  }

  /**
   * Troca qual turma é a de REFERÊNCIA do aluno, sem encerrar nada.
   *
   * É o caso do aluno que está numa regular e numa eletiva e foi enturmado na
   * ordem errada: a de referência é a que alimenta o cache `users.turma_id` e,
   * por ele, o claim `turma_id` do token.
   */
  async tornarPrincipal(escolaId: string, matriculaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const matricula = await tx.matricula.findFirst({
        where: { id: matriculaId, escolaId, papel: "aluno", fim: null },
      });
      if (!matricula) return null;
      await tx.matricula.updateMany({
        where: {
          escolaId,
          usuarioId: matricula.usuarioId,
          papel: "aluno",
          fim: null,
          id: { not: matricula.id },
        },
        data: { principal: false },
      });
      await tx.matricula.update({ where: { id: matricula.id }, data: { principal: true } });
      await tx.user.update({
        where: { id: matricula.usuarioId },
        data: { turmaId: matricula.turmaId },
      });
      return { ok: true as const };
    }, escolaId);
  }

  /**
   * Move a pessoa de turma: encerra a matrícula na origem e abre na destino.
   *
   * Dois passos numa ação por um motivo: feito à mão, o gestor tira da turma
   * antiga e esquece de colocar na nova — e o aluno fica sem turma, invisível
   * para o professor, sem nada na tela dizendo o que faltou.
   */
  async moverDeTurma(escolaId: string, matriculaId: string, turmaDestinoId: string) {
    const periodo = await this.periodoDeHoje();
    return this.prisma.comTenancy(async (tx) => {
      const matricula = await tx.matricula.findFirst({
        where: { id: matriculaId, escolaId, fim: null },
      });
      if (!matricula) return null;
      const destino = await tx.turma.findFirst({ where: { id: turmaDestinoId, escolaId } });
      if (!destino) return null;
      if (destino.id === matricula.turmaId) return { ok: true as const };

      const papel = matricula.papel as "aluno" | "professor";
      await tx.matricula.update({
        where: { id: matricula.id },
        data: { fim: new Date(), principal: false },
      });
      await matricularEm(tx, {
        escolaId,
        turmaId: destino.id,
        usuarioId: matricula.usuarioId,
        papel,
        principal: papel === "aluno" && matricula.principal,
        inicio: periodo?.inicio ?? new Date(),
      });
      return { ok: true as const };
    }, escolaId);
  }

  /** Encerra em vez de apagar — a matrícula é o que dá turma ao histórico. */
  async encerrarMatricula(escolaId: string, matriculaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const matricula = await tx.matricula.findFirst({ where: { id: matriculaId, escolaId } });
      if (!matricula) return null;
      await tx.matricula.update({
        where: { id: matricula.id },
        data: { fim: new Date(), principal: false },
      });
      if (matricula.papel === "aluno") {
        await tx.user.updateMany({
          where: { id: matricula.usuarioId, turmaId: matricula.turmaId },
          data: { turmaId: null },
        });
      }
      return { ok: true as const };
    }, escolaId);
  }

  // ------------------------------------------------------------------- turmas

  async criarTurma(
    escolaId: string,
    dados: { nome: string; serie: string; turno?: string | null; tipo?: string; periodoLetivoId?: string },
  ) {
    const periodoId = dados.periodoLetivoId ?? (await this.periodoDeHoje())?.id;
    if (!periodoId) return null;
    return this.prisma.comTenancy(
      (tx) =>
        tx.turma.create({
          data: {
            escolaId,
            periodoLetivoId: periodoId,
            nome: dados.nome,
            serie: dados.serie,
            turno: dados.turno ?? null,
            tipo: dados.tipo ?? "regular",
          },
        }),
      escolaId,
    );
  }

  async atualizarTurma(
    escolaId: string,
    turmaId: string,
    dados: { nome?: string; serie?: string; turno?: string | null },
  ) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId } });
      if (!turma) return null;
      return tx.turma.update({ where: { id: turma.id }, data: dados });
    }, escolaId);
  }

  /**
   * As turmas da ESCOLA (gestor e admin-contrato). O professor tem a rota
   * própria — `turmasDoProfessor` — e é isso que separa "quem administra a
   * escola" de "quem dá aula numa turma".
   */
  async turmasDaEscola(escolaId: string, periodoLetivoId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: { escolaId, ...(periodoLetivoId ? { periodoLetivoId } : {}) },
        include: { periodoLetivo: true },
        orderBy: [{ nome: "asc" }],
      });
      return Promise.all(turmas.map((turma) => this.comContagem(tx, escolaId, turma)));
    }, escolaId);
  }

  async turmasDoProfessor(escolaId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const matriculas = await tx.matricula.findMany({
        where: { escolaId, usuarioId: professorId, papel: "professor", fim: null },
        include: { turma: { include: { periodoLetivo: true } } },
        orderBy: [{ turma: { nome: "asc" } }],
      });
      return Promise.all(matriculas.map((m) => this.comContagem(tx, escolaId, m.turma)));
    }, escolaId);
  }

  private async comContagem(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turma: { id: string; nome: string; serie: string; turno: string | null; tipo: string; periodoLetivo?: { titulo: string } | null },
  ) {
    const [alunos, professores] = await Promise.all([
      tx.matricula.count({ where: { escolaId, turmaId: turma.id, papel: "aluno", fim: null } }),
      tx.matricula.count({ where: { escolaId, turmaId: turma.id, papel: "professor", fim: null } }),
    ]);
    return {
      id: turma.id,
      nome: turma.nome,
      serie: turma.serie,
      turno: turma.turno,
      tipo: turma.tipo,
      periodo: turma.periodoLetivo?.titulo ?? null,
      alunos,
      professores,
    };
  }

  /** `true` quando o professor tem matrícula ativa na turma. */
  async professorLecionaNaTurma(escolaId: string, professorId: string, turmaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const matricula = await tx.matricula.findFirst({
        where: { escolaId, usuarioId: professorId, turmaId, papel: "professor", fim: null },
        select: { id: true },
      });
      return Boolean(matricula);
    }, escolaId);
  }

  /** Os matriculados de uma turma — a lista NOMINAL, que é o ponto de tudo isto. */
  async pessoasDaTurma(escolaId: string, turmaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({
        where: { id: turmaId, escolaId },
        include: { periodoLetivo: true },
      });
      if (!turma) return null;
      const matriculas = await tx.matricula.findMany({
        where: { escolaId, turmaId, fim: null },
        include: {
          usuario: {
            select: {
              id: true,
              username: true,
              displayName: true,
              matriculaExterna: true,
              ativo: true,
              senhaProvisoria: true,
            },
          },
        },
        orderBy: [{ usuario: { displayName: "asc" } }],
      });
      const linhas = (papel: string) =>
        matriculas
          .filter((m) => m.papel === papel)
          .map((m) => ({
            matriculaId: m.id,
            id: m.usuario.id,
            nome: m.usuario.displayName,
            usuario: m.usuario.username,
            matricula: m.usuario.matriculaExterna,
            ativo: m.usuario.ativo,
            /** Turma de REFERÊNCIA da pessoa (só faz sentido para aluno). */
            principal: m.principal,
            /** Ainda não entrou pela primeira vez. */
            senhaProvisoria: m.usuario.senhaProvisoria,
            desde: m.inicio,
          }));
      return {
        turma: {
          id: turma.id,
          nome: turma.nome,
          serie: turma.serie,
          turno: turma.turno,
          periodo: turma.periodoLetivo.titulo,
        },
        alunos: linhas("aluno"),
        professores: linhas("professor"),
      };
    }, escolaId);
  }

  /**
   * Contas que podem ser de ASSENTO — as que não têm matrícula da rede — com o
   * quanto cada uma já acumulou de dado. É diagnóstico para o gestor desativar
   * o que era conta de aparelho, com os números à vista.
   *
   * Não existe "fundir contas" aqui, de propósito: juntar duas contas move dado
   * de uma criança para outra, e depois ninguém consegue auditar de quem era.
   */
  async contasDeAssento(escolaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      /* Teto de 200: numa rede recém-migrada TODA conta antiga cai aqui, e uma
         lista de 10 mil linhas não é diagnóstico — é uma tela que trava. O corte
         é dito na resposta (`truncado`), nunca silencioso. */
      const usuarios = await tx.user.findMany({
        where: { escolaId, matriculaExterna: null, role: { in: ["aluno", "professor"] } },
        select: { id: true, username: true, displayName: true, role: true, ativo: true },
        orderBy: [{ username: "asc" }],
        take: TETO_DE_ASSENTOS + 1,
      });
      const truncado = usuarios.length > TETO_DE_ASSENTOS;
      if (truncado) usuarios.length = TETO_DE_ASSENTOS;
      if (usuarios.length === 0) return { total: 0, truncado: false, contas: [] };
      const ids = usuarios.map((u) => u.id);
      const [runs, vila, unootube, unoogpt] = await Promise.all([
        tx.run.groupBy({ by: ["alunoId"], where: { escolaId, alunoId: { in: ids } }, _count: true }),
        tx.vilaSessao.groupBy({ by: ["alunoId"], where: { escolaId, alunoId: { in: ids } }, _count: true }),
        tx.unootubeSessao.groupBy({ by: ["alunoId"], where: { escolaId, alunoId: { in: ids } }, _count: true }),
        tx.unoogptSessao.groupBy({ by: ["alunoId"], where: { escolaId, alunoId: { in: ids } }, _count: true }),
      ]);
      const somar = (linhas: Array<{ alunoId: string; _count: number }>, alvo: Map<string, number>) => {
        for (const linha of linhas) alvo.set(linha.alunoId, (alvo.get(linha.alunoId) ?? 0) + linha._count);
        return alvo;
      };
      const totais = new Map<string, number>();
      somar(runs as never, totais);
      somar(vila as never, totais);
      somar(unootube as never, totais);
      somar(unoogpt as never, totais);
      return {
        total: usuarios.length,
        truncado,
        contas: usuarios.map((u) => ({
          id: u.id,
          usuario: u.username,
          nome: u.displayName,
          papel: u.role,
          ativo: u.ativo,
          dados: totais.get(u.id) ?? 0,
        })),
      };
    }, escolaId);
  }
}
