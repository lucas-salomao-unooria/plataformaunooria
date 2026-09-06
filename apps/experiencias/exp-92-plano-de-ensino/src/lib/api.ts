import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Singleton do handle da SDK, preenchido pelo bootstrap ANTES do primeiro
 * render (padrão da exp-01). Onde o app origem fazia `fetch('/api/gerar-plano')`
 * na mesma origem, aqui vira `api.post('/planos')`: bearer token e apiUrl vêm
 * do `hub:init`, e o token nunca sai da memória da SDK.
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
  put: <T = unknown>(path: string, body?: unknown) => experiencia().api.put<T>(path, body),
  patch: <T = unknown>(path: string, body?: unknown) => experiencia().api.patch<T>(path, body),
  delete: <T = unknown>(path: string) => experiencia().api.delete<T>(path),
};

/**
 * A SDK lança `Error("API POST /planos → 409")` sem o corpo. Para a mensagem
 * que o professor lê, o app refaz o pedido de leitura da mensagem? Não: o
 * status já basta para escolher o texto — e evita expor detalhe interno.
 */
export function statusDoErro(erro: unknown): number | null {
  if (!(erro instanceof Error)) return null;
  const m = /→ (\d{3})$/.exec(erro.message);
  return m ? Number(m[1]) : null;
}
