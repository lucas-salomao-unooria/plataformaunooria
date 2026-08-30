import type { ExperienciaHandle } from "@edu/sdk";
import type { CodigoErro } from "./tipos";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Molde: `apps/experiencias/exp-02-unootube/src/lib/api.ts`.
 */
let handle: ExperienciaHandle | null = null;

export function definirExperiencia(exp: ExperienciaHandle) {
  handle = exp;
}

function exigir(): ExperienciaHandle {
  if (!handle) throw new Error("experiência usada antes do handshake com o hub");
  return handle;
}

/**
 * Quanto esperar por um turno do Cientista.
 *
 * O default do SDK é 10s — certo para ler catálogo e ERRADO aqui: a resposta
 * passa por até 6 voltas de ferramenta e leva de 10 a 30 segundos. Com o teto
 * padrão o `AbortController` cortava a resposta que já estava sendo gerada, e o
 * estudante lia "não consegui responder" enquanto a api tinha respondido.
 */
export const TIMEOUT_DO_TURNO_MS = 45_000;

export const api = {
  get: <T,>(path: string) => exigir().api.get<T>(path),
  post: <T,>(path: string, body?: unknown) => exigir().api.post<T>(path, body),
  put: <T,>(path: string, body?: unknown) => exigir().api.put<T>(path, body),
  /** Para as rotas que falam com o modelo. */
  postLento: <T,>(path: string, body?: unknown) =>
    exigir().api.post<T>(path, body, { timeoutMs: TIMEOUT_DO_TURNO_MS }),
};

export function estudanteAtual() {
  return exigir().estudante ?? (exigir() as any).aluno;
}

export const alunoAtual = estudanteAtual;

export function concluir(dados: Record<string, unknown>) {
  // SEM `score`: a missão não dá nota. "O propósito não é acertar a alocação" —
  // e mandar um número faria o hub exibir pontuação que o instrumento se recusa
  // a produzir.
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  exigir().enviarEstado(estado);
}

/**
 * Traduz a falha da api no código de jogo, quando houver.
 *
 * O SDK joga `Error` com "API POST /x → 409" — sem o corpo. Aqui o que interessa
 * é o STATUS, porque cada um tem uma frase de tela: 409 é regra do jogo, 429 é
 * teto, 503 é o Cientista fora do ar.
 */
export function codigoDoErro(erro: unknown): CodigoErro | "rede" {
  const texto = erro instanceof Error ? erro.message : String(erro);
  if (/→ 429/.test(texto)) return "teto-da-sessao";
  if (/→ 503/.test(texto)) return "cientista-indisponivel";
  if (/→ 40[03]/.test(texto)) return "payload-invalido";
  if (/→ 409/.test(texto)) return "sessao-encerrada";
  return "rede";
}
