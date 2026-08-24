import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexto de tenancy por requisição (AsyncLocalStorage puro — sem dependência
 * de nestjs-cls). O TenancyInterceptor abre o contexto com a escola do token;
 * o PrismaService lê daqui dentro de `comTenancy`.
 */
const storage = new AsyncLocalStorage<{ escolaId: string }>();

export function comEscolaNoContexto<T>(escolaId: string, fn: () => T): T {
  return storage.run({ escolaId }, fn);
}

export function escolaDoContexto(): string | undefined {
  return storage.getStore()?.escolaId;
}
