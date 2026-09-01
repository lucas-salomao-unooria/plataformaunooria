import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { EscolasService } from "./escolas.service";
import { garantirLotacao } from "./lotacao";
import { matricularEm } from "./matricula";
import type { ContextoDoExemplo } from "./modelos-oneroster";
import { lerPlanilha, type ErroDeLinha, type PessoaDaPlanilha } from "./planilha";
import { gerarSenha, gerarUsuario, periodoVigente, senhaAceitavel } from "./regras";

export const MAX_LINHAS = 50_000;

/**
 * O teto em BYTES do CSV cru, para as duas fronteiras de importação. Ele é do
 * TRANSPORTE (o `bodyParser` de `main.ts` tem de casar com ele), enquanto
 * `MAX_LINHAS` é da planilha simples — e são coisas diferentes: o binding
 * OneRoster de uma rede estadual traz um `enrollments.csv` que não é planilha
 * de escola nenhuma.
 *
 * 30 MB é escolhido para caber DEBAIXO do teto do ambiente: o Cloud Run recusa
 * requisição acima de 32 MiB em HTTP/1, e recusa antes do contêiner — aquele
 * 413 não é nosso, não diz o que fazer e não deixa linha no log. Prometer mais
 * do que o ambiente entrega é o que produz o erro que ninguém consegue
 * diagnosticar. Folga medida: o pior caso realista de UM contrato (~10 mil
 * estudantes, cinco componentes cada) dá ~7 MB de `enrollments.csv` (ADR-48).
 */
export const TETO_DO_ARQUIVO = 30_000_000;
export const TETO_EM_MB = TETO_DO_ARQUIVO / 1_000_000;
const CHUNK = 100;
const TIMEOUT_DA_ESCRITA = 30_000;
const TETO_DE_ASSENTOS = 200;

export interface Credencial {
  /**
   * O `users.id` de quem recebeu esta senha. Existe para o cadastro unitário
   * (ADR-59) responder com o id sem uma segunda consulta por `username` — e
   * consulta por login é exatamente onde se esquece o par com `escola_id`.
   */
  id: string;
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
  /**
   * Estudantes que já existiam em OUTRA escola da rede e foram TRANSFERIDOS para
   * esta. Reconhecidos pelo CPF — sem ele, cada um deles nasceria de novo, com o
   * histórico partido em duas pessoas.
   */
  transferidos: number;
  /**
   * Professores e gestores que já existiam em outra escola e ganharam lotação
   * NESTA, sem perder a de lá. É o caso que a rede estadual tem aos milhares.
   */
  lotacoesNovas: number;
  /** Devolvidas UMA vez, para o gestor imprimir. Não ficam em coluna nem em log. */
  credenciais: Credencial[];
}

export interface OpcoesDeImportacao {
  /** Senha única do lote. Vale só para quem está NASCENDO nesta importação. */
  senhaPadrao?: string;
  /** Uma senha diferente por pessoa (recomendado para estudantes). */
  gerarSenhas?: boolean;
}

export const relatorioVazio = (): RelatorioImportacao => ({
  criados: 0,
  atualizados: 0,
  matriculados: 0,
  desativados: 0,
  candidatosAInativacao: 0,
  transferidos: 0,
  lotacoesNovas: 0,
  turmasCriadas: [],
  erros: [],
  avisos: [],
  credenciais: [],
});

