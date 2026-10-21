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

/**
 * O teto das rotas que esperam o MODELO. O padrão do SDK é 10 s, e as reações
 * das personas ao post do estudante levam de 20 a 30 s: com o padrão, o
 * navegador desistia antes, o servidor terminava e gravava as reações, e o
 * estudante nunca as via — o `catch` do "sem rede" engolia o aborto em
 * silêncio (o mesmo teto da exp02em1b).
 */
export const TIMEOUT_DA_IA_MS = 45_000;

export const api = {
  get: <T = unknown>(path: string) => experiencia().api.get<T>(path),
  post: <T = unknown>(path: string, body?: unknown) => experiencia().api.post<T>(path, body),
  /** Para as rotas que chamam o modelo (hoje, o post do estudante). */
  postLento: <T = unknown>(path: string, body?: unknown) =>
    experiencia().api.post<T>(path, body, { timeoutMs: TIMEOUT_DA_IA_MS }),
};
