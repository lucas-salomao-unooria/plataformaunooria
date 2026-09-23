/**
 * O CÓDIGO da experiência (ADR-110), do lado do hub e das experiências.
 *
 * Missão da trilha: `expNNefUb` / `expNNemUb` (`exp08ef1b` = 8º ano do
 * Fundamental, unidade 1), derivado de `series[0]` + `unidade` do manifesto. O
 * que não é missão (produto do professor, o transversal): `app-NN-nome`.
 *
 * **É o MESMO formato de `apps/api/src/comum/codigo-da-experiencia.ts`,
 * copiado**, como o `fuso.ts`: a api não consome pacote de workspace, e
 * `apps/api/tests/codigo-da-experiencia.spec.ts` lê ESTE arquivo e reprova se
 * as duas cópias divergirem. Mudou aqui, muda lá — ou o CI acusa.
 */

/** Missão da trilha: `exp01ef1b` a `exp09ef4b`, `exp01em1b` a `exp03em4b`. */
export const CODIGO_DE_MISSAO_RE = /^exp(0[1-9]ef|0[1-3]em)[1-4]b$/;

/** O que não é missão: `app-NN-nome`. */
export const CODIGO_DE_APP_RE = /^app-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

/** Qualquer experiência — o que rota, catálogo e painel aceitam como `expId`. */
export const EXP_ID_RE = /^(exp(0[1-9]ef|0[1-3]em)[1-4]b|app-\d{2}-[a-z0-9]+(-[a-z0-9]+)*)$/;

/** A mensagem de erro do Zod, num lugar só. */
export const FORMATO_DO_EXP_ID = "expId no formato expNNefUb (missão) ou app-NN-nome";

/**
 * O código de uma missão a partir da série canônica (`8EF`, `2EM`) e da
 * unidade. Lança em entrada fora da grade: quem chama é teste e script, e um
 * código inventado em silêncio é o defeito que este formato existe para fechar.
 */
export function codigoDaMissao(serie: string, unidade: number): string {
  const [, ano, etapa] = /^([1-9])(EF|EM)$/.exec(serie) ?? [];
  if (!ano || !etapa || (etapa === "EM" && Number(ano) > 3)) {
    throw new Error(`série fora da grade: ${serie}`);
  }
  if (!Number.isInteger(unidade) || unidade < 1 || unidade > 4) {
    throw new Error(`unidade fora da grade: ${unidade}`);
  }
  return `exp0${ano}${etapa.toLowerCase()}${unidade}b`;
}
