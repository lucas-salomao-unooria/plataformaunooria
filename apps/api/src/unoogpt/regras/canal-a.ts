import { MISSAO_TEMPESTADE } from '../cenario';
import { CONJUNTO_POR_SLUG } from '../modelo/conjuntos';

/**
 * O VOCABULÁRIO do Canal A da Missão Tempestade (ADR-172). PURO.
 *
 * As sete tarefas por ação, cada uma um marcador da ficha
 * (`evidencias/fichas/exp02em1b.ts`). O MESMO vocabulário do CHECK
 * `exp02em1b_tarefas_tarefa_check` da migration `exp02em1b_canal_a` —
 * `tests/unoogpt-canal-a-postgres.spec.ts` compara os dois.
 */
export const TAREFAS = ['leitura', 'fontes', 'alerta', 'saude', 'e-se', 'whatsapp', 'moradora'] as const;
export type Tarefa = (typeof TAREFAS)[number];

/** O marcador da ficha que cada tarefa marca. Mesmo id, de propósito. */
export const MARCADOR_DA_TAREFA: Record<Tarefa, string> = {
  leitura: 'leitura',
  fontes: 'fontes',
  alerta: 'alerta',
  saude: 'saude',
  'e-se': 'e-se',
  whatsapp: 'whatsapp',
  moradora: 'moradora',
};

/** As três tarefas do registro da operação, na ordem da tela. */
export const TAREFAS_DO_REGISTRO = ['leitura', 'fontes', 'alerta'] as const satisfies readonly Tarefa[];
/** As duas do fechamento, que o professor abre. */
export const TAREFAS_DO_FECHAMENTO = ['whatsapp', 'moradora'] as const satisfies readonly Tarefa[];

// ── a língua dos cartões ───────────────────────────────────────────────────

/** O artigo de cada bairro: "a Ribeirinha", "o Vale Verde". */
const ARTIGO_DO_BAIRRO: Record<string, 'a' | 'o'> = {
  ribeirinha: 'a',
  valeverde: 'o',
  morroalto: 'o',
  industrial: 'o',
};

export const nomeDoBairro = (slug: string) =>
  MISSAO_TEMPESTADE.bairros.find((b) => b.slug === slug)?.nome ?? slug;

/** "para a Ribeirinha", "para o Industrial". */
export const paraOBairro = (slug: string) => `para ${ARTIGO_DO_BAIRRO[slug] ?? 'o'} ${nomeDoBairro(slug)}`;
/** "da Ribeirinha", "do Morro Alto". */
export const doBairro = (slug: string) => `${ARTIGO_DO_BAIRRO[slug] === 'a' ? 'da' : 'do'} ${nomeDoBairro(slug)}`;
/** "na Ribeirinha", "no Morro Alto". */
export const noBairro = (slug: string) => `${ARTIGO_DO_BAIRRO[slug] === 'a' ? 'na' : 'no'} ${nomeDoBairro(slug)}`;

/** O artigo de cada fonte, pelo rótulo curto: "o cadastro de moradores". */
const ARTIGO_DA_FONTE: Record<string, string> = {
  ocorrencias: 'os',
  sensores: 'as',
  censo: 'o',
  previsao: 'a',
  satelite: 'as',
  telefonia: 'o',
  viaria: 'o',
  estudo: 'o',
};

/** "o cadastro de moradores", "as medições do rio". */
export const aFonte = (slug: string) =>
  `${ARTIGO_DA_FONTE[slug] ?? 'a'} ${CONJUNTO_POR_SLUG.get(slug)?.rotuloCurto ?? slug}`;

/** "pelo cadastro de moradores", "pelas medições do rio". */
export const pelaFonte = (slug: string) => {
  const artigo = ARTIGO_DA_FONTE[slug] ?? 'a';
  const contracao = { o: 'pelo', a: 'pela', os: 'pelos', as: 'pelas' }[artigo] ?? 'pela';
  return `${contracao} ${CONJUNTO_POR_SLUG.get(slug)?.rotuloCurto ?? slug}`;
};

/** "A, B e C". */
export function lista(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** A ordem do mapa: é o desempate de toda escolha de bairro. */
export const ORDEM_DO_MAPA: readonly string[] = MISSAO_TEMPESTADE.bairros.map((b) => b.slug);
