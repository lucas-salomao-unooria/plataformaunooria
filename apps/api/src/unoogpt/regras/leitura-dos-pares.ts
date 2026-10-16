import { embaralhar, type Nivel } from '../../evidencias/regras';
import { agruparEmpatados } from '../modelo/estimativa';
import { noBairro } from './canal-a';

/**
 * A LEITURA DOS DADOS, no registro da operação (EM13CO12, ADR-172). PURO.
 *
 * Volta à tela a última tabela que o grupo pediu ao Cientista — bairro, pessoas
 * em risco e o "pode ser X ou Y", SEM a frase de empate — e duas perguntas, uma
 * por par de bairros: "Pelo que esta tabela mostra, há mais gente em risco na
 * Ribeirinha ou no Morro Alto?". Opções: os dois bairros e "As faixas se
 * cruzam".
 *
 * - Um par SEPARADO: a faixa de um inteira acima da do outro, com folga de pelo
 *   menos 5% do número maior. Certa: o bairro de cima.
 * - Um par CRUZADO, tirado de um grupo de empate da própria leitura (a mesma
 *   conta do aviso de empate, `agruparEmpatados`), com sobreposição de pelo
 *   menos 5%. Certa: "As faixas se cruzam" — e o gabarito nunca contraria um
 *   aviso que a missão já deu.
 * - A ordem dos pares e a dos bairros em cada par é embaralhada.
 *
 * Com dois pares de tipos diferentes, nenhuma resposta fixa chega a
 * "demonstra": "sempre se cruzam" erra o separado, "sempre o maior" erra o
 * cruzado.
 *
 * A régua, com o processo (os dados pedidos antes de mandar):
 *
 * | Dados pedidos | Leitura dos dois pares | Nível |
 * | --- | --- | --- |
 * | nenhum, com pelo menos 1 minuto de investigação aberta | — | não demonstra |
 * | nenhum, sem esse minuto | — | sem marca |
 * | uma fonte | qualquer, ou sem cartão | em desenvolvimento |
 * | duas ou mais | sem cartão | em desenvolvimento |
 * | duas ou mais | nenhum ou um par certo | em desenvolvimento |
 * | duas ou mais | os dois certos | demonstra |
 */
export const FOLGA_MINIMA = 0.05;
export const CRUZAM = 'cruzam';
export const ROTULO_CRUZAM = 'As faixas se cruzam';

export interface LinhaDaLeitura {
  bairro: string;
  min: number;
  esperado: number;
  max: number;
}

export interface ParDaLeitura {
  id: 'separado' | 'cruzado';
  /** A ordem em que os dois bairros aparecem na pergunta (já embaralhada). */
  bairros: [string, string];
  gabarito: string;
}

/** O par separado: o primeiro, do maior para o menor, com folga de 5% do maior. */
function parSeparado(linhas: readonly LinhaDaLeitura[]): [LinhaDaLeitura, LinhaDaLeitura] | null {
  const ordem = [...linhas].sort((a, b) => b.esperado - a.esperado);
  for (let i = 0; i < ordem.length; i++) {
    for (let j = i + 1; j < ordem.length; j++) {
      const de = ordem[i]!;
      const para = ordem[j]!;
      const maior = Math.max(de.max, para.max);
      if (de.min - para.max >= FOLGA_MINIMA * maior) return [de, para];
    }
  }
  return null;
}

/** O par cruzado: de um grupo de empate, com sobreposição de 5% do maior. */
function parCruzado(linhas: readonly LinhaDaLeitura[]): [LinhaDaLeitura, LinhaDaLeitura] | null {
  for (const grupo of agruparEmpatados(linhas.map((l) => ({ ...l, chave: l.bairro })))) {
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const a = grupo[i]!;
        const b = grupo[j]!;
        const sobreposicao = Math.min(a.max, b.max) - Math.max(a.min, b.min);
        if (sobreposicao >= FOLGA_MINIMA * Math.max(a.max, b.max)) return [a, b];
      }
    }
  }
  return null;
}

/** Os dois pares, ou `null` quando a tabela não tem os dois tipos (o cartão não aparece). */
export function montarPares(linhas: readonly LinhaDaLeitura[], aleatorio: () => number): ParDaLeitura[] | null {
  const separado = parSeparado(linhas);
  const cruzado = parCruzado(linhas);
  if (!separado || !cruzado) return null;
  const pares: ParDaLeitura[] = [
    {
      id: 'separado',
      bairros: embaralhar([separado[0].bairro, separado[1].bairro], aleatorio) as [string, string],
      gabarito: separado[0].bairro,
    },
    {
      id: 'cruzado',
      bairros: embaralhar([cruzado[0].bairro, cruzado[1].bairro], aleatorio) as [string, string],
      gabarito: CRUZAM,
    },
  ];
  return embaralhar(pares, aleatorio);
}

/** O enunciado de um par. */
export function perguntaDoPar(par: ParDaLeitura): string {
  const [a, b] = par.bairros;
  return `Pelo que esta tabela mostra, há mais gente em risco ${noBairro(a)} ou ${noBairro(b)}?`;
}

export function acertosDaLeitura(pares: readonly ParDaLeitura[], respostas: Record<string, string>): number {
  return pares.filter((p) => respostas[p.id] === p.gabarito).length;
}

export function opcoesDoPar(par: ParDaLeitura): string[] {
  return [...par.bairros, CRUZAM];
}

export function nivelDaLeitura(entrada: {
  /** Quantas fontes o grupo pediu antes de mandar. */
  fontes: number;
  /** A tentativa teve pelo menos 1 minuto de investigação aberta? */
  teveMinuto: boolean;
  /** Acertos nos dois pares; `null` = o cartão não apareceu. */
  acertos: number | null;
}): Nivel | null {
  if (entrada.fontes === 0) return entrada.teveMinuto ? 'nao_atingiu' : null;
  if (entrada.fontes === 1) return 'em_processo';
  return entrada.acertos === 2 ? 'atingiu' : 'em_processo';
}
