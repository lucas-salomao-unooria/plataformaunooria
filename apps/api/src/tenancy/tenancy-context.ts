import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Contexto da REQUISIÇÃO (AsyncLocalStorage puro — sem dependência de
 * nestjs-cls). Começou como só `{ escolaId }` para a tenancy; hoje carrega
 * também o que o log precisa para correlacionar uma linha com a requisição, o
 * trace e a escola sem que quem escreve o log lembre de nada disso.
 *
 * Quem ABRE o store é o `contextoMiddleware` (Express, registrado em `main.ts`),
 * antes de qualquer guard — é por isso que um 401 do OidcGuard sai com
 * `requestId`. Quem PREENCHE `escolaId`/`perfil` é o TenancyInterceptor, que
 * roda depois dos guards e MUTA o mesmo store: o ExceptionFilter, que executa
 * fora da cadeia do interceptor, lê a escola daqui.
 */
export interface ContextoDaRequisicao {
  /** Igual ao `traceId` quando o LB mandou um; senão um UUID. Vai no corpo do 500. */
  requestId: string;
  traceId?: string;
  spanId?: string;
  amostrado?: boolean;
  escolaId?: string;
  perfil?: string;
}

const storage = new AsyncLocalStorage<ContextoDaRequisicao>();

/** Abre um contexto novo para `fn`. Uso: middleware de requisição, worker, seed. */
export function abrirContexto<T>(inicial: ContextoDaRequisicao, fn: () => T): T {
  return storage.run(inicial, fn);
}

export function contextoAtual(): ContextoDaRequisicao | undefined {
  return storage.getStore();
}

/**
 * Preenche a tenancy no store JÁ aberto pelo middleware. Devolve `false` fora
 * de requisição (teste que instancia o interceptor sem middleware, por
 * exemplo) — o chamador decide o que fazer.
 */
export function definirTenancyNoContexto(dados: { escolaId?: string; perfil?: string }): boolean {
  const store = storage.getStore();
  if (!store) return false;
  if (dados.escolaId !== undefined) store.escolaId = dados.escolaId;
  if (dados.perfil !== undefined) store.perfil = dados.perfil;
  return true;
}

/**
 * Executa `fn` com `escolaId` no contexto. Fora de requisição (seed, worker,
 * teste) abre um store novo com `requestId` próprio; dentro de uma, abre uma
 * CÓPIA com a escola trocada — o store da requisição continua intacto quando
 * `fn` volta.
 */
export function comEscolaNoContexto<T>(escolaId: string, fn: () => T): T {
  const atual = storage.getStore();
  return storage.run({ ...(atual ?? { requestId: randomUUID() }), escolaId }, fn);
}

export function escolaDoContexto(): string | undefined {
  return storage.getStore()?.escolaId;
}
