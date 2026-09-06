import type { ExperienciaHandle } from "@edu/sdk";
import type { CodigoErro } from "./tipos";

/**
 * O handle da experiência, guardado num singleton depois do handshake com o
 * hub. Molde: `apps/experiencias/exp-07-o-eco-no-grupo/src/lib/api.ts`.
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
 * Fecha a missão. **Sem `score` calculado aqui**: a experiência não sabe
 * pontuar e não deve saber. O número que vai ao hub sai da api
 * (`regras/pontuacao.ts`) e não aparece em tela nenhuma desta missão — ele
 * existe para o progresso da plataforma.
 */
export function concluir(dados: Record<string, unknown>) {
  exigir().concluir({ dados });
}

export function enviarEstado(estado: Record<string, unknown>) {
  exigir().enviarEstado(estado);
}

/**
 * Traduz a falha da api no código de jogo, quando houver.
 *
 * O SDK joga `Error` com "API POST /x → 409" — **sem o corpo**. Por isso a
 * classificação é pelo STATUS. O 409 é ambíguo de propósito (o gate da aula e o
 * latch da decisão respondem o mesmo): quem sabe distinguir é a TELA, que
 * conhece o passo em que estava quando chamou.
 */
export function statusDoErro(erro: unknown): number | null {
  const texto = erro instanceof Error ? erro.message : String(erro);
  const casou = /→ (\d{3})/.exec(texto);
  return casou ? Number(casou[1]) : null;
}

export function codigoDoErro(erro: unknown): CodigoErro {
  switch (statusDoErro(erro)) {
    case 409:
      return "decisao-ja-registrada";
    case 400:
      return "payload-invalido";
    default:
      return "rede";
  }
}
