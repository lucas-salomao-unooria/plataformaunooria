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
  /** O Jornal da Escola (4º ano, unidade 1). A porta era do UnooTube, hoje
   *  ARQUIVADO como `backup-exp04ef1b` (ADR-116), que não sobe mais em dev. */
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
  /** O Efeito Amplificador — 2ª série do EM, unidade 1 (ADR-181). A porta é a
   *  da Missão Tempestade, que virou `exp02em1b-v0` e foi para a 5186. */
  "exp02em1b": "http://localhost:5178",
  /** A Missão Tempestade, VERSÃO ANTERIOR (ADR-181): fora do catálogo, mas no ar.
   *  Sobe só no profile `anteriores` do compose. */
  "exp02em1b-v0": "http://localhost:5186",
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
   * Quem Mandou Isso? v2.2 — 5º ano EF, unidade 1.
   *
   * A MESMA 5184 da v1, que ficou reservada na retirada dela (ADR-114): a v2.2
   * volta com o mesmo código, e a porta continuou no CORS_ORIGINS da api — sem
   * ela o boot da missão morre com "Failed to fetch" e o erro não diz por quê.
   * Experiência nova pede a próxima livre depois dela.
   */
  "exp05ef1b": "http://localhost:5184",
  /**
   * O Júri Estadual de Projetos — 6º ano EF, unidade 1.
   *
   * 5185, a próxima livre depois da exp05ef1b. A porta entra também no
   * CORS_ORIGINS da api (`docker-compose.dev.yml`, `.env.example`) — sem ela o
   * boot da missão morre com "Failed to fetch" e o erro não diz por quê.
   */
  "exp06ef1b": "http://localhost:5185",
  /**
   * O Enigma da Capa da Rádio — 2º ano EF, unidade 1 (ADR-184).
   *
   * 5187, a próxima livre depois da 5186 (a exp02em1b-v0). A porta entra também
   * no CORS_ORIGINS da api — sem ela o boot da missão morre com "Failed to
   * fetch" e o erro não diz por quê.
   */
  "exp02ef1b": "http://localhost:5187",
};

export function baseDevDaExperiencia(expId: string, fallback: string): string {
  return EXPERIENCIAS_DEV[expId] ?? fallback;
}
