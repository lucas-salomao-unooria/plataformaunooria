/**
 * As réguas da sessão do estudante: os tamanhos da tríade, da legenda e da
 * reflexão, e a contagem que os dois lados (Zod e banco) fazem igual.
 *
 * **Tudo em CODE POINTS**, e é a razão de este arquivo existir. `"😀".length`
 * é 2 em JavaScript e `char_length('😀')` é 1 no Postgres; com o Zod contando
 * `length` e o CHECK contando `char_length`, uma reflexão de 99 letras e um
 * emoji passa no Zod como 101 e o banco a recusa como 100 — ou, no teto, o Zod
 * recusa o que o banco aceitaria. O defeito existe na exp05ef1b (o Zod de lá
 * usa `.min()`/`.max()` de `length`). Aqui o Zod usa `codePoints`, a coluna
 * `chars` grava `codePoints`, e o CHECK confere `chars = char_length(texto)`.
 */

/** Exatamente três posts nos Stories: é o corte que a missão mede. */
export const TAMANHO_DA_SELECAO = 3;

/** A legenda dos Stories: "1 frase", com piso para frear a impulsividade (RF-004). */
export const LEGENDA_MIN = 10;
export const LEGENDA_MAX = 140;

/** A reflexão da Etapa 6: o PRD vence o parecer E4-A1 (decisão de 25/09). */
export const REFLEXAO_MIN = 100;
export const REFLEXAO_MAX = 500;

/**
 * Teto do tempo de feed que a tela informa. Acima de uma hora é aba esquecida,
 * não leitura — e o número é INDICATIVO (grau `indicative` da spec): não entra
 * em conta nenhuma, só no painel como conduta.
 */
export const TEMPO_DE_FEED_MAX_S = 3600;

/** Quantos caracteres o Postgres conta — o `char_length`, e não o `.length`. */
export function codePoints(texto: string): number {
  return [...texto].length;
}

/**
 * A legenda como ela é GRAVADA: sem espaço nas pontas e sem quebra de linha.
 * É uma frase de Stories, e uma legenda com cinco linhas em branco no meio
 * passaria o piso de 10 e chegaria ao Mural do colega como um bloco vazio.
 */
export function normalizarLegenda(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** A reflexão como ela é gravada: só sem as pontas — parágrafo é da criança. */
export function normalizarReflexao(texto: string): string {
  return texto.trim();
}

export function dentroDe(texto: string, min: number, max: number): boolean {
  const n = codePoints(texto);
  return n >= min && n <= max;
}

/**
 * A tríade que chegou é desta cobertura? Três ids DISTINTOS e todos dela. O
 * Zod já cobra o formato; o que ele não sabe é a cobertura da turma — um id
 * válido de uma cobertura que a professora trocou é uma tela velha falando
 * com um lote novo.
 */
export function selecaoValida(selecao: readonly string[], idsDaCobertura: ReadonlySet<string>): boolean {
  if (selecao.length !== TAMANHO_DA_SELECAO) return false;
  if (new Set(selecao).size !== selecao.length) return false;
  return selecao.every((id) => idsDaCobertura.has(id));
}
