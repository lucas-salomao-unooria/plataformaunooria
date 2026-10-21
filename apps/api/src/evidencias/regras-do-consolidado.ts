import { SERIES } from "../comum/series";
import { melhorRodadaPorHabilidade, type Nivel, type Situacao, type Status } from "./regras";

/**
 * O PAINEL DE HABILIDADES (F14.7): a evidência somada por turma, escola e rede.
 *
 * Regras PURAS, testadas sem banco (`tests/evidencias-consolidado-regras.spec.ts`).
 * O serviço lê as linhas; aqui se decide o que cada criança vale numa missão e
 * como as crianças viram contagem.
 *
 * As três decisões do produto (2026-10-03) que moram aqui:
 *   - a coluna é a UNIDADE da missão (do manifesto), e não o bimestre do
 *     calendário;
 *   - a missão é uma composição de atividades, e o nível da criança numa
 *     habilidade da missão é o MELHOR entre todas as atividades e rodadas —
 *     a extensão da "melhor rodada" que já valia dentro da atividade;
 *   - cada missão aparece separada: a mesma habilidade em duas missões são
 *     duas linhas, sem consolidação entre missões.
 */

/** Quantas crianças em cada nível — e as que não têm nível nenhum. */
export interface Distribuicao {
  atingiu: number;
  /** O "em processo" que diz do estudante — sem o limitado pela atividade. */
  emProcesso: number;
  /**
   * O "em processo" que mede a ATIVIDADE escolhida, e não o estudante: veio de
   * um marcador `limitadoPelaAtividade` (o acervo dela não deixava ir além).
   * Contado À PARTE, fora de `emProcesso`, e dentro do `total`.
   */
  emProcessoLimitado: number;
  naoAtingiu: number;
  /**
   * Da turma, sem evidência que conte: não fez, saiu antes, a projeção ainda
   * não foi confirmada, ou o professor pôs "Não participou". NUNCA vira
   * "não atingiu" — não ter sido observado não é ter falhado.
   */
  naoAvaliado: number;
  /** Todas as crianças contadas: a soma das cinco caixas. */
  total: number;
}

export const DISTRIBUICAO_VAZIA: Readonly<Distribuicao> = Object.freeze({
  atingiu: 0,
  emProcesso: 0,
  emProcessoLimitado: 0,
  naoAtingiu: 0,
  naoAvaliado: 0,
  total: 0,
});

/** Uma linha de `evidencias` como o consolidado a lê. */
export interface LinhaDoConsolidado {
  estudanteId: string;
  expId: string;
  habilidade: string;
  status: Status;
  situacao: Situacao;
  /**
   * O nível desta linha veio de um marcador `limitadoPelaAtividade`. Só a
   * linha PRÓPRIA sabe o marcador; cópia e ajuste nunca são limitados.
   */
  limitado?: boolean;
}

/**
 * O NÍVEL DE CADA CRIANÇA EM CADA HABILIDADE DE UMA MISSÃO — o melhor válido
 * em qualquer atividade e qualquer rodada.
 *
 * É a mesma função da "melhor rodada" aplicada às linhas de todas as
 * atividades juntas: o melhor de cada atividade, e depois o melhor entre elas,
 * dá o mesmo que o melhor de tudo. Fica de fora o que não conta (a projeção
 * `a_revisar` e o `nao_participou`).
 *
 * Chave de fora: o estudante. De dentro: o código da habilidade.
 */
export function niveisDaMissao(
  linhas: readonly LinhaDoConsolidado[],
  expId: string,
): Map<string, Map<string, Nivel>> {
  const porEstudante = new Map<string, LinhaDoConsolidado[]>();
  for (const l of linhas) {
    if (l.expId !== expId) continue;
    const doEstudante = porEstudante.get(l.estudanteId);
    if (doEstudante) doEstudante.push(l);
    else porEstudante.set(l.estudanteId, [l]);
  }
  const niveis = new Map<string, Map<string, Nivel>>();
  for (const [estudanteId, minhas] of porEstudante) niveis.set(estudanteId, melhorRodadaPorHabilidade(minhas));
  return niveis;
}

/**
 * QUEM ESTÁ "EM PROCESSO" SÓ PELO LIMITE DA ATIVIDADE, numa missão: o melhor
 * nível da criança na habilidade é "em processo" e TODAS as linhas válidas que
 * deram esse "em processo" são limitadas. Empate entre um "em processo"
 * limitado e um comum guarda o COMUM — houve uma atividade que mediu o
 * estudante, e é ela que fala dele.
 *
 * Devolve as chaves `estudante|habilidade` (a de `chaveDoLimitado`).
 */
