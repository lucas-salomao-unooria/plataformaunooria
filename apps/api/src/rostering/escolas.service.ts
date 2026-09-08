import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { formatarCpf } from "../comum/cpf";
import { PrismaService } from "../prisma/prisma.service";
import { escolaAtualDoEstudante, garantirLotacao, type PapelDeLotacao } from "./lotacao";
import { periodoVigente } from "./regras";
import { ehDoContrato } from "../auth/claims";

export interface EscolaDaRede {
  id: string;
  nome: string;
  tipo: string;
  codigoInep: string | null;
  municipio: string | null;
  uf: string | null;
  paiId: string | null;
  /** Nome da regional (ou da rede) a que a unidade pertence. */
  pai: string | null;
  estudantes: number;
  professores: number;
  turmas: number;
  /** Quantas escolas esta REGIONAL agrupa; 0 numa `escola`. */
  unidades: number;
  /** A regional que a plataforma criou para a rede sem divisão administrativa. */
  regionalPadrao: boolean;
}

/**
 * Por que a exclusão de regional não é `boolean` nem exceção: cada recusa manda
 * a TELA fazer uma coisa diferente — a última regional é um beco (não há o que
 * oferecer), e regional com escolas é um diálogo de transferência. Um `false`
 * comum aos dois obrigaria a tela a redescobrir qual era, reconsultando o que a
 * api acabou de olhar.
 */
export type ExclusaoDeRegional =
  | { ok: true; transferidas: number }
  | { erro: "nao-encontrada" }
  | { erro: "nao-e-regional" }
  | { erro: "ultima-regional" }
  | { erro: "tem-escolas"; escolas: number; destinos: number }
  | { erro: "destino-invalido" };

/** Recusa de REGRA na escrita de escola — distinta de `null`, que é ausência. */
export type RecusaDeEscola = { erro: "regional-invalida" | "sem-regional" };

/** O resultado de `lotarEmLote`, por escola — ver `LoteDeLotacoesSchema`. */
export interface LoteDeVinculos {
  criadas: string[];
  reabertas: string[];
  jaVinculadas: string[];
  ignoradas: string[];
}

export interface FiltroDeEscolas {
  busca?: string;
  /** `escola` | `regional` | `rede` */
  tipo?: string;
  /** Só as unidades desta regional — é o insumo da lotação em lote. */
  paiId?: string;
  municipio?: string;
}

/**
 * A REDE: escolas identificáveis, pessoas lotadas em mais de uma, e a
 * transferência de estudante entre elas.
 *
 * `escolas` e `lotacoes` ficam FORA da RLS (são identidade, lidas antes de haver
 * escola no contexto), então este service filtra por escola explicitamente,
 * como manda a regra 1 — a RLS aqui não é a rede de segurança de sempre.
 */
