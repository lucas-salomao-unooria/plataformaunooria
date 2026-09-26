import type { ExperienciaHandle } from "@edu/sdk";
import type { ClasseDeFalha } from "./tipos";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Toda chamada passa por aqui — nunca `fetch` solto: é o SDK que põe o
 * token, renova, aplica timeout e reenvia GET. Molde: `exp06ef2b/src/lib/api.ts`.
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
  /** O `PUT /quem-mandou-isso/selecao` — o rascunho da triagem. Sem reenvio: o SDK só reenvia GET. */
  put: <T,>(path: string, body?: unknown) => exigir().api.put<T>(path, body),
};

/**
 * Fecha a missão no hub. **Sem `score`**, e a ausência é o desenho: a régua
 * (EF05CO08 pela seleção, EF05CO03/EF05CO04 pelas perguntas) é da api e da
 * evidência (E14), e nenhum número dela aparece para o estudante. O que vai é
 * progresso — e o tamanho da regra, nunca o texto.
 */
export function concluir(dados: Record<string, unknown>) {
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  handle?.enviarEstado(estado);
}

/**
 * Manda a falha ao servidor pelo SDK. Usa o handle direto, e não `exigir()`:
 * quem reporta um erro não pode ganhar outro por causa disso (ADR-84).
 */
export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

/**
 * O status da falha da api, quando houver. O SDK joga `Error` com
 * "API POST /x → 409" — SEM o corpo; por isso a classificação é pelo status.
 * `null` = a chamada nem chegou (sem rede, timeout, CORS).
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}

/**
 * A classe da falha, pelo status.
 *
 * - sem status, 5xx ou 429 → `rede`: o cabeçalho diz "Conectando..." e a
 *   próxima tentativa resolve (o polling de 3 s já é a tentativa). O 429 é o
 *   rate limit por usuário da api — passageiro, e a criança não fez nada errado;
 * - 401 → `sessao-expirada`: a janela "Sua conexão expirou";
 * - 403 → `nao-liberada`: a porta da sala (ADR-69) ou a disponibilidade
 *   (ADR-87) — confundir com rede mandaria a criança recarregar para sempre;
 * - 409 → `conflito`: o relógio da turma andou (ou outra aba agiu) — relê;
 * - 400/404/422 → `recusada`: a tela decide o que a recusa quer dizer;
 * - o resto → `inesperada`.
 */
export function classificar(erro: unknown): ClasseDeFalha {
  const status = statusDoErro(erro);
  if (status === null || status >= 500 || status === 429) return "rede";
  if (status === 401) return "sessao-expirada";
  if (status === 403) return "nao-liberada";
  if (status === 409) return "conflito";
  if (status === 400 || status === 404 || status === 422) return "recusada";
  return "inesperada";
}
