/**
 * Substituto de `server-only` nos testes do vitest. O pacote real LANÇA ao ser
 * importado fora de um React Server Component — é a guarda dele. No vitest
 * (Node puro) isso derrubaria qualquer teste que toque `lib/log.ts` ou
 * `lib/api-servidor.ts`; o alias em `vitest.config.ts` aponta para aqui.
 */
export {};
