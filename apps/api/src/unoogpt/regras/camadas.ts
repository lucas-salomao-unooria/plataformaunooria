import { MISSAO_TEMPESTADE } from '../cenario';
import { CONJUNTOS } from '../modelo/conjuntos';
import { estimar, type EstimativaDoBairro } from '../modelo/estimativa';
import { sementeDe } from '../modelo/aleatorio';
import type { BairroPublico } from './sanitizador';

/**
 * Monta o mapa a partir dos Conjuntos carregados. PURO.
 *
 * A regra que a tela 2 promete: nada aparece sem que um Conjunto o cubra. Não
 * existe caminho no código que revele a cidade inteira — de propósito.
 */
export function montarMapa(
  sessaoId: string,
  rodada: number,
  conjuntos: readonly string[],
): { bairros: BairroPublico[]; estimativas: EstimativaDoBairro[] } {
  const estimativas = estimar(conjuntos, sementeDe(`${sessaoId}:${rodada}`));
  const porBairro = new Map(estimativas.map((e) => [e.bairro, e]));

  const bairros = MISSAO_TEMPESTADE.bairros.map((b) => ({
    slug: b.slug,
    nome: b.nome,
    left: b.left,
    top: b.top,
    w: b.w,
    h: b.h,
    // O tempo de deslocamento só aparece com o conjunto de malha viária.
    tempos: conjuntos.includes('viaria') ? { alfa: b.tA, bravo: b.tB } : null,
    // PONTO CEGO É AUSÊNCIA, NÃO ZERO. `estimar` devolve uma linha para TODO
    // bairro, e a do bairro sem cobertura vem com zeros — o que, atravessando
    // até a tela, imprimiria "0 pessoas em risco na Ribeirinha" onde a verdade
    // é "não sabemos". É a mesma distinção que separa `zero` de `none` no
    // relatório do professor, e é a coisa mais importante do modelo: a
    // `cobertura` filtra aqui para que o cliente seja estruturalmente incapaz
    // de confundir as duas. Branco é informação.
    estimativa: (() => {
      const e = porBairro.get(b.slug);
      return e && e.cobertura > 0 ? e : null;
    })(),
  }));

  return { bairros, estimativas };
}

/**
 * Conjuntos que o aluno ainda não carregou. Alimenta o Resultado — a lista do
 * que ele nunca consultou é a peça mais forte do fechamento.
 */
export function naoCarregados(conjuntos: readonly string[]) {
  return CONJUNTOS.filter((c) => !conjuntos.includes(c.slug));
}

/**
 * O QUE SOBROU: o maior bolsão de gente que ficou sem equipe, e a fonte que
 * teria mostrado esse bairro melhor.
 *
 * O aluno terminava a Missão sem conseguir responder "eu acertei?" — quatro
 * leituras do mesmo julgamento na tela e nenhuma conclusiva. Isto NÃO é um
 * veredito: é um fato, com nome de bairro, número de pessoas e a fonte que ele
 * não abriu. Quem transforma fato em lição é o professor, no debate (regra de
 * ouro 2).
 *
 * Roda no servidor porque a cobertura de cada Conjunto é do modelo.
 */
export function oQueSobrou(
  porBairro: readonly { bairro: string; nome: string; emRisco: number; equipe: string | null }[],
  conjuntos: readonly string[],
): { nome: string; pessoas: number; fonte: string | null } | null {
  const semEquipe = [...porBairro]
    .filter((b) => b.equipe === null)
    .sort((a, b) => b.emRisco - a.emRisco)[0];
  if (!semEquipe) return null;

  const melhor = naoCarregados(conjuntos)
    .map((c) => ({ c, cobertura: c.cobertura[semEquipe.bairro] ?? 0 }))
    .filter((x) => x.cobertura > 0)
    .sort((a, b) => b.cobertura - a.cobertura)[0];

  return {
    nome: semEquipe.nome,
    pessoas: semEquipe.emRisco,
    fonte: melhor?.c.rotuloCurto ?? null,
  };
}
