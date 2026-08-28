import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { cpfEhValido, finalDoCpf, hashDoCpf } from "../comum/cpf";
import { PrismaService } from "../prisma/prisma.service";
import type { ArquivoOneRoster } from "./catalogo";
import { EscolasService } from "./escolas.service";
import { garantirLotacao } from "./lotacao";
import { matricularEm } from "./matricula";
import {
  dataDoCampo,
  ehVerdadeiro,
  lerArquivoOneRoster,
  lerManifesto,
  listaDoCampo,
  papelDaMatricula,
  tipoDePeriodo,
  tipoDeTurma,
  type LinhaOneRoster,
} from "./oneroster";
import { gerarSenha, gerarUsuario, normalizarPapel, normalizarSerie, senhaAceitavel } from "./regras";
import {
  relatorioVazio,
  RosteringService,
  type OpcoesDeImportacao,
  type RelatorioImportacao,
} from "./rostering.service";

const TIMEOUT_DA_ESCRITA = 30_000;

export interface OpcoesOneRoster extends OpcoesDeImportacao {
  /** `bulk` = lote completo; `delta` = só o que mudou. Default: `delta`. */
  modo?: "bulk" | "delta";
  /**
   * `orgs.csv` pode CRIAR escola. Só `admin-contrato`: escola é tenant, e abrir
   * inquilino novo não é operação de quem administra uma unidade.
   */
  podeCriarEscola?: boolean;
}

/**
 * O CPF no padrão. Não há campo para ele — é dado brasileiro —, então vem por
 * onde o próprio padrão manda estender: `userIds` no formato `cpf:NNNNNNNNNNN`
 * (a lista de identificadores tipados) ou a coluna de extensão
 * `metadata.br.cpf`. As duas são lidas; vale a primeira que aparecer.
 */
/** Mesma regra do controller: o id circula no claim do token e na RLS. */
function idDeEscolaValido(id: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(id);
}

function cpfDaLinha(linha: LinhaOneRoster): string {
  const daExtensao = linha.campo("metadata.br.cpf");
  if (daExtensao) return daExtensao;
  const tipado = listaDoCampo(linha.campo("userIds")).find((v) => /^cpf\s*:/i.test(v));
  return tipado ? tipado.split(":").slice(1).join(":").trim() : "";
}

export interface RelatorioOneRoster extends RelatorioImportacao {
  arquivo: string;
  modo: "bulk" | "delta";
  /** Declarado no `manifest.csv`, quando ele é enviado. */
  arquivosDoLote?: Array<{ nome: string; modo: string }>;
}

/**
 * Aplicação do binding CSV do OneRoster 1.2 — um arquivo por chamada, na ordem
 * de dependência:
 *
 *   manifest \seta orgs \seta academicSessions \seta classes \seta users
 *            \seta enrollments \seta roles
 *
 * Cada arquivo é idempotente por `fonte_id` (o `sourcedId` do sistema de
 * origem), e referência a um `sourcedId` que ainda não existe volta no relatório
 * dizendo QUAL arquivo falta — em vez de criar meia entidade.
 */
