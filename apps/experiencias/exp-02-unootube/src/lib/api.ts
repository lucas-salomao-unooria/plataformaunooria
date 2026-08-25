import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Singleton do handle da SDK, preenchido pelo bootstrap ANTES do primeiro
 * render (mesmo padrão da exp-01). Bearer token e apiUrl vêm do `hub:init`;
 * o token nunca sai da memória da SDK.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

export function experiencia(): ExperienciaHandle {
  if (!handle) throw new Error("SDK ainda não conectada — o bootstrap define antes do render");
  return handle;
}

export const api = {
  get: <T = unknown>(path: string) => experiencia().api.get<T>(path),
  post: <T = unknown>(path: string, body?: unknown) => experiencia().api.post<T>(path, body),
};

/** Código legível que a api devolve em `{codigo, mensagem}` — ou null se não for esse formato. */
export function codigoDoErro(falha: unknown): string | null {
  if (typeof falha !== "object" || falha === null) return null;
  const mensagem = (falha as { message?: unknown }).message;
  if (typeof mensagem !== "string") return null;
  const m = /"codigo":"([A-Z_]+)"/.exec(mensagem);
  return m?.[1] ?? null;
}
