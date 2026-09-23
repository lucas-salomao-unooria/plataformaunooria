import type { ExperienciaHandle } from "@edu/sdk";
import type { CodigoErro } from "./tipos";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Molde: `apps/experiencias/exp02em1b/src/lib/api.ts`.
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
 * Quanto esperar por uma resposta de Amara.
 *
 * O default do SDK é 10 s — certo para ler o catálogo e curto para uma conversa
 * com o modelo, que leva de 5 a 20 s. Com o teto padrão o `AbortController`
 * cortaria uma resposta que já estava sendo escrita, e o estudante leria
 * "Amara não conseguiu responder" enquanto a api tinha respondido.
 */
export const TIMEOUT_DA_CONVERSA_MS = 45_000;

export const api = {
  get: <T,>(path: string) => exigir().api.get<T>(path),
  post: <T,>(path: string, body?: unknown) => exigir().api.post<T>(path, body),
  /** Para a rota que fala com o modelo. */
  postLento: <T,>(path: string, body?: unknown) =>
    exigir().api.post<T>(path, body, { timeoutMs: TIMEOUT_DA_CONVERSA_MS }),
};

export function estudanteAtual() {
  return exigir().estudante;
}

/**
 * Fecha a missão. O `score` vem da API (`regras/pontuacao.ts`), nunca do
 * cliente: quem corrige é o servidor, e o número não aparece em tela nenhuma
 * desta experiência — ele existe para o hub e para o painel.
 */
export function concluir(score: number, dados: Record<string, unknown>) {
  exigir().concluir({ score, dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  exigir().enviarEstado(estado);
}

/**
 * Traduz a falha da api no código de jogo, quando houver.
 *
 * O SDK joga `Error` com "API POST /x → 409" — **sem o corpo**. Por isso a
 * classificação é pelo STATUS: 409 é regra do jogo (a professora ainda não
 * abriu a aula, a resposta já foi enviada), 429 é teto de IA, 503 é o modelo
 * fora do ar. Cada um tem uma frase própria, e todas dentro da ficção.
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}

export function codigoDoErro(erro: unknown): CodigoErro {
  switch (statusDoErro(erro)) {
    case 429:
      return "teto-da-sessao";
    case 503:
      return "amara-indisponivel";
    case 409:
      return "resposta-ja-enviada";
    case 400:
      return "payload-invalido";
    default:
      return "rede";
  }
}