@Injectable()
export class OneRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rostering: RosteringService,
    private readonly config: ConfigService,
    private readonly escolasDaRede: EscolasService,
  ) {}

  async importar(
    escolaId: string,
    arquivo: ArquivoOneRoster,
    csv: string,
    opcoes: OpcoesOneRoster = {},
  ): Promise<RelatorioOneRoster> {
    const modo = opcoes.modo ?? "delta";
    const relatorio: RelatorioOneRoster = { ...relatorioVazio(), arquivo, modo };

    if (arquivo === "manifest") {
      const { arquivos, erros } = lerManifesto(csv);
      relatorio.erros.push(...erros);
      relatorio.arquivosDoLote = arquivos;
      /* Comparação sem caixa: `lerManifesto` normaliza o nome da propriedade, e
         `file.academicSessions` chega aqui como `academicsessions`. Comparando
         com a grafia do padrão, o manifesto acusava que não lemos justamente o
         arquivo que lemos. */
      const lidos = ["orgs", "academicsessions", "classes", "users", "enrollments", "roles"];
      const naoLidos = arquivos.filter(
        (a) => a.modo !== "absent" && !lidos.includes(a.nome.toLowerCase()),
      );
      for (const a of naoLidos) {
        relatorio.avisos.push({
          linha: 1,
          campo: a.nome,
          mensagem: `${a.nome}.csv está declarado no lote e esta api não o lê — as notas (categories/lineItems/results) não têm destino aqui`,
        });
      }
      return relatorio;
    }

    if (opcoes.senhaPadrao && !senhaAceitavel(opcoes.senhaPadrao)) {
      relatorio.erros.push({ linha: 1, campo: "senha", mensagem: "senha padrão: mínimo 8 caracteres" });
      return relatorio;
    }

    const { linhas, erros } = lerArquivoOneRoster(arquivo, csv);
    relatorio.erros.push(...erros);
    if (relatorio.erros.length > 0 || linhas.length === 0) {
      if (linhas.length === 0 && relatorio.erros.length === 0) {
        relatorio.erros.push({ linha: 2, campo: "arquivo", mensagem: "nenhuma linha de dados" });
      }
      return relatorio;
    }

    switch (arquivo) {
      case "orgs":
        return this.aplicarOrgs(escolaId, linhas, relatorio, opcoes.podeCriarEscola === true);
      case "academicSessions":
        return this.aplicarPeriodos(linhas, relatorio);
      case "classes":
        return this.aplicarTurmas(escolaId, linhas, relatorio);
      case "users":
        return this.aplicarPessoas(escolaId, linhas, relatorio, opcoes);
      case "enrollments":
        return this.aplicarMatriculas(escolaId, linhas, relatorio);
      case "roles":
        return this.aplicarPapeis(escolaId, linhas, relatorio);
      default:
        relatorio.erros.push({ linha: 1, campo: "arquivo", mensagem: `arquivo não suportado: ${arquivo}` });
        return relatorio;
    }
  }

  // ------------------------------------------------------------------- orgs

  /**
   * `orgs.csv` só APRENDE o mapeamento `sourcedId` \seta escola desta chamada;
   * não cria escola.
   *
   * Escola é \emph{tenant}: criar um a partir de arquivo enviado por upload seria
   * abrir um inquilino novo com stack, RLS e dados de menores por trás de um
   * clique de importação. Linha de outra organização volta no relatório.
   */
  private async aplicarOrgs(
    escolaId: string,
    linhas: LinhaOneRoster[],
    relatorio: RelatorioOneRoster,
    podeCriar = false,
  ): Promise<RelatorioOneRoster> {
    const escola = await this.prisma.escola.findUnique({ where: { id: escolaId } });
    if (!escola) {
      relatorio.erros.push({ linha: 1, campo: "escola", mensagem: "escola não encontrada" });
      return relatorio;
    }

    for (const linha of linhas) {
      const sourcedId = linha.campo("sourcedId");
      const identifier = linha.campo("identifier");
      const tipo = linha.campo("type").toLowerCase();

      if (tipo !== "school") {
        relatorio.avisos.push({
          linha: linha.linha,
          campo: "type",
          mensagem: `organização "${tipo}" ignorada — a hierarquia acima da escola não é montada por importação`,
        });
        continue;
      }

      const ehEsta =
        sourcedId === escola.id ||
        sourcedId === escola.fonteId ||
        (identifier !== "" && (identifier === escola.codigoInep || identifier === escola.id));
      if (!ehEsta) {
        /* REVISÃO da decisão original ("escola nova não nasce de CSV"): numa
           rede estadual são milhares de escolas, e cadastrar à mão é inviável.
           O que se mantém é QUEM pode: só `admin-contrato` abre inquilino novo.
           Para gestor, a linha continua sendo aviso. */
        if (!podeCriar) {
          relatorio.avisos.push({
            linha: linha.linha,
            campo: "sourcedId",
            mensagem: `escola "${linha.campo("name")}" não é a desta importação — só admin-contrato cadastra escola nova`,
          });
          continue;
        }
        const idNovo = idDeEscolaValido(sourcedId) ? sourcedId : null;
        if (!idNovo) {
          relatorio.erros.push({
            linha: linha.linha,
            campo: "sourcedId",
            mensagem: `sourcedId "${sourcedId}" não serve como id de escola: use 3–64 caracteres [a-z 0-9 . _ -]`,
          });
          continue;
        }
        const existente = await this.prisma.escola.findUnique({ where: { id: idNovo } });
        if (existente) {
          await this.prisma.escola.update({
            where: { id: idNovo },
            data: { nome: linha.campo("name") || existente.nome, ...(identifier ? { codigoInep: identifier } : {}) },
          });
          relatorio.atualizados += 1;
        } else {
          await this.prisma.escola.create({
            data: {
              id: idNovo,
              nome: linha.campo("name") || idNovo,
              tipo: "escola",
              fonteId: sourcedId,
              ...(identifier ? { codigoInep: identifier } : {}),
            },
          });
          relatorio.criados += 1;
        }
        continue;
      }

      await this.prisma.escola.update({
        where: { id: escola.id },
        data: {
          nome: linha.campo("name") || escola.nome,
          fonteId: sourcedId || escola.fonteId,
          ...(identifier ? { codigoInep: identifier } : {}),
        },
      });
      relatorio.atualizados += 1;
    }
    return relatorio;
  }

  // -------------------------------------------------------------- periodos

  /** `periodos_letivos` é catálogo do contrato: sem escola e fora da RLS. */
  private async aplicarPeriodos(
    linhas: LinhaOneRoster[],
    relatorio: RelatorioOneRoster,
  ): Promise<RelatorioOneRoster> {
    for (const linha of linhas) {
      const sourcedId = linha.campo("sourcedId");
      const tipo = tipoDePeriodo(linha.campo("type"));
      const titulo = linha.campo("title");
      const inicio = dataDoCampo(linha.campo("startDate"));
      const fim = dataDoCampo(linha.campo("endDate"));

      if (!tipo) {
        relatorio.erros.push({
          linha: linha.linha,
          campo: "type",
          mensagem: `tipo de período não reconhecido: "${linha.campo("type")}"`,
        });
        continue;
      }
      if (!inicio || !fim) {
        relatorio.erros.push({
          linha: linha.linha,
          campo: "startDate",
          mensagem: "startDate/endDate ausentes ou inválidos",
        });
        continue;
      }
      if (fim < inicio) {
        relatorio.erros.push({ linha: linha.linha, campo: "endDate", mensagem: "endDate antes de startDate" });
        continue;
      }
      if (linha.status === "tobedeleted") {
        relatorio.avisos.push({
          linha: linha.linha,
          campo: "status",
          mensagem: `período "${titulo}" marcado para exclusão — não é apagado: há turmas apontando para ele`,
        });
        continue;
      }

      const ano = Number(linha.campo("schoolYear")) || inicio.getUTCFullYear();
      const existente = sourcedId
        ? await this.prisma.periodoLetivo.findFirst({ where: { fonteId: sourcedId } })
        : null;

      if (existente) {
        await this.prisma.periodoLetivo.update({
          where: { id: existente.id },
          data: { tipo, titulo, ano, inicio, fim },
        });
        relatorio.atualizados += 1;
        continue;
      }
      // Sem `fonte_id` conhecido, a chave natural é (tipo, título) — é o que
      // impede o mesmo ano letivo entrar duas vezes com ids diferentes.
      const porTitulo = await this.prisma.periodoLetivo.findFirst({ where: { tipo, titulo } });
      if (porTitulo) {
        await this.prisma.periodoLetivo.update({
          where: { id: porTitulo.id },
          data: { ano, inicio, fim, fonteId: sourcedId || porTitulo.fonteId },
        });
        relatorio.atualizados += 1;
      } else {
        await this.prisma.periodoLetivo.create({
          data: { tipo, titulo, ano, inicio, fim, fonteId: sourcedId || null },
        });
        relatorio.criados += 1;
      }
    }
    return relatorio;
  }

  // ---------------------------------------------------------------- turmas

  private async aplicarTurmas(
    escolaId: string,
    linhas: LinhaOneRoster[],
    relatorio: RelatorioOneRoster,
  ): Promise<RelatorioOneRoster> {
    const escola = await this.prisma.escola.findUnique({ where: { id: escolaId } });
    const periodoVigente = await this.rostering.periodoDeHoje();
    if (!periodoVigente) {
      relatorio.erros.push({
        linha: 1,
        campo: "arquivo",
        mensagem: "nenhum período letivo cadastrado — envie academicSessions.csv antes",
      });
      return relatorio;
    }

    await this.prisma.comTenancy(
      async (tx) => {
        for (const linha of linhas) {
          const sourcedId = linha.campo("sourcedId");
          const nome = linha.campo("title");
          const escolaDaLinha = linha.campo("schoolSourcedId");

          // A escola da linha tem de ser a desta importação: o contrário seria
          // gravar turma de outra escola dentro do tenant atual.
          const daEscola =
            !escolaDaLinha ||
            escolaDaLinha === escolaId ||
            (escola?.fonteId && escolaDaLinha === escola.fonteId);
          if (!daEscola) {
            relatorio.avisos.push({
              linha: linha.linha,
              campo: "schoolSourcedId",
              mensagem: `turma "${nome}" é de outra escola — ignorada`,
            });
            continue;
          }

          if (linha.status === "tobedeleted") {
            relatorio.avisos.push({
              linha: linha.linha,
              campo: "status",
              mensagem: `turma "${nome}" marcada para exclusão — encerre as matrículas dela em /admin/turmas; a turma não é apagada`,
            });
            continue;
          }

          const grades = listaDoCampo(linha.campo("grades"));
          const serie = grades.map((g) => normalizarSerie(g)).find(Boolean) ?? null;
          if (!serie) {
            relatorio.erros.push({
              linha: linha.linha,
              campo: "grades",
              mensagem: grades.length
                ? `nenhuma série reconhecida em "${grades.join(",")}"`
                : "grades vazio — a série da turma é obrigatória aqui",
            });
            continue;
          }

          const termos = listaDoCampo(linha.campo("termSourcedIds"));
          let periodoId = periodoVigente.id;
          if (termos.length > 0) {
            const periodo = await tx.periodoLetivo.findFirst({ where: { fonteId: { in: termos } } });
            if (!periodo) {
              relatorio.erros.push({
                linha: linha.linha,
                campo: "termSourcedIds",
                mensagem: `período "${termos[0]}" desconhecido — envie academicSessions.csv antes de classes.csv`,
              });
              continue;
            }
            periodoId = periodo.id;
          }

          const dados = {
            nome,
            serie,
            tipo: tipoDeTurma(linha.campo("classType")),
            codigo: linha.campo("classCode") || null,
          };

          const existente = sourcedId
            ? await tx.turma.findFirst({ where: { escolaId, fonteId: sourcedId } })
            : null;
          if (existente) {
            await tx.turma.update({ where: { id: existente.id }, data: dados });
            relatorio.atualizados += 1;
            continue;
          }
          const porNome = await tx.turma.findUnique({
            where: {
              escolaId_periodoLetivoId_nome: { escolaId, periodoLetivoId: periodoId, nome },
            },
          });
          if (porNome) {
            await tx.turma.update({
              where: { id: porNome.id },
              data: { ...dados, fonteId: sourcedId || porNome.fonteId },
            });
            relatorio.atualizados += 1;
          } else {
            await tx.turma.create({
              data: { escolaId, periodoLetivoId: periodoId, ...dados, fonteId: sourcedId || null },
            });
            relatorio.turmasCriadas.push(nome);
            relatorio.criados += 1;
          }
        }
      },
      escolaId,
      { timeout: TIMEOUT_DA_ESCRITA },
    );
    return relatorio;
  }

  // --------------------------------------------------------------- pessoas

  /**
   * `users.csv`. O papel vem da coluna `role` quando ela existe (a 1.1 a tinha e
   * provedores seguem emitindo); sem ela, a pessoa nasce como **aluno** e o
   * relatório diz quantas linhas dependem do `roles.csv` para o papel certo.
   *
   * Nascer com o menor privilégio é falhar FECHADO: um professor que entra como
   * aluno perde acesso e reclama; um aluno que entrasse como professor leria a
   * turma inteira.
   */
  private async aplicarPessoas(
    escolaId: string,
    linhas: LinhaOneRoster[],
    relatorio: RelatorioOneRoster,
    opcoes: OpcoesOneRoster,
  ): Promise<RelatorioOneRoster> {
    const periodo = await this.rostering.periodoDeHoje();
    const inicioDaLotacao = periodo?.inicio ?? new Date();
    const existentes = await this.prisma.user.findMany({
      where: { escolaId },
      select: { id: true, username: true, matriculaExterna: true, fonteId: true, role: true },
    });
    const porFonte = new Map(existentes.filter((u) => u.fonteId).map((u) => [u.fonteId!, u]));
    const porMatricula = new Map(
      existentes.filter((u) => u.matriculaExterna).map((u) => [u.matriculaExterna!, u]),
    );
    const porUsuario = new Map(existentes.map((u) => [u.username, u]));
    const loginsUsados = new Set(existentes.map((u) => u.username));

    let semPapelDeclarado = 0;
    let senhasIgnoradas = 0;
    let cpfsInvalidos = 0;
    const vistos = new Set<string>();

    /* O CPF é procurado na REDE, não nesta escola: é o que transforma "essa
       criança já é nossa, de outra unidade" em transferência reconhecida em vez
       de uma segunda pessoa com o histórico partido. */
    const pimenta = this.config.get<string>("CPF_PEPPER");
    const hashPorLinha = new Map<number, string>();
    for (const linha of linhas) {
      const bruto = cpfDaLinha(linha);
      if (!bruto) continue;
      if (!cpfEhValido(bruto)) {
        cpfsInvalidos += 1;
        continue;
      }
      if (!pimenta) continue;
      hashPorLinha.set(linha.linha, hashDoCpf(bruto, pimenta));
    }
    if (cpfsInvalidos > 0) {
      relatorio.avisos.push({
        linha: 1,
        campo: "cpf",
        mensagem: `${cpfsInvalidos} CPF(s) com dígito verificador errado foram ignorados — a pessoa entrou sem CPF`,
      });
    }
    if (hashPorLinha.size === 0 && !pimenta) {
      const traziam = linhas.filter((l) => cpfDaLinha(l)).length;
      if (traziam > 0) {
        relatorio.avisos.push({
          linha: 1,
          campo: "cpf",
          mensagem: `${traziam} linha(s) traziam CPF e ele foi ignorado: CPF_PEPPER não está configurada nesta instalação`,
        });
      }
    }
    const naRede = hashPorLinha.size
      ? await this.prisma.user.findMany({
          where: { cpfHash: { in: [...hashPorLinha.values()] } },
          select: { id: true, escolaId: true, role: true, cpfHash: true },
        })
      : [];
    const porCpfNaRede = new Map(naRede.map((u) => [u.cpfHash!, u]));

    type Preparada = {
      linha: number;
      sourcedId: string;
      matricula: string | null;
      nome: string;
      usuario: string;
      email: string | null;
      papel: string;
      ativo: boolean;
      existenteId: string | null;
      senha: string | null;
      desativar: boolean;
      cpfHash: string | null;
      cpfFinal: string | null;
      /** Já existe na rede, em OUTRA escola: transferir (aluno) ou lotar. */
      deOutraEscola: { id: string; escolaId: string | null } | null;
    };
    const preparadas: Preparada[] = [];

    for (const linha of linhas) {
      const sourcedId = linha.campo("sourcedId");
      const nome = [linha.campo("givenName"), linha.campo("middleName"), linha.campo("familyName")]
        .filter(Boolean)
        .join(" ")
        .trim();
      const matricula =
        linha.campo("identifier") || listaDoCampo(linha.campo("userIds"))[0] || null;

      /* O CPF vem primeiro: é o único identificador que sobrevive à troca de
         nome, de login, de matrícula e de ESCOLA. */
      const hash = hashPorLinha.get(linha.linha) ?? null;
      const naOutra = hash ? porCpfNaRede.get(hash) : undefined;
      const veioDeOutraEscola = Boolean(naOutra && naOutra.escolaId !== escolaId);

      const existente = veioDeOutraEscola
        ? null
        : ((naOutra ? existentes.find((u) => u.id === naOutra.id) : undefined) ??
          (sourcedId ? porFonte.get(sourcedId) : undefined) ??
          (matricula ? porMatricula.get(matricula) : undefined) ??
          porUsuario.get(linha.campo("username")) ??
          null);

      if (existente?.role === "admin-contrato" || naOutra?.role === "admin-contrato") {
        relatorio.erros.push({ linha: linha.linha, campo: "username", mensagem: "usuario reservado" });
        continue;
      }

      const desativar = linha.status === "tobedeleted" || !ehVerdadeiro(linha.campo("enabledUser") || "true");
      if (desativar && !existente && !veioDeOutraEscola) {
        relatorio.avisos.push({
          linha: linha.linha,
          campo: "status",
          mensagem: `"${nome}" veio como tobedeleted e não existe aqui — nada a fazer`,
        });
        continue;
      }

      if (!nome && !existente && !veioDeOutraEscola) {
        relatorio.erros.push({ linha: linha.linha, campo: "givenName", mensagem: "nome vazio" });
        continue;
      }

      // `password` do padrão é ignorada por decisão (ADR-29): senha nunca vem em
      // arquivo. Contamos para o relatório dizer que foi ignorada, não sumir.
      if (linha.campo("password")) senhasIgnoradas += 1;

      const papelDeclarado = linha.campo("role") ? normalizarPapel(linha.campo("role")) : null;
      if (!papelDeclarado && !existente) semPapelDeclarado += 1;
      const papel = papelDeclarado ?? existente?.role ?? "aluno";

      let usuario = linha.campo("username") || existente?.username || "";
      if (!usuario) usuario = gerarUsuario(nome, loginsUsados);
      const dono = porUsuario.get(usuario);
      if (dono && dono.id !== existente?.id) {
        relatorio.erros.push({
          linha: linha.linha,
          campo: "username",
          mensagem: `o login "${usuario}" já é de outra pessoa nesta escola`,
        });
        continue;
      }
      if (vistos.has(usuario)) {
        relatorio.erros.push({
          linha: linha.linha,
          campo: "username",
          mensagem: `login "${usuario}" repetido no arquivo`,
        });
        continue;
      }
      vistos.add(usuario);
      loginsUsados.add(usuario);

      let senha: string | null = null;
      // Quem vem de outra escola da rede já tem conta e senha: trocar a dela
      // numa transferência seria trancar a criança para fora sem ninguém pedir.
      if (!existente && !desativar && !veioDeOutraEscola) {
        senha = opcoes.gerarSenhas ? gerarSenha() : (opcoes.senhaPadrao ?? null);
        if (!senha) {
          relatorio.erros.push({
            linha: linha.linha,
            campo: "senha",
            mensagem: "pessoa nova sem senha inicial — escolha a senha do lote na tela de importação",
          });
          continue;
        }
      }

      preparadas.push({
        cpfHash: hash,
        cpfFinal: hash ? finalDoCpf(cpfDaLinha(linha)) : null,
        deOutraEscola: veioDeOutraEscola
          ? { id: naOutra!.id, escolaId: naOutra!.escolaId }
          : null,
        linha: linha.linha,
        sourcedId,
        matricula,
        nome,
        usuario,
        email: linha.campo("email") || null,
        papel,
        ativo: !desativar,
        existenteId: existente?.id ?? null,
        senha,
        desativar,
      });
    }

    if (senhasIgnoradas > 0) {
      relatorio.avisos.push({
        linha: 1,
        campo: "password",
        mensagem: `${senhasIgnoradas} linha(s) traziam a coluna password — ela é IGNORADA: senha não entra por arquivo`,
      });
    }
    if (semPapelDeclarado > 0) {
      relatorio.avisos.push({
        linha: 1,
        campo: "role",
        mensagem: `${semPapelDeclarado} pessoa(s) sem coluna role entraram como aluno (o menor privilégio) — aplique roles.csv para corrigir o papel`,
      });
    }

    /* O que ATRAVESSA escola vem antes do laço, cada um na sua transação:
       transferir encerra vínculo numa escola e abre em outra, e isso não cabe
       dentro de uma transação já presa ao `escola_id` desta importação. */
    for (const p of preparadas) {
      if (!p.deOutraEscola) continue;
      if (p.papel === "aluno") {
        const feito = await this.escolasDaRede.transferirAluno({
          alunoId: p.deOutraEscola.id,
          escolaDestinoId: escolaId,
        });
        if (feito && !feito.jaEstava) relatorio.transferidos += 1;
      } else {
        const feito = await this.escolasDaRede.lotar(
          escolaId,
          p.deOutraEscola.id,
          p.papel as "professor" | "gestor",
        );
        if (feito) relatorio.lotacoesNovas += 1;
      }
      p.existenteId = p.deOutraEscola.id;
    }

    const hashes = await Promise.all(
      preparadas.map((p) => (p.senha ? bcrypt.hash(p.senha, 10) : Promise.resolve(null))),
    );

    await this.prisma.comTenancy(
      async (tx) => {
        for (let i = 0; i < preparadas.length; i += 1) {
          const p = preparadas[i]!;
          const hash = hashes[i];
          const comum = {
            displayName: p.nome || undefined,
            ...(p.matricula ? { matriculaExterna: p.matricula } : {}),
            ...(p.sourcedId ? { fonteId: p.sourcedId } : {}),
            ...(p.email ? { email: p.email } : {}),
            // Hash e três dígitos; o número nunca.
            ...(p.cpfHash ? { cpfHash: p.cpfHash, cpfFinal: p.cpfFinal } : {}),
            ativo: p.ativo,
          };

          if (p.existenteId) {
            await tx.user.update({ where: { id: p.existenteId }, data: { ...comum, username: p.usuario } });
            if (p.desativar) relatorio.desativados += 1;
            else relatorio.atualizados += 1;
            if (!p.desativar) {
              await garantirLotacao(tx, {
                escolaId,
                usuarioId: p.existenteId,
                papel: p.papel as "aluno" | "professor" | "gestor",
                inicio: inicioDaLotacao,
                fonteId: p.sourcedId || null,
              });
            }
            continue;
          }
          const criado = await tx.user.create({
            data: {
              ...comum,
              displayName: p.nome,
              escolaId,
              username: p.usuario,
              role: p.papel,
              passwordHash: hash!,
              senhaProvisoria: true,
            },
          });
          relatorio.criados += 1;
          await garantirLotacao(tx, {
            escolaId,
            usuarioId: criado.id,
            papel: p.papel as "aluno" | "professor" | "gestor",
            inicio: inicioDaLotacao,
            principal: true,
            fonteId: p.sourcedId || null,
          });
          if (p.senha) {
            relatorio.credenciais.push({ nome: p.nome, usuario: p.usuario, senha: p.senha, turma: null });
          }
        }
      },
      escolaId,
      { timeout: TIMEOUT_DA_ESCRITA },
    );

    if (relatorio.modo === "bulk") {
      const vindos = new Set(preparadas.map((p) => p.sourcedId).filter(Boolean));
      relatorio.candidatosAInativacao = existentes.filter(
        (u) => u.fonteId && !vindos.has(u.fonteId) && u.role !== "admin-contrato",
      ).length;
      if (relatorio.candidatosAInativacao > 0) {
        relatorio.avisos.push({
          linha: 1,
          campo: "bulk",
          mensagem: `${relatorio.candidatosAInativacao} pessoa(s) da rede NÃO vieram neste lote completo. Ausência de linha não desativa ninguém — confira em Usuários antes de desativar à mão`,
        });
      }
    }
    return relatorio;
  }

  // ------------------------------------------------------------ matriculas

  private async aplicarMatriculas(
    escolaId: string,
    linhas: LinhaOneRoster[],
    relatorio: RelatorioOneRoster,
  ): Promise<RelatorioOneRoster> {
    const periodo = await this.rostering.periodoDeHoje();
    await this.prisma.comTenancy(
      async (tx) => {
        for (const linha of linhas) {
          const papel = papelDaMatricula(linha.campo("role"));
          if (!papel) {
            relatorio.avisos.push({
              linha: linha.linha,
              campo: "role",
              mensagem: `papel "${linha.campo("role")}" não vira matrícula aqui — só student e teacher`,
            });
            continue;
          }

          const turma = await this.turmaPorFonte(tx, escolaId, linha.campo("classSourcedId"));
          if (!turma) {
            relatorio.erros.push({
              linha: linha.linha,
              campo: "classSourcedId",
              mensagem: `turma "${linha.campo("classSourcedId")}" desconhecida — envie classes.csv antes de enrollments.csv`,
            });
            continue;
          }
          const pessoa = await this.pessoaPorFonte(tx, escolaId, linha.campo("userSourcedId"));
          if (!pessoa) {
            relatorio.erros.push({
              linha: linha.linha,
              campo: "userSourcedId",
              mensagem: `pessoa "${linha.campo("userSourcedId")}" desconhecida — envie users.csv antes de enrollments.csv`,
            });
            continue;
          }

          const encerrar = linha.status === "tobedeleted";
          const fim = encerrar ? new Date() : dataDoCampo(linha.campo("endDate"));
          /* `primary` do padrão diz qual é a turma de referência. Ausente, vale
             o tipo da turma: `homeroom` é a de referência, `scheduled` é a de
             componente — que o mesmo aluno cursa EM PARALELO. */
          const bruto = linha.campo("primary");
          const principal = bruto ? ehVerdadeiro(bruto) : turma.tipo === "regular";
          await matricularEm(tx, {
            escolaId,
            turmaId: turma.id,
            usuarioId: pessoa.id,
            papel,
            principal,
            inicio: dataDoCampo(linha.campo("beginDate")) ?? periodo?.inicio ?? new Date(),
            fim,
            fonteId: linha.campo("sourcedId") || null,
          });
          if (encerrar) relatorio.desativados += 1;
          else relatorio.matriculados += 1;
        }
      },
      escolaId,
      { timeout: TIMEOUT_DA_ESCRITA },
    );
    return relatorio;
  }

  // ---------------------------------------------------------------- papéis

  /**
   * `roles.csv` — papel no nível da ORGANIZAÇÃO. Só o `primary` é aplicado:
   * `users.role` é um só, e escolher o secundário em silêncio seria dar a alguém
   * um papel que o arquivo declarou como acessório.
   */
  private async aplicarPapeis(
    escolaId: string,
    linhas: LinhaOneRoster[],
    relatorio: RelatorioOneRoster,
  ): Promise<RelatorioOneRoster> {
    await this.prisma.comTenancy(
      async (tx) => {
        for (const linha of linhas) {
          const tipo = (linha.campo("roleType") || "primary").toLowerCase();
          const papel = normalizarPapel(linha.campo("role"));
          if (!papel) {
            relatorio.avisos.push({
              linha: linha.linha,
              campo: "role",
              mensagem: `papel "${linha.campo("role")}" não existe nesta plataforma — a linha não foi aplicada`,
            });
            continue;
          }
          if (tipo !== "primary") {
            relatorio.avisos.push({
              linha: linha.linha,
              campo: "roleType",
              mensagem: `papel secundário "${papel}" ignorado — uma pessoa tem um papel aqui`,
            });
            continue;
          }
          const pessoa = await this.pessoaPorFonte(tx, escolaId, linha.campo("userSourcedId"));
          if (!pessoa) {
            relatorio.erros.push({
              linha: linha.linha,
              campo: "userSourcedId",
              mensagem: `pessoa "${linha.campo("userSourcedId")}" desconhecida — envie users.csv antes de roles.csv`,
            });
            continue;
          }
          if (pessoa.role === "admin-contrato") {
            relatorio.erros.push({ linha: linha.linha, campo: "userSourcedId", mensagem: "usuario reservado" });
            continue;
          }
          if (pessoa.role === papel) continue;
          await tx.user.update({ where: { id: pessoa.id }, data: { role: papel } });
          relatorio.atualizados += 1;
        }
      },
      escolaId,
      { timeout: TIMEOUT_DA_ESCRITA },
    );
    return relatorio;
  }

  // --------------------------------------------------------------- comuns

  private async turmaPorFonte(tx: Prisma.TransactionClient, escolaId: string, sourcedId: string) {
    if (!sourcedId) return null;
    return tx.turma.findFirst({
      where: { escolaId, fonteId: sourcedId },
      select: { id: true, tipo: true },
    });
  }

  private async pessoaPorFonte(tx: Prisma.TransactionClient, escolaId: string, sourcedId: string) {
    if (!sourcedId) return null;
    return tx.user.findFirst({
      where: { escolaId, fonteId: sourcedId },
      select: { id: true, role: true },
    });
  }
}
