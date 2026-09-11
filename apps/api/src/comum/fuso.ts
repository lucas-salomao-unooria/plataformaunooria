/**
 * O FUSO da plataforma, do lado da api.
 *
 * **É a MESMA constante de `packages/sdk/src/fuso.ts`, copiada.** A api não
 * consome pacote de workspace — `packages/AGENTS.md` registra a regra e a
 * exceção do logger —, e arrastar o `@edu/sdk` inteiro (handshake,
 * `postMessage`, telemetria de navegador) para dentro do NestJS por causa de
 * uma string seria pior que a cópia.
 *
 * O que segura a igualdade **não é confiança**: `tests/fuso-da-plataforma.spec.ts`
 * lê o arquivo do SDK e reprova se os dois valores divergirem. É a diferença
 * entre esta cópia e a da copy da exp-01, que só tem um comentário guardando.
 *
 * Ele existia desde sempre em `src/bemestar/catalogo.ts`, onde ninguém fora do
 * bem-estar o acharia — e por isso o hub formatou data sem fuso nenhum por
 * meses. A decisão, as alternativas e o gatilho de reavaliação estão na ADR-98.
 */
export const FUSO = "America/Sao_Paulo";

/**
 * `2026-09-11` — o DIA no fuso da plataforma.
 *
 * `toISOString().slice(0, 10)` daria o dia em UTC, e às 22h de Brasília isso é
 * o dia seguinte: um check-in feito à noite contaria como o de amanhã, e o de
 * amanhã seria recusado por "já respondeu hoje".
 */
export function diaDaPlataforma(instante: Date, fuso: string = FUSO): string {
  // `en-CA` porque o formato dele JÁ é `YYYY-MM-DD`; montar a string a partir
  // das partes de `pt-BR` reintroduziria a inversão de dia e mês.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}