@Injectable()
export class RosteringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escolas: EscolasService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------------ períodos

  /**
   * `periodos_letivos` é catálogo do contrato: sem escola_id e sem RLS, então
   * é lido fora de `comTenancy`.
   */
  async periodos() {
    const periodos = await this.prisma.periodoLetivo.findMany({ orderBy: [{ inicio: "desc" }] });
    const vigente = periodoVigente(periodos, new Date());
    /* `vigente` é DERIVADO das datas, não coluna: estado que ninguém atualiza
       mente mais do que ajuda. Vem calculado na resposta para a tela não repetir
       a regra — divergir do servidor aqui seria o gestor criando turma no ano
       errado sem nada na tela dizendo isso. */
    return periodos.map((p) => ({ ...p, vigente: p.id === vigente?.id }));
  }

  /** Quantas turmas cada período tem — é o que impede apagar um por engano. */
  async periodosComTurmas() {
    const periodos = await this.periodos();
    const contagem = await this.prisma.turma.groupBy({
      by: ["periodoLetivoId"],
      _count: { _all: true },
    });
    const porPeriodo = new Map(contagem.map((c) => [c.periodoLetivoId, c._count._all]));
    return periodos.map((p) => ({ ...p, turmas: porPeriodo.get(p.id) ?? 0 }));
  }

  async periodoDeHoje() {
    return periodoVigente(
      await this.prisma.periodoLetivo.findMany({ orderBy: [{ inicio: "desc" }] }),
      new Date(),
    );
  }

  async criarPeriodo(dados: { tipo: string; titulo: string; ano: number; inicio: Date; fim: Date }) {
    return this.prisma.periodoLetivo.create({ data: dados });
  }

  /**
   * O que o exemplo do OneRoster precisa saber do mundo real. A escola de
   * VERDADE entra no `sourcedId` do `orgs.csv` e no `schoolSourcedId` das
   * turmas: um id fictício faria o lote inteiro voltar como "escola não é a
   * desta importação" para o gestor e, para o `admin-contrato`, abriria um
   * tenant de mentira.
   */
  async contextoDeExemplo(escolaId: string): Promise<ContextoDoExemplo> {
    const escola = await this.prisma.escola.findUnique({
      where: { id: escolaId },
      select: { nome: true, codigoInep: true },
    });
    return {
      escolaId,
      escolaNome: escola?.nome ?? "Escola",
      codigoInep: escola?.codigoInep ?? null,
      ano: new Date().getFullYear(),
    };
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

    /**
     * O CPF é procurado na REDE INTEIRA, não nesta escola — é justamente o que
     * ele existe para responder: "essa criança já é nossa, de outra escola?".
     * Sem esta consulta, cada transferência criaria uma segunda pessoa e o
     * histórico dela nasceria partido.
     */
    const cpfs = leitura.pessoas.map((p) => p.cpf).filter(Boolean);
    const naRede = cpfs.length
      ? await this.prisma.user.findMany({
          where: { cpf: { in: cpfs } },
          select: { id: true, username: true, escolaId: true, role: true, cpf: true },
        })
      : [];
    const porCpfNaRede = new Map(naRede.map((u) => [u.cpf!, u]));
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
      /** Já existe na rede, em OUTRA escola: transferir (estudante) ou lotar. */
      deOutraEscola: { id: string; escolaId: string | null } | null;
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
      /* O CPF vem PRIMEIRO: é o único identificador que sobrevive à troca de
         nome, de login, de matrícula e de escola. Achado em outra escola da
         rede, a linha deixa de ser "pessoa nova" e passa a ser transferência
         (estudante) ou lotação a mais (professor e gestor). */
      const naOutraEscola = pessoa.cpf ? porCpfNaRede.get(pessoa.cpf) : undefined;
      const veioDeOutraEscola = Boolean(naOutraEscola && naOutraEscola.escolaId !== escolaId);

      let existente: (typeof existentes)[number] | null = null;
      if (naOutraEscola && !veioDeOutraEscola) {
        existente = existentes.find((u) => u.id === naOutraEscola.id) ?? null;
      }
      if (!existente && !veioDeOutraEscola && pessoa.matricula) {
        existente = porMatricula.get(pessoa.matricula) ?? null;
      }
      if (!existente && !veioDeOutraEscola && pessoa.usuario) {
        const candidato = porUsuario.get(pessoa.usuario) ?? null;
        const compativel =
          candidato &&
          (!pessoa.matricula ||
            !candidato.matriculaExterna ||
            candidato.matriculaExterna === pessoa.matricula);
        if (compativel) existente = candidato;
      }

      if (existente?.role === "admin-contrato" || naOutraEscola?.role === "admin-contrato") {
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
      // Quem vem de outra escola da rede JÁ tem conta e senha: pedir senha nova
      // seria trocar a dela numa transferência, sem ninguém ter pedido.
      else if (!existente && !veioDeOutraEscola) {
        senha = opcoes.gerarSenhas ? gerarSenha() : (opcoes.senhaPadrao ?? null);
      }

      if (!existente && !veioDeOutraEscola && !senha) {
        relatorio.erros.push({
          linha: pessoa.linha,
          campo: "senha",
          mensagem: "senha: obrigatória para usuário novo — escolha a senha do lote na tela de importação",
        });
        continue;
      }

      preparadas.push({
        pessoa,
        existenteId: existente?.id ?? null,
        usuario,
        senha,
        deOutraEscola: veioDeOutraEscola
          ? { id: naOutraEscola!.id, escolaId: naOutraEscola!.escolaId }
          : null,
      });
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
            // estudante traz (é obrigatória para ele) e corrige na mesma passada.
            serie: dados.serie || "9EF",
            turno: dados.turno,
          },
        });
        idPorTurma.set(nome, criada.id);
        relatorio.turmasCriadas.push(nome);
      }
    }, escolaId);

    /**
     * 3) O que ATRAVESSA escola vem antes do laço de escrita, e cada um na sua
     * transação: transferir um estudante encerra vínculo numa escola e abre em
     * outra, e isso não cabe dentro de uma transação já presa ao `escola_id`
     * desta importação.
     *
     * Estudante → transferência (a anterior é encerrada, é uma escola só).
     * Professor e gestor → lotação A MAIS (a de lá continua valendo).
     */
    for (const p of preparadas) {
      if (!p.deOutraEscola) continue;
      if (p.pessoa.papel === "estudante") {
        const feito = await this.escolas.transferirEstudante({
          estudanteId: p.deOutraEscola.id,
          escolaDestinoId: escolaId,
        });
        if (feito && !feito.jaEstava) relatorio.transferidos += 1;
      } else {
        const feito = await this.escolas.lotar(escolaId, p.deOutraEscola.id, p.pessoa.papel);
        if (feito) relatorio.lotacoesNovas += 1;
      }
      // A partir daqui a pessoa está NESTA escola, então o laço abaixo a trata
      // como qualquer outra que já existia aqui.
      p.existenteId = p.deOutraEscola.id;
    }

    // 4) Hash fora da transação, e escrita em lotes curtos.
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
              // O CPF, quando veio. Só os 11 dígitos: a formatação é da tela.
              ...(pessoa.cpf ? { cpf: pessoa.cpf } : {}),
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
                  ...(pessoa.papel === "estudante" && turmaId ? { turmaId } : {}),
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
                  ...(pessoa.papel === "estudante" && turmaId ? { turmaId } : {}),
                },
              });
              usuarioId = criado.id;
              relatorio.criados += 1;
            }

            if (senha) {
              relatorio.credenciais.push({
                id: usuarioId,
                nome: pessoa.nome,
                usuario,
                senha,
                turma: pessoa.turma || null,
              });
            }

            /* Lotação na escola desta importação. Para quem já veio de outra,
               a transferência (ou o `lotar`) acima já a criou; aqui é o caminho
               de quem nasce nesta escola — e do gestor, que não tem turma. */
            await garantirLotacao(tx, {
              escolaId,
              usuarioId,
              papel: pessoa.papel,
              inicio: periodo.inicio,
              principal: pessoa.papel === "estudante" || !existenteId,
            });

            if (turmaId && (pessoa.papel === "estudante" || pessoa.papel === "professor")) {
              await matricularEm(tx, {
                escolaId,
                turmaId,
                usuarioId,
                papel: pessoa.papel,
                /* A planilha simples tem UMA turma por pessoa (linha repetida é
                   erro de arquivo), então essa turma é a de referência. */
                principal: pessoa.papel === "estudante",
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

  async matricular(escolaId: string, turmaId: string, usuarioId: string, papel: "estudante" | "professor" | "estudante") {
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
        principal: papel === "estudante" && turma.tipo === "regular",
        inicio: periodo?.inicio ?? new Date(),
      });
      return { ok: true as const };
    }, escolaId);
  }

  /**
   * Troca qual turma é a de REFERÊNCIA do estudante, sem encerrar nada.
   *
   * É o caso do estudante que está numa regular e numa eletiva e foi enturmado na
   * ordem errada: a de referência é a que alimenta o cache `users.turma_id` e,
   * por ele, o claim `turma_id` do token.
   */
  async tornarPrincipal(escolaId: string, matriculaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const matricula = await tx.matricula.findFirst({
        where: { id: matriculaId, escolaId, papel: "estudante", fim: null },
      });
      if (!matricula) return null;
      await tx.matricula.updateMany({
        where: {
          escolaId,
          usuarioId: matricula.usuarioId,
          papel: "estudante",
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
   * antiga e esquece de colocar na nova — e o estudante fica sem turma, invisível
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

      const papel = (matricula.papel) as "estudante" | "professor";
      await tx.matricula.update({
        where: { id: matricula.id },
        data: { fim: new Date(), principal: false },
      });
      await matricularEm(tx, {
        escolaId,
        turmaId: destino.id,
        usuarioId: matricula.usuarioId,
        papel,
        principal: (papel === "estudante" || (papel as string) === "estudante") && matricula.principal,
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
      if (matricula.papel === "estudante") {
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
    const [estudantes, professores] = await Promise.all([
      tx.matricula.count({ where: { escolaId, turmaId: turma.id, papel: "estudante", fim: null } }),
      tx.matricula.count({ where: { escolaId, turmaId: turma.id, papel: "professor", fim: null } }),
    ]);
    return {
      id: turma.id,
      nome: turma.nome,
      serie: turma.serie,
      turno: turma.turno,
      tipo: turma.tipo,
      periodo: turma.periodoLetivo?.titulo ?? null,
      estudantes,
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
          .filter((m) => m.papel === papel || (papel === "estudante" && m.papel === "estudante"))
          .map((m) => ({
            matriculaId: m.id,
            id: m.usuario.id,
            nome: m.usuario.displayName,
            usuario: m.usuario.username,
            matricula: m.usuario.matriculaExterna,
            ativo: m.usuario.ativo,
            /** Turma de REFERÊNCIA da pessoa (só faz sentido para estudante). */
            principal: m.principal,
            /** Ainda não entrou pela primeira vez. */
            senhaProvisoria: m.usuario.senhaProvisoria,
            desde: m.inicio,
          }));
      const estudantes = linhas("estudante");
      return {
        turma: {
          id: turma.id,
          nome: turma.nome,
          serie: turma.serie,
          turno: turma.turno,
          periodo: turma.periodoLetivo.titulo,
        },
        estudantes,
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
        where: { escolaId, matriculaExterna: null, role: { in: ["estudante", "professor"] } },
        select: { id: true, username: true, displayName: true, role: true, ativo: true },
        orderBy: [{ username: "asc" }],
        take: TETO_DE_ASSENTOS + 1,
      });
      const truncado = usuarios.length > TETO_DE_ASSENTOS;
      if (truncado) usuarios.length = TETO_DE_ASSENTOS;
      if (usuarios.length === 0) return { total: 0, truncado: false, contas: [] };
      const ids = usuarios.map((u) => u.id);
      const [runs, vila, unootube, unoogpt] = await Promise.all([
        tx.run.groupBy({ by: ["estudanteId"], where: { escolaId, estudanteId: { in: ids } }, _count: true }),
        tx.vilaSessao.groupBy({ by: ["estudanteId"], where: { escolaId, estudanteId: { in: ids } }, _count: true }),
        tx.unootubeSessao.groupBy({ by: ["estudanteId"], where: { escolaId, estudanteId: { in: ids } }, _count: true }),
        tx.unoogptSessao.groupBy({ by: ["estudanteId"], where: { escolaId, estudanteId: { in: ids } }, _count: true }),
      ]);
      const somar = (linhas: Array<{ estudanteId: string; _count: number }>, alvo: Map<string, number>) => {
        for (const linha of linhas) alvo.set(linha.estudanteId, (alvo.get(linha.estudanteId) ?? 0) + linha._count);
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
