import type { EstimativaDoBairro } from '../modelo/estimativa';

/**
 * As visões do mapa. PURO.
 *
 * O mapa é a leitura dos Conjuntos carregados (ADR-0006): bairro que nenhum
 * conjunto cobre fica em branco, e ficar em branco é informação — é o modelo
 * dizendo "eu não sei", que é a coisa mais honesta que ele faz.
 */
export const VISOES = [
  { id: 'risco', rotulo: 'Risco' },
  { id: 'pessoas', rotulo: 'Pessoas' },
  { id: 'alcance', rotulo: 'Alcance' },
  { id: 'confianca', rotulo: 'Confiança' },
] as const;
export type Visao = (typeof VISOES)[number]['id'];

export type NivelDeRisco = 'baixo' | 'medio' | 'alto';

/**
 * Faixas de risco. Os cortes são de autoria, não de estatística: 30% separa
 * "pode acontecer" de "conte com isso", e 60% separa isso de "planeje para
 * acontecer".
 */
export function nivelDeRisco(chance: number): NivelDeRisco {
  if (chance >= 0.6) return 'alto';
  if (chance >= 0.3) return 'medio';
  return 'baixo';
}

export const ROTULO_NIVEL: Record<NivelDeRisco, string> = {
  baixo: 'BAIXO',
  medio: 'MÉDIO',
  alto: 'ALTO',
};

export interface DadoDaVisao {
  selo: { texto: string; nivel: NivelDeRisco } | null;
  linha: string;
  /** Faixa min–max em texto: nunca mostramos número seco. */
  faixa: string | null;
  confianca: 'alta' | 'média' | 'baixa';
}

const milhar = (n: number) => n.toLocaleString('pt-BR');

/**
 * Arredonda para a centena. "3.456 pessoas" com margem de mais ou menos mil é
 * precisão falsa: os quatro dígitos exatos desmentem a faixa ao lado. O modelo
 * não sabe a unidade — e a tela não pode fingir que sabe.
 */
const aproximado = (n: number) => milhar(Math.round(n / 100) * 100);

export function dadoDaVisao(
  estimativa: EstimativaDoBairro | undefined,
  visao: Visao,
): DadoDaVisao | null {
  // Alcance não sai da estimativa: sai do mapa de estradas e do Relógio, e é
  // tratado direto no mapa.
  if (visao === 'alcance') return null;
  if (!estimativa || estimativa.cobertura === 0) return null;

  switch (visao) {
    case 'risco': {
      const f = estimativa.chanceDeEventoSevero;
      const nivel = nivelDeRisco(f.esperado);
      return {
        selo: { texto: ROTULO_NIVEL[nivel], nivel },
        linha: `${Math.round(f.esperado * 100)}% de chance de evento severo`,
        faixa: `entre ${Math.round(f.min * 100)}% e ${Math.round(f.max * 100)}%`,
        confianca: estimativa.confianca,
      };
    }
    case 'pessoas': {
      const f = estimativa.pessoasEmRisco;
      return {
        selo: null,
        linha: `~${aproximado(f.esperado)} pessoas em risco`,
        faixa: `entre ${aproximado(f.min)} e ${aproximado(f.max)}`,
        confianca: estimativa.confianca,
      };
    }
    case 'confianca':
      return {
        selo: null,
        linha: `${Math.round(estimativa.cobertura * 100)}% de cobertura de dados`,
        faixa: `confiança ${estimativa.confianca}`,
        confianca: estimativa.confianca,
      };
  }
}
