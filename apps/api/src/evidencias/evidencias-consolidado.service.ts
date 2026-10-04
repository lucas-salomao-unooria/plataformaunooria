import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ehDoContrato, type AuthClaims } from "../auth/claims";
import { escolaAlvo } from "../comum/escola-alvo";
import { professorLeciona } from "../comum/turmas-do-professor";
import { habilidadePorCodigo } from "../curriculo/consulta";
import { PrismaService } from "../prisma/prisma.service";
import { EscolasService } from "../rostering/escolas.service";
import { periodoVigente } from "../rostering/regras";
import { EvidenciasService } from "./evidencias.service";
import {
  DISTRIBUICAO_VAZIA,
  distribuir,
  habilidadesDaMissao,
  missaoDaTurma,
  niveisDaMissao,
  ordemDaSerie,
  somar,
  type Distribuicao,
  type LinhaDoConsolidado,
} from "./regras-do-consolidado";
import type { Situacao, Status } from "./regras";

/** Uma missão com ficha, como o painel a descreve. */
interface MissaoDoPainel {
  expId: string;
  nome: string;
  unidade: number | null;
  series: string[];
  habilidades: { codigo: string; descricao: string }[];
}

/** O que uma turma mediu em uma missão. */
interface MedidaDaMissao {
  expId: string;
  aplicada: boolean;
  habilidades: { codigo: string; distribuicao: Distribuicao }[];
}

export interface TurmaMedida {
  id: string;
  nome: string;
  serie: string;
  estudantes: number;
  missoes: MedidaDaMissao[];
}

type LinhaDaTurma = LinhaDoConsolidado & { turmaId: string };

/**
 * Escolas lidas ao mesmo tempo no painel da rede. O mesmo 8 do relatório da
 * diretoria (`EscolasService.relatorioDaRegional`): todas em paralelo
 * estourariam o pool do Prisma, e em série seriam cem idas de rede em fila.
 */
const ESCOLAS_POR_LOTE = 8;

function* emLotes<T>(itens: readonly T[], tamanho: number): Generator<T[]> {
  for (let i = 0; i < itens.length; i += tamanho) yield itens.slice(i, i + tamanho);
}

const TURMA_NAO_ENCONTRADA = "Turma não encontrada.";

/**
 * O PAINEL DE HABILIDADES (F14.7): a evidência pedagógica somada — a turma
 * (professor), a escola (coordenação da escola) e a rede (coordenação
 * regional e perfis de contrato).
 *
 * Só LÊ. Quem escreve a evidência é a missão (`EvidenciasService.marcar`) e o
 * professor (`confirmar`, `ajustar`); o painel consome o que já está gravado.
 *
 * **A rede atravessa escolas SEM afrouxar a RLS** — uma transação por escola,
 * em lotes, somando na aplicação: o padrão do relatório da diretoria (ADR-82).
 * Diretoria grande ficar lenta é gatilho para agregado materializado, não para
 * mexer na política.
 *
 * **Nunca há ranking**: turmas por série e nome, escolas por nome, estudantes
 * por nome. A ordenação "da mais atingida à menos" é das HABILIDADES, e quem a
 * faz é a tela.
 */
