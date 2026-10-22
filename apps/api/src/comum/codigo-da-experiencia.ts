/**
 * O CÓDIGO da experiência (ADR-110), do lado da api.
 *
 * Dois formatos, e só dois:
 *
 * - **missão da trilha**: `exp` + ano (2 dígitos) + etapa (`ef`|`em`) + unidade
 *   (1 a 4) + `b` — `exp08ef1b` é o 8º ano do Fundamental, unidade 1. O código
 *   DIZ onde a missão mora na grade, e por isso é DERIVADO do manifesto
 *   (`series[0]` + `unidade`), nunca escolhido: `tests/codigo-da-experiencia.spec.ts`
 *   reprova o manifesto cujo `id` não é `codigoDaMissao(serie, unidade)`.
 * - **o que não é missão** (produto do professor, o transversal): `app-NN-nome`
 *   — `app-90-plano-de-aula`, `app-70-vila-do-lume`.
 *
 * Antes era `exp-NN-slug`, e o `NN` era a ORDEM DE CRIAÇÃO: a `exp-01` era do 8º
 * ano e a `exp-04` do 1º. O número parecia dizer a série e não dizia.
 *
 * **É o MESMO formato de `packages/sdk/src/codigo-da-experiencia.ts`, copiado**,
 * pela mesma razão de `fuso.ts`: a api não consome pacote de workspace. O teste
 * lê o arquivo do SDK e reprova se as duas cópias divergirem.
 */

/**
 * Missão da trilha: `exp01ef1b` a `exp09ef4b`, `exp01em1b` a `exp03em4b` — e a
 * VERSÃO ANTERIOR de uma delas, `exp02em1b-v0` (ADR-180): a missão que perdeu o
 * código para uma reformulação e continua no ar, fora do catálogo.
 */
export const CODIGO_DE_MISSAO_RE = /^exp(0[1-9]ef|0[1-3]em)[1-4]b(-v\d+)?$/;

/** O que não é missão: `app-NN-nome`. */
export const CODIGO_DE_APP_RE = /^app-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

/** Qualquer experiência — o que rota, catálogo e painel aceitam como `expId`. */
export const EXP_ID_RE = /^(exp(0[1-9]ef|0[1-3]em)[1-4]b(-v\d+)?|app-\d{2}-[a-z0-9]+(-[a-z0-9]+)*)$/;

/** A mensagem de erro do Zod, num lugar só. */
export const FORMATO_DO_EXP_ID = "expId no formato expNNefUb (missão), expNNefUb-vN (versão anterior) ou app-NN-nome";

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

/** O sufixo da versão anterior: `-v0`, `-v1`… */
export const SUFIXO_DE_VERSAO_ANTERIOR_RE = /-v\d+$/;

/**
 * A missão que perdeu o código para uma reformulação (ADR-180) — `exp02em1b-v0`.
 * Continua LIGADA (disponibilidade, liberações, dados e módulo seguem), mas não
 * entra em catálogo nenhum: nem na trilha do professor, nem na grade da sala.
 * Derivado do id, como o arquivamento (`backup-`): não há campo para ficar
 * dessincronizado do nome da pasta.
 */
export function ehVersaoAnterior(expId: string): boolean {
  return CODIGO_DE_MISSAO_RE.test(expId) && SUFIXO_DE_VERSAO_ANTERIOR_RE.test(expId);
}

/** O código vivo de que a versão anterior saiu: `exp02em1b-v0` → `exp02em1b`. */
export function codigoAtualDe(expId: string): string {
  return expId.replace(SUFIXO_DE_VERSAO_ANTERIOR_RE, "");
}
