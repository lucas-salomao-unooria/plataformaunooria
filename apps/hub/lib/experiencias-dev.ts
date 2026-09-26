/**
 * DEV sem manifesto: onde o dev server do Vite de cada experiência está no ar.
 * Usado SÓ quando a tabela `experiencias` não tem a exp e `NODE_ENV !==
 * "production"`. Em produção a URL vem do manifesto (bucket/CDN versionado).
 *
 * A `expOrigin` do postMessage é derivada desta URL — se divergir do `src`
 * do iframe, o hub descarta o `exp:ready` por origin e o handshake expira.
 */
export const EXPERIENCIAS_DEV: Readonly<Record<string, string>> = {
  "exp08ef1b": "http://localhost:5173",
  "exp04ef1b": "http://localhost:5174",
  /** Ferramenta do professor — embedada em /professor/plano-de-aula. */
  "app-90-plano-de-aula": "http://localhost:5175",
  /**
   * Transversal: não pertence a nenhum ano (`series: []` no manifesto).
   * 5177, não 5176: a 5176 é da app-91 (bem-estar). Com `strictPort` a colisão
   * falharia alto em vez de o Vite pular de porta e o iframe do hub passar a
   * apontar para a experiência errada.
   */
  "app-70-vila-do-lume": "http://localhost:5177",
  /** Check-in de bem-estar do professor — embedado em /professor/bem-estar. */
  "app-91-bem-estar": "http://localhost:5176",
  /** A Missão Tempestade — 2ª série do EM, unidade 1. Próxima porta livre. */
  "exp02em1b": "http://localhost:5178",
  /** A Seleção — 7º ano, unidade 1. A 5179 era do Eco no Grupo, que ela substitui (ADR-113). */
  "exp07ef1b": "http://localhost:5179",
  /**
   * O Rastro do Boato — 6º ano, unidade 2.
   *
   * 5181, não 5180: a 5180 está reservada para o planejamento de ensino
   * (app-92), que corre em outra frente. Com `strictPort` a colisão falharia
   * alto em vez de o Vite pular de porta e o iframe do hub passar a apontar
   * para a experiência errada.
   */
  "exp06ef2b": "http://localhost:5181",
  /** Planejamento de ensino do professor — embedado em /professor/plano-de-ensino. */
  "app-92-plano-de-ensino": "http://localhost:5180",
  /**
   * O Manifesto da IA — 8º ano, unidade 4.
   *
   * 5182, e não 5180 nem 5183: a 5180 é da app-92, a 5181 é da exp06ef2b e a 5183
   * está reservada para outra frente em andamento. Com `strictPort` a colisão
   * falharia alto em vez de o Vite pular de porta e o iframe do hub passar a
   * apontar para a experiência errada.
   */
  "exp08ef4b": "http://localhost:5182",
  /**
   * O Que a Foto Conta — 1º ano EF, unidade 1.
   *
   * 5183, não 5182: a 5182 está reservada para a exp08ef4b (manifesto-ia), que
   * corre em outra frente. A porta entra também no CORS_ORIGINS da api — sem
   * ela o boot da missão morre com "Failed to fetch" e o erro não diz por quê.
   */
  "exp01ef1b": "http://localhost:5183",
  /**
   * Quem mandou isso? — 5º ano EF, unidade 1.
   *
   * 5184 porque é a PRIMEIRA porta livre: 5180 é da app-92, 5181 da exp06ef2b,
   * 5182 da exp08ef4b e 5183 da exp01ef1b. Não há escolha estética aqui — o que
   * importa é que duas experiências nunca peçam a mesma. Com `strictPort` a
   * colisão falha alto; sem ele o Vite pula de porta em silêncio e o iframe do
   * hub passa a apontar para a experiência errada, com o handshake morrendo por
   * origin. A porta entra também no CORS_ORIGINS da api — sem ela o boot da
   * missão morre com "Failed to fetch", e o erro não diz por quê.
   */
  "exp05ef1b": "http://localhost:5184",
};

export function baseDevDaExperiencia(expId: string, fallback: string): string {
  return EXPERIENCIAS_DEV[expId] ?? fallback;
}