@Injectable()
export class EvidenciasConsolidadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly escolas: EscolasService,
  ) {}

  /**
   * QUAL ESCOLA esta consulta lê — `escolaAlvo`, mais uma porta: a coordenação
   * REGIONAL pode pedir qualquer escola da regional dela.
   *
   * É o que faz o drill-down "rede → escola → turma → estudante" funcionar
   * para quem não tem lotação em nenhuma escola. A RLS continua intocada: a
   * leitura roda sob o `escola_id` daquela escola só, e quem decide se a
   * escola é da regional é `temLotacao` — o mesmo lugar por onde o seletor do
   * cabeçalho e o histórico do estudante transferido já passam (ADR-80).
   */
  async escolaDaConsulta(auth: AuthClaims, escolaIdPedida?: string): Promise<string> {
    if (auth.perfil === "gestor_regional" && escolaIdPedida && escolaIdPedida !== auth.escolaId) {
      if (await this.escolas.temLotacao(auth.usuarioId, escolaIdPedida)) return escolaIdPedida;
      throw new ForbiddenException("acesso restrito às escolas da sua regional");
    }
    return escolaAlvo(auth, escolaIdPedida);
  }

  /**
   * As missões COM FICHA, com o que o catálogo diz delas (nome, unidade,
   * séries). Missão sem linha em `experiencias` (dev sem seed) fica com o
   * `expId` como nome e sem série — ela ainda aparece onde houver evidência.
   * Ordem: unidade, depois a primeira série, depois o nome.
   */
  private async catalogo(cliente: Pick<Prisma.TransactionClient, "experiencia">): Promise<MissaoDoPainel[]> {
    const fichas = this.evidencias.fichasRegistradas();
    const linhas = await cliente.experiencia.findMany({
      where: { expId: { in: fichas.map((f) => f.expId) } },
      select: { expId: true, nome: true, unidade: true, series: true },
    });
    const doCatalogo = new Map(linhas.map((l) => [l.expId, l]));
    const menorSerie = (m: MissaoDoPainel) => Math.min(...m.series.map(ordemDaSerie), Infinity);
    return fichas
      .map((f) => {
        const c = doCatalogo.get(f.expId);
        return {
          expId: f.expId,
          nome: c?.nome ?? f.expId,
          unidade: c?.unidade ?? null,
          series: c?.series ?? [],
          habilidades: f.habilidades.map((h) => ({
            codigo: h.codigo,
            descricao: habilidadePorCodigo(h.codigo)?.descricao ?? "",
          })),
        };
      })
      .sort(
        (a, b) =>
          (a.unidade ?? 99) - (b.unidade ?? 99) || menorSerie(a) - menorSerie(b) || a.nome.localeCompare(b.nome),
      );
  }

  /**
   * O ano letivo de onde as turmas da escola e da rede saem — o vigente pelas
   * datas, ou o mais recente. Sem filtro de período, a turma de 2026 e a de
   * 2027 da mesma série apareceriam lado a lado, e a soma da série misturaria
   * dois anos de crianças. `agora` é parâmetro para o teste não depender do
   * dia em que roda.
   */
  private async periodoDoPainel(agora: Date): Promise<{ id: string; titulo: string } | null> {
    const periodos = await this.prisma.periodoLetivo.findMany({
      where: { tipo: "ano_letivo" },
      select: { id: true, titulo: true, inicio: true, fim: true },
    });
    const p = periodoVigente(periodos, agora);
    return p ? { id: p.id, titulo: p.titulo } : null;
  }

  /**
   * As evidências das turmas, nas missões com ficha. UMA consulta para todas:
   * a linha vem com a turma, e `aplicada` sai das mesmas linhas (qualquer
   * linha conta, até a projeção a confirmar — a turma FEZ a missão).
   */
  private async linhasDasTurmas(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaIds: readonly string[],
    expIds: readonly string[],
  ): Promise<LinhaDaTurma[]> {
    if (turmaIds.length === 0 || expIds.length === 0) return [];
    const linhas = await tx.evidencia.findMany({
      where: { escolaId, turmaId: { in: [...turmaIds] }, expId: { in: [...expIds] } },
      select: { turmaId: true, estudanteId: true, expId: true, habilidade: true, status: true, situacao: true },
    });
    return linhas.map((l) => ({ ...l, status: l.status as Status, situacao: l.situacao as Situacao }));
  }

  /** O que UMA turma mediu em cada missão que vale para ela. */
  private medirTurma(
    serie: string,
    estudantes: readonly string[],
    linhas: readonly LinhaDaTurma[],
    catalogo: readonly MissaoDoPainel[],
  ): MedidaDaMissao[] {
    const aplicadas = new Set(linhas.map((l) => l.expId));
    return catalogo
      .filter((m) => missaoDaTurma(m, serie, aplicadas))
      .map((m) => {
        const niveis = niveisDaMissao(linhas, m.expId);
        const codigos = habilidadesDaMissao(
          m.habilidades.map((h) => h.codigo),
          linhas,
          m.expId,
        );
        return {
          expId: m.expId,
          aplicada: aplicadas.has(m.expId),
          habilidades: codigos.map((codigo) => ({ codigo, distribuicao: distribuir(estudantes, niveis, codigo) })),
        };
      });
  }

  /**
   * O PAINEL DA TURMA (H14.7.1): cada missão, cada habilidade, quantas
   * crianças em cada nível. É a mesma tela para o professor (só a turma em
   * que leciona — 404, nunca 403) e para a coordenação no drill-down.
   */
  async daTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await tx.turma.findFirst({
        where: { id: turmaId, escolaId },
        select: { id: true, nome: true, serie: true },
      });
      if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) {
        throw new NotFoundException({ mensagem: TURMA_NAO_ENCONTRADA });
      }
      const catalogo = await this.catalogo(tx);
      /* `users.turma_id`, a mesma fonte do painel da atividade e das equipes.
         `users` está FORA da RLS: o `escolaId` no `where` é a tranca. */
      const [estudantes, linhas] = await Promise.all([
        tx.user.findMany({
          where: { escolaId, turmaId, role: "estudante" },
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" },
        }),
        this.linhasDasTurmas(tx, escolaId, [turmaId], catalogo.map((m) => m.expId)),
      ]);
      const medidas = this.medirTurma(
        turma.serie,
        estudantes.map((e) => e.id),
        linhas,
        catalogo,
      );
      const daMissao = new Map(catalogo.map((m) => [m.expId, m]));
      return {
        turma,
        estudantes: estudantes.map((e) => ({ id: e.id, nome: e.displayName })),
        missoes: medidas.map((medida) => {
          const m = daMissao.get(medida.expId)!;
          return {
            expId: m.expId,
            nome: m.nome,
            unidade: m.unidade,
            aplicada: medida.aplicada,
            habilidades: medida.habilidades.map((h) => ({
              codigo: h.codigo,
              descricao: habilidadePorCodigo(h.codigo)?.descricao ?? "",
              distribuicao: h.distribuicao,
            })),
          };
        }),
      };
    }, escolaId);
  }

  /**
   * As turmas de UMA escola, medidas — dentro da transação já armada naquela
   * escola. É o miolo do painel da escola e de cada escola do painel da rede.
   */
  private async lerEscola(
    tx: Prisma.TransactionClient,
    escolaId: string,
    periodoId: string | null,
    catalogo: readonly MissaoDoPainel[],
  ): Promise<TurmaMedida[]> {
    const turmas = await tx.turma.findMany({
      where: { escolaId, ...(periodoId ? { periodoLetivoId: periodoId } : {}) },
      select: { id: true, nome: true, serie: true },
    });
    if (turmas.length === 0) return [];
    const turmaIds = turmas.map((t) => t.id);
    const [estudantes, linhas] = await Promise.all([
      tx.user.findMany({
        where: { escolaId, role: "estudante", turmaId: { in: turmaIds } },
        select: { id: true, turmaId: true },
      }),
      this.linhasDasTurmas(tx, escolaId, turmaIds, catalogo.map((m) => m.expId)),
    ]);
    const estudantesDa = new Map<string, string[]>();
    for (const e of estudantes) {
      if (!e.turmaId) continue;
      estudantesDa.set(e.turmaId, [...(estudantesDa.get(e.turmaId) ?? []), e.id]);
    }
    const linhasDa = new Map<string, LinhaDaTurma[]>();
    for (const l of linhas) linhasDa.set(l.turmaId, [...(linhasDa.get(l.turmaId) ?? []), l]);

    return turmas
      .map((t) => {
        const ids = estudantesDa.get(t.id) ?? [];
        return {
          id: t.id,
          nome: t.nome,
          serie: t.serie,
          estudantes: ids.length,
          missoes: this.medirTurma(t.serie, ids, linhasDa.get(t.id) ?? [], catalogo),
        };
      })
      .filter((t) => t.missoes.length > 0)
      .sort((a, b) => ordemDaSerie(a.serie) - ordemDaSerie(b.serie) || a.nome.localeCompare(b.nome));
  }

  /**
   * O PAINEL DA ESCOLA (H14.7.2): as turmas do ano letivo vigente que têm
   * alguma missão com ficha, por série e nome — sem ranking entre turmas.
   */
  async daEscola(escolaId: string, agora: Date = new Date()) {
    const escola = await this.prisma.escola.findFirst({
      where: { id: escolaId, tipo: "escola" },
      select: { id: true, nome: true },
    });
    if (!escola) throw new NotFoundException({ mensagem: "Escola não encontrada." });
    const periodo = await this.periodoDoPainel(agora);
    const catalogo = await this.catalogo(this.prisma);
    const turmas = await this.prisma.comTenancy(
      (tx) => this.lerEscola(tx, escolaId, periodo?.id ?? null, catalogo),
      escolaId,
    );
    return { escola, periodo, missoes: catalogo, turmas };
  }

  /**
   * QUAIS ESCOLAS o painel da rede lê. O `gestor_regional` lê a PRÓPRIA
   * regional, e o `?regionalId=` dele é IGNORADO — ignorado, e não validado:
   * o efeito é o mesmo, mas esquecer uma comparação não vira "leia a
   * diretoria do vizinho por querystring" (o desenho de `regionalDoRelatorio`).
   * Os perfis de contrato escolhem a regional, ou leem a rede inteira.
   */
  private async escolasDaRede(auth: AuthClaims, regionalPedida?: string) {
    const regionalId = ehDoContrato(auth.perfil)
      ? (regionalPedida ?? null)
      : await this.escolas.regionalDoRelatorio(auth);
    if (!ehDoContrato(auth.perfil) && !regionalId) return { regional: null, escolas: [] };

    if (regionalId) {
      const regional = await this.prisma.escola.findFirst({
        where: { id: regionalId, tipo: "regional" },
        select: { id: true, nome: true },
      });
      if (!regional) throw new NotFoundException({ mensagem: "Regional não encontrada." });
      const escolas = await this.prisma.escola.findMany({
        where: { tipo: "escola", paiId: regionalId },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      });
      return { regional, escolas };
    }
    const escolas = await this.prisma.escola.findMany({
      where: { tipo: "escola" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    return { regional: null, escolas };
  }

  /**
   * O PAINEL DA REDE (H14.7.3): cada escola, cada série, a soma das turmas.
   * Uma transação por escola, em lotes — a RLS não é tocada.
   */
  async daRede(auth: AuthClaims, regionalPedida?: string, agora: Date = new Date()) {
    const { regional, escolas } = await this.escolasDaRede(auth, regionalPedida);
    const periodo = await this.periodoDoPainel(agora);
    const catalogo = await this.catalogo(this.prisma);

    const lidas: { id: string; nome: string; turmas: TurmaMedida[] }[] = [];
    for (const lote of emLotes(escolas, ESCOLAS_POR_LOTE)) {
      lidas.push(
        ...(await Promise.all(
          lote.map(async (escola) => ({
            ...escola,
            turmas: await this.prisma.comTenancy(
              (tx) => this.lerEscola(tx, escola.id, periodo?.id ?? null, catalogo),
              escola.id,
            ),
          })),
        )),
      );
    }

    return {
      regional,
      periodo,
      missoes: catalogo,
      escolas: lidas.map((escola) => ({ id: escola.id, nome: escola.nome, series: somarPorSerie(escola.turmas) })),
    };
  }
}

/**
 * As turmas de uma escola somadas por SÉRIE: quantas turmas, quantas
 * crianças, e em cada missão quantas turmas a aplicaram e a soma da
 * distribuição de cada habilidade. A turma que não aplicou entra na soma como
 * "não avaliado" — são crianças da série que a missão ainda não alcançou.
 */
export function somarPorSerie(turmas: readonly TurmaMedida[]) {
  const porSerie = new Map<
    string,
    {
      turmas: number;
      estudantes: number;
      missoes: Map<string, { turmasAplicadas: number; habilidades: Map<string, Distribuicao> }>;
    }
  >();
  for (const turma of turmas) {
    const serie = porSerie.get(turma.serie) ?? { turmas: 0, estudantes: 0, missoes: new Map() };
    serie.turmas += 1;
    serie.estudantes += turma.estudantes;
    for (const missao of turma.missoes) {
      const soma = serie.missoes.get(missao.expId) ?? { turmasAplicadas: 0, habilidades: new Map() };
      if (missao.aplicada) soma.turmasAplicadas += 1;
      for (const h of missao.habilidades) {
        soma.habilidades.set(h.codigo, somar(soma.habilidades.get(h.codigo) ?? DISTRIBUICAO_VAZIA, h.distribuicao));
      }
      serie.missoes.set(missao.expId, soma);
    }
    porSerie.set(turma.serie, serie);
  }
  return [...porSerie.entries()]
    .sort(([a], [b]) => ordemDaSerie(a) - ordemDaSerie(b))
    .map(([serie, s]) => ({
      serie,
      turmas: s.turmas,
      estudantes: s.estudantes,
      missoes: [...s.missoes.entries()].map(([expId, m]) => ({
        expId,
        turmasAplicadas: m.turmasAplicadas,
        habilidades: [...m.habilidades.entries()].map(([codigo, distribuicao]) => ({ codigo, distribuicao })),
      })),
    }));
}