@Injectable()
export class EscolasService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ escolas

  /** Todas as escolas do contrato, com contagem. Só `gestor_contrato` chega aqui. */
  async listar(filtro: FiltroDeEscolas | string = {}): Promise<EscolaDaRede[]> {
    // A assinatura antiga aceitava só a busca; manter as duas evita mexer em
    // todos os call sites por causa de um filtro novo.
    const f: FiltroDeEscolas = typeof filtro === "string" ? { busca: filtro } : filtro;
    const termo = f.busca?.trim();
    const escolas = await this.prisma.escola.findMany({
      where: {
        ...(f.tipo ? { tipo: f.tipo } : {}),
        ...(f.paiId ? { paiId: f.paiId } : {}),
        ...(f.municipio ? { municipio: { equals: f.municipio, mode: "insensitive" } } : {}),
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: "insensitive" as const } },
                { id: { contains: termo, mode: "insensitive" as const } },
                { codigoInep: { contains: termo } },
                { municipio: { contains: termo, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: { pai: { select: { nome: true } } },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
      take: 1000,
    });
    if (escolas.length === 0) return [];

    const ids = escolas.map((e) => e.id);
    const [lotacoes, turmas, filhas] = await Promise.all([
      this.prisma.lotacao.groupBy({
        by: ["escolaId", "papel"],
        where: { escolaId: { in: ids }, fim: null },
        _count: { _all: true },
      }),
      this.prisma.turma.groupBy({ by: ["escolaId"], where: { escolaId: { in: ids } }, _count: { _all: true } }),
      /* As escolas de cada regional, contadas FORA do filtro da consulta: a tela
         de Regionais pede `tipo=regional`, e as filhas dela não estão no
         resultado. Contá-las a partir de `escolas` daria zero em toda linha. */
      this.prisma.escola.groupBy({
        by: ["paiId"],
        where: { tipo: "escola", paiId: { in: ids } },
        _count: { _all: true },
      }),
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
      pai: e.pai?.nome ?? null,
      estudantes: conta(e.id, "estudante"),
      professores: conta(e.id, "professor"),
      turmas: turmas.find((t) => t.escolaId === e.id)?._count._all ?? 0,
      unidades: filhas.find((f) => f.paiId === e.id)?._count._all ?? 0,
      regionalPadrao: e.regionalPadrao,
    }));
  }

  /** As regionais da rede — o que alimenta o seletor do cadastro de escola, a
   *  tela de Regionais e a lista de destinos de uma transferência. */
  async regionais(busca?: string) {
    return this.listar({ tipo: "regional", busca });
  }

  /**
   * A regional existe e É regional? É a checagem que impede o 500: sem ela, um
   * `pai_id` inventado só é recusado pelo trigger, e o que chega na tela é a
   * exceção crua do Postgres em vez do texto do produto.
   */
  private async regionalValida(paiId: string) {
    const pai = await this.prisma.escola.findUnique({
      where: { id: paiId },
      select: { id: true, tipo: true },
    });
    return pai?.tipo === "regional";
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
    const tipo = dados.tipo ?? "escola";
    // A regional é do Zod (`NovaEscolaSchema`); aqui se confere que ela EXISTE
    // e que é regional — o que o schema não tem como saber.
    if (tipo === "escola") {
      if (!dados.paiId) return { erro: "sem-regional" as const };
      if (!(await this.regionalValida(dados.paiId))) return { erro: "regional-invalida" as const };
    }
    return this.prisma.escola.create({
      data: {
        id: dados.id,
        nome: dados.nome,
        tipo,
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
    /* Editar é o outro caminho pelo qual uma escola ficaria órfã: o formulário
       manda `paiId: ""`, o controller o traduz para null, e sem esta guarda o
       CHECK do banco reprovaria com exceção crua em vez do texto do produto.
       `undefined` (o campo não veio) segue passando: é edição de nome ou INEP. */
    if (escola.tipo === "escola" && dados.paiId === null) {
      return { erro: "sem-regional" as const };
    }
    if (dados.paiId && !(await this.regionalValida(dados.paiId))) {
      return { erro: "regional-invalida" as const };
    }
    return this.prisma.escola.update({ where: { id }, data: dados });
  }

  /**
   * Exclui uma REGIONAL, transferindo as escolas dela quando houver destino.
   *
   * Escola NÃO se exclui por aqui e nem por lugar nenhum: ela é tenant, com
   * turma, dado de menor e histórico atrás — a saída de uma unidade é assunto de
   * contrato, não de um botão numa tabela. A regional é o oposto: ela não guarda
   * dado nenhum, e uma rede que se reorganiza em diretorias novas precisa poder
   * apagar as antigas.
   *
   * Duas recusas, e as duas são de PRODUTO (ADR-79): a rede nunca fica sem
   * regional, e uma regional com escolas só sai depois de dizer para onde elas
   * vão. A padrão não tem proteção especial — depois que a rede se organizou de
   * verdade, ela é exatamente a sobra que se quer remover; o que a segura é a
   * mesma regra da última.
   *
   * Transferir e excluir na MESMA transação: em duas chamadas existe a janela em
   * que as escolas já mudaram de regional e a antiga continua na lista, e é
   * nessa janela que quem estiver com a tela aberta recarrega.
   */
  async excluirRegional(id: string, transferirPara?: string): Promise<ExclusaoDeRegional> {
    return this.prisma.$transaction(async (tx) => {
      const regional = await tx.escola.findUnique({ where: { id }, select: { id: true, tipo: true } });
      if (!regional) return { erro: "nao-encontrada" as const };
      if (regional.tipo !== "regional") return { erro: "nao-e-regional" as const };

      const quantasRegionais = await tx.escola.count({ where: { tipo: "regional" } });
      if (quantasRegionais <= 1) return { erro: "ultima-regional" as const };

      const escolas = await tx.escola.count({ where: { tipo: "escola", paiId: id } });
      let transferidas = 0;
      if (escolas > 0) {
        if (!transferirPara) {
          return { erro: "tem-escolas" as const, escolas, destinos: quantasRegionais - 1 };
        }
        if (transferirPara === id) return { erro: "destino-invalido" as const };
        const destino = await tx.escola.findUnique({
          where: { id: transferirPara },
          select: { tipo: true },
        });
        if (destino?.tipo !== "regional") return { erro: "destino-invalido" as const };
        const movidas = await tx.escola.updateMany({
          where: { tipo: "escola", paiId: id },
          data: { paiId: transferirPara },
        });
        transferidas = movidas.count;
      }

      await tx.escola.delete({ where: { id } });
      return { ok: true as const, transferidas };
    });
  }

  // ----------------------------------------------------------------- lotações

  /**
   * As escolas de uma PESSOA — a resposta que o login precisa antes de saber a
   * escola, e a que o hub consulta para validar a troca de escola ativa.
   *
   * Sem tenancy de propósito: é justamente a pergunta que atravessa escolas.
   */
  async escolasDaPessoa(usuarioId: string) {
    /* O GESTOR REGIONAL não tem lotação: o escopo dele vem da regional
       (`users.regional_id`), e é aqui que essa diferença mora — uma vez, no
       lugar por onde o login, o seletor do cabeçalho e a validação da troca de
       escola já passam. Espalhada, seria a checagem esquecida em um dos três, e
       o sintoma seria um supervisor sem escola nenhuma para escolher (ADR-80).

       Ele continua trabalhando UMA escola por vez: esta lista é o que ele pode
       ATIVAR, e cada leitura depois roda sob um `escola_id` só, com a RLS
       inalterada. */
    const pessoa = await this.prisma.user.findUnique({
      where: { id: usuarioId },
      select: { role: true, regionalId: true },
    });
    if (pessoa?.role === "gestor_regional" && pessoa.regionalId) {
      const daRegional = await this.prisma.escola.findMany({
        where: { tipo: "escola", paiId: pessoa.regionalId },
        select: { id: true, nome: true, municipio: true, uf: true },
        orderBy: [{ nome: "asc" }],
      });
      return daRegional.map((e, i) => ({
        id: e.id,
        nome: e.nome,
        municipio: e.municipio,
        uf: e.uf,
        papel: "gestor_regional" as const,
        /* A primeira é a "principal" só para o login ter uma escola inicial
           quando a pessoa entra sem escolher. Não há linha em `lotacoes` para
           marcar, e a ordem é por NOME para ser estável entre sessões. */
        principal: i === 0,
      }));
    }
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

  /**
   * `true` quando a pessoa ALCANÇA esta escola.
   *
   * Para quem tem lotação, é a lotação ativa. Para o `gestor_regional`, é a
   * escola pertencer à regional dele — ele não tem lotação em nenhuma, e sem
   * este ramo o histórico do estudante transferido (a única leitura que
   * atravessa escolas fora dos perfis de contrato) responderia 403 para o
   * supervisor da própria diretoria onde a criança está.
   */
  async temLotacao(usuarioId: string, escolaId: string) {
    const lotacao = await this.prisma.lotacao.findFirst({
      where: { usuarioId, escolaId, fim: null },
      select: { id: true },
    });
    if (lotacao) return true;
    const pessoa = await this.prisma.user.findUnique({
      where: { id: usuarioId },
      select: { role: true, regionalId: true },
    });
    if (pessoa?.role !== "gestor_regional" || !pessoa.regionalId) return false;
    const naRegional = await this.prisma.escola.findFirst({
      where: { id: escolaId, tipo: "escola", paiId: pessoa.regionalId },
      select: { id: true },
    });
    return Boolean(naRegional);
  }

  /** Quem está lotado nesta escola, por papel. */
  async pessoasDaEscola(escolaId: string, papel: PapelDeLotacao) {
    const lotacoes = await this.prisma.lotacao.findMany({
      where: { escolaId, papel, fim: null },
      include: {
        usuario: {
          select: { id: true, username: true, displayName: true, ativo: true, cpf: true },
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
      cpf: l.usuario.cpf ? formatarCpf(l.usuario.cpf) : null,
      principal: l.principal,
      desde: l.inicio,
    }));
  }

  /**
   * Lota uma pessoa em MUITAS escolas de uma vez — o supervisor de uma Diretoria
   * de Ensino é um `gestor_escola` lotado nas 50 unidades dela.
   *
   * Recebe a LISTA de escolas, não o critério ("todas da regional X"), de
   * propósito: quem confirma precisa ver quantas e quais são antes de dar acesso
   * a cinquenta escolas de uma vez. A tela resolve o critério em lista e mostra.
   *
   * Idempotente: reaplicar reabre o que estava encerrado e não duplica.
   */
  async lotarEmLote(
    escolaIds: string[],
    usuarioId: string,
    papel: "professor" | "gestor_escola",
  ): Promise<LoteDeVinculos | null> {
    const periodo = await this.periodoDeHoje();
    const inicio = periodo?.inicio ?? new Date();

    const usuario = await this.prisma.user.findUnique({ where: { id: usuarioId } });
    if (!usuario || ehDoContrato(usuario.role)) return null;
    /* O PAPEL do vínculo é o da PESSOA, e divergir é recusa — não escolha.
       A chave única de `lotacoes` é (escola, pessoa, PAPEL): com um papel
       diferente do de `users.role`, a mesma pessoa ganharia uma SEGUNDA linha na
       mesma escola, e a contagem da tela a somaria nas duas colunas. Era o
       caminho por onde o "não alterar o perfil silenciosamente" do card se
       quebrava — e um candidato à divergência de contagem de professores. */
    if (usuario.role !== papel) return null;

    // Só unidades: lotar alguém numa `regional` daria uma escola que não tem
    // turma, estudante nem dado — e a pessoa apareceria com uma escola fantasma no
    // seletor do cabeçalho.
    const existentes = await this.prisma.escola.findMany({
      where: { id: { in: escolaIds }, tipo: "escola" },
      select: { id: true },
    });
    const validas = new Set(existentes.map((e) => e.id));
    const ignoradas = escolaIds.filter((id) => !validas.has(id));

    const criadas: string[] = [];
    const reabertas: string[] = [];
    const jaVinculadas: string[] = [];
    // Uma transação por escola: cinquenta lotações numa transação só seguraria
    // conexão por segundos, e cada uma é independente — falhar na décima não é
    // motivo para desfazer as nove.
    for (const escolaId of validas) {
      const efeito = await this.prisma.$transaction(async (tx) => {
        const primeira = (await tx.lotacao.count({ where: { usuarioId, fim: null } })) === 0;
        return garantirLotacao(tx, {
          escolaId,
          usuarioId,
          papel,
          inicio,
          principal: primeira,
        });
      });
      if (efeito === "criada") criadas.push(escolaId);
      else if (efeito === "reaberta") reabertas.push(escolaId);
      else jaVinculadas.push(escolaId);
    }
    return { criadas, reabertas, jaVinculadas, ignoradas };
  }

  /**
   * PROFISSIONAIS DA REDE — professor e coordenação, buscados por nome, login,
   * matrícula ou CPF, SEM dizer em que escola a pessoa está.
   *
   * É a rota que o card pediu, e ela existe por um defeito, não por conforto: a
   * busca anterior era `GET /usuarios?escolaId=`, que filtra por
   * `users.escola_id` — o CACHE da lotação PRINCIPAL. Quem trabalha em duas
   * escolas só era encontrado pela principal; procurando pela outra — uma escola
   * onde ela realmente está — a lista voltava vazia, e o administrador concluía
   * que a pessoa não existia. Justamente a população que esta tela administra.
   *
   * Sem `comTenancy`, e isso não é exceção nova: `users` e `lotacoes` já estão
   * fora da RLS (são lidas no login, antes de haver escola), e quem pergunta é o
   * único papel autorizado a atravessar escolas. A tranca é o `@Roles` da rota,
   * a mesma de `GET /escolas`.
   */
  async profissionaisDaRede(busca: string, limite: number) {
    const termo = busca.trim();
    const digitos = termo.replace(/\D/g, "");
    const pessoas = await this.prisma.user.findMany({
      where: {
        role: { in: ["professor", "gestor_escola"] },
        ativo: true,
        OR: [
          { displayName: { contains: termo, mode: "insensitive" } },
          { username: { contains: termo, mode: "insensitive" } },
          { matriculaExterna: { contains: termo, mode: "insensitive" } },
          /* CPF entra na busca com ou sem pontuação, como em `/usuarios`. O
             piso de 5 dígitos evita que "12" varra a rede por um pedaço de
             documento que casa com qualquer coisa. */
          ...(digitos.length >= 5 ? [{ cpf: { contains: digitos } }] : []),
        ],
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        role: true,
        lotacoes: {
          where: { fim: null },
          select: { papel: true, escola: { select: { id: true, nome: true } } },
        },
      },
      orderBy: [{ displayName: "asc" }],
      take: limite,
    });
    return pessoas.map((p) => ({
      id: p.id,
      nome: p.displayName,
      usuario: p.username,
      papel: p.role,
      escolas: p.lotacoes.map((l) => ({
        id: l.escola.id,
        nome: l.escola.nome,
        papel: l.papel,
      })),
    }));
  }

  /**
   * O panorama de quem tem muitas escolas: uma linha por unidade, com o que há
   * dentro dela. É a tela do supervisor de diretoria — sem ela, ele entraria em
   * cinquenta escolas uma a uma para saber onde falta gente.
   *
   * Separado de `escolasDaPessoa` porque aquele está no caminho do LOGIN e
   * precisa continuar barato.
   */
  async resumoDasEscolasDaPessoa(usuarioId: string) {
    /* As escolas saem de `escolasDaPessoa`, e não de `lotacoes` direto: é ela
       que sabe que o `gestor_regional` alcança as escolas da REGIONAL sem ter
       lotação em nenhuma. Lendo `lotacoes` aqui, o panorama dele voltava VAZIO
       — com o item de menu aparecendo, porque o menu conta as escolas da
       sessão. Tela em branco sem erro nenhum: o pior sintoma possível. */
    const alcance = await this.escolasDaPessoa(usuarioId);
    if (alcance.length === 0) return [];
    const ids = alcance.map((e) => e.id);
    const papelPorEscola = new Map(alcance.map((e) => [e.id, e.papel]));
    const principalPorEscola = new Map(alcance.map((e) => [e.id, e.principal]));
    /* A regional de cada escola, para a tela poder se intitular pela diretoria.
       `escolasDaPessoa` é barata de propósito (está no caminho do login) e não
       traz o pai — aqui pode. */
    const comRegional = await this.prisma.escola.findMany({
      where: { id: { in: ids } },
      select: { id: true, nome: true, municipio: true, uf: true, pai: { select: { nome: true } } },
    });
    const lotacoes = comRegional.map((escola) => ({ escola }));
    const [pessoas, turmas, semPrimeiroAcesso] = await Promise.all([
      this.prisma.lotacao.groupBy({
        by: ["escolaId", "papel"],
        where: { escolaId: { in: ids }, fim: null },
        _count: { _all: true },
      }),
      this.prisma.turma.groupBy({
        by: ["escolaId"],
        where: { escolaId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ["escolaId"],
        where: { escolaId: { in: ids }, senhaProvisoria: true, ativo: true },
        _count: { _all: true },
      }),
    ]);
    const conta = (escolaId: string, papel: string) =>
      pessoas.find((p) => p.escolaId === escolaId && p.papel === papel)?._count._all ?? 0;

    return lotacoes
      .map((l) => ({
        id: l.escola.id,
        nome: l.escola.nome,
        municipio: l.escola.municipio,
        uf: l.escola.uf,
        regional: l.escola.pai?.nome ?? null,
        papel: papelPorEscola.get(l.escola.id) ?? "",
        principal: principalPorEscola.get(l.escola.id) ?? false,
        estudantes: conta(l.escola.id, "estudante"),
        professores: conta(l.escola.id, "professor"),
        turmas: turmas.find((t) => t.escolaId === l.escola.id)?._count._all ?? 0,
        /** Quantos ainda não fizeram o primeiro acesso — o que falta fazer ali. */
        semPrimeiroAcesso:
          semPrimeiroAcesso.find((u) => u.escolaId === l.escola.id)?._count._all ?? 0,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  /**
   * Lota uma pessoa numa escola. Para professor e gestor, ACRESCENTA — não
   * encerra a lotação que ela já tem em outra escola da rede.
   */
  async lotar(escolaId: string, usuarioId: string, papel: "professor" | "gestor_escola") {
    const periodo = await this.periodoDeHoje();
    return this.prisma.$transaction(async (tx) => {
      const usuario = await tx.user.findUnique({ where: { id: usuarioId } });
      if (!usuario || ehDoContrato(usuario.role)) return null;
      const escola = await tx.escola.findUnique({ where: { id: escolaId } });
      if (!escola) return null;
      /* Só UNIDADE recebe lotação — a mesma regra que `lotarEmLote` aplica ao
         filtrar `tipo: "escola"`. Esta rota individual não a tinha, e por ela
         dava para lotar alguém numa regional: uma escola sem turma, sem
         estudante e sem dado, que apareceria no seletor do cabeçalho como
         destino válido. É a "escola fantasma" que o lote existe para evitar. */
      if (escola.tipo !== "escola") return null;
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
        /* `escolaId` como desempate: `inicio` é DATE, e duas lotações abertas no
           MESMO dia empatam — sem ele, qual escola vira a principal depende da
           ordem física das linhas. */
        orderBy: [{ inicio: "desc" }, { escolaId: "asc" }],
      });
      if (outra) {
        await tx.lotacao.update({ where: { id: outra.id }, data: { principal: true } });
        await tx.user.update({ where: { id: lotacao.usuarioId }, data: { escolaId: outra.escolaId } });
      }
      return { ok: true as const, escolaId: lotacao.escolaId };
    });
  }

  // ------------------------------------------------------------ transferência

  // ------------------------------------------------------------ transferência

  /**
   * Transfere o ESTUDANTE para outra escola da rede.
   *
   * A transferência é a única operação da plataforma que, por definição,
   * atravessa duas escolas — e é o que o CPF existe para tornar possível: sem
   * uma identidade imutável, a criança que muda de escola nasce de novo e o
   * histórico dela fica partido em duas pessoas.
   *
   * O QUE SEGUE O ESTUDANTE É A IDENTIDADE, NÃO O DADO. Tudo o que ele produziu
   * continua com o `escola_id` da escola onde produziu — é verdade histórica, e
   * mexer nisso apagaria de onde o fato veio. O que a plataforma passa a
   * conseguir é LER esse histórico atravessado (`historicoDoEstudante`), por uma
   * porta só e estreita.
   */
  async transferirEstudante(dados: {
    estudanteId?: string;
    escolaDestinoId: string;
    turmaDestinoId?: string | null;
  }) {
    const alvoId = dados.estudanteId;
    if (!alvoId) return null;
    const periodo = await this.periodoDeHoje();
    const inicio = periodo?.inicio ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const estudante = await tx.user.findUnique({ where: { id: alvoId } });
      if (!estudante || (estudante.role !== "estudante" && (estudante.role as string) !== "estudante")) return null;
      const destino = await tx.escola.findUnique({ where: { id: dados.escolaDestinoId } });
      if (!destino) return null;

      const origemId = await escolaAtualDoEstudante(tx, estudante.id);
      if (origemId === destino.id) return { ok: true as const, origem: origemId, jaEstava: true };

      // --- sai da origem -------------------------------------------------
      if (origemId) {
        await tx.lotacao.updateMany({
          where: { usuarioId: estudante.id, escolaId: origemId, papel: "estudante", fim: null },
          data: { fim: new Date(), principal: false },
        });
        await this.comEscolaNaTransacao(tx, origemId, async () => {
          await tx.matricula.updateMany({
            where: { escolaId: origemId, usuarioId: estudante.id, fim: null },
            data: { fim: new Date(), principal: false },
          });
        });
      }

      // --- entra no destino ----------------------------------------------
      await garantirLotacao(tx, {
        escolaId: destino.id,
        usuarioId: estudante.id,
        papel: "estudante",
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
                  usuarioId: estudante.id,
                  papel: "estudante",
                },
              },
              update: { fim: null, principal: true },
              create: {
                escolaId: destino.id,
                turmaId: turma.id,
                usuarioId: estudante.id,
                papel: "estudante",
                principal: true,
                inicio,
              },
            });
            await tx.user.update({ where: { id: estudante.id }, data: { turmaId: turma.id } });
          }
        });
      } else {
        // Sem turma no destino o estudante fica lotado e SEM turma — é estado
        // legítimo (chegou no meio do ano, a turma ainda não foi decidida) e
        // aparece na lista de usuários como "sem turma".
        await tx.user.update({ where: { id: estudante.id }, data: { turmaId: null } });
      }

      return { ok: true as const, origem: origemId, jaEstava: false };
    });
  }

  /**
   * O histórico do estudante ATRAVESSANDO escolas — a única leitura da plataforma
   * que faz isso fora de `gestor_contrato`.
   *
   * Devolve PARTICIPAÇÕES, não o conteúdo dos instrumentos: em que experiência
   * ele esteve, em que turma, em que escola, quando. O detalhe de cada
   * instrumento (o retrato de valores da Vila, a transcrição do unooGPT) continua
   * atrás das telas de quem tem a posse pedagógica na escola onde aquilo
   * aconteceu — atravessar a fronteira com o dado sensível junto seria abrir, por
   * uma tela de secretaria, o que quatro ADRs fecharam.
   */
  async historicoDoEstudante(estudanteId: string) {
    const estudante = await this.prisma.user.findUnique({
      where: { id: estudanteId },
      select: { id: true, displayName: true, username: true, cpf: true, role: true },
    });
    if (!estudante || (estudante.role !== "estudante" && (estudante.role as string) !== "estudante")) return null;

    const [lotacoes, matriculas, progresso] = await Promise.all([
      this.prisma.lotacao.findMany({
        where: { usuarioId: estudanteId, papel: "estudante" },
        include: { escola: { select: { id: true, nome: true, municipio: true, uf: true } } },
        /* ONDE ELA ESTÁ HOJE VEM PRIMEIRO — a tela imprime nesta ordem, e a
           primeira linha é a que o adulto lê como "a escola dela".
           `fim` nulo primeiro resolve isso; `inicio: desc` não resolvia, porque
           `inicio` é DATE e uma transferência no mesmo dia EMPATA — aí a ordem
           era a que o Postgres devolvesse. Passou meses em máquina e caiu no CI,
           que é o comportamento clássico de ordenação não determinística.
           `escolaId` fecha o último empate possível. */
        orderBy: [
          { fim: { sort: "desc", nulls: "first" } },
          { inicio: "desc" },
          { escolaId: "asc" },
        ],
      }),
      this.prisma.matricula.findMany({
        where: { usuarioId: estudanteId, papel: "estudante" },
        include: {
          turma: { select: { nome: true, serie: true, periodoLetivo: { select: { titulo: true } } } },
        },
        orderBy: [
          { fim: { sort: "desc", nulls: "first" } },
          { inicio: "desc" },
          { turmaId: "asc" },
        ],
      }),
      this.prisma.progresso.findMany({
        where: { estudanteId },
        select: { escolaId: true, expId: true, atualizadoEm: true },
        orderBy: [{ atualizadoEm: "desc" }],
      }),
    ]);

    const nomeDaEscola = new Map(lotacoes.map((l) => [l.escola.id, l.escola.nome]));
    const objetoPessoa = {
      id: estudante.id,
      nome: estudante.displayName,
      usuario: estudante.username,
      cpf: estudante.cpf ? formatarCpf(estudante.cpf) : null,
    };

    return {
      estudante: objetoPessoa,
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
