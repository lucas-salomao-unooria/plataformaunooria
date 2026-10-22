import type { ExperienciaHandle } from "@edu/sdk";
import type { AcaoNoFeed, Estado, Gate, Manchete, Sessao } from "./tipos";

/**
 * O handle da experiência, num singleton depois do handshake. Toda chamada à
 * api passa por aqui — nunca `fetch` solto: é o SDK que põe o token, renova,
 * aplica timeout e reenvia GET.
 *
 * A MENSAGEM fala com a IA (a conversa híbrida, ADR-181): o servidor corre
 * até 12 s contra o modelo e, perdendo, responde pela árvore. O padrão do SDK
 * (10 s) cortaria a resposta que já vinha — daí o teto próprio, com folga.
 */
export const TIMEOUT_DA_MENSAGEM_MS = 45_000;

let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

const BASE = "/efeito-amplificador";

export const api = {
  sessao: () => exigir().api.get<Sessao>(`${BASE}/sessao`),
  gate: () => exigir().api.get<Gate>(`${BASE}/gate`),
  entrar: () => exigir().api.post<Estado>(`${BASE}/entrar`),
  mensagem: (texto: string) => exigir().api.post<Estado>(`${BASE}/mensagem`, { texto }, { timeoutMs: TIMEOUT_DA_MENSAGEM_MS }),
  paragrafo: (paragrafoId: string, removido: boolean) => exigir().api.post<Estado>(`${BASE}/paragrafo`, { paragrafoId, removido }),
  publicar: (manchete: Manchete) => exigir().api.post<Estado>(`${BASE}/publicar`, { manchete }),
  feed: (acao: AcaoNoFeed) => exigir().api.post<Estado>(`${BASE}/feed`, acao),
  explicar: () => exigir().api.post<Estado>(`${BASE}/explicar`),
  indicador: (indicador: string) => exigir().api.post<Estado>(`${BASE}/indicador`, { indicador }),
  concluir: () => exigir().api.post<Estado>(`${BASE}/concluir`),
};

/** Fecha a missão na plataforma. Sem `score`: a experiência não pontua (regra 3). */
export function concluirNaPlataforma() {
  exigir().concluir({ dados: {} });
}

export function reportarErro(erro: unknown) {
  handle?.reportarErro(erro);
}

/**
 * O status da falha da api, quando houver. O SDK joga `Error` com
 * "API POST /x → 409" — SEM o corpo; `null` é rede (sem status).
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}
