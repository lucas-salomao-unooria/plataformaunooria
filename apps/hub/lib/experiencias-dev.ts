/**
 * DEV sem manifesto: onde o dev server do Vite de cada experiência está no ar.
 * Usado SÓ quando a tabela `experiencias` não tem a exp e `NODE_ENV !==
 * "production"`. Em produção a URL vem do manifesto (bucket/CDN versionado).
 *
 * A `expOrigin` do postMessage é derivada desta URL — se divergir do `src`
 * do iframe, o hub descarta o `exp:ready` por origin e o handshake expira.
 */
export const EXPERIENCIAS_DEV: Readonly<Record<string, string>> = {
  "exp-01-instanooria": "http://localhost:5173",
  "exp-02-unootube": "http://localhost:5174",
  /** Ferramenta do professor — embedada em /professor/plano-de-aula. */
  "exp-90-plano-de-aula": "http://localhost:5175",
  /**
   * Transversal: não pertence a nenhum ano (`series: []` no manifesto).
   * 5177, não 5176: a 5176 é da exp-91 (bem-estar). Com `strictPort` a colisão
   * falharia alto em vez de o Vite pular de porta e o iframe do hub passar a
   * apontar para a experiência errada.
   */
  "exp-70-vila-do-lume": "http://localhost:5177",
  /** Check-in de bem-estar do professor — embedado em /professor/bem-estar. */
  "exp-91-bem-estar": "http://localhost:5176",
  /** A Missão Tempestade — 2ª série do EM, unidade 1. Próxima porta livre. */
  "exp-03-unoogpt": "http://localhost:5178",
  "exp-07-o-eco-no-grupo": "http://localhost:5179",
  /**
   * O Rastro do Boato — 6º ano, unidade 2.
   *
   * 5181, não 5180: a 5180 está reservada para o planejamento de ensino
   * (exp-92), que corre em outra frente. Com `strictPort` a colisão falharia
   * alto em vez de o Vite pular de porta e o iframe do hub passar a apontar
   * para a experiência errada.
   */
  "exp-06-rastro-boato": "http://localhost:5181",
};

export function baseDevDaExperiencia(expId: string, fallback: string): string {
  return EXPERIENCIAS_DEV[expId] ?? fallback;
}