export function limitadosDaMissao(linhas: readonly LinhaDoConsolidado[], expId: string): Set<string> {
  const emProcesso = new Map<string, boolean>();
  const niveis = niveisDaMissao(linhas, expId);
  for (const l of linhas) {
    if (l.expId !== expId || l.situacao !== "valida" || l.status !== "em_processo") continue;
    if (niveis.get(l.estudanteId)?.get(l.habilidade) !== "em_processo") continue;
    const chave = chaveDoLimitado(l.estudanteId, l.habilidade);
    emProcesso.set(chave, (emProcesso.get(chave) ?? true) && l.limitado === true);
  }
  return new Set([...emProcesso].filter(([, limitado]) => limitado).map(([chave]) => chave));
}

/** `estudante|habilidade` — a chave de `limitadosDaMissao`. */
export function chaveDoLimitado(estudanteId: string, habilidade: string): string {
  return `${estudanteId}|${habilidade}`;
}

/**
 * A DISTRIBUIÇÃO DE UMA TURMA NUMA HABILIDADE: cada criança da turma cai em
 * exatamente uma das quatro caixas.
 *
 * `limitados` (de `limitadosDaMissao`) separa o "em processo" que mede a
 * atividade: ele cai em `emProcessoLimitado`, e não em `emProcesso`.
 *
 * Quem conta é a lista de ESTUDANTES DA TURMA, não as linhas: a criança sem
 * linha é "não avaliado", e a linha de quem saiu da turma não entra (é dela, e
 * volta se ela voltar — o mesmo critério do painel da atividade).
 */
export function distribuir(
  estudantes: readonly string[],
  niveis: ReadonlyMap<string, ReadonlyMap<string, Nivel>>,
  habilidade: string,
  limitados: ReadonlySet<string> = new Set(),
): Distribuicao {
  const d: Distribuicao = { ...DISTRIBUICAO_VAZIA };
  for (const id of estudantes) {
    const nivel = niveis.get(id)?.get(habilidade);
    if (nivel === "atingiu") d.atingiu += 1;
    else if (nivel === "em_processo" && limitados.has(chaveDoLimitado(id, habilidade))) d.emProcessoLimitado += 1;
    else if (nivel === "em_processo") d.emProcesso += 1;
    else if (nivel === "nao_atingiu") d.naoAtingiu += 1;
    else d.naoAvaliado += 1;
    d.total += 1;
  }
  return d;
}

/** A soma de duas distribuições — a escola é a soma das turmas, a rede a das escolas. */
export function somar(a: Distribuicao, b: Distribuicao): Distribuicao {
  return {
    atingiu: a.atingiu + b.atingiu,
    emProcesso: a.emProcesso + b.emProcesso,
    emProcessoLimitado: a.emProcessoLimitado + b.emProcessoLimitado,
    naoAtingiu: a.naoAtingiu + b.naoAtingiu,
    naoAvaliado: a.naoAvaliado + b.naoAvaliado,
    total: a.total + b.total,
  };
}

/**
 * AS HABILIDADES DE UMA MISSÃO, NA ORDEM DA FICHA — e, depois delas, as que
 * têm evidência mas saíram da ficha numa versão nova. Esconder essas seria
 * apagar o que a criança fez (o mesmo critério do painel da atividade).
 */
export function habilidadesDaMissao(
  daFicha: readonly string[],
  linhas: readonly LinhaDoConsolidado[],
  expId: string,
): string[] {
  const codigos = [...daFicha];
  for (const l of linhas) {
    if (l.expId === expId && !codigos.includes(l.habilidade)) codigos.push(l.habilidade);
  }
  return codigos;
}

/** A posição da série na trilha (`1EF` < … < `9EF` < `1EM` < … < `3EM`). Desconhecida vai para o fim. */
export function ordemDaSerie(serie: string): number {
  const i = (SERIES as readonly string[]).indexOf(serie);
  return i === -1 ? SERIES.length : i;
}

/**
 * A MISSÃO VALE PARA A TURMA? Vale quando a série da turma está nas séries do
 * manifesto, OU quando a turma já tem evidência dela — uma turma do 6º ano que
 * fez a missão do 5º continua vendo o que fez.
 */
export function missaoDaTurma(
  missao: { expId: string; series: readonly string[] },
  serieDaTurma: string,
  aplicadas: ReadonlySet<string>,
): boolean {
  return missao.series.includes(serieDaTurma) || aplicadas.has(missao.expId);
}
