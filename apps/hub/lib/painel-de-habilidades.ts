/**
 * O PAINEL DE HABILIDADES (F14.7): o que o hub lê em
 * `/evidencias/{turma/:id,escola,rede}/consolidado` e como a tela o organiza.
 *
 * O contrato é o Zod de `apps/api/src/evidencias/contrato-de-rotas.ts`; quem
 * decide o nível de cada criança na missão (o MELHOR entre as atividades) e
 * quem é "não avaliado" é a api. Aqui só se agrupa por unidade, se ordena e se
 * traduz para a tela.
 *
 * PURO, vale no cliente. As leituras moram em `evidencias-servidor.ts`.
 *
 * NUNCA HÁ RANKING. A única ordenação por desempenho é a das HABILIDADES ("da
 * mais atingida à menos", para o professor ver onde reforçar); estudantes,
 * turmas e escolas ficam na ordem em que a api os manda (alfabética).
 */

import { SERIES, rotuloDaSerie, type Serie } from "./series";

// ── o contrato ──────────────────────────────────────────────────────────

/** Quantas crianças em cada nível. `naoAvaliado` nunca é "não atingiu". */
export interface Distribuicao {
  atingiu: number;
  emProcesso: number;
  naoAtingiu: number;
  naoAvaliado: number;
  total: number;
}

export interface HabilidadeDoPainel {
  codigo: string;
  descricao: string;
}

export interface MissaoDoPainel {
  expId: string;
  nome: string;
  /** A coluna: a unidade do ano (1 a 4). `null` = transversal. */
  unidade: number | null;
  series: string[];
  habilidades: HabilidadeDoPainel[];
}

/** `GET /evidencias/turma/:turmaId/consolidado`. */
export interface TurmaConsolidada {
  turma: { id: string; nome: string; serie: string };
  /** Alfabética — a lista do drill-down. */
  estudantes: { id: string; nome: string }[];
  missoes: {
    expId: string;
    nome: string;
    unidade: number | null;
    aplicada: boolean;
    habilidades: (HabilidadeDoPainel & { distribuicao: Distribuicao })[];
  }[];
}

interface MissaoDaLinha {
  expId: string;
  habilidades: { codigo: string; distribuicao: Distribuicao }[];
}

/** `GET /evidencias/escola/consolidado`. */
export interface EscolaConsolidada {
  escola: { id: string; nome: string };
  periodo: { id: string; titulo: string } | null;
  missoes: MissaoDoPainel[];
  turmas: {
    id: string;
    nome: string;
    serie: string;
    estudantes: number;
    missoes: (MissaoDaLinha & { aplicada: boolean })[];
  }[];
}

/** `GET /evidencias/rede/consolidado`. */
export interface RedeConsolidada {
  regional: { id: string; nome: string } | null;
  periodo: { id: string; titulo: string } | null;
  missoes: MissaoDoPainel[];
  escolas: {
    id: string;
    nome: string;
    series: {
      serie: string;
      turmas: number;
      estudantes: number;
      missoes: (MissaoDaLinha & { turmasAplicadas: number })[];
    }[];
  }[];
}

// ── as cores e os textos ────────────────────────────────────────────────

/** As quatro caixas, na ordem em que a barra as desenha. */
export const NIVEIS_DA_BARRA = ["atingiu", "emProcesso", "naoAtingiu", "naoAvaliado"] as const;
export type NivelDaBarra = (typeof NIVEIS_DA_BARRA)[number];

export const ROTULO_DO_NIVEL_DA_BARRA: Record<NivelDaBarra, string> = {
  atingiu: "Atingiu",
  emProcesso: "Em processo",
  naoAtingiu: "Não atingiu",
  naoAvaliado: "Não avaliado",
};

/**
 * A cor de cada caixa, da paleta de dataviz do DS (`UNOORIA_DATAVIZ_PALETTE`,
 * copiada aqui em hex porque este arquivo é puro e não importa o pacote):
 * verde no atingiu, azul no em processo, LARANJA — e não vermelho — no não
 * atingiu (é leitura pedagógica, não erro, o mesmo critério das `Tag` do
 * painel da atividade), e quase branco no não avaliado, que precisa parecer
 * ausência. O PO pediu o não avaliado TRACEJADO; o `StackedProgressBar` do DS
 * só aceita cor sólida — lacuna registrada no cap. 14.
 */
export const COR_DO_NIVEL_DA_BARRA: Record<NivelDaBarra, string> = {
  atingiu: "#01B574",
  emProcesso: "#7FA5E2",
  naoAtingiu: "#DD5202",
  naoAvaliado: "#E8EFFA",
};

/** Um segmento do `StackedProgressBar` do DS. */
export interface SegmentoDaBarra {
  label: string;
  value: number;
  amountText: string;
  color: string;
}

/**
 * Os quatro segmentos da barra. O DS calcula a porcentagem a partir dos
 * valores e mostra "contagem (porcentagem)" na legenda — a mesma barra serve
 * ao professor (que quer QUANTOS) e à coordenação (que compara turmas de
 * tamanhos diferentes pela porcentagem).
 */
