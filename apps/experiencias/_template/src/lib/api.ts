import type { ExperienciaHandle } from "@edu/sdk";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Toda chamada à api passa por aqui — nunca `fetch` solto: é o SDK que
 * põe o token, renova, aplica timeout e reenvia GET. Molde:
 * `apps/experiencias/exp08ef4b/src/lib/api.ts`.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

export const api = {
  get: <T,>(path: string) => exigir().api.get<T>(path),
  post: <T,>(path: string, body?: unknown) => exigir().api.post<T>(path, body),
};

export function estudanteAtual() {
  return exigir().estudante;
}

/**
 * Fecha a missão. Sem `score` por padrão: a experiência não sabe pontuar e não
 * deve saber (regra 3). Se a missão tem nota, o número sai da api e entra aqui
 * como `concluir({ score, dados })`.
 */
export function concluir(dados: Record<string, unknown>) {
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  exigir().enviarEstado(estado);
}

export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

/**
 * O status da falha da api, quando houver. O SDK joga `Error` com
 * "API POST /x → 409" — SEM o corpo; por isso a classificação é pelo status.
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}
