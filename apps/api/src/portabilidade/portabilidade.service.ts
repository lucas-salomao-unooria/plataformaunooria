import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { formatarCpf } from "../comum/cpf";
import { PrismaService } from "../prisma/prisma.service";
import { linhasDeLeitura, resumoHonesto } from "../vila/leitura";
import { TIPO_DOCUMENTO, VERSAO_DOCUMENTO, type Verificacao } from "./catalogo";
import { PerfilPortatilSchema, versaoSuportada, type ArquivoDePerfil, type PerfilPortatil } from "./regras";
import { verificarAssinatura } from "./verificacao";

export type FalhaDeImportacao =
  | { erro: "documento-invalido"; detalhe: string }
  | { erro: "versao-nao-suportada"; detalhe: string }
  | { erro: "assinatura-invalida"; detalhe: string }
  | { erro: "titular-desconhecido"; detalhe: string };

export interface PerfilRecebido {
  id: string;
  emissor: string;
  emissorNome: string | null;
  emissorHub: string;
  emitidoEm: string;
  verificacao: Verificacao;
  importadoEm: string;
  /** Contagens, para a tela dizer o que veio sem despejar o documento. */
  escolas: number;
  turmas: number;
  participacoes: number;
  resultados: number;
}

/**
 * Emitir e receber o PERFIL PORTÁTIL — a saída da criança da REDE, não da
 * escola (ver `catalogo.ts`).
 *
 * Duas direções que não se parecem:
 *
 * - **Emitir** monta o documento a partir do que esta instalação sabe. Ler o
 *   histórico atravessa escolas do contrato, pela mesma justificativa da porta
 *   única `GET /estudantes/:id/historico`: é o dado do titular, pedido por ele,
 *   entregue por quem tem lotação onde ele está HOJE. A assinatura não acontece
 *   aqui — quem tem a chave é o hub.
 * - **Receber** grava o documento inteiro numa tabela só dele e NUNCA o mistura
 *   com o dado local. A justificativa está na migration; em uma frase: é a
 *   afirmação de outra instalação, possivelmente de outra versão do
 *   instrumento, e misturada ficaria indistinguível do que foi medido aqui.
 */