export function segmentosDaBarra(d: Distribuicao): SegmentoDaBarra[] {
  return NIVEIS_DA_BARRA.map((nivel) => ({
    label: ROTULO_DO_NIVEL_DA_BARRA[nivel],
    value: d[nivel],
    amountText: String(d[nivel]),
    color: COR_DO_NIVEL_DA_BARRA[nivel],
  }));
}

/** A fração que atingiu (0 a 1). Turma vazia é 0, e não divisão por zero. */
export function proporcaoAtingiu(d: Distribuicao): number {
  return d.total > 0 ? d.atingiu / d.total : 0;
}

/** "45%" — arredondado, sem casa decimal. */
export function porcentagem(parte: number, total: number): string {
  return `${total > 0 ? Math.round((parte / total) * 100) : 0}%`;
}

// ── as colunas: a unidade ───────────────────────────────────────────────

/** As quatro unidades do ano: as colunas do painel, sempre as quatro. */
export const UNIDADES: readonly number[] = [1, 2, 3, 4];

export function rotuloDaUnidade(unidade: number | null): string {
  return unidade === null ? "Transversais" : `Unidade ${unidade}`;
}

/**
 * As colunas do painel: as quatro unidades SEMPRE (a que ainda não tem missão
 * aparece vazia — o ano tem quatro unidades, e esconder as futuras faria o
 * painel parecer completo), e a das transversais só quando houver alguma.
 */
export function colunasPorUnidade<M extends { unidade: number | null }>(
  missoes: readonly M[],
): { unidade: number | null; missoes: M[] }[] {
  const colunas: { unidade: number | null; missoes: M[] }[] = UNIDADES.map((unidade) => ({
    unidade,
    missoes: missoes.filter((m) => m.unidade === unidade),
  }));
  const transversais = missoes.filter((m) => m.unidade === null || !UNIDADES.includes(m.unidade));
  if (transversais.length > 0) colunas.push({ unidade: null, missoes: transversais });
  return colunas;
}

// ── a ordem das habilidades ─────────────────────────────────────────────

export type OrdemDasHabilidades = "ficha" | "atingimento";

/**
 * As habilidades na ordem da FICHA (a do desenho pedagógico) ou da mais
 * atingida para a menos — para o professor ver rápido onde reforçar. Empate
 * mantém a ordem da ficha. É a ordem das habilidades, nunca dos estudantes.
 */
export function ordenarHabilidades<H extends { distribuicao: Distribuicao }>(
  habilidades: readonly H[],
  ordem: OrdemDasHabilidades,
): H[] {
  if (ordem === "ficha") return [...habilidades];
  return habilidades
    .map((h, i) => ({ h, i }))
    .sort((a, b) => proporcaoAtingiu(b.h.distribuicao) - proporcaoAtingiu(a.h.distribuicao) || a.i - b.i)
    .map(({ h }) => h);
}

// ── as séries ───────────────────────────────────────────────────────────

/** O rótulo humano da série ("5º ano"); série fora do vocabulário vai crua. */
export function rotuloDaSerieDoPainel(serie: string): string {
  return (SERIES as readonly string[]).includes(serie) ? rotuloDaSerie(serie as Serie) : serie;
}

/**
 * As turmas da escola agrupadas por série, na ordem em que a api as manda
 * (série na ordem da trilha, nome dentro dela). Cada grupo traz as missões
 * que valem para alguma turma dele, na ordem do catálogo.
 */
export function seriesDaEscola(painel: EscolaConsolidada) {
  const grupos: { serie: string; turmas: EscolaConsolidada["turmas"]; missoes: MissaoDoPainel[] }[] = [];
  for (const turma of painel.turmas) {
    let grupo = grupos.find((g) => g.serie === turma.serie);
    if (!grupo) {
      grupo = { serie: turma.serie, turmas: [], missoes: [] };
      grupos.push(grupo);
    }
    grupo.turmas.push(turma);
  }
  for (const grupo of grupos) {
    const usadas = new Set(grupo.turmas.flatMap((t) => t.missoes.map((m) => m.expId)));
    grupo.missoes = painel.missoes.filter((m) => usadas.has(m.expId));
  }
  return grupos;
}

/**
 * As séries que aparecem em alguma escola da rede, na ordem da trilha, cada uma
 * com as missões que alguma escola mediu nela.
 */
export function seriesDaRede(painel: RedeConsolidada) {
  const ordem = (s: string) => {
    const i = (SERIES as readonly string[]).indexOf(s);
    return i === -1 ? SERIES.length : i;
  };
  const series = [...new Set(painel.escolas.flatMap((e) => e.series.map((s) => s.serie)))].sort(
    (a, b) => ordem(a) - ordem(b),
  );
  return series.map((serie) => {
    const usadas = new Set(
      painel.escolas.flatMap((e) =>
        e.series.filter((s) => s.serie === serie).flatMap((s) => s.missoes.map((m) => m.expId)),
      ),
    );
    return { serie, missoes: painel.missoes.filter((m) => usadas.has(m.expId)) };
  });
}

/** A distribuição de uma habilidade numa linha (turma, ou série de uma escola); `null` se a linha não a mede. */
export function distribuicaoDa(
  missoes: readonly MissaoDaLinha[],
  expId: string,
  codigo: string,
): Distribuicao | null {
  return missoes.find((m) => m.expId === expId)?.habilidades.find((h) => h.codigo === codigo)?.distribuicao ?? null;
}
