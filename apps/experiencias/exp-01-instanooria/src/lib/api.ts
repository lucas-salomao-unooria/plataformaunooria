import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Singleton do handle da SDK, preenchido pelo bootstrap ANTES do primeiro
 * render. Existe para o porte ser mecânico: onde o origem fazia
 * `fetch('/api/runs/...')` (mesma origem, cookie), aqui vira
 * `api.get('/runs/...')` — bearer token e apiUrl vêm do `hub:init`, e o token
 * nunca sai da memória da SDK.
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