@Injectable()
export class PortabilidadeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------------ emitir

  /**
   * Monta o documento SEM assinatura. Devolve `null` se não houver estudante com
   * CPF — sem CPF o documento não significa nada na base do destino, onde
   * nenhum id daqui existe.
   */
  async montar(estudanteId: string): Promise<Omit<PerfilPortatil, "emissor" | "emitidoEm"> | null> {
    const estudante = await this.prisma.user.findUnique({
      where: { id: estudanteId },
      select: { id: true, displayName: true, cpf: true, role: true },
    });
    if (!estudante || (estudante.role !== "estudante" && (estudante.role as string) !== "estudante") || !estudante.cpf) return null;

    const [lotacoes, matriculas, progresso, experiencias] = await Promise.all([
      this.prisma.lotacao.findMany({
        where: { usuarioId: estudanteId, papel: "estudante" },
        include: { escola: { select: { id: true, nome: true, municipio: true, uf: true } } },
        /* Ordem estável: o documento é ASSINADO, e o hash cobre o JSON canônico.
           Com `inicio` DATE empatando numa transferência do mesmo dia, duas
           emissões do mesmo fato sairiam com as escolas em ordens diferentes. */
        orderBy: [{ inicio: "asc" }, { escolaId: "asc" }],
      }),
      this.prisma.matricula.findMany({
        where: { usuarioId: estudanteId, papel: "estudante" },
        include: {
          turma: {
            select: { nome: true, serie: true, periodoLetivo: { select: { titulo: true } } },
          },
        },
        orderBy: [{ inicio: "asc" }, { turmaId: "asc" }],
      }),
      this.prisma.progresso.findMany({
        where: { estudanteId },
        select: { escolaId: true, expId: true, atualizadoEm: true },
        orderBy: [{ atualizadoEm: "asc" }, { escolaId: "asc" }, { expId: "asc" }],
      }),
      this.prisma.experiencia.findMany({ select: { expId: true, nome: true } }),
    ]);

    /* `matriculas` tem RLS, e este `findMany` roda FORA de `comTenancy` de
       propósito: o documento é do titular e atravessa as escolas dele. A
       consulta é por `usuarioId`, nunca por escola, e o resultado nunca sai
       daqui sem ser o documento da própria criança. */
    const nomeDaEscola = new Map(lotacoes.map((l) => [l.escola.id, l.escola.nome]));
    const nomeDaExp = new Map(experiencias.map((e) => [e.expId, e.nome]));

    const resultados = await this.resultadosDasEscolas(
      estudanteId,
      lotacoes.map((l) => l.escola.id),
      nomeDaEscola,
    );

    return {
      documento: TIPO_DOCUMENTO,
      versao: VERSAO_DOCUMENTO,
      titular: { cpf: formatarCpf(estudante.cpf), nome: estudante.displayName },
      trajetoria: {
        escolas: lotacoes.map((l) => ({
          nome: l.escola.nome,
          municipio: l.escola.municipio,
          uf: l.escola.uf,
          entrada: l.inicio.toISOString(),
          saida: l.fim ? l.fim.toISOString() : null,
        })),
        turmas: matriculas.map((m) => ({
          escola: nomeDaEscola.get(m.escolaId) ?? m.escolaId,
          turma: m.turma.nome,
          serie: m.turma.serie,
          periodo: m.turma.periodoLetivo.titulo,
          entrada: m.inicio.toISOString(),
          saida: m.fim ? m.fim.toISOString() : null,
        })),
      },
      participacoes: progresso.map((p) => ({
        escola: nomeDaEscola.get(p.escolaId) ?? p.escolaId,
        expId: p.expId,
        nome: nomeDaExp.get(p.expId) ?? null,
        em: p.atualizadoEm.toISOString(),
      })),
      resultados,
    };
  }

  /**
   * O retrato de valores da Vila, escola por escola.
   *
   * Lê `vilaPerfil` direto em vez de chamar o `VilaService`: o que este módulo
   * precisa é a LEITURA (as funções puras de `vila/leitura.ts`), não o relatório
   * de tela. Depender do service inteiro arrastaria o módulo da exp-70 para
   * dentro da portabilidade sem nada em troca.
   *
   * `versaoMapeamento` viaja junto e é o motivo de o resultado ser exportável:
   * sem ela, dois retratos de gerações diferentes pareceriam comparáveis.
   */
  private async resultadosDasEscolas(
    estudanteId: string,
    escolaIds: string[],
    nomeDaEscola: Map<string, string>,
  ): Promise<PerfilPortatil["resultados"]> {
    const resultados: PerfilPortatil["resultados"] = [];
    for (const escolaId of new Set(escolaIds)) {
      const perfil = await this.prisma.comTenancy(
        (tx) =>
          tx.vilaPerfil.findFirst({
            where: { escolaId, estudanteId },
            orderBy: { createdAt: "desc" },
          }),
        escolaId,
      );
      if (!perfil) continue;
      const linhas = linhasDeLeitura(
        perfil.valores as Record<string, unknown>,
        perfil.graus as Record<string, unknown>,
      );
      resultados.push({
        tipo: "perfil-de-valores",
        expId: "exp-70-vila-do-lume",
        instrumento: "Vila do Lume — retrato de valores (Schwartz)",
        versaoMapeamento: perfil.versaoMapeamento,
        em: perfil.createdAt.toISOString(),
        escola: nomeDaEscola.get(escolaId) ?? escolaId,
        amostraSuficiente: perfil.amostraSuficiente,
        aberturaVsConservacao: perfil.aberturaVsConservacao,
        transcendenciaVsAutopromocao: perfil.transcendenciaVsAutopromocao,
        linhas: linhas.map((l) => ({
          valor: l.valor,
          nome: l.nome,
          grau: l.grau,
          numero: l.numero,
        })),
        frase: resumoHonesto(linhas, perfil.amostraSuficiente),
      });
    }
    return resultados;
  }

  // ----------------------------------------------------------------- receber

  async importar(
    escolaId: string,
    arquivo: ArquivoDePerfil,
    importadoPor: string,
  ): Promise<{ ok: true; perfil: PerfilRecebido } | { ok: false } & FalhaDeImportacao> {
    const lido = PerfilPortatilSchema.safeParse(arquivo.perfil);
    if (!lido.success) {
      return {
        ok: false,
        erro: "documento-invalido",
        detalhe: lido.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      };
    }
    const perfil = lido.data;

    if (!versaoSuportada(perfil.versao)) {
      return {
        ok: false,
        erro: "versao-nao-suportada",
        detalhe: `o documento é da versão ${perfil.versao} e esta instalação lê a ${VERSAO_DOCUMENTO}`,
      };
    }

    const veredito = await verificarAssinatura(
      perfil,
      arquivo.assinatura,
      this.config.get<string>("PORTABILIDADE_EMISSORES"),
      { producao: this.config.get<string>("NODE_ENV") === "production" },
    );
    if (veredito.estado === "invalida") {
      return { ok: false, erro: "assinatura-invalida", detalhe: veredito.motivo };
    }

    /* O documento se liga a uma pessoa que JÁ está aqui. Criar o estudante a partir
       dele seria deixar um arquivo de fora abrir conta nesta rede — a matrícula
       é ato da escola (planilha ou OneRoster), e só depois o perfil se anexa. */
    const digitos = perfil.titular.cpf.replace(/\D/g, "");
    const estudante = await this.prisma.user.findFirst({
      where: { cpf: digitos, role: "estudante" },
      select: { id: true },
    });
    if (!estudante) {
      return {
        ok: false,
        erro: "titular-desconhecido",
        detalhe:
          "não há estudante com este CPF nesta rede — matricule a criança primeiro, depois anexe o perfil",
      };
    }

    const gravado = await this.prisma.comTenancy(
      (tx) =>
        tx.perfilPortatil.upsert({
          where: {
            escolaId_estudanteId_emissorContrato_emitidoEm: {
              escolaId,
              estudanteId: estudante.id,
              emissorContrato: perfil.emissor.contrato,
              emitidoEm: new Date(perfil.emitidoEm),
            },
          },
          /* Reimportar o MESMO documento reconfere a assinatura e atualiza só o
             veredito: a rede pode ter voltado, e "não consegui falar com o
             emissor" deixar de valer não é fato novo sobre a criança. */
          update: { verificacao: veredito.estado, importadoPor },
          create: {
            escolaId,
            estudanteId: estudante.id,
            emissorContrato: perfil.emissor.contrato,
            emissorHub: perfil.emissor.hub,
            emissorNome: perfil.emissor.nome,
            emitidoEm: new Date(perfil.emitidoEm),
            documento: perfil as unknown as object,
            assinatura: arquivo.assinatura,
            verificacao: veredito.estado,
            importadoPor,
          },
        }),
      escolaId,
    );

    return { ok: true, perfil: resumir(gravado) };
  }

  /** O que esta escola recebeu sobre esta criança. */
  async recebidos(escolaId: string, estudanteId: string): Promise<PerfilRecebido[]> {
    const linhas = await this.prisma.comTenancy(
      (tx) =>
        tx.perfilPortatil.findMany({
          where: { escolaId, estudanteId },
          orderBy: { emitidoEm: "desc" },
        }),
      escolaId,
    );
    return linhas.map(resumir);
  }

  /** O documento inteiro, como veio. */
  async documento(escolaId: string, id: string) {
    return this.prisma.comTenancy(
      (tx) => tx.perfilPortatil.findFirst({ where: { escolaId, id } }),
      escolaId,
    );
  }

  async remover(escolaId: string, id: string): Promise<boolean> {
    const apagados = await this.prisma.comTenancy(
      (tx) => tx.perfilPortatil.deleteMany({ where: { escolaId, id } }),
      escolaId,
    );
    return apagados.count > 0;
  }
}

interface LinhaGravada {
  id: string;
  emissorContrato: string;
  emissorNome: string | null;
  emissorHub: string;
  emitidoEm: Date;
  verificacao: string;
  importadoEm: Date;
  documento: unknown;
}

function resumir(linha: LinhaGravada): PerfilRecebido {
  const doc = (linha.documento ?? {}) as Partial<PerfilPortatil>;
  return {
    id: linha.id,
    emissor: linha.emissorContrato,
    emissorNome: linha.emissorNome,
    emissorHub: linha.emissorHub,
    emitidoEm: linha.emitidoEm.toISOString(),
    verificacao: linha.verificacao as Verificacao,
    importadoEm: linha.importadoEm.toISOString(),
    escolas: doc.trajetoria?.escolas?.length ?? 0,
    turmas: doc.trajetoria?.turmas?.length ?? 0,
    participacoes: doc.participacoes?.length ?? 0,
    resultados: doc.resultados?.length ?? 0,
  };
}
